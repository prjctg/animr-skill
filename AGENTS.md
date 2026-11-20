# Instructions for coding agents

This repository is a skill for authoring "anims" (YAML music/lyric animation modules).

When asked to make, port, restyle or fix an anim, read and follow `skill/SKILL.md`. It holds the workflow, the rules and a routing table to the rest of `skill/`. Do not browse for example modules; everything needed is in `skill/`.

Tools (run from the repo root after `npm install`):
- `npm run new -- <name> --backend canvas2d|svg|dom|three`
- `npm run validate -- anims/<file>.yaml`
- `npm run check -- anims/<file>.yaml` (needs `npx playwright install chromium`)
- `npm run preview -- anims/<file>.yaml`

Deliver one file: `<kebab-name>@<major>.<minor>.yaml`.
