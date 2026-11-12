// Data -> music mapping, the live conductor for rounds, the heat beacon, Echo's scan,
// and the composer for the Earth Record and the globe time-lapse.
import { sitar, flute, tabla, tanpuraCycle, click, windLayer } from './instruments.js';
import { SA, freq, scaleFor, snap, degree } from './scales.js';

// ---------------- Mapping layer (one place, so the Sound Lab and the guide can show it) ----------------
export const MAP = {
  // Land surface temperature (deg C) -> 0..1 melody height. 26 C low, 37 C high.
  heat01: (c) => (c == null ? null : Math.max(0, Math.min(1, (c - 26) / 11))),
  // Year -> base tempo (beats per minute). Slightly faster toward 2050.
  tempo: (year) => 76 + Math.max(0, Math.min(50, year - 2000)) * 0.36,
  // Rain (mm/day) -> drum density: 0 silent (drought), 1 sparse, 2 full theka, 3 double time.
  drumLevel: (rain) => (rain == null ? -1 : rain < 0.8 ? 0 : rain < 3 ? 1 : rain < 7 ? 2 : 3),
  // NDVI -> flute presence 0..1 (bare ground 0.15 -> 0, lush 0.6 -> 1).
  flute: (ndvi) => (ndvi == null ? 0 : Math.max(0, Math.min(1, (ndvi - 0.15) / 0.45))),
  // NDVI -> drone fifth detune in cents (green = in tune, bare = beating, out of tune).
  droneDetune: (ndvi) => (ndvi == null ? 0 : Math.max(0, Math.min(28, (0.55 - ndvi) * 70))),
};

export function describeMusic({ heatC, tension, rain, ndvi, year }) {
  const sc = scaleFor(tension, rain);
  const parts = [];
  if (heatC != null) parts.push(`Melody ${heatC > 33 ? 'high' : heatC > 30 ? 'in the middle' : 'low'} for ${heatC.toFixed(1)} °C`);
  parts.push(sc.key === 'marwa' ? 'tense Marwa-like notes (lots of hot districts)' : sc.key === 'blend' ? 'some tense notes creeping in' : sc.key === 'megh' ? 'Megh Malhar rain scale' : 'calm Bhupali scale');
  const d = MAP.drumLevel(rain);
  parts.push(d < 0 ? 'drum resting: rain data missing' : d === 0 ? 'no drum: almost no rain' : d === 1 ? 'slow, sparse tabla: a little rain' : d === 2 ? 'steady tabla: some rain' : 'fast tabla: heavy rain');
  const fl = MAP.flute(ndvi);
  parts.push(fl < 0.2 ? 'flute almost silent: little green' : fl < 0.6 ? 'flute now and then: some green' : 'flute often: plenty of green');
  if (MAP.droneDetune(ndvi) > 10) parts.push('drone slightly out of tune');
  if (year) parts.push(`tempo ${Math.round(MAP.tempo(year))} beats a minute`);
  return parts.join('; ') + '.';
}

const KEHERWA = ['dha', 'ge', 'na', 'ti', 'na', 'ka', 'dha', 'na'];

// ---------------- Live conductor ----------------
export class Conductor {
  constructor(engine) {
    this.e = engine;
    this.params = { tempo: 80, tension: 0, rain: 3, ndvi: 0.45, outOfTune: 0, droneGain: 1, melody: true, heatC: 30 };
    this.beacons = new Set();
    this.running = false;
    this.player = { x: 0, z: 0 };
    this.onCue = null; // (text) => void
    window.__lastConductor = this; // test hook
  }

  set(p) { Object.assign(this.params, p); }

  start() {
    if (!this.e.ready || this.running) return;
    this.running = true;
    const t = this.e.now + 0.1;
    this.nextDrone = t; this.nextBeat = t; this.beat = 0; this.nextFlute = t + 2;
    this.wind = windLayer(this.e.ctx, this.e.bus.fx, { gain: 0.025 });
    this.timer = setInterval(() => this.tick(), 40);
    this.tick();
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    this.wind?.stop();
    for (const b of this.beacons) b.voice.dispose();
    this.beacons.clear();
    this.fluteVoice?.dispose(); this.fluteVoice = null;
  }

