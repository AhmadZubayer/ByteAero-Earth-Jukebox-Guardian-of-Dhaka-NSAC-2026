// Dumps js/content.js + js/timeline.js as JSON for the Python audio build.
// Usage: node tools/dump-timeline.js > audio/src/timeline.json
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['js/content.js', 'js/transect.js', 'js/timeline.js'])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
process.stdout.write(JSON.stringify({ timeline: ctx.window.EJ_TIMELINE, content: ctx.window.EJ_CONTENT }, null, 1));
