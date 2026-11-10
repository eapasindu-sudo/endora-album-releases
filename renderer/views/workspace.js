// Main album workspace: top bar, spreads stage, layouts panel, spread strip, photo browser.
import { state, mutate, undo, redo, goHome, importPaths, usedCounts, saveSoon, snapshot, clampSel, recull } from '../app.js';
import { $, esc, fmtNum, ICON, toast } from '../lib/dom.js';
import { spreadHTML, textStyle } from '../lib/render-spread.js';
import { sizeInfo, applyTemplate, bestTemplate, makeSpread, focalFor, lighten, uid, rng, TEMPLATES, layoutIdeasFor, MAX_PER_SPREAD } from '../lib/layout.js';
import { TEXT_PACKS, FONTS } from '../lib/textpacks.js';
import { packItems, hiddenPackItems, userItems, artUrl, ART_COLORS, artInfo } from '../lib/wordart.js';
import { autoBuildModal, printCheckModal, shareModal, sizeModal } from './modals.js';
import { sizeLabel } from './home.js';

const api = window.api;
let root = null;

export function renderWorkspace(r) {
  root = r;
  root.innerHTML = `
  <div class="ws" id="ws" style="--browser-h:${state.settings.browserH || 250}px">
    <header class="topbar" id="r-top"></header>
    <section class="stage" id="r-stage" aria-label="Album spreads"></section>
    <aside class="panel" id="r-panel" aria-label="Layouts and design"></aside>
    <nav class="strip" id="r-strip" aria-label="All spreads"></nav>
    <section class="browser" id="r-browser" aria-label="Photos"></section>
  </div>`;
  wireStage(); wireBrowser(); wirePanel(); wireStrip(); wireTop(); wireAppDrop();
  refresh();
  window.onresize = () => refresh(['stage']);
}

export function refresh(regions = ['top', 'stage', 'panel', 'strip', 'browser'], opts = {}) {
  if (state.view !== 'workspace' || !root) return;
  clampSel();
  for (const r of regions) {
    if (r === 'top') renderTop();
    if (r === 'stage') renderStage(opts);
    if (r === 'panel') renderPanel();
    if (r === 'strip') renderStrip(opts);
    if (r === 'browser') renderBrowser();
    if (r === 'busy') renderBusy();
  }
}

const P = () => state.project;
const curSpread = () => P().spreads[state.sel.spread];

// ================= TOP BAR =================
function renderTop() {
  const p = P();
  $('#r-top').innerHTML = `
    <button class="icon-btn" data-top="home" aria-label="All albums">${ICON.home}</button>
    <span class="logo" style="width:26px;height:26px;font-size:13px">E</span>
    <div class="title"><b>${esc(p.couple)}</b><span class="muted small">${esc(p.build.style)} · ${p.spreads.length} spreads · ${fmtNum(p.photos.length)} photos</span></div>
    <button class="icon-btn" data-top="undo" aria-label="Undo" ${state.undo.length ? '' : 'disabled'}>${ICON.undo}</button>
    <button class="icon-btn" data-top="redo" aria-label="Redo" ${state.redo.length ? '' : 'disabled'}>${ICON.redo}</button>
    <div class="center"><div class="seg" role="tablist">
      <button role="tab" class="${state.mode === 'album' ? 'on' : ''}" data-top="mode-album">Album</button>
      <button role="tab" class="${state.mode === 'designer' ? 'on' : ''}" data-top="mode-designer">Designer</button>
    </div></div>
    <div class="grow"></div>
    <select data-top="status" aria-label="Album status" style="height:30px;font-size:12px">
      ${['Designing', 'Client review', 'Approved', 'Printing'].map((s) => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}
    </select>
    <button class="size-btn" data-top="size" title="Album size">${esc(sizeLabel(p.size))}</button>
    <button class="icon-btn" data-top="theme" aria-label="Light or dark">${state.settings.theme === 'light' ? ICON.moon : ICON.sun}</button>
    <button class="btn" data-top="print">${ICON.print}Print check</button>
    <button class="btn" data-top="share">${ICON.send}Send to client</button>
    <button class="btn gold" data-top="export">${ICON.export}Export</button>`;
}

function wireTop() {
  const top = $('#r-top');
  top.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-top]');
    if (!b) return;
    const a = b.dataset.top;
    if (a === 'home') goHome();
    else if (a === 'undo') undo();
    else if (a === 'redo') redo();
    else if (a === 'mode-album') { state.mode = 'album'; refresh(['top', 'stage'], { scroll: true }); }
    else if (a === 'mode-designer') { state.mode = 'designer'; refresh(['top', 'stage']); }
    else if (a === 'size') sizeModal();
    else if (a === 'print') printCheckModal('check');
    else if (a === 'export') printCheckModal('export');
    else if (a === 'share') shareModal();
    else if (a === 'theme') {
      state.settings = await api.settings.set({ theme: state.settings.theme === 'light' ? 'dark' : 'light' });
      document.documentElement.dataset.theme = state.settings.theme; refresh(['top']);
    }
  });
  top.addEventListener('change', (e) => {
    if (e.target.dataset.top === 'status') { P().status = e.target.value; saveSoon(); }
  });
}

// ================= STAGE =================
function stageHeight() {
  const st = $('#r-stage');
  const info = sizeInfo(P().size);
  const h = st.clientHeight || 500, w = st.clientWidth || 900;
  if (state.mode === 'designer') return Math.max(80, Math.min(h - 110, (w - 110) / info.aspect) * state.zoom);
  return Math.max(80, Math.min(h - 100, (w * 0.47) / info.aspect) * state.zoom);
}

function renderStage(opts = {}) {
  const p = P();
  const st = $('#r-stage');
  const prevScroll = st.querySelector('.stage-scroll') ? st.querySelector('.stage-scroll').scrollLeft : 0;
  if (!p.spreads.length) {
    st.innerHTML = `<div class="drop-hint" style="pointer-events:auto">
      <div class="logo" style="width:56px;height:56px;font-size:26px">E</div>
      <h2 style="margin:0;font-family:var(--serif);font-size:28px;color:var(--text)">${p.photos.length ? 'Ready to design' : 'Add your photos'}</h2>
      <span>${p.photos.length ? fmtNum(p.photos.length) + ' photos ready. Let Endora design the spreads, or drag photos up here.' : 'Drop a folder here, or use Import images below. Add as many photos as you like.'}</span>
      <div class="row">${p.photos.length ? `<button class="btn lg gold" data-stage="autobuild">${ICON.bolt}Auto Build</button>` : `<button class="btn lg gold" data-stage="import">${ICON.import}Import images</button>`}</div>
    </div>`;
    return;
  }
  const H = stageHeight();
  const byId = state.byId;
  const designer = state.mode === 'designer';
  const indices = designer ? [state.sel.spread] : p.spreads.map((_, i) => i);
  let html = `<div class="stage-scroll ${designer ? 'designer' : ''}">`;
  if (designer) html += `<button class="icon-btn" data-stage="prev" aria-label="Previous spread" ${state.sel.spread === 0 ? 'disabled' : ''}>${ICON.left}</button>`;
  for (const i of indices) {
    const s = p.spreads[i];
    const sel = i === state.sel.spread;
    html += `<div class="spread-wrap" id="sw-${i}">
      ${spreadHTML(s, p, byId, { height: H, index: i, interactive: true, selected: sel && !designer, selCell: sel ? state.sel.cell : null, selText: sel ? state.sel.text : null, selArt: sel ? state.sel.art : null, guides: designer && state.guides, showDpi: designer, editCell: designer && sel && state.sel.text == null && state.sel.art == null ? state.sel.cell : null })}
      <div class="spread-label"><b>${String(i + 1).padStart(2, '0')}</b>pages ${i * 2 + 1}–${i * 2 + 2}${s.section ? ' · ' + esc(s.section) : ''}</div>
    </div>`;
  }
  if (designer) html += `<button class="icon-btn" data-stage="next" aria-label="Next spread" ${state.sel.spread >= p.spreads.length - 1 ? 'disabled' : ''}>${ICON.right}</button>`;
  html += '</div>';
  html += `<div class="stage-foot">
    ${designer ? `<label class="check small" style="padding:0 8px"><input type="checkbox" data-stage="guides" ${state.guides ? 'checked' : ''}>Guides</label>` : ''}
    <button class="icon-btn" data-stage="zoom-out" aria-label="Zoom out">${ICON.minus}</button>
    <button class="btn ghost" data-stage="zoom-fit" style="height:30px;padding:0 8px;font-size:12px">${state.zoom === 1 ? 'Fit' : Math.round(state.zoom * 100) + '%'}</button>
    <button class="icon-btn" data-stage="zoom-in" aria-label="Zoom in">${ICON.plus}</button>
  </div>`;
  st.innerHTML = html;
  const sc = st.querySelector('.stage-scroll');
  if (!designer) {
    sc.style.scrollBehavior = 'auto';
    sc.scrollLeft = prevScroll;
    if (opts.scroll) {
      const el = document.getElementById('sw-' + state.sel.spread);
      if (el) sc.scrollLeft = el.offsetLeft - (sc.clientWidth - el.clientWidth) / 2;
    }
    sc.style.scrollBehavior = '';
  }
  renderFloatbar();
}

