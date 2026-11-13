// Earth Jukebox: the 1884–2022 global temperature time-lapse on a 3D globe, with a melody
// from the GISTEMP global anomaly, then Echo flies down to Dhaka.
import * as THREE from 'three';
import gsap from 'gsap';
import { Globe, FRAME_YEARS } from '../world/globe.js';
import { h, show, button, clear } from '../ui/dom.js';
import { say } from '../ui/announce.js';
import { audio } from '../audio/engine.js';
import { composeGlobe } from '../audio/sonify.js';
import { gistempSeries } from '../data/nasa.js';

const NOTE = 0.16; // seconds per year

class GlobeScene {
  constructor(globe) { this.globe = globe; this.camera = 'custom'; this.t = 0; }
  build(rt) {
    this.rt = rt;
    const s = rt.stage;
    this.saved = { bg: s.scene.background.clone(), fog: s.scene.fog };
    s.scene.background = new THREE.Color('#03060f');
    s.scene.fog = null;
    rt.player.root.visible = false;
    rt.echo.group.visible = false;
    s.scene.add(this.globe.group);
    s.setDataView(true);
    this.frame();
    this.globe.spin.rotation.y = this.globe.faceDhakaRotation() - 1.4;
  }
  // Fit the globe to the screen: large on a laptop (shifted right of the readout), higher up on a phone.
  frame() {
    const cam = this.rt.stage.camera, aspect = cam.aspect;
    const d = 27 / Math.min(1, aspect * 0.95);
    this.home = new THREE.Vector3(0, 0, d);
    this.look = new THREE.Vector3(aspect > 1.25 ? -4.2 : 0, aspect < 0.8 ? -7.5 : 0, 0);
    cam.position.copy(this.home);
    cam.lookAt(this.look);
  }
  update(dt) {
    this.t += dt;
    if (!this.flying) this.frame();
    if (!this.flying) this.globe.spin.rotation.y += dt * 0.06;
    this.globe.update(dt, this.t);
  }
  dispose() {
    const s = this.rt.stage;
    s.scene.remove(this.globe.group);
    s.scene.background = this.saved.bg;
    s.scene.fog = this.saved.fog;
    this.rt.player.root.visible = true;
    this.rt.echo.group.visible = true;
    s.setDataView(false);
    s.camera.position.set(0, 6, 10);
  }
}

export async function globeIntro(rt, data, settings) {
  const globe = new Globe();
  await globe.load(rt.stage.renderer);
  const scene = new GlobeScene(globe);
  rt.setScene(scene);
  rt.setPlayerActive(false);
  const series = gistempSeries(1884, 2022);
  const big = h('div', { class: 'big', 'aria-hidden': 'true' }, '1884');
  const anom = h('div', { 'aria-hidden': 'true' }, '');
  const frame = h('div', { class: 'legend-labels', 'aria-hidden': 'true' });
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const playBtn = button('Play the time-lapse', () => start(), '', { 'data-autofocus': true });
  const skipBtn = button('Fly to Dhaka', () => finish(), 'secondary');
  let running = false, t0 = 0, raf = 0, done = null, lastSaid = 0;

  show(h('section', { class: 'globe-hud', 'aria-labelledby': 'globe-h' },
    h('div', { class: 'globe-readout' },
      h('p', { class: 'kicker' }, 'Earth Jukebox · ', h('span', { class: 'label real' }, 'Real NASA data')),
      h('h2', { id: 'globe-h', style: 'font-size:22px;margin:0' }, 'Earth\'s temperature, 1884 to 2022'),
      big, anom,
      h('div', { class: 'legend-bar', 'aria-hidden': 'true' }),
      h('div', { class: 'legend-labels', 'aria-hidden': 'true' }, h('span', {}, 'cooler'), h('span', {}, 'average 1951–1980'), h('span', {}, 'warmer')),
      frame,
      h('p', { class: 'globe-note' }, 'Each note is one year of NASA GISTEMP global temperature: higher and tenser as the world warms.'),
      h('p', { class: 'globe-source' }, 'Frames: NASA Scientific Visualization Studio, visualization 5060 (also on the Earth Information Center).'),
      live),
    h('div', { class: 'row' }, playBtn, skipBtn),
  ));

  const tick = () => {
    const el = audio.ready ? audio.now - t0 : (performance.now() / 1000 - t0);
    const yf = 1884 + Math.max(0, el) / NOTE;
    const y = Math.min(2022, Math.floor(yf));
    const fr = globe.setYear(Math.min(2022, yf));
    const a = data.gistemp[y];
    big.textContent = String(y);
    anom.textContent = a == null ? 'no data' : `${a >= 0 ? '+' : ''}${a.toFixed(2)} °C compared with 1951–1980`;
    frame.textContent = `Showing NASA frames ${fr.from} → ${fr.to}`;
    if (y - lastSaid >= 20 || (y === 2022 && lastSaid !== 2022)) { lastSaid = y; live.textContent = `${y}: ${a == null ? 'no data' : `${a >= 0 ? 'plus' : 'minus'} ${Math.abs(a).toFixed(2)} degrees`}.`; }
    if (yf >= 2022.5) { running = false; playBtn.textContent = 'Play again'; say('The time-lapse reached 2022. The melody climbed as the world warmed: about 1.1 degrees warmer than in the 1880s.'); return; }
    raf = requestAnimationFrame(tick);
  };
  const start = async () => {
    if (running) return;
    await audio.unlock();
    running = true; lastSaid = 1864;
    playBtn.textContent = 'Playing…';
    if (audio.ready && settings.sound) {
      t0 = audio.now + 0.15;
      composeGlobe(audio.ctx, audio.bus, t0, series, NOTE);
    } else t0 = performance.now() / 1000;
    say('Time-lapse playing: 1884 to 2022. Each sitar note is one year of global temperature.');
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };
  const finish = () => {
    if (done) return;
    cancelAnimationFrame(raf);
    running = false;
    clear();
    say('Echo flies down to Dhaka, Bangladesh.');
    scene.flying = true;
    const cam = rt.stage.camera;
    const target = globe.faceDhakaRotation();
    const dur = settings.reducedMotion ? 0.4 : 3.2;
    done = new Promise((res) => {
      gsap.to(globe.spin.rotation, { y: target, duration: dur * 0.6, ease: 'power2.inOut' });
      const dhaka = globe.marker.position.clone();
      const o = { k: 0 };
      gsap.to(o, { k: 1, duration: dur, ease: 'power3.in', onUpdate: () => {
        const p = scene.home.clone().lerp(new THREE.Vector3(0, Math.sin(THREE.MathUtils.degToRad(23.8)) * 10.4, 10.9), o.k);
        cam.position.copy(p); cam.lookAt(scene.look.clone().lerp(new THREE.Vector3(0, dhaka.y, 0), o.k));
      }, onComplete: () => setTimeout(res, 250) });
    });
    return done;
  };
  // Wait until the player chooses to fly (after or instead of the time-lapse).
  await new Promise((resolve) => { skipBtn.addEventListener('click', () => done.then(resolve)); });
  rt.setScene(null);
  globe.dispose();
}

export { FRAME_YEARS };
