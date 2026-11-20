/**
 * Types for the `G` object an anim module receives: `export default function (G, shadowRoot, config)`.
 *
 * The prose in the neighbouring spec pages explains behaviour and gives examples; this file is the compact
 * signature reference. Times are milliseconds unless a name says `beat`. `G.uninit` is internal and not part of the contract.
 * Reference implementation of this surface: harness/g-mock.js.
 */

// ── Event objects (event-shapes.md) ─────────────────────────────────────────────

/** Fields every song event carries. */
export interface TimedEvent {
  id: number;
  /** start ms */
  s: number;
  /** end ms */
  e: number;
  /** beat position */
  b: number;
}

export interface Syl extends TimedEvent {
  /** display text */
  d: string;
  wordId: number;
  segmentId: number;
  /** composite LINE id (>= 1,000,001) */
  lineId: number;
  /** space / punctuation: present in the array, excluded from callbacks and `map` unless `includeDash` */
  isSP: boolean;
  syls: Syl[];
}
export interface Word extends TimedEvent {
  lineId: number;
  segmentId: number;
  isSP: boolean;
  syls: Syl[];
}
export interface Segment extends TimedEvent {
  lineId: number;
  /** null for translation segments */
  d: string | null;
}
export interface Line extends TimedEvent {
  /** composite id >= 1,000,001 */
  id: number;
  secId: number;
  /** only on objects passed to `G.on` callbacks, not in `G.map` results */
  actualStart?: number;
  actualEnd?: number;
}
/** Display line (>= 2,000,001): a wrapped slice of a LINE. One per LINE unless `G.relayout` splits it. */
export interface DLine extends TimedEvent {
  lineId: number;
  secId: number;
  /** 0-based index within the lyric line */
  dIdx: number;
  dCount: number;
  /** segment ids touched */
  l: number[];
  /** syllable ids (numbers, NOT objects; render from the `G.relayout` result) */
  syls: number[];
  actualStart?: number;
  actualEnd?: number;
}
/** Per-stream line (< 1,000,001). Prefer `Line`. */
export interface SLine extends TimedEvent {
  secId: number;
  /** composite LINE id this belongs to */
  lineId: number;
}
export interface Section extends TimedEvent {
  /**
   * chorus when >= half its lines recur in another section; inst when it has no lines.
   * Absent on filler (no-lyrics) sections, which have nothing to classify.
   */
  type?: "verse" | "chorus" | "inst";
}
export type Beat = TimedEvent;
export type Chord = TimedEvent;
export type Key = TimedEvent;
export type TimeSig = TimedEvent;
export interface Note extends TimedEvent {
  /** MIDI pitch */
  v: number;
  /** rest */
  r: boolean;
}
export interface Measure extends TimedEvent {
  /** present with the `notes: true` option */
  notes?: Note[];
}

// ── Event types (G.TYPE) ───────────────────────────────────────────────────────────────────────

export interface EventTypes {
  /** every animation frame while playing: (timeMs, deltaMs) */
  readonly TICK: 1000;
  readonly SEEK: 1001;
  /** (startTimeMs) */
  readonly PLAY: 1002;
  readonly PAUSE: 1003;
  readonly UNINIT: 1007;
  /** song data ready; G.map/forEach/iterator/lookup are valid from here */
  readonly INIT: 1008;
  /** (ResizeObserverEntry[]) */
  readonly RESIZE: 1009;
  /** (state: GameState | null, prev: GameState | null) game-shell state changed; null = left Game mode */
  readonly GAME: 1010;
  readonly BEAT: 1011;
  readonly MEASURE: 1012;
  readonly TIMESIG: 1013;
  readonly KEY: 1014;
  readonly CHORD: 1015;
  readonly SECTION: 1021;
  readonly SLINE: 1031;
  readonly LINE: 1032;
  readonly DLINE: 1033;
  readonly SEGMENT: 1041;
  readonly WORD: 1051;
  /** @deprecated use WORD with { includeDash: true } */
  readonly WORD_: 1052;
  readonly SYL: 1061;
  /** @deprecated use SYL with { includeDash: true } */
  readonly SYL_: 1062;
  readonly NOTE: 1063;
}

