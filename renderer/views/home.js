import { state, openProject, render } from '../app.js';
import { esc, fmtNum, ICON, toast } from '../lib/dom.js';
import { newAlbumModal, settingsModal } from './modals.js';

const STATUSES = ['All', 'Designing', 'Client review', 'Approved', 'Printing'];
let filter = 'All';
let query = '';

export function renderHome(root) {
  const list = state.projects.filter((p) => (filter === 'All' || p.status === filter) &&
    (!query || (p.couple + ' ' + (p.date || '')).toLowerCase().includes(query.toLowerCase())));
  root.innerHTML = `
  <div class="home">
    <header class="home-top">
      <div class="brand"><span class="logo">E</span>Endora <b>Album</b></div>
      <div class="grow"></div>
      <button class="icon-btn" data-act="theme" aria-label="Switch light or dark">${state.settings.theme === 'light' ? ICON.moon : ICON.sun}</button>
      <button class="btn" data-act="settings">${ICON.user}${esc(state.settings.studio || 'Settings')}</button>
    </header>
    <main class="home-main">
      <div class="row" style="justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:14px">
        <div class="col" style="gap:4px"><h1>Albums</h1><span class="muted">Every wedding album, from first import to the print lab.</span></div>
        <div class="row">
          <input type="search" id="home-q" placeholder="Search couple or date" value="${esc(query)}" style="width:230px;height:40px">
          <button class="btn lg gold" data-act="new">${ICON.plus}New album</button>
        </div>
      </div>
      <div class="row" role="tablist" aria-label="Status" style="flex-wrap:wrap">
        ${STATUSES.map((s) => `<button class="chip ${filter === s ? 'on' : ''}" data-filter="${s}">${s} ${s === 'All' ? state.projects.length : state.projects.filter((p) => p.status === s).length}</button>`).join('')}
      </div>
      ${state.projects.length === 0 ? `
        <div class="empty">
          <span class="logo" style="width:54px;height:54px;font-size:26px">E</span>
          <h2 style="margin:0;font-family:var(--serif);font-size:28px">Create your first album</h2>
          <span class="muted">Add as many photos as you like. Endora picks the best ones and designs the spreads for you.</span>
          <button class="btn lg gold" data-act="new">${ICON.plus}New album</button>
        </div>` : `
      <div class="cards">
        ${list.map((p) => `
          <div class="card" role="button" tabindex="0" data-open="${esc(p.id)}">
            <div class="cover" style="${p.cover ? `background-image:url('${esc(window.api.fileUrl(p.cover))}')` : ''}"></div>
            <div class="body">
              <div class="row" style="justify-content:space-between"><span class="name">${esc(p.couple)}</span><span class="badge st-${esc(String(p.status).replace(/ /g, '-'))}">${esc(p.status)}</span></div>
              <div class="row muted small" style="flex-wrap:wrap;gap:12px">
                <span>${esc(p.date || '')}</span><span>${fmtNum(p.photoCount)} photos</span><span>${p.spreadCount} spreads</span><span>${esc(p.size ? sizeLabel(p.size) : '')}</span>
                <span class="grow"></span>
                <button class="icon-btn" data-del="${esc(p.id)}" aria-label="Delete album">${ICON.trash}</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`}
    </main>
  </div>`;

  root.onclick = async (e) => {
    const t = e.target.closest('[data-act],[data-filter],[data-open],[data-del]');
    if (!t) return;
    if (t.dataset.del) {
      e.stopPropagation();
      const p = state.projects.find((x) => x.id === t.dataset.del);
      if (!confirm(`Delete the album "${p.couple}"? Your original photos are not touched.`)) return;
      await window.api.projects.remove(p.id);
      state.projects = state.projects.filter((x) => x.id !== p.id);
      render(); toast('Album deleted');
      return;
    }
    if (t.dataset.open) return openProject(t.dataset.open);
    if (t.dataset.filter) { filter = t.dataset.filter; render(); return; }
    const a = t.dataset.act;
    if (a === 'new') newAlbumModal();
    if (a === 'settings') settingsModal();
    if (a === 'theme') {
      state.settings = await window.api.settings.set({ theme: state.settings.theme === 'light' ? 'dark' : 'light' });
      render();
    }
  };
  root.onkeydown = (e) => { const c = e.target.closest('[data-open]'); if (c && e.key === 'Enter') openProject(c.dataset.open); };
  const q = root.querySelector('#home-q');
  q.oninput = () => { query = q.value; const pos = q.selectionStart; render(); const n = document.getElementById('home-q'); n.focus(); n.setSelectionRange(pos, pos); };
}

export function sizeLabel(s) {
  if (!s) return '';
  const u = s.unit && s.unit !== 'in' ? ' ' + s.unit : '';
  return `${s.h}×${s.w}${u}`;
}
