--
-- A torch client for `display` graphics server
-- Based heavily on https://github.com/clementfarabet/gfx.js/blob/master/clients/torch/js.lua
--

local mime = require 'mime'
local http = require 'socket.http'
local ltn12 = require 'ltn12'
local json = require 'cjson'
local ffi = require 'ffi'

require 'image'  -- image module is broken for now
local torch = require 'torch'


M = {
  url = 'http://localhost:8000/events'
}


local function uid()
  return 'pane_' .. (os.time() .. math.random()):gsub('%.', '')
end


local function send(command)
  -- TODO: make this asynchronous, don't care about result, but don't want to block execution
  command = json.encode(command)
  http.request({
    url = M.url,
    method = 'POST',
    headers = { ['content-length'] = #command, ['content-type'] = 'application/text' },
    source = ltn12.source.string(command),
  })
end


local function pane(type, win, title, content)
  win = win or uid()
  send({ command='pane', type=type, id=win, title=title, content=content })
  return win
end


local function normalize(img, opts)
  -- rescale image to 0 .. 1
  local min = opts.min or img:min()
  local max = opts.max or img:max()

  img = torch.FloatTensor(img:size()):copy(img)
  img:add(-min):mul(1/(max-min))
  return img
end

-- Set the URL of the listening server
function M.configure(config)
  local port = config.port or 8000
  local hostname = config.hostname or '127.0.0.1'
  M.url = 'http://' .. hostname .. ':' .. port ..'/events'
end

function M.image(img, opts)
  -- options:
  opts = opts or {}

  if type(img) == 'table' then
    return M.images(img, opts)
  end

  -- img is a collection?
  if img:dim() == 4 or (img:dim() == 3 and img:size(1) > 3) then
    local images = {}
    for i = 1,img:size(1) do
      images[i] = img[i]
    end
    return M.images(images, opts)
  end

  img = normalize(img, opts)

  -- write to in-memory compressed JPG
  local inmem_img = image.compressJPG(img)
  local imgdata = 'data:image/jpg;base64,' .. mime.b64(ffi.string(inmem_img:data(), inmem_img:nElement()))


  return pane('image', opts.win, opts.title, { src=imgdata, labels=opts._labels, width=opts.width })
end


function M.images(images, opts)
  opts = opts or {}
  local labels = opts.labels or {}
  local nperrow = opts.nperrow or math.ceil(math.sqrt(#images))

  local maxsize = {1, 0, 0}
  for i, img in ipairs(images) do
    if opts.normalize then
      img = normalize(img, opts)
    end
    if img:dim() == 2 then
      img = torch.expand(img:view(1, img:size(1), img:size(2)), maxsize[1], img:size(1), img:size(2))
    end
    images[i] = img
    maxsize[1] = math.max(maxsize[1], img:size(1))
    maxsize[2] = math.max(maxsize[2], img:size(2))
    maxsize[3] = math.max(maxsize[3], img:size(3))
  end

  -- merge all images onto one big canvas
  local _labels = {}
  local numrows = math.ceil(#images / nperrow)
  local canvas = torch.FloatTensor(maxsize[1], maxsize[2] * numrows, maxsize[3] * nperrow):fill(0.5)
  local row = 0
  local col = 0
  for i, img in ipairs(images) do
    canvas:narrow(2, maxsize[2] * row + 1, img:size(2)):narrow(3, maxsize[3] * col + 1, img:size(3)):copy(img)
    if labels[i] then
       table.insert(_labels, { col / nperrow, row / numrows, labels[i] })
    end
    col = col + 1
    if col == nperrow then
      col = 0
      row = row + 1
    end
  end
  opts._labels = _labels;

  return M.image(canvas, opts)
end


-- data is either a 2-d torch.Tensor, or a list of lists
-- opts.labels is a list of series names, e.g.
-- plot({ { 1, 23 }, { 2, 12 } }, { labels={'iteration', 'score'} })
-- first series is always the X-axis
-- See http://dygraphs.com/options.html for supported options
function M.plot(data, opts)
  opts = opts or {}

  local dataset = {}
  if torch.typename(data) then
    for i = 1, data:size(1) do
      local row = {}
      for j = 1, data:size(2) do
        table.insert(row, data[{i, j}])
      end
      table.insert(dataset, row)
    end
  else
    dataset = data
  end

  -- clone opts into options
  options = {}
  for k, v in pairs(opts) do
    options[k] = v
  end

  options.file = dataset
  if options.labels then
    options.xlabel = options.xlabel or options.labels[1]
  end

  -- Don't pass our options to dygraphs. 'title' is ok
  options.win = nil

  return pane('plot', opts.win, opts.title, options)
end

function M.text(text, opts)
  opts = opts or {}

  return pane('text', opts.win, opts.title, text)
end

function M.audio(data, opts)
  opts = opts or {}

  if not pcall(require, 'audio') then
      print("Warning: audio package could not be loaded. Skipping audio.")
      return
  end

  local fname
  local delete = false
  local inmem = false
  if torch.isTensor(data) then -- audio as tensor
      if data:dim() ~= 2 then
          print('Warning: audio tensor has to be 2D Tensor of NSamples x NChannels. Other tensor shapes are not supported')
          return
      end
      local sampleRate = opts.rate or 44100 -- default sample rate
      if ffi.os == 'Linux' then -- only linux supports fmemopen OOB
         fname = audio.compress(data, sampleRate, 'ogg')
         inmem = true
      else
         -- use temporary file
         fname = os.tmpname() .. '.ogg'
         audio.save(fname, data, sampleRate)
         delete = true
      end
  elseif torch.type(data) == 'string' then -- audio file
      fname = data
      -- get prefix
      local pos = fname:reverse():find('%.')
      local ext = fname:sub(#fname-pos + 2)
      if not (ext == 'mp3' or ext == 'wav' or ext == 'ogg' or ext == 'aac') then
          print('Warning: mp3, wav, ogg, aac files supported. But found extension: ' .. ext)
          return
      end
  else
      print("Warning: unknown input type. Need a Tensor, or a filename")
      return
  end

  -- load the audio as binary blob
  local buf, ext, size
  if inmem == true then
     buf = fname
     ext = 'ogg'
     size = buf:nElement()
  else
     local f = assert(torch.DiskFile(fname, 'r', true),
                      'File could not be opened: ' .. fname):binary();
     f:seekEnd();
     size = f:position() - 1
     f:seek(1)
     buf = torch.CharStorage(size);
     assert(f:readChar(buf) == size, 'wrong number of bytes read')
     f:close()
     local pos = fname:reverse():find('%.')
     ext = fname:sub(#fname-pos + 2)
  end

  if delete then
      os.execute('rm -f ' .. fname)
  end

  local audio_data = 'data:audio/' .. ext .. ';base64,'
     .. mime.b64(ffi.string(torch.data(buf), size))
  return pane('audio', opts.win, opts.title, audio_data)
end


return M
