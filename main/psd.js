'use strict';
// Minimal Photoshop (.psd / .psb) layer reader: returns every pixel layer as RGBA.
// Supports 8-bit RGB, Grayscale and CMYK files with raw, RLE or ZIP compressed channels.
// Text layers come out as their rendered pixels, exactly as Photoshop saved them.
const zlib = require('zlib');

function reader(buf) {
  let p = 0;
  return {
    get pos() { return p; }, set pos(v) { p = v; },
    u8: () => buf[p++],
    i16: () => { const v = buf.readInt16BE(p); p += 2; return v; },
    u16: () => { const v = buf.readUInt16BE(p); p += 2; return v; },
    i32: () => { const v = buf.readInt32BE(p); p += 4; return v; },
    u32: () => { const v = buf.readUInt32BE(p); p += 4; return v; },
    u64: () => { const hi = buf.readUInt32BE(p), lo = buf.readUInt32BE(p + 4); p += 8; return hi * 4294967296 + lo; },
    str: (n) => { const s = buf.toString('latin1', p, p + n); p += n; return s; },
    skip: (n) => { p += n; }
  };
}

function unpackBits(src, start, len, out, outOff, outLen) {
  let i = start, o = outOff;
  const end = start + len, oEnd = outOff + outLen;
  while (i < end && o < oEnd) {
    const n = (src[i] << 24) >> 24; i++;
    if (n >= 0) { for (let k = 0; k <= n && o < oEnd; k++) out[o++] = src[i++]; }
    else if (n !== -128) { const v = src[i++]; for (let k = 0; k < 1 - n && o < oEnd; k++) out[o++] = v; }
  }
}

function decodeChannel(buf, start, length, w, h, depth, psb) {
  const comp = buf.readUInt16BE(start);
  const bpc = depth / 8;
  const rowBytes = w * bpc;
  const out = Buffer.alloc(rowBytes * h);
  const data = start + 2;
  if (comp === 0) buf.copy(out, 0, data, data + out.length);
  else if (comp === 1) {
    const cntSize = psb ? 4 : 2;
    let off = data + h * cntSize;
    for (let y = 0; y < h; y++) {
      const n = psb ? buf.readUInt32BE(data + y * 4) : buf.readUInt16BE(data + y * 2);
      unpackBits(buf, off, n, out, y * rowBytes, rowBytes);
      off += n;
    }
  } else if (comp === 2 || comp === 3) {
    const raw = zlib.inflateSync(buf.subarray(data, start + length));
    raw.copy(out, 0, 0, Math.min(raw.length, out.length));
    if (comp === 3 && bpc === 1) for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) out[y * w + x] = (out[y * w + x] + out[y * w + x - 1]) & 255;
  }
  if (bpc === 1) return out;
  // 16-bit: keep the high byte
  const o8 = Buffer.alloc(w * h);
  for (let i = 0; i < o8.length; i++) o8[i] = out[i * bpc];
  return o8;
}

