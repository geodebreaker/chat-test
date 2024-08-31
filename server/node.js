require('dotenv').config();
const http = require('http');
const fs = require('fs');
const ws = require('ws');
const mysql = require('mysql2');

process.on('unhandledExeption', (reason) => {
  console.error(reason);
})

process.on('unhandledRejection', (reason) => {
  console.error(reason);
})

const conn = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'app',
  port: 3306
});

conn.connect((err) => {
  if (err) {
    console.error('Error connecting to DB:\n ', err.stack);
    return;
  }
  console.log('Connected to DB');
});

setInterval(() => {
  conn.query('SELECT 1', (error) => {
    if (error) {
      console.error('Keep-alive query error:', error);
    } else {
      console.log('Keep-alive query executed');
    }
  });
}, 300000);  // 5 minutes

function getRoomData(room) {
  return new Promise((y, n) => {
    const sql = 'SELECT * FROM msg WHERE room=?';
      conn.query(sql, [room], (error, results) => {
        console.log(`Got room data for room ${room}`)
        y(results
          .map(x => ({ date: Date.parse(x.date), user: getUser(x.user), text: x.text, id: x.id }))
          .sort((a, b) => a.date - b.date)
        );
      });
  });
}

function putMsg(user, room, text) {
  return new Promise((y, n) => {
    const sql = 'INSERT INTO msg (user, room, text) VALUES (?, ?, ?)';
      conn.query(sql, [user, room, text], (error, results) => {
        if (error) {
          n(error);
          return;
        }
        console.log(`Put message ${text} from ${user} in ${room}`)
        y(results.insertId);
      });
  });
}

//TODO: add user system
function getUser(id) {
  console.log(`Got user ${id} for id ${id}`);
  return id;
}

const svr = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  var url = req.url;
  url = url.replace(/\.\./g, '.');
  url = url.replace(/\/$/, '/index.html');
  var f = x => url.endsWith(x);
  var s = () => {
    res.writeHead(200, {
      'Content-Type':
        (
          f('js') ? 'application/javascript' :
            f('css') ? 'text/css' :
              f('jpg') ? 'image/jpeg' :
                f('svg') ? 'image/svg+xml' :
                  f('png') ? 'image/png' :
                    f('mp3') ? 'audio/mp3' :
                      'text/html'
        )
    });
  };

  // fetch('https://geodebreaker.github.io/chat-test/src/' + url)
  //   .then(x => {
  //     res.writeHead(200, { 'Content-Type': x.headers.get('Content-Type') });
  //     return x.text();
  //   }).then(x => res.end(x));

  fs.readFile('../src/' + url, (err, data) => {
    console.log(err ? 'fail:' : 'success:', url);
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('404: File not found');
    } else {
      s();
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
        getRoomData(ws.room).then(x =>
          send(ws, 'roommsg', x)
        );

        break;
      case 'msg':

        putMsg(ws.un, ws.room, x.value).then(id => {
          emit('msg', { from: ws.un, data: x.value, id: x.value, date: Date.now() }, ws.room, ws.un);
          send(ws, 'updateid', { tmpid: x.tmpid, newid: id });
        });

        break;
      case 'users':

        var ul = [];
        for (var un in clients) {
          if (clients[un].room == ws.room) {
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


svr.listen(process.env.PORT ?? 8080);