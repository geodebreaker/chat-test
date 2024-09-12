function ontab() {
  return document.visibilityState === 'visible' && document.hasFocus();
};

function fmtDate(ms) {
  var x = new Date(parseInt(ms));
  var y = x.getHours() % 12;
  var z = x.getMinutes().toString();
  return `${x.getMonth() + 1}/${x.getDay() + 1}/${x.getFullYear()} ` +
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

function rclick(event) {
  if (event.target.tagName == 'A')
    return;
  event.preventDefault();
  $('#rclick').style.left = event.clientX + 'px';
  $('#rclick').style.top = (event.clientY + 200 > innerHeight ? innerHeight - 200 : event.clientY) + 'px';
  $('#rclick').dataset.id = this.dataset.id;
  $('#rc-date').innerText = fmtDate(this.dataset.date);
  $('#rc-copy').onclick = () => { copyText(this.dataset.text) };
  $('#rc-dms').onclick = () => {
    window.location.hash = '!' + this.dataset.user;
  };
  if (tag <= 1)
    $$('#rclick .mod').forEach(x => x.style.display = 'none');
  else
    $$('#rclick .mod').forEach(x => x.style.display = 'block');
  $('#rc-to').onclick = () => {
    var t = parseFloat(prompt('Time in minutes for timeout'));
    if (!t) {
      alert('invalid time');
    } else {
      ws.send(JSON.stringify({ mod: ['to', this.dataset.user, t * 60e3] }))
    }
  };
  $('#rc-ban').onclick = () => {
    ws.send(JSON.stringify({ mod: ['ban', this.dataset.user] }));
  }
  $('#rc-del').onclick = () => {
    ws.send(JSON.stringify({ mod: ['del', this.dataset.id] }));
  }
  $('#rclick').showPopover();
}

function clickLink(ev, t) {
  if (!room.startsWith('?') && !confirm(`Do you want to go to "${t}?"`))
    ev.preventDefault();
}


function styleMsg(x) {
  var y = x
    .replace(/(?<=^| )@(\S{2,12})/g, (x, y) => '^ls,#!' + y + ',@' + y + ';')
    .replace(/(?<=^| )#(\S{1,64})/g, (x, y) => '^ls,#' + y + ';')
    .replace(/!/g, '!!')
    .replace(/[<&"]/g, x => '!' + x);
  var z = '';
  var l = [];
  for (var i = 0; i < y.length; i++) {
    if (y[i] == '\\' && y[i + 1] != ',') {
      z += y[++i] ?? '';
    } else if (y[i] == '^') {
      l.push(z);
      z = '';
    } else if (l.length > 0 && y[i] == ';') {
      var w = z.split(/(?<!\\),/g);
      w = styles(w.shift(), w.map(x => x.replace(/\\(\\|,|;)/g, (x, y) => y)));
      z = l.pop() + (w ?? x);
    } else {
      z += y[i];
    }
  }
  y = z;
  y = y.replace(/(!*?)!([<&"])/g, (x, z, y) =>
    z + (z.length % 2 == 1 ? y : { '<': '&lt;', '&': '&amp;', '"': '&quot;' }[y])
  ).replace(/!!/g, '!');
  return y;
}

function styles(x, y) {
  switch (x) {
    case 'l':
    case 'ls':
      var href = y[0].startsWith('#') ? y[0] : y[0].replace(/^(?:http(s?):\/\/)?/, () => 'https://');
      return (`<a onclick="clickLink(event, ${y[0].startsWith('#') ? "'" + y[0] + "'" : href
        })" target="${x == 'l' ? '_blank' : ''
        }" href="${href}">${y[1] ?? y[0]
        }</a>`);
    case 'p':
      return `<img src="${y[0].replace(/^(?:http(s?):\/\/)?/, () => 'https://')}" class="img">`;
    case 'b':
    case 'i':
    case 'u':
    case 's':
      return `<${x}>${y.join(',')}</${x}>`;
    case 'c':
      return `<span style="color:${y.shift().replace(/;/g, '')};">${y.join(',')}</span>`;
    case 'uc':
      return `<span style="color:${colorhash(y.join(','))};">${y.join(',')}</span>`;
    case 'h':
      return `<span style="background-color:${y.shift().replace(/;/g, '')};">${y.join(',')}</span>`;
  }
}

function copyText(x) {
  navigator.clipboard.writeText(x).then(x => alert('copied to clipboard')).catch(x => { })
}

/* 
 * window.onbeforeunload = e => {
 *   e.preventDefault();
 *   e.returnValue = '';
 * } 
 * 
 */

function keepAlive() {
  requestAnimationFrame(keepAlive);
}

keepAlive();

function genTag(un, n, f) {
  var u = document.createElement('span');
  var y = document.createElement('span');
  y.innerText = un;
  u.innerHTML = (n != 0 && n != undefined ? `<span class="tag _${n}">${'X VMA'[n + 1]}</span>` : '') + y.innerHTML + (f ? ': ' : '');
  u.className = 'usertag';
  u.style.color = n < 0 ? 'red' : colorhash(un);
  return u;
}

function playPing() {
  var x = new Audio(ping);
  x.volume = ontab() ? 1 : 0.5;
  x.play();
  var img = 'https://evrtdg.com/goober.jpg';
  if (Notification.permission == "granted" && !ontab()) {
    new Notification('ping!', { icon: img, /*image: img*/ });
  } else if (!ontab()) {
    Notification.requestPermission();
  }
}

function parseCmd(value) {

  const txt = value.substring(1);
  if (txt == '') return;

  let cmd = null;
  const args = [];

  let InQuotes = false;
  let StringConstruct = '';

  for (let CharIndex = 0; CharIndex <= txt.length; CharIndex++) {

    const char = txt.charAt(CharIndex);
    const HasEscapeChar = CharIndex != 0 && txt.charAt(CharIndex - 1) == '\\';
    const IsQuote = !HasEscapeChar && char.replace('"', '\'') == '\'';        // this is ' char :mood:

    const IsWhitespace = char == ' ';

    // console.log(`Char: ${char}\nUsingHasEscapeChar: ${HasEscapeChar}\nIsQuote: ${IsQuote}\nIsWhitespace: ${IsWhitespace}`); 
    // for debugging if needed

    if (IsQuote && !HasEscapeChar) InQuotes = !InQuotes;
    if ((IsWhitespace && !InQuotes) || CharIndex == txt.length) {
      args.push(StringConstruct);
      StringConstruct = '';
    } else if (!IsQuote && char != '\\') StringConstruct += char;

  }
  cmd = args.shift();

  return { cmd, args };

}

function handleCmd(cmd, args) {
  return new Promise((res, rej) => {
    switch (cmd) {
      case 'help':
        res('commands:\n' +
          'help: prints this message\n' +
          'test: test function\n' +
          'goto [room?]: goto the given room. if no room is provided it\'ll bring you to the main room');
        break;
      case 'test':
        res('hi!');
        break;
      case 'goto':
        const roomName = args[0];
        (roomName) ? window.location.href = '/#' + roomName : window.location.href = '/#';
        res();
      default:
        rej(`command not found "${cmd}"`)
        break;
    }
  });
}

function emoteFormat(x) {
  const emotes = {
    mood: 'http://raw.githubusercontent.com/geodebreaker/mystuff/main/mood.jpg',
    goober: 'http://evrtdg.com/goober.jpg'
  };
  for (const [name, source] of Object.entries(emotes)) x = x
  .replaceAll(`\\:${name}:`, `:\\${name}:`)
  .replaceAll(`:${name}:`, `^p,${source};`)
  .replaceAll(`:\\${name}:`, `:${name}:`);

  return x;
}
