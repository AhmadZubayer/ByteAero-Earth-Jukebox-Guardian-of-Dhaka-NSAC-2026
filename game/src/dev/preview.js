// Dev-only contact sheet of every compressed model, with bounding-box sizes logged.
import * as THREE from 'three';
import { loadModel, instance } from '../core/assets.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bcd');
scene.add(new THREE.HemisphereLight('#fff', '#664', 2));
const sun = new THREE.DirectionalLight('#fff', 2); sun.position.set(3, 6, 4); scene.add(sun);
const manifest = await (await fetch('/models/manifest.json')).json();
const names = Object.keys(manifest);
const cols = 7;
const sizes = {};
await Promise.all(names.map(async (n, i) => {
  const g = await loadModel(n);
  const o = instance(g);
  const box = new THREE.Box3().setFromObject(o);
  const s = box.getSize(new THREE.Vector3());
  sizes[n] = [s.x, s.y, s.z].map((v) => +v.toFixed(2));
  const k = 1.6 / Math.max(s.x, s.y, s.z);
  o.scale.multiplyScalar(k);
  const c = box.getCenter(new THREE.Vector3()).multiplyScalar(k);
  o.position.set((i % cols) * 2 - cols + 1 - c.x, -box.min.y * k, Math.floor(i / cols) * 2 - c.z);
  scene.add(o);
  if (g.animations.length) {
    const mixer = new THREE.AnimationMixer(o);
    mixer.clipAction(g.animations.find((a) => /idle/i.test(a.name)) || g.animations[0]).play();
    mixer.update(0.3);
  }
}));
const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
cam.position.set(0, 9, 14); cam.lookAt(0, 0, 3);
renderer.render(scene, cam);
console.log('SIZES ' + JSON.stringify(sizes));
window.__ready = true;
