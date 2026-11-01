// Takes the README/Devpost screenshots from a running site. Usage: node scripts/shots.mjs <url> <outDir>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const url = process.argv[2] ?? 'https://bin-verdict.vercel.app/';
const out = process.argv[3] ?? 'docs';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(url);
await page.waitForFunction(() => /ready|Text match only/.test(document.getElementById('model-status').textContent), null, { timeout: 90000 });
async function ask(city, text) {
  await page.selectOption('#city', city);
  await page.fill('#q', text);
  await page.click('button[type=submit]');
  await page.waitForSelector('#verdict .badge');
  await page.waitForTimeout(200);
}
await ask('san-francisco-ca', 'oily carton from last night\'s pizza');
await page.screenshot({ path: `${out}/01-ruling-san-francisco.png`, clip: { x: 0, y: 0, width: 1280, height: 640 } });
await page.locator('#compare').screenshot({ path: `${out}/02-same-item-every-city.png` });
await ask('chicago-il', 'oily carton from last night\'s pizza');
await page.locator('#result').screenshot({ path: `${out}/03-ruling-chicago.png` });
await page.locator('#findings').locator('xpath=ancestor::section').screenshot({ path: `${out}/04-findings.png` });
await page.selectOption('#city', 'portland-or');
await page.locator('#sticker').locator('xpath=ancestor::section').screenshot({ path: `${out}/05-cart-sticker.png` });
await browser.close();
console.log('shots written to', out);
