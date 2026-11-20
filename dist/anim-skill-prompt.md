# Anim authoring skill (single-file bundle)

Everything below is one skill. Paths in the text refer to the section titles ("FILE: ..."). No tools are available in this mode: follow the tool-less workflow, and output only the final YAML file.


======== FILE: SKILL.md ========

---
name: author-anim
description: Create an "anim", a single YAML module that animates a song's lyrics and beats in the browser (canvas2d, SVG, DOM or three.js), from a short brief. Use when asked to make, port, restyle or fix an anim / lyric visualiser / lyric animation module. Works from this skill alone; no example library or catalog is needed.
---

# Author an anim

An **anim** is one file, `<kebab-name>@<major>.<minor>.yaml`, with exactly four keys: `t` (the literal `c`), `j` (an ES module), `s` (CSS), `h` (HTML/SVG). A host player runs it with a global `G` API that delivers the song's syllables, words, lines, sections and beats. Your job: turn a brief into one such file that is **correct under seek/pause/resize/theme**, **legible**, and **beautiful**. Paths below are relative to this `skill/` directory.

## The rules that matter most

1. **A frame is a pure function of playback time.** `render(t)` must draw the same picture whether playback reached `t` or the user scrubbed to it. No `Math.random`, `Date.now`, accumulated integration or "what happened last frame" state that a seek would skip. Derive everything from song data, the seed and `t`.
2. **Two halves.** An exported, DOM-free pure half (`buildPlan`, `frameAt`, helpers; unit-testable) above a banner comment, then a thin browser half (`export default function (G, shadowRoot, config)`) that only wires and draws. See `guides/architecture.md`.
3. **Register in `default`, read song data in `INIT`.** `G.on` / `G.off` / `G.onFrame` only inside `default`. `G.map` / `forEach` / `lookup` / `iterator` / `relayout` only once `INIT` has fired (an `INIT` handler, or later callbacks such as `render`), never in `default` itself. Subscribe `G.on(G.TYPE.TICK, render)` for playback; `G.onFrame({ render, reset })` covers SEEK/PLAY/PAUSE/RESIZE and UNINIT.
4. **Clean up with `G.dispose` / `G.listen`.** A function returned from `default` is ignored. Release WebGL (`forceContextLoss`), listeners, timers, camera.
5. **Colours live in CSS, not in `c.v`.** Light values on `:host`, dark overrides in `[data-bs-theme=dark] { }`; canvas reads them back with g-lib `cssColors`. Both themes must look intentional.
6. **Never hand-roll what g-lib has** (clamp, lerp, easing, seeded RNG, canvas fitting, springs, text layout, pools...). Import from the **exact-tag** pin; check `pitfalls/dont-hand-roll.md` and `spec/g-lib.md` before writing any helper.
7. **Legibility beats effect.** The active syllable is readable in light and dark, on phone and laptop, for long lines, CJK, RTL and Myanmar. Large flashes stay under 3 Hz (`guides/accessibility.md`).
8. **Few typed options.** `c` and `cSchema` are plain literals; each option does something visible.

## Workflow (with the repo tools)

1. **Brief.** Write the design brief from `guides/design-brief.md`: one strong, physical picture; the mechanism; which events drive what (the sync map); structure (verse/chorus/beat); legibility plan; options; traps. Pick the backend with its selection table. Reject ideas that cannot stay legible.
2. **Scaffold.** `npm run new -- <name> --backend canvas2d|svg|dom|three` (or copy `templates/<backend>.yaml` by hand and replace `__NAME__`).
3. **Read once:** `spec/module-format.md`, `pitfalls/general.md`, your backend's section in `pitfalls/backends.md`, `pitfalls/dont-hand-roll.md`. Open anything else only through the routing table below.
4. **Implement** the pure half first (time to state), then the thin browser half.
5. **Validate.** `npm run validate -- anims/<file>.yaml`. Fix every error; justify every warning in the docblock or fix it.
6. **Check.** `npm run check -- anims/<file>.yaml` mounts 13 edge-case songs headlessly, scores the conformance table and writes PNGs to `out/<name>/`. **Open the PNGs** (phone/laptop, light/dark). A green table over an ugly or illegible frame is a fail. A WARN on a seek-purity row means the picture depends on history: fix it, or justify it in the docblock (a deliberate simulation).
7. **Preview** (optional). `npm run preview -- anims/<file>.yaml` to play, scrub, flip theme and tweak options.
8. **Review** against `guides/quality-rubric.md` (20 questions), then deliver **the one YAML file** and a short report (filename, final check table, decisions the brief left open, what you deliberately did not do). Do not ship `out/` or the harness.

## Tool-less mode (chat models, no shell)

Skip steps 2, 5-7. Start from the matching template text, write the design brief in your reasoning, then walk `pitfalls/general.md`, the backend section and the 20-question rubric line by line against your own code before answering. Output **only** the YAML file in one fenced block, and mention which rubric items you could not verify without running it (seek purity, theme flip, resize).

## Routing table: open a doc only when its trigger applies

| When you are about to... | Read |
|---|---|
| decide what to build; choose a backend | `guides/design-brief.md` |
| lay out the file; name stages; write the docblock | `guides/architecture.md` |
| use any `G.*` call, event option or id range | `spec/events.md`, `spec/event-shapes.md`, `spec/g.d.ts` |
| add options, colours, theming | `spec/config.md` |
| use time utilities, text measuring, canvas helpers, lifecycle | `spec/utilities.md` |
| split lines into display lines, wrap text | `spec/relayout.md`, `guides/patterns-text.md` |
| trigger things on syllables/lines/beats; pre-spawn; pause; springs | `guides/patterns-timing.md` |
| fit, highlight or style text; non-Latin scripts | `guides/patterns-text.md` |
| write rendering code (DOM, SVG, canvas, three, simulation, layers) | `guides/patterns-render.md`, `pitfalls/backends.md` |
| camera, terrain, swarms, packing, procedural 3D | `guides/techniques.md`, `pitfalls/techniques.md` |
| use a photo or camera | `spec/image-input.md` |
| build a game (autoPlay false, score, states) | `guides/games.md` |
| use any g-lib helper | `spec/g-lib.md` |
| feel unsure about flashing, motion, contrast | `guides/accessibility.md` |
| finish | `guides/quality-rubric.md` |

## Minimal shape (do not ship this; start from a template)

```yaml
"t": |-
  c
"j": |
  import { hash01 } from 'https://cdn.jsdelivr.net/gh/prjctg/g-lib@1.3.0/index.js';
  /* name@0.1: <one line>
   * 1. <numbered design claim: the mechanism and the tempting wrong answer it rejects> */
  export function frameAt(plan, t) { /* pure */ }
  /* Browser half. Everything above this line is DOM-free on purpose. */
  export default function (G, shadowRoot, config) {
    const cfg = G.cfg(config, { channel: G.cfg.int(0) });
    let ready = false;
    const render = (t) => { if (!ready) return; /* draw frameAt(plan, t) */ };
    G.on(G.TYPE.INIT, () => { ready = true; /* G.map(...) is valid here */ });
    G.on(G.TYPE.TICK, render);
    G.onFrame({ render, reset() { ready = false; } });
  }
  export const c = { v: { fadeMs: 150 }, m: [{ s: 'fadeMs', t: 'fadeMs' }] };
  export const cSchema = [{ i: 'fadeMs', n: 'Fade (ms)', t: 'int', mn: 0, mx: 2000 }];
"s": |
  :host { display: block; --ink: var(--inkColor, #111); }
  [data-bs-theme=dark] { --ink: var(--inkColor, #eee); }
"h": |
  <canvas id="c"></canvas>
```

`j`, `s`, `h` hold raw text (never wrapped in backticks or quotes). `t` uses `|-`. The file name carries the version; never edit a published version in place.


======== FILE: spec/config.md ========

# Config: `c`, `cSchema`, `G.cfg`, CSS variables, theming

## `c`: defaults and mappings

```js
export const c = {
  v: { fontSize: '16px', seed: 7 },                 // local defaults
  m: [                                               // global -> local key mappings
    { s: 'textSize', t: 'fontSize' },
    { s: 'seed',     t: 'seed' },
  ],
};
```

- `v`: local defaults used when the host provides nothing.
- `m[].s`: the **global** key the host knows. `m[].t`: the **local** key your code and CSS read.
- Resolution: `config = { ...c.v }`, then for each mapping, if the host has a value for `s` it overwrites local key `t`. A `darkMode` boolean is always added.
- `c` is read **statically**: keep it a plain literal (no function calls, spreads or computed values) or it is ignored.
- Mapped colour keys: **do not put them in `c.v`** for theme-following modules. A default there is injected as a host variable and makes the dark-theme rule unreachable. Leave them out and let the CSS fallback apply.

## `cSchema`: types and labels for the mapped keys

```js
export const cSchema = [
  { i: 'backgroundColor', n: 'Background', t: 'color' },
  { i: 'seed', n: 'Seed', t: 'int', mn: 0, mx: 99999, d: 7 },
  { i: 'style', n: 'Style', t: 'select', o: [['fill', 'Fill'], ['line', 'Line']] },
];
```

| Field | Meaning |
|---|---|
| `i` | the **global** key; must equal one `m[].s` (not the local `t`) |
| `n` | label (defaults to a title-cased `i`) |
| `t` | type: `mchannel`, `tchannel`, `channel`, `select`, `check` / `boolean`, `int`, `number`, `color`. Anything else renders as a text input. |
| `d` | default |
| `o` | options for `select`: `[[value, label], ...]` |
| `mn`, `mx` | numeric range |

Rules:

- Only `i` is required. Without a schema entry the host guesses a type from the key name and default value.
- `m[].t` (local key) and `cSchema[].t` (a type) are unrelated.
- `cSchema` is a plain literal, never sent to the runtime; it only describes the options UI.
- Only mapped globals (`c.m` + `cSchema`) become options fields. Keep purely visual knobs as CSS custom properties.
- Every `m[].s` should have a `cSchema` entry and vice versa; the validator checks both directions.

### Track pickers

| `t` | Lists | Use when |
|---|---|---|
| `mchannel` | main lyric tracks only | the module uses per-word/per-syllable timing (`SYL`, `WORD`). Translations never fire those. |
| `tchannel` | translation tracks only | deliberately translation-only |
| `channel` | every track | subtitle-style display from `LINE` / `SLINE` / `DLINE` |

```js
export const c = { v: { channel: 0 }, m: [{ s: 'lyricsTrack', t: 'channel' }] };
export const cSchema = [{ i: 'lyricsTrack', n: 'Lyrics Track', t: 'mchannel', d: 0 }];
```

### Special keys

- `autoPlay: false` in `c.v`: the module is a game or is driven by pointer input; the host leaves the surface alone. See `../guides/games.md`.
- `allowCamera` / `allowUpload`: tell the host the module shows its own image-input controls.

## Reading config: `G.cfg`

```js
const { channel, fontFamily, seed, mirror, quality } = G.cfg(config, {
  channel: G.cfg.int(0),
  fontFamily: 'sans-serif',
  seed: G.cfg.int(7, 0, 99999),
  mirror: true,
  quality: G.cfg.pick('high', ['high', 'medium', 'low']),
});
```

Returns a frozen object with exactly the keys of the defaults. A missing or wrongly typed value falls back to its default:

- strings must be non-empty (a finite number becomes its string); booleans must be booleans;
- numbers must be finite (numeric strings accepted);
- `G.cfg.int(d, min?, max?)` rejects non-integers and clamps; `G.cfg.num(d, min?, max?)` clamps;
- `G.cfg.pick(d, list)` accepts only members of `list`.

Every key listed counts as "read in `default`", so changing it reloads the module (see `module-format.md`). Keep hand-written reads for derived values.

## CSS variables

Config keys are injected as CSS custom properties on `:host`. Every `var(--name)` you write in `s` is collected, and `:host { --name: value }` is set from the resolved config (and the raw host config). So:

```css
:host { --ink: var(--inkColor, #111); --paper: var(--paperColor, #fff); }
```

declares a themed pair whose host-provided override is `inkColor` / `paperColor`.

## Theming

- The host sets a theme attribute on the wrapper (`data-bs-theme="dark"` for dark). Write `[data-bs-theme=dark] { ... }` and the runtime rewrites it to `:host([data-bs-theme=dark])`. Do not wrap it yourself.
- Light values go on `:host`; dark overrides in the `[data-bs-theme=dark]` block.
- Player state attributes are also available: `:host([data-player-status=playing])`, `:host([data-player-status=paused])`, `:host([data-game-state=...])`.
- A default sheet is prepended: dark mode gets `color:#DEE2E6` and `svg{stroke:#fff;stroke-width:0;fill:#fff}`. Set your own fills explicitly.
- SVG: theme with CSS classes and variables, not presentation attributes (`fill="#fff"` is a fixed colour that a theme switch cannot change).
- Canvas: read colours from CSS with g-lib `cssColors` (see `g-lib.md`) and re-read about once a second, because a theme flip fires no event.
- Interactive modules: put `touch-action: none; user-select: none` on `:host` and listen for `pointerdown`.


======== FILE: spec/event-shapes.md ========

# Event object shapes

Every song event has `id`, `s` (start ms), `e` (end ms) and `b` (beat position). Callbacks get `(eventObject, config)`.

## SYL (syllable)

```ts
{ id, s, e, b,
  d: string,          // display text
  wordId: number, segmentId: number,
  lineId: number,     // composite LINE id (>= 1,000,001)
  isSP: boolean,      // space or punctuation
  syls: Syl[] }
```

## WORD

```ts
{ id, s, e, b, lineId, segmentId, isSP: boolean, syls: Syl[] }
```

Words come from `Intl.Segmenter` for scripts written without spaces (Japanese, Chinese, Thai), so word boundaries are linguistically correct.

Space/punctuation syllables and words (`isSP: true`) exist in the underlying arrays but are excluded from callbacks and `G.map` unless `includeDash: true`.

## SEGMENT

```ts
{ id, s, e, b, lineId, d: string | null }   // d is null for translation segments
```

## LINE (composite, id >= 1,000,001)

```ts
{ id, s, e, b, secId,
  actualStart?: number, actualEnd?: number }   // only on objects passed to G.on callbacks, NOT in G.map results
```

`syl.lineId` equals the `id` of its LINE: key line maps by `line.id` directly.

## DLINE (display line, id >= 2,000,001)

```ts
{ id, s, e, b,
  lineId: number,     // composite LINE this slices
  secId: number,
  dIdx: number,       // 0-based index within the lyric line
  dCount: number,     // display lines this lyric line was split into
  l: number[],        // segment ids touched
  syls: number[],     // syllable IDS, not objects
  actualStart?, actualEnd? }                   // callbacks only
```

- id = `2000001 + (lineId - 1000001) * 32 + dIdx`, so it survives a reflow that does not move that display line.
- Without `G.relayout` there is exactly one DLINE per LINE (`dIdx 0`, `dCount 1`).
- `G.map(G.TYPE.SYL, { dlineId })` gives a display line's syllables as objects; `G.toString(dline)` gives its text.

## SLINE (per-stream, id < 1,000,001)

```ts
{ id, s, e, b, secId, lineId }   // lineId = composite LINE it belongs to
```

Prefer LINE.

## SECTION

```ts
{ id, s, e, b, type?: 'verse' | 'chorus' | 'inst' }
```

- `e` is the next section's start (the last ends at the song duration).
- `chorus`: at least half of the section's lines recur in another section. `inst`: no lines. Otherwise `verse`.
- A song with a **single** section is typed `verse`; if you want chorus-by-repetition there, detect repetition per line yourself.
- Songs with no lyrics (filler syllables) have `e` on every section but **no `type`**. Treat `type` as optional.

## BEAT / CHORD / KEY / TIMESIG

```ts
{ id, s, e, b }
```

## MEASURE

```ts
{ id, s, e, b, notes?: Note[] }    // notes only with { notes: true }
```

## NOTE

```ts
{ id, s, e, b, v: number /* MIDI pitch */, r: boolean /* rest */ }
```

## Real-world data to expect

Fixtures that only contain tidy songs hide bugs. Real songs have: no lyrics at all, no beats, no word ids, one very long line, several channels, Myanmar/CJK/RTL text, very dense lyrics, a single section, and a final bar with no end. See `../guides/quality-rubric.md` for the edge-case list and `harness/fixtures.js` for builders.


======== FILE: spec/events.md ========

# Events, subscriptions and song data

## Subscribing

