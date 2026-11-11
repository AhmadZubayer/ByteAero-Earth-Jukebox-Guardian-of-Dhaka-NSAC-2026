// Boot: settings, WebGL check, loading screen, then the game flow.
import { hasWebGL } from './core/renderer.js';
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
    h('p', {}, 'You can still play: the simpler 2D Earth Jukebox uses the same NASA images, or you can play this game in text-only mode with sound.'),
    h('div', { class: 'row' },
      h('a', { class: 'btn', href: 'classic/index.html' }, 'Play the 2D game'),
      button('Play text-only', () => start(true), 'secondary')),
  ));
}

async function start(textOnly = false) {
  if (textOnly) settings.textOnly = true;
  document.body.classList.toggle('text-only', settings.textOnly);
  const { runGame } = await import('./game/flow.js');
  runGame(settings);
}

if (!hasWebGL() && !settings.textOnly) fallback();
else start();
