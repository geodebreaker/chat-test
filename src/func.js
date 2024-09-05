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
  if (event.target.tagName == 'A' || event.target.tagName == 'IMG')
    return;
  event.preventDefault();
  $('#rclick').style.left = event.clientX + 'px';
  $('#rclick').style.top = event.clientY + 'px';
  $('#rclick').dataset.id = this.dataset.id;
  $('#rc-date').innerText = fmtDate(this.dataset.date);
  $('#rc-copy').onclick = () => { copyText(this.dataset.text) };
  $('#rc-dms').onclick = () => {
    window.location.hash = '!' + this.dataset.user;
  };
  $('#rclick').showPopover();
}

function clickLink(ev, t) {
  if (!confirm(`Do you want to go to "${t}"`))
    ev.preventDefault();
}

function styleMsg(x) {
  var y = x
    .replace(/!/g, '!!')
    .replace(/[<&"]/g, x => '!' + x)
    .replace(
      /\^(.*?)(?<!\\);/g, (x, y) => {
        var z = y.split(/(?<!\\),/g);
        z = styles(z.shift(), z);
        return z ?? x;
      }
    )
    .replace(/(!*?)!([<&"])/g, (x, z, y) =>
      z + (z.length % 2 == 1 ? y : { '<': '&lt;', '&': '&amp;', '"': '&quot;' }[y])
    ).replace(/!!/g, '!');
  return y;
}

function styles(x, y) {
  switch (x) {
    case 'l':
    case 'ls':
      return ('<a href="?" onclick="clickLink(event, ?)" target="?">?</a>'
        .replace('?', y[0].replace(/^(#)?(?:http(s)?:\/\/)?/, (x, y, z) => y ? x : 'http' + (z ?? '') + '://'))
        .replace('?', y[0].startsWith('#') ? "'" + y[0] + "'" : this.href)
        .replace('?', x == 'l' ? '_blank' : '')
        .replace('?', y[1] ?? y[0])
      );
    case '':
      break;
  }
}

function copyText(x) {
  navigator.clipboard.writeText(x).then(x => alert('copied to clipboard')).catch(x => { })
}