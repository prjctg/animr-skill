#!/usr/bin/env node
/**
 * Scaffold a new module from a backend template.
 *
 *   npm run new -- drifting-type --backend canvas2d     (canvas2d | svg | dom | three)
 *   npm run new -- drifting-type --backend svg --dir my-anims
 *
 * Writes <dir>/<name>@0.1.yaml (default dir: anims/). Never overwrites.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const BACKENDS = ['canvas2d', 'svg', 'dom', 'three'];
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf('--' + name); return i < 0 ? dflt : argv[i + 1]; };
const name = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const backend = flag('backend', 'canvas2d');
const dir = flag('dir', 'anims');

const fail = (msg) => { console.error(msg); process.exit(2); };
if (!name) fail('usage: npm run new -- <kebab-name> [--backend canvas2d|svg|dom|three] [--dir anims]');
if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) fail(`"${name}" must be lowercase kebab-case (letters, digits, single hyphens)`);
if (!BACKENDS.includes(backend)) fail(`unknown backend "${backend}" (choose ${BACKENDS.join(', ')})`);

const target = join(resolve(dir), `${name}@0.1.yaml`);
if (existsSync(target)) fail(`${target} already exists; pick a new name or a new version (never edit a published version in place)`);
mkdirSync(resolve(dir), { recursive: true });
const text = readFileSync(join(ROOT, 'skill', 'templates', backend + '.yaml'), 'utf8').replaceAll('__NAME__', `${name}@0.1`);
writeFileSync(target, text);

console.log(`created ${target}

next:
  1. write the design brief (skill/guides/design-brief.md), then replace the placeholder picture in the template
  2. npm run validate -- ${dir}/${name}@0.1.yaml
  3. npm run check -- ${dir}/${name}@0.1.yaml      (then look at out/${name}@0.1/*.png)
  4. npm run preview -- ${dir}/${name}@0.1.yaml    (play it, scrub it, flip the theme)`);
