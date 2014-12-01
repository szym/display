'use strict';

// Window management for litegfx.js
// Copyright 2014, Szymon Jakubczak
// Based on https://github.com/chjj/tty.js by Christopher Jeffrey
//
(function() {

////////////
// Elements

var document = this.document
  , window = this
  , root
  , body;

///////////
// Helpers

function on(el, type, handler, capture) {
  el.addEventListener(type, handler, capture || false);
}

function off(el, type, handler, capture) {
  el.removeEventListener(type, handler, capture || false);
}

function cancel(ev) {
  if (ev.preventDefault) ev.preventDefault();
  ev.returnValue = false;
  if (ev.stopPropagation) ev.stopPropagation();
  ev.cancelBubble = true;
  return false;
}

function dispatchEvent(el, type) {
  var ev = document.createEvent('Event');
  ev.initEvent(type, true, true);
  el.dispatchEvent(ev);
}

/////////
// wm

var wm = {};

wm.open = function() {
  var base = '';
  if (document.location.pathname) {
    var parts = document.location.pathname.split('/');
    base = parts.slice(0, parts.length - 1).join('/').substring(1) + '/';
  }
  var socket = io.connect(null, { resource: base + 'socket.io' });

  wm.windows = {};

  root = document.documentElement;
  body = document.body;

  socket.on('render', function(data) {
    var divid = data.match(/dom_(\d*)/)[0];
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4 && xhr.status == 200) {
        var pane = wm.windows[divid];
        if (!pane) {
          pane = new Pane(divid);
          console.log('creating new pane with ID = ' + divid);
          // TODO: set default width/height to something reasonable...
        }
        var content = pane.content;
        content.innerHTML = xhr.responseText;
        pane.zoomable = (content.getElementsByClassName('zoomable').length > 0);

        // force script eval:
        var scripts = content.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; ++i) {
          eval(scripts[i].text);
        }
        if (content.parentNode.style.height)
          dispatchEvent(content, 'resizepane');
      }
    };
    xhr.open('GET', data, true);
    xhr.send();
  });
};

////////
// Pane

function Pane(divid) {
  var self = this;

  var el = document.createElement('div');
  el.className = 'window';

  var grip = document.createElement('div');
  grip.className = 'grip';

  var bar = document.createElement('div');
  bar.className = 'bar';

  var button = document.createElement('div');
  button.innerHTML = 'x';
  button.title = 'close';
  button.className = 'tab';

  var title = document.createElement('div');
  title.className = 'title';
  title.innerHTML = '';

  var content = document.createElement('div');
  content.className = 'content';

  this.divid = divid;
  this.element = el;
  this.grip = grip;
  this.title = title;
  this.content = content;

  el.appendChild(grip);
  el.appendChild(bar);
  el.appendChild(content);
  bar.appendChild(button);
  bar.appendChild(title);
  body.appendChild(el);

  wm.windows[divid] = this;

  this.zoomable = false;

  on(button, 'click', function(ev) {
    self.destroy();
    return cancel(ev);
  });

  on(grip, 'mousedown', function(ev) {
    self.focus();
    self.resizing(ev);
    return cancel(ev);
  });

  on(el, 'mousedown', function(ev) {
    if (ev.target !== el && ev.target !== bar) return;
    self.focus();
    self.drag(ev);
    return cancel(ev);
  });

  on(bar, 'dblclick', function(ev) {
    self.maximize();
  });

  on(content, 'wheel', function(ev) {
    if (!self.zoomable) return;
    self.zoom(ev);
    return cancel(ev);
  });

  on(content, 'mousedown', function(ev) {
    if (!self.zoomable) return;
    self.focus();
    self.pan(ev);
    return cancel(ev);
  });

  on(content, 'dblclick', function(ev) {
    if (!self.zoomable) return;
    self.reset();
    return cancel(ev);
  });

  this.focus();

  var position = JSON.parse(localStorage.getItem(divid) || 'false');
  if (position) {
    if (position.maximized) {
      this.maximize();
    } else {
      el.style.left = position.left;
      el.style.top = position.top;
      el.style.width = position.width;
      el.style.height = position.height;
    }
  }
}

Pane.prototype.focus = function() {
  // Restack, but only if not already last.
  if (!this.element.nextSibling) return;
  var parent = this.element.parentNode;
  if (parent) {
    parent.removeChild(this.element);
    parent.appendChild(this.element);
  }
};

Pane.prototype.save = function() {
  var el = this.element;
  var position = {
    left: el.style.left,
    top: el.style.top,
    width: el.style.width,
    height: el.style.height,
    maximized: false, // ('minimize' in this),
  };
  localStorage.setItem(this.divid, JSON.stringify(position));
}

