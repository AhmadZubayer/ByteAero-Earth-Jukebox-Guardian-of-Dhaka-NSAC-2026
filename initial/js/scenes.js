/* Earth Jukebox — scene data for the stylized isometric city (built by components.js).
 * The city is a game illustration of Dhaka, NOT a geographic model. Tile coordinates are
 * "col,row"; all times are absolute master seconds and mirror the cues in js/timeline.js.
 */
(function () {
  var I = function (id) { return '<svg class="ico"><use href="#' + id + '"/></svg>'; };
  function pin(id, color, d, o, extra) {
    return '<div class="a in-pop' + (o ? " out-fade" : "") + '" style="--d:' + d + (o ? ";--o:" + o : "") + '">' +
      '<div class="pin" style="color:' + color + ';bottom:' + (extra || 0) + 'px">' + I(id) + '</div></div>';
  }
  function label(text, color, d, o, dy) {
    return '<div class="a in-up' + (o ? " out-fade" : "") + '" style="--d:' + d + (o ? ";--o:" + o : "") + '">' +
      '<div class="bbl" style="color:' + color + ';bottom:' + (dy || 90) + 'px">' + text + '</div></div>';
  }
  function tree(d, extraStyle) {
    return '<div class="a in-pop" style="--d:' + d + '"><div class="tree" style="' + (extraStyle || "") + '"></div></div>';
  }
  function person(d, bodyColor, dx) {
    return '<div class="a in-pop" style="--d:' + d + ';translate:' + (dx || 0) + 'px 0"><div class="person" style="--pb:' + bodyColor + '"></div></div>';
  }
  function coinDrop(t) {
    return '<div class="a in-fade out-fade t-fast" style="--d:' + (t - 0.3) + ';--o:' + (t + 0.35) + ';--t2:.3s">' +
      '<div class="a mv" style="--d:' + (t - 0.3) + ';--t1:.3s;--e1:var(--ease-in);--fy:-260px;--ty:0px">' +
      '<div class="coin" style="position:absolute;left:-22px;bottom:0">1</div></div></div>';
  }
  function rings(at, times, cls, T) {                 // flat rings on the ground plane
    var p = at.split(",").map(Number), cx = p[0] * T + T / 2, cy = p[1] * T + T / 2, s = T * 0.9;
    return times.map(function (t) {
      return '<div class="gring a in-ring ' + (cls || "") + '" style="--d:' + t + ';--rs:3.2;left:' + (cx - s / 2) + 'px;top:' + (cy - s / 2) + 'px;width:' + s + 'px;height:' + s + 'px"></div>';
    }).join("");
  }
  function range(a, b, step) { var o = []; for (var t = a; t < b - 1e-6; t += step) o.push(+t.toFixed(4)); return o; }

  var cities = [];

  /* ---------- s02: the "virtual city" icon ---------- */
  var s02b = {};
  ["0,0", "1,0", "2,0", "0,1", "2,1", "0,2", "1,2", "2,2"].forEach(function (k, i) {
    var p = k.split(",").map(Number);
    s02b[k] = { h: 30 + ((i * 37) % 60), k: ["glass", "", "warm", "grey"][i % 4], cls: "a in-rise", style: "--d:" + (39.7 + (p[0] + p[1]) * 0.08) };
  });
  cities.push({ host: "#s02-city", spec: { n: 3, tile: 84, park: ["1,1"], blds: s02b,
    bb: [{ at: "1,1", html: tree(40.3) }] } });

  /* ---------- s03: training city (controls + Sound Lab preview) ---------- */
  var T3 = 110, s03b = {};
  var s03heights = { "0,0": 70, "1,0": 110, "3,0": 90, "4,0": 60, "0,1": 50, "1,1": 0, "3,1": 130, "4,1": 80, "0,2": 60, "1,2": 90, "3,2": 70, "4,2": 100, "0,3": 40, "3,3": 0, "4,3": 60 };
  Object.keys(s03heights).forEach(function (k, i) {
    var p = k.split(",").map(Number);
    if (!s03heights[k]) return;
    s03b[k] = { h: s03heights[k], k: ["glass", "", "warm", "grey", ""][i % 5], cls: "a in-rise", style: "--d:" + (50.15 + (p[0] + p[1]) * 0.07) };
  });
  s03b["3,1"].roof = '<div class="roofh a in-fade out-fade" style="--d:52.5;--o:55.2"></div>';
  cities.push({ host: "#s03-city", spec: { n: 5, tile: T3, roads: { cols: [2] }, water: ["0,4", "1,4", "2,4", "3,4", "4,4"], lot: ["1,1", "1,3", "3,3"],
    blds: s03b,
    ov: [
      { at: "1,3", cls: "green a in-fade", style: "--d:54.6" },
      { at: "0,0", span: 5, cls: "hot a", style: "opacity:calc((var(--hv, .5) - .5) * 1.6);border-radius:14px" },
      { at: "0,3", cls: "flood", style: "width:" + (5 * T3 - 6) + "px;height:" + (2 * T3 - 6) + "px;opacity:calc((var(--rv, .5) - .55) * 2.2)" }
    ],
    ground: rings("3,1", [52.55, 53.175, 53.8], "", T3) + rings("1,3", [54.4], "cy", T3) +
      '<svg class="trail" width="550" height="550" style="position:absolute;left:0;top:0;overflow:visible">' +
      '<path class="a in-draw" data-len style="--d:50.8;--t1:1.6s" d="M 60 470 C 160 380, 200 300, 300 290 S 420 180, 470 120"/></svg>' +
      '<div class="touch a in-fade out-fade" style="--d:50.7;--o:52.5;--t1:.2s"><div class="a kpath" style="--d:50.8;--t1:1.6s;offset-path:path(\'M 60 470 C 160 380, 200 300, 300 290 S 420 180, 470 120\')"></div></div>',
    bb: [
      { at: "1,3", html: tree(54.6, "scale:calc(.7 + var(--gv, .75) * .45)") },
      { at: "1,1", html: tree(50.5, "scale:calc(.15 + var(--gv, .75) * 1.1)"), dx: -18 },
      { at: "1,1", html: tree(50.6, "scale:calc(.15 + var(--gv, .75) * 1.1)"), dx: 22, dy: 20 },
      { at: "3,3", html: tree(50.6, "scale:calc(.15 + var(--gv, .75) * 1.1)") },
      { at: "2,2", html: person(50.7, "#58D9F9", -16) + person(50.8, "#F6B83F", 16) },
      { at: "2,2", html: '<div class="stress" style="opacity:calc((var(--hv, .5) - .72) * 5)">' + '<div class="pin" style="color:var(--heat);bottom:70px">' + I("i-heat") + '</div></div>' },
      { at: "3,1", html: pin("i-warn", "var(--heat)", 52.5, 55.3, 150) }
    ] } });

  /* ---------- s04: mission city ---------- */
  var T4 = 92, s04b = {};
  var zone = ["4,0", "5,0", "6,0", "7,0", "4,1", "5,1", "6,1", "7,1", "5,2", "6,2", "7,2"];
  var safe = { "4,0": 1, "5,0": 1, "6,0": 1, "6,1": 1, "5,1": 1, "5,2": 1, "6,2": 1 };
  var cross = function (k) { return +(130.2 + (7 - +k.split(",")[0]) * 0.5).toFixed(2); };
  var growth = ["0,0", "1,1", "2,5", "5,5", "6,6", "0,6"];
  var lots4 = ["5,0", "6,0", "5,2"].concat(growth, ["2,0", "0,2", "7,5"]);
  var rr = window.EJ_BUILD.rng(41);
  for (var y = 0; y < 7; y++) for (var x = 0; x < 8; x++) {
    var k = x + "," + y;
    if (x === 3 || y === 4 || k === "1,5" || lots4.indexOf(k) >= 0) continue;
    var dd = Math.hypot(x - 4, y - 2.5) / 5.5;
    s04b[k] = { h: Math.round(30 + (1 - dd) * 95 * (0.5 + rr() * 0.7)), k: ["", "glass", "warm", "grey"][Math.floor(rr() * 4)],
      cls: "a in-rise", style: "--d:" + (98.9 + (x + y) * 0.05).toFixed(2) };
  }
  growth.forEach(function (k, i) {
    s04b[k] = { h: 60 + (i * 23) % 70, k: ["grey", "", "glass"][i % 3], cls: "a in-rise", style: "--d:" + (145.9 + i * 0.3).toFixed(2) };
  });
  s04b["6,1"].h = 120;
  s04b["6,1"].roof = '<div class="roofw a in-flip" style="--d:123.85"></div>';
  ["7,0", "4,1", "7,1", "7,2"].forEach(function (k) {
    s04b[k].roof = (s04b[k].roof || "") + '<div class="roofh a in-fade" style="--d:' + cross(k) + '"></div>';
  });
  var ov4 = [];
  zone.forEach(function (k, i) {
    ov4.push({ at: k, cls: "zone a in-fade out-fade", style: "--d:" + (103.0 + i * 0.05).toFixed(2) + ";--o:" + cross(k) });
    ov4.push({ at: k, cls: (safe[k] ? "safe" : "hot") + " a in-fade", style: "--d:" + cross(k) });
  });
  ov4.push({ at: "5,2", cls: "pond a in-pop", style: "--d:125.1" });
  var bb4 = [
    { at: "6,1", html: pin("i-warn", "var(--heat)", 107.6, 110.2, 150) },
    { at: "5,0", html: coinDrop(121.25) + tree(121.35) },
    { at: "6,0", html: coinDrop(122.5) + tree(122.6) },
    { at: "6,1", html: coinDrop(123.75), z: 120 },
    { at: "5,2", html: coinDrop(125.0) },
    { at: "7,2", html: coinDrop(126.25) + pin("i-cool", "var(--cyan)", 126.35, 0, 120) },
    { at: "7,2", html: label("PEOPLE SAFE<br>AREA STILL HOT", "var(--cyan)", 131.0, 137.4, 200) },
    { at: "7,1", html: pin("i-sick", "var(--heat)", 130.8, 0, 125) },
    { at: "4,1", html: pin("i-school", "var(--heat)", 131.9, 0, 125) },
    { at: "4,1", html: label("SCHOOL CLOSED", "var(--heat)", 132.1, 137.4, 205) },
    { at: "5,5", html: person(99.6, "#58D9F9", -14) + person(99.7, "#6DDEAB", 12) },
    { at: "2,1", html: person(99.7, "#F6B83F", 0), dx: -30, dy: 30 }
  ];
  var trail4 = "M 138 506 C 200 400, 300 360, 360 300 S 520 240, 598 138";
  cities.push({ host: "#s04-city", spec: { n: 8, tile: T4, roads: { cols: [3], rows: [4] }, water: range(0, 8, 1).map(function (x) { return x + ",7"; }),
    park: ["1,5"], lot: lots4, blds: s04b, ov: ov4, bb: bb4,
    ground: rings("6,1", range(102.8, 107.6, 0.625), "", T4) + rings("6,1", [107.6], "cy", T4) +
      ["5,0", "6,0", "6,1", "5,2", "7,2"].map(function (k, i) { return rings(k, [[121.35, 122.6, 123.85, 125.1, 126.35][i]], "cy", T4); }).join("") +
      '<svg class="trail" width="736" height="736" style="position:absolute;left:0;top:0;overflow:visible"><path class="a in-draw out-fade" data-len style="--d:105.0;--t1:2.6s;--o:109.5" d="' + trail4 + '"/></svg>' +
      '<div class="touch a in-fade out-fade" style="--d:104.9;--o:108.0;--t1:.2s"><div class="a kpath" style="--d:105.0;--t1:2.6s;offset-path:path(\'' + trail4 + '\')"></div></div>' +
      '<div class="a in-fade out-fade" style="position:absolute;inset:0;--d:129.95;--t1:.2s;--o:133.6"><div class="front a mv" style="--d:130.0;--t1:3.8s;--e1:linear;--fx:760px;--tx:-340px"></div></div>'
  } });

  /* ---------- s06: two conditional futures from one shared city ---------- */
  function futureCity(host, kind) {
    var b = {}, r = window.EJ_BUILD.rng(77), bbs = [], ovs = [];
    for (var yy = 0; yy < 5; yy++) for (var xx = 0; xx < 5; xx++) {
      var key = xx + "," + yy;
      if (xx === 2 || key === "0,4" || key === "4,4" || key === "1,1" || key === "3,3") continue;
      b[key] = { h: Math.round(34 + r() * 70), k: ["", "glass", "warm", "grey"][Math.floor(r() * 4)] };
      if (kind === "B") { b[key].cls = "a taller"; b[key].style = "--m:" + (193.0 + (xx + yy) * 0.06).toFixed(2); b[key].k = "grey"; }
      if (kind === "A" && (xx + yy) % 3 === 0) b[key].roof = '<div class="solar a in-flip" style="--d:' + (193.2 + (xx + yy) * 0.08).toFixed(2) + '"></div>';
    }
    ["1,1", "3,3", "0,4", "4,4"].forEach(function (k, i) {
      if (kind === "A") { bbs.push({ at: k, html: tree(192.9 + i * 0.25), dx: -14 }); bbs.push({ at: k, html: tree(193.05 + i * 0.25), dx: 16, dy: 14 }); ovs.push({ at: k, cls: "green a in-fade", style: "--d:" + (192.9 + i * 0.25) }); }
      else { ovs.push({ at: k, cls: "concrete a in-fade", style: "--d:" + (193.0 + i * 0.2) }); }
    });
    if (kind === "B") ovs.push({ at: "0,0", span: 5, cls: "hot a in-fade", style: "--d:193.6;--t1:1.2s;opacity:.45;border-radius:14px" });
    else ovs.push({ at: "3,1", cls: "pond a in-pop", style: "--d:193.5" });
    cities.push({ host: host, spec: { n: 5, tile: 88, roads: { cols: [2] }, blds: b, bb: bbs, ov: ovs, park: kind === "A" ? [] : [] } });
  }
  futureCity("#s06-cityA", "A");
  futureCity("#s06-cityB", "B");

  /* ---------- s07: calm city beside Echo ---------- */
  var s07b = {};
  ["0,0", "1,0", "3,0", "0,1", "3,1", "1,3", "3,3", "0,3"].forEach(function (k, i) {
    s07b[k] = { h: 30 + (i * 29) % 70, k: ["glass", "", "warm", "grey"][i % 4] };
    if (i % 3 === 0) s07b[k].roof = '<div class="solar"></div>';
  });
  cities.push({ host: "#s07-city", spec: { n: 4, tile: 78, roads: { cols: [2] }, park: ["1,1", "0,2", "1,2"], blds: s07b, ov: [{ at: "3,2", cls: "pond" }],
    bb: [{ at: "1,1", html: tree(0) }, { at: "0,2", html: tree(0) }, { at: "1,2", html: tree(0), dx: 10 }, { at: "1,2", html: person(0, "#58D9F9", -20) }] } });

  window.EJ_CITIES = cities;
  window.EJ_ICON = I;
})();
