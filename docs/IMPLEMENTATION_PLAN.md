# Earth Jukebox: Guardian of Dhaka — 3D implementation plan

Status: first full version built in `game/` (all six phases). Differences from this plan are listed in section 15.
Branch: `claude/3d-game`. The working 2D game on `main` (`initial/`) stays untouched until the 3D version is ready.

## 1. Goal

Rebuild the game as a third-person 3D browser game. The player is a cartoon child in Dhaka, with Echo the satellite-drone as a companion. Each round a heat wave is coming; the player finds it **by listening**, runs to it, and protects the area before it hits.

Sound is the game mechanic, not decoration. This answers the challenge brief (sight → sound, real-time, musical, accessible) and the gaps found in the 2D version: no musicality, too few EIC frames, shallow accessibility, no audio export, sound not driven by real values.

First version target: playable start to finish, all six rounds, on a mid-range laptop and a recent phone.

## 2. Tech stack

Package manager and scripts: **bun**. Build tool: **Vite**. Language: plain JavaScript (ES modules), no framework.

| Package | Used for |
|---|---|
| `three` | Renderer, GLTF loading, skeletal animation, positional audio listener |
| `@dimforge/rapier3d-compat` | Physics and the kinematic character controller |
| `postprocessing` | Bloom, colour grading, vignette |
| `three.quarks` | Particles: leaves, dust, heat shimmer, scan wave |
| `gsap` | Camera moves and UI/object tweens |
| `nipplejs` | Touch joystick on phones |
| `vite` (dev) | Dev server and production build |
| `@gltf-transform/cli` (dev) | Compress and resize models |
| `playwright` (dev, already on the machine) | Automated smoke test and screenshots |

Music uses the browser's Web Audio API directly. No audio library and no audio files.

Versions: latest stable at install time, then locked by `bun.lock`.

## 3. Assets

All models are free. Preference is CC0 (no credit needed); CC-BY is allowed with a credit line in the game and README.

| Asset | Source | Licence | Fallback |
|---|---|---|---|
| Player child and townspeople, rigged with walk / run / idle / wave / cheer | Quaternius animated character packs | CC0 | KayKit characters (CC0) |
| Buildings, roads, street props | Kenney City Kit | CC0 | Simple boxes with window textures |
| Trees, plants, pond | Kenney Nature Kit / Quaternius nature | CC0 | Cone-and-cylinder trees |
| Rickshaw, tea stall, rooftop water tank | Poly Pizza (CC0 or CC-BY) | CC0 / CC-BY | Built in code from Three.js shapes |
| Echo drone | Built in code | — | — |
| Earth globe | Sphere + NASA frames already in repo | NASA, public | — |

Extra animations that the packs lack (planting, crouching) are faked with tweens in the first version. Mixamo clips can replace them later if the team supplies them, since Mixamo needs a login.

Asset budget after compression: models ≤ 5 MB, libraries ≤ 1.5 MB, NASA data ≤ 1 MB.

Network hosts that must be allowed to download assets: `quaternius.com`, `kenney.nl`, `poly.pizza`, and whichever file host those pages link to. Requested at the start of Phase 0.

## 4. NASA data (already in the repo)

| File | What it drives |
|---|---|
| `data/gistemp-global.csv` — GISTEMP global anomaly, 1880 onward | Globe time-lapse melody pitch |
| `assets/timelapse/nasa-gistemp-*.jpg` — nine frames, 1884–2022, NASA SVS 5060 | Globe texture per year |
| `assets/nasa-modis-dhaka-lst-*.png` — MODIS land surface temperature, April 2000/2010/2020/2024 | Where the city is hot in each round |
| `assets/nasa-modis-dhaka-ndvi-*.png` — MODIS monthly NDVI, same years | Where trees already stand |
| `data/power-dhaka-monthly.json` — NASA POWER, Dhaka monthly temperature and rain 2000–2024 | Heat-wave strength per round, rain rhythm |

Rule: the **street layout is invented, the heat is real**. The city is a grid of districts; each district's heat and greenness are sampled from the LST and NDVI images. The game says this on screen. Cooling effects of trees, roofs and ponds are game estimates and are labelled as such. 2035 and 2050 are imagined and labelled.

## 5. Game design

### Flow

Start → Echo's broken message → Earth Jukebox (globe) → Sound Lab → Quick Ears → six Dhaka rounds → Earth Record → ticket.

### Controls

- Keyboard: WASD or arrows to move, Shift to run, Space to jump, E to act, Q to ask Echo for a scan, 1–4 to pick a fix.
- Phone: joystick on the left, action buttons on the right.
- Camera follows behind the player; mouse or touch-drag rotates it.

