// Turns the bundled NASA files into one small JSON file the game reads at runtime.
//
//  - MODIS LST and NDVI PNGs (rendered by NASA GIBS) are decoded back to numbers using the
//    official GIBS colour maps (scripts/colormaps/*.json, copied from the URLs stored inside them).
//  - The decoded rasters are averaged over a 5 x 5 grid of game districts around central Dhaka.
//  - NASA POWER (April values) and GISTEMP (annual global anomaly) are copied as compact arrays.
//
// Run: bun scripts/build-data.js     Output: public/nasa/game-data.json
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const root = resolve(import.meta.dir, '..');
const nasa = (f) => resolve(root, 'public/nasa', f);
const YEARS = [2000, 2010, 2020, 2024];

// Image geometry (same for LST and NDVI): 1000 x 800 px, approx. 89.95–90.85 E, centred on 23.82 N.
// The game city samples a crop around the built-up core seen in the NDVI images.
const CROP = { x0: 375, y0: 290, x1: 625, y1: 590 }; // 250 x 300 px, roughly 23 km x 23 km
const COLS = 5, ROWS = 5;

function loadColormap(name) {
  const cm = JSON.parse(readFileSync(resolve(root, 'scripts/colormaps', `${name}.json`), 'utf8'));
  const exact = new Map();
  for (const [r, g, b, lo, hi, transparent] of cm.entries) {
    exact.set((r << 16) | (g << 8) | b, transparent ? null : (lo + hi) / 2);
  }
  return { cm, exact };
}

function decoder(name) {
  const { cm, exact } = loadColormap(name);
  const cache = new Map();
  return (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    if (exact.has(key)) return exact.get(key);
    if (cache.has(key)) return cache.get(key);
    // PNG resampling can shift a channel by one or two; take the nearest palette colour if close.
    let best = null, bestD = 1e9;
    for (const [er, eg, eb, lo, hi, t] of cm.entries) {
      const d = (er - r) ** 2 + (eg - g) ** 2 + (eb - b) ** 2;
      if (d < bestD) { bestD = d; best = t ? null : (lo + hi) / 2; }
    }
    const v = bestD <= 12 ? best : null;
    cache.set(key, v);
    return v;
  };
}

function gridStats(file, decode, toValue) {
  const png = PNG.sync.read(readFileSync(nasa(file)));
  const cw = (CROP.x1 - CROP.x0) / COLS, ch = (CROP.y1 - CROP.y0) / ROWS;
  const cells = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      let sum = 0, n = 0, max = -Infinity, min = Infinity, missing = 0;
      for (let y = Math.round(CROP.y0 + row * ch); y < Math.round(CROP.y0 + (row + 1) * ch); y++) {
        for (let x = Math.round(CROP.x0 + col * cw); x < Math.round(CROP.x0 + (col + 1) * cw); x++) {
          const i = (y * png.width + x) * 4;
          if (png.data[i + 3] < 128) { missing++; continue; }
          const raw = decode(png.data[i], png.data[i + 1], png.data[i + 2]);
          if (raw == null) { missing++; continue; }
          const v = toValue(raw);
          sum += v; n++; if (v > max) max = v; if (v < min) min = v;
        }
      }
      const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
      cells.push({ mean: n ? r2(sum / n) : null, max: r2(max), min: r2(min), missing: r2(missing / (missing + n)) });
    }
  }
  return cells;
}

const lstDecode = decoder('lst');
const ndviDecode = decoder('ndvi');
const districts = {};
for (const y of YEARS) {
  const lst = gridStats(`nasa-modis-dhaka-lst-${y}.png`, lstDecode, (k) => k - 273.15);
  const ndvi = gridStats(`nasa-modis-dhaka-ndvi-${y}.png`, ndviDecode, (v) => v);
  districts[y] = lst.map((l, i) => ({
    lst: l.mean, lstMax: l.max, ndvi: ndvi[i].mean, ndviMin: ndvi[i].min,
    missing: Math.max(l.missing, ndvi[i].missing),
  }));
}

// NASA POWER, Dhaka point (23.81 N, 90.41 E). Fill value -999 becomes null.
const power = JSON.parse(readFileSync(nasa('power-dhaka-monthly.json'), 'utf8'));
const P = power.properties.parameter;
const fill = power.header.fill_value;
const pv = (k, key) => (P[k][key] == null || P[k][key] === fill ? null : P[k][key]);
const powerOut = {};
for (let y = 2000; y <= 2024; y++) {
  powerOut[y] = {
    aprT2M: pv('T2M', `${y}04`), aprT2MMax: pv('T2M_MAX', `${y}04`), aprRain: pv('PRECTOTCORR', `${y}04`),
    yearT2M: pv('T2M', `${y}13`), yearRain: pv('PRECTOTCORR', `${y}13`),
    monthlyRain: Array.from({ length: 12 }, (_, m) => pv('PRECTOTCORR', `${y}${String(m + 1).padStart(2, '0')}`)),
  };
}

// GISTEMP v4 global land-ocean anomaly (deg C vs 1951–1980), annual J-D column. "***" = missing.
const csv = readFileSync(nasa('gistemp-global.csv'), 'utf8').trim().split('\n').slice(2);
const gistemp = {};
for (const line of csv) {
  const c = line.split(',');
  const year = +c[0];
  if (!year) continue;
  gistemp[year] = c[13] === '***' ? null : +c[13];
}

const out = {
  generated: 'scripts/build-data.js',
  notes: {
    lst: 'MODIS Terra 8-day daytime land surface temperature around 15 April, decoded from the GIBS colour map. Degrees C. Land surface, not air temperature.',
    ndvi: 'MODIS monthly NDVI for April, decoded from the GIBS colour map. 0 = bare or built-up, 1 = dense green.',
    grid: `5 x 5 game districts over image pixels x ${CROP.x0}-${CROP.x1}, y ${CROP.y0}-${CROP.y1} (north at top). Street layout is invented.`,
    power: 'NASA POWER monthly point data for Dhaka: T2M and T2M_MAX in deg C, PRECTOTCORR in mm/day.',
    gistemp: 'NASA GISTEMP v4 global annual mean anomaly, deg C relative to 1951-1980.',
  },
  grid: { cols: COLS, rows: ROWS, crop: CROP },
  districts, power: powerOut, gistemp,
};
writeFileSync(nasa('game-data.json'), JSON.stringify(out));
for (const y of YEARS) {
  const d = districts[y];
  const l = d.map((c) => c.lst).filter((v) => v != null);
  console.log(y, 'LST', Math.min(...l).toFixed(1), '-', Math.max(...l).toFixed(1), 'mean', (l.reduce((a, b) => a + b, 0) / l.length).toFixed(2),
    'NDVI mean', (d.reduce((a, c) => a + (c.ndvi ?? 0), 0) / d.length).toFixed(3));
  console.log('   ', d.map((c) => c.lst?.toFixed(1)).join(' '));
  console.log('   ', d.map((c) => c.ndvi?.toFixed(2)).join(' '));
}
