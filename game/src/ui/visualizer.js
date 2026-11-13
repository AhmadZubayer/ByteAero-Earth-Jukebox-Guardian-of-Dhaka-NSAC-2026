// Live picture of the music: a scrolling "note river" (each note is a dot, height = pitch,
// colour = instrument) over a spectrum, plus four instrument lamps that flash as they play.
import { h } from './dom.js';
import { audio } from '../audio/engine.js';
import { noteListeners } from '../audio/instruments.js';

const INST = {
  sitar: { label: 'Sitar · heat', color: '#ff8a3d' },
  tabla: { label: 'Tabla · rain', color: '#4fb3ff' },
  flute: { label: 'Flute · green', color: '#5fd17a' },
  drone: { label: 'Drone', color: '#c9a7ff' },
};

export function visualizer({ height = 140, compact = false } = {}) {
  const canvas = h('canvas', { class: 'viz-canvas', 'aria-hidden': 'true' });
  const lamps = {};
  const lampRow = h('div', { class: 'viz-lamps', 'aria-hidden': 'true' }, Object.entries(INST).map(([k, v]) => {
    const el = h('span', { class: 'viz-lamp', style: `--c:${v.color}` }, h('i'), v.label);
    lamps[k] = el;
    return el;
  }));
  const root = h('div', { class: `viz${compact ? ' compact' : ''}` }, canvas, lampRow);
  const dots = [];
  const onNote = (n) => {
    if (n.kind === 'click') { dots.push({ x: 1, y: 0.5, c: '#ffffff', r: 2, life: 1, ring: true }); return; }
    const inst = INST[n.kind];
    if (!inst) return;
    const y = n.f ? Math.max(0, Math.min(1, (Math.log2(n.f) - Math.log2(70)) / (Math.log2(1400) - Math.log2(70)))) : 0.5;
    dots.push({ x: 1, y, c: inst.color, r: n.kind === 'drone' ? 3 : 3 + n.gain * 8, life: 1, kind: n.kind });
    const lamp = lamps[n.kind];
    if (lamp) { lamp.classList.add('on'); clearTimeout(lamp._t); lamp._t = setTimeout(() => lamp.classList.remove('on'), 160); }
  };
  noteListeners.add(onNote);
  let raf = 0, last = performance.now();
  const bins = new Uint8Array(1024);
  const draw = (now) => {
    if (!root.isConnected) { noteListeners.delete(onNote); return; }
    raf = requestAnimationFrame(draw);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth, hh = canvas.clientHeight || height;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hh);
    // Spectrum along the bottom.
    if (audio.spectrum) {
      audio.spectrum.getByteFrequencyData(bins);
      const n = 56, base = hh;
      for (let i = 0; i < n; i++) {
        const lo = Math.floor(2 * Math.pow(400, i / n)), hi = Math.max(lo + 1, Math.floor(2 * Math.pow(400, (i + 1) / n)));
        let v = 0; for (let k = lo; k < hi && k < bins.length; k++) v = Math.max(v, bins[k]);
        const bh = (v / 255) * hh * 0.45;
        const t = i / n;
        g.fillStyle = `hsla(${200 - t * 180}, 85%, 60%, 0.35)`;
        g.fillRect((i / n) * w + 1, base - bh, w / n - 2, bh);
      }
    }
    // Note river: dots drift left; glowing trail.
    for (let i = dots.length - 1; i >= 0; i--) {
      const d = dots[i];
      d.x -= dt * 0.22;
      if (d.x < -0.05) { dots.splice(i, 1); continue; }
      const x = d.x * w, y = 8 + (1 - d.y) * (hh - 16) * 0.92;
      const fresh = Math.max(0, d.x - 0.85) / 0.15;
      g.globalAlpha = Math.min(1, 0.35 + d.x);
      g.fillStyle = d.c;
      g.beginPath(); g.arc(x, y, d.r * (1 + fresh * 0.8), 0, Math.PI * 2); g.fill();
      if (fresh > 0) { g.globalAlpha = fresh * 0.5; g.beginPath(); g.arc(x, y, d.r * 3.2 * (1 - fresh * 0.5), 0, Math.PI * 2); g.strokeStyle = d.c; g.lineWidth = 2; g.stroke(); }
    }
    g.globalAlpha = 1;
    // "Now" line on the right.
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(w - 3, 0, 2, hh);
  };
  canvas.style.height = `${height}px`;
  raf = requestAnimationFrame(draw);
  root.dispose = () => { cancelAnimationFrame(raf); noteListeners.delete(onNote); };
  return root;
}
