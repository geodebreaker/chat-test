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
  const sql = 'SELECT * FROM users';
  conn.query(sql, (error, results) => {
    if (error) {
      return;
    }
    results.map((x) => {
      usercache.push({
        id: x.id,
        un: x.un,
        pw: x.pw,
        perm: x.perm,
        ban: x.ban,
        timeout: x.timeout,
        notif: x.notif,
        laston: x.laston,
        time: Date.now()
      })
    });
  });
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

function getRoomData(room, page = 0) {
  return new Promise((y, n) => {
    const pagecount = 400;
    const sql = 'SELECT * FROM msg WHERE room=? ORDER BY date DESC LIMIT ? OFFSET ?';
    conn.query(sql, [room, pagecount, pagecount * page], async (error, results) => {
      if (error)
        n(error);
      var dat = (await Promise.all(results.map(async x => ({
        date: Date.parse(x.date), user: await getUser(x.user), text: x.text, id: x.id,
        tag: await getUserTag(x.user), ban: await getUserData(x.user, 'ban')
      })))).sort((x, y) => x.date - y.date);
      console.log(`Got room data for room ${room}`);
      y(dat);
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
      const sql = `SELECT * FROM users WHERE ${type}${(type == 'un' ? ' LIKE ' : '=')}?`;
      conn.query(sql, [value + (type == 'un' ? '%' : '')], (error, results) => {
        if (error) {
          n(error);
          return;
        }
        var res = results[0];
        if (res) {
          usercache.push({
            id: res.id,
            un: res.un,
            pw: res.pw,
            perm: res.perm,
            ban: res.ban,
            timeout: res.timeout,
            notif: res.notif,
            laston: res.laston,
            time: Date.now()
          });
          // console.log(`UCache miss: ${type} ${value} ${newType} -> ${res[newType]}`);
        }
        y((res ?? {})[newType]);
      });
    }
  });
}

function getTopRooms() {
  return new Promise((y, n) => {
    var sql = "SELECT room, COUNT(*) AS cnt, " +
      "COUNT(*) - (TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), MAX(date)) / 300000) AS rnk " +
      "FROM msg WHERE room NOT LIKE '!%' AND room NOT LIKE '?%' GROUP BY room ORDER BY rnk DESC"// LIMIT 10";
    conn.query(sql, (error, results) => {
      if (error)
        return n(error);
      y(results.map(x => [x.room, x.cnt]));
    });
  });
}

function getAllUsers() {
  return new Promise((y, n) => {
    var sql = "SELECT un, perm, ban FROM users";
    conn.query(sql, (error, results) => {
      if (error)
        return n(error);
      y(results.map(x => [x.un, clients[x.un] != undefined, x.ban ? -1 : x.perm]));
    });
  });
}

function getAllMods() {
  return new Promise((y, n) => {
    var sql = "SELECT un, perm FROM users WHERE perm > 1";
    conn.query(sql, (error, results) => {
      if (error)
        return n(error);
      y(results.map(x => x.un));
    });
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

function isIPBanned(ip) {
  return new Promise((y, n) => {
    const sql = `SELECT * FROM ipban WHERE ip=?`;
    conn.query(sql, [ip], (error, results) => {
      if (error) {
        n(error);
        return;
      }
      y(!(results.length == 0 || results.every(x => x.time <= Date.now())));
    });
  });
}

async function getUserStats(id) {
  var cli = clients[await getUser(id)] ?? {};
  return {
    id: id,
    un: await getUserData(id, 'un'),
    tag: await getUserData(id, 'perm'),
    banned: !!(await getUserData(id, 'ban')),
    timeout: fmtTime(await getUserData(id, 'timeout'), true),
    "last online": fmtTime(Date.now() - await getUserData(id, 'laston')),
    online: !!cli.li,
    room: cli.room,
  };
}


function fmtTime(x, y) {
  x = Math.max((x || 0) - (y ? Date.now() : 0), 0);
  var z = Math.floor(x / 1e3) % 60;
  return (x > 60e3 ? Math.floor(x / 60e3) + 'm ' : '') + (z == 0 ? '' : z + 's');
}


const svr = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  var url = req.url;
  url = url.replace(/\.\./g, '.');
  url = url.replace(/\/$/, '/index.html');
  var q = URL.parse(url, true).query;
  if (url.startsWith('/api/sql') && q.cred == process.env.ADMIN_KEY) {
    const sql = q.query ?? 'SELECT un FROM users';
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
  } else if (url.startsWith('/api/restart') && q.cred == process.env.ADMIN_KEY) {
    process.exit(1);
  }

  var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (await isIPBanned(ip)) {
    console.log(`Banned ip detected ${ip} (HTTP)`);
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('IP Banned');
    return;
  }

  if (req.headers.host == 'nicknack.evrtdg.com')
    return fetch('https://geodebreaker.github.io/' + req.url)
      .then(x => {
        res.writeHead(200, { 'Content-Type': x.headers.get('Content-Type') });
        stream.pipeline(x.body, res, (err) => { });
      });

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

setInterval(() => {
  wss.clients.forEach(x => {
    if (x.li) sendUserList(x);
  });
}, 60e3)

function makeDmRoom(room, un) {
  var r = room.replace('!', '').split(',').concat([un]).filter((x, i, a) => a.indexOf(x) == i).sort();
  return ['!' + r.join(','), r];
}

function sendUserList(ws) {
  var ul = [];
  for (var un in clients) {
    ul.push([un, clients[un].room == ws.room, clients[un].ban ? -1 : clients[un].tag]);
  }
  send(ws, 'users', ul);
}



var wss = new ws.Server({ server: svr });
var clients = {};
var dontcon = {};
var ualert = '';


function send(ws, type, data) {
  if (type != 'roommsg' && type != 'li')
    console.log(`Sent to ${ws.un}: ${type} :`, data);

  var x = {};
  x[type] = data;
  ws.send(JSON.stringify(x));
}

function emit(type, data, room, exclude) {
  for (var un in clients) {
    if ((room == '*' || clients[un].room == room) && un != exclude)
      send(clients[un], type, data);
  }
}

wss.on('connection', async (ws, req) => {
  ws.li = false;
  ws.un = '';
  ws.uid = null;
  ws.room = null;
  ws.otherroom = [];
  ws.ogroom = null;
  ws.tag = 0;
  ws.spamm = [];
  ws.spamt = [];
  ws.ban = false;
  ws.ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (await isIPBanned(ws.ip)) {
    console.log(`Banned ip detected ${ws.ip} (WS)`);
    return ws.close();
  }
  console.log(`WebSocket connected at IP ${ws.ip}`);

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

        send(ws, 'sli', '');
        ws.uid = id;
        ws.un = un;
        ws.tag = await getUserTag(ws.uid);
        ws.ban = await getUserData(ws.uid, 'ban');
        if (x.room.startsWith('!')) {
          ws.room = makeDmRoom(x.room, ws.un);
          ws.otherroom = ws.room[1];
          ws.room = ws.room[0];
        } else
          ws.room = x.room;
        ws.li = true;
        if (ualert)
          send(ws, 'popup', ualert);
        if (!(dontcon[ws.un] && Date.now() - dontcon[ws.un] < 10e3))
          emit('connect', [ws.un, ws.tag], ws.room, ws.un);
        console.log(`${ws.un} logged into room ${ws.room}`);
        clients[ws.un] = ws;
        if (ws.room.startsWith('?')
          && !(ws.room == '?ban' && (ws.ban || ws.tag > 1))
          && !(ws.room == '?mod' && (ws.tag > 1))) {
          if (ws.room == '?') {
            send(ws, 'li', [true, ws.ban ? -1 : ws.tag, []]);

            ['',
              '^b,^i,^u,WELCOME TO THE HOMEPAGE;;; (its a little dissapointing)', '',
              '^ls,#,main channel; (post here)', '',
              '^ls,#?find; find rooms',
              '^ls,#?notif; notifications',
              '^ls,#?users; users', '',
              '^ls,#rules; (please read)',
              '^ls,#help; (feel free to ask and ping mods!)',
              '^ls,#ideas; (please add any ideas you get)',
              '^ls,#bugs; (please say if you find any)', '',
            ].concat(ws.ban || ws.tag > 1 ? ['^ls,#?ban; banned users page (FOR MODS OR BANNED USERS)'] : [])
              .concat(ws.tag > 1 ? ['^ls,#?mod; moderator chat'] : [])
              .map(x =>
                send(ws, 'alert', ['', x])
              );
          } else if (ws.room == '?notif') {
            send(ws, 'li', [true, ws.ban ? -1 : ws.tag, []]);
            send(ws, 'alert', ['', '^ls,#?,back to homepage;']);

            JSON.parse(await getUserData(ws.uid, 'notif') || '[]').reverse().map(x =>
              send(ws, 'alert', [x[2] + ':', '^ls,#' + x[1].replace(/,/g, '\\,') + ';', true, true]));
          } else if (ws.room == '?users') {
            send(ws, 'li', [true, ws.ban ? -1 : ws.tag, []]);
            send(ws, 'alert', ['', '^ls,#?,back to homepage;']);

            getAllUsers().then(x =>
              x.map(x =>
                send(ws, 'alert', [(x[1] ? ' on' : 'off') + 'line:', x[0], false, x[1], x[2]])
              )
            );
          } else if (ws.room == '?find') {
            send(ws, 'li', [true, ws.ban ? -1 : ws.tag, []]);
            send(ws, 'alert', ['', '^ls,#?,back to homepage;']);

            getTopRooms().then(x =>
              x.map(x =>
                send(ws, 'alert', [x[1] + ':', '^ls,#' + x[0].replace(/,/g, '\\,') +
                  (x[0] == '' ? ',(main)' : '') + ';'])
              )
            );
          } else {
            send(ws, 'li', [false, 'invalid util room']);
          }
        } else {
          getRoomData(ws.room).then(x =>
            send(ws, 'li', [true, ws.ban ? -1 : ws.tag, x])
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

        var to = await getUserData(ws.uid, 'timeout');
        var ban = await getUserData(ws.uid, 'ban');

        if (spam > 10) {
          to = now + 10e3;
          setUserData(ws.uid, 'timeout', to);
          send(ws, 'alert', ['timed out:', '10s']);
        } else if (to > now) {
          send(ws, 'alert', ['timeout active for:', fmtTime(to, true)]);
        }

        if (ban) {
          send(ws, 'alert', ['you are banned:', 'go to #?ban to repeal']);
        }

        if (
          x.value.length > 156 ||
          ban && ws.room != '?ban' ||
          to > now ||
          spam > 0
        ) return send(ws, 'remmsg', x.tmpid);

        putMsg(ws.uid, ws.room, x.value).then(async id => {
          var mu = (x.value.match(/(?<=@)\S{2,12}/g) || []).concat(ws.otherroom);
          if (mu.includes('mods'))
            mu.splice(mu.indexOf('mods'), 1, ...(await getAllMods()));
          mu.filter(x => x != ws.un).filter((x, i, a) => i == a.indexOf(x)).map(async z => {
            var uid = await fromUsername(z);
            if (!uid) return;
            var rm = ws.otherroom.length > 0 ? '!' + ws.otherroom.filter(x => x != z).join('\\,') : ws.room;
            if (clients[z] && clients[z].room != ws.room)
              send(clients[z], 'alert', ['pinged:', `by @${ws.un} in ^ls,#${rm};`, true, true]);
            setUserData(uid, 'notif', JSON.stringify(JSON.parse(
              await getUserData(uid, 'notif') || '[]').concat(
                [[id, rm, ws.un]])
              .filter((x, y) => y < 64)))
          });
          emit('msg',
            { from: ws.un, data: x.value, id: id, date: Date.now(), tag: ws.tag },
            ws.room, ws.un);
          send(ws, 'updateid', { tmpid: x.tmpid, newid: id });
        });

        break;
      case 'users':

        sendUserList(ws);

        break;
      case 'getpage':

        getRoomData(ws.room, x).then(x =>
          send(ws, 'roommsg', x)
        );

        break;
      case 'ping':

        send(ws, 'ping', '');

        break;
      case 'mod':

        if (ws.tag > 1)
          switch (x[0]) {
            case 'ban':

              var id = await fromUsername(x[1]);
              if (!id) return;
              var tag = await getUserData(id, 'perm');
              if (tag >= ws.tag) return;
              var b = await getUserData(id, 'ban');
              setUserData(id, 'ban', !b);
              emit('alert', ['user ' + (b ? 'un' : '') + 'banned:', x[1], false], ws.room);

              break;
            case 'to':

              var id = await fromUsername(x[1]);
              if (!id) return;
              var tag = await getUserData(id, 'perm');
              if (tag >= ws.tag) return;
              var to = parseFloat(x[2]);
              setUserData(id, 'timeout', Date.now() + to);
              if (clients[x[1]])
                send(clients[x[1]], 'alert', ['timed out:', fmtTime(to)]);
              send(ws, 'alert', ['timed out:', '^uc,' + x[1] + '; for ' + fmtTime(to)]);

              break;
            case 'del':

              delMsg(x[1], ws.room)

              break;
            case 'stats':

              var id = await fromUsername(x[1]);
              if (!id) return;
              send(ws, 'stats', await getUserStats(id));

              break;
            case 'setpopup':

              ualert = x[1];
              wss.clients.forEach(x =>
                send(x, 'popup', ualert));

              break;
          }

        break;
      case 'runjs':
        if (ws.tag > 1)
          emit('runjs', x, '*', ws.un);
        break;
    }
  });

  ws.on('close', () => {
    console.log('Disconnected:', ws.un)
    if (ws.li) {
      dontcon[ws.un] = Date.now();
      setTimeout((un, tag, room) => {
        if (!clients[un]) emit('disconnect', [un, tag], room);
      }, 10e3, ws.un, ws.tag, ws.room);
      setUserData(ws.uid, 'laston', Date.now());
    }
    delete clients[ws.un];
  });
});


svr.listen(process.env.PORT ?? 8080);


// async function compress(input) {
//   const encoder = new TextEncoder();
//   const compressedStream = new CompressionStream('gzip');
//   const writer = compressedStream.writable.getWriter();
//   writer.write(encoder.encode(input));
//   writer.close();
//   const reader = compressedStream.readable.getReader();
//   let compressedChunks = [];
//   let done = false;
//   while (!done) {
//     const { value, done: streamDone } = await reader.read();
//     if (value) compressedChunks.push(value);
//     done = streamDone;
//   }
//   const compressed = new Uint8Array(compressedChunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), []));
//   return String.fromCharCode(...compressed);
// }

// async function decompress(compressedStr) {
//   const compressed = Uint8Array.from(compressedStr, c => c.charCodeAt(0));
//   const decompressedStream = new DecompressionStream('gzip');
//   const writer = decompressedStream.writable.getWriter();
//   writer.write(compressed);
//   writer.close();
//   const reader = decompressedStream.readable.getReader();
//   let decompressedChunks = [];
//   let done = false;
//   while (!done) {
//     const { value, done: streamDone } = await reader.read();
//     if (value) decompressedChunks.push(value);
//     done = streamDone;
//   }
//   const decompressed = new Uint8Array(decompressedChunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), []));
//   return new TextDecoder().decode(decompressed);
// }