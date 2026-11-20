#!/usr/bin/env node
/**
 * Build one self-contained prompt for chat models without file access.
 *   npm run bundle            -> dist/anim-skill-prompt.md
 *   npm run bundle -- --check -> exit 1 if dist/ is stale (used by tests)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SKILL = join(ROOT, 'skill');
const OUT = join(ROOT, 'dist', 'anim-skill-prompt.md');
const ORDER = ['spec', 'pitfalls', 'guides', 'templates'];

export function build() {
  const parts = [
    '# Anim authoring skill (single-file bundle)\n\nEverything below is one skill. Paths in the text refer to the section titles ("FILE: ..."). ' +
      'No tools are available in this mode: follow the tool-less workflow, and output only the final YAML file.\n',
  ];
  const add = (rel) => {
    const body = readFileSync(join(SKILL, rel), 'utf8').replace(/\r\n/g, '\n').trimEnd();
    const lang = rel.endsWith('.yaml') ? 'yaml' : rel.endsWith('.ts') ? 'ts' : '';
    const fenced = lang ? '```' + lang + '\n' + body + '\n```' : body;
    parts.push(`\n\n======== FILE: ${rel} ========\n\n${fenced}\n`);
  };
  add('SKILL.md');
  for (const dir of ORDER) {
    for (const f of readdirSync(join(SKILL, dir)).sort()) add(`${dir}/${f}`);
  }
  return parts.join('');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = build();
  if (process.argv.includes('--check')) {
    const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (cur !== text) { console.error('dist/anim-skill-prompt.md is stale: run npm run bundle'); process.exit(1); }
    console.log('bundle is fresh');
  } else {
    mkdirSync(join(ROOT, 'dist'), { recursive: true });
    writeFileSync(OUT, text);
    console.log(`wrote ${OUT} (${Math.round(text.length / 1024)} KB)`);
  }
}
