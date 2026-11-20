/**
 * Node-only: read an anim module file (`name@major.minor.yaml`) into its four parts.
 * The browser never parses YAML; the preview server and the checker hand it `{ js, css, html }`.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import YAML from 'yaml';

export const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*@\d+\.\d+\.yaml$/;

export function parseModule(text) {
  const doc = YAML.parse(text);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('module is not a YAML mapping');
  return { doc, js: String(doc.j ?? ''), css: String(doc.s ?? ''), html: String(doc.h ?? '') };
}

export function loadModule(file) {
  const mod = parseModule(readFileSync(file, 'utf8'));
  return { ...mod, file, name: basename(file).replace(/\.yaml$/, '') };
}
