// Renderer, scene, camera, lights and post-processing, with a low-quality switch.
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, ToneMappingEffect, ToneMappingMode, HueSaturationEffect, BrightnessContrastEffect } from 'postprocessing';

export class Stage {
  constructor(container, { quality = 'high' } = {}) {
    this.container = container;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
    this.camera.position.set(0, 6, 10);

    this.hemi = new THREE.HemisphereLight('#cfe6ff', '#7a6248', 1.4);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff3dd', 2.6);
    this.sun.position.set(30, 50, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = -45; s.right = 45; s.top = 45; s.bottom = -45; s.near = 1; s.far = 160;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog('#d9e6ee', 60, 260);
    this.scene.background = new THREE.Color('#bcd9ec');

    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new BloomEffect({ intensity: 0.6, luminanceThreshold: 0.82, luminanceSmoothing: 0.2, mipmapBlur: true });
    this.vignette = new VignetteEffect({ darkness: 0.38, offset: 0.32 });
    this.grade = new HueSaturationEffect({ saturation: 0.08, hue: 0 });
    this.contrast = new BrightnessContrastEffect({ contrast: 0.06 });
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    this.effectPass = new EffectPass(this.camera, this.bloom, this.grade, this.contrast, this.vignette, this.tone);
    this.composer.addPass(this.effectPass);

    this.setQuality(quality);
    this.resize = this.resize.bind(this);
    addEventListener('resize', this.resize);
    this.resize();
  }

  setQuality(q) {
    this.quality = q;
    const low = q === 'low';
    this.renderer.shadowMap.enabled = !low;
    this.sun.castShadow = !low;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1 : 1.75));
    this.usePost = !low;
    this.renderer.toneMapping = low ? THREE.AgXToneMapping : THREE.NoToneMapping;
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    this.resize?.();
  }

  // Warm/cool grading for heat. t = 0 calm, 1 very hot.
  setHeatLook(t) {
    const hot = new THREE.Color('#f3c08a'), cool = new THREE.Color('#bcd9ec');
    this.scene.background.copy(cool).lerp(hot, t * 0.85);
    this.scene.fog.color.copy(this.scene.background);
    this.scene.fog.near = 60 - t * 30;
    this.scene.fog.far = 260 - t * 120;
    this.sun.color.set('#fff3dd').lerp(new THREE.Color('#ffc58a'), t);
    this.hemi.color.set('#cfe6ff').lerp(new THREE.Color('#ffd9b0'), t);
    this.grade.hue = t * -0.06;
    this.grade.saturation = 0.08 + t * 0.12;
  }

  resize() {
    const w = this.container.clientWidth || innerWidth, h = this.container.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Data view (the globe): no post-processing or tone mapping, so NASA's colours stay exactly as
  // published, and full device resolution for sharp detail.
  setDataView(on) {
    this.dataView = on;
    this.renderer.toneMapping = on ? THREE.NoToneMapping : (this.quality === 'low' ? THREE.AgXToneMapping : THREE.NoToneMapping);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, on ? 2 : this.quality === 'low' ? 1 : 1.75));
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    this.resize();
  }

  render(dt) {
    if (this.dataView) this.renderer.render(this.scene, this.camera);
    else if (this.usePost) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  // Keep the shadow camera centred on the player so a small shadow map covers the play area.
  followShadow(x, z) {
    this.sun.position.set(x + 30, 50, z + 20);
    this.sun.target.position.set(x, 0, z);
  }
}
