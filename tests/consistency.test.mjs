import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findContradictions, charactersIn, latestStatuses, coAppearEdges } from '../src/lib/consistency.js';

const names = { a: { name: 'Алиса' }, b: { name: 'Борис' } };

test('flags revival: dead → alive along canon', () => {
  const nodes = [
    { id: 'r', parent: null, votes: 10, chars: { a: 'alive' } },
    { id: 'x', parent: 'r', votes: 5, chars: { a: 'dead' } },
    { id: 'y', parent: 'x', votes: 5, chars: { a: 'alive' } },
  ];
  const issues = findContradictions(nodes, {}, names);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, 'revival');
  assert.equal(issues[0].sev, 'high');
  assert.equal(issues[0].charName, 'Алиса');
});

test('missing → alive is a (mid) revival; changed is not "gone"', () => {
  const nodes = [
    { id: 'r', parent: null, votes: 3, chars: { b: 'missing' } },
    { id: 'x', parent: 'r', votes: 3, chars: { b: 'alive' } },
  ];
  const issues = findContradictions(nodes, {}, names);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].sev, 'mid');
});

test('no false positives on a consistent canon', () => {
  const nodes = [
    { id: 'r', parent: null, votes: 3, chars: { a: 'alive', b: 'alive' } },
    { id: 'x', parent: 'r', votes: 3, chars: { a: 'changed', b: 'alive' } },
  ];
  assert.deepEqual(findContradictions(nodes, {}, names), []);
});

test('contradiction off the canon path is ignored', () => {
  const nodes = [
    { id: 'r', parent: null, votes: 10, chars: { a: 'alive' } },
    { id: 'canon', parent: 'r', votes: 10, chars: { a: 'alive' } },
    { id: 'side', parent: 'r', votes: 1, chars: { a: 'dead' } },     // losing branch
    { id: 'sideRevive', parent: 'side', votes: 1, chars: { a: 'alive' } },
  ];
  assert.deepEqual(findContradictions(nodes, {}, names), []);
});

test('helpers: charactersIn / latestStatuses / coAppearEdges', () => {
  const nodes = [
    { id: 'r', parent: null, votes: 2, chars: { a: 'alive', b: 'alive' } },
    { id: 'x', parent: 'r', votes: 2, chars: { a: 'dead' } },
  ];
  assert.deepEqual(charactersIn(nodes).sort(), ['a', 'b']);
  assert.equal(latestStatuses(nodes, {}).a, 'dead');     // canon tip status
  const edges = coAppearEdges(nodes);
  assert.equal(edges.length, 1);                          // a&b co-appear in r
  assert.equal(edges[0].n, 1);
});
