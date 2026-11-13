// Phase 5 check: globe time-lapse plays with sound, flies to Dhaka; Earth Record plays and
// renders a WAV; ticket shows.
import { launch, collectErrors } from './browser.js';
const base = process.argv[2] || 'http://localhost:5199/';
const browser = await launch();
for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: name === 'phone', hasTouch: name === 'phone', acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto(`${base}?scene=globe`);
  await page.waitForFunction('window.__phase === "globe"', null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Play the time-lapse' }).click();
  await page.waitForTimeout(9000);
  const g = await page.evaluate(() => ({ year: document.querySelector('.globe-readout .big').textContent, rms: window.__audio.levels() }));
  await page.screenshot({ path: `screenshots/phase5-globe-${name}.png` });
  await page.getByRole('button', { name: 'Fly to Dhaka' }).click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `screenshots/phase5-flyin-${name}.png` });
  await page.waitForFunction('window.__phase === "globe-done"', null, { timeout: 20000 });
  console.log(name, 'globe at 9 s shows year', g.year, 'output rms', g.rms);
  // Earth Record
  await page.goto(`${base}?scene=record`);
  await page.waitForFunction('window.__phase === "record"', null, { timeout: 60000 });
  await page.getByRole('button', { name: 'Play the Earth Record' }).click();
  await page.waitForTimeout(4000);
  const rec = await page.evaluate(() => ({ rms: window.__audio.levels(), now: document.querySelector('.note[aria-live]').textContent.slice(0, 140) }));
  await page.screenshot({ path: `screenshots/phase5-record-${name}.png` });
  await page.getByRole('button', { name: 'Stop' }).click();
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: 'Download as WAV' }).click()]);
  const path = await download.path();
  const { statSync } = await import('node:fs');
  console.log(name, 'record rms', rec.rms, '|', rec.now);
  console.log(name, 'WAV', download.suggestedFilename(), (statSync(path).size / 1e6).toFixed(2), 'MB');
  await page.getByRole('button', { name: 'Get my ticket' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `screenshots/phase5-ticket-${name}.png`, fullPage: true });
  console.log(name, 'errors:', errors.length ? errors : 'none');
  await ctx.close();
}
await browser.close();
