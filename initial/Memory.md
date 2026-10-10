# Earth Jukebox project memory

Last updated: 2026-09-29, after the implementation build. This file records durable context and actual status, not claims of future completion.

## User intent

The user is preparing video components for a videographer. The first request produced the planning files (Agent.md, Architecture.md, ImplementationPlan.md, Memory.md) and a sourced image library. The second request, on 2026-09-29, was to implement the full package from those files. It asked for a 240-second HTML/CSS motion-graphics master plus a separate 235-second judging version, and minimal vanilla JavaScript for sync and controls. It also asked for local Roboto Mono, real original or licensed music synchronised to the picture, separately animated components, full playback/scene/seek/frame/caption/audio/clean-capture controls, editable narration, and honest labels. The full interactive game is out of scope.

## Inputs read

| Input | What it establishes |
| --- | --- |
| `../project-docs/Earth_Jukebox_Game_Plan (1).pdf` | Four-page game concept dated September 26, 2026: Echo, Dhaka, tutorial, sound mapping, six rounds, interventions, futures and reward |
| `../project-docs/Nasa space apps video script.docx` | Seven narrated scenes from 0:00 to 3:55; ByteAro team name; planned rather than completed data integrations |
| `image/reference-judging.png` | Under-240-second guidance and 45/60/60/75-second WHO/WHY/WHAT/SO WHAT NEXT structure |
| [User's challenge URL](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/) | Challenge title; the full live page could not be retrieved during research |

## Decisions (planning, still in force)

1. Keep the DOCX sequence. Its 235 seconds plus a five-second end hold give the 240-second master; the judging cut ends at 235 s with its own completed musical ending.
2. The four-block judging structure is a reference only. The DOCX does not match its boundaries, and the narration was not restructured.
3. Visuals are HTML/CSS. A small vanilla-JS transport is used for audio sync, seeking and controls. There's no framework, backend or build step, and `index.html` opens by double-click from `file://`.
4. The format is 1920×1080, 30 fps, 96 BPM 4/4 (one bar = 2.5 s, 96 bars master). These are production choices, not source requirements.
5. NASA-inspired palette with no implied endorsement; downloaded images unchanged and credited.
6. Use the DOCX's cautious science language. Future outcomes are conditional; coin costs and effects are game assumptions.

## Implementation decisions (made during the build)

- **Motion engine.** All motion is authored as CSS keyframes in four "slots" per element (in / out / loop / mid) with delays in *absolute timeline seconds* (`css/motion.css`). The player pauses every CSS animation and sets `currentTime = t` each frame through the Web Animations API, so any frame is reproducible forwards or backwards. JS only supplies the clock, audio sync, captions, the ring-wipe radius, and a few time-derived values: slider knobs (`data-v`), counters (`data-count`, `data-steps`), and Echo's mouth and happy eyes.
- **Clock.** By default the preview plays the sample-locked reference mix (`delivery/audio/mix-*.wav`) as one media element, and its `currentTime` is the clock, so the stems can't drift. Touching any stem control switches to the four separate stems: the music stem becomes the clock, and the others follow with gentle playback-rate nudges (re-seated only for jumps over 120 ms). Paused and capture modes use the requested time snapped to 30 fps frames.
- **Single source of truth for sync.** `js/timeline.js` defines scenes, SFX cues and every sonification note. `tools/dump-timeline.js` exports it for the Python synthesiser, and the Sound Lab note, drum and chord marks are drawn from the same data, so the picture and sound cannot disagree.
- **Music.** The score is original, synthesised in `tools/make_audio.py` with no samples. It uses a D-minor progression, lifts to a bVI–bVII–I cadence landing on D major at 232.5 s, and has an original two-note Echo motif (A5 to D6) at 5.0 s, 197.5 s and 230 s. Risers and booms fall on each wipe boundary, and the heat-wave impact lands at 130 s. Duck rules come from the caption regions and from "teach" windows: melodic score material is removed during heat demos, score percussion during rain demos, and the pad is lowered during greenery.
- **Sonification timbres are distinct from the score.** Heat is a reedy pulse lead that sharpens with heat. Rain is a hand drum whose rate means steady, flood or silent. Greenery is FM electric-piano chords, detuned (out of tune) when greenery is low. The s05 demo uses a neutral glass tone because brightness is not a climate variable.
- **Guide VO.** Windows TTS (Zira for Echo at +7 % pitch, David for Presenter) placed at the caption start times, and marked TEMP everywhere. Every line fits its window.
- **Honest frame-to-sound demo (s05).** Real mean-pixel brightness is sampled along one row of the Landsat 8 Dhaka 2022 image (`tools/make_transect.py` → `js/transect.js`) and mapped to pitch, labelled "brightness is not temperature" and "EIC frame pipeline · planned, not built".
- **Geography.** The Blue Marble 2002 Western Hemisphere image is used only as a generic Earth. Dhaka is located on the VIIRS 2021 night-lights image and then the Landsat 2022 image, both dated and credited on screen, before dissolving to the stylised city tagged "not to scale".
- **Example values.** The player name "NOVA" is labelled illustrative. The round result "64 % · 7/11 zones" and the final score "82 %" are both labelled example; the round fraction is kept distinct from the across-round score. The budget of 12 coins is illustrative. Cooling centres are shown as "people safe · area still hot".
- **Challenge title** is shown as "The Earth Information Jukebox", taken from the user-supplied URL slug. It's editable in `js/content.js` and flagged there for verification.

## Completed and verified

- [x] `index.html` single entry point; 8 scenes (s01–s08) with independently animated Echo, Earth, isometric CSS 3D city, sliders, Sound Lab, Quick Ears, HUD, evidence lanes, charts, boarding pass, icons (inline SVG sprite) and labels.
- [x] Local Roboto Mono 400/500/700 (`fonts/`, SIL OFL 1.1 in `fonts/OFL.txt`).
- [x] Player: play/pause, restart, scrubber with bar and accent markers, scene buttons, previous/next scene, ±1 frame and ±1 s, loop scene, cut switch (240/235), captions, clean capture, background modes (space/black/green/transparent), component solo, reduced-motion preview, and per-stem volume/mute. There are also URL parameters, keyboard shortcuts, a loader with asset status, and visible errors for missing media.
- [x] Audio built: `audio/music-master.wav` (240.000 s), `music-judging.wav` (235.000 s), `sonification.wav`, `sfx.wav`, `vo-guide-TEMP.wav`; 48 kHz/16-bit stereo, zero-aligned. Mixes are at −17.4 LUFS integrated, −1.3 dBTP (provisional target −16 LUFS; limited by peaks).
- [x] Delivery: SRT captions (both cuts), `cue-sheet.csv`, reference mixes, `verification.json`, `sync-check.json`, plus MP4 exports `delivery/video/earth-jukebox_master_240s_1920x1080_30fps.mp4` (7,200 frames, 240.000 s video and audio) and `..._judging_235s_...mp4` (7,050 frames, 235.000 s). Both were verified with ffprobe.
- [x] `tools/verify.mjs` (headless Chrome) passes all 20 checks:
  - Assets and audio load from `file://`.
  - Default playback uses the reference mix only, with the visual clock within 4 ms of it.
  - In stems mode, the visual clock stays within 2 ms of the music stem, and the followers are bounded (median 2.6–3.7 ms, p95 23–49 ms across runs) with no accumulating drift.
  - Scene boundaries are start-inclusive and end-exclusive.
  - Backward seeks reproduce forward frames (mean difference 0.00007/255).
  - The master ends on frame 7199 (s08) and the judging cut on 7049 (s07) with `music-judging.wav`.
  - Fonts and images are local; there are no wall-clock CSS transitions; critical text sits inside the 96/54 px safe area; on-screen text is at least 24 px; there are no page errors.
  - The reduced-motion, solo and missing-audio fallbacks work.
- [x] `tools/check_sync.py`: 17 picture cues measured in the rendered stems are all within one frame (most within ±5 ms).
- [x] Visual QA: contact sheets reviewed for every scene; overlaps, overflow and caption-label collisions fixed.

## Missing inputs (explicit placeholders, not invented)

- Team member names, roles and the number of members. s02 shows four "Name pending / Role pending · PREVIEW SLOT" cards; edit `members` in `js/content.js`.
- Recorded voiceover (Echo and Presenter), plus pronunciation. Only the TEMP TTS guide exists.
- Final project URL and QR code. The boarding pass shows "QR SLOT · URL PENDING"; s08 credits show "project URL: pending".
- Verified exact challenge title and complete live challenge brief (EIC requirements).
- Approved historical and projection datasets. No climate values are shown anywhere; lanes say "planned" or "to be selected".
- Videographer's capture/alpha requirements. PNG alpha via `--alpha --solo` is available; MP4 has no alpha.

## Known limitations

- Mix loudness is −17.4 LUFS, not −16, because the ceiling was kept at about −1.3 dBTP. A mastering pass can close the gap.
- Only stems mode (after adjusting a stem control) plays four separate media elements, held within about ±50 ms of each other. Default playback and all exports use the sample-aligned mix.
- The quick MP4s were encoded from JPEG q95 screenshots (visually lossless at CRF 15). Use PNG mode for a lossless master (~45 min).
- The Sound Lab and Quick Ears are compressed montages and are labelled that way. The 20 s protection countdown is real time.
- The script does not follow the judging graphic's WHO/WHY/WHAT/SO WHAT NEXT timing; that would need a narration edit.

## Next work

Record VO and replace `audio/vo-guide-TEMP.wav`, retiming captions in `js/content.js` if needed and re-running `tools\build-audio.cmd`. Fill in the team, URL and QR details. Verify the challenge title and brief. Choose datasets before showing any values. Optionally master the mix to −16 LUFS.
