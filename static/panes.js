'use strict';

// Copyright 2014, Szymon Jakubczak
// Based on https://github.com/chjj/tty.js by Christopher Jeffrey
//
(function() {

///////////////////
// Global Elements

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

function extend(dst, src) {
  for (var k in src)
    if (src.hasOwnProperty(k))
      dst[k] = src[k];
  return dst;
}

////////
// Pane

var panes = {};

function getPane(id, ctor) {
  var pane = panes[id];
  if (!(pane instanceof ctor)) {
    if (pane) pane.destroy(true);
    pane = new ctor(id);
  }
  return pane;
}

function Pane(id) {
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

  var content = document.createElement('div');
  content.className = 'content';

  this.id = id;
  this.zoomable = false;
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

  panes[id] = this;

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

  this.focus();

  var position = JSON.parse(localStorage.getItem(id) || 'false');
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

Pane.prototype = {
  setTitle: function(title) {
    this.title.innerHTML = title;
  },

  focus: function() {
    // Restack, but only if not already last.
    // Otherwise, dblclick won't work.
    if (!this.element.nextSibling) return;
    var parent = this.element.parentNode;
    if (parent) {
      parent.removeChild(this.element);
      parent.appendChild(this.element);
    }
  },

  save: function() {
    var el = this.element;
    var position = {
      left: el.style.left,
      top: el.style.top,
      width: el.style.width,
      height: el.style.height,
      maximized: false, // ('minimize' in this),
    };
    localStorage.setItem(this.id, JSON.stringify(position));
  },

  destroy: function(keepPosition) {
    if (this.destroyed) return;
    this.destroyed = true;

    delete panes[this.id];
    this.element.parentNode.removeChild(this.element);
    if (!keepPosition)
      localStorage.removeItem(this.id);
  },

  drag: function(ev) {
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
  },

  resizing: function(ev) {
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
      if (self.onresize) self.onresize();
    }

    on(document, 'mousemove', move);
    on(document, 'mouseup', up);
  },

  maximize: function() {
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
      if (self.onresize) self.onresize();
    };

    window.scrollTo(0, 0);

    el.style.left = '0px';
    el.style.top = '0px';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.boxSizing = 'border-box';
    grip.style.display = 'none';
    self.save();
    if (self.onresize) self.onresize();
  },
};


function ImagePane(id) {
  Pane.call(this, id);

  var self = this;

  var content = this.content;

  var image = document.createElement('img');
  image.className = 'content-image';
  content.appendChild(image);

  // TODO: add annotations. <div><image /><annotations /></div>
  this.content = image;

  on(content, 'wheel', function(ev) {
    self.zoom(ev);
    return cancel(ev);
  });

  on(content, 'mousedown', function(ev) {
    self.focus();
    self.panContent(ev);
    return cancel(ev);
  });

  on(content, 'dblclick', function(ev) {
    self.reset();
    return cancel(ev);
  });
}

ImagePane.prototype = extend(Object.create(Pane.prototype), {
  moveContent: function(left, top) {
    var el = this.element, content = this.content;
    if (!content.style.position) {
      // Until the content is first moved, it is positioned statically, so remember current size in |el|.
      el.style.width = Math.min(root.clientWidth - el.offsetLeft, el.clientWidth) + 'px';
      el.style.height = Math.min(root.clientHeight - el.offsetTop, el.clientHeight) + 'px';
      content.style.position = 'absolute';
    }
    content.style.left = Math.min(0, Math.max(el.clientWidth - content.clientWidth, left)) + 'px';
    content.style.top = Math.min(0, Math.max(el.clientHeight - content.clientHeight, top)) + 'px';
  },

  zoom: function(ev) {
    var el = this.element, content = this.content;

    var delta = (ev.deltaMode === ev.DOM_DELTA_PIXEL) ? ev.deltaY : ev.deltaY * 40;
    var scale = Math.exp(delta / 800.);

    // Don't shrink below 100px.
    if (content.clientWidth * scale < 100) scale = 100 / content.clientWidth;

    // Note, style is applied immediately, so changing style.width might change clientHeight.
    var clientHeight = content.clientHeight;
    content.style.width = content.clientWidth * scale + 'px';
    content.style.height = clientHeight * scale + 'px';

    this.moveContent(content.offsetLeft + (1 - scale) * ev.layerX,
                     content.offsetTop + (1 - scale) * ev.layerY);
  },

  panContent: function(ev) {
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
  },

  reset: function() {
    var c = this.content;

    c.style.left = '';
    c.style.top = '';
    c.style.width ='';
    c.style.height = '';
  },

  setContent: function(src, width, annotations) {
    this.content.src = src;
    this.content.width = width;
    // TODO: support annotations
    this.reset();
  },
});


function PlotPane(id) {
  Pane.call(this, id);

  // Need default size.
  this.element.style.width = '400px';
  this.element.style.height = '300px';

  this.content.className += ' content-plot';

  this.graph = new Dygraph(this.content);
}

PlotPane.prototype = extend(Object.create(Pane.prototype), {
  onresize: function() {
    this.graph.resize();
  },

  setContent: function(opts) {
    this.graph.updateOptions(opts);
  },
});

///////////////////
// Display "server"

var Commands = {
  image: function(cmd) {
    var pane = getPane(cmd.id, ImagePane);
    if (cmd.title) pane.setTitle(cmd.title);
    pane.setContent(cmd.src, cmd.width, cmd.annotations);
  },

  plot: function(cmd) {
    var pane = getPane(cmd.id, PlotPane);
    if (cmd.title) pane.setTitle(cmd.title);
    pane.setContent(cmd.options);
  },
};

function load() {
  root = document.documentElement;
  body = document.body;

  var eventSource = new EventSource('events');

  on(eventSource, 'message', function(event) {
    var cmd = JSON.parse(event.data);
    var command = Commands[cmd.command];
    if (command) command(cmd);
  });

  off(document, 'DOMContentLoaded', load);
}

on(document, 'DOMContentLoaded', load);

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());
