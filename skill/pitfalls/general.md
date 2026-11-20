# Pitfalls: universal

Format: **rule**: why. Read this before writing code and again before declaring done. Backend rules: `backends.md`. Technique rules (relayout, cameras, terrain, packing, swarms, 3D, faces): `techniques.md` in this folder.

Rules marked ⚙ are enforced by `npm run validate`; the rest need your judgment.

## Lifecycle and events

- **Register every `G.on` / `G.off` / `G.onFrame` inside `default(G, shadowRoot, config)`.** They must exist before the module counts as initialised.
- **Never call `G.map`, `G.forEach`, `G.iterator` or `G.lookup` in `default`.** Song data is not loaded yet; use `G.on(G.TYPE.INIT, …)` or a returned `init()`.
- **`G.setConfig` is only valid after INIT.**
- **`G.off()` fires at the event END time (`e`).** Use it for teardown, not setup.
- ⚙ **Never `return () => cleanup()` from `default`.** The host ignores it. Use `G.dispose(fn)` / `G.listen(...)`.
- **SYL/LINE and TICK are not ordered for you.** Build DOM lazily in the SYL/LINE handler (`if (!active.has(syl.lineId)) setupLine(...)`); never assume TICK ran first.
- **Skip spaces with `if (syl.isSP) return;` only if you opted into `includeDash: true`.** By default callbacks and `G.map` already exclude them.
- **Do not use `TYPE.SYL_` / `TYPE.WORD_`** (deprecated, log warnings). Use `SYL` / `WORD` with `{ includeDash: true }`.
- **`syl.lineId` is the composite LINE id (≥ 1,000,001).** Key line maps by `line.id`. Prefer `TYPE.LINE` over `TYPE.SLINE`.
- **`actualStart` / `actualEnd` exist only on LINE/DLINE objects inside `G.on` callbacks**, not in `G.map` results.
- **`channel` 0 is the primary language, 1 the secondary/translation.** A translation track has no per-syllable timing.
- **`parentLimit`'s referenced LINE subscription must be registered in the same batch**; later it silently has no effect. **`parentId` counts only LINE and DLINE subscriptions, in registration order, all LINE before any DLINE.**
- **`prevSylLimit` clamps the start only.** WORD keeps its own end (bound it with `parentLimit`). Early-fire formula and floor are in `../spec/events.md`.
- **Declare `autoPlay: false` in `c.v` and honour it for modules driven by pointer input** (games), or a tap brings host controls back and swallows the next tap.

## Seek, pause, scrub

- **A frame is a pure function of playback time.** Poses depend on `(time, syl.s)`, never on state accumulated across frames. This is what makes seek, scrub and pause correct for free.
- **Wipe live DOM/state on SEEK, PAUSE and UNINIT.** `G.onFrame({ render, reset })` redraws on SEEK/PLAY/PAUSE/RESIZE but `reset` runs on UNINIT only; it does not replace a SEEK/PAUSE wipe for modules with live actors.
- **If the module calls `G.pause()` itself, omit the PAUSE wipe** (SEEK + UNINIT only), or it wipes its own pause.
- **`G.pause()` / `G.play()` are async.** Drive them with a phase state machine; reset to `'idle'` on SEEK and UNINIT.
- **On SEEK reconcile, don't rebuild:** clear the live set, binary-search start times for windows straddling `G.currentTime()`, re-arm, render one frame.
- **Allow a few percent slack before treating a negative progress as "scrubbed backwards".** SYL (message) and TICK (next frame) are skewed, so a first frame can read slightly below 0.
- **Never animate with CSS `@keyframes` for anything tied to the song.** They run on wall-clock, continue while paused and cannot reconstruct a scrub. Write the value from `render(t)`.
- **Prefer deriving sub-phases inside one syllable from `(time, syl.s, syl.e)`.** Accumulating `delta` (`elapsed += delta`) is a last resort: it is not seek-safe and a paused scrub delivers `delta` 0.
- **`TYPE.TICK` time never decreases and `delta` is `>= 0`, but still clamp `delta` before integrating.**

## Text and lyrics data

- **Escape lyric text before `innerHTML` (`& < >`), or use `textContent`.** Lyrics are untrusted. Join CJK words with `''`, others with `' '`.
- **Use `G.toChars` for grapheme clusters.** `split('')` and `Array.from` break combining marks (Myanmar, Indic, emoji).
- **Pick the right track type in `cSchema`:** `mchannel` for modules using SYL/WORD, `channel` only for LINE/SLINE/DLINE subtitles, `tchannel` for translation-only. A translation track never fires SYL/WORD.
- **Derive a DLINE's content with `G.map(G.TYPE.SYL, { dlineId })` and `G.toString(dline)`.**
- **Never assume breaks inside words.** `TYPE.WORD` comes from a segmenter for whitespace-free scripts.
- **Lyrics can be absent, one line long, RTL, CJK or dense.** Handle empty arrays, single sections, missing beats and word ids (see `../guides/quality-rubric.md`).

