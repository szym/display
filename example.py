#!/usr/bin/env python

import numpy
import random
import time

import display


def generate_image():
  X, Y = numpy.meshgrid(numpy.linspace(0, numpy.pi, 512), numpy.linspace(0, 2, 512))
  z = (numpy.sin(X) + numpy.cos(Y)) ** 2 + 0.5
  return z


i1 = generate_image()
i2 = generate_image()

display.image(i1, title='gradient')

# display.images([i2, i2, i2, i2], width=200, title='super fabio', labels=['a', 'b', 'c', 'd'])

data = []
for i in range(15):
  data.append([i, random.random(), random.random() * 2])

win = display.plot(data, labels=[ 'position', 'a', 'b' ], title='progress')

for i in range(15, 25):
  time.sleep(0.2)
  data.append([i, random.random(), random.random() * 2])
  display.plot(data, win=win)