```js
G.on(type, callback)
G.on(type, options, callback)
G.off(type, options, callback)      // fires at the event END time (e), not the start
```

Song-event subscriptions return an integer subscription index. All registrations happen inside `default`.

Callbacks for song events receive `(eventObject, config)`.

## `EventOptions`

| Key | Type | Meaning |
|-----|------|---------|
| `channel` | number | Lyric track. `0` primary language, `1+` translations. Same index space as `G.getSongData().lyricLangs`. |
| `stream` | number | Sub-stream inside the channel. |
| `offset` | number (ms) | Shifts the fire time. Negative fires early. `ev.s` stays the true time. |
| `batchEvents` | boolean | Receive an array of same-timestamp events in one call. |
| `includeDash` | boolean | SYL/WORD: also deliver space/punctuation items (`isSP`). Default false. |
| `secId`, `lineId`, `dlineId`, `segmentId`, `wordId` | number | Filter by parent id. |
| `notes` | boolean | MEASURE: attach `notes`. |
| `syls` | boolean | NOTE: attach `syls`. |
| `lookahead` | number (ms) | LINE/SLINE/SEGMENT: look-ahead window. Not supported on DLINE. Spell it exactly. |
| `prevSylLimit` | boolean | LINE/DLINE/SLINE/SEGMENT/WORD: clamp an early fire so it cannot overlap the previous unit's last syllable. |
| `prevSylRatio` | 0..1, default 0.3 | Share of the gap usable as early headroom. |
| `prevSylOffset` | ms, default 0 | Added to the clamped start. |
| `parentLimit` | boolean | WORD/SYL: never fire before the parent LINE/DLINE subscription. |
| `parentId` | number | Index of the parent subscription (see below). |

Spell options exactly. Unknown keys are silently dropped (`lookahead` is a real option; `lookAhead` is not and is ignored).

### Early-fire clamping

Lyric modules fire LINE events early (negative `offset`) to animate an incoming line. A large offset can overlap the previous line's last syllable. With `prevSylLimit: true` the start is clamped to:

```
clampedStart = prevSylEnd + prevSylRatio * (nominalStart - prevSylEnd) + prevSylOffset
```

where `prevSylEnd` is the **start time of the last sung syllable of the previous unit** (previous line for LINE/SLINE, previous display line for DLINE, previous segment for SEGMENT, previous word for WORD; spaces skipped). Floor: `prevSylEnd + 1 ms`.

- `prevSylRatio` 0 = fire as the previous unit's last syllable begins; 1 = fire at the unit's own start; default 0.3.
- Only the start moves. The end stays nominal, so an early unit is stretched, not shifted.
- LINE/DLINE/SLINE/SEGMENT ends are also cut to the next unit's clamped start. **WORD is start-clamped only.**
- `prevSylLimit` has no effect on SYL subscriptions.

`parentLimit` + `parentId`: the event never fires earlier than the resolved start of its parent subscription. `parentId` is the zero-based index among **LINE and DLINE subscriptions only**, in registration order, all LINE ones counted before any DLINE one. The parent must be registered in the same batch (inside `default`).

```js
// subscription 0 for parentId purposes
G.on(G.TYPE.LINE, { offset: -1000, prevSylLimit: true, prevSylRatio: 0.3 }, (line) => { /* ... */ });
// never before its parent line fires
G.on(G.TYPE.WORD, { offset: -1500, parentLimit: true, parentId: 0 }, (word) => { /* ... */ });
```

## `G.TYPE`

System events:

| Constant | Value | Callback |
|---|---|---|
| `TICK` | 1000 | `(timeMs, deltaMs)` every animation frame while playing |
| `SEEK` | 1001 | `()` position jumped |
| `PLAY` | 1002 | `(startTimeMs)` |
| `PAUSE` | 1003 | `()` |
| `UNINIT` | 1007 | `()` module is being unloaded |
| `INIT` | 1008 | `()` song data ready |
| `RESIZE` | 1009 | `(ResizeObserverEntry[])` |
| `GAME` | 1010 | `(state, prev)` game-shell state changed |

Song events:

| Constant | Value | Notes |
|---|---|---|
| `BEAT` | 1011 | each beat |
| `MEASURE` | 1012 | each measure |
| `TIMESIG` | 1013 | time-signature change |
| `KEY` | 1014 | key change |
| `CHORD` | 1015 | chord change |
| `SECTION` | 1021 | verse / chorus / inst |
| `SLINE` | 1031 | per-stream line. Prefer LINE. |
| `LINE` | 1032 | composite lyric line, ids start at 1,000,001 |
| `DLINE` | 1033 | display line, ids start at 2,000,001; one per LINE unless `G.relayout` splits it |
| `SEGMENT` | 1041 | phrase inside a line |
| `WORD` | 1051 | word start |
| `SYL` | 1061 | syllable start |
| `NOTE` | 1063 | musical note |

`WORD_` (1052) and `SYL_` (1062) are deprecated: use `WORD`/`SYL` with `{ includeDash: true }`.

To redraw on SEEK/PLAY/PAUSE/RESIZE and clean up on UNINIT, prefer `G.onFrame({ render, reset })`, `G.dispose` and `G.listen` over hand-wiring each type (see `utilities.md`).

## Reading song data (after INIT)

These throw before `INIT` has fired, so never call them in `default`. Call them from an `INIT` handler, or from any later callback (a lazy build inside `render` is fine).

```js
G.map(type, options?, transform?)      -> array
G.forEach(type, options?, callback?)   -> void
G.lookup(type, options?, transform?)   -> Map<id, event | transformed value>
G.iterator(type, options?, transform?) -> { next(): { value, done } }
G.getSongData()                        -> { title, artist, duration, beat: { type, bpm }, streamCount, lyricLangs }
```

- `options` and `transform` are optional. `iterator` is stateful, auto-seeked on play/jump; when `done` is true `value` is a **random** item, not end-of-data.
- Space/punctuation (`isSP`) items are excluded from callbacks and `map` unless `includeDash: true`.
- `beat.bpm` falls back to 120 when the song has no beat data.
- Calling these before INIT throws `G.map can only be called after initialization`.

## Time and timing model

```js
G.currentTime()   // ms
G.toBeat(ms)      // ms -> beat (handles tempo maps)
G.toMs(beat)
G.progress(event, ms)   // 0..1 through a timed event {s, e}; 1 when duration <= 0
G.getPlaybackRate()
```

- The player owns the clock. The module's frame clock is kept within about a frame of it.
- A paused scrub fires SEEK, then one TICK pass with `deltaMs = 0`.
- `G.off` handlers fire at the event end `e`; for LINE they also fire on seek.
- `G.emit(name, data)` is fire-and-forget between modules of a collection and is **not replayed on seek**. Derive cross-layer coordination from the same song data instead.

## Playback control

`G.seek(ms)`, `G.play()`, `G.pause()` are requests to the player (async). `G.setConfig(updates)` merges config updates and is valid only after INIT.

## Seek-safe patterns

See `../guides/patterns-timing.md` for pre-spawn, line lifecycle, pre-timed arrival and seek reconciliation. The single rule behind all of them: **a frame is a pure function of playback time**.


======== FILE: spec/g-lib.md ========

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


======== FILE: spec/g.d.ts ========

```ts
/**
 * Types for the `G` object an anim module receives: `export default function (G, shadowRoot, config)`.
 *
 * The prose in the neighbouring spec pages explains behaviour and gives examples; this file is the compact
 * signature reference. Times are milliseconds unless a name says `beat`. `G.uninit` is internal and not part of the contract.
 * Reference implementation of this surface: harness/g-mock.js.
 */

// ── Event objects (event-shapes.md) ─────────────────────────────────────────────

/** Fields every song event carries. */
export interface TimedEvent {
  id: number;
  /** start ms */
  s: number;
  /** end ms */
  e: number;
  /** beat position */
  b: number;
}

export interface Syl extends TimedEvent {
  /** display text */
  d: string;
  wordId: number;
  segmentId: number;
  /** composite LINE id (>= 1,000,001) */
  lineId: number;
  /** space / punctuation: present in the array, excluded from callbacks and `map` unless `includeDash` */
  isSP: boolean;
  syls: Syl[];
}
export interface Word extends TimedEvent {
  lineId: number;
  segmentId: number;
  isSP: boolean;
  syls: Syl[];
}
export interface Segment extends TimedEvent {
  lineId: number;
  /** null for translation segments */
  d: string | null;
}
export interface Line extends TimedEvent {
  /** composite id >= 1,000,001 */
  id: number;
  secId: number;
  /** only on objects passed to `G.on` callbacks, not in `G.map` results */
  actualStart?: number;
  actualEnd?: number;
}
/** Display line (>= 2,000,001): a wrapped slice of a LINE. One per LINE unless `G.relayout` splits it. */
export interface DLine extends TimedEvent {
  lineId: number;
  secId: number;
  /** 0-based index within the lyric line */
  dIdx: number;
  dCount: number;
  /** segment ids touched */
  l: number[];
  /** syllable ids (numbers, NOT objects; render from the `G.relayout` result) */
  syls: number[];
  actualStart?: number;
  actualEnd?: number;
}
/** Per-stream line (< 1,000,001). Prefer `Line`. */
export interface SLine extends TimedEvent {
  secId: number;
  /** composite LINE id this belongs to */
  lineId: number;
}
export interface Section extends TimedEvent {
  /**
   * chorus when >= half its lines recur in another section; inst when it has no lines.
   * Absent on filler (no-lyrics) sections, which have nothing to classify.
   */
  type?: "verse" | "chorus" | "inst";
}
export type Beat = TimedEvent;
export type Chord = TimedEvent;
export type Key = TimedEvent;
export type TimeSig = TimedEvent;
export interface Note extends TimedEvent {
  /** MIDI pitch */
  v: number;
  /** rest */
  r: boolean;
}
export interface Measure extends TimedEvent {
  /** present with the `notes: true` option */
  notes?: Note[];
}

// ── Event types (G.TYPE) ───────────────────────────────────────────────────────────────────────

export interface EventTypes {
  /** every animation frame while playing: (timeMs, deltaMs) */
  readonly TICK: 1000;
  readonly SEEK: 1001;
  /** (startTimeMs) */
  readonly PLAY: 1002;
  readonly PAUSE: 1003;
  readonly UNINIT: 1007;
  /** song data ready; G.map/forEach/iterator/lookup are valid from here */
  readonly INIT: 1008;
  /** (ResizeObserverEntry[]) */
  readonly RESIZE: 1009;
  /** (state: GameState | null, prev: GameState | null) game-shell state changed; null = left Game mode */
  readonly GAME: 1010;
  readonly BEAT: 1011;
  readonly MEASURE: 1012;
  readonly TIMESIG: 1013;
  readonly KEY: 1014;
  readonly CHORD: 1015;
  readonly SECTION: 1021;
  readonly SLINE: 1031;
  readonly LINE: 1032;
  readonly DLINE: 1033;
  readonly SEGMENT: 1041;
  readonly WORD: 1051;
  /** @deprecated use WORD with { includeDash: true } */
  readonly WORD_: 1052;
  readonly SYL: 1061;
  /** @deprecated use SYL with { includeDash: true } */
  readonly SYL_: 1062;
  readonly NOTE: 1063;
}

/** Maps a song event type to the object a callback receives. */
export interface EventOf {
  1011: Beat;
  1012: Measure;
  1013: TimeSig;
  1014: Key;
  1015: Chord;
  1021: Section;
  1031: SLine;
  1032: Line;
  1033: DLine;
  1041: Segment;
  1051: Word;
  1061: Syl;
  1063: Note;
}

/** Subscription / data-access options (events.md). */
export interface EventOptions {
  /** lyric track: 0 primary, 1 translation. Use `mchannel` config for SYL/WORD (translations never fire them) */
  channel?: number;
  stream?: number;
  /** shifts the fire time, ms (negative = early) */
  offset?: number;
  /** receive an array of same-timestamp events in one call */
  batchEvents?: boolean;
  /** SYL/WORD: include space/punctuation items */
  includeDash?: boolean;
  secId?: number;
  lineId?: number;
  /** display line id (see `relayout`) */
  dlineId?: number;
  segmentId?: number;
  wordId?: number;
  /** MEASURE: attach `notes` */
  notes?: boolean;
  /** NOTE: attach `syls` */
  syls?: boolean;
  /** LINE/DLINE/SLINE/SEGMENT/WORD: clamp early fire so it cannot overlap the previous unit's last syllable */
  /** look-ahead window in ms for line-family subscriptions; spelled exactly `lookahead`; not supported on DLINE */
  lookahead?: number;
  prevSylLimit?: boolean;
  /** 0..1, default 0.3 */
  prevSylRatio?: number;
  /** ms, default 0 */
  prevSylOffset?: number;
  /** WORD/SYL: do not precede the resolved start of the parent LINE/DLINE subscription */
  parentLimit?: boolean;
  /** index among LINE and DLINE subscriptions in registration order (all LINE before any DLINE) */
  parentId?: number;
}

// ── relayout / wrap / imageInput ───────────────────────────────────────────────────────────────

export interface RelayoutSpec {
  /** default 0 */
  channel?: number;
  /** px budget; a function is re-evaluated on every reflow. Exactly one of maxWidth / maxChars */
  maxWidth?: number | (() => number);
  /** grapheme budget instead of px; needs no font/measure */
  maxChars?: number | (() => number);
  /** exactly one of font / measure / maxChars: CSS font shorthand */
  font?: string;
  measure?: (text: string) => number;
  /** 0..1, default 0.45 */
  minFill?: number;
  /** default true */
  balance?: boolean;
  /** default true: allow a break inside a word at syllable boundaries */
  splitWords?: boolean;
  /** default 'resize' */
  reflowOn?: 'resize' | 'never';
  /** fires only after a reflow that changed the split */
  onReflow?: (lines: DisplayLayoutLine[]) => void;
}
/** One entry of the `G.relayout` result: a display line with its syllables as OBJECTS. */
export interface DisplayLayoutLine extends Omit<DLine, 'syls'> {
  syls: Syl[];
}

export interface WrapSpec {
  maxWidth?: number | (() => number);
  maxChars?: number | (() => number);
  font?: string;
  measure?: (text: string) => number;
  minFill?: number;
  balance?: boolean;
  /** default false here (word[][] cannot express a split word) */
  splitWords?: boolean;
}

export type ImageInputMode = 'camera' | 'upload' | 'default';
export interface ImageInputOptions {
  /** container to render into (required) */
  mount: Element;
  /** default true */
  allowCamera?: boolean;
  /** default true */
  allowUpload?: boolean;
  /** CSS-flip the camera preview only; default true */
  mirror?: boolean;
  defaultImageUrl?: string | null;
  /** default true */
  showControls?: boolean;
  /** default true */
  controlsAutoHide?: boolean;
  /** default 4000 */
  controlsIdleMs?: number;
  /** default 'top-right' */
  controlsPlacement?: 'top-right' | 'bottom-right';
  onModeChange?: (mode: ImageInputMode) => void;
  onStatus?: (message: string | null) => void;
  onReady?: (el: HTMLVideoElement | HTMLImageElement) => void;
}
export interface ImageInput {
  readonly element: HTMLVideoElement | HTMLImageElement;
  readonly mode: ImageInputMode;
  readonly width: number;
  readonly height: number;
  /** true only in camera mode with `mirror` */
  readonly mirrored: boolean;
  useCamera(): void;
  useUpload(file: File): void;
  useDefault(): void;
  revealControls(): void;
  /** early manual teardown; the runtime also tears down automatically */
  destroy(): void;
}

// ── Config helpers (config.md) ──────────────────────────────────────────────────

export interface Cfg {
  /** typed read: each key falls back to its default when absent or of the wrong type; returns a frozen object */
  <D extends Record<string, unknown>>(config: Record<string, unknown>, defaults: D): Readonly<D>;
  /** integer only (channel, seed); clamped */
  int(d: number, min?: number, max?: number): unknown;
  /** finite number, numeric strings accepted; clamped */
  num(d: number, min?: number, max?: number): unknown;
  /** one of `list`, else `d` */
  pick<T>(d: T, list: readonly T[]): unknown;
}

// ── G ──────────────────────────────────────────────────────────────────────────────────────────

export interface G {
  readonly TYPE: EventTypes;

  // Events. Register inside `default(G, shadowRoot, config)`, never later (throws after init).
  // System types and custom events return nothing; only song-event subscriptions return an index.
  on(type: 1000, cb: (timeMs: number, deltaMs: number) => void): void;
  on(type: 1002, cb: (startTimeMs: number) => void): void;
  on(type: 1001 | 1003 | 1007 | 1008, cb: () => void): void;
  on(type: 1009, cb: (entries: ResizeObserverEntry[]) => void): void;
  on<T extends keyof EventOf>(type: T, cb: (ev: EventOf[T], config: Record<string, unknown>) => void): number;
  on<T extends keyof EventOf>(type: T, options: EventOptions, cb: (ev: EventOf[T], config: Record<string, unknown>) => void): number;
  /** custom event emitted by another module in the collection */
  on(type: string, cb: (data: unknown) => void): void;
  /** fires at the event END time (`e`), not the start */
  off<T extends keyof EventOf>(type: T, cb: (ev: EventOf[T], config: Record<string, unknown>) => void): number;
  off<T extends keyof EventOf>(type: T, options: EventOptions, cb: (ev: EventOf[T], config: Record<string, unknown>) => void): number;
  /** fire-and-forget between modules of a collection; no replay on seek */
  emit(eventName: string, data?: unknown): void;

  // Song data: valid once INIT has fired (an INIT handler, the returned `init()`, or any later callback); throws in default
  map<T extends keyof EventOf, R = EventOf[T]>(type: T, options?: EventOptions | ((ev: EventOf[T], i: number) => R), transform?: (ev: EventOf[T], i: number) => R): R[];
  forEach<T extends keyof EventOf>(type: T, options?: EventOptions | ((ev: EventOf[T], i: number) => void), callback?: (ev: EventOf[T], i: number) => void): void;
  /** stateful, auto-seeked on play/jump; when `done` is true `value` is a random item */
  iterator<T extends keyof EventOf>(type: T, options?: EventOptions, transform?: (ev: EventOf[T]) => unknown): { next(): { value: any; done: boolean } };
  /** id -> event (or transformed value) Map. INIT only */
  lookup<T extends keyof EventOf, R = EventOf[T]>(type: T, options?: EventOptions | ((ev: EventOf[T], i: number) => R), transform?: (ev: EventOf[T], i: number) => R): Map<number, R>;
  /** read-only proxy over the song. `streamCount` = number of stream groups (1 if none); `beat.bpm` falls back to 120 */
  getSongData(): { title: string; artist: string; duration: number; beat: { type: number; bpm: number }; streamCount: number; lyricLangs: string[] };

  // Time
  currentTime(): number;
  toBeat(timeMs: number): number;
  toMs(beat: number): number;
  getPlaybackRate(): number;

  /**
   * Game-shell hooks (Game mode only; every call is optional and a no-op in Anim mode).
   * `state` is the shell's screen; the host also carries `data-game-state`, so
   * `:host([data-game-state=paused])` can style it. Reset your run on "countdown" (sent for a fresh run only; Resume is sent as "paused").
   */
  game: {
    readonly state: "title" | "countdown" | "playing" | "paused" | "ended" | "tutorial" | null;
    /** live score for Results / best score; ignored in "tutorial" */
    score(n: number): void;
    /** game over before the song ends */
    end(result?: { score?: number; grade?: string }): void;
    /** tutorial finished */
    done(): void;
  };
  /** 0..1 through a timed event (takes the event object, not (t, a, b)) */
  progress(event: { s: number; e: number }, timeMs: number): number;

  // Playback control (asks the parent player; async)
  seek(ms: number): void;
  play(): void;
  pause(): void;
  /** merge config updates; only valid after INIT */
  setConfig(updates: Record<string, unknown>): void;

  // DOM
  /** within the shadow DOM (document.getElementById does not work there) */
  getElementById(id: string): Element | null;
  clientRect(): DOMRect;
  svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Record<string, string | number>): SVGElementTagNameMap[K];

  // Text and canvas
  toString(obj: unknown): string;
  /** grapheme clusters (Myanmar-aware) */
  toChars(obj: unknown): string[];
  measureText(text: string, font?: string): TextMetrics;
  context2d(width: number, height: number, dpi?: number, options?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D;
  /** keep a canvas context fitted to the container; fires once immediately, then on each resize */
  /** call in default: it registers a RESIZE handler */
  fit(ctx: CanvasRenderingContext2D, init?: (ctx: CanvasRenderingContext2D) => void): void;
  /** greedy by character count */
  wrap<W>(words: W[], targetLines: number): W[][];
  /** width-based; see `relayout` for the spec keys */
  wrap<W>(words: W[], spec: WrapSpec): W[][];
  /** re-split lyric lines into display lines; call from init() after subscribing to TYPE.DLINE */
  relayout(spec: RelayoutSpec): DisplayLayoutLine[];

  // Lifecycle: torn down on UNINIT / anim switch
  /** `render(timeMs)` on SEEK/PLAY/PAUSE/RESIZE; `reset()` on UNINIT only (it does not wipe on SEEK). Call before INIT completes */
  onFrame(spec: { render?: (timeMs: number) => void; reset?: () => void }): void;
  /** run `fn` at teardown, reverse order; errors are logged, not thrown. Returns `fn` */
  dispose<F extends () => void>(fn: F): F;
  /** addEventListener removed automatically at teardown; returns the remover */
  listen(target: EventTarget, type: string, fn: (ev: any) => void, options?: boolean | AddEventListenerOptions): () => void;

  // Config
  cfg: Cfg;

  // Media
  imageInput(options: ImageInputOptions): ImageInput;

  // Frozen legacy helpers: new modules import these from g-lib instead (the validator flags G.clamp/lerp/ease/randGen)
  /** seeded xorshift32, [0, 1) */
  randGen(seed?: number): () => number;
  /** in place Fisher-Yates */
  shuffle<T>(array: T[]): void;
  /** @deprecated import from g-lib */
  lerp(a: number, b: number, t: number): number;
  /** @deprecated import from g-lib */
  clamp(v: number, lo: number, hi: number): number;
  /** @deprecated import from g-lib */
  ease(t: number, type?: 'in' | 'out' | 'inOut' | 'cubic'): number;
}
```


