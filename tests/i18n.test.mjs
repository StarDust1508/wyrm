import { test } from 'node:test';
import assert from 'node:assert/strict';

// i18n.detect() reads localStorage — stub it before importing the module.
globalThis.localStorage = {
  _d: {},
  getItem(k) { return k in this._d ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};

const { t, setLang } = await import('../src/lib/i18n.js');

test('existing key returns the ru string', () => {
  assert.equal(t('common.more'), 'Показать ещё');
});

test('missing key returns the provided fallback', () => {
  assert.equal(t('nope.key', 'запас'), 'запас');
});

test('missing key with no fallback returns the key itself', () => {
  assert.equal(t('nope.key'), 'nope.key');
});

test('unknown language falls back to the ru dictionary', () => {
  setLang('xx');
  assert.equal(t('common.loading'), 'Загрузка…'); // no xx dict → DICT.ru
  setLang('ru');
});
