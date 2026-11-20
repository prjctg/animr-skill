# Techniques

Generic recipes for effects that recur. Read only the section you use; the matching traps are in `../pitfalls/techniques.md`. Keep every solver DOM-free and exported so it can be tested headlessly.

## Terrain generated from syllable timing (slopes, roads, waveforms)

- Emit **one** fill for the whole shape and split only the **stroke** per syllable. Neighbouring fills share an edge and anti-alias both sides, leaving a hairline seam at every junction.

  ```js
  const under = surface.slice().reverse().map((p) => ({ x: p.x, y: p.y + DEPTH }));
  add(layer, 'path', { class: 'body', d: `${pathFrom(surface)}${pathFrom(under, 'L')}Z` });
  seg.crest = add(layer, 'path', { class: 'crest', d: pathFrom(stretch) });   // one per syllable, classed independently
  ```

- Decimate the render path: integrate physics at a fine step, sample every Nth point into the `d` string.
- Keep the terrain's own scale separate from the figure's. Shrinking terrain alone puts several syllables on screen without shrinking the type.
- **Separate render coordinate from physics coordinate.** The figure's position belongs to the integrator. To make part of the ride read differently (airtime), displace the **terrain**: give each point a render `ry` beside its physics `y`, draw from `ry`, move the figure on `y`. A decorative offset on the figure stacks fiction on the simulation and looks like teleporting.
- Bumps need zero derivative at both ends: `0.5 * (1 - Math.cos(2 * Math.PI * t))`, not `sin(πt)`.
- Damp anything derived from terrain that the integrator may snap: keep the true angle for the path and a damped `rotVis` for drawing; use `speed / (speed + REF)` instead of `clamp(speed / REF, 0, 1)` for camera lead, zoom and particle rate.

## Camera

Pure function of time, keyed on impact. See `patterns-timing.md` ("Camera as a pure function of time"). For a static layout, a CSS transition on a wrapper `<g>` with the transition suppressed for one frame on SEEK.

## Swarms and density fields (hundreds of identical objects)

1. **Drive everything from a density ERROR, and normalise the target so it is reachable.** Force ∝ `localDensity − requestedDensity`; a neighbourhood that already has the density produces no force, and drag stops it.

   ```js
   const wBar = 1 + contrast * meanCoverage;                       // mean over the whole field
   const requested = rhoRef * (1 + contrast * coverageAt(x)) / wBar;  // integrates to the object count
   ```

   Without the division the swarm chases an unreachable total and never settles. Keep the dead band small (a few percent of the mean); a wide band calls a lumpy neighbourhood finished.
