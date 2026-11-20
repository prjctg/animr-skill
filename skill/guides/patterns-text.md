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
