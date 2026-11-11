// Settings panel (title screen and pause menu). Changes apply at once and are saved.
import { h } from './dom.js';
import { saveSettings } from '../core/save.js';
import { audio } from '../audio/engine.js';
import { setVibration } from './announce.js';

const TOGGLES = [
  ['sound', 'Sound', 'Music and sound cues. Every cue also has a written description.'],
  ['captions', 'Show sound captions', 'Written descriptions of sounds appear on screen.'],
  ['speakDirections', 'Echo gives directions in words', 'Echo says where the heat is, like "ahead and to your left".'],
  ['heatView', 'Heat view', 'Coloured heat overlay on the city. Turn it off to play by ear (listener bonus).'],
  ['relaxed', 'Relaxed mode', 'No timer. You bring the heat wave when you are ready.'],
  ['reducedMotion', 'Reduce motion', 'No camera shake, shimmer or bouncing.'],
  ['vibration', 'Vibration', 'Phones buzz gently near a hot spot.'],
  ['textOnly', 'Text-only mode', 'Play the story and every choice as text, without 3D. Works with screen readers.'],
];

export function settingsPanel(settings, onChange) {
  const box = h('div', { class: 'settings', role: 'group', 'aria-label': 'Settings' });
  for (const [key, label, help] of TOGGLES) {
    const id = `set-${key}`;
    const input = h('input', { type: 'checkbox', id, checked: !!settings[key] });
    input.addEventListener('change', () => { settings[key] = input.checked; apply(settings, key); saveSettings(settings); onChange?.(key); });
    box.append(h('label', { class: 'toggle', for: id }, input, h('span', {}, h('strong', {}, label), h('small', {}, help))));
  }
  const vol = h('input', { type: 'range', id: 'set-volume', min: 0, max: 1, step: 0.05, value: settings.volume, 'aria-valuetext': `${Math.round(settings.volume * 100)} percent` });
  vol.addEventListener('input', () => { settings.volume = +vol.value; vol.setAttribute('aria-valuetext', `${Math.round(settings.volume * 100)} percent`); audio.setVolume(settings.volume); saveSettings(settings); });
  box.append(h('div', { class: 'slider' }, h('label', { for: 'set-volume' }, 'Volume'), vol, h('span')));
  const q = h('select', { id: 'set-quality' }, h('option', { value: 'high' }, 'High (shadows, glow)'), h('option', { value: 'low' }, 'Low (faster, fewer people)'));
  q.value = settings.quality;
  q.addEventListener('change', () => { settings.quality = q.value; saveSettings(settings); apply(settings, 'quality'); onChange?.('quality'); });
  box.append(h('div', { class: 'field' }, h('label', { for: 'set-quality' }, h('strong', {}, 'Graphics quality')), q));
  return box;
}

export function apply(settings, key) {
  if (key === 'sound') audio.setEnabled(settings.sound);
  if (key === 'captions') document.body.classList.toggle('no-captions', !settings.captions);
  if (key === 'reducedMotion') document.body.classList.toggle('reduced-motion', settings.reducedMotion);
  if (key === 'vibration') setVibration(settings.vibration);
  if (key === 'quality') window.__rt?.stage.setQuality(settings.quality);
}
