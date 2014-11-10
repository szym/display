package = "litegfx.js"
version = "scm-0"

source = {
   url = "git://github.com/szym/litegfx.js",
   dir = "litegfx.js"
}

description = {
   summary = "A browser-based graphics server with a Torch7 client.",
   detailed = [[
A browser-based graphics server with a Torch7 client.
   ]],
   homepage = "https://github.com/szym/litegfx.js",
   license = "MIT"
}

dependencies = {
   "torch >= 7.0",
   "image >= 1.0",
   "penlight >= 1.1.0",
   "graphicsmagick >= 1.scm",
   "lua-cjson >= 2.1.0"
}

build = {
   type = "command",
   build_command = "ls",
   install_command = "bash install.sh"
}
