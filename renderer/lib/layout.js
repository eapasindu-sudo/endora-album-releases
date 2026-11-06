// Endora Album – layout engine (pure functions, no DOM; tested with node --test)
// All cell coordinates are fractions of the full spread: x,y,w,h in 0..1.

export const STANDARD_SIZES = [
  { name: '12×36', h: 12, w: 36, unit: 'in' },
  { name: '12×30', h: 12, w: 30, unit: 'in' },
  { name: '10×30', h: 10, w: 30, unit: 'in' },
  { name: '8×24', h: 8, w: 24, unit: 'in' }
];

export const STYLES = {
  Classic: { margin: 0.05, gap: 0.018, avg: 4.5, bg: '#FFFFFF', bleedHero: false },
  Modern: { margin: 0, gap: 0.006, avg: 4, bg: '#FFFFFF', bleedHero: true },
  Minimal: { margin: 0.1, gap: 0.03, avg: 2.6, bg: '#F6F3EE', bleedHero: false },
  Magazine: { margin: 0.04, gap: 0.012, avg: 5.5, bg: '#FFFFFF', bleedHero: false }
};

export const toInches = (v, unit) => unit === 'cm' ? v / 2.54 : unit === 'mm' ? v / 25.4 : v;

export function sizeInfo(size) {
  const hIn = toInches(size.h, size.unit || 'in');
  const wIn = toInches(size.w, size.unit || 'in');
  const dpi = size.dpi || 300;
  const bleedIn = (size.bleedMm == null ? 3 : size.bleedMm) / 25.4;
  return {
    hIn, wIn, dpi, bleedIn,
    aspect: wIn / hIn,
    pxW: Math.round((wIn + 2 * bleedIn) * dpi),
    pxH: Math.round((hIn + 2 * bleedIn) * dpi),
    pageAspect: wIn / 2 / hIn
  };
}

// ---- page layouts, in page coordinates (0..1 of one page) ----
const PAGE = {
  full: [[0, 0, 1, 1]],
  center: [[0.14, 0.12, 0.72, 0.76]],
  cols2: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]],
  rows2: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]],
  bigL2: [[0, 0, 0.62, 1], [0.62, 0, 0.38, 0.5], [0.62, 0.5, 0.38, 0.5]],
  bigR2: [[0, 0, 0.38, 0.5], [0, 0.5, 0.38, 0.5], [0.38, 0, 0.62, 1]],
  top2: [[0, 0, 1, 0.6], [0, 0.6, 0.5, 0.4], [0.5, 0.6, 0.5, 0.4]],
  cols3: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]],
  grid4: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  big3: [[0, 0, 0.66, 1], [0.66, 0, 0.34, 1 / 3], [0.66, 1 / 3, 0.34, 1 / 3], [0.66, 2 / 3, 0.34, 1 / 3]],
  strip3: [[0, 0, 1, 0.62], [0, 0.62, 1 / 3, 0.38], [1 / 3, 0.62, 1 / 3, 0.38], [2 / 3, 0.62, 1 / 3, 0.38]]
};
export const PAGE_LAYOUTS = PAGE;

// Spread templates: either a full-spread layout or a left+right page pair.
export function buildTemplates() {
  const list = [
    { id: 'spread-hero', name: 'Full spread hero', full: [[0, 0, 1, 1]] },
    { id: 'spread-pano-2', name: 'Panorama + one', full: [[0, 0, 0.68, 1], [0.68, 0, 0.32, 1]] }
  ];
  const keys = Object.keys(PAGE);
  for (const l of keys) for (const r of keys) list.push({ id: l + '|' + r, name: l + ' + ' + r, left: l, right: r });
  return list.map((t) => ({ ...t, count: t.full ? t.full.length : PAGE[t.left].length + PAGE[t.right].length }));
}
export const TEMPLATES = buildTemplates();

