/** Minimal PNG decoder (8-bit, non-interlaced RGB/RGBA: what Chromium screenshots are) and pixel measures. */
import { inflateSync } from 'node:zlib';

export function decodePng(buf) {
  let off = 8;
  let w = 0; let h = 0; let ct = 6;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); ct = body[9]; }
    else if (type === 'IDAT') idat.push(body);
    off += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = new Uint8Array(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = (line[x] + add) & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      out[o] = line[x * bpp]; out[o + 1] = line[x * bpp + 1]; out[o + 2] = line[x * bpp + 2];
      out[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255;
    }
    prev = line;
  }
  return { w, h, data: out };
}

/** Fraction of pixels that differ from the most common colour by more than 24 in any channel. */
export function ink(png) {
  const counts = new Map();
  const n = png.w * png.h;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const key = ((png.data[o] >> 3) << 10) | ((png.data[o + 1] >> 3) << 5) | (png.data[o + 2] >> 3);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let bg = 0; let best = -1;
  for (const [k, c] of counts) if (c > best) { best = c; bg = k; }
  const br = ((bg >> 10) & 31) << 3; const bgc = ((bg >> 5) & 31) << 3; const bb = (bg & 31) << 3;
  let diff = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (Math.max(Math.abs(png.data[o] - br), Math.abs(png.data[o + 1] - bgc), Math.abs(png.data[o + 2] - bb)) > 24) diff++;
  }
  return diff / n;
}

/** Fraction of pixels that differ between two same-sized images by more than 16 in any channel. */
export function diffRatio(a, b) {
  if (a.w !== b.w || a.h !== b.h) return 1;
  const n = a.w * a.h;
  let diff = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (Math.max(Math.abs(a.data[o] - b.data[o]), Math.abs(a.data[o + 1] - b.data[o + 1]), Math.abs(a.data[o + 2] - b.data[o + 2])) > 16) diff++;
  }
  return diff / n;
}
