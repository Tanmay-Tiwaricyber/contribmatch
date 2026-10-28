/**
 * A very small static file server.
 *
 * The audit tools need a server to load the pages from. Rather than ask the
 * reader to start one in another terminal, they can start this, run, and
 * stop it again. No dependencies.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
};

/**
 * Start a static server.
 * @param {{root?: string, port?: number}} [options]
 * @returns {Promise<{url: string, close: () => Promise<void>}>}
 */
export function startStaticServer(options = {}) {
  const root = options.root || process.cwd();
  const port = options.port || 0;

  const server = createServer(async (req, res) => {
    try {
      const requested = decodeURIComponent((req.url || '/').split('?')[0]);
      let path = normalize(join(root, requested));

      // Never serve anything outside the root.
      if (!path.startsWith(root + sep) && path !== root) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      let info = await stat(path).catch(() => null);
      if (info && info.isDirectory()) {
        path = join(path, 'index.html');
        info = await stat(path).catch(() => null);
      }
      if (!info) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
        return;
      }

      const body = await readFile(path);
      res.writeHead(200, {
        'content-type': TYPES[extname(path).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch (err) {
      res.writeHead(500, { 'content-type': 'text/plain' }).end(String(err));
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

/**
 * Check whether a URL is already serving something.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function isServing(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}
