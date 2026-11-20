import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { validate, GLIB_EXPORTS, G_MEMBERS, G_TYPES } from '../tools/validate.mjs';
import { build } from '../tools/bundle.mjs';
import { scan } from '../tools/scan.mjs';
import { SONGS, SONG_NAMES } from '../harness/fixtures.js';
import { createScheduler, TYPE } from '../harness/scheduler.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const yamls = [
  ...readdirSync(new URL('../skill/templates/', import.meta.url)).map((f) => ['skill/templates/' + f, true]),
  ...readdirSync(new URL('../examples/', import.meta.url)).map((f) => ['examples/' + f, false]),
];

describe('templates and examples', () => {
  for (const [file, anyName] of yamls) {
    it(`${file} validates with no errors or warnings`, () => {
      const r = validate(read(file), { file, allowAnyName: anyName });
      expect(r.errors).toEqual([]);
      expect(r.warnings).toEqual([]);
    });
  }
});

describe('validator rules', () => {
  const tpl = read('skill/templates/canvas2d.yaml').replaceAll('__NAME__', 'x@0.1');
  const bad = (from, to) => validate(tpl.replace(from, to), { file: 'x@0.1.yaml' }).errors.map((e) => e.rule);
  it('flags Math.random', () => expect(bad('export default function', 'const r = Math.random();\n  export default function')).toContain('math-random'));
  it('flags a bad file name', () => expect(validate(tpl, { file: 'Bad_Name.yaml' }).errors.map((e) => e.rule)).toContain('file-name'));
  it('flags an unpinned g-lib', () => expect(bad('g-lib@1.3.0', 'g-lib')).toContain('glib-pin'));
});

describe('lists stay in sync with the specs', () => {
  it('every g-lib export is documented', () => {
    const doc = read('skill/spec/g-lib.md');
    for (const n of GLIB_EXPORTS) expect(doc, n).toContain(n);
  });
  it('G members and types appear in g.d.ts', () => {
    const d = read('skill/spec/g.d.ts');
    for (const n of [...G_MEMBERS, ...G_TYPES]) expect(d, n).toContain(n);
  });
});

describe('harness', () => {
  it('has all fixtures producing songs', () => {
    expect(SONG_NAMES.length).toBe(13);
    for (const n of SONG_NAMES) expect(SONGS[n]()).toHaveProperty('channelData');
  });
  it('scheduler fires in order and re-fires the latest on seek', () => {
    const song = SONGS.basic();
    const s = createScheduler(song);
    const seen = [];
    s.add(TYPE.LINE, {}, (ev) => seen.push(ev.s));
    s.playTo(1e9);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    seen.length = 0;
    s.seekTo(song.lineData[1].s + 1);
    expect(seen).toEqual([song.lineData[1].s]);
  });
});

describe('repo hygiene', () => {
  it('bundle is fresh', () => {
    let cur = '';
    try { cur = read('dist/anim-skill-prompt.md'); } catch {}
    expect(cur === build()).toBe(true);
  });
  it('has no private references', () => expect(scan().hits).toEqual([]));
});
