# Handoff: Earth Jukebox: Guardian of Dhaka (3D)

For the Team BYTEAERO member taking over. Written 12 November 2026.

> **বাংলায় সংক্ষেপে:** নিচের "One prompt for Claude Code" অংশের প্রম্পটটা Claude Code-এ পেস্ট করুন।
> Claude নিজেই সব সেটআপ করবে (bun, প্যাকেজ, টেস্ট), তারপর বাকি কাজের তালিকা থেকে পরের কাজ শুরু করবে।
> main ব্রাঞ্চে কিছু পাঠানো বা পাবলিশ করার আগে Claude আপনাকে জিজ্ঞেস করবে।

## Where things stand

- The 3D game is **finished and playable** from the title screen to the ticket: globe intro, tutorial,
  six Dhaka years, Earth Record (WAV download) and ticket.
- All work is on the branch **`claude/3d-game`**. `main` still has the old 2D game and old README.
  The 2D game was removed from `claude/3d-game` at the owner's request.
- **Not published yet.** The GitHub Pages workflow exists (`.github/workflows/pages.yml`) but has
  never run. See task 1 below.

## One prompt for Claude Code

Open this repository folder in Claude Code and paste:

```text
Read CLAUDE.md and docs/HANDOFF.md first. Then set this project up on my machine: install bun if it
is missing, check out the claude/3d-game branch, install packages, build, start the dev server, and run
the smoke test and the planting test. Tell me plainly what passed and what failed. Then start on the
first open task in the handoff's "Tasks left" list. Ask me before you push to main, publish anything,
or delete anything.
```

## Quick start by hand

