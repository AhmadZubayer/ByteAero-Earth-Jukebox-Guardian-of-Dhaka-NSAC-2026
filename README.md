# Earth Jukebox: Guardian of Dhaka

A 3D listening game about heat in Dhaka, made with real NASA Earth data, by Team BYTEAERO (AIUB, Dhaka)
for the NASA Space Apps Challenge 2026 challenge **The Earth Information Jukebox**.

You play a child in Dhaka with **Echo**, a small satellite-drone. Every round a heat wave is coming.
You find it **by listening**: a sitar line rises from the hottest part of the city, louder, higher and
faster as you get close, and glowing rings show where it comes from. Run there, plant trees, paint roofs white, dig ponds or open a cooling centre,
then watch the wave arrive. Six years: 2000, 2010, 2020 and 2024 use NASA data; 2035 and 2050 are
imagined and shaped by your choices. At the end your six years play back as one piece of music, the
**Earth Record**, which you can download as a WAV file, and you get a printable ticket.

- **Game:** [`game/`](game/). Player guide: [docs/GUIDE.md](docs/GUIDE.md).
- **Plan:** [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) · **Credits and licences:** [docs/CREDITS.md](docs/CREDITS.md) · **Team handoff and setup:** [docs/HANDOFF.md](docs/HANDOFF.md)

## Run it

Needs [bun](https://bun.sh).

```bash
cd game
bun install
bun run dev        # http://localhost:5173
bun run build      # production build in game/dist
bun run test       # smoke test of the build in a real browser (Playwright + Chrome)
```

Everything is bundled: the game works offline and makes no network requests at runtime.
Measured download: 0.3 MB for the title screen and 4.5 MB in total by the first Dhaka round (uncompressed; less when the host gzips). No requests go to other sites.

## How sight becomes sound

All music is synthesised live in the browser with the Web Audio API. There are no audio files.

| Data | Sound |
|---|---|
| Land surface temperature of a block (NASA MODIS) | Sitar-like pitch, snapped to the scale: hotter is higher |
| Share of the city in danger, plus overall heat | Scale tension: calm Raga Bhupali → tense Marwa-like notes |
| April rain (NASA POWER) | Tabla rhythm: silent in drought, busier with more rain; Megh Malhar scale when wet |
| Greenness, NDVI (NASA MODIS) | Bansuri-like flute presence; the tanpura drone drifts out of tune as green falls |
| Where a hot spot is | 3D (HRTF) direction and distance from the child |
| Year | Tempo rises slightly toward 2050 |
| Missing data | A rest with a soft click |
| Global temperature 1884–2022 (NASA GISTEMP) | The globe time-lapse melody, one note per year |

The audio is original and inspired by NASA's sonification work. It is not official NASA audio.

## What is real and what is not

- **Real:** each block's land surface temperature and NDVI, decoded from NASA MODIS images (via GIBS)
  for mid-April 2000, 2010, 2020 and 2024 using the official GIBS colour maps; NASA POWER April air
  temperature and rain for Dhaka; NASA SVS 5060 globe frames and GISTEMP global anomalies.
- **Invented:** the street layout (each block's numbers come from the matching part of the image),
  people, the story, and the imagined years 2035 and 2050 (not NASA projections).
- **Game estimates:** the size of each heat wave and how much each fix cools. They are labelled.
- **Careful wording:** land surface temperature is not air temperature or how hot a person feels;
  four April snapshots do not prove a climate trend. The game says both.

## Accessibility

Menus, dialogue, HUD, reports and the ticket are HTML over the 3D canvas, usable by keyboard and screen
reader. Every sound cue has a written description in a live region and as an on-screen caption; Echo
gives directions in words ("ahead and to your left"). Settings: relaxed mode (no timer), text-only mode
(the whole game as accessible pages, including a "play the city" sweep for finding heat by ear), heat
view on/off, reduced motion, captions, phone vibration near a hot spot, low graphics quality, and an
audio legend with cool and hot reference tones. Without WebGL the page offers text-only mode.

## Team

Developed and designed by Team BYTEAERO: KIYAS, ZUBAYER, ROHIT, PROMI, RAHUL, SHAFAYET — AIUB, Dhaka.

This is an independent Space Apps project, not an official NASA product.
