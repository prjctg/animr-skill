# Quality rubric

Use this twice: once before you write code (to set the bar) and once before you deliver. A green validator and conformance table says the module is **not broken**; it says nothing about whether it is **good**. A green table over an ugly frame is a fail. So is a beautiful frame with an illegible lyric.

## The bar (self-review: answer each honestly)

**Picture**
1. Does the first sung syllable already show the idea, and does the composition do something at 1.1 s as well as at 11 s?
2. Is the picture specific and physical (one strong image), or a generic recolour/preset?
3. Does it change across the song (sections, last line, instrumental gap) without becoming noise?

**Legibility**
4. Is the active lyric readable at the moment it matters, in light **and** dark, at phone **and** laptop sizes?
5. Is nothing covering the active syllable? Does a long line still fit (wrap or scale with a floor)?
6. CJK / RTL / Myanmar: graphemes intact, no reordering, no tofu (fonts have fallbacks)?

**Sync**
7. Does the motion read as caused by the music (syllable onset, held notes, beats), not merely running alongside?
8. Do zero-length syllables, one-syllable lines and overlapping events behave?

**Correctness under control**
9. Seek forward/back/into the middle of an effect: same frame as playing there? (conformance "seek" check)
10. Pause/resume: stationary while paused, exact on resume?
11. Resize (and DPR 1, 1.5, 2, 3): repaints, no stretched or blurry canvas?
12. UNINIT: no leaked rAF, timers, listeners, GL contexts, camera tracks, DOM?
13. Theme flip light↔dark: both look intentional (not just inverted)?
14. Deterministic: two runs with the same seed produce the same frames?

**Craft**
15. One docblock with numbered claims, a pure DOM-free half, a banner, a thin browser half?
16. No hand-rolled helper that exists (`../pitfalls/dont-hand-roll.md`); g-lib pinned to an exact tag?
17. Budget stated, caps justified, a quality tier if heavy?
18. Options are few, named for the user, typed (`cSchema`), and each does something visible?
19. Comfort: no >3 Hz large flashes; reduced-motion plan; reduce-flash option if needed (`accessibility.md`)?
20. Would a senior engineer say it is more complicated than the idea needs? If so, simplify.

## Edge-case songs the module must survive

`harness/fixtures.js` provides all of these; `npm run check` mounts every one.

| Fixture | What it exposes |
|---|---|
| `empty` | no events at all (INIT with empty arrays; no division by zero, no `undefined[0]`) |
| `noLyrics` | filler syllables, sections without `type` |
| `noBeats` | no `BEAT`/`MEASURE`; any beat pulse must degrade |
| `oneSection` | a single section (`type: 'verse'`); no chorus detection |
| `noWordIds` | syllables with `wordId` 0/undefined |
| `dense` | very short syllables back to back (≥ 8 per second); pool/slot exhaustion |
| `longLine` | one line of 60+ syllables; wrapping and fitting |
| `cjk` | no spaces, `isSP` absent, wide glyphs |
| `rtl` | right-to-left text |
| `myanmar` | combining clusters; `G.toChars` vs `split('')` |
| `zeroLength` | `s === e` syllables, overlapping events |
| `twoChannels` | channel 1 present (translation without SYL/WORD) |

## Done checklist

- [ ] `npm run validate -- <file>`: no errors, warnings addressed or justified in the docblock
- [ ] `npm run check -- <file>`: all hard checks pass; soft warnings explained
- [ ] Looked at the PNGs in `out/` at phone and laptop sizes, light and dark
- [ ] Walked the 20-question bar above
- [ ] Re-read `../pitfalls/general.md` and the section for your backend and techniques
- [ ] Deliverable is **one** file `<kebab-name>@<major>.<minor>.yaml` with exactly keys `t`, `j`, `s`, `h`

## Final report

Say: the filename; the final check table; the decisions you made that the brief left open and why; anything deliberately not done and why. Do not ship the harness or `out/`.
