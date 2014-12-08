'use strict';

// https://github.com/szym/display
// Copyright (c) 2014, Szymon Jakubczak (MIT License)
// Based on https://github.com/chjj/tty.js by Christopher Jeffrey

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

function findPlacement() {
  var rects = [];
  for (var p in panes) {
    if (!panes.hasOwnProperty(p)) continue;
    p = panes[p];
    if (p.minimize) p.minimize();
    var el = p.element;
    var rect = [ el.offsetLeft, el.offsetTop,
                 el.offsetLeft + el.offsetWidth, el.offsetTop + el.offsetHeight ];
    rects.push(rect);
  }

  if (rects.length == 0) return {};

  function overlap(rect) {
    var total = 0;
    for (var i = 0; i < rects.length; ++i) {
      var other = rects[i];
      total += Math.max(0, Math.min(other[2] - rect[0], rect[2] - other[0])) *
               Math.max(0, Math.min(other[3] - rect[1], rect[3] - other[1]));
    }
    return total;
  }

  // Try random location a few times; pick the one with smallest overlap.
  var MAX_TRIES = 4;
  var width = 400, height = 300;  // assumed width/height
  var best = { overlap: Infinity };
  for (var i = 0; i < MAX_TRIES; ++i) {
    var x = Math.random() * (root.clientWidth - width), y = Math.random() * (root.clientHeight - height);
    var candidate = [ x, y, x + width, y + height ];
    var over = overlap(candidate);
    if (over < best.overlap || (over <= best.overlap && (x < best.rect[0] || y < best.rect[1])))
        best = { overlap: over, rect: candidate };
  }

  return {
    left: best.rect[0] + 'px',
    top: best.rect[1] + 'px',
  };
}

function Pane(id) {
  var self = this;

  var el = document.createElement('div');
  el.className = 'window';

  var grip = document.createElement('div');
  grip.className = 'grip';

  var bar = document.createElement('div');
  bar.className = 'bar';

  var closeButton = document.createElement('button');
  closeButton.innerHTML = 'x';
  closeButton.title = 'close';

  var cloneButton = document.createElement('button');
  cloneButton.innerHTML = 'o';
  cloneButton.title = 'disconnect';

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
  bar.appendChild(closeButton);
  bar.appendChild(cloneButton);
  bar.appendChild(title);
  body.appendChild(el);

  on(closeButton, 'click', function(ev) {
    self.destroy();
    return cancel(ev);
  });

  on(cloneButton, 'click', function(ev) {
    bar.removeChild(cloneButton);
    self.id = id + Math.random();
    self.title.innerHTML += ' (offline)';
    delete panes[id];
    panes[self.id] = self;
    return cancel(ev);
  });

  on(grip, 'mousedown', function(ev) {
    self.focus();
    self.resizing(ev);
    return cancel(ev);
  });

  on(el, 'mousedown', function(ev) {
    self.focus();
    if (ev.target !== el && ev.target !== bar && ev.target !== title) return;
    self.drag(ev);
    return cancel(ev);
  });

  on(bar, 'dblclick', function(ev) {
    self.maximize();
  });

  this.focus();

  var position = JSON.parse(localStorage.getItem(id) || 'false') || findPlacement();
  if (position.maximized) {
    this.maximize();
  } else {
    el.style.left = position.left;
    el.style.top = position.top;
    el.style.width = position.width;
    el.style.height = position.height;
  }

  panes[id] = this;
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

    var anchor = {
      x: ev.pageX - el.offsetLeft,
      y: ev.pageY - el.offsetTop,
    };

    el.style.opacity = '0.60';
    root.style.cursor = 'move';

    function move(ev) {
      el.style.left = (ev.pageX - anchor.x) + 'px';
      el.style.top = Math.max(0, ev.pageY - anchor.y) + 'px';
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

    delete this.minimize;

    var anchor = {
      x: ev.pageX - el.offsetWidth,
      y: ev.pageY - el.offsetHeight,
    };

    el.style.opacity = '0.70';
    root.style.cursor = 'se-resize';

    function move(ev) {
      el.style.width = (ev.pageX - anchor.x) + 'px';
      el.style.height = (ev.pageY - anchor.y) + 'px';
    }

    function up(ev) {
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
      width: el.offsetWidth,
      height: el.offsetHeight,
    };

    this.minimize = function() {
      delete self.minimize;

      el.style.left = m.left + 'px';
      el.style.top = m.top + 'px';
      el.style.width = m.width + 'px';
      el.style.height = m.height + 'px';
      grip.style.display = '';
      self.save();
      if (self.onresize) self.onresize();
    };

    window.scrollTo(0, 0);

    el.style.left = '0px';
    el.style.top = '0px';
    el.style.width = '100%';
    el.style.height = '100%';
    grip.style.display = 'none';
    self.save();
    if (self.onresize) self.onresize();
  },
};


