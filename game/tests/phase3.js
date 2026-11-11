// Phase 3 check: 2000 and 2024 look and sound different; a tree can be planted.
import { launch, collectErrors } from './browser.js';
const base = process.argv[2] || 'http://localhost:5199/';
const browser = await launch();
const out = {};
for (const year of [2000, 2024]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto(`${base}?scene=round&year=${year}`);
  await page.waitForFunction('window.__round && window.__round.phase === "intro"', null, { timeout: 90000 });
  await page.waitForTimeout(400);
  // Click through Echo's intro lines.
  for (let k = 0; k < 8; k++) {
    const next = page.locator('.dialogue button').first();
    if (await next.count() === 0) break;
    await next.click(); await page.waitForTimeout(250);
  }
  await page.waitForFunction('window.__round.phase === "play"', null, { timeout: 20000 });
  await page.waitForTimeout(3500);
  const info = await page.evaluate(() => {
    const r = window.__round;
    const lv = window.__audio.levels();
    return { tension: +r.tension.toFixed(2), spots: r.spots, meanLst: +(r.cells.reduce((s, c) => s + c.lst, 0) / 25).toFixed(2), tempo: window.__lastConductor.params.tempo, rain: window.__lastConductor.params.rain, droneDetune: window.__lastConductor.params.ndvi, rms: +(lv.l + lv.r).toFixed(4), fps: window.__fps, bg: window.__rt.stage.scene.background.getHexString() };
  });
  // Overview shot from above.
  await page.evaluate(() => { const f = window.__rt.follow; f.pitch = 1.0; f.distance = 60; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `screenshots/phase3-${year}-overview.png` });
  await page.evaluate(() => { const f = window.__rt.follow; f.pitch = 0.38; f.distance = 7.5; });
  // Walk to a free tree plot in the first hot spot district and plant a tree.
  const planted = await page.evaluate(async () => {
    const r = window.__round, rt = window.__rt;
    const d = r.city.districts[r.spots[0]];
    const plot = d.treePlots.find((p) => !p.used);
    rt.player.pos.set(plot.x + 1.2, 0, plot.z + 1.2);
    await new Promise((res) => setTimeout(res, 400));
    const coins = r.coins;
    r.pick('tree'); r.act();
    await new Promise((res) => setTimeout(res, 1500));
    return { coinsBefore: coins, coinsAfter: r.coins, fixes: r.fixes.length, plotUsed: plot.used, found: r.found.size };
  });
  await page.screenshot({ path: `screenshots/phase3-${year}-tree.png` });
  out[year] = { ...info, planted, errors };
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
