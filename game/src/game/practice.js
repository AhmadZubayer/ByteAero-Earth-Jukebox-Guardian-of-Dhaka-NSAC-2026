// Sound Lab, Quick Ears and the beacon hunt: learning to hear heat, rain and green.
import { h, show, button, dialogue, clear } from '../ui/dom.js';
import { say, directionWords, vibrate, relAngle } from '../ui/announce.js';
import { audio } from '../audio/engine.js';
import { Conductor, describeMusic, playClip, MAP } from '../audio/sonify.js';
import { sitar } from '../audio/instruments.js';
import { visualizer } from '../ui/visualizer.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function legendButtons() {
  const play = (kind, text) => () => { playClip(audio, kind); say(text); };
  return h('div', { class: 'row', role: 'group', 'aria-label': 'Audio legend: reference sounds' },
    button('Cool reference', play('cool-ref', 'Cool reference: one low, soft flute note.'), 'small cool'),
    button('Hot reference', play('hot-ref', 'Hot reference: one high, bright sitar note that bends upward.'), 'small'),
    button('Missing data', play('missing', 'Missing data: silence with a soft click.'), 'small secondary'));
}

export function soundLab(rt) {
  return new Promise((resolve) => {
    const cond = new Conductor(audio);
    const vals = { heat: 30, rain: 3, green: 0.45 };
    const desc = h('p', { id: 'lab-desc', 'aria-live': 'polite' });
    let playing = false;
    let debounce = null;
    const apply = () => {
      const tension = MAP.heat01(vals.heat);
      cond.set({ heatC: vals.heat, tension, rain: vals.rain, ndvi: vals.green, tempo: 84 });
      cond.clearBeacons();
      if (playing) cond.addBeacon({ x: 0, z: -20, lst: vals.heat, strength: 0.8 });
      rt?.stage.setHeatLook(tension * 0.8);
      clearTimeout(debounce);
      debounce = setTimeout(() => { desc.textContent = describeMusic({ heatC: vals.heat, tension, rain: vals.rain, ndvi: vals.green }); }, 350);
    };
    const slider = (id, label, min, max, step, unit, key, fmt) => {
      const out = h('output', { for: id }, fmt(vals[key]) + unit);
      const input = h('input', { type: 'range', id, min, max, step, value: vals[key], 'aria-valuetext': fmt(vals[key]) + unit });
      input.addEventListener('input', () => {
        vals[key] = +input.value; out.textContent = fmt(vals[key]) + unit; input.setAttribute('aria-valuetext', fmt(vals[key]) + unit); apply();
      });
      return h('div', { class: 'slider' }, h('label', { for: id }, label), input, out);
    };
    const toggle = button('Play the mix', async () => {
      await audio.unlock();
      playing = !playing;
      toggle.setAttribute('aria-pressed', String(playing));
      toggle.textContent = playing ? 'Stop the mix' : 'Play the mix';
      if (playing) { cond.start(); apply(); say('Sound Lab mix playing.'); } else cond.stop();
    }, '', { 'aria-pressed': 'false', 'data-autofocus': true });

    show(h('section', { class: 'panel', 'aria-labelledby': 'lab-h' },
      h('p', { class: 'kicker' }, 'Sound Lab'),
      h('h2', { id: 'lab-h' }, 'How the city becomes music'),
      h('p', {}, 'Move the three controls and listen. Heat changes the sitar melody and makes the scale tense. Rain sets the tabla drum. Green space brings in the flute and keeps the drone in tune.'),
      h('p', { class: 'note' }, h('span', { class: 'label estimate' }, 'Practice values'), ' These controls are for practice. In the rounds the same rules are driven by NASA data.'),
      slider('lab-heat', 'Heat', 26, 37, 0.5, ' °C', 'heat', (v) => v.toFixed(1)),
      slider('lab-rain', 'Rain', 0, 10, 0.5, ' mm/day', 'rain', (v) => v.toFixed(1)),
      slider('lab-green', 'Green', 0.1, 0.7, 0.05, ' NDVI', 'green', (v) => v.toFixed(2)),
      visualizer({ height: 130 }),
      desc,
      h('div', { class: 'row' }, toggle),
      h('h3', {}, 'Audio legend'),
      h('p', {}, 'Play these any time from the menu to compare.'),
      legendButtons(),
      h('div', { class: 'row end' }, button('Next: Quick Ears', () => { cond.stop(); resolve(); })),
    ));
    apply();
    desc.textContent = describeMusic({ heatC: vals.heat, tension: MAP.heat01(vals.heat), rain: vals.rain, ndvi: vals.green });
  });
}

const CLUES = {
  heat: { word: 'Heat', text: 'a fast rising sitar line with tense notes over a wobbly drone', hint: 'Heat is the bright sitar climbing up, with sharp, uneasy notes.' },
  rain: { word: 'Rain', text: 'a quick tabla drum pattern', hint: 'Rain plays the tabla drum. More rain, busier drum.' },
  green: { word: 'Green space', text: 'a soft flute melody over a calm drone', hint: 'Green space is the gentle flute.' },
};

