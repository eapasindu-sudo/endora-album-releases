// Dialogs: new album, album size, sign in, Auto Build, Print check / Export, Send to client.
import { state, createProject, mutate, saveSoon, saveImmediately, recull, render, usedCounts } from '../app.js';
import { refresh } from './workspace.js';
import { esc, fmtNum, ICON, toast } from '../lib/dom.js';
import { STANDARD_SIZES, sizeInfo, autoBuild, usablePhotos, suggestSpreads, printChecks, focalFor, pickForId, MAX_PER_SPREAD } from '../lib/layout.js';
import { SECTION_NAMES, SECTION_TITLES_SI } from '../lib/textpacks.js';
import { spreadHTML } from '../lib/render-spread.js';
import { exportAlbum } from '../lib/exporter.js';
import { publishAlbum, fetchFeedback, setLinkActive, resolveComment } from '../lib/cloud.js';
import { hasFaceDetection } from '../lib/analysis.js';
import { MATERIALS, COVER_STYLES, defaultCoverOptions, coverHTML, coverSummary } from '../lib/covers.js';

const api = window.api;

export function openModal(html, cls = '') {
  const root = document.getElementById('modal-root');
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  root.appendChild(ov);
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape' && !ov.dataset.locked) close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov && !ov.dataset.locked) close(); });
  const first = ov.querySelector('input,button.gold,button');
  if (first) setTimeout(() => first.focus(), 30);
  return { el: ov.querySelector('.modal'), ov, close };
}

const head = (title, sub) => `<div class="modal-head"><div class="grow"><h2>${title}</h2>${sub ? `<div class="small muted" style="margin-top:3px">${sub}</div>` : ''}</div><button class="icon-btn" data-x aria-label="Close">${ICON.close}</button></div>`;

// ============ size picker (shared) ============
function sizeFields(size) {
  const isStd = STANDARD_SIZES.find((s) => s.name === size.name && (size.unit || 'in') === 'in');
  const custom = !isStd;
  return `
    <div class="size-grid">${STANDARD_SIZES.map((s) => `<button type="button" data-size="${s.name}" class="${!custom && size.name === s.name ? 'on' : ''}">${s.name}</button>`).join('')}
      <button type="button" data-size="custom" class="${custom ? 'on' : ''}">Custom</button></div>
    <div class="col" data-custom style="margin-top:10px;${custom ? '' : 'display:none'}">
      <div class="row" style="gap:8px;align-items:flex-end">
        <label class="field grow">Height<input type="number" name="h" min="2" max="200" step="0.1" value="${size.h}"></label>
        <label class="field grow">Spread width<input type="number" name="w" min="4" max="400" step="0.1" value="${size.w}"></label>
        <label class="field" style="width:100px">Unit<select name="unit">${['in', 'cm', 'mm'].map((u) => `<option value="${u}" ${(size.unit || 'in') === u ? 'selected' : ''}>${u === 'in' ? 'inch' : u}</option>`).join('')}</select></label>
      </div>
      ${(state.settings.presets || []).length ? `<div class="row small" style="flex-wrap:wrap">Saved: ${(state.settings.presets || []).map((p, i) => `<button type="button" class="chip" data-preset="${i}">${esc(p.h)}×${esc(p.w)} ${esc(p.unit)}</button>`).join('')}</div>` : ''}
    </div>
    <div class="row" style="gap:8px;margin-top:10px;align-items:flex-end">
      <label class="field grow">Bleed<select name="bleed">${[0, 3, 5].map((b) => `<option value="${b}" ${(size.bleedMm ?? 3) === b ? 'selected' : ''}>${b ? b + ' mm' : 'None'}</option>`).join('')}</select></label>
      <label class="field grow">Print resolution<select name="dpi">${[240, 300, 400].map((d) => `<option value="${d}" ${(size.dpi || 300) === d ? 'selected' : ''}>${d} DPI</option>`).join('')}</select></label>
    </div>
    <div class="small muted" data-sizeinfo style="margin-top:8px"></div>`;
}

function wireSize(el, size) {
  const cur = { ...size };
  const info = el.querySelector('[data-sizeinfo]');
  const upd = () => {
    const i = sizeInfo(cur);
    info.textContent = `Page ${+(cur.w / 2).toFixed(2)} × ${cur.h} ${cur.unit || 'in'} · export ${fmtNum(i.pxW)} × ${fmtNum(i.pxH)} px per spread (with bleed)`;
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-size],[data-preset]');
    if (!b) return;
    if (b.dataset.preset) {
      const p = state.settings.presets[+b.dataset.preset];
      Object.assign(cur, { h: p.h, w: p.w, unit: p.unit, name: 'Custom' });
      el.querySelector('[name=h]').value = p.h; el.querySelector('[name=w]').value = p.w; el.querySelector('[name=unit]').value = p.unit;
      upd(); return;
    }
    el.querySelectorAll('[data-size]').forEach((x) => x.classList.toggle('on', x === b));
    const box = el.querySelector('[data-custom]');
    if (b.dataset.size === 'custom') {
      box.style.display = '';
      Object.assign(cur, { name: 'Custom', h: +el.querySelector('[name=h]').value, w: +el.querySelector('[name=w]').value, unit: el.querySelector('[name=unit]').value });
    } else {
      box.style.display = 'none';
      const s = STANDARD_SIZES.find((x) => x.name === b.dataset.size);
      Object.assign(cur, { name: s.name, h: s.h, w: s.w, unit: 'in' });
    }
    upd();
  });
  el.addEventListener('input', (e) => {
    const n = e.target.name;
    if (n === 'h' || n === 'w') cur[n] = Math.max(1, +e.target.value || 1);
    if (n === 'unit') cur.unit = e.target.value;
    if (n === 'bleed') cur.bleedMm = +e.target.value;
    if (n === 'dpi') cur.dpi = +e.target.value;
    upd();
  });
  upd();
  return () => ({ ...cur, name: cur.name === 'Custom' || !STANDARD_SIZES.find((s) => s.name === cur.name) ? `${cur.h}×${cur.w}` : cur.name, custom: cur.name === 'Custom' || (cur.unit || 'in') !== 'in' || !STANDARD_SIZES.find((s) => s.h === cur.h && s.w === cur.w) });
}

async function savePreset(sz) {
  const presets = (state.settings.presets || []).filter((p) => !(p.h === sz.h && p.w === sz.w && p.unit === sz.unit));
  presets.unshift({ h: sz.h, w: sz.w, unit: sz.unit || 'in' });
  state.settings = await api.settings.set({ presets: presets.slice(0, 8) });
}

