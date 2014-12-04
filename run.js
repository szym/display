#!/usr/bin/env node

var fs = require('fs');

function configure(config_path) {
  if (fs.existsSync(config_path)) {
    return JSON.parse(fs.readFileSync(config_path, 'utf8'));
  }
  return {
    port: 8000,
  };
}

var server = require('./server.js')();
var config = configure(__dirname + '/config.json');
server.listen(config.port, config.hostname);
console.log('Listening on http://%s:%s', config.hostname, config.port);
