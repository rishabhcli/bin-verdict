import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function loadData() {
  const items = JSON.parse(fs.readFileSync(path.join(root, 'data/items.json'), 'utf8'));
  const dir = path.join(root, 'data/cities');
  const cities = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  return { items, cities };
}
