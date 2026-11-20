# Pitfalls by technique

Read only the section for the technique you use. Universal rules: `general.md`. Technique recipes: `../guides/techniques.md`.

## DLINE and `G.relayout`

- **Do not use `lookahead` on DLINE.** The option is spelled `lookahead`; `lookAhead` is silently dropped, and DLINE buckets never honour it.
- **A DLINE event's `syls` is `number[]` (ids); `G.relayout()` returns `syls: Syl[]` (objects).** Render from the layout; use the event only as a trigger, or lines arriving during playback draw empty text.
- **Sort your copy of the `relayout` result `(a, b) => a.s - b.s || a.id - b.id`.** It returns lyric-line order; dispatch is by start time.
- **Show a two-line karaoke from ONE DLINE subscription** (`layout[idx + 1]` for the pending line), not an early `prevSylLimit` one plus an un-offset one: the clamp makes the second line's appearance drift.
- **Keep one live entry per row; remove its node synchronously on reuse.**
- **Subscribe to `TYPE.DLINE` before calling `G.relayout`; give exactly one of `measure`/`font`/`maxChars` and one of `maxWidth`/`maxChars`.**
- **`G.relayout` only splits, and makes one visual run per composite LINE.**

## Time-driven scenes: pools, cameras, static layouts, flow fields

- **Key recycled pool slots on the syllable index (`i % SLOTS`) and use `null` (not `-1`) for "unused".** The mapping survives a seek without bookkeeping.
- **Drive a camera as a pure function of time, keyed on impact** (`camT[i] = impact[i]`), lower-bounded by `panStart = max(camT[i], camT[i+1] − LEAD_MS)`, with a minimum-duration floor between arrivals. Moving it from an offset handler lurches a lane at arming.
- **Use a quintic (`t³(t(6t−15)+10)`, g-lib `smoother`) for camera pans, not quadratic in-out.** The quadratic's acceleration step shows as a tick at each hold.
- **Don't drive a camera from a TICK lerp.** TICK fires only while playing, so a paused scrub freezes the camera. Compute it in `render(t)`.
- **Static layouts: SEEK is a state reconciliation** (binary-search a sorted start-time array against `G.currentTime()`), not a rebuild.
- **Make motion fields (`makeFlow`, `makeModulation`) pure functions of playback time.**

## Terrain and simulated figures

- **Never add a decorative offset to a simulated figure;** give terrain points a render `ry` beside the physics `y` and displace the terrain. An offset stacks fiction on the integrator and looks like teleporting.
- **Use a bump with zero derivative at both ends** (`0.5 * (1 - cos(2πt))`), not `sin(πt)`, which leaves a kink on departure and return.
- **Draw with a damped `rotVis`, keep the true angle for the path;** prefer `speed / (speed + REF)` to `clamp(speed / REF, 0, 1)`. Raw tangents pop once per syllable; an accelerating integrator pins the clamp at 1.
- **Emit ONE fill for a shape built from syllables and split only the stroke.** Adjacent fills anti-alias both sides of a shared edge and leave a hairline seam.
- **Keep the terrain's scale separate from the figure's.**

## Text packing and machine-readable symbols

- **Measure ink, not the em box:** use `actualBoundingBox*`, size the slot around the anchor, place on the alphabetic baseline `y = rowCentre + (asc - desc)/2` (not `dominant-baseline: central`).
- **Bound deliberate cropping per glyph** (`pad + bleed × edgeGlyphWidth`), never by a global overscale; measure crop against the un-padded ink box.
- **When packing rotated glyphs, rotate about the baseline, take extents at the worst anisotropy allowed, and leave a few percent margin.** An under-measured slot is how two glyphs touch.
- **Normalise nodes to height 1 in packing searches (aspect-ratio algebra) and bisect overscale against the exact crop predicate.**
- **Machine-readable symbols (QR-like):** fix the size from the FULL line, draw on whole device pixels, keep the symbol's two colours out of the theme (a themed code stops scanning).
- **Encode lazily per line in a pre-fire handler** (`G.on(G.TYPE.LINE, { offset: -600, prevSylLimit: true })`), not all at INIT.

## Swarms, density fields, even distribution

- **Drop a departing object from the solve when it is MARKED, not when it disappears,** or survivors wait for its exit animation before closing the gap.
- **Make seeks land on a settled simulation** (re-add preceding items, pre-relax off-screen); a scrub otherwise lands mid-transient.
- **Agents planned backwards to land together are in lockstep near the goal:** jitter per-step durations and fan the last step over several sources.
- **Dim additive particles by their packing.** Dense same-colour `lighter` glows saturate a channel and burn legible type into a bar.
- **Drive swarms from a density ERROR with a target normalised by its mean** (`requested = rhoRef * (1 + contrast * coverageAt(x)) / wBar`) and keep the dead band small: an unreachable target never settles; a wide band leaves it lumpy.
- **Subtract the requested field first, then blur the error.** Blurring density then comparing to a sharp target evacuates a ring around every glyph.
- **Use a spiky (not poly6) gradient for short-range repulsion, and make it repulsion-only.** poly6's gradient is 0 at r=0, so coincident objects never separate; attraction collapses sparse patches.
- **Express smoothness as a time constant, sample fields bilinearly, clamp `delta` and sub-step.**
- **Weight rotation steering by `speed²/(speed² + vRef²)`,** and scale tumble torque against a motion reference, not the force clamp.
- **Never spring toward a canonical angle; let angular drag freeze the last heading.**
- **Drive short-range spacing from a clearance error** (`obbOverlap(a, b, gapTarget)`), not overlap-only, and configure a fill FRACTION (<1) of the derived gap. Asking for the full tiling bound never settles.
- **Zero-mean the power-metric weights** (`pw = powerK * (area - meanArea)`) and *subtract* the dead band.
- **Apply contact forces at the midpoint of the clipped contact manifold,** not the furthest corner.
- **Measure, don't guess** (CV of nearest gaps, residual kinetic energy, ring density) before and after a physics change.

## Procedural 3D worlds

- **When syllables are laid out in world metres, derive speed from a low percentile of syllable gaps at INIT (not the minimum),** allocate the pool by age, and size marks against the surface.
- **Sweeping a cross-section along a curve:** keep offsets below the local radius of curvature; build the frame from world-up (`right = normalize(cross(tangent, up))`), not Frenet; drive ribbon, vehicle and paint from one `bank(t)`.
- **Stretch text decals painted flat on a surface along the view direction.** A square decal 70 m out is ~2 px tall at a 4 m camera height.
- **Measure before chunking instanced scenery.** Past ~4 chunks culling finds nothing and each chunk is pure overhead.
- **Generate closed curves analytically** (`r(θ) = 1 + Σ_{k=2..5} a_k·sin(kθ + φ_k)`, `a_k ∝ 1/k²`), normalise perimeter and use `'centripetal'` Catmull-Rom. A random walk with the first point re-pushed leaves a seam kink and can self-intersect.
- **Keep chase-camera distance in the curve's arc length,** not a damped world-space offset (a damped follow lags through corners and reads as a zoom).
- **Keep generators pure** (plain arrays, nothing at module scope) so they test without GPU or CDN.

## Camera / face input

- **Cap multi-subject detection** (`.slice(0, MAX_HEADS)`, largest first).
- **Extrapolate missing landmarks from a measured ratio** (`foreheadTopY = browY - FOREHEAD_RATIO * (chinY - browY)`) and document it as a heuristic: the 68-point model has no forehead points.
- **Provide fixed anchors for the default image;** never run detection on it.
