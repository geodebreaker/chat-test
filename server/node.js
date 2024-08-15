const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
  var url = req.url;
  url = url.replace(/\.\./g, '.');
  url = url.replace(/\/$/, '/index.html');
  fs.readFile('../src/' + url, (err, data) => {
    console.log(err ? 'fail:' : 'success:', url);
    var f = x => url.endsWith(x);
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('404: File not found');
    } else {
      res.writeHead(200, {
        'Content-Type':
          (
            f('js') ? 'application/javascript' : 
            f('css') ? 'text/css' : 
            f('gif') ? 'image/gif' : 
            'text/html'
          )
      });
      res.end(data);
    }
  });
}).listen(8000);