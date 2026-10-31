// Lexical baseline for mapping free text to an item id: token overlap plus character trigram Dice.
const STOP = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'for', 'with', 'my', 'old', 'used', 'in', 'to', 'is', 'it']);

export function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9#\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function tokens(s) {
  return normalize(s).split(' ').filter(w => w && !STOP.has(w)).map(stem);
}

function trigrams(s) {
  const t = ` ${normalize(s)} `;
  const set = new Map();
  for (let i = 0; i < t.length - 2; i += 1) {
    const g = t.slice(i, i + 3);
    set.set(g, (set.get(g) ?? 0) + 1);
  }
  return set;
}

function dice(a, b) {
  let inter = 0;
  let sa = 0;
  let sb = 0;
  for (const v of a.values()) sa += v;
  for (const v of b.values()) sb += v;
  for (const [k, v] of a) if (b.has(k)) inter += Math.min(v, b.get(k));
  return sa + sb ? (2 * inter) / (sa + sb) : 0;
}

/** Build a searchable index from the item list. Every synonym and the label become a phrase. */
export function buildLexicalIndex(items) {
  const phrases = [];
  for (const it of items) {
    for (const p of new Set([it.label, ...it.synonyms])) {
      phrases.push({ item: it.id, text: p, toks: new Set(tokens(p)), tri: trigrams(p) });
    }
  }
  return phrases;
}

/** Ranked list of {item, score}, best phrase per item. */
export function lexicalSearch(index, query, k = 5) {
  const qt = new Set(tokens(query));
  const qtri = trigrams(query);
  const best = new Map();
  for (const p of index) {
    let overlap = 0;
    for (const t of qt) if (p.toks.has(t)) overlap += 1;
    const jac = qt.size + p.toks.size - overlap ? overlap / (qt.size + p.toks.size - overlap) : 0;
    const score = 0.6 * jac + 0.4 * dice(qtri, p.tri);
    if (score > (best.get(p.item) ?? -1)) best.set(p.item, score);
  }
  return [...best.entries()].map(([item, score]) => ({ item, score })).sort((a, b) => b.score - a.score).slice(0, k);
}

/** Score every item (best phrase per item). Returns a Map(item -> score in [0,1]). */
export function lexicalScores(index, query) {
  const qt = new Set(tokens(query));
  const qtri = trigrams(query);
  const best = new Map();
  for (const p of index) {
    let overlap = 0;
    for (const t of qt) if (p.toks.has(t)) overlap += 1;
    const union = qt.size + p.toks.size - overlap;
    const jac = union ? overlap / union : 0;
    const score = 0.6 * jac + 0.4 * dice(qtri, p.tri);
    if (score > (best.get(p.item) ?? -1)) best.set(p.item, score);
  }
  return best;
}
