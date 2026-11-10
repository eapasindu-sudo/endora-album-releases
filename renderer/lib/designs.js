// Endora Album – magazine-style spread designs (photos + colour blocks + frames + title text).
// Pure data/functions, no DOM. Each design is drawn in PAGE coordinates (0..1 of one page, page 0 =
// left, 1 = right) and turned into spread fractions here, so nothing is ever placed across the fold
// by accident. `pa` = page width / page height, used to keep circles round and portraits upright.
// Text may hold tokens {title} {TITLE} {couple} {COUPLE} {date} {initial}, filled in when the spread is made.

const cellP = (p, x, y, w, h, extra = {}) => ({ x: (p + x) / 2, y, w: w / 2, h, ...extra });
const shapeP = (p, x, y, w, h, s) => ({ x: (p + x) / 2, y, w: w / 2, h, ...s });
const textP = (p, x, y, w, text, size, o = {}) => ({ x: (p + x) / 2, y, w: w / 2, text, size, font: 'serif', align: 'center', color: '#2E2622', ...o, d: true });

const WHITE = '#FFFFFF';

export const DESIGNS = [
  // ---------- openings (with title text) ----------
  { id: 'cover4', name: 'Wedding cover', n: 4, opening: true, build: (pa, c) => ({
    cells: [cellP(0, 0, 0, 1, 1),
      cellP(1, 0.08, 0.29, 0.27, 0.42), cellP(1, 0.365, 0.26, 0.27, 0.42), cellP(1, 0.65, 0.23, 0.27, 0.42)],
    shapes: [],
    texts: [textP(1, 0.1, 0.1, 0.8, '{TITLE}', 0.075, { bold: true }),
      textP(1, 0.1, 0.74, 0.8, '{COUPLE}', 0.048), textP(1, 0.1, 0.82, 0.8, '{date}', 0.026, { font: 'sans' })]
  }) },
  { id: 'cover3', name: 'Name page + trio', n: 3, opening: true, build: (pa, c) => ({
    cells: [cellP(1, 0.08, 0.29, 0.27, 0.42), cellP(1, 0.365, 0.26, 0.27, 0.42), cellP(1, 0.65, 0.23, 0.27, 0.42)],
    shapes: [shapeP(0, 0, 0, 1, 1, { fill: c.soft })],
    texts: [textP(0, 0.1, 0.36, 0.8, '{couple}', 0.1, { font: 'script' }), textP(0, 0.1, 0.56, 0.8, '{date}', 0.028, { font: 'sans' }),
      textP(1, 0.1, 0.1, 0.8, '{TITLE}', 0.07, { bold: true })]
  }) },
  { id: 'day2', name: 'Wedding day', n: 2, opening: true, build: (pa) => ({
    cells: [cellP(0, 0.5 - 0.3, 0.24, 0.6, 0.58), cellP(1, 0, 0, 1, 1)],
    shapes: [],
    texts: [textP(0, 0.1, 0.08, 0.8, '{TITLE}', 0.075), textP(0, 0.1, 0.87, 0.8, '{date}', 0.028)]
  }) },
  { id: 'monogram3', name: 'Monogram card', n: 3, opening: true, build: () => ({
    cells: [cellP(0, 0, 0, 1, 1), cellP(1, 0.06, 0.08, 0.44, 0.84), cellP(1, 0.51, 0.08, 0.43, 0.84)],
    shapes: [shapeP(1, 0.37, 0.3, 0.26, 0.48, { fill: WHITE, front: true })],
    texts: [textP(1, 0.37, 0.35, 0.26, '{initial}', 0.15), textP(1, 0.37, 0.6, 0.26, '{COUPLE}', 0.022, { font: 'sans' }),
      textP(1, 0.37, 0.67, 0.26, '{date}', 0.02, { font: 'sans' })]
  }) },
  { id: 'framed2', name: 'Line frame', n: 2, opening: true, build: (pa, c) => {
    const h = 0.6, w = (h * 0.75) / pa, x = 0.5 - w / 2;
    const ox = 0.035 / pa;
    return {
      cells: [cellP(0, x, 0.12, w, h), cellP(1, 0, 0, 1, 1)],
      shapes: [shapeP(0, 0, 0, 1, 1, { fill: c.deep }),
        shapeP(0, x - ox, 0.12 - 0.035, w + 2 * ox, h + 0.11, { stroke: '#F4ECE6', lw: 0.0025, front: true })],
      texts: [textP(0, 0.1, 0.745, 0.8, '{couple}', 0.07, { font: 'script', color: WHITE }),
        textP(0, 0.1, 0.87, 0.8, '{DATE}', 0.022, { font: 'sans', color: WHITE })]
    };
  } },
  { id: 'magazine3', name: 'Magazine cover', n: 3, opening: true, build: () => ({
    cells: [cellP(0, 0, 0, 1, 1), cellP(1, 0.08, 0.08, 0.84, 0.41), cellP(1, 0.08, 0.51, 0.84, 0.41)],
    shapes: [shapeP(0, 0.07, 0.3, 0.004, 0.36, { fill: WHITE, front: true })],
    texts: [textP(0, 0.07, 0.07, 0.6, 'SPECIAL EDITION', 0.022, { font: 'sans', bold: true, align: 'left', color: WHITE, shadow: true }),
      textP(0, 0.06, 0.1, 0.9, '{TITLE}', 0.14, { align: 'left', color: WHITE, shadow: true }),
      textP(0, 0.1, 0.7, 0.5, '{COUPLE}', 0.032, { font: 'sans', align: 'left', color: WHITE, shadow: true }),
      textP(0, 0.1, 0.76, 0.5, '{date}', 0.024, { font: 'sans', align: 'left', color: WHITE, shadow: true })]
  }) },
  { id: 'titlebleed1', name: 'Title page + photo', n: 1, opening: true, build: (pa, c) => ({
    cells: [cellP(1, 0.1, 0.1, 0.9, 0.9)],
    shapes: [shapeP(1, 0.1, 0.035, 0.5, 0.04, { fill: c.grey }), shapeP(0, 0.16, 0.47, 0.18, 0.003, { fill: '#2E2622' })],
    texts: [textP(0, 0.16, 0.3, 0.72, '{TITLE}', 0.08, { align: 'left' }),
      textP(0, 0.16, 0.52, 0.72, '{couple}', 0.05, { align: 'left' }), textP(0, 0.16, 0.62, 0.72, '{date}', 0.026, { font: 'sans', align: 'left' })]
  }) },
  { id: 'colourpage2', name: 'Colour page', n: 2, opening: true, build: (pa, c) => ({
    cells: [cellP(1, 0.08, 0.07, 0.76, 0.42), cellP(1, 0.08, 0.51, 0.76, 0.42)],
    shapes: [shapeP(0, 0, 0, 1, 1, { fill: c.deep }), shapeP(1, 0.9, 0, 0.1, 1, { fill: c.deep })],
    texts: [textP(0, 0.1, 0.68, 0.8, '{TITLE}', 0.08, { align: 'left', color: WHITE }),
      textP(0, 0.1, 0.8, 0.8, '{couple}', 0.055, { font: 'script', align: 'left', color: WHITE })]
  }) },
  { id: 'bands5', name: 'Colour bands', n: 5, opening: true, build: (pa, c) => ({
    cells: [cellP(0, 0.06, 0.14, 0.88, 0.4), cellP(0, 0.06, 0.56, 0.435, 0.3), cellP(0, 0.505, 0.56, 0.435, 0.3),
      cellP(1, 0.08, 0.08, 0.55, 0.4), cellP(1, 0, 0.58, 1, 0.42)],
    shapes: [shapeP(0, 0, 0, 1, 0.09, { fill: c.soft }), shapeP(0, 0, 0.91, 1, 0.09, { fill: c.soft }), shapeP(1, 0, 0, 1, 0.56, { fill: c.soft })],
    texts: [textP(1, 0.66, 0.2, 0.3, '{couple}', 0.05, { font: 'script' }), textP(1, 0.66, 0.33, 0.3, '{TITLE}', 0.024, { font: 'sans' })]
  }) },

  // ---------- body designs ----------
  { id: 'block8', name: 'Grey block', n: 8, build: (pa, c) => ({
    cells: [cellP(0, 0.06, 0.07, 0.88, 0.36),
      cellP(0, 0.1, 0.53, 0.27, 0.2), cellP(0, 0.39, 0.53, 0.27, 0.2), cellP(0, 0.1, 0.75, 0.27, 0.2), cellP(0, 0.39, 0.75, 0.27, 0.2),
      cellP(1, 0.1, 0.07, 0.76, 0.27), cellP(1, 0.1, 0.365, 0.76, 0.27), cellP(1, 0.1, 0.66, 0.76, 0.27)],
    shapes: [shapeP(0, 0, 0.48, 0.72, 0.52, { fill: c.grey }), shapeP(1, 0.9, 0.22, 0.1, 0.56, { fill: c.grey })],
    texts: []
  }) },
  { id: 'circle5', name: 'Circle', n: 5, build: (pa, c) => {
    const d = 0.4;
    return {
      cells: [cellP(0, 0, 0, 1, 0.76), cellP(0, 0.07, 0.52, d / pa, d, { round: 'circle', border: { w: 0.012, color: WHITE } }),
        cellP(1, 0.15, 0.17, 0.32, 0.6), cellP(1, 0.56, 0.1, 0.36, 0.38), cellP(1, 0.56, 0.52, 0.36, 0.38)],
      shapes: [shapeP(1, 0.1, 0.1, 0.42, 0.74, { fill: c.soft })],
      texts: []
    };
  } },
  { id: 'overlap3', name: 'Overlap', n: 3, build: (pa, c) => ({
    cells: [cellP(0, 0.06, 0.07, 0.62, 0.86), cellP(1, 0.22, 0, 0.78, 0.55), cellP(1, 0.1, 0.42, 0.55, 0.5, { border: { w: 0.014, color: WHITE } })],
    shapes: [shapeP(0, 0.72, 0.55, 0.28, 0.3, { fill: c.grey }), shapeP(1, 0, 0.52, 0.16, 0.22, { fill: c.grey })],
    texts: []
  }) },
  { id: 'stagger6', name: 'Staggered trio', n: 6, build: () => ({
    cells: [0, 1].flatMap((p) => [cellP(p, 0.08, 0.3, 0.26, 0.4), cellP(p, 0.37, 0.2, 0.26, 0.6), cellP(p, 0.66, 0.3, 0.26, 0.4)]),
    shapes: [], texts: []
  }) },
  { id: 'cluster6', name: 'Cluster', n: 6, build: () => ({
    cells: [cellP(0, 0.3, 0.27, 0.4, 0.44), cellP(0, 0.36, 0.06, 0.24, 0.19), cellP(0, 0.4, 0.73, 0.24, 0.19),
      cellP(0, 0.09, 0.36, 0.19, 0.25), cellP(0, 0.72, 0.4, 0.19, 0.25), cellP(1, 0.14, 0.12, 0.72, 0.76)],
    shapes: [shapeP(1, 0.1, 0.07, 0.8, 0.86, { stroke: '#B9AEA6', lw: 0.002 })],
    texts: []
  }) },
  { id: 'column8', name: 'Centre column', n: 8, build: () => ({
    cells: [cellP(0, 0, 0, 1, 1),
      cellP(1, 0.06, 0.07, 0.2, 0.27), cellP(1, 0.06, 0.365, 0.2, 0.27), cellP(1, 0.06, 0.66, 0.2, 0.27),
      cellP(1, 0.28, 0.07, 0.44, 0.86),
      cellP(1, 0.74, 0.07, 0.2, 0.27), cellP(1, 0.74, 0.365, 0.2, 0.27), cellP(1, 0.74, 0.66, 0.2, 0.27)],
    shapes: [], texts: []
  }) },
  { id: 'quote2', name: 'Quote page', n: 2, build: () => ({
    cells: [cellP(1, 0.07, 0.1, 0.42, 0.8), cellP(1, 0.51, 0.1, 0.42, 0.8)],
    shapes: [shapeP(0, 0.44, 0.34, 0.12, 0.003, { fill: '#2E2622' }), shapeP(0, 0.44, 0.64, 0.12, 0.003, { fill: '#2E2622' })],
    texts: [textP(0, 0.18, 0.4, 0.64, 'Every love story is beautiful, but ours is my favourite.', 0.042, { italic: true })]
  }) },
  { id: 'film6', name: 'Film strip', n: 6, build: () => ({
    cells: [0, 1].flatMap((p) => [cellP(p, 0.06, 0.3, 0.28, 0.4), cellP(p, 0.36, 0.3, 0.28, 0.4), cellP(p, 0.66, 0.3, 0.28, 0.4)]),
    shapes: [0, 1].flatMap((p) => [shapeP(p, 0.06, 0.25, 0.88, 0.003, { fill: '#2E2622' }), shapeP(p, 0.06, 0.747, 0.88, 0.003, { fill: '#2E2622' })]),
    texts: []
  }) },
  { id: 'offset2', name: 'Offset blocks', n: 2, build: (pa, c) => ({
    cells: [cellP(0, 0.16, 0.12, 0.52, 0.66), cellP(1, 0.32, 0.12, 0.52, 0.66)],
    shapes: [shapeP(0, 0.24, 0.22, 0.52, 0.66, { fill: c.soft }), shapeP(1, 0.24, 0.22, 0.52, 0.66, { fill: c.soft })],
    texts: []
  }) },
  { id: 'magazine6', name: 'Magazine grid', n: 6, build: (pa, c) => ({
    cells: [cellP(0, 0.06, 0.07, 0.3, 0.42), cellP(0, 0.38, 0.07, 0.56, 0.42), cellP(0, 0.06, 0.51, 0.44, 0.42),
      cellP(0, 0.52, 0.51, 0.2, 0.2), cellP(0, 0.52, 0.73, 0.2, 0.2), cellP(1, 0.06, 0.07, 0.88, 0.86)],
    shapes: [shapeP(0, 0.74, 0.51, 0.2, 0.42, { fill: c.grey })],
    texts: [textP(0, 0.75, 0.62, 0.18, 'Feel the love', 0.03, { italic: true })]
  }) }
];

export function designColours(photo) {
  const hex = photo && photo.avgColor;
  const mix = (h, t, a) => {
    const n = parseInt(h.slice(1), 16), m = parseInt(t.slice(1), 16);
    const ch = (s) => Math.round(((n >> s) & 255) * (1 - a) + ((m >> s) & 255) * a);
    return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('').toUpperCase();
  };
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return { soft: '#EFE6DF', deep: '#7E5F52', grey: '#E7E5E2' };
  return { soft: mix(hex, '#FFFFFF', 0.8), deep: mix(hex, '#2A211D', 0.35), grey: '#E7E5E2' };
}

export function fillTokens(text, info = {}) {
  const title = info.title || 'Wedding';
  const couple = info.couple || 'Your names';
  return String(text)
    .replace(/\{TITLE\}/g, title.toUpperCase()).replace(/\{title\}/g, title)
    .replace(/\{COUPLE\}/g, couple.toUpperCase()).replace(/\{couple\}/g, couple)
    .replace(/\{DATE\}/g, (info.date || '').toUpperCase()).replace(/\{date\}/g, info.date || '')
    .replace(/\{initial\}/g, (couple.trim()[0] || 'E').toUpperCase());
}
