$ = x => document.querySelector(x);
$$ = x => document.querySelectorAll(x);

var ws;
var un;
var room;
var loggedin = false;
var menuopen = false;
var userlist = [];

if (window.localStorage && localStorage.un) {
  un = localStorage.un;
  $('#username').value = un;
  $('#password').value = localStorage.pw;
  room = localStorage.room;
  $('#room').value = room;
}

document.addEventListener('click', e => {
  if (!(e.target == $('#rclick') || $('#rclick').contains(e.target)))
    $('#rclick').hidePopover();
});
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
  if (menuopen)
    ws.send(JSON.stringify({ users: '' }));
};

$('#login').showPopover();

function send(value) {
  if (value != '') {
    var id = 'TMP-' + Math.floor(Math.random() * 256).toString(16);
    ws.send(JSON.stringify({ msg: { value: value, tmpid: id } }));
    mkmsg(un, value, id, Date.now());
    $('#msg').value = '';
  }
}

function recv(value) {
  mkmsg(value.from, value.data, value.id, value.date, value.tag);

  x = new Audio(ping);
  x.volume = document.visibilityState == 'visible' ? 1 : 0.5;
  x.oncanplay = () =>
    x.play();
}

function mkmsg(from, data, id, date, tag) {
  var u = document.createElement('span');
  u.innerText = from;
  u.innerHTML += `<span class="tag _${tag}"></span>` + ': ';
  u.className = 'usertag';
  u.style.color = colorhash(from);
  u.setAttribute('oncontextmenu', 'rclick(event)');
  u.dataset.id = id;
  u.dataset.date = date;

  var m = document.createElement('span');
  m.innerText = data;
  m.oncontextmenu = 'rclick';
  m.setAttribute('oncontextmenu', 'rclick(event)');
  m.dataset.id = id;
  m.dataset.date = date;

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
    u.innerText = un[0];
    u.innerHTML += `<span class="tag _${un[2]}"></span>`;
    u.className = 'usertag';
    u.style.color = colorhash(un[0]);
    $('#menu').innerHTML += u.outerHTML + '<br>';
  }
}

function rclick(event) {
  event.preventDefault();
  $('#rclick').style.left = event.clientX + 'px';
  $('#rclick').style.top = event.clientY + 'px';
  $('#rc-date').innerText = fmtDate(event.target.dataset.date);
  $('#rclick').showPopover();
}

function fmtDate(ms) {
  var x = new Date(parseInt(ms));
  var y = x.getHours() % 12;
  var z = x.getMinutes().toString();
  return `${x.getMonth()}/${x.getDay()}/${x.getFullYear()} ` +
    `${y == 0 ? 12 : y}:${z.length == 1 ? '0' + z : z} ${x.getHours() > 11 ? 'PM' : 'AM'}`;
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
        userlist.splice(userlist.findIndex(z=>z[0]==x[0]), 1);
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
        $$('[data-id="' + x.tmpid + '"]').forEach(y => y.dataset.id = x.newid)
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