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
import { SoundWaves } from '../world/soundwaves.js';
import { pickTree } from '../ui/treePicker.js';
import { Target } from '../world/target.js';
import { learn, onFact, yearFact, FIX_FACT } from './learn.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Round {
  constructor(def, data, state, settings) {
    this.def = def; this.data = data; this.state = state; this.settings = settings;
    this.cells = cellsFor(data, def, state);
    this.spots = pickSpots(this.cells, def.spots);
    this.wave = waveFor(data, def, state);
    this.layouts = this.cells.map(layoutDistrict);
    this.fixes = [];
    this.coins = def.coins + (state.quizBonus || 0);
    this.quizBonus = state.quizBonus || 0;
    state.quizBonus = 0;
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
    // Colour each block by how much cooling it still needs: green = safe, amber = a little, red = a lot.
    const before = this.forecast.districts.map((d) => (d.safe ? 0.25 : 1.15 + Math.min(1.45, Math.max(0, d.excess - DANGER) / 1.6)));
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
    this.h.onPick = (k) => this.userPick(k);
    this.h.onMenu = () => this.rt.input.fire('menu');
    this.h.onWave = () => this.finish();
    this.h.onRestart = async () => {
      if (this.phase !== 'play') return;
      this.rt.setPlayerActive(false);
      const yes = await dialogue({ text: `Start ${this.def.year} again from the beginning? Your fixes this year will be removed.`, options: [{ label: 'Yes, restart', value: true }, { label: 'No, keep playing', value: false }] });
      if (yes) this.restart(); else this.rt.setPlayerActive(true);
    };
    this.h.onPlace = () => this.act();
    this.h.select(this.selected);
    this.hud();
    onFact((f) => this.h.tip(f));
    this.guideTarget = new Target(this.rt.stage.scene);
    await audio.unlock();
    this.cond = new Conductor(audio);
    // See the heat calls: rings and sparks from each hot spot (not in the hidden-heat year, and
    // only with the heat view on, so playing by ear stays a real challenge).
    this.waves = new SoundWaves(this.rt.stage.scene);
    this.waves.enabled = !this.settings.reducedMotion;
    this.cond.onBeaconNote = (b, f, p) => {
      if (!this.settings.heatView || (this.def.hidden && !this.found.has(b.district))) return;
      this.waves.spawn(b.x, b.z, f, p);
    };
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
    if (this.quizBonus) say(`Quiz bonus from last year: plus ${this.quizBonus} coin.`);
    this.phase = 'play';
    // A first lesson for this year, then how the sound works.
    setTimeout(() => { learn(yearFact(this.def.year), this.state) || learn('sonify', this.state) || (this.def.year !== 2000 && learn('rain', this.state)); }, 1500);
    this.bindInput();
    rt.setPlayerActive(true);
    clear();
    this.startTime = performance.now();
    await new Promise((res) => { this.endPlay = res; });
    rt.setPlayerActive(false);
    if (this.aborted) { // restart: no heat wave, straight back to the start of the year
      this.cond?.stop();
      this.h.show(false); this.h.compass(0, false); this.h.highlight(null);
      if (this.arrow) this.arrow.visible = false;
      onFact(null);
      return { aborted: true };
    }
    this.phase = 'wave';
    this.hud();
    const result = await this.heatWave();
    this.h.show(false);
    this.h.district('');
    this.h.compass(0, false);
    this.h.highlight(null);
    if (this.arrow) this.arrow.visible = false;
    this.city.showTreeSpots(null);
    onFact(null);
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
    i.on('pick', (n) => this.userPick(['tree', 'roof', 'pond', 'centre'][n - 1]));
    i.on('act', () => this.act());
    i.on('tap', (pt) => this.tap(pt));
    i.on('scan', () => this.scan());
    i.on('where', () => { this.usedHint = true; this.where(false); });
    i.on('overlay', () => { this.settings.heatView = !this.settings.heatView; if (this.settings.heatView) this.usedHeatView = true; this.refresh(); say(`Heat view ${this.settings.heatView ? 'on' : 'off'}.`); });
    i.on('finish', () => this.finish());
  }

  finish() { if (this.phase === 'play') { this.phase = 'ending'; this.endPlay?.(); } }

  // Start this year again from the beginning (no heat wave, no report).
  restart() { if (this.phase === 'play') { this.aborted = true; this.phase = 'ending'; this.endPlay?.(); } }

  // Choosing Tree opens the tree picker; the chosen tree is remembered for the next plantings.
  async userPick(key) {
    this.pick(key);
    if (key === 'tree') await this.chooseTree();
  }

  async chooseTree() {
    if (this.choosingTree) return null;
    this.choosingTree = true;
    const wasActive = this.phase === 'play';
    if (wasActive) this.rt.setPlayerActive(false);
    const t = await pickTree(this.tree?.key);
    if (wasActive && this.phase === 'play') this.rt.setPlayerActive(true);
    this.choosingTree = false;
    if (t) { this.tree = t; this.h.fixButtons.tree.querySelector('.fix-long').textContent = `1 ${t.name}`; say(`${t.name} chosen. Stand near open ground in a block and press E to plant it.`); }
    return t;
  }

  pick(key) {
    if (!FIXES[key]) return;
    this.selected = key;
    this.h.select(key);
    const f = FIXES[key];
    say(`${f.label} selected: ${f.what}. Costs ${f.cost}.`, { caption: false });
  }

  // E, the Place button and a click on the ground all place the chosen fix through here.
  act() { this.tryPlace(null); }

  tap(pt) {
    if (this.phase !== 'play') return;
    const g = this.rt.groundPoint(pt.x, pt.y);
    if (!g) return;
    const p = this.rt.player.pos;
    if (Math.hypot(g.x - p.x, g.z - p.z) > 30) { say('That is too far. Walk closer, then click again.'); return; }
    this.tryPlace({ x: g.x, z: g.z });
  }

  // Where the chosen fix would go now (aimed point = in front of the child, or a clicked point).
  aim(point) {
    const p = this.rt.player.pos;
    const a = point || { x: p.x, z: p.z };
    return a;
  }

  tryPlace(point) {
    if (this.phase !== 'play') return;
    const p = this.rt.player.pos;
    // Talk to the tea seller in 2020.
    if (!point && this.def.talk && !this.talked && this.city.teaStall.position.distanceTo(p) < 4) { this.talk(); return; }
    const f = FIXES[this.selected];
    if (this.coins < f.cost) { say(`Not enough coins for a ${f.label.toLowerCase()}. ${this.coins} left.`); return; }
    if (this.selected === 'tree' && !this.tree) { this.chooseTree().then((t) => { if (t) this.tryPlace(point); }); return; }
    const a = this.aim(point);
    const di = districtAt(a.x, a.z);
    const target = di < 0 ? null : this.city.preview(this.selected, a.x, a.z);
    if (di < 0 || !target || !plotFree(this.layouts, di, this.selected, this.fixes)) {
      const name = di >= 0 ? this.city.districts[di].name : 'here';
      const roomForTrees = di >= 0 && plotFree(this.layouts, di, 'tree', this.fixes) && this.city.districts[di].treePlots.some((q) => !q.used);
      if (this.selected === 'tree' && di >= 0 && !roomForTrees) {
        // No room for more trees in this block: switch to what the plan needs next.
        const sg = this.suggest();
        const alt = sg && sg.type && sg.type !== 'tree' ? sg.type : (plotFree(this.layouts, di, 'roof', this.fixes) && this.coins >= 2 ? 'roof' : plotFree(this.layouts, di, 'pond', this.fixes) && this.coins >= 3 ? 'pond' : null);
        if (alt) {
          this.pick(alt);
          say(`${name} has no room for more trees. I picked ${FIXES[alt].label} for you: follow the arrow, then press E.`, { urgent: true });
          return;
        }
      }
      say(this.selected === 'roof' ? `No roof to paint ${di >= 0 ? `in ${name}` : 'here'}. Stand next to a building.`
        : this.selected === 'tree' ? (di < 0 ? 'Walk into a city block first.' : this.city.districts[di].treePlots.some((q) => !q.used) && plotFree(this.layouts, di, 'tree', this.fixes) ? 'Trees go on the green circles. Follow the arrow to the next one, then press E.' : `${name} has no room for more trees. Try a white roof, or another block.`)
        : (di < 0 ? 'Walk into a city block first.' : `${name}'s middle square is already used. Try another block.`));
      return;
    }
    const placed = this.city.place(this.selected, a.x, a.z, this.selected === 'tree' ? this.tree.kind : null);
    if (!placed) { say('That does not fit here.'); return; }
    this.fixes.push({ type: this.selected, district: placed.district });
    this.coins -= f.cost;
    this.rt.player.emote('Interact');
    this.state.planted ||= new Array(N).fill(0);
    if (this.selected === 'tree' || this.selected === 'pond') this.state.planted[placed.district] += this.selected === 'pond' ? 2 : 1;
    const d = this.city.districts[placed.district];
    const before = this.forecast.districts[placed.district];
    this.refresh();
    this.lastDistrict = -1; // refresh the "you are here" line with the new numbers
    const after = this.forecast.districts[placed.district];
    this.chime(after.safe && !before.safe);
    if (after.safe && !before.safe) this.blockSafe(placed.district);
    learn(FIX_FACT[this.selected], this.state);
    const status = after.cooled ? 'This block is now safe from the wave' : after.sheltered ? 'People here can shelter, but the block is still hot' : `This block still needs about ${Math.max(0.1, after.excess - DANGER).toFixed(1)} more degrees of cooling`;
    const away = this.selected === 'tree' && placed.at && !placed.at.exact ? ` It went on the open ground ${directionWords(relAngle(this.rt.follow.yaw, placed.at.x - p.x, placed.at.z - p.z), Math.hypot(placed.at.x - p.x, placed.at.z - p.z))}.` : '';
    say(`${this.selected === 'tree' ? this.tree.name : f.label} placed in ${d.name}.${away} ${status} (game estimate). ${this.coins} coin${this.coins === 1 ? '' : 's'} left.`);
    this.hud();
  }

  // A block just became safe: make it obvious.
  blockSafe(i) {
    if (this.focus === i) this.focus = null;
    if (!this.settings.relaxed) { this.time += 15; this.hud(); } // reward: more time for the next block
    const d = this.city.districts[i];
    const safe = this.forecast.districts.filter((x) => x.safe).length;
    this.city.effects.sparkle(new THREE.Vector3(d.cx, 2, d.cz));
    this.city.flashSafe(i);
    this.h.celebrate(this.settings.relaxed ? `✔ ${d.name} is safe!` : `✔ ${d.name} is safe!  +15 s`);
    say(`${d.name} is now safe from the heat wave! ${safe} of ${N} blocks are safe. ${safe >= Math.ceil(N / 2) ? 'That is enough to win; more safe blocks earn more stars.' : `You need ${Math.ceil(N / 2) - safe} more to win.`}`, { urgent: true });
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
    learn('scan', this.state);
    const words = hottest ? directionWords(hottest.rel, 30).split(',')[0] : 'nowhere nearby';
    say(`Scan: notes sweep around you, starting ahead and going right. The highest note is ${words}.`);
  }

  update(dt) {
    this.city?.update(dt);
    if (this.city && this.rt) this.city.updateOcclusion(this.rt.stage.camera.position, this.rt.player.pos);
    this.waves?.update(dt);
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
    this.updateArrow(dt);
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
        if ((c.ndvi ?? 0) >= 0.55) learn('ndvi', this.state);
      } else this.h.district('');
    }
    // Preview where the selected fix would go.
    const aimAt = this.aim(null);
    const t = this.city.preview(this.selected, aimAt.x, aimAt.z);
    const canPlace = !!t && this.coins >= FIXES[this.selected].cost && plotFree(this.layouts, districtAt(aimAt.x, aimAt.z), this.selected, this.fixes);
    { const di2 = districtAt(p.x, p.z); const left = di2 < 0 ? null : Math.min(this.city.districts[di2].treePlots.filter((q) => !q.used).length, this.layouts[di2].freeTrees - this.fixes.filter((f) => f.district === di2 && f.type === 'tree').length); this.h.treeSpots(left); }
    this.h.placeState(canPlace, this.selected === 'tree' ? (this.tree ? `Plant ${this.tree.name}` : 'Choose a tree') : `Place ${FIXES[this.selected].label}`);
    if (t && canPlace) {
      this.ring.visible = true;
      this.ring.position.set(t.x, (t.y ?? 0.2) + 0.05, t.z);
      this.ring.scale.setScalar(t.r);
      this.ring.material.opacity = 0.6 + Math.sin(performance.now() / 200) * 0.3;
    } else this.ring.visible = false;
    if (Math.floor(this.time) !== this.lastShown) { this.lastShown = Math.floor(this.time); this.hud(); }
    this.guideTarget?.update(dt, this.settings.reducedMotion);
    this.updateBlockLabel();
    if (!this.lastGuide || performance.now() - this.lastGuide > 250) { this.lastGuide = performance.now(); this.guide(); }
  }

  // A label floating over the block you are told to cool: its name, a cooling bar, what is left.
  updateBlockLabel() {
    const L = this.labelFor;
    if (!L || !this.h) { this.h?.blockLabel(null); return; }
    const d = this.city.districts[L.i], r = this.forecast.districts[L.i];
    const v = new THREE.Vector3(L.at.x, L.at.y, L.at.z).project(this.rt.stage.camera);
    if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { this.h.blockLabel(null); return; }
    const el = this.rt.stage.renderer.domElement.getBoundingClientRect();
    const sx = el.left + (v.x + 1) / 2 * el.width, sy = el.top + (1 - v.y) / 2 * el.height;
    const card = this.h.mission.getBoundingClientRect();
    if (sy < 110 || (sx < card.right + 90 && sy < card.bottom + 40)) { this.h.blockLabel(null); return; } // keep clear of the HUD
    const done = r.need > 0 ? Math.max(0, Math.min(1, 1 - Math.max(0, r.excess - DANGER) / r.need)) : 1;
    this.h.blockLabel({ x: el.left + (v.x + 1) / 2 * el.width, y: el.top + (1 - v.y) / 2 * el.height, name: `${d.name} · ${Math.round(done * 100)}% cooled`, done, text: L.text });
  }

  // ---------- Guidance: the one next thing to do, and where ----------
  // A plan that can really make block i safe with the room it has and the coins you have:
  // a pond first if it needs a lot, then trees, then white roofs. Returns { items, reachable }.
  planFor(i) {
    const d = this.city.districts[i], r = this.forecast.districts[i];
    let need = Math.max(0, r.excess - DANGER), coins = this.coins;
    let trees = this.layouts[i].freeTrees - this.fixes.filter((f) => f.district === i && f.type === 'tree').length;
    let roofs = d.buildings.filter((b) => !b.white).length;
    let big = !d.big.used && this.rt.world.isFree(d.big.x, d.big.z, 2.6);
    const items = { pond: 0, tree: 0, roof: 0 };
    for (let guard = 0; guard < 20 && need > 1e-3; guard++) {
      if (big && coins >= 3 && need >= 1.6) { items.pond++; big = false; coins -= 3; need -= FIXES.pond.cool; }
      else if (trees > 0 && coins >= 1) { items.tree++; trees--; coins -= 1; need -= FIXES.tree.cool; }
      else if (big && coins >= 3) { items.pond++; big = false; coins -= 3; need -= FIXES.pond.cool; }
      else if (roofs > 0 && coins >= 2) { items.roof++; roofs--; coins -= 2; need -= FIXES.roof.cool; }
      else break;
    }
    return { items, reachable: need <= 1e-3, centre: !d.big.used && this.coins >= 4 };
  }

  planText(items) {
    const parts = [];
    if (items.pond) parts.push(`💧 ${items.pond} pond`);
    if (items.tree) parts.push(`🌳 ${items.tree} tree${items.tree > 1 ? 's' : ''}`);
    if (items.roof) parts.push(`🏠 ${items.roof} white roof${items.roof > 1 ? 's' : ''}`);
    return parts.join(' + ');
  }

  // Where to stand / aim for a fix type in block i.
  spotFor(type, i) {
    const p = this.rt.player.pos, d = this.city.districts[i];
    if (type === 'pond' || type === 'centre') return { x: d.big.x + 3, z: d.big.z, at: { x: d.big.x, z: d.big.z } };
    if (type === 'tree') {
      let q = null, bd = 1e9;
      for (const t of d.treePlots) { if (t.used) continue; const dd = Math.hypot(t.x - p.x, t.z - p.z); if (dd < bd) { bd = dd; q = t; } }
      return q ? { x: q.x, z: q.z, at: q } : null;
    }
    const b = d.buildings.find((q) => !q.white);
    if (!b) return null;
    const sx = Math.sign(p.x - b.x) || 1, sz = Math.sign(p.z - b.z) || 1, along = Math.abs(p.x - b.x) > Math.abs(p.z - b.z);
    return { x: along ? b.x + sx * 5 : b.x, z: along ? b.z : b.z + sz * 5, at: b };
  }

  suggest() {
    const p = this.rt.player.pos;
    const list = this.forecast.districts.map((r, i) => ({ r, i })).filter(({ r }) => !r.safe);
    if (!list.length) return { done: true };
    const dist = (i) => { const c = districtCentre(i); return Math.hypot(c.x - p.x, c.z - p.z); };
    list.sort((a, b) => (dist(a.i) - a.r.excess * 25) - (dist(b.i) - b.r.excess * 25));
    const tryBlock = (i) => {
      const plan = this.planFor(i);
      const order = Object.entries(plan.items).filter(([, n]) => n > 0).map(([k]) => k);
      if (!plan.reachable) return null; // cannot be made safe with what is left; try another block
      // Do the fix you already chose first, if it is part of the plan.
      const type = order.includes(this.selected) ? this.selected : order[0];
      const spot = this.spotFor(type, i);
      if (!spot) return null;
      const d = this.city.districts[i];
      return { district: i, d, need: Math.max(0.1, this.forecast.districts[i].excess - DANGER), type, plan, ...spot, left: list.length };
    };
    // Stay with the block you are working on until it is safe.
    if (this.focus != null && !this.forecast.districts[this.focus].safe) { const r = tryBlock(this.focus); if (r) return r; }
    for (const { i } of list) { const r = tryBlock(i); if (r) { this.focus = i; return r; } }
    // Nothing can be made fully safe: a cooling centre still protects the people of the hottest block.
    for (const { i } of list) {
      const d = this.city.districts[i];
      if (!d.big.used && this.coins >= 4 && !this.forecast.districts[i].sheltered) return { district: i, d, need: Math.max(0.1, this.forecast.districts[i].excess - DANGER), type: 'centre', plan: { items: {} }, centreOnly: true, ...this.spotFor('centre', i), left: list.length };
    }
    return { stuck: true, left: list.length };
  }

  guide() {
    if (this.phase !== 'play' || !this.h) return;
    this.labelFor = null;
    this.goal = null;
    const safeNow = this.forecast.districts.filter((x) => x.safe).length;
    this.h.setScore(safeNow, N);
    const p = this.rt.player.pos, yaw = this.rt.follow.yaw;
    const unfound = this.spots.filter((s) => !this.found.has(s));
    const elapsed = (performance.now() - this.startTime) / 1000;
    const words = (x, z) => directionWords(relAngle(yaw, x - p.x, z - p.z), Math.hypot(x - p.x, z - p.z));
    const showGuide = this.settings.guide !== false;
    const touch = this.rt.input.isTouch;
    const placeKey = touch ? 'Place' : 'E';
    this.city.showTreeSpots(null);
    // 1. Find the heat.
    if (unfound.length) {
      this.h.setSteps(this.def.year, { find: [`Find the heat (${this.found.size}/${this.spots.length})`, 'now'], protect: ['Protect the blocks around it', 'todo'], wave: ['Get ready for the heat wave', 'todo'] });
      let best = null;
      for (const s of unfound) { const c = districtCentre(s); const d = Math.hypot(c.x - p.x, c.z - p.z); if (!best || d < best.d) best = { c, d }; }
      this.h.highlight(null);
      if (this.def.hidden && !this.usedHint) {
        this.h.action('Find the hidden heat by ear: walk where the sitar gets louder.');
        this.h.next('This year there is no arrow or light. Press Q to scan, or R if you are lost.');
        this.h.where(''); this.guideTarget.hide();
        return;
      }
      const marked = showGuide && (elapsed > 20 || this.usedHint || this.def.hidden);
      this.h.action('Follow the arrow to the hot spot.');
      this.h.next(`Listen too: the rising sitar gets louder and faster as you get close${this.settings.heatView ? ', and orange rings rise from it' : ''}.`);
      this.h.where(`Hot spot: ${words(best.c.x, best.c.z)}`);
      this.goal = { x: best.c.x, z: best.c.z, r: 11 };
      if (marked) this.guideTarget.show(best.c.x, best.c.z, 2.2); else this.guideTarget.hide();
      return;
    }
    // 2. Make blocks safe.
    const sg = this.suggest();
    const waveLabel = this.settings.relaxed ? 'Bring the heat wave (F) when ready' : 'Survive the heat wave (or press F)';
    if (sg.done || sg.stuck) {
      this.h.setSteps(this.def.year, { find: ['Find the heat ✓', 'done'], protect: [sg.done ? 'All blocks are safe' : `Make blocks safe: ${sg.left} still too hot`, sg.done ? 'done' : 'now'], wave: [waveLabel, 'now'] });
      this.h.action(touch ? 'Tap Bring the wave when you are ready.' : 'Press F (or Bring the wave) when you are ready.', touch ? null : 'F');
      this.h.next(sg.done ? 'Every block is safe from the wave. Well done!' : this.coins < 1 ? 'You have used all your coins for this year.' : 'No room is left for the fixes you can afford.');
      this.h.where(''); this.h.highlight('wave'); this.guideTarget.hide();
      return;
    }
    this.h.setSteps(this.def.year, { find: ['Find the heat ✓', 'done'], protect: [`Make blocks safe: ${sg.left} still too hot`, 'now'], wave: [waveLabel, 'todo'] });
    const names = { tree: 'Tree', roof: 'White roof', pond: 'Pond', centre: 'Cooling centre' };
    const verbs = { tree: `plant the ${this.tree ? this.tree.name.toLowerCase() : 'tree'}`, roof: 'paint the roof white', pond: 'dig the pond', centre: 'build the cooling centre' };
    const key = { tree: 1, roof: 2, pond: 3, centre: 4 }[sg.type];
    const dist = Math.hypot(sg.x - p.x, sg.z - p.z);
    const here = sg.type === 'tree' ? Math.hypot(sg.at.x - p.x, sg.at.z - p.z) < 3.6 : dist < 3.6;
    const selected = this.selected === sg.type;
    const planTxt = sg.centreOnly ? '' : this.planText(sg.plan.items);
    const spotWord = sg.type === 'tree' ? 'the green circle' : 'the yellow light';
    if (this.lastFocus !== sg.district) { // a new block to work on
      if (this.lastFocus != null) this.newBlockUntil = performance.now() + 7000;
      this.lastFocus = sg.district;
      this.doneHere = 0;
    }
    const newBlock = performance.now() < (this.newBlockUntil || 0);
    const doneHere = this.fixes.filter((f) => f.district === sg.district).length;
    const leftHere = Object.values(sg.plan.items || {}).reduce((a, b) => a + b, 0);
    const stepWord = leftHere > 0 ? ` (${doneHere + 1} of ${doneHere + leftHere} here)` : '';
    // The one thing to do now.
    const treeRoom = plotFree(this.layouts, sg.district, 'tree', this.fixes) && sg.d.treePlots.some((q) => !q.used);
    const treeBlocked = this.selected === 'tree' && sg.type !== 'tree' && !treeRoom;
    if (treeBlocked) { this.h.action(touch ? `No more room for trees here. Tap ${names[sg.type]}.` : `No more room for trees here. Press ${key} for ${names[sg.type]}.`, touch ? null : String(key)); this.h.highlight(sg.type); }
    else if (!here) { this.h.action(newBlock ? `Next block: ${sg.d.name}. Follow the arrow to ${spotWord}.` : `Follow the arrow to ${spotWord}${stepWord}.`); this.h.highlight(selected ? null : sg.type); }
    else if (!selected) { this.h.action(touch ? `Tap ${names[sg.type]} below.` : `Press ${key} to choose ${names[sg.type]}.`, touch ? null : String(key)); this.h.highlight(sg.type); }
    else { this.h.action(`Press ${placeKey} to ${verbs[sg.type]}${stepWord}.`, touch ? null : 'E'); this.h.highlight('place'); }
    this.h.next(sg.centreOnly
      ? `${sg.d.name} cannot be cooled enough with what is left, but a cooling centre keeps its people safe.`
      : `${sg.d.name} is ${sg.need.toFixed(1)} °C too hot. Still to do here: ${planTxt} (game estimate).`);
    this.h.where(here ? `✔ You are at ${spotWord}.` : `${spotWord[0].toUpperCase()}${spotWord.slice(1)}: ${words(sg.at.x, sg.at.z)}`);
    if (sg.type === 'tree') this.city.showTreeSpots(sg.district);
    this.goal = { x: sg.at.x, z: sg.at.z, r: sg.type === 'tree' ? 3.6 : sg.type === 'roof' ? 6.5 : 6 };
    this.labelFor = here ? null : { i: sg.district, text: sg.centreOnly ? '⛺ cooling centre' : planTxt || 'almost safe', at: { x: sg.at.x, z: sg.at.z, y: sg.type === 'roof' ? (sg.at.h || 0) + 3 : 4.2 } };
    if (showGuide) this.guideTarget.show(sg.at.x, sg.at.z, sg.type === 'roof' ? 0.9 : sg.type === 'tree' ? 0.6 : 1.4); else this.guideTarget.hide();
    this.guideTarget.setNear(here);
    this.guideTarget.group.position.y = sg.type === 'roof' && showGuide ? sg.at.h || 0 : 0;
  }

  // The arrow at the child's feet and at the top of the screen: always points to the goal,
  // shows the distance, and turns red with "Wrong way" when you walk away from it.
  updateArrow(dt) {
    const g = this.goal, p = this.rt.player.pos;
    if (!this.arrow) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 1.3); shape.lineTo(0.75, 0.2); shape.lineTo(0.28, 0.2); shape.lineTo(0.28, -0.9); shape.lineTo(-0.28, -0.9); shape.lineTo(-0.28, 0.2); shape.lineTo(-0.75, 0.2); shape.closePath();
      this.arrowMat = new THREE.MeshBasicMaterial({ color: '#ffe14d', transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
      this.arrow = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.arrowMat);
      this.arrow.renderOrder = 6;
      this.rt.stage.scene.add(this.arrow);
    }
    if (!g || this.settings.guide === false) { this.arrow.visible = false; this.h.compass(0, false); return; }
    const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz);
    const arrived = d < g.r;
    // Wrong-way check: 4 m farther than your closest point for more than half a second.
    // It stays on until you have turned back and come 2.5 m closer again.
    const key = `${Math.round(g.x)}|${Math.round(g.z)}`;
    if (this.goalKey !== key) { this.goalKey = key; this.bestD = d; this.wrongSince = 0; this.wrongOn = false; }
    if (!this.wrongOn) {
      this.bestD = Math.min(this.bestD, d);
      if (!arrived && d > this.bestD + 4) {
        this.wrongSince += dt;
        if (this.wrongSince > 0.6) { this.wrongOn = true; this.wrongD = d; say('Wrong way! Turn around and follow the arrow.'); vibrate([60, 60, 60]); }
      } else this.wrongSince = 0;
    } else {
      this.wrongD = Math.max(this.wrongD, d);
      if (arrived || d < this.wrongD - 2.5) { this.wrongOn = false; this.bestD = d; this.wrongSince = 0; }
    }
    const showWrong = this.wrongOn;
    // Ground arrow just in front of the child, pointing at the goal.
    const ang = Math.atan2(dx, dz);
    this.arrow.visible = !arrived;
    this.arrow.position.set(p.x + Math.sin(ang) * 1.9, p.y + 0.25, p.z + Math.cos(ang) * 1.9);
    this.arrow.rotation.set(-Math.PI / 2, 0, 0); // lie flat, then turn toward the goal
    this.arrow.rotateZ(ang + Math.PI);
    this.arrowMat.color.set(showWrong ? '#ff5a3c' : '#ffe14d');
    this.arrow.scale.setScalar(this.settings.reducedMotion ? 1 : 1 + Math.sin(performance.now() / 180) * 0.08);
    // Screen arrow.
    const rel = relAngle(this.rt.follow.yaw, dx, dz);
    this.h.compass(rel, true, arrived ? '✔ here' : showWrong ? '↩ Wrong way' : `${Math.round(d)} m`, arrived ? 'ok' : showWrong ? 'wrong' : '');
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
    learn('heatIsland', this.state) || learn('lst', this.state);
    say(`Found a hot spot: ${d.name}, ground ${this.cells[s].lst.toFixed(1)} °C.${byEar ? ' Found by ear: listener bonus, plus 2 coins!' : ''} ${this.found.size < this.spots.length ? 'Listen for the next one.' : 'Now protect it and the blocks around it.'}`, { urgent: true });
    this.hud();
  }

  async heatWave() {
    const rt = this.rt;
    this.ring.visible = false;
    say('The heat wave is here!', { urgent: true });
    this.guideTarget?.hide();
    learn('wave', this.state);
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
    this.guideTarget?.dispose();
    if (this.arrow) this.rt.stage.scene.remove(this.arrow);
    this.cond?.stop();
    this.waves?.clear();
    this.city?.dispose();
    if (this.ring) this.rt.stage.scene.remove(this.ring);
    const i = this.rt?.input;
    if (i) for (const a of ['pick', 'act', 'tap', 'scan', 'where', 'overlay', 'finish']) i.on(a, null);
  }
}
