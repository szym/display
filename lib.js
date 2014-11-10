var http = require('http')
  , path = require('path')
  , express = require('express')
  , io = require('socket.io')
  , chokidar = require('chokidar');


function Server() {
  var app = express();
  var server = http.createServer(app);

  var sessions = {};
  var ioserver = io.listen(server, { log: true, 'close timeout': 5 });

  // TODO: add { lastModified: false, etag: false } if necessary
  app.use(express.static(__dirname + '/static'));

  // Watch the /data/ directory and send updates to all sockets.
  function onwatch(filename) {
    var fpath = path.basename(filename);
    if (fpath.match(/html$/)) {
      console.log('Watch Event on file: %s -> rendering template into DOM.', fpath);
      ioserver.emit('render', '/data/' + fpath);
    }
  }

  var watcher = chokidar.watch(__dirname + '/static/data/', {ignoreInitial: false});
  watcher.on('add', onwatch);
  watcher.on('change', onwatch);

  server.app = app;
  return server;
};


module.exports = { createServer: Server };
