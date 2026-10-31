import fs from 'node:fs';
import path from 'node:path';
import { loadData, root } from './load.mjs';
import { genericErrorRate, contestedItems, unanimity } from '../src/engine.js';
const { items, cities } = loadData();
const err = genericErrorRate(cities);
const contested = contestedItems(cities, items).filter(x => x.yes.length && x.no.length);
const una = unanimity(cities, items);
const label = Object.fromEntries(items.map(i => [i.id, i.label]));
const out = {
  cities: cities.length,
  items: items.length,
  countedRulings: cities.reduce((n, c) => n + Object.values(c.rulings).filter(r => r.basis !== 'inferred').length, 0),
  genericAdvice: { pairs: err.pairs, wrong: err.wrong, rate: Number(err.rate.toFixed(4)), falseRecycle: err.falseRecycle, falseKeep: err.falseKeep },
  unanimity: una,
  perCity: Object.fromEntries(Object.entries(err.perCity).map(([k, v]) => [k, { ...v, rate: v.pairs ? Number((v.wrong / v.pairs).toFixed(3)) : 0 }])),
  mostContested: contested.slice(0, 15).map(x => ({ item: x.item, label: label[x.item], recycle: x.yes, notRecycle: x.no }))
};
fs.writeFileSync(path.join(root, 'docs/stats.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ ...out, mostContested: out.mostContested.slice(0, 8).map(x => `${x.item}: ${x.recycle.length} yes / ${x.notRecycle.length} no`) }, null, 1));
