import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from '../scripts/load.mjs';
import { onboardReport, stickerHtml } from '../scripts/onboard.mjs';

const { items, cities } = loadData();

test('onboarding report for a real city has coverage and hotspots', () => {
  const chi = cities.find(c => c.id === 'chicago-il');
  const rep = onboardReport(chi, items, cities.filter(c => c.id !== chi.id));
  assert.deepEqual(rep.problems, []);
  assert.equal(rep.coverage.total, items.length);
  assert.ok(rep.coverage.stated > 20);
  assert.ok(Array.isArray(rep.hotspots));
});

test('onboarding report flags a broken file', () => {
  const bad = structuredClone(cities[0]);
  bad.rulings.newspaper.verdict = 'nope';
  const rep = onboardReport(bad, items, cities.slice(1));
  assert.ok(rep.problems.length >= 1);
});

test('sticker lists yes and no columns and the source', () => {
  const html = stickerHtml(cities[0], items);
  assert.match(html, /<h2>Yes<\/h2>/);
  assert.match(html, /<h2>No<\/h2>/);
  assert.match(html, new RegExp(cities[0].sources[0].url.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')));
});
