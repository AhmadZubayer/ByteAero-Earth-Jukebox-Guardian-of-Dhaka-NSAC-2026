# Credits and licences — Earth Jukebox 3D (`game/`)

Every outside file used by the 3D game is listed here. Models were compressed with
`game/scripts/build-models.js` (gltf-transform, meshopt geometry, WebP textures ≤ 512 px).
The compressed copies live in `game/public/models/`.

## 3D models

| File in `game/public/models/` | Original | Author | Source | Licence |
|---|---|---|---|---|
| `person-c.glb` (player child, townspeople) | Casual Character | Quaternius | https://poly.pizza/m/kZ3DmIoGip | CC0 1.0 |
| `person-a.glb` (townspeople) | Woman Casual | Quaternius | https://poly.pizza/m/jpKRgGDxhk | CC0 1.0 |
| `palm.glb` | Palm Tree | Quaternius | https://poly.pizza/m/DsrrAYmucG | CC0 1.0 |
| `tree-round.glb` | Tree | Quaternius | https://poly.pizza/m/i4QMw4L64D | CC0 1.0 |
| `tree-tall.glb` | Tree | Quaternius | https://poly.pizza/m/9nvGuZlbpE | CC0 1.0 |
| `bird.glb` | Bird | Quaternius | https://poly.pizza/m/gYYC0gYMnw | CC0 1.0 |
| `lilypad.glb` | Lilypad | Quaternius | https://poly.pizza/m/TI6ukUlsLh | CC0 1.0 |
| `solar.glb` | Solar Panel | Quaternius | https://poly.pizza/m/ah89Y79JdT | CC0 1.0 |
| `bld-a.glb` … `bld-h.glb` | building_A … building_H | Kay Lousberg (KayKit City Builder Bits 1.0) | https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0 | CC0 1.0 |
| `bench.glb`, `bush.glb`, `car-taxi.glb`, `car-hatch.glb`, `streetlight.glb`, `watertower.glb`, `dumpster.glb` | bench, bush, car_taxi, car_hatchback, streetlight, watertower, dumpster | Kay Lousberg (KayKit City Builder Bits 1.0) | same as above | CC0 1.0 |

Built in code (no outside file): Echo the drone, the cycle rickshaws, the tea stall, kites,
ponds, cooling centres, white roofs, the globe, all ground textures.

Notes on sourcing:

- Kenney's website refuses automated downloads, and Kenney's City Kit is not mirrored on GitHub
  by Kenney, so the KayKit city pack (the plan's named fallback, also CC0) supplies the buildings.
- The Quaternius "Ultimate Animated Character" Google Drive folder hit its download quota, so the
  same author's single-character uploads on Poly Pizza were used.
- No free rickshaw, tea stall or rooftop water tank model of the right style was found on
  Poly Pizza; the rickshaw and tea stall are built from shapes, the water tank comes from KayKit.

## Font

| File | Author | Source | Licence |
|---|---|---|---|
| `game/public/fonts/HomeVideo-*.ttf` | GGBotNet | https://ggbot.itch.io/home-video-font | CC0 1.0 |

## NASA data and images (public domain, NASA)

| File in `game/public/nasa/` | What it is | Source |
|---|---|---|
| `timelapse/nasa-gistemp-YYYY.jpg` | Global temperature anomaly frames 1884–2022, 2048 × 1024 (nine years) | NASA Scientific Visualization Studio, visualization 5060, https://svs.gsfc.nasa.gov/5060/ — Science On a Sphere frames `SOSGISS2022c-Rolling1peryear` (2048x1024), converted from TIFF to JPEG (quality 86). Also on the Earth Information Center, https://earth.gov/ |
| `gistemp-global.csv` | GISTEMP v4 global land-ocean anomaly, monthly and annual | NASA GISS, https://data.giss.nasa.gov/gistemp/ |
| `nasa-modis-dhaka-lst-YYYY.png` | MODIS Terra 8-day daytime land surface temperature, mid-April 2000/2010/2020/2024 | NASA GIBS / Worldview, layer `MODIS_Terra_L3_Land_Surface_Temp_8Day_Day` |
| `nasa-modis-dhaka-ndvi-YYYY.png` | MODIS monthly NDVI, April of the same years | NASA GIBS / Worldview |
| `power-dhaka-monthly.json` | NASA POWER monthly T2M, T2M_MAX, PRECTOTCORR for 23.81 N, 90.41 E, 2000–2024 | NASA POWER, https://power.larc.nasa.gov/ |
| `earth-blue-marble-2002.jpg` | Blue Marble Earth image | NASA Visible Earth |
| `game-data.json` | Derived by `game/scripts/build-data.js` from the files above | — |

Colour-map tables used to turn the LST and NDVI images back into numbers
(`game/scripts/colormaps/*.json`) were converted from the official GIBS colour maps:
https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Land_Surface_Temp.xml and
https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_NDVI.xml

## Software (bundled into the build)

| Package | Licence |
|---|---|
| three | MIT |
| postprocessing | Zlib |
| three.quarks | MIT |
| gsap | GreenSock Standard "no charge" licence |
| nipplejs | MIT |

Build tools only (not shipped): vite (MIT), @gltf-transform/cli (MIT), playwright (Apache-2.0), pngjs (MIT).

## Sound

All sound is synthesised live in the browser with the Web Audio API. There are no audio files.
The music is original, inspired by NASA's sonification work; it is not official NASA audio.

This is an independent NASA Space Apps Challenge project by Team BYTEAERO. It is not an official
NASA product and is not endorsed by NASA.
