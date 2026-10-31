import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../scripts/load.mjs';
import { buildLexicalIndex, lexicalSearch, tokens, normalize } from '../src/lexical.js';

const { items } = loadData();
const idx = buildLexicalIndex(items);

test('normalize and tokens', () => {
  assert.equal(normalize('  Greasy   Pizza-Box! '), 'greasy pizza box');
  assert.deepEqual(tokens('the batteries and boxes'), ['battery', 'boxe']);
});

test('obvious queries land on the right item', () => {
  assert.equal(lexicalSearch(idx, 'greasy pizza box')[0].item, 'pizza-box-greasy');
  assert.equal(lexicalSearch(idx, 'soda can')[0].item, 'aluminum-can');
  assert.equal(lexicalSearch(idx, 'styrofoam cup')[0].item, 'foam-food-container');
  assert.equal(lexicalSearch(idx, 'ziploc bag')[0].item, 'plastic-bag-film');
});

test('top-k returns k distinct items sorted by score', () => {
  const r = lexicalSearch(idx, 'plastic', 5);
  assert.equal(r.length, 5);
  assert.equal(new Set(r.map(x => x.item)).size, 5);
  for (let i = 1; i < r.length; i += 1) assert.ok(r[i - 1].score >= r[i].score);
});
