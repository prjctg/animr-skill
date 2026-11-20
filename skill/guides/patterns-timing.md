# Timing patterns

Recipes for scheduling visuals against song events. All assume the core rule: **a frame is a pure function of playback time** (see `architecture.md`). Event handlers arm things; `render(t)` draws them.

## Which trigger for which job

| Job | Trigger |
|---|---|
| Something should be visible from the moment a line is about to be sung until it ends | `LINE` with negative `offset` + `prevSylLimit`, `G.off(LINE)` to hide |
| An actor must land exactly on a syllable | `SYL` with `offset: -LEAD_MS`; pose from `(time, syl.s)` |
| Highlight progress inside a syllable | `G.progress(syl, t)` in `render` (not events) |
| A pulse on the beat | g-lib `beatPulse`, or `BEAT` handler storing the last beat time |
| Section-level change (palette, camera mode) | `SECTION`, with `type` treated as optional |
| Two-line karaoke / fixed-height lyric card | one `DLINE` subscription + `G.relayout` |
| Continuous motion (flow, camera, drift) | closed-form function of `t` in `render` |

## Pre-spawn with negative offset

```js
G.on(G.TYPE.SYL, { channel: 0, offset: -TRAVEL_MS }, (syl) => spawnNote(syl));  // syl.s is still the true target time
// in render(t): u = (t - syl.s) / TRAVEL_MS + 1   ->  0 at spawn, 1 at target
```

## Build lookups at INIT, not at event time

```js
let sylInfo = null;
G.on(G.TYPE.INIT, () => {
  sylInfo = G.lookup(G.TYPE.SYL, { channel: 0 }, (syl, idx) => ({ lineId: syl.lineId, idx }));
});
G.on(G.TYPE.SYL, { channel: 0 }, (syl) => { const { lineId, idx } = sylInfo.get(syl.id); /* … */ });
```

`syl.lineId` and `line.id` share an id space; key line maps by `line.id` directly.

## Wipe live state on seek and pause

```js
const wipe = () => { actors.forEach((a) => a.el.remove()); actors.length = 0; };
G.on(G.TYPE.SEEK, wipe);
G.on(G.TYPE.PAUSE, wipe);
G.on(G.TYPE.UNINIT, wipe);
```

Exceptions: elements managed purely by `G.on` / `G.off` pairs clean themselves up; if the module itself calls `G.pause()`, omit the PAUSE wipe (SEEK + UNINIT only).

## SYL/LINE and render are not ordered: build lazily

```js
G.on(G.TYPE.SYL, { channel: 0 }, (syl) => {
  if (!active.has(syl.lineId)) setupLine(syl.lineId);   // never assume render ran first
  activate(syl);
});
```

## Event-driven line lifecycle

```js
// 1. Preview: show early, clamped so it does not overlap the previous line's last syllable
G.on(G.TYPE.LINE, { channel: 0, offset: -PREVIEW_MS, prevSylLimit: true, prevSylRatio: 0.5 },
  (line) => showLine(line.id, true));
// 2. Active: fire at the true start
G.on(G.TYPE.LINE, { channel: 0 }, (line) => transitionToActive(line.id));
// 3. Hide: fires at the end AND on seek (automatic)
G.off(G.TYPE.LINE, { channel: 0 }, (line) => hideLine(line.id));
```

## `G.pause` / `G.play` are async: use a phase machine

```js
let phase = 'idle';   // 'idle' | 'question' | 'waiting' | 'reveal'
G.on(G.TYPE.LINE, { channel: 0 }, () => { if (phase !== 'idle') return; phase = 'question'; G.pause(); });
G.on(G.TYPE.SEEK, () => { phase = 'idle'; });
G.on(G.TYPE.UNINIT, () => { phase = 'idle'; });
```

## Multi-phase animation inside one syllable

For several sub-states across a single syllable (for example several mouth shapes), do not key boundaries off TICK `time` lining up with `syl.s`/`syl.e`. Accumulate elapsed from `delta`:

```js
let active = null;   // { phases: [{ value, endFrac }], duration, elapsed }
G.on(G.TYPE.SYL, { channel: 0 }, (syl) => {
  active = { phases: buildPhases(syl.d), duration: syl.e - syl.s, elapsed: 0 };
});
G.on(G.TYPE.TICK, (time, delta) => {
  if (!active) return;
  active.elapsed += delta;
  const t = active.duration > 0 ? clamp(active.elapsed / active.duration, 0, 1) : 1;
  const phase = active.phases.find((p) => t < p.endFrac) || active.phases.at(-1);
  applyPhase(phase.value);
});
G.on(G.TYPE.SEEK, () => { active = null; });
```

This stays correct when SYL and TICK dispatch are skewed. The trade-off: it is **not** seek-exact. Prefer a pure function of `(time, syl.s, syl.e)` whenever the sub-phases can be derived from time alone.

## Pre-timed arrival: an actor that must land on the syllable

When the syllable is the moment of **impact** (not spawn), two rules keep it exact under scrubbing.

**1. The pose is a pure function of `(time, syl.s)`**, never of accumulated state:

```js
G.on(G.TYPE.SYL, { channel, offset: -LEAD_MS }, (syl) => arm(syl));   // syl.s is the true impact time

// in render(t), per active actor:
const u = (t - (syl.s - LEAD_MS)) / LEAD_MS;          // 0 at launch, 1 at impact
const x = lerp(startX, impactX, u);
const y = lerp(startY, impactY, u) - ARC_H * 4 * u * (1 - u);
const angle = Math.atan2((impactY - startY) - ARC_H * 4 * (1 - 2 * u), impactX - startX);
```

