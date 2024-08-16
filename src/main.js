$ = x => document.querySelector(x);

var ws;
var un;
var room;
var loggedin = false;
var menuopen = false;
var userlist = [];

if (window.localStorage && localStorage.un) {
  un = localStorage.un;
  $('#username').value = un;
  room = localStorage.room;
  $('#room').value = room;
}

$('#username').onkeypress = x => {
  if (x.key == 'Enter') $('#room').focus();
  $('#username').style.color = colorhash($('#username').value + (x.key.length == 1 ? x.key : ''))
};
$('#msg').onkeypress = x => { if (x.key == 'Enter') $('#send').click() };
$('#room').onkeypress = x => { if (x.key == 'Enter') $('#libtn').click() };
$('#send').onclick = x => send($('#msg').value);
$('#leave').onclick = x => {
  $('#login').showPopover();
  loggedin = null;
  ws.close();
  $('#chat').innerHTML = '';
  userlist = [];
};
$('#libtn').onclick = x => login();
$('#openmenu').onclick = x => {
  menuopen = !menuopen;
  $('body').style.gridTemplateAreas =
    "'u r r l o' 'c c " + (menuopen ? "x x x" : "c c c") + "' 'm m m s s'";
  $('#menu').style.display = (menuopen ? 'block' : 'none');
  ws.send(JSON.stringify({ users: '' }));
};

$('#login').showPopover();

function send(value) {
  if (value != '') {
    ws.send(JSON.stringify({ msg: value }));
    mkmsg(un, value);
    $('#msg').value = '';
  }
}

function recv(value) {
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
  updateChat();
}

function mkalert(type, data, un) {
  var m = document.createElement('span');
  m.innerText = data;
  m.className = type ? 'bad' : 'good';
  var u = document.createElement('span');
  u.innerText = un;
  u.className = 'usertag';
  u.style.color = colorhash(un);
  $('#chat').innerHTML += m.outerHTML + u.outerHTML + '<br>';
  updateChat();
}

function updateChat() {
  $('#chat').scrollTop = $('#chat').scrollHeight;
}

function updateMenu() {
  $('#menu').innerHTML = '';
  for (var un of userlist) {
    var u = document.createElement('span');
    u.innerText = un;
    u.className = 'usertag';
    u.style.color = colorhash(un);
    $('#menu').innerHTML += u.outerHTML + '<br>';
  }
}

function colorhash(x) {
  var r = x => parseInt(('' + x).split('').reverse().join(''));
  var w = x.split('');
  var y = 0;
  for (var z of w) {
    y += z.charCodeAt(0);
  }
  y = Math.floor(y / 10000 + y);
  y = r(y);
  y *= 202383492;
  y %= 10284631;
  y *= 846689351;
  y = r(y);
  y %= 38357492;
  y *= 84748;
  y = r(y);
  var v = [];
  var u = 0;
  for (var i = 0; i < 3; i++) {
    y = Math.floor(y / 255);
    v.push(y % 255);
    u += y % 255;
  }
  u /= 3;
  if (u <= 100) {
    v = v.map(x => 255 - x);
  }
  return '#' + v
    .map(x => x.toString(16))
    .map(x => "0".repeat(Math.max(0, 2 - x.length)) + x)
    .join('');
}

function login() {
  un = $('#username').value;
  room = $('#room').value;
  if (window.localStorage) {
    localStorage.un = un;
    localStorage.room = room;
  }
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
          $('#undisplay').style.color = colorhash(un);
          $('#roomdisplay').innerText = room;
          loggedin = true;
        } else {
          $('#lilog').innerText = 'failed to sign in: ' + x;
        }
        break;
      case 'msg':
        recv(x);
        break;
      case 'connect':
        mkalert(false, 'connected: ', x);
        userlist.push(x);
        updateMenu();
        break;
      case 'disconnect':
        mkalert(true, 'disconnected: ', x);
        userlist.splice(userlist.indexOf(x), 1);
        updateMenu();
        break;
      case 'users':
        userlist = x;
        updateMenu();
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
    } else if (loggedin !== null) {
      $('#lilog').innerText = 'failed to sign in: failed to connect to server';
    }
  }
}