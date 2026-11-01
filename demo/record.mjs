// Records the demo against the live site with headless Chromium (Playwright). Output: demo/raw/*.webm + demo/marks.json
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const D = new URL('.', import.meta.url).pathname;
const LIVE = process.env.APP_URL ?? 'https://bin-verdict.vercel.app/';
fs.rmSync(D + 'raw', { recursive: true, force: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
const ctxStart = Date.now();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: D + 'raw', size: { width: 1920, height: 1080 } } });
const page = await ctx.newPage();
await page.goto(LIVE);
await page.waitForFunction(() => /ready/.test(document.getElementById('model-status').textContent), null, { timeout: 120000 });
const style = z => page.evaluate(zoom => { document.documentElement.style.zoom = zoom; }, z);
const cap = text => page.evaluate(t => {
  let el = document.getElementById('__cap');
  if (!el) {
    el = document.createElement('div'); el.id = '__cap';
    el.style.cssText = 'position:fixed;left:20px;right:20px;bottom:18px;background:rgba(8,28,20,.9);color:#fff;padding:10px 16px;border-radius:10px;font:600 17px system-ui;z-index:99999;';
    document.documentElement.appendChild(el);
  }
  el.textContent = t;
}, text);
const wait = ms => page.waitForTimeout(ms);
const smooth = sel => page.evaluate(s => document.querySelector(s).scrollIntoView({ behavior: 'smooth', block: 'start' }), sel);
const smoothCenter = sel => page.evaluate(s => document.querySelector(s).scrollIntoView({ behavior: 'smooth', block: 'center' }), sel);
const q = page.locator('#q');
await style('1.5');
await page.evaluate(() => window.scrollTo(0, 0));
await page.selectOption('#city', 'san-francisco-ca');
const t0 = Date.now();
const marks = { offset: (t0 - ctxStart) / 1000 };
const now = () => (Date.now() - t0) / 1000;
const mark = n => { marks[n] = now(); };
async function scene(minLen, fn) { const s = now(); await fn(); const rest = minLen - (now() - s); if (rest > 0) await wait(rest * 1000); }
async function ask(text, delay = 55) { await q.fill(''); await q.pressSequentially(text, { delay }); await page.click('button[type=submit]'); await page.waitForSelector('#verdict .badge'); }

await scene(15, async () => {
  await cap('Arbiter Hacks V1, Theme Track "Rethinking Waste": Bin Verdict gives cited per-city bin rulings');
  await wait(900); mark('p1');
  await ask('greasy pizza box');
  await cap('San Francisco: compost cart (Recology page: "Greasy pizza boxes and paper bags")'); await wait(3300);
  await page.selectOption('#city', 'chicago-il'); await cap('Chicago: recycling cart, if the box is empty and holds no pizza'); await wait(3600);
  await page.selectOption('#city', 'urbana-il'); await cap('Urbana: food-soiled boxes are not accepted in the recycling cart'); await wait(3300);
});
await scene(21, async () => {
  await page.selectOption("#city", "san-francisco-ca");
  await cap("Free-text lookup: MiniLM sentence embeddings run in the browser, no server calls");
  await wait(700); mark("p2");
  await ask("Dunkin cup with the sleeve", 70);
  await wait(2300);
  await smoothCenter("#result"); await cap("San Francisco: paper coffee cups go in the recycling cart"); await wait(5200);
  await page.selectOption("#city", "austin-tx"); mark("p2b"); await cap("Austin: coated paper cups are accepted"); await wait(3700);
  await page.selectOption("#city", "portland-or"); await cap("Portland: \"NO coffee cups, take-out food containers, paper plates.\""); await wait(3700);
});
await scene(18, async () => {
  await cap('A different item: an empty aerosol can');
  await wait(300);
  await ask('empty can of whipped cream', 45);
  await wait(800);
  mark('p3');
  await smooth('#compare'); await cap('Same item, every city. "Not stated" means the city\'s page is silent, so the tool does not guess.'); await wait(5000);
  await page.evaluate(() => window.scrollBy({ top: 260, behavior: 'smooth' })); await wait(3000);
});
await scene(19, async () => {
  await smooth('#find-h'); await wait(600); mark('p4');
  await cap('Leave-one-out test: each city ruling is compared with the majority of the other cities');
  await wait(5500);
  await page.evaluate(() => window.scrollBy({ top: 330, behavior: 'smooth' })); await cap('Most contested items: cities split on whether they belong in the recycling cart'); await wait(4000);
});
await scene(15, async () => {
  await smoothCenter('#findings .meta'); await wait(600); mark('p5');
  await cap('Retrieval check: 195 held-out descriptions written by the author, semantic model vs plain text matching');
  await wait(7000);
});
await scene(24, async () => {
  await smooth('#stk-h'); await wait(600); mark('p6');
  await page.selectOption('#city', 'chicago-il'); await cap('Cart sticker for Chicago, generated from the same rulings');
  await wait(4200);
  await page.selectOption('#city', 'denver-co'); await cap('Cart sticker for Denver');
  await wait(4200);
  await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' })); await wait(3500);
});
await scene(11, async () => {
  await page.goto('https://github.com/rishabhcli/bin-verdict'); await wait(1500);
  await style('1.3'); await cap('Open source (MIT): github.com/rishabhcli/bin-verdict. 15 tests, model and runtime vendored, static deploy.');
  await wait(2500);
  await page.evaluate(() => window.scrollBy({ top: 700, behavior: 'smooth' })); await wait(3500);
});
mark('end');
fs.writeFileSync(D + 'marks.json', JSON.stringify(marks, null, 1));
await ctx.close();
const vids = fs.readdirSync(D + 'raw').filter(f => f.endsWith('.webm'));
marks.video = D + 'raw/' + vids[0];
fs.writeFileSync(D + 'marks.json', JSON.stringify(marks, null, 1));
await browser.close();
console.log('recorded', JSON.stringify(marks));
