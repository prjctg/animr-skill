#!/usr/bin/env node
/**
 * Static validator for anim modules. Usage:
 *
 *   npm run validate -- anims/my-anim@0.1.yaml [more.yaml] [--json] [--allow-any-name]
 *
 * Errors make the exit code 1. Warnings are judgment calls: fix them or justify them in the docblock.
 * Every rule is explained in skill/pitfalls/ (rules marked with a gear there are enforced here).
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as acorn from 'acorn';
import YAML from 'yaml';

export const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*@\d+\.\d+\.yaml$/;

/** The 47 exports of g-lib (skill/spec/g-lib.md). A test keeps this list equal to the spec. */
export const GLIB_EXPORTS = [
  'createPool', 'textLayout', 'createPhysics', 'beatPulse', 'boxBlur', 'bandPassNoise', 'upsample', 'thinMask', 'edt',
  'makeFlow', 'makeModulation', 'warpPair', 'layoutWord', 'fitCanvas', 'toRgba', 'cssColors', 'num', 'clamp', 'lerp',
  'prog', 'smooth', 'smoother', 'easeOutExpo', 'easeInExpo', 'easeOutBounce', 'ease', 'mulberry32', 'xorshift32',
  'hash32', 'hash01', 'parseHex', 'luminance', 'contrast', 'lastAtOrBefore', 'applyCase', 'groupWords', 'measure',
  'rasterizeGlyph', 'sampleCoverage', 'springAt', 'makeSpring', 'spr', 'disposeObject3D', 'createThreeStage',
  'FACE_API_BASE', 'loadFaceApi', 'tinyFaceOptions',
];
/** Members of `G` (skill/spec/g.d.ts). A test keeps this list equal to the spec. */
export const G_MEMBERS = [
  'TYPE', 'on', 'off', 'emit', 'map', 'forEach', 'iterator', 'lookup', 'getSongData', 'currentTime', 'toBeat', 'toMs',
  'getPlaybackRate', 'game', 'progress', 'seek', 'play', 'pause', 'setConfig', 'getElementById', 'clientRect', 'svg',
  'toString', 'toChars', 'measureText', 'context2d', 'fit', 'wrap', 'relayout', 'onFrame', 'dispose', 'listen', 'cfg',
  'imageInput', 'randGen', 'shuffle', 'lerp', 'clamp', 'ease',
];
export const G_TYPES = [
  'TICK', 'SEEK', 'PLAY', 'PAUSE', 'UNINIT', 'INIT', 'RESIZE', 'GAME', 'BEAT', 'MEASURE', 'TIMESIG', 'KEY', 'CHORD',
  'SECTION', 'SLINE', 'LINE', 'DLINE', 'SEGMENT', 'WORD', 'SYL', 'NOTE', 'WORD_', 'SYL_',
];
export const EVENT_OPTIONS = [
  'channel', 'stream', 'offset', 'batchEvents', 'includeDash', 'secId', 'lineId', 'dlineId', 'segmentId', 'wordId',
  'notes', 'syls', 'prevSylLimit', 'prevSylRatio', 'prevSylOffset', 'parentLimit', 'parentId', 'lookahead',
];
const CSCHEMA_TYPES = ['mchannel', 'tchannel', 'channel', 'select', 'check', 'boolean', 'int', 'number', 'color', 'text'];
const HAND_ROLLED = /^(clamp|lerp|mix|ease|easeIn\w*|easeOut\w*|easeInOut\w*|smooth|smoother|smoothstep|smootherstep|mulberry32|xorshift\w*|hash01|hash32|ensureSized)$/i;
const INIT_ONLY = new Set(['map', 'forEach', 'lookup', 'iterator', 'relayout']);
const DOM_NAMES = new Set(['document', 'window', 'G', 'shadowRoot', 'requestAnimationFrame']);

