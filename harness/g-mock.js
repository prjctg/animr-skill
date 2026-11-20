/**
 * Reference implementation of the `G` runtime contract (skill/spec/*), for driving a module in a
 * real browser page without the full player. Browser ES module.
 *
 *   const anim = await mount({ js, css, html, song, config, size: [640, 360], theme: 'light' });
 *   anim.playTo(2300);  anim.seek(1000);  anim.resize(320, 240);  anim.uninit();  anim.report();
 *
 * Differences from the real runtime, so you know what a green run does not prove:
 *  - `G.relayout` is the identity (one display line per LINE) and `G.wrap` splits evenly;
 *  - `G.imageInput` serves a 1x1 default image, never the camera;
 *  - `prevSylLimit` is approximated and `parentLimit` is ignored (see scheduler.js);
 *  - there is no player: time only moves when you call playTo/seek.
 * It also ships guards a real runtime does not have: non-finite numbers handed to canvas/DOM APIs,
 * leaked listeners / GL contexts / timers after UNINIT.
 */
import { TYPE, createScheduler, dataFor } from './scheduler.js';

const rawRaf = window.requestAnimationFrame.bind(window);
const rawSetTimeout = window.setTimeout.bind(window);
export const sleep = (ms) => new Promise((r) => rawSetTimeout(r, ms));
export const nextFrame = () => new Promise((r) => rawRaf(() => r()));

const SYSTEM = new Set([TYPE.TICK, TYPE.SEEK, TYPE.PLAY, TYPE.PAUSE, TYPE.UNINIT, TYPE.INIT, TYPE.RESIZE, TYPE.GAME]);
const BAD = /\bNaN\b|\bInfinity\b|\bundefined\b/;
const DARK_SHEET = ':host([data-bs-theme=dark]){color:#DEE2E6}'
  + ':host([data-bs-theme=dark]) svg{stroke:#fff;stroke-width:0;fill:#fff}\n';

// ───────────────────────── guards (installed once per page) ─────────────────────────
function installGuards() {
  if (window.__animGuards) return window.__animGuards;
  const state = {
    armed: false, uninit: false, host: null,
    nan: [], late: { raf: 0, interval: 0, timeout: 0 }, listeners: [], gl: [],
  };
  const flag = (what) => {
    if (!state.armed || state.nan.length >= 50) return;
    if (!state.nan.includes(what)) state.nan.push(what);
  };
  const badNum = (v) => typeof v === 'number' && !Number.isFinite(v);

  const proto = CanvasRenderingContext2D.prototype;
  for (const name of ['moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'fillRect', 'strokeRect',
    'clearRect', 'fillText', 'strokeText', 'drawImage', 'translate', 'scale', 'rotate', 'transform', 'setTransform',
    'bezierCurveTo', 'quadraticCurveTo', 'createLinearGradient', 'createRadialGradient']) {
    const orig = proto[name];
    if (typeof orig !== 'function') continue;
    proto[name] = function (...a) {
      if (state.armed && (a.some(badNum) || ((name === 'fillText' || name === 'strokeText') && BAD.test(String(a[0]))))) {
        flag('canvas.' + name + '(' + a.map((x) => (typeof x === 'object' ? typeof x : String(x))).join(', ') + ')');
      }
      return orig.apply(this, a);
    };
  }
  for (const prop of ['globalAlpha', 'lineWidth', 'lineDashOffset', 'miterLimit', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY']) {
    const d = Object.getOwnPropertyDescriptor(proto, prop);
    if (!d || !d.set) continue;
    Object.defineProperty(proto, prop, { ...d, set(v) { if (badNum(v)) flag('canvas.' + prop + ' = ' + v); d.set.call(this, v); } });
  }

  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (state.armed && BAD.test(String(value))) flag('setAttribute(' + name + ', ' + value + ')');
    return setAttribute.call(this, name, value);
  };
  const setProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (name, value, prio) {
    if (state.armed && value != null && (badNum(value) || BAD.test(String(value)))) flag('style.setProperty(' + name + ', ' + value + ')');
    return setProperty.call(this, name, value, prio);
  };
  try {
    const sp = CSSStyleDeclaration.prototype;
    for (const k of Object.getOwnPropertyNames(sp)) {
      const d = Object.getOwnPropertyDescriptor(sp, k);
      if (!d || !d.set || k === 'cssText' || k === 'length') continue;
      Object.defineProperty(sp, k, { ...d, set(v) {
        if (state.armed && v != null && (badNum(v) || BAD.test(String(v)))) flag('style.' + k + ' = ' + v);
        d.set.call(this, v);
      } });
    }
  } catch { /* style accessors differ between engines: setProperty is still guarded */ }

  // Timers: count callbacks that run after UNINIT.
  window.requestAnimationFrame = (cb) => rawRaf((t) => { if (state.uninit) state.late.raf++; return cb(t); });
  const si = window.setInterval.bind(window);
  window.setInterval = (cb, ms, ...a) => si(typeof cb === 'function'
    ? (...x) => { if (state.uninit) state.late.interval++; return cb(...x); } : cb, ms, ...a);
  window.setTimeout = (cb, ms, ...a) => rawSetTimeout(typeof cb === 'function'
    ? (...x) => { if (state.uninit) state.late.timeout++; return cb(...x); } : cb, ms, ...a);

  // Listeners on window/document/body/host that are still attached after UNINIT.
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  const capture = (o) => (typeof o === 'boolean' ? o : !!o?.capture);
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (state.armed && fn && !(opts && typeof opts === 'object' && (opts.once || opts.signal))
      && !state.listeners.some((e) => e.target === this && e.type === type && e.fn === fn && e.capture === capture(opts))) {
      state.listeners.push({ target: this, type, fn, capture: capture(opts) });
    }
    return add.call(this, type, fn, opts);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    const i = state.listeners.findIndex((e) => e.target === this && e.type === type && e.fn === fn && e.capture === capture(opts));
    if (i >= 0) state.listeners.splice(i, 1);
    return remove.call(this, type, fn, opts);
  };

  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const ctx = getContext.call(this, type, ...a);
    if (ctx && /webgl/.test(type) && state.armed) state.gl.push(ctx);
    return ctx;
  };

  return (window.__animGuards = state);
}

