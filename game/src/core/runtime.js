// The 3D runtime: stage, input, collision world, player, camera, Echo and the frame loop.
// Scenes (test street, Dhaka round, globe) plug in with setScene().
import * as THREE from 'three';
import { Stage } from './renderer.js';
import { Input } from './input.js';
import { CollisionWorld } from './collision.js';
import { loadModel } from './assets.js';
import { Player } from '../player/character.js';
import { FollowCamera } from '../player/camera.js';
import { Echo } from '../player/echo.js';
import { audio } from '../audio/engine.js';

export class Runtime {
  constructor(settings) {
    this.settings = settings;
    this.stage = new Stage(document.getElementById('stage'), { quality: settings.quality });
    this.input = new Input(this.stage.renderer.domElement, document.getElementById('touch'));
    this.world = new CollisionWorld();
    this.scene = null;
    this.clock = new THREE.Clock();
    this.frames = 0; this.fpsTime = 0; this.fps = 0;
    this.listeners = new Set();
    this.paused = false;
    this.playerActive = false;
    this.loop = this.loop.bind(this);
  }

  async init(onProgress) {
    const gltf = await loadModel('person-c', onProgress);
    this.player = new Player(gltf, this.world);
    this.stage.scene.add(this.player.root);
    this.follow = new FollowCamera(this.stage.camera, this.world);
    this.follow.reducedMotion = this.settings.reducedMotion;
    this.echo = new Echo(this.stage.scene);
    this.input.on('jump', () => this.player.jump());
    requestAnimationFrame(this.loop);
  }

  setScene(scene) {
    this.scene?.dispose?.();
    this.scene = scene;
    this.world.clear();
    scene?.build?.(this);
  }

  setPlayerActive(v) {
    this.playerActive = v;
    this.input.setEnabled(v);
    this.player.root.visible = v || this.player.root.visible;
    document.getElementById('touch').hidden = !(v && this.input.isTouch && !this.settings.textOnly);
  }

  onFrame(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  loop() {
    requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 1 / 20);
    this.frames++; this.fpsTime += raw;
    if (this.fpsTime >= 1) { this.fps = this.frames / this.fpsTime; this.frames = 0; this.fpsTime = 0; window.__fps = Math.round(this.fps * 10) / 10; }
    if (this.paused || this.settings.textOnly) return;
    const look = this.input.consumeLook();
    if (this.scene?.camera !== 'custom' && this.player) {
      if (this.playerActive) {
        const axes = this.input.axes();
        this.player.step(dt, axes, this.follow.yaw);
        this.follow.update(dt, this.player.pos, look, this.player.facing, Math.hypot(axes.x, axes.y) > 0.1);
      } else {
        this.player.mixer.update(dt);
        this.follow.update(dt, this.player.pos, look, this.player.facing, false);
      }
      this.echo.update(dt, this.player, this.settings.reducedMotion);
      if (audio.ready) audio.setListener(this.player.pos.x, this.player.pos.y + 1.3, this.player.pos.z, -Math.sin(this.follow.yaw), -Math.cos(this.follow.yaw));
      this.stage.followShadow(this.player.pos.x, this.player.pos.z);
    }
    this.scene?.update?.(dt, this);
    for (const fn of this.listeners) fn(dt);
    this.stage.render(dt);
  }
}
