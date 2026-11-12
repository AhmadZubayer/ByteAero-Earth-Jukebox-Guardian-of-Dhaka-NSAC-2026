// Phase 4 check: play all six years with a scripted player (fixes placed by best play),
// see the reports, 2035 choices, and that doing nothing loses a round.
import { launch, collectErrors } from './browser.js';
const base = process.argv[2] || 'http://localhost:5199/';
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await page.goto(`${base}?scene=round&year=2000`);
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const clickNexts = async () => {
  for (let k = 0; k < 10; k++) {
    const next = page.locator('.dialogue button').first();
    if (await next.count() === 0) return;
    await next.click(); await page.waitForTimeout(200);
  }
};
const log = [];
let lostOnce = false;
for (let guard = 0; guard < 12; guard++) {
  const phase = await page.evaluate(() => window.__phase);
  if (phase === 'record' || phase === 'ticket') break;
  if (phase === 'choices') {
    await page.getByRole('button', { name: /Clean energy/ }).click();
    await page.getByRole('button', { name: /Parks and water/ }).click();
    await page.getByRole('button', { name: 'Build this future' }).click();
    await page.waitForTimeout(500);
    continue;
  }
  await page.waitForFunction('window.__round && (window.__round.phase === "intro" || window.__round.phase === "play")', null, { timeout: 60000 });
  await page.waitForTimeout(400);
  await clickNexts();
  await page.waitForFunction('window.__round.phase === "play"', null, { timeout: 20000 });
  const year = await page.evaluate(() => window.__round.def.year);
  // First 2000 attempt: do nothing, to check that a round can be lost.
  const doNothing = year === 2000 && !lostOnce;
  const placed = await page.evaluate(async (doNothing) => {
    const r = window.__round, rt = window.__rt;
    if (doNothing) return 0;
    const { bestPlay } = await import('/src/game/heat.js');
    const { plotFree } = await import('/src/game/rounds.js');
    const plan = bestPlay(r.cells, r.spots, r.wave, r.coins, (d, t, f) => plotFree(r.layouts, d, t, f));
    let n = 0;
    for (const f of plan.fixes) {
      const d = r.city.districts[f.district];
      let x = d.cx, z = d.cz;
      if (f.type === 'tree') { const p = d.treePlots.find((q) => !q.used); if (!p) continue; x = p.x + 0.5; z = p.z + 0.5; }
      if (f.type === 'roof') { const b = d.buildings.find((q) => !q.white); if (!b) continue; x = b.x + 4.6 * Math.sign(d.cx - b.x || 1); z = b.z; }
      if (f.type === 'pond' || f.type === 'centre') { x = d.cx + 3.2; z = d.cz; }
      rt.player.pos.set(x, 0, z);
      await new Promise((res) => setTimeout(res, 120));
      r.tree = { key: 'mango', kind: 1, name: 'Mango tree' }; r.pick(f.type); r.act(); n++;
      await new Promise((res) => setTimeout(res, 80));
    }
    return n;
  }, doNothing);
  await page.screenshot({ path: `screenshots/phase4-${year}-play.png` });
  await page.evaluate(() => window.__round.finish());
  await page.waitForFunction(`window.__phase === "report-${year}"`, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  const heading = await page.locator('#rep-h').textContent();
  await page.screenshot({ path: `screenshots/phase4-${year}-report.png`, fullPage: false });
  log.push(`${year}: placed ${placed} fixes -> ${heading}`);
  if (doNothing) { lostOnce = true; await page.getByRole('button', { name: 'Try this year again' }).click(); continue; }
  const next = page.getByRole('button', { name: /Next year|Hear the Earth Record|Continue to the Earth Record/ }).first();
  await next.click();
  await page.waitForTimeout(500);
}
console.log(log.join('\n'));
console.log('final phase:', await page.evaluate(() => window.__phase), 'saved progress round index:', await page.evaluate(() => JSON.parse(localStorage.getItem('earth-jukebox-3d-v1')).progress.roundIndex));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
