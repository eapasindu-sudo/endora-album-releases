// Endora Album – layout engine (pure functions, no DOM; tested with node --test)
// All cell coordinates are fractions of the full spread: x,y,w,h in 0..1.

import { DESIGNS, designColours, fillTokens } from './designs.js';

export const MAX_PER_SPREAD = 40;

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
  // No layout puts one photo across both pages: a face on the fold is lost in the binding.
  const list = [];
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

// ---------- AI layout ideas (unlimited) ----------
// Each page is split by a random tree of side-by-side (H) and stacked (V) cuts. A cut gives each
// side the room its photos need, so portrait photos get tall cells and landscapes wide ones.
// Thousands of trees are tried and the ones that crop the photos least are kept. A new seed gives
// new ideas, so there is no limit. Ids look like  g:H(0,V(1,2))|V(3,4)  and can be rebuilt later.

function rTree(lo, hi, rand) {
  if (hi - lo === 1) return { i: lo };
  const n = hi - lo;
  const mid = lo + n / 2;
  let k = lo + 1 + Math.floor(rand() * (n - 1));
  if (rand() < 0.5) k = Math.max(lo + 1, Math.min(hi - 1, Math.round(mid + (rand() - 0.5))));
  return { d: rand() < 0.5 ? 'H' : 'V', a: rTree(lo, k, rand), b: rTree(k, hi, rand) };
}
function tAspect(t, asp) {
  if (t.i != null) return asp[t.i];
  const a = tAspect(t.a, asp), b = tAspect(t.b, asp);
  return t.d === 'H' ? a + b : 1 / (1 / a + 1 / b);
}
function placeTree(t, x, y, w, h, g, asp, out) {
  if (t.i != null) { out[t.i] = { x, y, w, h }; return; }
  const a = tAspect(t.a, asp), b = tAspect(t.b, asp);
  if (t.d === 'H') {
    const wa = Math.max(0.0001, (w - g) * a / (a + b));
    placeTree(t.a, x, y, wa, h, g, asp, out); placeTree(t.b, x + wa + g, y, w - wa - g, h, g, asp, out);
  } else {
    const ha = Math.max(0.0001, (h - g) * (1 / a) / (1 / a + 1 / b));
    placeTree(t.a, x, y, w, ha, g, asp, out); placeTree(t.b, x, y + ha + g, w, h - ha - g, g, asp, out);
  }
}
const ser = (t) => (t.i != null ? String(t.i) : `${t.d}(${ser(t.a)},${ser(t.b)})`);
function parseTree(str) {
  let p = 0;
  const node = () => {
    if (str[p] === 'H' || str[p] === 'V') {
      const d = str[p]; p += 2; const a = node(); p++; const b = node(); p++;
      return { d, a, b };
    }
    let n = ''; while (p < str.length && /\d/.test(str[p])) n += str[p++];
    return { i: +n };
  };
  return node();
}
function leaves(t, out = []) { if (t.i != null) out.push(t.i); else { leaves(t.a, out); leaves(t.b, out); } return out; }

// page boxes in physical units (spread is A wide, 1 high)
function pageBoxes(size, styleName) {
  const st = STYLES[styleName] || STYLES.Classic;
  const A = sizeInfo(size).aspect, m = st.margin, g = st.gap;
  const half = A / 2;
  if (m === 0) return { A, g, boxes: [{ x: 0, y: 0, w: half - g / 2, h: 1 }, { x: half + g / 2, y: 0, w: half - g / 2, h: 1 }], full: { x: 0, y: 0, w: A, h: 1 } };
  return { A, g, boxes: [{ x: m, y: m, w: half - 2 * m, h: 1 - 2 * m }, { x: half + m, y: m, w: half - 2 * m, h: 1 - 2 * m }], full: { x: m, y: m, w: A - 2 * m, h: 1 - 2 * m } };
}

