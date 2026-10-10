# Earth Jukebox motion graphics architecture

## Production contract

Proposed system: a local, dependency-light HTML/CSS scene package with a small vanilla JavaScript playback controller. The 240-second master is designed at 1920 x 1080, 16:9, 30 fps: 7,200 frames numbered 0 through 7,199. Scaling to 3840 x 2160 is optional after testing source resolution and performance. The videographer can play the whole sequence, isolate a scene, scrub to a precise frame, or hide all controls for capture.

This document was written as the build specification. The package was implemented on 2026-09-29; see "As built" at the end for where the implementation differs.

## Proposed structure

The source documents live outside the runtime package in the sibling directory `D:/AhmadZubayer/Dev/Projects/NSAC2026-EarthJukeBox/project-docs/`: `Earth_Jukebox_Game_Plan (1).pdf` and `Nasa space apps video script.docx`. From `initial/`, resolve them through `../project-docs/`. They are authoring references; browser playback must not depend on loading them.

```text
initial/
  Agent.md
  Architecture.md
  ImplementationPlan.md
  Memory.md
  index.html                  # sole launch page, all scene templates
  css/
    tokens.css                # palette, spacing, type, easing
    stage.css                 # 16:9 stage and preview controls
    components.css            # Echo, city, UI, charts, labels
    scenes.css                # scene-specific composition
    motion.css                # keyframes and reduced-motion variants
  js/
    content.js                # copy, team slots, source references
    timeline.js               # scene bounds and musical cue markers
    components.js             # reusable DOM builders
    scenes.js                 # scene render functions
    audio.js                  # stems, transport, envelopes
    player.js                 # clock, controls, frame stepping
  image/
    SOURCES.md                # provenance and shot usage
    *.jpg                     # downloaded NASA imagery
    reference-judging.png      # reference only
  fonts/                      # local Roboto Mono and license
  audio/                      # licensed score, VO, SFX, sonification
  delivery/                   # future cue sheet, captions, captures
```

Keep scene templates in index.html or construct them from classic deferred scripts. Avoid fetching HTML fragments, JSON, remote fonts, or JavaScript modules in the default direct-file mode. This lets the user double-click index.html without a server. External CSS and classic scripts use relative paths. A localhost mode may improve capture automation but must not be the only documented entry point.

## Scene and component model

Each scene declares an ID, start and end seconds, subtitle cues, source IDs, musical markers, and a deterministic `render(localTime, state)` function. Its active range is start-inclusive and end-exclusive. The final boundary is handled explicitly by the player. Transitions overlap visual layers inside these ranges without adding runtime.

Reusable components:

| Component | Independent parts | Story purpose |
| --- | --- | --- |
| Earth stage | photograph, circular mask, atmosphere, orbit, markers | Planet-scale opening and closing |
| Echo satellite | body, face, panels, antenna, rings | Host, reactions, transitions |
| Dhaka city | tile grid, building faces, roads, water, trees, heat layer | Explain choices and outcomes |
| Sound Lab | tracks, knobs, values, symbols, waveform marks | Relate variables to sound |
| Quick Ears | five markers, answer chips, hint state | Show learning before play |
| Mission HUD | timer, coins, year, four intervention tiles | Make constraints legible |
| Evidence card | source, variable, unit, period, mapping, status | Separate observations from interpretation |
| Future split | shared city, two development paths, labels | Contrast conditional scenarios |
| Boarding pass | player name, example score, future, badges, QR slot | Closing reward and invitation |

Use nested DOM elements for CSS camera movement so local component transforms remain independent. Prefer DOM/CSS shapes for the original icons. If later using external vector images, put those files in image/ and ensure essential animated pieces remain separately addressable. Keep decorative elements out of accessibility text.

## Shared clock and deterministic rendering

Expose a single transport with play, pause, seek, restart, scene selection, and one-frame stepping. Internally represent timeline positions as seconds; snap frame requests to `frame / 30`. Derive every object's state from absolute time and a fixed random seed. Never accumulate animation state one frame at a time or rely on chained timeouts.

During audible playback, use the active master audio media element's currentTime as the visual timebase. Schedule other stems against that transport, resynchronize after seeks, and verify drift. Pause or resynchronize after background-tab throttling. For silent preview and offline frame capture, use the explicit requested timeline time. CSS animations can be paused and assigned a currentTime through the Web Animations API; avoid independent free-running CSS loops.

Controls should include Play with sound, pause, restart, scrubber, timecode, scene selector, frame forward/back, mute, stem controls, clean capture, captions, and background mode. A user gesture starts audio because browsers may block autoplay. In direct-file mode use local media elements; do not depend on fetching and decoding audio with APIs that may reject file URLs. If a stem fails, display an actionable preview error and do not silently imply successful sound playback.

URL parameters proposed for capture: `?scene=s04&time=95&clean=1&bg=black`. A transparent CSS background is useful for compositing previews but does not make an ordinary screen recording contain alpha. Document the actual alpha-capable image-sequence or video export path separately when implemented.

