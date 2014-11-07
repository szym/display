# litegfx.js: a browser-based graphics server

Forked from [gfx.js](https://github.com/clementfarabet/gfx.js/).

The goal is to remain compatible with the torch/python bindings of gfx.js, but
remove the term.js/tty.js/pty.js stuff which is served just fine by ssh.

A secondary goal is to simplify session management and store window positions
so that after reloading the window everything remains where it was left.

## Technical overview

The basic approach is same as in gfx.js:
the server watches a directory, and monitors the creation & modification of HTML files;
upon modification / creation, it creates a new window on the client side (browser), 
which simply renders the HTML. 

Clients are easy to develop: one simply needs to dump HTML into the watched
directory to have it rendered by the browser.

## Installation and usage

Install gfx.js.

Then run `install.sh`.

For safety, this overwrites `~/.gfx.js/server.js` (which allows insecure access
to pty). Start and use gfx.js as before.

## TODO:

- persist window locations in `localStorage`
- move styling from templates to css
- fix z-order of grip

