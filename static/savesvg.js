
function saveSvg(svg, filename) {
  var svg = (new XMLSerializer).serializeToString(svg);
  window.URL = window.webkitURL || window.URL;

  var bb = new Blob([ svg ], { type:'text/svg' });

  var a = document.createElement('a');
  a.download = filename;
  a.href = window.URL.createObjectURL(bb);
  a.dataset.downloadurl = ['text/svg', a.download, a.href].join(':');

  document.body.appendChild(a);

  a.addEventListener('click', function(e) {
    setTimeout(function() {
      window.URL.revokeObjectURL(a.href);
    }, 1500);
    a.remove();
  });

  a.click();
}
