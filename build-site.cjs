'use strict';
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname, 'public');
fs.mkdirSync(output, { recursive: true });
const files = ['index.html', 'styles.css', 'app.js', 'routing-core.js', 'hardware-design.md'];
for (const name of files) fs.copyFileSync(path.join(__dirname, name), path.join(output, name));
console.log(`Static build ready: ${files.length} web files in public/`);
