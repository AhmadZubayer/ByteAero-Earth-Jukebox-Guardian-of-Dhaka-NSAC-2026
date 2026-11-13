// Text-only mode: every round as an accessible HTML page, no 3D. Uses the same NASA data,
// heat rules and reports as the 3D game. With sound on, "Play the city" sweeps the 25 blocks
// as notes (north row first, west to east, panned left to right; higher = hotter).
import { h, show, button } from '../ui/dom.js';
import { say } from '../ui/announce.js';
import { audio } from '../audio/engine.js';
import { sitar, click, tanpuraCycle } from '../audio/instruments.js';
import { MAP } from '../audio/sonify.js';
import { freq, snap, scaleFor, SA } from '../audio/scales.js';
import { resolve as resolveHeat, FIXES, FIX_LIST, pickSpots, DANGER, LOSE_BELOW, N, COLS } from './heat.js';
import { ROUNDS, DISTRICT_NAMES, cellsFor, waveFor, layoutDistrict, plotFree } from './rounds.js';
import { reportScreen, choiceScreen } from '../ui/report.js';
import { resultRecord } from './flow.js';
import { saveProgress } from '../core/save.js';

function playCity(cells, forecast, tension) {
  if (!audio.ready) return 0;
  const ctx = audio.ctx, t0 = audio.now + 0.1, steps = scaleFor(tension, 0).steps;
  tanpuraCycle(ctx, audio.bus.music, t0, { sa: SA, cycle: 7.5, gain: 0.06 });
  cells.forEach((c, i) => {
    const pan = ctx.createStereoPanner();
    pan.pan.value = ((i % COLS) - 2) / 2.5;
    pan.connect(audio.bus.music);
    const t = t0 + i * 0.3 + Math.floor(i / COLS) * 0.25;
    const ex = forecast.districts[i].excess;
    const v = c.lst == null ? null : Math.max(0, Math.min(1, (MAP.heat01(c.lst) * 0.5) + Math.max(0, ex) / 5));
    if (v == null) click(ctx, pan, t);
    else sitar(ctx, pan, t, { f: freq(snap(v, steps, 2, 12)), gain: 0.4, bright: 0.3 + v * 0.6, dur: 0.6 });
  });
  return 9;
}