function renderFloatbar() {
  const st = $('#r-stage');
  st.querySelectorAll('.floatbar').forEach((x) => x.remove());
  const s = curSpread();
  if (!s) return;
  let target = null, html = '';
  if (state.sel.art != null && s.arts && s.arts[state.sel.art]) {
    target = st.querySelector(`[data-spread="${state.sel.spread}"] [data-art="${state.sel.art}"]`);
    const a = s.arts[state.sel.art];
    const info = artInfo(a.src);
    html = `
      <span class="small muted" style="padding:0 4px">Size</span>
      <input type="range" data-fb="artsize" min="0.04" max="1" step="0.005" value="${a.w}" aria-label="Word art size">
      ${ART_COLORS.map((c) => `<button class="sw ${a.color === c ? 'on' : ''}" data-fb="artcolor" data-c="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}
      <input type="color" data-fb="artpick" value="${esc(a.color || (info && info.color) || '#000000')}" aria-label="Any colour">
      <button class="btn ghost" data-fb="artorig" style="height:30px;font-size:12px;${a.color ? '' : 'color:var(--gold)'}">Original</button>
      <span class="small muted" style="padding:0 4px">Opacity</span>
      <input type="range" data-fb="artop" min="0.1" max="1" step="0.05" value="${a.opacity == null ? 1 : a.opacity}" aria-label="Opacity" style="width:70px">
      <button class="icon-btn" data-fb="artcenter" aria-label="Centre on page">${ICON.grid}</button>
      <button class="icon-btn" data-fb="artdel" aria-label="Delete word art">${ICON.trash}</button>`;
  } else if (state.sel.text != null) {
    target = st.querySelector(`[data-spread="${state.sel.spread}"] [data-text="${state.sel.text}"]`);
    const t = s.texts[state.sel.text];
    html = `
      <select data-fb="font" aria-label="Font">${Object.keys(FONTS).map((f) => `<option value="${f}" ${t.font === f ? 'selected' : ''}>${f[0].toUpperCase() + f.slice(1)}</option>`).join('')}</select>
      <input type="range" data-fb="tsize" min="0.02" max="0.2" step="0.005" value="${t.size}" aria-label="Text size">
      <input type="color" data-fb="color" value="${esc(t.color || '#3B3026')}" aria-label="Text colour">
      <button class="icon-btn" data-fb="bold" aria-label="Bold" style="font-weight:700">B</button>
      <button class="icon-btn" data-fb="italic" aria-label="Italic" style="font-style:italic;font-family:serif">I</button>
      <button class="icon-btn" data-fb="align" aria-label="Alignment">${t.align === 'center' ? '≡' : t.align === 'right' ? '⫶' : '☰'}</button>
      <button class="icon-btn" data-fb="shadow" aria-label="Shadow">S</button>
      <button class="icon-btn" data-fb="deltext" aria-label="Delete text">${ICON.trash}</button>`;
  } else if (state.sel.cell != null) {
    target = st.querySelector(`[data-spread="${state.sel.spread}"] [data-cell="${state.sel.cell}"]`);
    const c = s.cells[state.sel.cell];
    html = `
      <span class="small muted" style="padding:0 6px">Zoom</span>
      <input type="range" data-fb="zoom" min="1" max="3" step="0.02" value="${c.zoom || 1}" aria-label="Photo zoom">
      <button class="btn ghost" data-fb="center" style="height:30px;font-size:12px">Reset crop</button>
      <button class="btn ghost" data-fb="star" style="height:30px;font-size:12px">${ICON.star}Hero</button>
      <button class="btn ghost danger" data-fb="remove" style="height:30px;font-size:12px">${ICON.trash}Remove</button>`;
  }
  if (!target || !html) return;
  const fb = document.createElement('div');
  fb.className = 'floatbar';
  fb.innerHTML = html;
  st.appendChild(fb);
  const sr = st.getBoundingClientRect(), tr = target.getBoundingClientRect();
  let top = tr.top - sr.top - fb.offsetHeight - 10;
  if (top < 6) top = tr.bottom - sr.top + 10;
  let left = tr.left - sr.left + tr.width / 2 - fb.offsetWidth / 2;
  left = Math.max(6, Math.min(sr.width - fb.offsetWidth - 6, left));
  fb.style.top = top + 'px'; fb.style.left = left + 'px';
}

function wireStage() {
  const st = $('#r-stage');
  st.addEventListener('click', (e) => {
    const b = e.target.closest('[data-stage]');
    if (b) {
      const a = b.dataset.stage;
      if (a === 'zoom-in') state.zoom = Math.min(3, +(state.zoom + 0.25).toFixed(2));
      if (a === 'zoom-out') state.zoom = Math.max(0.4, +(state.zoom - 0.25).toFixed(2));
      if (a === 'zoom-fit') state.zoom = 1;
      if (a === 'prev') { state.sel = { spread: Math.max(0, state.sel.spread - 1), cell: null, text: null }; refresh(['stage', 'panel', 'strip'], { scroll: true }); return; }
      if (a === 'next') { state.sel = { spread: Math.min(P().spreads.length - 1, state.sel.spread + 1), cell: null, text: null }; refresh(['stage', 'panel', 'strip'], { scroll: true }); return; }
      if (a === 'autobuild') return autoBuildModal();
      if (a === 'import') return pickImport();
      if (a !== 'guides') refresh(['stage']);
      return;
    }
    if (e.target.closest('.floatbar')) return onFloatClick(e);
    if (e.target.closest('[data-h]')) return;
    const sp = e.target.closest('[data-spread]');
    if (!sp) { if (state.sel.cell != null || state.sel.text != null) { state.sel.cell = null; state.sel.text = null; refresh(['stage']); } return; }
    const si = +sp.dataset.spread;
    const cell = e.target.closest('[data-cell]');
    const txt = e.target.closest('[data-text]');
    const artEl = e.target.closest('[data-art]');
    const changed = si !== state.sel.spread;
    state.sel = artEl ? { spread: si, cell: null, text: null, art: +artEl.dataset.art }
      : { spread: si, cell: cell ? +cell.dataset.cell : null, text: txt ? +txt.dataset.text : null, art: null };
    refresh(changed ? ['stage', 'panel', 'strip'] : ['stage']);
  });
  st.addEventListener('change', (e) => {
    if (e.target.dataset.stage === 'guides') { state.guides = e.target.checked; refresh(['stage']); }
  });
  st.addEventListener('input', onFloatInput);
  st.addEventListener('change', (e) => { if (e.target.closest('.floatbar')) { saveSoon(); } });

  // text editing
  st.addEventListener('dblclick', (e) => {
    const t = e.target.closest('[data-text]');
    if (!t) return;
    t.contentEditable = 'true'; t.focus();
    document.getSelection().selectAllChildren(t);
    t.onblur = () => {
      t.contentEditable = 'false';
      const s = curSpread(); const ti = +t.dataset.text;
      if (s && s.texts[ti] && s.texts[ti].text !== t.innerText) {
        snapshot(); s.texts[ti].text = t.innerText.trim() || ' '; delete s.texts[ti].d;
        if (/[඀-෿]/.test(s.texts[ti].text) && s.texts[ti].font !== 'sinhala') s.texts[ti].font = 'sinhala';
        saveSoon(); refresh(['stage', 'strip']);
      }
    };
  });

  // drag a selected text box / pan a selected photo
  st.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const sp = e.target.closest('[data-spread]');
    if (!sp || +sp.dataset.spread !== state.sel.spread) return;
    const handle = e.target.closest('[data-h]');
    if (handle) { e.preventDefault(); e.stopPropagation(); startFrameEdit(e, sp, handle.dataset.h); return; }
    const t = e.target.closest('[data-text]');
    const c = e.target.closest('[data-cell]');
    const rect = sp.getBoundingClientRect();
    const s = curSpread();
    const artEl = e.target.closest('[data-art]');
    if (artEl && +artEl.dataset.art === state.sel.art) {
      e.preventDefault();
      const a = s.arts[state.sel.art];
      const sx = e.clientX, sy = e.clientY, ox = a.x, oy = a.y;
      let moved = false;
      const mv = (ev) => {
        if (!moved) { snapshot(); moved = true; }
        a.x = Math.max(-a.w * 0.5, Math.min(1 - a.w * 0.5, ox + (ev.clientX - sx) / rect.width));
        a.y = Math.max(-0.2, Math.min(0.95, oy + (ev.clientY - sy) / rect.height));
        Object.assign(artEl.style, { left: a.x * rect.width + 'px', top: a.y * rect.height + 'px' });
        const fb = st.querySelector('.floatbar'); if (fb) fb.style.visibility = 'hidden';
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) { saveSoon(); refresh(['stage', 'strip']); } };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      return;
    }
    if (t && +t.dataset.text === state.sel.text && t.contentEditable !== 'true') {
      e.preventDefault();
      const tx = s.texts[state.sel.text];
      const sx = e.clientX, sy = e.clientY, ox = tx.x, oy = tx.y;
      let moved = false;
      const mv = (ev) => {
        if (!moved) { snapshot(); moved = true; }
        tx.x = Math.max(0, Math.min(1 - 0.02, ox + (ev.clientX - sx) / rect.width));
        tx.y = Math.max(0, Math.min(1 - 0.02, oy + (ev.clientY - sy) / rect.height));
        Object.assign(t.style, { left: tx.x * rect.width + 'px', top: tx.y * rect.height + 'px' });
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) { saveSoon(); refresh(['stage', 'strip']); } };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    } else if (c && +c.dataset.cell === state.sel.cell) {
      e.preventDefault();
      const cell = s.cells[state.sel.cell];
      const img = c.querySelector('img');
      const cr = c.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY, fx0 = cell.fx ?? 0.5, fy0 = cell.fy ?? 0.42;
      let moved = false;
      const mv = (ev) => {
        if (!moved) { snapshot(); moved = true; }
        cell.fx = Math.max(0, Math.min(1, fx0 - (ev.clientX - sx) / cr.width));
        cell.fy = Math.max(0, Math.min(1, fy0 - (ev.clientY - sy) / cr.height));
        if (img) { img.style.objectPosition = `${cell.fx * 100}% ${cell.fy * 100}%`; img.style.setProperty('--fx', cell.fx * 100 + '%'); img.style.setProperty('--fy', cell.fy * 100 + '%'); img.style.transformOrigin = `${cell.fx * 100}% ${cell.fy * 100}%`; }
      };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) { saveSoon(); refresh(['strip']); } };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    }
  });

  // drag & drop: cells swap, photos from browser
  st.addEventListener('dragstart', (e) => {
    const c = e.target.closest('[data-cell]');
    const sp = e.target.closest('[data-spread]');
    if (!c || !sp) return;
    if (+sp.dataset.spread === state.sel.spread && +c.dataset.cell === state.sel.cell) { e.preventDefault(); return; }
    e.dataTransfer.setData('application/x-endora-cell', sp.dataset.spread + ':' + c.dataset.cell);
    e.dataTransfer.effectAllowed = 'move';
  });
  st.addEventListener('dragover', (e) => {
    const types = e.dataTransfer.types;
    if (!types.includes('application/x-endora-cell') && !types.includes('application/x-endora-photo')) return;
    e.preventDefault();
    st.querySelectorAll('.over,.drop-target').forEach((x) => x.classList.remove('over', 'drop-target'));
    const c = e.target.closest('[data-cell]');
    const sp = e.target.closest('[data-spread]');
    if (c) c.classList.add('over'); else if (sp) sp.classList.add('drop-target');
  });
  st.addEventListener('dragleave', (e) => { if (!st.contains(e.relatedTarget)) st.querySelectorAll('.over,.drop-target').forEach((x) => x.classList.remove('over', 'drop-target')); });
  st.addEventListener('drop', (e) => {
    const cellSrc = e.dataTransfer.getData('application/x-endora-cell');
    const photoSrc = e.dataTransfer.getData('application/x-endora-photo');
    if (!cellSrc && !photoSrc) return;
    e.preventDefault(); e.stopPropagation();
    const c = e.target.closest('[data-cell]');
    const sp = e.target.closest('[data-spread]');
    const p = P();
    if (cellSrc && c && sp) {
      const [s1, c1] = cellSrc.split(':').map(Number);
      const s2 = +sp.dataset.spread, c2 = +c.dataset.cell;
      if (s1 === s2 && c1 === c2) return refresh(['stage']);
      mutate(() => {
        const A = p.spreads[s1].cells[c1], B = p.spreads[s2].cells[c2];
        const a = A.photoId; A.photoId = B.photoId; B.photoId = a;
        Object.assign(A, focalFor(state.byId.get(A.photoId)), { zoom: 1 });
        Object.assign(B, focalFor(state.byId.get(B.photoId)), { zoom: 1 });
      }, ['stage', 'strip', 'panel']);
    } else if (photoSrc) {
      const ids = photoSrc.split(',').filter((id) => state.byId.has(id));
      if (!ids.length) return;
      if (c && sp) {
        mutate(() => {
          const cell = p.spreads[+sp.dataset.spread].cells[+c.dataset.cell];
          cell.photoId = ids[0];
          Object.assign(cell, focalFor(state.byId.get(ids[0])), { zoom: 1 });
        });
      } else if (sp) {
        addPhotosToSpread(+sp.dataset.spread, ids);
      } else {
        newSpreadWith(ids, p.spreads.length);
      }
    }
  });
}

// Resize / move a photo frame by hand. Edges snap to other frames, the margins and the centre fold.
function startFrameEdit(e, sp, mode) {
  const s = curSpread();
  const ci = state.sel.cell;
  const cell = s.cells[ci];
  if (!cell) return;
  const rect = sp.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  const start = { x: cell.x, y: cell.y, w: cell.w, h: cell.h };
  const sx = e.clientX, sy = e.clientY;
  const others = s.cells.filter((_, i) => i !== ci);
  const xs = [0, 0.5, 1, 0.04 / sizeInfo(P().size).aspect, 1 - 0.04 / sizeInfo(P().size).aspect], ys = [0, 1, 0.04, 0.96];
  others.forEach((o) => { xs.push(o.x, o.x + o.w); ys.push(o.y, o.y + o.h); });
  const tolX = 7 / W, tolY = 7 / H, minW = 24 / W, minH = 24 / H;
  const snap = (v, list, tol) => { let best = null; for (const t of list) if (Math.abs(t - v) < tol && (best == null || Math.abs(t - v) < Math.abs(best - v))) best = t; return best; };
  const cellEl = sp.querySelector(`[data-cell="${ci}"]`);
  const frameEl = sp.querySelector('.frame-edit');
  let moved = false;
  const lines = [];
  const clearLines = () => { lines.forEach((l) => l.remove()); lines.length = 0; };
  const line = (vertical, pos) => { const l = document.createElement('div'); l.className = 'snap-line'; Object.assign(l.style, vertical ? { left: pos * W + 'px', top: 0, width: '1px', height: H + 'px' } : { top: pos * H + 'px', left: 0, height: '1px', width: W + 'px' }); sp.appendChild(l); lines.push(l); };
  const mv = (ev) => {
    if (!moved) { snapshot(); moved = true; }
    const dx = (ev.clientX - sx) / W, dy = (ev.clientY - sy) / H;
    let { x, y, w, h } = start;
    clearLines();
    if (mode === 'move') {
      x = Math.max(0, Math.min(1 - w, x + dx)); y = Math.max(0, Math.min(1 - h, y + dy));
      const l = snap(x, xs, tolX), r = snap(x + w, xs, tolX), t = snap(y, ys, tolY), b = snap(y + h, ys, tolY);
      if (l != null) { x = l; line(true, l); } else if (r != null) { x = r - w; line(true, r); }
      if (t != null) { y = t; line(false, t); } else if (b != null) { y = b - h; line(false, b); }
    } else {
      if (mode.includes('w')) { let nx = Math.max(0, Math.min(start.x + start.w - minW, start.x + dx)); const sn = snap(nx, xs, tolX); if (sn != null && sn < start.x + start.w - minW) { nx = sn; line(true, sn); } w = start.x + start.w - nx; x = nx; }
      if (mode.includes('e')) { let r = Math.min(1, Math.max(start.x + minW, start.x + start.w + dx)); const sn = snap(r, xs, tolX); if (sn != null && sn > start.x + minW) { r = sn; line(true, sn); } w = r - start.x; }
      if (mode.includes('n')) { let ny = Math.max(0, Math.min(start.y + start.h - minH, start.y + dy)); const sn = snap(ny, ys, tolY); if (sn != null && sn < start.y + start.h - minH) { ny = sn; line(false, sn); } h = start.y + start.h - ny; y = ny; }
      if (mode.includes('s')) { let b = Math.min(1, Math.max(start.y + minH, start.y + start.h + dy)); const sn = snap(b, ys, tolY); if (sn != null && sn > start.y + minH) { b = sn; line(false, sn); } h = b - start.y; }
    }
    Object.assign(cell, { x, y, w, h });
    const css = { left: x * W + 'px', top: y * H + 'px', width: w * W + 'px', height: h * H + 'px' };
    if (cellEl) Object.assign(cellEl.style, css);
    if (frameEl) Object.assign(frameEl.style, css);
  };
  const up = () => {
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    clearLines();
    if (moved) { s.layoutId = 'custom'; saveSoon(); refresh(['stage', 'strip', 'panel']); }
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}

function onFloatClick(e) {
  const b = e.target.closest('[data-fb]');
  if (!b) return;
  const s = curSpread();
  const a = b.dataset.fb;
  if (state.sel.art != null && s.arts && s.arts[state.sel.art]) {
    const art = s.arts[state.sel.art];
    if (a === 'artdel') { mutate(() => { s.arts.splice(state.sel.art, 1); state.sel.art = null; }, ['stage', 'strip']); return; }
    if (a === 'artcolor') mutate(() => { art.color = b.dataset.c; }, ['stage', 'strip']);
    if (a === 'artorig') mutate(() => { art.color = null; }, ['stage', 'strip']);
    if (a === 'artcenter') {
      const A = sizeInfo(P().size).aspect;
      mutate(() => { const h = art.w * A * art.ar; const right = art.x + art.w / 2 > 0.5; art.x = (right ? 0.75 : 0.25) - art.w / 2; art.y = 0.5 - h / 2; }, ['stage', 'strip']);
    }
    return;
  }
  if (state.sel.text != null) {
    const t = s.texts[state.sel.text];
    if (a === 'deltext') { mutate(() => { s.texts.splice(state.sel.text, 1); state.sel.text = null; }, ['stage', 'strip']); return; }
    mutate(() => {
      if (a === 'bold') t.bold = !t.bold;
      if (a === 'italic') t.italic = !t.italic;
      if (a === 'shadow') t.shadow = !t.shadow;
      if (a === 'align') t.align = t.align === 'left' ? 'center' : t.align === 'center' ? 'right' : 'left';
    }, ['stage', 'strip']);
  } else if (state.sel.cell != null) {
    const c = s.cells[state.sel.cell];
    if (a === 'center') mutate(() => Object.assign(c, focalFor(state.byId.get(c.photoId)), { zoom: 1 }), ['stage', 'strip']);
    if (a === 'star') { const ph = state.byId.get(c.photoId); ph.star = !ph.star; saveSoon(); toast(ph.star ? 'Marked as a hero photo' : 'Hero mark removed'); refresh(['browser']); }
    if (a === 'remove') removePhotoFromSpread(state.sel.spread, state.sel.cell);
  }
}

let floatSnap = false;
function onFloatInput(e) {
  const el = e.target;
  if (!el.closest('.floatbar')) return;
  const s = curSpread();
  if (!floatSnap) { snapshot(); floatSnap = true; setTimeout(() => { floatSnap = false; }, 800); }
  const a = el.dataset.fb;
  const st = $('#r-stage');
  if (state.sel.art != null && s.arts && s.arts[state.sel.art]) {
    const art = s.arts[state.sel.art];
    const node = st.querySelector(`[data-spread="${state.sel.spread}"] [data-art="${state.sel.art}"]`);
    const sp = node && node.closest('.spread');
    if (a === 'artsize') {
      const cx = art.x + art.w / 2, cyPx = art.y * (sp ? sp.offsetHeight : 1) + art.w * (sp ? sp.offsetWidth : 1) * art.ar / 2;
      art.w = +el.value; art.x = cx - art.w / 2;
      if (sp) art.y = (cyPx - art.w * sp.offsetWidth * art.ar / 2) / sp.offsetHeight;
      if (node && sp) Object.assign(node.style, { left: art.x * sp.offsetWidth + 'px', top: art.y * sp.offsetHeight + 'px', width: art.w * sp.offsetWidth + 'px', height: art.w * sp.offsetWidth * art.ar + 'px' });
    }
    if (a === 'artop') { art.opacity = +el.value; if (node) node.style.opacity = art.opacity; }
    if (a === 'artpick') {
      art.color = el.value;
      const url = artUrl(art.src);
      if (node) node.innerHTML = `<div class="art-mask" style="background:${art.color};-webkit-mask-image:url('${url}');mask-image:url('${url}')"></div>`;
    }
    saveSoon();
    return;
  }
  if (a === 'zoom') {
    const c = s.cells[state.sel.cell]; c.zoom = +el.value;
    const img = st.querySelector(`[data-spread="${state.sel.spread}"] [data-cell="${state.sel.cell}"] img`);
    if (img) img.style.transform = `scale(${c.zoom})`;
  } else if (state.sel.text != null) {
    const t = s.texts[state.sel.text];
    if (a === 'tsize') t.size = +el.value;
    if (a === 'color') t.color = el.value;
    if (a === 'font') t.font = el.value;
    const node = st.querySelector(`[data-spread="${state.sel.spread}"] [data-text="${state.sel.text}"]`);
    const sp = node && node.closest('.spread');
    if (node) node.setAttribute('style', textStyle(t, sp.offsetWidth, sp.offsetHeight));
  }
  saveSoon();
}

// ================= spread operations =================
function relayout(spread, photos, seed) {
  const p = P();
  const pick = bestTemplate(photos, p.size, p.build.style, { allowFull: photos.length <= 2, random: seed ? rng(seed) : null, avoid: [spread.layoutId], userTemplates: state.settings.userTemplates, info: { couple: p.couple, date: p.date, title: spread.section } })
    || bestTemplate(photos, p.size, 'Classic', { allowFull: true });
  if (!pick) return spread;
  const ns = makeSpread(pick, { id: spread.id, bg: spread.bg, section: spread.section, texts: spread.texts });
  ns.locked = spread.locked;
  return ns;
}

function spreadPhotos(s) { return s.cells.map((c) => state.byId.get(c.photoId)).filter(Boolean); }

export function addPhotosToSpread(si, ids) {
  const p = P();
  const s = p.spreads[si];
  const have = new Set(s.cells.map((c) => c.photoId));
  const add = ids.filter((id) => !have.has(id)).map((id) => state.byId.get(id));
  const photos = spreadPhotos(s).concat(add);
  if (photos.length > MAX_PER_SPREAD) { toast(`A spread can hold up to ${MAX_PER_SPREAD} photos. Make a new spread for the rest.`, true); return; }
  if (!state.autoLayout) toast('Auto layout is off, so the layout was picked once for the new photo count.');
  mutate(() => { p.spreads[si] = relayout(s, photos); state.sel = { spread: si, cell: null, text: null }; });
}

function removePhotoFromSpread(si, ci) {
  const p = P();
  const s = p.spreads[si];
  const photos = spreadPhotos(s).filter((_, i) => i !== ci);
  mutate(() => {
    if (!photos.length) { p.spreads.splice(si, 1); }
    else p.spreads[si] = relayout(s, photos);
    state.sel.cell = null;
  });
}

function newSpreadWith(ids, at) {
  const p = P();
  const photos = ids.slice(0, MAX_PER_SPREAD).map((id) => state.byId.get(id)).filter(Boolean);
  if (!photos.length) return;
  const pick = bestTemplate(photos, p.size, p.build.style, { allowFull: photos.length <= 2 }) || bestTemplate(photos, p.size, 'Classic', { allowFull: true });
  mutate(() => {
    const prev = p.spreads[at - 1];
    p.spreads.splice(at, 0, makeSpread(pick, { bg: prev ? prev.bg : '#FFFFFF', section: prev ? prev.section : '' }));
    state.sel = { spread: at, cell: null, text: null };
  });
  refresh(['stage'], { scroll: true });
}

function nextUnused(count, near) {
  const used = usedCounts();
  const pool = P().photos.filter((ph) => !used.has(ph.id) && !ph.excluded);
  if (near) pool.sort((a, b) => Math.abs(a.takenAt - near) - Math.abs(b.takenAt - near));
  return pool.slice(0, count).sort((a, b) => a.takenAt - b.takenAt);
}

function changeCount(delta) {
  const p = P(); const si = state.sel.spread; const s = p.spreads[si];
  const photos = spreadPhotos(s);
  if (delta > 0) {
    if (photos.length >= MAX_PER_SPREAD) return toast(`${MAX_PER_SPREAD} photos is the most for one spread.`);
    const near = photos.length ? photos[Math.floor(photos.length / 2)].takenAt : null;
    const add = nextUnused(1, near);
    if (!add.length) return toast('No unused photos left. Import more or drag one from the browser.');
    mutate(() => { p.spreads[si] = relayout(s, photos.concat(add).sort((a, b) => a.takenAt - b.takenAt)); });
  } else {
    if (photos.length <= 1) return;
    const worst = photos.reduce((w, ph) => ((ph.score ?? 0.5) < (w.score ?? 0.5) ? ph : w), photos[0]);
    mutate(() => { p.spreads[si] = relayout(s, photos.filter((x) => x !== worst)); });
  }
  state.layoutPage = 0;
}

// ================= PANEL =================
function renderPanel() {
  const p = P();
  const panel = $('#r-panel');
  const s = curSpread();
  const tab = state.panelTab;
  let head = '', body = '';
  if (!s) {
    panel.innerHTML = `<div class="panel-body"><p class="muted">Select a spread to see layouts, text and backgrounds.</p></div>`;
    return;
  }
  const photos = spreadPhotos(s);
  if (tab === 'layouts') {
    const sub = state.layoutSub || 'ideas';
    const userT = state.settings.userTemplates || [];
    head = `<div class="seg" style="display:grid;grid-template-columns:1fr 1fr"><button class="${sub === 'ideas' ? 'on' : ''}" data-sub="ideas">AI ideas</button><button class="${sub === 'mine' ? 'on' : ''}" data-sub="mine">My templates ${userT.length ? '(' + userT.length + ')' : ''}</button></div>
      <div class="row" style="justify-content:space-between">
        <span class="row small">Photos <span class="stepper"><button data-pn="minus" aria-label="One photo less">−</button><b>${photos.length}</b><button data-pn="plus" aria-label="One photo more">+</button></span></span>
        ${sub === 'ideas' ? `<button class="btn ghost" data-pn="ideas" style="height:28px;font-size:12px">${ICON.shuffle}Show new ideas</button>` : ''}
      </div>
      <button class="btn" data-pn="savetpl" style="height:30px;font-size:12px">${ICON.plus}Save this spread as my template</button>`;
    const { ideas, mine } = layoutIdeasFor(photos, p.size, p.build.style, state.layoutPage || 0, userT, { couple: p.couple, date: p.date, title: s.section });
    const tile = (r, del) => {
      const fake = { ...s, texts: r.texts || [], shapes: r.shapes || [], cells: r.cells.map((c, i) => ({ ...c, photoId: r.order[i].id, ...focalFor(r.order[i]), zoom: 1 })) };
      return `<div style="position:relative"><button class="layout-tile ${r.tpl.id === s.layoutId ? 'on' : ''}" data-layout="${esc(r.tpl.id)}" title="${esc(r.tpl.name || '')}">${spreadHTML(fake, p, state.byId, { height: 42 })}</button>
        ${del ? `<button class="icon-btn" data-deltpl="${esc(r.tpl.id)}" aria-label="Delete template" style="position:absolute;right:-6px;top:-8px;width:22px;height:22px;background:var(--bg2);border:1px solid var(--line2);border-radius:11px">${ICON.close}</button>` : ''}</div>`;
    };
    if (sub === 'ideas') {
      body = `<div class="layout-grid">${ideas.map((r) => tile(r)).join('')}</div>
        <p class="small muted" style="margin-top:10px">Set ${(state.layoutPage || 0) + 1} · made for these ${photos.length} photos · best fit first</p>`;
    } else {
      const others = userT.filter((u) => u.count !== photos.length);
      body = mine.length ? `<div class="layout-grid">${mine.map((r) => tile(r, true)).join('')}</div>` : `<p class="small muted">No saved templates for ${photos.length} photos yet.</p>`;
      body += `<p class="small muted" style="margin-top:10px">To make one: in Designer, select a photo and drag its corners or the move grip, then press "Save this spread as my template".${others.length ? ` You also have ${others.length} template${others.length > 1 ? 's' : ''} for other photo counts.` : ''}</p>`;
    }
  } else if (tab === 'text') {
    head = `<button class="btn" data-pn="addtext">${ICON.text}Add text box</button>
      <div class="row"><button class="btn grow" data-pn="importpng">${ICON.plus}Add PNG</button><button class="btn grow" data-pn="importpsd">${ICON.import}Import PSD</button></div>
      <span class="small muted">Click word art to add it. You can also drop PNG or PSD files here.</span>`;
    const mine = userItems(state.settings);
    const hidden = hiddenPackItems(state.settings);
    const artTile = (it, kind) => `<button class="art-tile" data-art-add="${esc(it.src)}" title="${esc(it.name)}"><img src="${esc(artUrl(it.src))}" alt="${esc(it.name)}" loading="lazy">${kind === 'mine' ? `<span class="x" data-art-del="${esc(it.id)}" role="button" aria-label="Delete" title="Delete">${ICON.close}</span>` : kind === 'pack' ? `<span class="x" data-art-hide="${esc(it.id)}" role="button" aria-label="Hide" title="Hide from the pack">${ICON.close}</span>` : `<span class="x" data-art-unhide="${esc(it.id)}" role="button" aria-label="Show again" title="Show again" style="color:var(--gold)">${ICON.plus}</span>`}</button>`;
    body = `<div class="art-drop" data-art-drop>Drop PNG or PSD files here</div>`
      + (mine.length ? `<div class="sec-title">My word art (${mine.length})</div><div class="art-grid">${mine.map((it) => artTile(it, 'mine')).join('')}</div>` : '')
      + `<div class="sec-title">Word art pack (${packItems(state.settings).length})</div><div class="art-grid">${packItems(state.settings).map((it) => artTile(it, 'pack')).join('')}</div>`
      + (hidden.length ? `<div class="row" style="margin-top:10px"><span class="small muted grow">${hidden.length} hidden</span><button class="btn ghost" data-pn="showhidden" style="height:28px;font-size:12px">${state.showHiddenArt ? 'Close' : 'Show hidden'}</button></div>`
        + (state.showHiddenArt ? `<div class="art-grid" style="opacity:.7">${hidden.map((it) => artTile(it, 'hidden')).join('')}</div>` : '') : '')
      + TEXT_PACKS.map((g) => `<div class="sec-title">${esc(g.group)}</div>` + g.items.map((it, k) =>
      `<button class="text-item" data-tp="${esc(g.group)}|${k}"><span style="font-family:${FONTS[it.font]};font-size:${it.t.length > 30 ? 14 : 18}px">${esc(it.t)}</span>${it.note ? `<span class="small muted">${esc(it.note)}</span>` : ''}</button>`).join('')).join('');
  } else {
    const pal = [...new Set(photos.map((ph) => ph.avgColor).filter(Boolean))].slice(0, 6);
    const fromPhotos = pal.map((c) => lighten(c, 0.86)).concat(pal.map((c) => darken(c, 0.55)));
    const std = ['#FFFFFF', '#F6F3EE', '#EFE6D8', '#E9DCD6', '#DDE2D6', '#D6D2CB', '#B9A893', '#6F5B4C', '#3B2E25', '#2A2A2E', '#141416', '#000000'];
    head = `<span class="small muted">Background for this spread</span>`;
    body = `<div class="sec-title">From these photos</div><div class="swatches">${fromPhotos.map((c) => `<button class="swatch ${s.bg === c ? 'on' : ''}" data-bg="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('') || '<span class="small muted">Analysing…</span>'}</div>
      <div class="sec-title">Classic</div><div class="swatches">${std.map((c) => `<button class="swatch ${s.bg === c ? 'on' : ''}" data-bg="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}</div>
      <div class="sec-title">Custom</div><div class="row"><input type="color" data-pn="bgpick" value="${esc(s.bg || '#ffffff')}" style="width:44px;height:36px;padding:0;border:0;background:none"><button class="btn" data-pn="bgall">Use on all spreads</button></div>`;
  }
  panel.innerHTML = `
    <div class="panel-tabs"><div class="seg" role="tablist">
      <button role="tab" class="${tab === 'layouts' ? 'on' : ''}" data-tab="layouts">Layouts</button>
      <button role="tab" class="${tab === 'text' ? 'on' : ''}" data-tab="text">Text</button>
      <button role="tab" class="${tab === 'bg' ? 'on' : ''}" data-tab="bg">Background</button>
    </div></div>
    <div class="panel-head">${head}</div>
    <div class="panel-body">${body}</div>
    <div class="panel-head" style="border-top:1px solid var(--line);border-bottom:0">
      <div class="row" style="flex-wrap:wrap;gap:6px">
        <span class="small muted grow">Spread ${state.sel.spread + 1}</span>
        <button class="icon-btn" data-pn="moveL" aria-label="Move spread left">${ICON.left}</button>
        <button class="icon-btn" data-pn="moveR" aria-label="Move spread right">${ICON.right}</button>
        <button class="icon-btn" data-pn="lock" aria-label="${s.locked ? 'Unlock' : 'Lock'} spread" style="${s.locked ? 'color:var(--gold)' : ''}">${ICON.lock}</button>
        <button class="icon-btn" data-pn="delete" aria-label="Delete spread">${ICON.trash}</button>
      </div>
    </div>`;
}

function darken(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(c * (1 - amt)).toString(16).padStart(2, '0');
  return '#' + f((n >> 16) & 255) + f((n >> 8) & 255) + f(n & 255);
}

function wirePanel() {
  const panel = $('#r-panel');
  const isFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  panel.addEventListener('dragover', (e) => {
    if (!isFiles(e) || state.panelTab !== 'text') return;
    e.preventDefault(); e.stopPropagation();
    const z = panel.querySelector('[data-art-drop]'); if (z) z.classList.add('over');
  });
  panel.addEventListener('dragleave', (e) => { const z = panel.querySelector('[data-art-drop]'); if (z && !panel.contains(e.relatedTarget)) z.classList.remove('over'); });
  panel.addEventListener('drop', (e) => {
    if (!isFiles(e) || state.panelTab !== 'text') return;
    e.preventDefault(); e.stopPropagation();
    document.body.classList.remove('drag-over-app');
    const paths = [...e.dataTransfer.files].map((f) => api.photos.pathForFile(f)).filter((p) => /\.(png|psd|psb)$/i.test(p || ''));
    if (!paths.length) { toast('Drop PNG or PSD files to add word art.', true); refresh(['panel']); return; }
    importArt(null, paths);
  });
  panel.addEventListener('click', (e) => {
    const del = e.target.closest('[data-art-del]');
    if (del) {
      e.stopPropagation();
      if (!confirm('Remove this word art from My word art? Spreads that use it will show an empty box.')) return;
      const list = state.settings.userWordArt || [];
      const it = list.find((x) => x.id === del.dataset.artDel);
      api.settings.set({ userWordArt: list.filter((x) => x.id !== del.dataset.artDel) }).then((x) => { state.settings = x; if (it) api.wordart.remove(it.path); refresh(['panel']); });
      return;
    }
    const hide = e.target.closest('[data-art-hide],[data-art-unhide]');
    if (hide) {
      e.stopPropagation();
      const id = hide.dataset.artHide || hide.dataset.artUnhide;
      const cur = new Set(state.settings.hiddenWordArt || []);
      if (hide.dataset.artHide) cur.add(id); else cur.delete(id);
      api.settings.set({ hiddenWordArt: [...cur] }).then((x) => { state.settings = x; refresh(['panel']); });
      if (hide.dataset.artHide) toast('Hidden from the pack. Use "Show hidden" to bring it back.');
      return;
    }
    const addArtBtn = e.target.closest('[data-art-add]');
    if (addArtBtn) { addArt(addArtBtn.dataset.artAdd); return; }
    const t = e.target.closest('[data-tab],[data-pn],[data-layout],[data-tp],[data-bg],[data-sub],[data-deltpl]');
    if (!t) return;
    const p = P(); const si = state.sel.spread; const s = p.spreads[si];
    if (t.dataset.sub) { state.layoutSub = t.dataset.sub; refresh(['panel']); return; }
    if (t.dataset.deltpl) {
      if (!confirm('Delete this saved template? Spreads that use it keep their layout.')) return;
      api.settings.set({ userTemplates: (state.settings.userTemplates || []).filter((u) => u.id !== t.dataset.deltpl) }).then((x) => { state.settings = x; refresh(['panel']); });
      return;
    }
    if (t.dataset.tab) { state.panelTab = t.dataset.tab; refresh(['panel']); return; }
    if (t.dataset.layout) {
      if (s.locked) return toast('This spread is locked. Unlock it to change the layout.');
      mutate(() => { p.spreads[si] = applyTemplate(s, t.dataset.layout, state.byId, p.size, p.build.style, state.settings.userTemplates, { couple: p.couple, date: p.date, title: s.section }); }, ['stage', 'panel', 'strip']);
      return;
    }
    if (t.dataset.bg) { mutate(() => { s.bg = t.dataset.bg; }, ['stage', 'panel', 'strip']); return; }
    if (t.dataset.tp) {
      const [g, k] = t.dataset.tp.split('|');
      const it = TEXT_PACKS.find((x) => x.group === g).items[+k];
      addText(it.t, it.font, it.note && g === 'Quotes' ? it.note : null);
      return;
    }
    const a = t.dataset.pn;
    if (a === 'plus') changeCount(1);
    if (a === 'minus') changeCount(-1);
    if (a === 'ideas') { state.layoutPage++; refresh(['panel']); }
    if (a === 'addtext') addText('Your text', 'serif');
    if (a === 'savetpl') saveAsTemplate(s);
    if (a === 'importpng') importArt('png');
    if (a === 'importpsd') importArt('psd');
    if (a === 'showhidden') { state.showHiddenArt = !state.showHiddenArt; refresh(['panel']); }
    if (a === 'bgall') { const c = s.bg; mutate(() => p.spreads.forEach((x) => { x.bg = c; }), ['stage', 'strip']); toast('Background used on all spreads'); }
    if (a === 'lock') mutate(() => { s.locked = !s.locked; }, ['stage', 'panel']);
    if (a === 'delete') { if (confirm('Delete this spread? Its photos go back to the browser.')) mutate(() => { p.spreads.splice(si, 1); }); }
    if (a === 'moveL' && si > 0) mutate(() => { p.spreads.splice(si - 1, 0, p.spreads.splice(si, 1)[0]); state.sel.spread = si - 1; }, ['stage', 'panel', 'strip']);
    if (a === 'moveR' && si < p.spreads.length - 1) mutate(() => { p.spreads.splice(si + 1, 0, p.spreads.splice(si, 1)[0]); state.sel.spread = si + 1; }, ['stage', 'panel', 'strip']);
  });
  panel.addEventListener('input', (e) => {
    if (e.target.dataset.pn === 'bgpick') {
      const s = curSpread(); s.bg = e.target.value;
      const el = document.querySelector(`#r-stage [data-spread="${state.sel.spread}"]`);
      if (el) el.style.background = s.bg;
    }
  });
  panel.addEventListener('change', (e) => {
    if (e.target.dataset.pn === 'bgpick') { snapshot(); saveSoon(); refresh(['strip', 'panel']); }
  });
}

