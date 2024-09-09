require('dotenv').config();
const http = require('http');
const fs = require('fs');
const ws = require('ws');
const mysql = require('mysql2');
const stream = require('stream');
const URL = require('url');

process.on('unhandledException', (reason) => {
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
}, 60e3);

var usercache = [];

function getRoomData(room) {
  return new Promise((y, n) => {
    const sql = 'SELECT * FROM msg WHERE room=?';
    conn.query(sql, [room], async (error, results) => {
      console.log(`Got room data for room ${room}`)
      y(
        /*await compress(JSON.stringify(*/(await Promise.all(results
        .map(async x => (
          { date: Date.parse(x.date), user: await getUser(x.user), text: x.text, id: x.id, tag: await getUserTag(x.user) }))
      )).sort((a, b) => a.date - b.date)/*))*/
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

function delMsg(id, room) {
  emit('remmsg', id, room);
  return new Promise((y, n) => {
    const sql = 'DELETE FROM msg WHERE id=?';
    conn.query(sql, [id], (error, results) => {
      if (error) {
        n(error);
        return;
      }
      console.log(`Deleted message ${id}`)
      y();
    });
  });
}

function fromUserCache(type, value, newType) {
  return new Promise((y, n) => {
    var u = usercache.find(x => x[type] == value && Date.now() - x.time < 60 * 60e3);
    if (u) {
      // console.log(`UCache hit: ${type} ${value} ${newType} -> ${u[newType]}`);
      y(u[newType]);
    } else {
      const sql = 'SELECT * FROM users WHERE ' + type + '=?';
      conn.query(sql, [value], (error, results) => {
        if (error) {
          n(error);
          return;
        }
        var res = results[0];
        if (res) {
          usercache.push({
            id: results[0].id,
            un: results[0].un,
            pw: results[0].pw,
            perm: results[0].perm,
            ban: results[0].ban,
            notif: results[0].notif,
            time: Date.now()
          });
          // console.log(`UCache miss: ${type} ${value} ${newType} -> ${res[newType]}`);
        }
        y((res ?? {})[newType]);
      });
    }
  });
}

function getUser(id) {
  return fromUserCache('id', id, 'un');
}

function getUserTag(id) {
  return fromUserCache('id', id, 'perm');
}

function fromUsername(un) {
  return fromUserCache('un', un, 'id');
}

async function checkPw(id, pw) {
  return (await fromUserCache('id', id, 'pw')) == pw;
}

function setUserData(id, name, val) {
  const sql = 'UPDATE users SET ' + name + '=? WHERE id=?';
  conn.query(sql, [val, id], (error, results) => {
    if (error) {
      return;
    }
    console.log('set user data for id ' + id + ': ' + name + '=' + val)
    var u = usercache.find(x => x.id == id && Date.now() - x.time < 60 * 60e3);
    if (u) {
      u[name] = val;
    }
  });
}

function getUserData(id, val) {
  return fromUserCache('id', id, val);
}



const svr = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.headers.host == 'nicknack.evrtdg.com')
    return fetch('https://geodebreaker.github.io/' + req.url)
      .then(x => {
        res.writeHead(200, { 'Content-Type': x.headers.get('Content-Type') });
        stream.pipeline(x.body, res, (err) => { });
      });

  var url = req.url;
  url = url.replace(/\.\./g, '.');
  url = url.replace(/\/$/, '/index.html');

  var q = URL.parse(url, true).query;
  if (url.startsWith('/api/sql') && q.cred == process.env.ADMIN_KEY) {
    const sql = q.query;
    conn.query(sql, (error, results) => {
      if (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(error.stack);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(results));
      }
    });
    return;
  }

  if (url.startsWith('/api/restart') && q.cred == process.env.ADMIN_KEY) {
    process.exit(1);
  }

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

  if (process.env.AWS) {
    fetch('https://geodebreaker.github.io/chat-test/src/' + url)
      .then(x => {
        res.writeHead(200, { 'Content-Type': x.headers.get('Content-Type') });
        stream.pipeline(x.body, res, (err) => { });
      })
  } else {
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
  }
});

// setInterval(() => {
//   var r = {};
//   wss.clients.forEach(async c => {
//     if (c.room != null && !r[c.room]) {
//       r[c.room] = true;
//       emit('roommsg', await getRoomData(c.room), c.room)
//     }
//   });
// }, 15 * 60e3)

function makeDmRoom(room, un) {
  var r = room.replace('!', '').split(',');
  r.push(un);
  r.filter((x, i, a) => a.indexOf(x) == i).sort();
  return ['!' + r.join(','), r.filter(x => x != un)];
}



var wss = new ws.Server({ server: svr });
var clients = {};
var dontcon = {};



function send(ws, type, data) {
  if (type != 'roommsg')
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
  ws.uid = null;
  ws.room = null;
  ws.otherroom = [];
  ws.ogroom = null;
  ws.tag = 0;
  ws.spamm = [];
  ws.spamt = [];

  ws.on('message', async (message) => {
    console.log(`Received from ${ws.un}: ${message}`);

    var x = JSON.parse(message);
    var y = Object.keys(x)[0];
    x = x[y];

    switch (y) {
      case 'li':
        var un = x.username.toLowerCase();

        if (un.length < 2 || un.length > 12) {
          return send(ws, 'li', [false, 'bad username']);
        }

        if (clients[un]) {
          return send(ws, 'li', [false, 'already signed in']);
        }

        var id = await fromUsername(un);

        if (!id) {
          return send(ws, 'li', [false, 'user does not exist']);
        }

        if (!await checkPw(id, x.password)) {
          return send(ws, 'li', [false, 'bad password']);
        }

        ws.uid = id;
        ws.un = un;
        ws.tag = await getUserTag(ws.uid);
        if (await getUserData(ws.uid, 'ban') == 'true')
          ws.tag = -1;
        if (x.room.startsWith('!')) {
          ws.room = makeDmRoom(x.room, ws.un);
          ws.otherroom = ws.room[1];
          ws.room = ws.room[0];
        } else
          ws.room = x.room;
        ws.li = true;
        if (!(dontcon[ws.un] && Date.now() - dontcon[ws.un] < 10e3))
          emit('connect', [ws.un, ws.tag], ws.room, ws.un);
        console.log(`${ws.un} logged into room ${ws.room}`);
        clients[ws.un] = ws;
        if (ws.room.startsWith('?')) {
          if (ws.room == '?notif') {
            send(ws, 'li', [true, ws.tag, []]);
            JSON.parse(await getUserData(ws.uid, 'notif') || '[]').reverse().map(x =>
              send(ws, 'alert', [x[2] + ':', '^ls,#' + x[1] + ';']));
          } else {
            send(ws, 'li', [false, 'invalid util room']);
          }
        } else {
          getRoomData(ws.room).then(x =>
            send(ws, 'li', [true, ws.tag, x])
          );
        }

        break;
      case 'msg':

        var spam = (ws.tag + 1) * -10;
        var now = Date.now();
        if (ws.tag <= 2) {
          ws.spamt.push(now);
          ws.spamm.push(x.value);
          if (ws.spamt.length > 60) {
            ws.spamt.shift();
            ws.spamm.shift();
          }
          spam += Math.floor(5 - x.value.length) - 2;
          spam += ws.spamt.map(s => s >= now - 10e3).reduce((a, b) => a + b);
          spam += ws.spamm.map(s => s == x.value).reduce((a, b) => a + b);
        }

        if (spam > 10) {
          setUserData(ws.uid, 'timeout', now + 10e3);
          send(ws, 'alert', ['timed out:', '10s']);
        }

        if (
          x.value.length > 156 ||
          await getUserData(ws.uid, 'ban') ||
          await getUserData(ws.uid, 'timeout') > now ||
          spam > 0
        ) return send(ws, 'remmsg', x.tmpid);

        putMsg(ws.uid, ws.room, x.value).then(id => {
          var z = (x.value.match(/(?<=@)\S{2,12}/g) || []);
          z.push(...ws.otherroom);
          z.map(async z => {
            var uid = await fromUsername(z);
            if (!uid) return;
            setUserData(uid, 'notif', JSON.stringify(JSON.parse(
              await getUserData(uid, 'notif') || '[]').concat([[id, ws.room, ws.un]])
              .filter((x, y) => y < 32)))
          });
          emit('msg',
            { from: ws.un, data: x.value, id: id, date: Date.now(), tag: ws.tag },
            ws.room, ws.un);
          send(ws, 'updateid', { tmpid: x.tmpid, newid: id });
        });

        break;
      case 'users':

        var ul = [];
        for (var un in clients) {
          if (clients[un].room == ws.room) {
            ul.push([un, true, clients[un].tag]);
          }
        }
        send(ws, 'users', ul);

        break;
      case 'ping':

        send(ws, 'ping', '');

        break;
      case 'mod':

        if (ws.tag > 1)
          switch (x[0]) {
            case 'ban':

              var id = await fromUsername(x[1]);
              if (!id)
                return;
              if (await getUserData(id, 'tag') > 1)
                return;
              var b = await getUserData(id, 'ban');
              setUserData(id, 'ban', !b);
              emit('alert', ['user ' + (b ? 'un' : '') + 'banned:', x[1]], ws.room);

              break;
            case 'to':

              var id = await fromUsername(x[1]);
              if (!id)
                return;
              if (await getUserData(id, 'tag') > 1)
                return;
              setUserData(ws.uid, 'timeout', now + 10e3);
              send(ws, 'alert', ['timed out:', '10s']);

              break;
            case 'del':

              delMsg(x[1], ws.room)

              break;
          }

        break;
      case 'runjs':
        if (ws.tag > 2)
          emit('runjs', x, ws.room, ws.un);
        break;
    }
  });

  ws.on('close', () => {
    console.log('Disconnected:', ws.un)
    if (ws.li) {
      dontcon[ws.un] = Date.now();
      setTimeout((un, tag, room) => {
        if (!clients[un]) emit('disconnect', [un, tag], room);
      }, 10e3, ws.un, ws.tag, ws.room)
    }
    delete clients[ws.un];
  });
});


svr.listen(process.env.PORT ?? 8080);


async function compress(input) {
  const encoder = new TextEncoder();
  const compressedStream = new CompressionStream('gzip');
  const writer = compressedStream.writable.getWriter();
  writer.write(encoder.encode(input));
  writer.close();
  const reader = compressedStream.readable.getReader();
  let compressedChunks = [];
  let done = false;
  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (value) compressedChunks.push(value);
    done = streamDone;
  }
  const compressed = new Uint8Array(compressedChunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), []));
  return String.fromCharCode(...compressed);
}

async function decompress(compressedStr) {
  const compressed = Uint8Array.from(compressedStr, c => c.charCodeAt(0));
  const decompressedStream = new DecompressionStream('gzip');
  const writer = decompressedStream.writable.getWriter();
  writer.write(compressed);
  writer.close();
  const reader = decompressedStream.readable.getReader();
  let decompressedChunks = [];
  let done = false;
  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (value) decompressedChunks.push(value);
    done = streamDone;
  }
  const decompressed = new Uint8Array(decompressedChunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), []));
  return new TextDecoder().decode(decompressed);
}