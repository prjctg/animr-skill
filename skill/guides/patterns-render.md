# Rendering patterns by backend

## DOM / SVG

```js
const g = G.svg('g');                  // never raw createElementNS
layer.appendChild(g);                  // layer from G.getElementById(...)
```

**Pivot an SVG `scale()` by wrapping in a translated `<g>`:**

```xml
<g transform="translate(50,548)">
  <g id="target-g"><!-- scale() here pivots around (50,548) --></g>
</g>
```

**Theme with CSS custom properties and classes, not presentation attributes:**

```css
:host { --bg: #ededf8; --text: #0d0d2e; }
[data-bs-theme=dark] { --bg: #05050e; --text: #d6d6ff; }
#bg-rect { fill: var(--bg); }        /* class/id rule: var() resolves */
/* NOT <rect fill="#fff"/>: a fixed colour no theme switch can change */
```

Escape lyric text before `innerHTML` (or use `textContent`):

```js
const esc = (t) => (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
```

Touch/interactive host CSS: `:host { touch-action: none; user-select: none; }` and `pointerdown`, not `click`.

Performance: move elements with `transform` (not `left/top`), batch writes after reads, prefer pooling (`createPool`) over create/destroy per syllable, remove nodes synchronously when a slot is reused.

## Canvas 2D

Structure (see `architecture.md`): a `plan` computed once at INIT/RESIZE, a pure `frame(plan, t)` that returns what to draw, and a `draw(ctx, frame)` that only paints.

```js
const fit = fitCanvas(G, canvas, { minSize: 8 });
if (!fit) return;                         // container has no size yet
if (fit.changed) rebuild(fit.w, fit.h, fit.dpr);   // canvas width/height assignment cleared it
ctx.setTransform(fit.dpr, 0, 0, fit.dpr, 0, 0);    // draw in CSS pixels
```

- Always clear (`clearRect`) or fully repaint each frame; never rely on the previous frame's pixels (seek and pause break that).
- **Theme colours:** declare `--ink: var(--inkColor, #111)` in `s`, add a `[data-bs-theme=dark]` block, and read them with `cssColors` about once a second.
- Pre-render repeated glyphs/sprites once per palette step and `drawImage` them under `setTransform`, rather than `fillText` per object per frame.
- Preallocate typed arrays; skip drawing when nothing moved and the source is static.

### Keeping a pixel-heavy module playable on mobile

1. **Decouple analysis rate from render rate.** A search/match/detect pass usually only needs to produce a new *target*; the per-frame smoothing toward it is what the eye reads as motion. Throttle the expensive pass with an accumulator and keep the lerp every frame. For a static source skip it until something invalidates it:

   ```js
   let accum = INTERVAL_MS, dirty = true;
   const source = G.imageInput({ …, onModeChange: () => { dirty = true; }, onReady: () => { dirty = true; } });
   G.on(G.TYPE.TICK, (time, delta) => {
     accum += delta;
     if (accum >= INTERVAL_MS && (source.mode === 'camera' || dirty)) { accum = 0; dirty = false; runAnalysis(); }
     lerpTowardTargets();
     render();
   });
   ```

2. **Cap intermediate buffers to what the destination can display.** Drawing a 1080p video into a 40 px box discards ~99% of the pixels it sampled, once per tile. Downscale once into a shared buffer sized to the destination's budget (`clamp(tileSize * MAX_ZOOM * SUPERSAMPLE, 96, 720)`), then sample that. Fold a mirror flip into that single downscale instead of wrapping every tile draw in `save/scale(-1,1)/restore`.

3. **Offer one `quality` option** (`auto | high | medium | low`) that tiers analysis rate, buffer size, candidate counts and backing-store scale together, with `auto` resolved by a low-power heuristic (`navigator.hardwareConcurrency <= 4`, small screen, `deviceMemory`).

### Heavy draw calls

- Don't batch thousands of small shapes into one huge path; cache settled shapes in small tiles and redraw a tile only when it changes (a single 6,000-subpath fill measured 55–150 ms vs 5–15 ms for many small fills on a software rasteriser).
- Stroke thin lines at `lineWidth <= 1 / dpr` and keep gradients off the bulk of them.
- Blit cached full-screen layers 1:1 (build with a margin for shake), never slightly scaled.
- Let the compositor blend glow: a static background canvas, a 1x CSS-resolution glow canvas with `mix-blend-mode`, the foreground on top.

## three.js

```js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { createThreeStage } from 'https://cdn.jsdelivr.net/gh/prjctg/g-lib@1.3.0/index.js';

const stage = createThreeStage(THREE, G, { canvas: G.getElementById('c'), fov: 55, maxDpr: 2 });
G.on(G.TYPE.RESIZE, () => { if (stage.resize()) stage.render(); });
G.dispose(stage.dispose);              // geometries, materials, textures, renderer, GL context, canvas
```

- Scene state is a pure function of `t`; call `stage.render()` from `render(t)`.
- Instanced meshes for repeated objects; share geometries and materials.
- Wrap optional shader/effect paths in try/catch with a hard fallback.
- Pure generators (curves, terrain heights) live in the exported DOM-free half so they are testable.

## Simulation (when closed form is not possible)

- Fixed sub-steps (e.g. 1/120 s) with a clamped `delta`; never integrate a raw frame delta.
- On SEEK re-simulate from a checkpoint or the beginning to `t` (cheap for small scenes) or precompute a trajectory table at INIT and index it by time.
- Seeded RNG only; spawn from the event id with `hash01`.
- Measure settling (residual kinetic energy), not just appearance.

## Stop-motion / quantised time

For a hand-made feel, quantise the time you feed to `frame`: `tq = Math.floor(t / STEP) * STEP` with `STEP ≈ 83 ms` (12 fps), and jitter with `hash01(id, Math.floor(t / STEP))`. It is still a pure function of `t`.

## Layers

Order from back to front: background (static) → ambient motion → decoration → lyrics → foreground accent. Keep lyrics in their own layer so you can guarantee legibility rules (`patterns-text.md`) regardless of what is behind them, and so a reduced-motion mode can hide only the ambient layers.