======== FILE: spec/image-input.md ========

# `G.imageInput`: camera, uploaded photo or fallback image

A unified image source so downstream code (drawing, face detection) treats camera, user photo and default image identically: all resolve to one element, `handle.element`.

```js
const source = G.imageInput({
  mount: G.getElementById('stage'),   // required container
  allowCamera: true,                  // try the camera first
  allowUpload: true,                  // built-in upload button
  mirror: true,                       // CSS-flip the camera preview only
  defaultImageUrl: null,              // fallback URL/data URI; built-in placeholder if omitted
  showControls: true,
  controlsAutoHide: true,             // controls peek on start, fade when idle, return on pointer/touch
  controlsIdleMs: 4000,
  controlsPlacement: 'top-right',     // or 'bottom-right'
  onModeChange: (mode) => {},         // 'camera' | 'upload' | 'default'
  onStatus: (message) => {},          // string | null
  onReady: (el) => {},                // active element has usable pixels
});

source.element   // <video> (camera) or <img> (upload/default)
source.mode      // 'camera' | 'upload' | 'default'
source.width     // natural pixel size of the active element
source.height
source.mirrored  // true only in camera mode with mirror set
source.useCamera(); source.useUpload(file); source.useDefault();
source.revealControls();
source.destroy();                     // optional early teardown
```

- It tries the camera first; on denial or error it falls back to the default image immediately, so there is no dead end.
- Only one of the internal `<video>` / `<img>` is visible. Classes for restyling: `gii-video`, `gii-img`, `gii-status`, `gii-upload-btn`, `gii-camera-btn`, `gii-file-input`, `gii-controls`; `mount` carries `data-gii-mode`.
- Teardown (stopping camera tracks) is automatic on module unload. Do not add a UNINIT handler just for that.
- Never hand-roll `getUserMedia`, file upload or fallback logic.
- It knows nothing about faces. For detection, layer g-lib `loadFaceApi` / `tinyFaceOptions` on `source.element`: run **continuously** in `camera` mode, **once** in `upload` mode (static image), and **never** in `default` mode (use fixed anchors for your own fallback image).
- Modules using it need no `autoPlay` flag; `allowCamera` / `allowUpload` config keys tell the host the module owns its controls.


======== FILE: spec/module-format.md ========

# Module format and lifecycle

An **anim module** is one YAML file that animates a song's lyrics and beats. This page is the whole file contract. Read it once.

## File name

`<kebab-name>@<major>.<minor>.yaml`, for example `drifting-type@0.1.yaml`.

- Name: lowercase letters, digits and single hyphens (`/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`).
- The version is part of the module id. New modules start at `@0.1`. Never edit a published version in place; a changed look is a new version or a config option.

## YAML shape

Exactly four top-level keys:

```yaml
"t": |-
  c
"j": |
  // the whole ES module source (all exports inline)
"s": |
  /* CSS, scoped to the module */
"h": |
  <!-- HTML or SVG template -->
```

| Key | Content | Notes |
|-----|---------|-------|
| `t` | the literal `c` | "code module". Use `\|-` so there is no trailing newline. |
| `j` | the ES module | Use `\|`. Contains `export default` and usually `export const c / cSchema` (and `game`). |
| `s` | CSS text | The module's stylesheet. |
| `h` | HTML/SVG text | The module's markup. |

Rules:

- `j`, `s` and `h` hold **raw text**. Never wrap them in backticks or quotes inside the YAML.
- `j`, `s` and `h` are separate panes in editors. Write the CSS in `s` and the markup in `h`; do **not** also export `s`/`h` from `j` unless you need them computed. If you do export them, the text must equal the `s`/`h` keys (the validator checks).
- A module is a single file: no relative imports of local files. It may import from absolute CDN URLs (see `g-lib.md`) and from nothing else.

## Module exports

| Export | Type | Required | Meaning |
|--------|------|----------|---------|
| `default` | `(G, shadowRoot, config) => void \| { init() }` | yes | Entry point, called once, synchronously. |
| `h` | `string \| (config) => string` | no | Markup placed in the shadow root. |
| `s` | `string \| ({}) => string` | no | CSS scoped to the shadow root. A function receives `{}`, **not** config. |
| `c` | `{ v: object, m: {s,t}[] }` | no | Config defaults and global-to-local key mappings. Plain literal. |
| `cSchema` | `ConfigParam[]` | no | Types/labels for the mapped keys. Plain literal. See `config.md`. |
| `game` | `{ howTo, controls, tutorial }` | no | Game-mode metadata. See `../guides/games.md`. |

Also export pure helpers (`export const DEFAULTS`, `export function layout(...)`) so they can be unit-tested without a DOM. The runtime ignores extra exports.

### `default(G, shadowRoot, config)`

- `G` is the runtime API (`g.d.ts`).
- `shadowRoot` is the root your `h` markup lives in. Use `G.getElementById(id)`; `document.getElementById` cannot see inside it.
- `config` is a **read-only** proxy of the resolved config. Writing throws.
- Register **every** `G.on` / `G.off` / `G.onFrame` here. They throw after initialisation.
- Do **not** call `G.map`, `G.forEach`, `G.iterator`, `G.lookup` or `G.relayout` here: song data does not exist yet.
- Returning a cleanup function does nothing. Use `G.dispose(fn)` and `G.listen(...)`.
- May return `{ init() }`, equivalent to `G.on(G.TYPE.INIT, init)`.

```js
export default function (G, root, config) {
  G.on(G.TYPE.INIT, () => { /* G.map(...) is valid from here */ });
  G.on(G.TYPE.TICK, (timeMs, deltaMs) => { /* draw a frame */ });
}
```

## Lifecycle

```
import module
  -> default(G, root, config)        register all handlers HERE
  -> song data arrives
  -> init(): returned init() then every TYPE.INIT handler   (G.map/forEach/iterator/lookup/relayout valid)
  -> playback
       TYPE.PLAY(startMs)
       TYPE.TICK(timeMs, deltaMs)     every animation frame while playing
       song events (SYL, WORD, LINE, BEAT, ...) at their scheduled times
       TYPE.PAUSE / TYPE.SEEK / TYPE.RESIZE as they happen
  -> TYPE.UNINIT, then G.dispose callbacks in reverse order, listeners from G.listen removed
```

Notes:

- RESIZE never fires before INIT.
- TICK fires only while playing. On a **paused scrub** the player fires SEEK, and the runtime then runs every TICK handler once with `deltaMs = 0` so tick-driven modules repaint.
- `timeMs` never decreases; `deltaMs >= 0`. Still clamp `deltaMs` before integrating anything.
- Song-event handlers (SYL, LINE, ...) and TICK are scheduled by different mechanisms and are **not ordered** relative to each other. Build DOM lazily in whichever handler runs first.
- `G.play()`, `G.pause()` and `G.seek()` are asynchronous requests; the effect arrives later as PLAY/PAUSE/SEEK events.

## Reload vs hot-swap

The runtime records which config keys `default` reads **synchronously while it runs**.

- Change to a key read there -> the module is torn down and re-run (new `h`, UNINIT, `default` again, INIT).
- Change to a key used only as `var(--key)` in `s` -> only the CSS variable updates, nothing reloads.

So: structural options (counts, modes, seeds, channel) are read in `default`; colours and purely visual knobs go through CSS variables and are never read in `default`.

## Minimal complete module

