package = "display"
version = "scm-0"

source = {
   url = "git://github.com/szym/display",
   dir = "display"
}

description = {
   summary = "A browser-based graphics server with a Torch client.",
   detailed = [[A simple node.js server pushes images and charts to the browser.]],
   homepage = "https://github.com/szym/display",
   license = "MIT"
}

dependencies = {
   "torch >= 7.0",
   "sys >= 1.0",
   "image >= 1.0",
   "luasocket >= 2.0",
   "lua-cjson >= 2.1.0",
   "async >= 1.0"
}

build = {
   type = "command",
   install = {
      lua = {
        ["display.init"] = "init.lua",
        ["display.server"] = "server.lua",
        ["display.start"] = "start.lua",
      }
   },
   install_command = "mkdir $(LUADIR)/display && cp -a static plugins $(LUADIR)/display"
}
