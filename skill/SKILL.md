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
