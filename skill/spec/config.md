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
