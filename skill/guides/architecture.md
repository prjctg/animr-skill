# Module architecture

The house form for a module that stays correct under seek, pause, resize and teardown. The templates in `../templates/` already have this shape.

## 1. The core rule

**The picture is a pure function of playback time** (plus the song data and config). Then `SEEK` is just `render(G.currentTime())`, a scrub is exact, pause needs no handling, and a hot-swap is a re-render.

Where state genuinely cannot be avoided (a fluid, a spinning mass, a growing structure), say so in the docblock and degrade honestly: relax to rest on SEEK instead of freezing a stale frame, conserve the quantity that shows the scheme is right, clamp `dt` and sub-step so a dropped frame slows down instead of exploding, and never let a `NaN` leave the solver. A jar full of `NaN` is a blank screen with no error.

## 2. Two halves, one banner

```js
/* ── pure half: DOM-free, exported by name, no `document`, no `G` ───────────── */
export const DEFAULTS = { /* every cap and tuning constant, each with a comment justifying the number */ };
export function buildPlan(syls, lines, size, opts) { /* geometry, schedule, layout */ }
export function frameAt(plan, tMs) { /* what exists at time t: positions, alphas, indices */ }

/* Browser half. Everything above this line is DOM-free on purpose. */
export default function (G, shadowRoot, config) { /* wires the pure half to the DOM */ }
```

- Above the banner: geometry, physics, layout, scheduling, hashing; deterministic, unit-testable in node without a browser.
- Below it: `export default`, which only wires the pure half to the DOM and the event system.
- `c` and `cSchema` are separate **literal** exports (not references to `DEFAULTS`); `c.v` duplicates the subset the options panel needs.

## 3. plan / frame / draw

| Stage | When | Does | Allocates? |
|---|---|---|---|
| **plan** | INIT, RESIZE, config change | build layouts, tables, typed arrays from song data and size | yes |
| **frame** | every render | `frameAt(plan, t)`: pure state for time `t` | no (reuse buffers) |
| **draw** | every render | paint the frame (canvas calls, attribute writes) | no |

Rendering entry: one `render(t)`. `G.onFrame({ render })` has the runtime call it on SEEK, PLAY, PAUSE and RESIZE; **it does not call it on TICK**, so also subscribe `G.on(G.TYPE.TICK, render)` for playback. Event handlers (`G.on(SYL…)`) only **arm** things (spawn, mark, schedule); `render` draws them.

## 4. Skeleton

```js
export default function (G, shadowRoot, config) {
  const cfg = G.cfg(config, { channel: G.cfg.int(0), seed: G.cfg.int(7, 0, 99999) });
  const canvas = G.getElementById('c');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  let plan = null;

  const rebuild = () => {
    const fit = fitCanvas(G, canvas, { minSize: 8 });
    if (!fit) return false;
    plan = buildPlan(G.map(G.TYPE.SYL, { channel: cfg.channel }), fit.w, fit.h, cfg);
    ctx.setTransform(fit.dpr, 0, 0, fit.dpr, 0, 0);
    return true;
  };

  const render = (t) => {
    if (!plan && !rebuild()) return;
    draw(ctx, frameAt(plan, t));
  };

  G.on(G.TYPE.INIT, rebuild);
  G.on(G.TYPE.RESIZE, rebuild);
  G.on(G.TYPE.TICK, render);                       // playback
  G.onFrame({ render, reset() { plan = null; } }); // SEEK / PLAY / PAUSE / RESIZE, and UNINIT
  G.dispose(() => { plan = null; });
}
```

## 5. Docblock (design claims)

Open `j` with a numbered docblock; each claim names the tempting wrong answer it rejects. It is where you commit to the mechanism, and what a reader checks the code against.

```js
/*
 * <name>@0.1: <one line>
 *
 * 1. The cloth's position is a PURE FUNCTION OF TIME, not an integrated simulation.
 *    buildPlan() turns the syllables into a piecewise-constant pick rate and
 *    clothOffsetAt() integrates it analytically, so SEEK is just render(now).
 * 2. Colours live in CSS custom properties, not config, so dark mode is reachable.
 * 3. …
 *
 * Not done on purpose: <thing>, because <reason>.
 */
```

Also record there: the decisions the brief left open, any stub you depended on (e.g. `relayout`/`imageInput` verified by reading, not running), and the seek strategy when state is not a pure function of time.

## 6. Determinism

- Seed every random choice from a config key (`seed`). Independent wanderers need independent seeds (`seed + 101`), or they beat against each other.
- Per-event randomness: `hash01(syl.id, seed)`; per-stream: a seeded generator created in `plan`.
- No `Math.random`, `Date.now`, `performance.now` or `setTimeout` in anything that affects the picture.

## 7. One wipe

One `wipe()`, wired to SEEK and UNINIT (and PAUSE where it makes sense), that nulls every cache, typed array, context and Map and removes live nodes. Register disposers with `G.dispose`; listeners with `G.listen`. A module that leaks a timer or an rAF past UNINIT is broken even if it looks right. If the module must keep moving while paused, give it its own rAF and cancel it in `G.dispose`.

## 8. Resize and DPR

Setting `canvas.width` clears it: a size change means **rebuild and repaint**, not just resize. Size the backing store in whole device pixels for every DPR a phone reports (1, 1.5, 2, 2.625, 3, 3.5), re-derive every cached layout, and keep CSS size at the container size.

## 9. Budget and quality

- Put caps in `DEFAULTS` with a one-line justification, not as magic constants.
- Offer `quality: 'auto' | 'high' | 'medium' | 'low'`; resolve `auto` with `matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4`.
- Gate expensive analysis on an accumulator and lerp toward its result per frame; never run it every frame.
- Target ≤ 8 ms mean per frame at the default quality.

## 10. Interaction

If the module takes pointer input, declare `autoPlay: false` in `c.v` and honour it (`games.md`). TICK does not fire while paused, so anything that must move while paused needs its own rAF, cancelled on UNINIT. Every sensor input (`deviceorientation`, `getUserMedia`) needs a pointer or default-image fallback; desktop has no sensor, some mobile browsers will not deliver one without a gesture, and the harness has neither.

## 11. Theme

Theme a canvas through CSS, not config: declare `--x: var(--xColor, #…)` on `:host`, override the same names under `[data-bs-theme=dark]`, read them back with `cssColors` and poll about once a second. A theme flip fires no event and changes no config.