```yaml
"t": |-
  c
"j": |
  import { clamp } from 'https://cdn.jsdelivr.net/gh/prjctg/g-lib@1.3.0/index.js';

  export const h = `<canvas id="c"></canvas>`;
  export const s = `:host{display:block;background:var(--bgColor,#fff)} #c{position:absolute;inset:0;width:100%;height:100%}`;
  export const c = { v: { fadeMs: 200 }, m: [{ s: 'fadeMs', t: 'fadeMs' }] };
  export const cSchema = [{ i: 'fadeMs', n: 'Fade (ms)', t: 'int', mn: 0, mx: 2000 }];

  // pure: a function of time only, so seek/pause/play all give the same frame
  export const alphaAt = (t, syl, fade) => clamp(Math.min((t - syl.s) / fade, (syl.e + fade - t) / fade), 0, 1);

  export default function (G, root, config) {
    const { fadeMs } = G.cfg(config, { fadeMs: G.cfg.int(200, 0, 2000) });
    const canvas = G.getElementById('c');
    const ctx = canvas.getContext('2d');
    let syls = [];
    const render = (t) => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w; canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#111';
      ctx.font = `${Math.round(h * 0.12)}px sans-serif`;
      ctx.textAlign = 'center';
      for (const syl of syls) {
        const a = alphaAt(t, syl, fadeMs);
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.fillText(G.toString(syl), w / 2, h / 2);
      }
      ctx.globalAlpha = 1;
    };
    G.on(G.TYPE.INIT, () => { syls = G.map(G.TYPE.SYL, { channel: 0 }); render(G.currentTime()); });
    G.onFrame({ render });                       // SEEK / PLAY / PAUSE / RESIZE
    G.on(G.TYPE.TICK, (t) => render(t));
  }
"s": |
  :host{display:block;background:var(--bgColor,#fff)} #c{position:absolute;inset:0;width:100%;height:100%}
"h": |
  <canvas id="c"></canvas>
```

(For real modules prefer the templates in `../templates/`, which size canvases per device pixel ratio and read theme colours properly.)


======== FILE: spec/relayout.md ========

# `G.relayout` and `G.wrap`: your own line wrapping

`G.relayout(spec)` re-splits every lyric line of a channel into **display lines** that fit a measured width and moves `TYPE.DLINE` events onto the new boundaries. Use it when the module decides how many visual lines a lyric line occupies (two-line karaoke, fixed-height lyric card, anything that must not wrap or shrink to fit).

```js
export default function (G, root, config) {
  // Subscribe first. The boundaries these fire at are decided later.
  G.on(G.TYPE.DLINE, { channel: 0 }, activate);
  G.on(G.TYPE.SYL,   { channel: 0 }, highlight);

  return {
    init() {
      const lines = G.relayout({
        channel: 0,
        font: '700 52px sans-serif',
        maxWidth: () => G.clientRect().width * 0.9,
        minFill: 0.45,
        onReflow: (relaid) => rebuild(relaid),
      });
      lines.forEach(buildDom);
    },
  };
}
```

## Spec

| Key | Default | Meaning |
|---|---|---|
| `channel` | 0 | lyric channel |
| `maxWidth` | | px budget; a function is re-evaluated on every reflow |
| `maxChars` | | grapheme budget instead of px (exclusive with `maxWidth`; needs no font) |
| `font` | | CSS font shorthand (measure with a private canvas) |
| `measure` | | `(text) => px`; use for SVG text, letter-spacing, anything canvas metrics get wrong |
| `minFill` | 0.45 | a last line narrower than this fraction of the widest pulls a word down |
| `balance` | true | equalise widths across the display lines of one lyric line |
| `splitWords` | true | allow a break inside a word (at syllable boundaries) when one word exceeds the budget |
| `reflowOn` | `'resize'` | or `'never'` |
| `onReflow` | | called only after a reflow that **changed** the split |

Give exactly one of `font` / `measure` / `maxChars`, and one of `maxWidth` / `maxChars`.

## Return value

`DisplayLayoutLine[]` (also the `onReflow` argument):

```ts
{ id, lineId, dIdx, dCount, s, e, text, width, syls: Syl[] /* OBJECTS */ }
```

## Behaviour

- **Split only.** A display line is a contiguous slice of one LINE. Lines are never merged.
- Breaks fall **between words** (`TYPE.WORD` already respects CJK/Thai segmentation); an over-wide word falls back to syllable boundaries unless `splitWords: false`.
- Balanced, not ragged: the line count comes from a greedy pass, widths from the smallest cap that still fits that count; `minFill` repairs a runt. Neither adds a line.
- Leading and trailing spaces of a display line are dropped; interior ones are kept.
- **Idempotent**: a recompute giving the same boundaries notifies nobody.
- One visual run per lyric line: all streams of a composite LINE are packed as one row of text.
- Layouts are per module. Every song starts with an **identity** layout (one DLINE per LINE), which is why `TYPE.DLINE` is safe to subscribe to before calling `relayout`. Calling it asks the player to rebuild its events and re-seek.
- Valid only from INIT (`init()` or a `TYPE.INIT` handler).

## Gotchas

1. A DLINE **event** carries syllable **ids** (`number[]`). The relayout **result** carries objects. Render from the result; use the event only as a trigger, otherwise lines arriving during playback draw empty text.
2. Sort your copy of the result `(a, b) => a.s - b.s || a.id - b.id`: it comes back in lyric-line order, the player dispatches by start time. Index it by DLINE id (rebuild the index in `init` and in `onReflow`).
3. A two-line karaoke needs **one** DLINE subscription: the pending line is `layout[idx + 1]`. An early-firing `prevSylLimit` subscription plus an un-offset one makes the second line's appearance drift.
4. Keep one live entry per row and remove its DOM node synchronously when the row is reused, or SEEK + `onReflow` can render the same line twice.
5. `lookahead` does not work on DLINE.

## `G.wrap`

- `G.wrap(words, targetLines)`: greedy split by character count.
- `G.wrap(words, spec)`: width-based; takes the same keys as `relayout` except `channel`, `reflowOn`, `onReflow`, with `splitWords` defaulting to **false**. Returns `word[][]`.


======== FILE: spec/utilities.md ========

# `G` utilities (non-event members)

Signatures are in `g.d.ts`. This page is behaviour. Check `../pitfalls/dont-hand-roll.md` before writing any helper.

## Time

```js
G.currentTime()     // playback position, ms
G.toBeat(ms)        // ms -> beat number (tempo-map aware)
G.toMs(beat)
G.getPlaybackRate()
G.progress(event, ms)   // 0..1 through any {s, e} event; takes the event object, not (t, a, b)
```

## Text

```js
G.toString(obj)     // lyric object (or array) -> display text
G.toChars(obj)      // grapheme clusters, Myanmar-aware. Never use text.split('') or Array.from(text)
G.measureText(text, font?)   // TextMetrics (shared canvas, cached font)
```

## Canvas

```js
G.context2d(w, h, dpi?, opts?)  // off-DOM canvas context, pre-scaled by dpi (default devicePixelRatio)
G.fit(ctx, init?)               // keep ctx fitted to the container (aspect preserved); runs once now, then on resize. Call in default (it registers a RESIZE handler)
```

For on-screen canvases prefer g-lib `fitCanvas` (see `g-lib.md`).

## DOM

```js
G.getElementById(id)    // searches the shadow root
G.clientRect()          // wrapper DOMRect
G.svg(tag, attrs?)      // SVG element factory; never raw createElementNS
```

## Song metadata

```js
G.getSongData()  // { title, artist, duration, beat: { type, bpm }, streamCount, lyricLangs: string[] }
```

`lyricLangs[channel]` is the language code of that channel; same index space as the `channel` option.

## Lookups (INIT only)

```js
G.lookup(type, options?, transform?)   // Map<id, event>; replaces forEach + Map boilerplate
```

Key by a named field when you build your own maps: key `0` is falsy.

## Lifecycle

```js
G.onFrame({ render?, reset? })  // render(timeMs) on SEEK/PLAY/PAUSE/RESIZE; reset() on UNINIT only. Call in default.
G.dispose(fn)                   // run fn at teardown (reverse order; errors logged). Returns fn.
G.listen(target, type, fn, opts?) // addEventListener removed automatically; returns the remover
```

`onFrame.reset` does **not** run on SEEK/PAUSE: modules that keep live DOM actors still wipe them on SEEK/PAUSE themselves.

## Playback control

`G.seek(ms)`, `G.play()`, `G.pause()` (async requests), `G.setConfig(updates)` (after INIT).

## Game shell (Game mode only; no-ops otherwise)

```js
G.game.state                 // "title" | "countdown" | "playing" | "paused" | "ended" | "tutorial" | null
G.game.score(n)              // live score (ignored in tutorial)
G.game.end({ score?, grade? })
G.game.done()                // tutorial finished
G.on(G.TYPE.GAME, (state, prev) => {})
```

See `../guides/games.md`.

## Custom events

`G.emit(name, data)` / `G.on(name, cb)`: fire-and-forget between modules of a collection, not replayed on seek.

## Frozen legacy math

`G.lerp`, `G.clamp`, `G.ease(t, 'in'|'out'|'inOut'|'cubic')`, `G.randGen(seed)` (xorshift32) and `G.shuffle(arr)` (uses `Math.random`, so **not** seek-safe) exist for old modules. **New modules import the g-lib equivalents** (`g-lib.md`).


======== FILE: pitfalls/backends.md ========

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


======== FILE: pitfalls/dont-hand-roll.md ========

# Don't hand-roll: use what exists

Before writing any helper, find it here. The validator (`npm run validate`) flags local copies of the items marked ⚙ and any use of the frozen legacy `G` math.

| Need | Use | Note |
|---|---|---|
| ⚙ clamp / lerp / easing / smoothstep | g-lib `clamp`, `lerp`, `prog`, `smooth`, `smoother`, `ease(t, type)` | **not** `G.clamp/lerp/ease` (frozen legacy; flagged in new modules) |
| progress 0..1 through a timed event | `G.progress(event, timeMs)` | takes the event object, not `(t, a, b)` |
| config with defaults and type checks | `G.cfg(config, defaults)` + `G.cfg.int/num/pick` | replaces `config.x \|\| d` and `Number.isInteger(...) ? ... : 0` |
| id → event map | `G.lookup(type, options?)` (INIT only) | replaces forEach + Map |
| ⚙ SVG elements | `G.svg(tag, attrs?)` | no raw `createElementNS` |
| ⚙ seeded random | g-lib `mulberry32` / `xorshift32` | no inline `s ^= s << 13…` closures; not `Math.random` |
| stateless per-key randomness | g-lib `hash32` / `hash01` | seek-safe, order-independent |
| shuffle | seeded Fisher-Yates over a copy | `G.shuffle` is in place and uses `Math.random` |
| grapheme clusters | `G.toChars(obj)` | no `split('')` / `Array.from(text)` |
| text metrics / offscreen canvas | `G.context2d(1,1,1)`, `G.measureText`, g-lib `measure` | ink metrics with fallbacks |
| ⚙ canvas follows container + DPR | g-lib `fitCanvas` (or `G.fit`) | no local `ensureSized` |
| theme-aware canvas palette | g-lib `cssColors` | no per-module `getComputedStyle` |
| fit one word to a box | g-lib `layoutWord` | |
| centre syllables per line | g-lib `textLayout` | |
| group syllables into words | g-lib `groupWords` | skips spaces |
| beat-sync pulse | g-lib `beatPulse` | call in `default` |
| spring motion | g-lib `springAt` / `makeSpring` / `spr` | closed-form, seek-safe |
| ballistic motion with drag | g-lib `createPhysics` | closed-form, no state |
| object pool | g-lib `createPool` | `wipe()` on SEEK/UNINIT |
| grid fields, blur, distance transform | g-lib `boxBlur`, `edt`, `thinMask`, `upsample`, `bandPassNoise` | |
| flow / modulation / warp | g-lib `makeFlow`, `makeModulation`, `warpPair` | pure functions of time |
| binary search by time | g-lib `lastAtOrBefore(arr, t, key?)` | |
| colour parse / contrast | g-lib `parseHex`, `luminance`, `contrast` | WCAG ratios |
| case transform | g-lib `applyCase` | |
| glyph raster / coverage sampling | g-lib `rasterizeGlyph`, `sampleCoverage` | |
| three.js stage + teardown | g-lib `createThreeStage`, `disposeObject3D` | |
| face detection setup | g-lib `loadFaceApi`, `tinyFaceOptions` | |
| wrap words to N lines or a width | `G.wrap` or `G.relayout` | `../spec/relayout.md` |
| camera / photo / fallback image | `G.imageInput` | `../spec/image-input.md` |
| per-module cleanup | `G.dispose`, `G.listen`, `G.onFrame({ render, reset })` | not a returned function |

## Before swapping a local copy for a helper

If you are porting existing code rather than writing new, **diff before replacing**. Most local copies differ from the shared one in a constant, a fallback or an edge case, and a swap must not change output.

- `hash32` is not value-compatible with other common hashes: swapping changes seeded output.
- `measure` defaults ascent/descent to 0.75/0.25 of the size and treats ascent 0 as missing but descent 0 as real. Pass `{ ascent, descent }` to keep a module's old fallbacks.
- `groupWords` keys by `(wordId, lineId)`, skips spaces and returns `{wordId, lineId, s, e, text, syls, index}`; a local copy that sorts or filters differently is not equivalent.
- `applyCase` is `upper` / `lower` / passthrough only.


======== FILE: pitfalls/general.md ========

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


======== FILE: pitfalls/techniques.md ========

# Pitfalls by technique

Read only the section for the technique you use. Universal rules: `general.md`. Technique recipes: `../guides/techniques.md`.

## DLINE and `G.relayout`

- **Do not use `lookahead` on DLINE.** The option is spelled `lookahead`; `lookAhead` is silently dropped, and DLINE buckets never honour it.
- **A DLINE event's `syls` is `number[]` (ids); `G.relayout()` returns `syls: Syl[]` (objects).** Render from the layout; use the event only as a trigger, or lines arriving during playback draw empty text.
- **Sort your copy of the `relayout` result `(a, b) => a.s - b.s || a.id - b.id`.** It returns lyric-line order; dispatch is by start time.
- **Show a two-line karaoke from ONE DLINE subscription** (`layout[idx + 1]` for the pending line), not an early `prevSylLimit` one plus an un-offset one: the clamp makes the second line's appearance drift.
- **Keep one live entry per row; remove its node synchronously on reuse.**
- **Subscribe to `TYPE.DLINE` before calling `G.relayout`; give exactly one of `measure`/`font`/`maxChars` and one of `maxWidth`/`maxChars`.**
- **`G.relayout` only splits, and makes one visual run per composite LINE.**

## Time-driven scenes: pools, cameras, static layouts, flow fields

- **Key recycled pool slots on the syllable index (`i % SLOTS`) and use `null` (not `-1`) for "unused".** The mapping survives a seek without bookkeeping.
- **Drive a camera as a pure function of time, keyed on impact** (`camT[i] = impact[i]`), lower-bounded by `panStart = max(camT[i], camT[i+1] − LEAD_MS)`, with a minimum-duration floor between arrivals. Moving it from an offset handler lurches a lane at arming.
- **Use a quintic (`t³(t(6t−15)+10)`, g-lib `smoother`) for camera pans, not quadratic in-out.** The quadratic's acceleration step shows as a tick at each hold.
- **Don't drive a camera from a TICK lerp.** TICK fires only while playing, so a paused scrub freezes the camera. Compute it in `render(t)`.
- **Static layouts: SEEK is a state reconciliation** (binary-search a sorted start-time array against `G.currentTime()`), not a rebuild.
- **Make motion fields (`makeFlow`, `makeModulation`) pure functions of playback time.**

## Terrain and simulated figures

- **Never add a decorative offset to a simulated figure;** give terrain points a render `ry` beside the physics `y` and displace the terrain. An offset stacks fiction on the integrator and looks like teleporting.
- **Use a bump with zero derivative at both ends** (`0.5 * (1 - cos(2πt))`), not `sin(πt)`, which leaves a kink on departure and return.
- **Draw with a damped `rotVis`, keep the true angle for the path;** prefer `speed / (speed + REF)` to `clamp(speed / REF, 0, 1)`. Raw tangents pop once per syllable; an accelerating integrator pins the clamp at 1.
- **Emit ONE fill for a shape built from syllables and split only the stroke.** Adjacent fills anti-alias both sides of a shared edge and leave a hairline seam.
- **Keep the terrain's scale separate from the figure's.**

## Text packing and machine-readable symbols

- **Measure ink, not the em box:** use `actualBoundingBox*`, size the slot around the anchor, place on the alphabetic baseline `y = rowCentre + (asc - desc)/2` (not `dominant-baseline: central`).
- **Bound deliberate cropping per glyph** (`pad + bleed × edgeGlyphWidth`), never by a global overscale; measure crop against the un-padded ink box.
- **When packing rotated glyphs, rotate about the baseline, take extents at the worst anisotropy allowed, and leave a few percent margin.** An under-measured slot is how two glyphs touch.
- **Normalise nodes to height 1 in packing searches (aspect-ratio algebra) and bisect overscale against the exact crop predicate.**
- **Machine-readable symbols (QR-like):** fix the size from the FULL line, draw on whole device pixels, keep the symbol's two colours out of the theme (a themed code stops scanning).
- **Encode lazily per line in a pre-fire handler** (`G.on(G.TYPE.LINE, { offset: -600, prevSylLimit: true })`), not all at INIT.

## Swarms, density fields, even distribution

- **Drop a departing object from the solve when it is MARKED, not when it disappears,** or survivors wait for its exit animation before closing the gap.
- **Make seeks land on a settled simulation** (re-add preceding items, pre-relax off-screen); a scrub otherwise lands mid-transient.
- **Agents planned backwards to land together are in lockstep near the goal:** jitter per-step durations and fan the last step over several sources.
- **Dim additive particles by their packing.** Dense same-colour `lighter` glows saturate a channel and burn legible type into a bar.
- **Drive swarms from a density ERROR with a target normalised by its mean** (`requested = rhoRef * (1 + contrast * coverageAt(x)) / wBar`) and keep the dead band small: an unreachable target never settles; a wide band leaves it lumpy.
- **Subtract the requested field first, then blur the error.** Blurring density then comparing to a sharp target evacuates a ring around every glyph.
- **Use a spiky (not poly6) gradient for short-range repulsion, and make it repulsion-only.** poly6's gradient is 0 at r=0, so coincident objects never separate; attraction collapses sparse patches.
- **Express smoothness as a time constant, sample fields bilinearly, clamp `delta` and sub-step.**
- **Weight rotation steering by `speed²/(speed² + vRef²)`,** and scale tumble torque against a motion reference, not the force clamp.
- **Never spring toward a canonical angle; let angular drag freeze the last heading.**
- **Drive short-range spacing from a clearance error** (`obbOverlap(a, b, gapTarget)`), not overlap-only, and configure a fill FRACTION (<1) of the derived gap. Asking for the full tiling bound never settles.
- **Zero-mean the power-metric weights** (`pw = powerK * (area - meanArea)`) and *subtract* the dead band.
- **Apply contact forces at the midpoint of the clipped contact manifold,** not the furthest corner.
- **Measure, don't guess** (CV of nearest gaps, residual kinetic energy, ring density) before and after a physics change.

## Procedural 3D worlds

- **When syllables are laid out in world metres, derive speed from a low percentile of syllable gaps at INIT (not the minimum),** allocate the pool by age, and size marks against the surface.
- **Sweeping a cross-section along a curve:** keep offsets below the local radius of curvature; build the frame from world-up (`right = normalize(cross(tangent, up))`), not Frenet; drive ribbon, vehicle and paint from one `bank(t)`.
- **Stretch text decals painted flat on a surface along the view direction.** A square decal 70 m out is ~2 px tall at a 4 m camera height.
- **Measure before chunking instanced scenery.** Past ~4 chunks culling finds nothing and each chunk is pure overhead.
- **Generate closed curves analytically** (`r(θ) = 1 + Σ_{k=2..5} a_k·sin(kθ + φ_k)`, `a_k ∝ 1/k²`), normalise perimeter and use `'centripetal'` Catmull-Rom. A random walk with the first point re-pushed leaves a seam kink and can self-intersect.
- **Keep chase-camera distance in the curve's arc length,** not a damped world-space offset (a damped follow lags through corners and reads as a zoom).
- **Keep generators pure** (plain arrays, nothing at module scope) so they test without GPU or CDN.

## Camera / face input

- **Cap multi-subject detection** (`.slice(0, MAX_HEADS)`, largest first).
- **Extrapolate missing landmarks from a measured ratio** (`foreheadTopY = browY - FOREHEAD_RATIO * (chinY - browY)`) and document it as a heuristic: the 68-point model has no forehead points.
- **Provide fixed anchors for the default image;** never run detection on it.


======== FILE: guides/accessibility.md ========

# Accessibility and comfort

An anim plays full-screen over music for minutes. Treat comfort as part of correctness.

## Photosensitivity (WCAG 2.3.1)

- Nothing may flash more than **3 times per second** over a large area (a general flash: a pair of opposing luminance changes of ≥ 10% of the maximum luminance where the darker image is below 0.80 relative luminance, over more than ~25% of a 10° visual field). A strobe on every beat of a fast song violates this.
- Avoid saturated red flashes and high-contrast regular patterns (stripes, checkerboards, concentric rings) that fill the screen and move.
- Beat pulses should modulate **size, small brightness shifts or local glow**, not whole-frame black/white swaps. Cap pulse amplitude (e.g. ≤ 25% luminance change) and give it a decay (`beatPulse`).
- Provide an option to disable flashing effects (`reduceFlash` boolean in `cSchema`), default **off for risky effects**.
- Bursts of many particles in the same colour with additive blending can approach white and flash; dim by packing (`techniques.md`).

## Reduced motion

`prefers-reduced-motion: reduce` is a request to remove large-scale, fast or parallax motion.

```js
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
```

Plan once, up front, which motion is *essential* (it carries the sync: the highlight following the syllable) and which is *decorative* (camera shake, parallax, particle storms, zoom, spin). With reduced motion:

- keep essential sync, as colour/opacity or small-distance movement;
- drop or shrink decorative motion (no shake, no continuous spin, no zoom > ~5%);
- replace slides and sweeps with fades;
- re-read the query on a `change` event (`G.listen(mql, 'change', …)`), since it can change mid-song.

CSS `@keyframes` are covered by a `@media (prefers-reduced-motion: reduce)` rule in `s`, but song-tied motion belongs in `render` (`patterns-timing.md`), so in those modules honouring the preference is yours to do in JS.

## Legibility and contrast

- Lyrics: ≥ 4.5:1 for normal text, ≥ 3:1 for large text, in both themes. Check with g-lib `contrast` in your tests (`parseHex`, `contrast`).
- Never rely on colour alone to show state (active vs idle): add weight, size or position change.
- Minimum text size: about 16 CSS px at the smallest supported container; scale up with the container.
- Keep a calm resting state: a still, readable frame when nothing is sung.

## Quality tiers and low-power devices

Offer `quality: 'auto' | 'high' | 'medium' | 'low'` when work is heavy (`architecture.md`). Lower tiers reduce particle counts, backing-store scale, analysis rate and effects; they must not change the **timing or legibility** of the lyrics.

## Pointer and keyboard (interactive modules)

- Large hit targets (≥ 44 CSS px), `pointerdown` for latency, no hover-only actions.
- Offer a non-timing assist for games (wider windows, no fail state) via an option.
- Don't trap keys the host needs (Esc/P pause the run in Game mode).

## Language

- Test with CJK, RTL and Myanmar fixtures (`quality-rubric.md`); never reorder or split graphemes manually.


======== FILE: guides/architecture.md ========

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


======== FILE: guides/design-brief.md ========

# Design brief

Write this **before** any code. It is short (a page), it forces the decisions that decide whether the module is good, and it replaces "look at existing animations for inspiration". If the person gave you a brief, check it against this template and fill the gaps yourself; do not stop to ask unless something is truly undecidable.

Work in your head or in a scratch file. Only the YAML is delivered; the brief's essentials go into the module's docblock (`architecture.md`).

## Template

### 1. The picture
One sentence a stranger could sketch. Concrete and physical: *"A paper curtain is pulled across a lit window; each syllable pulls it a notch."* Not *"modern kinetic typography with vibes."*

- What is on screen at the first sung syllable? At 1.1 s? At 11 s? (A composition that only works once it is full has failed the first ten seconds.)
- What is the lyric's role: the object itself (type is the art), or a caption over art?

### 2. Why it is worth building
The physical or perceptual reason it will feel right with music (inertia, a pendulum that rings after a strike, light through a pane). If you cannot say why it belongs with sung words, pick a different picture. Reject early: ideas where the type becomes illegible, and ideas that are a recolour of the default look.

### 3. The mechanism
How the picture is produced, as a pure function of time wherever possible:

- State that is **derived** from time/events (positions, pulses, camera) vs state that is **simulated** (flocks, fluids). For simulated state, say how seek is handled (`patterns-timing.md`, `techniques.md`).
- The one or two formulas that carry the effect (springs, easings, hash-based randomness).
- Backend choice with a reason: `svg`/`dom` (few elements, crisp text, CSS theming), `canvas2d` (many objects, pixel work), `three` (real 3D). See "Backend selection" below.

### 4. Sync map
Which song events drive what. Fill in a table:

| Event | Options | Drives |
|---|---|---|
| `SYL` (`mchannel`) | `offset: -LEAD` | the actor that lands on the syllable |
| `LINE` | `offset: -PREVIEW`, `prevSylLimit` | line enters; `G.off(LINE)` exits |
| `BEAT` | | background pulse |
| `SECTION` | `type` optional | palette / density change |

Rules of thumb: per-syllable timing is the strongest cue; beats are good for ambient pulse; sections for macro change; `TICK`/`render` for everything continuous. Do **not** sample continuous values at event time.

### 5. Structure over the song
What changes between verse, chorus, instrumental and the last line? A module that looks identical for four minutes is monotony; one that changes without reason is noise. Decide the progression (density, palette, camera, scale) and what an instrumental gap shows. Handle a song with a **single section** and a song with **no beats** (fall back to a fixed tempo or to syllable timing).

### 6. Legibility plan
Where does the active lyric sit, at what minimum size, with what contrast in light and dark? What guarantees nothing covers it? (`patterns-text.md`.) How does a very long line behave? How do CJK, RTL and Myanmar behave?

### 7. Options
Which knobs are worth exposing (`c.m` + `cSchema`): seed, a style `select`, a quality tier, colours via CSS variables, track picker (`mchannel` for SYL/WORD modules). Everything purely visual that should hot-swap stays a CSS custom property. Don't expose a knob you cannot explain.

### 8. What to export for tests
List the pure functions above the browser half and the property each must have: *"`planAt(plan, t)` is deterministic"*, *"volume is conserved"*, *"no two glyphs overlap"*, *"result is frame-rate independent"*. These become your own assertions (the validator warns when an exported function touches the DOM).

### 9. Budget
Frame cost target (mean per-frame work ≤ 8 ms at the default quality), caps on object counts with the reason for each number, a quality tier (`auto|high|medium|low`), memory for typed arrays. State what degrades first.

### 10. Traps, in the order you will hit them
Predict them. Typical: zero-length syllables, a line with one syllable, DPR 3, a resize mid-song, seeking backwards into the middle of an animation, a theme flip, a long line that wraps, the first syllable at t < LEAD.

## Backend selection

| Need | Backend |
|---|---|
| ≤ ~150 moving elements, crisp type, easy theming, CSS transitions for chrome | `svg` or `dom` |
| thousands of particles, field/pixel effects, glow, image processing | `canvas2d` |
| perspective, lighting, instancing, real depth | `three` |
| camera/photo input with pixel work | `canvas2d` over `G.imageInput` |

When unsure between `svg` and `canvas2d`, prefer `svg` for a typography-first piece and `canvas2d` for a texture/particle-first piece.

## Reject list

Decline or reshape the idea if it needs: network calls at runtime other than pinned library imports, `Math.random`/`Date.now` in the render path with no way to seed, flashing above 3 Hz over a large area (`accessibility.md`), text that cannot be kept legible, or state that cannot be reconciled after a seek and cannot "relax to rest" credibly.

## Variant vs new module

If the request is only "a different look or setting" of something that already exists in the user's library, do not write a new module: change the existing module's options (or the collection entry that references it) rather than forking code. Write a new module only when the core behaviour differs.


======== FILE: guides/games.md ========

# Game mode

An anim whose `c.v` declares `autoPlay: false` runs in **Game mode**: the host wraps it in a shell (Title → optional How to play → 3-2-1 countdown → Playing ⇄ Paused → Results, plus song select). The seek bar is locked and intro-skip is hidden. **Every hook below is optional.** A game that uses none still gets the full flow with a score-less Results screen.

Declare it **and honour it**: with `autoPlay: false` the host leaves the animation surface alone for taps, so the module owns pointer input. In normal (Animation) mode the module is expected to play itself.

```js
export const c = { v: { autoPlay: false }, m: [] };
const AUTO_PLAY = config.autoPlay === true;
if (!AUTO_PLAY) board.addEventListener('pointerdown', onTap);
```

Interactive CSS: `:host { touch-action: none; user-select: none; }`, listen for `pointerdown` (not `click`).

## States

Read `G.game.state`; subscribe with `G.on(G.TYPE.GAME, (state, prev) => …)` (fires on change only; read `G.game.state` in INIT for the current value). The wrapper also carries `:host([data-game-state=…])` for CSS.

| State | Meaning |
|---|---|
| `title` | Title, How to play or song select; song held at 0 |
| `countdown` | a **fresh run** is about to start: reset your game here, not on SEEK |
| `playing` | the song is running |
| `paused` | pause menu, or the short resume countdown (never `countdown`, so a resume cannot wipe the run) |
| `ended` | Results |
| `tutorial` | your own tutorial is showing: song paused, seek locked, scores ignored |
| `null` | Animation mode: no shell |

Esc / P pause the run for you (call `preventDefault()` on the key if you need it).

## Metadata and reporting

```js
export const game = {
  howTo: [{ icon: 'bi-hand-index', text: 'Tap the circles on the beat' }],  // up to 4 steps; icon = an icon-font class name
  controls: 'Tap · Space · D F J K',
  tutorial: true,    // shows "Try tutorial"; the shell sends state "tutorial"; call G.game.done() when finished
};

G.on(G.TYPE.GAME, (s) => { if (s === 'countdown') resetRun(); });
G.game.score(n);                      // live score; the latest value is the run's score
G.game.end({ score, grade: 'A' });    // game over before the song ends (also fine just after it)
```

Limits the host enforces: at most 4 steps, step text ≤ 140 chars, `controls` ≤ 80, finite scores, grade ≤ 16 chars. Higher scores are better; the best score is stored per game and song by the host.

## Design rules for rhythm games

- Build the note chart from song events at INIT (`SYL`, `BEAT`, `NOTE`), not by listening live; the chart is then deterministic.
- Judge input against the **chart time** (`G.currentTime()`), not wall-clock; allow a tolerance window (±60–120 ms) and show the offset.
- State that must reset per run (score, combo, hit set) is reset on `countdown`. A SEEK in a game is rare (title/restart); handle it by re-deriving what is on screen from time.
- Show the controls on first screen; give clear hit/miss feedback; never rely on colour alone.
- Provide a non-timing assist (larger windows, no fail) via a config option for accessibility.


======== FILE: guides/patterns-render.md ========

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


======== FILE: guides/patterns-text.md ========

# Text patterns

Lyrics are the content: if the text is not legible at the moment it is sung, nothing else matters.

## Legibility rules

- Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large display type, in **both** themes (g-lib `contrast`). The sung/active text should be the highest-contrast thing on screen.
- Text must stay on screen long enough to read: show a line from shortly before its first syllable (a `LINE` handler with negative `offset` + `prevSylLimit`) until after its last.
- Never let decoration cross the active syllable. Effects go behind text, or are masked out under it.
- Strokes: use `paint-order: stroke fill` (SVG) or stroke-then-fill (canvas) so an outline does not eat the glyph.
- Respect the container: fit the text to the frame (`layoutWord`, `G.relayout`, or measured scaling); never rely on overflow.
- Provide a minimum size so a long line does not shrink to illegibility; wrap it instead (`G.relayout`).

## Measure ink, not the em box

`measureText().width` is an advance width and the font box is ascent + descent; neither is what lands on screen. Reserving the em box per row leaves a panel half empty, and the advance box lets an overhanging glyph touch its neighbour. Use `actualBoundingBox*`:

```js
const m = ctx.measureText(text);
const half = Math.max(m.actualBoundingBoxLeft + m.width / 2,     // text-anchor: middle
                      m.actualBoundingBoxRight - m.width / 2,
                      m.width / 2);
const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
// place on the alphabetic baseline (NOT dominant-baseline: central, which re-centres the em box):
const y = rowCentre + (asc - desc) / 2;
```

g-lib `measure(ctx, text, size)` returns `{ width, ascent, descent }` with sensible fallbacks.

## Fitting and "biggest type"

- **One word at the largest size that fits:** g-lib `layoutWord(syllableTexts, { gw, gh, maxRows, measure })`.
- **A line at a size you chose, centred:** g-lib `textLayout`.
- **Fill width per row, height by stretching:** scale each row on its own to fill the width exactly (short rows come out much bigger, which is most of the visual texture), then use any remaining height with a capped vertical `scale(1, s)`.
- **Bound deliberate cropping per glyph.** "Let the text bleed off the edge" is not a global overscale (that crops small glyphs by an arbitrary fraction). Fit to the container, then over-justify one row by `pad + bleed × edgeGlyphWidth`, so the crop on any character is at most `bleed` of its own width, by construction.
- Measure at a reference size and scale; leave a few percent margin because browsers rasterise at the final size and agree only to about 1%.

## Highlights: two edges that must agree

For a syllable wipe, draw the **same** text runs twice, a base layer and a highlight layer clipped to the progress edge. Sharing identical tspans (or identical canvas draw calls) keeps the two edges aligned. Map progress to pixels through measured glyph advances (cumulative widths), not syllable counts. Drive progress with `G.progress(syl, t)` inside `render`.

SVG skeleton:

```xml
<clipPath id="kc"><rect class="clip-rect" x="0" y="0" width="0" height="100%"/></clipPath>
<text class="base-text"><!-- tspans --></text>
<text class="hi-text" clip-path="url(#kc)"><!-- same tspans --></text>
```
```css
.base-text { fill: var(--dim); stroke: var(--halo); stroke-width: 6; stroke-linejoin: round; paint-order: stroke fill; }
.hi-text   { fill: var(--accent); }
```

Call `getBBox()` one `requestAnimationFrame` after `appendChild`: it is not valid until laid out.

## Scripts and segmentation

- Never `split('')` or `Array.from(text)`: use `G.toChars` (grapheme clusters; Myanmar/Indic/emoji-safe).
- Join words with `''` for CJK, `' '` elsewhere; detect CJK from the data, e.g. `/[぀-鿿豈-﫿]/`.
- `TYPE.WORD` already uses a segmenter for whitespace-free scripts (Japanese, Chinese, Thai); never assume breaks inside words.
- RTL: do not reverse syllables yourself. Lay out in logical order and let the browser shape; set `direction`/`unicode-bidi` on the container when mixing scripts. Test with an RTL fixture.
- Escape before `innerHTML` (`& < >`), or use `textContent` / canvas, which need no escaping.
- Fonts: a web-font URL must be loaded before measuring (`document.fonts.load`), otherwise the first layout uses the fallback metrics. Re-layout on `document.fonts.ready`.
- Case transforms: g-lib `applyCase` (upper/lower). Locale-sensitive casing (Turkish `İ`) is out of scope; leave the text alone if unsure.

## Composed-once layouts (colour-only animation)

Most modules rebuild layout on every `LINE`. The opposite discipline, composing the whole sheet once and letting only colour move, makes seek trivial: with nothing to rebuild, `SEEK` is pure reconciliation: binary-search a start-time-sorted array against `G.currentTime()` and mark everything before it "sung", everything after "idle". A camera over such a layout is a CSS transition on a wrapper `<g>` (set `style.transform`; px values are user units in SVG), suppressed for one frame on SEEK so it snaps; a TICK-driven camera would freeze when a paused scrub happens (TICK only fires while playing).

Rules for composed-once layouts:

1. Measure ink (above), place on the baseline.
2. Fill each row to the width; absorb height with a capped vertical scale.
3. Bound crops per glyph.
4. Colour states (idle / sung / active) are CSS classes or a numeric state array, not rebuilt DOM.

## Packing type into a shape

Row layouts always leave slack. To pack (every glyph as large as possible, nothing overlapping, no visible gaps) search layouts in **aspect-ratio algebra**:

- Normalise every node to height 1; its whole shape is one number, `a = w/h`. A guillotine layout is a binary tree of cuts; composing two nodes is series/parallel resistor algebra:

  ```js
  // row: children stacked, sharing the node's width
  const a = 1 / (1 / aL + 1 / aR);  const kL = a / aL, kR = a / aR;
  // col: children side by side, sharing the node's height
  const a = aL + aR;                const kL = 1, kR = 1;
  ```

  `k_i` is the scale factor of everything inside child `i`, so a node carries running aggregates (`Σ weight·log(size)`, smallest and largest type) and each merge is O(1):

  ```js
  wLog: L.wLog + L.wSum * Math.log(kL) + R.wLog + R.wSum * Math.log(kR),
  minU: Math.min(L.minU * kL, R.minU * kR),
  ```

- DP over contiguous runs (reading order must survive), pruned by bucketing candidates on `log(a)` and keeping the best of each bucket (this keeps shape variety, which the final fit needs, while bounding the search).
- Choose the winner by the type size it achieves in this container: `wLog/wSum + log(min(boxW/a, boxH))`, so a shape mismatch pays for itself and no separate aspect penalty is needed. Give a held syllable a heavier weight and the search hands it a cell of its own beside a stack of short ones, an arrangement a row layout cannot express.
- **Bound cropping per glyph against the real polygon:** fit to the container, then bisect a global overscale about the box centre against the exact predicate "no glyph lies more than `bleed` of its own size outside this polygon". Scaling about a point cannot introduce an overlap (every gap scales with it). Measure the crop against the glyph's **un-padded** ink box.
- Rotation is about the **baseline**, not the box centre: extents are asymmetric (width grows by the larger of ascent and descent, height by half the width). If a cell may stretch the glyph anisotropically, take extents at the worst anisotropy allowed: a slot that under-measures is how two glyphs touch.
- Verify with three measurements: pairwise ink-box overlap, per-glyph crop against the polygon, and ink area over container area.

## Machine-readable symbols that grow (QR-like)

Anything with a checksum over its own contents re-encodes at every syllable. To read as one symbol filling in rather than a slideshow:

- **Fix the symbol size for the whole line** (`minVersionFor(fullText, ecc)`) and encode every prefix at that version. At a fixed version the leading data codewords of one prefix are byte-identical to the previous one's; only the count, the new bytes, the padding tail and the ECC change.
- **Spend the format's freedom on continuity:** when several valid masks exist, score all, keep those within ~25% of the best penalty and, among them, take the one with the smallest Hamming distance to the previous frame (~20–30% fewer modules flipped per syllable). Lower ECC churns fewer modules.
- **Encode lazily, per line** in a pre-fire handler (`G.on(G.TYPE.LINE, { offset: -600, prevSylLimit: true })`); compute each line's *version* at INIT (a byte-length lookup, no encoding).
- Draw modules on whole **device** pixels (`Math.floor(available * dpr / total)`), and keep the symbol's two colours out of the theme: a themed symbol stops scanning.
- Keep the payload half DOM-free and exported; decode what your encoder produces in a test (format info → unmask → zig-zag → de-interleave) and check every Reed-Solomon block's syndromes: this catches a misplaced ECC codeword that still round-trips as text.


======== FILE: guides/patterns-timing.md ========

# Timing patterns

Recipes for scheduling visuals against song events. All assume the core rule: **a frame is a pure function of playback time** (see `architecture.md`). Event handlers arm things; `render(t)` draws them.

## Which trigger for which job

| Job | Trigger |
|---|---|
| Something should be visible from the moment a line is about to be sung until it ends | `LINE` with negative `offset` + `prevSylLimit`, `G.off(LINE)` to hide |
| An actor must land exactly on a syllable | `SYL` with `offset: -LEAD_MS`; pose from `(time, syl.s)` |
| Highlight progress inside a syllable | `G.progress(syl, t)` in `render` (not events) |
| A pulse on the beat | g-lib `beatPulse`, or `BEAT` handler storing the last beat time |
| Section-level change (palette, camera mode) | `SECTION`, with `type` treated as optional |
| Two-line karaoke / fixed-height lyric card | one `DLINE` subscription + `G.relayout` |
| Continuous motion (flow, camera, drift) | closed-form function of `t` in `render` |

## Pre-spawn with negative offset

```js
G.on(G.TYPE.SYL, { channel: 0, offset: -TRAVEL_MS }, (syl) => spawnNote(syl));  // syl.s is still the true target time
// in render(t): u = (t - syl.s) / TRAVEL_MS + 1   ->  0 at spawn, 1 at target
```

## Build lookups at INIT, not at event time

```js
let sylInfo = null;
G.on(G.TYPE.INIT, () => {
  sylInfo = G.lookup(G.TYPE.SYL, { channel: 0 }, (syl, idx) => ({ lineId: syl.lineId, idx }));
});
G.on(G.TYPE.SYL, { channel: 0 }, (syl) => { const { lineId, idx } = sylInfo.get(syl.id); /* … */ });
```

`syl.lineId` and `line.id` share an id space; key line maps by `line.id` directly.

## Wipe live state on seek and pause

```js
const wipe = () => { actors.forEach((a) => a.el.remove()); actors.length = 0; };
G.on(G.TYPE.SEEK, wipe);
G.on(G.TYPE.PAUSE, wipe);
G.on(G.TYPE.UNINIT, wipe);
```

Exceptions: elements managed purely by `G.on` / `G.off` pairs clean themselves up; if the module itself calls `G.pause()`, omit the PAUSE wipe (SEEK + UNINIT only).

## SYL/LINE and render are not ordered: build lazily

```js
G.on(G.TYPE.SYL, { channel: 0 }, (syl) => {
  if (!active.has(syl.lineId)) setupLine(syl.lineId);   // never assume render ran first
  activate(syl);
});
```

## Event-driven line lifecycle

```js
// 1. Preview: show early, clamped so it does not overlap the previous line's last syllable
G.on(G.TYPE.LINE, { channel: 0, offset: -PREVIEW_MS, prevSylLimit: true, prevSylRatio: 0.5 },
  (line) => showLine(line.id, true));
// 2. Active: fire at the true start
G.on(G.TYPE.LINE, { channel: 0 }, (line) => transitionToActive(line.id));
// 3. Hide: fires at the end AND on seek (automatic)
G.off(G.TYPE.LINE, { channel: 0 }, (line) => hideLine(line.id));
```

## `G.pause` / `G.play` are async: use a phase machine

```js
let phase = 'idle';   // 'idle' | 'question' | 'waiting' | 'reveal'
G.on(G.TYPE.LINE, { channel: 0 }, () => { if (phase !== 'idle') return; phase = 'question'; G.pause(); });
G.on(G.TYPE.SEEK, () => { phase = 'idle'; });
G.on(G.TYPE.UNINIT, () => { phase = 'idle'; });
```

## Multi-phase animation inside one syllable

For several sub-states across a single syllable (for example several mouth shapes), do not key boundaries off TICK `time` lining up with `syl.s`/`syl.e`. Accumulate elapsed from `delta`:

```js
let active = null;   // { phases: [{ value, endFrac }], duration, elapsed }
G.on(G.TYPE.SYL, { channel: 0 }, (syl) => {
  active = { phases: buildPhases(syl.d), duration: syl.e - syl.s, elapsed: 0 };
});
G.on(G.TYPE.TICK, (time, delta) => {
  if (!active) return;
  active.elapsed += delta;
  const t = active.duration > 0 ? clamp(active.elapsed / active.duration, 0, 1) : 1;
  const phase = active.phases.find((p) => t < p.endFrac) || active.phases.at(-1);
  applyPhase(phase.value);
});
G.on(G.TYPE.SEEK, () => { active = null; });
```

This stays correct when SYL and TICK dispatch are skewed. The trade-off: it is **not** seek-exact. Prefer a pure function of `(time, syl.s, syl.e)` whenever the sub-phases can be derived from time alone.

## Pre-timed arrival: an actor that must land on the syllable

When the syllable is the moment of **impact** (not spawn), two rules keep it exact under scrubbing.

**1. The pose is a pure function of `(time, syl.s)`**, never of accumulated state:

```js
G.on(G.TYPE.SYL, { channel, offset: -LEAD_MS }, (syl) => arm(syl));   // syl.s is the true impact time

// in render(t), per active actor:
const u = (t - (syl.s - LEAD_MS)) / LEAD_MS;          // 0 at launch, 1 at impact
const x = lerp(startX, impactX, u);
const y = lerp(startY, impactY, u) - ARC_H * 4 * u * (1 - u);
const angle = Math.atan2((impactY - startY) - ARC_H * 4 * (1 - 2 * u), impactX - startX);
```

Take the facing angle from the analytic derivative of the same parabola, not a tuned constant: the actor then meets the surface head-first at every lead time and aspect ratio.

**2. SEEK is a reconciliation, not a rebuild:** clear the live set, binary-search the start-time array (`lastAtOrBefore`) for everything whose `[s − lead, s + tail)` window straddles `G.currentTime()`, re-arm those, render one frame. This also covers the case the offset subscription cannot fire at all, such as a first syllable closer to 0 than the lead.

Give the negative-offset handler a few percent of slack before treating a negative `u` as "scrubbed backwards": SYL and TICK are dispatched on different ticks, so the first frame of a flight can read `u` slightly below 0.

**Recycled pools:** key the slot on the syllable **index** (`i % SLOTS`) rather than handing out free slots. The slot for syllable `i` is the one syllable `i − SLOTS` used, which has already left the screen, and the mapping survives a seek without bookkeeping. Use `null` (not `-1`) for "unused": `-1` collides with a real lane index.

**Z-order with a recycled pool:** slot DOM order is not lane order. Anything that must draw over every lane lives in its own layer that mirrors each slot's transform.

## Camera as a pure function of time

A camera moved from the offset handler jumps a whole lane the instant an actor is armed, a whole lead time before anything visibly happens, which reads as a lurch. Drive it from the timeline and key arrivals on the **impact**: `camT[i] = impact[i]`. The pan to actor `i + 1` then travels with that actor.

```js
const panStart = Math.max(camT[i], camT[i + 1] - LEAD_MS);   // never before this actor's own impact
const u = clamp((t - panStart) / (camT[i + 1] - panStart), 0, 1);
return i + smoother(u);                                      // quintic t³(t(6t−15)+10)
```

- The lower bound makes it read as following: well-spaced units hold still after impact and set off when the next actor leaves; a tight burst pans on from the impact it just landed on.
- Use a quintic (`smoother`), not quadratic in-out: the quadratic has a step in acceleration, visible as a tick at each hold.
- Precompute arrival times with a minimum-duration floor between consecutive entries, so units closer than that pan continuously instead of stepping. SEEK then needs no camera bookkeeping.

## Joints and limbs belong in `render`, not `@keyframes`

A CSS animation is the tempting way to cycle a figure's limbs, and it breaks the core rule: it runs on wall-clock time, keeps going while paused and cannot reconstruct its phase at a scrub point. Derive the phase from the same `(time, syl.s)` the position comes from (`ph = (t2 − GLIDE_MS) / STROKE_MS`) and write rotations per frame. It costs a handful of `setAttribute` calls per actor, is scrub-exact, and permits things a keyframe cannot: unequal half-cycles, a second joint driven by the first one's phase, a gesture every other cycle. Cost: `prefers-reduced-motion` becomes yours to honour in JS (`accessibility.md`).

## Display lines (`DLINE`) and `G.relayout`

A DLINE **event** carries syllable ids; `G.relayout()` returns the objects. A module that renders straight from the event silently draws empty text for every line that arrives during playback. Index the layout by display-line id and let the event be only the trigger:

```js
const idxOf = new Map();                       // rebuilt in init() and in onReflow
G.on(G.TYPE.DLINE, { channel }, (ev) => {
  const idx = idxOf.get(ev.id);                // ev.id survives a reflow that doesn't move this line
  if (idx !== undefined) show(idx);
});
```

- Sort your copy `(a, b) => a.s - b.s || a.id - b.id` first: `relayout` returns lyric-line order; the player dispatches by start time.
- **A two-line karaoke needs one subscription, not two.** The obvious shape (an early `{ offset: -previewMs, prevSylLimit: true }` subscription to preview the incoming line plus an un-offset one to activate it) makes the second line's appearance drift, because `prevSylLimit` clamps the lead time to a fraction of whatever gap follows the previous line. The pending line is just `layout[idx + 1]`: render both from one handler.
- Keep at most one live entry per row; remove its node synchronously when the row is reused, or SEEK + `onReflow` rebuild at once and the same line appears twice.
- `lookahead` does not work on DLINE (and is spelled `lookahead`: `lookAhead` is silently dropped).
- Two alternating rows (`row = i % 2`, each aligned to its own edge, both low in the frame like a large subtitle) is a good default layout.
- Expose lots of surface (fonts, colours, outline, shadow, motion) as `c.m` mappings with `cSchema` entries; keep purely visual knobs as CSS custom properties so they hot-swap.

## Closed-form decay and springs

Any "reaction to a trigger" is `f(t − trigger)`:

- decay: `exp(-k·dt)`; pulse: `max(0, 1 − dt / D)`;
- spring: g-lib `springAt(dt, zeta, wn)` / `spr(dt, makeSpring(zeta, wn))`;
- ballistic with drag: g-lib `createPhysics().pos(p, seconds)`.

No integration state means seek, pause and resume are free. When you must integrate (swarms, physics sims), sub-step with a clamped `delta`, and on SEEK re-simulate from the nearest checkpoint (`techniques.md`).

## Wipes and reveals

For a left-to-right syllable wipe, interpolate with `G.progress(syl, t)` inside `render`, and map progress to pixels through measured glyph advances (not syllable counts). Share one set of text runs between the base layer and the highlight layer, and clip the highlight; this keeps the two edges aligned (`patterns-text.md`).


======== FILE: guides/quality-rubric.md ========

# Quality rubric

Use this twice: once before you write code (to set the bar) and once before you deliver. A green validator and conformance table says the module is **not broken**; it says nothing about whether it is **good**. A green table over an ugly frame is a fail. So is a beautiful frame with an illegible lyric.

## The bar (self-review: answer each honestly)

**Picture**
1. Does the first sung syllable already show the idea, and does the composition do something at 1.1 s as well as at 11 s?
2. Is the picture specific and physical (one strong image), or a generic recolour/preset?
3. Does it change across the song (sections, last line, instrumental gap) without becoming noise?

**Legibility**
4. Is the active lyric readable at the moment it matters, in light **and** dark, at phone **and** laptop sizes?
5. Is nothing covering the active syllable? Does a long line still fit (wrap or scale with a floor)?
6. CJK / RTL / Myanmar: graphemes intact, no reordering, no tofu (fonts have fallbacks)?

**Sync**
7. Does the motion read as caused by the music (syllable onset, held notes, beats), not merely running alongside?
8. Do zero-length syllables, one-syllable lines and overlapping events behave?

**Correctness under control**
9. Seek forward/back/into the middle of an effect: same frame as playing there? (conformance "seek" check)
10. Pause/resume: stationary while paused, exact on resume?
11. Resize (and DPR 1, 1.5, 2, 3): repaints, no stretched or blurry canvas?
12. UNINIT: no leaked rAF, timers, listeners, GL contexts, camera tracks, DOM?
13. Theme flip light↔dark: both look intentional (not just inverted)?
14. Deterministic: two runs with the same seed produce the same frames?

**Craft**
15. One docblock with numbered claims, a pure DOM-free half, a banner, a thin browser half?
16. No hand-rolled helper that exists (`../pitfalls/dont-hand-roll.md`); g-lib pinned to an exact tag?
17. Budget stated, caps justified, a quality tier if heavy?
18. Options are few, named for the user, typed (`cSchema`), and each does something visible?
19. Comfort: no >3 Hz large flashes; reduced-motion plan; reduce-flash option if needed (`accessibility.md`)?
20. Would a senior engineer say it is more complicated than the idea needs? If so, simplify.

## Edge-case songs the module must survive

`harness/fixtures.js` provides all of these; `npm run check` mounts every one.

| Fixture | What it exposes |
|---|---|
| `empty` | no events at all (INIT with empty arrays; no division by zero, no `undefined[0]`) |
| `noLyrics` | filler syllables, sections without `type` |
| `noBeats` | no `BEAT`/`MEASURE`; any beat pulse must degrade |
| `oneSection` | a single section (`type: 'verse'`); no chorus detection |
| `noWordIds` | syllables with `wordId` 0/undefined |
| `dense` | very short syllables back to back (≥ 8 per second); pool/slot exhaustion |
| `longLine` | one line of 60+ syllables; wrapping and fitting |
| `cjk` | no spaces, `isSP` absent, wide glyphs |
| `rtl` | right-to-left text |
| `myanmar` | combining clusters; `G.toChars` vs `split('')` |
| `zeroLength` | `s === e` syllables, overlapping events |
| `twoChannels` | channel 1 present (translation without SYL/WORD) |

## Done checklist

- [ ] `npm run validate -- <file>`: no errors, warnings addressed or justified in the docblock
- [ ] `npm run check -- <file>`: all hard checks pass; soft warnings explained
- [ ] Looked at the PNGs in `out/` at phone and laptop sizes, light and dark
- [ ] Walked the 20-question bar above
- [ ] Re-read `../pitfalls/general.md` and the section for your backend and techniques
- [ ] Deliverable is **one** file `<kebab-name>@<major>.<minor>.yaml` with exactly keys `t`, `j`, `s`, `h`

## Final report

Say: the filename; the final check table; the decisions you made that the brief left open and why; anything deliberately not done and why. Do not ship the harness or `out/`.


======== FILE: guides/techniques.md ========

# Techniques

Generic recipes for effects that recur. Read only the section you use; the matching traps are in `../pitfalls/techniques.md`. Keep every solver DOM-free and exported so it can be tested headlessly.

## Terrain generated from syllable timing (slopes, roads, waveforms)

- Emit **one** fill for the whole shape and split only the **stroke** per syllable. Neighbouring fills share an edge and anti-alias both sides, leaving a hairline seam at every junction.

  ```js
  const under = surface.slice().reverse().map((p) => ({ x: p.x, y: p.y + DEPTH }));
  add(layer, 'path', { class: 'body', d: `${pathFrom(surface)}${pathFrom(under, 'L')}Z` });
  seg.crest = add(layer, 'path', { class: 'crest', d: pathFrom(stretch) });   // one per syllable, classed independently
  ```

- Decimate the render path: integrate physics at a fine step, sample every Nth point into the `d` string.
- Keep the terrain's own scale separate from the figure's. Shrinking terrain alone puts several syllables on screen without shrinking the type.
- **Separate render coordinate from physics coordinate.** The figure's position belongs to the integrator. To make part of the ride read differently (airtime), displace the **terrain**: give each point a render `ry` beside its physics `y`, draw from `ry`, move the figure on `y`. A decorative offset on the figure stacks fiction on the simulation and looks like teleporting.
- Bumps need zero derivative at both ends: `0.5 * (1 - Math.cos(2 * Math.PI * t))`, not `sin(πt)`.
- Damp anything derived from terrain that the integrator may snap: keep the true angle for the path and a damped `rotVis` for drawing; use `speed / (speed + REF)` instead of `clamp(speed / REF, 0, 1)` for camera lead, zoom and particle rate.

## Camera

Pure function of time, keyed on impact. See `patterns-timing.md` ("Camera as a pure function of time"). For a static layout, a CSS transition on a wrapper `<g>` with the transition suppressed for one frame on SEEK.

## Swarms and density fields (hundreds of identical objects)

1. **Drive everything from a density ERROR, and normalise the target so it is reachable.** Force ∝ `localDensity − requestedDensity`; a neighbourhood that already has the density produces no force, and drag stops it.

   ```js
   const wBar = 1 + contrast * meanCoverage;                       // mean over the whole field
   const requested = rhoRef * (1 + contrast * coverageAt(x)) / wBar;  // integrates to the object count
   ```

   Without the division the swarm chases an unreachable total and never settles. Keep the dead band small (a few percent of the mean); a wide band calls a lumpy neighbourhood finished.
2. **Two scales.** Short-range SPH pressure alone propagates at "sound speed": redistributing a canvas takes seconds. Splat objects onto a coarse grid, subtract the requested field cell by cell, blur the error hard (repeated 3×3 box blur ≈ Gaussian, `sigma = sqrt(2·passes/3)` cells), and have every object descend its gradient. Keep a small purely **repulsive** SPH kernel underneath for packing (spiky gradient, not poly6: poly6's gradient is 0 at r=0, so coincident objects never separate). Attraction at short range lets a sparse patch collapse into a clump.
3. **Subtract first, then blur.** Blurring the splatted density and comparing with a sharp target makes cells beside a dense feature measure as over-dense; the gradient evacuates a ring around every glyph. Blur is linear, so blurring the error keeps it zero-mean and no halo is representable (measured: ring density 0.0 → 1.2 of the mean, residual kinetic energy 12.4 → 0.13).
4. **Smoothness is a time constant, not a tween.** Ease coverage toward its target (~150 ms), let size follow coverage on its own constant, sample fields **bilinearly** (nearest-cell sampling steps the force at each boundary and objects buzz), clamp `delta` and sub-step.
5. **Rotation:** weight steering by `speed²/(speed² + vRef²)` (quadratic; linear leaves a few percent alive and the field swivels forever); never spring toward a canonical angle; let angular drag freeze the last heading. Scale tumble torque against a motion reference (`drag × a brisk speed`), not the force clamp, or it rounds to nothing.
6. Render: pre-render the glyph once per palette step and `drawImage` it under `setTransform`; read colours from CSS custom properties (`cssColors`).
7. Seek: re-add the preceding items and **pre-relax** off-screen so a scrub lands on a settled frame.

## Even distribution of sized, rotatable boxes (words, tags, thumbnails)

"Evenly distributed" means an **even gap between boxes**, not even spacing of centres.

- **Long range (prevents clumping):** assign a coarse grid cell by cell to the nearest object under a **power metric** `d² − w_i` and accelerate each object toward the centroid of the cells it owns (Lloyd relaxation, integrated, not snapped). Weights are box area with the mean removed (`pw = powerK * (area - meanArea)`); non-zero-mean weights inflate the whole diagram. Drive from the error and *subtract* the dead band so the force is continuous across the threshold.
- **Short range (makes it even):** oriented-box separating-axis test (circle-culled first). A force that exists only while boxes overlap does nothing beyond overlap. Drive from a **clearance error** `k · (targetGap − gap)` by inflating the SAT by the target gap: `obbOverlap(a, b, gapTarget)`; `depth` then reads as the clearance error.
- **Derive the target gap and make it reachable:** configure a *fill fraction* (<1), solve `Σ (2hw + g)(2hh + g) = W·H` for the uniform band that tiles the container, and use a fraction of it. The full tiling bound is not attainable by freely-placed rectangles; asking for it leaves every pair pushing forever (residual KE 13,000 at fill 1.0 vs 12 at 0.75). Repulsion-only; keep Lloyd underneath (repulsion alone can never pull anything into a hole).
- **Apply contact forces at the contact point:** the midpoint of the clipped contact manifold (clip the incident face to the reference face). A force at the centre only slides a box; at the real contact it carries a lever arm, so a wedged word turns out of the way. Using the furthest corner gives symmetric pushes a lever arm they do not have.

  ```js
  function applyAt(item, fx, fy, at, h) {
    item.vx += fx * item.im * h;
    item.vy += fy * item.im * h;
    item.va += torqueK * ((at.x - item.x) * fy - (at.y - item.y) * fx) * item.ii * h;
  }
  ```

- A **departing** object leaves the solve when it is *marked*, not when it disappears: zero its velocities and skip it in every force pass, so survivors close the gap during its exit animation.
- Normalise mass against a reference object, not raw `sqrt(area)`.
- Where readability needs an exception, make it *one* object: the newest word clamped to ±45°, released once the next word arrives.
- Not worth it (measured): Lloyd cells by box distance (6.5× frame cost for no measurable change once the clearance term exists); steering long axes toward the principal axis of free space.
- Verify by **measuring**: CV of nearest gaps (0.45 → 0.02–0.09 across 16–40 objects), minimum gap vs mean, residual kinetic energy, area share, non-overlap, containment.

## Agents that must land together

Agents planned backwards to land together are in lockstep near the goal and read as clumps. Jitter per-step durations (seeded) and fan the last step over several sources. Dim additive particles by their packing (a burst's current scale, the lattice step of small type): dense same-colour `lighter` glows saturate a channel and burn legible type into a bar.

## Procedural 3D worlds

1. **Closed curves analytically, not by random walk.** A walk that re-pushes its first point leaves a seam kink, can self-intersect, and changes length per run.

   ```js
   // r(θ) = 1 + Σ_{k=2..5} a_k·sin(kθ + φ_k),  a_k ∝ 1/k²
   // θ wraps at 2π → closed; r(θ) > 0 and single-valued → star-shaped → cannot self-intersect;
   // the 1/k² falloff bounds curvature: "no hairpins" is one amplitude clamp, not a retry loop.
   ```

   Normalise sampled perimeter to a constant so every seed yields the same length; feed to `new THREE.CatmullRomCurve3(pts, true, 'centripetal')`.
2. **Sweeping a cross-section has a hard limit:** an offset wider than the local radius of curvature folds through itself. Road, curbs and rails (metres) are fine; anything wide belongs on a grid displaced by an analytic height field (which also makes terrain and road the same surface).
3. **Frames:** build with world-up (`right = normalize(cross(tangent, up))`), not Frenet (normals flip at inflections). Derive winding from the first quad; put lane markings in texture UVs; one `bank(t)` drives ribbon, vehicle and paint.
4. **Measure before chunking** instanced scenery (1 chunk = 21 calls / 13.1k tris; 4 chunks = 27 / 9.5k; 8 chunks = 39 / 9.5k: past 4, culling finds nothing and each chunk is pure overhead).
5. **Decals on a surface the camera looks along foreshorten to nothing:** stretch along the view direction (a square decal 70 m out is ~2 px tall at a 4 m camera height).
6. **When the world moves the lyrics, world speed is a layout parameter** (syllables laid out in metres): size marks against the surface (scale a unit plane per instance); derive speed at INIT from a low **percentile** of syllable gaps (not the minimum) and speed up until that gap clears one mark (keep musical anchors, e.g. whole-phrase laps, only ever speed up, cap it); allocate the pool by **age**, taking any free slot and stealing the oldest only when all are live (round-robin repaints an unreached mark, so lyrics look dropped).
7. **Chase camera distance in the curve's arc length**, not a damped world offset (a damped follow lags through corners and reads as an unintended zoom). Smooth the look target if you want the heading eased.
8. Dispose geometry, materials, textures and the context on UNINIT (`G.dispose(stage.dispose)`).

## Camera and face input

- `G.imageInput` for acquisition (`../spec/image-input.md`); face-api on `source.element`, continuous in `camera`, once in `upload`, never in `default` (fixed anchors).
- Detect all subjects and **cap the count**, largest first: `dets.sort((a, b) => areaOf(b.detection.box) - areaOf(a.detection.box)).slice(0, MAX_HEADS)`.
- The 68-point model has no forehead points: extrapolate `foreheadTopY = browY - FOREHEAD_RATIO * (chinY - browY)` and document it as a heuristic.
- Pixel warps: Canvas 2D banded scaling by default; an optional higher-fidelity WebGL path behind a config toggle with a hard fallback (never let its failure reach the console):

  ```js
  try { glfxCanvas = fx.canvas(); } catch (e) { glfxFailed = true; /* canvas 2D path from here on */ }
  ```

- Smooth detections toward targets every frame; throttle the detector (`patterns-render.md`).
- Camera is optional: the module must be fully usable and attractive on the default image.


======== FILE: templates/canvas2d.yaml ========

```yaml
"t": |-
  c
"j": |
  import { cssColors, fitCanvas, hash01 } from 'https://cdn.jsdelivr.net/gh/prjctg/g-lib@1.3.0/index.js';

  /*
   * __NAME__: <one line: the picture, concrete and physical>
   *
   * 1. The picture is a PURE FUNCTION OF TIME. frameAt() maps (plan, t) to what is visible,
   *    so SEEK is just render(G.currentTime()) and a scrub lands on exactly the frame playback drew.
   * 2. Colours live in CSS custom properties (s), not in c.v, so the dark rule is reachable;
   *    the canvas reads them back with cssColors and re-polls about once a second.
   * 3. All randomness is hash01(seed, syllable id): reproducible, order-independent, seek-safe.
   *
   * Not done on purpose: <thing>, because <reason>.
   */

  export const DEFAULTS = { fadeMs: 150, sizeRatio: 0.14, seed: 1 };

  /** 0..1 visibility of [s, e] at time t with a symmetric fade. Pure and continuous. */
  export function envelope(t, s, e, fadeMs) {
    if (!(fadeMs > 0)) return t >= s && t <= e ? 1 : 0;
    if (t < s - fadeMs || t > e + fadeMs) return 0;
    if (t < s) return (t - (s - fadeMs)) / fadeMs;
    if (t > e) return 1 - (t - e) / fadeMs;
    return 1;
  }

  /** Layout, computed once per size (INIT / RESIZE). No time dependence. */
  export function buildPlan(syls, size, cfg) {
    return syls.map((syl) => ({
      id: syl.id, s: syl.s, e: syl.e, text: syl.d || '',
      x: size.w / 2 + (hash01(cfg.seed, syl.id) * 2 - 1) * size.w * 0.15,
      y: size.h / 2,
    }));
  }

  /** What is visible at time t. Fills and returns `out` so a frame allocates nothing new. */
  export function frameAt(plan, t, fadeMs, out) {
    out.length = 0;
    for (const item of plan) {
      const a = envelope(t, item.s, item.e, fadeMs);
      if (a > 0) out.push({ item, a });
    }
    return out;
  }

  /* Browser half. Everything above this line is DOM-free on purpose. */
  export default function (G, shadowRoot, config) {
    const cfg = G.cfg(config, {
      channel: G.cfg.int(0),
      fadeMs: G.cfg.num(DEFAULTS.fadeMs, 0, 2000),
      sizeRatio: G.cfg.num(DEFAULTS.sizeRatio, 0.02, 0.5),
      seed: G.cfg.int(DEFAULTS.seed, 0, 99999),
    });
    const canvas = G.getElementById('c');
    const ctx = canvas && canvas.getContext('2d');
    if (!ctx) return;

    // Fallbacks equal the LIGHT theme values declared on :host in s.
    const palette = cssColors(canvas, { '--ink': '#111111', '--paper': '#ffffff' },
      G.context2d(1, 1, 1, { willReadFrequently: true }));
    const rgb = (key) => 'rgb(' + palette.rgb[key].slice(0, 3).join(',') + ')';

    let ready = false;   // song data exists only after INIT
    let plan = null;
    let size = null;
    let frames = 0;
    const visible = [];

    G.on(G.TYPE.INIT, () => { ready = true; plan = null; });
    G.on(G.TYPE.RESIZE, () => { plan = null; });   // a size change means rebuild, not just resize

    const render = (t) => {
      if (!ready) return;
      if (!plan) {
        const fit = fitCanvas(G, canvas, { minSize: 8 });   // assigning width/height clears the canvas
        if (!fit) return;                                    // container has no size yet
        size = fit;
        plan = buildPlan(G.map(G.TYPE.SYL, { channel: cfg.channel }), fit, cfg);
      }
      if (frames++ % 30 === 0) palette.read();   // a theme flip fires no event: poll about once a second
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = rgb('--paper');
      ctx.fillRect(0, 0, size.w, size.h);
      ctx.font = '700 ' + Math.round(size.h * cfg.sizeRatio) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgb('--ink');
      for (const { item, a } of frameAt(plan, t, cfg.fadeMs, visible)) {
        ctx.globalAlpha = a;
        ctx.fillText(item.text, item.x, item.y);
      }
      ctx.globalAlpha = 1;
    };
    G.on(G.TYPE.TICK, render);                            // playback; onFrame covers SEEK/PLAY/PAUSE/RESIZE
    G.onFrame({ render, reset() { plan = null; ready = false; } });
    G.dispose(() => { plan = null; ctx.clearRect(0, 0, canvas.width, canvas.height); });
  }

  export const c = {
    v: { fadeMs: 150, sizeRatio: 0.14, seed: 1 },
    m: [
      { s: 'fadeMs', t: 'fadeMs' },
      { s: 'sizeRatio', t: 'sizeRatio' },
      { s: 'seed', t: 'seed' },
      { s: 'inkColor', t: 'inkColor' },
      { s: 'paperColor', t: 'paperColor' },
    ],
  };

  export const cSchema = [
    { i: 'fadeMs', n: 'Fade (ms)', t: 'int', mn: 0, mx: 2000 },
    { i: 'sizeRatio', n: 'Text size', t: 'number', mn: 0.02, mx: 0.5 },
    { i: 'seed', n: 'Seed', t: 'int', mn: 0, mx: 99999 },
    { i: 'inkColor', n: 'Ink', t: 'color' },
    { i: 'paperColor', n: 'Paper', t: 'color' },
  ];
"s": |
  :host {
    display: block;
    --ink: var(--inkColor, #111111);
    --paper: var(--paperColor, #ffffff);
    background: var(--paper);
  }
  [data-bs-theme=dark] {
    --ink: var(--inkColor, #eeeeee);
    --paper: var(--paperColor, #101014);
  }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
"h": |
  <canvas id="c"></canvas>
```


======== FILE: templates/dom.yaml ========

```yaml
"t": |-
  c
"j": |
  import { hash01 } from 'https://cdn.jsdelivr.net/gh/prjctg/g-lib@1.3.0/index.js';

  /*
   * __NAME__: <one line: the picture, concrete and physical>
   *
   * 1. The picture is a PURE FUNCTION OF TIME. frameAt() maps (plan, t) to per-syllable
   *    opacity, so SEEK is just render(G.currentTime()) and nothing needs wiping.
   * 2. Colours are CSS custom properties (s), so the dark theme rule is reachable.
   * 3. All randomness is hash01(seed, syllable id): reproducible and seek-safe.
   *
   * Not done on purpose: <thing>, because <reason>.
   */

  export const DEFAULTS = { fadeMs: 150, sizeRatio: 0.14, seed: 1 };

  /** 0..1 visibility of [s, e] at time t with a symmetric fade. Pure and continuous. */
  export function envelope(t, s, e, fadeMs) {
    if (!(fadeMs > 0)) return t >= s && t <= e ? 1 : 0;
    if (t < s - fadeMs || t > e + fadeMs) return 0;
    if (t < s) return (t - (s - fadeMs)) / fadeMs;
    if (t > e) return 1 - (t - e) / fadeMs;
    return 1;
  }

  /** Layout in a w x h box, computed once per size. */
  export function buildPlan(syls, size, cfg) {
    return syls.map((syl) => ({
      id: syl.id, s: syl.s, e: syl.e, text: syl.d || '',
      x: size.w / 2 + (hash01(cfg.seed, syl.id) * 2 - 1) * size.w * 0.15,
      y: size.h / 2,
    }));
  }

  /** Opacity of every plan item at time t (a plain array parallel to the plan). */
  export function frameAt(plan, t, fadeMs, out) {
    out.length = plan.length;
    for (let i = 0; i < plan.length; i++) out[i] = envelope(t, plan[i].s, plan[i].e, fadeMs);
    return out;
  }

  /* Browser half. Everything above this line is DOM-free on purpose. */
  export default function (G, shadowRoot, config) {
    const cfg = G.cfg(config, {
      channel: G.cfg.int(0),
      fadeMs: G.cfg.num(DEFAULTS.fadeMs, 0, 2000),
      sizeRatio: G.cfg.num(DEFAULTS.sizeRatio, 0.02, 0.5),
      seed: G.cfg.int(DEFAULTS.seed, 0, 99999),
    });
    const stage = G.getElementById('stage');
    if (!stage) return;

    let ready = false;   // song data exists only after INIT
    let plan = null;
    let nodes = [];
    const alphas = [];

    const build = () => {
      const r = G.clientRect();
      const size = { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
      plan = buildPlan(G.map(G.TYPE.SYL, { channel: cfg.channel }), size, cfg);
      nodes.forEach((n) => n.remove());
      nodes = plan.map((item) => {
        const el = document.createElement('span');
        el.className = 'word';
        el.textContent = item.text;   // textContent, never innerHTML: lyric text is untrusted
        el.style.fontSize = Math.round(size.h * cfg.sizeRatio) + 'px';
        el.style.transform = 'translate(' + item.x + 'px,' + item.y + 'px) translate(-50%,-50%)';
        el.style.opacity = 0;
        stage.appendChild(el);
        return el;
      });
    };

    G.on(G.TYPE.INIT, () => { ready = true; plan = null; });
    G.on(G.TYPE.RESIZE, () => { plan = null; });

    const render = (t) => {
      if (!ready) return;
      if (!plan) build();
      frameAt(plan, t, cfg.fadeMs, alphas);
      for (let i = 0; i < nodes.length; i++) nodes[i].style.opacity = alphas[i];
    };
    G.on(G.TYPE.TICK, render);                            // playback; onFrame covers SEEK/PLAY/PAUSE/RESIZE
    G.onFrame({ render, reset() { plan = null; ready = false; } });
    G.dispose(() => { nodes.forEach((n) => n.remove()); nodes = []; plan = null; });
  }

  export const c = {
    v: { fadeMs: 150, sizeRatio: 0.14, seed: 1 },
    m: [
      { s: 'fadeMs', t: 'fadeMs' },
      { s: 'sizeRatio', t: 'sizeRatio' },
      { s: 'seed', t: 'seed' },
      { s: 'inkColor', t: 'inkColor' },
      { s: 'paperColor', t: 'paperColor' },
    ],
  };

  export const cSchema = [
    { i: 'fadeMs', n: 'Fade (ms)', t: 'int', mn: 0, mx: 2000 },
    { i: 'sizeRatio', n: 'Text size', t: 'number', mn: 0.02, mx: 0.5 },
    { i: 'seed', n: 'Seed', t: 'int', mn: 0, mx: 99999 },
    { i: 'inkColor', n: 'Ink', t: 'color' },
    { i: 'paperColor', n: 'Paper', t: 'color' },
  ];
"s": |
  :host {
    display: block;
    --ink: var(--inkColor, #111111);
    --paper: var(--paperColor, #ffffff);
    background: var(--paper);
  }
  [data-bs-theme=dark] {
    --ink: var(--inkColor, #eeeeee);
    --paper: var(--paperColor, #101014);
  }
  .stage { position: absolute; inset: 0; overflow: hidden; }
  .word {
    position: absolute; left: 0; top: 0;
    white-space: nowrap;
    color: var(--ink);
    font: 700 1em system-ui, sans-serif;
    will-change: transform, opacity;
  }
"h": |
  <div id="stage" class="stage"></div>
```


======== FILE: templates/svg.yaml ========

```yaml
"t": |-
  c
"j": |
  import { hash01 } from 'https://cdn.jsdelivr.net/gh/prjctg/g-lib@1.3.0/index.js';

  /*
   * __NAME__: <one line: the picture, concrete and physical>
   *
   * 1. The picture is a PURE FUNCTION OF TIME. frameAt() maps (plan, t) to per-syllable
   *    opacity, so SEEK is just render(G.currentTime()) and nothing needs wiping.
   * 2. Colours are CSS classes and custom properties (s), never presentation attributes,
   *    so the dark theme rule wins.
   * 3. All randomness is hash01(seed, syllable id): reproducible and seek-safe.
   *
   * Not done on purpose: <thing>, because <reason>.
   */

  export const DEFAULTS = { fadeMs: 150, sizeRatio: 0.14, seed: 1 };

  /** 0..1 visibility of [s, e] at time t with a symmetric fade. Pure and continuous. */
  export function envelope(t, s, e, fadeMs) {
    if (!(fadeMs > 0)) return t >= s && t <= e ? 1 : 0;
    if (t < s - fadeMs || t > e + fadeMs) return 0;
    if (t < s) return (t - (s - fadeMs)) / fadeMs;
    if (t > e) return 1 - (t - e) / fadeMs;
    return 1;
  }

  /** Layout in a w x h box, computed once per size. */
  export function buildPlan(syls, size, cfg) {
    return syls.map((syl) => ({
      id: syl.id, s: syl.s, e: syl.e, text: syl.d || '',
      x: size.w / 2 + (hash01(cfg.seed, syl.id) * 2 - 1) * size.w * 0.15,
      y: size.h / 2,
    }));
  }

  /** Opacity of every plan item at time t (a plain array parallel to the plan). */
  export function frameAt(plan, t, fadeMs, out) {
    out.length = plan.length;
    for (let i = 0; i < plan.length; i++) out[i] = envelope(t, plan[i].s, plan[i].e, fadeMs);
    return out;
  }

  /* Browser half. Everything above this line is DOM-free on purpose. */
  export default function (G, shadowRoot, config) {
    const cfg = G.cfg(config, {
      channel: G.cfg.int(0),
      fadeMs: G.cfg.num(DEFAULTS.fadeMs, 0, 2000),
      sizeRatio: G.cfg.num(DEFAULTS.sizeRatio, 0.02, 0.5),
      seed: G.cfg.int(DEFAULTS.seed, 0, 99999),
    });
    const root = G.getElementById('stage');
    if (!root) return;

    let ready = false;   // song data exists only after INIT
    let plan = null;
    let nodes = [];
    let size = { w: 0, h: 0 };
    const alphas = [];

    const build = () => {
      const r = G.clientRect();
      size = { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
      root.setAttribute('viewBox', '0 0 ' + size.w + ' ' + size.h);
      plan = buildPlan(G.map(G.TYPE.SYL, { channel: cfg.channel }), size, cfg);
      nodes.forEach((n) => n.remove());
      nodes = plan.map((item) => {
        const node = G.svg('text', { class: 'word', x: item.x, y: item.y, 'font-size': Math.round(size.h * cfg.sizeRatio), opacity: 0 });
        node.textContent = item.text;   // textContent, never innerHTML: lyric text is untrusted
        root.appendChild(node);
        return node;
      });
    };

    G.on(G.TYPE.INIT, () => { ready = true; plan = null; });
    G.on(G.TYPE.RESIZE, () => { plan = null; });

    const render = (t) => {
      if (!ready) return;
      if (!plan) build();
      frameAt(plan, t, cfg.fadeMs, alphas);
      for (let i = 0; i < nodes.length; i++) nodes[i].setAttribute('opacity', alphas[i]);
    };
    G.on(G.TYPE.TICK, render);                            // playback; onFrame covers SEEK/PLAY/PAUSE/RESIZE
    G.onFrame({ render, reset() { plan = null; ready = false; } });
    G.dispose(() => { nodes.forEach((n) => n.remove()); nodes = []; plan = null; });
  }

  export const c = {
    v: { fadeMs: 150, sizeRatio: 0.14, seed: 1 },
    m: [
      { s: 'fadeMs', t: 'fadeMs' },
      { s: 'sizeRatio', t: 'sizeRatio' },
      { s: 'seed', t: 'seed' },
      { s: 'inkColor', t: 'inkColor' },
      { s: 'paperColor', t: 'paperColor' },
    ],
  };

  export const cSchema = [
    { i: 'fadeMs', n: 'Fade (ms)', t: 'int', mn: 0, mx: 2000 },
    { i: 'sizeRatio', n: 'Text size', t: 'number', mn: 0.02, mx: 0.5 },
    { i: 'seed', n: 'Seed', t: 'int', mn: 0, mx: 99999 },
    { i: 'inkColor', n: 'Ink', t: 'color' },
    { i: 'paperColor', n: 'Paper', t: 'color' },
  ];
"s": |
  :host {
    display: block;
    --ink: var(--inkColor, #111111);
    --paper: var(--paperColor, #ffffff);
    background: var(--paper);
  }
  [data-bs-theme=dark] {
    --ink: var(--inkColor, #eeeeee);
    --paper: var(--paperColor, #101014);
  }
  .stage { position: absolute; inset: 0; width: 100%; height: 100%; }
  .word {
    fill: var(--ink);
    font-weight: 700;
    font-family: system-ui, sans-serif;
    text-anchor: middle;
    dominant-baseline: central;
  }
"h": |
  <svg id="stage" class="stage" preserveAspectRatio="none"></svg>
```


======== FILE: templates/three.yaml ========

```yaml
"t": |-
  c
"j": |
  import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
  import { createThreeStage } from 'https://cdn.jsdelivr.net/gh/prjctg/g-lib@1.3.0/index.js';

  /*
   * __NAME__: <one line: the picture, concrete and physical>
   *
   * 1. The scene is a PURE FUNCTION OF TIME. poseAt() maps (plan, t) to the object's scale and
   *    angle, so SEEK is just render(G.currentTime()) and nothing needs wiping.
   * 2. createThreeStage owns renderer, DPR clamp, resize and teardown (geometries, materials,
   *    textures, renderer, GL context), released through G.dispose.
   *
   * Not done on purpose: <thing>, because <reason>.
   */

  export const DEFAULTS = { fadeMs: 150, sizeRatio: 0.14 };

  /** 0..1 visibility of [s, e] at time t with a symmetric fade. Pure and continuous. */
  export function envelope(t, s, e, fadeMs) {
    if (!(fadeMs > 0)) return t >= s && t <= e ? 1 : 0;
    if (t < s - fadeMs || t > e + fadeMs) return 0;
    if (t < s) return (t - (s - fadeMs)) / fadeMs;
    if (t > e) return 1 - (t - e) / fadeMs;
    return 1;
  }

  /** Time ranges only; geometry belongs to the browser half. */
  export function buildPlan(syls) {
    return syls.map((syl) => ({ id: syl.id, s: syl.s, e: syl.e }));
  }

  /** Scale and angle of the object at time t. Deterministic. */
  export function poseAt(plan, t, cfg) {
    let a = 0;
    for (const item of plan) a = Math.max(a, envelope(t, item.s, item.e, cfg.fadeMs));
    return { scale: 0.2 + a * cfg.sizeRatio * 6, angleY: t / 1000 };
  }

  /* Browser half. Everything above this line is DOM-free on purpose. */
  export default function (G, shadowRoot, config) {
    const cfg = G.cfg(config, {
      channel: G.cfg.int(0),
      fadeMs: G.cfg.num(DEFAULTS.fadeMs, 0, 2000),
      sizeRatio: G.cfg.num(DEFAULTS.sizeRatio, 0.02, 0.5),
    });
    const canvas = G.getElementById('c');
    if (!canvas) return;

    const stage = createThreeStage(THREE, G, { canvas, fov: 50, maxDpr: 2 });
    G.dispose(stage.dispose);   // frees geometries, materials, textures, renderer and the GL context
    stage.camera.position.z = 6;
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshNormalMaterial());
    stage.scene.add(box);

    let ready = false;   // song data exists only after INIT
    let plan = null;

    G.on(G.TYPE.INIT, () => { ready = true; plan = null; });
    G.on(G.TYPE.RESIZE, () => { stage.resize(); });

    const render = (t) => {
      if (!ready) return;
      if (!plan) plan = buildPlan(G.map(G.TYPE.SYL, { channel: cfg.channel }));
      const pose = poseAt(plan, t, cfg);
      box.scale.setScalar(pose.scale);
      box.rotation.y = pose.angleY;
      stage.render();
    };
    G.on(G.TYPE.TICK, render);                            // playback; onFrame covers SEEK/PLAY/PAUSE/RESIZE
    G.onFrame({ render, reset() { plan = null; ready = false; } });
  }

  export const c = {
    v: { fadeMs: 150, sizeRatio: 0.14 },
    m: [
      { s: 'fadeMs', t: 'fadeMs' },
      { s: 'sizeRatio', t: 'sizeRatio' },
    ],
  };

  export const cSchema = [
    { i: 'fadeMs', n: 'Fade (ms)', t: 'int', mn: 0, mx: 2000 },
    { i: 'sizeRatio', n: 'Size', t: 'number', mn: 0.02, mx: 0.5 },
  ];
"s": |
  :host {
    display: block;
    --paper: var(--paperColor, #ffffff);
    background: var(--paper);
  }
  [data-bs-theme=dark] {
    --paper: var(--paperColor, #101014);
  }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
"h": |
  <canvas id="c"></canvas>
```