/** Maps a song event type to the object a callback receives. */
export interface EventOf {
  1011: Beat;
  1012: Measure;
  1013: TimeSig;
  1014: Key;
  1015: Chord;
  1021: Section;
  1031: SLine;
  1032: Line;
  1033: DLine;
  1041: Segment;
  1051: Word;
  1061: Syl;
  1063: Note;
}

/** Subscription / data-access options (events.md). */
export interface EventOptions {
  /** lyric track: 0 primary, 1 translation. Use `mchannel` config for SYL/WORD (translations never fire them) */
  channel?: number;
  stream?: number;
  /** shifts the fire time, ms (negative = early) */
  offset?: number;
  /** receive an array of same-timestamp events in one call */
  batchEvents?: boolean;
  /** SYL/WORD: include space/punctuation items */
  includeDash?: boolean;
  secId?: number;
  lineId?: number;
  /** display line id (see `relayout`) */
  dlineId?: number;
  segmentId?: number;
  wordId?: number;
  /** MEASURE: attach `notes` */
  notes?: boolean;
  /** NOTE: attach `syls` */
  syls?: boolean;
  /** LINE/DLINE/SLINE/SEGMENT/WORD: clamp early fire so it cannot overlap the previous unit's last syllable */
  /** look-ahead window in ms for line-family subscriptions; spelled exactly `lookahead`; not supported on DLINE */
  lookahead?: number;
  prevSylLimit?: boolean;
  /** 0..1, default 0.3 */
  prevSylRatio?: number;
  /** ms, default 0 */
  prevSylOffset?: number;
  /** WORD/SYL: do not precede the resolved start of the parent LINE/DLINE subscription */
  parentLimit?: boolean;
  /** index among LINE and DLINE subscriptions in registration order (all LINE before any DLINE) */
  parentId?: number;
}

// ── relayout / wrap / imageInput ───────────────────────────────────────────────────────────────

export interface RelayoutSpec {
  /** default 0 */
  channel?: number;
  /** px budget; a function is re-evaluated on every reflow. Exactly one of maxWidth / maxChars */
  maxWidth?: number | (() => number);
  /** grapheme budget instead of px; needs no font/measure */
  maxChars?: number | (() => number);
  /** exactly one of font / measure / maxChars: CSS font shorthand */
  font?: string;
  measure?: (text: string) => number;
  /** 0..1, default 0.45 */
  minFill?: number;
  /** default true */
  balance?: boolean;
  /** default true: allow a break inside a word at syllable boundaries */
  splitWords?: boolean;
  /** default 'resize' */
  reflowOn?: 'resize' | 'never';
  /** fires only after a reflow that changed the split */
  onReflow?: (lines: DisplayLayoutLine[]) => void;
}
/** One entry of the `G.relayout` result: a display line with its syllables as OBJECTS. */
export interface DisplayLayoutLine extends Omit<DLine, 'syls'> {
  syls: Syl[];
}

export interface WrapSpec {
  maxWidth?: number | (() => number);
  maxChars?: number | (() => number);
  font?: string;
  measure?: (text: string) => number;
  minFill?: number;
  balance?: boolean;
  /** default false here (word[][] cannot express a split word) */
  splitWords?: boolean;
}

