// Third-person follow camera: orbit by drag, pulls in front of tall walls.
import * as THREE from 'three';

export class FollowCamera {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.yaw = 0;
    this.pitch = 0.38;
    this.distance = 7.5;
    this.height = 1.35;
    this.current = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.shake = 0;
    this.reducedMotion = false;
    this.first = true;
  }

  // look: {dx, dy} pixels dragged since the last frame.
  update(dt, target, look, playerFacing, moving) {
    this.yaw -= look.dx * 0.006;
    this.pitch = THREE.MathUtils.clamp(this.pitch + look.dy * 0.004, 0.08, 1.15);
    // Drift gently behind the player while walking and not dragging.
    if (moving && look.dx === 0) {
      const behind = playerFacing + Math.PI;
      let d = behind - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 0.9);
    }
    const tx = target.x, ty = target.y + this.height, tz = target.z;
    const cd = Math.cos(this.pitch) * this.distance;
    let px = tx + Math.sin(this.yaw) * cd, pz = tz + Math.cos(this.yaw) * cd;
    const py = ty + Math.sin(this.pitch) * this.distance;
    // Avoid putting a building between the camera and the child.
    const t = this.world.rayBlocked(tx, tz, px, pz, ty + 0.5);
    if (t < 1) { const k = Math.max(0.25, t - 0.08); px = tx + (px - tx) * k; pz = tz + (pz - tz) * k; }
    const want = new THREE.Vector3(px, py, pz);
    if (this.first) { this.current.copy(want); this.lookAt.set(tx, ty, tz); this.first = false; }
    const k = 1 - Math.exp(-dt * 10);
    this.current.lerp(want, k);
    this.lookAt.lerp(new THREE.Vector3(tx, ty, tz), 1 - Math.exp(-dt * 14));
    this.camera.position.copy(this.current);
    if (this.shake > 0 && !this.reducedMotion) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 0.8);
    }
    this.camera.lookAt(this.lookAt);
  }

  snapBehind(facing) { this.yaw = facing + Math.PI; this.first = true; }
}
