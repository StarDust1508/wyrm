import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffSentences, applyMerge } from '../src/lib/diff.js';

test('identical text → only ctx hunks', () => {
  const t = 'Архонт ждал. Кейра назвала цену.';
  const h = diffSentences(t, t);
  assert.ok(h.every(x => x.type === 'ctx'));
  assert.equal(applyMerge(h, {}), 'Архонт ждал. Кейра назвала цену.');
});

test('adjacent del+add coalesce into a conflict', () => {
  const target = 'Архонт ждал их в зале. Вэйл шагнул вперёд. Кейра назвала цену.';
  const source = 'Архонт ждал их в зале. Вэйл остался у дверей. Кейра назвала цену.';
  const h = diffSentences(target, source).map((x, i) => ({ ...x, id: i }));
  const types = h.map(x => x.type);
  assert.deepEqual(types, ['ctx', 'conflict', 'ctx']);
  const conflict = h.find(x => x.type === 'conflict');
  assert.match(conflict.text, /Вэйл шагнул/);
  assert.match(conflict.them, /остался у дверей/);
});

test('applyMerge resolves a conflict by chosen line', () => {
  const target = 'A. B. C.';
  const source = 'A. X. C.';
  const h = diffSentences(target, source).map((x, i) => ({ ...x, id: i }));
  const cid = h.find(x => x.type === 'conflict').id;
  assert.match(applyMerge(h, {}), /B\./);            // default keeps canon
  assert.match(applyMerge(h, { [cid]: 'them' }), /X\./); // pick branch line
});

test('pure addition is kept unless rejected; pure deletion drops unless rejected', () => {
  const target = 'One.';
  const source = 'One. Two.';
  const h = diffSentences(target, source).map((x, i) => ({ ...x, id: i }));
  const add = h.find(x => x.type === 'add');
  assert.ok(add, 'expected an add hunk');
  assert.match(applyMerge(h, {}), /Two\./);
  assert.doesNotMatch(applyMerge(h, { [add.id]: 'reject' }), /Two\./);
});
