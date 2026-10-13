'use strict';
const fs = require('node:fs');
const path = require('node:path');
const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
let html = read('index.html');
html = html.replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${read('styles.css')}\n</style>`);
html = html.replace('<script src="routing-core.js" defer></script>', () => `<script>\n${read('routing-core.js')}\n</script>`);
// app.js expects the DOM. Place it immediately before the closing body tag.
html = html.replace('  <script src="app.js" defer></script>\n', '');
html = html.replace('</body>', () => `<script>\n${read('app.js')}\n</script>\n</body>`);
fs.writeFileSync(path.join(__dirname, 'standalone.html'), html);
console.log('standalone.html updated');