// ============ New album ============
export function newAlbumModal() {
  const size = { ...STANDARD_SIZES[0], bleedMm: 3, dpi: 300 };
  const m = openModal(`${head('New album')}
    <div class="modal-body col" style="gap:14px">
      <label class="field">Couple<input type="text" name="couple" placeholder="Nimesha &amp; Kasun" autocomplete="off"></label>
      <label class="field">Wedding date<input type="date" name="date"></label>
      <div><div class="label-cap" style="margin-top:0">Album size</div>${sizeFields(size)}</div>
      <label class="check small"><input type="checkbox" name="preset">Save this custom size for next time</label>
    </div>
    <div class="modal-foot"><div class="grow"></div><button class="btn" data-x>Cancel</button><button class="btn gold" data-ok>Create album</button></div>`, 'md');
  const getSize = wireSize(m.el, size);
  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-x]')) return m.close();
    if (!e.target.closest('[data-ok]')) return;
    const couple = m.el.querySelector('[name=couple]').value.trim() || 'New album';
    const d = m.el.querySelector('[name=date]').value;
    const sz = getSize();
    if (sz.custom && m.el.querySelector('[name=preset]').checked) await savePreset(sz);
    delete sz.custom;
    m.close();
    createProject({ couple, date: d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '', size: sz });
  });
}

// ============ change size of open album ============
export function sizeModal() {
  const p = state.project;
  const m = openModal(`${head('Album size', 'Changing the size re-fits every spread to the new shape.')}
    <div class="modal-body">${sizeFields(p.size)}
      <label class="check small" style="margin-top:10px"><input type="checkbox" name="preset">Save as a custom preset</label></div>
    <div class="modal-foot"><div class="grow"></div><button class="btn" data-x>Cancel</button><button class="btn gold" data-ok>Apply size</button></div>`, 'md');
  const getSize = wireSize(m.el, p.size);
  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-x]')) return m.close();
    if (!e.target.closest('[data-ok]')) return;
    const sz = getSize();
    if (sz.custom && m.el.querySelector('[name=preset]').checked) await savePreset(sz);
    delete sz.custom;
    m.close();
    mutate((proj) => {
      proj.size = sz;
      // re-fit cells for the new aspect, keeping each spread's photos and template
      proj.spreads = proj.spreads.map((s) => refitSpread(s, proj));
    });
    toast('Album size changed to ' + sz.name);
  });
}

function refitSpread(s, proj) {
  // hand-made layouts keep their frames; generated and built-in layouts are rebuilt for the new shape
  const photos = s.cells.map((c) => state.byId.get(c.photoId)).filter(Boolean);
  const pick = pickForId(s.layoutId, photos, proj.size, proj.build.style, state.settings.userTemplates);
  if (!pick) return s;
  return { ...s, cells: pick.cells.map((c, i) => ({ ...c, photoId: pick.order[i].id, ...focalFor(pick.order[i]), zoom: 1 })) };
}

// ============ Connect Cloudflare (one time per PC) ============
export function connectCloudModal(after) {
  let busy = null, err = null, done = null;
  const m = openModal('<div data-cc></div>', 'md');
  const draw = () => {
    m.el.querySelector('[data-cc]').innerHTML = `${head('Connect Cloudflare', 'Your client links run on your own free Cloudflare account. You do this once. On a second PC, use the same steps and the same account.')}
      <div class="modal-body col" style="gap:12px">
        ${done ? `<div class="box gold col" style="gap:6px"><b>${ICON.check} Connected${done.accountName ? ' to ' + esc(done.accountName) : ''}</b>
            <span class="small">Your client links will start with:</span><code style="font-size:13px">${esc(done.url)}/a/…</code>
            ${done.live ? '' : '<span class="small muted">The new address can take a few minutes to start working the first time.</span>'}</div>` : `
        <div class="box col" style="gap:8px">
          <div class="row"><span class="dot ok" style="background:var(--bg4);color:var(--text)">1</span><b class="grow">Make a free Cloudflare account</b><button class="btn" data-cc="signup">Open Cloudflare</button></div>
          <span class="small muted" style="padding-left:32px">Skip this if you already have one.</span>
        </div>
        <div class="box col" style="gap:8px">
          <div class="row"><span class="dot ok" style="background:var(--bg4);color:var(--text)">2</span><b class="grow">Turn on R2 storage</b><button class="btn" data-cc="r2">Open R2</button></div>
          <span class="small muted" style="padding-left:32px">Press "Purchase R2 plan". Cloudflare asks for a card, but the first 10 GB every month are free. Album photos and films are kept here.</span>
        </div>
        <div class="box col" style="gap:8px">
          <div class="row"><span class="dot ok" style="background:var(--bg4);color:var(--text)">3</span><b class="grow">Make a token for Endora Album</b><button class="btn" data-cc="token">Create token</button></div>
          <span class="small muted" style="padding-left:32px">The page opens with the right permissions ticked. Scroll down, press <b>Continue to summary</b>, then <b>Create Token</b>, and copy it.</span>
          <label class="field" style="padding-left:32px">Paste the token here<input type="password" name="token" autocomplete="off" placeholder="Paste token"></label>
        </div>
        ${busy ? `<div class="small">${esc(busy.label)}…</div><div class="progress"><div style="width:${busy.total ? (busy.done / busy.total) * 100 : 5}%"></div></div>` : ''}
        ${err ? `<div class="box" style="border-color:var(--warn);color:var(--warn)">${esc(err)}</div>` : ''}`}
      </div>
      <div class="modal-foot"><span class="small muted grow">The token is stored encrypted on this PC only.</span>
        ${done ? '<button class="btn gold" data-x>Done</button>' : `<button class="btn" data-x>Cancel</button><button class="btn gold" data-cc="go" ${busy ? 'disabled' : ''}>Connect</button>`}</div>`;
  };
  draw();
  m.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-x],[data-cc]');
    if (!t) return;
    if (t.dataset.x !== undefined) { if (busy) return; m.close(); if (done && after) after(); return; }
    const a = t.dataset.cc;
    if (a === 'signup') api.cloud.openSignup();
    if (a === 'r2') api.cloud.openR2();
    if (a === 'token') api.cloud.openTokenPage();
    if (a === 'go') {
      const token = (m.el.querySelector('[name=token]').value || '').trim();
      if (token.length < 20) { err = 'Paste the token from step 3 first.'; draw(); return; }
      err = null; busy = { label: 'Starting', done: 0, total: 8 }; m.ov.dataset.locked = '1'; draw();
      const off = api.cloud.onProgress((p) => { busy = p; draw(); const i = m.el.querySelector('[name=token]'); if (i) i.value = token; });
      try { done = await api.cloud.setup(token); state.cloud = done; toast('Cloudflare connected'); }
      catch (ex) { err = ex.message.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, ''); }
      off(); busy = null; delete m.ov.dataset.locked; draw();
      if (!done) { const i = m.el.querySelector('[name=token]'); if (i) i.value = token; }
    }
  });
}

