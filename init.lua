--
-- A torch client to litegfx.M backend
-- Based heavily on https://github.com/clementfarabet/gfx.js/blob/master/clients/torch/js.lua
--

local image = require 'image'
local json = require 'cjson'
local template = require('pl.template')
local gm = require 'graphicsmagick'
local torch = require 'torch'

local home = os.getenv('HOME') .. '/.litegfx.js/'

if not os.execute('test -e ' .. home) then
  print('Warning: litegfx.js was not property installed in ' .. home)
  return {}
end

local templatedir = home .. 'templates/'
local prefix = 'data/'
local static = home .. 'static/' .. prefix 


local M = {
  verbose = true,
  templates = {},
}


-- load templates
for file in io.popen('ls -1 "' .. templatedir .. '"'):lines() do
  if file:find('html$') then
    local f = io.open(templatedir .. file)
    local template = f:read('*all')
    M.templates[file:gsub('%.html$', '')] = template
  end
end


local function log(id)
  if M.verbose then
    print('[litegfx.js] rendering cell <' .. id .. '>')
  end
end


local function uid()
  return 'dom_' .. (os.time() .. math.random()):gsub('%.', '')
end


local function render(img, opts)
  opts = opts or {}

  -- rescale image to 0 .. 1
  local min = opts.min or img:min()
  local max = opts.max or img:max()

  img = torch.FloatTensor(img:size()):copy(img)
  img:add(-min):mul(1/(max-min))

  local win = opts.win or uid()
  local filename = win .. '.png'
  gm.save(static .. filename, img)

  local width
  if img:nDimension() == 2 then
    width = img:size(2)
  elseif img:nDimension() == 3 then
    width = img:size(3)
  else
    error('image must have two or three dimensions')
  end
 
  -- TODO(szym): allow manual zooming instead of opts.zoom
  local zoom = opts.zoom or 1
  -- render template:
  local html = template.substitute(M.templates.image, {
    width = width * zoom,
    filename = prefix .. filename .. '?' .. os.time(),
    legend = opts.legend or '',
  })

  return html, win
end


function M.image(img, opts)
  -- options:
  opts = opts or {}
  local zoom = opts.zoom or 1
  local win = opts.win or uid()      -- id of the window to be reused

  if type(img) == 'table' then
    return M.images(img, opts)
  end

  -- img is a collection?
  if img:nDimension() == 4 or (img:nDimension() == 3 and img:size(1) > 3) then
    local images = {}
    for i = 1,img:size(1) do
      images[i] = img[i]
    end
    return M.images(images, opts)
  end

  html, win = render(img, opts)

  local f = io.open(static .. win .. '.html', 'w')
  f:write(html)
  f:close()
  log(win)

  return win
end


