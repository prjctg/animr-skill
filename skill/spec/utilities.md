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
