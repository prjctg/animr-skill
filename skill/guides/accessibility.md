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
