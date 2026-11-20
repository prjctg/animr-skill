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