## DOM, CSS, pointer (any module with `h`/`s`)

- **Look up elements with `G.getElementById(id)` or `shadowRoot.getElementById(id)`.** `document.getElementById` cannot see the shadow tree.
- **`s` is a static string.** Dynamic values go through CSS variables, not template logic on config.
- **Write `[data-bs-theme=dark]` selectors bare;** the runtime wraps them in `:host(...)`.
- **Only declare `var(--localKey)` for keys present in `c.v` or `c.m`.**
- **Interactive modules: `touch-action: none; user-select: none` on `:host`, listen for `pointerdown`, not `click`.**

## Config

- **Read a config key synchronously in `default` only when a change should reload the module; send colours through CSS variables and do not read them in JS.** Default-body reads reload; CSS variables hot-swap.
- **`config` in `default` is a read-only proxy; callbacks get the same resolved config as their 2nd argument.**
- **`c.m[].s` is the GLOBAL key, `t` the local key; `cSchema[].i` matches `s`, never `t`.** Mixing them orphans the entry.
- ⚙ **`cSchema` and `c` are plain literals** (no calls, spreads, computed values); the host reads them statically.
- **Only `i` is required in a `cSchema` entry; `select` needs `o`.** Unknown `t` renders a text input.
- **Only mapped globals become options fields.** Keep purely visual knobs as CSS custom properties.
- **Leave mapped colour keys out of `c.v` for theme-following modules,** so the CSS fallback and dark rule apply.
- **`G.imageInput`: pass `controlsAutoHide: false` to pin controls; never hand-roll `getUserMedia`, upload or fallback; detect continuously only in `camera` mode, once in `upload`, never in `default`; don't add a UNINIT handler just to release the camera.**

## Randomness and determinism

- ⚙ **Use a seeded RNG (g-lib `mulberry32` / `xorshift32`) or a stateless hash (`hash32` / `hash01`), never `Math.random()`, for anything that must repeat across play and seek.** `Math.random` is a validator error; `Date.now` / `performance.now` are warnings. All of them in a render path break `play == seek`.
- **Seed per-feature streams separately** (`seed + 101`); shared streams correlate unrelated effects.
- **Prefer a hash of the event id to a stateful RNG for per-syllable randomness;** it needs no ordering and survives seek.
- **`G.shuffle` is in-place and not seek-safe.** Shuffle a copy with your own seeded RNG.
- **`G.iterator().next()` returns a random item with `done: true`.** Don't treat it as end-of-data.

## Imports and g-lib

- ⚙ **Pin g-lib to the exact tag** and import only names it exports (`../spec/g-lib.md`).
- ⚙ **Don't write local `clamp` / `lerp` / `ease*` / `smooth*` / `mulberry32` / `xorshift` / `ensureSized` / raw `createElementNS`**, and ⚙ don't use `G.clamp` / `G.lerp` / `G.ease` / `G.randGen` in new modules (`dont-hand-roll.md`).
- **Call `beatPulse(G, …)` inside `default`, before INIT.**
- **`createPool`: pass a reset function; call `pool.wipe()` on SEEK and UNINIT.**
- **`textLayout` and `G.relayout` results are INIT-time data.** Call them once; do not recompute per frame.
- **`layoutWord` spans are flat and sorted by syllable index; position is the index.**
- **In the YAML, `t` is the literal `c`; `j`, `s`, `h` are raw block scalars** (`|`, or `|-` for `t`). Don't wrap them in backticks or quotes. See `../spec/module-format.md`.

## Number hygiene

- **Every value that reaches `ctx.createRadialGradient`, a transform, `setAttribute` or a style must be finite.** One `NaN` from a missing size, `0/0` or an `undefined` helper return poisons the whole frame. Guard sizes (`Math.max(1, …)`), use `num()` for config, and run `npm run check` (it fails on NaN in the DOM and console errors).
- **Clamp `t` before easing** and avoid dividing by durations that can be zero (zero-length syllables exist).
- **Zero-duration and overlapping events are normal.** Never assume `e > s`.

## Testing

- **Keep simulation and layout logic DOM-free and exported, and assert it headlessly;** leave rendering and scrub behaviour to the conformance run.
- **A module importing g-lib cannot be imported by node as is** (node's ESM loader rejects `https:` specifiers). To unit-test the pure half, map the URL to a local copy of g-lib with your test runner's alias or a loader.
- **Make `cssColors` fallbacks equal the LIGHT theme values** in `:host`: a theme the host cannot read falls back to them, so a wrong fallback silently shows the wrong colours.