function ImagePane(id) {
  Pane.call(this, id);

  var self = this
    , content = this.content;

  var image = document.createElement('img');
  image.className = 'content-image';
  content.appendChild(image);

  var annotations = document.createElement('div');
  annotations.className = 'annotations';
  content.appendChild(annotations);

  this.content = image;
  this.annotations = annotations;
  this.width = 0;
  this.height = 0;

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

  on(image, 'load', function(ev) {
    if ((image.width != self.width) || (image.height != self.height)) {
      self.width = image.width;
      self.height = image.height;
      self.reset();
    }
  });
}

ImagePane.prototype = extend(Object.create(Pane.prototype), {
  resizeAnnotations: function() {
    // TODO: can we use CSS transforms instead?
    this.annotations.style.left = this.content.offsetLeft + 'px';
    this.annotations.style.top = this.content.offsetTop + 'px';
    this.annotations.style.width = this.content.offsetWidth + 'px';
    this.annotations.style.height = this.content.offsetHeight + 'px'
  },

  reset: function() {
    var c = this.content;

    c.style.left = '';
    c.style.top = '';
    c.style.width ='';
    c.style.height = '';
    this.resizeAnnotations();
    this.width = this.content.width;
    this.height = this.content.height;
  },

  moveContent: function(left, top) {
    var el = this.element
      , content = this.content;

    if (!content.style.position) {
      // Until the content is first moved, it is positioned statically, so remember current size in |el|.
      el.style.width = Math.min(root.clientWidth - el.offsetLeft, el.offsetWidth) + 'px';
      el.style.height = Math.min(root.clientHeight - el.offsetTop, el.offsetHeight) + 'px';
      content.style.position = 'absolute';
    }
    // TODO: use CSS transforms instead of left/top/width/height
    content.style.left = Math.min(el.offsetWidth - 20,
                           Math.max(20 - content.offsetWidth, left)) + 'px';
    content.style.top = Math.min(el.offsetHeight - 18 - 20,
                          Math.max(20 - content.offsetHeight, top)) + 'px';
    this.resizeAnnotations();
  },

  zoom: function(ev) {
    var el = this.element
      , content = this.content;

    var delta = (ev.deltaMode === ev.DOM_DELTA_PIXEL) ? ev.deltaY : ev.deltaY * 40;
    var scale = Math.exp(delta / 800.);

    // Don't shrink below 100px.
    if (content.offsetWidth * scale < 100) scale = 100 / content.offsetWidth;

    this.width *= scale;
    this.height *= scale;

    content.style.width = this.width + 'px';
    content.style.height = this.height + 'px';

    this.moveContent(content.offsetLeft + (1 - scale) * ev.layerX,
                     content.offsetTop + (1 - scale) * ev.layerY);
  },

  panContent: function(ev) {
    var self = this
      , content = this.content;

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

  setContent: function(src, width, annotations) {
    this.content.src = src;
    if (width) {
      this.content.width = width;
    } else {
      this.content.removeAttribute('width');
    }
    this.annotations.innerHTML = '';
    for (var i = 0; i < annotations.length; ++i) {
      var a = annotations[i];  // [x, y, text]
      var ae = document.createElement('div');
      ae.className = 'annotation';
      ae.style.left = a[0] < 1 ? (a[0] * 100 + '%') : (a[0] + 'px');
      ae.style.top = a[1] < 1 ? (a[1] * 100 + '%') : (a[1] + 'px');
      ae.innerHTML = a[2];
      this.annotations.appendChild(ae);
    }
  },
});


function getTickResolution(graph) {
  var range = graph.yAxisRange(0);
  var area = graph.getArea();
  var maxTicks = area.h / graph.getOptionForAxis('pixelsPerLabel', 'y');
  var tickSize = (range[1] - range[0]) / maxTicks;
  return Math.floor(Math.log10(tickSize));
}


function PlotPane(id) {
  Pane.call(this, id);

  this.element.style.minWidth = '300px';
  this.element.style.minHeight = '200px';
  this.element.style.height = '200px';  // min-height is not enough for children height 100% to work
  this.content.className += ' content-plot';

  // Use undefined initial data to avoid anything being drawn until setContent.
  var graph = this.graph = new Dygraph(this.content, undefined, {
    axes: {
      y: {
        valueFormatter: function(y) {
          var resolution = getTickResolution(graph);
          return y.toFixed(Math.max(0, -resolution + 1));
        },
        axisLabelFormatter: function(y) {
          var resolution = getTickResolution(graph);
          return y.toFixed(Math.max(0, -resolution));
        },
      },
    },
  });
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
