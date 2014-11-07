
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


/////////
// wm

var wm = {};

wm.windows;

wm.open = function() {
  var socket;
  if (document.location.pathname) {
    var parts = document.location.pathname.split('/')
      , base = parts.slice(0, parts.length - 1).join('/') + '/'
      , resource = base.substring(1) + 'socket.io';

    socket = io.connect(null, { resource: resource });
  } else {
    socket = io.connect();
  }

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
    var x = new XMLHttpRequest();
    x.onreadystatechange = function() {
      if (x.readyState == 4 && x.status == 200) {
        // infer id
        var res = x.responseText.match(/dom_(\d*)/);
        var divid = res[1];

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
        el.innerHTML = x.responseText;

        // force script eval:
        var scripts = el.getElementsByTagName('script');
        for (var ix = 0; ix < scripts.length; ix++) {
          eval(scripts[ix].text);
        }
      }
    };
    x.open('GET', data, true);
    x.send();
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
  root.className = !root.className
    ? 'dark'
    : '';
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
  // TODO(szym): check localStorage for position info and restore it

  this.element = el;
  this.grip = grip;
  this.bar = bar;
  this.button = button;
  this.title = title;

  el.appendChild(grip);
  el.appendChild(bar);
  bar.appendChild(button);
  bar.appendChild(title);
  body.appendChild(el);

  wm.windows.push(this);

  this.focus();
  this.bind();
}

Pane.prototype.bind = function() {
  var self = this
    , el = this.element
    , bar = this.bar
    , grip = this.grip
    , button = this.button
    , last = 0;

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
    cancel(ev);

    // handle double-click
    if (new Date - last < 600) {
      return self.maximize();
    }
    last = new Date;

    self.drag(ev);
    return cancel(ev);
  });
};

Pane.prototype.focus = function() {
  // Restack
  var parent = this.element.parentNode;
  if (parent) {
    parent.removeChild(this.element);
    parent.appendChild(this.element);
  }
};

Pane.prototype.save = function() {
  // TODO(szym): save position from style and status (minimized/maximized) into localStorage
}

Pane.prototype.destroy = function() {
  if (this.destroyed) return;
  this.destroyed = true;

  if (this.minimize) this.minimize();

  splice(wm.windows, this);
  this.element.parentNode.removeChild(this.element);
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
  el.style.cursor = 'move';
  root.style.cursor = 'move';

  function move(ev) {
    el.style.left = (drag.left + ev.pageX - drag.pageX) + 'px';
    el.style.top = (drag.top + ev.pageY - drag.pageY) + 'px';
  }

  function up() {
    el.style.opacity = '';
    el.style.cursor = '';
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

  el.style.overflow = 'hidden';
  el.style.opacity = '0.70';
  el.style.cursor = 'se-resize';
  root.style.cursor = 'se-resize';

  function move(ev) {
    var x, y;
    x = (ev.pageX - el.offsetLeft);
    y = (ev.pageY - el.offsetTop); // - el.offsetHeight;
    el.style.width = x + 'px';
    el.style.height = y + 'px';
  }

  function up(ev) {
    move(ev);

    // TODO(szym): clean this up, this should be done via CSS.
    var elch = el.children[2].getElementsByTagName("img");
    for (i = 0; i < elch.length; i++) {
      if (elch[i].style.width != null) {
        elch[i].style.width = '100%';
        elch[i].style.height = '100%';
      }
    }

    // el.style.overflow = '';
    el.style.opacity = '';
    el.style.cursor = '';
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
    , el = this.element;

  var m = {
    left: el.offsetLeft,
    top: el.offsetTop,
    root: root.className
  };

  this.minimize = function() {
    delete self.minimize;

    el.style.left = m.left + 'px';
    el.style.top = m.top + 'px';
    el.style.width = '';
    el.style.height = '';
    el.style.boxSizing = '';
    self.grip.style.display = '';
    root.className = m.root;
    self.save();
  };

  window.scrollTo(0, 0);

  el.style.left = '0px';
  el.style.top = '0px';
  el.style.width = '100%';
  el.style.height = '100%';
  el.style.boxSizing = 'border-box';
  this.grip.style.display = 'none';
  root.className = 'maximized';
  self.save();
};

////////
// Load

function load() {
  if (load.done) return;
  load.done = true;

  off(document, 'load', load);
  off(document, 'DOMContentLoaded', load);
  wm.open();
}

on(document, 'load', load);
on(document, 'DOMContentLoaded', load);
setTimeout(load, 5000);

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());
