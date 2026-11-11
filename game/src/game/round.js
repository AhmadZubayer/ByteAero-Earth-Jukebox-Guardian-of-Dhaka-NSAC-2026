// One Dhaka round in 3D: Listen -> Find -> Protect -> heat wave -> result.
import * as THREE from 'three';
import gsap from 'gsap';
import { City, loadCity, districtCentre, districtAt, HALF, cityModels } from '../world/city.js';
import { resolve, FIXES, pickSpots, DANGER, N } from './heat.js';
import { cellsFor, waveFor, layoutDistrict, plotFree } from './rounds.js';
import { audio } from '../audio/engine.js';
import { Conductor, playScan, MAP, describeMusic } from '../audio/sonify.js';
import { sitar, tabla } from '../audio/instruments.js';
import { Hud } from '../ui/hud.js';
import { say, directionWords, relAngle, vibrate } from '../ui/announce.js';
import { dialogue, clear } from '../ui/dom.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Round {
  constructor(def, data, state, settings) {
    this.def = def; this.data = data; this.state = state; this.settings = settings;
    this.cells = cellsFor(data, def, state);
    this.spots = pickSpots(this.cells, def.spots);
    this.wave = waveFor(data, def, state);
    this.layouts = this.cells.map(layoutDistrict);
    this.fixes = [];
    this.coins = def.coins;
    this.found = new Set();
    this.usedHint = false;
    this.usedHeatView = settings.heatView && !def.hidden;
    this.selected = 'tree';
    this.time = def.time;
    this.phase = 'intro';
    this.talked = false;
    this.lastDistrict = -1;
    this.foundTimes = [];
  }

  async load() { await loadCity(); }

  build(rt) {
    this.rt = rt;
    this.city = new City();
    this.city.build(rt, this.cells, { quality: this.settings.quality, reducedMotion: this.settings.reducedMotion });
    rt.player.pos.set(0, 0, HALF + 2.5);
    rt.player.facing = Math.PI;
    rt.follow.snapBehind(Math.PI);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: '#ffd34d', transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; this.ring.renderOrder = 3;
    rt.stage.scene.add(this.ring);
    // 2035 choices change how the city looks.
    if (this.state.energy === 'clean' && !this.def.real) this.addSolar();
    this.refresh();
  }

  addSolar() {
    const models = cityModels();
    if (!models) return;
    for (const d of this.city.districts) {
      const b = d.buildings[1];
      if (!b || d.i % 3) continue;
      const s = models.solar.scene.clone(true);
      s.scale.setScalar(1.6); s.position.set(b.x + 1, b.h, b.z + 1);
      this.city.group.add(s);
    }
  }

  // Recompute the forecast after any change; update overlay, music and look.
  refresh() {
    this.forecast = resolve(this.cells, this.spots, this.wave, this.fixes);
    const before = this.forecast.districts.map((d) => Math.max(0, d.excess));
    const hide = this.def.hidden ? this.spots.filter((s) => !this.found.has(s)) : [];
    this.city.setOverlay(before, this.settings.heatView && !this.def.hidden, hide);
    const unsafe = this.forecast.districts.filter((d) => !d.safe).length;
    const meanLst = this.cells.reduce((s, c) => s + (c.lst ?? 30), 0) / N;
    this.tension = 0.5 * (unsafe / N) + 0.5 * (MAP.heat01(meanLst) ?? 0.5); // hot share plus overall heat
    const ndvi = this.cells.reduce((s, c) => s + (c.ndvi ?? 0), 0) / N + this.fixes.filter((f) => f.type === 'tree').length * 0.006;
    const p = this.rainFor();
    this.cond?.set({ tension: this.tension, ndvi, rain: p, tempo: MAP.tempo(this.def.year) });
    const look = Math.min(1, Math.max(0, (this.cells.reduce((s, c) => s + (c.lst ?? 30), 0) / N - 28) / 7) * 0.6 + this.tension * 0.5);
    this.rt.stage.setHeatLook(this.state.energy === 'coal' && !this.def.real ? Math.min(1, look + 0.25) : look);
    for (const b of this.cond?.beacons || []) {
      const r = this.forecast.districts[b.district];
      b.strength = r.safe ? 0.35 : 1; // the heat call calms when that block is protected
    }
  }

  rainFor() {
    if (this.def.real) return this.data.power[this.def.year].aprRain;
    return this.data.power[2024].aprRain; // imagined years reuse the 2024 April rain
  }

  hud() {
    this.h.set({ year: this.def.year, imagined: !this.def.real, phase: this.phaseText(), time: this.time, coins: this.coins, found: this.found.size, spots: this.spots.length, relaxed: this.settings.relaxed });
  }

  phaseText() {
    if (this.phase === 'play') return this.found.size < this.spots.length ? 'Listen and find the heat' : 'Protect the city';
    if (this.phase === 'wave') return 'Heat wave!';
    return '';
  }

  // ---------- Main sequence ----------
  async play() {
    const rt = this.rt;
    this.h = new Hud();
    this.h.onPick = (k) => this.pick(k);
    this.h.onMenu = () => this.rt.input.fire('menu');
    this.h.onWave = () => this.finish();
    this.h.select(this.selected);
    this.hud();
    await audio.unlock();
    this.cond = new Conductor(audio);
    this.refresh();
    const greenest = this.cells.map((c, i) => [c.ndvi ?? 0, i]).sort((a, b) => b[0] - a[0])[0][1];
    const gc = districtCentre(greenest);
    if (this.settings.sound) {
      this.cond.start();
      this.cond.setFluteSource(gc.x, gc.z);
    }
    await this.intro();
    this.h.show(true);
    // Heat calls from each hot spot.
    if (this.settings.sound) {
      this.spots.forEach((s, k) => {
        const c = districtCentre(s);
        const b = this.cond.addBeacon({ x: c.x, z: c.z, lst: this.cells[s].lst, octave: k === 1 ? -1 : 0 });
        if (b) b.district = s;
      });
      this.refresh();
    }
    if (!this.def.hidden && this.settings.heatView) for (const s of this.spots) this.city.effects.shimmer(new THREE.Vector3(districtCentre(s).x, 0.5, districtCentre(s).z), 1);
    say(this.def.spots > 1 ? `Listen: ${this.def.spots} rising sitar lines. Each one comes from a hot spot.` : 'Listen: a rising sitar line. It comes from the hot spot.');
    const meanLst = this.cells.reduce((s, c) => s + (c.lst ?? 30), 0) / N;
    say(`Music for ${this.def.year}: ${describeMusic({ heatC: meanLst, tension: this.tension, rain: this.rainFor(), ndvi: this.cells.reduce((s, c) => s + (c.ndvi ?? 0), 0) / N, year: this.def.year })}`);
    this.where(true);
    this.phase = 'play';
    this.bindInput();
    rt.setPlayerActive(true);
    clear();
    this.startTime = performance.now();
    await new Promise((res) => { this.endPlay = res; });
    rt.setPlayerActive(false);
    this.phase = 'wave';
    this.hud();
    const result = await this.heatWave();
    this.h.show(false);
    this.h.district('');
    this.h.compass(0, false);
    return result;
  }

  async intro() {
    const d = this.def;
    const p = this.data.power[d.year];
    const lines = [];
    if (d.year === 2000) lines.push('This is Dhaka in April 2000. The streets are made up for the game, but the heat in each block comes from a real NASA satellite image of the same part of the city.');
    if (d.real) lines.push(`A heat wave is coming. In April ${d.year} NASA POWER recorded a hottest day of about ${p.aprT2MMax.toFixed(0)} °C in the air at Dhaka.`);
    else lines.push(`This is an imagined ${d.year}. It starts from the real 2024 NASA pattern and changes it with your choices. It is not a NASA forecast.`);
    if (d.spots > 1) lines.push(`I can hear ${d.spots} hot spots. Find them all.`);
    if (d.hidden) lines.push('This time the heat is hidden. No colours, no shimmer. You will have to find it by ear.');
    if (d.talk) lines.push('Someone at the tea stall in the middle of the city wants to talk to you. Press E next to them.');
    if (d.centre) lines.push('Coins are tight this year. A cooling centre protects people from the heat, but it does not cool the city.');
    lines.push(this.settings.relaxed ? 'Relaxed mode: take your time. Press F, or the Bring the wave button in the menu, when you are ready.' : `You have ${d.time} seconds and ${this.coins} coins. Press F to bring the wave early.`);
    for (const text of lines) await dialogue({ text, options: [{ label: 'Next', value: true }] });
  }

  bindInput() {
    const i = this.rt.input;
    i.on('pick', (n) => this.pick(['tree', 'roof', 'pond', 'centre'][n - 1]));
    i.on('act', () => this.act());
    i.on('scan', () => this.scan());
    i.on('where', () => { this.usedHint = true; this.where(false); });
    i.on('overlay', () => { this.settings.heatView = !this.settings.heatView; if (this.settings.heatView) this.usedHeatView = true; this.refresh(); say(`Heat view ${this.settings.heatView ? 'on' : 'off'}.`); });
    i.on('finish', () => this.finish());
  }

  finish() { if (this.phase === 'play') { this.phase = 'ending'; this.endPlay?.(); } }

  pick(key) {
    if (!FIXES[key]) return;
    this.selected = key;
    this.h.select(key);
    const f = FIXES[key];
    say(`${f.label} selected: ${f.what}. Costs ${f.cost}.`, { caption: false });
  }

  act() {
    if (this.phase !== 'play') return;
    const p = this.rt.player.pos;
    // Talk to the tea seller in 2020.
    if (this.def.talk && !this.talked && this.city.teaStall.position.distanceTo(p) < 4) { this.talk(); return; }
    const f = FIXES[this.selected];
    if (this.coins < f.cost) { say(`Not enough coins for a ${f.label.toLowerCase()}.`); return; }
    const di = districtAt(p.x, p.z);
    const target = this.city.preview(this.selected, p.x, p.z);
    if (di < 0 || !target || !plotFree(this.layouts, di, this.selected, this.fixes)) {
      say(this.selected === 'roof' ? 'Stand next to a building to paint its roof white.' : this.selected === 'tree' ? 'No free spot for a tree here. Try open ground in a block.' : 'Go to the middle of a block with an empty square to build this.');
      return;
    }
    const placed = this.city.place(this.selected, p.x, p.z);
    if (!placed) { say('That does not fit here.'); return; }
    this.fixes.push({ type: this.selected, district: placed.district });
    this.coins -= f.cost;
    this.rt.player.emote('Interact');
    this.state.planted ||= new Array(N).fill(0);
    if (this.selected === 'tree' || this.selected === 'pond') this.state.planted[placed.district] += this.selected === 'pond' ? 2 : 1;
    const d = this.city.districts[placed.district];
    const before = this.forecast.districts[placed.district];
    this.refresh();
    const after = this.forecast.districts[placed.district];
    this.chime(after.safe && !before.safe);
    const status = after.cooled ? 'This block is now safe from the wave' : after.sheltered ? 'People here can shelter, but the block is still hot' : `This block still needs about ${Math.max(0.1, after.excess - DANGER).toFixed(1)} more degrees of cooling`;
    say(`${f.label} placed in ${d.name}. ${status} (game estimate). ${this.coins} coin${this.coins === 1 ? '' : 's'} left.`);
    this.hud();
  }

  chime(good) {
    if (!audio.ready) return;
    const t = audio.now;
    (good ? [0, 4, 7, 12] : [0, 7]).forEach((s, k) => sitar(audio.ctx, audio.bus.fx, t + k * 0.09, { f: 293.66 * 2 ** (s / 12), gain: 0.28, bright: 0.4, dur: 0.9 }));
  }

  async talk() {
    this.talked = true;
    this.rt.setPlayerActive(false);
    const di = 12;
    const lst = this.cells[di].lst;
    const p = this.data.power;
    await dialogue({ who: 'Rina, tea seller', person: true, text: `Hello! Echo says the satellite measured the ground in this block at about ${lst.toFixed(1)} °C in mid-April 2020.` });
    await dialogue({ who: 'Rina, tea seller', person: true, text: `But the satellite measures the surface: roofs, roads, fields. NASA POWER says the April 2020 air in Dhaka averaged ${p[2020].aprT2M.toFixed(1)} °C, cooler than April 2010 (${p[2010].aprT2M.toFixed(1)} °C) or 2024 (${p[2024].aprT2M.toFixed(1)} °C).` });
    await dialogue({ who: 'Rina, tea seller', person: true, text: 'How hot I feel also depends on shade, wind, humidity and a cup of tea! So the ground can tell you where heat builds up, but not exactly how a person feels.' });
    await dialogue({ who: 'Echo', text: 'Thank you, Rina. Let us keep listening for the hidden heat.' });
    clear();
    this.rt.setPlayerActive(true);
    say('Talked to Rina. Back to finding the hidden heat.');
  }

  // Words for the nearest unfound hot spot.
  where(initial) {
    const p = this.rt.player.pos;
    const left = this.spots.filter((s) => !this.found.has(s));
    if (!left.length) { say('All hot spots found. Protect the blocks around them.'); return; }
    let best = null;
    for (const s of left) { const c = districtCentre(s); const d = Math.hypot(c.x - p.x, c.z - p.z); if (!best || d < best.d) best = { s, d, c }; }
    if (!this.settings.speakDirections && !initial) { say('Direction words are off in settings.'); return; }
    const rel = relAngle(this.rt.follow.yaw, best.c.x - p.x, best.c.z - p.z);
    say(`Echo: ${initial ? 'the heat is' : 'heat'} ${directionWords(rel, best.d)}.`);
  }

  scan() {
    if (this.phase !== 'play' || (this.lastScan && performance.now() - this.lastScan < 2500)) return;
    this.lastScan = performance.now();
    const p = this.rt.player.pos, yaw = this.rt.follow.yaw;
    this.rt.echo.scan(p);
    const samples = [];
    let hottest = null;
    for (let k = 0; k < 8; k++) {
      const rel = (k / 8) * Math.PI * 2; // clockwise from ahead
      const a = yaw + Math.PI - rel; // world angle in the camera's frame
      const dx = Math.sin(a), dz = Math.cos(a);
      const x = p.x + dx * 28, z = p.z + dz * 28;
      const di = districtAt(x, z);
      const ex = di < 0 ? null : Math.max(0, this.forecast.districts[di].excess);
      const hidden = this.def.hidden && di >= 0 && this.spots.includes(di) && !this.found.has(di);
      const heat01 = ex == null ? null : Math.min(1, ex / 2.6);
      samples.push({ angle: rel, heat01, x: p.x + dx * 8, z: p.z + dz * 8 });
      if (heat01 != null && (!hottest || heat01 > hottest.h)) hottest = { h: heat01, rel, hidden };
    }
    if (this.settings.sound) playScan(audio, samples, p);
    const words = hottest ? directionWords(hottest.rel, 30).split(',')[0] : 'nowhere nearby';
    say(`Scan: notes sweep around you, starting ahead and going right. The highest note is ${words}.`);
  }

  update(dt) {
    this.city?.update(dt);
    if (this.phase !== 'play') return;
    const rt = this.rt, p = rt.player.pos;
    if (this.cond) this.cond.player = { x: p.x, z: p.z };
    if (!this.settings.relaxed) {
      this.time -= dt;
      if (this.time <= 10 && !this.warned10) { this.warned10 = true; say('Ten seconds until the heat wave!', { urgent: true }); }
      if (this.time <= 0) this.finish();
    }
    // Found a hot spot?
    let nearest = null;
    for (const s of this.spots) {
      const c = districtCentre(s);
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (!this.found.has(s)) {
        if (!nearest || d < nearest.d) nearest = { d, c, s };
        if (d < 11) this.foundSpot(s);
      }
    }
    const prox = nearest ? Math.max(0, 1 - nearest.d / 80) : 0;
    rt.echo.setMood(prox);
    if (nearest && nearest.d < 22 && this.settings.vibration && (!this.lastBuzz || performance.now() - this.lastBuzz > 1400)) { vibrate(35); this.lastBuzz = performance.now(); }
    // Compass toward the nearest hidden heat (visual help only when the heat view is on).
    if (nearest) this.h.compass(relAngle(rt.follow.yaw, nearest.c.x - p.x, nearest.c.z - p.z), this.settings.heatView && !this.def.hidden);
    else this.h.compass(0, false);
    // District readout.
    const di = districtAt(p.x, p.z);
    if (di !== this.lastDistrict) {
      this.lastDistrict = di;
      if (di >= 0) {
        const c = this.cells[di], f = this.forecast.districts[di], d = this.city.districts[di];
        const src = this.def.real ? `NASA MODIS, April ${this.def.year}` : 'imagined from 2024';
        const showHeat = !(this.def.hidden && this.spots.includes(di) && !this.found.has(di));
        const status = !showHeat ? '' : f.safe ? ' · safe from the wave' : ` · needs cooling (about ${Math.max(0.1, f.excess - DANGER).toFixed(1)} °C, game estimate)`;
        const text = `${d.name}: ground ${c.lst?.toFixed(1) ?? 'no data'} °C, green ${c.ndvi?.toFixed(2) ?? 'no data'} (${src})${status}`;
        this.h.district(text);
        say(text, { caption: false });
      } else this.h.district('');
    }
    // Preview where the selected fix would go.
    const t = this.city.preview(this.selected, p.x, p.z);
    if (t && this.coins >= FIXES[this.selected].cost) {
      this.ring.visible = true;
      this.ring.position.set(t.x, (t.y ?? 0.2) + 0.05, t.z);
      this.ring.scale.setScalar(t.r);
      this.ring.material.opacity = 0.6 + Math.sin(performance.now() / 200) * 0.3;
    } else this.ring.visible = false;
    if (Math.floor(this.time) !== this.lastShown) { this.lastShown = Math.floor(this.time); this.hud(); }
  }

  foundSpot(s) {
    this.found.add(s);
    const secs = (performance.now() - this.startTime) / 1000;
    this.foundTimes.push(secs);
    const d = this.city.districts[s];
    const byEar = !this.usedHint && !(this.settings.heatView && !this.def.hidden);
    if (byEar) { this.coins += 2; this.byEar = true; }
    this.refresh();
    if (this.def.hidden || !this.settings.heatView) this.city.effects.shimmer(new THREE.Vector3(d.cx, 0.5, d.cz), 1);
    this.city.effects.sparkle(new THREE.Vector3(d.cx, 0, d.cz));
    this.rt.echo.scan(this.rt.player.pos, { color: '#ff9a3c', size: 20, dur: 1.2 });
    this.chime(true);
    say(`Found a hot spot: ${d.name}, ground ${this.cells[s].lst.toFixed(1)} °C.${byEar ? ' Found by ear: listener bonus, plus 2 coins!' : ''} ${this.found.size < this.spots.length ? 'Listen for the next one.' : 'Now protect it and the blocks around it.'}`, { urgent: true });
    this.hud();
  }

  async heatWave() {
    const rt = this.rt;
    this.ring.visible = false;
    say('The heat wave is here!', { urgent: true });
    // A warm front rolls out from each hot spot.
    const domes = this.spots.map((s) => {
      const c = districtCentre(s);
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff7a2f', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(c.x, 0, c.z); m.scale.setScalar(2);
      rt.stage.scene.add(m);
      gsap.to(m.scale, { x: 70, y: 18, z: 70, duration: this.settings.reducedMotion ? 0.3 : 3.2, ease: 'power2.out' });
      gsap.to(m.material, { opacity: 0, duration: 3.4, delay: 0.6 });
      return m;
    });
    if (!this.settings.reducedMotion) rt.follow.shake = 0.35;
    document.getElementById('vignette-heat').style.opacity = '1';
    rt.stage.setHeatLook(1);
    if (audio.ready) this.waveSound();
    this.cond?.set({ tension: 1, outOfTune: 0.6 });
    await wait(this.settings.reducedMotion ? 800 : 3200);
    const result = resolve(this.cells, this.spots, this.wave, this.fixes);
    this.city.showOutcome(result);
    document.getElementById('vignette-heat').style.opacity = '0';
    const lost = result.pct < 50;
    this.cond?.set({ tension: lost ? 0.8 : 0.1, outOfTune: lost ? 0.8 : 0, rain: lost ? 0 : 4 });
    this.cond?.clearBeacons();
    rt.stage.setHeatLook(lost ? 0.85 : 0.25);
    domes.forEach((m) => { rt.stage.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
    rt.player.emote(lost ? 'HitRecieve' : 'Wave');
    say(lost ? `The wave was too strong: only ${result.pct}% of Dhaka was protected. The music stays out of tune.` : `${result.pct}% of Dhaka protected! People come out and cheer. The music settles into the calm Bhupali scale.`, { urgent: true });
    // Look at the city from above for a moment.
    const cam = rt.stage.camera;
    if (!this.settings.reducedMotion) {
      rt.follow.pitch = 0.9; rt.follow.distance = 26;
      await wait(2600);
      rt.follow.pitch = 0.38; rt.follow.distance = 7.5;
    } else await wait(1200);
    void cam;
    this.cond?.stop();
    return { result, fixes: this.fixes, coinsLeft: this.coins, found: this.found.size, spots: this.spots, byEar: !!this.byEar, usedHint: this.usedHint, talked: this.talked, foundTimes: this.foundTimes };
  }

  waveSound() {
    const ctx = audio.ctx, t = audio.now;
    const n = ctx.createBufferSource();
    const len = ctx.sampleRate * 3;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.sin((Math.PI * k) / len);
    n.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(2400, t + 2.6);
    const g = ctx.createGain(); g.gain.value = 0.5;
    n.connect(f).connect(g).connect(audio.bus.fx);
    n.start(t);
    [0, 1, 6].forEach((s, k) => sitar(ctx, audio.bus.fx, t + 2.4 + k * 0.05, { f: 293.66 * 2 ** (s / 12), gain: 0.3, bright: 0.9, dur: 1.6 }));
    tabla(ctx, audio.bus.fx, t + 2.4, { stroke: 'dha', gain: 0.7 });
  }

  dispose() {
    this.cond?.stop();
    this.city?.dispose();
    if (this.ring) this.rt.stage.scene.remove(this.ring);
    const i = this.rt?.input;
    if (i) for (const a of ['pick', 'act', 'scan', 'where', 'overlay', 'finish']) i.on(a, null);
  }
}
