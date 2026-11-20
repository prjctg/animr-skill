#!/usr/bin/env node
/**
 * Headless conformance check: mounts a module in Chromium against the mock runtime and
 * measures what every anim owes. Usage:
 *
 *   npm run check -- anims/my-anim@0.1.yaml [more.yaml] [--out out] [--json] [--budget 8]
 *
 * Writes PNGs to <out>/<name>/ (phone and laptop, light and dark). LOOK AT THEM: a green
 * table says the module is not broken, not that it is good.
 */
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadModule } from '../harness/load-module.js';
import { SONGS, SONG_NAMES, BASIC_TIMES } from '../harness/fixtures.js';
import { decodePng, ink, diffRatio } from './png.mjs';
import { serve, ROOT } from './serve.mjs';

const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf('--' + name); return i < 0 ? dflt : argv[i + 1]; };
const VALUE_FLAGS = new Set(['--out', '--budget']);
const files = [];
for (let i = 0; i < argv.length; i++) {
  if (VALUE_FLAGS.has(argv[i])) i++;
  else if (!argv[i].startsWith('--')) files.push(argv[i]);
}
const OUT = resolve(flag('out', 'out'));
const BUDGET = Number(flag('budget', 8));
const JSON_OUT = argv.includes('--json');
if (!files.length) { console.error('usage: npm run check -- <module.yaml> [...] [--out dir] [--json] [--budget ms]'); process.exit(2); }

const CACHE = join(ROOT, '.cache', 'cdn');
mkdirSync(CACHE, { recursive: true });
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com)\//;

/** Serve CDN requests from a local cache (filled on first use), so runs are fast and repeatable. */
async function cdnRoute(route) {
  const url = route.request().url();
  const key = join(CACHE, createHash('sha1').update(url).digest('hex'));
  const cors = { 'access-control-allow-origin': '*' };
  if (existsSync(key)) {
    const { type } = JSON.parse(readFileSync(key + '.json', 'utf8'));
    return route.fulfill({ status: 200, body: readFileSync(key), headers: { ...cors, 'content-type': type } });
  }
  try {
    const res = await fetch(url);
    const body = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') || 'text/javascript';
    if (res.ok) { writeFileSync(key, body); writeFileSync(key + '.json', JSON.stringify({ type, url })); }
    return route.fulfill({ status: res.status, body, headers: { ...cors, 'content-type': type } });
  } catch {
    return route.abort();
  }
}

const SIZES = { phone: { w: 420, h: 740, dpr: 2 }, laptop: { w: 1280, h: 720, dpr: 1 } };

async function openPage(browser, base, { w, h, dpr = 1, theme = 'light' }) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: theme });
  await context.route(CDN, cdnRoute);
  const page = await context.newPage();
  const log = { errors: [], warnings: [] };
  page.on('pageerror', (e) => log.errors.push('uncaught: ' + e.message));
  page.on('console', (m) => {
    const text = m.text();
    if (/favicon/.test(text)) return;
    if (m.type() === 'error') log.errors.push(text);
    else if (m.type() === 'warning') log.warnings.push(text);
  });
  // A module stuck in an endless loop would hang evaluate() forever: fail the call instead.
  const evaluate = page.evaluate.bind(page);
  page.evaluate = (fn, arg) => new Promise((ok, no) => {
    const timer = setTimeout(() => no(new Error('timed out after 45 s (endless loop, or a very slow frame)')), 45000);
    evaluate(fn, arg).then(ok, no).finally(() => clearTimeout(timer));
  });
  page.on('close', () => {});
  await page.goto(base + '/harness/page.html');
  await page.waitForFunction(() => window.__ready === true);
  return { page, context, log };
}

const mountIn = (page, mod, { song, size, theme = 'light', config = {} }) =>
  page.evaluate(async (a) => { window.__a = await window.__mount(a); return true; },
    { js: mod.js, css: mod.css, html: mod.html, song, size, theme, config });

const shot = async (page, w, h) => decodePng(await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } }));

