// Settings and progress in localStorage. Every access is guarded: storage can be missing or blocked.
const KEY = 'earth-jukebox-3d-v1';

const DEFAULT_SETTINGS = {
  sound: true,
  volume: 0.8,
  relaxed: false,
  textOnly: false,
  reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  quality: 'high',
  captions: true,
  vibration: true,
  heatView: true,
  speakDirections: true,
};

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...(read().settings || {}) };
}
export function saveSettings(s) {
  const d = read(); d.settings = s; write(d);
}
export function loadProgress() {
  return read().progress || null;
}
export function saveProgress(p) {
  const d = read(); d.progress = p; write(d);
}
export function clearProgress() {
  const d = read(); delete d.progress; write(d);
}
