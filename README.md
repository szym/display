# display: a browser-based graphics server

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Development](#development)

A very lightweight display server for [Torch](http://torch.ch). Best used as a remote desktop paired with a terminal of your choice.

Use a Torch REPL (e.g., [trepl](https://github.com/torch/trepl)) via SSH to control Torch and tell it to display stuff (images, plots, audio) to the server. The server then forwards the display data to (one or more) web clients.

## <a name='installation'></a> Installation

Install for Torch via:

    luarocks install https://raw.githubusercontent.com/szym/display/master/display-scm-0.rockspec

Install for Python (`numpy` required) via:

    python setup.py install [--user]
    
> NOTE: The Python client is not yet fully developed.

## <a name='quick-start'></a> Quick Start

Launch the server:

    th -ldisplay.start [port [hostname]]

Note, there is no authentication so **don't use "as is" for sensitive data**.
By default, the server listens on localhost. Pass `0.0.0.0` to allow external connections on any interface:

    th -ldisplay.start 8000 0.0.0.0

Then open `http://(hostname):(port)/` in your browser to load the remote desktop.

To actually display stuff on the server, use the `display` package in a Torch script or REPL:

```lua
-- Generic stuff you'll need to make images anyway.
torch = require 'torch'
image = require 'image'

-- Load the display package
display = require 'display'

-- Tell the library, if you used a custom port or a remote server (default is 127.0.0.1).
display.configure({hostname='myremoteserver.com', port=1234})

-- Display a torch tensor as an image. The image is automatically normalized to be renderable.
local lena = image.lena()
display.image(lena)

-- Plot some random data.
display.plot(torch.cat(torch.linspace(0, 10, 10), torch.randn(10), 2))
```

See `example.lua` or `example.py` for a bigger example.

![](https://raw.github.com/szym/display/master/example.png)

## <a name='usage'></a> Usage

Each command creates a new window (pane) on the desktop that can be independently positioned, resized, maximized.
It also returns the id of the window which can be passed as the `win` option to reuse the window
for a subsequent command. This can be used to show current progress of your script:

```lua
for i = 1, num_iterations do
   -- do some work
   ...
   -- update results
   local state_win = display.image(current_state, {win=state_win, title='state at iteration ' .. i})
end
```

Another common option is `title`. The title bar can be double-clicked to maximize the window.
The `x` button closes the window. The `o` button "disconnects" the window so that it will not be
overwritten when the script reuses the window id. This is useful if you want to make a quick "copy" of the window
to compare progress between iterations.

### Images

```lua
display.image(tensor, options)
```

Displays the tensor as an image. The tensor is normalized (by a scalar offset and scaling factor) to be displayable.
The image can be panned around and zoomed (with the scroll wheel or equivalent).
Double-click the image to restore original size or fill the window.

If the tensor has 4 dimensions, it is considered to be a list of images -- sliced by first dimension.
Same thing if it has 3 dimensions but the first dimension has size more than 3 (so they cannot be considered
the RGB channels). This is equivalent to passing a list (Lua table) of tensors or the explicit `images` command.
This is convenient when visualizing the trained filters of convolutional layer. Each image is normalized independently.
When displaying a list of images, the option `labels` can be used to put a small label on each sub-image:

```lua
display.images({a, b, c, d}, {labels={'a', 'b', 'c', 'd'}})
```

Finally, the option `width` can be used to specify the initial size of the window in pixels.

### Plotting

`display.plot(data, options)`

Creates a [Dygraph plot](http://dygraphs.com) which is most useful for visualizing time series.
The graph can be zoomed in by selecting a range of X values or zoomed-out by double-clicking it.

The data should either be a 2-dimensional tensor where the each row is a data point and each column is a series,
or a Lua table of tables. The first column is always taken as the X dimension. 
The command supports all the [Dygraph options](http://dygraphs.com/options.html).
Most importantly `labels` is taken as a list (Lua table) of series labels. Again the first label is for the X axis.
You can name the Y axis with `ylabel`.

```lua
local config = {
  title = "Global accuracy/recall over time",
  labels = {"epoch", "accuracy", "recall"},
  ylabel = "ratio",
}

for t = 1, noEpoch do
  -- update model, compute data
  local accuracy, recall = train()
  -- update plot data
  table.insert(data, {t, accuracy, recall})
  -- display
  config.win = display.plot(data, config)
end
```

### Other

`display.audio(tensor_with_audio, options)`

## <a name='development'></a> Development

### Supported commands

- `pane`: creates a new `Pane` of specified type; arguments are:
  - `type`: the registered type, e.g., `image` for `ImagePane`
  - `win`: identifier of the window to be reused (pick a random one if you want a new window)
  - `title`: title for the window title bar
  - `content`: passed to the `Pane.setContent` method

### Built-in Pane types

`image` creates a zoomable `<img>` element
  - `src`: URL for the `<img>` element
  - `width`: initial width in pixels
  - `labels`: array of 3-element arrays `[ x, y, text ]`, where `x`, `y` are the coordinates
    `(0, 0)` is top-left, `(1, 1)` is bottom-right; `text` is the label content

`plot` creates a Dygraph, all [Dygraph options](http://dygraphs.com/options.html) are supported
  - `file`: see [Dygraph data formats](http://dygraphs.com/data.html) for supported formats
  - `labels`: list of strings, first element is the X label

`text` places raw text in `<p>` element

`audio` places raw audio content in an `<audio>` element

### Technical overview

The server is a trivial message forwarder:

    POST /events -> EventSource('/events')

The Lua client sends JSON commands directly to the server. The browser script
interprets these commands, e.g.

    { command: 'pane', type: 'image', content: { src: 'data:image/png;base64,....' }, title: 'lena' }

### History

Originally forked from [gfx.js](https://github.com/clementfarabet/gfx.js/).

The initial goal was to remain compatible with the torch/python API of `gfx.js`,
but remove the term.js/tty.js/pty.js stuff which is served just fine by ssh.

Compared to `gfx.js`:

  - no terminal windows (no term.js)
  - [dygraphs](http://dygraphs.com/) instead of nvd3 (have built in zoom and are perfect for time-series plots)
  - plots resize when windows are resized
  - images support zoom and pan
  - image lists are rendered as one image to speed up loading
  - windows remember their positions
  - implementation not relying on the filesystem, supports remote clients (sources)
