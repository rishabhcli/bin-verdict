import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../scripts/load.mjs';
import { validateCity, genericAnswer, genericErrorRate, contestedItems, unanimity, answer, compare, counted } from '../src/engine.js';

const mk = (id, rulings, carts = ['recycle', 'trash']) => ({
  id, name: id, state: 'XX', program: 'test', carts, retrieved: '2026-01-01',
  sources: [{ id: 's1', url: 'https://example.org/' + id, title: id }],
  rulings: Object.fromEntries(Object.entries(rulings).map(([k, v]) => [k, { verdict: v, basis: 'listed', source: 's1', quote: 'quote for ' + k }]))
});

test('real data validates', () => {
  const { items, cities } = loadData();
  const ids = new Set(items.map(i => i.id));
  assert.ok(cities.length >= 10);
  for (const c of cities) assert.deepEqual(validateCity(c, ids), [], c.id);
});

test('validator catches broken records', () => {
  const ids = new Set(['a']);
  const bad = mk('x', { a: 'recycle', b: 'recycle' });
  bad.rulings.a.verdict = 'maybe';
  bad.rulings.a.source = 's9';
  const p = validateCity(bad, ids);
  assert.ok(p.some(x => /bad verdict/.test(x)));
  assert.ok(p.some(x => /unknown source/.test(x)));
  assert.ok(p.some(x => /unknown item/.test(x)));
});

test('compost verdict requires a compost cart', () => {
  const c = mk('x', { a: 'compost' });
  assert.ok(validateCity(c, new Set(['a'])).some(x => /compost cart/.test(x)));
  const d = mk('y', { a: 'compost' }, ['recycle', 'compost', 'trash']);
  assert.deepEqual(validateCity(d, new Set(['a'])), []);
});

test('inferred rulings are not counted', () => {
  assert.equal(counted({ basis: 'inferred' }), false);
  assert.equal(counted({ basis: 'listed' }), true);
  assert.equal(counted({ basis: 'general-rule' }), true);
  assert.equal(counted(null), false);
});

test('generic answer is leave-one-out majority with ties resolving to no', () => {
  const cs = [mk('a', { i: 'recycle' }), mk('b', { i: 'recycle' }), mk('c', { i: 'trash' }), mk('d', { i: 'trash' })];
  // excluding a: b yes, c no, d no -> no
  assert.equal(genericAnswer(cs, 'i', 'a', 3).recycle, false);
  // excluding c: a yes, b yes, d no -> yes
  assert.equal(genericAnswer(cs, 'i', 'c', 3).recycle, true);
  // too few others
  assert.equal(genericAnswer(cs, 'i', 'a', 4), null);
  // tie 2-2 among others resolves to no
  const five = [...cs, mk('e', { i: 'recycle' })];
  const g = genericAnswer(five, 'i', 'e', 3);
  assert.equal(g.yes, 2); assert.equal(g.no, 2); assert.equal(g.recycle, false);
});

test('generic error rate on a hand-checked example', () => {
  const cs = [
    mk('a', { i: 'recycle', j: 'recycle' }),
    mk('b', { i: 'recycle', j: 'recycle' }),
    mk('c', { i: 'recycle', j: 'recycle' }),
    mk('d', { i: 'trash', j: 'recycle' })
  ];
  const e = genericErrorRate(cs, 3);
  // item j: everyone agrees, 4 pairs, 0 wrong. item i: a,b,c have majority yes of others (2 yes 1 no for a: b,c yes d no -> yes) correct; d: others all yes -> wrong
  assert.equal(e.pairs, 8);
  assert.equal(e.wrong, 1);
  assert.equal(e.falseRecycle, 1);
  assert.equal(e.falseKeep, 0);
  assert.equal(e.perItem.i.wrong, 1);
});

test('contested items sort by split and ignore thin items', () => {
  const items = [{ id: 'i', label: 'I' }, { id: 'j', label: 'J' }, { id: 'k', label: 'K' }];
  const cs = [
    mk('a', { i: 'recycle', j: 'recycle', k: 'recycle' }),
    mk('b', { i: 'trash', j: 'recycle', k: 'trash' }),
    mk('c', { i: 'recycle', j: 'recycle' })
  ];
  const r = contestedItems(cs, items, 3);
  assert.deepEqual(r.map(x => x.item), ['i', 'j']);
  assert.ok(r[0].split > r[1].split);
  const u = unanimity(cs, items, 3);
  assert.deepEqual(u, { items: 2, unanimous: 1, contested: 1 });
});

test('answer returns quote, source, retrieval date and disagreement count', () => {
  const cs = [mk('a', { i: 'recycle' }), mk('b', { i: 'trash' }), mk('c', { i: 'trash' })];
  const a = answer(cs, 'a', 'i');
  assert.equal(a.found, true);
  assert.equal(a.verdict, 'recycle');
  assert.equal(a.quote, 'quote for i');
  assert.equal(a.source.retrieved, '2026-01-01');
  assert.equal(a.otherCities.disagreeWithThisAnswer, 2);
  const miss = answer(cs, 'a', 'zzz');
  assert.equal(miss.found, false);
  assert.match(miss.message, /will not guess/);
  assert.throws(() => answer(cs, 'nope', 'i'));
  assert.equal(compare(cs, 'i').length, 3);
});

test('known real-world disagreements in the data', () => {
  const { cities } = loadData();
  const v = (city, item) => cities.find(c => c.id === city).rulings[item]?.verdict;
  assert.equal(v('san-francisco-ca', 'pizza-box-greasy'), 'compost');
  assert.equal(v('chicago-il', 'pizza-box-greasy'), 'recycle');
  assert.equal(v('urbana-il', 'aerosol-can'), 'recycle');
  assert.equal(v('chicago-il', 'aerosol-can'), 'not-recycling');
  assert.equal(v('portland-or', 'paper-cup-hot'), 'not-recycling');
  assert.equal(v('austin-tx', 'paper-cup-hot'), 'recycle');
});
