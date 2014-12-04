package = "display"
version = "scm-0"

source = {
   url = "git://github.com/szym/display",
   dir = "display",
}

description = {
   summary = "A browser-based graphics server with a Torch7 client.",
   detailed = [[A simple node.js server pushes images and charts to the browser.]],
   homepage = "https://github.com/szym/display",
   license = "MIT"
}

dependencies = {
   "torch >= 7.0",
   "image >= 1.0",
   "luasocket >= 3.0-rc1",
   "lua-cjson >= 2.1.0"
}

build = {
   type = "command",
   build_command = "ls",
   install_command = "bash install.sh",
   install = {
      lua = {["display.init"] = "init.lua"}
   }
}