function addArt(src) {
  const s = curSpread();
  const info = artInfo(src);
  if (!s || !info) return;
  const A = sizeInfo(P().size).aspect;
  const ar = info.h / info.w;
  let w = 0.3;
  if (w * A * ar > 0.7) w = 0.7 / (A * ar);           // keep tall art inside the page
  mutate(() => {
    s.arts = s.arts || [];
    s.arts.push({ id: uid(), src, x: 0.75 - w / 2, y: 0.5 - (w * A * ar) / 2, w, ar, color: null, opacity: 1 });
    state.sel = { spread: state.sel.spread, cell: null, text: null, art: s.arts.length - 1 };
  }, ['stage', 'strip']);
  if (state.mode !== 'designer') toast('Word art added. Select it to change the colour or size.');
}

async function importArt(kind, paths) {
  let res;
  try { res = paths ? await api.wordart.importPaths(paths) : await api.wordart.import(kind); }
  catch (err) { toast('Could not read the file: ' + err.message, true); return; }
  if (!res.items.length) { if (res.skipped.length) toast('No word art layers found in that file.', true); return; }
  state.settings = await api.settings.set({ userWordArt: [...res.items, ...(state.settings.userWordArt || [])] });
  refresh(['panel']);
  toast(`${res.items.length} word art layer${res.items.length > 1 ? 's' : ''} added to My word art${res.skipped.length ? ` · ${res.skipped.length} photo/background layer${res.skipped.length > 1 ? 's' : ''} skipped` : ''}.`);
}

