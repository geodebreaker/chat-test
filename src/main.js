$ = x => document.querySelector(x);

$('#msg').onkeypress = x => { if (x.key == 'Enter') $('#send').click() };
$('#send').onclick = x => send($('#msg').value);
$('#leave').onclick = x => $('#login').showPopover();
$('#libtn').onclick = x => login();

$('#login').showPopover();

var ws;

function send(value) {
  console.log(value);
  ws.send(JSON.stringify({send: k}));
}

function recv(value) {
  console.log(value);
  var x = JSON.parse(value);
  x = x[Object.keys(x)[0]];
  mkmsg(x.from, x.data);
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

function setupws(){
  ws = new WebSocket();
}