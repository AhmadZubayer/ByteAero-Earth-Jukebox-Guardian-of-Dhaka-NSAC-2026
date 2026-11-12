// A short hands-on tutorial on the practice street: move, follow a sound, scan, plant a tree.
// One clear instruction at a time, always on screen, with a Skip button.
import * as THREE from 'three';
import { h, show, button, clear } from '../ui/dom.js';
import { say, directionWords, relAngle } from '../ui/announce.js';
import { audio } from '../audio/engine.js';
import { Conductor, playScan } from '../audio/sonify.js';
import { sitar } from '../audio/instruments.js';
import { SoundWaves } from '../world/soundwaves.js';
import { Effects } from '../world/effects.js';
import { loadModel, instance } from '../core/assets.js';
import { visualizer } from '../ui/visualizer.js';
import { Target } from '../world/target.js';
import { pickTree } from '../ui/treePicker.js';

const STEPS = 5;

export async function tutorial(rt, settings) {
  const scene = rt.stage.scene;
  const waves = new SoundWaves(scene);
  waves.enabled = !settings.reducedMotion;
  const fx = new Effects(scene);
  const treeModels = [await loadModel('palm'), await loadModel('tree-round'), await loadModel('tree-tall')];
  const TREE_SCALE = [2.6, 1.25, 1.35];
  const cond = new Conductor(audio);
  cond.set({ tension: 0.3, rain: 0, ndvi: 0.5, tempo: 80, droneGain: 0.45 });
  cond.onBeaconNote = (b, f, p) => waves.spawn(b.x, b.z, f, p);
  const target = new Target(scene);
  window.__tutTarget = target; // test hook
  rt.player.pos.set(0, 0, 30); rt.player.facing = Math.PI; rt.follow.snapBehind(Math.PI);

  let skip = null;
  const skipped = new Promise((r) => { skip = r; });
  const text = h('p', { class: 'tut-text' });
  const keys = h('p', { class: 'tut-keys' });
  const where = h('p', { class: 'tut-where', 'aria-hidden': 'true' });
  const extra = h('div', { class: 'row tut-extra' });
  const count = h('p', { class: 'tut-count' });
  const status = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const viz = visualizer({ height: 54, compact: true });
  const card = h('section', { class: 'tut-card', 'aria-labelledby': 'tut-h' },
    h('h2', { id: 'tut-h', class: 'tut-title' }, 'Tutorial'), count, text, keys, where, extra, viz, status,
    h('div', { class: 'row' }, button('Skip tutorial', () => skip('skip'), 'secondary small')));
  show(card);
  const step = (n, main, hint) => {
    count.textContent = `Step ${n} of ${STEPS}`;
    text.textContent = main;
    keys.textContent = hint;
    status.textContent = `Step ${n} of ${STEPS}. ${main} ${hint}`;
    say(main, { caption: false });
  };
  // Runs for the whole tutorial: effects, the target marker and the "where is the circle" line.
  let lastWhere = 0;
  const always = rt.onFrame((dt) => {
    waves.update(dt); fx.update(dt); target.update(dt, settings.reducedMotion);
    cond.player = { x: rt.player.pos.x, z: rt.player.pos.z };
    if (performance.now() - lastWhere < 250) return;
    lastWhere = performance.now();
    if (target.group.visible) {
      const tp = target.group.position, p = rt.player.pos, d = Math.hypot(tp.x - p.x, tp.z - p.z);
      where.textContent = d < 2.6 ? 'You are in the yellow circle ✔' : `Yellow circle: ${directionWords(relAngle(rt.follow.yaw, tp.x - p.x, tp.z - p.z), d)}`;
    } else where.textContent = '';
  });
  const frameLoop = (fn) => new Promise((resolve) => {
    const off = rt.onFrame((dt) => { if (fn(dt)) { off(); resolve('done'); } });
    skipped.then(() => off());
  });
  const race = (p) => Promise.race([p, skipped]);
  const chime = () => { if (audio.ready) [0, 4, 7, 12].forEach((s, k) => sitar(audio.ctx, audio.bus.fx, audio.now + k * 0.09, { f: 293.66 * 2 ** (s / 12), gain: 0.3 })); };
  const near = (x, z, d) => Math.hypot(rt.player.pos.x - x, rt.player.pos.z - z) < d;

  await audio.unlock();
  rt.setPlayerActive(true);
  let result = 'done';
  try {
    // 1. Move
    target.show(0, 14);
    step(1, 'Walk to the yellow circle.', rt.input.isTouch ? 'Use the joystick on the left. Drag the screen to look around.' : 'Keys: W A S D or the arrow keys. Hold Shift to run. Drag the mouse to look around.');
    if (await race(frameLoop(() => near(0, 14, 2.4))) !== 'done') throw 'skip';
    chime(); fx.sparkle(new THREE.Vector3(0, 0, 14));

    // 2. Follow the sound
    target.hide();
    const spot = { x: Math.random() < 0.5 ? -5.5 : 5.5, z: -26 };
    if (settings.sound) { cond.start(); cond.addBeacon({ x: spot.x, z: spot.z, lst: 33 }); }
    step(2, 'Listen! That rising sitar is the sound of heat. Walk toward it.', 'It gets louder, higher and faster as you get close. The rings show where it comes from. Stuck? Press R (or Where?) and Echo tells you the way.');
    rt.input.on('where', () => say(`Echo: the sound is ${directionWords(relAngle(rt.follow.yaw, spot.x - rt.player.pos.x, spot.z - rt.player.pos.z), Math.hypot(spot.x - rt.player.pos.x, spot.z - rt.player.pos.z))}.`));
    if (!settings.sound) waves.enabled = true;
    const silentRings = setInterval(() => { if (!settings.sound) waves.spawn(spot.x, spot.z, 500, 0); }, 1200);
    const r2 = await race(frameLoop(() => near(spot.x, spot.z, 4)));
    clearInterval(silentRings);
    if (r2 !== 'done') throw 'skip';
    cond.clearBeacons();
    cond.onBeaconNote = null; waves.clear(); // the heat call is found: no more rings
    chime(); fx.sparkle(new THREE.Vector3(spot.x, 0, spot.z)); rt.player.emote('Wave');
    say('You found the heat by listening!');

    // 3. Scan
    step(3, 'Now ask Echo to scan.', rt.input.isTouch ? 'Tap the Scan button. Notes play all around you; the highest note points to the heat.' : 'Press Q. Notes play all around you, one direction at a time; the highest note points to the heat.');
    const scanned = new Promise((res) => rt.input.on('scan', () => {
      const p = rt.player.pos, yaw = rt.follow.yaw;
      rt.echo.scan(p);
      const target = { x: -spot.x, z: 10 }; // pretend there is more heat back down the street
      const samples = [];
      for (let k = 0; k < 8; k++) {
        const rel = (k / 8) * Math.PI * 2, a = yaw + Math.PI - rel;
        const dx = Math.sin(a), dz = Math.cos(a);
        const to = Math.atan2(target.x - p.x, target.z - p.z);
        const heat01 = (Math.cos(a - to) + 1) / 2;
        samples.push({ angle: rel, heat01, x: p.x + dx * 8, z: p.z + dz * 8 });
      }
      if (settings.sound) playScan(audio, samples, p);
      say('Scan: the highest note came from behind you, back down the street.');
      res();
    }));
    if (await race(scanned) === 'skip') throw 'skip';
    await new Promise((r) => setTimeout(r, 2200));

    // 4. Choose a tree and plant it in the circle just ahead.
    // Put the circle on the pavement a few steps in front of where the camera looks.
    const fz = -Math.cos(rt.follow.yaw);
    const tree = { x: rt.player.pos.x >= 0 ? 6.4 : -6.4, z: Math.max(-40, Math.min(40, rt.player.pos.z + (Math.abs(fz) > 0.2 ? Math.sign(fz) : -1) * 6)) };
    target.show(tree.x, tree.z, 0.8);
    let chosen = null;
    const choose = async () => {
      rt.setPlayerActive(false);
      const t = await pickTree(chosen?.key);
      rt.setPlayerActive(true);
      if (t) { chosen = t; say(`${t.name} chosen. Now stand in the yellow circle and press ${rt.input.isTouch ? 'Place' : 'E'}.`); text.textContent = `${t.name} chosen. Now plant it in the yellow circle.`; }
      return t;
    };
    step(4, 'Choose a tree, then plant it in the yellow circle.', rt.input.isTouch ? 'Tap Choose a tree. Then walk into the yellow circle and tap Place.' : 'Press 1 (or click Choose a tree). Then walk into the yellow circle and press E.');
    extra.replaceChildren(button('Choose a tree', choose, 'small green'));
    rt.input.on('pick', (n) => { if (n === 1) choose(); });
    const planted = new Promise((res) => rt.input.on('act', async () => {
      if (!chosen && !(await choose())) return;
      if (!near(tree.x, tree.z, 2.6)) { say('Walk into the yellow circle first.'); return; }
      const model = treeModels[chosen.kind], s = TREE_SCALE[chosen.kind];
      const t = instance(model); t.scale.setScalar(0.01); t.position.set(tree.x, 0.02, tree.z); scene.add(t);
      const t0 = performance.now();
      const grow = rt.onFrame(() => { const k = Math.min(1, (performance.now() - t0) / 900); t.scale.setScalar(0.01 + k * s); if (k >= 1) grow(); });
      rt.world.addBox(tree.x, tree.z, 0.6, 0.6, 9);
      fx.leaves(new THREE.Vector3(tree.x, 0, tree.z));
      rt.player.emote('Interact');
      chime();
      target.hide();
      extra.replaceChildren();
      say(`${chosen.name} planted! It will shade and cool this street.`);
      res();
    }));
    if (await race(planted) === 'skip') throw 'skip';
    await new Promise((r) => setTimeout(r, 1500));

    // 5. Ready
    step(5, 'You are ready!', 'In each year a heat wave is coming. Find the hot spot by ear, spend your coins on trees, white roofs, ponds or a cooling centre near it, before the timer ends. Protect more than half of Dhaka to win.');
    const go = button('Start the game', () => skip('done'), '', { 'data-autofocus': true });
    card.querySelector('.row').replaceChildren(go);
    go.focus();
    result = await skipped;
  } catch (e) {
    result = 'skip';
  } finally {
    rt.setPlayerActive(false);
    cond.stop();
    waves.clear();
    fx.clearLoops();
    always(); target.dispose(); scene.remove(fx.batch);
    for (const a of ['where', 'scan', 'act', 'pick']) rt.input.on(a, null);
    clear();
  }
  return result;
}
