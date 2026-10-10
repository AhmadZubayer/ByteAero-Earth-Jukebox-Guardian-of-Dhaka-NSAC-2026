# Earth Jukebox video implementation plan

## Intended outcome

Produce a 240-second HTML/CSS motion graphics package that a videographer can capture as a full sequence or as separate components. Retain the supplied script's narrative order and dialogue meaning. The plan below is ready for implementation; its unchecked items describe future work.

## Timing decisions

The DOCX has seven scenes totaling 235 seconds. Add a five-second end hold for the requested 240-second master. Deliver a separately resolved 235-second judging cut because the supplied judging graphic says the pitch must run under 240 seconds. Keep credits readable earlier as well as during the tail; do not cram all attribution into five seconds.

The judging reference recommends WHO 0-45, WHY 45-105, WHAT 105-165, SO WHAT NEXT 165-240. The supplied script has a different organization and spends much of WHY on tutorial content. Preserve the script as the base version while strengthening human stakes visually during training. An exact four-block restructuring requires a separate narration edit; do not silently present the current script as matching that reference.

## Master storyboard

Time intervals below are contiguous and total 240 seconds. Musical bar ranges use zero-based boundaries at a proposed 96 BPM.

| ID | Time | Duration / bars | Story and on-screen components | Motion and sound |
| --- | --- | --- | --- | --- |
| s01 | 0:00-0:25 | 25s / 0-10 | Guardian wanted. Earth, Echo, mission card, Dhaka title; establish the listening premise within 15 seconds. | Darkness opens with a signal, atmosphere blooms, Echo arcs in, panels settle. Match a signal ring to the mission-card reveal. Sparse pad, original two-note Echo call, pulse enters. |
| s02 | 0:25-0:50 | 25s / 10-20 | Meet ByteAro. Project title, editable member/role cards, exact challenge title, nine-to-ten-minute game concept, name entry. | Cards arrive in staggered beats, cursor types a clearly illustrative player name, name label carries into the next scene. Warm arpeggio builds under presenter. |
| s03 | 0:50-1:35 | 45s / 20-38 | Echo training. Drag/listen/tap, Sound Lab heat/rain/greenery sliders, five-question Quick Ears and hint. Include stylized people/buildings to connect heat to everyday life. | Follow a gesture trail over city tiles, expand a slider into a waveform, reveal each sound family separately. Reduce score so the learner hears the difference. Hint gently replays one example. |
| s04 | 1:35-2:30 | 55s / 38-60 | Mission. Six years, city, warning, 20-second protection phase, coin budget, four interventions, impact, report and retry rule. | Geographic context resolves into stylized city. Warning travels through sound rings. Coins transfer into chosen fixes, trees grow with overshoot, roof flips reflective, heat front crosses city, protected zones settle. Tension pulse peaks at impact. |
| s05 | 2:30-3:05 | 35s / 60-74 | Evidence. Source card, planned NASA historical input, proposed projections, value-to-sound mapping and separate game assumptions. Include a provisional EIC-frame-to-sonification diagram. | Heat trace becomes a chart line; source, mapping, and rules separate into clearly labeled layers. Lower music density and slow motion for comprehension. Future-scenario label remains readable. |
| s06 | 3:05-3:35 | 30s / 74-86 | Future and boarding pass. Energy/green-space choices, two conditional futures, personalized pass, illustrative score and badges, QR slot. | Shared city splits into paths; parks and buildings evolve separately. Merge selected path into a pass with restrained dimensional tilt and badge accents. Harmony opens, Echo motif returns. |
| s07 | 3:35-3:55 | 20s / 86-94 | Final invitation. Learning goal, city view, Echo, project/team title, "Let's listen to Earth together." | Return to opening composition, sound traces wrap around Earth, typography resolves in phrase-sized groups. Land the final spoken line and musical cadence by 235s for judging cut. |
| s08 | 3:55-4:00 | 5s / 94-96 | Master-only end hold. Title, invitation and concise credits; optional verified URL. | Hold readable type, let small orbital motion and the music tail settle; stop exactly at 240s. |

### Detailed tutorial and mission beats

For s03, allocate 50-60s to controls, 60-72.5s to heat, 72.5-80s to rain, 80-87.5s to greenery/restore, and 87.5-95s to Quick Ears. These are montage demonstrations, not the complete two-minute Sound Lab. Fit narration before polishing animation; do not squeeze five real questions into this eight-second montage while implying a complete test was played.

For s04, allocate 95-102.5s to the six-year timeline, 102.5-110s to finding the warning, 110-130s to the 20-second protection phase, 130-137.5s to impact, and 137.5-150s to report/retry/city growth. If the countdown is compressed in a later edit, label it as a montage. Do not animate a false real-time countdown.

## Milestone 1 content and evidence

Use the verified source files in `D:/AhmadZubayer/Dev/Projects/NSAC2026-EarthJukeBox/project-docs/` (`../project-docs/` from the implementation folder): `Earth_Jukebox_Game_Plan (1).pdf` and `Nasa space apps video script.docx`. Use `image/reference-judging.png` for the judging reference.

