// Held-out retrieval evaluation: lexical vs embedding (MiniLM) vs hybrid, on eval/queries.json.
// Also writes the phrase embeddings the web app loads (web/data/phrases.*).
import fs from 'node:fs';
import path from 'node:path';
import { pipeline, env } from '@huggingface/transformers';
import { loadData, root } from './load.mjs';
import { buildLexicalIndex, lexicalScores } from '../src/lexical.js';
import { buildPhrases, embeddingScores, hybridScores, rank } from '../src/retrieve.js';

env.allowRemoteModels = false;
env.localModelPath = path.join(root, 'web/models') + '/';
const ext = await pipeline('feature-extraction', 'all-MiniLM-L6-v2', { dtype: 'q8' });
const embed = async texts => {
  const out = await ext(texts, { pooling: 'mean', normalize: true });
  return { data: out.data, dim: out.dims[1] };
};

const { items } = loadData();
const phrases = buildPhrases(items);
const queries = JSON.parse(fs.readFileSync(path.join(root, 'eval/queries.json'), 'utf8'));
const lexIdx = buildLexicalIndex(items);

const P = await embed(phrases.map(p => p.text));
fs.mkdirSync(path.join(root, 'web/data'), { recursive: true });
fs.writeFileSync(path.join(root, 'web/data/phrases.json'), JSON.stringify({ dim: P.dim, phrases }) + '\n');
fs.writeFileSync(path.join(root, 'web/data/phrases.f32'), Buffer.from(new Float32Array(P.data).buffer));

const Q = await embed(queries.map(q => q.q));
const rankers = { lexical: [], embedding: [], hybrid: [] };
const detail = [];
queries.forEach((q, i) => {
  const qv = Q.data.subarray(i * Q.dim, (i + 1) * Q.dim);
  const lex = lexicalScores(lexIdx, q.q);
  const emb = embeddingScores(phrases, P.data, P.dim, qv);
  const hyb = hybridScores(lex, emb, 0.5);
  const r = { lexical: rank(lex, 3), embedding: rank(emb, 3), hybrid: rank(hyb, 3) };
  for (const k of Object.keys(rankers)) {
    const pos = r[k].findIndex(x => x.item === q.item);
    rankers[k].push(pos);
  }
  detail.push({ q: q.q, truth: q.item, lexical: r.lexical[0].item, embedding: r.embedding[0].item, hybrid: r.hybrid[0].item });
});
const summary = {};
for (const [k, pos] of Object.entries(rankers)) {
  const n = pos.length;
  summary[k] = { top1: pos.filter(p => p === 0).length / n, top3: pos.filter(p => p >= 0).length / n };
}
const res = { model: 'Xenova/all-MiniLM-L6-v2 (int8 ONNX)', queries: queries.length, hybridAlpha: 0.5, summary,
  hybridMisses: detail.filter(d => d.hybrid !== d.truth) };
fs.writeFileSync(path.join(root, 'docs/retrieval-eval.json'), JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify({ queries: res.queries, phrases: phrases.length, summary }, null, 1));
console.log('hybrid misses:', res.hybridMisses.length);
