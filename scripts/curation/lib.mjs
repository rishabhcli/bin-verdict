// Helper used while curating data/cities/*.json by hand from official pages.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const items = JSON.parse(fs.readFileSync(path.join(root, 'data/items.json'), 'utf8'));
const ids = new Set(items.map(x => x.id));
const VERDICTS = new Set(['recycle', 'compost', 'trash', 'special', 'not-recycling']);
const BASES = new Set(['listed', 'general-rule', 'inferred']);
export function writeCity(meta, rows) {
  const rulings = {};
  const srcIds = new Set(meta.sources.map(s => s.id));
  for (const [item, verdict, basis, quote, source, note] of rows) {
    if (!ids.has(item)) throw new Error('unknown item ' + item);
    if (!VERDICTS.has(verdict)) throw new Error('bad verdict ' + verdict + ' for ' + item);
    if (!BASES.has(basis)) throw new Error('bad basis ' + basis + ' for ' + item);
    if (!srcIds.has(source)) throw new Error('bad source ' + source + ' for ' + item);
    if (rulings[item]) throw new Error('dup ' + item + ' in ' + meta.id);
    rulings[item] = { verdict, basis, source, quote, ...(note ? { note } : {}) };
  }
  const out = { ...meta, rulings };
  fs.writeFileSync(path.join(root, 'data/cities', meta.id + '.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(meta.id, Object.keys(rulings).length, 'rulings');
}
