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
