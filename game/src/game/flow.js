// Game flow: title -> Echo's message -> Earth Jukebox globe -> Sound Lab -> Quick Ears -> beacon hunt
// -> six Dhaka rounds -> Earth Record -> ticket.
import { h, show, button, clear, dialogue } from '../ui/dom.js';
import { say } from '../ui/announce.js';
import { audio } from '../audio/engine.js';
import { loadData } from '../data/nasa.js';
import { loadProgress, saveProgress, clearProgress } from '../core/save.js';
import { settingsPanel } from '../ui/settings.js';
import { reportScreen, choiceScreen } from '../ui/report.js';
import { legendButtons, soundLab, quickEars, beaconHunt } from './practice.js';
import { ROUNDS } from './rounds.js';
import { N, starsFor, LOSE_BELOW } from './heat.js';

const params = new URLSearchParams(location.search);
let rt = null, data = null, settings = null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function loadingScreen(text) {
  const bar = h('span');
  show(h('div', { class: 'loading', role: 'status', 'aria-live': 'polite' }, h('p', {}, text), h('div', { class: 'bar', 'aria-hidden': 'true' }, bar)));
  return (p) => { bar.style.width = `${Math.round(p * 100)}%`; };
}

async function ensureRuntime() {
  if (rt || settings.textOnly) return rt;
  const progress = loadingScreen('Loading Dhaka…');
  const { Runtime } = await import('../core/runtime.js');
  rt = new Runtime(settings);
  await rt.init((e) => { if (e.total) progress(e.loaded / e.total); });
  rt.input.on('menu', () => openMenu());
  window.__rt = rt;
  return rt;
}

export function newState(name = 'Earth Explorer') {
  return { v: 1, name, roundIndex: 0, results: [], energy: null, land: null, planted: new Array(N).fill(0), practiced: false };
}

// ---------------- Pause menu ----------------
let menuOpen = false, currentRound = null, menuReturn = null;
async function openMenu() {
  if (menuOpen || !rt || !currentRound || currentRound.phase !== 'play') return;
  menuOpen = true;
  rt.paused = true;
  rt.setPlayerActive(false);
  try { await audio.ctx?.suspend(); } catch { /* no audio */ }
  const prev = [...document.getElementById('ui').childNodes];
  const close = async (then) => {
    menuOpen = false;
    if (prev.length) show(...prev); else clear();
    rt.paused = false;
    rt.clock.getDelta();
    try { await audio.ctx?.resume(); } catch { /* no audio */ }
    rt.setPlayerActive(true);
    then?.();
  };
  show(h('section', { class: 'panel', 'aria-labelledby': 'menu-h', role: 'dialog', 'aria-modal': 'true' },
    h('h2', { id: 'menu-h' }, 'Paused'),
    h('div', { class: 'row' },
      button('Resume', () => close(), '', { 'data-autofocus': true }),
      button('Bring the heat wave now', () => close(() => currentRound.finish()), 'secondary'),
      button('Ask Echo: where is the heat?', () => close(() => { currentRound.usedHint = true; currentRound.where(false); }), 'secondary')),
    h('h3', {}, 'Audio legend'), legendButtons(),
    h('h3', {}, 'Controls'),
    h('p', {}, 'W A S D or arrows: move. Shift: run. Space: jump. Q: Echo scans and plays the heat around you. R: Echo says where the heat is. 1 to 4: choose a fix. E: place it (or talk). F: bring the heat wave. H: heat view on or off. Esc: this menu.'),
    h('h3', {}, 'Settings'), settingsPanel(settings, (k) => { if (k === 'heatView') currentRound.refresh(); if (k === 'textOnly') location.reload(); }),
    h('div', { class: 'row end' }, button('Restart this year', () => close(() => { menuReturn = 'restart'; currentRound.finish(); }), 'secondary small'),
      button('Save and quit to title', () => { saveProgress(window.__state); location.href = location.pathname; }, 'secondary small')),
  ));
}

