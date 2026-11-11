// Game flow: title -> message -> globe -> Sound Lab -> Quick Ears -> six rounds -> record -> ticket.
import { h, show, button, clear } from '../ui/dom.js';
import { say } from '../ui/announce.js';
import { Runtime } from '../core/runtime.js';
import { TestStreet } from '../world/teststreet.js';
import { audio } from '../audio/engine.js';
import { soundLab, quickEars, beaconHunt } from './practice.js';
import { loadData } from '../data/nasa.js';
import { Round } from './round.js';
import { ROUNDS } from './rounds.js';

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

async function practice(settings) {
  await testStreet(settings);
  rt.setPlayerActive(false);
  window.__phase = 'lab';
  await soundLab(rt);
  window.__phase = 'quickears';
  await quickEars(settings);
  window.__phase = 'hunt';
  const secs = await beaconHunt(rt, settings);
  window.__phase = 'hunt-done';
  show(h('section', { class: 'panel' }, h('h2', {}, `You found it by ear in ${Math.round(secs)} seconds!`), h('p', {}, 'Next: Dhaka. (Built in Phase 3.)')));
}

async function devRound(settings, year) {
  const data = await loadData();
  const r = await ensureRuntime(settings);
  const def = ROUNDS.find((x) => x.year === year) || ROUNDS[0];
  const round = new Round(def, data, {}, settings);
  await round.load();
  r.setScene(round);
  window.__round = round;
  window.__ready = true;
  const out = await round.play();
  window.__roundResult = out;
  show(h('section', { class: 'panel' }, h('h2', {}, `${def.year}: ${out.result.pct}% protected`)));
}

export async function runGame(settings) {
  audio.setEnabled(settings.sound);
  audio.setVolume(settings.volume);
  if (params.get('scene') === 'street') return testStreet(settings);
  if (params.get('scene') === 'practice') return practice(settings);
  if (params.get('scene') === 'round') return devRound(settings, +params.get('year') || 2000);
  show(h('section', { class: 'panel title-panel' },
    h('p', { class: 'kicker' }, 'NASA Space Apps 2026 · The Earth Information Jukebox'),
    h('h1', {}, 'Earth Jukebox: Guardian of Dhaka'),
    h('p', {}, 'Listen for the heat. Find it. Cool the city.'),
    h('div', { class: 'row', style: 'justify-content:center' }, button('Start', async () => { await audio.unlock(); practice(settings); }, '', { 'data-autofocus': true })),
    h('p', { class: 'team' }, 'Team BYTEAERO · AIUB, Dhaka'),
  ));
  window.__ready = true;
}
