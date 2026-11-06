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
