// Heat-wave rules. Pure functions, shared by the 3D rounds, text-only mode and the tests.
//
// What is real: each district's land surface temperature (LST) and NDVI, decoded from NASA MODIS
// images. What is a game estimate: the size of the heat wave, how much each fix cools, and the
// "danger" line. These estimates are labelled in the game.

export const COLS = 5, ROWS = 5, N = COLS * ROWS;

export const FIXES = {
  tree: { key: 'tree', label: 'Tree', cost: 1, cool: 0.9, spread: 0, hotkey: 1, what: 'shade and cooler air close by' },
  roof: { key: 'roof', label: 'White roof', cost: 2, cool: 1.3, spread: 0, hotkey: 2, what: 'a roof that reflects sunlight instead of trapping heat' },
  pond: { key: 'pond', label: 'Pond', cost: 3, cool: 2.0, spread: 0.7, hotkey: 3, what: 'water that cools this block and a little of its neighbours' },
  centre: { key: 'centre', label: 'Cooling centre', cost: 4, cool: 0, spread: 0, hotkey: 4, what: 'a shaded place with water where people can rest; it protects people but does not cool the city' },
};
export const FIX_LIST = [FIXES.tree, FIXES.roof, FIXES.pond, FIXES.centre];

export const DANGER = 0.8; // degrees above the city's middle value (game estimate)

export const colRow = (i) => [i % COLS, Math.floor(i / COLS)];
export const neighbours = (i) => {
  const [c, r] = colRow(i);
  return [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]].filter(([x, y]) => x >= 0 && x < COLS && y >= 0 && y < ROWS).map(([x, y]) => y * COLS + x);
};

function median(a) {
  const s = a.filter((v) => v != null).sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

// The extra heat the wave brings to each district (game estimate).
export function waveBump(spots, strength) {
  return Array.from({ length: N }, (_, i) => {
    const [c, r] = colRow(i);
    let b = 0;
    for (const s of spots) {
      const [sc, sr] = colRow(s);
      const d2 = (c - sc) ** 2 + (r - sr) ** 2;
      b = Math.max(b, strength * Math.exp(-d2 / (2 * 1.6 ** 2))); // waves overlap, they do not add up
    }
    return b;
  });
}

// fixes: [{ type, district }]. Returns per-district outcome and the city score.
export function resolve(cells, spots, strength, fixes, { extraBase = null } = {}) {
  const base = cells.map((c, i) => (c.lst ?? null) == null ? null : c.lst + (extraBase ? extraBase[i] : 0));
  const mid = median(base);
  const bump = waveBump(spots, strength);
  const cooling = new Array(N).fill(0);
  const shelter = new Array(N).fill(false);
  for (const f of fixes) {
    const def = FIXES[f.type];
    cooling[f.district] += def.cool;
    if (def.spread) for (const n of neighbours(f.district)) cooling[n] += def.spread;
    if (f.type === 'centre') shelter[f.district] = true;
  }
  const out = base.map((b, i) => {
    const anomaly = b == null ? 0 : (b - mid) * 0.45; // districts hotter than the city middle start closer to danger
    const excess = anomaly + bump[i] - cooling[i];
    const cooled = excess <= DANGER;
    return { excess, before: anomaly + bump[i], cooling: cooling[i], cooled, sheltered: shelter[i] && !cooled, safe: cooled || shelter[i], need: Math.max(0, anomaly + bump[i] - DANGER) };
  });
  const safe = out.filter((d) => d.safe).length;
  const cooledCount = out.filter((d) => d.cooled).length;
  return { districts: out, pct: Math.round((safe / N) * 100), cooledPct: Math.round((cooledCount / N) * 100), unsafe: N - safe };
}

export function starsFor(pct) { return pct >= 90 ? 3 : pct >= 75 ? 2 : pct >= 50 ? 1 : 0; }
export const LOSE_BELOW = 50; // more than half the city unprotected repeats the round

// Greedy best play, used to check each round can be won and to tune coins (tests only).
// Objective: protected districts, then the remaining heat in unprotected ones.
function value(r) { return r.districts.reduce((s, d) => s + (d.safe ? 1 : -0.35 * Math.max(0, d.excess - DANGER)), 0); }
export function bestPlay(cells, spots, strength, coins, plots) {
  const fixes = [];
  let left = coins;
  for (let guard = 0; guard < 80 && left > 0; guard++) {
    const cur = value(resolve(cells, spots, strength, fixes));
    let best = null;
    for (const f of FIX_LIST) {
      if (f.cost > left) continue;
      for (let d = 0; d < N; d++) {
        if (!plots(d, f.key, fixes)) continue;
        const gain = (value(resolve(cells, spots, strength, [...fixes, { type: f.key, district: d }])) - cur) / f.cost;
        if (!best || gain > best.gain) best = { gain, f, d };
      }
    }
    if (!best || best.gain <= 0) break;
    fixes.push({ type: best.f.key, district: best.d });
    left -= best.f.cost;
  }
  return { fixes, result: resolve(cells, spots, strength, fixes), left };
}

// Hot spots: the hottest districts by NASA land surface temperature, kept at least two
// districts apart so each one is a separate place to find.
export function pickSpots(cells, n) {
  const order = cells.map((c, i) => [c.lst ?? -99, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  const out = [];
  for (const i of order) {
    if (out.length >= n) break;
    const [c, r] = colRow(i);
    if (out.every((j) => { const [c2, r2] = colRow(j); return Math.max(Math.abs(c - c2), Math.abs(r - r2)) >= 2; })) out.push(i);
  }
  return out;
}
