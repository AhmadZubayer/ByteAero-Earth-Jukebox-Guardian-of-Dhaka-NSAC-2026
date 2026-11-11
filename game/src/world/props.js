// Dhaka street props built from Three.js shapes: cycle rickshaw, tea stall, rooftop water tank, kite.
// No suitable free rickshaw model was found, so it is made here.
import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
const cache = {};
function m(key, color, extra) { return (cache[key] ||= mat(color, extra)); }

function wheel(r = 0.34) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 8, 22), m('tire', '#222'));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8), m('steel', '#9aa3ad', { metalness: 0.6, roughness: 0.3 }));
  hub.rotation.x = Math.PI / 2;
  g.add(tire, hub);
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.012, r * 2, 0.012), m('steel'));
    s.rotation.z = (i / 6) * Math.PI;
    g.add(s);
  }
  g.rotation.y = Math.PI / 2;
  return g;
}

const HOODS = ['#d6336c', '#2a9d8f', '#e76f51', '#f4a261', '#7b2cbf', '#1d74c8'];

export function makeRickshaw(seed = 0) {
  const g = new THREE.Group();
  const hood = HOODS[seed % HOODS.length];
  const frame = m('frame', '#2c3e50', { metalness: 0.4, roughness: 0.4 });
  // Rear axle with two wheels.
  const wl = wheel(); wl.position.set(-0.55, 0.34, -0.35);
  const wr = wheel(); wr.position.set(0.55, 0.34, -0.35);
  const wf = wheel(0.3); wf.position.set(0, 0.3, 1.25);
  g.add(wl, wr, wf);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1), frame);
  axle.rotation.z = Math.PI / 2; axle.position.set(0, 0.34, -0.35);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.6), frame);
  bar.position.set(0, 0.5, 0.45);
  const fork = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.04), frame);
  fork.position.set(0, 0.62, 1.22);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.04), frame);
  handle.position.set(0, 0.95, 1.15);
  const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.3), m('seat', '#5b2a12'));
  driverSeat.position.set(0, 0.95, 0.6);
  // Passenger box and seat.
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.7), m(`box${seed}`, hood));
  box.position.set(0, 0.7, -0.35);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.5), m('cushion', '#c0392b'));
  seat.position.set(0, 0.92, -0.35);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.08), m('panel', '#f1c40f'));
  back.position.set(0, 1.15, -0.68);
  // Folding hood: a half cylinder.
  const hoodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.75, 14, 1, true, -Math.PI / 2, Math.PI), m(`hood${seed}`, hood, { side: THREE.DoubleSide }));
  hoodMesh.rotation.z = Math.PI / 2; hoodMesh.rotation.y = Math.PI / 2;
  hoodMesh.position.set(0, 1.25, -0.45);
  hoodMesh.scale.set(1, 1, 1.05);
  // Painted decoration on the back panel (rickshaw art is very colourful).
  for (let i = 0; i < 3; i++) {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), m(`deco${i}`, ['#e74c3c', '#27ae60', '#2980b9'][i]));
    dot.position.set(-0.3 + i * 0.3, 1.15, -0.725);
    dot.rotation.y = Math.PI;
    g.add(dot);
  }
  g.add(axle, bar, fork, handle, driverSeat, box, seat, back, hoodMesh);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  g.userData.wheels = [wl, wr, wf];
  return g;
}

export function makeTeaStall() {
  const g = new THREE.Group();
  const wood = m('wood', '#8b5a2b');
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.0), wood);
  counter.position.y = 0.5;
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 1.1), m('top', '#d9c3a0'));
  top.position.y = 1.04;
  const poleMat = m('pole', '#5a3a1a');
  for (const [x, z] of [[-1.05, -0.45], [1.05, -0.45], [-1.05, 0.45], [1.05, 0.45]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3), poleMat);
    p.position.set(x, 1.15, z);
    g.add(p);
  }
  const awning = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 1.6), m('awning', '#1f8a70'));
  awning.position.set(0, 2.32, 0.15); awning.rotation.x = 0.12;
  const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.28, 10), m('kettle', '#b0b7bf', { metalness: 0.7, roughness: 0.3 }));
  kettle.position.set(-0.5, 1.22, 0);
  const cups = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.09, 8), m('cup', '#f5f0e6'));
    c.position.set(0.2 + i * 0.16, 1.13, 0.1);
    cups.add(c);
  }
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.4), wood);
  bench.position.set(0, 0.45, 1.3);
  for (const x of [-0.8, 0.8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.35), wood);
    leg.position.set(x, 0.22, 1.3);
    g.add(leg);
  }
  g.add(counter, top, awning, kettle, cups, bench);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// A kite on a string, for rooftops (kite flying is a Dhaka tradition).
export function makeKite(color = '#e63946') {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.5); shape.lineTo(0.35, 0); shape.lineTo(0, -0.6); shape.lineTo(-0.35, 0); shape.closePath();
  const kite = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.6 }));
  g.add(kite);
  return g;
}