Pane.prototype.destroy = function() {
  if (this.destroyed) return;
  this.destroyed = true;

  delete wm.windows[this.divid];
  this.element.parentNode.removeChild(this.element);
  localStorage.removeItem(this.divid);
};

Pane.prototype.drag = function(ev) {
  var self = this
    , el = this.element;

  if (this.minimize) return;

  var drag = {
    left: el.offsetLeft - ev.pageX,
    top: el.offsetTop - ev.pageY,
  };

  el.style.opacity = '0.60';
  root.style.cursor = 'move';

  function move(ev) {
    el.style.left = (drag.left + ev.pageX) + 'px';
    el.style.top = (drag.top + ev.pageY) + 'px';
  }

  function up() {
    el.style.opacity = '';
    root.style.cursor = '';

    off(document, 'mousemove', move);
    off(document, 'mouseup', up);
    self.save();
  }

  on(document, 'mousemove', move);
  on(document, 'mouseup', up);
};

Pane.prototype.resizing = function(ev) {
  var self = this
    , el = this.element;

  if (this.minimize) delete this.minimize;
  var resize = {
    w: el.clientWidth,
    h: el.clientHeight
  };

  el.style.opacity = '0.70';
  root.style.cursor = 'se-resize';

  function move(ev) {
    el.style.width = (ev.pageX - el.offsetLeft) + 'px';
    el.style.height = (ev.pageY - el.offsetTop) + 'px';
  }

  function up(ev) {
    move(ev);

    el.style.opacity = '';
    root.style.cursor = '';
    off(document, 'mousemove', move);
    off(document, 'mouseup', up);
    self.save();
    dispatchEvent(self.content, 'resizepane');
  }

  on(document, 'mousemove', move);
  on(document, 'mouseup', up);
};

Pane.prototype.maximize = function() {
  if (this.minimize) return this.minimize();

  var self = this
    , el = this.element
    , grip = this.grip;

  var m = {
    left: el.offsetLeft,
    top: el.offsetTop,
    width: el.clientWidth,
    height: el.clientHeight,
  };

  this.minimize = function() {
    delete self.minimize;

    el.style.left = m.left + 'px';
    el.style.top = m.top + 'px';
    el.style.width = m.width + 'px';
    el.style.height = m.height + 'px';
    el.style.boxSizing = '';
    grip.style.display = '';
    self.save();
  };

  window.scrollTo(0, 0);

  el.style.left = '0px';
  el.style.top = '0px';
  el.style.width = '100%';
  el.style.height = '100%';
  el.style.boxSizing = 'border-box';
  grip.style.display = 'none';
  self.save();
};

Pane.prototype.moveContent = function(left, top) {
  var el = this.element, content = this.content;
  content.style.left = Math.min(0, Math.max(el.clientWidth - content.clientWidth, left)) + 'px';
  content.style.top = Math.min(0, Math.max(el.clientHeight - content.clientHeight, top)) + 'px';
}

Pane.prototype.zoom = function(ev) {
  var el = this.element, content = this.content;

  var delta = (ev.deltaMode === ev.DOM_DELTA_PIXEL) ? ev.deltaY : ev.deltaY * 40;
  var scale = Math.exp(delta / 800.);

  // Don't shrink below 100px.
  if (content.clientWidth * scale < 100) scale = 100 / content.clientWidth;

  content.style.width = content.clientWidth * scale + 'px';
  content.style.height = content.clientHeight * scale + 'px';

  this.moveContent(content.offsetLeft + (1 - scale) * ev.layerX, content.offsetTop + (1 - scale) * ev.layerY);
};

Pane.prototype.pan = function(ev) {
  var self = this, content = this.content;

  var drag = {
    left: content.offsetLeft  - ev.pageX,
    top: content.offsetTop - ev.pageY,
  };

  content.style.cursor = 'move';

  function move(ev) {
    self.moveContent(drag.left + ev.pageX, drag.top + ev.pageY);
  }

  function up(ev) {
    move(ev);

    content.style.cursor = '';
    off(document, 'mousemove', move);
    off(document, 'mouseup', up);
  }

  on(document, 'mousemove', move);
  on(document, 'mouseup', up);
};

Pane.prototype.reset = function() {
  var c = this.content;

  c.style.left = '';
  c.style.top = '';
  c.style.width ='';
  c.style.height = '';
};

////////
// Load

function load() {
  wm.open();
  off(document, 'DOMContentLoaded', load);
}

on(document, 'DOMContentLoaded', load);

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());
