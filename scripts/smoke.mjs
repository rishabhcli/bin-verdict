// Headless browser smoke test against a running static server. Usage: node scripts/smoke.mjs [url] [shotDir]
// Needs Playwright resolvable via NODE_PATH or PLAYWRIGHT_MODULE and CHROMIUM_PATH.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const url = process.argv[2] ?? 'http://localhost:5173/';
const shots = process.argv[3];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(url);
await page.waitForFunction(() => /ready|Text match only/.test(document.getElementById('model-status').textContent), null, { timeout: 90000 });
const status = await page.textContent('#model-status');
async function ask(city, text) {
  await page.selectOption('#city', city);
  await page.fill('#q', text);
  await page.click('button[type=submit]');
  await page.waitForSelector('#verdict .badge');
  await page.waitForTimeout(150);
  return { head: await page.textContent('#verdict .res-head h3'), verdict: await page.textContent('#verdict .badge') };
}
const out = { status };
out.sf = await ask('san-francisco-ca', 'greasy pizza box');
if (shots) await page.screenshot({ path: `${shots}/app-sf-pizza.png`, fullPage: false });
out.chicago = await ask('chicago-il', 'greasy pizza box');
out.urbana = await ask('urbana-il', 'empty can of Febreze');
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
if (shots) await page.screenshot({ path: `${shots}/app-full.png`, fullPage: true });
await browser.close();
if (errors.length || !/Compost/.test(out.sf.verdict) || !/Recycling cart/.test(out.chicago.verdict)) process.exit(1);
