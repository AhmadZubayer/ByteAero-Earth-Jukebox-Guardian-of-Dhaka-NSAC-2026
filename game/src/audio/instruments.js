// Four synthesised instruments plus a soft click. Each takes (ctx, destination, startTime, options)
// so the same code plays live and renders offline for the WAV download.

// Live note events for the visualiser (offline renders for the WAV do not emit them).
export const noteListeners = new Set();
function emit(ctx, kind, t, f = 0, gain = 0.5) {
  if (!noteListeners.size || (typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext)) return;
  const ms = Math.max(0, (t - ctx.currentTime) * 1000);
  setTimeout(() => { for (const fn of noteListeners) fn({ kind, f, gain }); }, ms);
}

const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  if (!noiseCache.has(ctx)) {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff) - 1; }
    noiseCache.set(ctx, b);
  }
  return noiseCache.get(ctx);
}

function env(g, t, a, peak, d, sustain = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
}

// ---------- Sitar-like pluck: Karplus-Strong string, rendered to a cached buffer ----------
const ksCache = new WeakMap();
function ksBuffer(ctx, f, bright = 0.5, dur = 1.8) {
  if (!ksCache.has(ctx)) ksCache.set(ctx, new Map());
  const cache = ksCache.get(ctx);
  const key = `${Math.round(f * 10)}|${Math.round(bright * 10)}`;
  if (cache.has(key)) return cache.get(key);
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const N = Math.max(2, Math.round(sr / f));
  const line = new Float32Array(N);
  let seed = Math.round(f * 977) + 7;
  for (let i = 0; i < N; i++) { seed = (seed * 16807) % 2147483647; line[i] = (seed / 1073741823.5 - 1) * 0.9; }
  // Slightly bright, slow decay; the "jawari" bridge buzz is approximated by a soft clip
  // that adds upper partials while the string is loud.
  const decay = 0.996 + bright * 0.0025;
  let idx = 0, prev = 0, peak = 0;
  for (let i = 0; i < len; i++) {
    const cur = line[idx];
    const next = line[(idx + 1) % N];
    const avg = decay * (0.5 * cur + 0.5 * next);
    line[idx] = avg;
    const buzz = Math.tanh(cur * 2.2) * 0.55 + cur * 0.45;
    const s = buzz - prev * 0.12; // gentle high-pass tilt
    prev = buzz;
    out[i] = s;
    if (Math.abs(s) > peak) peak = Math.abs(s);
    idx = (idx + 1) % N;
  }
  const fadeStart = Math.floor(len * 0.85);
  for (let i = fadeStart; i < len; i++) out[i] *= 1 - (i - fadeStart) / (len - fadeStart);
  if (peak > 0) for (let i = 0; i < len; i++) out[i] /= peak;
  cache.set(key, buf);
  return buf;
}

// opts: f (Hz), gain, bright (0..1), bendTo (Hz, optional meend glide), bendTime (s)
export function sitar(ctx, dest, t, { f = 293.66, gain = 0.4, bright = 0.5, bendTo = null, bendTime = 0.18, dur = 1.6 } = {}) {
  emit(ctx, 'sitar', t, f, gain);
  const src = ctx.createBufferSource();
  src.buffer = ksBuffer(ctx, f, bright);
  if (bendTo) {
    src.playbackRate.setValueAtTime(1, t + 0.05);
    src.playbackRate.exponentialRampToValueAtTime(bendTo / f, t + 0.05 + bendTime);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.setTargetAtTime(0.0001, t + dur * 0.7, dur * 0.2);
  const tone = ctx.createBiquadFilter();
  tone.type = 'peaking'; tone.frequency.value = 2400; tone.Q.value = 0.8; tone.gain.value = 3 + bright * 5;
  src.connect(tone).connect(g).connect(dest);
  src.start(t);
  src.stop(t + dur + 0.1);
  return src;
}

// ---------- Bansuri-like flute: sine plus a little second harmonic, vibrato, breath noise ----------
export function flute(ctx, dest, t, { f = 587.33, dur = 1.2, gain = 0.18, breath = 0.35, vibrato = 0.004 } = {}) {
  emit(ctx, 'flute', t, f, gain);
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t);
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2, t);
  const g2 = ctx.createGain(); g2.gain.value = 0.12;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
  const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * vibrato, t + Math.min(0.5, dur * 0.6));
  lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  // Slight scoop up into the note, as a bansuri player often does.
  o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  const g = ctx.createGain();
  const a = Math.min(0.12, dur * 0.3);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + a);
  g.gain.setValueAtTime(gain, t + Math.max(a, dur - 0.18));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx); n.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 1.2;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(gain * breath, t + 0.04);
  ng.gain.exponentialRampToValueAtTime(gain * breath * 0.25, t + 0.25);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); o2.connect(g2).connect(g); n.connect(bp).connect(ng).connect(dest);
  g.connect(dest);
  for (const s of [o, o2, lfo, n]) { s.start(t); s.stop(t + dur + 0.05); }
}