// Turn a "g:" id into cells for these photos (photos in the order the id refers to).
export function cellsFromGenId(id, photos, size, styleName) {
  const { A, g, boxes, full } = pageBoxes(size, styleName);
  const asp = photos.map((p) => p.width / p.height);
  const parts = id.slice(2).split('|');
  const out = new Array(photos.length);
  const trees = parts.map(parseTree);
  const all = trees.flatMap((t) => leaves(t));
  if (all.length !== photos.length || new Set(all).size !== photos.length || Math.max(...all) >= photos.length) return null;
  const targets = trees.length === 1 ? [full] : boxes;
  trees.forEach((t, k) => { const b = targets[k] || boxes[k % 2]; placeTree(t, b.x, b.y, b.w, b.h, g, asp, out); });
  return out.map((c) => ({ x: c.x / A, y: c.y, w: c.w / A, h: c.h }));
}

function layoutCost(cells, photos, A) {
  let cost = 0;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const ca = (c.w * A) / c.h;
    cost += cropLoss(photos[i].width / photos[i].height, ca);
    if (ca > 4.2 || ca < 0.24) cost += 0.6;          // ribbon-thin cells look bad
    if (c.w * A * c.h < 0.012) cost += 0.4;           // tiny cells
  }
  return cost / cells.length;
}

/**
 * Generated layout ideas for these photos (kept in time order).
 * opts: { seed, n (how many to return), tries }
 */
export function generateIdeas(photos, size, styleName = 'Classic', opts = {}) {
  const n = photos.length;
  if (!n) return [];
  const rand = rng((opts.seed || 1) * 7919 + n * 31);
  const A = sizeInfo(size).aspect;
  const want = opts.n || 12;
  const tries = opts.tries || Math.min(900, 120 + n * 60);
  const seen = new Map();
  for (let t = 0; t < tries; t++) {
    let id;
    if (n === 1) return [];              // one photo: the designer layouts below handle it (never across the fold)
    {
      const mid = n / 2;
      let k = Math.round(mid + (rand() - 0.5) * Math.min(4, n));
      k = Math.max(1, Math.min(n - 1, k));
      id = 'g:' + ser(rTree(0, k, rand)) + '|' + ser(rTree(k, n, rand));
    }
    if (seen.has(id)) continue;
    const cells = cellsFromGenId(id, photos, size, styleName);
    if (!cells) continue;
    seen.set(id, { tpl: { id, name: 'Idea', gen: true, count: n }, cells, order: photos, cost: layoutCost(cells, photos, A) });
  }
  return [...seen.values()].sort((a, b) => a.cost - b.cost).slice(0, want);
}


