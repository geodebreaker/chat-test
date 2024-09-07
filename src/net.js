var attempts = 0;

function login() {
  un = $('#username').value;
  room = $('#room').value;
  window.location.hash = room;
  var pw = $('#password').value;
  if (window.localStorage) {
    localStorage.un = un;
    localStorage.room = room;
    localStorage.pw = pw;
  }
  ws = new WebSocket(
    (window.location.protocol == 'https:' ? 'wss://' : 'ws://') + (window.notproxy ? window.location.host : 'ws://evrtdg.com')
  );
  ws.onmessage = async value => {
    var x = JSON.parse(value.data);
    var y = Object.keys(x)[0];
    x = x[y];
    if (y != 'roommsg')
      console.log(y + ':', x);
    switch (y) {
      case 'li':
        if (x[0]) {
          attempts = 0;
          $('#login').hidePopover();
          var y = document.createElement('span');
          y.innerText = un;
          $('#undisplay').innerHTML = genTag(un, x[1]).outerHTML;
          $('#roomdisplay').innerText = room;
          tag = x[1];
          loggedin = true;
          updateTitle();
          JSON.parse(await decompress(x[2])).map(m => mkmsg(m.user, m.text, m.id, m.date, m.tag, true));
        } else {
          $('#lilog').innerText = 'failed to sign in: ' + x[1];
        }
        break;
      case 'msg':
        recv(x);
        break;
      case 'connect':
        mkalert(false, 'connected: ', x[0]);
        userlist.push(x);
        updateMenu();
        break;
      case 'disconnect':
        mkalert(true, 'disconnected: ', x[0]);
        userlist.splice(userlist.findIndex(z => z[0] == x[0]), 1);
        updateMenu();
        break;
      case 'users':
        userlist = x;
        updateMenu();
        break;
      case 'updateid':
        $$(`[data-id="${x.tmpid}"]`).forEach(y => y.dataset.id = x.newid)
        break;
      case 'remmsg':
        $$(`[data-id="${x}"]:not(#rclick)`).forEach(y => y.remove());
        break;
      case 'roommsg':
        $('#chat').innerHTML = '';
        JSON.parse(await decompress(x)).map(m => mkmsg(m.user, m.text, m.id, m.date, m.tag, true));
        break;
    }
  };
  ws.onopen = () => {
    ws.send(JSON.stringify({
      li: {
        username: un,
        password: pw,
        room,
      }
    }))
  };
  ws.onclose = (x) => {
    if (loggedin) {
      if (attempts > 4 || $('#login:popover-open')) {
        $('#login').showPopover();
        $('#login div').innerText = 'disconnected. please reload';
        loggedin = false;
        updateTitle();
      } else {
        attempts++;
        leave();
        login();
      }
    } else if (loggedin !== null) {
      $('#lilog').innerText = 'failed to sign in: failed to connect to server';
    }
  }
}

setInterval(() => {
  if (ws && ws.readyState == ws.OPEN)
    ws.send(JSON.stringify({ ping: '' }))
}, 30e3);

function leave(x) {
  if (x) {
    loggedin = null;
    ws.close();
  }
  $('#chat').innerHTML = '';
  userlist = [];
  notif = 0;
  updateTitle();
}

var ping;
fetch('ping.mp3').then(x => x.blob()).then(x => ping = URL.createObjectURL(x));

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
  // return compressedStr
}
