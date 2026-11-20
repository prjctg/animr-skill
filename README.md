# animr-skill

A model-agnostic skill for writing **anims**: single-file YAML modules that animate a song's lyrics and beats in the browser (canvas2d, SVG, DOM or three.js). It works with Claude, Gemini, GPT or any model that can follow written instructions. It includes a validator, a headless conformance check and a browser preview, so a model can test its own output.

An anim is one file named `<kebab-name>@<major>.<minor>.yaml` with four keys: `t` (the literal `c`), `j` (an ES module), `s` (CSS), `h` (HTML/SVG). The host runs it with a global `G` API that delivers syllables, words, lines, sections and beats. The rule everything else follows: **a frame is a pure function of playback time**, so scrubbing, pausing and resizing always show the right picture.

## Use it

**Coding agent (Claude Code, Codex, Gemini CLI, Cursor, ...).** Open this repo in the agent and ask, e.g. *"make an anim where each line is a ribbon that unfurls on the beat"*. `AGENTS.md` (also `CLAUDE.md`, `GEMINI.md`) points the agent to `skill/SKILL.md`. The folder `skill/` is also a valid Agent Skill: copy it into your agent's skills directory as `author-anim/` (the folder name must match `name` in `SKILL.md`).

**Chat model with no tools.** Paste `dist/anim-skill-prompt.md` (build it with `npm run bundle`, about 160 KB) as the system prompt or first message, then give your brief. The model outputs the YAML; save it as `anims/<name>@0.1.yaml`.

**By hand.** `npm run new -- my-anim --backend svg`, edit the file, then validate and check it (below).

## Setup

```sh
npm install
npx playwright install chromium     # only for `check`
```

## Commands

| Command | What it does |
|---|---|
| `npm run new -- <name> --backend canvas2d\|svg\|dom\|three` | Scaffold `anims/<name>@0.1.yaml` from a template |
| `npm run validate -- <file.yaml>` | Static rules: format, exports, config, pinned imports, hand-rolled helpers, seek-safety, cleanup. Exit code 1 on errors |
| `npm run check -- <file.yaml>` | Mounts the module headlessly against 13 edge-case songs (empty, no lyrics, CJK, RTL, Myanmar, dense, ...), at phone and laptop sizes in light and dark, and checks painting, motion, seek purity, resize, tick cost and UNINIT cleanup. Writes PNGs to `out/` |
| `npm run preview -- <file.yaml>` | Opens a page to play, scrub, switch song, size and theme, and edit options |
| `npm run bundle` | Builds `dist/anim-skill-prompt.md` for chat models |
| `npm run scan` | Fails if the repo mentions private project details |
| `npm test` | Unit tests |

Open the PNGs after `check`. A green table over an ugly or illegible frame is still a fail.

## Layout

```
skill/
  SKILL.md       workflow, key rules, routing table (start here)
  spec/          the module format, the G API (g.d.ts), events, config, relayout, utilities, g-lib
  guides/        design brief, architecture, timing/text/render patterns, techniques, games, accessibility, quality rubric
  pitfalls/      mistakes that cost the most, per area
  templates/     one starter module per backend
harness/         the mock G runtime (reference implementation), event scheduler, test songs, preview page
tools/           new, validate, check, preview, bundle, scan
examples/        scaffolded starters that pass validate and check
test/            vitest
```

## About the harness

`harness/g-mock.js` implements the `G` contract described in `skill/spec/` and is the reference for it. It is stricter than most hosts on purpose (it fails on NaN, leaked listeners, leaked WebGL contexts and timers after UNINIT), but it is a model of the host, not the host. Event delivery is an approximation; always do a final run in the real player when you have one.

Modules import helpers from [g-lib](https://github.com/prjctg/g-lib) at an exact pinned tag, and three.js at a pinned version; the first `check` downloads them into `.cache/`.

## License

MIT, see `LICENSE`.
