// Renders a spread as HTML at a given pixel height (used by stage, strip, layout previews, print check).
import { esc } from './dom.js';
import { sizeInfo, cellDpi } from './layout.js';
import { FONTS } from './textpacks.js';
import { artUrl } from './wordart.js';

export function photoUrl(p) {
  return p ? window.api.fileUrl(p.thumb) + (p.v ? '?v=' + p.v : '') : '';
}

/**
 * opts: { height, index, selected, selCell, selText, guides, interactive, showDpi, filter, className }
 */
export function spreadHTML(spread, project, byId, opts = {}) {
  const info = sizeInfo(project.size);
  const H = opts.height || 300;
  const W = Math.round(H * info.aspect);
  const cls = ['spread', opts.className || '', opts.selected ? 'sel' : '', spread.locked && opts.interactive ? 'locked' : ''].join(' ');
  const attrs = opts.interactive ? ` data-spread="${opts.index}"` : '';
  let out = `<div class="${cls}"${attrs} style="width:${W}px;height:${H}px;background:${esc(spread.bg || '#fff')};${opts.filter ? 'filter:' + opts.filter + ';' : ''}">`;
  const shapeHTML = (sh) => {
    const lw = Math.max(1, (sh.lw || 0.002) * H);
    return `<div class="shape" style="left:${(sh.x * W).toFixed(2)}px;top:${(sh.y * H).toFixed(2)}px;width:${(sh.w * W).toFixed(2)}px;height:${(sh.h * H).toFixed(2)}px;${sh.fill ? 'background:' + esc(sh.fill) + ';' : ''}${sh.stroke ? `border:${lw.toFixed(1)}px solid ${esc(sh.stroke)};` : ''}${sh.circle ? 'border-radius:50%;' : ''}"></div>`;
  };
  (spread.shapes || []).filter((sh) => !sh.front).forEach((sh) => { out += shapeHTML(sh); });
  spread.cells.forEach((c, ci) => {
    const p = byId.get(c.photoId);
    const fx = Math.round((c.fx == null ? 0.5 : c.fx) * 100), fy = Math.round((c.fy == null ? 0.42 : c.fy) * 100);
    const z = c.zoom || 1;
    const sel = opts.selCell === ci ? ' sel' : '';
    const ca = opts.interactive ? ` data-cell="${ci}" draggable="true"` : '';
    const deco = (c.round === 'circle' ? 'border-radius:50%;' : c.round === 'arch' ? `border-radius:${(c.w * W / 2).toFixed(1)}px ${(c.w * W / 2).toFixed(1)}px 0 0;` : '')
      + (c.fade != null ? `opacity:${c.fade};background:transparent;` : '') + (c.border || c.shadow ? `box-shadow:${[c.border ? `0 0 0 ${Math.max(1, c.border.w * H).toFixed(1)}px ${esc(c.border.color || '#fff')}` : '', c.shadow ? `${(H * 0.006).toFixed(1)}px ${(H * 0.012).toFixed(1)}px ${(H * 0.03).toFixed(1)}px rgba(0,0,0,.35)` : ''].filter(Boolean).join(',')};z-index:1;` : '');
    out += `<div class="cell${sel}"${ca} style="left:${(c.x * W).toFixed(2)}px;top:${(c.y * H).toFixed(2)}px;width:${(c.w * W).toFixed(2)}px;height:${(c.h * H).toFixed(2)}px;${deco}">`;
    if (p) out += `<img src="${esc(photoUrl(p))}" alt="" loading="lazy" style="object-position:${fx}% ${fy}%;--fx:${fx}%;--fy:${fy}%;transform:scale(${z})${c.bw ? ';filter:grayscale(1)' : ''}">`;
    if (opts.showDpi && p) {
      const dpi = cellDpi(c, p, project.size);
      if (dpi < 200) out += `<span class="lowres">${dpi} DPI</span>`;
    }
    out += '</div>';
  });
  (spread.shapes || []).filter((sh) => sh.front).forEach((sh) => { out += shapeHTML(sh).replace('class="shape"', 'class="shape front"'); });
  (spread.arts || []).forEach((a, ai) => {
    const url = artUrl(a.src);
    const wpx = a.w * W, hpx = wpx * a.ar;
    const sel = opts.selArt === ai ? ' sel' : '';
    const aa = opts.interactive ? ` data-art="${ai}"` : '';
    const inner = !url ? '' : a.color
      ? `<div class="art-mask" style="background:${esc(a.color)};-webkit-mask-image:url('${esc(url)}');mask-image:url('${esc(url)}')"></div>`
      : `<img src="${esc(url)}" alt="" draggable="false">`;
    out += `<div class="art${sel}"${aa} style="left:${(a.x * W).toFixed(1)}px;top:${(a.y * H).toFixed(1)}px;width:${wpx.toFixed(1)}px;height:${hpx.toFixed(1)}px;opacity:${a.opacity == null ? 1 : a.opacity}">${inner}</div>`;
  });
  (spread.texts || []).forEach((t, ti) => {
    const sel = opts.selText === ti ? ' sel' : '';
    const ta = opts.interactive ? ` data-text="${ti}"` : '';
    out += `<div class="txt${sel}"${ta} style="${textStyle(t, W, H)}">${esc(t.text)}</div>`;
  });
  if (!opts.interactive || opts.fold !== false) out += '<div class="fold"></div>';
  if (opts.editCell != null && spread.cells[opts.editCell]) {
    const c = spread.cells[opts.editCell];
    out += `<div class="frame-edit" data-frame="${opts.editCell}" style="left:${(c.x * W).toFixed(2)}px;top:${(c.y * H).toFixed(2)}px;width:${(c.w * W).toFixed(2)}px;height:${(c.h * H).toFixed(2)}px">
      ${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<span class="fh fh-${h}" data-h="${h}"></span>`).join('')}
      <span class="fh-move" data-h="move" title="Drag to move this photo frame" aria-label="Move frame"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg></span>
    </div>`;
  }
  if (opts.guides) {
    const bleedFracX = info.bleedIn / (info.wIn + 2 * info.bleedIn);
    const safe = 0.04;
    out += `<div class="guides"><div class="bleed" style="border-width:${Math.max(1.5, bleedFracX * W)}px"></div>
      <div class="safe" style="left:${safe / info.aspect * W}px;right:${safe / info.aspect * W}px;top:${safe * H}px;bottom:${safe * H}px"></div>
      <div class="gutter" style="left:${W / 2 - 0.015 * W}px;width:${0.03 * W}px"></div></div>`;
  }
  out += '</div>';
  return out;
}

export function textStyle(t, W, H) {
  const fs = Math.max(4, t.size * H);
  return [
    `left:${(t.x * W).toFixed(1)}px`, `top:${(t.y * H).toFixed(1)}px`, `width:${(t.w * W).toFixed(1)}px`,
    `font-size:${fs.toFixed(1)}px`, `font-family:${FONTS[t.font] || FONTS.serif}`, `color:${t.color || '#3B3026'}`,
    `text-align:${t.align || 'left'}`, `font-style:${t.italic ? 'italic' : 'normal'}`, `font-weight:${t.bold ? 700 : 500}`,
    t.shadow ? 'text-shadow:0 1px 6px rgba(0,0,0,.45)' : ''
  ].join(';');
}
