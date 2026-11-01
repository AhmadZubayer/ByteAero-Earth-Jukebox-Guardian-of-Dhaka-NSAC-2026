// Earth Jukebox — frame-accurate capture via headless Chrome (DevTools Protocol, no npm deps).
//
// Each frame is rendered by seeking the page's deterministic clock (EJ.seek) and taking a
// screenshot, so the output is exactly 30 fps regardless of machine speed. Requires Node 22+
// (built-in WebSocket) and Google Chrome or Microsoft Edge. ffmpeg is needed only for --video.
//
// Examples (run from the project folder):
//   node tools/capture.mjs --times 0,15,60.5 --out delivery/stills          # review stills
//   node tools/capture.mjs --scene s04 --handles 2 --out delivery/frames/s04 # PNG sequence
//   node tools/capture.mjs --scene s01 --solo echo --alpha --out delivery/frames/echo-alpha
//   node tools/capture.mjs --cut master --video delivery/video/master_1920x1080_30fps.mp4          (PNG frames, lossless into x264)
//   node tools/capture.mjs --cut judging --jpeg --video delivery/video/judging_1920x1080_30fps.mp4 (faster)
// Options: --from/--to seconds, --every N (stills every N s), --captions 0|1 (default 0), --noaudio,
//          --bg space|black|green|transparent, --jpeg (smaller review stills), --chrome PATH
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => {
  if (v.startsWith("--")) a.push([v.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "1"]);
  return a;
}, []));
const FPS = 30;
const cut = args.cut === "judging" ? "judging" : "master";
const DUR = cut === "judging" ? 235 : 240;
const SCENES = { s01: [0, 25], s02: [25, 50], s03: [50, 95], s04: [95, 150], s05: [150, 185], s06: [185, 215], s07: [215, 235], s08: [235, 240] };

function findChrome() {
  if (args.chrome) return args.chrome;
  const c = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium"];
  const f = c.find((p) => fs.existsSync(p));
  if (!f) throw new Error("Chrome/Edge not found; pass --chrome PATH");
  return f;
}

// ---- which frames ----
let frames = [];
if (args.times) frames = args.times.split(",").map((t) => Math.round(+t * FPS));
else {
  let a = 0, b = DUR;
  if (args.scene) { [a, b] = SCENES[args.scene]; const hd = +(args.handles || 0); a = Math.max(0, a - hd); b = Math.min(DUR, b + hd); }
  if (args.from) a = +args.from;
  if (args.to) b = Math.min(DUR, +args.to);
  const step = args.every ? Math.round(+args.every * FPS) : 1;
  for (let f = Math.round(a * FPS); f < Math.round(b * FPS); f += step) frames.push(f);
}
const out = args.video ? null : path.resolve(ROOT, args.out || "delivery/stills");
if (out) fs.mkdirSync(out, { recursive: true });
let enc = null;                              // --video: frames stream straight into ffmpeg (no frame files)
if (args.video) {
  const first = frames[0], mix = path.join(ROOT, "delivery", "audio", `mix-${cut}.wav`);
  const vid = path.resolve(ROOT, args.video); fs.mkdirSync(path.dirname(vid), { recursive: true });
  const ff = ["-y", "-v", "error", "-f", "image2pipe", "-framerate", "30", "-c:v", args.jpeg ? "mjpeg" : "png", "-i", "-"];
  if (fs.existsSync(mix) && !args.noaudio) ff.push("-ss", (first / FPS).toFixed(4), "-t", (frames.length / FPS).toFixed(4), "-i", mix, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "320k");
  ff.push("-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", "-r", "30", "-fps_mode", "cfr", "-movflags", "+faststart", vid);
  enc = spawn("ffmpeg", ff, { stdio: ["pipe", "inherit", "inherit"] });
  enc.done = new Promise((r) => enc.on("close", r));
  enc.vid = vid;
}
const ext = args.jpeg ? "jpg" : "png";

// ---- launch browser ----
const port = 9300 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ej-chrome-"));
const chrome = spawn(findChrome(), [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  "--window-size=1920,1080", "--hide-scrollbars", "--mute-audio", "--no-first-run",
  "--allow-file-access-from-files", "--force-device-scale-factor=1", "about:blank"], { stdio: "ignore" });

async function getJSON(u) { for (let i = 0; i < 80; i++) { try { return await (await fetch(u)).json(); } catch { await new Promise((r) => setTimeout(r, 150)); } } throw new Error("DevTools not reachable"); }
const targets = await getJSON(`http://127.0.0.1:${port}/json/list`);
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0; const pending = new Map(); const errors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.j(new Error(d.error.message)) : p.r(d.result); }
  else if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  else if (d.method === "Runtime.consoleAPICalled" && (d.params.type === "error" || d.params.type === "warning")) errors.push(d.params.args.map((a) => a.value ?? a.description).join(" "));
  else if (d.method === "Log.entryAdded" && d.params.entry.level === "error") errors.push(d.params.entry.text + " " + (d.params.entry.url || ""));
};
const send = (method, params = {}) => new Promise((r, j) => { const id = ++seq; pending.set(id, { r, j }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
const bg = args.alpha ? "transparent" : (args.bg || "space");
if (args.alpha) await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
const q = new URLSearchParams({ capture: "1", clean: "1", cut, bg, captions: args.captions === "1" ? "1" : "0" });
if (args.solo) q.set("solo", args.solo);
if (args.reduced) q.set("reduced", "1");
const url = pathToFileURL(path.join(ROOT, "index.html")).href + "?" + q;
await send("Page.navigate", { url });
for (let i = 0; i < 200; i++) { if (await evaluate("!!(window.EJ && window.EJ.ready)").catch(() => false)) break; await new Promise((r) => setTimeout(r, 100)); }
if (args.alpha) await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
const fontsOK = await evaluate("document.fonts.check(\"700 40px 'Home Video'\") && document.fonts.check(\"400 40px 'Home Video'\") && document.fonts.check(\"500 40px 'Home Video'\")");

const t0 = Date.now();
for (let i = 0; i < frames.length; i++) {
  const f = frames[i];
  await evaluate(`EJ.seek(${f} / ${FPS})`);
  const shot = await send("Page.captureScreenshot", args.jpeg ? { format: "jpeg", quality: args.video ? 95 : 88 } : { format: "png" });
  const bytes = Buffer.from(shot.data, "base64");
  if (enc) { if (!enc.stdin.write(bytes)) await new Promise((r) => enc.stdin.once("drain", r)); }
  else {
    const name = args.times || args.every ? `${cut}_t${(f / FPS).toFixed(2).padStart(6, "0")}_f${String(f).padStart(4, "0")}.${ext}` : `frame_${String(f).padStart(5, "0")}.${ext}`;
    fs.writeFileSync(path.join(out, name), bytes);
  }
  if (i % 150 === 0 && frames.length > 20) process.stdout.write(`  ${i}/${frames.length} frames (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
}
ws.close(); chrome.kill();
console.log(JSON.stringify({ frames: frames.length, out, fontsOK, errors }, null, 1));

if (enc) {
  enc.stdin.end();
  const code = await enc.done;
  console.log(code === 0 ? "video written: " + enc.vid : "ffmpeg failed (" + code + ")");
}
