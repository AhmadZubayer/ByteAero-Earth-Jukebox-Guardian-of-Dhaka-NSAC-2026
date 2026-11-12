// Street traffic: cycle rickshaws (a pedalling puller and one or two passengers) and green CNG
// auto-rickshaws (a driver and passengers). They keep to the left, as in Bangladesh, slow down
// behind each other, and stop with a bell or horn when the child is in the way.
import * as THREE from 'three';
import { makeRickshaw, makeCNG } from './props.js';
import { Animated } from '../player/character.js';
import { audio } from '../audio/engine.js';

const CLOTHES = [
  { Shirt: '#c0392b', Pants: '#2c3e50' }, { Shirt: '#1abc9c', Pants: '#34495e' }, { Shirt: '#8e44ad', Pants: '#2d2d2d' },
  { Shirt: '#f39c12', Pants: '#3e2723' }, { Shirt: '#ecf0f1', Pants: '#5d4037' }, { Shirt: '#e84393', Pants: '#2d3436' },
];
const PULLER = [{ LightBrown: '#d9d2c3', LightBlue: '#3b4a5a' }, { LightBrown: '#5b8bd9', LightBlue: '#2b2b2b' }, { LightBrown: '#e8e1cf', LightBlue: '#6b5b45' }];

function bell(x, z, kind) {
  if (!audio.ready) return;
  const ctx = audio.ctx, v = audio.voice({ x, y: 1.2, z, ref: 5, rolloff: 1.4, bus: 'fx' }), t = audio.now;
  const tones = kind === 'cng' ? [[440, 0.18], [554, 0.18]] : [[2637, 0.6], [3951, 0.35]]; // horn or bicycle bell
  for (let rep = 0; rep < (kind === 'cng' ? 1 : 2); rep++) {
    for (const [f, a] of tones) {
      const o = ctx.createOscillator(); o.type = kind === 'cng' ? 'square' : 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); const st = t + rep * 0.18;
      g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(a * 0.25, st + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, st + (kind === 'cng' ? 0.25 : 0.5));
      o.connect(g).connect(v.input); o.start(st); o.stop(st + 0.6);
    }
  }
  setTimeout(() => v.dispose(), 1200);
}

export class Traffic {
  // models: { 'person-a', 'person-c' } glTFs. routes: [{ along: 'z'|'x', line, min, max }] road centre lines.
  constructor(scene, models, routes, { count = 8, cngShare = 0.35 } = {}) {
    this.scene = scene;
    this.vehicles = [];
    this.routes = routes;
    for (let k = 0; k < count; k++) {
      const isCng = k % 3 === 2 && Math.random() < cngShare + 0.5;
      const group = isCng ? makeCNG(k) : makeRickshaw(k);
      const riders = [];
      if (isCng) {
        riders.push(this.sit(models['person-a'], group, 0, 0.47, 0.42, CLOTHES[(k + 1) % CLOTHES.length]));
        riders.push(this.sit(models['person-a'], group, -0.25, 0.47, -0.55, CLOTHES[k % CLOTHES.length]));
        if (k % 2) riders.push(this.sit(models['person-a'], group, 0.25, 0.47, -0.55, CLOTHES[(k + 2) % CLOTHES.length]));
      } else {
        // The puller stands on the pedals; the walk cycle reads as pedalling.
        const p = new Animated(models['person-c'], { scale: 0.84, colors: PULLER[k % 3] });
        p.root.position.set(0, 0.2, 0.72);
        p.play('Walk');
        group.add(p.root);
        riders.push(p);
        p.pedals = true;
        const two = k % 2 === 1;
        riders.push(this.sit(models['person-a'], group, two ? -0.24 : 0, 0.5, -0.36, CLOTHES[k % CLOTHES.length]));
        if (two) riders.push(this.sit(models['person-a'], group, 0.24, 0.5, -0.36, CLOTHES[(k + 3) % CLOTHES.length]));
      }
      const route = routes[k % routes.length];
      const v = {
        group, riders, kind: isCng ? 'cng' : 'rickshaw', route,
        s: route.min + ((k * 37) % Math.max(1, route.max - route.min)), dir: k % 2 ? -1 : 1,
        cruise: isCng ? 5.5 + (k % 3) * 0.5 : 2.4 + (k % 3) * 0.4, speed: 0, lastBell: 0,
      };
      v.speed = v.cruise;
      scene.add(group);
      this.vehicles.push(v);
    }
  }

  sit(gltf, group, x, y, z, colors, scale = 0.37, clip = 'Female_Sitting') {
    const p = new Animated(gltf, { scale, colors });
    p.root.position.set(x, y, z);
    if (!p.play(clip)) p.play('Idle');
    p.update(0.6); // a still seated pose; no need to animate every frame
    p.still = true;
    group.add(p.root);
    return p;
  }

  update(dt, player) {
    const now = performance.now();
    for (const v of this.vehicles) {
      const r = v.route, lane = 1.7 * v.dir; // keep left: +x when heading +z, -z when heading +x
      const ahead = (px, pz) => (r.along === 'z' ? { a: (pz - v.s) * v.dir, l: Math.abs(px - (r.line + lane)) } : { a: (px - v.s) * v.dir, l: Math.abs(pz - (r.line - lane)) });
      let want = v.cruise;
      if (player) {
        const q = ahead(player.x, player.z);
        if (q.a > 0 && q.a < 5.5 && q.l < 1.6) {
          want = 0;
          if (now - v.lastBell > 3500) { v.lastBell = now; const wp = v.group.position; bell(wp.x, wp.z, v.kind); }
        }
      }
      for (const o of this.vehicles) { // do not drive into the one in front
        if (o === v || o.route !== r || o.dir !== v.dir) continue;
        const gap = (o.s - v.s) * v.dir;
        if (gap > 0 && gap < 4.5) want = Math.min(want, o.speed * 0.9);
      }
      v.speed += (want - v.speed) * Math.min(1, dt * (want < v.speed ? 5 : 1.5));
      v.s += v.dir * v.speed * dt;
      if (v.s > r.max) { v.s = r.max; v.dir = -1; }
      if (v.s < r.min) { v.s = r.min; v.dir = 1; }
      const g = v.group;
      if (r.along === 'z') { g.position.set(r.line + 1.7 * v.dir, 0, v.s); g.rotation.y = v.dir > 0 ? 0 : Math.PI; }
      else { g.position.set(v.s, 0, r.line - 1.7 * v.dir); g.rotation.y = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      for (const w of g.userData.wheels) w.rotation.x += dt * v.speed * 3.2;
      for (const p of v.riders) {
        if (p.still) continue;
        if (p.pedals) {
          const moving = v.speed > 0.3;
          if (p.action('Walk')) p.action('Walk').timeScale = moving ? 0.5 + v.speed * 0.35 : 0;
        }
        p.update(dt);
      }
    }
  }

  dispose() {
    for (const v of this.vehicles) this.scene.remove(v.group);
    this.vehicles = [];
  }
}
