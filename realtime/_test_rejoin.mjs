import { WebSocket } from 'ws';
function mkToken(id){const h=Buffer.from(JSON.stringify({alg:'none'})).toString('base64url');const p=Buffer.from(JSON.stringify({id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return `${h}.${p}.s`;}
const PORT=process.env.PORT||8093, ROOM='rj';
function conn(){const ws=new WebSocket(`ws://localhost:${PORT}/room/${ROOM}`);ws._m=[];ws.on('message',d=>ws._m.push(JSON.parse(d.toString())));return ws;}
const open=ws=>new Promise(r=>ws.on('open',r));const sleep=ms=>new Promise(r=>setTimeout(r,ms));const send=(ws,o)=>ws.send(JSON.stringify(o));const last=(ws,t)=>[...ws._m].reverse().find(m=>m.type===t);
let fail=0;const check=(c,l)=>{console.log((c?'PASS ':'FAIL ')+l);if(!c)fail++;};
async function main(){
  const a=conn(),b=conn();await Promise.all([open(a),open(b)]);await sleep(50);
  send(a,{type:'join',token:mkToken('uA')});send(b,{type:'join',token:mkToken('uB')});await sleep(80);
  send(a,{type:'enqueue'});await sleep(30);
  check(last(b,'turn')?.turnHolder==='uA','uA holds pen');
  // Re-join SAME identity on same socket (snapshot resync, same user) -> keeps pen
  a._m=[]; send(a,{type:'join',token:mkToken('uA')});await sleep(60);
  check(!!last(a,'snapshot'),'re-join same identity returns snapshot');
  check(last(a,'snapshot')?.session?.turnHolder==='uA','re-join same identity keeps pen in snapshot');
  // Now re-join on SAME socket with DIFFERENT identity uC -> old uA must vacate pen
  a._m=[]; b._m=[]; send(a,{type:'join',token:mkToken('uC')});await sleep(80);
  check(last(a,'snapshot')?.session?.turnHolder===null,'identity swap vacates old holder (uA) -> null');
  // and the socket is now uC; uC enqueue gets pen
  send(a,{type:'enqueue'});await sleep(40);
  check(last(b,'turn')?.turnHolder==='uC','swapped socket acts as uC');
  a.close();b.close();await sleep(100);
  console.log(fail===0?'\nALL PASS':`\n${fail} FAIL`);process.exit(fail?1:0);
}
main();