const isFn = (n) => n && (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');

function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  if (visit(node, parent) === false) return;
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const v = node[key];
    if (Array.isArray(v)) v.forEach((x) => x && typeof x.type === 'string' && walk(x, visit, node));
    else if (v && typeof v.type === 'string') walk(v, visit, node);
  }
}

/** The JS value of a literal-only expression, or `undefined` plus a reason when it is not one. */
function literal(node) {
  const bad = (why) => ({ ok: false, why });
  switch (node.type) {
    case 'Literal': return { ok: true, value: node.value };
    case 'TemplateLiteral':
      return node.expressions.length ? bad('template literal with ${}') : { ok: true, value: node.quasis.map((q) => q.value.cooked).join('') };
    case 'UnaryExpression': {
      const a = literal(node.argument);
      return a.ok && typeof a.value === 'number' && (node.operator === '-' || node.operator === '+')
        ? { ok: true, value: node.operator === '-' ? -a.value : a.value } : bad('computed value');
    }
    case 'ArrayExpression': {
      const out = [];
      for (const el of node.elements) {
        if (!el || el.type === 'SpreadElement') return bad('spread or hole in array');
        const r = literal(el);
        if (!r.ok) return r;
        out.push(r.value);
      }
      return { ok: true, value: out };
    }
    case 'ObjectExpression': {
      const out = {};
      for (const p of node.properties) {
        if (p.type !== 'Property' || p.computed || p.kind !== 'init' || p.method) return bad('spread, computed key or method in object');
        const key = p.key.type === 'Identifier' ? p.key.name : p.key.value;
        const r = literal(p.value);
        if (!r.ok) return r;
        out[key] = r.value;
      }
      return { ok: true, value: out };
    }
    default: return bad(node.type);
  }
}

let gShadowed = false; // a local `const G = ...` means G.x is not the runtime: skip the G.* rules
const gMember = (n) => !gShadowed && n.type === 'MemberExpression' && n.object.type === 'Identifier' && n.object.name === 'G' && !n.computed
  ? n.property.name : null;

