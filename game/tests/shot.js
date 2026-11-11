// Usage: bun tests/shot.js <url> <out.png> [width] [height] [waitExpr]
import { launch, collectErrors } from './browser.js';
const [url, out, w = 1280, h = 720, waitExpr = 'window.__ready === true'] = process.argv.slice(2);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = collectErrors(page);
page.on('console', (m) => { if (m.type() !== 'error') console.log('[console]', m.text().slice(0, 2000)); });
await page.goto(url);
await page.waitForFunction(waitExpr, null, { timeout: 60000 });
await page.waitForTimeout(500);
await page.screenshot({ path: out });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
