// Earth Jukebox — automated verification in headless Chrome (DevTools Protocol, no deps).
// Checks: assets load from file://, audible playback clock vs audio stems (drift), scene
// boundaries, deterministic seeking (forward vs backward renders identical), end frames for
// both cuts, clean/reduced/solo modes, and missing-audio fallback.
// Usage: node tools/verify.mjs            (writes delivery/verification.json)
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import zlib from "node:zlib";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function browser() {
  const port = 9800 + Math.floor(Math.random() * 150);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ej-verify-"));
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1920,1256",
    "--autoplay-policy=no-user-gesture-required", "--no-first-run", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  let list;
  for (let i = 0; i < 80; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch { await sleep(150); } }
  const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const wait = new Map(); const errors = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); }
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === "Log.entryAdded" && d.params.entry.level === "error") errors.push(d.params.entry.text + " " + (d.params.entry.url || ""));
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1256, deviceScaleFactor: 1, mobile: false });
  return { send, ev, errors, close: () => { ws.close(); proc.kill(); } };
}
async function open(b, dir, q) {
  await b.send("Page.navigate", { url: pathToFileURL(path.join(dir, "index.html")).href + (q ? "?" + q : "") });
  for (let i = 0; i < 150; i++) { if (await b.ev("!!(window.EJ && EJ.ready)")) break; await sleep(100); }
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "ej-shots-"));
let shotN = 0;
const shot = async (b) => { const f = path.join(TMP, `s${shotN++}.png`); fs.writeFileSync(f, Buffer.from((await b.send("Page.captureScreenshot", { format: "png" })).result.data, "base64")); return f; };
function decodePNG(file) {     // minimal 8-bit RGB/RGBA PNG decoder (Chrome screenshots)
  const buf = fs.readFileSync(file); let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    if (type === "IDAT") idat.push(data);
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * bpp), stride = w * bpp;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  return out;
}
function maxDiff(a, b) {        // { max, mean, over3 } per-channel absolute difference, 0-255
  const x = decodePNG(a), y = decodePNG(b); let max = 0, sum = 0, over3 = 0;
  for (let i = 0; i < x.length; i++) { const d = Math.abs(x[i] - y[i]); sum += d; if (d > max) max = d; if (d > 3) over3++; }
  return { max, mean: +(sum / x.length).toFixed(5), over3 };
}

