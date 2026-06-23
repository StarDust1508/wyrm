/**
 * WYRM realtime relay — "Комната авторов" (collaborative writing room).
 * TZ Appendix C. Standalone microservice: Node.js + `ws` only.
 *
 * One logical endpoint per room:  wss://host/room/{sessionId}
 * Auth: PocketBase JWT, passed either in the query string (?token=...) or in
 *       the first `join` message. See verifyToken() for the pluggable strategy.
 *
 * All wire messages are JSON objects of the shape { type, ...payload }.
 *
 * Env config:
 *   PORT          listen port                       (default 8090)
 *   PB_URL        PocketBase base URL               (no default; enables
 *                 full token verification + persistence when set)
 *   TURN_SECONDS  seconds a writer holds the pen     (default 90)
 *   HEARTBEAT_MS  ws ping interval in ms             (default 30000)
 *   PERSIST_MS    flush interval for committed turns  (default 15000)
 *   PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD   service (admin) creds used to
 *                 authenticate node writes; persistence is DISABLED unless
 *                 these (or PB_SERVICE_TOKEN) are set — nodes.createRule
 *                 requires auth, so anonymous writes would 403.
 *   PB_SERVICE_TOKEN  alternative: a pre-issued PB auth token (skips login).
 *                 MUST belong to a PocketBase SUPERUSER. A regular-user token
 *                 still passes nodes.createRule but is NOT admin, so the hook
 *                 would rewrite the turn's author and mis-attribute it.
 *
 * Run:  PORT=8090 PB_URL=https://pb.example.com \
 *       PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=secret node server.js
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { URL } from 'node:url';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT || 8090);
const PB_URL = (process.env.PB_URL || '').replace(/\/+$/, ''); // strip trailing /
const TURN_SECONDS = Number(process.env.TURN_SECONDS || 90);
const TURN_MS = TURN_SECONDS * 1000;
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS || 30000);
const PERSIST_MS = Number(process.env.PERSIST_MS || 15000);
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || '';
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || '';
const PB_SERVICE_TOKEN = process.env.PB_SERVICE_TOKEN || '';
const MAX_PERSIST_ATTEMPTS = 5; // drop a row after this many failed flushes
let pbToken = PB_SERVICE_TOKEN; // current service auth token (refreshed on 401)
const persistEnabled = () =>
  !!PB_URL && (!!PB_SERVICE_TOKEN || (!!PB_ADMIN_EMAIL && !!PB_ADMIN_PASSWORD));

// Limits — keep memory bounded and reject abusive payloads.
const MAX_BUFFER_CHARS = 20000; // live buffer cap per turn
const MAX_COMMIT_CHARS = 20000; // single committed turn cap
const MAX_HISTORY = 500;        // in-memory history rows kept per session
const MAX_DIRECTIONS = 100;     // proposed directions per session

// ---------------------------------------------------------------------------
// Small logging helper
// ---------------------------------------------------------------------------

const log = (...args) => console.log(new Date().toISOString(), '[wyrm-rt]', ...args);
const warn = (...args) => console.warn(new Date().toISOString(), '[wyrm-rt]', ...args);

// ---------------------------------------------------------------------------
// JWT auth (pluggable)
// ---------------------------------------------------------------------------
//
// Two strategies, selected automatically:
//
//   1. PB_URL set  -> "verify" mode. We call PocketBase
//      /api/collections/users/auth-refresh with the token. PocketBase checks
//      the signature, expiry and that the user still exists, and echoes the
//      record back. This is the authoritative check (recommended for prod).
//
//   2. PB_URL unset -> "decode" mode. We base64url-decode the JWT payload and
//      accept it if `exp` is in the future. This does NOT verify the signature
//      — a forged token with a future exp would pass. Acceptable only for local
//      dev / scaffolding. Documented tradeoff in README.
//
// TODO(prod): for the strongest guarantee without a network round-trip per
// connection, fetch the PocketBase signing key / well-known JWKS once at boot
// and verify the HMAC/RS signature locally. Left pluggable on purpose.

/** Decode a JWT payload without verifying the signature. */
function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Resolve a token to a user identity.
 * @returns {Promise<{ userId: string, record?: object } | null>} null = reject.
 */
