# g-lib: the shared helper library

`g-lib` is a small public ES module of pure helpers (math, easing, seeded random, colour, text fitting, field kernels, springs, canvas sizing, three.js stage, face-api loader). Source: `https://github.com/prjctg/g-lib`.

```js
import { clamp, fitCanvas, cssColors } from 'https://cdn.jsdelivr.net/gh/prjctg/g-lib@1.3.0/index.js';
```

## Pin rule (non-negotiable)

Pin the **exact** `MAJOR.MINOR.PATCH` tag (`@1.3.0`). Never `@1`, `@1.3`, `@latest` or `@main`. A floating tag can resolve to a release older than a helper you import; the import then yields `undefined` and the failure appears far away (`NaN` sizes, `createRadialGradient: non-finite value`). The validator checks the pin and that every imported name exists in the export list below.

Import in the `j` block, at the top of the ES module. Import only names you use.

## Exports (47)

| Group | Names |
|---|---|
| numbers | `num(v, d, lo?, hi?)`, `clamp(v, lo, hi)`, `lerp(a, b, t)`, `prog(t, a, b)` (0..1 progress between a and b), `smooth`, `smoother` |
| easing | `ease(t, type)`: `in`, `out`, `inOut` (default), `cubic`, `smooth`, `smoother`, `expoIn`, `expoOut`, `bounceOut`; also `easeInExpo`, `easeOutExpo`, `easeOutBounce` |
| random / hash | `mulberry32(seed)`, `xorshift32(seed)` (seeded generators returning `() => [0,1)`), `hash32(...ints)`, `hash01(...ints)` (stateless, order-independent per key) |
| colour | `parseHex`, `luminance`, `contrast` (WCAG ratio of two `[r,g,b]`), `toRgba(ctx, color, fallback)`, `cssColors(el, defaults, ctx)` |
| text | `measure(ctx, text, size, {font, ascent, descent})`, `layoutWord(words, spec)`, `textLayout(syls, measureFn, {lineHeight})`, `groupWords(syls)`, `applyCase(text, 'upper'/'lower')`, `rasterizeGlyph`, `sampleCoverage` |
| time | `lastAtOrBefore(sortedArray, t, key?)` (binary search; index or -1) |
| motion | `springAt(ms, zeta, wn)`, `makeSpring(zeta, wn)`, `spr(ms, spring)` (closed-form, seek-safe); `createPhysics({gravity, friction})` (closed-form ballistic with drag); `beatPulse(G, {decay})` |
| fields | `boxBlur`, `bandPassNoise`, `upsample`, `thinMask`, `edt`, `makeFlow`, `makeModulation`, `warpPair` |
| sizing | `fitCanvas(G, canvas, {maxDpr, minSize, maxPixels})` |
| pool | `createPool(create, reset)` |
| three / ML | `createThreeStage(THREE, G, opts)`, `disposeObject3D`, `loadFaceApi`, `tinyFaceOptions`, `FACE_API_BASE` |

## Usage notes

### `fitCanvas`
Returns `{ w, h, dpr, changed }` in CSS pixels, or `null` when the container has no size yet. Assigning `canvas.width/height` clears it, so `changed` means "rebuild and repaint".

```js
function syncSize() {
  const fit = fitCanvas(G, canvas, { minSize: 8 });
  if (!fit) return false;
  if (built && !fit.changed) return true;
  rebuild(fit.w, fit.h, fit.dpr);
  return true;
}
G.on(G.TYPE.RESIZE, () => { if (syncSize()) render(G.currentTime()); });
```

### `cssColors`: theme-aware palette for canvas
Colours live in CSS (`--ink: var(--inkColor, #111)` plus a `[data-bs-theme=dark]` block); canvas reads them back. A theme flip fires no event, so poll: call `read()` about once a second.

```js
const palette = cssColors(canvas, { '--ink': '#141414', '--paper': '#f2efe6' },
                          G.context2d(1, 1, 1, { willReadFrequently: true }));
palette.read();
// in render, every ~30 frames: palette.read();
const [r, g, b, a] = palette.rgb['--ink'];   // mutated in place
```

### `createPool(create, reset)`
`get()`, `release(item)`, `releaseAll()`, `active()`, `wipe()` (removes every pooled node from the DOM and empties the pool). Call `wipe()` on SEEK and UNINIT.

### `textLayout(syls, measureFn, {lineHeight})`
Centres syllables per `lineId` (spaces skipped): returns `[[{ syl, x, y, width, lineIndex }]]`, x relative to the line centre, y in line units × `lineHeight`.