export function validate(text, { file = '', allowAnyName = false } = {}) {
  const errors = [];
  const warnings = [];
  const add = (list, rule, msg, node) => list.push({ rule, msg, line: node?.loc?.start.line });
  const err = (rule, msg, node) => add(errors, rule, msg, node);
  const warn = (rule, msg, node) => add(warnings, rule, msg, node);

  if (file && !allowAnyName && !NAME_RE.test(basename(file))) {
    err('file-name', `"${basename(file)}" must look like kebab-name@major.minor.yaml`);
  }
  let doc;
  try { doc = YAML.parse(text); } catch (e) { err('yaml', 'not valid YAML: ' + e.message.split('\n')[0]); return { errors, warnings }; }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) { err('yaml', 'the file is not a YAML mapping'); return { errors, warnings }; }
  const keys = Object.keys(doc).sort().join(',');
  if (keys !== 'h,j,s,t') err('keys', `top-level keys must be exactly t, j, s, h (found: ${Object.keys(doc).join(', ') || 'none'})`);
  if (doc.t !== 'c') err('type-key', `"t" must be the literal c (found ${JSON.stringify(doc.t)})`);
  for (const k of ['j', 's', 'h']) if (typeof doc[k] !== 'string') err('keys', `"${k}" must be a string`);
  if (typeof doc.j !== 'string') return { errors, warnings };

  const js = doc.j;
  const css = typeof doc.s === 'string' ? doc.s : '';
  const html = typeof doc.h === 'string' ? doc.h : '';
  let comments = [];
  let ast;
  try {
    ast = acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'module', locations: true, onComment: comments });
  } catch (e) { err('js-syntax', 'j does not parse: ' + e.message); return { errors, warnings }; }

  gShadowed = false;
  walk(ast, (n) => { if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === 'G') gShadowed = true; });
  if (gShadowed) warn('g-shadowed', 'a local variable named G hides the runtime: rename it, the G.* checks are skipped');

  // ── exports ──
  const exportsByName = new Map();
  let defaultFn = null;
  for (const node of ast.body) {
    if (node.type === 'ExportDefaultDeclaration') defaultFn = isFn(node.declaration) ? node.declaration : { unresolved: true, node };
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      const d = node.declaration;
      if (d.type === 'VariableDeclaration') for (const v of d.declarations) exportsByName.set(v.id.name, { node: v.init, decl: node });
      else if (d.id) exportsByName.set(d.id.name, { node: d, decl: node });
    }
  }
  if (!defaultFn) err('export-default', 'j must have `export default function (G, shadowRoot, config) { ... }`');
  else if (defaultFn.unresolved) {
    const id = defaultFn.node.declaration;
    const local = id.type === 'Identifier' ? ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id?.name === id.name) : null;
    defaultFn = local || null;
    if (!defaultFn) warn('export-default', 'could not resolve the default export to a function; checks that need it are skipped', id);
  }

  // ── c and cSchema ──
  const readLiteral = (name) => {
    const e = exportsByName.get(name);
    if (!e) return null;
    const r = literal(e.node);
    if (!r.ok) { err('literal-' + name, `\`${name}\` must be a plain literal (the host reads it statically): ${r.why}`, e.node); return null; }
    return r.value;
  };
  const c = readLiteral('c');
  const cSchema = readLiteral('cSchema');
  const mapped = [];
  if (c) {
    if (!c.v || typeof c.v !== 'object') err('c-shape', '`c.v` must be an object', exportsByName.get('c').node);
    const m = Array.isArray(c.m) ? c.m : [];
    if (c.m !== undefined && !Array.isArray(c.m)) err('c-shape', '`c.m` must be an array of { s, t }', exportsByName.get('c').node);
    for (const e of m) {
      if (!e || typeof e.s !== 'string' || typeof e.t !== 'string') err('c-shape', 'each `c.m` entry needs string `s` and `t`', exportsByName.get('c').node);
      else mapped.push(e);
    }
    const seen = new Set();
    for (const e of mapped) { if (seen.has(e.s)) err('c-shape', `duplicate global key "${e.s}" in c.m`, exportsByName.get('c').node); seen.add(e.s); }
  }
  if (cSchema) {
    if (!Array.isArray(cSchema)) err('cschema-shape', '`cSchema` must be an array', exportsByName.get('cSchema').node);
    else {
      const ids = new Set();
      for (const p of cSchema) {
        if (!p || typeof p.i !== 'string') { err('cschema-shape', 'each cSchema entry needs a string `i`', exportsByName.get('cSchema').node); continue; }
        ids.add(p.i);
        if (p.t !== undefined && !CSCHEMA_TYPES.includes(p.t)) warn('cschema-type', `cSchema "${p.i}": type "${p.t}" renders as a text input`, exportsByName.get('cSchema').node);
        if (c && !mapped.some((e) => e.s === p.i)) err('cschema-mapping', `cSchema "${p.i}" has no matching c.m[].s (\`i\` is the GLOBAL key)`, exportsByName.get('cSchema').node);
      }
      for (const e of mapped) if (!ids.has(e.s)) err('cschema-mapping', `c.m maps "${e.s}" but cSchema has no entry with i: "${e.s}"`, exportsByName.get('c').node);
      if (c?.v) {
        for (const p of cSchema) {
          if (p?.t !== 'color') continue;
          const local = mapped.find((e) => e.s === p.i)?.t;
          if (local && local in c.v) err('color-in-v', `colour key "${local}" must not be in c.v: a default there is injected as a host variable and makes the dark rule unreachable`, exportsByName.get('c').node);
        }
      }
    }
  }
  if (c?.v) for (const k of Object.keys(c.v)) {
    if (/colou?r$/i.test(k) && !(cSchema || []).some((p) => p?.t === 'color' && mapped.some((e) => e.s === p.i && e.t === k))) {
      warn('color-in-v', `"${k}" looks like a colour in c.v: leave theme colours to CSS var(--${k}, fallback)`, exportsByName.get('c').node);
    }
  }

  // exported h / s must equal the keys
  for (const [name, text2] of [['h', html], ['s', css]]) {
    const e = exportsByName.get(name);
    if (!e) continue;
    const r = literal(e.node);
    if (r.ok && typeof r.value === 'string' && r.value.trim() !== text2.trim()) err('export-sync', `\`export const ${name}\` differs from the "${name}" key`, e.node);
  }

  // ── imports ──
  for (const node of ast.body.filter((n) => n.type === 'ImportDeclaration')) {
    const src = node.source.value;
    const names = node.specifiers.filter((s) => s.type === 'ImportSpecifier').map((s) => s.imported.name);
    if (/g-lib/.test(src)) {
      if (!/^https:\/\/cdn\.jsdelivr\.net\/gh\/prjctg\/g-lib@\d+\.\d+\.\d+\/index\.js$/.test(src)) {
        err('glib-pin', `g-lib must be imported from https://cdn.jsdelivr.net/gh/prjctg/g-lib@<exact tag>/index.js (found ${src})`, node);
      }
      for (const n of names) if (!GLIB_EXPORTS.includes(n)) err('glib-name', `g-lib does not export "${n}" (see skill/spec/g-lib.md)`, node);
    } else if (/^https:\/\/cdn\.jsdelivr\.net\/npm\/(@?[\w.-]+(?:\/[\w.-]+)?)@([^/]+)\//.test(src)
      || /^https:\/\/unpkg\.com\/(@?[\w.-]+)@([^/]+)\//.test(src)) {
      const ver = src.match(/@(\d[^/]*)\//)?.[1];
      if (!ver || !/^\d+\.\d+\.\d+$/.test(ver)) err('cdn-pin', `pin ${src} to an exact version (no range, tag or latest)`, node);
      if (/\/three@/.test(src) && ver && ver !== '0.179.1') warn('three-version', `three is pinned at 0.179.1 in this skill (found ${ver})`, node);
    } else if (/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/[\w.-]+\/(\d+\.\d+\.\d+)\//.test(src)) {
      // exact pin
    } else {
      err('import-source', `imports may only come from the pinned CDN hosts (found ${src})`, node);
    }
  }

  // ── whole-module walks ──
  const addRemove = { add: [], remove: [] };
  let usesGListen = false;
  let usesWebGL = /getContext\(\s*['"](?:experimental-)?webgl2?['"]/.test(js) || /cdn\.jsdelivr\.net\/npm\/three@/.test(js);
  const releasesGL = /forceContextLoss|WEBGL_lose_context|createThreeStage/.test(js);
  walk(ast, (node, parent) => {
    // hand-rolled helpers
    const declName = node.type === 'FunctionDeclaration' ? node.id?.name
      : node.type === 'VariableDeclarator' && isFn(node.init) && node.id.type === 'Identifier' ? node.id.name : null;
    if (declName && HAND_ROLLED.test(declName) && !(node.type === 'FunctionDeclaration' && parent?.type === 'ExportDefaultDeclaration')) {
      err('dont-hand-roll', `local \`${declName}\` duplicates a g-lib helper: import it (see skill/pitfalls/dont-hand-roll.md)`, node);
    }
    if (node.type === 'AssignmentExpression' && node.operator === '^=' && node.right.type === 'BinaryExpression'
      && node.right.operator === '<<' && node.right.right.value === 13) {
      err('dont-hand-roll', 'inline xorshift: use g-lib mulberry32 / xorshift32', node);
    }
    if (node.type === 'CallExpression') {
      const callee = node.callee;
      if (callee.type === 'MemberExpression' && !callee.computed) {
        const obj = callee.object; const prop = callee.property.name;
        if (prop === 'createElementNS') err('svg-create', 'use `G.svg(tag, attrs)`, not createElementNS', node);
        if (obj.type === 'Identifier' && obj.name === 'Math' && prop === 'random') err('math-random', 'Math.random() breaks play == seek: use a seeded RNG (mulberry32/xorshift32) or hash01', node);
        if (obj.type === 'Identifier' && obj.name === 'Date' && prop === 'now') warn('wall-clock', 'Date.now() in a render path breaks play == seek: derive from playback time', node);
        if (obj.type === 'Identifier' && obj.name === 'performance' && prop === 'now') warn('wall-clock', 'performance.now() in a render path breaks play == seek: derive from playback time', node);
        if (obj.type === 'Identifier' && obj.name === 'document' && prop === 'getElementById') err('shadow-dom', 'document.getElementById cannot see the shadow root: use G.getElementById', node);
        if (obj.type === 'Identifier' && obj.name === 'document' && (prop === 'querySelector' || prop === 'querySelectorAll')) warn('shadow-dom', 'document.querySelector cannot see the shadow root: use shadowRoot.querySelector', node);
        if (prop === 'addEventListener' || prop === 'removeEventListener') {
          const target = obj.type === 'Identifier' ? obj.name
            : obj.type === 'MemberExpression' && obj.object.type === 'Identifier' ? obj.object.name + '.' + (obj.property.name || '') : null;
          if (['window', 'document', 'document.body', 'document.documentElement'].includes(target)) {
            addRemove[prop === 'addEventListener' ? 'add' : 'remove'].push({ target, type: node.arguments[0]?.value, node });
          }
        }
        if (gMember(callee) === 'listen') usesGListen = true;
        const gm = gMember(callee);
        if (gm && ['on', 'off', 'map', 'forEach', 'lookup', 'iterator'].includes(gm)) {
          const opts = node.arguments.find((a, i) => i > 0 && a.type === 'ObjectExpression');
          if (opts) for (const p of opts.properties) {
            const k = p.key?.name ?? p.key?.value;
            if (p.type === 'Property' && k && !EVENT_OPTIONS.includes(k)) warn('unknown-option', `"${k}" is not an event option and is silently ignored (see skill/spec/events.md)`, p);
          }
        }
      }
      if (callee.type === 'Identifier' && (callee.name === 'setTimeout' || callee.name === 'setInterval')) warn('timers', `${callee.name} outlives UNINIT unless cleared in G.dispose, and it is not seek-safe`, node);
      if (callee.type === 'Identifier' && callee.name === 'requestAnimationFrame') warn('own-raf', 'drive frames from G.on(TICK) / G.onFrame, not your own requestAnimationFrame loop (a loop keeps running after UNINIT)', node);
    }
    if (node.type === 'MemberExpression') {
      const gm = gMember(node);
      if (gm) {
        if (!G_MEMBERS.includes(gm)) err('unknown-g-member', `G.${gm} does not exist (see skill/spec/g.d.ts)`, node);
        if (['clamp', 'lerp', 'ease', 'randGen'].includes(gm)) err('frozen-g-math', `G.${gm} is frozen legacy: import from g-lib`, node);
      }
      if (node.object.type === 'MemberExpression' && gMember(node.object) === 'TYPE' && !node.computed && !G_TYPES.includes(node.property.name)) {
        err('unknown-type', `G.TYPE.${node.property.name} does not exist (see skill/spec/events.md)`, node);
      }
      if (node.object.type === 'MemberExpression' && gMember(node.object) === 'TYPE' && /^(WORD_|SYL_)$/.test(node.property.name)) {
        warn('deprecated-type', `G.TYPE.${node.property.name} is deprecated: use ${node.property.name.slice(0, -1)} with { includeDash: true }`, node);
      }
    }
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && node.left.property.name === 'innerHTML'
      && !(node.right.type === 'Literal' || (node.right.type === 'TemplateLiteral' && !node.right.expressions.length))) {
      warn('inner-html', 'innerHTML with dynamic content: lyric text is untrusted, use textContent', node);
    }
  });

  if (addRemove.add.length) {
    for (const a of addRemove.add) {
      const matched = addRemove.remove.some((r) => r.target === a.target && r.type === a.type);
      if (!matched) err('listener-balance', `${a.target}.addEventListener('${a.type}') has no matching removeEventListener: use G.listen(...) instead`, a.node);
    }
  }
  if (usesWebGL && !releasesGL) err('webgl-release', 'a WebGL context must be released on teardown: call renderer.forceContextLoss() in G.dispose (or use g-lib createThreeStage)');

  // ── default function ──
  if (defaultFn && isFn(defaultFn)) {
    if (defaultFn.params.length < 1) warn('default-signature', 'default should take (G, shadowRoot, config)', defaultFn);
    const stmts = defaultFn.body.type === 'BlockStatement' ? defaultFn.body : null;
    if (stmts) walk(stmts, (n) => {
      if (n !== stmts && isFn(n)) return false; // do not descend into callbacks
      if (n.type === 'ReturnStatement' && n.argument && isFn(n.argument)) err('returned-cleanup', 'returning a function from default does nothing: use G.dispose(fn) / G.listen(...)', n);
      if (n.type === 'CallExpression' && gMember(n.callee) && INIT_ONLY.has(gMember(n.callee))) {
        err('init-only', `G.${gMember(n.callee)} is valid from INIT only: move it into G.on(G.TYPE.INIT, ...)`, n);
      }
      return true;
    });
  }

  // ── pure half ──
  for (const [name, e] of exportsByName) {
    if (e.node?.type !== 'FunctionDeclaration' && !isFn(e.node)) continue;
    let touches = null;
    walk(e.node, (n) => {
      if (!touches && n.type === 'Identifier' && DOM_NAMES.has(n.name)) touches = n;
    });
    if (touches) warn('pure-half', `exported \`${name}\` touches \`${touches.name}\`: keep the exported half DOM-free so it can be unit-tested`, touches);
  }

  // ── docblock, css, html ──
  const claims = comments.find((cm) => cm.type === 'Block' && /^\s*\*?\s*1\./m.test(cm.value));
  if (!claims) warn('docblock', 'no design-claims docblock (numbered claims) found: see skill/guides/architecture.md');
  if (/@import|url\(\s*['"]?https?:/i.test(css)) warn('css-external', 'external CSS resources are blocked: inline them');
  if (/<script/i.test(html)) err('html-script', 'h must not contain <script>');
  if (/\son[a-z]+\s*=/i.test(html)) warn('html-inline-handler', 'inline event handlers: use G.listen from default');

  return { errors, warnings };
}

// ── CLI ──
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const argv = process.argv.slice(2);
  const files = argv.filter((a) => !a.startsWith('--'));
  const asJson = argv.includes('--json');
  const allowAnyName = argv.includes('--allow-any-name');
  if (!files.length) { console.error('usage: npm run validate -- <module.yaml> [...] [--json] [--allow-any-name]'); process.exit(2); }
  for (const f of files) if (!existsSync(f)) { console.error(`no such file: ${f}`); process.exit(2); }
  const results = files.map((file) => ({ file, ...validate(readFileSync(file, 'utf8'), { file, allowAnyName }) }));
  if (asJson) console.log(JSON.stringify(results, null, 2));
  else {
    for (const r of results) {
      console.log(`\n${r.file}`);
      for (const e of r.errors) console.log(`  error    ${e.rule}${e.line ? ` (j:${e.line})` : ''}: ${e.msg}`);
      for (const w of r.warnings) console.log(`  warning  ${w.rule}${w.line ? ` (j:${w.line})` : ''}: ${w.msg}`);
      if (!r.errors.length && !r.warnings.length) console.log('  ok');
      else console.log(`  ${r.errors.length} error(s), ${r.warnings.length} warning(s)`);
    }
  }
  process.exit(results.some((r) => r.errors.length) ? 1 : 0);
}
