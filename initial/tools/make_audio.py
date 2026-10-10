"""Earth Jukebox - audio build: original score, sonification, effects, guide VO, mixes.

Everything is synthesised here from scratch (no samples, loops or third-party audio), so the
score is an original work made for this project. Cue times come from js/timeline.js and
js/content.js via tools/dump-timeline.js (audio/src/timeline.json), so picture and sound
share one set of numbers.

Outputs (48 kHz, 16-bit stereo WAV, all starting at timeline zero):
  audio/music-master.wav     240 s score, cadence at 232.5 s, tail to silence by 240 s
  audio/music-judging.wav    235 s score, same cadence, completed decay by 235 s
  audio/sonification.wav     educational sound mappings only (heat/rain/greenery/scan)
  audio/sfx.wav              UI and story effects
  audio/vo-guide-TEMP.wav    TEMPORARY text-to-speech timing guide (not a performance)
  delivery/audio/mix-master.wav, mix-judging.wav   reference mixes
  delivery/captions/*.srt, delivery/cue-sheet.csv, audio/src/build-report.json
Run: tools/build-audio.cmd  (or: node tools/dump-timeline.js > audio/src/timeline.json && python tools/make_audio.py)
"""
import json
import math
import pathlib
import re
import subprocess
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SR = 48000
DUR = 240.0
N = int(SR * (DUR + 1.0))
rng = np.random.default_rng(20260929)

J = json.loads((ROOT / "audio" / "src" / "timeline.json").read_text(encoding="utf-8"))
TL, CONTENT = J["timeline"], J["content"]
BEAT, BAR = TL["beat"], TL["bar"]
CAPS = CONTENT["captions"]


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def pan_gains(p):
    a = (p + 1) * math.pi / 4
    return math.cos(a), math.sin(a)


class Bus:
    def __init__(self):
        self.x = np.zeros((2, N), np.float32)

    def add(self, sig, t, pan=0.0, gain=1.0):
        i0 = int(round(t * SR))
        if i0 >= N:
            return
        if i0 < 0:
            sig = sig[-i0:]
            i0 = 0
        n = min(len(sig), N - i0)
        gl, gr = pan_gains(pan)
        self.x[0, i0:i0 + n] += (sig[:n] * gain * gl).astype(np.float32)
        self.x[1, i0:i0 + n] += (sig[:n] * gain * gr).astype(np.float32)


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR * 0.45) / (SR / 2))
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def env_ar(n, att, rel_start, rel):
    t = tt(n)
    e = np.clip(t / max(att, 1e-4), 0, 1)
    e = np.where(t > rel_start, e * np.clip(1 - (t - rel_start) / max(rel, 1e-4), 0, 1), e)
    return e


def expdec(n, tau, att=0.003):
    t = tt(n)
    return np.clip(t / att, 0, 1) * np.exp(-t / tau)


def saw(f, n, ph=None):
    ph = rng.random() if ph is None else ph
    p = (ph + f * tt(n)) % 1.0
    return 2 * p - 1


# ------------------------------------------------------------------ control envelopes
CT = np.arange(0, DUR + 1, 0.01)          # 100 Hz control rate


def smooth_env(raw, att=0.15, rel=0.4):
    """One-pole smoothing with different up/down speeds (samples at 100 Hz)."""
    out = np.empty_like(raw)
    v = raw[0]
    ka, kr = 1 - math.exp(-0.01 / att), 1 - math.exp(-0.01 / rel)
    for i, r in enumerate(raw):
        v += (r - v) * (ka if r < v else kr)
        out[i] = v
    return out


def build_ducks():
    vo = np.ones_like(CT)
    for c in CAPS:
        vo[(CT >= c["start"] - 0.1) & (CT < c["end"] + 0.15)] = 0.5
    layers = {k: np.ones_like(CT) for k in ["pad", "mel", "bass", "drums", "fx"]}
    rules = {
        "heat":  dict(mel=0.04, pad=0.55, drums=0.55, bass=0.8),
        "rain":  dict(drums=0.0, pad=0.6, mel=0.35, bass=0.7),
        "green": dict(pad=0.3, mel=0.08, drums=0.4, bass=0.6),
        "light": dict(pad=0.6, mel=0.45, drums=0.5, bass=0.7),
        "quiet": dict(pad=0.35, mel=0.08, drums=0.0, bass=0.4, fx=0.5),
    }
    for w in TL["teach"]:
        m = (CT >= w["from"]) & (CT < w["to"])
        for k, g in rules[w["mode"]].items():
            layers[k][m] = np.minimum(layers[k][m], g)
    out = {}
    for k, v in layers.items():
        out[k] = smooth_env(v * vo, 0.12, 0.45)
    return out


