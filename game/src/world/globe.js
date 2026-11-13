// The Earth Jukebox globe: NASA SVS 5060 global temperature frames on a sphere, cross-faded by year.
import * as THREE from 'three';
import { nasaUrl } from '../data/nasa.js';

export const FRAME_YEARS = [1884, 1900, 1920, 1940, 1960, 1980, 2000, 2010, 2022];

// Direction on the unit sphere for a latitude/longitude, matching three's SphereGeometry UVs.
export function latLonDir(lat, lon, out = new THREE.Vector3()) {
  const la = THREE.MathUtils.degToRad(lat), lo = THREE.MathUtils.degToRad(lon);
  return out.set(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
}

export class Globe {
  constructor() {
    this.group = new THREE.Group();
    this.textures = [];
    this.radius = 10;
  }

  async load(renderer) {
    const loader = new THREE.TextureLoader();
    this.textures = await Promise.all(FRAME_YEARS.map((y) => loader.loadAsync(nasaUrl(`timelapse/nasa-gistemp-${y}.jpg`))));
    this.blue = await loader.loadAsync(nasaUrl('earth-blue-marble-2002.jpg'));
    const aniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
    for (const t of [...this.textures, this.blue]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; }
    const img = this.textures[0].image;
    const texel = new THREE.Vector2(1 / (img.width || 1024), 1 / (img.height || 512));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { a: { value: this.textures[0] }, b: { value: this.textures[1] }, mixv: { value: 0 }, texel: { value: texel }, sun: { value: new THREE.Vector3(0.6, 0.35, 1).normalize() } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      // Light unsharp mask to keep coastlines crisp when the frames are enlarged; almost flat
      // lighting so the colours stay true to NASA's scale.
      fragmentShader: `uniform sampler2D a; uniform sampler2D b; uniform float mixv; uniform vec2 texel; uniform vec3 sun; varying vec2 vUv; varying vec3 vN;
        vec3 sharp(sampler2D t, vec2 uv) {
          vec3 c = texture2D(t, uv).rgb;
          vec3 n = (texture2D(t, uv + vec2(texel.x, 0.0)).rgb + texture2D(t, uv - vec2(texel.x, 0.0)).rgb
                  + texture2D(t, uv + vec2(0.0, texel.y)).rgb + texture2D(t, uv - vec2(0.0, texel.y)).rgb) * 0.25;
          return clamp(c + (c - n) * 0.4, 0.0, 1.0);
        }
        void main(){ vec3 c = mix(sharp(a, vUv), sharp(b, vUv), mixv);
          float l = mix(0.8, 1.04, max(dot(vN, sun), 0.0));
          gl_FragColor = vec4(c * l, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.globe = new THREE.Mesh(new THREE.SphereGeometry(this.radius, 96, 64), this.mat);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(this.radius * 1.022, 64, 32), new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 4.0); gl_FragColor = vec4(0.55, 0.8, 1.0, f * 0.55); }',
    }));
    // Dhaka marker.
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffd34d' }));
    this.marker.position.copy(latLonDir(23.81, 90.41).multiplyScalar(this.radius * 1.005));
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.34, 32), new THREE.MeshBasicMaterial({ color: '#ffd34d', side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    halo.position.copy(this.marker.position);
    halo.lookAt(this.marker.position.clone().multiplyScalar(2));
    this.halo = halo;
    this.spin = new THREE.Group();
    this.spin.add(this.globe, this.marker, halo);
    this.group.add(this.spin, atmo);
    // Stars
    const n = 1500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(300 + Math.random() * 200);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.2, sizeAttenuation: false }));
    this.group.add(this.stars);
  }

  // Show a (fractional) year: blends the two nearest frames.
  setYear(y) {
    let k = 0;
    while (k < FRAME_YEARS.length - 2 && y > FRAME_YEARS[k + 1]) k++;
    const y0 = FRAME_YEARS[k], y1 = FRAME_YEARS[k + 1];
    const t = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
    this.mat.uniforms.a.value = this.textures[k];
    this.mat.uniforms.b.value = this.textures[k + 1];
    this.mat.uniforms.mixv.value = t;
    return { from: y0, to: y1, t };
  }

  showBlueMarble() {
    this.mat.uniforms.a.value = this.blue; this.mat.uniforms.b.value = this.blue; this.mat.uniforms.mixv.value = 0;
  }

  // Rotation that turns Dhaka toward +Z (the camera).
  faceDhakaRotation() {
    const d = latLonDir(23.81, 90.41);
    return Math.atan2(d.x, d.z) * -1;
  }

  update(dt, t) {
    this.halo.scale.setScalar(1 + Math.sin(t * 3) * 0.2);
  }

  dispose() {
    for (const t of [...this.textures, this.blue]) t?.dispose();
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
}
