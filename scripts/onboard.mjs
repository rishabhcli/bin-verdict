// City onboarding: validate a rules file, report coverage and where it departs from other cities,
// and optionally write a printable cart sticker.
// Usage: node scripts/onboard.mjs data/cities/<city>.json [--sticker out.html]
import fs from 'node:fs';
import { loadData } from './load.mjs';
import { validateCity, genericAnswer, counted, inRecycling } from '../src/engine.js';

export function onboardReport(city, items, others) {
  const ids = new Set(items.map(i => i.id));
  const problems = validateCity(city, ids);
  const named = Object.entries(city.rulings).filter(([, r]) => counted(r));
  const hotspots = [];
  for (const [item, r] of named) {
    const g = genericAnswer(others, item, city.id);
    if (g && g.recycle !== inRecycling(r)) hotspots.push({ item, label: items.find(i => i.id === item).label, city: inRecycling(r) ? 'recycle' : 'not recycling', others: `${g.yes} recycle / ${g.no} not` });
  }
  const missing = items.filter(i => !city.rulings[i.id]).map(i => i.label);
  return { problems, coverage: { stated: Object.keys(city.rulings).length, total: items.length }, hotspots, missing };
}

export function stickerHtml(city, items) {
  const yes = [];
  const no = [];
  for (const it of items) {
    const r = city.rulings[it.id];
    if (!counted(r)) continue;
    (inRecycling(r) ? yes : no).push(it.label);
  }
  const li = a => a.map(x => `<li>${x}</li>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>${city.name} recycling sticker</title>
<style>body{font:14px/1.4 system-ui;margin:24px}h1{margin:0 0 8px}.g{display:grid;grid-template-columns:1fr 1fr;gap:24px}h2{margin:0 0 4px}.y h2{color:#1f7a4d}.n h2{color:#a8323e}ul{margin:0;padding-left:18px}small{color:#555}</style>
<h1>${city.name}: what goes in the recycling cart</h1><div class="g"><div class="y"><h2>Yes</h2><ul>${li(yes)}</ul></div><div class="n"><h2>No</h2><ul>${li(no)}</ul></div></div>
<p><small>Rulings from ${city.sources.map(s => s.url).join(', ')}. Read ${city.retrieved}.</small></p>`;
}

if (process.argv[1] && process.argv[1].endsWith('onboard.mjs')) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node scripts/onboard.mjs <city.json> [--sticker out.html]'); process.exit(2); }
  const { items, cities } = loadData();
  const city = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rep = onboardReport(city, items, cities.filter(c => c.id !== city.id));
  console.log(`${city.name}: ${rep.coverage.stated}/${rep.coverage.total} item types stated`);
  console.log(rep.problems.length ? 'PROBLEMS:\n' + rep.problems.join('\n') : 'no validation problems');
  console.log(`Items where ${city.name} departs from the majority of other cities (${rep.hotspots.length}):`);
  for (const h of rep.hotspots) console.log(`  ${h.label}: ${h.city} here, others ${h.others}`);
  const si = process.argv.indexOf('--sticker');
  if (si > 0) { fs.writeFileSync(process.argv[si + 1], stickerHtml(city, items)); console.log('sticker written to', process.argv[si + 1]); }
  process.exit(rep.problems.length ? 1 : 0);
}
