// Mapping a free-text description to an item id. Three rankers share this file:
// lexical (src/lexical.js), embedding similarity, and a hybrid of both.

/** Every label and synonym becomes a phrase that points at its item. */
export function buildPhrases(items) {
  const out = [];
  for (const it of items) {
    for (const p of new Set([it.label, ...it.synonyms])) out.push({ item: it.id, text: p });
  }
  return out;
}

/**
 * Embedding score per item: the best cosine similarity between the query vector and any phrase
 * vector of that item. Vectors must be L2-normalised. `vecs` is a flat Float32Array (n x dim).
 */
export function embeddingScores(phrases, vecs, dim, q) {
  const best = new Map();
  for (let i = 0; i < phrases.length; i += 1) {
    let s = 0;
    const off = i * dim;
    for (let d = 0; d < dim; d += 1) s += vecs[off + d] * q[d];
    const cur = best.get(phrases[i].item);
    if (cur === undefined || s > cur) best.set(phrases[i].item, s);
  }
  return best;
}

function zscores(map) {
  const vals = [...map.values()];
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
  return new Map([...map].map(([k, v]) => [k, (v - mean) / sd]));
}

/** Weighted sum of per-query z-scores. alpha is the weight on the embedding ranker. */
export function hybridScores(lex, emb, alpha = 0.5) {
  const zl = zscores(lex);
  const ze = zscores(emb);
  const out = new Map();
  for (const [k, v] of ze) out.set(k, alpha * v + (1 - alpha) * (zl.get(k) ?? 0));
  return out;
}

export function rank(scoreMap, k = 5) {
  return [...scoreMap.entries()].map(([item, score]) => ({ item, score })).sort((a, b) => b.score - a.score).slice(0, k);
}
