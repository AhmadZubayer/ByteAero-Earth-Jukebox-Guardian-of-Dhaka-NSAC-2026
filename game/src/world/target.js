// A "go here" marker that cannot be confused with sound rings: a bright yellow disc and ring,
// a tall light beam and a bouncing arrow above it.
import * as THREE from 'three';

export class Target {
  constructor(scene) {
    this.group = new THREE.Group();
    const yellow = '#ffe14d';
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshBasicMaterial({ color: yellow, transparent: true, opacity: 0.28, depthWrite: false }));
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.8, 48), new THREE.MeshBasicMaterial({ color: yellow, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide }));
    for (const m of [this.disc, this.ring]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 5; }
    this.disc.position.y = 0.22; this.ring.position.y = 0.24;
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.4, 14, 24, 1, true), new THREE.MeshBasicMaterial({ color: yellow, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.position.y = 7;
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.3, 4), new THREE.MeshBasicMaterial({ color: yellow }));
    this.arrow.rotation.x = Math.PI; // point down
    this.group.add(this.disc, this.ring, this.beam, this.arrow);
    this.group.visible = false;
    scene.add(this.group);
    this.scene = scene;
    this.t = 0;
  }

  show(x, z, size = 1) {
    this.setNear(false);
    this.group.position.set(x, 0, z);
    this.group.scale.set(size, 1, size);
    this.group.visible = true;
  }

  hide() { this.group.visible = false; }

  // Close by: keep the glowing disc on the ground, drop the beam and arrow.
  setNear(near) { this.beam.visible = !near; this.arrow.visible = !near; }

  update(dt, reducedMotion = false) {
    this.t += dt;
    this.arrow.position.y = 3.2 + (reducedMotion ? 0 : Math.sin(this.t * 3) * 0.4);
    this.arrow.rotation.y += reducedMotion ? 0 : dt * 1.5;
    this.ring.material.opacity = 0.75 + Math.sin(this.t * 5) * 0.25;
  }

  dispose() { this.scene.remove(this.group); }
}
