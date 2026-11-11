// Written descriptions of sound cues: screen-reader live regions, visible captions, vibration.
const polite = () => document.getElementById('live-polite');
const assertive = () => document.getElementById('live-assert');
const captions = () => document.getElementById('captions');
let lastText = '', lastAt = 0;
export const log = [];

export function say(text, { urgent = false, caption = true } = {}) {
  if (!text) return;
  const now = performance.now();
  if (text === lastText && now - lastAt < 1500) return; // avoid repeating the same cue
  lastText = text; lastAt = now;
  log.push({ t: Math.round(now), text });
  if (log.length > 200) log.shift();
  const region = urgent ? assertive() : polite();
  if (region) {
    if (urgent) region.textContent = text;
    else {
      const p = document.createElement('p');
      p.textContent = text;
      region.appendChild(p);
      while (region.childNodes.length > 6) region.firstChild.remove();
    }
  }
  if (caption) showCaption(text);
}

export function showCaption(text, ms = 4200) {
  const box = captions();
  if (!box) return;
  const d = document.createElement('div');
  d.textContent = text;
  box.appendChild(d);
  while (box.childNodes.length > 3) box.firstChild.remove();
  setTimeout(() => d.remove(), ms);
}

let vibrateOn = true;
export function setVibration(v) { vibrateOn = v; }
export function vibrate(pattern) {
  if (vibrateOn && navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* not allowed */ } }
}

// "ahead and to your left" style direction from a relative angle (radians, 0 = ahead, + = right).
export function directionWords(rel, dist) {
  const a = Math.atan2(Math.sin(rel), Math.cos(rel));
  const deg = (a * 180) / Math.PI;
  let w;
  if (Math.abs(deg) < 20) w = 'straight ahead';
  else if (Math.abs(deg) > 150) w = 'behind you';
  else if (deg > 0) w = deg < 65 ? 'ahead and to your right' : deg < 115 ? 'to your right' : 'behind you on the right';
  else w = deg > -65 ? 'ahead and to your left' : deg > -115 ? 'to your left' : 'behind you on the left';
  const m = Math.round(dist / 5) * 5;
  const far = dist < 6 ? 'right here' : `about ${m} metres away`;
  return dist < 6 ? 'right here' : `${w}, ${far}`;
}
