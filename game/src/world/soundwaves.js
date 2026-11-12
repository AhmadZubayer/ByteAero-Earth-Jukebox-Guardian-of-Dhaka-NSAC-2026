// Visible sound: each note of a heat call sends out a glowing ring and a rising spark from its
// source, so the sound's flow can be seen as well as heard.
import * as THREE from 'three';

const ringGeo = new THREE.RingGeometry(0.92, 1, 48);
const sparkGeo = new THREE.SphereGeometry(0.22, 10, 8);

export class SoundWaves {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.enabled = true;
  }

  // f: note frequency (higher = brighter, warmer colour). p: player closeness 0..1.
  spawn(x, z, f = 440, p = 0) {
    if (!this.enabled || this.items.length > 40) return;
    const t = Math.max(0, Math.min(1, (Math.log2(f) - Math.log2(250)) / 2.2));
    const color = new THREE.Color().setHSL(0.11 - t * 0.1, 1, 0.55 + t * 0.1);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.35, z);
    ring.renderOrder = 4;
    const spark = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false }));
    spark.position.set(x + (Math.random() - 0.5) * 2, 3 + t * 2, z + (Math.random() - 0.5) * 2);
    this.scene.add(ring, spark);
    this.items.push({ ring, spark, life: 0, dur: 2.4, size: 14 + p * 10 });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life += dt;
      const k = it.life / it.dur;
      it.ring.scale.setScalar(1 + k * it.size);
      it.ring.material.opacity = 0.85 * (1 - k) ** 1.5;
      it.spark.position.y += dt * 3.2;
      it.spark.material.opacity = 1 - k;
      if (k >= 1) {
        this.scene.remove(it.ring, it.spark);
        it.ring.material.dispose(); it.spark.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() { for (const it of this.items) { this.scene.remove(it.ring, it.spark); it.ring.material.dispose(); it.spark.material.dispose(); } this.items = []; }
}
