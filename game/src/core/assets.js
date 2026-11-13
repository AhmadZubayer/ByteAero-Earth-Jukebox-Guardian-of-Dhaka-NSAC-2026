// Model loading with meshopt decoding, caching and skinned-mesh cloning.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
const base = import.meta.env.BASE_URL || './';

export function modelUrl(name) {
  return `${base}models/${name}.glb`;
}

export function loadModel(name, onProgress) {
  if (!cache.has(name)) {
    cache.set(name, new Promise((resolve, reject) => {
      loader.load(modelUrl(name), (gltf) => {
        gltf.scene.traverse((o) => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        });
        resolve(gltf);
      }, onProgress, reject);
    }));
  }
  return cache.get(name);
}

export async function loadModels(names, onEach) {
  let done = 0;
  const out = {};
  await Promise.all(names.map(async (n) => {
    out[n] = await loadModel(n);
    done++;
    onEach?.(done, names.length, n);
  }));
  return out;
}

// A fresh copy of a model's scene. Skinned characters need SkeletonUtils.clone.
export function instance(gltf) {
  let skinned = false;
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });
  return skinned ? cloneSkinned(gltf.scene) : gltf.scene.clone(true);
}
