#!/usr/bin/env node
/**
 * Dev server for local verification (static files only).
 * Adds an early error-capture script to HTML so module-load/init failures
 * are visible in the console before any code rewrites them.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.xml': 'text/xml', '.txt': 'text/plain',
};
const HOOK = `<script>
  window.__cmErr = [];
  window.addEventListener('error', (e) => { const m = '[error] ' + (e.message || String(e.error || e)); window.__cmErr.push(m); console.error(m); }, true);
  window.addEventListener('unhandledrejection', (e) => { const m = '[rejection] ' + String(e.reason && (e.reason.stack || e.reason.message) || e.reason); window.__cmErr.push(m); console.error(m); }, true);
  window.addEventListener('DOMContentLoaded', () => setTimeout(() => { console.log('[cm-check] hooks alive, listeners=' + String(!!document.getElementById('matcher-form'))); }, 50));
</script>`;

const root = process.cwd();
http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  let file = path.join(root, urlPath);
  if (urlPath.endsWith('/')) file = path.join(file, 'index.html');
  try {
    const data = await readFile(file);
    let out = data;
    if (file.endsWith('.html')) {
      const text = data.toString('utf8').replace('<head>', '<head>' + HOOK);
      out = Buffer.from(text, 'utf8');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(out);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(3000, () => console.log('dev server (with error hook) on 3000'));
