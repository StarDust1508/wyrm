# WritersRoom — browser client example

Minimal example of how the WYRM web client (the "Комната авторов" / WritersRoom
component) connects to the relay, sends `join` / `type` / `commit`, and reacts
to `snapshot` / `turn` / `buffer` / `committed`.

```js
// --- connect ---------------------------------------------------------------
const sessionId = "room-42";
const token = pb.authStore.token; // PocketBase JWT from your auth store
const myUserId = pb.authStore.model?.id;

const url = `wss://your.host/room/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`;
const ws = new WebSocket(url);

// Local view of room state, rebuilt from snapshot then patched by events.
let state = {
  turnHolder: null,
  turnDeadline: 0,
  queue: [],
  buffer: "",
  history: [],
  directions: [],
  reacts: { flame: 0, star: 0 },
};

const send = (msg) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));

// --- send: join / type / commit -------------------------------------------
ws.onopen = () => {
  // Token also went in the query string; sending it again in join is fine.
  send({ type: "join", token });
};

function requestPen() {
  send({ type: "enqueue" });
}

// Call on every keystroke while you hold the pen (debounce in real UI).
function onType(text) {
  if (state.turnHolder !== myUserId) return; // only the holder may type
  send({ type: "type", text });
}

// Finish your turn.
function commitTurn(text) {
  send({ type: "commit", text }); // omit `text` to commit the live buffer
}

function voteDirection(dirId) {
  send({ type: "voteDirection", dirId });
}

function react(kind /* "flame" | "star" */) {
  send({ type: "react", kind });
}

// --- receive: snapshot / turn / buffer / committed -------------------------
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  switch (msg.type) {
    case "hello":
      // Server accepted the upgrade; { room, turnSeconds }. Auth still pending.
      break;

    case "snapshot": {
      // Full room state — use on first join and every reconnect.
      const s = msg.session;
      state = {
        turnHolder: s.turnHolder,
        turnDeadline: s.turnDeadline,
        queue: s.queue,
        buffer: s.buffer,
        history: s.history,
        directions: s.directions,
        reacts: state.reacts,
      };
      render();
      break;
    }

    case "turn":
      state.turnHolder = msg.turnHolder;
      state.turnDeadline = msg.turnDeadline; // start a countdown to this ts
      render();
      break;

    case "buffer":
      // Live (uncommitted) text from whoever holds the pen.
      state.buffer = msg.text;
      render();
      break;

    case "committed":
      // A turn was finalized — append to the rendered story.
      state.history.push({ who: msg.who, text: msg.text, ts: Date.now() });
      state.buffer = "";
      render();
      break;

    case "queue":
      state.queue = msg.queue;
      render();
      break;

    case "directions":
      state.directions = msg.directions; // [{ id, text, votes }]
      render();
      break;

    case "reacts":
      state.reacts = { flame: msg.flame, star: msg.star };
      render();
      break;

    case "error":
      console.warn("relay error:", msg.code, msg.message);
      if (msg.code === "auth_failed") {
        // token expired/invalid — refresh and reconnect
      }
      break;
  }
};

// --- reconnect -------------------------------------------------------------
ws.onclose = (ev) => {
  // 4001 = auth_failed (don't blindly retry). Otherwise back off and reconnect;
  // on the new socket, send join again to get a fresh snapshot.
  if (ev.code !== 4001) {
    setTimeout(/* reconnect with a fresh WebSocket, then send join */, 1000);
  }
};

function render() {
  // Wire `state` into your React/UI here.
}
```
