// https://github.com/szym/display
// Copyright (c) 2014, Szymon Jakubczak (MIT License)

var http = require('http')
  , express = require('express')
  , getRawBody = require('raw-body');

// Forwards any data POSTed to /events to an event-stream at /events.
// Serves files from /static otherwise.
function createServer() {
  var app = express();

  app.get('/events', function(req, res) {
    req.socket.setTimeout(Infinity);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('\n\n');

    function forwardEvent(data) {
      res.write('data: ');
      res.write(data);
      res.write('\n\n');
    }

    // exploit the fact that app is an EventEmitter
    app.on('update', forwardEvent);
    req.once('close', function() {
      app.removeListener('update', forwardEvent);
    });
  });

  app.post('/events', function(req, res, next) {
    getRawBody(req, {
      length: req.headers['content-length'],
      limit: '4mb',
    }, function(err, body) {
      if (err) return next(err);
      app.emit('update', body);
      res.status(200).end();
    });
  });

  app.use(express.static(__dirname + '/static'));

  return app;
};


module.exports = createServer;
