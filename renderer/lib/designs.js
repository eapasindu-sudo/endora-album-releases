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
  }) },
  // ---------- set 2 (from the second batch of references) ----------
  { id: 'arch5', name: 'Arch', n: 5, opening: true, build: (pa, c) => ({
    cells: [cellP(0, 0.08, 0.08, 0.38, 0.84, { round: 'arch' }), cellP(0, 0.5, 0.08, 0.42, 0.41), cellP(0, 0.5, 0.51, 0.42, 0.41),
      cellP(1, 0.08, 0.08, 0.4, 0.84), cellP(1, 0.56, 0.56, 0.36, 0.36)],
    shapes: [],
    texts: [textP(1, 0.54, 0.12, 0.4, 'The Wedding of', 0.06, { font: 'script' }), textP(1, 0.54, 0.27, 0.4, '{COUPLE}', 0.03),
      textP(1, 0.54, 0.35, 0.4, '{date}', 0.022, { font: 'sans' })]
  }) },
  { id: 'chapter1', name: 'Chapter title', n: 1, opening: true, build: () => ({
    cells: [cellP(1, 0, 0, 1, 1)],
    shapes: [shapeP(0, 0.1, 0.56, 0.1, 0.004, { fill: '#2E2622' })],
    texts: [textP(0, 0.1, 0.38, 0.85, '{TITLE}', 0.1, { font: 'sans', bold: true, align: 'left' }),
      textP(0, 0.1, 0.6, 0.6, '{couple} · {date}', 0.024, { font: 'sans', align: 'left' })]
  }) },
  { id: 'ghost3', name: 'Faded background', n: 3, opening: true, build: () => ({
    cells: [cellP(1, 0, 0, 1, 1), cellP(0, 0, 0, 1, 1, { fade: 0.22 }), cellP(0, 0.1, 0.16, 0.3, 0.66, { border: { w: 0.01, color: '#FFFFFF' } })],
    shapes: [],
    texts: [textP(0, 0.46, 0.34, 0.46, '{couple}', 0.06, { font: 'script' }), textP(0, 0.46, 0.5, 0.46, 'are married!', 0.075, { font: 'script' }),
      textP(0, 0.46, 0.66, 0.46, '{DATE}', 0.022, { font: 'sans' })]
  }) },
  { id: 'outline3', name: 'Outline pair', n: 3, build: () => ({
    cells: [cellP(0, 0, 0, 1, 1), cellP(1, 0.12, 0.16, 0.38, 0.68), cellP(1, 0.5, 0.16, 0.38, 0.68)],
    shapes: [shapeP(1, 0.09, 0.12, 0.82, 0.76, { stroke: '#9C918A', lw: 0.002 })],
    texts: []
  }) },
  { id: 'initials1', name: 'Initials cover', n: 1, opening: true, build: () => ({
    cells: [cellP(1, 0, 0, 1, 1)],
    shapes: [shapeP(0, 0.44, 0.58, 0.12, 0.003, { fill: '#2E2622' })],
    texts: [textP(0, 0.1, 0.3, 0.8, '{initials}', 0.14), textP(0, 0.1, 0.63, 0.8, '{COUPLE}', 0.026, { font: 'sans' }),
      textP(0, 0.1, 0.69, 0.8, '{date}', 0.022, { font: 'sans' })]
  }) },
  { id: 'lifepics2', name: 'Life in pictures', n: 2, opening: true, build: () => ({
    cells: [cellP(0, 0, 0.42, 1, 0.58), cellP(1, 0.3, 0.26, 0.4, 0.34)],
    shapes: [shapeP(0, 0.25, 0.33, 0.5, 0.002, { fill: '#2E2622' })],
    texts: [textP(0, 0.1, 0.1, 0.8, '{TITLE}', 0.065), textP(0, 0.1, 0.22, 0.8, '{COUPLE}', 0.022, { font: 'sans' }),
      textP(1, 0.25, 0.65, 0.5, 'A perfectly told love story, framed in love.', 0.026)]
  }) },
  { id: 'bliss1', name: 'Wedding bliss', n: 1, opening: true, build: (pa, c) => ({
    cells: [cellP(0, 0.2, 0.25, 0.6, 0.5)],
    shapes: [shapeP(0, 0, 0, 1, 1, { fill: c.soft }), shapeP(1, 0, 0, 1, 1, { fill: c.soft })],
    texts: [textP(0, 0.1, 0.09, 0.8, '{TITLE}', 0.07), textP(0, 0.1, 0.81, 0.8, 'UNBREAKABLE · BEAUTIFUL · JOURNEY', 0.02, { font: 'sans' }),
      textP(1, 0.25, 0.36, 0.5, 'A PERFECTLY TOLD LOVE STORY, FRAMED IN LOVE.', 0.045), textP(1, 0.25, 0.62, 0.5, '{couple}', 0.03, { italic: true })]
  }) },
  { id: 'bliss4', name: 'Trio + bleed', n: 4, build: () => ({
    cells: [cellP(0, 0.08, 0.14, 0.27, 0.58), cellP(0, 0.365, 0.14, 0.27, 0.58), cellP(0, 0.65, 0.14, 0.27, 0.58), cellP(1, 0, 0, 1, 1)],
    shapes: [],
    texts: [textP(0, 0.1, 0.8, 0.8, 'SEALED WITH LOVE, FRAMED WITH JOY', 0.02, { font: 'sans' })]
  }) },
  { id: 'pinwheel5', name: 'Pinwheel', n: 5, build: () => ({
    cells: [cellP(0, 0, 0, 1, 1), cellP(1, 0.1, 0.07, 0.38, 0.5), cellP(1, 0.56, 0.2, 0.26, 0.24), cellP(1, 0.24, 0.62, 0.24, 0.29), cellP(1, 0.54, 0.5, 0.36, 0.43)],
    shapes: [], texts: []
  }) },
  { id: 'sidecol5', name: 'Edge column', n: 5, build: () => ({
    cells: [cellP(0, 0.12, 0.27, 0.44, 0.5), cellP(0, 0.62, 0, 0.3, 0.33), cellP(0, 0.62, 0.335, 0.3, 0.33), cellP(0, 0.62, 0.67, 0.3, 0.33), cellP(1, 0, 0, 1, 1)],
    shapes: [], texts: []
  }) },
  { id: 'corner5', name: 'Corner cluster', n: 5, build: () => ({
    cells: [cellP(0, 0.1, 0.12, 0.17, 0.25), cellP(0, 0.28, 0.12, 0.17, 0.25), cellP(0, 0.1, 0.38, 0.17, 0.25), cellP(0, 0.28, 0.38, 0.17, 0.25), cellP(1, 0, 0, 1, 1)],
    shapes: [], texts: []
  }) },
  { id: 'luxe4', name: 'Script + trio', n: 4, build: () => ({
    cells: [cellP(0, 0.1, 0.12, 0.34, 0.44), cellP(1, 0.08, 0.2, 0.27, 0.6), cellP(1, 0.365, 0.2, 0.27, 0.6), cellP(1, 0.65, 0.2, 0.27, 0.6)],
    shapes: [],
    texts: [textP(0, 0.1, 0.7, 0.7, "It's a wonderful life", 0.07, { font: 'script', align: 'left', color: '#A88B5A' })]
  }) },
  { id: 'inset3', name: 'Inset frame', n: 3, opening: true, build: () => ({
    cells: [cellP(0, 0, 0, 1, 1), cellP(0, 0.54, 0.1, 0.34, 0.48, { border: { w: 0.01, color: '#FFFFFF' } }), cellP(1, 0, 0, 1, 1)],
    shapes: [],
    texts: [textP(0, 0.5, 0.66, 0.42, '{TITLE}', 0.06, { color: '#FFFFFF', shadow: true })]
  }) },
  { id: 'lovestory3', name: 'Love story', n: 3, opening: true, build: () => ({
    cells: [cellP(0, 0.52, 0.3, 0.4, 0.6), cellP(0, 0.1, 0.56, 0.36, 0.34), cellP(1, 0, 0, 1, 1)],
    shapes: [],
    texts: [textP(0, 0.1, 0.1, 0.8, '{TITLE}', 0.075, { font: 'sans', bold: true, align: 'left' }),
      textP(0, 0.1, 0.3, 0.36, 'Grow old along with me! The best is yet to be.', 0.03, { italic: true, align: 'left' })]
  }) },
  { id: 'namestack1', name: 'Name stack', n: 1, opening: true, build: (pa, c) => ({
    cells: [cellP(1, 0, 0, 1, 1)],
    shapes: [],
    texts: [textP(0, 0.2, 0.3, 0.6, 'OUR WEDDING', 0.022, { font: 'sans' }), textP(0, 0.2, 0.36, 0.6, '{COUPLE}', 0.085, { color: c.deep }),
      textP(0, 0.2, 0.52, 0.6, '{DATE}', 0.02, { font: 'sans' })]
  }) },
  { id: 'darktitle1', name: 'Night title', n: 1, opening: true, build: () => ({
    cells: [cellP(0, 0, 0, 0.64, 1)],
    shapes: [shapeP(0, 0, 0, 1, 1, { fill: '#141414' }), shapeP(1, 0, 0, 1, 1, { fill: '#141414' })],
    texts: [textP(1, 0.15, 0.4, 0.7, '{couple}', 0.08, { font: 'script', color: '#FFFFFF' }), textP(1, 0.15, 0.56, 0.7, '{date}', 0.026, { italic: true, color: '#D9D2CB' })]
  }) },
  { id: 'caption4', name: 'Caption page', n: 4, build: () => ({
    cells: [cellP(0, 0.08, 0.07, 0.84, 0.44), cellP(0, 0.08, 0.53, 0.41, 0.3), cellP(0, 0.51, 0.53, 0.41, 0.3), cellP(1, 0, 0, 1, 1)],
    shapes: [],
    texts: [textP(0, 0.08, 0.87, 0.8, 'Moments we will never forget.', 0.026, { font: 'sans', align: 'left' })]
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
    .replace(/\{initial\}/g, (couple.trim()[0] || 'E').toUpperCase())
    .replace(/\{initials\}/g, couple.split(/\s*(?:&|and|\+|,)\s*/i).filter(Boolean).map((x) => x.trim()[0].toUpperCase()).join(' | ') || 'E');
}