// Turn a template into concrete spread cells with margins + gaps applied.
export function templateCells(tpl, size, styleName = 'Classic') {
  const st = STYLES[styleName] || STYLES.Classic;
  const { aspect } = sizeInfo(size);
  const mY = st.margin;                 // margin as fraction of height
  const mX = st.margin / aspect;        // same physical margin across width
  const gY = st.gap, gX = st.gap / aspect;
  const out = [];
  const place = (rects, x0, w0, bleed) => {
    for (const [x, y, w, h] of rects) {
      const mx = bleed ? 0 : mX, my = bleed ? 0 : mY;
      const areaX = x0 + mx, areaW = w0 - 2 * mx;
      const areaY = my, areaH = 1 - 2 * my;
      let cx = areaX + x * areaW, cy = areaY + y * areaH, cw = w * areaW, ch = h * areaH;
      // inset by half gap on internal edges only
      if (x > 0.001) { cx += gX / 2; cw -= gX / 2; }
      if (x + w < 0.999) cw -= gX / 2;
      if (y > 0.001) { cy += gY / 2; ch -= gY / 2; }
      if (y + h < 0.999) ch -= gY / 2;
      out.push({ x: cx, y: cy, w: cw, h: ch });
    }
  };
  if (tpl.full) place(tpl.full, 0, 1, st.bleedHero && tpl.full.length === 1);
  else {
    // the centre fold gets its own margin so photos do not run into the gutter
    place(PAGE[tpl.left], 0, 0.5, false);
    place(PAGE[tpl.right], 0.5, 0.5, false);
    if (st.margin === 0) {
      // Modern: pages are full-bleed; only keep a small gutter gap
      out.length = 0;
      const placeBleed = (rects, x0) => {
        for (const [x, y, w, h] of rects) {
          let cx = x0 + x * 0.5, cy = y, cw = w * 0.5, ch = h;
          if (x > 0.001) { cx += gX / 2; cw -= gX / 2; }
          if (x + w < 0.999) cw -= gX / 2;
          if (y > 0.001) { cy += gY / 2; ch -= gY / 2; }
          if (y + h < 0.999) ch -= gY / 2;
          out.push({ x: cx, y: cy, w: cw, h: ch });
        }
      };
      placeBleed(PAGE[tpl.left], 0);
      placeBleed(PAGE[tpl.right], 0.5);
    }
  }
  return out;
}

// Fraction of the photo that is cropped away when it fills the cell.
export function cropLoss(photoAspect, cellAspect) {
  if (!photoAspect || !cellAspect) return 1;
  return 1 - Math.min(photoAspect, cellAspect) / Math.max(photoAspect, cellAspect);
}

// Assign photos to cells to minimise crop: match by sorted aspect, keep time order for ties.
export function assignPhotos(cells, photos, aspect) {
  const cellIdx = cells.map((c, i) => ({ i, a: (c.w * aspect) / c.h }));
  const phIdx = photos.map((p, i) => ({ i, a: p.width / p.height }));
  cellIdx.sort((a, b) => a.a - b.a || a.i - b.i);
  phIdx.sort((a, b) => a.a - b.a || a.i - b.i);
  const result = new Array(cells.length);
  let cost = 0;
  cellIdx.forEach((c, k) => {
    const p = phIdx[k];
    result[c.i] = photos[p.i];
    cost += cropLoss(p.a, c.a);
  });
  return { order: result, cost: cost / cells.length };
}

export function bestTemplate(photos, size, styleName, opts = {}) {
  const { aspect } = sizeInfo(size);
  const n = photos.length;
  const avoid = new Set(opts.avoid || []);
  let best = null;
  for (const t of TEMPLATES) {
    if (t.count !== n) continue;
    if (t.full && !opts.allowFull) continue;
    if (styleName === 'Minimal' && !t.full && !/center|full|cols2|rows2/.test(t.id)) continue;
    const cells = templateCells(t, size, styleName);
    const { order, cost } = assignPhotos(cells, photos, aspect);
    let score = cost;
    if (avoid.has(t.id)) score += 0.08;
    if (opts.random) score += opts.random() * 0.05;
    if (!best || score < best.score) best = { tpl: t, cells, order, score };
  }
  return best;
}

