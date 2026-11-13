// Lightweight character collision for a flat city: a vertical capsule (circle in plan view)
// against axis-aligned boxes, plus a ground plane and world bounds.
//
// The plan named Rapier for this. Its WebAssembly build is 1.65 MB gzipped on its own, which is
// above the whole 1.5 MB library budget, and the city only needs circle-vs-box tests, so this
// small module does the job instead. The interface is kept narrow so Rapier could replace it.

export class CollisionWorld {
  constructor() {
    this.boxes = []; // { minX, maxX, minZ, maxZ, top, tag }
    this.bounds = null; // { minX, maxX, minZ, maxZ }
    this.cell = 8;
    this.grid = new Map();
  }

  clear() { this.boxes.length = 0; this.grid.clear(); }

  addBox(cx, cz, w, d, top = 10, tag = null) {
    const b = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, top, tag };
    this.boxes.push(b);
    const c = this.cell;
    for (let gx = Math.floor(b.minX / c); gx <= Math.floor(b.maxX / c); gx++) {
      for (let gz = Math.floor(b.minZ / c); gz <= Math.floor(b.maxZ / c); gz++) {
        const k = gx * 100003 + gz;
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(b);
      }
    }
    return b;
  }

  removeTag(tag) {
    this.boxes = this.boxes.filter((b) => b.tag !== tag);
    this.grid.clear();
    const old = this.boxes; this.boxes = [];
    for (const b of old) this.addBox((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, b.maxX - b.minX, b.maxZ - b.minZ, b.top, b.tag);
  }

  setBounds(minX, maxX, minZ, maxZ) { this.bounds = { minX, maxX, minZ, maxZ }; }

  near(x, z, r) {
    const c = this.cell, out = new Set();
    for (let gx = Math.floor((x - r) / c); gx <= Math.floor((x + r) / c); gx++) {
      for (let gz = Math.floor((z - r) / c); gz <= Math.floor((z + r) / c); gz++) {
        const list = this.grid.get(gx * 100003 + gz);
        if (list) for (const b of list) out.add(b);
      }
    }
    return out;
  }

  // Ground height under a point (top of a box the feet are above, else 0).
  groundAt(x, z, r, feetY) {
    let h = 0;
    for (const b of this.near(x, z, r)) {
      if (x + r * 0.5 > b.minX && x - r * 0.5 < b.maxX && z + r * 0.5 > b.minZ && z - r * 0.5 < b.maxZ && feetY >= b.top - 0.35) h = Math.max(h, b.top);
    }
    return h;
  }

  // Move a circle of radius r from (x,z) by (dx,dz), sliding along boxes. feetY lets the player
  // stand on low boxes (steps, benches) it is above.
  move(pos, dx, dz, r, feetY = 0) {
    let x = pos.x + dx, z = pos.z + dz;
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      for (const b of this.near(x, z, r + 0.5)) {
        if (feetY >= b.top - 0.35) continue; // standing on top of it
        const px = Math.max(b.minX, Math.min(x, b.maxX));
        const pz = Math.max(b.minZ, Math.min(z, b.maxZ));
        let ox = x - px, oz = z - pz;
        const d2 = ox * ox + oz * oz;
        if (d2 >= r * r) continue;
        if (d2 < 1e-8) {
          // Centre inside the box: push out along the shortest axis.
          const l = x - b.minX, rr = b.maxX - x, f = z - b.minZ, k = b.maxZ - z;
          const m = Math.min(l, rr, f, k);
          if (m === l) x = b.minX - r; else if (m === rr) x = b.maxX + r; else if (m === f) z = b.minZ - r; else z = b.maxZ + r;
        } else {
          const d = Math.sqrt(d2);
          ox /= d; oz /= d;
          x = px + ox * r; z = pz + oz * r;
        }
        pushed = true;
      }
      if (!pushed) break;
    }
    if (this.bounds) {
      x = Math.max(this.bounds.minX + r, Math.min(this.bounds.maxX - r, x));
      z = Math.max(this.bounds.minZ + r, Math.min(this.bounds.maxZ - r, z));
    }
    pos.x = x; pos.z = z;
  }

  // Is a circle free of boxes? Used for placing fixes.
  isFree(x, z, r) {
    for (const b of this.near(x, z, r)) {
      const px = Math.max(b.minX, Math.min(x, b.maxX)), pz = Math.max(b.minZ, Math.min(z, b.maxZ));
      if ((x - px) ** 2 + (z - pz) ** 2 < r * r) return false;
    }
    return true;
  }

  // Line of sight test in plan view (for the camera pulling in front of walls).
  rayBlocked(ax, az, bx, bz, minTop = 2) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      for (const b of this.near(x, z, 0.3)) {
        if (b.top >= minTop && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return t;
      }
    }
    return 1;
  }
}