async function saveAsTemplate(s) {
  const list = state.settings.userTemplates || [];
  const cells = s.cells.map((c) => ({ x: +c.x.toFixed(5), y: +c.y.toFixed(5), w: +c.w.toFixed(5), h: +c.h.toFixed(5) }));
  const sig = JSON.stringify(cells);
  if (list.some((u) => JSON.stringify(u.cells) === sig)) { toast('This layout is already in My templates.'); return; }
  const tpl = { id: 'u:' + uid(), name: `My layout ${list.length + 1} · ${cells.length} photos`, count: cells.length, cells, createdAt: Date.now() };
  state.settings = await api.settings.set({ userTemplates: [tpl, ...list] });
  s.layoutId = tpl.id; saveSoon();
  state.layoutSub = 'mine';
  refresh(['panel']);
  toast('Saved to My templates. Auto Build can use it too.');
}

function addText(text, font, sub) {
  const p = P(); const s = curSpread();
  if (!s) return;
  mutate(() => {
    s.texts = s.texts || [];
    const dark = isDark(s.bg);
    s.texts.push({ id: uid(), text: sub ? text + '\n— ' + sub : text, x: 0.56, y: 0.42, w: 0.36, size: text.length > 30 ? 0.035 : 0.06, font, color: dark ? '#FFFFFF' : '#3B3026', align: 'center' });
    state.sel.text = s.texts.length - 1; state.sel.cell = null;
  }, ['stage', 'strip']);
  if (state.mode !== 'designer') toast('Text added. Switch to Designer to fine-tune it.');
}

