// Echo, the small satellite-drone companion, built from primitives.
import * as THREE from 'three';
import gsap from 'gsap';

export class Echo {
  constructor(scene) {
    this.group = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: '#eef2f6', roughness: 0.35, metalness: 0.3 });
    const gold = new THREE.MeshStandardMaterial({ color: '#e2b04a', roughness: 0.4, metalness: 0.6 });
    const panel = new THREE.MeshStandardMaterial({ color: '#2b5fae', roughness: 0.3, metalness: 0.5, emissive: '#0c2050', emissiveIntensity: 0.4 });
    this.eyeMat = new THREE.MeshStandardMaterial({ color: '#7ff3ff', emissive: '#4fe0ff', emissiveIntensity: 2.4 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), white);
    body.scale.set(1, 0.9, 1);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.035, 8, 24), gold);
    band.rotation.x = Math.PI / 2;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), this.eyeMat);
    eye.position.set(0, 0.02, 0.24);
    eye.scale.set(1.2, 0.8, 0.5);
    this.wings = new THREE.Group();
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22), gold);
      arm.rotation.z = Math.PI / 2; arm.position.x = s * 0.36;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.22), panel);
      p.position.x = s * 0.62;
      this.wings.add(arm, p);
    }
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25), gold);
    antenna.position.y = 0.36;
    this.tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), this.eyeMat);
    this.tip.position.y = 0.5;
    this.body = new THREE.Group();
    this.body.add(body, band, eye, this.wings, antenna, this.tip);
    this.group.add(this.body);
    this.light = new THREE.PointLight('#7ff3ff', 1.2, 5, 2);
    this.group.add(this.light);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.group);

    this.t = 0;
    this.target = new THREE.Vector3();
    this.lookTarget = null;
    this.scanRings = [];
    this.scene = scene;
  }

  setMood(hot) {
    // Cyan when calm, amber when heat is near.
    const c = new THREE.Color('#4fe0ff').lerp(new THREE.Color('#ff9a3c'), hot);
    this.eyeMat.emissive.copy(c);
    this.eyeMat.color.copy(c);
    this.light.color.copy(c);
  }

  // Float beside the player's shoulder.
  update(dt, player, reducedMotion = false) {
    this.t += dt;
    const f = player.facing;
    const side = 0.95;
    this.target.set(
      player.pos.x + Math.cos(f) * -side + Math.sin(f) * -0.4,
      player.pos.y + 1.75 + (reducedMotion ? 0 : Math.sin(this.t * 2.1) * 0.1),
      player.pos.z - Math.sin(f) * -side + Math.cos(f) * -0.4,
    );
    this.group.position.lerp(this.target, 1 - Math.exp(-dt * 5));
    const look = this.lookTarget || new THREE.Vector3(player.pos.x + Math.sin(f) * 5, this.group.position.y, player.pos.z + Math.cos(f) * 5);
    const ang = Math.atan2(look.x - this.group.position.x, look.z - this.group.position.z);
    let d = ang - this.body.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.body.rotation.y += d * Math.min(1, dt * 4);
    if (!reducedMotion) this.wings.rotation.z = Math.sin(this.t * 1.3) * 0.08;

    for (let i = this.scanRings.length - 1; i >= 0; i--) {
      const r = this.scanRings[i];
      r.life += dt;
      const k = r.life / r.dur;
      r.mesh.scale.setScalar(1 + k * r.size);
      r.mesh.material.opacity = 0.7 * (1 - k);
      if (k >= 1) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); this.scanRings.splice(i, 1); }
    }
  }

  // A light ring that sweeps out across the ground from the player.
  scan(origin, { size = 60, dur = 2.2, color = '#7ff3ff' } = {}) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 64),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(origin.x, origin.y + 0.15, origin.z);
    this.scene.add(mesh);
    this.scanRings.push({ mesh, life: 0, dur, size });
    gsap.fromTo(this.tip.scale, { x: 1, y: 1, z: 1 }, { x: 2.2, y: 2.2, z: 2.2, duration: 0.25, yoyo: true, repeat: 3 });
  }
}
