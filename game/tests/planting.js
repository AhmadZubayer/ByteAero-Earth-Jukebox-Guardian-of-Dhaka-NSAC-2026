import { launch, collectErrors } from './browser.js';
// Every way to plant a tree (E, the Place button, clicking the ground) in all six years and the tutorial.
// Run against a dev server: bun tests/planting.js http://localhost:5173/
const base = process.argv[2] || 'http://localhost:5173/';
const b = await launch();
const rows = [];
for (const year of [2000, 2010, 2020, 2024, 2035, 2050]) {
  const p = await b.newPage({ viewport: { width: 1400, height: 880 } }); const errors = collectErrors(p);
  await p.goto(`${base}?scene=round&year=${year}&energy=clean&land=parks`);
  await p.waitForFunction('window.__round && window.__round.phase === "intro"', null, { timeout: 90000 });
  for (let k = 0; k < 8; k++) { const n = p.locator('.dialogue button').first(); if (await n.count() === 0) break; await n.click(); await p.waitForTimeout(150); }
  await p.waitForFunction('window.__round.phase === "play"');
  // Walk into the city with the keyboard.
  await p.keyboard.down('KeyW'); await p.keyboard.down('ShiftLeft'); await p.waitForTimeout(1700); await p.keyboard.up('ShiftLeft'); await p.keyboard.up('KeyW');
  await p.waitForTimeout(300);
  // 1) Tree button -> picker -> Mango, then go to the green circle the arrow points at, then E.
  await p.getByRole('button', { name: /Tree/ }).first().click();
  await p.getByRole('button', { name: /Mango tree/ }).click();
  const toSpot = async () => p.evaluate(async () => { const r = window.__round; const d = r.city.districts[window.__rt.player.pos ? (await import('/src/world/city.js')).districtAt(window.__rt.player.pos.x, window.__rt.player.pos.z) : 0]; const q = d?.treePlots.find((t) => !t.used) || r.city.districts.flatMap((x) => x.treePlots).find((t) => !t.used); window.__rt.player.pos.set(q.x + 0.6, 0, q.z + 0.6); await new Promise((res) => setTimeout(res, 300)); });
  await toSpot();
  const n0 = await p.evaluate(() => window.__round.fixes.length);
  const aim = await p.evaluate(() => window.__rt.frontPoint(1.6));
  await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
  const viaE = await p.evaluate(() => window.__round.fixes.length);
  const lastTree = await p.evaluate(() => { const d = window.__round.city.districts[window.__round.fixes.at(-1)?.district]; return d ? d.treePlots.filter((q) => q.used === 'planted').length : 0; });
  // 2) The Place button, at the next green circle.
  await toSpot();
  await p.getByRole('button', { name: /Plant Mango tree/ }).click(); await p.waitForTimeout(400);
  const viaButton = await p.evaluate(() => window.__round.fixes.length);
  // 3) Click on a green circle you can see (turn the camera toward it first, like a player).
  await p.evaluate(async () => {
    const { districtAt } = await import('/src/world/city.js');
    const rt = window.__rt, pp = rt.player.pos, d = window.__round.city.districts[districtAt(pp.x, pp.z)];
    const q = d.treePlots.filter((t) => !t.used).sort((a, b) => Math.hypot(a.x - pp.x, a.z - pp.z) - Math.hypot(b.x - pp.x, b.z - pp.z))[0];
    const L = Math.hypot(q.x - pp.x, q.z - pp.z) || 1;
    if (L > 6) pp.set(q.x - (q.x - pp.x) / L * 6, 0, q.z - (q.z - pp.z) / L * 6); // walk up to about 6 m away
    rt.follow.yaw = Math.atan2(q.x - pp.x, q.z - pp.z) + Math.PI; rt.follow.pitch = 0.6;
  });
  await p.waitForTimeout(700);
  const scr = await p.evaluate(async () => {
    const rt = window.__rt; const { Vector3 } = await import('/node_modules/.vite/deps/three.js');
    const { districtAt } = await import('/src/world/city.js');
    const pp = rt.player.pos; const d = window.__round.city.districts[districtAt(pp.x, pp.z)];
    const q = d.treePlots.filter((t) => !t.used).sort((a, b) => Math.hypot(a.x - pp.x, a.z - pp.z) - Math.hypot(b.x - pp.x, b.z - pp.z))[0];
    const v = new Vector3(q.x, 0.16, q.z).project(rt.stage.camera);
    const r = rt.stage.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, z: v.z, q: [q.x, q.z], p: [pp.x, pp.z] };
  });
  if (process.env.DEBUG) console.log(year, 'click target', JSON.stringify(scr));
  await p.mouse.click(scr.x, scr.y); await p.waitForTimeout(400);
  const viaClick = await p.evaluate(() => window.__round.fixes.length);
  const say = await p.evaluate(() => [...document.querySelectorAll('#live-polite p')].map((x) => x.textContent).filter((t) => /placed|room|Walk|far/.test(t)).slice(-3));
  rows.push({ year, E: viaE > n0, button: viaButton > viaE, click: viaClick > viaButton, total: viaClick - n0, said: say, errors: errors.length });
  await p.close();
}
console.log(JSON.stringify(rows, null, 1));
// Tutorial: E in the circle, and a click in the circle.
for (const how of ['E', 'click']) {
  const p = await b.newPage({ viewport: { width: 1400, height: 880 } }); const errors = collectErrors(p);
  await p.goto(`${base}?scene=tutorial`);
  await p.waitForSelector('text=Walk to the yellow circle', { timeout: 60000 });
  await p.evaluate(() => window.__rt.player.pos.set(0, 0, 14));
  await p.waitForSelector('text=Walk toward it');
  await p.evaluate(() => { const bb = [...window.__lastConductor.beacons][0]; window.__rt.player.pos.set(bb.x, 0, bb.z + 1); });
  await p.waitForSelector('text=ask Echo to scan'); await p.keyboard.press('KeyQ');
  await p.waitForSelector('text=Choose a tree, then plant', { timeout: 10000 });
  await p.getByRole('button', { name: 'Choose a tree' }).click(); await p.getByRole('button', { name: /Neem tree/ }).click();
  if (how === 'E') { await p.evaluate(() => { const g = window.__tutTarget.group.position; window.__rt.player.pos.set(g.x, 0, g.z); }); await p.keyboard.press('KeyE'); }
  else {
    const scr = await p.evaluate(async () => { const rt = window.__rt; const { Vector3 } = await import('/node_modules/.vite/deps/three.js'); const g = window.__tutTarget.group.position; const v = new Vector3(g.x, 0.16, g.z).project(rt.stage.camera); const r = rt.stage.renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, vis: v.z < 1 }; });
    await p.mouse.click(scr.x, scr.y);
  }
  const ok = await p.waitForSelector('text=Start the game', { timeout: 8000 }).then(() => true).catch(() => false);
  console.log('tutorial via', how, ok ? 'planted' : 'NOT planted', 'errors', errors.length);
  await p.close();
}
await b.close();