async function verifyToken(token) {
  if (!token) return null;

  // Strategy 2 components are always available as a fast pre-check.
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp <= now) {
    return null; // expired
  }

  // Strategy 1: authoritative verification via PocketBase.
  if (PB_URL) {
    try {
      const res = await fetch(`${PB_URL}/api/collections/users/auth-refresh`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const userId = data?.record?.id || payload.id || payload.sub;
      if (!userId) return null;
      return { userId, record: data.record };
    } catch (err) {
      // Network failure talking to PB. Fail closed: do not trust an unverified
      // token just because PB is unreachable.
      warn('auth-refresh failed:', err?.message || err);
      return null;
    }
  }

  // Strategy 2: decode-only (dev). Accept on non-expired payload.
  // Require an `exp` claim: a token with no expiry is effectively immortal, and
  // since this path does NOT verify the signature, accepting it would mean a
  // forged, never-expiring token is trusted indefinitely. Fail closed instead.
  if (typeof payload.exp !== 'number') return null;
  const userId = payload.id || payload.sub;
  if (!userId) return null;
  return { userId, record: { id: userId } };
}

// ---------------------------------------------------------------------------
// Session model
// ---------------------------------------------------------------------------
//
// A Session is the in-memory state of one writing room. It owns:
//   - the turn holder + deadline (and the timer that auto-passes the pen)
//   - the writer queue
//   - the live buffer (current, uncommitted text)
//   - proposed directions + their votes
//   - committed history (bounded; flushed to PB best-effort)
//   - the set of connected sockets for broadcasting
//
// State shape sent to clients via snapshot:
//   { id, storyId, turnHolder, turnDeadline, queue, buffer, directions, history }

let idCounter = 0;
const nextId = (prefix) => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

class Session {
  constructor(id) {
    this.id = id;
    this.storyId = id; // room id doubles as story id unless overridden by token/meta
    this.turnHolder = null;
    this.turnDeadline = 0;
    this.queue = []; // userId[]
    this.buffer = '';
    this.directions = []; // [{ id, text, votes:Set<userId> }] — votes serialized as count
    this.history = []; // [{ who, text, ts }]
    this.reacts = { flame: 0, star: 0 };

    this.sockets = new Set();   // ws connections in this room
    this.turnTimer = null;      // setTimeout handle for the active turn
    this.pendingPersist = [];   // committed rows not yet flushed to PB
  }

  // ----- serialization ------------------------------------------------------

  /** Public snapshot of the whole session (sent on join / reconnect). */
  toSnapshot() {
    return {
      id: this.id,
      storyId: this.storyId,
      turnHolder: this.turnHolder,
      turnDeadline: this.turnDeadline,
      queue: [...this.queue],
      buffer: this.buffer,
      directions: this.directions.map((d) => ({ id: d.id, text: d.text, votes: d.votes.size })),
      history: this.history.slice(-50), // keep snapshot light
    };
  }

  // ----- broadcast ----------------------------------------------------------

