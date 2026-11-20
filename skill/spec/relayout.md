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
