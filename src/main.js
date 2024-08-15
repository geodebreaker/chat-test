$=x=>document.querySelector(x);

$('#msg').onkeypress=x=>{if(x.key=='Enter')$('#send').click()};
$('#send').onclick=x=>send($('#msg').value);

var ws;

function send(value){
  console.log(value);
  ws.send(JSON.stringify())
}

function recv(value){
  console.log(value)
}