You need **git**, **bun 1.4 or newer** (https://bun.sh, never use npm) and **Google Chrome** (for tests).

```bash
git clone https://github.com/Kiyas-Mahmud/dhaka-jukebox.git
cd dhaka-jukebox
git checkout claude/3d-game
cd game
bun install
bun run dev            # open http://localhost:5173/
```

Other commands, all run inside `game/`:

| Command | What it does |
|---|---|
| `bun run build` | Production build into `game/dist/` |
| `bun run preview` | Serve the build to check it |
| `bun run test` | Smoke test of the build in Chrome (run `bun run build` first) |
| `bun run check` | Build + smoke test + game-balance check |
| `bun run sources` | Re-download every raw model and the NASA colour maps into `game/.sources/` (~10 MB, not committed) |
| `bun run models` | Compress `.sources/` models into `public/models/` |
| `bun run data` | Rebuild `public/nasa/game-data.json` from the NASA files |

Tests that need the dev server running (`bun run dev` in another terminal), passing its address:

| Test | Checks |
|---|---|
| `bun tests/planting.js http://localhost:5173/` | Planting with E, the Place button and a click, in all six years and the tutorial |
| `bun tests/phase4.js http://localhost:5173/` | A scripted player plays all six years; doing nothing loses |
| `bun tests/phase2.js http://localhost:5173/` | Sound: stereo direction and an "ear-only" bot finds a hidden sound (takes ~2 min) |
| `bun tests/phase5.js http://localhost:5173/` | Globe, Earth Record and WAV download |
| `bun tests/phase6.js http://localhost:5173/` | Text-only mode, no-WebGL fallback, phone layout, frame rate |
| `bun tests/tune.js` | Game balance by simulation (no browser) |

Tests use `/usr/bin/google-chrome` with the real graphics card. Set `CHROME_PATH=/path/to/chrome` if
Chrome is elsewhere, or `GL=soft` to use software rendering (slow).

## What is where

```
game/
  index.html, src/style.css      HTML shell and all styles (UI is HTML over the 3D canvas)
  src/main.js                    boot, WebGL check, text-only fallback
  src/game/flow.js               title → story → globe → tutorial → 6 rounds → record → ticket; save/continue
  src/game/round.js              one year in 3D: find heat, mission card, guide arrow, fixes, heat wave
  src/game/heat.js               heat-wave rules (pure functions) and fix values (game estimates)
  src/game/rounds.js             the six years, district names, block layout from NDVI, 2035 choices
  src/game/learn.js              "Did you know?" facts and the quiz question for each year
  src/game/tutorial.js           5-step tutorial on the practice street
  src/game/textonly.js           the whole game as accessible pages (no 3D)
  src/game/globe-scene.js        GISTEMP globe time-lapse and fly-in
  src/game/ending.js             Earth Record (play + WAV) and the ticket
  src/audio/                     Web Audio engine, instruments, raga scales, data→music mapping, WAV export
  src/world/                     city, Dhaka buildings (code), landmarks per block, traffic, effects, globe
  src/player/                    child character, follow camera, Echo the drone
  src/ui/                        HUD + mission card, report + quiz, settings, tree picker, visualiser
  public/nasa/                   NASA images and data (bundled; no network at runtime)
  public/models/                 compressed CC0 models (0.7 MB)
  scripts/                       fetch-sources, build-models, build-data, GIBS colour maps
  tests/                         Playwright checks (see above)
docs/
  IMPLEMENTATION_PLAN.md         original plan + "Changes made while building"
  GUIDE.md                       player guide
  CREDITS.md                     every asset, source URL and licence
  HANDOFF.md                     this file
.github/workflows/pages.yml      build with bun and publish game/dist to GitHub Pages
```

## How the NASA data is used

- `public/nasa/nasa-modis-dhaka-lst-YYYY.png` and `…-ndvi-YYYY.png` (MODIS, April 2000/2010/2020/2024)
  are decoded back to °C and NDVI with the official GIBS colour maps (`scripts/colormaps/`), then averaged
  over a 5 × 5 grid of game blocks by `scripts/build-data.js` into `public/nasa/game-data.json`.
- `power-dhaka-monthly.json` (NASA POWER) gives April air temperature, hottest day and rain for each year.
- `gistemp-global.csv` drives the globe melody; `timelapse/*.jpg` are the NASA SVS 5060 frames
  (2048 × 1024). `bun scripts/fetch-sources.js .sources --frames` re-downloads the original TIFFs
  (~108 MB) and prints the conversion command.

## Rules to keep (the judges care about these)

1. **Science honesty.** Streets and block names are invented; each block's heat and green come from the
   NASA images (say so on screen). Land surface temperature is not air temperature or how hot it feels.
   Four April snapshots do not prove a trend. Cooling effects are **game estimates** (label them).
   2035 and 2050 are **imagined**, not NASA projections. The music is original, inspired by NASA
   sonification, not official NASA audio.
2. **Accessibility.** Every sound cue needs a written description (`say()` in `src/ui/announce.js`).
   Menus, HUD and reports stay real HTML. Keep keyboard play, text-only mode, relaxed mode, captions,
   reduced motion and the audio legend working.
3. **Size and offline.** Models ≤ 5 MB, libraries ≤ 1.5 MB, first load ≤ 8 MB (now about 4.5 MB).
   No network requests at runtime. Do not add large datasets or video.
4. **Assets.** CC0 where possible; record every new asset in `docs/CREDITS.md`.
5. **Tools.** bun only (not npm). Plain JavaScript, Vite. Music only with the Web Audio API.
6. **Git.** Work on `claude/3d-game` (or a branch from it). Do not rewrite or force-push history.
   Commit with your own name. No AI co-author lines in commit messages (team preference).

## Tasks left

1. **Publish the game (GitHub Pages).**
   - The repo owner (Kiyas) or anyone with admin rights: GitHub → Settings → Pages → Source:
     **GitHub Actions**. When last checked, the API still reported Pages as off.
   - Merge `claude/3d-game` into `main` (it is a fast-forward; `main` has no newer commits).
     This replaces the 2D game on `main`.
   - Pushing `main` runs `.github/workflows/pages.yml`. Check the Actions tab, then open the link
     (`https://kiyas-mahmud.github.io/dhaka-jukebox/`) and put it at the top of `README.md`.
2. **Test the public link** on a laptop and a real phone (Android Chrome and, if possible, an iPhone).
   Check sound starts after the first tap, the joystick and buttons work, and it runs smoothly.
   If slow, try Settings → Graphics quality → Low.
3. **Listen** with headphones: is the music pleasant, and can you find the heat by ear?
4. **Screen reader check**: NVDA (Windows), VoiceOver (Mac/iPhone) or TalkBack (Android). Play the
   tutorial and one year in text-only mode; every screen and sound should be announced.
5. **Space Apps submission**: project summary, demo (check the current rules for video length or slide
   count), links to the game and this repo, and the NASA data list from `docs/CREDITS.md`.
6. **Optional polish**: a real pedalling animation for rickshaw pullers, buses and cars, moving
   passengers, a child-proportioned player model, the team logo on the title screen, the mission card in
   text-only mode.

## Known issues

- Frame rate on the test laptop (AMD Ryzen iGPU): about 60 fps at 1366 × 768, 45–55 fps at 1600 × 1000.
  Real phones are untested.
- The player is an adult model scaled to child size. The rickshaw puller uses a walking animation.
- In the hidden-heat year (2020) there is deliberately no arrow until the heat is found by ear.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Port 5173 is in use` | Another dev server is running; use the address Vite prints, or stop the other one (Ctrl+C) |
| `bun: command not found` | Install bun: `curl -fsSL https://bun.sh/install \| bash`, then open a new terminal |
| Tests cannot find Chrome | `CHROME_PATH=/path/to/chrome bun tests/smoke.js` |
| Game starts mid-way | Progress is saved in the browser; click **New game** on the title screen |
| Page shows "cannot show the 3D city" | Turn on hardware acceleration in the browser settings, or use text-only mode |
