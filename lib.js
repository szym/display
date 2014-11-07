var path = require('path')
  , express = require('express')
  , io = require('socket.io')
  , chokidar = require('chokidar');


function Server(conf) {
  if (!(this instanceof Server)) {
    return new Server(conf);
  }

  this.conf = conf;
  this.app = express();
  this.server = require('http').createServer();
  this.server.on('request', this.app);

  this.sessions = {};
  this.io = io.listen(this.server, { log: false });

  this.init();
}

Server.prototype.init = function() {
  this.init = function() {};
  this.initMiddleware();
  this.initIO();
};

Server.prototype.initMiddleware = function() {
  var self = this;

  // TODO(szym) Do I need this???
  this.use(function(req, res, next) {
    var setHeader = res.setHeader;
    res.setHeader = function(name) {
      switch (name) {
        case 'Cache-Control':
        case 'Last-Modified':
        case 'ETag':
          return;
      }
      return setHeader.apply(res, arguments);
    };
    next();
  });

  this.use(express.favicon(__dirname + '/static/favicon.ico'));
  this.use(this.app.router);
  this.use(express.static(__dirname + '/static'));
};

Server.prototype.initIO = function() {
  var self = this
    , io = this.io;

  io.sockets.on('connection', function(socket) {
    return self.handleConnection(socket);
  });
};

Server.prototype.handleConnection = function(socket) {
  var self = this;

  var session = new Session(self, socket);
  self.sessions[session.id] = session;

  socket.on('disconnect', function() {
    if (self.sessions[self.id]) {
      delete self.sessions[self.id];
    }
  });
};

Server.prototype.listen = function(port, hostname, func) {
  port = port || this.conf.port || 8080;
  hostname = hostname || this.conf.hostname;
  return this.server.listen(port, hostname, func);
};


function Session(server, socket) {
  this.server = server;
  this.socket = socket;

  var req = socket.handshake;
  this.user = req.user;
  this.id = req.user || this.uid();

  console.log('Session %s created.', this.id);

  var static = 'static/data/';
  var self = this;
  var watcher = chokidar.watch(static, {ignoreInitial: true});
  watcher.on('add', function(filename) {
    console.log(filename);
    var fpath = '/data/' + path.basename(filename);
    if (fpath.match(/html$/)) {
      console.log('Watch Event [add] on file: %s -> rendering template into DOM.', fpath);
      self.socket.emit('render', fpath);
    }
  });
  watcher.on('change', function(filename) {
    var fpath = '/data/' + path.basename(filename);
    if (fpath.match(/html$/)) {
      console.log('Watch Event [change] on file: %s -> rendering template into DOM.', fpath);
      self.socket.emit('render', fpath);
    }
  });
}

Session.uid = 0;
Session.prototype.uid = function() {
  return Session.uid++ + '';
};


/**
 * "Inherit" Express Methods
 */

// Methods
Object.keys(express.application).forEach(function(key) {
  if (Server.prototype[key]) return;
  Server.prototype[key] = function() {
    return this.app[key].apply(this.app, arguments);
  };
});

// Middleware
Object.getOwnPropertyNames(express).forEach(function(key) {
  var prop = Object.getOwnPropertyDescriptor(express, key);
  if (typeof prop.get !== 'function') return;
  Object.defineProperty(Server, key, prop);
});


exports = Server;
exports.Server = Server;
exports.Session = Session;
exports.createServer = Server;

module.exports = exports;
