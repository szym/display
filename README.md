# display: a browser-based graphics server

A very lightweight display server for [Torch](http://torch.ch). Best used as a remote desktop paired with a terminal of your choice.

Use a Torch REPL (e.g., [trepl](https://github.com/torch/trepl)) via SSH to control Torch and tell it to display stuff (images, plots, audio) to the server. The server then forwards the display data to (one or more) web clients.

## Installation

Install for Torch via:

    luarocks install https://raw.githubusercontent.com/szym/display/master/display-scm-0.rockspec

Install for Python (`numpy` required) via:

    python setup.py install [--user]

## Usage

Launch the server:

    th -ldisplay.start [port [hostname]]

Note, there is no authentication so **don't use "as is" for sensitive data**.
By default, the server listens on localhost. Pass `0.0.0.0` to allow external connections on any interface:

    th -ldisplay.start 8000 0.0.0.0

Then open `http://(hostname):(port)/` in your browser to load the remote desktop.

To actually display stuff on the server, use the `display` package in a Torch script or REPL:

    -- Generic stuff you'll need to make images anyway.
    torch = require 'torch'
    image = require 'image'
    
    -- Load the display package
    disp = require 'display'
    
    -- If you used a custom port or want to talk to a remote server (default is 127.0.0.1)...
    -- disp.url = 'http://myremoteserver.com:1234/events

    -- Display a torch tensor as an image. The image is automatically normalized to be renderable.
    lena = image.lena()
    disp.image(lena)
    
    -- Display a torch tensor as a graph. The first column is always the X dimension.
    -- The other columns can be multiple series.
    disp.plot(torch.cat(torch.linspace(0, 10, 10), torch.randn(10), 2))

Each command creates a new window on the desktop that can be independently positioned, resized, maximized.
If you want to reuse a window, pass the window id returned by each `image` or `plot` command as the `win` option.
See `example.lua` or `example.py` for a bigger example.

![](https://raw.github.com/szym/display/master/example.png)

## Development

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

## Technical overview

The server is a trivial message forwarder:

    POST /events -> EventSource('/events')

The Lua client sends JSON commands directly to the server. The browser script
interprets these commands, e.g.

    { command: 'image', src: 'data:image/png;base64,....', title: 'lena' }

## History

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