DUCK = build_ducks()


def duck(layer, t0, n):
    ts = t0 + tt(n)
    return np.interp(ts, CT, DUCK[layer])


# ------------------------------------------------------------------ score plan
CH = {  # pad voicings, bass root (MIDI)
    "Dm": ([62, 65, 69, 72], 38), "Bb": ([58, 62, 65, 69], 34), "F": ([57, 60, 65, 67], 41),
    "C": ([55, 60, 64, 67], 36), "Gm": ([55, 58, 62, 65], 43), "A": ([57, 61, 64, 69], 33),
    "Dc": ([60, 62, 65, 69], 36), "D": ([62, 66, 69, 76], 38),
}
PROG = (["Dm"] * 3 + ["Bb", "F", "C", "Dm", "Bb", "F", "C"] +                 # s01 0-9
        ["Dm", "Bb", "F", "C", "Dm", "Bb", "F", "C", "Gm", "A"] +              # s02 10-19
        ["Dm", "Bb", "F", "Dm", "Dm", "Bb", "Bb", "F", "F", "Bb", "C", "Dm", "Bb", "C", "Dm", "Dm", "Bb", "A"] +  # s03 20-37
        ["Dm", "Bb", "C", "Dm", "Dm", "Bb", "Dm", "Dc", "Bb", "A", "Dm", "Dc", "Bb", "A", "Dm", "Bb", "A",
         "F", "C", "Dm", "Bb", "C"] +                                            # s04 38-59
        ["Bb", "F", "Gm", "Dm", "Bb", "F", "C", "Dm", "Gm", "Bb", "Bb", "Dm", "Dm", "A"] +  # s05 60-73
        ["Bb", "F", "C", "Dm", "Bb", "C", "F", "F", "Bb", "C", "Dm", "C"] +     # s06 74-85
        ["Dm", "Bb", "F", "C", "Dm", "Bb", "C", "D", "D", "D"])                 # s07 86-93, tail 94-95
assert len(PROG) == 96, len(PROG)


def bars(*ranges):
    s = set()
    for r in ranges:
        a, b = (r, r) if isinstance(r, int) else r
        s.update(range(a, b + 1))
    return s


ARP = bars((10, 19), (20, 22), (31, 33), (38, 40), (44, 51), (55, 59), (76, 85), (86, 91))
BASS_PULSE = bars((6, 9), (10, 19), (20, 22), (38, 40), (44, 51), (76, 85), (88, 91))
BASS_HOLD = bars((2, 5), (23, 37), (41, 43), (52, 59), (60, 73), (86, 87), (92, 93))
KICK4 = bars((44, 51), (80, 85), (88, 91))
KICK2 = bars((6, 9), (10, 19), (20, 22), (38, 40), (52, 54), (76, 79))
HATS = bars((10, 19), (20, 22), (38, 40), (44, 51), (76, 85), (88, 91))
SNARE = bars((14, 19), (44, 51), (80, 85), (88, 91))
BRIGHT = bars((74, 95))
LOUD = {**{b: 0.55 for b in range(0, 6)}, **{b: 0.8 for b in range(6, 20)}, **{b: 0.8 for b in range(20, 38)},
        **{b: 0.85 for b in range(38, 60)}, **{b: 0.6 for b in range(60, 74)}, **{b: 0.95 for b in range(74, 86)},
        **{b: 0.85 for b in range(86, 96)}}
LOUD.update({b: 1.0 for b in range(44, 52)})

music = Bus()
verb = Bus()      # reverb send


def add_m(sig, t, pan, gain, layer, send):
    sig = sig * duck(layer, t, len(sig))
    music.add(sig, t, pan, gain)
    if send:
        verb.add(sig, t, pan, gain * send)


def pad_chord(notes, t0, dur, amp, bright):
    n = int((dur + 1.6) * SR)
    e = env_ar(n, 0.9, dur, 1.6)
    for m in notes:
        f = mtof(m)
        for det, p in ((-7, -0.55), (0, 0.0), (7, 0.55)):
            s = saw(f * 2 ** (det / 1200), n) * 0.6 + np.sin(2 * np.pi * f / 2 * tt(n)) * 0.25
            s = lp(s, 900 + 1500 * bright) * e
            add_m(s, t0, p, amp * 0.055, "pad", 0.45)


def pluck(f, n, tau=0.2):
    x = tt(n)
    s = np.sin(2 * np.pi * f * x) + 0.35 * np.sin(4 * np.pi * f * x) + 0.12 * np.sin(6 * np.pi * f * x)
    return s * expdec(n, tau, 0.002)


