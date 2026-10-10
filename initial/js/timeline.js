/* Earth Jukebox — master timeline, musical grid and cue data.
 *
 * Single source of truth for: scene bounds, the 96 BPM grid, sound-effect cues and the
 * educational sonification notes. The browser uses it to draw note/drum/chord marks at
 * the exact times they sound; tools/build-audio.cmd dumps it (via Node) so the Python
 * synthesiser renders audio from the same numbers. Times are absolute master seconds.
 *
 * Requires js/transect.js to be loaded first (s05 frame-to-sound demonstration).
 */
(function () {
  var BPM = 96, BEAT = 60 / BPM, BAR = BEAT * 4;           // 0.625 s, 2.5 s

  var scenes = [
    { id: "s01", title: "Guardian wanted",           start: 0,   end: 25 },
    { id: "s02", title: "Meet ByteAro",              start: 25,  end: 50 },
    { id: "s03", title: "Echo’s training",           start: 50,  end: 95 },
    { id: "s04", title: "The mission begins",        start: 95,  end: 150 },
    { id: "s05", title: "Echo explains the evidence", start: 150, end: 185 },
    { id: "s06", title: "Your future and boarding pass", start: 185, end: 215 },
    { id: "s07", title: "Final invitation",          start: 215, end: 235 },
    { id: "s08", title: "End hold (master only)",    start: 235, end: 240, masterOnly: true }
  ];

  var cuts = {
    master:  { label: "Master 240 s",  duration: 240, music: "audio/music-master.wav", mix: "delivery/audio/mix-master.wav" },
    judging: { label: "Judging 235 s", duration: 235, music: "audio/music-judging.wav", mix: "delivery/audio/mix-judging.wav" }
  };

  var stems = {
    sono: "audio/sonification.wav",
    sfx: "audio/sfx.wav",
    vo: "audio/vo-guide-TEMP.wav"
  };

  /* Ring-wipe transitions (cover closes onto the boundary, opens after it). */
  var wipes = [25, 50, 95, 150, 185, 215];

  /* ---------------- Sound effects: [time, type, gain(0-1), pan(-1..1)] ---------------- */
  var sfx = [
    // s01
    [0.625, "ping", 0.5, 0], [1.875, "ping", 0.3, 0], [2.3, "swell", 0.5, 0],
    [5.0, "beep", 0.8, 0.3], [15.0, "card", 0.7, 0.2], [16.9, "tick", 0.5, 0.3],
    [18.9, "tick", 0.5, 0.3], [21.25, "beep", 0.55, 0.1], [22.5, "chirp", 0.6, 0.1],
    // s02
    [25.0, "card", 0.6, -0.3], [27.5, "card", 0.5, -0.2], [28.75, "tick", 0.45, -0.2],
    [30.0, "tick", 0.35, 0.3], [30.3125, "tick", 0.35, 0.35], [30.625, "tick", 0.35, 0.4], [30.9375, "tick", 0.35, 0.45],
    [33.1, "tick", 0.45, -0.3], [34.4, "tick", 0.45, 0], [35.3, "tick", 0.45, 0.3], [36.9, "card", 0.45, 0],
    [42.5, "card", 0.55, 0], [43.0, "beep", 0.55, 0.3],
    [44.4, "key", 0.5, 0], [44.7, "key", 0.5, 0], [45.0, "key", 0.5, 0], [45.3, "key", 0.5, 0],
    [46.25, "enter", 0.6, 0], [47.5, "whoosh", 0.35, -0.4],
    // s03
    [50.6, "tick", 0.45, 0.4], [52.4, "tick", 0.45, 0.4], [54.3, "tick", 0.45, 0.4], [54.4, "tap", 0.6, -0.2],
    [54.6, "pop", 0.55, -0.2], [57.0, "card", 0.55, 0.2], [58.9, "tick", 0.35, 0],
    [67.5, "tick", 0.35, 0], [72.5, "tick", 0.35, 0], [77.5, "card", 0.45, 0.3],
    [80.6, "correct", 0.5, 0.3], [82.2, "correct", 0.5, 0.3], [84.4, "correct", 0.55, 0.3],
    [85.0, "card", 0.5, 0],
    [87.0, "correct", 0.45, -0.2], [88.25, "correct", 0.45, -0.1], [89.5, "correct", 0.45, 0],
    [90.75, "wrong", 0.5, 0.1], [91.25, "beep", 0.45, 0.4], [93.25, "correct", 0.45, 0.2], [93.75, "unlock", 0.65, 0],
    // s04
    [95.0, "swell", 0.45, 0], [96.25, "lock", 0.55, 0.1], [97.5, "swell", 0.3, 0], [98.75, "card", 0.45, 0],
    [100.0, "tick", 0.4, -0.6], [100.3125, "tick", 0.4, -0.35], [100.625, "tick", 0.4, -0.1],
    [100.9375, "tick", 0.4, 0.1], [101.25, "tick", 0.4, 0.35], [101.5625, "tick", 0.4, 0.6],
    [102.0, "tick", 0.5, 0.1], [102.5, "alert", 0.45, 0.5], [107.6, "lock", 0.65, 0.4],
    [110.0, "card", 0.5, 0],
    [113.0, "tick", 0.45, -0.45], [114.2, "tick", 0.45, -0.15], [115.4, "tick", 0.45, 0.15], [116.8, "tick", 0.45, 0.45],
    [121.25, "coin", 0.6, -0.2], [121.35, "pop", 0.5, -0.2], [122.5, "coin", 0.6, 0], [122.6, "pop", 0.5, 0],
    [123.75, "coin", 0.6, 0.2], [123.85, "flip", 0.55, 0.2], [125.0, "coin", 0.6, -0.1], [125.1, "splash", 0.6, -0.1],
    [126.25, "coin", 0.6, 0.3], [126.35, "chime", 0.55, 0.3],
    [130.0, "heatwave", 0.8, 0.4], [137.5, "card", 0.5, 0.3], [139.4, "tick", 0.45, 0.3], [142.2, "tick", 0.45, 0.3],
    [145.9, "pop", 0.3, -0.3], [146.5, "pop", 0.3, 0.1], [147.1, "pop", 0.3, 0.3], [147.7, "pop", 0.3, -0.1],
    // s05
    [150.6, "card", 0.5, -0.3], [154.6, "tick", 0.45, -0.5], [157.5, "tick", 0.45, 0], [160.0, "tick", 0.45, 0.5],
    [163.2, "tick", 0.4, -0.5], [164.0, "tick", 0.4, -0.2], [164.8, "tick", 0.4, 0.2], [165.6, "tick", 0.4, 0.5],
    [167.4, "card", 0.45, 0], [173.75, "swell", 0.4, 0], [177.5, "card", 0.45, -0.2], [178.0, "tick", 0.4, -0.4],
    // s06
    [185.2, "beep", 0.55, 0], [186.9, "card", 0.45, 0], [189.4, "tick", 0.5, -0.3], [190.6, "tick", 0.5, 0.3],
    [192.5, "swell", 0.45, 0], [197.5, "whoosh", 0.4, 0], [198.1, "card", 0.55, 0],
    [199.9, "sparkle", 0.5, -0.3], [200.5, "sparkle", 0.5, 0], [201.1, "sparkle", 0.5, 0.3],
    [201.9, "tick", 0.45, 0.4], [203.75, "stamp", 0.6, 0.2], [207.5, "beep", 0.5, 0.3],
    // s07
    [215.0, "swell", 0.4, 0], [217.5, "tick", 0.4, 0.3], [219.4, "tick", 0.4, 0.3], [221.0, "tick", 0.4, 0.3],
    [223.75, "card", 0.35, 0], [225.3, "card", 0.35, 0], [227.6, "chirp", 0.55, 0.2], [230.0, "swell", 0.35, 0]
  ];
  // Transition whooshes land on each wipe boundary.
  wipes.forEach(function (w) { sfx.push([w - 0.45, "whoosh", 0.55, 0]); });
  // Protection countdown: one tick per real second, 110 s .. 129 s.
  for (var s = 0; s < 20; s++) sfx.push([110 + s, "clock", s >= 15 ? 0.5 : 0.28, 0]);
  sfx.sort(function (a, b) { return a[0] - b[0]; });

  /* ---------------- Educational sonification ----------------
   * kinds: "heat" melody note {t,d,m(midi),sharp(0-1),pan,g}
   *        "rain" drum hit    {t,v,pan,g}
   *        "green" soft chord {t,d,notes[],detune(cents),pan,g}
   *        "scan" neutral tone for the frame-to-sound demo {t,d,m,g}
   * Mapping (from the game plan): heat -> melody (calm middle notes .. high & sharp),
   * rain -> drums (steady beat .. very fast flood / silent drought),
   * greenery -> soft chords (sweet .. out of tune).
   */
  var PENTA = [0, 3, 5, 7, 10];                      // D minor pentatonic around D
  function snap(m) {                                 // nearest pentatonic MIDI note on D
    var base = Math.floor((m - 2) / 12) * 12 + 2, best = m, dist = 99;
    for (var o = -12; o <= 12; o += 12) PENTA.forEach(function (p) {
      var c = base + o + p; if (Math.abs(c - m) < dist) { dist = Math.abs(c - m); best = c; }
    });
    return best;
  }
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function ramp(t, t0, t1, v0, v1) { return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0)); }
  var CONTOUR = [0, 2, 4, 2, 5, 3, 1, 3];
  function heatPitch(h, i) {                          // h: 0 calm .. 1 heatwave
    return snap(64 + h * 19 + CONTOUR[i % CONTOUR.length] * (1 + 0.4 * h));
  }

  var sono = [];
  function heatRun(t0, t1, step, hOf, opt) {
    opt = opt || {};
    for (var i = 0, t = t0; t < t1 - 1e-6; i++, t = t0 + i * step) {
      var h = hOf(t);
      sono.push({ k: "heat", t: +t.toFixed(4), d: step * 0.9, m: heatPitch(h, i), sharp: h,
        pan: opt.pan === undefined ? 0 : (typeof opt.pan === "function" ? opt.pan(t) : opt.pan),
        g: opt.g === undefined ? 0.8 : (typeof opt.g === "function" ? opt.g(t) : opt.g), tag: opt.tag });
    }
  }
  function rainRun(t0, t1, rOf, opt) {               // r: 0 drought .. 0.5 normal .. 1 flood
    opt = opt || {};
    var t = t0;
    while (t < t1 - 1e-6) {
      var r = rOf(t);
      sono.push({ k: "rain", t: +t.toFixed(4), v: 0.55 + 0.45 * r, pan: opt.pan || 0, g: opt.g || 0.85, tag: opt.tag });
      t += BEAT * Math.pow(2, -(r - 0.5) * 4);         // 0.5 -> quarter notes, 1 -> sixteenths
    }
  }
  var CHORDS = [[53, 57, 60, 64], [50, 57, 60, 65], [46, 53, 57, 62], [48, 55, 60, 64]]; // Fmaj7, Dm(add), Bbmaj7, C
  function chordRun(t0, t1, step, detOf, opt) {
    opt = opt || {};
    for (var i = 0, t = t0; t < t1 - 1e-6; i++, t = t0 + i * step) {
      sono.push({ k: "green", t: +t.toFixed(4), d: opt.d || step * 1.1, notes: CHORDS[(i + (opt.offset || 0)) % 4],
        detune: detOf(t), pan: opt.pan || 0, g: opt.g || 0.75, tag: opt.tag });
    }
  }
  var E8 = BEAT / 2, E16 = BEAT / 4;

  // s01: a first taste of "Earth's song" (calm = normal) right after "into music".
  heatRun(9.375, 11.875, E8 * 2, function () { return 0.15; }, { g: 0.45, tag: "s01-song" });
  rainRun(9.375, 11.875, function () { return 0.5; }, { g: 0.4, tag: "s01-song" });
  chordRun(9.375, 11.875, 2.5, function () { return 0; }, { d: 3, g: 0.4, tag: "s01-song" });

  // s03 controls: listen to the warning, tap to place a tree.
  heatRun(53.125, 54.1, E8, function () { return 0.9; }, { pan: 0.3, g: 0.7, tag: "s03-warning" });
  chordRun(54.6, 54.7, 1, function () { return 0; }, { d: 1.4, g: 0.6, tag: "s03-tree" });
  // Sound Lab: heat melody rises with the slider (value 0.5 -> 0.95 between 59 and 66 s).
  function heatKnob(t) { return ramp(t, 59, 66, 0.5, 0.95); }
  heatRun(59.0, 67.1, E8, function (t) { return (heatKnob(t) - 0.5) / 0.45; }, { tag: "lab-heat" });
  // Rain: slider 0.3 -> 1.0 between 68 and 71 s; beat accelerates to flood.
  rainRun(68.0, 72.3, function (t) { return ramp(t, 68, 71, 0.3, 1.0); }, { tag: "lab-rain" });
  // Greenery: slider 0.2 -> 0.85 between 73 and 76.5 s; chords move from out of tune to sweet.
  chordRun(73.0, 77.4, 1.25, function (t) { return ramp(t, 73, 76.5, 45, 0); }, { tag: "lab-green" });
  // Mission montage: heatwave, flood, back to normal.
  heatRun(79.375, 80.6, E8, function () { return 1; }, { tag: "lab-m1" });
  rainRun(80.9, 82.2, function () { return 1; }, { tag: "lab-m2" });
  heatRun(82.5, 85.0, E8 * 2, function () { return 0.1; }, { g: 0.6, tag: "lab-m3" });
  rainRun(82.5, 85.0, function () { return 0.5; }, { g: 0.6, tag: "lab-m3" });
  chordRun(82.5, 85.0, 1.25, function () { return 0; }, { g: 0.6, tag: "lab-m3" });
  // Quick Ears: five sounds, one wrong answer, hint replay.
  heatRun(86.25, 87.1, E8 / 1.2, function () { return 0.95; }, { g: 0.75, tag: "qe1" });
  rainRun(87.5, 88.35, function () { return 1; }, { g: 0.8, tag: "qe2" });
  chordRun(88.75, 88.8, 1, function () { return 0; }, { d: 0.95, g: 0.7, tag: "qe3" });
  rainRun(90.0, 90.85, function () { return 0.85; }, { g: 0.8, tag: "qe4" });
  rainRun(91.25, 92.1, function () { return 0.85; }, { g: 0.8, tag: "qe4-hint" });
  heatRun(92.5, 93.35, E8 / 1.2, function () { return 0.9; }, { g: 0.75, tag: "qe5" });

  // s04 warning: the melody rises in the east district; louder as the finger closes in.
  heatRun(102.8, 109.5, E8, function (t) { return ramp(t, 102.8, 107.6, 0.35, 1); },
    { pan: function (t) { return ramp(t, 102.8, 107.6, 0.75, 0.25); },
      g: function (t) { return ramp(t, 103, 107.6, 0.45, 0.85); }, tag: "s04-warning" });
  // Trees placed during protection answer with a short sweet chord (greenery = chords).
  chordRun(121.35, 121.4, 1, function () { return 0; }, { d: 1.0, g: 0.45, pan: -0.2, tag: "s04-tree" });
  chordRun(122.6, 122.65, 1, function () { return 0; }, { d: 1.0, g: 0.45, offset: 1, tag: "s04-tree" });
  // Impact: the heat melody spikes over unprotected zones.
  heatRun(130.0, 133.2, E16, function () { return 1; }, { pan: 0.3, g: 0.55, tag: "s04-impact" });

  // s05 frame-to-sound demonstration: brightness samples -> pitch (neutral "scan" timbre).
  var T = window.EJ_TRANSECT || { notes: [] };
  var lo = Math.min.apply(null, T.notes), hi = Math.max.apply(null, T.notes);
  T.notes.forEach(function (b, i) {
    var u = (b - lo) / (hi - lo || 1);
    sono.push({ k: "scan", t: +(178 + i * E16).toFixed(4), d: E16 * 0.95, m: snap(60 + u * 26), g: 0.7, u: u, tag: "s05-scan" });
  });

  // s06: Future A (calmer) then Future B (hotter), both conditional game scenarios.
  heatRun(192.8, 195.0, E8 * 2, function () { return 0.15; }, { pan: -0.5, g: 0.5, tag: "s06-A" });
  rainRun(192.8, 195.0, function () { return 0.5; }, { pan: -0.5, g: 0.45, tag: "s06-A" });
  chordRun(192.8, 195.0, 1.1, function () { return 0; }, { pan: -0.5, g: 0.5, tag: "s06-A" });
  heatRun(195.0, 197.3, E8, function () { return 0.95; }, { pan: 0.5, g: 0.5, tag: "s06-B" });
  rainRun(195.0, 197.3, function () { return 0.95; }, { pan: 0.5, g: 0.45, tag: "s06-B" });
  chordRun(195.0, 197.3, 1.1, function () { return 40; }, { pan: 0.5, g: 0.45, tag: "s06-B" });

  // s07: calm Earth song under the goals.
  heatRun(216.25, 222.5, E8 * 2, function () { return 0.1; }, { g: 0.35, tag: "s07-song" });
  chordRun(216.25, 222.5, 2.5, function () { return 0; }, { d: 2.8, g: 0.35, tag: "s07-song" });

  sono.sort(function (a, b) { return a.t - b.t; });

  /* Windows where the score thins out so the lesson is audible (read by the audio build). */
  var teach = [
    { from: 9.2, to: 12.2, mode: "light" },
    { from: 52.9, to: 55.9, mode: "light" },
    { from: 58.75, to: 67.4, mode: "heat" },      // no bright melodic score material
    { from: 67.5, to: 72.5, mode: "rain" },       // score percussion suppressed
    { from: 72.5, to: 77.5, mode: "green" },
    { from: 79.2, to: 85.0, mode: "light" },
    { from: 86.0, to: 93.6, mode: "quiet" },      // Quick Ears
    { from: 102.6, to: 109.6, mode: "heat" },
    { from: 177.8, to: 184.2, mode: "quiet" },    // frame-to-sound demo
    { from: 192.6, to: 197.4, mode: "light" }
  ];

  /* Musical accents the picture lands on (for the cue sheet / QA). */
  var accents = [
    [0.625, "signal ping"], [2.5, "Earth reveal"], [5.0, "Echo arrives + two-note call"],
    [15.0, "GUARDIAN WANTED card hit, pulse enters"], [20.0, "title phrase"], [25.0, "wipe, ByteAro title"],
    [50.0, "wipe, training"], [57.5, "Sound Lab open"], [95.0, "wipe, mission"], [110.0, "protection groove"],
    [130.0, "heat-wave impact"], [137.5, "report / relief"], [150.0, "wipe, evidence (low density)"],
    [185.0, "wipe, future"], [197.5, "Echo motif returns, boarding pass"], [215.0, "wipe, return to Earth"],
    [232.5, "final cadence"], [235.0, "judging cut ends"], [240.0, "master ends"]
  ];

  window.EJ_TIMELINE = {
    fps: 30, bpm: BPM, beat: BEAT, bar: BAR, offset: 0,
    scenes: scenes, cuts: cuts, stems: stems, wipes: wipes,
    sfx: sfx, sono: sono, teach: teach, accents: accents
  };
})();