// ============ Settings + updates ============
export function settingsModal() {
  const m = openModal('<div data-st></div>', 'sm');
  const draw = () => {
    const u = state.update;
    const status = !u ? '' : u.state === 'checking' ? 'Checking…' : u.state === 'latest' ? 'You have the newest version.'
      : u.state === 'dev' ? 'Updates work in the installed app, not in development mode.'
      : u.state === 'downloading' ? `Downloading ${u.version}… ${u.percent || 0}%` : u.state === 'ready' ? `Version ${u.version} is ready to install.`
      : u.state === 'available' ? `Version ${u.version} is available.` : u.state === 'error' ? 'Could not check: ' + u.message : '';
    m.el.querySelector('[data-st]').innerHTML = `${head('Settings')}
      <div class="modal-body col" style="gap:14px">
        <label class="field">Studio name (shown to clients on the album link)<input type="text" name="studio" value="${esc(state.settings.studio || '')}" placeholder="Endora Wedding Films"></label>
        <div class="box col" style="gap:8px">
          <div class="row"><b class="grow">Client links (Cloudflare)</b>${state.cloud && state.cloud.connected ? '<button class="btn danger" data-up="disconnect">Disconnect</button>' : '<button class="btn gold" data-up="connect">Connect Cloudflare</button>'}</div>
          <span class="small muted">${state.cloud && state.cloud.connected ? 'Connected' + (state.cloud.accountName ? ' to ' + esc(state.cloud.accountName) : '') + ' · ' + esc(state.cloud.url) : 'Not connected yet. Needed for Send to client.'}</span>
        </div>
        <div class="box col" style="gap:8px">
          <div class="row"><b class="grow">Endora Album ${esc(state.version || '')}</b>
            ${u && u.state === 'ready' ? '<button class="btn gold" data-up="install">Restart &amp; update</button>' : u && u.state === 'available' ? '<button class="btn gold" data-up="download">Download update</button>' : '<button class="btn" data-up="check">Check for updates</button>'}</div>
          ${status ? `<span class="small muted">${esc(status)}</span>` : ''}
        </div>
      </div>
      <div class="modal-foot"><div class="grow"></div><button class="btn gold" data-x>Done</button></div>`;
  };
  draw();
  const off = setInterval(draw, 1000);
  const close = () => { clearInterval(off); m.close(); };
  m.el.addEventListener('change', async (e) => {
    if (e.target.name === 'studio') { state.settings = await api.settings.set({ studio: e.target.value.trim() }); if (state.view === 'home') render(); }
  });
  m.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-x],[data-up]');
    if (!t) return;
    if (t.dataset.x !== undefined) {
      const inp = m.el.querySelector('[name=studio]');
      if (inp && inp.value.trim() !== (state.settings.studio || '')) state.settings = await api.settings.set({ studio: inp.value.trim() });
      close(); if (state.view === 'home') render(); return;
    }
    if (t.dataset.up === 'connect') { close(); connectCloudModal(() => settingsModal()); return; }
    if (t.dataset.up === 'disconnect') {
      if (!confirm('Disconnect this PC from Cloudflare? Links you already sent keep working.')) return;
      await api.cloud.disconnect(); state.cloud = { connected: false }; draw(); return;
    }
    if (t.dataset.up === 'check') { state.update = { state: 'checking' }; draw(); const r = await api.updates.check(); if (r && r.state !== 'checking') state.update = r; draw(); }
    if (t.dataset.up === 'install') api.updates.install();
    if (t.dataset.up === 'download') api.updates.download();
  });
}

// Small banner in the corner when an update is downloading or ready.
export function renderUpdateBanner() {
  const root = document.getElementById('update-root');
  const u = state.update;
  if (!u || !['downloading', 'ready', 'available'].includes(u.state) || state.updateDismissed === u.version + u.state) { root.innerHTML = ''; return; }
  const msg = u.state === 'downloading' ? `Downloading Endora Album ${esc(u.version)}… ${u.percent || 0}%`
    : u.state === 'ready' ? `Endora Album ${esc(u.version)} is ready.` : `Endora Album ${esc(u.version)} is available.`;
  const btn = u.state === 'ready' ? '<button class="btn gold" data-ub="install">Restart &amp; update</button>'
    : u.state === 'available' ? '<button class="btn gold" data-ub="download">Download</button>' : '';
  root.innerHTML = `<div class="update-banner">${ICON.export}<span class="grow">${msg}</span>${btn}<button class="icon-btn" data-ub="hide" aria-label="Hide">${ICON.close}</button></div>`;
  root.onclick = async (e) => {
    const b = e.target.closest('[data-ub]'); if (!b) return;
    if (b.dataset.ub === 'install') { await saveImmediately(); api.updates.install(); }
    if (b.dataset.ub === 'download') api.updates.download();
    if (b.dataset.ub === 'hide') { state.updateDismissed = u.version + u.state; root.innerHTML = ''; }
  };
}

// ============ Auto Build ============
const STYLE_INFO = {
  Classic: ['Classic', 'Even grids, white borders, calm'],
  Modern: ['Modern', 'Big full-bleed photos, bold'],
  Magazine: ['Magazine', 'Mixed sizes, editorial rhythm'],
  Minimal: ['Fine Art', 'Few photos, lots of space']
};
const STYLE_PV = {
  Classic: '<i style="left:6%;top:12%;width:40%;height:76%"></i><i style="left:54%;top:12%;width:19%;height:36%"></i><i style="left:75%;top:12%;width:19%;height:36%"></i><i style="left:54%;top:52%;width:40%;height:36%"></i>',
  Modern: '<i style="left:0;top:0;width:62%;height:100%"></i><i style="left:63%;top:0;width:37%;height:49%"></i><i style="left:63%;top:51%;width:37%;height:49%"></i>',
  Magazine: '<i style="left:5%;top:10%;width:28%;height:80%"></i><i style="left:35%;top:10%;width:14%;height:38%"></i><i style="left:35%;top:52%;width:14%;height:38%"></i><i style="left:55%;top:10%;width:40%;height:50%"></i><i style="left:55%;top:64%;width:19%;height:26%"></i><i style="left:76%;top:64%;width:19%;height:26%"></i>',
  Minimal: '<i style="left:12%;top:20%;width:26%;height:60%"></i><i style="left:62%;top:20%;width:26%;height:60%"></i>'
};