def bell(f, n, tau=1.2, ratio=3.5, index=2.2):
    x = tt(n)
    mod = index * np.exp(-x / (tau * 0.35)) * np.sin(2 * np.pi * f * ratio * x)
    return np.sin(2 * np.pi * f * x + mod) * expdec(n, tau, 0.004)


def kick(n=int(0.5 * SR)):
    x = tt(n)
    f = 46 + 90 * np.exp(-x / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.tanh(1.6 * np.sin(ph) * np.exp(-x / 0.32)) + 0.2 * rng.standard_normal(n) * np.exp(-x / 0.004)


def snare(n=int(0.35 * SR)):
    x = tt(n)
    return bp(rng.standard_normal(n), 900, 7000) * np.exp(-x / 0.11) * 0.8 + np.sin(2 * np.pi * 190 * x) * np.exp(-x / 0.07) * 0.5


def hat(n=int(0.09 * SR), tau=0.028):
    return hp(rng.standard_normal(n), 7000) * expdec(n, tau, 0.001)


def tom(f0, n=int(0.5 * SR)):
    x = tt(n)
    f = f0 * (1 + 0.5 * np.exp(-x / 0.05))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.25)


def boom(n=int(3.5 * SR)):
    x = tt(n)
    f = 30 + 45 * np.exp(-x / 0.5)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 1.1)
    s += lp(rng.standard_normal(n), 1800) * np.exp(-x / 0.25) * 0.5
    return np.tanh(1.3 * s)


def crash(n=int(3 * SR)):
    x = tt(n)
    s = hp(rng.standard_normal(n), 4500) * 0.6
    for f in (3170, 4230, 5710, 7350, 8900):
        s += 0.08 * np.sin(2 * np.pi * f * x + rng.random() * 6)
    return s * expdec(n, 1.1, 0.002)


def riser(dur):
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    blocks = 48
    L = n // blocks
    win = np.hanning(2 * L)
    for k in range(blocks - 1):
        a = k * L
        seg = noise[a:a + 2 * L]
        if len(seg) < 2 * L:
            break
        fc = 250 * (32 ** (k / blocks))
        out[a:a + 2 * L] += bp(seg, fc * 0.7, fc * 1.4) * win
    x = tt(n) / dur
    sweep = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (x * 2)) / SR) * 0.25
    return (out * 1.2 + sweep) * (x ** 2.2)


def echo_motif(t, amp=1.0, reply=False):
    """Echo's original two-note call: rising fourth A5 -> D6 with a soft glide."""
    notes = [(81, 0.0, 0.28), (86, 0.3125, 0.9)] if not reply else [(86, 0.0, 0.25), (81, 0.3125, 0.25), (86, 0.625, 1.2)]
    for m, dt, d in notes:
        n = int((d + 1.0) * SR)
        f = mtof(m)
        x = tt(n)
        fcur = f * (1 - 0.03 * np.exp(-x / 0.03))
        s = np.sin(2 * np.pi * np.cumsum(fcur) / SR) * 0.8 + bell(f, n, 0.9, 2.0, 1.2) * 0.5
        s *= env_ar(n, 0.01, d, 0.6)
        add_m(s, t + dt, 0.15, amp * 0.16, "fx", 0.5)


