# Game mode

An anim whose `c.v` declares `autoPlay: false` runs in **Game mode**: the host wraps it in a shell (Title → optional How to play → 3-2-1 countdown → Playing ⇄ Paused → Results, plus song select). The seek bar is locked and intro-skip is hidden. **Every hook below is optional.** A game that uses none still gets the full flow with a score-less Results screen.

Declare it **and honour it**: with `autoPlay: false` the host leaves the animation surface alone for taps, so the module owns pointer input. In normal (Animation) mode the module is expected to play itself.

```js
export const c = { v: { autoPlay: false }, m: [] };
const AUTO_PLAY = config.autoPlay === true;
if (!AUTO_PLAY) board.addEventListener('pointerdown', onTap);
```

Interactive CSS: `:host { touch-action: none; user-select: none; }`, listen for `pointerdown` (not `click`).

## States

Read `G.game.state`; subscribe with `G.on(G.TYPE.GAME, (state, prev) => …)` (fires on change only; read `G.game.state` in INIT for the current value). The wrapper also carries `:host([data-game-state=…])` for CSS.

| State | Meaning |
|---|---|
| `title` | Title, How to play or song select; song held at 0 |
| `countdown` | a **fresh run** is about to start: reset your game here, not on SEEK |
| `playing` | the song is running |
| `paused` | pause menu, or the short resume countdown (never `countdown`, so a resume cannot wipe the run) |
| `ended` | Results |
| `tutorial` | your own tutorial is showing: song paused, seek locked, scores ignored |
| `null` | Animation mode: no shell |

Esc / P pause the run for you (call `preventDefault()` on the key if you need it).

## Metadata and reporting

```js
export const game = {
  howTo: [{ icon: 'bi-hand-index', text: 'Tap the circles on the beat' }],  // up to 4 steps; icon = an icon-font class name
  controls: 'Tap · Space · D F J K',
  tutorial: true,    // shows "Try tutorial"; the shell sends state "tutorial"; call G.game.done() when finished
};

G.on(G.TYPE.GAME, (s) => { if (s === 'countdown') resetRun(); });
G.game.score(n);                      // live score; the latest value is the run's score
G.game.end({ score, grade: 'A' });    // game over before the song ends (also fine just after it)
```

Limits the host enforces: at most 4 steps, step text ≤ 140 chars, `controls` ≤ 80, finite scores, grade ≤ 16 chars. Higher scores are better; the best score is stored per game and song by the host.

## Design rules for rhythm games

- Build the note chart from song events at INIT (`SYL`, `BEAT`, `NOTE`), not by listening live; the chart is then deterministic.
- Judge input against the **chart time** (`G.currentTime()`), not wall-clock; allow a tolerance window (±60–120 ms) and show the offset.
- State that must reset per run (score, combo, hit set) is reset on `countdown`. A SEEK in a game is rare (title/restart); handle it by re-deriving what is on screen from time.
- Show the controls on first screen; give clear hit/miss feedback; never rely on colour alone.
- Provide a non-timing assist (larger windows, no fail) via a config option for accessibility.