export function autoBuildModal() {
  const p = state.project;
  if (!p.photos.length) { toast('Import photos first.'); return; }
  const b = p.build;
  const m = openModal('<div data-ab></div>');
  const locked = () => p.spreads.filter((s) => s.locked);

  const draw = () => {
    const skip = new Set(locked().flatMap((s) => s.cells.map((c) => c.photoId)));
    const usable = usablePhotos(p.photos, { starsOnly: b.opts.starsOnly, skip });
    const analysed = p.photos.filter((x) => x.sharpness != null).length;
    const flagged = { blur: 0, dup: 0, exposure: 0 };
    p.photos.forEach((x) => (x.flags || []).forEach((f) => { flagged[f]++; }));
    const leftOut = p.photos.filter((x) => x.excluded).length;
    const spreads = b.unit === 'pages' ? Math.ceil(b.spreads / 2) : b.spreads;
    const per = b.useEvery ? `${Math.max(1, Math.floor(usable.length / Math.max(1, spreads - locked().length)))}–${Math.min(MAX_PER_SPREAD, Math.ceil(usable.length / Math.max(1, spreads - locked().length)))}`
      : b.perSpread === 'range' ? `${b.min} to ${b.max}` : { Classic: '3 to 6', Modern: '3 to 6', Magazine: '4 to 7', Minimal: '1 to 3' }[b.style];
    const busy = state.busy;
    m.el.querySelector('[data-ab]').innerHTML = `
    ${head(`${ICON.bolt} Auto Build`, 'Endora reads every photo (time, faces, sharpness and the parts of the day) and designs the album with AI layouts made for your photos.')}
    <div class="modal-body"><div class="two">
      <div>
        <div class="box" style="padding:10px 12px">
          <div class="row small">${busy ? `<span>${esc(busy.label)}… ${fmtNum(busy.done)} / ${fmtNum(busy.total)}</span>` : `<span style="color:var(--ok)">${ICON.check}</span><span>All ${fmtNum(analysed)} photos analysed${hasFaceDetection() ? ' · faces found for safe crops' : ''}</span>`}</div>
          <div class="progress" style="margin-top:8px"><div style="width:${busy ? (busy.done / busy.total) * 100 : 100}%"></div></div>
        </div>
        <div class="label-cap">Style</div>
        <div class="style-cards">${Object.keys(STYLE_INFO).map((k) => `<button class="style-card ${b.style === k ? 'on' : ''}" data-style="${k}"><div class="pv">${STYLE_PV[k]}</div><b>${STYLE_INFO[k][0]}</b><span>${STYLE_INFO[k][1]}</span></button>`).join('')}</div>
        <div class="label-cap">Album</div>
        <div class="bignum">
          <div class="box"><strong>${spreads}</strong><span class="small muted">Spreads (${spreads * 2} pages)</span></div>
          <div class="box"><strong>${per}</strong><span class="small muted">Photos per spread</span></div>
        </div>
        <div class="row" style="margin-top:10px">
          <div class="seg"><button class="${b.unit !== 'pages' ? 'on' : ''}" data-unit="spreads">Spreads</button><button class="${b.unit === 'pages' ? 'on' : ''}" data-unit="pages">Pages</button></div>
          <input type="range" class="grow" name="count" min="${b.unit === 'pages' ? 4 : 2}" max="${b.unit === 'pages' ? 160 : 80}" step="${b.unit === 'pages' ? 2 : 1}" value="${b.spreads}" aria-label="Album length">
          <input type="number" name="countn" min="1" max="160" value="${b.spreads}" style="width:64px" aria-label="Album length number">
          <button class="btn ghost" data-suggest style="color:var(--gold)">Suggest</button>
        </div>
        <div class="row" style="margin-top:12px;justify-content:space-between">
          <span class="small">Photos per spread</span>
          <div class="seg"><button class="${b.perSpread !== 'range' ? 'on' : ''}" data-per="smart">Smart</button><button class="${b.perSpread === 'range' ? 'on' : ''}" data-per="range">Range</button></div>
        </div>
        ${b.perSpread === 'range' ? `<div class="row" style="margin-top:8px;justify-content:flex-end"><span class="small muted">from</span><input type="number" name="min" min="1" max="${MAX_PER_SPREAD}" value="${b.min}" style="width:56px"><span class="small muted">to</span><input type="number" name="max" min="1" max="${MAX_PER_SPREAD}" value="${b.max}" style="width:56px"></div>` : ''}
        <label class="box gold check" style="margin-top:12px"><input type="checkbox" name="useEvery" ${b.useEvery ? 'checked' : ''}><span><b style="color:var(--gold)">Use every photo</b>: all ${fmtNum(usable.length)} kept photos go into these ${spreads} spreads.<br><span class="small muted">Off: Auto Build picks the best ones and leaves out blurry and repeat shots.</span></span></label>
        <div class="row" style="margin-top:12px;justify-content:space-between">
          <span class="small">Template reuse</span>
          <div class="seg">${['Low', 'Medium', 'High'].map((r) => `<button class="${b.reuse === r ? 'on' : ''}" data-reuse="${r}">${r}</button>`).join('')}</div>
        </div>
        <div class="row" style="margin-top:12px;justify-content:space-between">
          <span class="small">Album size</span>
          <span class="small"><b>${esc(p.size.name)}</b> ${esc(p.size.unit && p.size.unit !== 'in' ? p.size.unit : 'in')} · <a href="#" data-resize>Change</a></span>
        </div>
      </div>
      <div>
        <div class="label-cap" style="margin-top:0">Smart choices</div>
        <label class="check"><input type="checkbox" data-cull="blur" ${p.cull.blur ? 'checked' : ''}>Leave out blurry photos <span class="muted">(${flagged.blur})</span></label>
        <label class="check"><input type="checkbox" data-cull="dup" ${p.cull.dup ? 'checked' : ''}>Keep only the best of similar shots <span class="muted">(${flagged.dup})</span></label>
        <label class="check"><input type="checkbox" data-cull="exposure" ${p.cull.exposure ? 'checked' : ''}>Leave out too dark or too bright <span class="muted">(${flagged.exposure})</span></label>
        <label class="check"><input type="checkbox" data-opt="newSpreadPerPart" ${b.opts.newSpreadPerPart ? 'checked' : ''}>Start a new spread at each part of the day</label>
        <label class="check"><input type="checkbox" data-opt="hero" ${b.opts.hero ? 'checked' : ''}>Open each part with a big hero photo</label>
        <label class="check"><input type="checkbox" data-opt="text" ${b.opts.text ? 'checked' : ''}>Add part titles from the Text Pack</label>
        ${b.opts.text ? `<div class="row small" style="padding-left:25px"><div class="seg"><button class="${b.titleLang !== 'en' ? 'on' : ''}" data-lang="si">සිංහල</button><button class="${b.titleLang === 'en' ? 'on' : ''}" data-lang="en">English</button></div></div>` : ''}
        <label class="check"><input type="checkbox" data-opt="color" ${b.opts.color ? 'checked' : ''}>Match background colour to the photos</label>
        <label class="check"><input type="checkbox" data-opt="starsOnly" ${b.opts.starsOnly ? 'checked' : ''}>Use only my hero ★ photos</label>
        <label class="check"><input type="checkbox" data-opt="myTemplates" ${b.opts.myTemplates !== false ? 'checked' : ''}>Use My templates too <span class="muted">(${(state.settings.userTemplates || []).length} saved)</span></label>
        <div class="small muted" style="margin:4px 0 0 25px">Hero ★ photos are always preferred. Locked spreads stay as they are.</div>
        <div class="label-cap">Parts of the day</div>
        <div class="box" style="max-height:210px;overflow:auto">
          ${(p.events || []).map((ev, i) => `<div class="part-row"><input type="text" list="part-names" data-part="${i}" value="${esc(ev.name)}" aria-label="Part ${i + 1} name"><span class="small muted" style="text-align:right">${fmtNum(ev.ids.length)} photos</span></div>`).join('') || '<span class="small muted">Parts appear after import.</span>'}
          <datalist id="part-names">${SECTION_NAMES.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        </div>
        <div class="box" style="margin-top:12px"><div class="stats">
          <div><strong>${spreads}</strong><span>spreads</span></div>
          <div><strong>${fmtNum(usable.length)}</strong><span>photos</span></div>
          <div><strong>${(p.events || []).length}</strong><span>parts</span></div>
          <div><strong>${fmtNum(leftOut)}</strong><span>left out</span></div>
          <div><strong>${fmtNum(flagged.dup)}</strong><span>similar</span></div>
        </div></div>
      </div>
    </div></div>
    <div class="modal-foot">
      <span class="small muted grow">${p.spreads.length ? 'Building again replaces the current spreads (except locked ones). You can undo.' : ''}</span>
      <button class="btn" data-x>Cancel</button>
      <button class="btn gold" data-build ${busy || !usable.length ? 'disabled' : ''}>${ICON.wand}Build album</button>
    </div>`;
  };
  draw();
  const poll = setInterval(() => { if (state.busy) draw(); }, 600);
  const close = () => { clearInterval(poll); m.close(); };

  m.el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-x],[data-style],[data-unit],[data-suggest],[data-per],[data-reuse],[data-resize],[data-build],[data-lang]');
    if (!t) return;
    if (t.dataset.x !== undefined) return close();
    if (t.dataset.style) b.style = t.dataset.style;
    if (t.dataset.unit && t.dataset.unit !== b.unit) { b.spreads = t.dataset.unit === 'pages' ? b.spreads * 2 : Math.ceil(b.spreads / 2); b.unit = t.dataset.unit; }
    if (t.dataset.suggest !== undefined) {
      const n = suggestSpreads(usablePhotos(p.photos, { starsOnly: b.opts.starsOnly }).length, b.style);
      b.spreads = b.unit === 'pages' ? n * 2 : n;
    }
    if (t.dataset.per) b.perSpread = t.dataset.per;
    if (t.dataset.reuse) b.reuse = t.dataset.reuse;
    if (t.dataset.lang) b.titleLang = t.dataset.lang;
    if (t.dataset.resize !== undefined) { e.preventDefault(); close(); sizeModal(); return; }
    if (t.dataset.build !== undefined) { close(); runBuild(); return; }
    saveSoon(); draw();
  });
  m.el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.cull) { p.cull[t.dataset.cull] = t.checked; recull(); }
    if (t.dataset.opt) b.opts[t.dataset.opt] = t.checked;
    if (t.name === 'useEvery') b.useEvery = t.checked;
    if (t.name === 'min') b.min = Math.max(1, Math.min(MAX_PER_SPREAD, +t.value || 1));
    if (t.name === 'max') b.max = Math.max(b.min, Math.min(MAX_PER_SPREAD, +t.value || 1));
    if (t.name === 'countn') b.spreads = Math.max(1, Math.min(b.unit === 'pages' ? 160 : 80, Math.round(+t.value || 1)));
    if (t.dataset.part != null) { p.events[+t.dataset.part].name = t.value.trim() || 'Part ' + (+t.dataset.part + 1); }
    saveSoon(); draw();
  });
  m.el.addEventListener('input', (e) => {
    if (e.target.name === 'count') {
      b.spreads = +e.target.value;
      const n = m.el.querySelector('[name=countn]'); if (n) n.value = b.spreads;
      const big = m.el.querySelector('.bignum strong');
      const sp = b.unit === 'pages' ? Math.ceil(b.spreads / 2) : b.spreads;
      if (big) { big.textContent = sp; big.nextElementSibling.textContent = `Spreads (${sp * 2} pages)`; }
    }
  });
  m.el.addEventListener('pointerup', (e) => { if (e.target.name === 'count') { saveSoon(); draw(); } });
}

