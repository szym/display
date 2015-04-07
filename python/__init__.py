
import base64
import json
import urllib.request
import uuid

import numpy


__all__ = ['URL', 'image', 'images', 'plot']

URL = 'http://localhost:8000/events'


def uid():
  return 'pane_%s' % uuid.uuid4()


def send(**command):
  command = json.dumps(command)
  req = urllib.request.Request(URL, method='POST')
  req.add_header('Content-Type', 'application/json')
  req.data = command.encode('ascii')
  try:
    resp = urllib.request.urlopen(req)
    return resp != None
  except:
    raise
    return False


def encode_png(buf, width, height):
  """ buf: must be bytes or a bytearray in py3, a regular string in py2. formatted RGBRGB... """
  import zlib, struct, itertools
  assert (width * height * 3 == len(buf))
  bpp = 3
  # reverse the vertical line order and add null bytes at the start
  width_bytes = width * bpp
  # TODO: make a generetar
  #raw_data = b''.join(b'\x00' + buf[span:span + width_byte_4]
  #    for span in range((height - 1) * width * 4, -1, - width_byte_4))
  def raw_data():
    for span in range((height - 1) * width * bpp, -1, - width_bytes):
      yield b'\x00'
      yield buf[span:span + width_bytes]

  def png_pack(png_tag, data):
    chunk_head = png_tag + data
    return b''.join([
        struct.pack("!I", len(data)),
        chunk_head,
        struct.pack("!I", 0xFFFFFFFF & zlib.crc32(chunk_head))
      ])

  COLOR_TYPE_RGB = 2
  COLOR_TYPE_RGBA = 6
  bit_depth = 8
  return b''.join([
      b'\x89PNG\r\n\x1a\n',
      png_pack(b'IHDR', struct.pack("!2I5B", width, height, bit_depth, COLOR_TYPE_RGB, 0, 0, 0)),
      png_pack(b'IDAT', zlib.compress(b''.join(raw_data()), 9)),
      png_pack(b'IEND', b'')
    ])


def normalize(img, opts):
  minval = opts.get('min')
  if minval is None:
    minval = numpy.amin(img)
  maxval = opts.get('max')
  if maxval is None:
    maxval = numpy.amax(img)

  return numpy.uint8((img - minval) * (255/(maxval - minval)))


def to_rgb(img):
  nchannels = img.shape[2] if img.ndim == 3 else 1
  if nchannels == 3:
    return img
  if nchannels == 1:
    return img[:, :, numpy.newaxis].repeat(3, axis=2)
  raise ValueError('Image must be RGB or gray-scale')


def image(img, **opts):
  assert img.ndim == 2 or img.ndim == 3
  win = opts.get('win') or uid()

  if isinstance(img, list):
    return images(img, opts)
  # TODO: if img is a 3d tensor, then unstack it into a list of images

  img = to_rgb(normalize(img, opts))
  pngbytes = encode_png(img.tostring(), img.shape[1], img.shape[0])
  imgdata = 'data:image/png;base64,' + base64.b64encode(pngbytes).decode('ascii')

  send(command='image', id=win, src=imgdata,
    labels=opts.get('labels'),
    width=opts.get('width'),
    title=opts.get('title'))
  return win


def images(images, **opts):
  # TODO: need to merge images into a single canvas
  raise Exception('Not implemented')


def plot(data, **opts):
  """ Plot data as line chart.
  Params:
    data: either a 2-d numpy array or a list of lists.
    win: pane id
    labels: list of series names, first series is always the X-axis
    see http://dygraphs.com/options.html for other supported options
  """
  win = opts.get('win') or uid()

  dataset = {}
  if type(data).__module__ == numpy.__name__:
    dataset = data.tolist()
  else:
    dataset = data

  # clone opts into options
  options = dict(opts)
  options['file'] = dataset
  if options.get('labels'):
    options['xlabel'] = options['labels'][0]

  # Don't pass our options to dygraphs.
  options.pop('win', None)

  send(command='plot', id=win, title=opts.get('title'), options=options)
  return win