export function focalFor(photo) {
  if (photo && photo.face) return { fx: photo.face.x, fy: photo.face.y };
  return { fx: 0.5, fy: 0.42 };
}

export function makeSpread(tplPick, extra = {}) {
  return {
    id: extra.id || uid(),
    layoutId: tplPick.tpl.id,
    bg: extra.bg || '#FFFFFF',
    section: extra.section || '',
    locked: false,
    texts: extra.texts || [],
    cells: tplPick.cells.map((c, i) => ({ ...c, photoId: tplPick.order[i].id, ...focalFor(tplPick.order[i]), zoom: 1 }))
  };
}

let _uidN = 0;
export function uid() {
  _uidN = (_uidN + 1) % 1e6;
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + _uidN.toString(36);
}

// Seeded random so "Shuffle" gives repeatable but different results.
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; };
}

// ---- events (sections) from capture time ----
export function groupEvents(photos, gapMinutes = 40) {
  const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt);
  const events = [];
  let cur = null;
  for (const p of sorted) {
    if (!cur || p.takenAt - cur.end > gapMinutes * 60000) {
      cur = { name: 'Part ' + (events.length + 1), start: p.takenAt, end: p.takenAt, ids: [] };
      events.push(cur);
    }
    cur.end = p.takenAt;
    cur.ids.push(p.id);
  }
  // merge tiny events (< 8 photos) into the previous one
  const merged = [];
  for (const e of events) {
    if (merged.length && e.ids.length < 8) {
      const prev = merged[merged.length - 1];
      prev.ids.push(...e.ids); prev.end = e.end;
    } else merged.push(e);
  }
  merged.forEach((e, i) => { e.name = 'Part ' + (i + 1); });
  return merged;
}

// Split n spreads across events proportional to photo count (each event >= 1 when possible).
export function allocate(total, weights) {
  const n = weights.length;
  if (!n) return [];
  if (total <= n) {
    const order = weights.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w);
    const out = new Array(n).fill(0);
    order.slice(0, total).forEach((o) => { out[o.i] = 1; });
    return out;
  }
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => 1 + (w / sum) * (total - n));
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => ({ f: r - Math.floor(r), i })).sort((a, b) => b.f - a.f).forEach((o) => { if (left > 0) { out[o.i]++; left--; } });
  return out;
}

// Photos-per-spread pattern that averages `avg` and varies naturally.
export function countsFor(spreads, photosAvailable, avg, random) {
  const counts = [];
  const choices = avg >= 5 ? [4, 5, 6, 7, 5, 6] : avg >= 4 ? [3, 4, 5, 6, 4, 4] : avg >= 3 ? [2, 3, 4, 3] : [1, 2, 2, 3];
  for (let i = 0; i < spreads; i++) counts.push(choices[Math.floor(random() * choices.length)]);
  // scale to what is available
  let total = counts.reduce((a, b) => a + b, 0);
  while (total > photosAvailable && counts.some((c) => c > 1)) {
    const i = counts.indexOf(Math.max(...counts)); counts[i]--; total--;
  }
  return counts;
}

