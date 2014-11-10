#!/usr/bin/env node

var lib = require('./lib.js');
var fs = require('fs');


var config;
var configFile = process.env.HOME + '/.litegfx.js/config.json'
console.log('Checking for custom config at ' + configFile)
if (fs.existsSync(configFile)) {
  config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
} else {
  console.log('Custom config not found, using defaults');
  config = {
    port: 8000,
  }
}
console.log(config);

var server = lib.createServer();

server.listen(config.port, config.hostname, function() {
  console.log('Listening on http://%s:%s', config.hostname, config.port);
});
