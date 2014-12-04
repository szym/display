var http = require('http')
  , express = require('express')
  , getRawBody = require('raw-body');

// Forwards any JSON POSTed to /events to an event-stream at /events.
function createServer() {
  var app = express();

  app.get('/events', function(req, res) {
    function forwardEvent(data) {
      res.write('name: update\ndata: ');
      res.write(data);
      res.write('\n\n');
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    req.socket.setTimeout(Infinity);

    req.once('close', function() {
      app.removeListener('update', forwardEvent);
    });

    // exploit the fact that app is an EventEmitter
    app.on('update', forwardEvent);
  });

  app.post('/events', function(req, res) {
    getRawBody(req, {
      length: req.headers['content-length'],
      limit: '2mb',
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
