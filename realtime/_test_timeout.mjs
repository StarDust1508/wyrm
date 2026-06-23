import { WebSocket } from 'ws';
function mkToken(id) {
  const h = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ id, exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url');
  return `${h}.${p}.s`;
}
const PORT = process.env.PORT || 8098;
const ROOM = 'to';
function conn() { const ws = new WebSocket(`ws://localhost:${PORT}/room/${ROOM}`); ws._m=[]; ws.on('message',d=>ws._m.push(JSON.parse(d.toString()))); return ws; }
const open = ws => new Promise(r=>ws.on('open',r));
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const send=(ws,o)=>ws.send(JSON.stringify(o));
const last=(ws,t)=>[...ws._m].reverse().find(m=>m.type===t);
let fail=0; const check=(c,l)=>{console.log((c?'PASS ':'FAIL ')+l); if(!c)fail++;};

async function main(){
  const a=conn(),b=conn(); await Promise.all([open(a),open(b)]); await sleep(50);
  send(a,{type:'join',token:mkToken('uA')}); send(b,{type:'join',token:mkToken('uB')});
  await sleep(80);
  // TURN_SECONDS=1 set via env on server. A enqueues, B enqueues.
  send(a,{type:'enqueue'}); await sleep(30);
  send(b,{type:'enqueue'}); await sleep(30);
  check(last(a,'turn')?.turnHolder==='uA','A holds pen');
  // Wait for timeout (>1s) -> auto-pass to B
  await sleep(1300);
  check(last(b,'turn')?.turnHolder==='uB','timeout auto-passed pen A->B');
  // Wait again for B's turn to time out -> empty queue -> null
  await sleep(1300);
  check(last(b,'turn')?.turnHolder===null,'second timeout -> empty queue -> null turnHolder');
  // After null, no timer should keep firing. capture msg count, wait, ensure no extra 'turn'
  const n = b._m.filter(m=>m.type==='turn').length;
  await sleep(1500);
  const n2 = b._m.filter(m=>m.type==='turn').length;
  check(n===n2,'no phantom turn broadcasts after pen idle (no timer leak)');
  a.close(); b.close(); await sleep(100);
  console.log(fail===0?'\nALL PASS':`\n${fail} FAIL`); process.exit(fail?1:0);
}
main();
