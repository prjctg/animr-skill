/**
 * Synthetic songs for testing anim modules. Pure data: no DOM, no node APIs, so it loads in
 * the browser (preview, check) and in node (unit tests).
 *
 * `songOf(lines, opts)` returns the harness form (`channelData`, `wordData`, `lineData`,
 * `sectionData`, `beatData`, `measureData`, `songData`) plus a flat "unit" form
 * (`syls`, `words`, `lines`, `beats`) for testing a module's pure half directly.
 *
 * A line is an array of words `[text | [syllables], startMs, endMs]`; `line()` builds one.
 */
export const LINE_BASE = 1000001;     // composite LINE ids start here (see skill/spec/event-shapes.md)
export const TRANSLATION_BASE = 5001; // first syllable id of channel 1

/** `line("moon sun|rise", 1000, 600)`: words every `step` ms, `|` splits syllables. */
export function line(text, start, step = 600) {
  return text.split(/\s+/).filter(Boolean).map((w, i) => {
    const s = start + i * step;
    return [w.includes('|') ? w.split('|') : w, s, s + Math.round(step * 0.8)];
  });
}

function buildChannel(lines, { idBase, beatMs, spaces, wordIds }) {
  const syls = [];
  const words = [];
  let id = idBase;
  let wid = idBase;
  lines.forEach((ws, li) => {
    const lineId = LINE_BASE + li;
    ws.forEach(([d, s, e]) => {
      const parts = Array.isArray(d) ? d : [d];
      const step = (e - s) / parts.length;
      const wordId = wordIds ? wid : 0;
      parts.forEach((x, k) => {
        const syl = {
          id: id++, d: x, s: s + k * step, e: s + (k + 1) * step, b: (s + k * step) / beatMs,
          wordId, segmentId: lineId, lineId,
        };
        if (spaces) syl.isSP = false;
        syls.push(syl);
      });
      if (wordIds) words.push({ id: wid, s, e, b: s / beatMs, lineId, segmentId: lineId, isSP: false });
      wid++;
      if (spaces) syls.push({ id: id++, d: ' ', s: e, e: e + 50, b: e / beatMs, wordId: 0, segmentId: lineId, lineId, isSP: true });
    });
  });
  return { syls, words };
}

export function songOf(lines, {
  duration = 16000, bpm = 120, beats = true, sections = [], title = 'Fixture',
  spaces = true, wordIds = true, translation = null, lang = 'en',
} = {}) {
  const beatMs = 60000 / bpm;
  const main = buildChannel(lines, { idBase: 1, beatMs, spaces, wordIds });
  const lineEvs = lines.map((ws, i) => ({
    id: LINE_BASE + i, s: ws[0][1], e: ws[ws.length - 1][2], b: ws[0][1] / beatMs, secId: 0,
  }));
  const beatData = [];
  const measureData = [];
  if (beats) {
    for (let ms = 0, i = 0; ms < duration; ms += beatMs, i++) {
      beatData.push({ id: i + 1, s: ms, e: ms + beatMs, b: i });
      if (i % 4 === 0) measureData.push({ id: measureData.length + 1, s: ms, e: ms + 4 * beatMs, b: i });
    }
  }
  const channelData = { 0: main.syls };
  const wordData = { 0: main.words };
  const lyricLangs = [lang];
  if (translation) {
    const t = buildChannel(translation, { idBase: TRANSLATION_BASE, beatMs, spaces, wordIds });
    channelData[1] = t.syls;
    wordData[1] = t.words;
    lyricLangs.push('xx');
  }
  const song = {
    channelData, wordData, lineData: lineEvs, sectionData: sections, beatData, measureData,
    songData: { title, artist: 'Test', duration, beat: { type: 4, bpm }, streamCount: 1, lyricLangs },
  };
  // unit form
  song.syls = main.syls;
  song.words = main.words;
  song.lines = lineEvs;
  song.beats = beatData;
  return song;
}

const verse = (id, s, e) => ({ id, s, e, b: 0, type: 'verse' });
const chorus = (id, s, e) => ({ id, s, e, b: 0, type: 'chorus' });

/** Four short lines with verse/chorus sections and a 120 bpm grid. Something is sung at 1.1 s and at 2.3 s. */
const basic = () => songOf([
  [...line('moon light', 1000, 900)],
  [...line('deep end', 3200, 900)],
  [...line('rise up high', 6400, 700)],
  [...line('fall back down', 10000, 700)],
], { sections: [verse(1, 0, 6000), chorus(2, 6000, 16000)] });

/** Very short syllables back to back (10 per second). */
const dense = () => songOf([
  [...line(Array.from({ length: 20 }, (_, i) => 'a' + i).join(' '), 500, 100)],
  [...line(Array.from({ length: 20 }, (_, i) => 'b' + i).join(' '), 3000, 100)],
  [...line(Array.from({ length: 20 }, (_, i) => 'c' + i).join(' '), 5500, 100)],
], { sections: [verse(1, 0, 16000)] });

/** One line of 64 syllables: wrapping and fitting. */
const longLine = () => songOf([
  [...line(Array.from({ length: 32 }, () => 'la|la').join(' '), 800, 330)],
], { sections: [verse(1, 0, 16000)] });

/** Syllables with s === e and overlaps. */
const zeroLength = () => {
  const song = basic();
  song.syls.forEach((s, i) => { if (!s.isSP && i % 3 === 0) s.e = s.s; });
  const overlap = song.syls.find((s) => !s.isSP && s.e > s.s);
  if (overlap) song.syls.push({ ...overlap, id: 9001, s: overlap.s + 10, e: overlap.e + 400 });
  song.channelData[0] = song.syls;
  return song;
};

export const SONGS = {
  basic,
  empty: () => songOf([], { duration: 8000, beats: false }),
  noLyrics: () => songOf([
    [['♪', 1000, 3000]], [['♪', 5000, 7000]],
  ], { sections: [{ id: 1, s: 0, e: 8000, b: 0 }] }),
  noBeats: () => songOf([[...line('moon light', 1000, 900)], [...line('deep end', 3200, 900)]], { beats: false }),
  oneSection: () => songOf([[...line('moon light', 1000, 900)], [...line('deep end', 3200, 900)]],
    { sections: [verse(1, 0, 16000)] }),
  noWordIds: () => songOf([[...line('moon light', 1000, 900)], [...line('deep end', 3200, 900)]], { wordIds: false }),
  dense,
  longLine,
  cjk: () => songOf([
    [[[...'你好世界我们一起唱歌'], 1000, 4000]],
    [[[...'月光照亮夜空'], 5000, 8000]],
  ], { spaces: false, lang: 'zh' }),
  rtl: () => songOf([
    [...line('שלום עולם', 1000, 900)],
    [...line('مرحبا بالعالم', 3200, 900)],
  ], { lang: 'he' }),
  myanmar: () => songOf([
    [[[...['မင်္ဂ', 'လာ', 'ပါ']], 1000, 2400], [['ကျေးဇူး', 'တင်ပါတယ်'], 2800, 4400]],
  ], { lang: 'my' }),
  zeroLength,
  twoChannels: () => songOf([
    [...line('moon light', 1000, 900)],
    [...line('deep end', 3200, 900)],
  ], { translation: [[...line('lune lumiere', 1000, 900)], [...line('fin profonde', 3200, 900)]] }),
};

/** Fixture names in the order `npm run check` mounts them. */
export const SONG_NAMES = Object.keys(SONGS);
/** Moments of `basic` where something is sung: for screenshots and frame comparisons. */
export const BASIC_TIMES = { early: 1300, mid: 2300, later: 3500 };
