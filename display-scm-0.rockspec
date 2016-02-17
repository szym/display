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
   "image >= 1.0",
   "luasocket >= 2.0",
   "lua-cjson >= 2.1.0",
   "async >= 1.0"
}

build = {
   type = "command",
   build_command = "echo 'return { static = \"$(PREFIX)/static/\" }' > config.lua",
   install = {
      lua = {
        ["display.init"] = "init.lua",
        ["display.server"] = "server.lua",
        ["display.start"] = "start.lua",
        ["display.config"] = "config.lua"
      }
   },
   copy_directories = { "static" }
}
