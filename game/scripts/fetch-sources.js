// Re-download every outside source used by the game into a raw folder (not committed).
// The compressed results are already in public/, so this is only needed to rebuild them.
//
//   bun scripts/fetch-sources.js .sources            models + GIBS colour maps (~10 MB)
//   bun scripts/fetch-sources.js .sources --frames   also the nine 2048x1024 NASA SVS globe TIFFs (~108 MB)
//
// Then:  bun scripts/build-models.js .sources   (compress models into public/models)
//        bun scripts/build-data.js              (rebuild public/nasa/game-data.json)
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';

const out = resolve(process.argv[2] || '.sources');
const wantFrames = process.argv.includes('--frames');
const UA = { 'User-Agent': 'earth-jukebox-build/1.0' };

// Poly Pizza (Quaternius, CC0). Page ids are in docs/CREDITS.md.
const POLY = {
  'casual-character': '90a9e2d4-053f-42f1-99a2-8f5e1180ea7f',
  'woman-casual': '51d5abdd-bb87-4b8d-9967-21738ffb8437',
  'palm-tree2': '21d44b5b-efef-4abd-96ad-fc59e4ad373b',
  tree4: 'a2102cc2-cbe7-4bd0-8bc5-c0d4ee6e9e0d',
  tree3: '36ada9ac-2071-49f7-9e09-cda4add8589b',
  bird: 'bc6de37a-fdc5-4ef2-85c6-4a2e7b5db9d5',
  lilypad: 'ae432cca-6422-42ef-a982-b74bd0fc99b2',
  'solar-panel': '7a7d151e-b40a-4f5f-9372-7d5c9fb18072',
};
// KayKit City Builder Bits (CC0) on GitHub.
const KAYKIT = 'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/main/addons/kaykit_city_builder_bits/Assets/gltf/';
const KAYKIT_FILES = ['bench', 'bush', 'streetlight'];
// NASA GIBS colour maps for decoding the MODIS images back to numbers.
const COLORMAPS = {
  lst: 'https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Land_Surface_Temp.xml',
  ndvi: 'https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_NDVI.xml',
};
// NASA SVS 5060 Science On a Sphere frames, 2048 x 1024.
const SVS = 'https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005060/frames/2048x1024_2x1_30p/SOSGISS2022c-Rolling1peryear/SOSGISS2022c-Rolling1peryear-SOSRollingAverageperyear.';
const FRAME_YEARS = [1884, 1900, 1920, 1940, 1960, 1980, 2000, 2010, 2022];

async function get(url, file) {
  if (existsSync(file)) { console.log('  have', file.replace(out + '/', '')); return readFileSync(file); }
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
  console.log('  got ', file.replace(out + '/', ''), `${(buf.length / 1024).toFixed(0)} KB`);
  return buf;
}

console.log('Poly Pizza models');
for (const [name, id] of Object.entries(POLY)) await get(`https://static.poly.pizza/${id}.glb`, join(out, 'pp', `${name}.glb`));

console.log('KayKit models (glTF plus the files they point to)');
for (const name of KAYKIT_FILES) {
  const gltf = JSON.parse((await get(`${KAYKIT}${name}.gltf`, join(out, 'kaykit', `${name}.gltf`))).toString());
  for (const ref of [...(gltf.buffers || []), ...(gltf.images || [])]) if (ref.uri && !ref.uri.startsWith('data:')) await get(KAYKIT + ref.uri, join(out, 'kaykit', ref.uri));
}

console.log('NASA GIBS colour maps -> scripts/colormaps/*.json');
for (const [name, url] of Object.entries(COLORMAPS)) {
  const xml = (await get(url, join(out, 'gibs', `${name}.xml`))).toString();
  const entries = [];
  for (const line of xml.match(/<ColorMapEntry [^>]*\/>/g) || []) {
    if (line.includes('nodata="true"')) continue;
    const rgb = line.match(/rgb="(\d+),(\d+),(\d+)"/), v = line.match(/value="\[([-\d.]+),([-\d.]+)\)"/);
    if (!rgb || !v) continue;
    entries.push([+rgb[1], +rgb[2], +rgb[3], +v[1], +v[2], line.includes('transparent="true"') ? 1 : 0]);
  }
  const json = { source: url, units: name === 'lst' ? 'K' : 'NDVI', format: '[r,g,b,low,high,transparent]', entries };
  writeFileSync(resolve(import.meta.dir, 'colormaps', `${name}.json`), JSON.stringify(json));
  console.log(`  ${name}: ${entries.length} colours`);
}

if (wantFrames) {
  console.log('NASA SVS 5060 globe frames (12 MB each)');
  for (const y of FRAME_YEARS) await get(`${SVS}${y}.tif`, join(out, 'svs', `${y}.tif`));
  console.log('\nConvert them to the JPEGs the game uses (needs Python with Pillow):');
  console.log(`  python3 -c "from PIL import Image; [Image.open('${out}/svs/%d.tif' % y).convert('RGB').save('public/nasa/timelapse/nasa-gistemp-%d.jpg' % y, 'JPEG', quality=86, optimize=True, progressive=True, subsampling=0) for y in [${FRAME_YEARS.join(', ')}]]"`);
}
console.log(`\nDone. Next: bun scripts/build-models.js ${process.argv[2] || '.sources'}`);
