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

const STEPS = 5;

export async function tutorial(rt, settings) {
  const scene = rt.stage.scene;
  const waves = new SoundWaves(scene);
  waves.enabled = !settings.reducedMotion;
  const fx = new Effects(scene);
  const palm = await loadModel('tree-round');
  const cond = new Conductor(audio);
  cond.set({ tension: 0.3, rain: 0, ndvi: 0.5, tempo: 80, droneGain: 0.45 });
  cond.onBeaconNote = (b, f, p) => waves.spawn(b.x, b.z, f, p);
  const marker = new THREE.Mesh(new THREE.RingGeometry(1.6, 2, 48), new THREE.MeshBasicMaterial({ color: '#ffd34d', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2; marker.renderOrder = 3;
  scene.add(marker);
  rt.player.pos.set(0, 0, 30); rt.player.facing = Math.PI; rt.follow.snapBehind(Math.PI);

  let skip = null;
  const skipped = new Promise((r) => { skip = r; });
  const text = h('p', { class: 'tut-text' });
  const keys = h('p', { class: 'tut-keys' });
  const count = h('p', { class: 'tut-count' });
  const status = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const viz = visualizer({ height: 54, compact: true });
  const card = h('section', { class: 'tut-card', 'aria-labelledby': 'tut-h' },
    h('h2', { id: 'tut-h', class: 'tut-title' }, 'Tutorial'), count, text, keys, viz, status,
    h('div', { class: 'row' }, button('Skip tutorial', () => skip('skip'), 'secondary small')));
  show(card);
  const step = (n, main, hint) => {
    count.textContent = `Step ${n} of ${STEPS}`;
    text.textContent = main;
    keys.textContent = hint;
    status.textContent = `Step ${n} of ${STEPS}. ${main} ${hint}`;
    say(main, { caption: false });
  };
  const frameLoop = (fn) => new Promise((resolve) => {
    const off = rt.onFrame((dt) => {
      waves.update(dt); fx.update(dt);
      marker.material.opacity = 0.55 + Math.sin(performance.now() / 180) * 0.35;
      cond.player = { x: rt.player.pos.x, z: rt.player.pos.z };
      if (fn(dt)) { off(); resolve('done'); }
    });
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
    marker.position.set(0, 0.25, 14); marker.visible = true;
    step(1, 'Walk to the yellow circle.', rt.input.isTouch ? 'Use the joystick on the left. Drag the screen to look around.' : 'Keys: W A S D or the arrow keys. Hold Shift to run. Drag the mouse to look around.');
    if (await race(frameLoop(() => near(0, 14, 2.4))) !== 'done') throw 'skip';
    chime(); fx.sparkle(marker.position);

    // 2. Follow the sound
    marker.visible = false;
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

    // 4. Plant a tree
    const tree = { x: spot.x > 0 ? 6.6 : -6.6, z: -14 };
    marker.position.set(tree.x, 0.3, tree.z); marker.scale.setScalar(0.7); marker.visible = true;
    step(4, 'Plant a tree in the yellow circle.', rt.input.isTouch ? 'Walk next to the circle, then tap Place. Trees give shade and cool the street.' : 'Walk next to the circle, press 1 to choose Tree, then press E to plant it. Trees give shade and cool the street.');
    rt.input.on('pick', (n) => { if (n === 1) say('Tree selected.'); });
    const planted = new Promise((res) => rt.input.on('act', () => {
      if (!near(tree.x, tree.z, 3.2)) { say('Get closer to the yellow circle first.'); return; }
      const t = instance(palm); t.scale.setScalar(0.01); t.position.set(tree.x, 0.02, tree.z); scene.add(t);
      const o = { s: 0.01 }; const t0 = performance.now();
      const grow = rt.onFrame(() => { o.s = Math.min(1.25, 0.01 + ((performance.now() - t0) / 900) * 1.25); t.scale.setScalar(o.s); if (o.s >= 1.25) grow(); });
      rt.world.addBox(tree.x, tree.z, 0.6, 0.6, 9);
      fx.leaves(new THREE.Vector3(tree.x, 0, tree.z));
      rt.player.emote('Interact');
      chime();
      marker.visible = false;
      say('Tree planted! It will cool this street.');
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
    scene.remove(marker, fx.batch);
    for (const a of ['where', 'scan', 'act', 'pick']) rt.input.on(a, null);
    clear();
  }
  return result;
}
