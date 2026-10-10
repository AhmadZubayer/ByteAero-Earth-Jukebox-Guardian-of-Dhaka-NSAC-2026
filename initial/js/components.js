/* Earth Jukebox — reusable DOM builders.
 * Builds repeated component markup once at load (Echo, city, star field, sound marks).
 * Nothing here animates by itself: builders only emit elements with animation slot
 * classes and absolute-time delays (see css/motion.css). Deterministic: fixed seeds.
 */
(function () {
  var TL = window.EJ_TIMELINE;

  function rng(seed) {                         // mulberry32
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function h(tag, cls, style, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) e.setAttribute("style", style);
    if (html) e.innerHTML = html;
    return e;
  }
  function nums(s) { return (s || "").split(",").filter(function (x) { return x.trim() !== ""; }).map(Number); }

  /* ---------- star field (two parallax layers, fixed seed) ---------- */
  function stars(el, seed, count, maxR) {
    var r = rng(seed), sh = [];
    for (var i = 0; i < count; i++) {
      var x = Math.round(r() * 2000 - 40), y = Math.round(r() * 1160 - 40), s = (r() * maxR).toFixed(1);
      var a = (0.35 + r() * 0.65).toFixed(2);
      sh.push(x + "px " + y + "px 0 " + s + "px rgba(220,235,255," + a + ")");
    }
    el.style.boxShadow = sh.join(",");
  }

  /* ---------- Echo ----------
   * <div class="echo" data-echo data-rings="5,15" data-rings-amber="21.25" style="left:..;top:..;--es:1">
   */
  function echo(el) {
    var rings = nums(el.getAttribute("data-rings")).map(function (t) {
      return '<div class="part ring a in-ring" style="--d:' + t + '"></div>';
    }).join("") + nums(el.getAttribute("data-rings-amber")).map(function (t) {
      return '<div class="part ring amb a in-ring" style="--d:' + t + '"></div>';
    }).join("");
    el.innerHTML =
      '<div class="rig a lp-bob"><div class="sc">' + rings +
      '<div class="part flame a lp-flame"></div>' +
      '<div class="part arm l"></div><div class="part arm r"></div>' +
      '<div class="part wing l"><div class="panelx a lp-flap-l"></div></div>' +
      '<div class="part wing r"><div class="panelx a lp-flap-r"></div></div>' +
      '<div class="part stem"></div><div class="part dish"></div><div class="part tip"></div>' +
      '<div class="part body"></div><div class="part foil"></div>' +
      '<div class="part face">' +
      '<div class="part eye l a lp-blink"><i></i></div><div class="part eye r a lp-blink"><i></i></div>' +
      '<div class="part joy l"></div><div class="part joy r"></div>' +
      '<div class="part cheek l"></div><div class="part cheek r"></div>' +
      '<div class="part mouth"></div></div>' +
      '</div></div>';
  }

  /* ---------- sound ring around Earth: bars that breathe with the beat ---------- */
  function soundring(el) {
    var n = +el.getAttribute("data-n") || 96, R = +el.getAttribute("data-r") || 420;
    var t0 = +el.getAttribute("data-t0") || 0, span = +el.getAttribute("data-span") || 1.2;
    var r = rng(+el.getAttribute("data-seed") || 7), out = [];
    for (var i = 0; i < n; i++) {
      var len = 14 + Math.pow(r(), 1.6) * 70 + 18 * Math.sin(i / n * Math.PI * 6) ** 2;
      out.push('<i class="a in-grow t-fast" style="--d:' + (t0 + span * i / n).toFixed(3) +
        ';height:' + len.toFixed(1) + 'px;transform:rotate(' + (360 * i / n).toFixed(2) +
        'deg) translateY(-' + R + 'px) scaleY(calc(.55 + var(--beat) * .6))"></i>');
    }
    el.innerHTML = out.join("");
  }

  /* ---------- split text into staggered characters ---------- */
  function split(el) {
    var p = nums(el.getAttribute("data-split")), t0 = p[0], step = p[1] || 0.04, cls = el.getAttribute("data-split-cls") || "in-up";
    var text = el.textContent; el.textContent = "";
    Array.prototype.forEach.call(text, function (ch, i) {
      el.appendChild(h("span", "a " + cls, "--d:" + (t0 + i * step).toFixed(3) + ";--dist:40px", ch === " " ? "&nbsp;" : ch.replace(/&/g, "&amp;").replace(/</g, "&lt;")));
    });
  }

  /* ---------- sound marks drawn from the timeline sonification data ----------
   * data-marks="heat" data-tags="lab-heat,lab-m1" data-t0 data-t1 (x axis) data-w data-h
   */
  function marks(el) {
    var kind = el.getAttribute("data-marks"), tags = el.getAttribute("data-tags").split(",");
    var t0 = +el.getAttribute("data-t0"), t1 = +el.getAttribute("data-t1");
    var W = +el.getAttribute("data-w"), H = +el.getAttribute("data-h");
    var col = el.getAttribute("data-color") || "";
    var ev = TL.sono.filter(function (e) { return e.k === kind && tags.indexOf(e.tag) >= 0; });
    var X = function (t) { return 14 + (t - t0) / (t1 - t0) * (W - 28); };
    var out = [];
    ev.forEach(function (e, i) {
      var x = X(e.t).toFixed(1);
      if (kind === "heat" || kind === "scan") {
        var y = (H - 16 - (e.m - 60) / 30 * (H - 32)).toFixed(1);
        var size = kind === "heat" ? 10 + e.sharp * 10 : 14;
        out.push('<div class="nmark a in-pop t-fast" style="--d:' + e.t + ';left:' + x + 'px;top:' + y +
          'px;width:' + size + 'px;height:' + size + 'px;margin:' + (-size / 2) + 'px 0 0 ' + (-size / 2) + 'px' + (col ? ';--rc:' + col : '') + '"></div>');
      } else if (kind === "rain") {
        out.push('<div class="dmark a in-grow t-fast" style="--d:' + e.t + ';left:' + x + 'px;height:' + (24 + e.v * (H - 60)).toFixed(0) + 'px"></div>');
      } else if (kind === "green") {
        var bars = e.notes.map(function (n, j) {
          var jit = (j % 2 ? 1 : -1) * e.detune * 0.28;
          return '<i style="top:' + (j * 16) + 'px;transform:translateX(' + jit.toFixed(1) + 'px)"></i>';
        }).join("");
        out.push('<div class="cmark a in-growx" style="--d:' + e.t + ';left:' + x + 'px;top:' + (H / 2 - 30) + 'px;width:' + Math.max(40, e.d / (t1 - t0) * (W - 28) - 8).toFixed(0) + 'px;transform-origin:left">' + bars + '</div>');
      }
    });
    el.insertAdjacentHTML("beforeend", out.join(""));
  }

  /* ---------- isometric Dhaka-style game city (stylized, not to scale) ----------
   * spec: { n, tile, seed, roads:{cols:[],rows:[]}, water:["c,r"], park:[], lot:[],
   *   blds:{ "c,r": {h, k(kind), cls, style, roof:"html", inner:"html"} },
   *   fill: true (auto buildings on remaining tiles), tileCls:{ "c,r": "..." },
   *   ov:[{at:"c,r", cls, style}], bb:[{at:"c,r", dx, dy, html}] (billboards), ground:"html" }
   */
  function city(el, spec) {
    var n = spec.n, T = spec.tile, r = rng(spec.seed || 3), W = n * T;
    var c = h("div", "city"); c.style.width = W + "px"; c.style.height = W + "px";
    var html = ['<div class="gnd"></div>'];
    var set = function (a) { var o = {}; (a || []).forEach(function (k) { o[k] = 1; }); return o; };
    var water = set(spec.water), park = set(spec.park), lot = set(spec.lot);
    var rc = spec.roads || {}, cols = set((rc.cols || []).map(String)), rows = set((rc.rows || []).map(String));
    var blds = spec.blds || {};
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var k = x + "," + y, cls = "tile", isRoadC = cols[x], isRoadR = rows[y];
      if (water[k]) cls += " water";
      else if (isRoadC && isRoadR) cls += " road x";
      else if (isRoadC) cls += " road";
      else if (isRoadR) cls += " road h";
      else if (park[k]) cls += " park";
      else if (lot[k]) cls += " lot";
      if (spec.tileCls && spec.tileCls[k]) cls += " " + spec.tileCls[k];
      html.push('<div class="' + cls + '" data-at="' + k + '" style="left:' + (x * T + 3) + 'px;top:' + (y * T + 3) + 'px;width:' + (T - 6) + 'px;height:' + (T - 6) + 'px"></div>');
      var free = !water[k] && !isRoadC && !isRoadR && !park[k] && !lot[k];
      if (!blds[k] && spec.fill && free) {
        var d = Math.hypot(x - n / 2 + .5, y - n / 2 + .5) / (n / 1.4);
        blds[k] = { h: Math.round(26 + (1 - d) * 90 * (0.45 + r() * 0.8)), k: ["", "glass", "warm", "grey"][Math.floor(r() * 4)] };
      }
    }
    (spec.ov || []).forEach(function (o) {
      var p = o.at.split(",").map(Number), span = o.span || 1;
      html.push('<div class="ov ' + (o.cls || "") + '" style="inset:auto;left:' + (p[0] * T + 3) + 'px;top:' + (p[1] * T + 3) + 'px;width:' + (T * span - 6) + 'px;height:' + (T * span - 6) + 'px;' + (o.style || "") + '"></div>');
    });
    Object.keys(blds).forEach(function (k) {
      var b = blds[k]; if (!b) return;
      var p = k.split(",").map(Number), pad = b.pad === undefined ? T * 0.14 : b.pad, s = T - pad * 2;
      html.push('<div class="bld ' + (b.k || "") + ' ' + (b.cls || "") + '" data-at="' + k + '" style="left:' + (p[0] * T + pad) + 'px;top:' + (p[1] * T + pad) + 'px;width:' + s + 'px;height:' + s + 'px;--h:' + b.h + 'px;' + (b.style || "") + '">' +
        '<div class="f s win"></div><div class="f e win"></div><div class="f top">' + (b.roof || "") + '</div>' + (b.inner || "") + '</div>');
    });
    (spec.bb || []).forEach(function (o) {
      var p = o.at.split(",").map(Number);
      var bx = p[0] * T + T / 2 + (o.dx || 0), by = p[1] * T + T / 2 + (o.dy || 0);
      html.push('<div class="bb" style="left:' + bx + 'px;top:' + by + 'px;transform:translateZ(' + (o.z || 0) + 'px)"><div class="up">' + o.html + '</div></div>');
    });
    if (spec.ground) html.push(spec.ground);
    c.innerHTML = html.join("");
    el.appendChild(c);
    return c;
  }

  /* ---------- s05 transect chart (SVG polyline from real sampled brightness) ---------- */
  function transect(svg) {
    var T = window.EJ_TRANSECT; if (!T) return;
    var W = +svg.getAttribute("data-w"), H = +svg.getAttribute("data-h");
    var lo = Math.min.apply(null, T.trace), hi = Math.max.apply(null, T.trace);
    var pts = T.trace.map(function (v, i) {
      return (i / (T.trace.length - 1) * W).toFixed(1) + "," + (H - 10 - (v - lo) / (hi - lo) * (H - 20)).toFixed(1);
    }).join(" ");
    var line = svg.querySelector("polyline");
    line.setAttribute("points", pts);
  }

  function lengths() {                       // stroke lengths for line-draw reveals
    document.querySelectorAll("[data-len]").forEach(function (p) {
      try { p.style.setProperty("--len", Math.ceil(p.getTotalLength ? p.getTotalLength() : 1000) + 1); } catch (e) { }
      p.style.strokeDasharray = "var(--len)";
    });
  }

  window.EJ_BUILD = {
    rng: rng, h: h,
    init: function () {
      document.querySelectorAll(".stars[data-seed]").forEach(function (s) {
        stars(s, +s.getAttribute("data-seed"), +s.getAttribute("data-count"), +s.getAttribute("data-size"));
      });
      document.querySelectorAll("[data-echo]").forEach(echo);
      document.querySelectorAll("[data-soundring]").forEach(soundring);
      document.querySelectorAll("[data-split]").forEach(split);
      document.querySelectorAll("[data-marks]").forEach(marks);
      document.querySelectorAll("svg[data-transect]").forEach(transect);
      (window.EJ_CITIES || []).forEach(function (c) {
        var host = document.querySelector(c.host);
        if (host) city(host, c.spec);
      });
      document.querySelectorAll("[data-copy]").forEach(function (e) {
        var k = e.getAttribute("data-copy"), v = window.EJ_CONTENT[k];
        if (v) e.textContent = v;
      });
    },
    lengths: lengths
  };
})();
