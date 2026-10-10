# Image sources and production uses

Retrieved September 29, 2026. These are contextual assets for the planned Earth Jukebox video. Original downloads are retained without edits. Keep all future image derivatives in this directory with their source recorded here.

## Earth opening

**File:** `earth-blue-marble-2002.jpg`

- Source page: [Blue Marble 2002](https://science.nasa.gov/resource/blue-marble-2002/).
- Download: [NASA original JPEG](https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/1/1-bluemarble_west-1.jpg).
- Credit: NASA's Earth Observatory.
- Context: Western Hemisphere Blue Marble composite. The publication page describes MODIS imagery combined across months; it is not a single live photograph or present-day condition.
- Use: opening and closing masked Earth image, atmosphere and orbit overlays as separate HTML/CSS layers.
- Limitation: do not use this hemisphere to pinpoint Dhaka. Transition to a separately constructed locator/city view. Check native resolution before large crops; do not claim a flat disk is a true rotating 3D globe.

## Dhaka urban context

**Files:** `dhaka-landsat-1988.jpg`, `dhaka-landsat-2022.jpg`

- Source page: [Rising Flood Risks in Bangladesh](https://science.nasa.gov/earth/earth-observatory/rising-flood-risks-in-bangladesh-150274/).
- Downloads: [1988 original](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/150000/150274/dhaka_tm_198850_lrg.jpg), [2022 original](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/150000/150274/dhaka_oli_202279_lrg.jpg).
- Dates/instruments: February 19, 1988, Landsat 5 Thematic Mapper; March 20, 2022, Landsat 8 Operational Land Imager.
- Credit: NASA Earth Observatory images by Lauren Dauphin, using Landsat data from the U.S. Geological Survey.
- Use: optional date-labeled urban-growth comparison; crop inside animated frames, use a reveal mask, add independent locator lines and labels. Keep map alignment consistent when comparing.
- Limitation: these are geographic and urban-growth context, not heat measurements, future projections, or images from the proposed game's round years. Do not recolor them as measured heat maps. The article's flood framing does not establish a quantified heat claim.

## Bangladesh at night

**File:** `bangladesh-night-lights-2021.jpg`

- Source page: [Rising Flood Risks in Bangladesh](https://science.nasa.gov/earth/earth-observatory/rising-flood-risks-in-bangladesh-150274/).
- Download: [2021 original](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/150000/150274/bangladesh_vir_2021335_lrg.jpg).
- Date/instrument: December 1, 2021, Suomi NPP VIIRS day-night band.
- Credit: NASA Earth Observatory image by Lauren Dauphin, using VIIRS day-night band data from the Suomi National Polar-orbiting Partnership.
- Use: optional regional context for the city introduction; animated routes, markers, and labels remain independent layers.
- Limitation: light brightness is not a temperature map or direct measure of individual household safety. Any schematic connections or pulses added by the project are decorative.

## User reference

**File:** `reference-judging.png`

- Source: image supplied by the user with this request.
- Use: planning reference for WHO, WHY, WHAT, and SO WHAT NEXT and the under-four-minute guidance.
- Do not insert as a raw slide in the motion graphics package. No external publication rights or status as final competition rules were established.

## Credit and adaptation notes

Follow the [NASA images and media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/). Preserve individual credits and avoid implying endorsement. These source pages credit NASA imagery; future downloads require their own source checks. NASA emblems are not included as project assets.

Use downloaded images as composition layers, not as screenshots of websites. Place source credits in relevant evidence scenes and the delivery credit list. Label any illustrative heat overlays or stylized city graphics separately from source imagery. None of these files establishes a verified Earth Information Center visual-frame integration; that remains a separate implementation task.

No AI-generated imagery is included in this initial library. Echo and the game UI are planned as editable HTML/CSS artwork.

## Usage in the implemented package (2026-09-29)

No new image files were added. All crops, masks and zooms are done in CSS; the originals are unchanged.

| File | Where it appears | On-screen label or credit |
| --- | --- | --- |
| `earth-blue-marble-2002.jpg` | s01 opening Earth, s07/s08 closing Earth (masked disk, slow drift) | Credited in the s08 end credits. Used as a generic Earth only, never to locate Dhaka. |
| `bangladesh-night-lights-2021.jpg` | s04 95.0–98.0 s, push-in to a "DHAKA" reticle | "NASA observation · Bangladesh at night · Suomi NPP VIIRS day-night band · 1 Dec 2021 · NASA Earth Observatory" |
| `dhaka-landsat-2022.jpg` | s04 97.4–99.2 s (before the stylized city); s05 evidence lane thumbnail; s05 frame-to-sound demo frame | "Dhaka · Landsat 8 OLI · 20 Mar 2022 · NASA Earth Observatory / USGS"; demo tagged "brightness is not temperature" |
| `dhaka-landsat-1988.jpg` | s05 evidence lane thumbnail (1988 vs 2022 urban context) | "Landsat 5 TM and Landsat 8 OLI · NASA Earth Observatory / USGS · urban-growth context only — not temperature" |
| `reference-judging.png` | Not used in the package (planning reference only) | — |

**Derived data.** `js/transect.js` is generated by `tools/make_transect.py`. It holds mean JPEG luma (0–255) sampled along one horizontal band (row 757, 24 px tall, x 450–1650) of `dhaka-landsat-2022.jpg`. It drives the s05 chart line and the demo pitches, and it is **not** calibrated reflectance or temperature.
