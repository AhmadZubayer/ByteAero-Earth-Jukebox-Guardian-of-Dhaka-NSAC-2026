# Earth Jukebox: Guardian of Dhaka — videographer guide

A 1920×1080, 30 fps motion-graphics package built in HTML/CSS, with a 240-second master and a 235-second judging cut. Everything is local; no server or internet is needed.

## 1. Watch it

1. Double-click `index.html`. Use Chrome or Edge; that's what the package was tested in.
2. Once the loader shows all six items `ready`, click **Play with sound**. Browsers only allow sound after a click.
3. The dock under the picture controls playback. It never appears inside the 16:9 frame.

| Key | Action |
| --- | --- |
| Space | play / pause |
| ← / → | one frame back / forward (pauses) |
| Shift + ← / → | one second |
| `[` / `]`, `1`–`8` | previous / next scene, jump to scene |
| Home / End | first / last frame |
| C, Esc | clean capture on / off (hides the dock and cursor) |
| K | captions on / off |
| L | loop the current scene |
| M | mute all |

By default it plays the sample-locked reference mix. Touching any stem control switches to the separate stems.

Dock extras: **Cut** switches between Master 240 s and Judging 235 s. **BG** sets the background to space, black, green, or transparent. **Solo** shows one component family only (Echo, city, UI/cards, type, Earth). There are per-stem volume and mute controls, and a **Reduced motion** preview.

URL shortcuts (append to the address): `index.html?scene=s04`, `?time=95.5`, `?frame=2865`, `?cut=judging`, `?clean=1`, `?captions=0`, `?bg=green`, `?solo=echo`, `?loop=1`.

## 2. Ready-made files (`delivery/`)

| File | What it is |
| --- | --- |
| `video/earth-jukebox_master_240s_1920x1080_30fps.mp4` | full master, 7,200 frames, with the reference mix, no burned-in captions |
| `video/earth-jukebox_judging_235s_1920x1080_30fps.mp4` | judging cut, 7,050 frames |
| `audio/mix-master.wav`, `audio/mix-judging.wav` | reference mixes, 48 kHz / 16-bit |
| `captions/captions-master.srt`, `captions-judging.srt` | subtitles (script wording) |
| `cue-sheet.csv` | scene starts, music accents, voice lines, sound-lesson windows |
| `verification.json`, `sync-check.json` | automated test results |

**Stems** are in `audio/`: `music-master.wav`, `music-judging.wav`, `sonification.wav`, `sfx.wav`, `vo-guide-TEMP.wav`. They're 48 kHz stereo WAV and all start at 00:00:00:00, so drop them at zero. For the judging cut, use `music-judging.wav` and trim the other stems at 235.000 s. The guide VO is **Windows text-to-speech, for timing only**. Replace it with the recorded voices.

## 3. Capture your own frames (frame-accurate)

Screen recording works for previews, but it isn't frame-accurate. For exact frames, use the capture tool. It needs Node 22+ and Chrome or Edge, plus ffmpeg for video.

```text
node tools/capture.mjs --scene s04 --handles 2 --out delivery/frames/s04-mission_1920x1080_30fps
node tools/capture.mjs --scene s01 --solo echo --alpha --out delivery/frames/s01-echo_alpha
node tools/capture.mjs --cut master --video delivery/video/master_lossless.mp4        (PNG frames, ~45 min)
node tools/capture.mjs --cut judging --jpeg --video delivery/video/judging_quick.mp4  (~10 min)
node tools/capture.mjs --times 12.5,95,130 --out delivery/stills
```

- Frames are named `frame_NNNNN.png`, numbered by master frame (the first frame of s04 is 02850).
- `--handles 2` adds two seconds either side of a scene, taken from the master timeline itself.
- `--alpha` writes **real transparent PNGs**, but only for component layers: combine it with `--solo` (and it sets a transparent background). An ordinary screen recording never contains alpha.
- `--captions 1` burns captions in. They're off by default because the SRT files are supplied.

## 4. Scene map (master)

| Scene | Time | Bars (96 BPM) | Content |
| --- | --- | --- | --- |
| s01 | 0:00–0:25 | 0–10 | Guardian wanted: Earth, Echo, mission card |
| s02 | 0:25–0:50 | 10–20 | Meet ByteAro, member slots, concept, name entry |
| s03 | 0:50–1:35 | 20–38 | Controls, Sound Lab (heat / rain / greenery), Quick Ears |
| s04 | 1:35–2:30 | 38–60 | NASA imagery to game city, six rounds, 20 s protection, impact, report |
| s05 | 2:30–3:05 | 60–74 | Evidence ledger, design pipeline, assumptions, frame-to-sound demo |
| s06 | 3:05–3:35 | 74–86 | Two conditional futures, boarding pass |
| s07 | 3:35–3:55 | 86–94 | Goals, "you can't win unless you learn", final lock-up (cadence 3:52.5) |
| s08 | 3:55–4:00 | 94–96 | Master-only end hold with credits |

Every scene boundary is a ring wipe on a bar downbeat. One bar is 2.5 s.

## 5. Things to keep true in the edit

- Keep the status tags on screen. They separate **verified NASA observation**, **planned data integration**, **future scenario**, and **illustrative gameplay**. The 82% and 64% scores, the coin costs, and the city are game illustrations, not results.
- The 20-second protection countdown runs in real time (1:50–2:10). Only relabel it "montage" if you shorten it.
- Don't present the 240-second master as "under four minutes". Submit the 235-second judging cut for judging.
- Before release, fill in the pending items listed in `Memory.md`: team names and roles, recorded VO, and the final URL/QR.

## 6. Rebuilding after edits

- **Copy:** edit `js/content.js`. It holds the captions/narration, team slots, challenge title, and example player name.
- **Timing:** edit the `--d`/`--o` values (absolute seconds) in `index.html`, and the cue lists in `js/timeline.js`.
- **Audio:** run `tools\build-audio.cmd` to regenerate all audio, captions, and the cue sheet. It needs Python with numpy and scipy, Node, ffmpeg, and Windows speech voices.
- **Checks:** `node tools/verify.mjs` and `python tools/check_sync.py` re-run the tests.