function textRound(def, data, state, settings) {
  return new Promise((resolveRound) => {
    const cells = cellsFor(data, def, state);
    const spots = pickSpots(cells, def.spots);
    const wave = waveFor(data, def, state);
    const layouts = cells.map(layoutDistrict);
    const fixes = [];
    let coins = def.coins;
    const found = new Set(def.hidden ? [] : spots);
    let byEar = false;
    const status = h('p', { 'aria-live': 'polite', class: 'note' });
    const coinsEl = h('p', { 'aria-live': 'off' });
    const tableBody = h('tbody');
    const placedList = h('ul');
    const districtSel = h('select', { id: 'to-district' }, DISTRICT_NAMES.map((n, i) => h('option', { value: i }, n)));
    const fixSel = h('select', { id: 'to-fix' }, FIX_LIST.map((f) => h('option', { value: f.key }, `${f.label} (${f.cost} coin${f.cost > 1 ? 's' : ''}): ${f.what}`)));
    const guessSel = h('select', { id: 'to-guess' }, DISTRICT_NAMES.map((n, i) => h('option', { value: i }, n)));
    let forecast = resolveHeat(cells, spots, wave, fixes);

    const render = () => {
      forecast = resolveHeat(cells, spots, wave, fixes);
      coinsEl.textContent = `Coins left: ${coins}. Hot spots found: ${found.size} of ${spots.length}.`;
      tableBody.replaceChildren(...Array.from({ length: 5 }, (_, r) => h('tr', {},
        h('th', { scope: 'row' }, ['North', 'North-middle', 'Middle', 'South-middle', 'South'][r]),
        ...Array.from({ length: 5 }, (_, c) => {
          const i = r * 5 + c, d = forecast.districts[i], cell = cells[i];
          const hidden = def.hidden && spots.includes(i) && !found.has(i);
          const isSpot = spots.includes(i) && found.has(i);
          return h('td', {}, h('strong', {}, DISTRICT_NAMES[i]), h('br'),
            hidden ? 'ground ? (listen)' : `ground ${cell.lst?.toFixed(1) ?? 'no data'} °C`, h('br'),
            `green ${cell.ndvi?.toFixed(2) ?? '–'}`, h('br'),
            hidden ? '' : d.safe ? 'safe' : `needs ${Math.max(0.1, d.excess - DANGER).toFixed(1)} °C`,
            isSpot ? h('span', { class: 'label estimate' }, 'hot spot') : '');
        }))));
      placedList.replaceChildren(...fixes.map((f, k) => h('li', {}, `${FIXES[f.type].label} in ${DISTRICT_NAMES[f.district]} `,
        button('Remove', () => { coins += FIXES[f.type].cost; fixes.splice(k, 1); render(); say(`Removed. ${coins} coins.`); }, 'small secondary'))));
    };

    const place = () => {
      const d = +districtSel.value, type = fixSel.value, f = FIXES[type];
      if (coins < f.cost) { status.textContent = `Not enough coins for a ${f.label.toLowerCase()}.`; return; }
      if (!plotFree(layouts, d, type, fixes)) { status.textContent = `No room for a ${f.label.toLowerCase()} in ${DISTRICT_NAMES[d]}. ${type === 'tree' ? 'Its open ground is full.' : type === 'roof' ? 'All its roofs are white.' : 'Its central square is used.'}`; return; }
      fixes.push({ type, district: d });
      coins -= f.cost;
      render();
      const after = forecast.districts[d];
      status.textContent = `${f.label} placed in ${DISTRICT_NAMES[d]}. ${after.cooled ? 'This block is now safe' : after.sheltered ? 'People can shelter here, but the block is still hot' : `Still needs ${Math.max(0.1, after.excess - DANGER).toFixed(1)} °C`} (game estimate). ${coins} coins left.`;
    };

    const guess = () => {
      const g = +guessSel.value;
      if (spots.includes(g) && !found.has(g)) {
        found.add(g); byEar = true; coins += 2; render();
        status.textContent = `Yes! ${DISTRICT_NAMES[g]} is a hot spot (ground ${cells[g].lst.toFixed(1)} °C). Found by ear: plus 2 coins.`;
      } else status.textContent = `${DISTRICT_NAMES[g]} is not the hidden hot spot. Play the city again and listen for the highest, brightest note.`;
      say(status.textContent);
    };

    const p = data.power[def.year];
    show(h('section', { class: 'panel wide', 'aria-labelledby': 'tr-h' },
      h('p', { class: 'kicker' }, def.real ? h('span', { class: 'label real' }, `Real NASA data · April ${def.year}`) : h('span', { class: 'label imagined' }, `Imagined ${def.year} · not a NASA forecast`)),
      h('h2', { id: 'tr-h' }, `${def.year}: ${def.title}`),
      h('p', {}, def.real ? `A heat wave is coming. In April ${def.year} NASA POWER recorded a hottest day of about ${p.aprT2MMax.toFixed(0)} °C in Dhaka's air.` : `This year is imagined from the real 2024 pattern and your choices. It is not a NASA forecast.`),
      h('p', {}, 'The streets are invented; each block\'s ground temperature (land surface temperature) and greenness (NDVI) come from NASA MODIS images of the same part of Dhaka. Protect blocks near the hot spots before the wave. Cooling numbers are game estimates.'),
      def.hidden ? h('p', { class: 'note' }, 'This year the hot spot is hidden. Play the city and listen: the hottest block has the highest, brightest note. Then make your guess below.') : null,
      h('div', { class: 'row' }, button('Play the city (sound)', async () => { await audio.unlock(); if (!settings.sound || !audio.ready) { say('Sound is off.'); return; } playCity(cells, forecast, forecast.districts.filter((d) => !d.safe).length / N); say('Playing the city: north row first, west to east, from left to right. Higher notes are hotter.'); }, 'secondary')),
      coinsEl,
      h('table', { class: 'data-table' }, h('caption', {}, 'Dhaka blocks, north at the top, west on the left'), tableBody),
      def.hidden ? h('div', { class: 'field' }, h('label', { for: 'to-guess' }, 'Which block is the hidden hot spot?'), guessSel, button('Check my guess', guess, 'small')) : null,
      h('h3', {}, 'Place a fix'),
      h('div', { class: 'field' }, h('label', { for: 'to-district' }, 'Block'), districtSel),
      h('div', { class: 'field' }, h('label', { for: 'to-fix' }, 'Fix'), fixSel),
      h('div', { class: 'row' }, button('Place fix', place)),
      status,
      h('h3', {}, 'Fixes placed'), placedList,
      h('div', { class: 'row end' }, button('Bring the heat wave', () => {
        const result = resolveHeat(cells, spots, wave, fixes);
        resolveRound({ cells, outcome: { result, fixes, coinsLeft: coins, found: found.size, spots, byEar, usedHint: false, talked: false, foundTimes: [] }, wave });
      })),
    ));
    render();
  });
}

export async function playTextOnly(state, data, settings) {
  for (let i = state.roundIndex; i < ROUNDS.length; i++) {
    const def = ROUNDS[i];
    if (def.choices && (!state.energy || !state.land)) {
      const pick = await choiceScreen();
      state.energy = pick.energy; state.land = pick.land;
    }
    for (;;) {
      window.__phase = `text-${def.year}`;
      const plantedBefore = [...state.planted];
      const { cells, outcome } = await textRound(def, data, state, settings);
      for (const f of outcome.fixes) if (f.type === 'tree' || f.type === 'pond') state.planted[f.district] += f.type === 'pond' ? 2 : 1;
      const action = await reportScreen({ def, cells, data, outcome, state, final: !!def.final });
      const lost = outcome.result.pct < LOSE_BELOW;
      if (action === 'retry' || (lost && !def.final)) { state.planted = plantedBefore; continue; }
      const tension = outcome.result.districts.filter((d) => !d.safe).length / N;
      state.results[i] = resultRecord(def, { cells, tension, rainFor: () => (def.real ? data.power[def.year].aprRain : data.power[2024].aprRain) }, outcome);
      state.roundIndex = i + 1;
      saveProgress(state);
      break;
    }
  }
}
