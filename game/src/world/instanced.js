// Turn a static glTF model into InstancedMeshes (one per mesh part) so a city of copies costs
// a handful of draw calls.
import * as THREE from 'three';

// Compressed models store positions and normals as quantized integers. Baking a transform into
// them would clip values outside -1..1, so copy every attribute to plain floats first.
function toFloat(src) {
  const geo = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(src.attributes)) {
    const n = a.count, k = a.itemSize, out = new Float32Array(n * k);
    const get = [a.getX, a.getY, a.getZ, a.getW];
    for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) out[i * k + j] = get[j].call(a, i);
    geo.setAttribute(name, new THREE.BufferAttribute(out, k));
  }
  if (src.index) geo.setIndex(Array.from(src.index.array));
  for (const gr of src.groups) geo.addGroup(gr.start, gr.count, gr.materialIndex);
  return geo;
}

export class InstancedModel {
  constructor(gltf, capacity, { castShadow = true, receiveShadow = true } = {}) {
    this.parts = [];
    this.count = 0;
    this.capacity = capacity;
    this.group = new THREE.Group();
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    gltf.scene.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh) return;
      const geo = toFloat(o.geometry);
      geo.applyMatrix4(o.matrixWorld);
      geo.computeBoundingBox();
      box.union(geo.boundingBox);
      const mesh = new THREE.InstancedMesh(geo, o.material, capacity);
      mesh.count = 0;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.frustumCulled = false;
      this.parts.push(mesh);
      this.group.add(mesh);
    });
    this.box = box;
    this.size = box.getSize(new THREE.Vector3());
  }

  add(matrix, color) {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    for (const p of this.parts) {
      p.setMatrixAt(i, matrix);
      if (color) p.setColorAt(i, color);
      p.count = this.count;
      p.instanceMatrix.needsUpdate = true;
      if (p.instanceColor) p.instanceColor.needsUpdate = true;
    }
    return i;
  }

  set(i, matrix) {
    for (const p of this.parts) { p.setMatrixAt(i, matrix); p.instanceMatrix.needsUpdate = true; }
  }

  clear() {
    this.count = 0;
    for (const p of this.parts) p.count = 0;
  }

  dispose() {
    for (const p of this.parts) { p.geometry.dispose(); p.dispose(); }
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
export function matrixFrom(x, y, z, rotY = 0, scale = 1, sy = scale) {
  _q.setFromEuler(_e.set(0, rotY, 0));
  _s.set(scale, sy, scale);
  return _m.compose(_p.set(x, y, z), _q, _s);
}