// ---------- Designer layouts (uncommon looks) ----------
// Each page gets its own design: a photo island that keeps the photos' own shapes and floats in
// white space (anchored to a corner, an edge or the centre, at different sizes), a full-bleed page,
// or an empty page left for a title. Nothing ever crosses the fold.
// Id:  c:<left>~<right>   page = "-" (empty) | "<pos><scale>/<tree>"   e.g.  c:f/0~t68/H(1,2)
//   pos: f = full bleed page, F = full page inside the margin, c t b l r tl tr bl br = island anchor
const POS = ['c', 't', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br'];
const SCALES = [70, 78, 86, 94, 100];

function pageSpec(str) {
  if (str === '-') return null;
  const [head, tree] = str.split('/');
  const m = /^([a-zA-Z]+)(\d*)$/.exec(head);
  if (!m || !tree) return undefined;
  return { pos: m[1], scale: m[2] ? +m[2] / 100 : 1, tree: parseTree(tree) };
}

export function cellsFromCreativeId(id, photos, size, styleName) {
  const st = STYLES[styleName] || STYLES.Classic;
  const A = sizeInfo(size).aspect, half = A / 2;
  const g = Math.max(st.gap, 0.012);
  const asp = photos.map((p) => p.width / p.height);
  const parts = id.slice(2).split('~');
  if (parts.length !== 2) return null;
  const specs = parts.map(pageSpec);
  if (specs.some((x) => x === undefined)) return null;
  const all = specs.flatMap((sp) => (sp ? leaves(sp.tree) : []));
  if (all.length !== photos.length || new Set(all).size !== photos.length || Math.max(...all) >= photos.length) return null;
  const out = new Array(photos.length);
  specs.forEach((sp, k) => {
    if (!sp) return;
    const x0 = k * half;
    if (sp.pos === 'f') { placeTree(sp.tree, x0 + (k ? g / 2 : 0), 0, half - g / 2, 1, g, asp, out); return; }
    const fm = Math.max(st.margin, 0.05);
    if (sp.pos === 'F') { placeTree(sp.tree, x0 + fm, fm, half - 2 * fm, 1 - 2 * fm, g, asp, out); return; }
    const pm = Math.max(st.margin * 1.4, 0.08);
    const ax = x0 + pm, ay = pm, aw = half - 2 * pm, ah = 1 - 2 * pm;
    const bw = aw * sp.scale, bh = ah * sp.scale;
    const a = tAspect(sp.tree, asp);
    let w = bw, h = bw / a;
    if (h > bh) { h = bh; w = bh * a; }
    const p = sp.pos;
    const x = p.includes('l') ? ax : p.includes('r') ? ax + aw - w : ax + (aw - w) / 2;
    const y = p.includes('t') ? ay : p.includes('b') ? ay + ah - h : ay + (ah - h) / 2;
    placeTree(sp.tree, x, y, w, h, g, asp, out);
  });
  return out.map((c) => ({ x: c.x / A, y: c.y, w: c.w / A, h: c.h }));
}

const lookOf = (id) => id.slice(2).split('~').map((x) => (x === '-' ? '-' : x.split('/')[0].replace(/\d+/, ''))).join('~');

function randomPage(lo, hi, rand) {
  const n = hi - lo;
  const r = rand();
  const tree = ser(rTree(lo, hi, rand));
  if (n <= 3 && r < 0.22) return 'f/' + tree;
  if (n <= 6 && r < 0.32) return 'F/' + tree;
  const pos = POS[Math.floor(rand() * POS.length)];
  const scale = n >= 3 ? SCALES[2 + Math.floor(rand() * 3)] : SCALES[Math.floor(rand() * SCALES.length)];
  return pos + scale + '/' + tree;
}

export function creativeIdeas(photos, size, styleName = 'Classic', opts = {}) {
  const n = photos.length;
  if (!n || n > 16) return [];
  const rand = rng((opts.seed || 1) * 6151 + n * 17);
  const A = sizeInfo(size).aspect;
  const want = opts.n || 8;
  const tries = opts.tries || Math.min(1500, 200 + n * 80);
  const best = new Map();              // best idea for each look, so the list stays varied
  for (let t = 0; t < tries; t++) {
    let k;
    if (n === 1) k = rand() < 0.5 ? 0 : 1;
    else if (n === 2 && rand() < 0.2) k = rand() < 0.5 ? 0 : n;      // one page left empty (white space)
    else k = Math.max(1, Math.min(n - 1, Math.round(n / 2 + (rand() - 0.5) * Math.min(4, n))));
    const L = k === 0 ? '-' : randomPage(0, k, rand);
    const R = k === n ? '-' : randomPage(k, n, rand);
    if (/^f/.test(L) && /^f/.test(R)) continue;                       // two bleed pages is a plain grid
    const id = 'c:' + L + '~' + R;
    const cells = cellsFromCreativeId(id, photos, size, styleName);
    if (!cells) continue;
    let cost = layoutCost(cells, photos, A);
    const cover = cells.reduce((s, c) => s + c.w * c.h, 0);
    if (n >= 2) cost += Math.max(0, 0.42 - cover) * 0.7;               // too much empty paper for the photo count
    if (n === 1 && cover < 0.12) cost += 0.2;
    const look = lookOf(id);
    const prev = best.get(look);
    if (!prev || cost < prev.cost) best.set(look, { tpl: { id, name: 'Designer', creative: true, look, count: n }, cells, order: photos, cost });
  }
  const list = [...best.values()].sort((a, b) => a.cost - b.cost);
  // shuffle a little among good ones so each request gives a fresh mix
  if (opts.random) list.sort((a, b) => (a.cost + opts.random() * 0.08) - (b.cost + opts.random() * 0.08));
  return list.slice(0, want);
}

// Opening spread of a part: the best photo on a full page, the rest (if any) as a small island
// at the top of the other page so the title has room underneath.
export function heroPick(group, hero, size, styleName, random = Math.random) {
  const sorted = [...group].sort((a, b) => a.takenAt - b.takenAt);
  const hi = sorted.indexOf(hero);
  const rest = sorted.map((_, i) => i).filter((i) => i !== hi);
  const heroPage = (random() < 0.6 ? 'f' : 'F') + '/' + hi;
  const other = rest.length ? (random() < 0.5 ? 't' : 'tl') + '72/' + (rest.length === 1 ? rest[0] : rest.length === 2 ? `H(${rest[0]},${rest[1]})` : `H(${rest[0]},V(${rest[1]},${rest[2]}))`) : '-';
  const id = 'c:' + heroPage + '~' + other;
  const cells = cellsFromCreativeId(id, sorted, size, styleName);
  if (!cells) return null;
  return { tpl: { id, name: 'Opening', creative: true, look: lookOf(id), count: group.length }, cells, order: sorted, cost: 0 };
}

// ---------- magazine designs (colour blocks, frames, circles, title text) ----------
export function designPick(d, photos, size, opts = {}) {
  if (!d || d.n !== photos.length) return null;
  const info = sizeInfo(size);
  const col = designColours(opts.hero || photos[0]);
  const built = d.build(info.pageAspect, col);
  const cells = built.cells.map((c) => ({ ...c }));
  let order, cost;
  if (opts.hero && photos.includes(opts.hero) && photos.length > 1) {
    // the hero photo takes the biggest frame, the rest are matched by shape
    const big = cells.reduce((b, c, i) => (c.w * c.h > cells[b].w * cells[b].h ? i : b), 0);
    const restIdx = cells.map((_, i) => i).filter((i) => i !== big);
    const a = assignPhotos(restIdx.map((i) => cells[i]), photos.filter((p) => p !== opts.hero), info.aspect);
    order = new Array(cells.length);
    order[big] = opts.hero;
    restIdx.forEach((ci, k) => { order[ci] = a.order[k]; });
    cost = a.cost;
  } else ({ order, cost } = assignPhotos(cells, photos, info.aspect));
  const texts = built.texts.map((t) => ({ ...t, id: uid(), text: fillTokens(t.text, opts.info) })).filter((t) => t.text.trim());
  return { tpl: { id: 'd:' + d.id, name: d.name, design: true, look: 'd:' + d.id, count: d.n }, cells, order, cost, shapes: built.shapes.map((x) => ({ ...x })), texts };
}
export const designsFor = (n, opening) => DESIGNS.filter((d) => d.n === n && (opening == null || !!d.opening === opening));

// ---------- user templates ("My templates") ----------
// { id: 'u:…', name, count, cells:[{x,y,w,h}] } – cells as fractions of the spread, any album size.
export function userTemplatePick(t, photos, size) {
  if (!t || t.count !== photos.length) return null;
  const { order, cost } = assignPhotos(t.cells, photos, sizeInfo(size).aspect);
  return { tpl: { id: t.id, name: t.name, user: true, count: t.count }, cells: t.cells.map((c) => ({ ...c })), order, cost };
}

// Best layout for a group of photos: built-in templates, AI ideas and the user's own templates.
export function bestTemplate(photos, size, styleName, opts = {}) {
  const { aspect } = sizeInfo(size);
  const n = photos.length;
  const avoid = new Set(opts.avoid || []);
  const jitter = () => (opts.random ? opts.random() * 0.05 : 0);
  let best = null;
  const consider = (pick, bonus = 0) => {
    if (!pick) return;
    let score = pick.cost + bonus + jitter();
    if (avoid.has(pick.tpl.look || pick.tpl.id)) score += 0.12;
    if (!best || score < best.score) best = { ...pick, score };
  };
  for (const t of TEMPLATES) {
    if (t.count !== n) continue;
    if (t.full && !opts.allowFull) continue;
    if (styleName === 'Minimal' && !t.full && !/center|full|cols2|rows2/.test(t.id)) continue;
    const cells = templateCells(t, size, styleName);
    const { order, cost } = assignPhotos(cells, photos, aspect);
    consider({ tpl: t, cells, order, cost });
  }
  if (!opts.noGen && (n > 1 || !best)) {
    const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt);
    const ideas = generateIdeas(sorted, size, styleName, { seed: opts.random ? Math.floor(opts.random() * 1e6) : 1, n: 3, tries: Math.min(400, 80 + n * 30) });
    // built-in templates are tried first for small counts; ideas win when they crop clearly less
    for (const idea of ideas) consider(idea, n <= 8 ? 0.03 : 0);
  }
  if (!opts.noGen) {
    const seed = opts.random ? Math.floor(opts.random() * 1e6) : 1;
    // designer looks get a head start so albums are never just grids
    for (const idea of creativeIdeas([...photos].sort((a, b) => a.takenAt - b.takenAt), size, styleName, { seed, n: 6, tries: Math.min(700, 120 + n * 50), random: opts.random })) consider(idea, -0.06);
  }
  if (!opts.noGen) for (const d of designsFor(n, false)) consider(designPick(d, photos, size, { info: opts.info }), -0.1);
  for (const u of opts.userTemplates || []) consider(userTemplatePick(u, photos, size), -0.3);    // the photographer's own saved designs come first
  return best;
}