// ---------------- Screens ----------------
function titleScreen() {
  const saved = loadProgress();
  return new Promise((resolve) => {
    const canContinue = saved && saved.roundIndex > 0 && saved.roundIndex <= ROUNDS.length;
    show(h('section', { class: 'panel title-panel', 'aria-labelledby': 'title-h' },
      h('p', { class: 'kicker' }, 'NASA Space Apps 2026 · The Earth Information Jukebox'),
      h('h1', { id: 'title-h' }, 'Earth Jukebox: Guardian of Dhaka'),
      h('p', {}, 'A heat wave is coming. Listen for it, find it, and cool the city, with real NASA Earth data turned into music.'),
      h('div', { class: 'row', style: 'justify-content:center' },
        button(canContinue ? 'New game' : 'Start', () => resolve({ mode: 'new' }), '', { 'data-autofocus': true }),
        canContinue ? button(`Continue (${saved.roundIndex < ROUNDS.length ? ROUNDS[saved.roundIndex].year : 'Earth Record'})`, () => resolve({ mode: 'continue', state: saved }), 'secondary') : null),
      h('details', { class: 'note', style: 'text-align:left' }, h('summary', {}, 'How to play'),
        h('p', {}, 'Each year a heat wave is coming to Dhaka. Listen: a rising sitar line comes from the hottest blocks, louder, higher and faster as you get close. Walk there and spend coins on trees, white roofs, ponds and cooling centres before the wave hits.'),
        h('p', {}, 'Keyboard: W A S D or arrows to move, Shift to run, Q for Echo\'s sound scan, R for directions in words, 1 to 4 to choose a fix, E to place it, F to bring the wave, Esc for the menu. Phone: joystick on the left, buttons on the right, fixes along the bottom.')),
      h('details', { class: 'note', style: 'text-align:left' }, h('summary', {}, 'Settings and accessibility'), settingsPanel(settings, (k) => { if (k === 'textOnly') location.reload(); })),
      h('p', { class: 'note', style: 'text-align:left' }, 'Best with headphones: sounds come from where they are in the city. Every sound also has a written description. No 3D graphics? Turn on Text-only mode in the settings above.'),
      h('p', { class: 'team' }, 'Team BYTEAERO · AIUB, Dhaka. Not an official NASA product. Music is original, inspired by NASA sonification.'),
    ));
    window.__ready = true;
  });
}

function nameScreen(state) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'text', id: 'player-name', maxlength: 24, autocomplete: 'off', placeholder: 'Earth Explorer' });
    const go = () => { state.name = input.value.trim() || 'Earth Explorer'; resolve(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    show(h('section', { class: 'panel', 'aria-labelledby': 'msg-h' },
      h('p', { class: 'kicker' }, h('span', { class: 'label imagined' }, 'Imagined story')),
      h('h2', { id: 'msg-h' }, 'A broken message from 2050'),
      h('p', {}, 'Echo, a small listening satellite, has caught a crackling message from a child in a possible future Dhaka:'),
      h('p', { class: 'fragment' }, '“…can anyone hear… what happened to our city…? …listen to the heat… help us…”'),
      h('p', {}, 'The message is broken into six pieces. Each year you protect brings one piece back.'),
      h('div', { class: 'field' }, h('label', { for: 'player-name' }, 'Your name for the ticket'), input),
      h('div', { class: 'row end' }, button('Help Echo', go)),
    ));
    requestAnimationFrame(() => input.focus());
  });
}

// ---------------- Rounds ----------------
export function resultRecord(def, round, outcome) {
  return {
    year: def.year, pct: outcome.result.pct, cooledPct: outcome.result.cooledPct, stars: starsFor(outcome.result.pct), byEar: outcome.byEar,
    fixes: outcome.fixes.length, talked: outcome.talked,
    rowLst: [0, 1, 2, 3, 4].map((r) => { const v = round.cells.slice(r * 5, r * 5 + 5).map((c) => c.lst).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }),
    meanLst: round.cells.reduce((s, c) => s + (c.lst ?? 0), 0) / N,
    ndvi: round.cells.reduce((s, c) => s + (c.ndvi ?? 0), 0) / N,
    rain: round.rainFor(), tension: round.tension, real: def.real,
  };
}

async function playRounds(state) {
  const { Round } = await import('./round.js');
  for (let i = state.roundIndex; i < ROUNDS.length; i++) {
    const def = ROUNDS[i];
    if (def.choices && (!state.energy || !state.land)) {
      window.__phase = 'choices';
      const pick = await choiceScreen();
      state.energy = pick.energy; state.land = pick.land;
      say(`You chose ${pick.energy === 'clean' ? 'clean energy' : 'coal power'} and ${pick.land === 'parks' ? 'parks and water' : 'more concrete'}.`);
      saveProgress(state);
    }
    for (;;) {
      const plantedBefore = [...state.planted];
      const round = new Round(def, data, state, settings);
      loadingScreen(`Travelling to ${def.year}…`);
      await round.load();
      rt.setScene(round);
      currentRound = round; window.__round = round; window.__phase = `round-${def.year}`;
      menuReturn = null;
      const outcome = await round.play();
      currentRound = null;
      if (menuReturn === 'restart') { state.planted = plantedBefore; continue; }
      window.__phase = `report-${def.year}`;
      const action = await reportScreen({ def, cells: round.cells, data, outcome, state, final: !!def.final });
      const lost = outcome.result.pct < LOSE_BELOW;
      if (action === 'retry' || (lost && !def.final)) { state.planted = plantedBefore; continue; }
      state.results[i] = resultRecord(def, round, outcome);
      state.roundIndex = i + 1;
      saveProgress(state);
      break;
    }
  }
}

