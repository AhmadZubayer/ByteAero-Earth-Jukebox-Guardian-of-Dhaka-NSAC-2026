// Dhaka-style apartment blocks built in code: painted concrete walls with window grilles,
// balconies with laundry, AC units and rain stains; shops with rolling shutters and signboards on
// the ground floor; floor ledges; roof parapets and the black plastic water tanks seen on
// rooftops all over the city. All buildings of one wall style share one merged mesh.
import * as THREE from 'three';

const FLOOR = 3.0, SHOP = 3.6, TILE_W = 8; // metres: one wall texture tile = 2 bays x 1 floor
const PAINTS = ['#ece5d6', '#e2cfa4', '#cfdcc7', '#e7c6b9', '#bfcad1', '#ead78f', '#d2cdc4', '#dcb894'];
const SIGNS = [
  ['TEA STALL', '#c0392b'], ['PHARMACY', '#1f8a4c'], ['GROCERY', '#1d5fa8'], ['MOBILE SHOP', '#8e44ad'],
  ['TAILOR', '#b9770e'], ['SWEETS', '#d35400'], ['HARDWARE', '#2c3e50'], ['BOOKS', '#16a085'],
];

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; }

// One 2-bay x 1-floor wall tile (512 x 192 px = 8 m x 3 m).
function wallTexture(paint, seed) {
  const W = 512, H = 192, px = W / TILE_W;
  const [c, g] = canvas(W, H);
  const r = rng(seed);
  g.fillStyle = paint; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2500; i++) { // plaster grain
    g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(r() * W, r() * H, 2, 2);
  }
  // Floor slab band and a faint line of the slab edge.
  g.fillStyle = shade(paint, 0.86); g.fillRect(0, H - 14, W, 14);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, H - 15, W, 2);
  for (let bay = 0; bay < 2; bay++) {
    const bx = bay * W / 2;
    const balcony = (seed + bay) % 2 === 1;
    if (balcony) {
      // Recessed balcony: dark doorway, railing, sometimes laundry and a pot plant.
      g.fillStyle = shade(paint, 0.62); g.fillRect(bx + 0.35 * px, 10, 3.3 * px, H - 26);
      g.fillStyle = '#2b2f36'; g.fillRect(bx + 0.9 * px, 22, 1.2 * px, H - 40);
      g.fillStyle = '#3a4250'; g.fillRect(bx + 2.3 * px, 34, 1.1 * px, 70);
      if (r() < 0.7) { // laundry line
        const cols = ['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1', '#9b59b6', '#2ecc71'];
        g.strokeStyle = '#555'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx + 0.4 * px, 40); g.lineTo(bx + 3.6 * px, 40); g.stroke();
        for (let k = 0; k < 4; k++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(bx + (0.6 + k * 0.75) * px, 41, 0.5 * px, 24 + r() * 16); }
      }
      // Railing
      g.fillStyle = shade(paint, 0.9); g.fillRect(bx + 0.35 * px, H - 70, 3.3 * px, 6);
      g.fillStyle = '#4a4f57';
      for (let k = 0; k <= 16; k++) g.fillRect(bx + 0.35 * px + k * (3.3 * px / 16), H - 66, 2, 50);
      g.fillRect(bx + 0.35 * px, H - 18, 3.3 * px, 3);
      if (r() < 0.5) { g.fillStyle = '#2f8a43'; g.beginPath(); g.arc(bx + 3.3 * px, H - 74, 10, 0, Math.PI * 2); g.fill(); }
    } else {
      // Window with a metal grille and a small sunshade above.
      const wx = bx + 1.1 * px, wy = 40, ww = 1.8 * px, wh = 1.35 * px;
      const grad = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
      grad.addColorStop(0, '#2c3a4a'); grad.addColorStop(0.55, '#5b7084'); grad.addColorStop(1, '#22303d');
      g.fillStyle = shade(paint, 0.7); g.fillRect(wx - 5, wy - 5, ww + 10, wh + 10);
      g.fillStyle = grad; g.fillRect(wx, wy, ww, wh);
      if (r() < 0.35) { g.fillStyle = 'rgba(240,230,200,0.85)'; g.fillRect(wx + 3, wy + 3, ww * 0.45, wh - 6); } // curtain
      g.strokeStyle = '#3d434b'; g.lineWidth = 2;
      for (let k = 1; k < 7; k++) { g.beginPath(); g.moveTo(wx + (k * ww) / 7, wy); g.lineTo(wx + (k * ww) / 7, wy + wh); g.stroke(); }
      g.beginPath(); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke();
      g.fillStyle = shade(paint, 0.8); g.fillRect(wx - 10, wy - 16, ww + 20, 8); // chajja
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(wx - 8, wy - 8, ww + 16, 4);
      // Rain stain running down from the sill.
      const st = g.createLinearGradient(0, wy + wh + 5, 0, H - 14);
      st.addColorStop(0, 'rgba(60,50,40,0.22)'); st.addColorStop(1, 'rgba(60,50,40,0)');
      g.fillStyle = st; g.fillRect(wx + ww * 0.2, wy + wh + 5, ww * 0.6, H - 14 - (wy + wh + 5));
      if (r() < 0.4) { // AC unit
        g.fillStyle = '#e8e8e4'; g.fillRect(wx + ww + 10, wy + wh - 30, 0.75 * px, 30);
        g.fillStyle = '#9aa0a6'; for (let k = 0; k < 5; k++) g.fillRect(wx + ww + 14, wy + wh - 26 + k * 5, 0.75 * px - 8, 2);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// Ground-floor shops: one row per sign in an atlas (512 x 128 px per row = 8 m x 3.6 m).
function shopTexture() {
  const W = 512, RH = 128, H = RH * SIGNS.length;
  const [c, g] = canvas(W, H);
  SIGNS.forEach(([name, col], i) => {
    const y = i * RH;
    g.fillStyle = '#cfc8bb'; g.fillRect(0, y, W, RH);
    for (let s = 0; s < 2; s++) {
      const x = s * W / 2 + 12, w = W / 2 - 24;
      g.fillStyle = col; g.fillRect(x - 6, y + 6, w + 12, 30); // signboard
      g.fillStyle = '#fff'; g.font = 'bold 20px system-ui, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(s ? name : SIGNS[(i + 3) % SIGNS.length][0], x + w / 2, y + 21);
      const open = (i + s) % 3 !== 0;
      if (open) { // open shop: warm interior and goods
        g.fillStyle = '#5a4632'; g.fillRect(x, y + 42, w, RH - 46);
        g.fillStyle = '#f2d39b'; g.fillRect(x + 6, y + 48, w - 12, 18);
        const goods = ['#e74c3c', '#f39c12', '#27ae60', '#2980b9', '#ecf0f1'];
        for (let k = 0; k < 10; k++) { g.fillStyle = goods[k % goods.length]; g.fillRect(x + 10 + k * (w - 20) / 10, y + 74, (w - 20) / 12, 14 + (k % 3) * 6); }
        g.fillStyle = '#8b8f94'; g.fillRect(x, y + 42, w, 10); // shutter rolled up
      } else { // closed rolling shutter
        g.fillStyle = '#9ea3a8'; g.fillRect(x, y + 42, w, RH - 46);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (let k = 0; k < 16; k++) g.fillRect(x, y + 44 + k * 5, w, 1.5);
      }
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8;
  return t;
}

let shared = null;
function materials() {
  if (shared) return shared;
  shared = {
    walls: PAINTS.map((p, i) => new THREE.MeshStandardMaterial({ map: wallTexture(p, i * 7 + 3), roughness: 0.92 })),
    shop: new THREE.MeshStandardMaterial({ map: shopTexture(), roughness: 0.85 }),
    concrete: new THREE.MeshStandardMaterial({ color: '#b7b1a6', roughness: 0.95 }),
    tank: new THREE.MeshStandardMaterial({ color: '#1c1d1f', roughness: 0.55 }),
  };
  return shared;
}

class Arrays {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  quad(a, b, c, d, normal, uv) { // a,b,c,d counter-clockwise seen from outside
    const k = this.p.length / 3;
    for (const v of [a, b, c, d]) this.p.push(...v);
    for (let j = 0; j < 4; j++) this.n.push(...normal);
    this.uv.push(...uv);
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  box(cx, y0, cz, w, h, d) { // closed box (for ledges, parapets)
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h, u = [0, 0, 1, 0, 1, 1, 0, 1];
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], u);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], u);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], u);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], u);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], u);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