### `layoutWord(words, { gw, gh, fillW, fillH, maxRows, lineGap, measure })`
Fits **one word** (array of syllable strings) into a box at the largest type that fits, over 1..`maxRows` rows. `measure(text, size) -> {width, ascent, descent}` is injected, so it is testable without a canvas. Returns `{ fontSize, rows: [{ spans, baselineY }], spans }` (spans flat, ordered by syllable index) or `null`.

### `springAt` / `makeSpring` / `spr`
Closed-form damped spring from a trigger time: `springAt(msSinceTrigger, zeta, wn)` returns the 0→1 response (overshoots when `zeta < 1`). `makeSpring(zeta, wn)` returns `{ z, wn, hz }` where `hz` is the settle time; `spr(ms, spring)` is 0 before the trigger and exactly 1 after settling. Because they are functions of elapsed time, seeking is free.

### `createPhysics({ gravity = 200, friction = 0.98 })`
`pos({x0, y0, vx, vy}, seconds)` gives the position of a projectile under gravity with per-second velocity decay, in closed form, with no integration state.

### `beatPulse(G, { decay = 500 })`
Call in `default`. `get(t)` is 1 right after a BEAT and decays linearly to 0 over `decay` ms; it resets on SEEK.

### Field kernels
Flat typed arrays, row-major, explicit `width`/`height`, treated as a torus (wrap-around) except `edt`.

- `boxBlur(src, w, h, radius, passes = 2, scratch?)`: in place; three passes ≈ Gaussian.
- `bandPassNoise(w, h, rng, {inner, outer, passes})`: signed noise at one wavelength; threshold at 0 for a mask.
- `upsample(coarse, cw, ch, cell, out, w, h)`: bilinear expansion of a coarse lattice.
- `thinMask(mask, w, h)`: Zhang–Suen thinning to a one-cell medial axis.
- `edt(seed, w, h)`: exact Euclidean distance transform (no wrap). With `thinMask` it is the font-agnostic glyph pipeline: skeletonise, then re-dilate by thresholding the distance. Thresholding `edt` is also the general way to dilate any mask by a real radius.
- `makeFlow(w, h, rng, opts)` → `{ sample(t) }`: divergence-free flow field, a pure function of time (curl of a stream function). `makeModulation(w, h, rng, opts)` → `{ sample(t) }` returns a slow scalar field in [-1, 1]. Give them **separate seeds**.
- `warpPair(srcA, srcB, dstA, dstB, w, h, flow, amount)`: warps for display only. Never warp the simulation state: resampling every frame is numerical diffusion.

### Text helpers
- `measure(ctx, text, size, opts)`: `{ width, ascent, descent }` from real ink metrics with fallbacks (ratios 0.75/0.25 of `size` unless overridden). Treats ascent 0 as missing but descent 0 as real.
- `rasterizeGlyph(ctx, text, fontFamily, {size, padding, weight})` → RGBA array or null; `sampleCoverage(data, x, y, {size, radius, steps, alpha})` → 0..1 coverage.
- `groupWords(syls)` → `[{ wordId, lineId, s, e, text, syls, index }]`, spaces skipped.

### three.js and face-api

```js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
const stage = createThreeStage(THREE, G, { canvas: G.getElementById('c'), fov: 55, maxDpr: 2 });  // { renderer, camera, scene, resize, render, dispose }
G.on(G.TYPE.RESIZE, () => { if (stage.resize()) stage.render(); });
G.on(G.TYPE.UNINIT, stage.dispose);   // frees geometries, materials, textures, renderer and GL context

const faceapi = await loadFaceApi();            // once per page; cached, retried after failure
const opts = tinyFaceOptions(faceapi, 224);
```

g-lib takes the `THREE` namespace you import, so it never pins a three.js itself. Pin third-party libraries to exact versions too:

| Library | Pin |
|---|---|
| three.js | `0.179.1` |
| face-api (`@vladmandic/face-api`) | `1.7.15` (already the default of `loadFaceApi`) |

## Where each helper is needed

See `../pitfalls/dont-hand-roll.md` for the need → helper table. Rule of thumb: if you are about to write `clamp`, `lerp`, an easing, a seeded RNG, a hash, a spring, canvas DPR sizing, a WebGL renderer setup/teardown, or word fitting, it already exists here.

## Testing a module that imports g-lib

Node's ESM loader rejects `https:` specifiers. To unit-test the exported pure half in node, map the URL to a local copy of g-lib with your test runner's alias or a loader.