function runBuild() {
  const p = state.project; const b = p.build;
  const lockedAt = p.spreads.map((s, i) => (s.locked ? i : -1)).filter((i) => i >= 0);
  const skip = new Set(lockedAt.flatMap((i) => p.spreads[i].cells.map((c) => c.photoId)));
  const total = (b.unit === 'pages' ? Math.ceil(b.spreads / 2) : b.spreads);
  const titles = {};
  (p.events || []).forEach((ev) => { titles[ev.name] = b.titleLang === 'en' ? ev.name : (SECTION_TITLES_SI[ev.name] || ev.name); });
  const t0 = performance.now();
  const built = autoBuild(p.photos, {
    spreads: Math.max(1, total - lockedAt.length), size: p.size, style: b.style, seed: Date.now() % 100000,
    hero: b.opts.hero, text: b.opts.text, color: b.opts.color, starsOnly: b.opts.starsOnly,
    newSpreadPerPart: b.opts.newSpreadPerPart, useEvery: b.useEvery, reuse: b.reuse,
    range: b.perSpread === 'range' ? [b.min, b.max] : null,
    events: p.events, titles, skip,
    userTemplates: b.opts.myTemplates !== false ? (state.settings.userTemplates || []) : []
  });
  mutate(() => {
    const out = [...built];
    lockedAt.forEach((i) => out.splice(Math.min(i, out.length), 0, p.spreads[i]));
    p.spreads = out;
    state.sel = { spread: 0, cell: null, text: null };
  });
  const used = usedCounts().size;
  toast(`Album built: ${p.spreads.length} spreads, ${fmtNum(used)} photos in ${Math.round(performance.now() - t0)} ms`);
}

