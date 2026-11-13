// Each block gets its own character: a theme (market, park, school, river ghat, brickfield…)
// with a matching ground colour, wall paints and small landmarks built from shapes, plus a
// street sign with the block's name. All decorations are merged into a few meshes at the end.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRickshaw, makeTeaStall, makeKite } from './props.js';

const mats = {};
const M = (color, extra = {}) => (mats[color + JSON.stringify(extra)] ||= new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra }));
const box = (w, h, d, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(color)); m.position.set(x, y + h / 2, z); return m; };
const cyl = (r1, r2, h, color, x = 0, y = 0, z = 0, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), M(color)); m.position.set(x, y + h / 2, z); return m; };

// ---------- Landmark builders (each returns a Group facing +z, about 2–3 m wide) ----------
function stall(color) { // market stall with a striped umbrella and crates of goods
  const g = new THREE.Group();
  g.add(box(2.0, 0.8, 0.9, '#8b5a2b'), cyl(0.04, 0.04, 2.3, '#555', 0, 0.8, 0));
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.5, 8), M(color)); top.position.set(0, 3.0, 0); g.add(top);
  const goods = ['#e74c3c', '#f39c12', '#27ae60', '#f1c40f'];
  for (let k = 0; k < 4; k++) g.add(box(0.42, 0.22, 0.5, goods[k], -0.7 + k * 0.47, 0.8, 0.1));
  return g;
}
function fishStall() {
  const g = stall('#1f77b4');
  for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), M('#c0c8d0', { metalness: 0.4 })); f.scale.set(2.2, 0.6, 0.8); f.position.set(-0.7 + k * 0.35, 1.1, 0.25); g.add(f); }
  return g;
}
function busStop(label = '#2f7fc8') {
  const g = new THREE.Group();
  g.add(box(2.6, 0.08, 1.1, '#9aa3ad', 0, 2.3, 0), box(0.08, 2.3, 0.08, '#555', -1.25, 0, -0.5), box(0.08, 2.3, 0.08, '#555', 1.25, 0, -0.5));
  g.add(box(2.5, 1.4, 0.06, label, 0, 0.8, -0.52), box(2.0, 0.08, 0.4, '#8b5a2b', 0, 0.5, -0.25));
  return g;
}
function schoolCorner() {
  const g = new THREE.Group();
  g.add(box(0.1, 3.4, 0.1, '#ddd', -1.2, 0, 0)); // flag pole
  const flagG = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), M('#006a4e', { side: THREE.DoubleSide })); flagG.position.set(-0.72, 3.05, 0); g.add(flagG);
  const flagR = new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), M('#f42a41', { side: THREE.DoubleSide })); flagR.position.set(-0.78, 3.05, 0.01); g.add(flagR);
  // swing frame
  g.add(box(0.08, 2.0, 0.08, '#c0392b', 0.2, 0, -0.4), box(0.08, 2.0, 0.08, '#c0392b', 0.2, 0, 0.4), box(0.08, 2.0, 0.08, '#c0392b', 1.6, 0, -0.4), box(0.08, 2.0, 0.08, '#c0392b', 1.6, 0, 0.4));
  g.add(box(1.5, 0.08, 0.08, '#c0392b', 0.9, 2.0, -0.4), box(1.5, 0.08, 0.08, '#c0392b', 0.9, 2.0, 0.4), box(0.5, 0.06, 0.3, '#f1c40f', 0.9, 0.6, 0));
  return g;
}
function chimney() { // brick kiln chimney
  const g = new THREE.Group();
  g.add(cyl(0.7, 1.1, 9, '#a5452c', 0, 0, 0, 12), cyl(0.75, 0.75, 0.4, '#5a2a1a', 0, 9, 0, 12));
  for (let k = 0; k < 3; k++) g.add(box(0.9, 0.4, 0.5, '#b85c38', -1.6 + k * 0.2, k * 0.4, 0.8));
  return g;
}
function clothesLine(colors) { // colourful saris drying
  const g = new THREE.Group();
  g.add(box(0.07, 2.3, 0.07, '#5a3a1a', -1.4, 0, 0), box(0.07, 2.3, 0.07, '#5a3a1a', 1.4, 0, 0), box(2.8, 0.02, 0.02, '#444', 0, 2.25, 0));
  colors.forEach((c, k) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.3), M(c, { side: THREE.DoubleSide })); s.position.set(-1.05 + k * 0.7, 1.6, 0); g.add(s); });
  return g;
}
function lanterns() {
  const g = new THREE.Group();
  g.add(box(0.07, 2.8, 0.07, '#333', -1.4, 0, 0), box(0.07, 2.8, 0.07, '#333', 1.4, 0, 0), box(2.8, 0.02, 0.02, '#333', 0, 2.75, 0));
  ['#e74c3c', '#f1c40f', '#e67e22', '#e84393'].forEach((c, k) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), M(c, { emissive: c, emissiveIntensity: 0.6 })); l.position.set(-1.05 + k * 0.7, 2.45, 0); g.add(l); });
  return g;
}
function clayPots() {
  const g = new THREE.Group();
  for (let k = 0; k < 7; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.28 + (k % 3) * 0.06, 10, 8), M('#b5653a')); p.scale.y = 0.85; p.position.set(-1.2 + (k % 4) * 0.8, 0.3 + Math.floor(k / 4) * 0.5, Math.floor(k / 4) * -0.3); g.add(p); }
  return g;
}
function flowerBed() {
  const g = new THREE.Group();
  g.add(box(2.6, 0.3, 1.0, '#8b6b4a'));
  const cols = ['#e84393', '#f1c40f', '#e74c3c', '#ffffff', '#9b59b6'];
  for (let k = 0; k < 10; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), M(cols[k % 5])); f.position.set(-1.1 + (k % 5) * 0.55, 0.42, k < 5 ? -0.2 : 0.2); g.add(f); }
  return g;
}
function benchPair() {
  const g = new THREE.Group();
  for (const x of [-0.8, 0.8]) g.add(box(1.2, 0.08, 0.4, '#8b5a2b', x, 0.45, 0), box(0.08, 0.45, 0.35, '#555', x - 0.5, 0, 0), box(0.08, 0.45, 0.35, '#555', x + 0.5, 0, 0));
  return g;
}
function tinShed() {
  const g = new THREE.Group();
  g.add(box(2.6, 1.8, 1.4, '#8d99a6'));
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.06, 1.8), M('#b8c2cc', { metalness: 0.5, roughness: 0.4 })); roof.position.set(0, 1.95, 0); roof.rotation.x = 0.12; g.add(roof);
  return g;
}
function puddles() {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.CircleGeometry(0.5 + k * 0.2, 16), M('#6fa8c8', { roughness: 0.05, metalness: 0.3 })); p.rotation.x = -Math.PI / 2; p.position.set(-1 + k * 1.0, 0.02, (k % 2) * 0.4); g.add(p); }
  const umb = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.35, 8), M('#2c3e50')); umb.position.set(1.2, 2.0, 0); g.add(umb, cyl(0.02, 0.02, 2.0, '#222', 1.2, 0, 0));
  return g;
}
function boats() { // country boats pulled up at the ghat
  const g = new THREE.Group();
  for (let k = 0; k < 2; k++) {
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.6, 10, 1, false, 0, Math.PI), M(k ? '#1d5fa8' : '#8b3a1a', { side: THREE.DoubleSide }));
    hull.rotation.z = Math.PI / 2; hull.rotation.y = Math.PI / 2; hull.position.set(-0.7 + k * 1.4, 0.45, 0); hull.scale.set(1, 1, 0.8);
    g.add(hull);
  }
  return g;
}
function bamboo() { // bamboo scaffolding
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) g.add(cyl(0.05, 0.05, 5.5, '#c8a96a', -1.2 + k * 0.8, 0, 0, 6));
  for (let k = 1; k < 5; k++) g.add(box(2.6, 0.06, 0.06, '#c8a96a', 0, k * 1.1, 0));
  return g;
}
function gate() {
  const g = new THREE.Group();
  g.add(box(0.4, 3.6, 0.4, '#c0392b', -1.3, 0, 0), box(0.4, 3.6, 0.4, '#c0392b', 1.3, 0, 0), box(3.2, 0.5, 0.5, '#f1c40f', 0, 3.6, 0));
  return g;
}

