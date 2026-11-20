/** Tiny local static server for the harness. Binds 127.0.0.1 only. */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModule } from '../harness/load-module.js';

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };

const listAnims = () => ['anims', 'examples', 'skill/templates'].flatMap((dir) => {
  const abs = join(ROOT, dir);
  return existsSync(abs) ? readdirSync(abs).filter((f) => f.endsWith('.yaml')).map((f) => dir + '/' + f) : [];
});

export function serve({ port = 0 } = {}) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const send = (code, body, type = 'text/plain') => { res.writeHead(code, { 'content-type': type + '; charset=utf-8' }); res.end(body); };
    try {
      if (url.pathname === '/__list') return send(200, JSON.stringify(listAnims()), 'application/json');
      if (url.pathname === '/__module') {
        const file = resolve(ROOT, url.searchParams.get('file') || '');
        if (!file.startsWith(ROOT + sep) || !file.endsWith('.yaml') || !existsSync(file)) return send(404, 'not a yaml file');
        const { js, css, html } = loadModule(file);
        return send(200, JSON.stringify({ js, css, html }), 'application/json');
      }
      const file = normalize(join(ROOT, decodeURIComponent(url.pathname === '/' ? '/harness/preview.html' : url.pathname)));
      if (!file.startsWith(ROOT + sep) || !existsSync(file) || !statSync(file).isFile()) return send(404, 'not found');
      return send(200, readFileSync(file), TYPES[extname(file)] || 'application/octet-stream');
    } catch (e) {
      return send(500, String(e.message || e));
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({
    url: 'http://127.0.0.1:' + server.address().port,
    close: () => new Promise((done) => server.close(done)),
  })));
}