export type ImageInputMode = 'camera' | 'upload' | 'default';
export interface ImageInputOptions {
  /** container to render into (required) */
  mount: Element;
  /** default true */
  allowCamera?: boolean;
  /** default true */
  allowUpload?: boolean;
  /** CSS-flip the camera preview only; default true */
  mirror?: boolean;
  defaultImageUrl?: string | null;
  /** default true */
  showControls?: boolean;
  /** default true */
  controlsAutoHide?: boolean;
  /** default 4000 */
  controlsIdleMs?: number;
  /** default 'top-right' */
  controlsPlacement?: 'top-right' | 'bottom-right';
  onModeChange?: (mode: ImageInputMode) => void;
  onStatus?: (message: string | null) => void;
  onReady?: (el: HTMLVideoElement | HTMLImageElement) => void;
}
export interface ImageInput {
  readonly element: HTMLVideoElement | HTMLImageElement;
  readonly mode: ImageInputMode;
  readonly width: number;
  readonly height: number;
  /** true only in camera mode with `mirror` */
  readonly mirrored: boolean;
  useCamera(): void;
  useUpload(file: File): void;
  useDefault(): void;
  revealControls(): void;
  /** early manual teardown; the runtime also tears down automatically */
  destroy(): void;
}

// ── Config helpers (config.md) ──────────────────────────────────────────────────

export interface Cfg {
  /** typed read: each key falls back to its default when absent or of the wrong type; returns a frozen object */
  <D extends Record<string, unknown>>(config: Record<string, unknown>, defaults: D): Readonly<D>;
  /** integer only (channel, seed); clamped */
  int(d: number, min?: number, max?: number): unknown;
  /** finite number, numeric strings accepted; clamped */
  num(d: number, min?: number, max?: number): unknown;
  /** one of `list`, else `d` */
  pick<T>(d: T, list: readonly T[]): unknown;
}

// ── G ──────────────────────────────────────────────────────────────────────────────────────────

export interface G {
  readonly TYPE: EventTypes;

  // Events. Register inside `default(G, shadowRoot, config)`, never later (throws after init).
  // System types and custom events return nothing; only song-event subscriptions return an index.
  on(type: 1000, cb: (timeMs: number, deltaMs: number) => void): void;
  on(type: 1002, cb: (startTimeMs: number) => void): void;
  on(type: 1001 | 1003 | 1007 | 1008, cb: () => void): void;
  on(type: 1009, cb: (entries: ResizeObserverEntry[]) => void): void;
  on<T extends keyof EventOf>(type: T, cb: (ev: EventOf[T], config: Record<string, unknown>) => void): number;
  on<T extends keyof EventOf>(type: T, options: EventOptions, cb: (ev: EventOf[T], config: Record<string, unknown>) => void): number;
  /** custom event emitted by another module in the collection */
  on(type: string, cb: (data: unknown) => void): void;
  /** fires at the event END time (`e`), not the start */
  off<T extends keyof EventOf>(type: T, cb: (ev: EventOf[T], config: Record<string, unknown>) => void): number;
  off<T extends keyof EventOf>(type: T, options: EventOptions, cb: (ev: EventOf[T], config: Record<string, unknown>) => void): number;
  /** fire-and-forget between modules of a collection; no replay on seek */
  emit(eventName: string, data?: unknown): void;

  // Song data: valid once INIT has fired (an INIT handler, the returned `init()`, or any later callback); throws in default
  map<T extends keyof EventOf, R = EventOf[T]>(type: T, options?: EventOptions | ((ev: EventOf[T], i: number) => R), transform?: (ev: EventOf[T], i: number) => R): R[];
  forEach<T extends keyof EventOf>(type: T, options?: EventOptions | ((ev: EventOf[T], i: number) => void), callback?: (ev: EventOf[T], i: number) => void): void;
  /** stateful, auto-seeked on play/jump; when `done` is true `value` is a random item */
  iterator<T extends keyof EventOf>(type: T, options?: EventOptions, transform?: (ev: EventOf[T]) => unknown): { next(): { value: any; done: boolean } };
  /** id -> event (or transformed value) Map. INIT only */
  lookup<T extends keyof EventOf, R = EventOf[T]>(type: T, options?: EventOptions | ((ev: EventOf[T], i: number) => R), transform?: (ev: EventOf[T], i: number) => R): Map<number, R>;
  /** read-only proxy over the song. `streamCount` = number of stream groups (1 if none); `beat.bpm` falls back to 120 */
  getSongData(): { title: string; artist: string; duration: number; beat: { type: number; bpm: number }; streamCount: number; lyricLangs: string[] };

