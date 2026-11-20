# Pitfalls by backend

Read only the section for your module's backend. Universal rules: `general.md`.

## svg / dom

- ⚙ **Create SVG elements with `G.svg(tag, attrs)`, not `createElementNS`.**
- **Pivot an SVG `scale()` by wrapping in a translated `<g>`.** The scale is otherwise about the origin.
- **Theme through CSS classes and custom properties, not presentation attributes** (`<rect fill="#fff"/>`): a hardcoded attribute is one fixed colour that a theme switch cannot change.
- **Call `getBBox()` one `requestAnimationFrame` after `appendChild`.** It is not valid until laid out.
- **Karaoke two-layer reveal:** share identical tspans in the base and `clip-path` layers and use `paint-order: stroke fill` so the outline does not eat the highlight.
- **Write joint/limb transforms from `render(t)`, not CSS keyframes.** Keyframes ignore pause and seek.
- **Escape text before `innerHTML`; prefer `textContent`.**
- **Remove nodes synchronously when a row/slot is reused;** a node dropped asynchronously and forgotten renders twice after SEEK.

## canvas2d

- **Size with `fitCanvas` (or `G.fit`) and treat `changed` as "rebuild and repaint".** Setting `canvas.width/height` clears it; `fitCanvas` returns `null` until the container has a size.
- **Handle a missing context** (`canvas?.getContext('2d')`; `if (!ctx) return;`).
- **Leave mapped colour keys out of `c.v`** so `var(--inkColor, <theme default>)` falls through.
- **Poll `cssColors().read()` about once a second (every ~30 frames), not every frame.** A theme flip fires no event; reads cost.
- **Decouple analysis rate from render rate:** throttle expensive passes with an accumulator, lerp every frame, skip analysis for a static source until something invalidates it.
- **Preallocate typed arrays once; skip drawing when nothing moved and the source is static.**
- **Cap intermediate buffers to the destination's budget** (`clamp(tileSize * MAX_ZOOM * SUPERSAMPLE, 96, 720)`) and fold a mirror flip into that one downscale. A 1080p video drawn into a 40 px tile discards ~99% of its pixels per tile.
- **Run `warpPair` on the way to the screen, never on the simulation.** Resampling every frame is numerical diffusion.
- **Give `makeFlow` and `makeModulation` separate seeds and keep modulation amplitude small.**
- **`boxBlur` / `bandPassNoise` / `upsample` / `thinMask` treat the grid as a torus; `edt` does not wrap; `boxBlur` works in place.**
- **Don't batch thousands of small shapes into one huge path.** Cache settled shapes in small tiles and redraw a tile only when it changes (a single 6,000-subpath fill measured 55–150 ms vs 5–15 ms for many small ones on a software rasteriser).
- **Stroke thin lines at `lineWidth <= 1 / dpr` and keep gradients off the bulk of them.** Wider than a device pixel leaves the hairline fast path; re-stroke only the spans that need the gradient.
- **Blit cached full-screen layers 1:1 (build with a margin for shake), never slightly scaled.** A scaled blit resamples differently after a read-back, so a seek round trip can differ along hard edges.
- **Let the compositor blend glow:** a static background canvas, a 1x CSS-resolution glow canvas with CSS `mix-blend-mode` (screen / multiply), the foreground on top. Upscaling a quarter-res glow every frame is costly, and a quarter-res on-screen canvas fails the DPR check.
- **Pre-render a glyph once per palette step and `drawImage` it under `setTransform`** rather than `fillText` per object per frame.
- **Back the canvas at the device pixel ratio.** The conformance run checks the backing store at DPR 2.

## webgl / three

- **Create the stage with `createThreeStage`; release it with `G.dispose(stage.dispose)`.** That frees geometry, materials, textures, the renderer, the GL context (`forceContextLoss`) and the canvas.
- ⚙ **A module that creates a WebGL context must call `forceContextLoss()` (or the `WEBGL_lose_context` extension) on teardown,** and every `window`/`document` `addEventListener` needs a matching remove (or use `G.listen`).
- **Wrap optional enhanced render paths in try/catch with a hard fallback.** Their failure must never reach the console or break the default path.
- **Read the canvas2d section too** for sizing and `cssColors` polling; those rules are not GL-specific.
- **Pin three.js to an exact version** (`../spec/g-lib.md`).
- **Render on demand from `render(t)`;** keep scene state a pure function of time.