// ============ Print check + Export ============
export function printCheckModal(tab = 'check') {
  const p = state.project;
  if (!p.spreads.length) { toast('Build the album first.'); return; }
  let mode = 'guides';
  let fmt = 'jpg', which = 'all', running = null;
  const m = openModal('<div data-pc></div>');
  const draw = () => {
    const info = sizeInfo(p.size);
    const ch = printChecks(p);
    const s = p.spreads[state.sel.spread];
    const H = Math.min(230, 470 / info.aspect);
    const pv = mode === 'mock'
      ? `<div class="mock-stage"><div class="mock-book" style="background:${esc((p.cloud && p.cloud.coverChoice && p.cloud.coverChoice.color) || p.share.cover || '#3B2E25')}">${spreadHTML(s, p, state.byId, { height: H * 0.9 })}</div></div>`
      : `<div style="background:var(--stage);border-radius:12px;padding:24px;display:flex;justify-content:center">${spreadHTML(s, p, state.byId, { height: H, guides: mode === 'guides', showDpi: true, filter: mode === 'proof' ? 'saturate(.85) brightness(.96) contrast(.97)' : '' })}</div>`;
    const issue = (ok, title, sub, go) => `<div class="issue"><span class="dot ${ok ? 'ok' : 'warn'}">${ok ? '✓' : '!'}</span><div class="grow"><div>${title}</div><div class="small muted">${sub}</div></div>${go ? `<button class="btn ghost" data-go="${go}" style="height:28px">Show</button>` : ''}</div>`;
    m.el.querySelector('[data-pc]').innerHTML = `
      ${head('How it will print', `${esc(p.size.name)} ${esc(p.size.unit || 'in')} · ${p.spreads.length} spreads / ${p.spreads.length * 2} pages · ${fmtNum(info.pxW)} × ${fmtNum(info.pxH)} px per spread at ${info.dpi} DPI`)}
      <div class="modal-body"><div class="two">
        <div class="col" style="gap:12px">
          <div class="row" style="justify-content:space-between">
            <div class="seg"><button class="${mode === 'guides' ? 'on' : ''}" data-mode="guides">Guides</button><button class="${mode === 'proof' ? 'on' : ''}" data-mode="proof">Print proof</button><button class="${mode === 'mock' ? 'on' : ''}" data-mode="mock">Album mockup</button></div>
            <div class="row"><button class="icon-btn" data-nav="-1" aria-label="Previous spread">${ICON.left}</button><span class="small">Spread ${state.sel.spread + 1} / ${p.spreads.length}</span><button class="icon-btn" data-nav="1" aria-label="Next spread">${ICON.right}</button></div>
          </div>
          ${pv}
          ${mode === 'guides' ? `<div class="row small muted" style="flex-wrap:wrap;gap:16px">
            <span class="row"><span style="width:18px;border-top:2px solid #E25555"></span>Bleed ${p.size.bleedMm ?? 3} mm (cut off)</span>
            <span class="row"><span style="width:18px;border-top:2px dashed #4696E6"></span>Safe zone (keep text inside)</span>
            <span class="row"><span style="width:14px;height:14px;background:rgba(226,85,85,.35)"></span>Centre fold</span></div>` : ''}
          ${mode === 'proof' ? '<span class="small muted">Print proof shows colours slightly softer, the way most photo papers print. Use your lab\'s ICC profile in Photoshop for exact soft-proofing.</span>' : ''}
        </div>
        <div class="col" style="gap:12px">
          <div class="box"><b>Pre-print check</b>
            ${issue(!ch.low.length, ch.low.length ? `${ch.low.length} photo${ch.low.length > 1 ? 's' : ''} below 200 DPI` : 'All photos are sharp enough to print', ch.low.length ? 'Spreads ' + [...new Set(ch.low.map((x) => x.spread))].slice(0, 8).join(', ') + ' · may print soft' : 'Every photo is 200 DPI or more', ch.low.length ? ch.low[0].spread : null)}
            ${issue(!ch.gutter.length, ch.gutter.length ? `${ch.gutter.length} face${ch.gutter.length > 1 ? 's' : ''} on the centre fold` : 'No faces on the centre fold', ch.gutter.length ? 'Spreads ' + ch.gutter.map((x) => x.spread).join(', ') + ' · move them off the fold' : 'Checked every photo that crosses the fold', ch.gutter.length ? ch.gutter[0].spread : null)}
            ${issue(!ch.textOut.length, ch.textOut.length ? `${ch.textOut.length} text box${ch.textOut.length > 1 ? 'es' : ''} outside the safe zone` : 'All text inside the safe zone', `${ch.textCount} text boxes checked`, ch.textOut.length ? ch.textOut[0].spread : null)}
            ${issue(true, 'Edge photos run into the bleed', `${p.size.bleedMm ?? 3} mm extra on every side`)}
          </div>
          <div class="box col" style="gap:10px"><b>Export for print lab</b>
            <div class="row"><label class="field grow">File type<select name="fmt"><option value="jpg" ${fmt === 'jpg' ? 'selected' : ''}>JPG · one file per spread</option><option value="tiff" ${fmt === 'tiff' ? 'selected' : ''}>TIFF · one file per spread</option></select></label>
            <label class="field grow">Spreads<select name="which"><option value="all" ${which === 'all' ? 'selected' : ''}>All ${p.spreads.length}</option><option value="cur" ${which === 'cur' ? 'selected' : ''}>Only spread ${state.sel.spread + 1}</option></select></label></div>
            <span class="small muted">sRGB · ${info.dpi} DPI saved in the file · bleed included</span>
            ${running ? `<div class="small">${esc(running.label)} ${running.done} / ${running.total}</div><div class="progress"><div style="width:${(running.done / running.total) * 100}%"></div></div>` : ''}
            <button class="btn gold lg" data-export ${running ? 'disabled' : ''}>${ICON.export}Export ${info.dpi} DPI</button>
          </div>
        </div>
      </div></div>`;
  };
  draw();
  if (tab === 'export') setTimeout(() => { const b = m.el.querySelector('[data-export]'); if (b) b.focus(); }, 60);
  m.el.addEventListener('change', (e) => { if (e.target.name === 'fmt') fmt = e.target.value; if (e.target.name === 'which') which = e.target.value; });
  m.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-x],[data-mode],[data-nav],[data-go],[data-export]');
    if (!t) return;
    if (t.dataset.x !== undefined) { if (!running) m.close(); return; }
    if (t.dataset.mode) mode = t.dataset.mode;
    if (t.dataset.nav) state.sel = { spread: Math.max(0, Math.min(p.spreads.length - 1, state.sel.spread + +t.dataset.nav)), cell: null, text: null };
    if (t.dataset.go) { state.sel = { spread: +t.dataset.go - 1, cell: null, text: null }; state.mode = 'designer'; m.close(); refresh(); return; }
    if (t.dataset.export !== undefined) {
      const dir = await api.exporter.chooseDir();
      if (!dir) return;
      m.ov.dataset.locked = '1';
      running = { label: 'Exporting spread', done: 0, total: which === 'all' ? p.spreads.length : 1 };
      draw();
      try {
        await exportAlbum(p, state.byId, { dir, format: fmt, indices: which === 'all' ? null : [state.sel.spread], onProgress: (d, n) => { running = { label: 'Exporting spread', done: d, total: n }; draw(); } });
        toast(`Exported ${running.total} spread${running.total > 1 ? 's' : ''} to the print folder.`);
        api.exporter.openFolder(dir);
        if (p.status === 'Approved') { p.status = 'Printing'; saveSoon(); }
      } catch (err) { toast('Export failed: ' + err.message, true); }
      running = null; delete m.ov.dataset.locked;
    }
    draw();
    refresh(['strip', 'panel']);
  });
}