// ---------- Themes per block (index matches DISTRICT_NAMES) ----------
const T = (ground, props, paints) => ({ ground, props, paints });
const PARK = '#a8c38b', MARKET = '#d8c39a', PLAZA = '#d8d2c6', BRICK = '#c69072', HOME = null;
export const THEMES = [
  T(HOME, ['kites', 'flowers'], [5, 0]), // Kite Lane
  T(PARK, ['flowers', 'benches'], [2, 1]), // Mango Para
  T(PARK, ['flowers', 'puddles'], [3, 0]), // Shapla Block
  T(PLAZA, ['benches', 'lanterns', 'flowers'], [6, 7]), // Banyan Square
  T(MARKET, ['boats', 'bus'], [4, 6]), // Boat Ghat
  T(HOME, ['lanterns', 'lanterns2'], [3, 5]), // Lantern Lane
  T(MARKET, ['tea', 'benches'], [7, 1]), // Tea Corner
  T(HOME, ['rickshaws', 'stall'], [5, 4]), // Rickshaw Row
  T(MARKET, ['stall', 'stall2', 'stall3'], [1, 7]), // Lotus Market
  T(PARK, ['benches', 'flowers'], [2, 0]), // Jamun Street
  T(HOME, ['puddles', 'tin'], [4, 6]), // Monsoon Court
  T(HOME, ['tin', 'tin'], [6, 4]), // Tin Roof Row
  T(MARKET, ['pots', 'stall'], [7, 1]), // Clay Pot Corner
  T(MARKET, ['rickshaws', 'stall2'], [0, 5]), // Cycle Bazaar
  T(PARK, ['flowers', 'benches'], [2, 3]), // Palm Para
  T(PARK, ['flowers', 'lanterns'], [3, 2]), // Kadam Corner
  T(PLAZA, ['school', 'flowers'], [5, 0]), // School Lane
  T(HOME, ['kites', 'tin'], [7, 4]), // Rooftop Hill
  T(PLAZA, ['bus', 'stall'], [0, 6]), // Ferry Road
  T(MARKET, ['bamboo', 'stall3'], [1, 5]), // Bamboo Bazaar
  T(PARK, ['puddles', 'flowers'], [2, 4]), // Pond Side
  T(MARKET, ['fish', 'fish2'], [4, 1]), // Hilsa Market
  T(BRICK, ['chimney', 'bricks'], [7, 6]), // Brick Kiln Road
  T(MARKET, ['saris', 'saris2'], [3, 5]), // Sari Street
  T(PLAZA, ['gate', 'bus'], [0, 4]), // River Gate
];

