// Copies the 2D game into dist/classic/ so the WebGL fallback link works on the published site.
import { cpSync } from 'node:fs';
import { resolve } from 'node:path';
const from = resolve(import.meta.dir, '../../initial/sites/earth-jukebox-dhaka/dist');
const to = resolve(import.meta.dir, '../dist/classic');
cpSync(from, to, { recursive: true });
console.log('copied 2D game to', to);