  setFluteSource(x, z) {
    if (!this.e.ready) return;
    if (!this.fluteVoice) this.fluteVoice = this.e.voice({ x, y: 3, z, ref: 14, rolloff: 0.8, bus: 'music' });
    else this.fluteVoice.set(x, 3, z);
  }

  // A rising sitar line from a hot spot. lst in deg C; strength scales loudness.
  addBeacon({ x, z, lst, id = 'hot', strength = 1, octave = 0 }) {
    if (!this.e.ready) return null;
    const voice = this.e.voice({ x, y: 2.2, z, ref: 7, rolloff: 1.25 });
    const b = { id, x, z, lst, strength, octave, voice, next: this.e.now + 0.3, found: false };
    this.beacons.add(b);
    return b;
  }

  removeBeacon(b) { if (!b) return; b.voice.dispose(); this.beacons.delete(b); }
  clearBeacons() { for (const b of this.beacons) b.voice.dispose(); this.beacons.clear(); }

  proximity(b) {
    const d = Math.hypot(b.x - this.player.x, b.z - this.player.z);
    return { d, p: Math.max(0, Math.min(1, 1 - d / 90)) };
  }

  tick() {
    const ctx = this.e.ctx, now = this.e.now, ahead = now + 0.15, P = this.params;
    const spb = 60 / P.tempo;
    const sc = scaleFor(P.tension, P.rain);
    // Drone: one tanpura cycle every 4 beats.
    while (this.nextDrone < ahead) {
      const det = MAP.droneDetune(P.ndvi) + P.outOfTune * 35;
      tanpuraCycle(ctx, this.e.bus.music, this.nextDrone, { sa: SA, fifth: sc.key === 'megh' ? 5 : 7, detune: det, cycle: spb * 4, gain: 0.1 * P.droneGain });
      this.nextDrone += spb * 4;
    }
    // Tabla, from rain.
    while (this.nextBeat < ahead) {
      const lvl = MAP.drumLevel(P.rain);
      const sub = lvl === 3 ? 2 : 1;
      for (let s = 0; s < sub; s++) {
        const t = this.nextBeat + (s * spb) / sub;
        const i = (this.beat * sub + s) % 8;
        const play = lvl === 1 ? i % 4 === 0 : lvl >= 2;
        if (play) tabla(ctx, this.e.bus.music, t, { stroke: KEHERWA[i], gain: (i === 0 ? 0.42 : 0.28) * (lvl === 3 ? 0.8 : 1) });
      }
      if (lvl < 0 && this.beat % 8 === 0) click(ctx, this.e.bus.music, this.nextBeat); // missing data
      this.beat++;
      this.nextBeat += spb;
    }
    // Flute phrases from green areas.
    if (this.nextFlute < ahead) {
      const pres = MAP.flute(P.ndvi);
      if (Math.random() < pres * 0.9) {
        const dest = this.fluteVoice ? this.fluteVoice.input : this.e.bus.music;
        const calm = [0, 2, 4, 7, 9];
        let deg = 5 + Math.floor(Math.random() * 3);
        let t = this.nextFlute;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) {
          const dur = spb * (k === n - 1 ? 2 : 1);
          flute(ctx, dest, t, { f: freq(degree(deg, calm, 12)), dur, gain: 0.11 * (0.5 + pres * 0.5) });
          deg += Math.random() < 0.6 ? -1 : 1;
          t += dur;
        }
      }
      this.nextFlute += spb * 8;
    }
    // Heat beacons: louder, higher and faster as the player comes close.
    for (const b of this.beacons) {
      if (b.next > ahead) continue;
      const { p } = this.proximity(b);
      const h = MAP.heat01(b.lst) ?? 0.5;
      const start = Math.round(h * 4) + Math.round(p * 4);
      const gap = 0.32 - p * 0.18;
      const notes = 4;
      const steps = scaleFor(Math.max(P.tension, 0.5), 0).steps;
      for (let k = 0; k < notes; k++) {
        const f = freq(degree(start + k, steps, 12 + 12 * b.octave));
        const last = k === notes - 1;
        sitar(ctx, b.voice.input, b.next + k * gap, {
          f, gain: (0.55 + p * 0.45) * b.strength, bright: 0.5 + p * 0.4,
          bendTo: last ? f * 2 ** (1 / 12) : null, dur: last ? 1.4 : 0.8,
        });
        if (this.onBeaconNote) { const at = b.next + k * gap; setTimeout(() => this.onBeaconNote?.(b, f, p), Math.max(0, (at - this.e.now) * 1000)); }
      }
      b.next += notes * gap + (2.4 - p * 1.6);
    }
  }
}

