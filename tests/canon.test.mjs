import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonPath, markCanon } from '../src/lib/store.js';

// «лидер среди сиблингов»: путь от корня вниз по наибольшему числу голосов.
const tree = () => ([
  { id: 'root', parent: null, votes: 100, score: 1 },
  { id: 'A', parent: 'root', votes: 40, score: 0.9 },
  { id: 'B', parent: 'root', votes: 10, score: 0.7 },
  { id: 'A1', parent: 'A', votes: 20, score: 0.8 },
  { id: 'A2', parent: 'A', votes: 5, score: 0.5 },
]);

test('canonPath follows the vote leaders root→tip', () => {
  assert.deepEqual(canonPath(tree()), ['root', 'A', 'A1']);
});

test('overlay flips the canon line', () => {
  // добавим B достаточно голосов, чтобы обойти A
  assert.deepEqual(canonPath(tree(), { B: 100 }), ['root', 'B']);
});

test('markCanon tags exactly the canon path', () => {
  const marked = markCanon(tree());
  const canon = marked.filter(n => n.canon).map(n => n.id).sort();
  assert.deepEqual(canon, ['A', 'A1', 'root']);
});

test('cycle guard: malformed parent loop does not hang', () => {
  const bad = [
    { id: 'x', parent: 'y', votes: 1 },
    { id: 'y', parent: 'x', votes: 1 },
  ];
  // нет корня (parent:null) → путь пустой, без зацикливания
  assert.deepEqual(canonPath(bad), []);
});
