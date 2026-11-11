// Phase 1 check: the child walks and runs on the practice street, desktop and phone.
import { launch, collectErrors } from './browser.js';
const base = process.argv[2] || 'http://localhost:5199/';
const browser = await launch();
for (const [name, vp, mobile] of [['desktop', { width: 1280, height: 720 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto(base + '?scene=street');
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const start = await page.evaluate(() => window.__rt.player.pos.toArray());
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(400);
  const end = await page.evaluate(() => window.__rt.player.pos.toArray());
  const fps = await page.evaluate(() => window.__fps);
  await page.screenshot({ path: `screenshots/phase1-${name}.png` });
  console.log(name, 'start', start.map((v) => v.toFixed(1)), 'end', end.map((v) => v.toFixed(1)), 'fps', fps, 'errors', errors);
  await ctx.close();
}
await browser.close();
