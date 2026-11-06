'use strict';
// Minimal EXIF reader: finds DateTimeOriginal (0x9003) or DateTime (0x0132)
// in the raw EXIF buffer that sharp returns from metadata().exif.

function readDate(str) {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(str || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function parseExifDate(buf) {
  if (!buf || buf.length < 14) return null;
  let start = 0;
  if (buf.toString('ascii', 0, 4) === 'Exif') start = 6;
  const order = buf.toString('ascii', start, start + 2);
  const le = order === 'II';
  if (!le && order !== 'MM') return null;
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));

  const readIfd = (ifdOffset) => {
    const out = {};
    const base = start + ifdOffset;
    if (base + 2 > buf.length) return out;
    const count = u16(base);
    for (let i = 0; i < count; i++) {
      const e = base + 2 + i * 12;
      if (e + 12 > buf.length) break;
      const tag = u16(e);
      const type = u16(e + 2);
      const num = u32(e + 4);
      if (type === 2) {
        const off = num > 4 ? start + u32(e + 8) : e + 8;
        if (off + num <= buf.length) out[tag] = buf.toString('ascii', off, off + num).replace(/\0+$/, '');
      } else if (type === 4 || type === 3) {
        out[tag] = type === 4 ? u32(e + 8) : u16(e + 8);
      }
    }
    return out;
  };

  try {
    const ifd0 = readIfd(u32(start + 4));
    let date = null;
    if (ifd0[0x8769]) {
      const exif = readIfd(ifd0[0x8769]);
      date = readDate(exif[0x9003]) || readDate(exif[0x9004]);
    }
    return date || readDate(ifd0[0x0132]);
  } catch (_) {
    return null;
  }
}

module.exports = { parseExifDate };