export function layoutIdeasFor(photos, size, styleName, page, userTemplates, info) {
  // page 0, 1, 2 … : every page shows the next 16 best ideas, so "Show new ideas" never runs dry
  const n = photos.length;
  const per = 16;
  const aspect = sizeInfo(size).aspect;
  const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt);
  const builtin = page === 0 ? TEMPLATES.filter((t) => t.count === n).map((t) => {
    const cells = templateCells(t, size, styleName);
    const { order, cost } = assignPhotos(cells, photos, aspect);
    return { tpl: t, cells, order, cost };
  }).sort((a, b) => a.cost - b.cost).slice(0, 4) : [];
  const want = (page + 1) * per;
  const pool = generateIdeas(sorted, size, styleName, { seed: 1 + Math.floor(page / 6), n: want, tries: Math.min(6000, 300 + want * 30) });
  let ideas = pool.slice(page * per, page * per + per - builtin.length);
  if (!ideas.length && pool.length) ideas = generateIdeas(sorted, size, styleName, { seed: page + 7, n: per }); // few photos: fewer shapes exist
  const mine = (userTemplates || []).map((u) => userTemplatePick(u, photos, size)).filter(Boolean);
  const grid = builtin.concat(ideas).sort((a, b) => a.cost - b.cost);
  const designer = creativeIdeas(sorted, size, styleName, { seed: page + 1, n: 10, tries: 1200, random: rng(page * 13 + 5) });
  const mixed = [];
  for (let i = 0; mixed.length < per && (i < designer.length || i < grid.length); i++) {
    if (designer[i]) mixed.push(designer[i]);
    if (grid[i] && mixed.length < per) mixed.push(grid[i]);
  }
  const designs = page === 0 ? designsFor(n).map((d) => designPick(d, photos, size, { info })).filter(Boolean) : [];
  return { ideas: designs.concat(mixed).slice(0, per + designs.length), mine };
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
    texts: (extra.texts || []).filter((t) => !t.d).concat(tplPick.texts || []),
    shapes: tplPick.shapes || [],
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
  return Math.max(1, Math.min(300, Math.round(count / avg)));
}

