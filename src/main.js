$ = x => document.querySelector(x);

var ws;
var un;
var room;
var loggedin = false;

$('#msg').onkeypress = x => { if (x.key == 'Enter') $('#send').click() };
$('#send').onclick = x => send($('#msg').value);
$('#leave').onclick = x => { $('#login').showPopover(); loggedin = false; ws.close() };
$('#libtn').onclick = x => login();

$('#login').showPopover();

function send(value) {
  console.log(value);
  ws.send(JSON.stringify({ msg: value }));
  mkmsg(un, value);
}

function recv(value) {
  console.log(value);
  mkmsg(value.from, value.data);
}

function mkmsg(from, data) {
  var u = document.createElement('span');
  u.innerText = from + ': ';
  u.className = 'usertag';
  u.style.color = colorhash(from);
  var m = document.createElement('span');
  m.innerText = data;
  $('#chat').innerHTML += u.outerHTML + m.outerHTML + '<br>';
}

function colorhash(x) {
  var w = x.split('');
  var y = 0;
  for (var z of w) {
    y += z.charCodeAt(0);
  }
  y = y / 1000 + y;
  y *= 202383492;
  y %= 10284672;
  y *= 846589213;
  y %= 38357692;
  y *= 84748;
  return '#' + Math.floor(y % 0xffffff).toString(16);
}

function login() {
  un = $('#username').value;
  room = $('#room').value;
  ws = new WebSocket((window.location.protocol == 'http:' ? 'ws://' : 'wss://') + window.location.host);
  ws.onmessage = value => {
    var x = JSON.parse(value.data);
    var y = Object.keys(x)[0];
    x = x[y];
    switch (y) {
      case 'li':
        if (x == "") {
          $('#login').hidePopover();
          $('#undisplay').innerText = un;
          $('#roomdisplay').innerText = room;
          loggedin = true;
        } else {
          $('#lilog').innerText = 'failed to sign in: ' + x;
        }
        break;
      case 'msg':
        recv(x);
        break;
    }
  };
  ws.onopen = () => {
    ws.send(JSON.stringify({
      li: {
        username: un,
        room,
      }
    }))
  };
  ws.onclose = (x) => {
    if (loggedin) {
      $('#login').showPopover();
      $('#login div').innerText = 'disconnected. please reload';
    } else {
      $('#lilog').innerText = 'failed to sign in: failed to connect to server';
    }
  }
}