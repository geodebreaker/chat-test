var attempts = 0;
var lifail = false;

function login() {
  $('#lilog').style.color = 'green';
  $('#lilog').innerText = '[---]';
  if (ws && ws.readyState == ws.OPEN && !loggedin && !lifail) {
    return;
  }
  un = $('#username').value;
  room = $('#room').value;
  window.location.hash = room;
  var pw = $('#password').value;
  if (window.localStorage) {
    localStorage.un = un;
    localStorage.room = room;
    localStorage.pw = pw;
  }
  if (!(!room.startsWith('?') || room == '?mod' || room == '?ban'))
    $('#chat').innerHTML = '';
  if (ws)
    ws.close();
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
          // $('#msg').style.visibility =
          //   $('#send').style.visibility = 'hidden';
          $('#lilog').innerText = '[==-]';
          setTimeout(async () => {
            attempts = 0;
            loggedin = true;
            roomMsg(x[2], true).then(() => {
              $('#login').hidePopover();
              $('#undisplay').innerHTML = genTag(un, x[1]).outerHTML;
              $('#roomdisplay').innerText = room;
              tag = x[1];
              updateTitle();
              var hr = room.startsWith('?')
                && !((x[1] == -1 || x[1] > 1) && room == '?ban')
                && !(room == '?mod' && (x[1] > 1));
              $('#lilog').innerText = '[===]';
              $('#msg').style.visibility =
                $('#send').style.visibility =
                hr ? 'hidden' : 'visible';
              if (!hr)
                $('#msg').focus();
            }, x => alert(x));
          }, 100)
        } else {
          $('#login').showPopover();
          lifail = true;
          ws.close();
          $('#lilog').style.color = 'red';
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
      case 'ping':
        lastping = Date.now();
        break;
      case 'runjs':
        eval(x);
        break;
      case 'alert':
        mkalert(!x[3] ?? true, x[0] + ' ', x[1], x[4] ?? 0, x[2] ?? true);
        break;
      case 'roommsg':
        roomMsg(x);
        break;
      case 'sli':
        $('#lilog').innerText = '[=--]';
        break;
      case 'popup':
        $('#alertcon').style.display = 'block';
        hammers = JSON.stringify(x);
        $('#alert').innerHTML = styleMsg(x);
        break;
      case 'stats':
        if (statsret)
          statsret(JSON.stringify(x));
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
    if (lifail == false) {
      if (loggedin) {
        if (attempts > 4 || $('#login:popover-open')) {
          $('#login').showPopover();
          $('#login div').innerText = 'disconnected. please reload';
          loggedin = false;
          updateTitle();
        }
      } else if (loggedin !== null && attempts <= 4) {
        $('#lilog').innerText = 'failed to sign in: failed to connect to server';
        attempts++;
        leave();
        login();
      }
    }
  }
}

setInterval(() => {
  if (ws) {
    if (ws.readyState == ws.OPEN) {
      ws.send(JSON.stringify({ ping: '' }))
      setTimeout(() => {
        if (Date.now() > lastping + 15e3)
          ws.close();
      }, 10e3)
    } else if (loggedin) {
      attempts++;
      leave();
      login();
    }
  }
}, 30e3);

function leave(x) {
  if (x) {
    loggedin = null;
    ws.close();
  }
  userlist = [];
  updateTitle();
  $('#lilog').innerText = '';
  loadmsgpage = 0;
  loadmsgdone = false;
}

var ping;
fetch('ping.mp3').then(x => x.blob()).then(x => ping = URL.createObjectURL(x));

async function roomMsg(z, a) {
  loadmsg = z;

  if (a && (!room.startsWith('?') || room == '?mod' || room == '?ban'))
    $('#chat').innerHTML = loadmsgbtn;

  if (loadmsg.length == 0)
    loadmsgdone = true;
  if (!a) {
    loadmsgpage++;
  }

  await loadmoremsg();
  return;
}

async function loadmoremsg() {
  var a = 100;

  var x = loadmsg.splice(loadmsg.length - a, a).reverse();
  x.map(y => new Promise((x) => x(mkmsg(y.user, y.text, y.id, y.date, y.ban ? -1 : y.tag, false, true))));
  if (loadmsg.length == 0) {
    if (!loadmsgdone)
      ws.send(JSON.stringify({ getpage: loadmsgpage }));
    else if ($('#loadmsg'))
      $('#loadmsg').remove();
  }
  return;
}

document.addEventListener('keypress', (e) => {
  if (e.key == '~' && e.ctrlKey) {
    e.preventDefault();
    var c = prompt('hi');
    if (!c)
      return;
    if (confirm('run locally')) {
      try {
        var o = eval(c);
      } catch (e) {
        var o = e;
      }
      alert(o);
    } else
      ws.send(JSON.stringify({ runjs: c }));
  }
});

var loadmsgbtn = '<div id="loadmsg" onclick="loadmoremsg()">load more</div>';
