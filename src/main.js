$ = x => document.querySelector(x);
$$ = x => document.querySelectorAll(x);

function init() {
  if (window.localStorage && localStorage.un) {
    un = localStorage.un;
    $('#username').value = un;
    $('#password').value = localStorage.pw;
    room = window.location.hash.replace('#', '') || localStorage.room;
    $('#room').value = room;
  }

  document.addEventListener('click', e => {
    if (!(e.target == $('#rclick') || ($('#rclick').contains(e.target) && !e.target.classList.contains('btn'))))
      $('#rclick').hidePopover();
  });
  window.onfocus = () => { notif = 0; updateTitle() };
  window.onhashchange = (e) => {
    var old = $('#room').value;
    if (old != ($('#room').value = new URL(e.newURL).hash.replace('#', ''))) {
      leave(true);
      login();
    }
  };
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
    leave(true);
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
var tag = 0;
var notif = 0;
var lastping = 0;
var loggedin = false;
var menuopen = false;
var userlist = [];



function send(value) {
  if (value != '') {

    const is_cmd = value.startsWith('/');
    if (is_cmd) {

      // command functionality to add later
      $('#msg').value = '';

    } else {

      // normal message
      var id = 'TMP-' + Math.floor(Math.random() * 256).toString(16);
      ws.send(JSON.stringify({ msg: { value: value, tmpid: id } }));
      mkmsg(un, value, id, Date.now(), tag);
      $('#msg').value = '';

    }

  }
}

function recv(value) {
  mkmsg(value.from, value.data, value.id, value.date, value.tag);
  playPing();
}

function mkmsg(from, data, id, date, tag, x) {
  var u = genTag(from, tag, true);

  var m = document.createElement('span');
  m.innerHTML = styleMsg(data);

  var c = document.createElement('span');
  c.oncontextmenu = rclick;
  c.dataset.id = id;
  c.dataset.date = date;
  c.dataset.text = data;
  c.dataset.user = from;
  c.innerHTML = u.outerHTML + m.outerHTML + '<br>';

  $('#chat').appendChild(c);
  updateChat();

  if (!ontab() && !x) {
    notif++;
    updateTitle()
  }
}

function mkalert(type, data, un, tag, x) {
  var m = document.createElement('span');
  m.innerText = data;
  m.className = type ? 'bad' : 'good';

  var u = !x ? genTag(un, tag) : {outerHTML: styleMsg(un)};

  var c = document.createElement('span');
  c.innerHTML = m.outerHTML + u.outerHTML + '<br>';

  $('#chat').appendChild(c);
  updateChat();

  playPing();
  if (!ontab()) {
    notif++;
    updateTitle();
  }
}

function updateChat() {
  $('#chat').scrollTop = $('#chat').scrollHeight;
}

function updateMenu() {
  $('#menu').innerHTML = '';
  for (var un of userlist) {
    var u = genTag(un[0], un[2]);
    $('#menu').innerHTML += (un[1] ? '+' : '-') + ' ' + u.outerHTML + '<br>';
  }
}

function updateTitle() {
  $('title').innerText =
    (notif > 0 ? '(' + notif + ') ' : '') +
    'gooberchat' +
    (loggedin ? ' - ' + room : '');
}

init();
