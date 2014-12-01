// Simple SVG download routines.
// Copyright 2014, Szymon Jakubczak, szym@szym.net
(function() {
  'use strict';
  var out$ = typeof exports != 'undefined' && exports || window;

  function download(url, mimetype, filename) {
    var a = document.createElement('a');
    a.download = filename;
    a.href = url;
    document.body.appendChild(a);

    a.addEventListener('click', function(e) {
      setTimeout(function() {
        URL.revokeObjectURL(a.href);
      }, 1500);
      a.remove();
    });
    a.click();
  }

  function downloadImage(uri, mimetype, filename) {
    var image = new Image();
    image.src = uri;
    image.onload = function() {
      var canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      download(canvas.toDataURL(mimetype), filename);
    }
  }

  out$.saveSvgAsPng = function(el, filename) {
    var svg = (new XMLSerializer).serializeToString(el);
    var uri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    downloadImage(uri, 'image/png', filename);
  }

  out$.saveSvg = function(el, filename) {
    var svg = (new XMLSerializer).serializeToString(el);
    var blob = new Blob([ svg ], { type:'text/svg' });
    download(URL.createObjectURL(blob), filename);
  }
})();
