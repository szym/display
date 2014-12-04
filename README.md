# display: a browser-based graphics server

Original forked from [gfx.js](https://github.com/clementfarabet/gfx.js/).

The original goal was to remain compatible with the torch/python API of gfx.js,
but remove the term.js/tty.js/pty.js stuff which is served just fine by ssh.

I also wanted charts to resize properly when their windows are resized.

A secondary goal was to simplify session management and store window positions
so that after reloading the window everything remains where it was left.

## Technical overview

The server is a trivial message forwarder:

    POST /events -> EventSource('/events')

The Lua client sends JSON commands directly to the server. The browser script
interprets these commands, e.g.

    { command: 'image', src: 'data:image/png;base64,....', title: 'lena' }

## Installation and usage

Install via:

    luarocks install https://raw.githubusercontent.com/szym/display/master/display-scm-0.rockspec

Launch the server:

    ~/.display/run.js &

See `example.lua` for sample usage.

    disp = require 'display'
    disp.image(image.lena())
    disp.plot(torch.cat(torch.linspace(0, 10, 10), torch.randn(10), 2))