export function quickEars(settings) {
  return new Promise((resolve) => {
    const order = ['heat', 'green', 'rain', 'heat', 'green', 'rain', 'heat'];
    let i = 0, correct = 0;
    const need = 3;
    const status = h('p', { 'aria-live': 'polite' });
    const clueText = h('p', { class: 'note' });
    const answers = h('div', { class: 'choice-grid', role: 'group', 'aria-label': 'What did you hear?' });
    const playIt = async () => {
      await audio.unlock();
      const k = order[i % order.length];
      const sound = settings.sound && audio.ready;
      if (sound) playClip(audio, k);
      clueText.textContent = sound ? `Clue ${i + 1}: listen…` : `Clue ${i + 1} (sound is off): you would hear ${CLUES[k].text}.`;
      if (sound) say(`Clue ${i + 1} playing.`, { caption: false });
    };
    const answer = async (pick) => {
      const k = order[i % order.length];
      if (pick === k) {
        correct++;
        status.textContent = `Yes! That was ${CLUES[k].word.toLowerCase()}: ${CLUES[k].text}. ${correct} of ${need} correct.`;
        say(status.textContent);
        i++;
        if (correct >= need) { await wait(900); finish(); return; }
        await wait(1100);
        playIt();
      } else {
        status.textContent = `Not quite. ${CLUES[k].hint} Listen again.`;
        say(status.textContent);
        await wait(700);
        playIt();
      }
    };
    for (const k of ['heat', 'rain', 'green']) answers.append(h('button', { type: 'button', class: 'choice', onclick: () => answer(k) }, h('strong', {}, CLUES[k].word), h('span', {}, CLUES[k].text)));
    const finish = () => resolve(correct);
    show(h('section', { class: 'panel', 'aria-labelledby': 'qe-h' },
      h('p', { class: 'kicker' }, 'Quick Ears'),
      h('h2', { id: 'qe-h' }, 'Name that sound'),
      h('p', {}, `Listen to each short clue and choose heat, rain or green space. Get ${need} right to finish.`),
      clueText,
      visualizer({ height: 110 }),
      h('div', { class: 'row' }, button('Play the clue again', playIt, 'secondary', { 'data-autofocus': true })),
      answers,
      status,
      h('div', { class: 'row end' }, button('Skip practice', finish, 'secondary small')),
    ));
    playIt();
  });
}

// Find a hidden sound on the practice street by ear. Resolves with seconds taken.
export async function beaconHunt(rt, settings) {
  await audio.unlock();
  const cond = new Conductor(audio);
  cond.set({ tension: 0.3, rain: 0, ndvi: 0.5, tempo: 80, droneGain: 0.5 });
  const spot = { x: Math.random() < 0.5 ? -5.5 : 5.5, z: -22 - Math.random() * 14 };
  rt.player.pos.set(0, 0, 30); rt.player.facing = Math.PI; rt.follow.snapBehind(Math.PI);
  if (settings.sound) { cond.start(); cond.addBeacon({ x: spot.x, z: spot.z, lst: 33 }); }
  clear();
  await dialogue({ text: 'A secret sound is hidden on this street. I will not show it. Walk toward the sitar notes. They get louder, higher and faster as you get close. Press R, or the Where? button, and I will tell you the direction in words.', options: [{ label: 'Start listening', value: true }] });
  rt.setPlayerActive(true);
  say('Beacon hunt started. Follow the rising sitar notes.');
  const started = performance.now();
  return new Promise((resolve) => {
    let lastBuzz = 0;
    const where = () => {
      const p = rt.player.pos;
      const rel = relAngle(rt.follow.yaw, spot.x - p.x, spot.z - p.z);
      say(`Echo: the sound is ${directionWords(rel, Math.hypot(spot.x - p.x, spot.z - p.z))}.`);
    };
    rt.input.on('where', where);
    const off = rt.onFrame(() => {
      const p = rt.player.pos;
      cond.player = { x: p.x, z: p.z };
      const d = Math.hypot(spot.x - p.x, spot.z - p.z);
      if (d < 12 && settings.vibration && performance.now() - lastBuzz > 1500) { vibrate(40); lastBuzz = performance.now(); }
      if (d < 3.5) {
        off();
        rt.input.on('where', null);
        const secs = (performance.now() - started) / 1000;
        cond.stop();
        if (audio.ready) [12, 16, 19, 24].forEach((s, k) => sitar(audio.ctx, audio.bus.fx, audio.now + k * 0.12, { f: 146.83 * 2 ** (s / 12), gain: 0.4 }));
        rt.echo.scan(p, { size: 14, dur: 1.2, color: '#ffd34d' });
        rt.player.emote('Wave');
        say(`Found it in ${Math.round(secs)} seconds, by ear!`, { urgent: true });
        rt.setPlayerActive(false);
        resolve(secs);
      }
    });
  });
}
