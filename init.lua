--
-- A torch client to litegfx.M backend
-- Based heavily on https://github.com/clementfarabet/gfx.js/blob/master/clients/torch/js.lua
--

local mime = require 'mime'
local http = require 'socket.http'
local ltn12 = require 'ltn12'
local json = require 'cjson'

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
    headers = { ['content-length'] = #command, ['content-type'] = 'application/json' },
    source = ltn12.source.string(command),
  })
end


local function normalize(img, opts)
  -- rescale image to 0 .. 1
  local min = opts.min or img:min()
  local max = opts.max or img:max()

  img = torch.FloatTensor(img:size()):copy(img)
  img:add(-min):mul(1/(max-min))
  return img
end


function M.image(img, opts)
  -- options:
  opts = opts or {}
  local win = opts.win or uid()      -- id of the window to be reused

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

  -- I wish we could write to memory instead of on-disk file.
  local filename = os.tmpname() .. '.png'
  image.save(filename, img)

  local file = io.open(filename, 'rb')
  local imgdata = 'data:image/png;base64,' .. mime.b64(file:read('*all'))
  file:close()

  send({ command='image', id=win, src=imgdata, annotations=opts._annotations, width=opts.width, title=opts.title })
  return win
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
  local annotations = {}
  local numrows = math.ceil(#images / nperrow)
  local canvas = torch.FloatTensor(maxsize[1], maxsize[2] * numrows, maxsize[3] * nperrow):fill(0.5)
  local row = 0
  local col = 0
  for i, img in ipairs(images) do
    canvas:narrow(2, maxsize[2] * row + 1, img:size(2)):narrow(3, maxsize[3] * col + 1, img:size(3)):copy(img)
    if labels[i] then
       table.insert(annotations, { col / nperrow, row / numrows, labels[i] })
    end
    col = col + 1
    if col == nperrow then
      col = 0
      row = row + 1
    end
  end
  opts._annotations = annotations;

  return M.image(canvas, opts)
end


-- data is either a 2-d torch.Tensor, or a list of lists
-- opts.labels is a list of series names, e.g.
-- plot({ { 1, 23 }, { 2, 12 } }, { labels={'iteration', 'score'} })
-- first series is always the X-axis
-- See http://dygraphs.com/options.html for supported options
function M.plot(data, opts)
  opts = opts or {}
  local win = opts.win or uid()

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
    for i, v in ipairs(data) do
      table.insert(dataset, v)
    end
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

  send({ command='plot', id=win, title=opts.title, options=options })
  return win
end


return M
