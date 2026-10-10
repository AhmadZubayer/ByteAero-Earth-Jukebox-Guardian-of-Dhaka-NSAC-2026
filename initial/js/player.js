/* Earth Jukebox — transport, audio sync, deterministic rendering and preview controls.
 *
 * Timebase: by default the preview plays the sample-locked reference mix as ONE media element,
 * and its currentTime IS the clock (no inter-stem drift possible). As soon as a stem control is
 * touched, playback switches to the four separate stems: the music stem is the clock and the
 * others follow it with small playback-rate nudges. When paused, silent,
 * or capturing, the clock is the explicitly requested time, snapped to 30 fps frames.
 * Rendering: every CSS animation on the stage is paused and given currentTime = t,
 * so any frame can be reproduced exactly, forwards or backwards.
 */
(function () {
  var TL = window.EJ_TIMELINE, C = window.EJ_CONTENT, FPS = TL.fps;
  var qs = new URLSearchParams(location.search);
  var body = document.body, stage = document.getElementById("stage"), viewport = document.getElementById("viewport");
  var $ = function (s) { return document.querySelector(s); };

  var state = {
    t: 0, playing: false, cut: qs.get("cut") === "judging" ? "judging" : "master",
    loop: false, capture: qs.get("capture") === "1", dirty: true, audioOK: false,
    vol: { music: 1, sono: 1, sfx: 1, vo: 1 }, forceStems: false, mute: { music: false, sono: false, sfx: false, vo: false }, master: false
  };
  var cut = function () { return TL.cuts[state.cut]; };
  var frames = function () { return Math.round(cut().duration * FPS); };
  var lastT = function () { return (frames() - 1) / FPS; };
  var sceneList = function () { return TL.scenes.filter(function (s) { return state.cut === "master" || !s.masterOnly; }); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var snap = function (t) { return Math.round(t * FPS) / FPS; };

  /* ---------------- stage fit ---------------- */
  function fit() {
    var w = viewport.clientWidth, hgt = viewport.clientHeight, s = Math.min(w / 1920, hgt / 1080);
    stage.style.transform = "translate(" + ((w - 1920 * s) / 2) + "px," + ((hgt - 1080 * s) / 2) + "px) scale(" + s + ")";
  }

  /* ---------------- per-scene animation bookkeeping ---------------- */
  var sceneEls = {}; TL.scenes.forEach(function (s) { sceneEls[s.id] = document.getElementById(s.id); });
  var active = null, anims = [], globalAnims = [], tracks = [], steps = [], counts = [], happy = [];

  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function parseTrack(el) {
    var keys = el.getAttribute("data-v").split(",").map(function (p) { var a = p.split(":"); return [+a[0], +a[1]]; });
    return { el: el, keys: keys, name: el.getAttribute("data-var") || "--v", lin: el.hasAttribute("data-lin"), last: null };
  }
  function evalTrack(k, t, lin) {
    if (t <= k[0][0]) return k[0][1];
    for (var i = 1; i < k.length; i++) if (t < k[i][0]) {
      var a = k[i - 1], b = k[i], u = (t - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * (lin ? u : smooth(u));
    }
    return k[k.length - 1][1];
  }
  function parseSteps(el) {
    var keys = el.getAttribute("data-steps").split("|").map(function (p) { var i = p.indexOf(":"); return [+p.slice(0, i), p.slice(i + 1)]; });
    return { el: el, keys: keys, last: null };
  }
  function parseCount(el) {   // "t0,t1,v0,v1,decimals,suffix[,ceil]" ceil = linear countdown, rounded up
    var a = el.getAttribute("data-count").split(",");
    return { el: el, t0: +a[0], t1: +a[1], v0: +a[2], v1: +a[3], dec: +(a[4] || 0), suf: a[5] || "", ceil: a[6] === "ceil", last: null };
  }
  function parseHappy(el) {
    return { el: el, r: el.getAttribute("data-happy").split(",").map(function (p) { var a = p.split("-"); return [+a[0], +a[1]]; }) };
  }
  function collect() {
    if (!active) return;
    var el = sceneEls[active.id];
    anims = el.getAnimations({ subtree: true });
    anims.forEach(function (a) { a.pause(); });
    tracks = Array.prototype.map.call(el.querySelectorAll("[data-v]"), parseTrack);
    steps = Array.prototype.map.call(el.querySelectorAll("[data-steps]"), parseSteps);
    counts = Array.prototype.map.call(el.querySelectorAll("[data-count]"), parseCount);
    happy = Array.prototype.map.call(el.querySelectorAll("[data-happy]"), parseHappy);
  }
  function collectGlobal() {
    globalAnims = [];
    document.querySelectorAll(".global").forEach(function (g) { globalAnims = globalAnims.concat(g.getAnimations({ subtree: true })); });
    globalAnims.forEach(function (a) { a.pause(); });
  }
  function sceneAt(t) {
    var l = sceneList();
    for (var i = 0; i < l.length; i++) if (t >= l[i].start && t < l[i].end) return l[i];
    return l[l.length - 1];
  }
  function activate(s) {
    if (active === s) return;
    if (active) sceneEls[active.id].classList.remove("on");
    active = s; sceneEls[s.id].classList.add("on");
    collect();
  }

  /* ---------------- live CSS variables: beat, talk ---------------- */
  var echoCues = C.captions.filter(function (c) { return c.who === "Echo"; });
  function beatVars(t) {
    var quiet = TL.teach.some(function (w) { return t >= w.from && t < w.to && w.mode === "quiet"; });
    var energy = t < 2.5 ? 0.2 : quiet ? 0.35 : t > 232.5 ? Math.max(0.1, 1 - (t - 232.5) / 1.5) : 1;   // pulse settles after the final cadence
    var bf = (t % TL.beat) / TL.beat, barf = (t % TL.bar) / TL.bar;
    stage.style.setProperty("--beat", (Math.exp(-bf * 5) * energy).toFixed(3));
    stage.style.setProperty("--bar", (Math.exp(-barf * 6) * energy).toFixed(3));
    var talk = 0;
    for (var i = 0; i < echoCues.length; i++) {
      var c = echoCues[i];
      if (t >= c.start && t < c.end) {
        var edge = Math.min(1, (t - c.start) * 8, (c.end - t) * 8);
        talk = edge * Math.abs(Math.sin(t * 17.3) * 0.6 + Math.sin(t * 7.1) * 0.4);
        break;
      }
    }
    stage.style.setProperty("--talk", talk.toFixed(3));
  }

  /* ---------------- ring wipe ---------------- */
  var wipe = $("#wipe"), R = 1130, CLOSE = 0.5, OPEN = 0.6;
  function ease(x) { x = clamp(x, 0, 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function wipeAt(t) {
    for (var i = 0; i < TL.wipes.length; i++) {
      var w = TL.wipes[i];
      if (t >= w - CLOSE && t < w + OPEN) {
        wipe.classList.add("on");
        if (t < w) {
          var p = ease((t - (w - CLOSE)) / CLOSE);
          wipe.style.setProperty("--wr", (p * R) + "px"); wipe.style.setProperty("--wh", "0px");
          wipe.style.setProperty("--we", p < 1 ? 1 : 0); wipe.style.setProperty("--wo", 0);
        } else {
          var q = ease((t - w) / OPEN);
          wipe.style.setProperty("--wr", R + "px"); wipe.style.setProperty("--wh", (q * R) + "px");
          wipe.style.setProperty("--we", 0); wipe.style.setProperty("--wo", 1 - q * 0.6);
        }
        return;
      }
    }
    wipe.classList.remove("on");
  }

  /* ---------------- captions ---------------- */
  var capEl = $("#captions"), capWho = capEl.querySelector(".who"), capTxt = capEl.querySelector(".txt"), capId = null;
  function captionsAt(t) {
    var cue = null;
    for (var i = 0; i < C.captions.length; i++) { var c = C.captions[i]; if (t >= c.start && t < c.end) { cue = c; break; } }
    var id = cue ? cue.id : null;
    if (id === capId) return;
    capId = id;
    if (!cue) { capEl.classList.remove("on"); return; }
    capWho.textContent = cue.who.toUpperCase();
    capWho.className = "who who-" + cue.who.toLowerCase();
    capTxt.textContent = cue.text;
    capEl.classList.add("on");
  }

  /* ---------------- render ---------------- */
  function render(t) {
    activate(sceneAt(t));
    var ms = t * 1000, i;
    for (i = 0; i < anims.length; i++) anims[i].currentTime = ms;
    for (i = 0; i < globalAnims.length; i++) globalAnims[i].currentTime = ms;
    for (i = 0; i < tracks.length; i++) {
      var tr = tracks[i], v = evalTrack(tr.keys, t, tr.lin).toFixed(4);
      if (v !== tr.last) { tr.el.style.setProperty(tr.name, v); tr.last = v; }
    }
    for (i = 0; i < steps.length; i++) {
      var st = steps[i], txt = st.keys[0][1];
      for (var j = 0; j < st.keys.length; j++) if (t >= st.keys[j][0]) txt = st.keys[j][1];
      if (txt !== st.last) { st.el.textContent = txt; st.last = txt; }
    }
    for (i = 0; i < counts.length; i++) {
      var c = counts[i], u = clamp((t - c.t0) / (c.t1 - c.t0), 0, 1);
      var val = c.v0 + (c.v1 - c.v0) * (c.ceil ? u : smooth(u));
      var s = (c.ceil ? String(Math.ceil(val - 1e-6)).padStart(2, "0") : val.toFixed(c.dec)) + c.suf;
      if (s !== c.last) { c.el.textContent = s; c.last = s; }
    }
    for (i = 0; i < happy.length; i++) {
      var hv = 0;
      happy[i].r.forEach(function (r) { hv = Math.max(hv, Math.min(1, (t - r[0]) * 6, (r[1] - t) * 6)); });
      happy[i].el.style.setProperty("--happy", clamp(hv, 0, 1).toFixed(3));
    }
    beatVars(t); wipeAt(t); captionsAt(t);
    ui(t);
  }

  /* ---------------- audio ---------------- */
  var stems = {}, stemOK = {}, stemNames = ["mix", "music", "sono", "sfx", "vo"], STEMS = ["music", "sono", "sfx", "vo"];
  function srcFor(k) { return k === "music" ? cut().music : k === "mix" ? cut().mix : TL.stems[k]; }
  function mixMode() {                       // reference mix unless a stem control has been touched
    return stemOK.mix === true && !state.forceStems && STEMS.every(function (k) { return !state.mute[k] && state.vol[k] === 1; });
  }
  function clockKey() { return usingMix ? "mix" : "music"; }
  function makeAudio(k) {
    var a = new Audio(); a.preload = "auto"; a.src = srcFor(k); stems[k] = a; stemOK[k] = null;
    a.addEventListener("canplaythrough", function () { if (stemOK[k] !== true) { stemOK[k] = true; loaderItem(k, true); updateStatus(); } });
    a.addEventListener("error", function () { stemOK[k] = false; loaderItem(k, false); updateStatus(); });
    a.addEventListener("ended", function () { if (k === clockKey() && state.playing) onEnd(); });
    applyVol(k);
  }
  function applyVol(k) { if (stems[k]) stems[k].volume = (state.master || state.mute[k]) ? 0 : (k === "mix" ? 1 : state.vol[k]); }
  function audioReady() { return stemOK.music === true || stemOK.mix === true; }
  function seatAudio(t) {
    stemNames.forEach(function (k) { var a = stems[k]; if (a && stemOK[k]) { try { a.currentTime = t; } catch (e) { } } });
  }
  function pauseAudio() { stemNames.forEach(function (k) { if (stems[k]) { stems[k].pause(); stems[k].playbackRate = 1; } }); }

  var wall0 = 0, t0 = 0, lastMt = -1, lastMtAt = 0, lastDrift = 0, usingAudio = false, usingMix = false;
  function play() {
    if (state.playing) return;
    if (state.t >= lastT() - 1e-6) state.t = loopRange() ? loopRange()[0] : 0;
    state.playing = true; t0 = state.t; wall0 = performance.now(); lastMt = -1;
    usingAudio = audioReady() && !state.capture;
    if (usingAudio) {
      usingMix = mixMode() || stemOK.music !== true;
      seatAudio(state.t);
      var set = usingMix ? ["mix"] : STEMS.filter(function (k) { return stemOK[k]; });
      var ps = set.map(function (k) { return stems[k].play(); });
      Promise.all(ps).then(function () {                   // all started: line followers up with the music clock
        if (!usingMix) ["sono", "sfx", "vo"].forEach(function (k) { if (stemOK[k]) stems[k].currentTime = stems.music.currentTime; });
        updateStatus();
      }).catch(function (err) {
        usingAudio = false; pauseAudio(); t0 = state.t; wall0 = performance.now();
        setStatus("Audio playback was blocked (" + err.name + "). Click Play again, or continue in silent preview.", "err");
      });
    }
    updateButtons();
  }
  function pause() {
    if (!state.playing) return;
    state.playing = false; pauseAudio();
    state.t = snap(state.t); state.dirty = true; updateButtons();
  }
  function seek(t, keepPlaying) {
    t = clamp(t, 0, lastT());
    if (!state.playing) t = snap(t);
    state.t = t; state.dirty = true;
    if (state.playing) { t0 = t; wall0 = performance.now(); lastMt = -1; if (usingAudio) seatAudio(t); }
    else seatAudio(t);
    if (!state.playing || keepPlaying) render(t);
  }
  function onEnd() {
    var lr = loopRange();
    if (lr) { seek(lr[0], true); return; }
    state.t = lastT(); pause(); render(state.t);
  }
  function loopRange() {
    if (!state.loop) return null;
    var s = sceneAt(state.t); return [s.start, Math.min(s.end, cut().duration)];
  }

  function tick(now) {
    if (state.playing) {
      var t;
      var clk = stems[clockKey()];
      if (usingAudio && clk && !clk.paused) {
        var mt = clk.currentTime;
        if (mt !== lastMt) { lastMt = mt; lastMtAt = now; }
        t = mt + Math.min(0.08, (now - lastMtAt) / 1000);
      } else t = t0 + (now - wall0) / 1000;
      var lr = loopRange(), end = lr ? lr[1] : cut().duration;
      if (lr && t < lr[0] - 0.5) end = cut().duration;
      if (t >= end) { if (lr) { seek(lr[0], true); t = lr[0]; } else { onEnd(); return requestAnimationFrame(tick); } }
      state.t = t;
      if (usingAudio && !usingMix && now - lastDrift > 100) {   // stems mode: keep followers on the music clock
        lastDrift = now;
        var mc = stems.music.currentTime;
        ["sono", "sfx", "vo"].forEach(function (k) {
          var a = stems[k]; if (!a || !stemOK[k] || a.paused) return;
          var d = a.currentTime - mc;
          if (Math.abs(d) > 0.12) { a.currentTime = mc; a.playbackRate = 1; }          // large jump: re-seat
          else if (Math.abs(d) > 0.008) a.playbackRate = 1 - clamp(d * 3, -0.06, 0.06);   // small drift: nudge
          else if (a.playbackRate !== 1) a.playbackRate = 1;
        });
      }
      render(t);
    } else if (state.dirty) { state.dirty = false; render(state.t); }
    requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); });

  function setCut(c) {
    if (c === state.cut) return;
    var was = state.playing; pause();
    state.cut = c; body.setAttribute("data-cut", c);
    ["music", "mix"].forEach(function (k) { if (stems[k]) { stems[k].pause(); stemOK[k] = null; stems[k].src = srcFor(k); loaderItem(k, null); } });
    buildScrub(); buildSceneButtons(); seek(Math.min(state.t, lastT()));
    updateStatus(); if (was) setTimeout(play, 200);
  }

  /* ---------------- dock UI ---------------- */
  function tc(t) {
    var f = Math.round(t * FPS), s = Math.floor(f / FPS), ff = f % FPS;
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(Math.floor(s / 60)) + ":" + p(s % 60) + ":" + p(ff);
  }
  var tcEl = $("#tc"), scnEl = $("#scn"), headEl = $("#head"), progEl = $("#prog"), scrubEl = $("#scrub");
  var lastUI = -1;
  function ui(t) {
    var f = Math.round(t * FPS);
    if (f === lastUI) return; lastUI = f;
    tcEl.innerHTML = tc(t) + " <small>f" + String(f).padStart(4, "0") + " / " + (frames() - 1) + "</small>";
    var s = sceneAt(t);
    scnEl.textContent = s.id + " · " + s.title + "  (" + s.start + "–" + Math.min(s.end, cut().duration) + " s)";
    var x = (t / 240 * 100) + "%"; headEl.style.left = x; progEl.style.width = x;
    document.querySelectorAll(".scenes-row button[data-s]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-s") === s.id); });
  }
  function buildScrub() {
    var html = "";
    sceneList().forEach(function (s) {
      var e = Math.min(s.end, cut().duration);
      html += '<div class="seg" style="left:' + (s.start / 240 * 100) + '%;width:' + ((e - s.start) / 240 * 100) + '%">' + s.id + '</div>';
    });
    for (var b = 0; b <= 96; b++) html += '<div class="mk" style="left:' + (b * TL.bar / 240 * 100) + '%"></div>';
    TL.accents.forEach(function (a) { html += '<div class="mk acc" title="' + a[1] + ' @ ' + a[0] + 's" style="left:' + (a[0] / 240 * 100) + '%"></div>'; });
    if (cut().duration < 240) html += '<div class="cutend" style="width:' + ((240 - cut().duration) / 240 * 100) + '%"></div>';
    html += '<div class="prog" id="prog"></div><div class="head" id="head"></div>';
    scrubEl.innerHTML = html; headEl = $("#head"); progEl = $("#prog"); lastUI = -1;
  }
  function buildSceneButtons() {
    var row = $("#scenes"); row.innerHTML = "";
    sceneList().forEach(function (s) {
      var b = document.createElement("button"); b.setAttribute("data-s", s.id);
      b.innerHTML = s.id + " <small>" + s.title + "</small>";
      b.title = s.start + "–" + s.end + " s";
      b.onclick = function () { seek(s.start, true); };
      row.appendChild(b);
    });
  }
  function updateButtons() {
    $("#play").textContent = state.playing ? "Pause ▮▮".replace("▮▮", "||") : (audioReady() ? "Play with sound" : "Play (silent)");
    $("#loop").classList.toggle("on", state.loop);
    $("#cc").classList.toggle("on", !body.classList.contains("no-captions"));
    $("#rm").classList.toggle("on", body.classList.contains("reduced"));
    $("#mute").classList.toggle("on", state.master);
  }
  function setStatus(msg, cls) { var s = $("#status"); s.textContent = msg; s.className = "status " + (cls || ""); }
  function updateStatus() {
    var miss = stemNames.filter(function (k) { return stemOK[k] === false; });
    document.querySelectorAll(".stem[data-k]").forEach(function (e) { e.classList.toggle("missing", stemOK[e.getAttribute("data-k")] === false); });
    if (stemOK.music === false) setStatus("Music stem failed to load (" + srcFor("music") + "). Silent preview clock in use — rebuild audio with tools/build-audio.cmd.", "err");
    else if (miss.length) setStatus("Missing audio stem(s): " + miss.join(", ") + ". Playback continues without them.", "warn");
    else setStatus("Cut: " + cut().label + " · audio: " + (mixMode() ? "reference mix (sample-locked; touch a stem control for separate stems)" : "separate stems") + " · VO is a TEMPORARY text-to-speech timing guide — final voiceover not recorded yet.", "warn");
    updateButtons();
  }

  function modeCheck() {                      // switch mix <-> stems without losing the position
    if (state.playing && usingAudio && mixMode() !== usingMix) { pause(); play(); }
    updateStatus();
  }

  function bindDock() {
    $("#play").onclick = function () { state.playing ? pause() : play(); };
    $("#restart").onclick = function () { seek(loopRange() ? loopRange()[0] : 0, true); };
    $("#fb").onclick = function () { pause(); seek(state.t - 1 / FPS); };
    $("#ff").onclick = function () { pause(); seek(state.t + 1 / FPS); };
    $("#sb").onclick = function () { seek(state.t - 1, true); };
    $("#sf").onclick = function () { seek(state.t + 1, true); };
    $("#prev").onclick = function () { var l = sceneList(), s = sceneAt(state.t), i = l.indexOf(s); seek(state.t - s.start > 0.5 ? s.start : l[Math.max(0, i - 1)].start, true); };
    $("#next").onclick = function () { var l = sceneList(), i = l.indexOf(sceneAt(state.t)); if (i < l.length - 1) seek(l[i + 1].start, true); };
    $("#loop").onclick = function () { state.loop = !state.loop; updateButtons(); };
    $("#cc").onclick = function () { body.classList.toggle("no-captions"); updateButtons(); };
    $("#clean").onclick = function () { body.classList.add("clean"); setTimeout(fit, 0); };
    $("#rm").onclick = function () { body.classList.toggle("reduced"); collect(); collectGlobal(); state.dirty = true; updateButtons(); };
    $("#mute").onclick = function () { state.master = !state.master; stemNames.forEach(applyVol); updateButtons(); };
    $("#cut").value = state.cut; $("#cut").onchange = function () { setCut(this.value); };
    $("#bg").value = body.getAttribute("data-bg"); $("#bg").onchange = function () { body.setAttribute("data-bg", this.value); };
    $("#solo").value = body.getAttribute("data-solo") || ""; $("#solo").onchange = function () { if (this.value) body.setAttribute("data-solo", this.value); else body.removeAttribute("data-solo"); };
    document.querySelectorAll(".stem[data-k]").forEach(function (e) {
      var k = e.getAttribute("data-k"), r = e.querySelector("input"), b = e.querySelector("button");
      r.value = state.vol[k]; r.oninput = function () { state.vol[k] = +r.value; applyVol(k); modeCheck(); };
      b.onclick = function () { state.mute[k] = !state.mute[k]; b.classList.toggle("on", state.mute[k]); applyVol(k); modeCheck(); };
    });
    var drag = false;
    function scrubTo(ev) { var r = scrubEl.getBoundingClientRect(); seek(clamp((ev.clientX - r.left) / r.width, 0, 1) * 240, true); }
    scrubEl.addEventListener("pointerdown", function (e) { drag = true; scrubEl.setPointerCapture(e.pointerId); scrubTo(e); });
    scrubEl.addEventListener("pointermove", function (e) { if (drag) scrubTo(e); });
    scrubEl.addEventListener("pointerup", function () { drag = false; });
    window.addEventListener("keydown", function (e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      var k = e.key;
      if (k === " ") { e.preventDefault(); state.playing ? pause() : play(); }
      else if (k === "ArrowRight") { e.preventDefault(); if (e.shiftKey) seek(state.t + 1, true); else { pause(); seek(state.t + 1 / FPS); } }
      else if (k === "ArrowLeft") { e.preventDefault(); if (e.shiftKey) seek(state.t - 1, true); else { pause(); seek(state.t - 1 / FPS); } }
      else if (k === "Home") seek(0, true);
      else if (k === "End") { pause(); seek(lastT()); }
      else if (k === "[") $("#prev").onclick();
      else if (k === "]") $("#next").onclick();
      else if (k === "c" || k === "C") { body.classList.toggle("clean"); setTimeout(fit, 0); }
      else if (k === "Escape") { body.classList.remove("clean"); setTimeout(fit, 0); }
      else if (k === "k" || k === "K") $("#cc").onclick();
      else if (k === "m" || k === "M") $("#mute").onclick();
      else if (k === "l" || k === "L") $("#loop").onclick();
      else if (k >= "1" && k <= "8") { var s = sceneList()[+k - 1]; if (s) seek(s.start, true); }
    });
  }

  /* ---------------- loader / preload ---------------- */
  function loaderItem(k, ok) {
    var li = document.querySelector('.loader li[data-k="' + k + '"]'); if (!li) return;
    li.className = ok === true ? "ok" : ok === false ? "bad" : "";
    li.querySelector("b").textContent = ok === true ? "ready" : ok === false ? "MISSING" : "…";
  }
  function preload() {
    var fonts = Promise.all(["400", "500", "700"].map(function (w) { return document.fonts.load(w + " 40px 'Roboto Mono'"); }))
      .then(function (r) { var ok = r.every(function (x) { return x.length > 0; }); loaderItem("fonts", ok); return ok; });
    var imgs = Promise.all(Array.prototype.map.call(document.querySelectorAll(".stage img"), function (im) {
      return (im.decode ? im.decode() : Promise.resolve()).then(function () { return true; }, function () { return false; });
    })).then(function (r) { var ok = r.every(Boolean); loaderItem("images", ok); return ok; });
    return Promise.all([fonts, imgs]);
  }

  /* ---------------- boot ---------------- */
  function boot() {
    body.setAttribute("data-bg", qs.get("bg") || "space");
    if (qs.get("solo")) body.setAttribute("data-solo", qs.get("solo"));
    if (qs.get("clean") === "1") body.classList.add("clean");
    if (qs.get("captions") === "0") body.classList.add("no-captions");
    if (qs.get("reduced") === "1" || (qs.get("reduced") !== "0" && matchMedia("(prefers-reduced-motion: reduce)").matches && !state.capture)) body.classList.add("reduced");
    body.setAttribute("data-cut", state.cut);

    window.EJ_BUILD.init();
    window.EJ_BUILD.lengths();
    fit(); window.addEventListener("resize", fit);
    collectGlobal(); buildScrub(); buildSceneButtons(); bindDock();

    var start = 0;
    if (qs.get("scene")) { var s = TL.scenes.filter(function (x) { return x.id === qs.get("scene"); })[0]; if (s) start = s.start; }
    if (qs.get("time")) start = +qs.get("time");
    if (qs.get("frame")) start = +qs.get("frame") / FPS;
    state.t = snap(clamp(start, 0, lastT()));
    if (qs.get("loop") === "1") state.loop = true;

    var ready = preload();
    if (!state.capture) stemNames.forEach(makeAudio);
    else $("#loader").classList.add("hide");
    ready.then(function () { state.dirty = true; render(state.t); window.EJ.ready = true; });

    $("#go").onclick = function () { $("#loader").classList.add("hide"); play(); };
    $("#silent").onclick = function () { $("#loader").classList.add("hide"); };
    render(state.t); updateStatus();
    requestAnimationFrame(tick);
  }

  window.EJ = {
    ready: false, state: state,
    seek: function (t) { pause(); seek(t); return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); },
    renderAt: function (t) { state.t = t; render(t); },
    play: play, pause: pause, setCut: setCut, frames: frames,
    _stems: function () { return stems; }, _stemOK: function () { return stemOK; },   // for tools/verify.mjs
    _mode: function () { return usingMix ? "mix" : "stems"; }, _forceStems: function (v) { state.forceStems = !!v; modeCheck(); }
  };
  boot();
})();
