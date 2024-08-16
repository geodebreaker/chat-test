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
                f('jpg') ? 'image/jpg' :
                  f('svg') ? 'image/svg+xml' :
                    f('png') ? 'image/png' :
                      'text/html'
          )
      });
      res.end(data);
    }
  });
});

var wss = new ws.Server({ server: svr });
var clients = {};

function send(ws, type, data) {
  console.log(`Sent to ${ws.un}: ${type} :`, data);

  var x = {};
  x[type] = data;
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

    var x = JSON.parse(message);
    var y = Object.keys(x)[0];
    x = x[y];

    switch (y) {
      case 'li':
        if (clients[x.username] || x.username.length < 2 || x.username.length > 12) {
          return send(ws, 'li', 'bad username');
        }

        ws.un = x.username;
        ws.room = x.room;
        ws.li = true;
        emit('connect', ws.un, ws.room, ws.un);
        send(ws, 'li', '');
        console.log(`${ws.un} logged into room ${ws.room}`);
        clients[ws.un] = ws;

        break;
      case 'msg':

        emit('msg', { from: ws.un, data: x }, ws.room, ws.un);

        break;
      case 'users':

        var ul = [];
        for(var un in clients){
          if(clients[un].room == ws.room){
            ul.push(un);
          }
        }
        send(ws, 'users', ul);

        break;
    }
  });

  // Event handler for WebSocket connection closing
  ws.on('close', () => {
    console.log('Disconnected:', ws.un)
    if (ws.li) {
      emit('disconnect', ws.un, ws.room, ws.un)
    }
    delete clients[ws.un];
  });
});


svr.listen(8080);