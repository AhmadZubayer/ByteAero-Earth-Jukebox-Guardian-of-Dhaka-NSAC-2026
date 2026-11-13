// Raga-inspired scales as semitone offsets from Sa (the tonic).
export const SCALES = {
  // Raga Bhupali: S R G P D — open, calm pentatonic.
  bhupali: { name: 'Bhupali (calm)', steps: [0, 2, 4, 7, 9] },
  // Raga Megh Malhar: S R m P n — associated with the monsoon.
  megh: { name: 'Megh Malhar (rain)', steps: [0, 2, 5, 7, 10] },
  // Marwa-like set: S r G M# D N — komal Re and tivra Ma give an unsettled, tense colour.
  marwa: { name: 'Marwa-like (heat tension)', steps: [0, 1, 4, 6, 9, 11] },
};

export const SA = 146.83; // D3 as the tonic, a comfortable drone register

export function freq(semitones, sa = SA) {
  return sa * 2 ** (semitones / 12);
}

// Choose a scale from heat tension (share of hot districts, 0..1) and rain (mm/day).
// Between calm and tense, notes of Bhupali are swapped for Marwa colours with rising probability.
export function scaleFor(tension, rain = 0) {
  if (rain >= 6 && tension < 0.5) return { key: 'megh', steps: SCALES.megh.steps, blend: 0 };
  if (tension < 0.2) return { key: 'bhupali', steps: SCALES.bhupali.steps, blend: 0 };
  if (tension > 0.55) return { key: 'marwa', steps: SCALES.marwa.steps, blend: 1 };
  const blend = (tension - 0.2) / 0.35;
  // R -> r (flat second), P -> M# (sharp fourth) as tension grows.
  const steps = [0, blend > 0.35 ? 1 : 2, 4, blend > 0.65 ? 6 : 7, 9];
  return { key: 'blend', steps, blend };
}

// Map a 0..1 value to a semitone offset snapped to the scale, across `octaves` octaves.
export function snap(v, steps, octaves = 2, base = 0) {
  const n = steps.length * octaves;
  const i = Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))));
  return base + steps[i % steps.length] + 12 * Math.floor(i / steps.length);
}

// The degree index (0..n) for a semitone value, used to walk up a scale.
export function degree(i, steps, base = 0) {
  const o = Math.floor(i / steps.length);
  const k = ((i % steps.length) + steps.length) % steps.length;
  return base + steps[k] + 12 * o;
}