export function badgesFor(state) {
  const r = state.results.filter(Boolean);
  const avg = r.length ? r.reduce((s, x) => s + x.pct, 0) / r.length : 0;
  const b = [];
  if (r.some((x) => x.byEar)) b.push({ key: 'hunter', name: 'Heat Hunter', why: 'Found a hot spot by ear alone' });
  if (avg >= 80) b.push({ key: 'cooler', name: 'City Cooler', why: `Protected ${Math.round(avg)}% of Dhaka on average` });
  const last = r.find((x) => x.year === 2050);
  if (last && last.pct >= 75) b.push({ key: 'future', name: 'Future Maker', why: 'Made 2050 calmer' });
  return { list: b, avg: Math.round(avg) };
}

async function ending(state) {
  window.__phase = 'record';
  const { earthRecord, ticket } = await import('./ending.js');
  rt?.setScene(null);
  await earthRecord(state, data, settings, rt);
  window.__phase = 'ticket';
  await ticket(state, badgesFor(state), settings);
}

async function practice(state) {
  if (settings.textOnly) return;
  const { TestStreet } = await import('../world/teststreet.js');
  const street = new TestStreet();
  await street.load();
  rt.setScene(street);
  window.__phase = 'lab';
  await soundLab(rt);
  window.__phase = 'quickears';
  await quickEars(settings);
  window.__phase = 'hunt';
  await beaconHunt(rt, settings);
  window.__phase = 'hunt-done';
  await wait(1200);
  await dialogue({ text: 'You can find a sound by ear! Now let us fly to Dhaka in the year 2000.', options: [{ label: 'Go to Dhaka', value: true }] });
  state.practiced = true;
  saveProgress(state);
}

export async function runGame(s) {
  settings = s;
  audio.setEnabled(settings.sound);
  audio.setVolume(settings.volume);
  data = await loadData();
  const scene = params.get('scene');
  if (scene) return devScene(scene);
  const choice = await titleScreen();
  await audio.unlock();
  const state = choice.mode === 'continue' ? choice.state : newState();
  window.__state = state;
  if (choice.mode === 'new') {
    clearProgress();
    await nameScreen(state);
    if (!settings.textOnly) {
      await ensureRuntime();
      const { globeIntro } = await import('./globe-scene.js');
      window.__phase = 'globe';
      await globeIntro(rt, data, settings);
    }
  }
  if (settings.textOnly) {
    const { playTextOnly } = await import('./textonly.js');
    await playTextOnly(state, data, settings);
  } else {
    await ensureRuntime();
    if (!state.practiced) await practice(state);
    await playRounds(state);
  }
  await ending(state);
}

// Development shortcuts used by the tests: ?scene=street | practice | globe | round&year=2000 | record | ticket
async function devScene(scene) {
  const state = newState('Tester'); window.__state = state;
  if (scene === 'record' || scene === 'ticket') {
    state.energy = 'clean'; state.land = 'parks';
    state.results = ROUNDS.map((r, i) => ({ year: r.year, pct: [84, 76, 92, 80, 80, 76][i], stars: 2, cooledPct: 70, byEar: i === 2, real: r.real, rowLst: data.districts[r.real ? r.year : 2024].reduce((a, c, k) => { a[Math.floor(k / 5)] += (c.lst ?? 0) / 5; return a; }, [0, 0, 0, 0, 0]), meanLst: 31, ndvi: 0.45, rain: r.real ? data.power[r.year].aprRain : 2.07, tension: 0.4 + i * 0.08 }));
    state.roundIndex = 6;
    window.__ready = true;
    if (scene === 'record') return ending(state);
    const { ticket } = await import('./ending.js');
    return ticket(state, badgesFor(state), settings);
  }
  if (settings.textOnly) {
    window.__ready = true;
    const { playTextOnly } = await import('./textonly.js');
    await playTextOnly(state, data, settings);
    return ending(state);
  }
  await ensureRuntime();
  if (scene === 'street') {
    const { TestStreet } = await import('../world/teststreet.js');
    const street = new TestStreet(); await street.load(); rt.setScene(street); rt.setPlayerActive(true); clear();
    say('Practice street. Use W A S D or the arrow keys to walk, Shift to run, Space to jump.');
    window.__ready = true;
    return;
  }
  if (scene === 'practice') { window.__ready = true; await practice(state); return; }
  if (scene === 'globe') { const { globeIntro } = await import('./globe-scene.js'); window.__ready = true; window.__phase = 'globe'; await globeIntro(rt, data, settings); window.__phase = 'globe-done'; return; }
  if (scene === 'round') {
    const year = +params.get('year') || 2000;
    state.roundIndex = Math.max(0, ROUNDS.findIndex((r) => r.year === year));
    if (params.get('energy')) { state.energy = params.get('energy'); state.land = params.get('land') || 'parks'; }
    window.__ready = true;
    await playRounds(state);
    await ending(state);
  }
}
