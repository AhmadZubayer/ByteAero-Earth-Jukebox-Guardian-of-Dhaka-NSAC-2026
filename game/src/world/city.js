// Dhaka for one round: a 5 x 5 grid of districts whose heat and greenness come from NASA data.
// The street layout is invented; each district's land surface temperature and NDVI are sampled
// from the MODIS images for the same part of the city (north at the top of the image = -Z here).
import * as THREE from 'three';
import gsap from 'gsap';
import { loadModels } from '../core/assets.js';
import { InstancedModel, matrixFrom } from './instanced.js';
import { groundTextures, plane } from './ground.js';
import { makeRickshaw, makeTeaStall, makeKite } from './props.js';
import { Animated } from '../player/character.js';
import { Effects } from './effects.js';
import { DhakaBuildings } from './dhakaBuildings.js';
import { COLS, ROWS, colRow } from '../game/heat.js';
import { DISTRICT_NAMES, layoutDistrict } from '../game/rounds.js';

export const PITCH = 30, BLOCK = 23, HALF = (COLS * PITCH) / 2;
export const CITY_MODELS = ['palm', 'tree-round', 'tree-tall', 'streetlight', 'bench', 'bush', 'lilypad', 'bird', 'person-a', 'person-c', 'solar'];
const CORNER = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

export function districtCentre(i) {
  const [c, r] = colRow(i);
  return { x: (c - (COLS - 1) / 2) * PITCH, z: (r - (ROWS - 1) / 2) * PITCH };
}

export function districtAt(x, z) {
  const c = Math.floor((x + HALF) / PITCH), r = Math.floor((z + HALF) / PITCH);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
  return r * COLS + c;
}

// Heat colour for overlays: 0 calm (teal) -> 1 (amber) -> 2+ (red).
export function heatColor(v, out = new THREE.Color()) {
  const stops = [[0, '#3fb6a8'], [0.6, '#9ad16b'], [1.1, '#f4c64e'], [1.8, '#f08a3c'], [2.6, '#d9342b']];
  const t = Math.max(0, Math.min(2.6, v));
  for (let k = 1; k < stops.length; k++) {
    if (t <= stops[k][0]) {
      const a = stops[k - 1], b = stops[k];
      return out.set(a[1]).lerp(new THREE.Color(b[1]), (t - a[0]) / (b[0] - a[0]));
    }
  }
  return out.set('#d9342b');
}

let models = null;
export const cityModels = () => models;
export async function loadCity() {
  if (!models) {
    models = await loadModels(CITY_MODELS);
  }
  return models;
}

const PEOPLE_COLORS = [
  { Shirt: '#c0392b', Pants: '#2c3e50' }, { Shirt: '#16a085', Pants: '#34495e' }, { Shirt: '#8e44ad', Pants: '#2d2d2d' },
  { LightBrown: '#2e86c1', LightBlue: '#1b2631' }, { LightBrown: '#f5f5f5', LightBlue: '#5d4037' }, { LightBrown: '#27ae60', LightBlue: '#212f3d' },
  { Shirt: '#e67e22', Pants: '#3e2723' }, { LightBrown: '#d35400', LightBlue: '#263238' },
];

export class City {
  constructor() {
    this.group = new THREE.Group();
    this.districts = [];
    this.people = [];
    this.rickshaws = [];
    this.birds = [];
    this.kites = [];
    this.growing = [];
    this.t = 0;
  }

