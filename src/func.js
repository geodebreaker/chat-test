function ontab() {
  return document.visibilityState === 'visible' && document.hasFocus();
};

function fmtDate(ms) {
  var x = new Date(parseInt(ms));
  var y = x.getHours() % 12;
  var z = x.getMinutes().toString();
  return `${x.getMonth() + 1}/${x.getDate()}/${x.getFullYear()} ` +
    `${y == 0 ? 12 : y}:${z.length == 1 ? '0' + z : z} ${x.getHours() > 11 ? 'PM' : 'AM'}`;
}

function colorhash(x) {
  var r = x => parseInt(('' + x).split('').reverse().join(''));
  try {
    var w = x.split('');
  } catch (e) {
    return 'white';
  }
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
var chstyle = 233;
// function old_colorhash(x) {
//   var hash = 0//chstyle//932;
//   for (var i = 0; i < x.length; i++) {
//     hash = x.charCodeAt(i) + ((hash << 5) - hash) + chstyle;
//   }
//   var r = (hash >> 8) & 0xF;
//   var g = (hash >> 4) & 0xF;
//   var b = hash & 0xF;
//   var mavg = 0xA;
//   let avg = (r + g + b) / 3;
//   if (avg < mavg) {
//     r = Math.min(0xF, r + mavg - avg);
//     g = Math.min(0xF, g + mavg - avg);
//     b = Math.min(0xF, b + mavg - avg);
//   }
//   return `#${((1 << 24) | ((r * 0xF) << 16) | ((g * 0xF) << 8) | (b * 0xF)).toString(16).slice(1)}`;
// }

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
  if (!room.startsWith('?') && !confirm(`Do you want to go to "${t}"?`))
    ev.preventDefault();
  else if (t.startsWith('#')) {
    $('#room').value = t.replace(/#/, '');
    leave();
    login();
  }
}


function styleMsg(x) {
  var y = styleEmote(x)
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
      return (`<a onclick="clickLink(event, ${"'" + href + "'"})" target="${x == 'l' ? '_blank' : ''
        }" href="${href}">${y[1] ?? y[0]
        }</a>`);
    case 'p':
      return (
        `<img src="${y[0].replace(/^(?:http(s?):\/\/)?/, () => 'https://')}" class="img${y[1] == 'emote' ? ' emote' : ''}">`);
    case 'b':
    case 'i':
    case 'u':
    case 's':
      return `<${x}>${y.join(',')}</${x}>`;
    case 'c':
      return `<span style="color:${y.shift().replace(/;/g, '')};">${y.join(',')}</span>`;
    case 'uc':
      return `<span style="color:${colorhash(y.length == 1 ? y[0] : y.shift())};">${y.join(',')}</span>`;
    case 'h':
      return `<span style="background-color:${y.shift().replace(/;/g, '')};padding:0px 2px;">${y.join(',')}</span>`;
    case 'sp':
      return `<span style="${spoilerStyle}" onclick="spoilerStyleClick(this)">${y.join(',')}</span>`;
    case 'sans':
      return `<span style="font-family: 'Comic Sans MS';font-size: 15px;">${y.join(',')}</span>`;
  }
}

var spoilerStyle = "background-color:#000;color:#000;cursor:pointer;padding:0px 2px;";

function spoilerStyleClick(e) {
  e.style = "background-color:#444;color:#inherit;cursor:text;padding:0px 2px;";
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

  const args = [];
  let q = false;
  let str = "";

  for (let i = 0; i <= txt.length; i++) {
    const c = txt[i];

    if (i == txt.length) {
      args.push(str);
    } else if (c == '\\') {
      str += txt[++i];
    } else if ((c == '"' || c == '\'') &&
      (((txt[i - 1] == ' ' || i == 0) && !q) ||
        (txt[i + 1] == ' ' && q))) {
      q = !q;
      if (txt[i + 1] == ' ' && q) i++;
    } else if (c == ' ' && !q) {
      args.push(str);
      str = "";
    } else {
      str += c;
    }
  }

  let cmd = args.shift() ?? '';

  return { cmd, args };

}

function handleCmd(cmd, args) {
  return new Promise((res, rej) => {
    switch (cmd) {
      case 'help':
      case '?':
        res([ 
          'commands:',
          '^c,#0f0,help|?:; prints this message',
          '^c,#0f0,test:; test function',
          '^c,#0f0,goto [room?]:; goto the given room. if no room provided, it brings you to main',
        ].concat(tag > 1 ? [
          '^c,#0f0,stats [user]:; gives you statistics about the given user',
          '^c,#0f0,ban [user]:; will flip the ban state of a user, banned -> unban, unbanned -> ban',
          '^c,#0f0,setpopup [text?...]:; sets a popup / banner to appear for all users until changed',
          '^c,#0f0,runjs [code...]:; will run javascript code provided for all other users.',
        ] : []).map(x => x.replace(/^.{90}.*? /, x => x + '\n')).join('\n\n'));
        break;
      case 'test':
        res('hi!');
        break;
      case 'goto':
        const roomName = args[0];
        $('#room').value = roomName ?? '';
        leave();
        login();
        res();
      case 'setpopup':
        ws.send(JSON.stringify({ mod: ['setpopup', args.join(' ')] }));
        break;
      case 'stats':
        statsret = res;
        ws.send(JSON.stringify({ mod: ['stats', args[0]] }));
        break;
      case 'ban':
        ws.send(JSON.stringify({ mod: ['ban', args[0]] }));
        res('attempted to ban ^uc,' + args[0] + ';')
        break;
      case 'to':
        if (parseFloat(args[1]) == NaN)
          rej('error: invalid time');
        ws.send(JSON.stringify({ mod: ['to', args[0], parseFloat(args[1]) * 60e3] }));
        res('attempted to timeout ^uc,' + args[0] + '; for ' + args[1] + 'm')
        break;
      case 'runjs':
        ws.send(JSON.stringify({ runjs: args.join(' ') }));
        res('running code');
        break;
      default:
        rej(`command not found "${cmd}".\n^c,yellow,TIP:; use /help or /? for help`)
        break;
    }
  });
}

function styleEmote(x) {
  const emo = [ "mood", "goober", "horror", "nohorror", "clueless", "silly", "roll", "mh", "moodenheimer" ];

  return x.replace(/(\\?)(:(.{2,8}?):)/g, (_match, bs, og, name) =>
    bs ? og : emo.includes(name) ? '^p,' + `https://evrtdg.com/emoji/${name}.jpg` + ',emote;' : og);
}

var statsret = null;