async function checkModule(browser, base, file) {
  const mod = loadModule(file);
  const dir = join(OUT, mod.name);
  mkdirSync(dir, { recursive: true });
  const rows = [];
  const row = (name, ok, detail = '', soft = false) => rows.push({ name, status: ok ? 'PASS' : soft ? 'WARN' : 'FAIL', detail });
  const allErrors = [];
  const allWarnings = [];
  const allNan = [];

  const progress = (m) => { if (!JSON_OUT) console.error('  ... ' + m); };
  progress(`${mod.name}: ${SONG_NAMES.length} edge-case songs`);
  // 1. Every edge-case song: mount, play, seek, resize, UNINIT, stray TICK.
  const fixtureProblems = [];
  for (const name of SONG_NAMES) {
    const { page, context, log } = await openPage(browser, base, { w: 640, h: 360 });
    try {
      const song = SONGS[name]();
      await mountIn(page, mod, { song, size: [640, 360] });
      const dur = Math.min(song.songData.duration, 6000);
      await page.evaluate(({ dur }) => {
        const a = window.__a;
        a.playTo(dur, 100); a.seek(dur / 2); a.seek(0); a.playTo(300, 100);
        a.resize(320, 240); a.uninit(); a.strayTick();
      }, { dur });
      const rep = await page.evaluate(() => window.__a.report());
      if (log.errors.length) fixtureProblems.push(`${name}: ${log.errors[0].slice(0, 160)}`);
      if (rep.nan.length) allNan.push(`${name}: ${rep.nan[0]}`);
      allErrors.push(...log.errors.map((e) => `[${name}] ${e}`));
      allWarnings.push(...log.warnings.map((e) => `[${name}] ${e}`));
    } catch (e) {
      fixtureProblems.push(`${name}: ${String(e.message).split('\n')[0].slice(0, 160)}`);
    }
    await context.close().catch(() => {});
  }
  row('no console errors', fixtureProblems.length === 0,
    fixtureProblems.length ? fixtureProblems.slice(0, 3).join(' | ') : `${SONG_NAMES.length} edge-case songs`);
  row('no NaN / Infinity / undefined', allNan.length === 0, allNan.slice(0, 3).join(' | ') || 'canvas, attributes, styles');
  row('no console warnings', allWarnings.length === 0, allWarnings[0]?.slice(0, 160) || '', true);

  progress('phone and laptop, light and dark');
  // 2. Visuals on the basic song: phone + laptop, light + dark.
  const shots = {};
  const surfaces = {};
  for (const [sizeName, { w, h, dpr }] of Object.entries(SIZES)) {
    for (const theme of ['light', 'dark']) {
      const { page, context, log } = await openPage(browser, base, { w, h, dpr, theme });
      try {
        await mountIn(page, mod, { song: SONGS.basic(), size: [w, h], theme });
        for (const [label, t] of Object.entries(BASIC_TIMES)) {
          await page.evaluate((t) => window.__a.playTo(t, 40), t);
          await page.evaluate(() => window.__nextFrame());
          const buf = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
          writeFileSync(join(dir, `${sizeName}-${theme}-${label}.png`), buf);
          shots[`${sizeName}-${theme}-${label}`] = decodePng(buf);
        }
        surfaces[`${sizeName}-${theme}`] = (await page.evaluate(() => window.__a.report())).canvases;
        if (sizeName === 'laptop' && theme === 'light') {
          // resize must repaint
          await page.evaluate(() => { window.__a.resize(480, 270); });
          await page.evaluate(() => window.__nextFrame());
          const small = await shot(page, 480, 270);
          shots.resized = small;
          writeFileSync(join(dir, 'laptop-light-resized.png'), await page.screenshot({ clip: { x: 0, y: 0, width: 480, height: 270 } }));
        }
      } catch (e) {
        allErrors.push(`[visual ${sizeName}-${theme}] ${String(e.message).split('\n')[0]}`);
      }
      allErrors.push(...log.errors.map((m) => `[visual ${sizeName}-${theme}] ${m}`));
      await context.close();
    }
  }
  const has = (k) => !!shots[k];
  const inkMid = ['phone-light-mid', 'laptop-light-mid'].map((k) => (has(k) ? ink(shots[k]) : 0));
  row('painted', inkMid.every((v) => v > 0.001), `ink ${inkMid.map((v) => (v * 100).toFixed(1) + '%').join(' / ')} (phone / laptop)`);
  const moved = has('laptop-light-early') && has('laptop-light-mid') && has('laptop-light-later')
    ? Math.max(diffRatio(shots['laptop-light-early'], shots['laptop-light-mid']), diffRatio(shots['laptop-light-mid'], shots['laptop-light-later']))
    : 0;
  row('moves', moved > 0.0005, `${(moved * 100).toFixed(2)}% of pixels change between 1.3 s, 2.3 s, 3.5 s`);
  const themed = has('laptop-light-mid') && has('laptop-dark-mid') ? diffRatio(shots['laptop-light-mid'], shots['laptop-dark-mid']) : 0;
  row('light differs from dark', themed > 0.002, `${(themed * 100).toFixed(1)}% of pixels` + (themed > 0.002 ? '' : ': fine only if the scene paints its own opaque ground'), true);
  row('resize repaints', has('resized') && ink(shots.resized) > 0.001, has('resized') ? `ink ${(ink(shots.resized) * 100).toFixed(1)}% at 480x270` : 'no screenshot');
  const surf = surfaces['phone-light'] || [];
  const undersized = surf.filter((c) => c.cssW > 1 && c.w < c.cssW);
  const offDpr = surf.filter((c) => c.cssW > 1 && c.w < Math.round(c.cssW * 2) - 1);
  row('canvas not undersized (DPR 2)', undersized.length === 0, surf.length ? surf.map((c) => `${c.w}px for ${Math.round(c.cssW)} css px`).join(', ') : 'no canvas');
  row('canvas backing = css x dpr', offDpr.length === 0, offDpr.length ? 'below css x 2: fine only if a quality tier clamps it on purpose' : '', true);

  progress('seek purity');
  // 3. Seek purity.
  {
    const { page, context } = await openPage(browser, base, { w: 640, h: 360 });
    try {
      const T = BASIC_TIMES.mid;
      await mountIn(page, mod, { song: SONGS.basic(), size: [640, 360] });
      const r = await page.evaluate(async ({ T }) => {
        const a = window.__a;
        await window.__sleep(200);
        a.seek(T); const first = a.frame();
        a.seek(0); a.playTo(100, 50); const early = a.frame();
        a.seek(T); const again = a.frame();
        return { pure: first === again, vacuous: first === early };
      }, { T });
      row('seek purity (away and back)', r.pure, r.vacuous ? 'frame at 0.1 s equals frame at 2.3 s: comparison is weak' : '', true);
      const second = await openPage(browser, base, { w: 640, h: 360 });
      await mountIn(second.page, mod, { song: SONGS.basic(), size: [640, 360] });
      const played = await page.evaluate(({ T }) => { const a = window.__a; a.seek(0); a.playTo(T, 40); return a.frame(); }, { T });
      const sought = await second.page.evaluate(async ({ T }) => { const a = window.__a; a.seek(T); return a.frame(); }, { T });
      row('seek purity (play == seek)', played === sought, 'playing to 2.3 s must draw what seeking to 2.3 s draws', true);
      await second.context.close();
    } catch (e) {
      row('seek purity', false, String(e.message).split('\n')[0], true);
    }
    await context.close();
  }

  progress('lifecycle and tick budget');
  // 4. Lifecycle after UNINIT, and the tick budget.
  {
    const { page, context, log } = await openPage(browser, base, { w: 1280, h: 720 });
    try {
      await mountIn(page, mod, { song: SONGS.basic(), size: [1280, 720] });
      await page.evaluate(() => { window.__a.playTo(500, 16); window.__a.clearTickStats(); window.__a.playTo(2500, 16); });
      const stats = (await page.evaluate(() => window.__a.report())).tick;
      row(`tick budget <= ${BUDGET} ms`, stats.median <= BUDGET,
        `median ${stats.median.toFixed(2)} ms, p95 ${stats.p95.toFixed(2)} ms, max ${stats.max.toFixed(1)} ms over ${stats.n} ticks`);
      if (stats.p95 > 2 * BUDGET) row('tick p95', false, `p95 ${stats.p95.toFixed(1)} ms: spikes are felt as jank`, true);
      await page.evaluate(() => { window.__a.uninit(); window.__a.strayTick(); });
      // The runtime stops delivering events after UNINIT, so a stray TICK repainting is not the question:
      // does the picture change by itself (a leaked loop, interval or CSS-driven JS)?
      const before = await page.evaluate(() => window.__a.frame());
      await page.evaluate(() => window.__sleep(600));
      const after = await page.evaluate(() => window.__a.frame());
      const rep = await page.evaluate(() => window.__a.report());
      const leaks = [];
      if (rep.leakedListeners.length) leaks.push('listeners left on window/document/body: ' + [...new Set(rep.leakedListeners)].join(', '));
      if (rep.liveGl) leaks.push(`${rep.liveGl} WebGL context(s) not released (forceContextLoss)`);
      row('UNINIT cleans up', leaks.length === 0, leaks.join('; ') || 'listeners, GL contexts, disposers');
      const animating = [];
      if (before !== after) animating.push('the frame changed after UNINIT');
      if (rep.late.raf > 2) animating.push(`rAF kept running (${rep.late.raf} callbacks)`);
      if (rep.late.interval > 0) animating.push(`setInterval kept running (${rep.late.interval} calls)`);
      row('nothing animates after UNINIT', animating.length === 0, animating.join('; '));
      allErrors.push(...log.errors.map((m) => `[lifecycle] ${m}`));
    } catch (e) {
      row('lifecycle / budget', false, String(e.message).split('\n')[0]);
    }
    await context.close();
  }

  const lifecycleErrors = allErrors.filter((e) => e.startsWith('[visual') || e.startsWith('[lifecycle'));
  if (lifecycleErrors.length) rows.unshift({ name: 'no console errors (visual runs)', status: 'FAIL', detail: lifecycleErrors[0].slice(0, 200) });
  return { file, name: mod.name, dir, rows };
}

const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = false;
const results = [];
try {
  for (const f of files) {
    let res;
    try { res = await checkModule(browser, server.url, f); }
    catch (e) { res = { file: f, name: f, dir: '', rows: [{ name: 'load', status: 'FAIL', detail: String(e.message).split('\n')[0] }] }; }
    results.push(res);
    if (res.rows.some((r) => r.status === 'FAIL')) failed = true;
  }
} finally {
  await browser.close();
  await server.close();
}

if (JSON_OUT) console.log(JSON.stringify(results, null, 2));
else {
  for (const r of results) {
    console.log(`\n${r.file}`);
    const width = Math.max(...r.rows.map((x) => x.name.length));
    for (const x of r.rows) console.log(`  ${x.status.padEnd(4)}  ${x.name.padEnd(width)}  ${x.detail}`);
    if (r.dir) console.log(`\n  PNGs: ${r.dir}  (look at them: phone and laptop, light and dark)`);
  }
}
process.exit(failed ? 1 : 0);
