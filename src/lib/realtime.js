/* ============================================================
   WYRM — realtime-клиент «Комнаты авторов» (живая эстафета).

   Боевой режим (VITE_RT_URL задан + есть токен): WebSocket к
   микросервису realtime/server.js. Протокол — JSON {type,...}:
     C→S: join{token}, enqueue, dequeue, type{text}, commit{text?},
          voteDirection{dirId}, addDirection{text}, react{kind}, ping
     S→C: hello, snapshot{session}, turn, buffer, committed, queue,
          directions, reacts, pong, error
   Подробности протокола — realtime/README.md.

   Демо-режим (нет VITE_RT_URL или пользователь не залогинен): локальный
   симулятор с ТЕМ ЖЕ интерфейсом, чтобы UI работал без сервера.

   connectRoom(sessionId, { token, me, onState }) → handle:
     { live, enqueue, dequeue, type, commit, vote, addDirection,
       react, close }
   onState(state) — нормализованный снапшот при каждом изменении:
     { live, history:[{who,text}], buffer, turnHolder, turnDeadline,
       queue:[id], directions:[{id,text,votes}], reacts:{flame,star} }
   ============================================================ */

const RT_URL = (import.meta.env ? import.meta.env.VITE_RT_URL : '') || '';
export const rtEnabled = !!RT_URL;

