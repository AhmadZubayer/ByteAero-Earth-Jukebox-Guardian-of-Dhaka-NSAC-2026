# Earth Jukebox: Guardian of Dhaka

A static, browser-based NASA Space Apps Challenge 2026 game concept.

## How it works

- The frame jukebox displays two local NASA Scientific Visualization Studio frames that are used by the Earth Information Center global temperature view. In the browser, a canvas samples pixels every seven pixels and classifies warm and cool color areas. A left-to-right scan plays separate original bell and soft-string voices. Vertical image position sets pitch, pixel brightness sets loudness, and horizontal position sets stereo pan. This is a visual art mapping, not a temperature estimate.
- The Sound Lab uses sliders to teach heat, rain, and greenery sound rules. These slider values are illustrative.
- Quick Ears uses five sounds, with three correct answers required before the Dhaka game unlocks.
- The 2000, 2010, 2020, and 2024 Dhaka rounds each display a locally bundled, unaltered NASA GIBS rendering of the Terra MODIS eight-day daytime land surface temperature layer (MOD11A2). The WMS requests use April 15 of each year, a bounding box of 89.95–90.85° E and 23.50–24.15° N, and the same 1000 × 800 image size. These are surface-temperature snapshots, not air-temperature readings or a climate trend. Missing observations may appear gray.
- The 2035 and 2050 rounds display the observed 2024 image as historical context, clearly labeled as such. The six district buttons, warmer game signals, costs, intervention effects, scores, and future story paths remain illustrative. They do not claim to represent measured neighborhood conditions, intervention efficacy, or NASA projections. MODIS/VIIRS active-fire hotspots were not used, since those detections do not measure ordinary urban heat.
- Browser Web Audio creates sound when the player turns it on. Every signal also has text. The experience works without sound, supports keyboard controls and reduced-motion settings, and prints a boarding pass.

## Sources

- Challenge: https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/
- EIC global temperature visualization: https://earth.gov/sealevel/global-temperature-overlay/
- NASA SVS visualization 5060 and image credits: https://svs.gsfc.nasa.gov/5060/
- Home Video font by GGBotNet, CC0: https://ggbot.itch.io/home-video-font/
- NASA sonification examples and method inspiration: https://www.nasa.gov/universe/data-sonification-a-new-cosmic-triad-of-sound/
- NASA GIBS MODIS land surface temperature layer metadata: https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/MODIS_Terra_L3_Land_Surface_Temp_8Day_Day.json
- NASA MODIS land surface temperature products: https://modis.gsfc.nasa.gov/data/dataprod/mod11.php
- NASA FIRMS active-fire definition (why this was not used for the urban heat map): https://firms.modaps.eosdis.nasa.gov/
- Local Earth imagery from the existing project image library. See `../../image/SOURCES.md`.

The Home Video font currently loads from GGBotNet's public GitHub repository via jsDelivr. The NASA visualization frames, four Dhaka surface-temperature maps, and Earth image are bundled locally in `dist/assets/`.
