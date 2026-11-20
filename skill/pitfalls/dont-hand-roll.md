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