export function lighten(hex, amt = 0.85) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c) => Math.round(c + (255 - c) * amt);
  return '#' + [mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Auto build an album.
 * photos: [{id,width,height,takenAt,score,excluded,star,face,avgColor}]
 * opts: { spreads, size, style, hero, face, text, color, seed, events:[{name,ids}], titles:{} }
 */
export function usablePhotos(photos, opts = {}) {
  let usable = photos.filter((p) => !p.excluded && p.width && p.height);
  if (opts.starsOnly) {
    const stars = usable.filter((p) => p.star);
    if (stars.length) usable = stars;
  }
  if (opts.skip) usable = usable.filter((p) => !opts.skip.has(p.id));
  return usable;
}

export function suggestSpreads(count, style) {
  const avg = (STYLES[style] || STYLES.Classic).avg;
  return Math.max(1, Math.min(80, Math.round(count / avg)));
}

// Counts that use every photo: spread evenly, between 1 and 8 per spread.
function evenCounts(spreads, photos) {
  const base = Math.floor(photos / spreads), extra = photos % spreads;
  return Array.from({ length: spreads }, (_, i) => Math.min(8, base + (i < extra ? 1 : 0)));
}

function rangeCounts(spreads, available, min, max, random) {
  const counts = [];
  for (let i = 0; i < spreads; i++) counts.push(min + Math.floor(random() * (max - min + 1)));
  let total = counts.reduce((a, b) => a + b, 0);
  while (total > available && counts.some((c) => c > 1)) { const i = counts.indexOf(Math.max(...counts)); counts[i]--; total--; }
  return counts;
}

export function autoBuild(photos, opts) {
  const style = STYLES[opts.style] ? opts.style : 'Classic';
  const st = STYLES[style];
  const random = rng(opts.seed || 7);
  const usable = usablePhotos(photos, opts);
  if (!usable.length) return [];
  const byId = new Map(usable.map((p) => [p.id, p]));
  let events = (opts.events && opts.events.length && opts.newSpreadPerPart !== false ? opts.events : [])
    .map((e) => ({ ...e, photos: e.ids.map((id) => byId.get(id)).filter(Boolean) }))
    .filter((e) => e.photos.length);
  if (!events.length && opts.newSpreadPerPart !== false && !(opts.events && opts.events.length)) {
    events = groupEvents(usable).map((e) => ({ ...e, photos: e.ids.map((id) => byId.get(id)) }));
  }
  if (!events.length) events = [{ name: (opts.events && opts.events[0] && opts.events[0].name) || 'Album', photos: [...usable].sort((a, b) => a.takenAt - b.takenAt) }];

  const total = Math.max(1, Math.min(opts.spreads || 30, 200));
  const alloc = allocate(total, events.map((e) => e.photos.length));
  const spreads = [];
  const reuseWindow = opts.reuse === 'Low' ? 8 : opts.reuse === 'High' ? 0 : 2;
  const recent = [];

  events.forEach((ev, ei) => {
    const n = alloc[ei];
    if (!n) return;
    const counts = opts.useEvery ? evenCounts(n, ev.photos.length)
      : opts.range ? rangeCounts(n, ev.photos.length, opts.range[0], opts.range[1], random)
      : countsFor(n, ev.photos.length, st.avg, random);
    let heroIdx = -1;
    if (opts.hero !== false && n >= 2 && !opts.useEvery) {
      counts[0] = 1;
      // hero: best scored (or starred) landscape-ish photo
      const cands = ev.photos.map((p, i) => ({ p, i, s: (p.score || 0.5) + (p.star ? 1 : 0) + (p.width >= p.height ? 0.15 : 0) }));
      cands.sort((a, b) => b.s - a.s);
      heroIdx = cands[0].i;
    }
    const need = counts.reduce((a, b) => a + b, 0);
    // choose the best `need` photos but keep time order
    const ranked = ev.photos.map((p, i) => ({ p, i, s: (p.score == null ? 0.5 : p.score) + (p.star ? 1 : 0) }));
    ranked.sort((a, b) => b.s - a.s);
    const keep = new Set(ranked.slice(0, need).map((r) => r.i));
    if (heroIdx >= 0) keep.add(heroIdx);
    let chosen = ev.photos.filter((_, i) => keep.has(i) && i !== heroIdx);
    const hero = heroIdx >= 0 ? ev.photos[heroIdx] : null;

    const bg = opts.color && ev.photos[0] && ev.photos[0].avgColor ? lighten(ev.photos[0].avgColor, 0.88) : st.bg;
    for (let s = 0; s < n; s++) {
      let group;
      if (s === 0 && hero) group = [hero];
      else group = chosen.splice(0, counts[s]);
      if (!group.length) break;
      const allowFull = group.length <= 2;
      let pick = bestTemplate(group, opts.size, style, { allowFull, avoid: recent.slice(-reuseWindow), random });
      if (!pick) pick = bestTemplate(group, opts.size, 'Classic', { allowFull: true });
      if (!pick) pick = bestTemplate(group.slice(0, 1), opts.size, style, { allowFull: true });
      if (reuseWindow) recent.push(pick.tpl.id);
      const texts = [];
      if (s === 0 && opts.text) {
        const title = (opts.titles && opts.titles[ev.name]) || ev.name;
        texts.push(makeText(title, pick, opts.size, style));
      }
      spreads.push(makeSpread(pick, { bg, section: ev.name, texts }));
    }
  });
  return spreads;
}

export function makeText(text, pick, size, style) {
  // place the title in the lower area of the right page, inside the safe zone
  const dark = STYLES[style] && STYLES[style].margin === 0;
  return {
    id: uid(), text, x: 0.56, y: 0.8, w: 0.38, size: 0.055,
    font: /[඀-෿]/.test(text) ? 'sinhala' : 'serif',
    color: dark || (pick && pick.tpl.full) ? '#FFFFFF' : '#3B3026',
    align: 'left', shadow: dark || !!(pick && pick.tpl.full)
  };
}

// Re-layout one spread with a chosen template, keeping its photos.
export function applyTemplate(spread, tplId, photosById, size, style) {
  const tpl = TEMPLATES.find((t) => t.id === tplId);
  if (!tpl) return spread;
  const photos = spread.cells.map((c) => photosById.get(c.photoId)).filter(Boolean);
  if (tpl.count !== photos.length) return spread;
  const cells = templateCells(tpl, size, style);
  const { order } = assignPhotos(cells, photos, sizeInfo(size).aspect);
  return { ...spread, layoutId: tpl.id, cells: cells.map((c, i) => ({ ...c, photoId: order[i].id, ...focalFor(order[i]), zoom: 1 })) };
}

export function templatesFor(count) {
  return TEMPLATES.filter((t) => t.count === count);
}

// ---- print checks ----
export function cellDpi(cell, photo, size) {
  const info = sizeInfo(size);
  const cellWIn = cell.w * info.wIn, cellHIn = cell.h * info.hIn;
  const pa = photo.width / photo.height, ca = cellWIn / cellHIn;
  // the photo is scaled to cover the cell
  const usedW = pa > ca ? photo.height * ca : photo.width;
  return Math.round(usedW / cellWIn / (cell.zoom || 1));
}

export function printChecks(project) {
  const size = project.size;
  const byId = new Map(project.photos.map((p) => [p.id, p]));
  const low = [], gutter = [], textOut = [];
  const safe = 0.04;
  project.spreads.forEach((s, si) => {
    s.cells.forEach((c) => {
      const p = byId.get(c.photoId);
      if (!p) return;
      const dpi = cellDpi(c, p, size);
      if (dpi < 200) low.push({ spread: si + 1, photoId: p.id, dpi });
      if (p.face && c.x < 0.5 && c.x + c.w > 0.5) {
        const fxSpread = c.x + c.w * (c.fx == null ? 0.5 : c.fx);
        if (Math.abs(fxSpread - 0.5) < 0.03) gutter.push({ spread: si + 1, photoId: p.id });
      }
    });
    (s.texts || []).forEach((t) => {
      const hTxt = t.size * 1.4;
      if (t.x < safe / 3 || t.y < safe || t.x + t.w > 1 - safe / 3 || t.y + hTxt > 1 - safe) textOut.push({ spread: si + 1, id: t.id });
    });
  });
  const textCount = project.spreads.reduce((a, s) => a + (s.texts || []).length, 0);
  return { low, gutter, textOut, textCount };
}
