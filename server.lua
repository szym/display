-- https://github.com/szym/display
-- Copyright (c) 2015, Szymon Jakubczak (MIT License)

-- Forwards any data POSTed to /events to an event-stream at /events.
-- Serves files from /static otherwise.

local port = tonumber(arg[1]) or 8000
local hostname = arg[2] or '127.0.0.1'

local async = require('async')
local config = require('display.config')

local function getMime(ext)
   if ext == '.css' then
      return 'text/css'
   elseif ext == '.js' then
      return 'text/javascript'
   else
      return 'text/html' -- TODO: other mime types
   end
end

local subscribers = {}

async.http.listen('http://' .. hostname .. ':' .. port .. '/',
     function(req, res, client)
	print(req.method, req.url.path)

	local resp
	if req.url.path == '/events' then
	   local header = {
	      ['Content-Type']  = 'text/event-stream',
	      ['Cache-Control'] = 'no-cache',
	      ['Connection']    = 'keep-alive',
	      ['Transfer-Encoding'] = 'chunked'
	   }
	   if req.method == 'GET' then
	      res('', header, 200)
	      table.insert(subscribers, client)
	   elseif req.method == 'POST' then
	      local body = req.body
	      for i=1,#subscribers do
		 local client = subscribers[i]
		 assert(type(body) == 'string')
		 local headlen = 8
		 client.write(string.format('%x\r\n', #body + headlen))
		 client.write('data: ') -- 6
		 client.write(body)
		 client.write('\n\n') -- 2
		 client.write('\r\n')
	      end
	      res('', {})
	   else
	      res('Invalid!', {['Content-Type']='text/html'})
	   end
	else -- serve files from static
	   local file = req.url.path
	   if file == '/' or file == '' then
	      file = '/index.html'
	   end
	   local ext = string.match(file, "%.%l%l%l?")
	   local mime = getMime(ext)

	   local served = io.open(config.static .. file, 'r')
	   if served ~= nil then
	      resp = served:read("*all")
	      served:close()
	      res(resp, {['Content-Type']=mime})
	   else
	      res('Not found!', {}, 404)
	   end
	end
end)

print('server listening on http://' .. hostname .. ':' ..  port)

async.go()
