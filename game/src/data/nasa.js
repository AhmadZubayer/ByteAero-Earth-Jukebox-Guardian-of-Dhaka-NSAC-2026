// Bundled NASA data (public/nasa/game-data.json, built by scripts/build-data.js).
const base = import.meta.env.BASE_URL || './';
let data = null;

export async function loadData() {
  if (!data) data = await (await fetch(`${base}nasa/game-data.json`)).json();
  return data;
}
export function getData() { return data; }
export const nasaUrl = (f) => `${base}nasa/${f}`;

export const REAL_YEARS = [2000, 2010, 2020, 2024];

export function districtsFor(year) {
  return data.districts[year] || null;
}

export function cityStats(cells) {
  const l = cells.map((c) => c.lst).filter((v) => v != null);
  const n = cells.map((c) => c.ndvi).filter((v) => v != null);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const rows = [];
  for (let r = 0; r < 5; r++) {
    const row = cells.slice(r * 5, r * 5 + 5).map((c) => c.lst).filter((v) => v != null);
    rows.push(row.length ? mean(row) : null);
  }
  return { meanLst: mean(l), maxLst: Math.max(...l), minLst: Math.min(...l), meanNdvi: mean(n), rowLst: rows };
}

// Indices of the n hottest districts by land surface temperature.
export function hottest(cells, n = 1) {
  return cells.map((c, i) => [c.lst ?? -99, i]).sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]);
}

export function power(year) { return data.power[year] || null; }

export function gistempSeries(from = 1884, to = 2022) {
  const out = [];
  for (let y = from; y <= to; y++) out.push({ year: y, anomaly: data.gistemp[y] ?? null });
  return out;
}
