# Earth Jukebox: Guardian of Dhaka

An interactive, browser-based Earth sound story for the NASA Space Apps Challenge 2026. Open `dist/index.html` in a local web server, or visit the published Site. The in-game **Guide** button opens `dist/guide.html`, a visual guide to the opening, all six rounds, the Earth record, and the ticket. The [player journey](plan.md) is the longer written plan.

## Journey

The player meets Echo, scans two real NASA Earth Information Center global temperature frames, practices three sound textures, and follows six Dhaka story years. The 2000, 2010, 2020, and 2024 rounds use local NASA Terra MODIS daytime land surface temperature images. The 2035 and 2050 scenes are explicitly imagined; they display the real 2024 map only as a dated reference. The player finishes with a six-image sound record and a personalized printable ticket.

Each year has a different interaction: listen within an image, compare two dated images, ask about an imagined walk to school, choose a people-focused action, choose a future path, and send back a lesson. There is no timed district clicker.

## How the sound works

Sound is generated in the browser during each image scan. A canvas samples the locally bundled image. A left-to-right playhead triggers short noise grains. Image position sets stereo position and each grain's frequency band; brightness sets level. Warm and cool color features use separate bands. This makes a changing, non-melodic texture linked to the displayed pixels. The Sound Lab and Quick Ears use clearly marked practice textures.

This is an original sonification **inspired by NASA's spatial sweep and layered mappings**, not an official NASA recording or a temperature measurement. The MODIS images supplied here are rendered color views, not numeric raster values. Their sound conveys image structure; it does not encode degrees Celsius. The real-image and imagined-story labels remain visible throughout.

Sound needs a user click to start. All sound cues have written descriptions. The game supports keyboard controls and reduced-motion settings; the ticket can be printed.

## Science notes

- The global frames show temperature anomaly relative to a 1951–1980 average. They are not Dhaka air temperature.
- The Dhaka images are eight-day **land surface** temperature views requested for April 15 in the four observed years. They are not street-level air-temperature readings, and four snapshots alone do not prove a climate trend.
- Future stories, illustrated people and streets, choices, and outcomes are fictional. A cooling center is shown as a place that helps people during heat, not as something that cools a whole city.
- MODIS/VIIRS active-fire hotspots are not used as ordinary urban-heat readings.

## Sources

- [The Earth Information Jukebox challenge](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/)
- [Earth Information Center global temperature view](https://earth.gov/sealevel/global-temperature-overlay/)
- [NASA SVS global temperature visualization 5060](https://svs.gsfc.nasa.gov/5060/)
- [NASA sonification examples and method](https://www.nasa.gov/universe/data-sonification-a-new-cosmic-triad-of-sound/)
- [NASA GIBS MODIS land surface temperature layer](https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/MODIS_Terra_L3_Land_Surface_Temp_8Day_Day.json)
- [NASA MODIS land surface temperature products](https://modis.gsfc.nasa.gov/data/dataprod/mod11.php)
- [NASA FIRMS active-fire definition](https://firms.modaps.eosdis.nasa.gov/)
- [Home Video font by GGBotNet, CC0](https://ggbot.itch.io/home-video-font/)

Home Video Regular and Bold are bundled in `dist/fonts/` under CC0 and used for all game text. All NASA images used in the experience are bundled in `dist/assets/`. This is an independent Space Apps project, not an official NASA product.
