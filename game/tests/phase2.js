// Phase 2 check: music engine plays; the hidden beacon's direction and distance are audible
// (stereo balance and loudness measured at the output), and an ear-only bot can find it.
import { launch, collectErrors } from './browser.js';
const base = process.argv[2] || 'http://localhost:5199/';
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = collectErrors(page);
await page.goto(base + '?scene=practice');
await page.waitForFunction('window.__phase === "lab"', null, { timeout: 60000 });
await page.getByRole('button', { name: 'Play the mix' }).click();
await page.waitForTimeout(2500);
const labLevel = await page.evaluate(() => window.__audio.levels());
console.log('Sound Lab output RMS', labLevel);
await page.locator('#lab-heat').fill('36');
await page.waitForTimeout(600);
console.log('description:', await page.locator('#lab-desc').textContent());
await page.screenshot({ path: 'screenshots/phase2-lab.png' });
await page.getByRole('button', { name: 'Next: Quick Ears' }).click();
await page.waitForFunction('window.__phase === "quickears"');
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/phase2-quickears.png' });
await page.getByRole('button', { name: 'Skip practice' }).click();
await page.waitForFunction('window.__phase === "hunt"');
await page.getByRole('button', { name: 'Start listening' }).click();
await page.waitForTimeout(500);

// Measure: average L/R energy over a few seconds with the player at a fixed spot facing down the street.
const measure = async (x, z, secs = 5) => page.evaluate(async ([x, z, secs]) => {
  const rt = window.__rt; rt.player.pos.set(x, 0, z); rt.follow.yaw = 0; // camera behind, looking toward -Z
  let l = 0, r = 0, n = 0;
  const end = performance.now() + secs * 1000;
  while (performance.now() < end) { await new Promise((res) => setTimeout(res, 50)); rt.player.pos.set(x, 0, z); const v = window.__audio.levels(); l += v.l * v.l; r += v.r * v.r; n++; }
  return { l: Math.sqrt(l / n), r: Math.sqrt(r / n) };
}, [x, z, secs]);
// Read the hidden spot from the conductor (test only).
const spot = await page.evaluate(() => { const b = [...window.__lastConductor.beacons][0]; return { x: b.x, z: b.z }; });
console.log('hidden beacon at', spot);
const leftOf = await measure(spot.x - 7, spot.z + 1);
const rightOf = await measure(spot.x + 7, spot.z + 1);
const far = await measure(0, 30);
const near = await measure(spot.x, spot.z + 4);
const db = (a, b) => (20 * Math.log10(a / b)).toFixed(1);
console.log('beacon to the right: R-L', db(leftOf.r, leftOf.l), 'dB');
console.log('beacon to the left : R-L', db(rightOf.r, rightOf.l), 'dB');
console.log('near vs far loudness', db((near.l + near.r) / 2, (far.l + far.r) / 2), 'dB');

// Ear-only bot: steer toward the louder ear, keep walking while it gets louder.
const result = await page.evaluate(async () => {
  const rt = window.__rt; rt.player.pos.set(0, 0, 30); rt.follow.yaw = 0;
  const avg = async (ms) => { let l = 0, r = 0, n = 0; const end = performance.now() + ms; while (performance.now() < end) { await new Promise((res) => setTimeout(res, 40)); const v = window.__audio.levels(); l += v.l * v.l; r += v.r * v.r; n++; } return { l: Math.sqrt(l / n), r: Math.sqrt(r / n) }; };
  const t0 = performance.now();
  let lastLoud = 0;
  for (let step = 0; step < 40 && window.__phase === 'hunt'; step++) {
    const v = await avg(2600); // one beacon phrase
    const bal = Math.log10((v.r + 1e-6) / (v.l + 1e-6));
    rt.follow.yaw -= Math.max(-0.5, Math.min(0.5, bal * 3)); // turn toward the louder ear
    const loud = v.l + v.r;
    if (loud < lastLoud * 0.8) rt.follow.yaw += Math.PI; // getting quieter: it is behind us
    lastLoud = loud;
    const yaw = rt.follow.yaw;
    for (let k = 0; k < 12; k++) { rt.player.pos.x += -Math.sin(yaw) * 0.45; rt.player.pos.z += -Math.cos(yaw) * 0.45; rt.player.pos.x = Math.max(-8, Math.min(8, rt.player.pos.x)); await new Promise((res) => setTimeout(res, 30)); }
  }
  return { found: window.__phase === 'hunt-done', secs: (performance.now() - t0) / 1000, pos: rt.player.pos.toArray() };
});
console.log('ear-only bot:', result);
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/phase2-hunt.png' });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
