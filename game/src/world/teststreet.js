// A short practice street: used to learn to move, and for the Sound Lab beacon hunt.
import * as THREE from 'three';
import { loadModels } from '../core/assets.js';
import { InstancedModel, matrixFrom } from './instanced.js';
import { groundTextures, plane } from './ground.js';
import { makeRickshaw, makeTeaStall } from './props.js';

const BUILDINGS = ['bld-a', 'bld-b', 'bld-c', 'bld-d', 'bld-e', 'bld-f', 'bld-g', 'bld-h'];
export const STREET_MODELS = [...BUILDINGS, 'palm', 'streetlight', 'bench', 'car-taxi'];

export class TestStreet {
  constructor() {
    this.group = new THREE.Group();
    this.rickshaws = [];
    this.t = 0;
  }

  async load() { this.models = await loadModels(STREET_MODELS); }

  build(rt) {
    const g = this.group, tex = groundTextures(), world = rt.world;
    const L = 90; // street length along Z
    const road = plane(8, L, tex.asphalt, 1, L / 8); g.add(road);
    for (const s of [-1, 1]) {
      const walk = plane(4, L, tex.paving, 1, L / 4); walk.position.set(s * 6, 0.02, 0); g.add(walk);
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, L), new THREE.MeshStandardMaterial({ color: '#d8d2c4' }));
      kerb.position.set(s * 4.1, 0.08, 0); kerb.receiveShadow = true; g.add(kerb);
    }
    const grass = plane(160, 160, tex.grass, 30, 30); grass.position.y = -0.02; g.add(grass);

    const scale = 5;
    const inst = Object.fromEntries(BUILDINGS.map((b) => [b, new InstancedModel(this.models[b], 6)]));
    for (const im of Object.values(inst)) g.add(im.group);
    let k = 0;
    for (const s of [-1, 1]) {
      for (let z = -36; z <= 36; z += 12) {
        const name = BUILDINGS[k++ % BUILDINGS.length];
        const x = s * 14;
        inst[name].add(matrixFrom(x, 0, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, scale));
        world.addBox(x, z, 10, 10, 30);
      }
    }
    const palms = new InstancedModel(this.models.palm, 20); g.add(palms.group);
    const lights = new InstancedModel(this.models.streetlight, 20); g.add(lights.group);
    for (let z = -40; z <= 40; z += 10) {
      for (const s of [-1, 1]) {
        if ((z / 10 + (s > 0 ? 1 : 0)) % 2 === 0) { palms.add(matrixFrom(s * 7.4, 0, z + 5, z, 2.6)); world.addBox(s * 7.4, z + 5, 0.6, 0.6, 9); }
        else { lights.add(matrixFrom(s * 4.6, 0, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, 5.5)); world.addBox(s * 4.6, z, 0.3, 0.3, 6); }
      }
    }
    const stall = makeTeaStall(); stall.position.set(-6.2, 0, -8); stall.rotation.y = Math.PI / 2; g.add(stall);
    world.addBox(-6.2, -8, 1.1, 2.4, 1.05);
    for (let i = 0; i < 3; i++) {
      const r = makeRickshaw(i); r.position.set(i % 2 ? 2 : -2, 0, -30 + i * 25); r.rotation.y = i % 2 ? Math.PI : 0;
      r.userData.dir = i % 2 ? -1 : 1;
      g.add(r); this.rickshaws.push(r);
    }
    world.setBounds(-9, 9, -L / 2, L / 2);
    rt.stage.scene.add(g);
    rt.player.pos.set(0, 0, 30);
    rt.player.facing = Math.PI;
    rt.follow.snapBehind(Math.PI);
    rt.stage.setHeatLook(0.1);
    this.rt = rt;
  }

  update(dt) {
    this.t += dt;
    for (const r of this.rickshaws) {
      r.position.z += r.userData.dir * dt * 2.2;
      if (r.position.z > 42) r.position.z = -42;
      if (r.position.z < -42) r.position.z = 42;
      for (const w of r.userData.wheels) w.rotation.x += dt * 6 * r.userData.dir;
    }
  }

  dispose() {
    this.rt?.stage.scene.remove(this.group);
    this.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  }
}
