# WYRM Realtime — "Комната авторов"

A self-contained WebSocket microservice implementing **TZ Appendix C**: a
collaborative writing relay for WYRM. Multiple authors share one "pen" — one
writer types at a time, others queue, vote on directions, and react. Committed
turns are streamed to everyone and (optionally) persisted to PocketBase.

This service is **isolated** from the main WYRM app. Its only runtime
dependency is [`ws`](https://github.com/websockets/ws). It does **not** touch
the main app's `package.json`.

---

## What it is

- One logical endpoint per room: `wss://host/room/{sessionId}`.
- All state lives in memory (per process). PocketBase is used only for
  **auth verification** and **best-effort persistence** of committed turns.
- Auth uses a PocketBase JWT, passed in the query string (`?token=…`) or in the
  first `join` message.

---

## Run

```bash
cd realtime
npm install            # installs `ws`
PORT=8090 PB_URL=https://pb.example.com node server.js
# or
npm start
```

Health check: `GET http://host:8090/health` → `{ "ok": true, "sessions": N, "uptime": … }`

### Environment

| Var            | Default | Purpose                                                        |
| -------------- | ------- | -------------------------------------------------------------- |
| `PORT`         | `8090`  | Listen port.                                                   |
| `PB_URL`       | _unset_ | PocketBase base URL. Enables JWT verification + persistence.   |
| `TURN_SECONDS` | `90`    | Seconds a writer holds the pen before auto-pass.               |
| `HEARTBEAT_MS` | `30000` | Interval for ws ping / dead-socket reaping.                    |
| `PERSIST_MS`   | `15000` | Interval for flushing committed turns to PocketBase.           |

---

## Auth: JWT verification approach (pluggable)

The token is verified by `verifyToken()`, which picks a strategy based on
whether `PB_URL` is set:

1. **`PB_URL` set → verify mode (recommended for production).**
   The service POSTs the token to
   `${PB_URL}/api/collections/users/auth-refresh`. PocketBase checks the
   **signature, expiry, and user existence** and returns the user record.
   This is authoritative. The cost is one HTTP round-trip per `join`.
   If PocketBase is unreachable, auth **fails closed** (the token is rejected)
   rather than trusting an unverified token.

2. **`PB_URL` unset → decode mode (dev / scaffold only).**
   The JWT payload is base64url-decoded and accepted only if it carries an
   `exp` claim that is in the future. **The signature is not checked** — a
   forged token with a future `exp` would pass. A token **without** an `exp`
   claim is rejected (an unverified, never-expiring token must not be trusted).
   Use only for local development.

> **TODO (prod hardening):** to avoid a network round-trip per connection,
> fetch the PocketBase signing key / JWKS once at boot and verify the signature
> locally. The verification function is intentionally pluggable for this.

A failed `join` replies with `error{code:"auth_failed"}` and closes the socket
with code `4001`.

---

## Persistence: best-effort batch to PocketBase

- Committed turns are appended to in-memory `history` **and** queued in
  `pendingPersist`.
- Every `PERSIST_MS` (and on session reap / shutdown), each queued row is
  POSTed to `${PB_URL}/api/collections/nodes/records`.
- **Best-effort** means: on failure the row is logged and **re-queued** for the
  next flush — the relay never blocks and never drops a turn from in-memory
  history. If `PB_URL` is unset, persistence is a no-op (memory only).
- The POST body maps to a `nodes` record:
  `{ story, author, text, created_ts, session }`. Adapt field names to your
  schema. If your `nodes` collection requires auth to create records, attach a
  service token in `persistRow()` (see the inline NOTE).

---

## Message protocol

All messages are JSON: `{ "type": "...", ... }`.

### Client → server

| type            | payload          | who          | effect                                                            |
| --------------- | ---------------- | ------------ | ----------------------------------------------------------------- |
| `join`          | `{ token }`      | anyone       | Authenticate + bind to room. Replies with `snapshot` (+ `reacts`).|
| `enqueue`       | —                | joined       | Join the writer queue. If pen is free, you get it immediately.    |
| `dequeue`       | —                | joined       | Leave the queue, or pass the pen if you hold it.                  |
| `type`          | `{ text }`       | turn holder  | Stream live (uncommitted) buffer text. Non-holders get `error`.   |
| `commit`        | `{ text? }`      | turn holder  | Commit a turn (uses `text`, else the buffer). Passes the pen.     |
| `voteDirection` | `{ dirId }`      | joined       | Toggle your vote on a proposed direction.                         |
| `addDirection`  | `{ text }`       | joined       | Propose a new story direction (≤280 chars).                       |
| `react`         | `{ kind }`       | joined       | `kind` ∈ `"flame" \| "star"`. Increments the counter.            |
| `ping`          | —                | anyone       | Liveness check. Replies `pong{ts}`. (Separate from ws ping/pong.) |

### Server → client

| type        | payload                            | when                                          |
| ----------- | ---------------------------------- | --------------------------------------------- |
| `hello`     | `{ room, turnSeconds }`            | On connect, before auth.                      |
| `snapshot`  | `{ session }`                      | On successful `join` / reconnect.             |
| `turn`      | `{ turnHolder, turnDeadline }`     | Whenever the pen moves (commit, timeout, etc).|
| `buffer`    | `{ text }`                         | On every `type`, and on turn changes (reset). |
| `committed` | `{ who, text }`                    | When a turn is committed.                     |
| `queue`     | `{ queue }`                        | When the writer queue changes.                |
| `directions`| `{ directions:[{id,text,votes}] }` | When directions are added or voted.           |
| `reacts`    | `{ flame, star }`                  | On `react`, and right after `snapshot`.       |
| `pong`      | `{ ts }`                           | Reply to client `ping`.                       |
| `error`     | `{ code, message }`                | On any rejected action.                       |

**`snapshot.session` shape:**

```json
{
  "id": "room-42",
  "storyId": "story-42",
  "turnHolder": "user_abc",
  "turnDeadline": 1719150000000,
  "queue": ["user_def", "user_ghi"],
  "buffer": "the dragon stirred…",
  "directions": [{ "id": "dir_…", "text": "go north", "votes": 3 }],
  "history": [{ "who": "user_abc", "text": "…", "ts": 1719149900000 }]
}
```

### Rules / timeouts

- The pen passes **on `commit`** OR **when `turnDeadline` elapses** (auto-pass
  to the next writer in the queue).
- Empty queue → `turnHolder = null` (pen idle).
- Only one active `turnHolder`. A `type` from a non-holder → `error{not_your_turn}`.
- Each new turn resets the deadline timer and clears the live buffer.
- A writer who disconnects while holding the pen auto-passes it.
- **Reconnect:** client re-sends `join` → fresh `snapshot`.

### Heartbeat

- WebSocket-level: the server `ping`s every socket each `HEARTBEAT_MS`; sockets
  that didn't `pong` since the last cycle are `terminate()`d (dead-socket
  cleanup).
