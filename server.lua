-- https://github.com/szym/display
-- Copyright (c) 2015, Szymon Jakubczak (MIT License)

-- Forwards any data POSTed to /events to an event-stream at /events.
-- Serves files from /static otherwise.

local async = require('async')
local paths = require('paths')

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

local function handler(req, res, client)
  print(req.method, req.url.path)

  if req.url.path == '/events' then
    local headers = {
      ['Content-Type']  = 'text/event-stream',
      ['Cache-Control'] = 'no-cache',
      ['Connection']    = 'keep-alive',
      ['Transfer-Encoding'] = 'chunked'
    }
    if req.method == 'GET' then
      res('', headers, 200)
      table.insert(subscribers, client)
    elseif req.method == 'POST' then
      local body = req.body
      for i=1,#subscribers do
        local client = subscribers[i]
        assert(type(body) == 'string')
        -- send chunk
        local headlen = 8
        client.write(string.format('%x\r\n', #body + headlen))
        client.write('data: ') -- 6
        client.write(body)
        client.write('\n\n') -- 2
        client.write('\r\n')
      end
      res('', {})
    else
      res('Invalid method!', {}, 405)
    end
  else -- serve files from static
    local path = req.url.path
    if path == '/' or path == '' then
      path = '/index.html'
    end
    local ext = string.match(path, "%.%l%l%l?")
    local mime = getMime(ext)

    local file = io.open(paths.dirname(paths.thisfile()) .. '/static' .. path, 'r')
    if file ~= nil then
      local content = file:read("*all")
      file:close()
      res(content, {['Content-Type']=mime})
    else
      res('Not found!', {}, 404)
    end
  end
end


function server(hostname, port)
  async.http.listen('http://' .. hostname .. ':' .. port .. '/', handler)
  print('server listening on http://' .. hostname .. ':' ..  port)
  async.go()
end

return server
