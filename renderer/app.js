// Endora Album – renderer entry: state, persistence, undo, import pipeline.
import { toast, debounce } from './lib/dom.js';
import { analyse, scoreSet, applyCull } from './lib/analysis.js';
import { groupEvents, uid, STANDARD_SIZES } from './lib/layout.js';
import { renderHome } from './views/home.js';
import { renderWorkspace, refresh } from './views/workspace.js';
import { renderUpdateBanner } from './views/modals.js';

export const state = {
  view: 'home',
  projects: [],
  project: null,
  byId: new Map(),
  mode: 'album',            // album | designer
  sel: { spread: 0, cell: null, text: null },
  panelTab: 'layouts',
  layoutPage: 0,
  browser: { filter: 'all', sort: 'time', q: '', thumb: 96, sel: new Set() },
  zoom: 1,
  guides: true,
  autoLayout: true,
  busy: null,               // { label, done, total }
  settings: {},
  update: null,             // { state, version, percent, message }
  undo: [],
  redo: []
};

const api = window.api;

export function newProject({ couple, date, size }) {
  return {
    id: uid(), couple: couple || 'New album', date: date || '', status: 'Designing',
    size: size || { ...STANDARD_SIZES[0], bleedMm: 3, dpi: 300 },
    photos: [], events: [], spreads: [],
    cull: { blur: true, dup: true, exposure: false },
    build: { style: 'Classic', spreads: 30, unit: 'spreads', perSpread: 'smart', min: 2, max: 6, useEvery: false, reuse: 'Medium',
      opts: { newSpreadPerPart: true, hero: true, text: true, color: false, face: true, starsOnly: false } },
    share: { video: null, videoPos: 'before', cover: '#3B2E25', music: 'video', perms: { comment: true, swap: true, approve: true, download: false, watermark: true }, expiryDays: 60 },
    cloud: null, comments: [], createdAt: Date.now()
  };
}

export function indexPhotos() {
  state.byId = new Map((state.project ? state.project.photos : []).map((p) => [p.id, p]));
}

export function usedCounts() {
  const m = new Map();
  if (!state.project) return m;
  for (const s of state.project.spreads) for (const c of s.cells) m.set(c.photoId, (m.get(c.photoId) || 0) + 1);
  return m;
}

// ---------- persistence ----------
const saveNow = async () => {
  if (!state.project) return;
  try { await api.projects.save(state.project); } catch (e) { toast('Could not save: ' + e.message, true); }
};
export const saveSoon = debounce(saveNow, 700);
export async function saveImmediately() { await saveNow(); }

// ---------- undo ----------
export function snapshot() {
  const p = state.project;
  state.undo.push(JSON.stringify({ spreads: p.spreads, size: p.size }));
  if (state.undo.length > 60) state.undo.shift();
  state.redo = [];
}
export function mutate(fn, regions = ['stage', 'panel', 'strip', 'top', 'browser']) {
  snapshot();
  fn(state.project);
  saveSoon();
  refresh(regions);
}
export function undo() {
  if (!state.undo.length) return;
  const p = state.project;
  state.redo.push(JSON.stringify({ spreads: p.spreads, size: p.size }));
  Object.assign(p, JSON.parse(state.undo.pop()));
  clampSel(); saveSoon(); refresh();
}
export function redo() {
  if (!state.redo.length) return;
  const p = state.project;
  state.undo.push(JSON.stringify({ spreads: p.spreads, size: p.size }));
  Object.assign(p, JSON.parse(state.redo.pop()));
  clampSel(); saveSoon(); refresh();
}
export function clampSel() {
  const n = state.project ? state.project.spreads.length : 0;
  if (state.sel.spread >= n) state.sel.spread = Math.max(0, n - 1);
  const s = state.project && state.project.spreads[state.sel.spread];
  if (!s || state.sel.cell >= s.cells.length) state.sel.cell = null;
  if (!s || state.sel.text >= (s.texts || []).length) state.sel.text = null;
}