// ============ Send to client ============
export async function shareModal() {
  const p = state.project;
  if (!p.spreads.length) { toast('Build the album first.'); return; }
  state.cloud = await api.cloud.status().catch(() => ({ connected: false }));
  if (!state.cloud.connected) { connectCloudModal(() => shareModal()); return; }
  const sh = p.share;
  let busy = null, qr = null, feedback = null;
  const m = openModal('<div data-sh></div>');
  const covers = [['Brown leather', '#3B2E25'], ['Black leather', '#1B1B1D'], ['Ivory linen', '#E6DED0'], ['Burgundy velvet', '#5A2430'], ['Navy linen', '#24324A'], ['Forest green', '#24352B']];
  if (!sh.coverOptions) sh.coverOptions = defaultCoverOptions();
  const co = sh.coverOptions;
  const pagePhoto = (si, side, w, h) => {
    const s = p.spreads[Math.min(si, p.spreads.length - 1)];
    if (!s) return '';
    const A = sizeInfo(p.size).aspect;
    const Hs = Math.max(h, w / (A / 2));
    const left = side === 'L' ? 0 : -(Hs * A / 2);
    return `<div style="position:absolute;inset:0;overflow:hidden"><div style="position:absolute;left:${left + (w - Hs * A / 2) / 2}px;top:${(h - Hs) / 2}px">${spreadHTML(s, p, state.byId, { height: Hs })}</div></div>`;
  };
  const draw = () => {
    const c = p.cloud;
    const comments = p.comments || [];
    const choice = c && c.coverChoice;
    m.el.querySelector('[data-sh]').innerHTML = `
      ${head('Send album to client', 'The couple opens one private link on their phone: the film first, then the album turns like a real book.')}
      <div class="modal-body"><div class="two">
        <div class="col" style="gap:14px">
          <div class="box col" style="gap:10px">
            <div class="row"><b class="grow">Highlight video</b>${sh.video ? `<button class="btn ghost" data-act="novideo" style="height:28px">Remove</button>` : ''}<button class="btn" data-act="video">${sh.video ? 'Change' : 'Choose video'}</button></div>
            ${sh.video ? `<span class="small muted">${esc(sh.video.name)} · ${(sh.video.bytes / 1048576).toFixed(0)} MB</span>
            <div class="seg">${[['before', 'Before album opens'], ['page', 'Inside the album'], ['end', 'Last page']].map(([v, l]) => `<button class="${sh.videoPos === v ? 'on' : ''}" data-vpos="${v}">${l}</button>`).join('')}</div>` : '<span class="small muted">Optional · MP4 or MOV</span>'}
          </div>
          <div class="box col" style="gap:10px">
            <b>Cover colour until the client chooses</b>
            <div class="row" style="flex-wrap:wrap">${covers.map(([n, col]) => `<button class="swatch ${sh.cover === col ? 'on' : ''}" data-cover="${col}" title="${n}" aria-label="${n}" style="width:40px;background:${col}"></button>`).join('')}</div>
            <label class="field">Background music<select name="music"><option value="video" ${sh.music === 'video' ? 'selected' : ''}>Use video sound</option><option value="none" ${sh.music === 'none' ? 'selected' : ''}>No music</option></select></label>
          </div>
          <div class="box col" style="gap:4px">
            <label class="check"><input type="checkbox" data-co="enabled" ${co.enabled ? 'checked' : ''}><b>Let the client design the album cover</b></label>
            ${co.enabled ? `<span class="small muted" style="padding-left:25px">The client picks the style, material, colour, glass top photo and name tag on the link.</span>
            <div class="row small" style="padding-left:25px;flex-wrap:wrap;gap:12px;margin-top:4px">${Object.entries(MATERIALS).map(([k, m]) => `<label class="check"><input type="checkbox" data-com="${k}" ${co.materials.includes(k) ? 'checked' : ''}>${m.name}</label>`).join('')}</div>
            <div class="row small" style="padding-left:25px;flex-wrap:wrap;gap:12px">${Object.entries(COVER_STYLES).map(([k, n]) => `<label class="check"><input type="checkbox" data-cos="${k}" ${co.styles.includes(k) ? 'checked' : ''}>${n}</label>`).join('')}
              <label class="check"><input type="checkbox" data-co="tag" ${co.tag ? 'checked' : ''}>Name tag</label></div>` : ''}
          </div>
          <div class="box col" style="gap:2px">
            <b style="margin-bottom:6px">Client can…</b>
            ${[['comment', 'Comment on any photo'], ['swap', 'Ask to swap a photo'], ['approve', 'Approve the album'], ['download', 'Download spreads'], ['watermark', 'Show watermark']].map(([k, l]) => `<label class="check"><input type="checkbox" data-perm="${k}" ${sh.perms[k] ? 'checked' : ''}>${l}</label>`).join('')}
            <label class="field" style="margin-top:8px">Your studio name (shown on the link)<input type="text" name="studio" value="${esc(state.settings.studio || '')}" placeholder="Endora Wedding Films"></label>
            <label class="field" style="margin-top:8px">Link stays open for<select name="expiry">${[[14, '2 weeks'], [30, '1 month'], [60, '2 months'], [180, '6 months'], [0, 'Always']].map(([d, l]) => `<option value="${d}" ${+sh.expiryDays === d ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          </div>
        </div>
        <div class="col" style="gap:14px">
          <div class="box col" style="gap:12px">
            <b>Private client link</b>
            ${c ? `<div class="link-box"><input type="text" readonly value="${esc(c.url)}" aria-label="Client link"><button class="btn gold" data-act="copy">${ICON.copy}Copy</button></div>
              <div class="row small"><span>PIN: <b style="font-size:15px;letter-spacing:2px">${esc(c.pin)}</b></span><span class="muted">· ${c.active === false ? 'link turned off' : 'only people with the link + PIN can open it'}</span></div>
              <div class="row" style="flex-wrap:wrap"><button class="btn" data-act="wa">WhatsApp</button><button class="btn" data-act="mail">Email</button><button class="btn" data-act="qr">QR code</button><button class="btn" data-act="toggle">${c.active === false ? 'Turn link on' : 'Turn link off'}</button></div>
              ${qr ? `<img class="qr" src="${qr}" alt="QR code for the client link">` : ''}
              <span class="small muted">Sent ${new Date(c.publishedAt).toLocaleString('en-GB')}${c.views ? ' · opened ' + c.views + ' times' : ''}${c.approvedAt ? ' · <b style="color:var(--ok)">approved by ' + esc(c.approvedBy || 'client') + '</b>' : ''}</span>`
              : '<span class="small muted">No link yet. Upload creates a private link with a random address and a 4-digit PIN.</span>'}
            ${busy ? `<div class="small">${esc(busy.label)}${busy.total ? ` ${busy.done} / ${busy.total}` : ''}</div><div class="progress"><div style="width:${busy.total ? (busy.done / busy.total) * 100 : 30}%"></div></div>` : ''}
            <button class="btn gold lg" data-act="publish" ${busy ? 'disabled' : ''}>${ICON.send}${c ? 'Update the album on the link' : 'Upload & create link'}</button>
            ${c ? '<span class="small muted">Updating keeps the same link and PIN. The couple sees the new design when they open it again.</span>' : ''}
          </div>
          ${c && co.enabled ? `<div class="box col" style="gap:10px">
            <b>Album cover chosen by the client</b>
            ${choice ? `<div class="row" style="gap:14px;align-items:flex-start">
                ${coverHTML(choice, { couple: p.couple, date: p.date, aspect: sizeInfo(p.size).aspect, W: 130, photoHTML: pagePhoto })}
                <div class="col" style="gap:4px"><span class="small">${esc(coverSummary(choice))}</span>
                <span class="small muted">${choice.by ? 'by ' + esc(choice.by) + ' · ' : ''}${c.coverChosenAt ? new Date(c.coverChosenAt).toLocaleString('en-GB') : ''}</span></div></div>`
              : '<span class="small muted">Not chosen yet. The client sees a "Design your album cover" button on the link.</span>'}
          </div>` : ''}
          ${c ? `<div class="box col" style="gap:8px;max-height:300px;overflow:auto">
            <div class="row"><b class="grow">Client comments</b><button class="btn ghost" data-act="sync" style="height:28px">Refresh</button></div>
            ${comments.length ? comments.map((x) => `<div class="comment" style="${x.resolved ? 'opacity:.55' : ''}">
              <div class="row small"><b>${esc(x.name || 'Client')}</b><span class="muted">· spread ${x.spread + 1} · ${new Date(x.createdAt).toLocaleString('en-GB')}</span><span class="grow"></span><span class="badge ${x.kind === 'swap' ? 'st-Designing' : 'st-Client-review'}">${x.kind === 'swap' ? 'Swap photo' : 'Comment'}</span></div>
              <div>${esc(x.text)}</div>
              <div class="row"><button class="btn ghost" data-goc="${x.spread}" style="height:26px;font-size:12px">Show spread</button><button class="btn ghost" data-res="${esc(x.id)}" data-val="${x.resolved ? 0 : 1}" style="height:26px;font-size:12px">${x.resolved ? 'Reopen' : 'Mark done'}</button></div>
            </div>`).join('') : `<span class="small muted">${feedback === null ? 'Loading…' : 'No comments yet.'}</span>`}
          </div>` : ''}
        </div>
      </div></div>`;
  };
  draw();
  const sync = async () => {
    if (!p.cloud) return;
    try { feedback = await fetchFeedback(p); saveSoon(); } catch (err) { feedback = {}; toast(err.message, true); }
    draw(); refresh(['top']);
  };
  sync();

  m.el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.perm) sh.perms[t.dataset.perm] = t.checked;
    if (t.dataset.co) { co[t.dataset.co] = t.checked; if (t.dataset.co === 'enabled') draw(); }
    if (t.dataset.com) { co.materials = t.checked ? [...new Set([...co.materials, t.dataset.com])] : co.materials.filter((x) => x !== t.dataset.com); if (!co.materials.length) { co.materials = [t.dataset.com]; t.checked = true; } }
    if (t.dataset.cos) { co.styles = t.checked ? [...new Set([...co.styles, t.dataset.cos])] : co.styles.filter((x) => x !== t.dataset.cos); if (!co.styles.length) { co.styles = [t.dataset.cos]; t.checked = true; } }
    if (t.name === 'music') sh.music = t.value;
    if (t.name === 'expiry') sh.expiryDays = +t.value;
    if (t.name === 'studio') api.settings.set({ studio: t.value.trim() }).then((x) => { state.settings = x; });
    saveSoon();
  });
  m.el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-x],[data-act],[data-vpos],[data-cover],[data-goc],[data-res]');
    if (!t) return;
    if (t.dataset.x !== undefined) { if (!busy) m.close(); return; }
    if (t.dataset.vpos) { sh.videoPos = t.dataset.vpos; saveSoon(); draw(); return; }
    if (t.dataset.cover) { sh.cover = t.dataset.cover; saveSoon(); draw(); return; }
    if (t.dataset.goc) { state.sel = { spread: Math.min(p.spreads.length - 1, +t.dataset.goc), cell: null, text: null }; state.mode = 'designer'; m.close(); refresh(); return; }
    if (t.dataset.res) {
      try { await resolveComment(p, t.dataset.res, t.dataset.val === '1'); const x = p.comments.find((c) => String(c.id) === t.dataset.res); if (x) x.resolved = t.dataset.val === '1'; draw(); } catch (err) { toast(err.message, true); }
      return;
    }
    const a = t.dataset.act;
    const c = p.cloud;
    if (a === 'video') { const v = await api.video.pick(); if (v) { sh.video = v; saveSoon(); draw(); } }
    if (a === 'novideo') { sh.video = null; saveSoon(); draw(); }
    if (a === 'copy') { await navigator.clipboard.writeText(`${c.url}\nPIN: ${c.pin}`); toast('Link and PIN copied'); }
    if (a === 'wa') api.shell.open('https://wa.me/?text=' + encodeURIComponent(`Your wedding album is ready to view 💍\n${c.url}\nPIN: ${c.pin}`));
    if (a === 'mail') api.shell.open(`mailto:?subject=${encodeURIComponent('Your wedding album preview')}&body=${encodeURIComponent(`Hi ${p.couple},\n\nYour album is ready to view:\n${c.url}\nPIN: ${c.pin}\n\nYou can leave comments on any photo and approve it when you are happy.`)}`);
    if (a === 'qr') { qr = qr ? null : await api.qr(c.url); draw(); }
    if (a === 'sync') sync();
    if (a === 'toggle') { try { await setLinkActive(p, c.active === false); saveSoon(); draw(); } catch (err) { toast(err.message, true); } }
    if (a === 'publish') {
      m.ov.dataset.locked = '1';
      busy = { label: 'Starting', done: 0, total: 0 }; draw();
      try {
        await publishAlbum(p, state.byId, (s) => { busy = s; draw(); });
        await saveImmediately();
        toast('Private link is ready');
        refresh(['top']); sync();
      } catch (err) { toast('Could not send: ' + err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), true); }
      busy = null; delete m.ov.dataset.locked; draw();
    }
  });
}