def render_score():
    for b, name in enumerate(PROG):
        t0 = b * BAR
        notes, root = CH[name]
        loud = LOUD[b]
        # pad: one chord per bar (tail bars sustain the final chord)
        if b <= 93:
            dur = BAR if b < 93 else BAR * 2.9
            pad_chord(notes, t0, dur, loud * (0.4 if b < 1 else 1.0), 1.0 if b in BRIGHT else 0.35)
        # bass
        if b in BASS_PULSE:
            for k in range(8):
                n = int(0.32 * SR)
                f = mtof(root)
                x = tt(n)
                s = np.tanh(1.4 * (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(4 * np.pi * f * x))) * expdec(n, 0.2, 0.004)
                add_m(s, t0 + k * BEAT / 2, 0, loud * (0.2 if k % 2 == 0 else 0.13), "bass", 0.05)
        elif b in BASS_HOLD and b <= 93:
            n = int((BAR + 0.8) * SR)
            f = mtof(root)
            s = np.sin(2 * np.pi * f * tt(n)) * env_ar(n, 0.4, BAR, 0.8)
            add_m(s, t0, 0, loud * 0.16, "bass", 0.0)
        # arpeggio (sixteenths through the chord)
        if b in ARP:
            seq = notes + [m + 12 for m in notes]
            order = [0, 2, 1, 3, 4, 6, 5, 7, 6, 4, 5, 3, 2, 4, 1, 3]
            for k in range(16):
                m = seq[order[k] % len(seq)]
                n = int(0.5 * SR)
                s = pluck(mtof(m + 12 if b in BRIGHT else m), n, 0.16)
                p = -0.35 if k % 2 else 0.35
                g = loud * 0.05 * (1.2 if k % 4 == 0 else 1)
                add_m(s, t0 + k * BEAT / 4, p, g, "mel", 0.3)
                add_m(s * 0.3, t0 + k * BEAT / 4 + BEAT * 0.75, -p, g, "mel", 0.2)   # dotted-eighth echo
        # drums
        for k in range(4):
            tb = t0 + k * BEAT
            if b in KICK4 or (b in KICK2 and k in (0, 2)):
                add_m(kick(), tb, 0, loud * 0.42, "drums", 0.04)
            if b in SNARE and k in (1, 3):
                add_m(snare(), tb, 0.05, loud * 0.16, "drums", 0.18)
            if b in HATS:
                subs = 4 if b in bars((44, 51)) else 2
                for j in range(subs):
                    add_m(hat(), tb + j * BEAT / subs, 0.3, loud * (0.06 if j % 2 else 0.045), "drums", 0.02)
        if b in bars((48, 51)) and True:          # tom fills build the protection countdown
            for j, f0 in enumerate([98, 110, 123, 147]):
                add_m(tom(f0), t0 + BAR - BEAT + j * BEAT / 4, -0.3 + j * 0.2, 0.12 * (b - 47) / 4, "drums", 0.15)

    # sustained low drone (D) under the whole piece; fades out for the tail
    n = int(DUR * SR)
    x = tt(n)
    drone = (saw(mtof(38), n) * 0.5 + saw(mtof(38) * 1.003, n) * 0.5)
    drone = lp(drone, 260) + np.sin(2 * np.pi * mtof(26) * x) * 0.5
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * x / (BAR * 4))
    shape = np.interp(x, [0, 2.5, 5, 230, 236, 239.8, 240], [0, 0.35, 1, 1, 0.7, 0, 0])
    music.add((drone * lfo * shape * 0.07).astype(np.float32), 0, 0, 1.0)

    # opening shimmer and tail shimmer
    for t0, t1 in ((0.0, 15.0), (228.0, 240.0)):
        n = int((t1 - t0) * SR)
        x = tt(n)
        s = sum(np.sin(2 * np.pi * mtof(m) * x + i) * 0.3 for i, m in enumerate([86, 93, 98]))
        s *= (0.6 + 0.4 * np.sin(2 * np.pi * 0.4 * x)) * np.interp(x, [0, 2, (t1 - t0) - 3, t1 - t0], [0, 1, 1, 0])
        add_m(s, t0, 0, 0.018, "fx", 0.8)

    # transitions: risers into boundaries, booms + crashes on the downbeat
    for w in [15.0, 25.0, 50.0, 95.0, 110.0, 130.0, 150.0, 185.0, 215.0]:
        d = 2.5 if w in (15.0, 130.0) else 1.8
        add_m(riser(d), w - d, 0, 0.12 if w != 130.0 else 0.2, "fx", 0.3)
    for w, g in [(15.0, 0.5), (25.0, 0.35), (50.0, 0.3), (95.0, 0.4), (130.0, 0.55), (150.0, 0.3), (185.0, 0.35), (215.0, 0.35), (232.5, 0.55)]:
        add_m(boom(), w, 0, g, "fx", 0.35)
        add_m(crash(), w, 0.1, g * 0.22, "fx", 0.3)
    # Echo's motif: arrival, pass reveal, final invitation
    echo_motif(5.0, 1.0)
    echo_motif(197.5, 0.9)
    echo_motif(230.0, 0.9, reply=True)
    echo_motif(236.25, 0.5)


def reverb_ir(seconds=3.4, decay=2.9):
    n = int(seconds * SR)
    x = tt(n)
    irs = []
    for ch in range(2):
        noise = rng.standard_normal(n) * np.exp(-x * 6.9 / decay)
        noise = lp(noise, 5200)
        noise[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        irs.append(noise / np.sqrt(np.sum(noise ** 2)) * 0.9)
    return irs


def apply_reverb(dry, send):
    ir = reverb_ir()
    wet = np.stack([signal.oaconvolve(send.x[c], ir[c])[:N] for c in range(2)])
    return dry.x + wet.astype(np.float32)


# ------------------------------------------------------------------ sonification
sono = Bus()
sverb = Bus()


def s_add(sig, t, pan, gain, send=0.25):
    sono.add(sig, t, pan, gain)
    sverb.add(sig, t, pan, gain * send)


def heat_note(e):
    """Heat = melody. Reedy pulse lead; brighter and sharper as heat rises."""
    f, d, sharp = mtof(e["m"]), e["d"], e["sharp"]
    n = int((d + 0.25) * SR)
    x = tt(n)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * x) * np.clip(x / 0.15, 0, 1)
    ph = np.cumsum(f * vib) / SR % 1.0
    duty = 0.42 - 0.3 * sharp
    s = np.where(ph < duty, 1.0, -1.0) - (2 * duty - 1)
    s = lp(s, 1600 + 5200 * sharp)
    return s * env_ar(n, 0.012, d, 0.18) * (0.9 + 0.4 * sharp)