const report = { date: new Date().toISOString(), checks: [] };
const check = (name, ok, detail) => { report.checks.push({ name, ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  " + JSON.stringify(detail) : "")); };

// ---------- 1. normal preview: assets + audible playback drift ----------
{
  const b = await browser();
  await open(b, ROOT, "");
  for (let i = 0; i < 100; i++) { if (await b.ev("document.querySelectorAll('.loader li.ok').length") >= 7) break; await sleep(200); }
  const items = await b.ev("[...document.querySelectorAll('.loader li')].map(l => l.dataset.k + ':' + l.className)");
  check("all local assets load from file:// (fonts, images, reference mix, 4 stems)", items.every((s) => s.endsWith(":ok")), items);
  // default mode: one sample-locked mix element is the clock
  await b.ev("document.getElementById('go').click()"); await sleep(1500);
  const mm = [];
  for (let k = 0; k < 12; k++) { await sleep(200); mm.push(await b.ev(`new Promise(res => requestAnimationFrame(() => { const s = EJ._stems(); res({ mode: EJ._mode(), d: EJ.state.t - s.mix.currentTime, others: ['music','sono','sfx','vo'].filter(k => !s[k].paused).length }); }))`)); }
  await b.ev("EJ.pause()");
  check("default playback = reference mix only, visual clock within one frame of it", mm.every((x) => x.mode === "mix" && x.others === 0 && Math.abs(x.d) < 0.0334), { maxD: Math.max(...mm.map((x) => Math.abs(x.d))).toFixed(4) });
  await b.ev("EJ._forceStems(true)");
  const drifts = [];
  for (const start of [2, 60, 118, 170, 229]) {
    await b.ev(`EJ.seek(${start}).then(() => EJ.play())`);
    await sleep(700);
    for (let k = 0; k < 16; k++) {
      await sleep(180);
      const r = await b.ev(`new Promise(res => requestAnimationFrame(() => { const s = EJ._stems(); res({ t: EJ.state.t, m: s.music.currentTime, o: ['sono','sfx','vo'].map(k => s[k].currentTime), paused: s.music.paused }); }))`);
      if (r) drifts.push({ start, visualMinusMusic: +(r.t - r.m).toFixed(4), followerMax: +Math.max(...r.o.map((x) => Math.abs(x - r.m))).toFixed(4), paused: r.paused, t: +r.t.toFixed(3) });
    }
    await b.ev("EJ.pause()");
  }
  const maxV = Math.max(...drifts.map((d) => Math.abs(d.visualMinusMusic))), maxF = Math.max(...drifts.map((d) => d.followerMax));
  check("audio actually playing (music element not paused)", drifts.length > 0 && drifts.every((d) => !d.paused), { samples: drifts.length });
  check("stems mode: visual clock vs music stem within one frame (33 ms)", maxV <= 0.0334, { maxV });
  const fs_ = drifts.map((d) => d.followerMax).sort((a, b) => a - b), q = (p) => fs_[Math.min(fs_.length - 1, Math.floor(p * fs_.length))];
  check("stems mode (after a stem control is touched): followers bounded, median < 10 ms, max < 80 ms, no accumulating drift", q(0.5) < 0.01 && maxF < 0.08,
    { samples: fs_.length, median: q(0.5), p95: q(0.95), max: maxF });
  // judging cut switch loads its own music file and ends at 235
  await b.ev("EJ.setCut('judging')");
  await sleep(1500);
  const j = await b.ev("({ frames: EJ.frames(), src: EJ._stems().music.src.split('/').pop(), ready: EJ._stemOK().music })");
  check("judging cut: 7,050 frames, music-judging.wav loaded", j.frames === 7050 && j.src === "music-judging.wav" && j.ready === true, j);
  await b.ev("EJ.seek(234.9).then(() => EJ.play())");
  await sleep(1200);
  const end = await b.ev("({ t: EJ.state.t, playing: EJ.state.playing, scene: document.querySelector('.scene.on').id })");
  check("judging cut stops on its last frame (234.967 s, s07)", !end.playing && Math.abs(end.t - 7049 / 30) < 1e-6 && end.scene === "s07", end);
  check("no page errors (preview)", b.errors.length === 0, b.errors);
  b.close();
}

// ---------- 2. capture mode: boundaries, determinism, end frames, modes ----------
{
  const b = await browser();
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await open(b, ROOT, "capture=1&clean=1&captions=0");
  const bounds = [[0, "s01"], [25, "s02"], [50, "s03"], [95, "s04"], [150, "s05"], [185, "s06"], [215, "s07"], [235, "s08"]];
  const res = [];
  for (const [t, id] of bounds) {
    await b.ev(`EJ.seek(${t})`); const on = await b.ev("document.querySelector('.scene.on').id");
    let prev = null;
    if (t > 0) { await b.ev(`EJ.seek(${t} - 1/30)`); prev = await b.ev("document.querySelector('.scene.on').id"); }
    res.push({ t, expect: id, on, prevFrame: prev });
  }
  check("scene boundaries: start-inclusive, end-exclusive", res.every((r, i) => r.on === r.expect && (i === 0 || r.prevFrame === bounds[i - 1][1])), res);
  const times = [7.4, 19.9, 44.9, 64.5, 91.8, 106.5, 124.1, 131.5, 144.0, 170.0, 181.0, 202.3, 226.0, 233.5, 238.0];
  const fwd = {};
  for (const t of times) { await b.ev(`EJ.seek(${t})`); fwd[t] = await shot(b); }
  const mism = [];
  let worst = 0, worstMean = 0;
  for (const t of [...times].reverse()) {
    await b.ev("EJ.seek(239.9)"); await b.ev(`EJ.seek(${t})`);
    const d = maxDiff(fwd[t], await shot(b)); worst = Math.max(worst, d.max); worstMean = Math.max(worstMean, d.mean);
    if (d.over3 > 200) mism.push({ t, ...d });
  }
  check("deterministic seeking: backward seek reproduces forward frame (fewer than 200 channel values differ by more than 3/255)", mism.length === 0, { frames: times.length, worstPixel: worst, worstMean, mismatches: mism });
  await b.ev("EJ.seek(1000)");
  const last = await b.ev("({ t: EJ.state.t, f: Math.round(EJ.state.t * 30), scene: document.querySelector('.scene.on').id, frames: EJ.frames() })");
  check("master: 7,200 frames, last frame 7199 on s08", last.frames === 7200 && last.f === 7199 && last.scene === "s08", last);
  const fonts = await b.ev("['400','500','700'].every(w => document.fonts.check(w + \" 40px 'Roboto Mono'\"))");
  const family = await b.ev("getComputedStyle(document.querySelector('.stage .title')).fontFamily");
  check("Roboto Mono 400/500/700 loaded locally", fonts && family.includes("Roboto Mono"), { family });
  const imgs = await b.ev("[...document.querySelectorAll('.stage img')].map(i => i.getAttribute('src')).filter((v, i, a) => a.indexOf(v) === i)");
  check("stage images all come from image/", imgs.every((s) => s.startsWith("image/")), imgs);
  const trans = await b.ev("[...document.querySelectorAll('.stage *')].filter(e => getComputedStyle(e).transitionDuration.split(',').some(d => parseFloat(d) > 0)).length");
  check("no wall-clock CSS transitions on the stage", trans === 0, { count: trans });
  const safe = await b.ev(`(() => { const out = []; for (const t of [17, 32, 38.5, 64.5, 91.8, 113.5, 144, 161.5, 170, 181, 190.5, 204.5, 221.5, 228.9, 234]) {
      EJ.renderAt(t); const sc = document.querySelector('.scene.on');
      for (const e of sc.querySelectorAll('.title, .hero, .h2, .label, .note, .tag, .kicker, .chip, .panel, .lane, .fix, .hud .cell, .goal, .opt, .ctl, .eq, .member, .lockup > *')) {
        const cs = getComputedStyle(e); let r = e.getBoundingClientRect();
        if (cs.textAlign === 'center' || cs.textAlign === 'right' || e.classList.contains('abs')) { const rg = document.createRange(); rg.selectNodeContents(e); const rr = rg.getBoundingClientRect(); if (rr.width) r = rr; }
        if (r.width === 0 || cs.visibility === 'hidden') continue;
        let o = 1, p = e; while (p && p !== document.body) { o *= +getComputedStyle(p).opacity; p = p.parentElement; }
        if (o < .5) continue;
        if (r.left < 95.5 || r.right > 1824.5 || r.top < 53.5 || r.bottom > 1026.5) out.push({ t, cls: e.className.slice(0, 30), l: Math.round(r.left), r: Math.round(r.right), tp: Math.round(r.top), b: Math.round(r.bottom) });
      } } return out; })()`);
  check("critical text/cards inside the 96/54 px safe area", safe.length === 0, safe.slice(0, 12));
  const small = await b.ev(`(() => { const out = new Set(); for (const t of [17, 38.5, 64.5, 91.8, 113.5, 144, 161.5, 181, 204.5, 221.5, 238]) { EJ.renderAt(t);
      for (const e of document.querySelectorAll('.scene.on *')) { if (!e.childNodes.length || ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        const r = e.getBoundingClientRect(); if (!r.width) continue; const fs = parseFloat(getComputedStyle(e).fontSize);
        let sc = 1, p = e; while (p && p !== document.body) { const m = getComputedStyle(p).scale; if (m && m !== 'none') sc *= parseFloat(m); p = p.parentElement; }
        let o = 1, q = e; while (q && q !== document.body) { o *= +getComputedStyle(q).opacity; q = q.parentElement; }
        if (o > .5 && fs * sc < 23.5 && !e.closest('.echo') && !e.closest('.city')) out.add(t + ':' + e.className.slice(0, 24) + ':' + e.textContent.trim().slice(0, 24) + ':' + (fs * sc).toFixed(1)); } } return [...out]; })()`);
  check("on-screen text at least 24 px (excluding Echo/city decoration)", small.length === 0, small.slice(0, 12));
  check("no page errors (capture)", b.errors.length === 0, b.errors);
  b.close();
}

// ---------- 3. reduced motion + solo + transparent ----------
{
  const b = await browser();
  await b.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await open(b, ROOT, "capture=1&clean=1&reduced=1");
  await b.ev("EJ.seek(7)"); const loops = await b.ev("document.querySelector('.scene.on').getAnimations({subtree:true}).filter(a => a.effect.getComputedTiming().iterations === Infinity).length");
  check("reduced-motion preview removes ambient loops", loops === 0, { infiniteLoops: loops });
  await open(b, ROOT, "capture=1&clean=1&solo=echo&bg=transparent");
  await b.ev("EJ.seek(7)");
  const vis = await b.ev("[...document.querySelectorAll('.scene.on *')].filter(e => getComputedStyle(e).visibility === 'visible' && e.getBoundingClientRect().width > 0 && !e.closest('.echo')).length");
  check("solo=echo hides every non-Echo element", vis === 0, { visibleOthers: vis });
  b.close();
}

// ---------- 4. missing audio: copy the package without audio/ ----------
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ej-noaudio-"));
  for (const d of ["css", "js", "fonts", "image"]) fs.cpSync(path.join(ROOT, d), path.join(tmp, d), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "index.html"), path.join(tmp, "index.html"));
  const b = await browser();
  await open(b, tmp, "");
  await sleep(2500);
  const st = await b.ev("({ status: document.getElementById('status').textContent, cls: document.getElementById('status').className, items: [...document.querySelectorAll('.loader li')].map(l => l.dataset.k + ':' + l.className) })");
  await b.ev("document.getElementById('go').click()"); await sleep(1500);
  const t = await b.ev("EJ.state.t");
  check("missing audio: visible error, silent clock still plays", st.cls.includes("err") && t > 0.8, { ...st, tAfter1_5s: t });
  b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

const ok = report.checks.every((c) => c.ok);
fs.mkdirSync(path.join(ROOT, "delivery"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "delivery", "verification.json"), JSON.stringify(report, null, 1));
console.log(ok ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
process.exit(ok ? 0 : 1);