Take the facing angle from the analytic derivative of the same parabola, not a tuned constant: the actor then meets the surface head-first at every lead time and aspect ratio.

**2. SEEK is a reconciliation, not a rebuild:** clear the live set, binary-search the start-time array (`lastAtOrBefore`) for everything whose `[s − lead, s + tail)` window straddles `G.currentTime()`, re-arm those, render one frame. This also covers the case the offset subscription cannot fire at all, such as a first syllable closer to 0 than the lead.

Give the negative-offset handler a few percent of slack before treating a negative `u` as "scrubbed backwards": SYL and TICK are dispatched on different ticks, so the first frame of a flight can read `u` slightly below 0.

**Recycled pools:** key the slot on the syllable **index** (`i % SLOTS`) rather than handing out free slots. The slot for syllable `i` is the one syllable `i − SLOTS` used, which has already left the screen, and the mapping survives a seek without bookkeeping. Use `null` (not `-1`) for "unused": `-1` collides with a real lane index.

**Z-order with a recycled pool:** slot DOM order is not lane order. Anything that must draw over every lane lives in its own layer that mirrors each slot's transform.

## Camera as a pure function of time

A camera moved from the offset handler jumps a whole lane the instant an actor is armed, a whole lead time before anything visibly happens, which reads as a lurch. Drive it from the timeline and key arrivals on the **impact**: `camT[i] = impact[i]`. The pan to actor `i + 1` then travels with that actor.

```js
const panStart = Math.max(camT[i], camT[i + 1] - LEAD_MS);   // never before this actor's own impact
const u = clamp((t - panStart) / (camT[i + 1] - panStart), 0, 1);
return i + smoother(u);                                      // quintic t³(t(6t−15)+10)
```

- The lower bound makes it read as following: well-spaced units hold still after impact and set off when the next actor leaves; a tight burst pans on from the impact it just landed on.
- Use a quintic (`smoother`), not quadratic in-out: the quadratic has a step in acceleration, visible as a tick at each hold.
- Precompute arrival times with a minimum-duration floor between consecutive entries, so units closer than that pan continuously instead of stepping. SEEK then needs no camera bookkeeping.

## Joints and limbs belong in `render`, not `@keyframes`

A CSS animation is the tempting way to cycle a figure's limbs, and it breaks the core rule: it runs on wall-clock time, keeps going while paused and cannot reconstruct its phase at a scrub point. Derive the phase from the same `(time, syl.s)` the position comes from (`ph = (t2 − GLIDE_MS) / STROKE_MS`) and write rotations per frame. It costs a handful of `setAttribute` calls per actor, is scrub-exact, and permits things a keyframe cannot: unequal half-cycles, a second joint driven by the first one's phase, a gesture every other cycle. Cost: `prefers-reduced-motion` becomes yours to honour in JS (`accessibility.md`).

## Display lines (`DLINE`) and `G.relayout`

A DLINE **event** carries syllable ids; `G.relayout()` returns the objects. A module that renders straight from the event silently draws empty text for every line that arrives during playback. Index the layout by display-line id and let the event be only the trigger:

```js
const idxOf = new Map();                       // rebuilt in init() and in onReflow
G.on(G.TYPE.DLINE, { channel }, (ev) => {
  const idx = idxOf.get(ev.id);                // ev.id survives a reflow that doesn't move this line
  if (idx !== undefined) show(idx);
});
```

- Sort your copy `(a, b) => a.s - b.s || a.id - b.id` first: `relayout` returns lyric-line order; the player dispatches by start time.
- **A two-line karaoke needs one subscription, not two.** The obvious shape (an early `{ offset: -previewMs, prevSylLimit: true }` subscription to preview the incoming line plus an un-offset one to activate it) makes the second line's appearance drift, because `prevSylLimit` clamps the lead time to a fraction of whatever gap follows the previous line. The pending line is just `layout[idx + 1]`: render both from one handler.
- Keep at most one live entry per row; remove its node synchronously when the row is reused, or SEEK + `onReflow` rebuild at once and the same line appears twice.
- `lookahead` does not work on DLINE (and is spelled `lookahead`: `lookAhead` is silently dropped).
- Two alternating rows (`row = i % 2`, each aligned to its own edge, both low in the frame like a large subtitle) is a good default layout.
- Expose lots of surface (fonts, colours, outline, shadow, motion) as `c.m` mappings with `cSchema` entries; keep purely visual knobs as CSS custom properties so they hot-swap.

## Closed-form decay and springs

Any "reaction to a trigger" is `f(t − trigger)`:

- decay: `exp(-k·dt)`; pulse: `max(0, 1 − dt / D)`;
- spring: g-lib `springAt(dt, zeta, wn)` / `spr(dt, makeSpring(zeta, wn))`;
- ballistic with drag: g-lib `createPhysics().pos(p, seconds)`.

No integration state means seek, pause and resume are free. When you must integrate (swarms, physics sims), sub-step with a clamped `delta`, and on SEEK re-simulate from the nearest checkpoint (`techniques.md`).

## Wipes and reveals

For a left-to-right syllable wipe, interpolate with `G.progress(syl, t)` inside `render`, and map progress to pixels through measured glyph advances (not syllable counts). Share one set of text runs between the base layer and the highlight layer, and clip the highlight; this keeps the two edges aligned (`patterns-text.md`).