  // Time
  currentTime(): number;
  toBeat(timeMs: number): number;
  toMs(beat: number): number;
  getPlaybackRate(): number;

  /**
   * Game-shell hooks (Game mode only; every call is optional and a no-op in Anim mode).
   * `state` is the shell's screen; the host also carries `data-game-state`, so
   * `:host([data-game-state=paused])` can style it. Reset your run on "countdown" (sent for a fresh run only; Resume is sent as "paused").
   */
  game: {
    readonly state: "title" | "countdown" | "playing" | "paused" | "ended" | "tutorial" | null;
    /** live score for Results / best score; ignored in "tutorial" */
    score(n: number): void;
    /** game over before the song ends */
    end(result?: { score?: number; grade?: string }): void;
    /** tutorial finished */
    done(): void;
  };
  /** 0..1 through a timed event (takes the event object, not (t, a, b)) */
  progress(event: { s: number; e: number }, timeMs: number): number;

  // Playback control (asks the parent player; async)
  seek(ms: number): void;
  play(): void;
  pause(): void;
  /** merge config updates; only valid after INIT */
  setConfig(updates: Record<string, unknown>): void;

  // DOM
  /** within the shadow DOM (document.getElementById does not work there) */
  getElementById(id: string): Element | null;
  clientRect(): DOMRect;
  svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Record<string, string | number>): SVGElementTagNameMap[K];

  // Text and canvas
  toString(obj: unknown): string;
  /** grapheme clusters (Myanmar-aware) */
  toChars(obj: unknown): string[];
  measureText(text: string, font?: string): TextMetrics;
  context2d(width: number, height: number, dpi?: number, options?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D;
  /** keep a canvas context fitted to the container; fires once immediately, then on each resize */
  /** call in default: it registers a RESIZE handler */
  fit(ctx: CanvasRenderingContext2D, init?: (ctx: CanvasRenderingContext2D) => void): void;
  /** greedy by character count */
  wrap<W>(words: W[], targetLines: number): W[][];
  /** width-based; see `relayout` for the spec keys */
  wrap<W>(words: W[], spec: WrapSpec): W[][];
  /** re-split lyric lines into display lines; call from init() after subscribing to TYPE.DLINE */
  relayout(spec: RelayoutSpec): DisplayLayoutLine[];

  // Lifecycle: torn down on UNINIT / anim switch
  /** `render(timeMs)` on SEEK/PLAY/PAUSE/RESIZE; `reset()` on UNINIT only (it does not wipe on SEEK). Call before INIT completes */
  onFrame(spec: { render?: (timeMs: number) => void; reset?: () => void }): void;
  /** run `fn` at teardown, reverse order; errors are logged, not thrown. Returns `fn` */
  dispose<F extends () => void>(fn: F): F;
  /** addEventListener removed automatically at teardown; returns the remover */
  listen(target: EventTarget, type: string, fn: (ev: any) => void, options?: boolean | AddEventListenerOptions): () => void;

  // Config
  cfg: Cfg;

  // Media
  imageInput(options: ImageInputOptions): ImageInput;

  // Frozen legacy helpers: new modules import these from g-lib instead (the validator flags G.clamp/lerp/ease/randGen)
  /** seeded xorshift32, [0, 1) */
  randGen(seed?: number): () => number;
  /** in place Fisher-Yates */
  shuffle<T>(array: T[]): void;
  /** @deprecated import from g-lib */
  lerp(a: number, b: number, t: number): number;
  /** @deprecated import from g-lib */
  clamp(v: number, lo: number, hi: number): number;
  /** @deprecated import from g-lib */
  ease(t: number, type?: 'in' | 'out' | 'inOut' | 'cubic'): number;
}
