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

function indexOf(obj, el) {
  var i = obj.length;
  while (i--) {
    if (obj[i] === el) return i;
  }
  return -1;
}

function splice(obj, el) {
  var i = indexOf(obj, el);
  if (~i) obj.splice(i, 1);
}

function dispatchResize(divid) {
  var ev = document.createEvent('Event');
  ev.initEvent('resizepane', true, true);
  // TODO: refactor the pane_ + divid logic
  document.getElementById('pane_' + divid).dispatchEvent(ev);
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

  wm.windows = [];

  root = document.documentElement;
  body = document.body;
  var lights = document.getElementById('lights');

  wm.toggleLights(); /* make dark mode the default light-scheme */

  if (lights) {
    on(lights, 'click', function() {
      wm.toggleLights();
    });
  }

  socket.on('connect', function() {
    wm.reset();
  });

  socket.on('render', function(data) {
    var divid = data.match(/dom_(\d*)/)[0];
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4 && xhr.status == 200) {
        // create new pane for resource:
        var el = document.getElementById('pane_' + divid);
        if (!el) {
          var pane = new Pane(divid);
          el = document.createElement('span');
          el.setAttribute('id', 'pane_' + divid);
          console.log('creating new pane with ID = ' + divid);
          pane.element.appendChild(el);
        } else {
          console.log('reusing pane with ID = ' + divid);
        }
        el.innerHTML = xhr.responseText;

        // force script eval:
        var scripts = el.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; ++i) {
          eval(scripts[i].text);
        }
        console.log('sending resize after render');
        dispatchResize(divid);
      }
    };
    xhr.open('GET', data, true);
    xhr.send();
  });


  // Keep windows maximized.
  on(window, 'resize', function() {
    var i = wm.windows.length
      , win;

    while (i--) {
      win = wm.windows[i];
      if (win.minimize) {
        win.minimize();
        win.maximize();
      }
    }
  });
};

wm.reset = function() {
  var i = wm.windows.length;
  while (i--) {
    wm.windows[i].destroy();
  }

  wm.windows = [];
};

wm.toggleLights = function() {
  root.className = !root.className ? 'dark' : '';
};

////////
// Pane

function Pane(divid) {
  var self = this;

  var el
    , grip
    , bar
    , button
    , title;

  el = document.createElement('div');
  el.className = 'window';

  grip = document.createElement('div');
  grip.className = 'grip';

  bar = document.createElement('div');
  bar.className = 'bar';

  button = document.createElement('div');
  button.innerHTML = 'x';
  button.title = 'close';
  button.className = 'tab';

  title = document.createElement('div');
  title.className = 'title';
  title.innerHTML = '';

  this.divid = divid;
  this.element = el;
  this.grip = grip;
  this.title = title;

  el.appendChild(grip);
  el.appendChild(bar);
  bar.appendChild(button);
  bar.appendChild(title);
  body.appendChild(el);

  wm.windows.push(this);

  on(button, 'click', function(ev) {
    self.destroy();
    return cancel(ev);
  });

  on(grip, 'mousedown', function(ev) {
    self.focus();
    self.resizing(ev);
    return cancel(ev);
  });

  var last = 0;
  on(el, 'mousedown', function(ev) {
    if (ev.target !== el && ev.target !== bar) return;

    self.focus();
    cancel(ev);

    // handle double-click
    if (new Date - last < 300) {
      return self.maximize();
    }
    last = new Date;

    self.drag(ev);
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
  // Restack
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
  dispatchResize(this.divid);
}

Pane.prototype.destroy = function() {
  if (this.destroyed) return;
  this.destroyed = true;

  if (this.minimize) this.minimize();

  splice(wm.windows, this);
  this.element.parentNode.removeChild(this.element);
  localStorage.removeItem(this.divid);
};

Pane.prototype.drag = function(ev) {
  var self = this
    , el = this.element;

  if (this.minimize) return;

  var drag = {
    left: el.offsetLeft,
    top: el.offsetTop,
    pageX: ev.pageX,
    pageY: ev.pageY
  };

  el.style.opacity = '0.60';
  root.style.cursor = 'move';

  function move(ev) {
    el.style.left = (drag.left + ev.pageX - drag.pageX) + 'px';
    el.style.top = (drag.top + ev.pageY - drag.pageY) + 'px';
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
    root: root.className
  };

  this.minimize = function() {
    delete self.minimize;

    el.style.left = m.left + 'px';
    el.style.top = m.top + 'px';
    el.style.width = m.width + 'px';
    el.style.height = m.height + 'px';
    el.style.boxSizing = '';
    grip.style.display = '';
    root.className = m.root;
    self.save();
  };

  window.scrollTo(0, 0);

  el.style.left = '0px';
  el.style.top = '0px';
  el.style.width = '100%';
  el.style.height = '100%';
  el.style.boxSizing = 'border-box';
  grip.style.display = 'none';
  root.className = 'maximized';
  self.save();
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
