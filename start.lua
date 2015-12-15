local port = tonumber(arg[2]) or 8000
local hostname = arg[3] or '127.0.0.1'

local server = require 'display.server'

server(hostname, port)

