// Echo's report after each heat wave: the real NASA images and numbers, the outcome, the lesson.
import { h, show, button, stars } from './dom.js';
import { say } from './announce.js';
import { nasaUrl, cityStats } from '../data/nasa.js';
import { DISTRICT_NAMES, CHOICES } from '../game/rounds.js';
import { starsFor, LOSE_BELOW } from '../game/heat.js';
import { QUIZ, FACTS } from '../game/learn.js';

const fmt = (v, d = 1) => (v == null ? 'no data' : v.toFixed(d));

export function reportScreen({ def, cells, data, outcome, state, final = false }) {
  return new Promise((resolve) => {
    const res = outcome.result;
    const st = starsFor(res.pct);
    const lost = res.pct < LOSE_BELOW;
    const stats = cityStats(cells);
    const hottestIdx = cells.map((c, i) => [c.lst ?? -99, i]).sort((a, b) => b[0] - a[0])[0][1];
    const imgYear = def.real ? def.year : 2024;
    const p = data.power[imgYear];
    const sheltered = res.districts.filter((d) => d.sheltered).length;
    const fixCounts = outcome.fixes.reduce((m, f) => ((m[f.type] = (m[f.type] || 0) + 1), m), {});
    const fixText = Object.entries(fixCounts).map(([k, n]) => `${n} ${k === 'centre' ? 'cooling centre' : k === 'roof' ? 'white roof' : k}${n > 1 ? 's' : ''}`).join(', ') || 'no fixes';

    const label = def.real
      ? h('span', { class: 'label real' }, `Real NASA data · April ${def.year}`)
      : h('span', { class: 'label imagined' }, `Imagined ${def.year} · not a NASA forecast`);

    const rows = [
      ['Land surface temperature, city average', `${fmt(stats.meanLst)} °C`, def.real ? 'MODIS Terra, 8-day daytime, mid-April' : 'imagined from the 2024 pattern'],
      ['Hottest block', `${DISTRICT_NAMES[hottestIdx]}: ${fmt(cells[hottestIdx].lst)} °C`, def.real ? 'MODIS Terra' : 'imagined'],
      ['Green cover (NDVI), city average', fmt(stats.meanNdvi, 2), def.real ? 'MODIS monthly NDVI, April' : 'imagined'],
      [`Air temperature, April ${imgYear} average`, `${fmt(p.aprT2M)} °C`, 'NASA POWER, Dhaka point'],
      [`Hottest air temperature, April ${imgYear}`, `${fmt(p.aprT2MMax)} °C`, 'NASA POWER'],
      [`Rain, April ${imgYear}`, `${fmt(p.aprRain)} mm per day`, 'NASA POWER'],
    ];

    const notes = [
      'Land surface temperature is how hot the ground, roofs and roads are when the satellite passes. It is not the air temperature, and not how hot a person feels.',
      'The streets are invented. Each block\'s heat and greenness come from the matching part of the NASA image.',
      'How much a tree, roof, pond or cooling centre helps is a game estimate, not a measurement.',
    ];
    if (def.year === 2010) notes.unshift('Two snapshots are not a trend. One April can be hotter than another for many reasons, such as weather that week.');
    if (def.year === 2020) notes.unshift(`In 2020 the ground images were the hottest of our four years, while April air was the coolest (${fmt(data.power[2020].aprT2M)} °C average). Surface and air are different measurements.`);
    if (def.year === 2024) notes.unshift('Four April snapshots (2000, 2010, 2020, 2024) do not prove a climate trend by themselves. Scientists use many years of data for that.');
    if (!def.real) notes.unshift(`This year is imagined. It starts from the real 2024 images and adds your choices: ${CHOICES.energy[state.energy || 'clean'].label.toLowerCase()} and ${CHOICES.land[state.land || 'parks'].label.toLowerCase()}.`);

    const onward = [];
    if (lost && !final) {
      onward.push(button('Try this year again', () => resolve('retry')));
    } else {
      onward.push(button(final ? 'Hear the Earth Record' : 'Next year', () => resolve('next')));
      onward.push(button('Play this year again', () => resolve('retry'), 'secondary'));
    }
    if (lost && final) onward.unshift(button('Continue to the Earth Record', () => resolve('next')));

    // Quick question: check what this year taught. A right answer gives 1 bonus coin next year.
    const qz = QUIZ[def.year];
    let quizBox = null;
    if (qz) {
      const feedback = h('p', { class: 'quiz-feedback', 'aria-live': 'polite' });
      const opts = qz.options.map((o, i) => h('button', { type: 'button', class: 'choice quiz-option', onclick: () => {
        const right = i === qz.answer;
        opts.forEach((b, k) => { b.disabled = true; b.classList.toggle('right', k === qz.answer); b.classList.toggle('wrong', k === i && !right); });
        state.quiz ||= {};
        state.quiz[def.year] = right;
        if (right && !final) state.quizBonus = 1; // used next year, or on a retry of this one
        feedback.textContent = `${right ? 'Correct!' : 'Not quite.'} ${qz.why}${right && !final ? (lost ? ' Bonus: +1 coin when you try again.' : ' Bonus: +1 coin next year.') : ''}`;
        say(feedback.textContent);
      } }, h('strong', {}, String.fromCharCode(65 + i)), ` ${o}`));
      quizBox = h('section', { class: 'quiz', 'aria-labelledby': 'quiz-h' },
        h('h3', { id: 'quiz-h' }, '🧠 Quick question'), h('p', {}, qz.q), h('div', { class: 'choice-grid' }, opts), feedback);
    }
    const learnedNow = (state.learned || []).slice(state.learnedShown || 0).map((id) => FACTS[id]).filter(Boolean);
    state.learnedShown = (state.learned || []).length;
    const learnedBox = learnedNow.length ? h('section', { class: 'note learned' }, h('h3', {}, '💡 What you learned this year'), h('ul', {}, learnedNow.map((f) => h('li', {}, h('strong', {}, `${f.title}: `), f.text)))) : null;

    show(h('section', { class: 'panel wide', 'aria-labelledby': 'rep-h' },
      h('p', { class: 'kicker' }, 'Echo\'s report'),
      h('h2', { id: 'rep-h' }, `${def.year}: ${res.pct}% of Dhaka protected`),
      h('div', {}, label, h('span', { class: 'label estimate' }, 'Cooling effects are game estimates')),
      stars(st),
      h('p', {}, lost
        ? `More than half the city was left in the heat. ${final ? 'This ending is a warning, not a fate.' : 'Try again: listen for the hot spot first, then protect the blocks around it.'}`
        : `You used ${fixText}. ${res.cooledPct}% of blocks stayed cool${sheltered ? `, and people in ${sheltered} more could shelter in a cooling centre` : ''}.${outcome.byEar ? ' You found heat by ear: listener bonus!' : ''}`),
      learnedBox,
      quizBox,
      h('div', { class: 'report-img' },
        h('figure', {}, h('img', { src: nasaUrl(`nasa-modis-dhaka-lst-${imgYear}.png`), alt: `NASA MODIS land surface temperature map of the Dhaka area, mid-April ${imgYear}. Yellow is warm; deeper orange is hotter.` }),
          h('figcaption', {}, `Land surface temperature, mid-April ${imgYear} (NASA MODIS via GIBS)${def.real ? '' : ', shown as the real reference'}`)),
        h('figure', {}, h('img', { src: nasaUrl(`nasa-modis-dhaka-ndvi-${imgYear}.png`), alt: `NASA MODIS vegetation index map of the Dhaka area, April ${imgYear}. Green is plants; brown is built-up or bare ground.` }),
          h('figcaption', {}, `Vegetation (NDVI), April ${imgYear} (NASA MODIS via GIBS)`))),
      h('table', { class: 'data-table' },
        h('caption', { class: 'sr-only' }, `NASA numbers for ${def.year}`),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'What'), h('th', { scope: 'col' }, 'Value'), h('th', { scope: 'col' }, 'Source'))),
        h('tbody', {}, rows.map(([a, b, c]) => h('tr', {}, h('th', { scope: 'row' }, a), h('td', {}, b), h('td', {}, c))))),
      h('h3', {}, def.title),
      h('p', {}, def.lesson),
      h('ul', { class: 'note' }, notes.map((n) => h('li', {}, n))),
      lost && !final ? null : h('div', {}, h('p', { class: 'kicker' }, 'Message fragment recovered'), h('p', { class: 'fragment' }, `“${def.fragment}”`)),
      h('div', { class: 'row end' }, onward),
    ));
    say(`Report for ${def.year}: ${res.pct} percent protected, ${st} star${st === 1 ? '' : 's'}.`);
  });
}

