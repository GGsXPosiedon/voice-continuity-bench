'use strict';
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const output = path.join(__dirname, 'public');
fs.mkdirSync(output, { recursive: true });
const files = ['index.html', 'styles.css', 'hardware-design.md'];
for (const name of files) fs.copyFileSync(path.join(__dirname, name), path.join(output, name));
esbuild.buildSync({ entryPoints: [path.join(__dirname, 'src/app.ts')], bundle: true,
  outfile: path.join(output, 'app.js'), format: 'iife', target: 'es2022',
  minify: true, sourcemap: false, legalComments: 'none' });
// Isolated Node build of the same policy source for deterministic tests.
esbuild.buildSync({ entryPoints: [path.join(__dirname, 'src/router.ts')], bundle: true,
  outfile: path.join(__dirname, '.test-build/router.cjs'), platform: 'node', format: 'cjs', target: 'node22' });
esbuild.buildSync({ entryPoints: [path.join(__dirname, 'src/motion.ts')], bundle: true,
  outfile: path.join(__dirname, '.test-build/motion.cjs'), platform: 'node', format: 'cjs', target: 'node22' });
// Remove one legacy generated asset from the previous version, within output only.
const legacyRouter = path.join(output, 'routing-core.js');
if (fs.existsSync(legacyRouter)) fs.unlinkSync(legacyRouter);
console.log('Static build ready: TypeScript browser bundle and three static files in public/');