def rain_hit(e):
    """Rain = drums. Hand-drum / tom with a skin slap (distinct from the score kit)."""
    n = int(0.38 * SR)
    x = tt(n)
    f = 150 * (1 + 0.6 * np.exp(-x / 0.03))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.16)
    s += bp(rng.standard_normal(n), 1200, 4200) * np.exp(-x / 0.025) * 0.55
    return s * e["v"]


def green_chord(e):
    """Greenery = soft chords. Warm FM electric-piano; detuned (out of tune) when greenery is low."""
    d = e["d"]
    n = int((d + 0.9) * SR)
    x = tt(n)
    out = np.zeros(n)
    for j, m in enumerate(e["notes"]):
        cents = e["detune"] * (1 if j % 2 else -1) * (0.6 + 0.4 * (j / 3))
        f = mtof(m + 12) * 2 ** (cents / 1200)
        mod = 1.1 * np.exp(-x / 0.5) * np.sin(2 * np.pi * f * x)
        out += np.sin(2 * np.pi * f * x + mod) * 0.3
    return out * env_ar(n, 0.03, d, 0.9) * np.exp(-x / 2.5)


def scan_tone(e):
    """Neutral glassy tone for the frame->sound demonstration (not a climate variable)."""
    n = int((e["d"] + 0.3) * SR)
    f = mtof(e["m"])
    x = tt(n)
    s = np.sin(2 * np.pi * f * x) + 0.25 * np.sin(2 * np.pi * 2 * f * x)
    return s * env_ar(n, 0.006, e["d"], 0.25)


def render_sono():
    for e in TL["sono"]:
        g, p = e.get("g", 0.8), e.get("pan", 0) or 0
        if e["k"] == "heat":
            s_add(heat_note(e), e["t"], p, g * 0.11, 0.2)
        elif e["k"] == "rain":
            s_add(rain_hit(e), e["t"], p, g * 0.3, 0.15)
        elif e["k"] == "green":
            s_add(green_chord(e), e["t"], p, g * 0.16, 0.35)
        elif e["k"] == "scan":
            s_add(scan_tone(e), e["t"], 0, g * 0.14, 0.3)


# ------------------------------------------------------------------ sound effects
sfx = Bus()
fverb = Bus()


