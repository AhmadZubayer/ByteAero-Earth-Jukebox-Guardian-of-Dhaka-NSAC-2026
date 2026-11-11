// Compress the chosen CC0 source models into public/models/.
// Usage: bun scripts/build-models.js <raw-dir>
// <raw-dir> must contain the subfolders pp/ (Poly Pizza), kaykit/ (KayKit City Builder Bits glTF).
// Sources and licences are listed in docs/CREDITS.md.
import { spawnSync } from 'node:child_process';
import { statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raw = resolve(process.argv[2] || '');
const out = resolve(import.meta.dir, '../public/models');
mkdirSync(out, { recursive: true });

// [output name, source path relative to raw dir, keep named materials (characters are recoloured in code)]
const MODELS = [
  ['person-a', 'pp/woman-casual.glb', true],
  ['person-c', 'pp/casual-character.glb', true], // also the player, scaled to child size in code
  ['palm', 'pp/palm-tree2.glb'],
  ['tree-round', 'pp/tree4.glb'],
  ['tree-tall', 'pp/tree3.glb'],
  ['bird', 'pp/bird.glb'],
  ['lilypad', 'pp/lilypad.glb'],
  ['solar', 'pp/solar-panel.glb'],
  ...['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((l) => [`bld-${l.toLowerCase()}`, `kaykit/building_${l}.gltf`]),
  ['bench', 'kaykit/bench.gltf'],
  ['bush', 'kaykit/bush.gltf'],
  ['car-taxi', 'kaykit/car_taxi.gltf'],
  ['car-hatch', 'kaykit/car_hatchback.gltf'],
  ['streetlight', 'kaykit/streetlight.gltf'],
  ['watertower', 'kaykit/watertower.gltf'],
  ['dumpster', 'kaykit/dumpster.gltf'],
];

const cli = resolve(import.meta.dir, '../node_modules/.bin/gltf-transform');
let total = 0;
const manifest = {};
for (const [name, src, keepMaterials] of MODELS) {
  const input = join(raw, src);
  const output = join(out, `${name}.glb`);
  const r = spawnSync(cli, ['optimize', input, output, '--compress', 'meshopt', '--texture-compress', 'webp',
    '--texture-size', '512', '--simplify', 'false', '--instance', 'false', '--flatten', 'false', '--join', 'false', ...(keepMaterials ? ['--palette', 'false'] : [])], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(name, r.stderr || r.stdout); process.exit(1); }
  const size = statSync(output).size;
  total += size;
  manifest[name] = size;
  console.log(name.padEnd(14), (size / 1024).toFixed(1), 'KB');
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log('TOTAL', (total / 1024 / 1024).toFixed(2), 'MB');