function M.images(images, opts)
  -- options:
  opts = opts or {}
  local nperrow = opts.nperrow or math.floor(math.sqrt(#images))
  local zoom = opts.zoom or 1
  local width = opts.width or 1200   -- max width
  local height = opts.height or 800  -- max height
  local legends = opts.legends or {}
  local legend = opts.legend
  local win = opts.win or uid()      -- id of the window to be reused

  -- do all images:
  local renders = {}
  local maxwidth,maxheight = 0,0
  for i,img in ipairs(images) do
    html, win = render(img, {
      legend = legends[i] or (i==1 and legend) or (not legend and ('Image #' .. i)) or '',
    })
    -- TODO: compute maxwidth, maxheight

    table.insert(renders, html)
  end

  -- TODO(szym)
  -- want container with zoom controls

  -- generate container:
  local width = math.min(width, (maxwidth + 4) * math.min(#images, nperrow))
  local height = math.min(height, math.ceil(#images / nperrow) * (maxheight + 4))
  local html = template.substitute(M.templates.window, {
    width = width, 
    height = height, 
    content = table.concat(renders, '\n')
  })
  local f = io.open(static .. win .. '.html', 'w')
  f:write(html)
  f:close()
  log(win)

  return win
end


-- format datasets to
-- { 
--   { key='series 1', values={ { x=x0, y=y0 }, .. { x=xn, y=yn } } },
--   { key='series 2', ... }
-- }
-- each data point can optionally have size= for scatter chart
local function format(data, chart)
  -- data is a straight tensor?
  if torch.typename(data) then
    data = { values=data }
  end

  -- one dataset only?
  if #data == 0 then
    data = { data }
  end

  for i,dataset in ipairs(data) do
    if torch.typename(dataset) or not dataset.values then
      -- wrap straight data as a dataset
      dataset = { values=dataset }
      data[i] = dataset
    end

    -- legend:
    dataset.key = dataset.key or ('Data #' .. i)

    -- values:
    local values = dataset.values
    if type(values) == 'table' then
      -- remap values:
      if type(values[1]) == 'number' then
        for i,value in ipairs(values) do
          values[i] = { x=i-1, y=value }
        end
      elseif not values[1].x or not values[1].y then
        for i,value in ipairs(values) do
          value.x = value[1]
          value.y = value[2]
          value.size = value[3]
        end
      end

    elseif torch.typename(values) then
      -- remap tensor into {x=, y=, size=} values:
      local vals = {}
      if values:nDimension() == 1 then
        for i = 1,values:size(1) do
          vals[i] = { x=i-1, y=values[i] }
        end

      elseif values:nDimension() == 2 and values:size(2) == 2 then
        for i = 1,values:size(1) do
          vals[i] = { x=values[i][1], y=values[i][2] }
        end

      elseif values:nDimension() == 2 and values:size(2) == 3 then
        for i = 1,values:size(1) do
          vals[i] = { x=values[i][1], y=values[i][2], size=values[i][3] }
        end

      else
        error('dataset.values could not be parsed')
      end
      dataset.values = vals
    else
      error('dataset.values must be a tensor or a table')
    end
  end

  -- return formatted data:
  return data
end


-- chart?
local charts = {
  line = 'lineChart',
  bar = 'discreteBarChart',
  stacked = 'stackedAreaChart',
  multibar = 'multiBarChart',
  scatter = 'scatterChart',
}
function M.chart(data, opts)
  -- args:
  opts = opts or {}
  local width = opts.width or 600
  local height = opts.height or 450
  local background = opts.background or '#fff'
  local win = opts.win or uid()
  local chart = opts.chart or 'line'
  local xFormat = opts.xFormat or '.02e'
  local yFormat = opts.yFormat or '.02e'
  local xLabel = opts.xLabel or ''
  local yLabel = opts.yLabel or ''

  -- chart
  chart = charts[chart]
  if not chart then
    print('unknown chart, must be one of:')
    for c in pairs(charts) do
      io.write(c .. ', ')
    end
    print('')
  end

  -- format data
  data = format(data, chart)

  -- export data:
  local data_json = json.encode(data)

  -- generate html:
  local html = template.substitute(M.templates.chart, {
    id = win,   -- needed to refer from the script
    width = width,
    height = height,
    data = data_json,
    chart = chart,
    background = background,
    xFormat = xFormat,
    yFormat = yFormat,
    xLabel = xLabel,
    yLabel = yLabel,
  })
  local f = io.open(static .. win .. '.html', 'w')
  f:write(html)
  f:close()
  log(win)

  -- return win handle
  return win
end


function M.clear()
  print('[gfx.M] clearing all cached graphics')
  for filename in io.popen('ls -1 "' .. static .. '"'):lines() do
    os.remove(static ..filename)
  end
end


function M.redraw(id)
  -- id: if number then it means redraw last N elements
  -- if string, then it's an actual id
  if type(id) == 'number' then
    -- list last elements, and redraw them:
    local ids = M.list(id)
    for i = #ids,1,-1 do
      M.redraw(ids[i])
    end
  else
    -- ext?
    if not id:find('html$') then
      id = id .. '.html'
    end
    -- touch the resource will force a redraw (or a new draw if window was closed)
    os.execute('touch "' .. static .. id .. '"')
  end
end


function M.list(N)
  -- default max
  N = N or 10
  -- list last N elements
  local pipe = io.popen('ls -t "' .. static .. '"dom_*.html 2>/dev/null')
  local ids = {}
  for i = 1,N do
    local line = pipe:read('*line')
    if line then
      local _,_,id = line:find('(dom_%d*)%.html$')
      table.insert(ids,id)
    else
      break
    end
  end
  return ids
end

return M