def fx(kind):
    if kind == "ping":
        n = int(1.2 * SR); x = tt(n)
        s = (np.sin(2 * np.pi * 1318.5 * x) + 0.3 * np.sin(2 * np.pi * 2637 * x)) * expdec(n, 0.22)
        return s
    if kind == "beep":
        out = np.zeros(int(0.4 * SR))
        for a, f0, f1 in ((0.0, 900, 1400), (0.13, 1250, 1900)):
            n = int(0.1 * SR); x = tt(n)
            f = f0 + (f1 - f0) * x / 0.1
            s = np.sin(2 * np.pi * np.cumsum(f) / SR); s += 0.2 * np.sin(3 * 2 * np.pi * np.cumsum(f) / SR)
            i = int(a * SR); out[i:i + n] += s * env_ar(n, 0.005, 0.085, 0.015)
        return out
    if kind == "chirp":
        out = np.zeros(int(0.5 * SR))
        for k, (f0, f1) in enumerate(((1000, 1500), (1300, 1800), (1600, 2400))):
            n = int(0.07 * SR); x = tt(n)
            f = f0 + (f1 - f0) * x / 0.07
            i = int(k * 0.09 * SR); out[i:i + n] += np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ar(n, 0.004, 0.06, 0.01)
        return out
    if kind == "whoosh":
        n = int(0.9 * SR); x = tt(n) / 0.9
        noise = rng.standard_normal(n)
        s = np.zeros(n); blocks = 18; L = n // blocks; w = np.hanning(2 * L)
        for k in range(blocks - 1):
            fc = 300 * (10 ** (k / blocks))
            seg = noise[k * L:k * L + 2 * L]
            if len(seg) == 2 * L:
                s[k * L:k * L + 2 * L] += bp(seg, fc * 0.6, fc * 1.6) * w
        return s * np.sin(np.pi * np.clip(x * 0.55 + 0.02, 0, 1)) ** 2
    if kind == "card":
        n = int(0.4 * SR); x = tt(n)
        return np.sin(2 * np.pi * 95 * x) * np.exp(-x / 0.07) * 0.9 + bp(rng.standard_normal(n), 800, 5000) * np.exp(-x / 0.05) * 0.3
    if kind in ("tick", "clock"):
        n = int(0.06 * SR); x = tt(n)
        f = 2300 if kind == "tick" else 3100
        return np.sin(2 * np.pi * f * x) * np.exp(-x / 0.012) + rng.standard_normal(n) * np.exp(-x / 0.002) * 0.3
    if kind == "key":
        n = int(0.05 * SR); x = tt(n)
        return bp(rng.standard_normal(n), 1500, 6000) * np.exp(-x / 0.008) + np.sin(2 * np.pi * 1800 * x) * np.exp(-x / 0.004) * 0.4
    if kind == "enter":
        out = np.zeros(int(0.3 * SR))
        for k, f in enumerate((880, 1318.5)):
            n = int(0.1 * SR); i = int(k * 0.09 * SR)
            out[i:i + n] += np.sin(2 * np.pi * f * tt(n)) * env_ar(n, 0.004, 0.08, 0.02)
        return out
    if kind == "tap":
        n = int(0.2 * SR); x = tt(n)
        return np.sin(2 * np.pi * 180 * x) * np.exp(-x / 0.05) + rng.standard_normal(n) * np.exp(-x / 0.003) * 0.4
    if kind == "pop":
        n = int(0.25 * SR); x = tt(n)
        f = 300 + 700 * np.clip(x / 0.07, 0, 1)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * expdec(n, 0.08, 0.003)
    if kind == "coin":
        out = np.zeros(int(0.8 * SR))
        for k, f in enumerate((2637, 3951)):
            n = int(0.6 * SR); i = int(k * 0.06 * SR)
            out[i:i + n] += bell(f, n, 0.25, 1.41, 0.8)
        return out * 0.6
    if kind == "flip":
        n = int(0.3 * SR); x = tt(n)
        return bp(rng.standard_normal(n), 600, 4000) * np.sin(np.pi * x / 0.3) * 0.6 + np.sin(2 * np.pi * 1600 * x) * np.exp(-(x - 0.22).clip(0) / 0.01) * (x > 0.22) * 0.5
    if kind == "splash":
        n = int(0.8 * SR); x = tt(n)
        s = lp(rng.standard_normal(n), 1500) * np.exp(-x / 0.18)
        for k in range(6):
            a = int((0.05 + k * 0.08) * SR); m = int(0.06 * SR)
            f = 500 + 900 * rng.random()
            s[a:a + m] += np.sin(2 * np.pi * np.cumsum(np.linspace(f, f * 1.8, m)) / SR) * np.hanning(m) * 0.4
        return s
    if kind == "chime":
        n = int(1.6 * SR)
        return bell(1046.5, n, 0.8, 3.5, 1.5) + bell(1568, n, 0.7, 3.5, 1.2) * 0.6
    if kind == "alert":
        out = np.zeros(int(0.8 * SR))
        for k, f in enumerate((880, 740, 880, 740)):
            n = int(0.14 * SR); i = int(k * 0.16 * SR)
            out[i:i + n] += np.sin(2 * np.pi * f * tt(n)) * env_ar(n, 0.01, 0.11, 0.03)
        return out * 0.7
    if kind == "lock":
        out = np.zeros(int(0.7 * SR))
        for k in range(3):
            n = int(0.03 * SR); i = int(k * 0.05 * SR)
            out[i:i + n] += np.sin(2 * np.pi * (1800 + k * 300) * tt(n)) * np.exp(-tt(n) / 0.008)
        n = int(0.5 * SR); i = int(0.16 * SR)
        out[i:i + n] += np.sin(2 * np.pi * 1760 * tt(n)) * expdec(n, 0.15)
        return out
    if kind == "correct":
        out = np.zeros(int(0.9 * SR))
        for k, f in enumerate((1318.5, 1760)):
            n = int(0.6 * SR); i = int(k * 0.08 * SR)
            out[i:i + n] += bell(f, n, 0.3, 2.0, 0.7)
        return out * 0.7
    if kind == "wrong":
        n = int(0.35 * SR); x = tt(n)
        s = np.sign(np.sin(2 * np.pi * 150 * x)) * 0.5 + np.sin(2 * np.pi * 150 * x) * 0.5
        return lp(s, 900) * env_ar(n, 0.01, 0.28, 0.07) * 0.6
    if kind == "unlock":
        out = np.zeros(int(1.4 * SR))
        for k, m in enumerate((74, 77, 81, 86)):
            n = int(0.9 * SR); i = int(k * 0.07 * SR)
            out[i:i + n] += bell(mtof(m), n, 0.45, 2.0, 1.0)
        return out * 0.5
    if kind == "sparkle":
        out = np.zeros(int(0.6 * SR))
        for k in range(7):
            n = int(0.2 * SR); i = int(k * 0.045 * SR)
            out[i:i + n] += np.sin(2 * np.pi * (3000 + 3000 * rng.random()) * tt(n)) * expdec(n, 0.05)
        return out * 0.5
    if kind == "stamp":
        n = int(0.5 * SR); x = tt(n)
        return np.tanh(2 * np.sin(2 * np.pi * 70 * x) * np.exp(-x / 0.12)) + lp(rng.standard_normal(n), 800) * np.exp(-x / 0.04) * 0.7
    if kind == "swell":
        n = int(1.6 * SR); x = tt(n)
        s = lp(rng.standard_normal(n), 2500) * 0.4 + sum(np.sin(2 * np.pi * mtof(m) * x) * 0.2 for m in (62, 69, 74))
        return s * (np.clip(x / 1.2, 0, 1) ** 2) * np.clip((1.6 - x) / 0.4, 0, 1)
    if kind == "heatwave":
        n = int(4.5 * SR); x = tt(n)
        s = lp(rng.standard_normal(n), 220) * 1.4 + np.sin(2 * np.pi * 48 * x) * 0.5
        s += hp(rng.standard_normal(n), 5000) * 0.12 * np.sin(np.pi * np.clip(x / 3.8, 0, 1))
        return s * np.clip(x / 0.2, 0, 1) * np.exp(-x / 1.6)
    raise ValueError(kind)


