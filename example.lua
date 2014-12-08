
disp = require ('./init.lua')

require 'image'
require 'socket'

i1 = image.lena()
i2 = image.fabio()

disp.image(i1, { title='lena' })

disp.images({i2, i2, i2, i2}, { width=200, title='super fabio', labels={'a', 'b', 'c', 'd'}})

data = {}
for i=1,15 do
  table.insert(data, { i, math.random(), math.random() * 2 })
end

win = disp.plot(data, { labels={ 'position', 'a', 'b' }, title='progress' })

for i = 16,25 do
  socket.select(nil, nil, 0.2);
  table.insert(data, { i, math.random(), math.random() * 2 })
  disp.plot(data, { win=win })
end
