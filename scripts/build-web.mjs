// Copies the engine and data into web/ so the site is a plain static folder (no bundler).
import fs from 'node:fs';
import path from 'node:path';
import { loadData, root } from './load.mjs';
const { items, cities } = loadData();
const w = p => path.join(root, 'web', p);
fs.mkdirSync(w('src'), { recursive: true });
fs.mkdirSync(w('data'), { recursive: true });
fs.mkdirSync(w('vendor'), { recursive: true });
for (const f of ['engine.js', 'lexical.js', 'retrieve.js']) fs.copyFileSync(path.join(root, 'src', f), w('src/' + f));
fs.writeFileSync(w('data/items.json'), JSON.stringify(items));
fs.writeFileSync(w('data/cities.json'), JSON.stringify(cities));
for (const [src, dst] of [['docs/stats.json', 'data/stats.json'], ['docs/retrieval-eval.json', 'data/retrieval-eval.json']]) {
  if (fs.existsSync(path.join(root, src))) fs.copyFileSync(path.join(root, src), w(dst));
}
const tf = path.join(root, 'node_modules/@huggingface/transformers/dist');
for (const f of ['transformers.min.js', 'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) {
  if (fs.existsSync(path.join(tf, f))) fs.copyFileSync(path.join(tf, f), w('vendor/' + f));
}
console.log('web built:', cities.length, 'cities,', items.length, 'items');
