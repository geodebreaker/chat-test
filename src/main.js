$ = x => document.querySelector(x);
$$ = x => document.querySelectorAll(x);

function init(){
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
  window.onfocus = () => { notif = 0; updateTitle() };
  $('#username').onkeypress = x => {
    if (x.key == 'Enter') $('#password').focus();
    $('#username').style.color = colorhash($('#username').value + (x.key.length == 1 ? x.key : ''))
  };
  $('#password').onkeypress = x => { if (x.key == 'Enter') $('#room').focus() };
  $('#msg').onkeypress = x => { if (x.key == 'Enter') $('#send').click() };
  $('#room').onkeypress = x => { if (x.key == 'Enter') $('#libtn').click() };
  $('#send').onclick = x => send($('#msg').value);
  $('#leave').onclick = x => {
    $('#login').showPopover();
    loggedin = null;
    ws.close();
    $('#chat').innerHTML = '';
    userlist = [];
    updateTitle();
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
}

var ws;
var un;
var room;
var notif = 0;
var loggedin = false;
var menuopen = false;
var userlist = [];

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
  x.volume = ontab() ? 1 : 0.5;
  x.play();
}

function mkmsg(from, data, id, date, tag) {
  var u = document.createElement('span');
  u.innerText = from;
  u.innerHTML += `<span class="tag _${tag}"></span>` + ': ';
  u.className = 'usertag';
  u.style.color = colorhash(from);

  var m = document.createElement('span');
  m.innerHTML = styleMsg(data);

  var c = document.createElement('span');
  c.oncontextmenu = rclick;
  c.dataset.id = id;
  c.dataset.date = date;
  c.dataset.text = data;
  c.innerHTML = u.outerHTML + m.outerHTML + '<br>';

  $('#chat').appendChild(c);
  updateChat();

  if (!ontab()) {
    notif++;
    updateTitle()
  }
}

function mkalert(type, data, un) {
  var m = document.createElement('span');
  m.innerText = data;
  m.className = type ? 'bad' : 'good';

  var u = document.createElement('span');
  u.innerText = un;
  u.className = 'usertag';
  u.style.color = colorhash(un);

  var c = document.createElement('span');
  c.innerHTML = m.outerHTML + u.outerHTML + '<br>';

  $('#chat').appendChild(c);
  updateChat();

  if (!ontab()) {
    notif++;
    updateTitle()
  }
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

function updateTitle() {
  $('title').innerText =
    (notif > 0 ? '(' + notif + ') ' : '') +
    'gooberchat' +
    (loggedin ? ' - ' + room : '');
}

init();