/* ---------- боевой клиент: настоящий WebSocket ---------- */
function realClient(sessionId, { token, onState } = {}) {
  let ws = null, closed = false, backoff = 1000, hbTimer = null;
  const state = {
    live: false, history: [], buffer: '', turnHolder: null, turnDeadline: 0,
    queue: [], directions: [], reacts: { flame: 0, star: 0 },
  };
  const emit = () => onState && onState({ ...state });
  const base = String(RT_URL).replace(/\/$/, '');
  const url = `${base}/room/${encodeURIComponent(sessionId)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  const send = (o) => { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (e) {} };

  function open() {
    try { ws = new WebSocket(url); } catch (e) { scheduleReconnect(1000); return; }
    ws.onopen = () => { backoff = 1000; send({ type: 'join', token }); };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      switch (m.type) {
        case 'hello': break;
        case 'snapshot': {
          const s = m.session || {};
          state.history = (s.history || []).map((h) => ({ who: h.who, text: h.text }));
          state.buffer = s.buffer || '';
          state.turnHolder = s.turnHolder || null;
          state.turnDeadline = s.turnDeadline || 0;
          state.queue = s.queue || [];
          state.directions = s.directions || [];
          state.live = true; emit(); break;
        }
        case 'turn': state.turnHolder = m.turnHolder || null; state.turnDeadline = m.turnDeadline || 0; emit(); break;
        case 'buffer': state.buffer = m.text || ''; emit(); break;
        case 'committed': state.history = [...state.history, { who: m.who, text: m.text }]; state.buffer = ''; emit(); break;
        case 'queue': state.queue = m.queue || []; emit(); break;
        case 'directions': state.directions = m.directions || []; emit(); break;
        case 'reacts': state.reacts = { flame: m.flame || 0, star: m.star || 0 }; emit(); break;
        default: break;
      }
    };
    ws.onclose = (ev) => {
      state.live = false; emit();
      if (closed || (ev && ev.code === 4001)) return;   // auth_failed — без ретраев
      scheduleReconnect(backoff); backoff = Math.min(backoff * 2, 15000);
    };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  }
  function scheduleReconnect(ms) { if (!closed) setTimeout(() => { if (!closed) open(); }, ms); }

  open();
  // прикладной ping раз в 25с (на случай прокси без protocol-level ping)
  hbTimer = setInterval(() => send({ type: 'ping' }), 25000);

  return {
    get live() { return state.live; },
    enqueue: () => send({ type: 'enqueue' }),
    dequeue: () => send({ type: 'dequeue' }),
    type: (text) => send({ type: 'type', text }),
    commit: (text) => send(text !== undefined ? { type: 'commit', text } : { type: 'commit' }),
    vote: (dirId) => send({ type: 'voteDirection', dirId }),
    addDirection: (text) => send({ type: 'addDirection', text }),
    react: (kind) => send({ type: 'react', kind }),
    close: () => { closed = true; if (hbTimer) clearInterval(hbTimer); try { ws && ws.close(1000); } catch (e) {} },
  };
}

/* ---------- демо-симулятор: тот же интерфейс, без сервера ---------- */
const DEMO_HISTORY = [
  { who: 'eira_noct', text: 'Костёр догорал. Кейра не спала третью ночь — пепел снова шёл с севера.' },
  { who: 'mara.q', text: 'Вэйл протянул ей флягу. «Ты не обязана нести это одна», — сказал он, и впервые за годы это не прозвучало упрёком.' },
];
const DEMO_LIVE = 'Она приняла флягу, но не выпила. На горизонте, там, где небо встречалось с мёртвой землёй, что-то огромное расправляло крылья — и Кейра поняла: Вирм проснулся не один.';
const DEMO_PARAS = [
  'Вирм поднял голову, и пепел сложился в очертания второго крыла — там, где крыла быть не должно.',
  'Архонт смотрел с башни и впервые за сорок лет не знал, что прикажет на рассвете.',
  'Вэйл сжал рукоять. «Если это конец — пусть он будет нашим», — но Кейра уже шла к обрыву.',
  'Под Аркадией что-то ответило Вирму: низко, по-древнему, как клятва, которую все забыли.',
];
const DEMO_DIRECTIONS = [
  { id: 'd1', text: 'Второй дракон — союзник. Древний враг Архонта.', votes: 312 },
  { id: 'd2', text: 'Это не дракон. Это то, что люди заперли под Аркадией.', votes: 488 },
  { id: 'd3', text: 'Кейра скрывает увиденное от Вэйла. Пока.', votes: 201 },
];
const DEMO_TURN_MS = 32000;   // длительность хода в демо

function demoClient(sessionId, { me, onState } = {}) {
  const meId = me || 'ты';
  let closed = false, voted = null, paraIdx = 0, first = true;
  let typingTarget = DEMO_LIVE, typingPos = 0;
  let typeTimer = null, tickTimer = null;
  const state = {
    live: false,                                  // демо — не «в эфире»
    history: DEMO_HISTORY.map((h) => ({ ...h })),
    buffer: '',
    turnHolder: 'nyx___',
    turnDeadline: Date.now() + DEMO_TURN_MS,
    queue: ['nyx___', 'grimwarden', 'sol_inkwell', 'ashpoet'],
    directions: DEMO_DIRECTIONS.map((d) => ({ ...d })),
    reacts: { flame: 142, star: 88 },
  };
  const emit = () => { if (!closed) onState && onState({ ...state, history: [...state.history], queue: [...state.queue], directions: state.directions.map((d) => ({ ...d })) }); };

  const beginTurn = (holder) => {
    state.turnHolder = holder;
    state.turnDeadline = Date.now() + DEMO_TURN_MS;
    state.buffer = '';
    typingPos = 0;
    if (holder !== meId) typingTarget = DEMO_PARAS[paraIdx++ % DEMO_PARAS.length];
    else typingTarget = '';                        // пользователь печатает сам
    emit();
  };

  const rotate = () => {
    const holder = state.turnHolder;
    if (state.buffer && state.buffer.trim()) state.history = [...state.history, { who: holder, text: state.buffer.trim() }];
    const q = state.queue.filter((x) => x !== holder);
    q.push(holder);                                // текущий — в хвост
    state.queue = q;
    first = false;
    beginTurn(q[0]);
  };

  // печать «вживую» (для демо-авторов)
  typeTimer = setInterval(() => {
    if (closed || state.turnHolder === meId) return;
    if (typingPos < typingTarget.length) {
      typingPos = Math.min(typingTarget.length, typingPos + 2);
      state.buffer = typingTarget.slice(0, typingPos);
      emit();
    }
  }, 45);
  // смена хода по дедлайну
  tickTimer = setInterval(() => {
    if (closed) return;
    if (Date.now() >= state.turnDeadline) rotate();
  }, 1000);

  // стартовая печать первого хода
  typingTarget = DEMO_LIVE; typingPos = 0;
  Promise.resolve().then(emit);                    // первый снапшот после подписки

  return {
    get live() { return false; },
    enqueue: () => { if (!state.queue.includes(meId)) { state.queue = [...state.queue, meId]; emit(); } },
    dequeue: () => {
      if (state.turnHolder === meId) { rotate(); return; }
      state.queue = state.queue.filter((x) => x !== meId); emit();
    },
    type: (text) => { if (state.turnHolder === meId) { state.buffer = text; emit(); } },
    commit: (text) => {
      if (state.turnHolder !== meId) return;
      const t = (text !== undefined ? text : state.buffer);
      if (t && t.trim()) state.history = [...state.history, { who: meId, text: t.trim() }];
      state.buffer = '';
      const q = state.queue.filter((x) => x !== meId); q.push(meId);
      state.queue = q; beginTurn(q[0]);
    },
    vote: (dirId) => { if (voted) return; voted = dirId; state.directions = state.directions.map((d) => d.id === dirId ? { ...d, votes: d.votes + 1 } : d); emit(); },
    addDirection: (text) => { const t = String(text || '').trim().slice(0, 280); if (!t) return; state.directions = [...state.directions, { id: 'd' + (state.directions.length + 1) + '_' + (paraIdx + 1), text: t, votes: 1 }]; emit(); },
    react: (kind) => { if (kind !== 'flame' && kind !== 'star') return; state.reacts = { ...state.reacts, [kind]: (state.reacts[kind] || 0) + 1 }; emit(); },
    close: () => { closed = true; if (typeTimer) clearInterval(typeTimer); if (tickTimer) clearInterval(tickTimer); },
  };
}

/* фабрика: боевой клиент только если есть сервер И токен, иначе демо */
export function connectRoom(sessionId, opts = {}) {
  return (rtEnabled && opts.token) ? realClient(sessionId, opts) : demoClient(sessionId, opts);
}
