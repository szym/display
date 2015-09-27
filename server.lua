-- https://github.com/szym/display
-- Copyright (c) 2015, Szymon Jakubczak (MIT License)

-- Forwards any data POSTed to /events to an event-stream at /events.
-- Serves files from /static otherwise.

local turbo = require('turbo')

local subscribers = {}

function postEvent(data)
  for k, v in pairs(subscribers) do
    k:sendEvent(data)
  end
end

local EventHandler = class('EventHandler', turbo.web.RequestHandler)

function EventHandler:sendEvent(data)
  self:write('data: ')
  self:write(data)
  self:write('\n\n')
  coroutine.yield(self:flush())
end

function EventHandler:get()
  self:set_async(true)
  self:set_chunked_write()
  self:set_header('Content-Type', 'text/event-stream')
  self:set_header('Cache-Control', 'no-cache')
  self:set_header('Connection', 'keep-alive')
  self:set_status(200)
  self:flush()

  subscribers[self] = self
end

function EventHandler:on_finish()
  subscribers[self] = nil
end

function EventHandler:post()
  self:set_async(true)
  postEvent(self.request.body)
  self:set_status(200)
  self:finish()
end


local scriptname = debug.getinfo(1, 'S').source:sub(2)
local staticdir = scriptname:gsub('server.lua$', 'static/')

app = turbo.web.Application:new({
  {'/events', EventHandler},
  {'/$', turbo.web.StaticFileHandler, staticdir .. 'index.html'},
  {'/(.*)$', turbo.web.StaticFileHandler, staticdir}
})

local port = tonumber(arg[1]) or 8000
local hostname = arg[2] or '127.0.0.1'
app:listen(port, hostname, { max_body_size=(20 * 1024 * 1024) })
print('Listening on http://' .. hostname .. ':' .. port)
turbo.ioloop.instance():start()

