// Boot: settings, WebGL check, loading screen, then the game flow.
import { hasWebGL } from './core/webgl.js';
import { loadSettings } from './core/save.js';
import { h, show, button } from './ui/dom.js';
import { setVibration } from './ui/announce.js';

const settings = loadSettings();
window.__settings = settings;
document.body.classList.toggle('reduced-motion', settings.reducedMotion);
document.body.classList.toggle('no-captions', !settings.captions);
setVibration(settings.vibration);

function fallback() {
  show(h('section', { class: 'panel' },
    h('h1', {}, 'Earth Jukebox: Guardian of Dhaka'),
    h('p', {}, 'This device or browser cannot show the 3D city (WebGL is not available).'),
    h('p', {}, 'You can still play the whole game in text-only mode, with sound, using the same NASA data. To see the 3D city, turn on graphics (hardware) acceleration in your browser settings and reload.'),
    h('div', { class: 'row' }, button('Play text-only', () => start(true), '', { 'data-autofocus': true })),
  ));
}

async function start(textOnly = false) {
  if (textOnly) settings.textOnly = true;
  document.body.classList.toggle('text-only', settings.textOnly);
  document.documentElement.classList.toggle('text-only', settings.textOnly);
  const { runGame } = await import('./game/flow.js');
  runGame(settings);
}

if (!hasWebGL() && !settings.textOnly) fallback();
else start();