const SARI = [['#e84393', '#f1c40f', '#16a085', '#e74c3c'], ['#8e44ad', '#f39c12', '#2980b9', '#d35400']];

function buildProp(kind) {
  switch (kind) {
    case 'stall': return stall('#e74c3c');
    case 'stall2': return stall('#27ae60');
    case 'stall3': return stall('#8e44ad');
    case 'fish': case 'fish2': return fishStall();
    case 'bus': return busStop();
    case 'school': return schoolCorner();
    case 'chimney': return chimney();
    case 'bricks': { const g = new THREE.Group(); for (let k = 0; k < 6; k++) g.add(box(0.9, 0.35, 0.45, '#b85c38', -1 + (k % 3) * 1.0, Math.floor(k / 3) * 0.35, 0)); return g; }
    case 'saris': return clothesLine(SARI[0]);
    case 'saris2': return clothesLine(SARI[1]);
    case 'lanterns': case 'lanterns2': return lanterns();
    case 'pots': return clayPots();
    case 'flowers': return flowerBed();
    case 'benches': return benchPair();
    case 'tin': return tinShed();
    case 'puddles': return puddles();
    case 'boats': return boats();
    case 'bamboo': return bamboo();
    case 'gate': return gate();
    case 'tea': { const g = makeTeaStall(); return g; }
    case 'rickshaws': { const g = new THREE.Group(); for (let k = 0; k < 2; k++) { const r = makeRickshaw(k + 3); r.position.x = -0.8 + k * 1.6; r.rotation.y = Math.PI / 2; g.add(r); } return g; }
    case 'kites': return null; // handled as flying kites
    default: return null;
  }
}

