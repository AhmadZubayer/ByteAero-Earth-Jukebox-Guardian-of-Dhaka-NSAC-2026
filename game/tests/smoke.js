// Smoke test for the built game (bun run build first, then bun run test).
// Serves dist/ with `vite preview`, then: title loads, no console errors, the real start flow
// reaches Dhaka, the player moves, and the 2000 round completes with a report.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { launch, collectErrors } from './browser.js';

const root = resolve(import.meta.dir, '..');
if (!existsSync(resolve(root, 'dist/index.html'))) { console.error('Run `bun run build` first.'); process.exit(1); }
const port = 5299;
const server = spawn(resolve(root, 'node_modules/.bin/vite'), ['preview', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
const base = `http://localhost:${port}/`;
for (let i = 0; i < 50; i++) { try { await fetch(base); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }

const fails = [];
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails.push(what); };
const browser = await launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto(base);
  await page.waitForSelector('#title-h', { timeout: 30000 });
  check(true, 'title screen loads');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByLabel('Your name for the ticket').fill('Smoke Test');
  await page.getByRole('button', { name: 'Help Echo' }).click();
  await page.waitForFunction('window.__phase === "globe"', null, { timeout: 60000 });
  check(true, 'globe intro opens');
  await page.getByRole('button', { name: 'Fly to Dhaka' }).click();
  await page.waitForFunction('window.__phase === "tutorial"', null, { timeout: 60000 });
  check(true, 'tutorial opens after the globe');
  // Tutorial step 1: walk with the keyboard toward the circle.
  await page.waitForSelector('text=Walk to the yellow circle', { timeout: 15000 });
  const before = await page.evaluate(() => window.__rt.player.pos.toArray());
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => window.__rt.player.pos.toArray());
  check(Math.hypot(after[0] - before[0], after[2] - before[2]) > 2, `player moves with the keyboard (${Math.hypot(after[0] - before[0], after[2] - before[2]).toFixed(1)} m)`);
  await page.evaluate(() => window.__rt.player.pos.set(0, 0, 14));
  await page.waitForSelector('text=Walk toward it', { timeout: 10000 });
  check(true, 'tutorial step 2: follow the heat sound');
  await page.evaluate(() => { const b = [...window.__lastConductor.beacons][0]; window.__rt.player.pos.set(b.x, 0, b.z + 1); });
  await page.waitForSelector('text=ask Echo to scan', { timeout: 10000 });
  await page.keyboard.press('KeyQ');
  await page.waitForSelector('text=Choose a tree, then plant', { timeout: 10000 });
  check(true, 'tutorial step 3: scan with Q');
  await page.evaluate(() => { const g = window.__tutTarget.group.position; window.__rt.player.pos.set(g.x, 0, g.z); });
  await page.waitForTimeout(300);
  await page.keyboard.press('Digit1');
  await page.waitForSelector('#tree-h', { timeout: 5000 });
  check(true, 'pressing 1 opens the tree picker');
  await page.keyboard.press('Digit2'); // coconut palm
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: 'Start the game' }).click({ timeout: 10000 });
  check(true, 'tutorial step 4: choose a tree, plant it, then start the game');
  await page.waitForFunction('window.__round && window.__round.phase === "intro"', null, { timeout: 90000 });
  for (let k = 0; k < 8; k++) { const n = page.locator('.dialogue button').first(); if (await n.count() === 0) break; await n.click(); await page.waitForTimeout(150); }
  await page.waitForFunction('window.__round.phase === "play"', null, { timeout: 20000 });
  check(true, '2000 round starts');
  // Plant a tree with the keyboard next to a free plot, then bring the wave with F.
  await page.evaluate(() => { const r = window.__round; const d = r.city.districts[r.spots[0]]; const p = d.treePlots.find((q) => !q.used); window.__rt.player.pos.set(p.x + 0.8, 0, p.z + 0.8); });
  await page.waitForTimeout(300);
  await page.keyboard.press('Digit1');
  await page.waitForSelector('#tree-h', { timeout: 5000 });
  await page.keyboard.press('Digit1'); // mango
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => window.__round.fixes.length) === 1, 'a mango tree is planted with 1, 1, E');
  await page.keyboard.press('KeyF');
  await page.waitForSelector('#rep-h', { timeout: 30000 });
  check(true, `round completes: ${await page.locator('#rep-h').textContent()}`);
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
} catch (e) {
  check(false, `unexpected: ${e.message.split('\n')[0]}`);
} finally {
  await browser.close();
  server.kill();
}
console.log(fails.length ? `${fails.length} check(s) failed` : 'ALL CHECKS PASSED');
process.exit(fails.length ? 1 : 0);
