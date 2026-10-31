import { answer, compare, VERDICT_LABEL, ruling, counted, inRecycling } from './src/engine.js';
import { buildLexicalIndex, lexicalScores } from './src/lexical.js';
import { embeddingScores, rank } from './src/retrieve.js';

const $ = id => document.getElementById(id);
const j = async p => (await fetch(p)).json();
const [items, cities, stats, evalRes, phraseMeta] = await Promise.all([
  j('data/items.json'), j('data/cities.json'), j('data/stats.json'), j('data/retrieval-eval.json'), j('data/phrases.json')
]);
const phraseVecs = new Float32Array(await (await fetch('data/phrases.f32')).arrayBuffer());
const label = Object.fromEntries(items.map(i => [i.id, i.label]));
const lexIndex = buildLexicalIndex(items);
let embedder = null;

const citySel = $('city');
for (const c of cities) citySel.add(new Option(c.name, c.id));
const savedCity = new URLSearchParams(location.search).get('city');
if (savedCity && cities.some(c => c.id === savedCity)) citySel.value = savedCity;
const browse = $('browse');
for (const it of [...items].sort((a, b) => a.label.localeCompare(b.label))) browse.add(new Option(it.label, it.id));

let selectedItem = null;
let candidates = [];

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function loadEmbedder() {
  try {
    const tf = await import('./vendor/transformers.min.js');
    tf.env.allowLocalModels = true;
    tf.env.allowRemoteModels = false;
    tf.env.localModelPath = new URL('./models/', location.href).pathname;
    tf.env.backends.onnx.wasm.wasmPaths = new URL('./vendor/', location.href).href;
    tf.env.backends.onnx.wasm.numThreads = 1;
    embedder = await tf.pipeline('feature-extraction', 'all-MiniLM-L6-v2', { dtype: 'q8' });
    $('model-status').textContent = 'Semantic search ready (MiniLM, runs in your browser, no server calls).';
  } catch (e) {
    console.warn('embedding model failed to load', e);
    $('model-status').textContent = 'Text match only: the semantic model did not load in this browser.';
  }
}

async function candidatesFor(text) {
  if (embedder) {
    const out = await embedder([text], { pooling: 'mean', normalize: true });
    const scores = embeddingScores(phraseMeta.phrases, phraseVecs, phraseMeta.dim, out.data);
    return rank(scores, 3);
  }
  return rank(lexicalScores(lexIndex, text), 3);
}

function renderChips() {
  $('chips').innerHTML = candidates.map(c =>
    `<button type="button" class="chip" data-item="${c.item}" aria-pressed="${c.item === selectedItem}">${esc(label[c.item])}</button>`).join('');
  for (const b of $('chips').querySelectorAll('button')) b.addEventListener('click', () => select(b.dataset.item));
}

function badge(v) { return `<span class="badge v-${v}">${esc(VERDICT_LABEL[v])}</span>`; }

function renderResult() {
  if (!selectedItem) return;
  const a = answer(cities, citySel.value, selectedItem);
  const box = $('verdict');
  $('result').classList.remove('hidden');
  if (!a.found) {
    box.innerHTML = `<div class="res-head"><h3>${esc(label[selectedItem])}</h3></div><p>${esc(a.message)}</p>`;
  } else {
    const basis = a.basis === 'general-rule' ? 'covered by a general rule on the page' : 'named on the page';
    const split = a.otherCities.recycle + a.otherCities.not;
    const dis = a.otherCities.disagreeWithThisAnswer;
    const splitLine = split ? `On whether it belongs in the recycling cart, ${dis} of ${split} other cities in this dataset answer differently.` : '';
    box.innerHTML = `
      <div class="res-head"><h3>${esc(label[selectedItem])} in ${esc(a.cityName)}</h3>${badge(a.verdict)}</div>
      <blockquote>${esc(a.quote)}</blockquote>
      ${a.note ? `<p class="meta">Note: ${esc(a.note)}</p>` : ''}
      <p class="meta">Source: <a href="${esc(a.source.url)}" rel="noopener">${esc(a.source.title)}</a>, read ${esc(a.source.retrieved)}<span class="tag">${basis}</span></p>
      ${splitLine ? `<p class="split">${esc(splitLine)}</p>` : ''}`;
  }
  const rows = compare(cities, selectedItem);
  $('compare').classList.remove('hidden');
  $('cmp-table').innerHTML = `<thead><tr><th>City</th><th>Ruling</th><th>What the page says</th></tr></thead><tbody>` +
    rows.map(r => `<tr class="${r.city === citySel.value ? 'me' : ''}"><td>${esc(r.cityName)}</td><td>${r.verdict ? badge(r.verdict) : '<span class="meta">not stated</span>'}</td><td>${r.quote ? esc(r.quote) : ''}</td></tr>`).join('') + '</tbody>';
}