2. **Two scales.** Short-range SPH pressure alone propagates at "sound speed": redistributing a canvas takes seconds. Splat objects onto a coarse grid, subtract the requested field cell by cell, blur the error hard (repeated 3×3 box blur ≈ Gaussian, `sigma = sqrt(2·passes/3)` cells), and have every object descend its gradient. Keep a small purely **repulsive** SPH kernel underneath for packing (spiky gradient, not poly6: poly6's gradient is 0 at r=0, so coincident objects never separate). Attraction at short range lets a sparse patch collapse into a clump.
3. **Subtract first, then blur.** Blurring the splatted density and comparing with a sharp target makes cells beside a dense feature measure as over-dense; the gradient evacuates a ring around every glyph. Blur is linear, so blurring the error keeps it zero-mean and no halo is representable (measured: ring density 0.0 → 1.2 of the mean, residual kinetic energy 12.4 → 0.13).
4. **Smoothness is a time constant, not a tween.** Ease coverage toward its target (~150 ms), let size follow coverage on its own constant, sample fields **bilinearly** (nearest-cell sampling steps the force at each boundary and objects buzz), clamp `delta` and sub-step.
5. **Rotation:** weight steering by `speed²/(speed² + vRef²)` (quadratic; linear leaves a few percent alive and the field swivels forever); never spring toward a canonical angle; let angular drag freeze the last heading. Scale tumble torque against a motion reference (`drag × a brisk speed`), not the force clamp, or it rounds to nothing.
6. Render: pre-render the glyph once per palette step and `drawImage` it under `setTransform`; read colours from CSS custom properties (`cssColors`).
7. Seek: re-add the preceding items and **pre-relax** off-screen so a scrub lands on a settled frame.

## Even distribution of sized, rotatable boxes (words, tags, thumbnails)

"Evenly distributed" means an **even gap between boxes**, not even spacing of centres.

- **Long range (prevents clumping):** assign a coarse grid cell by cell to the nearest object under a **power metric** `d² − w_i` and accelerate each object toward the centroid of the cells it owns (Lloyd relaxation, integrated, not snapped). Weights are box area with the mean removed (`pw = powerK * (area - meanArea)`); non-zero-mean weights inflate the whole diagram. Drive from the error and *subtract* the dead band so the force is continuous across the threshold.
- **Short range (makes it even):** oriented-box separating-axis test (circle-culled first). A force that exists only while boxes overlap does nothing beyond overlap. Drive from a **clearance error** `k · (targetGap − gap)` by inflating the SAT by the target gap: `obbOverlap(a, b, gapTarget)`; `depth` then reads as the clearance error.
- **Derive the target gap and make it reachable:** configure a *fill fraction* (<1), solve `Σ (2hw + g)(2hh + g) = W·H` for the uniform band that tiles the container, and use a fraction of it. The full tiling bound is not attainable by freely-placed rectangles; asking for it leaves every pair pushing forever (residual KE 13,000 at fill 1.0 vs 12 at 0.75). Repulsion-only; keep Lloyd underneath (repulsion alone can never pull anything into a hole).
- **Apply contact forces at the contact point:** the midpoint of the clipped contact manifold (clip the incident face to the reference face). A force at the centre only slides a box; at the real contact it carries a lever arm, so a wedged word turns out of the way. Using the furthest corner gives symmetric pushes a lever arm they do not have.

  ```js
  function applyAt(item, fx, fy, at, h) {
    item.vx += fx * item.im * h;
    item.vy += fy * item.im * h;
    item.va += torqueK * ((at.x - item.x) * fy - (at.y - item.y) * fx) * item.ii * h;
  }
  ```

- A **departing** object leaves the solve when it is *marked*, not when it disappears: zero its velocities and skip it in every force pass, so survivors close the gap during its exit animation.
- Normalise mass against a reference object, not raw `sqrt(area)`.
- Where readability needs an exception, make it *one* object: the newest word clamped to ±45°, released once the next word arrives.
- Not worth it (measured): Lloyd cells by box distance (6.5× frame cost for no measurable change once the clearance term exists); steering long axes toward the principal axis of free space.
- Verify by **measuring**: CV of nearest gaps (0.45 → 0.02–0.09 across 16–40 objects), minimum gap vs mean, residual kinetic energy, area share, non-overlap, containment.

## Agents that must land together

Agents planned backwards to land together are in lockstep near the goal and read as clumps. Jitter per-step durations (seeded) and fan the last step over several sources. Dim additive particles by their packing (a burst's current scale, the lattice step of small type): dense same-colour `lighter` glows saturate a channel and burn legible type into a bar.

## Procedural 3D worlds

1. **Closed curves analytically, not by random walk.** A walk that re-pushes its first point leaves a seam kink, can self-intersect, and changes length per run.

   ```js
   // r(θ) = 1 + Σ_{k=2..5} a_k·sin(kθ + φ_k),  a_k ∝ 1/k²
   // θ wraps at 2π → closed; r(θ) > 0 and single-valued → star-shaped → cannot self-intersect;
   // the 1/k² falloff bounds curvature: "no hairpins" is one amplitude clamp, not a retry loop.
   ```

   Normalise sampled perimeter to a constant so every seed yields the same length; feed to `new THREE.CatmullRomCurve3(pts, true, 'centripetal')`.
2. **Sweeping a cross-section has a hard limit:** an offset wider than the local radius of curvature folds through itself. Road, curbs and rails (metres) are fine; anything wide belongs on a grid displaced by an analytic height field (which also makes terrain and road the same surface).
3. **Frames:** build with world-up (`right = normalize(cross(tangent, up))`), not Frenet (normals flip at inflections). Derive winding from the first quad; put lane markings in texture UVs; one `bank(t)` drives ribbon, vehicle and paint.
4. **Measure before chunking** instanced scenery (1 chunk = 21 calls / 13.1k tris; 4 chunks = 27 / 9.5k; 8 chunks = 39 / 9.5k: past 4, culling finds nothing and each chunk is pure overhead).
5. **Decals on a surface the camera looks along foreshorten to nothing:** stretch along the view direction (a square decal 70 m out is ~2 px tall at a 4 m camera height).
6. **When the world moves the lyrics, world speed is a layout parameter** (syllables laid out in metres): size marks against the surface (scale a unit plane per instance); derive speed at INIT from a low **percentile** of syllable gaps (not the minimum) and speed up until that gap clears one mark (keep musical anchors, e.g. whole-phrase laps, only ever speed up, cap it); allocate the pool by **age**, taking any free slot and stealing the oldest only when all are live (round-robin repaints an unreached mark, so lyrics look dropped).
7. **Chase camera distance in the curve's arc length**, not a damped world offset (a damped follow lags through corners and reads as an unintended zoom). Smooth the look target if you want the heading eased.
8. Dispose geometry, materials, textures and the context on UNINIT (`G.dispose(stage.dispose)`).

## Camera and face input

- `G.imageInput` for acquisition (`../spec/image-input.md`); face-api on `source.element`, continuous in `camera`, once in `upload`, never in `default` (fixed anchors).
- Detect all subjects and **cap the count**, largest first: `dets.sort((a, b) => areaOf(b.detection.box) - areaOf(a.detection.box)).slice(0, MAX_HEADS)`.
- The 68-point model has no forehead points: extrapolate `foreheadTopY = browY - FOREHEAD_RATIO * (chinY - browY)` and document it as a heuristic.
- Pixel warps: Canvas 2D banded scaling by default; an optional higher-fidelity WebGL path behind a config toggle with a hard fallback (never let its failure reach the console):

  ```js
  try { glfxCanvas = fx.canvas(); } catch (e) { glfxFailed = true; /* canvas 2D path from here on */ }
  ```

- Smooth detections toward targets every frame; throttle the detector (`patterns-render.md`).
- Camera is optional: the module must be fully usable and attractive on the default image.
