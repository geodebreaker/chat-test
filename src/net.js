function login() {
  un = $('#username').value;
  room = $('#room').value;
  var pw = $('#password').value;
  if (window.localStorage) {
    localStorage.un = un;
    localStorage.room = room;
    localStorage.pw = pw;
  }
  ws = new WebSocket((window.location.protocol == 'http:' ? 'ws://' : 'wss://') + window.location.host);
  ws.onmessage = value => {
    var x = JSON.parse(value.data);
    var y = Object.keys(x)[0];
    x = x[y];
    console.log(y + ':', x);
    switch (y) {
      case 'li':
        if (x == "") {
          $('#login').hidePopover();
          $('#undisplay').innerText = un;
          $('#undisplay').style.color = colorhash(un);
          $('#roomdisplay').innerText = room;
          loggedin = true;
          updateTitle()
        } else {
          $('#lilog').innerText = 'failed to sign in: ' + x;
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
      case 'roommsg':
        x.map(m => mkmsg(m.user, m.text, m.id, m.date, m.tag));
        break;
      case 'updateid':
        $$(`[data-id="${x.tmpid}"]`).forEach(y => y.dataset.id = x.newid)
        break;
      case 'remmsg':
        $$(`[data-id="${x}"]`).forEach(y => y.remove());
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
      $('#login').showPopover();
      $('#login div').innerText = 'disconnected. please reload';
      loggedin = false;
      updateTitle();
    } else if (loggedin !== null) {
      $('#lilog').innerText = 'failed to sign in: failed to connect to server';
    }
  }
}

setInterval(() => {
  if (ws && ws.readyState == ws.OPEN)
    ws.send(JSON.stringify({ ping: '' }))
}, 60e3);

var ping;
fetch('ping.mp3').then(x => x.blob()).then(x => ping = URL.createObjectURL(x));