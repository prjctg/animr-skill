/**
 * Event dispatch for the mock runtime. DOM-free, so it also runs in node tests.
 *
 * Mirrors the documented timing model (skill/spec/events.md):
 *  - a subscription fires at `ev.s + offset`; a `G.off` subscription fires at `ev.e + offset`;
 *  - space/punctuation items (`isSP`) are not delivered unless `includeDash`;
 *  - playing fires every due event once, in time order; a seek fires the latest event of each subscription;
 *  - `prevSylLimit` is applied to the LINE family only (an approximation: it uses the previous line's
 *    last sung syllable); `parentLimit`/`parentId` are accepted and ignored.
 */
export const TYPE = Object.freeze({
  TICK: 1000, SEEK: 1001, PLAY: 1002, PAUSE: 1003, UNINIT: 1007, INIT: 1008, RESIZE: 1009, GAME: 1010,
  BEAT: 1011, MEASURE: 1012, TIMESIG: 1013, KEY: 1014, CHORD: 1015, SECTION: 1021,
  SLINE: 1031, LINE: 1032, DLINE: 1033, SEGMENT: 1041, WORD: 1051, WORD_: 1052, SYL: 1061, SYL_: 1062, NOTE: 1063,
});

const LINE_FAMILY = new Set([TYPE.LINE, TYPE.SLINE, TYPE.DLINE, TYPE.SEGMENT]);
const DLINE_BASE = 2000001;

/** The events `G.map(type, opts)` returns for a song. */
export function dataFor(song, type, opts = {}) {
  // Deprecated WORD_ / SYL_ are WORD / SYL with includeDash.
  if (type === TYPE.WORD_ || type === TYPE.SYL_) { type -= 1; opts = { ...opts, includeDash: true }; }
  const ch = opts.channel ?? 0;
  const byTime = (a) => a.slice().sort((x, y) => x.s - y.s);
  switch (type) {
    case TYPE.LINE: case TYPE.SLINE: case TYPE.SEGMENT: return byTime(song.lineData || []);
    case TYPE.DLINE:
      return byTime((song.lineData || []).map((l, i) => ({ ...l, id: DLINE_BASE + i, lineId: l.id })));
    case TYPE.SECTION: return byTime(song.sectionData || []);
    case TYPE.BEAT: return byTime(song.beatData || []);
    case TYPE.MEASURE: return byTime(song.measureData || []);
    case TYPE.WORD: case TYPE.SYL: {
      if (ch === 1) return []; // channel 1 is the translation track, which never fires SYL / WORD (spec/g.d.ts)
      let items = (type === TYPE.WORD ? song.wordData?.[ch] : song.channelData?.[ch]) || [];
      if (!opts.includeDash) items = items.filter((x) => !x.isSP);
      for (const key of ['lineId', 'segmentId', 'wordId', 'secId']) {
        if (opts[key] != null) items = items.filter((x) => x[key] === opts[key]);
      }
      if (opts.stream != null) items = items.filter((x) => (x.g ?? 0) === opts.stream);
      return byTime(items);
    }
    default: return [];
  }
}

function itemsFor(song, type, opts, off) {
  const evs = dataFor(song, type, opts);
  const offset = opts.offset || 0;
  let starts = evs.map((ev) => ev.s);
  if (opts.prevSylLimit && LINE_FAMILY.has(type)) {
    const ratio = opts.prevSylRatio ?? 0.3;
    const extra = opts.prevSylOffset ?? 0;
    const lastSyl = (lineId) => {
      const syls = (song.channelData?.[opts.channel ?? 0] || []).filter((x) => x.lineId === lineId && !x.isSP);
      return syls.length ? Math.max(...syls.map((x) => x.s)) : null;
    };
    starts = evs.map((ev, i) => {
      const nominal = ev.s;
      const early = nominal + offset;
      const prev = i > 0 ? lastSyl(evs[i - 1].lineId ?? evs[i - 1].id) : null;
      if (prev == null || early >= prev) return early - offset;
      return Math.max(prev + 1, prev + ratio * (nominal - prev) + extra) - offset;
    });
  }
  const items = evs.map((ev, i) => ({ t: (off ? ev.e : starts[i]) + offset, ev }));
  items.sort((a, b) => a.t - b.t);
  if (!opts.batchEvents) return items;
  const batches = [];
  for (const it of items) {
    const last = batches[batches.length - 1];
    if (last && last.t === it.t) last.ev.push(it.ev);
    else batches.push({ t: it.t, ev: [it.ev] });
  }
  return batches;
}

export function createScheduler(song) {
  const subs = [];
  return {
    subs,
    add(type, opts, cb, off = false) {
      if (type === TYPE.WORD_ || type === TYPE.SYL_) { type -= 1; opts = { ...opts, includeDash: true }; }
      const sub = { type, opts: opts || {}, cb, off, items: itemsFor(song, type, opts || {}, off), i: 0 };
      subs.push(sub);
      return subs.length - 1;
    },
    /** Fire every event due in (from, to], oldest first across all subscriptions. */
    playTo(to, config) {
      const due = [];
      for (const sub of subs) {
        while (sub.i < sub.items.length && sub.items[sub.i].t <= to) due.push({ sub, item: sub.items[sub.i++] });
      }
      due.sort((a, b) => a.item.t - b.item.t);
      for (const { sub, item } of due) sub.cb(item.ev, config);
    },
    /** A scrub: reposition every cursor and fire the latest event of each subscription at or before `t`. */
    seekTo(t, config) {
      for (const sub of subs) {
        let idx = -1;
        while (idx + 1 < sub.items.length && sub.items[idx + 1].t <= t) idx++;
        sub.i = idx + 1;
        if (idx >= 0 && (!sub.off || LINE_FAMILY.has(sub.type))) sub.cb(sub.items[idx].ev, config);
      }
    },
  };
}
