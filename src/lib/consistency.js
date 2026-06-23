/* ============================================================
   WYRM — движок согласованности «Кодекс мира».
   Чистый модуль без зависимостей на window/localStorage: принимает
   nodes (из store.listNodes / window.WYRM.nodesFor) и overlay
   (из store.voteOverlay) и ищет противоречия в судьбах персонажей
   вдоль КАНОН-цепочки (store.canonPath, root→верхушка).

   Логика: у каждой главы есть chars = { charId: статус }. Статусы
   делятся на «ушёл» (не действует) и «активен». Если персонаж был
   «ушёл» в ранней канон-главе и снова «активен» в поздней — это
   воскрешение/возвращение, т.е. неувязка.
   ============================================================ */

import { canonPath } from './store.js';

// семантика статусов (CHAR_STATUS: alive | dead | missing | changed)
export const GONE = new Set(['dead', 'missing']);     // не действует в кадре
export const ACTIVE = new Set(['alive', 'changed']);  // действует (changed = жив, но изменён)

const STATUS_LABEL = { alive: 'Жив', dead: 'Мёртв', missing: 'Пропал', changed: 'Изменён' };
const label = (s) => STATUS_LABEL[s] || s || '—';
const nameOf = (names, cid) => (names && names[cid] && (names[cid].name || cid)) || cid;
const titleOf = (byId, id) => (byId[id] && byId[id].title) || id;

/* findContradictions(nodes, overlay, names)
   names — необязательная карта charId → { name } (CHARACTERS).
   Возвращает массив issue:
   { id, charId, charName, sev, kind, text,
     fromIdx, fromId, fromStatus, toIdx, toId, toStatus } */
export function findContradictions(nodes, overlay = {}, names = {}) {
  if (!Array.isArray(nodes) || !nodes.length) return [];
  const order = canonPath(nodes, overlay);                 // id'шники root→верхушка
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const last = {};                                          // charId → { status, idx, id }
  const issues = [];

  order.forEach((nid, idx) => {
    const node = byId[nid];
    if (!node) return;
    const chars = node.chars || {};
    Object.keys(chars).forEach((cid) => {
      const cur = chars[cid];
      if (!cur) return;                                     // нет данных — пропуск
      const prev = last[cid];
      const nm = nameOf(names, cid);
      if (prev && GONE.has(prev.status) && ACTIVE.has(cur)) {
        // воскрешение / возвращение «с того света»
        const hard = prev.status === 'dead';
        issues.push({
          id: `${cid}|${prev.id}|${nid}`,
          charId: cid, charName: nm,
          sev: hard ? 'high' : 'mid', kind: 'revival',
          fromIdx: prev.idx, fromId: prev.id, fromStatus: prev.status,
          toIdx: idx, toId: nid, toStatus: cur,
          text: `${nm}: «${label(prev.status)}» в гл. ${prev.idx + 1} «${titleOf(byId, prev.id)}», но снова «${label(cur)}» в гл. ${idx + 1} «${node.title || nid}». ${hard ? 'Мёртвый не возвращается без причины.' : 'Пропавший вновь в кадре — объясни возвращение.'}`,
        });
      } else if (prev && prev.status === 'dead' && cur === 'missing') {
        // мягкая неувязка: мёртвого позже помечают «пропал»
        issues.push({
          id: `${cid}|${prev.id}|${nid}`,
          charId: cid, charName: nm,
          sev: 'low', kind: 'soft',
          fromIdx: prev.idx, fromId: prev.id, fromStatus: prev.status,
          toIdx: idx, toId: nid, toStatus: cur,
          text: `${nm}: помечен «Мёртв» (гл. ${prev.idx + 1}), затем «Пропал» (гл. ${idx + 1}) — уточни судьбу.`,
        });
      }
      last[cid] = { status: cur, idx, id: nid };
    });
  });
  return issues;
}

/* appearancesOf(charId, nodes, overlay)
   Все появления персонажа по ВСЕМУ дереву (не только канон):
   [{ id, title, status, canon }] — canon помечает главы из канон-цепочки. */
export function appearancesOf(charId, nodes, overlay = {}) {
  const canon = new Set(canonPath(nodes, overlay));
  return (nodes || [])
    .filter((n) => n.chars && n.chars[charId])
    .map((n) => ({ id: n.id, title: n.title, status: n.chars[charId], canon: canon.has(n.id) }));
}

/* charactersIn(nodes) — все персонажи, встречающиеся в дереве (union по chars). */
export function charactersIn(nodes) {
  const set = new Set();
  (nodes || []).forEach((n) => Object.keys(n.chars || {}).forEach((c) => set.add(c)));
  return [...set];
}

/* latestStatuses(nodes, overlay) — статус каждого персонажа на верхушке канона
   (последнее канон-упоминание). charId → статус. */
export function latestStatuses(nodes, overlay = {}) {
  const order = canonPath(nodes, overlay);
  const byId = Object.fromEntries((nodes || []).map((n) => [n.id, n]));
  const out = {};
  order.forEach((id) => {
    const chars = (byId[id] || {}).chars || {};
    Object.keys(chars).forEach((c) => { if (chars[c]) out[c] = chars[c]; });
  });
  return out;
}

/* coAppearEdges(nodes) — рёбра графа: пары персонажей, встречающиеся в одной
   главе. [{ a, b, n }] где n — число общих глав. */
export function coAppearEdges(nodes) {
  const pair = {};
  (nodes || []).forEach((n) => {
    const cs = Object.keys(n.chars || {});
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++) {
        const k = [cs[i], cs[j]].sort().join('|');
        pair[k] = (pair[k] || 0) + 1;
      }
  });
  return Object.keys(pair).map((k) => { const [a, b] = k.split('|'); return { a, b, n: pair[k] }; });
}