// ───────────────────────── G.cfg ─────────────────────────
function makeCfg() {
  const num = (x) => {
    if (typeof x === 'number') return Number.isFinite(x) ? x : null;
    if (typeof x === 'string' && x.trim() !== '') { const n = Number(x); return Number.isFinite(n) ? n : null; }
    return null;
  };
  const one = (v, spec) => {
    if (spec && typeof spec === 'object' && '$cfg' in spec) {
      if (spec.$cfg === 'pick') return spec.list.includes(v) ? v : spec.d;
      const n = num(v);
      if (n === null || (spec.$cfg === 'int' && !Number.isInteger(n))) return spec.d;
      return Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, n));
    }
    if (typeof spec === 'string') return typeof v === 'number' && Number.isFinite(v) ? String(v) : (typeof v === 'string' && v !== '' ? v : spec);
    if (typeof spec === 'boolean') return typeof v === 'boolean' ? v : spec;
    if (typeof spec === 'number') { const n = num(v); return n === null ? spec : n; }
    return v === undefined || v === null ? spec : v;
  };
  const cfg = (config, defaults) => {
    const out = {};
    for (const k of Object.keys(defaults ?? {})) out[k] = one((config ?? {})[k], defaults[k]);
    return Object.freeze(out);
  };
  const spec = (kind, d, o) => Object.freeze({ $cfg: kind, d, ...o });
  cfg.int = (d, min, max) => spec('int', d, { min, max });
  cfg.num = (d, min, max) => spec('num', d, { min, max });
  cfg.pick = (d, list) => spec('pick', d, { list: Object.freeze([...list]) });
  return cfg;
}

