const http = require('http');
const fs = require('fs');
const ws = require('ws');

const svr = http.createServer((req, res) => {
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
});

var wss = ws.createServer({ server: svr });
var clients = {};

function send(ws, type, data) {
  console.log(`Sent to ${ws.un}: ${type} :`, data);

  var x = {};
  x[type] = value;
  ws.send(JSON.stringify(x));
}

function emit(type, data, room, exclude) {
  for (var un in clients) {
    if (clients[un].room == room && un != exclude)
      send(clients[un], type, data);
  }
}

wss.on('connection', (ws) => {
  ws.li = false;
  ws.un = '';
  ws.room = null;

  ws.on('message', (message) => {
    console.log(`Received from ${ws.un}: ${message}`);

    var x = JSON.parse(message.data);
    var y = Object.keys(x)[0];
    x = x[y];

    switch(y){
      case 'li':
        if(clients[y.username] || clients[y.username].length < 2 || clients[y.username].length > 12){
          return send(ws, li, 'bad username');
        }
        
        ws.un = y.username;
        ws.room = y.room;
        ws.li = true;
        emit('connect', ws.un, ws.room, ws.un);

        break;
      case 'msg':

        emit('msg', {from:ws.un,data:y}, ws.room, ws.un);

        break;
    }
  });

  // Event handler for WebSocket connection closing
  ws.on('close', () => {
    if (ws.li) {
      emit('disconnected', ws.un, ws.room, ws.un)
    }
    delete clients[ws.un];
  });
});


svr.listen(8080);