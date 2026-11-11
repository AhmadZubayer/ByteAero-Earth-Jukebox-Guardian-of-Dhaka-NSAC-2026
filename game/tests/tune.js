// Balance check for the six rounds: doing nothing should lose, good play should win.
// Run: bun tests/tune.js
import { readFileSync } from 'node:fs';
import { resolve as res } from 'node:path';
import { resolve, bestPlay, starsFor, LOSE_BELOW, pickSpots } from '../src/game/heat.js';
import { ROUNDS, layoutDistrict, plotFree, cellsFor, waveFor } from '../src/game/rounds.js';

const data = JSON.parse(readFileSync(res(import.meta.dir, '../public/nasa/game-data.json'), 'utf8'));
let ok = true;
for (const state of [{ energy: 'clean', land: 'parks' }, { energy: 'coal', land: 'concrete' }]) {
  console.log('--- future choices:', state.energy, state.land);
  for (const r of ROUNDS) {
    if (r.real && state.energy === 'coal') continue;
    const cells = cellsFor(data, r, { ...state, planted: new Array(25).fill(r.year === 2050 ? 1 : 0) });
    const spots = pickSpots(cells, r.spots);
    const W = waveFor(data, r, state);
    const layouts = cells.map(layoutDistrict);
    const none = resolve(cells, spots, W, []);
    const best = bestPlay(cells, spots, W, r.coins, (d, t, f) => plotFree(layouts, d, t, f));
    const line = `${r.year} wave ${W.toFixed(2)} coins ${r.coins}: nothing ${none.pct}% | best ${best.result.pct}% (${starsFor(best.result.pct)} stars, ${best.left} coins left) fixes ${best.fixes.map((f) => f.type[0]).join('')}`;
    console.log(line);
    if (r.real || state.energy === 'clean') {
      if (none.pct >= LOSE_BELOW + 15) { console.log('   ! doing nothing is too easy'); ok = false; }
      if (best.result.pct < 75) { console.log('   ! cannot reach two stars'); ok = false; }
    }
  }
}
console.log(ok ? 'BALANCE OK' : 'BALANCE NEEDS WORK');
