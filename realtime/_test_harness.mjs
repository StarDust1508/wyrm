import { WebSocket } from 'ws';

// Make two tokens (dev mode, no PB_URL). exp in future.
function mkToken(id) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = Buffer.from(JSON.stringify({ id, exp })).toString('base64url');
  return `${header}.${payload}.sig`;
}

const PORT = process.env.PORT || 8099;
const ROOM = 'testroom';
function conn(name) {
  const ws = new WebSocket(`ws://localhost:${PORT}/room/${ROOM}`);
  ws._name = name;
  ws._msgs = [];
  ws.on('message', (d) => { const m = JSON.parse(d.toString()); ws._msgs.push(m); });
  return ws;
}
const open = (ws) => new Promise((r) => ws.on('open', r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (ws, o) => ws.send(JSON.stringify(o));
function last(ws, type) { return [...ws._msgs].reverse().find((m) => m.type === type); }

let failures = 0;
function check(cond, label) {
  console.log((cond ? 'PASS ' : 'FAIL ') + label);
  if (!cond) failures++;
}

async function main() {
  const a = conn('A'); const b = conn('B');
  await Promise.all([open(a), open(b)]);
  await sleep(50);

  // join both
  send(a, { type: 'join', token: mkToken('userA') });
  send(b, { type: 'join', token: mkToken('userB') });
  await sleep(100);
  check(!!last(a, 'snapshot'), 'A got snapshot on join');
  check(!!last(b, 'snapshot'), 'B got snapshot on join');

  // A enqueues -> gets pen immediately
  send(a, { type: 'enqueue' });
  await sleep(50);
  check(last(a, 'turn')?.turnHolder === 'userA', 'A becomes turnHolder on enqueue (free pen)');

  // B enqueues -> queued
  send(b, { type: 'enqueue' });
  await sleep(50);
  check(JSON.stringify(last(b, 'queue')?.queue) === JSON.stringify(['userB']), 'B queued behind A');

  // B tries to type -> error
  b._msgs = [];
  send(b, { type: 'type', text: 'hi from B' });
  await sleep(50);
  check(last(b, 'error')?.code === 'not_your_turn', 'B type rejected (not_your_turn)');

  // A types
  send(a, { type: 'type', text: 'dragon stirs' });
  await sleep(50);
  check(last(b, 'buffer')?.text === 'dragon stirs', 'B sees A buffer');

  // A commits -> pen passes to B, buffer cleared
  send(a, { type: 'commit', text: 'dragon stirs.' });
  await sleep(50);
  check(last(b, 'committed')?.text === 'dragon stirs.', 'committed broadcast');
  check(last(b, 'turn')?.turnHolder === 'userB', 'pen passed to B on commit');
  check(last(b, 'buffer')?.text === '', 'buffer cleared after commit');

  // BUG TEST 1: B commits (empties queue) -> turnHolder null
  send(b, { type: 'commit', text: 'B turn.' });
  await sleep(50);
  check(last(b, 'turn')?.turnHolder === null, 'empty queue -> turnHolder null');

  // BUG TEST 2: react aggregation
  a._msgs = [];
  send(a, { type: 'react', kind: 'flame' });
  send(a, { type: 'react', kind: 'star' });
  await sleep(50);
  check(last(a, 'reacts')?.flame === 1 && last(a, 'reacts')?.star === 1, 'reacts aggregate flame+star');

  // BUG TEST 3: addDirection + voteDirection
  a._msgs = [];
  send(a, { type: 'addDirection', text: 'go north' });
  await sleep(50);
  const dir = last(a, 'directions')?.directions?.[0];
  check(!!dir, 'addDirection creates direction');
  send(a, { type: 'voteDirection', dirId: dir.id });
  send(b, { type: 'voteDirection', dirId: dir.id });
  await sleep(50);
  check(last(a, 'directions')?.directions?.[0]?.votes === 2, 'voteDirection aggregates votes=2');

  // BUG TEST 4: malformed JSON -> error, no crash
  a._msgs = [];
  a.send('not json{{{');
  await sleep(50);
  check(last(a, 'error')?.code === 'bad_json', 'malformed JSON -> bad_json error');

  // BUG TEST 5: unknown type -> error
  a._msgs = [];
  send(a, { type: 'frobnicate' });
  await sleep(50);
  check(last(a, 'error')?.code === 'unknown_type', 'unknown type -> error');

  // BUG TEST 6: action before join -> not_joined
  const c = conn('C'); await open(c); await sleep(30);
  c._msgs = [];
  send(c, { type: 'enqueue' });
  await sleep(50);
  check(last(c, 'error')?.code === 'not_joined', 'pre-join action -> not_joined');

  // BUG TEST 7: disconnect mid-turn passes pen / cleans queue
  // A enqueue (gets pen), B enqueue (queued), A disconnects -> B should get pen
  a._msgs = []; b._msgs = [];
  send(a, { type: 'enqueue' }); await sleep(30);
  send(b, { type: 'enqueue' }); await sleep(30);
  check(last(b, 'turn')?.turnHolder === 'userA', 'pre-disconnect A holds pen');
  a.close(); await sleep(100);
  check(last(b, 'turn')?.turnHolder === 'userB', 'A disconnect -> pen passes to B');

  c.close(); b.close();
  await sleep(100);
  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
