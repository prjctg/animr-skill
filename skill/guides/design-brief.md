# Design brief

Write this **before** any code. It is short (a page), it forces the decisions that decide whether the module is good, and it replaces "look at existing animations for inspiration". If the person gave you a brief, check it against this template and fill the gaps yourself; do not stop to ask unless something is truly undecidable.

Work in your head or in a scratch file. Only the YAML is delivered; the brief's essentials go into the module's docblock (`architecture.md`).

## Template

### 1. The picture
One sentence a stranger could sketch. Concrete and physical: *"A paper curtain is pulled across a lit window; each syllable pulls it a notch."* Not *"modern kinetic typography with vibes."*

- What is on screen at the first sung syllable? At 1.1 s? At 11 s? (A composition that only works once it is full has failed the first ten seconds.)
- What is the lyric's role: the object itself (type is the art), or a caption over art?

### 2. Why it is worth building
The physical or perceptual reason it will feel right with music (inertia, a pendulum that rings after a strike, light through a pane). If you cannot say why it belongs with sung words, pick a different picture. Reject early: ideas where the type becomes illegible, and ideas that are a recolour of the default look.

### 3. The mechanism
How the picture is produced, as a pure function of time wherever possible:

- State that is **derived** from time/events (positions, pulses, camera) vs state that is **simulated** (flocks, fluids). For simulated state, say how seek is handled (`patterns-timing.md`, `techniques.md`).
- The one or two formulas that carry the effect (springs, easings, hash-based randomness).
- Backend choice with a reason: `svg`/`dom` (few elements, crisp text, CSS theming), `canvas2d` (many objects, pixel work), `three` (real 3D). See "Backend selection" below.

### 4. Sync map
Which song events drive what. Fill in a table:

| Event | Options | Drives |
|---|---|---|
| `SYL` (`mchannel`) | `offset: -LEAD` | the actor that lands on the syllable |
| `LINE` | `offset: -PREVIEW`, `prevSylLimit` | line enters; `G.off(LINE)` exits |
| `BEAT` | | background pulse |
| `SECTION` | `type` optional | palette / density change |

Rules of thumb: per-syllable timing is the strongest cue; beats are good for ambient pulse; sections for macro change; `TICK`/`render` for everything continuous. Do **not** sample continuous values at event time.

### 5. Structure over the song
What changes between verse, chorus, instrumental and the last line? A module that looks identical for four minutes is monotony; one that changes without reason is noise. Decide the progression (density, palette, camera, scale) and what an instrumental gap shows. Handle a song with a **single section** and a song with **no beats** (fall back to a fixed tempo or to syllable timing).

### 6. Legibility plan
Where does the active lyric sit, at what minimum size, with what contrast in light and dark? What guarantees nothing covers it? (`patterns-text.md`.) How does a very long line behave? How do CJK, RTL and Myanmar behave?

### 7. Options
Which knobs are worth exposing (`c.m` + `cSchema`): seed, a style `select`, a quality tier, colours via CSS variables, track picker (`mchannel` for SYL/WORD modules). Everything purely visual that should hot-swap stays a CSS custom property. Don't expose a knob you cannot explain.

### 8. What to export for tests
List the pure functions above the browser half and the property each must have: *"`planAt(plan, t)` is deterministic"*, *"volume is conserved"*, *"no two glyphs overlap"*, *"result is frame-rate independent"*. These become your own assertions (the validator warns when an exported function touches the DOM).

### 9. Budget
Frame cost target (mean per-frame work ≤ 8 ms at the default quality), caps on object counts with the reason for each number, a quality tier (`auto|high|medium|low`), memory for typed arrays. State what degrades first.

### 10. Traps, in the order you will hit them
Predict them. Typical: zero-length syllables, a line with one syllable, DPR 3, a resize mid-song, seeking backwards into the middle of an animation, a theme flip, a long line that wraps, the first syllable at t < LEAD.

## Backend selection

| Need | Backend |
|---|---|
| ≤ ~150 moving elements, crisp type, easy theming, CSS transitions for chrome | `svg` or `dom` |
| thousands of particles, field/pixel effects, glow, image processing | `canvas2d` |
| perspective, lighting, instancing, real depth | `three` |
| camera/photo input with pixel work | `canvas2d` over `G.imageInput` |

When unsure between `svg` and `canvas2d`, prefer `svg` for a typography-first piece and `canvas2d` for a texture/particle-first piece.

## Reject list

Decline or reshape the idea if it needs: network calls at runtime other than pinned library imports, `Math.random`/`Date.now` in the render path with no way to seed, flashing above 3 Hz over a large area (`accessibility.md`), text that cannot be kept legible, or state that cannot be reconciled after a seek and cannot "relax to rest" credibly.

## Variant vs new module

If the request is only "a different look or setting" of something that already exists in the user's library, do not write a new module: change the existing module's options (or the collection entry that references it) rather than forking code. Write a new module only when the core behaviour differs.