## Music grid

Proposed composition tempo: 96 BPM in 4/4. One beat is 0.625 seconds; one bar is 2.5 seconds. All supplied scene boundaries fall on whole bars. A 240-second score has 96 bars; the 235-second judging version has 94 bars and needs its own completed resolution.

Store soundtrack offset, tempo, beats per bar, scene markers, voiceover regions, accents, and ducking envelopes in timeline.js. Beat positions are `offset + beatIndex * 60 / BPM`. Zero-based bar positions equal beatIndex / 4. If a licensed track has a different tempo or variable timing, replace the cue map; do not pretend the provisional grid fits it.

Primary hits get one strong visual event. Eighth-note details are secondary; longer pads support slow camera drift. Suppress score percussion during rainfall demonstrations and bright melodic material during heat demonstrations. Use consistent sound mappings in all scenes, accompanied by captions. Music selection, voice performance, and mastering remain pending.

## Visual tokens and motion grammar

| Token | Proposed value | Use |
| --- | --- | --- |
| Space | #050B18 | Background |
| Panel | #101D36 | Cards and depth |
| Earth blue | #2878F0 | Data and mission graphics |
| Telemetry cyan | #58D9F9 | Traces, selection |
| Paper | #F2F6FC | Primary text |
| Muted | #ABBBD2 | Secondary labels |
| Heat | #FF654E | Warnings plus icon/text |
| Attention | #F6B83F | Budget and decision cues |
| Recovery | #6DDEAB | Protection and greenery |

These are project palette choices, not an official NASA brand specification. Check contrast in the final composited scene.

Use approximately 120-220 ms for taps and accents, 400-800 ms for component arrivals, 1-2 seconds for hero reveals, and multi-second drift for atmosphere. At 96 BPM, prefer 0.3125, 0.625, and 1.25 second accents where appropriate. A spring reveal should anticipate briefly, overshoot modestly, and settle once. Give copy a readable hold after its reveal. Animate transform and opacity; limit large blur filters and expensive repaints.

## Source and asset model

Every scientific card needs source URL, dataset/product name, measured variable, units, geography, period, observation/projection status, transformation, and any illustrative assumptions. Local image provenance lives in image/SOURCES.md. Asset imagery is not a substitute for a verified EIC frame pipeline or temperature dataset.

Use local NASA imagery as masked context layers with independent vector-like overlays. Keep the downloaded originals unchanged. The 1988/2022 Dhaka pair can support urban-growth context; it must not be relabeled as the game's 2000/2024 temperatures. Missing team names, final score, data, and URL use explicit editable preview slots; omit unresolved values from release rather than invent them.

## Videographer handoff and validation

Plan a master playback, isolated scenes, clean backgrounds, caption on/off, and component solo modes. Supply separate audio stems starting at timeline zero, a cue sheet with timecodes, and scene capture notes. Offer two-second handles on isolated exports without extending the master timeline. Use a readable naming pattern such as `s04-mission_1920x1080_30fps`.

Capture constant-frame-rate output; verify exact frame count and audio duration after encoding. Browser screen recording alone does not guarantee frame accuracy. Check scene starts, midpoints, ends, backward seeks, restart, and end-frame behavior. Measure visual/audio marker alignment to within one 30 fps frame at the beginning and end of the piece. Test local opening, offline assets, missing audio, font readiness, subtitle boundaries, and clean capture without controls. No production video export is claimed until those tests pass.

## As built (2026-09-29)

- **Files.** The structure follows the plan, with a few changes:
  - `js/components.js` holds the DOM builders.
  - `js/scenes.js` holds the city specifications.
  - `js/members.js` renders the team slots.
  - `js/transect.js` is generated brightness data.
  - `js/player.js` combines the planned `audio.js` and `player.js`.
  - The scene markup lives in `index.html`.
  - The tools are `tools/build-audio.cmd`, `make_audio.py`, `make_transect.py`, `make_guide_vo.ps1`, `dump-timeline.js`, `capture.mjs`, `verify.mjs` and `check_sync.py`.
- **Deterministic rendering.** Instead of per-scene `render(localTime)` functions, all motion is CSS keyframes with absolute-time delays in four slots (see `css/motion.css`). The player pauses every animation and sets `currentTime` from the one clock. A few time-derived values are set per frame from data attributes: slider positions, counters, Echo's mouth and eyes, beat pulses, the wipe radius and captions.
- **Audio.** Music, sonification, effects and the temporary guide VO are rendered offline from the same timeline data (`tools/make_audio.py`), so there is no runtime Web Audio. Stems are played by media elements that follow the music element's clock.
- **Capture.** `tools/capture.mjs` drives headless Chrome over the DevTools Protocol. It seeks each frame and screenshots it (PNG, JPEG, or alpha PNG), and can pipe the frames straight into ffmpeg with the reference mix.
