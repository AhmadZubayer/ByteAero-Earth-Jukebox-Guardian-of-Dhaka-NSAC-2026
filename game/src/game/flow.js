// Game flow: title -> message -> globe -> Sound Lab -> Quick Ears -> six rounds -> record -> ticket.
import { h, show, button, clear } from '../ui/dom.js';
import { say } from '../ui/announce.js';
import { Runtime } from '../core/runtime.js';
import { TestStreet } from '../world/teststreet.js';

const params = new URLSearchParams(location.search);
let rt = null;

function loadingScreen(text) {
  const bar = h('span');
  show(h('div', { class: 'loading', role: 'status', 'aria-live': 'polite' }, h('p', {}, text), h('div', { class: 'bar', 'aria-hidden': 'true' }, bar)));
  return (p) => { bar.style.width = `${Math.round(p * 100)}%`; };
}

async function ensureRuntime(settings) {
  if (rt) return rt;
  const progress = loadingScreen('Loading Dhaka…');
  rt = new Runtime(settings);
  await rt.init((e) => { if (e.total) progress(e.loaded / e.total); });
  window.__rt = rt;
  return rt;
}

async function testStreet(settings) {
  const r = await ensureRuntime(settings);
  const street = new TestStreet();
  await street.load();
  r.setScene(street);
  r.setPlayerActive(true);
  clear();
  say('Practice street. Use W A S D or the arrow keys to walk, Shift to run, Space to jump.');
  window.__ready = true;
}

export async function runGame(settings) {
  if (params.get('scene') === 'street') return testStreet(settings);
  show(h('section', { class: 'panel title-panel' },
    h('p', { class: 'kicker' }, 'NASA Space Apps 2026 · The Earth Information Jukebox'),
    h('h1', {}, 'Earth Jukebox: Guardian of Dhaka'),
    h('p', {}, 'Listen for the heat. Find it. Cool the city.'),
    h('div', { class: 'row', style: 'justify-content:center' }, button('Start', () => testStreet(settings), '', { 'data-autofocus': true })),
    h('p', { class: 'team' }, 'Team BYTEAERO · AIUB, Dhaka'),
  ));
  window.__ready = true;
}