// ───────────────────────── mount ─────────────────────────
export async function mount({ js, css = '', html = '', song, config = {}, size = [640, 360], theme = 'light', container = null }) {
  const guard = installGuards();
  Object.assign(guard, { armed: true, uninit: false, nan: [], late: { raf: 0, interval: 0, timeout: 0 }, listeners: [], gl: [] });

  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  if (!container) document.body.style.cssText = 'margin:0;background:#777;';
  const host = document.createElement('div');
  host.id = 'anim-host';
  host.style.cssText = `${container ? 'position:relative;flex:none;' : 'position:fixed;left:0;top:0;'}width:${size[0]}px;height:${size[1]}px;overflow:hidden;`;
  host.setAttribute('data-bs-theme', theme);
  (container || document.body).appendChild(host);
  guard.host = host;
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = DARK_SHEET + ':host{display:block;position:relative}\n'
    + css.replace(/\[data-bs-theme=(?:"dark"|'dark'|dark)\]/g, ':host([data-bs-theme=dark])');
  root.appendChild(style);
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  root.appendChild(tpl.content);

  const mod = await import(URL.createObjectURL(new Blob([js], { type: 'text/javascript' })));
  const cfgValues = { ...(mod.c?.v ?? {}), ...config, darkMode: theme === 'dark' };
  for (const name of new Set([...css.matchAll(/var\(\s*--([\w-]+)/g)].map((m) => m[1]))) {
    if (name in cfgValues) host.style.setProperty('--' + name, String(cfgValues[name]));
  }

  const songData = song.songData;
  const scheduler = createScheduler(song);
  const handlers = new Map();
  const disposers = [];
  const renders = [];
  const calls = { seek: [], play: 0, pause: 0, setConfig: [], emit: [], game: { score: [], end: [], done: 0 } };
  let inited = false;
  let now = 0;
  let playing = false;
  let measureCtx = null;

  const fire = (type, ...args) => {
    for (const h of [...(handlers.get(type) || [])]) {
      try { h(...args); } catch (e) { console.error(e); }
    }
  };
  const initOnly = (name, fn) => (...a) => {
    if (!inited) throw new Error('G.' + name + ' can only be called after initialization');
    return fn(...a);
  };
  const args = (opts, cb) => (typeof opts === 'function' ? [{}, opts] : [opts || {}, cb]);
  const beatTimes = () => (song.beatData || []).map((b) => b.s);
  const beatStep = () => 60000 / (songData.beat?.bpm || 120);

  const G = {
    TYPE,
    on(type, a, b) {
      if (inited) throw new Error('G.on can only be called while the module is being set up (in default), not after initialization');
      const [opts, cb] = args(a, b);
      if (SYSTEM.has(type) || typeof type === 'string') {
        if (!handlers.has(type)) handlers.set(type, []);
        handlers.get(type).push(cb);
        return undefined;
      }
      return scheduler.add(type, opts, (ev) => { try { cb(ev, cfgValues); } catch (e) { console.error(e); } });
    },
    off(type, a, b) {
      if (inited) throw new Error('G.off can only be called while the module is being set up (in default), not after initialization');
      const [opts, cb] = args(a, b);
      return scheduler.add(type, opts, (ev) => { try { cb(ev, cfgValues); } catch (e) { console.error(e); } }, true);
    },
    emit(name, data) { calls.emit.push(name); fire(name, data); },
    map: initOnly('map', (type, a, b) => {
      const [opts, fn] = typeof a === 'function' ? [{}, a] : [a || {}, b];
      const items = dataFor(song, type, opts);
      return fn ? items.map(fn) : items;
    }),
    forEach: initOnly('forEach', (type, a, b) => {
      const [opts, fn] = typeof a === 'function' ? [{}, a] : [a || {}, b];
      dataFor(song, type, opts).forEach(fn);
    }),
    lookup: initOnly('lookup', (type, a, b) => {
      const [opts, fn] = typeof a === 'function' ? [{}, a] : [a || {}, b];
      const out = new Map();
      dataFor(song, type, opts).forEach((ev, i) => { const v = fn ? fn(ev, i) : ev; if (v != null) out.set(ev.id, v); });
      return out;
    }),
    iterator: initOnly('iterator', (type, opts, fn) => {
      const items = dataFor(song, type, opts || {});
      return (fn ? items.map(fn) : items)[Symbol.iterator]();
    }),
    getSongData: () => songData,
    currentTime: () => now,
    toBeat(ms) {
      const t = beatTimes();
      if (t.length < 2) return ms / beatStep();
      let i = -1;
      while (i + 1 < t.length && t[i + 1] <= ms) i++;
      if (i < 0) return (ms - t[0]) / (t[1] - t[0]);
      const dur = i + 1 < t.length ? t[i + 1] - t[i] : t[i] - t[i - 1];
      return i + (ms - t[i]) / dur;
    },
    toMs(beat) {
      const t = beatTimes();
      if (t.length < 2) return beat * beatStep();
      const i = Math.max(0, Math.min(Math.floor(beat), t.length - 2));
      return t[i] + (beat - i) * (t[i + 1] - t[i]);
    },
    getPlaybackRate: () => 1,
    progress(ev, ms) { const d = ev.e - ev.s; return d <= 0 ? 1 : Math.max(0, Math.min(1, (ms - ev.s) / d)); },
    game: {
      state: null,
      score: (n) => { if (Number.isFinite(n)) calls.game.score.push(n); },
      end: (r) => { calls.game.end.push(r); },
      done: () => { calls.game.done++; },
    },
    seek: (ms) => { calls.seek.push(+ms); },
    play: () => { calls.play++; },
    pause: () => { calls.pause++; },
    setConfig: (u) => { calls.setConfig.push(u); Object.assign(cfgValues, u); },
    getElementById: (id) => root.getElementById(id),
    clientRect: () => host.getBoundingClientRect(),
    svg(tag, attrs) {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
      return el;
    },
    toString: (o) => (Array.isArray(o) ? o.map((x) => x?.d ?? '').join('') : (o?.d ?? '')),
    toChars: function toChars(o) {
      if (Array.isArray(o)) return o.flatMap(toChars);
      if (typeof o === 'string') return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(o), (s) => s.segment);
      if (o?.d != null) return toChars(o.d);
      if (o?.syls) return toChars(o.syls);
      return [];
    },
    measureText(text, font = '12px') {
      measureCtx ??= document.createElement('canvas').getContext('2d');
      measureCtx.font = font;
      return measureCtx.measureText(text);
    },
    context2d(w, h, dpi, opt) {
      dpi ??= window.devicePixelRatio;
      const canvas = document.createElement('canvas');
      canvas.width = w * dpi;
      canvas.height = h * dpi;
      const ctx = canvas.getContext('2d', opt);
      ctx.scale(dpi, dpi);
      return ctx;
    },
    fit(ctx, init) {
      const cb = () => {
        const r = host.getBoundingClientRect();
        const k = Math.min(r.width / ctx.canvas.width, r.height / ctx.canvas.height) || 1;
        ctx.canvas.width = Math.round(ctx.canvas.width * k);
        ctx.canvas.height = Math.round(ctx.canvas.height * k);
        ctx.scale(k, k);
        init?.(ctx);
      };
      G.on(TYPE.RESIZE, cb);
      cb();
    },
    wrap(words, spec) {
      const n = typeof spec === 'number' ? spec : 1;
      const per = Math.ceil(words.length / Math.max(1, n));
      const out = [];
      for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per));
      return out;
    },
    relayout: (spec = {}) => dataFor(song, TYPE.LINE).map((l, i) => ({
      ...l, id: 2000001 + i, lineId: l.id,
      syls: dataFor(song, TYPE.SYL, { channel: spec.channel ?? 0 }).filter((x) => x.lineId === l.id),
    })),
    cfg: makeCfg(),
    onFrame({ render, reset } = {}) {
      if (inited) throw new Error('G.onFrame can only be called while the module is being set up (in default), not after initialization');
      if (render) {
        renders.push(render);
        for (const t of [TYPE.SEEK, TYPE.PLAY, TYPE.PAUSE, TYPE.RESIZE]) G.on(t, () => render(now));
      }
      if (reset) G.on(TYPE.UNINIT, () => reset());
    },
    dispose(fn) { disposers.push(fn); return fn; },
    listen(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      const off = () => target.removeEventListener(type, fn, opts);
      disposers.push(off);
      return off;
    },
    imageInput({ mount: m, onReady } = {}) {
      const img = document.createElement('img');
      img.src = 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2764%27 height=%2764%27%3E%3Crect width=%2764%27 height=%2764%27 fill=%27%23888%27/%3E%3C/svg%3E';
      img.onload = () => onReady?.(img);
      m?.appendChild(img);
      return { mode: 'default', element: img, width: 64, height: 64, mirrored: false,
        useCamera() {}, useUpload() {}, useDefault() {}, revealControls() {}, destroy() { img.remove(); } };
    },
    randGen(s = 1) {
      return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 0x100000000; };
    },
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } },
    lerp: (a, b, t) => a + (b - a) * t,
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    ease(t, type = 'inOut') {
      t = Math.max(0, Math.min(1, t));
      if (type === 'in') return t * t;
      if (type === 'out') return t * (2 - t);
      if (type === 'cubic') return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },
  };

  const api = mod.default(G, root, cfgValues);
  if (api && typeof api.init === 'function') handlers.set(TYPE.INIT, [api.init, ...(handlers.get(TYPE.INIT) || [])]); // init() runs before INIT handlers
  inited = true;
  fire(TYPE.INIT);

  // ───────────────────────── controller ─────────────────────────
  const tickMs = [];
  const step = (to, delta) => {
    now = to;
    const t0 = performance.now();
    scheduler.playTo(now, cfgValues);
    fire(TYPE.TICK, now, delta);
    tickMs.push(performance.now() - t0);
  };
  const frameSignature = () => {
    const canvases = [...root.querySelectorAll('canvas')];
    if (canvases.length) return canvases.map((c) => { try { return c.toDataURL(); } catch { return 'tainted'; } }).join('|');
    return [...root.children].filter((n) => n.tagName !== 'STYLE').map((n) => n.outerHTML).join('');
  };

  return {
    host, root, calls, mod,
    time: () => now,
    /** Play forward to `to` ms in `stepMs` increments, dispatching due events before each TICK. */
    playTo(to, stepMs = 40) {
      if (!playing) { playing = true; fire(TYPE.PLAY, now); }
      while (now < to) step(Math.min(to, now + stepMs), Math.min(stepMs, to - now));
    },
    /** A paused scrub: SEEK, the latest event of each subscription, then a TICK with delta 0, then every `onFrame` render (the stricter of the possible orders). */
    seek(t) {
      playing = false;
      now = t;
      fire(TYPE.SEEK);
      scheduler.seekTo(t, cfgValues);
      fire(TYPE.TICK, now, 0);
      for (const r of renders) { try { r(now); } catch (e) { console.error(e); } }
    },
    pause() { playing = false; fire(TYPE.PAUSE); },
    resize(w, h) {
      host.style.width = w + 'px';
      host.style.height = h + 'px';
      const box = [{ inlineSize: w, blockSize: h }];
      fire(TYPE.RESIZE, [{ target: host, contentRect: host.getBoundingClientRect(), contentBoxSize: box, borderBoxSize: box }]);
    },
    setTheme(next) {
      host.setAttribute('data-bs-theme', next);
      document.documentElement.style.colorScheme = next === 'dark' ? 'dark' : 'light';
      cfgValues.darkMode = next === 'dark';
    },
    uninit() {
      fire(TYPE.UNINIT);
      for (const d of disposers.splice(0).reverse()) { try { d(); } catch (e) { console.error(e); } }
      guard.uninit = true;
    },
    /** A TICK after UNINIT must be harmless. */
    strayTick(n = 5) { for (let i = 0; i < n; i++) { now += 16; fire(TYPE.TICK, now, 16); } },
    frame: frameSignature,
    destroy() { host.remove(); guard.armed = false; },
    report() {
      const t = tickMs.slice().sort((a, b) => a - b);
      const pick = (q) => (t.length ? t[Math.min(t.length - 1, Math.floor(q * t.length))] : 0);
      const globals = [window, document, document.documentElement, document.body, host];
      return {
        nan: guard.nan.slice(),
        late: { ...guard.late },
        leakedListeners: guard.listeners.filter((e) => globals.includes(e.target)).map((e) => e.type),
        liveGl: guard.gl.filter((g) => !g.isContextLost()).length,
        disposersLeft: disposers.length,
        canvases: [...root.querySelectorAll('canvas')].map((c) => ({ w: c.width, h: c.height, cssW: c.getBoundingClientRect().width })),
        tick: { n: t.length, median: pick(0.5), p95: pick(0.95), max: t[t.length - 1] || 0 },
        calls,
      };
    },
    clearTickStats() { tickMs.length = 0; },
  };
}