// ---------- Tabla-like drum ----------
// stroke: 'dha' (both), 'ge' (bass with pitch glide), 'na' (ringing treble), 'ti' (dry treble), 'ka' (slap)
export function tabla(ctx, dest, t, { stroke = 'na', gain = 0.5, pitch = 1 } = {}) {
  emit(ctx, 'tabla', t, stroke === 'ge' || stroke === 'dha' ? 100 : 520, gain);
  const treble = (ringing) => {
    const o = ctx.createOscillator(); o.type = 'sine';
    const f = 520 * pitch;
    o.frequency.setValueAtTime(f * 1.04, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.01;
    const g = ctx.createGain(); env(g, t, 0.002, gain * 0.55, ringing ? 0.42 : 0.09);
    const g2 = ctx.createGain(); env(g2, t, 0.002, gain * 0.18, ringing ? 0.25 : 0.05);
    o.connect(g).connect(dest); o2.connect(g2).connect(dest);
    for (const s of [o, o2]) { s.start(t); s.stop(t + 0.6); }
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx);
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3200; hp.Q.value = 0.9;
    const ng = ctx.createGain(); env(ng, t, 0.001, gain * 0.35, 0.025);
    n.connect(hp).connect(ng).connect(dest); n.start(t, Math.random()); n.stop(t + 0.06);
  };
  const bass = () => {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(78 * pitch, t + 0.35); // the bayan's sliding "ge"
    const g = ctx.createGain(); env(g, t, 0.004, gain * 0.9, 0.5);
    o.connect(g).connect(dest); o.start(t); o.stop(t + 0.7);
  };
  if (stroke === 'dha') { treble(true); bass(); }
  else if (stroke === 'ge') bass();
  else if (stroke === 'na') treble(true);
  else if (stroke === 'ti') treble(false);
  else if (stroke === 'ka') {
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain(); env(g, t, 0.001, gain * 0.6, 0.06);
    n.connect(lp).connect(g).connect(dest); n.start(t, Math.random()); n.stop(t + 0.1);
  }
}

// ---------- Tanpura-like drone: four plucked strings that swell and buzz ----------
// One cycle of Pa (or Ma) – Sa' – Sa' – Sa. detune (cents) puts the fifth out of tune.
export function tanpuraCycle(ctx, dest, t, { sa = 146.83, fifth = 7, detune = 0, cycle = 4.8, gain = 0.12, brightness = 0.5 } = {}) {
  const strings = [sa * 2 ** ((fifth - 12) / 12) * 2 ** (detune / 1200), sa * 2, sa * 2, sa];
  strings.forEach((f, i) => emit(ctx, 'drone', t + (i * cycle) / 4, f, gain));
  strings.forEach((f, i) => {
    const st = t + (i * cycle) / 4;
    const len = cycle * 1.15;
    for (const [mult, det] of [[1, -4], [1, 4], [2, 0]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = f * mult; o.detune.value = det;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
      // The jawari "buzz": a resonant filter sweeping slowly down the harmonics.
      lp.frequency.setValueAtTime(f * (5 + brightness * 6), st);
      lp.frequency.exponentialRampToValueAtTime(f * 1.6, st + len);
      const g = ctx.createGain();
      const peak = gain * (mult === 2 ? 0.25 : 0.5);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(peak, st + 0.06);
      g.gain.exponentialRampToValueAtTime(peak * 0.45, st + len * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, st + len);
      o.connect(lp).connect(g).connect(dest);
      o.start(st); o.stop(st + len + 0.05);
    }
  });
}

// ---------- Missing data: a rest with a soft click ----------
export function click(ctx, dest, t, { gain = 0.12 } = {}) {
  emit(ctx, 'click', t, 0, gain);
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 3;
  const g = ctx.createGain(); env(g, t, 0.0005, gain, 0.012);
  n.connect(bp).connect(g).connect(dest); n.start(t, 0.3); n.stop(t + 0.03);
}

// ---------- Wind: a quiet filtered-noise texture under the music ----------
export function windLayer(ctx, dest, { gain = 0.04 } = {}) {
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx); n.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lg = ctx.createGain(); lg.gain.value = 300;
  lfo.connect(lg).connect(bp.frequency);
  const g = ctx.createGain(); g.gain.value = gain;
  n.connect(bp).connect(g).connect(dest);
  n.start(); lfo.start();
  return { gain: g, stop: () => { try { n.stop(); lfo.stop(); } catch { /* already stopped */ } } };
}