export function choiceScreen() {
  return new Promise((resolve) => {
    const picked = {};
    const group = (key, title) => {
      const opts = CHOICES[key];
      const btns = Object.entries(opts).map(([k, o]) => {
        const b = h('button', { type: 'button', class: 'choice', 'aria-pressed': 'false', onclick: () => {
          picked[key] = k;
          btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          go.disabled = !(picked.energy && picked.land);
        } }, h('strong', {}, o.label), h('span', {}, o.text));
        return b;
      });
      return h('fieldset', { class: 'note', style: 'border:none' }, h('legend', {}, h('strong', {}, title)), h('div', { class: 'choice-grid' }, btns));
    };
    const go = button('Build this future', () => resolve(picked), '', { disabled: true });
    show(h('section', { class: 'panel wide', 'aria-labelledby': 'ch-h' },
      h('p', { class: 'kicker' }, '2035 · Imagined'),
      h('h2', { id: 'ch-h' }, 'Choose how Dhaka grows'),
      h('p', {}, 'The next two years are imagined. They start from the real 2024 NASA pattern and change with your choices. They are not NASA projections.'),
      group('energy', 'How will the city get its power?'),
      group('land', 'What happens to open ground?'),
      h('p', { class: 'note' }, h('span', { class: 'label estimate' }, 'Game estimates'), ' Coal makes the imagined heat waves stronger; clean energy makes them weaker. Concrete makes blocks hotter and less green; parks and water do the opposite.'),
      h('div', { class: 'row end' }, go),
    ));
  });
}
