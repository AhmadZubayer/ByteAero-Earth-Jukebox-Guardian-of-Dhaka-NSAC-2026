// Earth Record (the six rounds as one piece, downloadable as WAV) and the Earth Listener Ticket.
import { h, show, button, stars } from '../ui/dom.js';
import { say } from '../ui/announce.js';
import { audio } from '../audio/engine.js';
import { composeRecord, SEGMENT, describeMusic } from '../audio/sonify.js';
import { renderRecord, wavBlob } from '../audio/recorder.js';
import { ROUNDS, CHOICES } from './rounds.js';
import { newState } from './flow.js';
import { clearProgress } from '../core/save.js';
import { visualizer } from '../ui/visualizer.js';

function recordRounds(state) {
  return state.results.filter(Boolean).map((r) => ({
    year: r.year, rowLst: r.rowLst, meanLst: r.meanLst, ndvi: r.ndvi, rain: r.rain, tension: r.tension, protectedPct: r.pct,
  }));
}

export function earthRecord(state, data, settings) {
  return new Promise((resolve) => {
    const rounds = recordRounds(state);
    const segs = rounds.map((r, i) => h('li', { class: 'seg', style: `--pct:${r.protectedPct}` },
      h('strong', {}, String(r.year)), h('span', {}, `${r.protectedPct}%`), h('small', {}, ROUNDS[i]?.real ? 'NASA data' : 'imagined')));
    const bar = h('ol', { class: 'record-bar', 'aria-label': 'The six parts of the Earth Record' }, segs);
    const nowText = h('p', { 'aria-live': 'polite', class: 'note' }, 'Press Play to hear your record.');
    let playing = false, timer = null, startAt = 0, sub = null;
    const stopVis = () => { clearInterval(timer); segs.forEach((s) => s.classList.remove('now')); playing = false; playBtn.textContent = 'Play the Earth Record'; try { sub?.disconnect(); } catch { /* gone */ } sub = null; };
    const playBtn = button('Play the Earth Record', async () => {
      await audio.unlock();
      if (playing) { stopVis(); return; }
      if (!audio.ready || !settings.sound) { nowText.textContent = 'Sound is off. Each part is described below.'; return; }
      playing = true; playBtn.textContent = 'Stop';
      startAt = audio.now + 0.1;
      // Play into a sub-bus so Stop can cut everything that is already scheduled.
      sub = audio.ctx.createGain();
      sub.connect(audio.bus.music);
      const dur = composeRecord(audio.ctx, { music: sub, fx: sub }, startAt, rounds);
      let last = -1;
      timer = setInterval(() => {
        const el = audio.now - startAt;
        const k = Math.floor(el / SEGMENT);
        if (k !== last && k < rounds.length && k >= 0) {
          last = k;
          segs.forEach((s, i) => s.classList.toggle('now', i === k));
          const r = rounds[k];
          nowText.textContent = `${r.year}: ${describeMusic({ heatC: r.meanLst, tension: r.tension, rain: r.rain, ndvi: r.ndvi })} Ends ${r.protectedPct >= 50 ? 'on the home note: the city was protected' : 'on an unresolved note: too much of the city was left in the heat'}.`;
        }
        if (el > dur) stopVis();
      }, 200);
    }, '', { 'data-autofocus': true });
    const dl = h('a', { class: 'btn secondary', href: '#', role: 'button' }, 'Download as WAV');
    dl.addEventListener('click', async (e) => {
      if (dl.dataset.ready) return; // let the browser follow the prepared link
      e.preventDefault();
      dl.textContent = 'Making the WAV…';
      try {
        const buf = await renderRecord(rounds);
        const url = URL.createObjectURL(wavBlob(buf));
        dl.href = url; dl.download = `earth-record-${(state.name || 'listener').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.wav`;
        dl.dataset.ready = '1';
        dl.textContent = `Download WAV (${Math.round(buf.duration)} s)`;
        window.__wavBytes = buf.length * buf.numberOfChannels * 2 + 44;
        dl.click();
      } catch (err) {
        dl.textContent = 'Could not make the WAV on this browser';
        console.warn(err);
      }
    });
    const message = ROUNDS.map((r) => r.fragment).join(' ');
    show(h('section', { class: 'panel wide', 'aria-labelledby': 'rec-h' },
      h('p', { class: 'kicker' }, 'Earth Record'),
      h('h2', { id: 'rec-h' }, 'Your six years as one piece of music'),
      h('p', {}, `Each part is one year (${SEGMENT.toFixed(1)} seconds). The sitar plays the five rows of the city from north to south, then the city average: higher notes for hotter ground. The tabla follows April rain, the flute follows green cover. A year ends on the home note if you protected the city, and on an unresolved note if not.`),
      bar,
      visualizer({ height: 120 }),
      h('div', { class: 'row' }, playBtn, dl),
      nowText,
      h('details', {}, h('summary', {}, 'Describe every part in words'),
        h('ul', {}, rounds.map((r, i) => h('li', {}, `${r.year}${ROUNDS[i]?.real ? '' : ' (imagined)'}: ${r.protectedPct}% protected. ${describeMusic({ heatC: r.meanLst, tension: r.tension, rain: r.rain, ndvi: r.ndvi, year: r.year })}`)))),
      h('h3', {}, 'The message, put back together'),
      h('p', { class: 'fragment' }, message),
      h('p', { class: 'note' }, 'The music is original, made live in your browser from NASA data. It is inspired by NASA sonification projects; it is not official NASA audio.'),
      h('div', { class: 'row end' }, button('Get my ticket', () => { if (playing) stopVis(); resolve(); })),
    ));
    say('Earth Record ready. Press Play to hear all six years.');
  });
}