function select(item) {
  selectedItem = item;
  if (!candidates.some(c => c.item === item)) candidates = [{ item }, ...candidates].slice(0, 3);
  renderChips();
  renderResult();
  renderSticker();
}

async function onAsk(e) {
  e.preventDefault();
  const text = $('q').value.trim();
  if (!text) return;
  browse.value = '';
  candidates = await candidatesFor(text);
  select(candidates[0].item);
}

function renderFindings() {
  const g = stats.genericAdvice;
  const pct = x => Math.round(x * 100);
  const rr = evalRes.summary;
  const contested = stats.mostContested.slice(0, 8).map(x =>
    `<tr><td>${esc(x.label)}</td><td>${x.recycle.length}</td><td>${x.notRecycle.length}</td></tr>`).join('');
  $('findings').innerHTML = `
    <div class="stat">
      <div><b>${pct(g.rate)}%</b><span>of ${g.pairs} city rulings contradict the majority of the other cities (${g.falseRecycle} would contaminate the cart, ${g.falseKeep} would send accepted material to the trash)</span></div>
      <div><b>${stats.unanimity.contested} of ${stats.unanimity.items}</b><span>common items are contested: some cities accept them, others do not</span></div>
    </div>
    <div class="scroll"><table class="mini"><thead><tr><th>Most contested items</th><th>Cities: recycle</th><th>Cities: not in recycling</th></tr></thead><tbody>${contested}</tbody></table></div>
    <p class="meta">Retrieval check: on ${evalRes.queries} held-out descriptions, the semantic model picks the right item first ${pct(rr.embedding.top1)}% of the time (top 3: ${pct(rr.embedding.top3)}%), against ${pct(rr.lexical.top1)}% (top 3: ${pct(rr.lexical.top3)}%) for plain text matching.</p>`;
}

function renderSticker() {
  const c = cities.find(x => x.id === citySel.value);
  const yes = [];
  const no = [];
  for (const it of items) {
    const r = ruling(c, it.id);
    if (!counted(r)) continue;
    (inRecycling(r) ? yes : no).push(it.label);
  }
  $('sticker').innerHTML = `<h3 style="margin:0 0 8px">${esc(c.name)}: ${esc(c.program)}</h3><div class="stk">
    <div class="yes"><h3>In the recycling cart</h3><ul>${yes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="no"><h3>Not in the recycling cart</h3><ul>${no.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
    <p class="meta">Rulings from ${esc(c.sources.map(s => s.title).join('; '))}. Read ${esc(c.retrieved)}.</p>`;
}

function renderAbout() {
  const total = cities.reduce((n, c) => n + Object.keys(c.rulings).length, 0);
  $('about').textContent = `${cities.length} cities, ${items.length} item types, ${total} rulings. Every ruling carries a quote from the city's own page and the date it was read. Cities change their rules, so confirm with the source link before relying on an answer. A city that does not mention an item gets "not stated", never a guess.`;
}

$('ask').addEventListener('submit', onAsk);
citySel.addEventListener('change', () => { renderResult(); renderSticker(); });
browse.addEventListener('change', () => { if (browse.value) { $('q').value = ''; candidates = [{ item: browse.value }]; select(browse.value); } });
$('print').addEventListener('click', () => window.print());
renderFindings();
renderAbout();
renderSticker();
loadEmbedder();
window.__binVerdict = { select, candidatesFor, ready: () => embedder !== null };