export class DhakaBuildings {
  constructor({ castShadow = true } = {}) {
    this.walls = PAINTS.map(() => new Arrays());
    this.shop = new Arrays();
    this.concrete = new Arrays();
    this.tanks = [];
    this.castShadow = castShadow;
    this.count = 0;
  }

  // Footprint centred on (x, z), w by d metres, with a shop floor and `floors` storeys above.
  // Returns the roof height.
  add(x, z, w, d, floors, seed = 0, paint = null) {
    const r = rng(seed * 9301 + 49297);
    const rolled = Math.floor(r() * PAINTS.length);
    const style = paint == null ? rolled : paint % PAINTS.length;
    const sign = Math.floor(r() * SIGNS.length);
    const hasShop = r() < 0.8;
    const base = hasShop ? SHOP : 0;
    const top = base + floors * FLOOR;
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const uOff = Math.floor(r() * 2) * 0.5;
    const wall = this.walls[style];
    const sides = [
      [[x0, z1], [x1, z1], [0, 0, 1], w], [[x1, z0], [x0, z0], [0, 0, -1], w],
      [[x1, z1], [x1, z0], [1, 0, 0], d], [[x0, z0], [x0, z1], [-1, 0, 0], d],
    ];
    for (const [[ax, az], [bx, bz], n, len] of sides) {
      const u1 = uOff + len / TILE_W, v1 = floors;
      wall.quad([ax, base, az], [bx, base, bz], [bx, top, bz], [ax, top, az], n, [uOff, 0, u1, 0, u1, v1, uOff, v1]);
      if (hasShop) {
        const row = (sign + (n[0] + 1) + (n[2] + 2)) % SIGNS.length;
        const vb = 1 - (row + 1) / SIGNS.length, vt = 1 - row / SIGNS.length;
        this.shop.quad([ax, 0, az], [bx, 0, bz], [bx, SHOP, bz], [ax, SHOP, az], n, [0, vb, len / TILE_W, vb, len / TILE_W, vt, 0, vt]);
      }
    }
    // Ledges at each floor line, a roof slab and a parapet.
    for (let f = hasShop ? 0 : 1; f <= floors; f++) {
      const y = base + f * FLOOR - (f === floors ? 0 : 0.1);
      this.concrete.box(x, y - 0.12, z, w + (f === 0 ? 0.9 : 0.4), 0.16, d + (f === 0 ? 0.9 : 0.4));
    }
    this.concrete.box(x, top, z, w, 0.12, d);
    const pt = 0.22, ph = 0.95;
    this.concrete.box(x, top, z1 - pt / 2, w, ph, pt); this.concrete.box(x, top, z0 + pt / 2, w, ph, pt);
    this.concrete.box(x1 - pt / 2, top, z, pt, ph, d); this.concrete.box(x0 + pt / 2, top, z, pt, ph, d);
    // Black rooftop water tanks (one or two), on a small stand.
    const nT = 1 + (r() < 0.45 ? 1 : 0);
    for (let k = 0; k < nT; k++) {
      const tx = x + (r() - 0.5) * (w - 3), tz = z + (r() - 0.5) * (d - 3);
      this.concrete.box(tx, top + 0.12, tz, 1.8, 0.5, 1.8);
      this.tanks.push([tx, top + 0.62, tz, 0.75 + r() * 0.2]);
    }
    this.count++;
    return top + 0.12;
  }

  build(group) {
    const m = materials();
    const meshes = [];
    this.walls.forEach((a, i) => { if (a.p.length) meshes.push(new THREE.Mesh(a.geometry(), m.walls[i])); });
    if (this.shop.p.length) meshes.push(new THREE.Mesh(this.shop.geometry(), m.shop));
    if (this.concrete.p.length) meshes.push(new THREE.Mesh(this.concrete.geometry(), m.concrete));
    if (this.tanks.length) {
      const tank = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1.5, 14), m.tank, this.tanks.length);
      const mat = new THREE.Matrix4();
      this.tanks.forEach(([x, y, z, s], i) => tank.setMatrixAt(i, mat.compose(new THREE.Vector3(x, y + 0.75 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s))));
      meshes.push(tank);
    }
    for (const mesh of meshes) { mesh.castShadow = this.castShadow; mesh.receiveShadow = true; group.add(mesh); }
    this.meshes = meshes;
    return meshes;
  }

  dispose() { for (const mesh of this.meshes || []) mesh.geometry.dispose(); }
}
