var lib = require('./lib.js');
var fs = require('fs');


var config;
var configFile = process.env.HOME + '/.gfx.js/config.json'
console.log('Checking for custom config at ' + configFile)
if (fs.existsSync(configFile)) {
    config  = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    console.log('Custom config found')
} else {
    console.log('Custom config not found, using defaults');
    // Default config
    config = {
	port: 8000,
    }
}

console.log(config);
var app = lib.createServer(config);

app.listen();