  /** Send a message to every live socket in the room. */
  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const ws of this.sockets) {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(data);
        } catch (err) {
          warn('send failed:', err?.message || err);
        }
      }
    }
  }

  broadcastTurn() {
    this.broadcast({ type: 'turn', turnHolder: this.turnHolder, turnDeadline: this.turnDeadline });
  }

  broadcastQueue() {
    this.broadcast({ type: 'queue', queue: [...this.queue] });
  }

  broadcastDirections() {
    this.broadcast({
      type: 'directions',
      directions: this.directions.map((d) => ({ id: d.id, text: d.text, votes: d.votes.size })),
    });
  }

  // ----- turn management ----------------------------------------------------

  clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  /**
   * Begin a turn for the next writer in the queue (FIFO). If the queue is
   * empty, the pen goes idle (turnHolder = null). Always resets the timer and
   * clears the live buffer so each turn starts fresh.
   */
  advanceTurn() {
    this.clearTurnTimer();
    this.buffer = '';

    const next = this.queue.shift() || null;
    this.turnHolder = next;

    if (next) {
      this.turnDeadline = Date.now() + TURN_MS;
      // Auto-pass when the deadline elapses.
      this.turnTimer = setTimeout(() => {
        log(`session ${this.id}: turn timeout, auto-pass from ${this.turnHolder}`);
        // A timed-out turn keeps whatever was committed already; the live
        // buffer is dropped. Move on to the next writer.
        this.advanceTurn();
        this.broadcastTurn();
        this.broadcast({ type: 'buffer', text: this.buffer });
        this.broadcastQueue();
      }, TURN_MS);
    } else {
      this.turnDeadline = 0;
    }
  }

  /**
   * Add a user to the writer queue. If nobody holds the pen, they get it
   * immediately. Idempotent: a user already holding or queued is a no-op.
   */
  enqueue(userId) {
    if (this.turnHolder === userId) return false;
    if (this.queue.includes(userId)) return false;

    if (this.turnHolder === null) {
      // Pen is free — grant it directly.
      this.queue.unshift(userId);
      this.advanceTurn();
      return true;
    }
    this.queue.push(userId);
    return true;
  }

  /** Remove a user from the queue (or pass the pen if they hold it). */
  dequeue(userId) {
    if (this.turnHolder === userId) {
      this.advanceTurn();
      return true;
    }
    const idx = this.queue.indexOf(userId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Commit the current turn's text into history and pass the pen onward.
   * Only the turn holder may commit (enforced by the router).
   */
  commit(userId, text) {
    const clean = String(text || '').slice(0, MAX_COMMIT_CHARS);
    const row = { who: userId, text: clean, ts: Date.now() };

    this.history.push(row);
    if (this.history.length > MAX_HISTORY) this.history.shift();
    this.pendingPersist.push(row);

    // Pen passes on commit.
    this.advanceTurn();
    return row;
  }

  // ----- directions & reactions ---------------------------------------------

  voteDirection(userId, dirId) {
    const dir = this.directions.find((d) => d.id === dirId);
    if (!dir) return false;
    // Toggle vote so a user can change their mind.
    if (dir.votes.has(userId)) dir.votes.delete(userId);
    else dir.votes.add(userId);
    return true;
  }

  addDirection(userId, text) {
    if (this.directions.length >= MAX_DIRECTIONS) return null;
    const clean = String(text || '').trim().slice(0, 280);
    if (!clean) return null;
    const dir = { id: nextId('dir'), text: clean, votes: new Set() };
    this.directions.push(dir);
    return dir;
  }

  react(kind) {
    if (kind === 'flame') this.reacts.flame += 1;
    else if (kind === 'star') this.reacts.star += 1;
    else return false;
    return true;
  }

  // ----- lifecycle ----------------------------------------------------------

  isEmpty() {
    return this.sockets.size === 0;
  }

  destroy() {
    this.clearTurnTimer();
    this.sockets.clear();
  }
}

// ---------------------------------------------------------------------------
// Session registry
// ---------------------------------------------------------------------------

/** @type {Map<string, Session>} */
const sessions = new Map();

function getOrCreateSession(id) {
  let s = sessions.get(id);
  if (!s) {
    s = new Session(id);
    sessions.set(id, s);
    log(`session created: ${id}`);
  }
  return s;
}

/** Does any remaining live socket in the session belong to this user? */
function userHasLiveSocket(session, userId) {
  for (const sock of session.sockets) {
    if (sock.userId === userId) return true;
  }
  return false;
}

function removeSocketFromSession(session, ws) {
  if (!session) return;
  session.sockets.delete(ws);

  // If the leaving user held the pen or sat in the queue, clean up — but ONLY
  // if this was their last live socket in the room. A user may have several
  // sockets (multiple tabs, or a reconnect whose old socket has not yet fired
  // its `close`). Yanking the pen / queue slot while another of their sockets
  // is still present would be a bug (closing a duplicate tab must not drop you
  // from your own turn).
  const userId = ws.userId;
  if (userId && !userHasLiveSocket(session, userId)) {
    if (session.turnHolder === userId) {
      session.advanceTurn();
      session.broadcastTurn();
      session.broadcast({ type: 'buffer', text: session.buffer });
      session.broadcastQueue();
    } else {
      const idx = session.queue.indexOf(userId);
      if (idx !== -1) {
        session.queue.splice(idx, 1);
        session.broadcastQueue();
      }
    }
  }

  // Reap empty sessions (after persisting anything outstanding).
  if (session.isEmpty()) {
    flushSession(session).finally(() => {
      // Re-check: a new socket may have joined during the async flush.
      if (session.isEmpty()) {
        session.destroy();
        sessions.delete(session.id);
        log(`session reaped: ${session.id}`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Persistence — best-effort batch to PocketBase
// ---------------------------------------------------------------------------
//
// Committed turns accumulate in session.pendingPersist and are flushed on an
// interval (and on session reap). Guarded by PB_URL — if it is unset, persist
// is a no-op and history lives only in memory.
//
// POSTs each row to ${PB_URL}/api/collections/nodes/records. "Best-effort"
// means: on failure we log and re-queue the row for the next flush, but never
// block the relay or drop a turn from in-memory history.

// Authenticate the persistence service against PocketBase. Tries the v0.22
// admins endpoint first, then the v0.23 _superusers collection. Returns a token
// ('' if it could not authenticate). A pre-issued PB_SERVICE_TOKEN short-circuits.
async function pbAuth() {
  if (PB_SERVICE_TOKEN) { pbToken = PB_SERVICE_TOKEN; return pbToken; }
  if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) return '';
  const paths = ['/api/admins/auth-with-password', '/api/collections/_superusers/auth-with-password'];
  for (const path of paths) {
    try {
      const res = await fetch(`${PB_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: PB_ADMIN_EMAIL, password: PB_ADMIN_PASSWORD }),
      });
      if (res.ok) {
        const j = await res.json().catch(() => null);
        if (j && j.token) { pbToken = j.token; return pbToken; }
      }
    } catch (_) { /* try next */ }
  }
  return '';
}

const escapeHtml = (s) =>
  String(s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

function pbCreateNode(body) {
  return fetch(`${PB_URL}/api/collections/nodes/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(pbToken ? { Authorization: pbToken } : {}) },
    body: JSON.stringify(body),
  });
}

async function pbGetJson(path) {
  const headers = pbToken ? { Authorization: pbToken } : {};
  let res = await fetch(`${PB_URL}${path}`, { headers });
  if (res.status === 401) { await pbAuth(); res = await fetch(`${PB_URL}${path}`, { headers: pbToken ? { Authorization: pbToken } : {} }); }
  if (!res.ok) throw new Error(`PB ${res.status}`);
  return res.json();
}

// Resolve the room's story (slug -> stories record id) and pick an initial
// parent = the story's canon tip, so persisted turns are NON-canon children of
// the real story, never a stray canon root. If the slug doesn't resolve to a
// real story, disable persistence for the session (no 400-loop). Memoized.
async function resolveStoryContext(session) {
  if (session.storyResolved) return;                        // already resolved (ok or confirmed-missing)
  if (session.storyResolving) { await session.storyResolving; return; } // share in-flight (no re-entrancy drop)
  session.storyResolving = (async () => {
    const slug = String(session.storyId || '').replace(/['"\\]/g, ''); // filter-safe (denylist; PB has no quote-escape)
    if (!slug) { session.persistDisabled = true; session.storyResolved = true; return; }
    // NOTE: a thrown pbGetJson here is a TRANSIENT failure — we do NOT set
    // persistDisabled and do NOT mark resolved, so the next flush retries and
    // the queue is preserved. Only a confirmed-missing story disables persist.
    const sres = await pbGetJson(`/api/collections/stories/records?perPage=1&filter=${encodeURIComponent(`slug='${slug}'`)}`);
    const story = sres && sres.items && sres.items[0];
    if (!story) {
      session.persistDisabled = true; session.storyResolved = true;
      warn(`persist disabled for session ${session.id}: no story with slug "${slug}"`);
      return;
    }
    session.storyRecordId = story.id;
    // parent = canon tip, else the latest node — NEVER '' (an empty parent would
    // be force-canoned into a stray canon root). Empty story → can't attach.
    let tip = null;
    const cres = await pbGetJson(`/api/collections/nodes/records?perPage=1&sort=-created&filter=${encodeURIComponent(`story='${story.id}' && canon=true`)}`);
    tip = cres && cres.items && cres.items[0];
    if (!tip) {
      const ares = await pbGetJson(`/api/collections/nodes/records?perPage=1&sort=-created&filter=${encodeURIComponent(`story='${story.id}'`)}`);
      tip = ares && ares.items && ares.items[0];
    }
    if (tip) { if (!session.lastPersistedNodeId) session.lastPersistedNodeId = tip.id; }
    else { session.persistDisabled = true; warn(`persist disabled for session ${session.id}: story "${slug}" has no nodes to attach turns to`); }
    session.storyResolved = true;
  })();
  try { await session.storyResolving; }
  finally { session.storyResolving = null; }
}

const handleCache = {};
async function resolveHandle(userId) {
  if (!userId) return '';
  if (handleCache[userId] !== undefined) return handleCache[userId];
  try {
    const u = await pbGetJson(`/api/collections/users/records/${encodeURIComponent(userId)}`);
    handleCache[userId] = (u && (u.handle || u.name)) || '';
  } catch (_) { handleCache[userId] = ''; }
  return handleCache[userId];
}

// Persist one committed turn as a real `nodes` record, using ONLY fields that
// exist in the schema (story, parent, title, author, author_handle, canon,
// html). Turns are chained (parent = previous turn) and never canon. On 401 we
// re-authenticate once and retry.
async function persistRow(row, session) {
  const handle = await resolveHandle(row.who);
  const body = {
    story: session.storyRecordId,                 // real stories id (resolved in flush)
    parent: session.lastPersistedNodeId || '',     // canon tip, then chained
    title: 'Эстафета · ход',
    author: row.who,                               // PB user id of the writer
    author_handle: handle || row.who,              // real handle, id fallback
    canon: false,                                  // room turns never auto-enter canon
    html: `<p>${escapeHtml(row.text)}</p>`,
  };
  let res = await pbCreateNode(body);
  if (res.status === 401) { await pbAuth(); res = await pbCreateNode(body); }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`PB ${res.status}: ${detail.slice(0, 200)}`);
  }
  const created = await res.json().catch(() => null);
  if (created && created.id) session.lastPersistedNodeId = created.id;
}

async function flushSession(session) {
  if (!persistEnabled()) return; // persistence disabled (no PB_URL / no creds)
  if (session.pendingPersist.length === 0) return;

  // Resolve the story once. A TRANSIENT failure throws → keep the queue and
  // retry next interval (no data loss). Only a CONFIRMED-unpersistable session
  // (missing story / empty story) drops the queue, and it was logged at resolve.
  try { await resolveStoryContext(session); }
  catch (e) { warn(`persist resolve failed for session ${session.id} (will retry):`, e?.message || e); return; }
  if (session.persistDisabled || !session.storyRecordId) { session.pendingPersist.length = 0; return; }

  // Take the current batch; re-queue transient failures, DROP rows that have
  // exhausted their attempts so a permanent error can't requeue forever.
  const batch = session.pendingPersist.splice(0, session.pendingPersist.length);
  const failed = [];
  for (const row of batch) {
    try {
      await persistRow(row, session);
    } catch (err) {
      row._attempts = (row._attempts || 0) + 1;
      if (row._attempts >= MAX_PERSIST_ATTEMPTS) {
        warn(`dropping turn after ${row._attempts} attempts (session ${session.id}): ${err?.message || err}`);
      } else {
        warn(`persist failed (session ${session.id}, attempt ${row._attempts}):`, err?.message || err);
        failed.push(row);
      }
    }
  }
  if (failed.length) {
    // Put failures back at the front for the next interval.
    session.pendingPersist.unshift(...failed);
  } else if (batch.length) {
    log(`persisted ${batch.length} row(s) for session ${session.id}`);
  }
}

let persistTimer = null;
function startPersistLoop() {
  if (!persistEnabled()) {
    log(PB_URL
      ? 'PB_URL set but no service creds (PB_ADMIN_EMAIL/PASSWORD or PB_SERVICE_TOKEN) — persistence disabled.'
      : 'PB_URL not set — persistence disabled (in-memory history only).');
    return;
  }
  pbAuth().then((t) =>
    log(t ? 'persist: service authenticated.' : 'persist: WARNING could not authenticate yet; will retry on flush.')
  );
  persistTimer = setInterval(() => {
    for (const session of sessions.values()) {
      flushSession(session).catch((err) => warn('flush loop error:', err?.message || err));
    }
  }, PERSIST_MS);
  persistTimer.unref?.();
}

// ---------------------------------------------------------------------------
// Wire helpers
// ---------------------------------------------------------------------------

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) {
    try {
      ws.send(JSON.stringify(msg));
    } catch (err) {
      warn('send failed:', err?.message || err);
    }
  }
}

function sendError(ws, code, message) {
  send(ws, { type: 'error', code, message });
}

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------
//
// Client -> server message types:
//   join{token}, enqueue, dequeue, type{text}, commit{text},
//   voteDirection{dirId}, addDirection{text}, react{kind}, ping
//
// Every handler other than `join`/`ping` requires an authenticated socket
// (ws.userId set) and a bound session (ws.session set).

async function handleMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return sendError(ws, 'bad_json', 'Message was not valid JSON.');
  }
  if (!msg || typeof msg.type !== 'string') {
    return sendError(ws, 'bad_message', 'Missing message type.');
  }

  // `ping` and `join` are allowed pre-auth.
  if (msg.type === 'ping') {
    return send(ws, { type: 'pong', ts: Date.now() });
  }

  if (msg.type === 'join') {
    return handleJoin(ws, msg);
  }

  // Everything below requires an authenticated, joined socket.
  if (!ws.userId || !ws.session) {
    return sendError(ws, 'not_joined', 'Send a join{token} message first.');
  }
  const session = ws.session;
  const userId = ws.userId;

  switch (msg.type) {
    case 'enqueue': {
      if (session.enqueue(userId)) {
        session.broadcastTurn();
        session.broadcastQueue();
        session.broadcast({ type: 'buffer', text: session.buffer });
      }
      break;
    }

    case 'dequeue': {
      if (session.dequeue(userId)) {
        session.broadcastTurn();
        session.broadcastQueue();
        session.broadcast({ type: 'buffer', text: session.buffer });
      }
      break;
    }

    case 'type': {
      // Only the active turn holder may stream text into the buffer.
      if (session.turnHolder !== userId) {
        return sendError(ws, 'not_your_turn', 'You do not hold the pen.');
      }
      const text = String(msg.text ?? '').slice(0, MAX_BUFFER_CHARS);
      session.buffer = text;
      // Echo to everyone (incl. sender) so all viewers see live typing.
      session.broadcast({ type: 'buffer', text: session.buffer });
      break;
    }

    case 'commit': {
      if (session.turnHolder !== userId) {
        return sendError(ws, 'not_your_turn', 'You do not hold the pen.');
      }
      // Use explicit commit text if provided, else the accumulated buffer.
      const text = msg.text !== undefined ? msg.text : session.buffer;
      const row = session.commit(userId, text);
      session.broadcast({ type: 'committed', who: row.who, text: row.text });
      // commit() advanced the turn — announce the new state.
      session.broadcastTurn();
      session.broadcast({ type: 'buffer', text: session.buffer });
      session.broadcastQueue();
      break;
    }

    case 'voteDirection': {
      if (session.voteDirection(userId, msg.dirId)) {
        session.broadcastDirections();
      } else {
        return sendError(ws, 'no_direction', 'Unknown direction id.');
      }
      break;
    }

    case 'addDirection': {
      const dir = session.addDirection(userId, msg.text);
      if (dir) session.broadcastDirections();
      else return sendError(ws, 'bad_direction', 'Empty or too many directions.');
      break;
    }

    case 'react': {
      if (session.react(msg.kind)) {
        session.broadcast({ type: 'reacts', flame: session.reacts.flame, star: session.reacts.star });
      } else {
        return sendError(ws, 'bad_react', 'kind must be "flame" or "star".');
      }
      break;
    }

    default:
      return sendError(ws, 'unknown_type', `Unknown message type: ${msg.type}`);
  }
}

/**
 * join{token}: authenticate, bind the socket to its session, and reply with a
 * full snapshot. Reconnecting clients simply re-send join to resync.
 */
async function handleJoin(ws, msg) {
  // Token may come from the query string (captured at connect) or this message.
  const token = msg.token || ws.queryToken;
  const identity = await verifyToken(token);
  if (!identity) {
    sendError(ws, 'auth_failed', 'Invalid or expired token.');
    // Close with a policy-violation code so clients know not to retry blindly.
    try { ws.close(4001, 'auth_failed'); } catch {}
    return;
  }

  const session = getOrCreateSession(ws.roomId);

  // Re-join on the SAME socket with a different identity (e.g. token swap):
  // tear down the previous identity's pen/queue state before rebinding, so the
  // old userId is not left orphaned as turnHolder or stuck in the queue. We
  // detach the socket first so userHasLiveSocket() does not count it.
  if (ws.userId && ws.userId !== identity.userId && ws.session) {
    const prevSession = ws.session;
    prevSession.sockets.delete(ws);
    const prevUser = ws.userId;
    ws.userId = undefined;
    if (!userHasLiveSocket(prevSession, prevUser)) {
      if (prevSession.turnHolder === prevUser) {
        prevSession.advanceTurn();
        prevSession.broadcastTurn();
        prevSession.broadcast({ type: 'buffer', text: prevSession.buffer });
        prevSession.broadcastQueue();
      } else {
        const idx = prevSession.queue.indexOf(prevUser);
        if (idx !== -1) {
          prevSession.queue.splice(idx, 1);
          prevSession.broadcastQueue();
        }
      }
    }
  }

  ws.userId = identity.userId;

  // If a story id rode along on the token, prefer it for persistence linkage.
  const payload = decodeJwtPayload(token);
  if (payload?.storyId) session.storyId = payload.storyId;

  // Bind socket <-> session and register for broadcasts.
  ws.session = session;
  session.sockets.add(ws);

  log(`join: user=${ws.userId} room=${session.id} (sockets=${session.sockets.size})`);

  // Fresh snapshot for the (re)joining client.
  send(ws, { type: 'snapshot', session: session.toSnapshot() });
  // Also surface current reactions which aren't in the snapshot shape.
  send(ws, { type: 'reacts', flame: session.reacts.flame, star: session.reacts.star });
}

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------
//
// We attach `ws` to a bare HTTP server so we can parse the /room/{sessionId}
// path and the ?token= query during the upgrade. Anything that isn't a valid
// room upgrade is rejected.

const httpServer = createServer((req, res) => {
  // Lightweight health endpoint for load balancers / systemd checks.
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, sessions: sessions.size, uptime: process.uptime() }));
    return;
  }
  res.writeHead(426, { 'Content-Type': 'text/plain' });
  res.end('Upgrade Required: connect via WebSocket to /room/{sessionId}');
});

