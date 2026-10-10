"""Measure audio onsets in the rendered stems at key picture cues (Earth Jukebox QA).
Each cue is an event the picture animates at the same timeline second. Reports the
detected onset offset in ms; pass = within one 30 fps frame (33.3 ms)."""
import json, pathlib
import numpy as np
from scipy.io import wavfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SR = 48000
CUES = [  # (stem, time, what the picture does at that moment)
    ("sfx", 0.625, "signal ring s01"), ("sfx", 5.0, "Echo lands + ring"), ("sfx", 15.0, "GUARDIAN WANTED card flips in"),
    ("sfx", 46.25, "name field turns green"), ("sfx", 54.6, "tree pops on tapped tile"), ("sfx", 93.75, "GAME UNLOCKED pops"),
    ("sfx", 107.6, "FOUND reticle"), ("sfx", 121.25, "first coin lands"), ("sfx", 110.0, "countdown starts (0:20)"), ("sfx", 129.0, "last countdown tick (0:01)"),
    ("sfx", 203.75, "EXAMPLE stamp"),
    ("music-low", 130.0, "impact boom (sub band)"), ("music-low", 232.5, "final cadence boom (sub band)"),
    ("sonification", 59.0, "first heat-melody mark"), ("sonification", 68.0, "first rain-drum mark"),
    ("sonification", 73.0, "first greenery chord mark"), ("sonification", 178.0, "scan starts at frame edge"),
]
out, stems = [], {}
for stem, t, what in CUES:
    name = {"sfx": "sfx", "music-low": "music-master", "sonification": "sonification"}[stem]
    key = stem
    if key not in stems:
        sr, x = wavfile.read(ROOT / "audio" / f"{name}.wav")
        x = x.astype(np.float32).mean(axis=1) / 32768
        if stem == "music-low":                      # isolate the boom from the riser (20-90 Hz)
            from scipy import signal
            x = signal.sosfilt(signal.butter(4, [20, 90], "band", fs=SR, output="sos"), x)
        stems[key] = np.abs(x)
    a = stems[key]
    i0, i1 = int((t - 0.2) * SR), int((t + 0.2) * SR)
    seg = a[i0:i1]
    env = np.convolve(seg, np.ones(48) / 48, mode="same")            # 1 ms envelope
    pre = env[: int(0.15 * SR)]
    floor = float(np.percentile(pre, 95)) if len(pre) else 0
    peak = float(env.max())
    thr = floor + 0.2 * (peak - floor)
    k = int(np.argmax(env[int(0.1 * SR):] > thr)) + int(0.1 * SR)
    onset = (i0 + k) / SR
    out.append(dict(stem=stem, cue=t, picture=what, onset=round(onset, 4), offset_ms=round((onset - t) * 1000, 1)))
ok = all(abs(o["offset_ms"]) <= 33.3 for o in out)
for o in out:
    print(f"{'PASS' if abs(o['offset_ms']) <= 33.3 else 'FAIL'} {o['stem']:13s} {o['cue']:7.3f}s  {o['offset_ms']:+6.1f} ms  {o['picture']}")
(ROOT / "delivery" / "sync-check.json").write_text(json.dumps(dict(pass_=ok, cues=out), indent=1))
print("ALL CUES WITHIN ONE FRAME" if ok else "SOME CUES OUTSIDE ONE FRAME")
