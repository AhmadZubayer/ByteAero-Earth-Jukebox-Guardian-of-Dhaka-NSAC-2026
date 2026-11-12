// Web Audio engine: context, buses, reverb, 3D listener, positional voices and level meters.

function makeImpulse(ctx, seconds = 2.4, decay = 2.6) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let seed = 99 + ch * 7;
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = ((seed / 1073741823.5) - 1) * (1 - i / len) ** decay;
    }
  }
  return buf;
}

// Build the bus graph on any context (live AudioContext or OfflineAudioContext).
export function buildGraph(ctx) {
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  const verb = ctx.createConvolver(); verb.buffer = makeImpulse(ctx);
  const verbSend = ctx.createGain(); verbSend.gain.value = 0.22;
  const music = ctx.createGain(); music.gain.value = 0.9;
  const cues = ctx.createGain(); cues.gain.value = 1;
  const fx = ctx.createGain(); fx.gain.value = 0.8;
  for (const b of [music, cues, fx]) { b.connect(master); b.connect(verbSend); }
  verbSend.connect(verb).connect(master);
  master.connect(comp).connect(ctx.destination);
  return { master, comp, music, cues, fx, verbSend };
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.8;
    this.voices = new Set();
  }

  // Must be called from a user gesture (click / key press).
  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.bus = buildGraph(this.ctx);
      this.bus.master.gain.value = this.enabled ? this.volume : 0;
      // Stereo level meters, used by the tests and the Sound Lab meter.
      this.split = this.ctx.createChannelSplitter(2);
      this.meterL = this.ctx.createAnalyser(); this.meterR = this.ctx.createAnalyser();
      this.meterL.fftSize = this.meterR.fftSize = 2048;
      this.bus.comp.connect(this.split);
      this.split.connect(this.meterL, 0); this.split.connect(this.meterR, 1);
      this.spectrum = this.ctx.createAnalyser();
      this.spectrum.fftSize = 2048; this.spectrum.smoothingTimeConstant = 0.8;
      this.bus.comp.connect(this.spectrum);
    }
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch { /* blocked */ } }
    return this.ctx.state === 'running';
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  setEnabled(on) {
    this.enabled = on;
    if (this.bus) this.bus.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.05);
  }

  setVolume(v) {
    this.volume = v;
    if (this.bus && this.enabled) this.bus.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  // Listener at the player, facing where the camera looks (flat on the ground plane).
  setListener(x, y, z, fx, fz) {
    const L = this.ctx?.listener;
    if (!L) return;
    const t = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(x, t, 0.03); L.positionY.setTargetAtTime(y, t, 0.03); L.positionZ.setTargetAtTime(z, t, 0.03);
      L.forwardX.setTargetAtTime(fx, t, 0.03); L.forwardY.setTargetAtTime(0, t, 0.03); L.forwardZ.setTargetAtTime(fz, t, 0.03);
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(x, y, z);
      L.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  // A sound source fixed in the world. Notes are scheduled into voice.input.
  voice({ x = 0, y = 1.5, z = 0, ref = 6, rolloff = 1.3, bus = 'cues' } = {}) {
    const ctx = this.ctx;
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.maxDistance = 400;
    p.rolloffFactor = rolloff;
    const input = ctx.createGain();
    input.connect(p).connect(this.bus[bus]);
    const v = {
      input, panner: p,
      set(x2, y2, z2) {
        if (p.positionX) { p.positionX.value = x2; p.positionY.value = y2; p.positionZ.value = z2; } else p.setPosition(x2, y2, z2);
      },
      dispose: () => { try { input.disconnect(); p.disconnect(); } catch { /* gone */ } this.voices.delete(v); },
    };
    v.set(x, y, z);
    this.voices.add(v);
    return v;
  }

  // RMS level of the left and right output, 0..1.
  levels() {
    if (!this.meterL) return { l: 0, r: 0 };
    const a = new Float32Array(this.meterL.fftSize), b = new Float32Array(this.meterR.fftSize);
    this.meterL.getFloatTimeDomainData(a); this.meterR.getFloatTimeDomainData(b);
    const rms = (d) => Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length);
    return { l: rms(a), r: rms(b) };
  }
}

export const audio = new AudioEngine();
window.__audio = audio;
