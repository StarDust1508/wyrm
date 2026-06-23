import { WebSocket } from 'ws';
function mkToken(id){const h=Buffer.from(JSON.stringify({alg:'none'})).toString('base64url');const p=Buffer.from(JSON.stringify({id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return `${h}.${p}.s`;}
const PORT=process.env.PORT||8096, ROOM='mt';
function conn(){const ws=new WebSocket(`ws://localhost:${PORT}/room/${ROOM}`);ws._m=[];ws.on('message',d=>ws._m.push(JSON.parse(d.toString())));return ws;}
const open=ws=>new Promise(r=>ws.on('open',r));const sleep=ms=>new Promise(r=>setTimeout(r,ms));const send=(ws,o)=>ws.send(JSON.stringify(o));const last=(ws,t)=>[...ws._m].reverse().find(m=>m.type===t);
let fail=0;const check=(c,l)=>{console.log((c?'PASS ':'FAIL ')+l);if(!c)fail++;};
async function main(){
  // Same user uA on two tabs (tab1, tab2). uB is another user.
  const t1=conn(),t2=conn(),b=conn();await Promise.all([open(t1),open(t2),open(b)]);await sleep(50);
  send(t1,{type:'join',token:mkToken('uA')});
  send(t2,{type:'join',token:mkToken('uA')});
  send(b,{type:'join',token:mkToken('uB')});
  await sleep(100);
  // uA enqueues from tab1 -> gets pen
  send(t1,{type:'enqueue'});await sleep(40);
  check(last(b,'turn')?.turnHolder==='uA','uA holds pen');
  // uB enqueues -> queued behind uA
  send(b,{type:'enqueue'});await sleep(40);
  // Now uA closes tab2 (still has tab1 open). Should uA KEEP the pen?
  t2.close();await sleep(120);
  const holderAfter = last(b,'turn')?.turnHolder;
  check(holderAfter==='uA','uA keeps pen after closing a duplicate tab (still connected via tab1)');
  t1.close();b.close();await sleep(100);
  console.log(fail===0?'\nALL PASS':`\n${fail} FAIL`);process.exit(fail?1:0);
}
main();
