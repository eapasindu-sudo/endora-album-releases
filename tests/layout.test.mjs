import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  autoBuild, templateCells, TEMPLATES, sizeInfo, allocate, groupEvents, cellDpi, printChecks, applyTemplate, STYLES
} from '../renderer/lib/layout.js';

function fakePhotos(n, start = Date.UTC(2026, 11, 14, 0, 30)) {
  const out = [];
  let t = start;
  for (let i = 0; i < n; i++) {
    t += (i % 300 === 299 ? 90 : 0.3) * 60000; // a 90 minute gap every 300 photos
    const portrait = i % 3 === 1;
    out.push({ id: 'p' + i, width: portrait ? 4000 : 6000, height: portrait ? 6000 : 4000, takenAt: t, score: (i * 37 % 100) / 100 });
  }
  return out;
}

const size = { name: '12×36', h: 12, w: 36, unit: 'in', bleedMm: 3, dpi: 300 };

test('size info for 12x36 at 300 dpi', () => {
  const s = sizeInfo(size);
  assert.equal(s.aspect, 3);
  assert.equal(s.pxW, Math.round((36 + 6 / 25.4) * 300));
});

test('custom size in cm', () => {
  const s = sizeInfo({ h: 30, w: 90, unit: 'cm', dpi: 300, bleedMm: 0 });
  assert.equal(Math.round(s.hIn * 100) / 100, 11.81);
  assert.equal(s.aspect, 3);
});

test('every template produces cells inside the spread', () => {
  for (const style of Object.keys(STYLES)) {
    for (const t of TEMPLATES) {
      const cells = templateCells(t, size, style);
      assert.equal(cells.length, t.count);
      for (const c of cells) {
        assert.ok(c.x >= -1e-9 && c.y >= -1e-9 && c.x + c.w <= 1 + 1e-9 && c.y + c.h <= 1 + 1e-9, t.id + ' ' + style);
        assert.ok(c.w > 0 && c.h > 0);
      }
    }
  }
});

test('allocate keeps the total', () => {
  assert.deepEqual(allocate(10, [1, 1]).reduce((a, b) => a + b), 10);
  assert.equal(allocate(30, [500, 20, 300, 400, 600]).reduce((a, b) => a + b), 30);
  assert.equal(allocate(2, [5, 50, 10]).reduce((a, b) => a + b), 2);
});

test('groups events by time gap', () => {
  const ev = groupEvents(fakePhotos(900));
  assert.equal(ev.length, 3);
  assert.equal(ev.reduce((a, e) => a + e.ids.length, 0), 900);
});

test('auto build 2000 photos into exact spread count, no duplicates', () => {
  const photos = fakePhotos(2000);
  for (const style of Object.keys(STYLES)) {
    const t0 = Date.now();
    const spreads = autoBuild(photos, { spreads: 40, size, style, hero: true, text: true, seed: 3 });
    const ms = Date.now() - t0;
    assert.equal(spreads.length, 40, style);
    const ids = spreads.flatMap((s) => s.cells.map((c) => c.photoId));
    assert.equal(new Set(ids).size, ids.length, 'photo used twice in ' + style);
    assert.ok(ms < 3000, 'too slow: ' + ms);
  }
});

test('excluded photos are never placed', () => {
  const photos = fakePhotos(200).map((p, i) => ({ ...p, excluded: i % 2 === 0 }));
  const spreads = autoBuild(photos, { spreads: 20, size, style: 'Classic', seed: 1 });
  const placed = new Set(spreads.flatMap((s) => s.cells.map((c) => c.photoId)));
  photos.filter((p) => p.excluded).forEach((p) => assert.ok(!placed.has(p.id)));
});

test('few photos still build', () => {
  const spreads = autoBuild(fakePhotos(5), { spreads: 10, size, style: 'Classic', seed: 1 });
  assert.ok(spreads.length >= 1 && spreads.length <= 10);
});

test('dpi check flags small photos', () => {
  const cell = { x: 0, y: 0, w: 0.5, h: 1 };
  assert.ok(cellDpi(cell, { width: 6000, height: 4000 }, size) >= 200);
  assert.ok(cellDpi(cell, { width: 1200, height: 800 }, size) < 200);
  const project = { size, photos: [{ id: 'a', width: 1000, height: 700 }], spreads: [{ cells: [{ ...cell, photoId: 'a' }], texts: [] }] };
  assert.equal(printChecks(project).low.length, 1);
});

test('apply template keeps photos', () => {
  const photos = fakePhotos(60);
  const spreads = autoBuild(photos, { spreads: 10, size, style: 'Classic', seed: 2, hero: false });
  const s = spreads.find((x) => x.cells.length === 3);
  const byId = new Map(photos.map((p) => [p.id, p]));
  const other = TEMPLATES.find((t) => t.count === 3 && t.id !== s.layoutId);
  const next = applyTemplate(s, other.id, byId, size, 'Classic');
  assert.equal(next.layoutId, other.id);
  assert.deepEqual(next.cells.map((c) => c.photoId).sort(), s.cells.map((c) => c.photoId).sort());
});

test('use every photo places all photos', () => {
  const photos = fakePhotos(130);
  const spreads = autoBuild(photos, { spreads: 25, size, style: 'Classic', useEvery: true, seed: 4 });
  const placed = new Set(spreads.flatMap((s) => s.cells.map((c) => c.photoId)));
  assert.equal(placed.size, 130);
  assert.equal(spreads.length, 25);
});