function isDark(hex) {
  const n = parseInt((hex || '#ffffff').slice(1), 16);
  return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) < 110;
}

// ================= STRIP =================
function renderStrip(opts = {}) {
  const p = P();
  const strip = $('#r-strip');
  const sl = strip.scrollLeft;
  strip.innerHTML = p.spreads.map((s, i) => `
    <button class="strip-item ${i === state.sel.spread ? 'on' : ''}" data-strip="${i}" aria-label="Spread ${i + 1}">
      ${spreadHTML(s, p, state.byId, { height: 54 })}
      <span>${String(i + 1).padStart(2, '0')}</span>
    </button>`).join('') + `<button class="strip-add" data-strip="add" aria-label="Add spread" title="Add a spread with unused photos">+</button>`;
  strip.scrollLeft = sl;
  if (opts.scroll) {
    const el = strip.querySelector(`[data-strip="${state.sel.spread}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
}

function wireStrip() {
  const strip = $('#r-strip');
  strip.addEventListener('click', (e) => {
    const b = e.target.closest('[data-strip]');
    if (!b) return;
    if (b.dataset.strip === 'add') {
      const last = P().spreads[P().spreads.length - 1];
      const near = last ? spreadPhotos(last).slice(-1)[0] : null;
      const ph = nextUnused(3, near ? near.takenAt : null);
      if (!ph.length) return toast('No unused photos left to make a new spread.');
      newSpreadWith(ph.map((x) => x.id), P().spreads.length);
      return;
    }
    state.sel = { spread: +b.dataset.strip, cell: null, text: null };
    refresh(['stage', 'panel', 'strip'], { scroll: true });
  });
  strip.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('application/x-endora-photo')) e.preventDefault(); });
  strip.addEventListener('drop', (e) => {
    const ids = (e.dataTransfer.getData('application/x-endora-photo') || '').split(',').filter(Boolean);
    if (!ids.length) return;
    e.preventDefault();
    const b = e.target.closest('[data-strip]');
    if (b && b.dataset.strip !== 'add') addPhotosToSpread(+b.dataset.strip, ids);
    else newSpreadWith(ids, P().spreads.length);
  });
}

// ================= BROWSER =================
const FILTERS = [['all', 'All images'], ['unused', 'Not in album'], ['used', 'In album'], ['flagged', 'Flagged'], ['out', 'Left out'], ['star', 'Hero picks']];
const FLAG_LABEL = { blur: 'Blurry', dup: 'Similar', exposure: 'Exposure' };

function filteredPhotos() {
  const p = P(); const b = state.browser;
  const used = usedCounts();
  let list = p.photos;
  if (b.filter === 'unused') list = list.filter((x) => !used.has(x.id) && !x.excluded);
  if (b.filter === 'used') list = list.filter((x) => used.has(x.id));
  if (b.filter === 'flagged') list = list.filter((x) => x.flags && x.flags.length);
  if (b.filter === 'out') list = list.filter((x) => x.excluded);
  if (b.filter === 'star') list = list.filter((x) => x.star);
  if (b.part) { const ev = (p.events || []).find((e) => e.name === b.part); if (ev) { const set = new Set(ev.ids); list = list.filter((x) => set.has(x.id)); } }
  if (b.q) { const q = b.q.toLowerCase(); list = list.filter((x) => x.name.toLowerCase().includes(q)); }
  list = [...list];
  if (b.sort === 'name') list.sort((a, c) => a.name.localeCompare(c.name, undefined, { numeric: true }));
  else if (b.sort === 'best') list.sort((a, c) => (c.score ?? 0) - (a.score ?? 0));
  else list.sort((a, c) => a.takenAt - c.takenAt);
  return { list, used };
}

function renderBrowser() {
  const p = P();
  const br = $('#r-browser');
  const b = state.browser;
  const { list, used } = filteredPhotos();
  const nSel = b.sel.size;
  br.innerHTML = `
    <div class="browser-resize" id="br-resize" title="Drag to resize"></div>
    <div class="busy-wrap" id="r-busy"></div>
    <div class="browser-bar">
      <button class="btn" data-br="import">${ICON.import}Import images</button>
      <button class="btn" data-br="autobuild" style="border-color:var(--gold);color:var(--gold)">${ICON.bolt}Auto Build</button>
      <label class="check small" style="padding:0 4px"><input type="checkbox" data-br="autolayout" ${state.autoLayout ? 'checked' : ''}>Auto layout</label>
      <select data-br="filter" aria-label="Show">${FILTERS.map(([v, l]) => `<option value="${v}" ${b.filter === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select data-br="part" aria-label="Part of the day"><option value="">All parts</option>${(p.events || []).map((e) => `<option ${b.part === e.name ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
      ${nSel ? `<span class="small" style="margin-left:6px">${nSel} selected</span>
        <button class="btn ghost" data-br="star" style="height:30px">${ICON.star}Hero</button>
        <button class="btn ghost" data-br="leaveout" style="height:30px">Leave out</button>
        <button class="btn ghost" data-br="include" style="height:30px">Include</button>
        <button class="btn ghost" data-br="tospread" style="height:30px">${ICON.plus}Add to spread</button>
        <button class="btn ghost" data-br="clearsel" style="height:30px">${ICON.close}</button>` : ''}
      <div class="grow"></div>
      <span class="small muted">${fmtNum(list.length)} of ${fmtNum(p.photos.length)} · ${fmtNum(used.size)} used</span>
      <select data-br="sort" aria-label="Sort"><option value="time" ${b.sort === 'time' ? 'selected' : ''}>Sort by time taken</option><option value="name" ${b.sort === 'name' ? 'selected' : ''}>Sort by file name</option><option value="best" ${b.sort === 'best' ? 'selected' : ''}>Best first</option></select>
      <input type="search" data-br="q" placeholder="Search" value="${esc(b.q)}" style="width:130px">
      <input type="range" data-br="thumb" min="64" max="200" step="8" value="${b.thumb}" aria-label="Thumbnail size" style="width:90px">
    </div>
    <div class="browser-grid" id="br-grid" style="--thumb:${b.thumb}px">
      ${list.map((ph) => {
        const u = used.get(ph.id) || 0;
        const flag = ph.flags && ph.flags.length ? FLAG_LABEL[ph.flags[0]] : '';
        return `<div class="ph ${u ? 'used' : ''} ${ph.excluded ? 'excluded' : ''} ${b.sel.has(ph.id) ? 'sel' : ''}" data-ph="${esc(ph.id)}" draggable="true" title="${esc(ph.name)}">
          <div class="im"><img src="${esc(api.fileUrl(ph.thumb))}" alt="" loading="lazy" decoding="async"></div>
          <span class="nm">${esc(ph.name)}</span>
          ${flag ? `<span class="tag">${flag}</span>` : ''}${u ? `<span class="used-n">${u}</span>` : ''}${ph.star ? `<span class="star">${ICON.star}</span>` : ''}
        </div>`;
      }).join('')}
    </div>
    ${!p.photos.length && !state.busy ? `<div class="drop-hint" style="top:46px">${ICON.import}<span>Drop photos or a folder anywhere in this window</span></div>` : ''}`;
  renderBusy();
}

function renderBusy() {
  const el = $('#r-busy');
  if (!el) return;
  const b = state.busy;
  el.innerHTML = b ? `<div class="busy-bar"><span>${esc(b.label)}… ${fmtNum(b.done)} / ${fmtNum(b.total)}</span><div class="progress"><div style="width:${b.total ? (b.done / b.total) * 100 : 0}%"></div></div></div>` : '';
}

let lastClicked = null;
function wireBrowser() {
  const br = $('#r-browser');
  br.addEventListener('click', (e) => {
    const t = e.target.closest('[data-br],[data-ph]');
    if (!t) return;
    const b = state.browser; const p = P();
    if (t.dataset.ph) {
      const id = t.dataset.ph;
      if (e.shiftKey && lastClicked) {
        const { list } = filteredPhotos();
        const a = list.findIndex((x) => x.id === lastClicked), c = list.findIndex((x) => x.id === id);
        list.slice(Math.min(a, c), Math.max(a, c) + 1).forEach((x) => b.sel.add(x.id));
      } else if (e.metaKey || e.ctrlKey) { b.sel.has(id) ? b.sel.delete(id) : b.sel.add(id); }
      else { const only = b.sel.size === 1 && b.sel.has(id); b.sel.clear(); if (!only) b.sel.add(id); }
      lastClicked = id;
      refresh(['browser']);
      return;
    }
    const a = t.dataset.br;
    if (a === 'import') pickImport();
    if (a === 'autobuild') autoBuildModal();
    if (a === 'clearsel') { b.sel.clear(); refresh(['browser']); }
    if (a === 'star') { const all = [...b.sel].every((id) => state.byId.get(id).star); b.sel.forEach((id) => { state.byId.get(id).star = !all; }); saveSoon(); refresh(['browser']); }
    if (a === 'leaveout' || a === 'include') { b.sel.forEach((id) => { const ph = state.byId.get(id); ph.manual = a === 'leaveout' ? 'drop' : 'keep'; }); recull(); refresh(['browser']); }
    if (a === 'tospread') { if (!p.spreads.length) newSpreadWith([...b.sel], 0); else addPhotosToSpread(state.sel.spread, [...b.sel]); b.sel.clear(); }
  });
  br.addEventListener('dblclick', (e) => {
    const t = e.target.closest('[data-ph]');
    if (t && P().spreads.length) addPhotosToSpread(state.sel.spread, [t.dataset.ph]);
  });
  br.addEventListener('change', (e) => {
    const a = e.target.dataset.br; const b = state.browser;
    if (a === 'filter') { b.filter = e.target.value; refresh(['browser']); }
    if (a === 'part') { b.part = e.target.value; refresh(['browser']); }
    if (a === 'sort') { b.sort = e.target.value; refresh(['browser']); }
    if (a === 'autolayout') state.autoLayout = e.target.checked;
    if (a === 'thumb') api.settings.set({ thumb: b.thumb });
  });
  br.addEventListener('input', (e) => {
    const a = e.target.dataset.br; const b = state.browser;
    if (a === 'thumb') { b.thumb = +e.target.value; $('#br-grid').style.setProperty('--thumb', b.thumb + 'px'); }
    if (a === 'q') { b.q = e.target.value; clearTimeout(br._q); br._q = setTimeout(() => { refresh(['browser']); const q = br.querySelector('[data-br=q]'); q.focus(); q.setSelectionRange(b.q.length, b.q.length); }, 250); }
  });
  br.addEventListener('dragstart', (e) => {
    const t = e.target.closest('[data-ph]');
    if (!t) return;
    const b = state.browser;
    const ids = b.sel.has(t.dataset.ph) ? [...b.sel] : [t.dataset.ph];
    e.dataTransfer.setData('application/x-endora-photo', ids.join(','));
    e.dataTransfer.effectAllowed = 'copy';
    const img = t.querySelector('img'); if (img) e.dataTransfer.setDragImage(img, 20, 20);
  });
  // resize handle
  br.addEventListener('pointerdown', (e) => {
    if (e.target.id !== 'br-resize') return;
    const ws = $('#ws'); const y0 = e.clientY; const h0 = state.settings.browserH || 250;
    const mv = (ev) => { const h = Math.max(120, Math.min(window.innerHeight - 320, h0 - (ev.clientY - y0))); state.settings.browserH = h; ws.style.setProperty('--browser-h', h + 'px'); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); api.settings.set({ browserH: state.settings.browserH }); refresh(['stage']); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
}

async function pickImport() {
  const paths = await api.photos.pick('folder');
  if (paths.length) importPaths(paths);
}

function wireAppDrop() {
  const ws = $('#ws');
  let depth = 0;
  const isFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  ws.addEventListener('dragenter', (e) => { if (isFiles(e)) { depth++; document.body.classList.add('drag-over-app'); } });
  ws.addEventListener('dragleave', (e) => { if (isFiles(e) && --depth <= 0) { depth = 0; document.body.classList.remove('drag-over-app'); } });
  ws.addEventListener('dragover', (e) => { if (isFiles(e)) e.preventDefault(); });
  ws.addEventListener('drop', async (e) => {
    if (!isFiles(e)) return;
    e.preventDefault(); depth = 0; document.body.classList.remove('drag-over-app');
    const paths = [...e.dataTransfer.files].map((f) => api.photos.pathForFile(f)).filter(Boolean);
    const expanded = await api.photos.expandDropped(paths);
    if (!expanded.length) return toast('No photos found. Use JPG, PNG, WebP or TIFF files.', true);
    importPaths(expanded);
  });
}

export { TEMPLATES };