- [x] Create editable content records for the seven script scenes and master-only tail. (`js/content.js`, `js/timeline.js`)
- [ ] Obtain team member names/roles, pronunciation, final voiceover, and destination URL. These are missing inputs, not reasons to delay visual scaffolding. **Still missing; shown as labelled placeholders.**
- [ ] Verify the complete live challenge brief and EIC requirements. Search-index text is provisional; the public page failed to expose full details during planning. **Still open; the title comes from the URL slug and is flagged in content.js.**
- [ ] Choose historical and future data products, record units/coverage/resolution, and validate any on-screen values. NASA POWER is a candidate mentioned in the PDF, not a verified solution for every data need. **Open; no climate values are shown on screen.**
- [x] Make an evidence ledger separating observations, climate scenarios, sonification mappings, and gameplay assumptions. (s05 lanes and status tags throughout)
- [x] Keep the PDF's challenge-release/event dates out of narration until independently verified.

Gate: every factual on-screen claim has a source or an explicit illustrative/planned label. Do not claim a finished prototype when showing an animation of proposed functionality.

## Milestone 2 visual system and image preparation

- [x] Implement the palette, type scale, safe areas, 16:9 stage, and local Roboto Mono.
- [x] Build Echo, isometric city tiles, interventions, HUD, Sound Lab, timeline, evidence card, and boarding pass as independently addressable parts.
- [x] Use downloaded imagery according to image/SOURCES.md. Store any additional images or derivatives inside image/. (no new image files were needed; crops are CSS)
- [x] Turn reference UI into actual labels, sliders, controls, and shapes; do not animate a flattened screenshot as the scene.
- [x] Prepare opening, Sound Lab, mission, and ending style frames to verify consistency before full animation.

Gate: key copy is readable at 1080p; the city, Echo, and information hierarchy remain clear without audio.

## Milestone 3 soundtrack and voiceover

- [x] Compose or license a 240-second instrumental score, with a separately finished 235-second version; retain license/credit records. (original score, see `audio/LICENSE-AUDIO.md`)
- [x] Start with 96 BPM, 4/4, unless the selected music requires a revised marker map. Build the emotional arc from curiosity to urgency to agency and resolution.
- [ ] Record Echo and presenter as distinct, intelligible voices. Time the actual performances against the supplied scene limits. **Open; only a TEMP text-to-speech guide exists, and every guide line fits its window.**
- [x] Prepare separate zero-aligned 48 kHz WAV stems for music, voiceover, sonification, and effects. Export compressed preview audio only as an additional asset. (the VO stem is the TEMP guide)
- [x] Mark beats, section changes, voice regions, impact accents, and sound-teaching windows in the cue sheet. (`delivery/cue-sheet.csv`)
- [x] Mix for clear speech and demonstrable sound mappings; provisional final target is about -16 LUFS integrated and at or below -1 dBTP, subject to videographer delivery requirements. (measured -17.4 LUFS, -1.3 dBTP; a mastering pass is optional)

Gate: music and sonification can be heard separately; no clipping, masked narration, or unlicensed temp music remains in a release export.

## Milestone 4 player and motion

- [x] Build index.html as the only required launch point and compose all scenes through local CSS/classic scripts.
- [x] Implement transport, scene selector, clean capture, captions, stem controls, scrubber, and exact frame stepping.
- [x] Drive visual state from the shared timeline, with fixed-seed decorative particles and deterministic backward seeking.
- [x] Animate s01-s03, then s04-s06, then the closing versions. Use one coherent transition motif: signal ring, waveform, chart trace, orbit.
- [x] Add anticipation, overshoot, follow-through, secondary reactions, and depth where they reinforce the action. Include calm holds so constant movement does not flatten the rhythm.
- [x] Preload local images, font faces, and media before enabling final capture.

Gate: scrubbing directly into any scene produces the same composition as normal playback at that time. Audio resumes at the matching offset without duplicate effects.

## Milestone 5 quality and handoff

- [x] Watch the entire master with audio and the entire judging cut separately. (automated playback, contact-sheet review and onset sync measurements; a human listening pass is still recommended)
- [x] Inspect all scene boundaries, captions, source notes, geographic labels, monetary values, and future-scenario labels.
- [x] Test double-click index.html offline in the videographer's browser; document any localhost-only capture features separately. (tested from file:// in Chrome; no localhost-only features)
- [x] Verify 7,200 frames for the master and 7,050 frames for the 235-second cut at 30 fps, after export.
- [x] Measure synchronization near the start, middle, and ending; keep key hits within one frame. (`delivery/sync-check.json`)
- [x] Test independent scene capture, restart, backward seek, missing media, window resize, reduced-motion preview, and hidden controls.
- [x] Supply cue sheet, captions, font/license records, image credits, separate audio stems, naming conventions, and instructions for two-second scene handles. (`VIDEOGRAPHER.md`)
- [x] State whether transparency is actually supported by the chosen export method. Offer black/solid background captures when alpha is unavailable. (PNG alpha via `--alpha --solo`; MP4 has none)

Gate: videographer can open the project, find a scene, replay it, capture a clean version, and locate its source assets without needing the author.

## Current delivery

Implemented 2026-09-29: the `index.html` player with all eight scenes, local fonts, original score and sonification stems, SFX, a TEMPORARY text-to-speech guide VO, captions, a cue sheet, capture and verification tools, and MP4 exports of both cuts. Still open: recorded VO, team details, the final URL/QR, a verified challenge brief, and approved datasets. Details and test results are in Memory.md; handoff steps are in VIDEOGRAPHER.md.
