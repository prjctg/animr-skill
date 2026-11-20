#!/usr/bin/env node
/**
 * Privacy scan: fail if the repo mentions private project details.
 *   npm run scan                      scan the repo (exit 1 on a hit)
 *   npm run scan -- --gen <anims-dir> (maintainers) regenerate tools/denylist.json from a directory of
 *                                     private *.yaml files; only SHA-256 hashes of the hyphenated names are stored
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DENY = join(ROOT, 'tools', 'denylist.json');
const SKIP = new Set(['node_modules', '.git', 'out', 'dist', '.cache', '.scratch']);
const sha = (s) => createHash('sha256').update(s).digest('hex');
// Hyphenated words only: single-word names collide with ordinary English.
// Ordinary English that happens to equal a private name; not a leak.
const COMMON = new Set(['one-line']);
const WORD = /[a-z][a-z0-9]*(?:-[a-z0-9]+)+/g;

// Built from fragments so this file does not contain the literals it searches for.
const LITERALS = [
  ['prjctg', '-ui'], ['localhost', ':8080'], ['app', 'spot'], ['242', '525'], ['src', '/utils'], ['g', '-src'],
  ['Red', 'ux'], ['pnpm run ', 'catalog'], ['post', 'Message'], ['test:', 'anim'],
].map((p) => p.join(''));

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(md|mjs|js|json|ya?ml|html|ts|txt)$/.test(name) && name !== 'denylist.json' && name !== 'package-lock.json') yield p;
  }
}

export function scan(root = ROOT) {
  const hashes = new Set(existsSync(DENY) ? JSON.parse(readFileSync(DENY, 'utf8')).hashes : []);
  const hits = [];
  for (const f of files(root)) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const lit of LITERALS) if (line.includes(lit)) hits.push(`${relative(root, f)}:${i + 1} literal "${lit}"`);
      for (const m of line.toLowerCase().matchAll(WORD)) {
        if (COMMON.has(m[0])) continue;
        const w = m[0].replace(/-\d+$/, '');
        if (hashes.has(sha(m[0])) || hashes.has(sha(w))) hits.push(`${relative(root, f)}:${i + 1} private anim name (hash match)`);
      }
    });
  }
  return { hits, hashed: hashes.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const gi = process.argv.indexOf('--gen');
  if (gi > 0) {
    const dir = resolve(process.argv[gi + 1]);
    const names = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).map((f) => f.replace(/@.*$/, '').replace(/\.ya?ml$/, '').toLowerCase()).filter((n) => n.includes('-'));
    const hashes = [...new Set(names.map(sha))].sort();
    writeFileSync(DENY, JSON.stringify({ note: 'sha256 of private hyphenated names; regenerate with --gen', hashes }, null, 1));
    console.log(`wrote ${hashes.length} hashes to tools/denylist.json`);
  } else {
    const { hits, hashed } = scan();
    if (hits.length) { console.error(hits.join('\n')); console.error(`\n${hits.length} private reference(s) found`); process.exit(1); }
    console.log(`scan clean (${LITERALS.length} literals, ${hashed} hashed names${hashed ? '' : ': denylist.json missing, run --gen'})`);
  }
}