// Counts that use every photo: spread evenly, between 1 and 8 per spread.
function evenCounts(spreads, photos) {
  const base = Math.floor(photos / spreads), extra = photos % spreads;
  return Array.from({ length: spreads }, (_, i) => Math.min(MAX_PER_SPREAD, base + (i < extra ? 1 : 0)));
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

  const total = Math.max(1, Math.min(opts.spreads || 30, 500));
  const alloc = allocate(total, events.map((e) => e.photos.length));
  const spreads = [];
  const reuseWindow = opts.reuse === 'Low' ? 8 : opts.reuse === 'High' ? 0 : 2;
  const recent = [];

  events.forEach((ev, ei) => {
    const n = alloc[ei];
    if (!n) return;
    const lim = Math.max(1, Math.min(MAX_PER_SPREAD, opts.maxPer || MAX_PER_SPREAD));
    const counts = (opts.useEvery ? evenCounts(n, ev.photos.length)
      : opts.range ? rangeCounts(n, ev.photos.length, opts.range[0], opts.range[1], random)
      : countsFor(n, ev.photos.length, st.avg, random)).map((c) => Math.min(c, lim));
    let heroIdx = -1, opening = null;
    if (opts.hero !== false && n >= 2 && !opts.useEvery) {
      counts[0] = Math.min(3, ev.photos.length);
      if (opts.text) {
        const ok = DESIGNS.filter((d) => d.opening && d.n <= ev.photos.length && d.n <= Math.min(lim, Math.max(3, counts[0] + 2)));
        opening = ok.length ? ok[Math.floor(random() * ok.length)] : null;
        if (opening) counts[0] = opening.n;
      }
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
      let group, forced = null;
      if (s === 0 && hero) group = [hero, ...chosen.splice(0, counts[0] - 1)];
      else {
        // about one spread in three becomes a magazine design (colour blocks, frames, circles)
        let take = counts[s];
        if (!opts.useEvery && !opts.range && s > 0 && random() < 0.36) {
          const later = counts.slice(s + 1).reduce((a, b) => a + b, 0);
          const ok = DESIGNS.filter((d) => !d.opening && d.n <= lim && Math.abs(d.n - take) <= 2 && chosen.length - d.n >= later && !recent.slice(-4).includes('d:' + d.id));
          if (ok.length) { const d = ok[Math.floor(random() * ok.length)]; take = d.n; forced = d; }
        }
        group = chosen.splice(0, take);
      }
      if (!group.length) break;
      const title = (opts.titles && opts.titles[ev.name]) || ev.name;
      const info = { title, couple: opts.couple, date: opts.date };
      let pick = s === 0 && hero && opening && group.length === opening.n ? designPick(opening, group, opts.size, { hero, info }) : null;
      if (!pick && forced) pick = designPick(forced, group, opts.size, { info });
      if (!pick && s === 0 && hero) pick = heroPick(group, hero, opts.size, style, random);
      if (!pick) pick = bestTemplate(group, opts.size, style, { avoid: recent.slice(-Math.max(reuseWindow, 3)), random, userTemplates: opts.userTemplates, info });
      if (!pick) pick = bestTemplate(group, opts.size, 'Classic', { allowFull: true });
      if (!pick) pick = bestTemplate(group.slice(0, 1), opts.size, style, { allowFull: true });
      recent.push(pick.tpl.look || pick.tpl.id);
      const texts = [];
      if (s === 0 && opts.text && !(pick.texts && pick.texts.length)) {
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

// Re-layout one spread with a chosen layout (built-in, AI idea "g:…" or user "u:…"), keeping its photos.
export function applyTemplate(spread, tplId, photosById, size, style, userTemplates, info) {
  const photos = spread.cells.map((c) => photosById.get(c.photoId)).filter(Boolean);
  const pick = pickForId(tplId, photos, size, style, userTemplates, { ...(info || {}), title: (info && info.title) || spread.section });
  if (!pick) return spread;
  return { ...spread, layoutId: tplId, shapes: pick.shapes || [], texts: (spread.texts || []).filter((t) => !t.d).concat(pick.texts || []), cells: pick.cells.map((c, i) => ({ ...c, photoId: pick.order[i].id, ...focalFor(pick.order[i]), zoom: 1 })) };
}

export function pickForId(tplId, photos, size, style, userTemplates, info) {
  if (!tplId) return null;
  if (tplId.startsWith('d:')) return designPick(DESIGNS.find((d) => 'd:' + d.id === tplId), photos, size, { info });
  if (tplId.startsWith('g:')) {
    const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt);
    const cells = cellsFromGenId(tplId, sorted, size, style);
    return cells ? { tpl: { id: tplId }, cells, order: sorted } : null;
  }
  if (tplId.startsWith('c:')) {
    const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt);
    const cells = cellsFromCreativeId(tplId, sorted, size, style);
    return cells ? { tpl: { id: tplId, creative: true, look: lookOf(tplId) }, cells, order: sorted } : null;
  }
  if (tplId.startsWith('u:')) return userTemplatePick((userTemplates || []).find((u) => u.id === tplId), photos, size);
  const tpl = TEMPLATES.find((t) => t.id === tplId);
  if (!tpl || tpl.count !== photos.length) return null;
  const cells = templateCells(tpl, size, style);
  const { order } = assignPhotos(cells, photos, sizeInfo(size).aspect);
  return { tpl, cells, order };
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