// ---------- navigation ----------
export async function goHome() {
  if (state.project) await saveNow();
  state.view = 'home'; state.project = null; state.undo = []; state.redo = [];
  state.projects = await api.projects.list();
  render();
}

export async function openProject(id) {
  try {
    state.project = await api.projects.get(id);
  } catch (e) { toast('Could not open album: ' + e.message, true); return; }
  indexPhotos();
  state.view = 'workspace'; state.mode = 'album';
  state.sel = { spread: 0, cell: null, text: null };
  state.undo = []; state.redo = [];
  render();
}

export async function createProject(data) {
  state.project = newProject(data);
  indexPhotos();
  await saveNow();
  state.view = 'workspace'; state.mode = 'album';
  state.sel = { spread: 0, cell: null, text: null };
  render();
}

export function render() {
  const root = document.getElementById('app');
  document.documentElement.dataset.theme = state.settings.theme || 'dark';
  if (state.view === 'home') renderHome(root);
  else renderWorkspace(root);
}

// ---------- import + analysis ----------
export async function importPaths(paths) {
  const p = state.project;
  if (!p || !paths || !paths.length) return;
  const known = new Set(p.photos.map((x) => x.path));
  const fresh = paths.filter((x) => !known.has(x));
  if (!fresh.length) { toast('Those photos are already in this album.'); return; }
  const list = fresh;

  state.busy = { label: 'Importing photos', done: 0, total: list.length };
  refresh(['browser']);
  const off = api.photos.onProgress(({ done, total }) => { state.busy = { label: 'Importing photos', done, total }; refresh(['busy']); });
  let res;
  try { res = await api.photos.process(p.id, list); }
  catch (e) { off(); state.busy = null; refresh(['browser']); toast(e.message, true); return; }
  off();
  if (res.failed.length) toast(`${res.failed.length} files could not be read and were skipped.`, true);
  const added = res.photos.map((ph) => ({ ...ph, flags: [], excluded: false, star: false }));
  p.photos.push(...added);
  p.photos.sort((a, b) => a.takenAt - b.takenAt);
  indexPhotos();

  // analyse thumbnails: sharpness, exposure, duplicates, faces, colour
  state.busy = { label: 'Checking sharpness, faces & duplicates', done: 0, total: added.length };
  refresh(['browser']);
  let i = 0;
  const work = async () => {
    while (i < added.length) {
      const ph = added[i++];
      try { Object.assign(ph, await analyse(api.fileUrl(ph.thumb))); } catch (_) { /* keep defaults */ }
      state.busy.done++;
      if (state.busy.done % 10 === 0) refresh(['busy']);
    }
  };
  await Promise.all([work(), work(), work(), work()]);
  scoreSet(p.photos);
  applyCull(p.photos, p.cull);
  const prevNames = (p.events || []).map((e) => e.name);
  p.events = groupEvents(p.photos).map((e, k) => ({ name: prevNames[k] || e.name, ids: e.ids }));
  state.busy = null;
  await saveNow();
  refresh();
  const flagged = p.photos.filter((x) => x.flags && x.flags.length).length;
  toast(`${added.length} photos added · ${flagged} flagged (blurry, similar or bad exposure).`);
}

export function recull() {
  applyCull(state.project.photos, state.project.cull);
  saveSoon();
}

// ---------- boot ----------
async function boot() {
  state.settings = await api.settings.get();
  state.version = await api.updates.version().catch(() => '');
  state.cloud = await api.cloud.status().catch(() => ({ connected: false }));
  api.updates.onStatus((u) => { state.update = u; renderUpdateBanner(); });
  state.browser.thumb = state.settings.thumb || 96;
  state.projects = await api.projects.list();
  render();
}

window.addEventListener('keydown', (e) => {
  if (state.view !== 'workspace') return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  else if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); }
  else if (!typing && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !document.querySelector('.overlay')) {
    const n = state.project.spreads.length;
    state.sel = { spread: Math.max(0, Math.min(n - 1, state.sel.spread + (e.key === 'ArrowRight' ? 1 : -1))), cell: null, text: null };
    refresh(['stage', 'panel', 'strip'], { scroll: true });
  }
});

boot();
