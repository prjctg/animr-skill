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