### One round (about 60–90 seconds)

1. **Listen.** Echo warns of a heat wave. A rising sitar line plays from the direction of the hottest district.
2. **Find.** The player runs toward the sound. It gets louder, higher and faster with proximity. Echo's scan (Q) sends out a light wave and replays the cue.
3. **Protect.** Limited coins and a timer. Place fixes on the district.
4. **Heat wave hits.** Protected districts stay green and calm, people come out and cheer. Unprotected ones turn red and the music goes out of tune.
5. **Echo's report.** The real NASA image and numbers for that year, and one message fragment.

### Fixes

| Fix | Cost | Effect (game estimate) |
|---|---|---|
| Tree | 1 | Cools a small area |
| White roof | 2 | Stops one building trapping heat |
| Pond | 3 | Cools a larger area |
| Cooling centre | 4 | Protects people, does not cool the city |

### Rounds

| Round | Twist | Lesson |
|---|---|---|
| 2000 | One hot spot, generous time | Every place has a sound; hot is high |
| 2010 | Two hot spots | Compare two dates; two snapshots are not a trend |
| 2020 | One spot hidden from view, found by ear only; talk to a person on the street | A satellite sees the land surface, not how a person feels |
| 2024 | Hottest year, fewest coins | Budgets force choices; a cooling centre helps people, not the city |
| 2035 (imagined) | Choose clean energy or coal, parks or concrete | Today's choices shape the future |
| 2050 (imagined) | Final heat wave shaped by every earlier choice | The ending is ours to write |

Difficulty comes from the data: later years are hotter in the NASA record, and built-up area grows so there is less room for fixes.

### Scoring

- Score: share of Dhaka protected, as a percentage.
- One to three stars per round. Losing more than half the city repeats the round.
- Badges: Heat Hunter (found fast by ear), City Cooler (80 % or more), Future Maker (the calmer 2050).
- Listener bonus for finding a spot with the visual heat overlay switched off.

## 6. Music and sonification

Everything is synthesised live in the browser.

| Instrument | Method | Carries |
|---|---|---|
| Tanpura drone | Detuned oscillators with slow filter | Background; detunes as green cover falls |
| Sitar-like pluck | Karplus-Strong string | Heat melody |
| Bansuri-like flute | Sine plus breath noise | Cool and green areas |
| Tabla-like drum | Pitched sine drop plus noise | Rain rhythm |

| Data | Sound |
|---|---|
| Temperature (°C or anomaly) | Melody pitch, snapped to the scale |
| Share of hot districts | Scale tension: Bhupali → added flat second and sharp fourth |
| Rain (mm/day) | Drum tempo; silence in drought |
| NDVI | Flute presence and drone tuning |
| Position in the world | 3D direction and distance (HRTF panner) |
| Year | Base tempo rises slightly |
| Missing data | Rest plus a soft click |

Scales: Raga Bhupali (calm), Megh Malhar (rain), a Marwa-like set (heat). The existing filtered-noise texture stays as a quiet wind layer.

The Earth Record at the end replays all six rounds as one piece and can be downloaded as a WAV file.

## 7. Accessibility

- All menus, dialogue, HUD and the ticket are HTML over the canvas, so screen readers and keyboard focus work.
- Every sound cue has a written description in a live region.
- Positional audio lets a player navigate by ear; Echo also speaks direction in words ("the heat is ahead and to your left").
- Relaxed mode: no timer.
- Text-only mode: play the story and choices without sound or 3D.
- Audio legend: play "cool" and "hot" reference tones on demand.
- Vibration on phones when close to a hot spot.
- Reduced-motion setting disables camera shake and shimmer.
- Fallback: if WebGL is unavailable, the page offers the 2D version.

## 8. Project structure

```
game/
  index.html
  package.json, bun.lock, vite.config.js
  public/
    models/        compressed .glb files
    nasa/          images and data copied from initial/.../dist
  src/
    main.js        boot, loading screen, scene switching
    core/          renderer, loop, input, camera, physics, assets, save
    audio/         engine, instruments, scales, sonify, spatial, recorder
    data/          gistemp, power, image sampling (LST, NDVI)
    world/         globe, city, districts, props, people, effects
    player/        character controller, animation, Echo
    game/          rounds, fixes, scoring, story, state
    ui/            HUD, dialogue, menus, ticket, announcer
  tests/           Playwright smoke test
initial/           the 2D game, kept as fallback
docs/              this plan, asset credits
```

## 9. Phases

Each phase ends with a Playwright run, screenshots, and a push.

