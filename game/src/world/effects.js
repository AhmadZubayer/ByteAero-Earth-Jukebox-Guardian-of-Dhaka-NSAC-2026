// Particles with three.quarks: heat shimmer over hot districts, leaves, splashes, cheering sparkles.
import * as THREE from 'three';
import {
  BatchedRenderer, ParticleSystem, ConeEmitter, SphereEmitter, ConstantValue, IntervalValue, ColorRange, Vector4,
  RenderMode, SizeOverLife, PiecewiseBezier, Bezier, ColorOverLife, Gradient, ApplyForce, Vector3 as QV3,
} from 'three.quarks';

let softTex = null;
function soft() {
  if (softTex) return softTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  softTex = new THREE.CanvasTexture(c);
  return softTex;
}
const v4 = (hex, a) => { const c = new THREE.Color(hex); return new Vector4(c.r, c.g, c.b, a); };

export class Effects {
  constructor(scene) {
    this.batch = new BatchedRenderer();
    scene.add(this.batch);
    this.scene = scene;
    this.loops = [];
    this.enabled = true;
  }

  material(blending = THREE.AdditiveBlending) {
    return new THREE.MeshBasicMaterial({ map: soft(), transparent: true, depthWrite: false, blending });
  }

  add(system, pos) {
    system.emitter.position.copy(pos);
    this.scene.add(system.emitter);
    this.batch.addSystem(system);
    return system;
  }

  remove(system) {
    if (!system) return;
    this.batch.deleteSystem(system);
    system.emitter.parent?.remove(system.emitter);
    system.dispose?.();
  }

  // Rising warm haze over a hot district. strength 0..1.
  shimmer(pos, strength = 1) {
    if (!this.enabled) return null;
    const s = new ParticleSystem({
      duration: 2, looping: true, worldSpace: true,
      startLife: new IntervalValue(1.6, 2.8),
      startSpeed: new IntervalValue(1.2, 2.4),
      startSize: new IntervalValue(2.2, 4.2),
      startColor: new ColorRange(v4('#ff9a3c', 0.18 * strength), v4('#ffd27a', 0.12 * strength)),
      emissionOverTime: new ConstantValue(10 + 18 * strength),
      shape: new ConeEmitter({ radius: 9, angle: 0.15 }),
      material: this.material(),
      renderMode: RenderMode.BillBoard,
      behaviors: [
        new SizeOverLife(new PiecewiseBezier([[new Bezier(0.6, 1, 1.2, 1.4), 0]])),
        new ColorOverLife(new Gradient([[new QV3(1, 0.7, 0.3), 0], [new QV3(1, 0.85, 0.5), 1]], [[0, 0], [1, 0.25], [0, 1]])),
      ],
    });
    s.emitter.rotation.x = -Math.PI / 2;
    this.loops.push(s);
    return this.add(s, pos);
  }

  burst(pos, { color = '#6fcf5a', color2 = '#a7e36b', count = 24, speed = [2, 5], life = [0.8, 1.6], size = [0.25, 0.5], gravity = 6, additive = false } = {}) {
    if (!this.enabled) return null;
    const s = new ParticleSystem({
      duration: 0.3, looping: false, worldSpace: true, autoDestroy: true,
      startLife: new IntervalValue(...life),
      startSpeed: new IntervalValue(...speed),
      startSize: new IntervalValue(...size),
      startColor: new ColorRange(v4(color, 1), v4(color2, 1)),
      emissionOverTime: new ConstantValue(0),
      emissionBursts: [{ time: 0, count: new ConstantValue(count), cycle: 1, interval: 0.01, probability: 1 }],
      shape: new SphereEmitter({ radius: 0.6, thickness: 1 }),
      material: this.material(additive ? THREE.AdditiveBlending : THREE.NormalBlending),
      renderMode: RenderMode.BillBoard,
      behaviors: [
        new ApplyForce(new QV3(0, -1, 0), new ConstantValue(gravity)),
        new ColorOverLife(new Gradient([[new QV3(1, 1, 1), 0], [new QV3(1, 1, 1), 1]], [[1, 0], [1, 0.7], [0, 1]])),
      ],
    });
    this.add(s, pos);
    setTimeout(() => this.remove(s), (life[1] + 0.6) * 1000);
    return s;
  }

  leaves(pos) { return this.burst(pos.clone().setY(pos.y + 3), { color: '#4fa84a', color2: '#9bd35a', count: 28, gravity: 3 }); }
  splash(pos) { return this.burst(pos.clone().setY(pos.y + 0.5), { color: '#5fb8ff', color2: '#d6f1ff', count: 34, speed: [3, 6], gravity: 9 }); }
  sparkle(pos) { return this.burst(pos.clone().setY(pos.y + 2), { color: '#ffd34d', color2: '#ffffff', count: 30, speed: [2, 6], gravity: 2, additive: true }); }

  clearLoops() { for (const s of this.loops) this.remove(s); this.loops = []; }

  update(dt) { this.batch.update(dt); }
}