// ---------------- Echo's scan: notes sweep around the player ----------------
// samples: [{ angle (rad, 0 = ahead, + = right), heat01, x, z }]
export function playScan(engine, samples, listenerPos) {
  if (!engine.ready) return;
  const ctx = engine.ctx;
  const t0 = engine.now + 0.05;
  const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  samples.forEach((s, i) => {
    const v = engine.voice({ x: s.x, y: listenerPos.y + 1.6, z: s.z, ref: 3, rolloff: 0.2 });
    const t = t0 + i * 0.22;
    if (s.heat01 == null) click(ctx, v.input, t);
    else sitar(ctx, v.input, t, { f: freq(snap(s.heat01, steps, 1, 12)), gain: 0.5, bright: 0.3 + s.heat01 * 0.6, dur: 0.7 });
    setTimeout(() => v.dispose(), (t - engine.now + 1.2) * 1000);
  });
}

// ---------------- Short practice clips for Quick Ears and the audio legend ----------------
export function playClip(engine, kind, dest = null) {
  if (!engine.ready) return 0;
  const ctx = engine.ctx, out = dest || engine.bus.music, t = engine.now + 0.05;
  if (kind === 'heat') {
    const steps = [0, 1, 4, 6, 9, 11];
    for (let k = 0; k < 6; k++) sitar(ctx, out, t + k * 0.24, { f: freq(degree(5 + k, steps, 12)), gain: 0.5, bright: 0.85, dur: 0.9 });
    tanpuraCycle(ctx, out, t, { sa: SA, detune: 25, cycle: 3, gain: 0.08 });
    return 3;
  }
  if (kind === 'rain') {
    for (let i = 0; i < 16; i++) tabla(ctx, out, t + i * 0.19, { stroke: KEHERWA[i % 8], gain: 0.4 });
    tanpuraCycle(ctx, out, t, { sa: SA, fifth: 5, cycle: 3, gain: 0.06 });
    return 3.2;
  }
  if (kind === 'green') {
    const calm = [0, 2, 4, 7, 9];
    [7, 6, 5, 6, 4].forEach((d, k) => flute(ctx, out, t + k * 0.55, { f: freq(degree(d, calm, 12)), dur: k === 4 ? 1.2 : 0.55, gain: 0.16 }));
    tanpuraCycle(ctx, out, t, { sa: SA, cycle: 3, gain: 0.07 });
    return 3.2;
  }
  if (kind === 'cool-ref') {
    flute(ctx, out, t, { f: freq(0, SA * 2), dur: 1.4, gain: 0.18 });
    return 1.5;
  }
  if (kind === 'hot-ref') {
    sitar(ctx, out, t, { f: freq(23, SA), gain: 0.55, bright: 0.9, bendTo: freq(24, SA), dur: 1.4 });
    return 1.5;
  }
  if (kind === 'missing') { click(ctx, out, t); click(ctx, out, t + 0.5); return 0.8; }
  return 0;
}

