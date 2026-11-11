import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { createReadStream, existsSync, statSync } from 'node:fs';

// The 2D game in ../initial is the fallback for devices without WebGL.
// In dev it is served at /classic/; `bun run build` copies it into dist/classic/.
const classicDir = resolve(import.meta.dirname, '../initial/sites/earth-jukebox-dhaka/dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.csv': 'text/csv', '.ttf': 'font/ttf', '.txt': 'text/plain' };

export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 900, assetsInlineLimit: 0 },
  plugins: [{
    name: 'serve-classic',
    configureServer(server) {
      server.middlewares.use('/classic', (req, res, next) => {
        const path = decodeURIComponent((req.url || '/').split('?')[0]);
        const file = resolve(classicDir, '.' + (path.endsWith('/') ? path + 'index.html' : path));
        if (!file.startsWith(classicDir) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', types[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
  }],
});
