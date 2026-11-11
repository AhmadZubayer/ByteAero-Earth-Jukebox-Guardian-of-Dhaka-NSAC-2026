// Procedural ground textures (no image downloads): asphalt with lane marks, paving, grass.
import * as THREE from 'three';

function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

function noise(g, s, base, spread, n = 1800) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    const v = Math.floor((Math.random() - 0.5) * spread);
    g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`;
    g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
}

let textures = null;
export function groundTextures() {
  if (textures) return textures;
  textures = {
    asphalt: canvasTex(256, (g, s) => {
      noise(g, s, '#55585e', 40);
      g.fillStyle = '#e9e2c8';
      for (let y = 0; y < s; y += 64) g.fillRect(s / 2 - 3, y + 8, 6, 34);
    }),
    paving: canvasTex(256, (g, s) => {
      noise(g, s, '#c9bfae', 30, 1200);
      g.strokeStyle = 'rgba(80,70,60,0.35)'; g.lineWidth = 2;
      for (let i = 0; i <= s; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); }
    }),
    grass: canvasTex(256, (g, s) => {
      noise(g, s, '#6fa24a', 50, 2600);
    }),
    dirt: canvasTex(256, (g, s) => noise(g, s, '#b59a6e', 40, 2000)),
  };
  return textures;
}

export function plane(w, d, map, repeatX = 1, repeatY = 1, color = '#fff') {
  const t = map.clone();
  t.needsUpdate = true;
  t.repeat.set(repeatX, repeatY);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, color, roughness: 0.95 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}
