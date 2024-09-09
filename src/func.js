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
  if (!confirm(`Do you want to go to "${t}"`))
    ev.preventDefault();
}

function styleMsg(x) {
  var y = x
    .replace(/(?<= )@(\S{2,12})/g, (x, y) => '^ls,#!' + y + ',@' + y + ';')
    .replace(/!/g, '!!')
    .replace(/[<&"]/g, x => '!' + x)
    .replace(
      /\^(.*?)(?<!\\);/g, (x, y) => {
        var z = y.split(/(?<!\\),/g);
        z = styles(z.shift(), z.map(x => styleMsg(x)));
        return z ?? x;
      }
    )
    .replace(/(!*?)!([<&"])/g, (x, z, y) =>
      z + (z.length % 2 == 1 ? y : { '<': '&lt;', '&': '&amp;', '"': '&quot;' }[y])
    ).replace(/!!/g, '!')
    .replace(/(?<!\\)\\(,|;)/g, (x, y) => y);
  return y;
}

function styles(x, y) {
  switch (x) {
    case 'l':
    case 'ls':
      return (`<a onclick="clickLink(event, ${y[0].startsWith('#') ? "'" + y[0] + "'" : this.href
        })" target="${x == 'l' ? '_blank' : ''
        }" href="${y[0].replace(/^(?:http(s?):\/\/)?/, () => 'https://')
        }">${y[1] ?? y[0]
        }</a>`);
    case 'p':
      return `<img src="${y[0].replace(/^(?:http(s?):\/\/)?/, () => 'https://')}" class="img">`;
    case 'b':
      return `<b>${y.join(',')}</b>`;
    case 'i':
      return `<i>${y.join(',')}</i>`;
    case 'u':
      return `<u>${y.join(',')}</u>`;
    case 'c':
      return `<span style="color:${y.shift().replace(/;/g, '')};">${y.join(',')}</span>`;
  }
}

function copyText(x) {
  navigator.clipboard.writeText(x).then(x => alert('copied to clipboard')).catch(x => { })
}

// window.onbeforeunload = e => {
//   e.preventDefault();
//   e.returnValue = '';
// }

function keepAlive() {
  requestAnimationFrame(keepAlive);
}

keepAlive();

function genTag(un, n, f) {
  var u = document.createElement('span');
  var y = document.createElement('span');
  y.innerText = un;
  u.innerHTML = (n > 0 ? `<span class="tag _${n}">${'VMA'[n - 1]}</span>` : '') + y.innerHTML + (f ? ': ' : '');
  u.className = 'usertag';
  u.style.color = n < 0 ? 'red' : colorhash(un);
  return u;
}

function playPing() {
  var x = new Audio(ping);
  x.volume = ontab() ? 1 : 0.5;
  x.play();
  if (!ontab()) {
    if (Notification.permission == "granted") {
      new Notification('ping!', {icon: 'https://evrtdg.com/goober.jpg'})
    } else {
      Notification.requestPermission();
    }
  }
}