**Phase 0 — Setup.** Create `game/` with bun and Vite. Install packages. Download, compress and commit models. Copy NASA files. Record every asset and licence in `docs/CREDITS.md`.
*Done when:* `bun run dev` shows a lit test scene with one loaded model.

**Phase 1 — Player and movement.** Renderer, lighting, post-processing. Rapier world. Character with walk/run/idle/jump animations. Follow camera. Keyboard and touch input. A short test street with collisions.
*Done when:* the character runs around the test street on desktop and phone at a steady frame rate.

**Phase 2 — Music engine and 3D sound.** Four instruments, three scales, the mapping layer, positional sources, sound on/off, written cues. Sound Lab and Quick Ears rebuilt on the new engine.
*Done when:* a hidden beacon can be found by ear alone.

**Phase 3 — Dhaka from NASA data.** District grid sampled from LST and NDVI per year. Buildings, roads, trees, rickshaws, people. Heat look (colour, shimmer) and cool look (green, birds). Fix placement with coins.
*Done when:* 2000 and 2024 visibly and audibly differ, and a tree can be planted.

**Phase 4 — Rounds and game rules.** The round loop, timer, heat-wave resolution, people reacting, Echo's report, six rounds with their twists, the 2035 choices, score, stars, badges, save and replay.
*Done when:* the game can be played from 2000 to 2050 and can be lost.

**Phase 5 — Globe, record and ticket.** 3D Earth intro with the 1884–2022 time-lapse driven by GISTEMP. Fly-in from orbit to Dhaka. Earth Record playback and WAV download. Ticket with score.
*Done when:* the full flow runs from the title to the ticket.

**Phase 6 — Polish and release.** Accessibility modes, phone layout, performance pass, loading screen, WebGL fallback, README and guide rewritten, GitHub Pages deploy.
*Done when:* the public link works on a laptop and a phone.

## 10. Performance budget

- 60 fps on a mid-range laptop, 30 fps on a recent phone.
- Instanced meshes for buildings, trees and people; one shared material atlas where possible.
- Quality setting: low turns off post-processing and shadows and halves the crowd.
- Initial download under 8 MB.

## 11. Testing

- Playwright smoke test per phase: page loads, no console errors, player moves, a round completes.
- Screenshots at desktop and phone sizes.
- Manual listening checks cannot be automated; the audio graph is checked by measuring output level and pitch in the test page.

## 12. Deployment

GitHub Pages from a GitHub Actions workflow: `bun install`, `bun run build`, publish `game/dist`. The repository owner enables Pages once in Settings → Pages.

## 13. Risks

| Risk | Plan |
|---|---|
| No good free rickshaw model | Build one from shapes in code |
| Packs lack a planting animation | Tween-based stand-in; replace with Mixamo later |
| Slow phones | Quality setting and instancing; 2D fallback |
| Scope is two to three times the 2D plan | Phases are ordered so each one leaves a playable build |
| Science claims overreach | Fix effects labelled as game estimates; future labelled imagined; LST is not air temperature |

## 14. What the team needs to provide

Required: approve the network request for asset hosts; enable GitHub Pages once; give feedback after the first version.

Optional, after the first version: preferred character look, a rickshaw model, Mixamo animations, a team logo.

## 15. Changes made while building

- **Physics:** Rapier was replaced by a small circle-vs-box collision module (`game/src/core/collision.js`).
  Rapier's WebAssembly build is 1.65 MB gzipped on its own, above the 1.5 MB library budget, and the
  city only needs a character sliding along boxes.
- **Assets:** Kenney's site refuses automated downloads and the Quaternius Google Drive folder was over
  quota, so buildings come from KayKit City Builder Bits (the planned fallback) and characters, trees and
  props from Quaternius uploads on Poly Pizza. All CC0. See `docs/CREDITS.md`.
- **Data:** the LST and NDVI images are decoded back to numbers with the official GIBS colour maps
  (`game/scripts/build-data.js`), so the sound uses degrees Celsius and NDVI values, not image colour.
  In these images April 2020 has the hottest ground of the four years while NASA POWER has its April
  air as the coolest; the 2020 round uses this for its "surface is not air" lesson. 2024 has the
  hottest April air maximum.
- **Balance:** wave strength comes from NASA POWER April maximum air temperature plus a per-round game
  adjustment; coins were tuned by simulation (`game/tests/tune.js`) so that doing nothing loses every
  round and good play reaches two or three stars.
- **2D game removed:** at the owner's request the old 2D game (`initial/`) was deleted from the
  repository, along with the `classic/` fallback. Without WebGL the game now offers text-only mode.
  The 2D game remains in the git history (commits before this change).