const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  let parsed;
  try {
    parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    socket.destroy();
    return;
  }

  // Expect /room/{sessionId}
  const match = parsed.pathname.match(/^\/room\/([^/]+)\/?$/);
  if (!match) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  const roomId = decodeURIComponent(match[1]);
  const queryToken = parsed.searchParams.get('token') || '';

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.roomId = roomId;
    ws.queryToken = queryToken;
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    // ws gives us a Buffer/ArrayBuffer; normalize to string.
    handleMessage(ws, data.toString()).catch((err) => {
      warn('handler error:', err?.message || err);
      sendError(ws, 'server_error', 'Internal error handling message.');
    });
  });

  ws.on('close', () => {
    removeSocketFromSession(ws.session, ws);
  });

  ws.on('error', (err) => {
    warn('socket error:', err?.message || err);
  });

  // Greet the socket so the client knows the room accepted the upgrade and can
  // proceed to send join{token}. (Auth still required before any room action.)
  send(ws, { type: 'hello', room: ws.roomId, turnSeconds: TURN_SECONDS });
});

// ---------------------------------------------------------------------------
// Heartbeat — ping all sockets, terminate the ones that didn't pong.
// ---------------------------------------------------------------------------

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      warn('terminating dead socket', ws.userId || '(anon)');
      try { ws.terminate(); } catch {}
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, HEARTBEAT_MS);
heartbeat.unref?.();

// ---------------------------------------------------------------------------
// Boot + graceful shutdown
// ---------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  log(`listening on :${PORT}  (TURN_SECONDS=${TURN_SECONDS}, PB_URL=${PB_URL || 'unset'})`);
  startPersistLoop();
});

async function shutdown(signal) {
  log(`${signal} received — shutting down...`);
  clearInterval(heartbeat);
  if (persistTimer) clearInterval(persistTimer);

  // Final flush of any pending committed turns.
  try {
    await Promise.all([...sessions.values()].map((s) => flushSession(s)));
  } catch (err) {
    warn('shutdown flush error:', err?.message || err);
  }

  for (const ws of wss.clients) {
    try { ws.close(1001, 'server_shutdown'); } catch {}
  }
  wss.close(() => {
    httpServer.close(() => {
      log('closed. bye.');
      process.exit(0);
    });
  });

  // Hard exit if something hangs.
  setTimeout(() => process.exit(0), 5000).unref?.();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
