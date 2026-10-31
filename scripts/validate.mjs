import { loadData } from './load.mjs';
import { validateCity } from '../src/engine.js';
const { items, cities } = loadData();
const ids = new Set(items.map(i => i.id));
let bad = 0;
for (const c of cities) for (const p of validateCity(c, ids)) { console.error(p); bad += 1; }
console.log(`${items.length} items, ${cities.length} cities, ${bad} problems`);
process.exit(bad ? 1 : 0);