// ---------------- Composer: Earth Record (six rounds as one piece) ----------------
// rounds: [{ year, rowLst: [5 values], meanLst, ndvi, rain, tension, protectedPct }]
// Schedules everything from t0 on any context; returns the total duration in seconds.
export const SEGMENT = 9.6;
export function composeRecord(ctx, bus, t0, rounds) {
  let t = t0;
  rounds.forEach((r, ri) => {
    const tempo = MAP.tempo(r.year);
    const spb = 60 / tempo;
    const seg = SEGMENT;
    const sc = scaleFor(r.tension, r.rain);
    const lost = r.protectedPct < 50;
    const detune = MAP.droneDetune(r.ndvi) + (lost ? 30 : 0);
    for (let c = 0; c * spb * 4 < seg; c++) tanpuraCycle(ctx, bus.music, t + c * spb * 4, { sa: SA, fifth: sc.key === 'megh' ? 5 : 7, detune, cycle: spb * 4, gain: 0.09 });
    // Melody: the five rows of the district grid, north to south, then the city mean, then a resolution.
    const values = [...r.rowLst, r.meanLst];
    let mt = t + spb * 0.5;
    values.forEach((v, i) => {
      const h = MAP.heat01(v);
      if (h == null) { click(ctx, bus.music, mt); mt += spb; return; } // missing value: rest + click
      const st = snap(h, sc.steps, 2, 12);
      sitar(ctx, bus.music, mt, { f: freq(st) * (lost ? 2 ** ((Math.random() - 0.5) * 0.04) : 1), gain: 0.42, bright: 0.4 + h * 0.5, dur: 1.3 });
      mt += spb * (i % 2 ? 0.5 : 1);
    });
    // Ending note: home (Sa) if most of the city was protected, the tense flat second if not.
    sitar(ctx, bus.music, mt + spb * 0.5, { f: freq(lost ? 13 : 12), gain: 0.45, bright: 0.5, dur: 2.2, bendTo: lost ? null : freq(12) });
    // Tabla from rain.
    const lvl = MAP.drumLevel(r.rain);
    for (let b = 0; b * spb < seg - spb; b++) {
      const sub = lvl === 3 ? 2 : 1;
      for (let s = 0; s < sub; s++) {
        const i = (b * sub + s) % 8;
        if (lvl === 1 ? i % 4 === 0 : lvl >= 2) tabla(ctx, bus.music, t + b * spb + (s * spb) / sub, { stroke: KEHERWA[i], gain: 0.26 });
      }
    }
    // Flute counter-line from green.
    const pres = MAP.flute(r.ndvi);
    const calm = [0, 2, 4, 7, 9];
    const fn = Math.round(pres * 5);
    for (let k = 0; k < fn; k++) flute(ctx, bus.music, t + seg * 0.35 + k * spb, { f: freq(degree(7 - k, calm, 12)), dur: spb * 0.95, gain: 0.1 });
    t += seg;
    if (ri < rounds.length - 1) click(ctx, bus.fx, t - 0.05, { gain: 0.05 });
  });
  return t - t0 + 2.5;
}

// ---------------- Globe time-lapse melody from GISTEMP ----------------
// years: [{ year, anomaly|null }], one note each; returns duration.
export function composeGlobe(ctx, bus, t0, years, noteDur = 0.16) {
  const calm = [0, 2, 4, 7, 9];
  let t = t0;
  years.forEach(({ anomaly }, i) => {
    if (anomaly == null) { click(ctx, bus.music, t); t += noteDur; return; }
    const v = Math.max(0, Math.min(1, (anomaly + 0.6) / 1.9)); // -0.6 .. +1.3 C
    const tension = Math.max(0, Math.min(1, (anomaly - 0.2) / 0.8));
    const steps = scaleFor(tension, 0).steps;
    sitar(ctx, bus.music, t, { f: freq(snap(v, steps, 3, 0)), gain: 0.32, bright: 0.3 + v * 0.6, dur: 0.9 });
    if (i % 16 === 0) tanpuraCycle(ctx, bus.music, t, { sa: SA, cycle: noteDur * 16, gain: 0.07, detune: tension * 20 });
    t += noteDur;
  });
  return t - t0 + 1.5;
}
