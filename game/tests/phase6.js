// Phase 6 checks: text-only mode, WebGL fallback, phone round layout, low quality frame rate.
import { launch, collectErrors } from './browser.js';
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:5199/';
const browser = await launch();

// 1. Text-only mode: play 2000 with screen-reader style controls only.
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('earth-jukebox-3d-v1', JSON.stringify({ settings: { textOnly: true } })));
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto(`${base}?scene=round&year=2000`);
  await page.waitForFunction('window.__phase === "text-2000"', null, { timeout: 30000 });
  const canvas = await page.locator('canvas').count();
  const place = async (block, fix) => { await page.getByLabel('Block', { exact: true }).selectOption({ label: block }); await page.getByLabel('Fix', { exact: true }).selectOption(fix); await page.getByRole('button', { name: 'Place fix' }).click(); };
  await place('Rooftop Hill', 'pond');
  for (const b of ['Rooftop Hill', 'Rooftop Hill', 'Clay Pot Corner', 'Cycle Bazaar', 'School Lane', 'Ferry Road']) await place(b, 'tree');
  await place('Brick Kiln Road', 'pond');
  const status = await page.locator('.note[aria-live]').first().textContent();
  await page.screenshot({ path: 'screenshots/phase6-textonly.png', fullPage: true });
  await page.getByRole('button', { name: 'Bring the heat wave' }).click();
  await page.waitForSelector('#rep-h');
  console.log('text-only: canvases', canvas, '| last status:', status.slice(0, 90), '| report:', await page.locator('#rep-h').textContent(), '| errors', errors.length ? errors : 'none');
  await ctx.close();
}

// 2. No WebGL: the fallback offers the 2D game.
{
  const nogl = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--disable-webgl', '--disable-3d-apis'] });
  const page = await nogl.newPage();
  await page.goto(base);
  await page.waitForSelector('text=Play the 2D game', { timeout: 15000 });
  const href = await page.getByRole('link', { name: 'Play the 2D game' }).getAttribute('href');
  const res = await page.request.get(new URL(href, base).href);
  console.log('no-WebGL fallback: link', href, 'status', res.status());
  await page.screenshot({ path: 'screenshots/phase6-nowebgl.png' });
  await nogl.close();
}

// 3. Phone layout of a round and 4. low quality frame rate.
for (const [name, vp, quality] of [['phone', { width: 390, height: 844 }, 'high'], ['phone-low', { width: 390, height: 844 }, 'low'], ['desktop-high', { width: 1366, height: 768 }, 'high']]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name.startsWith('phone'), hasTouch: name.startsWith('phone'), deviceScaleFactor: name.startsWith('phone') ? 2 : 1 });
  await ctx.addInitScript((q) => localStorage.setItem('earth-jukebox-3d-v1', JSON.stringify({ settings: { quality: q } })), quality);
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto(`${base}?scene=round&year=2024`);
  await page.waitForFunction('window.__round && window.__round.phase === "intro"', null, { timeout: 90000 });
  for (let k = 0; k < 8; k++) { const n = page.locator('.dialogue button').first(); if (await n.count() === 0) break; await n.click(); await page.waitForTimeout(150); }
  await page.waitForFunction('window.__round.phase === "play"');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3000);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(2500);
  const fps = await page.evaluate(() => window.__fps);
  const info = await page.evaluate(() => window.__rt.stage.renderer.info.render);
  await page.screenshot({ path: `screenshots/phase6-${name}.png` });
  console.log(name, 'fps', fps, 'draw calls', info.calls, 'triangles', info.triangles, 'errors', errors.length ? errors : 'none');
  await ctx.close();
}
await browser.close();
