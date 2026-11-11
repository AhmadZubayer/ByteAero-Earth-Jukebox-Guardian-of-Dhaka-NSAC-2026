import { launch } from './browser.js';
const b = await launch(); const p = await b.newPage();
await p.goto(process.argv[2] || 'http://localhost:5199/?scene=street');
await p.waitForFunction('window.__ready === true', null, { timeout: 60000 });
await p.waitForTimeout(3500);
console.log(process.env.GL || 'swiftshader', await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return (e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?') + ' fps=' + window.__fps; }));
await b.close();