export function ticket(state, badges) {
  return new Promise(() => {
    const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const results = state.results.filter(Boolean);
    const energy = state.energy ? CHOICES.energy[state.energy].label : '—';
    const land = state.land ? CHOICES.land[state.land].label : '—';
    show(h('section', { class: 'panel wide', 'aria-labelledby': 'tk-h' },
      h('div', { class: 'ticket' },
        h('p', { class: 'kicker' }, 'Earth Listener Ticket'),
        h('h2', { id: 'tk-h' }, state.name || 'Earth Explorer'),
        h('p', {}, `Guardian of Dhaka · ${date}`),
        h('div', { class: 'grid' },
          h('div', { class: 'cell' }, 'Dhaka protected, average', h('b', {}, `${badges.avg}%`)),
          h('div', { class: 'cell' }, 'Stars', h('b', {}, `${results.reduce((s, r) => s + r.stars, 0)} / ${results.length * 3}`)),
          h('div', { class: 'cell' }, 'Future chosen', h('b', { style: 'font-size:17px' }, `${energy}, ${land}`))),
        h('table', { class: 'data-table' },
          h('caption', { class: 'sr-only' }, 'Results by year'),
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Year'), h('th', { scope: 'col' }, 'Protected'), h('th', { scope: 'col' }, 'Stars'), h('th', { scope: 'col' }, 'Data'))),
          h('tbody', {}, results.map((r) => h('tr', {}, h('th', { scope: 'row' }, String(r.year)), h('td', {}, `${r.pct}%`), h('td', {}, stars(r.stars)), h('td', {}, r.real ? 'NASA MODIS + POWER' : 'imagined'))))),
        h('h3', {}, 'Badges'),
        badges.list.length ? h('div', {}, badges.list.map((b) => h('span', { class: 'badge' }, `🏅 ${b.name}`, h('small', {}, ` · ${b.why}`)))) : h('p', {}, 'No badges this time. Play again to earn Heat Hunter, City Cooler and Future Maker.'),
        h('p', { class: 'note' }, 'Heat per block from NASA MODIS land surface temperature (not air temperature); weather from NASA POWER; global frames from NASA SVS 5060 and GISTEMP. Streets, people, 2035 and 2050 are imagined. Cooling effects are game estimates.'),
        h('p', { class: 'team' }, 'Earth Jukebox: Guardian of Dhaka · Team BYTEAERO, AIUB · NASA Space Apps Challenge 2026')),
      h('div', { class: 'row no-print' },
        button('Print ticket', () => window.print(), '', { 'data-autofocus': true }),
        button('Play again', () => { clearProgress(); window.__state = newState(); location.href = location.pathname; }, 'secondary')),
    ));
    say(`Your ticket: ${badges.avg} percent of Dhaka protected on average. ${badges.list.length ? `Badges: ${badges.list.map((b) => b.name).join(', ')}.` : ''}`);
  });
}
