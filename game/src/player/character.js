// Animated characters (player child and townspeople) built from the Quaternius casual models.
import * as THREE from 'three';
import { instance } from '../core/assets.js';

const tmp = new THREE.Vector3();

export function findClip(gltf, name) {
  const re = new RegExp(`(^|\\|)(Female_)?${name}$`, 'i');
  return gltf.animations.find((a) => re.test(a.name));
}

// Recolour named materials on a model copy. Each copy gets its own materials.
export function recolor(root, colors) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const next = mats.map((m) => {
      const c = colors[m.name];
      if (!c) return m;
      const n = m.clone();
      n.color = new THREE.Color(c);
      return n;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });
}

export class Animated {
  constructor(gltf, { scale = 1, colors = null, headScale = 1 } = {}) {
    this.root = new THREE.Group();
    this.model = instance(gltf);
    this.model.scale.setScalar(scale);
    if (colors) recolor(this.model, colors);
    if (headScale !== 1) {
      const head = this.model.getObjectByName('Head');
      if (head) head.scale.setScalar(headScale);
    }
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    this.gltf = gltf;
    this.current = null;
  }

  action(name) {
    if (!(name in this.actions)) {
      const clip = findClip(this.gltf, name);
      this.actions[name] = clip ? this.mixer.clipAction(clip) : null;
    }
    return this.actions[name];
  }

  play(name, { fade = 0.2, once = false, timeScale = 1 } = {}) {
    const a = this.action(name);
    if (!a) return false;
    if (this.current === a && !once) { a.timeScale = timeScale; return true; }
    a.reset();
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    a.timeScale = timeScale;
    a.enabled = true;
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    a.play();
    this.current = a;
    return true;
  }

  update(dt) { this.mixer.update(dt); }
}

// The player: a child in a saffron T-shirt.
export class Player extends Animated {
  constructor(gltf, world) {
    super(gltf, {
      scale: 0.74,
      headScale: 1.32,
      colors: { LightBrown: '#f2a93b', LightBlue: '#2c4f86', Red_Dark: '#c8423b' },
    });
    this.world = world;
    this.pos = this.root.position;
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.onGround = true;
    this.radius = 0.32;
    this.facing = 0;
    this.speed = 0;
    this.locked = false; // during an emote
    this.play('Idle');
    this.mixer.addEventListener('finished', () => { this.locked = false; });
  }

  emote(name) {
    if (this.play(name, { once: true, fade: 0.15 })) this.locked = true;
  }

  jump() {
    if (this.onGround && !this.locked) { this.vy = 5.2; this.onGround = false; }
  }

  // axes: {x,y,running}; yaw: camera yaw in radians.
  step(dt, axes, yaw) {
    const walk = 3.4, run = 6.4;
    const target = (axes.running ? run : walk) * Math.hypot(axes.x, axes.y);
    // Camera-relative direction. Camera looks along -Z when yaw = 0.
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let dx = fx * axes.y + rx * axes.x, dz = fz * axes.y + rz * axes.x;
    const len = Math.hypot(dx, dz);
    if (len > 0.001) { dx /= len; dz /= len; }
    const accel = this.onGround ? 14 : 5;
    const want = this.locked ? 0 : target;
    this.speed += (want - this.speed) * Math.min(1, accel * dt);
    if (len > 0.001 && !this.locked) {
      const ang = Math.atan2(dx, dz);
      let d = ang - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * Math.min(1, 12 * dt);
      this.vel.set(dx, 0, dz);
    }
    this.model.rotation.y = this.facing;
    const step = this.speed * dt;
    this.world.move(this.pos, this.vel.x * step, this.vel.z * step, this.radius, this.pos.y);

    // Gravity and ground (boxes the child can stand on, e.g. a step).
    this.vy -= 15 * dt;
    this.pos.y += this.vy * dt;
    const ground = this.world.groundAt(this.pos.x, this.pos.z, this.radius, this.pos.y);
    if (this.pos.y <= ground) { this.pos.y = ground; this.vy = 0; this.onGround = true; } else if (this.pos.y > ground + 0.05) this.onGround = false;

    if (!this.locked) {
      if (!this.onGround) this.play('Idle_Neutral', { fade: 0.1 }) || this.play('Idle');
      else if (this.speed > 4.6) this.play('Run', { timeScale: this.speed / 6.2 });
      else if (this.speed > 0.4) this.play('Walk', { timeScale: Math.max(0.7, this.speed / 2.6) });
      else this.play('Idle');
    }
    this.mixer.update(dt);
  }

  forward(out = tmp) { return out.set(Math.sin(this.facing), 0, Math.cos(this.facing)); }
}