- Application-level: clients may also send `ping` and get `pong{ts}`.

---

## Deployment notes

### TLS / `wss://` via reverse proxy

Run the Node service on plain HTTP behind a TLS-terminating reverse proxy.
Browsers require `wss://` from an HTTPS page.

**nginx:**

```nginx
location /room/ {
    proxy_pass http://127.0.0.1:8090;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;   # keep long-lived sockets open
}
location = /health {
    proxy_pass http://127.0.0.1:8090;
}
```

**Caddy:**

```
your.host {
    reverse_proxy /room/* 127.0.0.1:8090
    reverse_proxy /health 127.0.0.1:8090
}
```

### systemd

`/etc/systemd/system/wyrm-realtime.service`:

```ini
[Unit]
Description=WYRM realtime relay
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/wyrm/realtime
Environment=PORT=8090
Environment=PB_URL=https://pb.example.com
Environment=TURN_SECONDS=90
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=2
User=wyrm

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wyrm-realtime
journalctl -u wyrm-realtime -f
```

> Single-process, in-memory state: scale by **sharding rooms across instances**
> (route `/room/{id}` by hash at the proxy). A multi-instance shared-room setup
> would need a pub/sub backplane (e.g. Redis) — out of scope for this scaffold.

---

## How the web client connects

```
const sessionId = "room-42";
const token = pb.authStore.token;            // PocketBase JWT
const url = `wss://your.host/room/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`;
const ws = new WebSocket(url);
```

Then send `join{token}` once the socket is open (the token may be sent in the
query, the message, or both — the message wins). See `client-example.md`.