def render_sfx():
    for t, kind, g, p in TL["sfx"]:
        s = fx(kind)
        send = 0.35 if kind in ("ping", "chime", "correct", "unlock", "swell", "sparkle", "beep", "chirp") else 0.12
        sfx.add(s, t, p, g * 0.32)
        fverb.add(s, t, p, g * 0.32 * send)


# ------------------------------------------------------------------ guide VO (temporary)
def render_vo():
    vo = Bus()
    src = ROOT / "audio" / "src" / "vo"
    src.mkdir(parents=True, exist_ok=True)
    rates = {c["id"]: (1 if c["who"] == "Echo" else 0) for c in CAPS}
    report = {}
    for attempt in range(6):
        todo = [c for c in CAPS if c["id"] not in report]
        if not todo:
            break
        jl = [{"id": c["id"], "voice": c["who"], "rate": rates[c["id"]], "text": c["text"]} for c in todo]
        jp = src / "lines.json"
        jp.write_text(json.dumps(jl), encoding="utf-8")
        subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ROOT / "tools" / "make_guide_vo.ps1"),
                        "-Json", str(jp), "-OutDir", str(src)], check=True)
        for c in todo:
            sr, x = wavfile.read(src / (c["id"] + ".wav"))
            x = x.astype(np.float32) / 32768.0
            nz = np.nonzero(np.abs(x) > 0.003)[0]
            x = x[max(0, nz[0] - 200): nz[-1] + 2400] if len(nz) else x
            if c["who"] == "Echo":   # brighter, slightly faster character voice (+7 % resample)
                x = signal.resample(x, int(len(x) / 1.07)).astype(np.float32)
            dur = len(x) / SR
            slot = c["end"] - c["start"] + 0.25
            if dur <= slot or rates[c["id"]] >= 6:
                report[c["id"]] = dict(start=c["start"], end=c["end"], spoken=round(dur, 2), rate=rates[c["id"]], fits=dur <= slot)
                vo.add(x * 0.9, c["start"], 0, 1.0)
            else:
                rates[c["id"]] += 1
    return vo, report


# ------------------------------------------------------------------ output helpers
def to16(x):
    return (np.clip(x, -1, 1) * 32767).astype(np.int16).T


def write(path, x, seconds):
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(path, SR, to16(x[:, : int(round(seconds * SR))]))


def limit(x, ceiling, release=0.12):
    """Peak limiter: instant attack (5 ms look-around max), smooth release. Stereo-linked."""
    from scipy.ndimage import maximum_filter1d
    pk = maximum_filter1d(np.max(np.abs(x), axis=0), size=int(0.005 * SR))
    g = np.minimum(1.0, ceiling / np.maximum(pk, 1e-9))
    k = 1 - math.exp(-1 / (release * SR))
    sm = signal.lfilter([k], [1, -(1 - k)], g - 1.0) + 1.0
    g = np.minimum(g, sm)
    g = maximum_filter1d(-g, size=int(0.005 * SR)) * -1          # hold so the attack never lags
    return (x * g).astype(np.float32)