test('range per spread is respected', () => {
  const photos = fakePhotos(600);
  const spreads = autoBuild(photos, { spreads: 30, size, style: 'Magazine', range: [3, 5], hero: false, seed: 9 });
  for (const s of spreads) assert.ok(s.cells.length >= 3 && s.cells.length <= 5, 'got ' + s.cells.length);
});

test('stars only uses starred photos', () => {
  const photos = fakePhotos(100).map((p, i) => ({ ...p, star: i < 30 }));
  const spreads = autoBuild(photos, { spreads: 8, size, style: 'Classic', starsOnly: true, seed: 1 });
  spreads.flatMap((s) => s.cells).forEach((c) => assert.ok(+c.photoId.slice(1) < 30));
});

import { generateIdeas, cellsFromGenId, applyTemplate as applyT, layoutIdeasFor, userTemplatePick, MAX_PER_SPREAD } from '../renderer/lib/layout.js';

const overlap = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;

test('AI ideas fit inside the spread, never overlap, and keep off the centre fold', () => {
  for (const n of [1, 2, 3, 5, 8, 12, 20, 40]) {
    const photos = fakePhotos(n);
    for (const style of Object.keys(STYLES)) {
      const ideas = generateIdeas(photos, size, style, { seed: 3, n: 6 });
      assert.ok(ideas.length >= 1, `no ideas for ${n} ${style}`);
      for (const idea of ideas) {
        assert.equal(idea.cells.length, n);
        idea.cells.forEach((c, i) => {
          assert.ok(c.x >= -1e-9 && c.y >= -1e-9 && c.x + c.w <= 1 + 1e-9 && c.y + c.h <= 1 + 1e-9, 'outside ' + idea.tpl.id);
          if (idea.tpl.id.includes('|')) assert.ok(c.x + c.w <= 0.5 + 1e-9 || c.x >= 0.5 - 1e-9, 'crosses fold ' + idea.tpl.id);
          idea.cells.slice(i + 1).forEach((d) => assert.ok(!overlap(c, d), 'overlap ' + idea.tpl.id));
        });
      }
    }
  }
});

test('new seeds give new ideas (unlimited)', () => {
  const photos = fakePhotos(6);
  const ids = new Set();
  for (let page = 0; page < 8; page++) layoutIdeasFor(photos, size, 'Classic', page, []).ideas.forEach((i) => ids.add(i.tpl.id));
  assert.ok(ids.size > 80, 'only ' + ids.size + ' distinct ideas');
});

test('ideas fit photo shapes: best idea crops little', () => {
  const photos = fakePhotos(4);
  const best = generateIdeas(photos, size, 'Modern', { seed: 2, n: 1 })[0];
  assert.ok(best.cost < 0.2, 'crop ' + best.cost);
});

test('g: ids rebuild for another album size', () => {
  const photos = fakePhotos(5);
  const id = generateIdeas(photos, size, 'Classic', { seed: 5, n: 1 })[0].tpl.id;
  const cells = cellsFromGenId(id, photos, { h: 10, w: 30, unit: 'in' }, 'Classic');
  assert.equal(cells.length, 5);
  assert.equal(cellsFromGenId('g:0|1', fakePhotos(3), size, 'Classic'), null);
});

test('more than 8 photos per spread and huge imports', () => {
  const photos = fakePhotos(6000);
  const t0 = Date.now();
  const spreads = autoBuild(photos, { spreads: 60, size, style: 'Magazine', range: [10, 16], hero: false, seed: 2 });
  assert.equal(spreads.length, 60);
  spreads.forEach((s) => assert.ok(s.cells.length >= 10 && s.cells.length <= 16, 'count ' + s.cells.length));
  assert.ok(Date.now() - t0 < 8000, 'slow ' + (Date.now() - t0));
  const all = autoBuild(fakePhotos(900), { spreads: 30, size, style: 'Classic', useEvery: true, seed: 1 });
  assert.equal(new Set(all.flatMap((s) => s.cells.map((c) => c.photoId))).size, 900);
  assert.ok(MAX_PER_SPREAD >= 30);
});

test('user templates are used and applied', () => {
  const photos = fakePhotos(3);
  const mine = { id: 'u:test', name: 'Mine', count: 3, cells: [{ x: 0.05, y: 0.1, w: 0.4, h: 0.8 }, { x: 0.55, y: 0.1, w: 0.18, h: 0.8 }, { x: 0.77, y: 0.1, w: 0.18, h: 0.8 }] };
  const pick = userTemplatePick(mine, photos, size);
  assert.equal(pick.cells.length, 3);
  const spreads = autoBuild(fakePhotos(60), { spreads: 20, size, style: 'Classic', range: [3, 3], hero: false, seed: 4, userTemplates: [mine] });
  assert.ok(spreads.some((s) => s.layoutId === 'u:test'));
  const byId = new Map(photos.map((p) => [p.id, p]));
  const s0 = { cells: photos.map((p) => ({ photoId: p.id })), texts: [] };
  assert.equal(applyT(s0, 'u:test', byId, size, 'Classic', [mine]).layoutId, 'u:test');
  const { ideas, mine: m } = layoutIdeasFor(photos, size, 'Classic', 1, [mine]);
  assert.ok(ideas.length >= 4); assert.equal(m.length, 1);
});