  // cells: per-district { lst, ndvi } for the round's year. opts.quality: 'high' | 'low'
  build(rt, cells, opts = {}) {
    this.rt = rt;
    const g = this.group, world = rt.world, tex = groundTextures();
    const low = opts.quality === 'low';
    this.effects = new Effects(rt.stage.scene);
    this.effects.enabled = !opts.reducedMotion;

    // Streets: one asphalt base, kerbed blocks on top, dashed centre lines.
    const base = plane(COLS * PITCH + 40, ROWS * PITCH + 40, tex.asphalt, 14, 14, '#9a9da3');
    base.material.map = null; base.material.color.set('#6c6f74'); // plain asphalt; lane marks are added below
    g.add(base);
    const outskirts = plane(700, 700, tex.grass, 90, 90, '#b7c79a'); outskirts.position.y = -0.05; g.add(outskirts);
    // The river along the south-west, as in the satellite images.
    const river = new THREE.Mesh(new THREE.PlaneGeometry(500, 70), new THREE.MeshStandardMaterial({ color: '#4f7f8f', roughness: 0.2, metalness: 0.1 }));
    river.rotation.x = -Math.PI / 2; river.rotation.z = Math.PI / 4; river.position.set(-150, -0.02, 150); g.add(river);
    const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.02, 2.2), new THREE.MeshStandardMaterial({ color: '#e9e2c8' }), 600);
    let nd = 0;
    const m4 = new THREE.Matrix4();
    for (let k = 0; k <= COLS; k++) {
      const p = -HALF + k * PITCH;
      for (let s = -HALF - 15; s < HALF + 15; s += 5) {
        dash.setMatrixAt(nd++, m4.makeTranslation(p, 0.03, s));
        dash.setMatrixAt(nd++, m4.makeRotationY(Math.PI / 2).setPosition(s, 0.03, p));
      }
    }
    dash.count = nd; dash.receiveShadow = true; g.add(dash);

    const blockGeo = new THREE.BoxGeometry(BLOCK, 0.16, BLOCK);
    const blocks = new THREE.InstancedMesh(blockGeo, new THREE.MeshStandardMaterial({ map: tex.paving, roughness: 0.95 }), COLS * ROWS);
    const grassGeo = new THREE.BoxGeometry(9, 0.04, 9);
    const grass = new THREE.InstancedMesh(grassGeo, new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 1 }), 100);
    let ng = 0;
    blocks.receiveShadow = true; grass.receiveShadow = true;
    g.add(blocks, grass);

    const blds = new DhakaBuildings();
    const trees = { palm: new InstancedModel(models.palm, 140), 'tree-round': new InstancedModel(models['tree-round'], 140), 'tree-tall': new InstancedModel(models['tree-tall'], 140) };
    const lights = new InstancedModel(models.streetlight, 80);
    const benches = new InstancedModel(models.bench, 60);
    const bushes = new InstancedModel(models.bush, 120);
    this.trees = trees;
    for (const im of [...Object.values(trees), lights, benches, bushes]) g.add(im.group);
    this.roofMat = new THREE.MeshStandardMaterial({ color: '#f7f7f2', roughness: 0.5, emissive: '#fffdf0', emissiveIntensity: 0.12 });
    this.roofGeo = new THREE.BoxGeometry(1, 0.12, 1);

    for (let i = 0; i < COLS * ROWS; i++) {
      const cell = cells[i];
      const { x: cx, z: cz } = districtCentre(i);
      const layout = layoutDistrict(cell, i);
      const ndvi = cell.ndvi ?? 0.4;
      const tint = new THREE.Color('#cfc4b0').lerp(new THREE.Color('#a9b98a'), Math.max(0, Math.min(1, (ndvi - 0.25) / 0.4)));
      blocks.setMatrixAt(i, m4.makeTranslation(cx, 0.08, cz));
      blocks.setColorAt(i, tint);
      const d = {
        i, cx, cz, name: DISTRICT_NAMES[i], cell, layout, buildings: [], treePlots: [], big: { x: cx, z: cz, used: null }, fixes: [],
      };
      // Buildings on some corners; the rest are open ground with grass.
      layout.buildingCorners.forEach((k, n) => {
        const [sx, sz] = CORNER[k];
        const bx = cx + sx * 6.6, bz = cz + sz * 6.6;
        // Taller where the NASA NDVI shows less green (more built-up).
        const floors = Math.max(3, Math.min(10, Math.round(3 + (0.6 - ndvi) * 12 + ((i * 7 + n * 3) % 4))));
        const h = blds.add(bx, bz, 8.2, 8.2, floors, i * 4 + n + 1);
        world.addBox(bx, bz, 8.2, 8.2, h + 4);
        d.buildings.push({ x: bx, z: bz, h, type: 'dhaka', white: false });
      });
      for (const k of layout.openCorners) {
        const [sx, sz] = CORNER[k];
        grass.setMatrixAt(ng, m4.makeTranslation(cx + sx * 6.6, 0.17, cz + sz * 6.6));
        ng++;
        d.treePlots.push({ x: cx + sx * 6.6 - sx * 2.2, z: cz + sz * 6.6 + sz * 2.2 });
        d.treePlots.push({ x: cx + sx * 6.6 + sx * 2.2, z: cz + sz * 6.6 - sz * 2.2 });
      }
      for (const [ex, ez] of [[0, -8.2], [0, 8.2], [-8.2, 0], [8.2, 0]]) d.treePlots.push({ x: cx + ex, z: cz + ez });
      // Existing trees (from NDVI) fill the first plots.
      for (let t = 0; t < layout.existingTrees; t++) {
        const p = d.treePlots[t];
        p.used = 'existing';
        this.addTree(p.x, p.z, (i + t) % 3, 1, false);
      }
      // Street furniture.
      lights.add(matrixFrom(cx - BLOCK / 2 + 0.6, 0.16, cz - BLOCK / 2 + 0.6, Math.PI / 4, 5));
      if (i % 2 === 0) benches.add(matrixFrom(cx + 3.2, 0.16, cz + 9.8, 0, 5));
      for (let b = 0; b < 2; b++) bushes.add(matrixFrom(cx + (b ? 10.6 : -10.6), 0.16, cz + 10.6, b, 4.5));
      // Heat overlay (shown when the heat view is on).
      const ov = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK - 0.4, BLOCK - 0.4), new THREE.MeshBasicMaterial({ color: '#3fb6a8', transparent: true, opacity: 0, depthWrite: false }));
      ov.rotation.x = -Math.PI / 2; ov.position.set(cx, 0.2, cz); ov.renderOrder = 2;
      g.add(ov);
      d.overlay = ov;
      this.districts.push(d);
    }
    blocks.instanceMatrix.needsUpdate = true; if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
    grass.count = ng; grass.instanceMatrix.needsUpdate = true;

    // A ring of buildings beyond the edge so the city does not look like an island (no collisions).
    const ring = new DhakaBuildings({ castShadow: false });
    let rk = 0;
    for (let a = -HALF - 22; a <= HALF + 22; a += 11) {
      for (const [x, z, r] of [[a, -HALF - 26, 0], [a, HALF + 26, Math.PI], [-HALF - 26, a, Math.PI / 2], [HALF + 26, a, -Math.PI / 2]]) {
        if (x < -100 && z > 60) continue; // leave the river bank open
        void r;
        ring.add(x, z, 9.5, 9.5, 5 + ((rk * 7) % 6), 500 + rk++);
      }
    }
    ring.build(g);
    blds.build(g);
    this.blds = [blds, ring];
    world.setBounds(-HALF - 6, HALF + 6, -HALF - 6, HALF + 6);

    // Tea stall in the central district, rickshaws on the roads, kites over rooftops.
    const centre = this.districts[12];
    this.teaStall = makeTeaStall();
    this.teaStall.position.set(centre.cx + 4, 0.16, centre.cz + 11);
    g.add(this.teaStall);
    world.addBox(centre.cx + 4, centre.cz + 11, 2.4, 1.2, 1.2);
    const nR = low ? 4 : 8;
    for (let k = 0; k < nR; k++) {
      const r = makeRickshaw(k);
      const lane = -HALF + ((k % (COLS + 1))) * PITCH + (k % 2 ? 1.6 : -1.6);
      const along = k % 2 === 0;
      r.userData = { ...r.userData, lane, along, s: -HALF + ((k * 37) % (COLS * PITCH)), dir: k % 3 === 0 ? -1 : 1, speed: 2 + (k % 3) * 0.6 };
      g.add(r); this.rickshaws.push(r);
    }
    for (let k = 0; k < (low ? 2 : 5); k++) {
      const d = this.districts[(k * 7 + 3) % 25];
      const b = d.buildings[0];
      if (!b) continue;
      const kite = makeKite(['#e63946', '#f1c40f', '#2a9d8f', '#8e44ad', '#ff7f50'][k]);
      kite.position.set(b.x, b.h + 12 + k, b.z);
      kite.userData = { base: kite.position.clone(), phase: k * 1.3 };
      g.add(kite); this.kites.push(kite);
    }

    // Birds circle over the greenest districts.
    const green = [...this.districts].sort((a, b) => (b.cell.ndvi ?? 0) - (a.cell.ndvi ?? 0)).slice(0, low ? 1 : 3);
    for (const d of green) {
      if ((d.cell.ndvi ?? 0) < 0.45) continue;
      for (let k = 0; k < 3; k++) {
        const bird = models.bird.scene.clone(true);
        bird.scale.setScalar(1.4);
        bird.userData = { cx: d.cx, cz: d.cz, r: 6 + k * 2, h: 14 + k * 1.5, phase: k * 2.1, speed: 0.5 + k * 0.1 };
        g.add(bird); this.birds.push(bird);
      }
    }

    // Townspeople walk around the blocks.
    const nPeople = low ? 7 : 14;
    for (let k = 0; k < nPeople; k++) {
      const useA = k % 2 === 0;
      const p = new Animated(models[useA ? 'person-a' : 'person-c'], { scale: useA ? 0.37 : 0.92, colors: PEOPLE_COLORS[k % PEOPLE_COLORS.length] });
      const di = (k * 9 + 2) % 25;
      const d = this.districts[di];
      p.home = di;
      p.loop = { cx: d.cx, cz: d.cz, half: BLOCK / 2 + 0.9, s: (k * 13) % 92, dir: k % 3 ? 1 : -1, speed: 1.1 + (k % 4) * 0.15 };
      p.state = 'walk';
      p.play('Walk');
      g.add(p.root);
      this.people.push(p);
    }

    rt.stage.scene.add(g);
  }

  addTree(x, z, kind, scale = 1, animate = true) {
    const names = ['palm', 'tree-round', 'tree-tall'];
    const name = names[kind % 3];
    const s = (name === 'palm' ? 2.8 : name === 'tree-round' ? 1.25 : 1.35) * scale;
    const im = this.trees[name];
    const rot = (x * 13 + z * 7) % 6.28;
    const idx = im.add(matrixFrom(x, 0.16, z, rot, animate ? 0.01 : s));
    this.rt.world.addBox(x, z, 0.7, 0.7, 6, 'tree');
    if (animate && idx >= 0) {
      const o = { s: 0.01 };
      this.growing.push(o);
      gsap.to(o, { s, duration: this.rt.settings.reducedMotion ? 0.01 : 1.1, ease: 'back.out(1.6)', onUpdate: () => im.set(idx, matrixFrom(x, 0.16, z, rot, o.s)), onComplete: () => this.growing.splice(this.growing.indexOf(o), 1) });
    }
  }

  // Place a fix. Returns a short description, or null if it does not fit here.
  place(type, x, z) {
    const di = districtAt(x, z);
    if (di < 0) return null;
    const d = this.districts[di];
    const pos = new THREE.Vector3(x, 0.2, z);
    if (type === 'tree') {
      const p = this.nearestFree(d.treePlots, x, z, 6);
      if (!p) return null;
      p.used = 'planted';
      this.addTree(p.x, p.z, d.fixes.length % 3, 1, true);
      this.effects.leaves(new THREE.Vector3(p.x, 0, p.z));
      d.fixes.push('tree');
      return { district: di, at: p };
    }
    if (type === 'roof') {
      let best = null, bd = 9;
      for (const b of d.buildings) {
        if (b.white) continue;
        const dist = Math.max(Math.abs(b.x - x), Math.abs(b.z - z)) - 4.1;
        if (dist < bd) { bd = dist; best = b; }
      }
      if (!best) return null;
      best.white = true;
      const slab = new THREE.Mesh(this.roofGeo, this.roofMat);
      slab.scale.set(7.2, 1, 7.2);
      slab.position.set(best.x, best.h + 0.08, best.z);
      slab.receiveShadow = true;
      this.group.add(slab);
      if (!this.rt.settings.reducedMotion) gsap.from(slab.scale, { x: 0.1, z: 0.1, duration: 0.6, ease: 'power2.out' });
      this.effects.sparkle(new THREE.Vector3(best.x, best.h, best.z));
      d.fixes.push('roof');
      return { district: di, at: best };
    }
    if (type === 'pond' || type === 'centre') {
      if (d.big.used) return null;
      if (Math.hypot(d.big.x - x, d.big.z - z) > 8.5) return null;
      if (!this.rt.world.isFree(d.big.x, d.big.z, 2.6)) return null;
      d.big.used = type;
      const obj = type === 'pond' ? this.makePond() : this.makeCoolingCentre();
      obj.position.set(d.big.x, 0.16, d.big.z);
      this.group.add(obj);
      if (!this.rt.settings.reducedMotion) gsap.from(obj.scale, { x: 0.05, y: 0.05, z: 0.05, duration: 0.7, ease: 'back.out(1.4)' });
      if (type === 'pond') { this.effects.splash(pos.set(d.big.x, 0.2, d.big.z)); this.rt.world.addBox(d.big.x, d.big.z, 4.4, 4.4, 0.3, 'pond'); }
      else { this.effects.sparkle(pos.set(d.big.x, 0.2, d.big.z)); this.rt.world.addBox(d.big.x, d.big.z, 4.6, 4.6, 4, 'centre'); }
      d.fixes.push(type);
      return { district: di, at: d.big };
    }
    return null;
  }

  nearestFree(plots, x, z, maxD) {
    let best = null, bd = maxD;
    for (const p of plots) {
      if (p.used) continue;
      const dd = Math.hypot(p.x - x, p.z - z);
      if (dd < bd) { bd = dd; best = p; }
    }
    return best;
  }

  // Where would this fix go if placed now? For the preview ring.
  preview(type, x, z) {
    const di = districtAt(x, z);
    if (di < 0) return null;
    const d = this.districts[di];
    if (type === 'tree') { const p = this.nearestFree(d.treePlots, x, z, 6); return p ? { x: p.x, z: p.z, r: 1.2 } : null; }
    if (type === 'roof') {
      let best = null, bd = 9;
      for (const b of d.buildings) { if (b.white) continue; const dist = Math.max(Math.abs(b.x - x), Math.abs(b.z - z)) - 4.1; if (dist < bd) { bd = dist; best = b; } }
      return best ? { x: best.x, z: best.z, r: 4.4, y: best.h + 0.3 } : null;
    }
    if (d.big.used || Math.hypot(d.big.x - x, d.big.z - z) > 8.5) return null;
    return { x: d.big.x, z: d.big.z, r: 2.8 };
  }

  makePond() {
    const g = new THREE.Group();
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), new THREE.MeshStandardMaterial({ color: '#3d8fbf', roughness: 0.08, metalness: 0.2, emissive: '#0d3550', emissiveIntensity: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.06;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.22, 8, 32), new THREE.MeshStandardMaterial({ color: '#9b8f7d', roughness: 0.9 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.08;
    g.add(water, rim);
    for (let k = 0; k < 3; k++) {
      const lp = models.lilypad.scene.clone(true);
      lp.scale.setScalar(0.9);
      lp.position.set(Math.cos(k * 2.1) * 1.2, 0.08, Math.sin(k * 2.1) * 1.2);
      g.add(lp);
    }
    g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    return g;
  }

  makeCoolingCentre() {
    const g = new THREE.Group();
    const post = new THREE.MeshStandardMaterial({ color: '#f2f2f2' });
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3), post);
      p.position.set(x, 1.5, z); p.castShadow = true; g.add(p);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.2, 4), new THREE.MeshStandardMaterial({ color: '#2f7fc8', roughness: 0.5 }));
    roof.position.y = 3.6; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.15, 4.6), new THREE.MeshStandardMaterial({ color: '#e6eef5' }));
    floor.position.y = 0.08;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12), new THREE.MeshStandardMaterial({ color: '#5fb8ff' }));
    tank.position.set(1.4, 0.6, 1.4);
    // Sign
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const x2 = c.getContext('2d'); x2.fillStyle = '#2f7fc8'; x2.fillRect(0, 0, 256, 96); x2.fillStyle = '#fff'; x2.font = 'bold 34px system-ui, sans-serif'; x2.textAlign = 'center'; x2.fillText('COOLING', 128, 42); x2.fillText('CENTRE', 128, 82);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.8), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    sign.position.set(0, 2.7, 2.05);
    g.add(roof, floor, tank, sign);
    return g;
  }

  // Show forecast heat per district (0 calm .. 2.6 very hot). visible: heat view setting.
  setOverlay(values, visible, hideIdx = []) {
    this.districts.forEach((d, i) => {
      const show = visible && !hideIdx.includes(i);
      heatColor(values[i], d.overlay.material.color);
      d.overlay.material.opacity = show ? 0.18 + Math.min(0.32, values[i] * 0.12) : 0;
    });
  }

  // After the wave: tint each district by outcome and set people's reactions.
  showOutcome(result) {
    result.districts.forEach((r, i) => {
      const d = this.districts[i];
      d.overlay.material.color.set(r.cooled ? '#3fb6a8' : r.sheltered ? '#f4c64e' : '#d9342b');
      d.overlay.material.opacity = 0.42;
    });
    for (const p of this.people) {
      const r = result.districts[p.home];
      p.state = r.safe ? 'cheer' : 'hot';
      if (r.safe) { p.play('Female_Clapping') || p.play('Wave'); } else { p.play('Female_Sitting') || p.play('Idle_Neutral') || p.play('Idle'); }
    }
  }

  resetPeople() { for (const p of this.people) { p.state = 'walk'; p.play('Walk'); } }

  update(dt) {
    this.t += dt;
    for (const p of this.people) {
      if (p.state === 'walk') {
        const L = p.loop;
        L.s = (L.s + L.dir * L.speed * dt + 92) % 92; // perimeter of the block loop (4 * 23)
        const side = Math.floor(L.s / 23), u = (L.s % 23) - 11.5;
        const h = L.half;
        const [x, z, ang] = side === 0 ? [u, -h, Math.PI / 2] : side === 1 ? [h, u, 0] : side === 2 ? [-u, h, -Math.PI / 2] : [-h, -u, Math.PI];
        p.root.position.set(L.cx + x, 0.16, L.cz + z);
        p.model.rotation.y = L.dir > 0 ? ang : ang + Math.PI;
      }
      p.update(dt);
    }
    for (const r of this.rickshaws) {
      const u = r.userData;
      u.s += u.dir * u.speed * dt;
      const lim = HALF + 12;
      if (u.s > lim || u.s < -lim) { u.dir *= -1; u.s = Math.max(-lim, Math.min(lim, u.s)); }
      if (u.along) { r.position.set(u.lane, 0, u.s); r.rotation.y = u.dir > 0 ? 0 : Math.PI; }
      else { r.position.set(u.s, 0, u.lane); r.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      for (const w of u.wheels) w.rotation.x += dt * u.speed * 3;
    }
    for (const b of this.birds) {
      const u = b.userData, a = this.t * u.speed + u.phase;
      b.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(a * 2) * 0.6, u.cz + Math.sin(a) * u.r);
      b.rotation.y = -a;
    }
    for (const k of this.kites) {
      const u = k.userData;
      k.position.set(u.base.x + Math.sin(this.t * 0.7 + u.phase) * 1.5, u.base.y + Math.sin(this.t * 1.3 + u.phase) * 0.8, u.base.z);
      k.rotation.z = Math.sin(this.t * 1.1 + u.phase) * 0.3;
    }
    this.effects?.update(dt);
  }

  dispose() {
    this.effects?.clearLoops();
    this.rt?.stage.scene.remove(this.group);
    if (this.effects) this.rt.stage.scene.remove(this.effects.batch);
    this.group.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) o.geometry.dispose?.(); });
  }
}
