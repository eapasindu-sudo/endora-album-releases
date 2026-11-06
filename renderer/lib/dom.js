export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(msg, isErr = false, ms = 3200) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function fmtNum(n) { return Number(n || 0).toLocaleString('en-US'); }

export function fmtDate(d) {
  if (!d) return '';
  const x = new Date(d);
  return isNaN(x) ? String(d) : x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const P = (d, extra = '') => `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const ICON = {
  home: P('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  undo: P('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>'),
  redo: P('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  minus: P('<path d="M5 12h14"/>'),
  bolt: P('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  wand: P('<path d="M15 4V2M15 10V8M11 6H9M21 6h-2M18 3l-1.5 1.5M18 9l-1.5-1.5"/><path d="M3 21l11-11"/>'),
  import: P('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/>'),
  export: P('<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>'),
  print: P('<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
  send: P('<path d="M4 12l16-8-6 16-2-7z"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  close: P('<path d="M6 6l12 12M18 6L6 18"/>'),
  trash: P('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  lock: P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>'),
  shuffle: P('<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>'),
  moon: P('<path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z"/>'),
  user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>'),
  left: P('<path d="M15 6l-6 6 6 6"/>'),
  right: P('<path d="M9 6l6 6-6 6"/>'),
  text: P('<path d="M4 6V4h16v2M12 4v16M9 20h6"/>'),
  copy: P('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/>'),
  play: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  check: P('<path d="M5 12l5 5 9-10"/>'),
  grid: P('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
  eye: P('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  star: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  dup: P('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a1 1 0 011-1h11"/>')
};
