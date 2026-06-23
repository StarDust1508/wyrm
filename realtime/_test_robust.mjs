import { WebSocket } from 'ws';
function mkToken(id,extra={}){const h=Buffer.from(JSON.stringify({alg:'none'})).toString('base64url');const p=Buffer.from(JSON.stringify({id,exp:Math.floor(Date.now()/1000)+3600,...extra})).toString('base64url');return `${h}.${p}.s`;}
const PORT=process.env.PORT||8095, ROOM='rb';
function conn(){const ws=new WebSocket(`ws://localhost:${PORT}/room/${ROOM}`);ws._m=[];ws.on('message',d=>ws._m.push(JSON.parse(d.toString())));return ws;}
const open=ws=>new Promise(r=>ws.on('open',r));const sleep=ms=>new Promise(r=>setTimeout(r,ms));const send=(ws,o)=>ws.send(JSON.stringify(o));const last=(ws,t)=>[...ws._m].reverse().find(m=>m.type===t);
let fail=0;const check=(c,l)=>{console.log((c?'PASS ':'FAIL ')+l);if(!c)fail++;};
async function main(){
  const a=conn();await open(a);await sleep(40);
  send(a,{type:'join',token:mkToken('uA')});await sleep(60);
  send(a,{type:'enqueue'});await sleep(40);
  // type with non-string text (number) -> should not crash, coerced
  a._m=[]; send(a,{type:'type',text:12345});await sleep(40);
  check(last(a,'buffer')?.text==='12345','type coerces non-string text');
  // type with null text
  send(a,{type:'type',text:null});await sleep(40);
  check(last(a,'buffer')?.text==='','type null -> empty buffer (no crash)');
  // voteDirection with missing dirId -> error no crash
  a._m=[]; send(a,{type:'voteDirection'});await sleep(40);
  check(last(a,'error')?.code==='no_direction','voteDirection missing dirId -> error');
  // react with bad kind
  a._m=[]; send(a,{type:'react',kind:'banana'});await sleep(40);
  check(last(a,'error')?.code==='bad_react','react bad kind -> error');
  // react missing kind
  a._m=[]; send(a,{type:'react'});await sleep(40);
  check(last(a,'error')?.code==='bad_react','react missing kind -> error');
  // commit with no text and empty buffer -> commits empty? should not crash
  a._m=[]; send(a,{type:'commit'});await sleep(40);
  check(!!last(a,'committed'),'commit with no text still commits (buffer)');
  // message that is a JSON array (not object) -> bad_message
  a._m=[]; a.send(JSON.stringify([1,2,3]));await sleep(40);
  check(last(a,'error')?.code==='bad_message' || last(a,'error')?.code==='unknown_type','array message -> error (no crash)');
  // message that is JSON null
  a._m=[]; a.send('null');await sleep(40);
  check(last(a,'error')?.code==='bad_message','null message -> bad_message');
  // huge buffer cap
  a._m=[]; send(a,{type:'enqueue'});await sleep(40);
  send(a,{type:'type',text:'x'.repeat(50000)});await sleep(60);
  check((last(a,'buffer')?.text?.length||0)<=20000,'buffer capped at 20000');
  // expired token rejected
  const ex=conn();await open(ex);await sleep(40);
  const expTok=(()=>{const h=Buffer.from(JSON.stringify({alg:'none'})).toString('base64url');const p=Buffer.from(JSON.stringify({id:'uX',exp:Math.floor(Date.now()/1000)-10})).toString('base64url');return `${h}.${p}.s`;})();
  ex._m=[]; let closed=false; ex.on('close',(c)=>{closed=c;});
  send(ex,{type:'join',token:expTok});await sleep(80);
  check(last(ex,'error')?.code==='auth_failed','expired token -> auth_failed');
  check(closed===4001,'expired token -> close 4001');
  // token with NO exp -> currently ACCEPTED in dev (documenting behavior)
  const ne=conn();await open(ne);await sleep(40);
  const noexp=(()=>{const h=Buffer.from(JSON.stringify({alg:'none'})).toString('base64url');const p=Buffer.from(JSON.stringify({id:'uNoExp'})).toString('base64url');return `${h}.${p}.s`;})();
  ne._m=[]; send(ne,{type:'join',token:noexp});await sleep(80);
  console.log('  [info] token-without-exp join result:', last(ne,'snapshot')?'ACCEPTED':'rejected');
  a.close();ex.close();ne.close();await sleep(100);
  console.log(fail===0?'\nALL PASS':`\n${fail} FAIL`);process.exit(fail?1:0);
}
main();