def loudness(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    txt = r.stderr
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", txt)
    p = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", txt)
    return float(i[-1]), float(p[-1])


def srt(cues, limit, path):
    def ts(s):
        ms = int(round(s * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    out = []
    for i, c in enumerate([c for c in cues if c["start"] < limit], 1):
        out.append(f"{i}\n{ts(c['start'])} --> {ts(min(c['end'], limit))}\n{c['who'].upper()}: {c['text']}\n")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(out), encoding="utf-8")


def main():
    print("score…", flush=True)
    render_score()
    m = apply_reverb(music, verb)
    tail = np.interp(tt(N), [0, 238.2, 239.9, DUR + 1], [1, 1, 0, 0]).astype(np.float32)
    m *= tail
    judge_env = np.interp(tt(N), [0, 232.6, 234.9, 235.0, DUR + 1], [1, 1, 0.0, 0, 0]).astype(np.float32)
    m_j = m * np.cos((1 - judge_env) * np.pi / 2) ** 2
    print("sonification…", flush=True)
    render_sono()
    s = apply_reverb(sono, sverb)
    print("effects…", flush=True)
    render_sfx()
    f = apply_reverb(sfx, fverb)
    print("guide VO…", flush=True)
    vo, vorep = render_vo()
    v = vo.x

    # level: scale all stems together toward -16 LUFS integrated, peak-limit each stem
    # (ceiling -3 dBFS) so the summed mix stays under about -1 dBTP. Two passes.
    tmp = ROOT / "audio" / "src" / "_probe.wav"
    g = 1.0
    raw = (m, m_j, s, f, v)
    for _ in range(3):
        m, m_j, s, f, v = (limit(x * g, 0.708) for x in raw)
        write(tmp, m + s + f + v, DUR)
        lufs, peak = loudness(tmp)
        if abs(lufs + 16.0) < 0.3:
            break
        g *= 10 ** ((-16.0 - lufs) / 20)
    mixpk = float(np.max(np.abs(m + s + f + v)))
    if mixpk > 0.86:
        m, m_j, s, f, v = (x * (0.86 / mixpk) for x in (m, m_j, s, f, v))
    tmp.unlink()

    A = ROOT / "audio"
    write(A / "music-master.wav", m, DUR)
    write(A / "music-judging.wav", m_j, 235.0)
    write(A / "sonification.wav", s, DUR)
    write(A / "sfx.wav", f, DUR)
    write(A / "vo-guide-TEMP.wav", v, DUR)
    D = ROOT / "delivery"
    write(D / "audio" / "mix-master.wav", m + s + f + v, DUR)
    write(D / "audio" / "mix-judging.wav", m_j + s + f + v, 235.0)
    stats = {}
    for name in ["audio/music-master.wav", "audio/music-judging.wav", "audio/sonification.wav", "audio/sfx.wav",
                 "audio/vo-guide-TEMP.wav", "delivery/audio/mix-master.wav", "delivery/audio/mix-judging.wav"]:
        sr, x = wavfile.read(ROOT / name)
        li, pk = loudness(ROOT / name)
        stats[name] = dict(seconds=round(len(x) / sr, 4), samples=len(x), lufs=li, true_peak_dbfs=pk)
    srt(CAPS, 240, D / "captions" / "captions-master.srt")
    srt(CAPS, 235, D / "captions" / "captions-judging.srt")
    rows = ["time_s,timecode_30fps,type,detail"]
    fmt = lambda t: f"{int(t // 60):02d}:{int(t % 60):02d}:{int(round((t % 1) * 30)) % 30:02d}"
    for sc in TL["scenes"]:
        rows.append(f"{sc['start']},{fmt(sc['start'])},scene,{sc['id']} {sc['title']} ({sc['start']}-{sc['end']} s)")
    for t, label in TL["accents"]:
        rows.append(f"{t},{fmt(t)},music accent,{label}")
    for c in CAPS:
        rows.append(f"{c['start']},{fmt(c['start'])},voice {c['who']},\"{c['text']}\"")
    for w in TL["teach"]:
        rows.append(f"{w['from']},{fmt(w['from'])},sound lesson window,{w['mode']} until {w['to']} s (score thinned)")
    (D / "cue-sheet.csv").write_text("\n".join(rows) + "\n", encoding="utf-8")
    rep = dict(stems=stats, guide_vo=vorep, gain_db=round(20 * math.log10(g), 2))
    (A / "src" / "build-report.json").write_text(json.dumps(rep, indent=1), encoding="utf-8")
    print(json.dumps(stats, indent=1))
    bad = {k: v for k, v in vorep.items() if not v["fits"]}
    print("guide VO lines over their window:", bad or "none")


if __name__ == "__main__":
    main()
