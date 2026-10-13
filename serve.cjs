'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.VOICE_BENCH_PORT || 8787);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end('Method not allowed'); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch (_) { res.writeHead(400); res.end('Invalid URL'); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(), microphone=(self)' });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  });
});
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Set VOICE_BENCH_PORT to another port and retry.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`Voice continuity bench: http://localhost:${port}\nLocal only. Press Ctrl+C to stop.`));