// Positions along the block edge, between the corner buildings, clear of the tree spots.
const SLOTS = [[0, 10.5, 0], [10.5, 0, -Math.PI / 2], [0, -10.5, Math.PI], [-10.5, 0, Math.PI / 2]];

// Street-name signs: one canvas atlas for all 25 names.
function signAtlas(names) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64 * names.length;
  const g = c.getContext('2d');
  names.forEach((n, i) => {
    const y = i * 64;
    g.fillStyle = '#1a6b3c'; g.fillRect(0, y, 512, 64);
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(6, y + 6, 500, 52);
    g.fillStyle = '#fff'; g.font = 'bold 34px system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(n, 256, y + 33);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Build decorations for all blocks; returns { group, kites: [{x,z,h}] } and adds collision boxes.
export function decorateCity(districts, names, world) {
  const parts = new THREE.Group();
  const kites = [];
  const atlas = signAtlas(names);
  const signMat = new THREE.MeshBasicMaterial({ map: atlas, side: THREE.DoubleSide });
  const signGeos = [];
  districts.forEach((d, i) => {
    const th = THEMES[i];
    let slot = 0;
    for (const kind of th.props) {
      if (kind === 'kites') { for (let k = 0; k < 3; k++) kites.push({ x: d.cx - 5 + k * 5, z: d.cz - 4 + k * 3, h: 20 + k * 2 }); continue; }
      const prop = buildProp(kind);
      if (!prop) continue;
      const [sx, sz, rot] = SLOTS[(i + slot++) % SLOTS.length];
      prop.position.set(d.cx + sx, 0.16, d.cz + sz);
      prop.rotation.y = rot;
      parts.add(prop);
      world.addBox(d.cx + sx, d.cz + sz, Math.abs(Math.sin(rot)) > 0.5 ? 1.2 : 2.8, Math.abs(Math.sin(rot)) > 0.5 ? 2.8 : 1.2, 2.5, 'prop');
    }
    // Name sign on a post at one corner of the block, readable from both sides.
    const post = box(0.1, 2.6, 0.1, '#555', d.cx + 11.0, 0.16, d.cz + 11.0);
    parts.add(post);
    const geo = new THREE.PlaneGeometry(2.4, 0.3);
    const uv = geo.attributes.uv, v0 = 1 - (i + 1) / names.length, v1 = 1 - i / names.length;
    for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) > 0.5 ? v1 : v0);
    geo.rotateY(Math.PI / 4);
    geo.translate(d.cx + 11.0, 2.75, d.cz + 11.0);
    signGeos.push(geo);
  });
  // Merge every decoration mesh by material: a few draw calls for the whole city.
  parts.updateMatrixWorld(true);
  const byMat = new Map();
  parts.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    g.applyMatrix4(o.matrixWorld);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  const group = new THREE.Group();
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  }
  const signs = new THREE.Mesh(mergeGeometries(signGeos.map((g) => g.toNonIndexed()), false), signMat);
  group.add(signs);
  return { group, kites };
}

export function groundTint(i) { return THEMES[i]?.ground || null; }
export function paintsFor(i) { return THEMES[i]?.paints || null; }
export { makeKite };
