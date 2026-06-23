import { WebSocket } from 'ws';
function mkToken(id){const h=Buffer.from(JSON.stringify({alg:'none'})).toString('base64url');const p=Buffer.from(JSON.stringify({id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return `${h}.${p}.s`;}
const PORT=process.env.PORT||8097, ROOM='hb';
function conn(){const ws=new WebSocket(`ws://localhost:${PORT}/room/${ROOM}`);ws._m=[];ws.on('message',d=>ws._m.push(JSON.parse(d.toString())));return ws;}
const open=ws=>new Promise(r=>ws.on('open',r));const sleep=ms=>new Promise(r=>setTimeout(r,ms));const send=(ws,o)=>ws.send(JSON.stringify(o));const last=(ws,t)=>[...ws._m].reverse().find(m=>m.type===t);
let fail=0;const check=(c,l)=>{console.log((c?'PASS ':'FAIL ')+l);if(!c)fail++;};
async function main(){
  const a=conn(),b=conn();await Promise.all([open(a),open(b)]);await sleep(50);
  send(a,{type:'join',token:mkToken('uA')});send(b,{type:'join',token:mkToken('uB')});await sleep(80);
  send(a,{type:'enqueue'});await sleep(30);send(b,{type:'enqueue'});await sleep(30);
  check(last(b,'turn')?.turnHolder==='uA','A holds pen');
  // Make A unresponsive to ws ping: monkeypatch pong off by suppressing the auto-pong.
  // ws auto-responds to ping with pong; to simulate dead socket, pause the underlying socket.
  a._socket = a._socket; a.pause(); // pause reading; ws won't process ping frames -> no auto-pong
  // also block outgoing: we can't easily; rely on pause stopping pong handling
  // HEARTBEAT_MS short on server. Wait 2 cycles.
  await sleep(2500);
  check(last(b,'turn')?.turnHolder==='uB','dead holder terminated -> pen auto-passed to B');
  b.close();try{a.terminate();}catch{} await sleep(100);
  console.log(fail===0?'\nALL PASS':`\n${fail} FAIL`);process.exit(fail?1:0);
}
main();