function readLayers(buf) {
  const r = reader(buf);
  if (r.str(4) !== '8BPS') throw new Error('Not a Photoshop file');
  const version = r.u16(); const psb = version === 2;
  r.skip(6);
  r.u16(); // channels in composite
  const height = r.u32(), width = r.u32();
  const depth = r.u16(), mode = r.u16();
  if (depth !== 8 && depth !== 16) throw new Error(`Unsupported bit depth ${depth}`);
  if (![1, 3, 4].includes(mode)) throw new Error('Only RGB, Grayscale and CMYK PSD files are supported');
  r.skip(r.u32()); // colour mode data
  r.skip(r.u32()); // image resources
  const lmLen = psb ? r.u64() : r.u32();
  const lmEnd = r.pos + lmLen;
  if (!lmLen) return { width, height, layers: [] };
  const liLen = psb ? r.u64() : r.u32();
  if (!liLen) return { width, height, layers: [] };
  let count = Math.abs(r.i16());
  const recs = [];
  for (let i = 0; i < count; i++) {
    const top = r.i32(), left = r.i32(), bottom = r.i32(), right = r.i32();
    const nch = r.u16();
    const chans = [];
    for (let c = 0; c < nch; c++) chans.push({ id: r.i16(), len: psb ? r.u64() : r.u32() });
    r.skip(4); // 8BIM
    const blend = r.str(4);
    const opacity = r.u8(); r.u8();
    const flags = r.u8(); r.u8();
    const extraLen = r.u32();
    const extraEnd = r.pos + extraLen;
    const maskLen = r.u32(); r.skip(maskLen);
    const rangesLen = r.u32(); r.skip(rangesLen);
    const nameLen = r.u8();
    let name = r.str(nameLen);
    r.skip((4 - ((nameLen + 1) % 4)) % 4);
    let divider = 0;
    while (r.pos + 12 <= extraEnd) {
      const sig = r.str(4);
      if (sig !== '8BIM' && sig !== '8B64') break;
      const key = r.str(4);
      const long = psb && ['LMsk', 'Lr16', 'Lr32', 'Layr', 'Mt16', 'Mt32', 'Mtrn', 'Alph', 'FMsk', 'lnk2', 'FEid', 'FXid', 'PxSD'].includes(key);
      const len = long ? r.u64() : r.u32();
      const start = r.pos;
      if (key === 'luni') {
        const n = buf.readUInt32BE(start);
        let s = '';
        for (let k = 0; k < n; k++) s += String.fromCharCode(buf.readUInt16BE(start + 4 + k * 2));
        name = s.replace(/\0+$/, '');
      } else if (key === 'lsct' || key === 'lsdk') divider = buf.readUInt32BE(start);
      r.pos = start + len + (len % 2 ? 0 : 0);
      // keys are padded to even (PSD) / 4 bytes (PSB) by the writer; tolerate both
      while (r.pos < extraEnd && r.pos % 2 && buf[r.pos] === 0) r.pos++;
    }
    r.pos = extraEnd;
    recs.push({ name, top, left, w: right - left, h: bottom - top, chans, opacity, blend, hidden: !!(flags & 2), divider });
  }
  const layers = [];
  for (const rec of recs) {
    const chanData = {};
    for (const ch of rec.chans) {
      const start = r.pos;
      if (rec.w > 0 && rec.h > 0 && ch.id >= -1 && ch.len >= 2) {
        try { chanData[ch.id] = decodeChannel(buf, start, ch.len, rec.w, rec.h, depth, psb); } catch (_) { /* skip broken channel */ }
      }
      r.pos = start + ch.len;
    }
    if (rec.w <= 0 || rec.h <= 0 || rec.divider) continue;
    const n = rec.w * rec.h;
    const rgba = Buffer.alloc(n * 4);
    const A = chanData[-1];
    for (let i = 0; i < n; i++) {
      let R, G, Bv;
      if (mode === 3) { R = chanData[0] ? chanData[0][i] : 0; G = chanData[1] ? chanData[1][i] : 0; Bv = chanData[2] ? chanData[2][i] : 0; }
      else if (mode === 1) { R = G = Bv = chanData[0] ? chanData[0][i] : 0; }
      else { // CMYK stored inverted
        const c = 255 - (chanData[0] ? chanData[0][i] : 255), m = 255 - (chanData[1] ? chanData[1][i] : 255);
        const y = 255 - (chanData[2] ? chanData[2][i] : 255), k = 255 - (chanData[3] ? chanData[3][i] : 255);
        R = 255 - Math.min(255, c + k); G = 255 - Math.min(255, m + k); Bv = 255 - Math.min(255, y + k);
      }
      rgba[i * 4] = R; rgba[i * 4 + 1] = G; rgba[i * 4 + 2] = Bv; rgba[i * 4 + 3] = A ? A[i] : 255;
    }
    layers.push({ name: rec.name, left: rec.left, top: rec.top, width: rec.w, height: rec.h, hidden: rec.hidden, hasAlpha: !!A, rgba });
  }
  return { width, height, layers };
}

module.exports = { readLayers };
