// Renders spreads at print resolution (with bleed) or web size, from the original photos.
import { sizeInfo } from './layout.js';
import { FONTS } from './textpacks.js';
import { drawArt } from './wordart.js';

const api = () => window.api;

// Source rectangle (in original pixels) for a photo covering a box of aspect `boxAspect`,
// matching the on-screen object-position + zoom-around-focal behaviour.
export function sourceRect(photo, boxAspect, fx = 0.5, fy = 0.42, zoom = 1) {
  const W = photo.width, H = photo.height, pa = W / H;
  let w0, h0;
  if (pa > boxAspect) { h0 = H; w0 = H * boxAspect; } else { w0 = W; h0 = W / boxAspect; }
  let x0 = (W - w0) * fx, y0 = (H - h0) * fy;
  const w = w0 / zoom, h = h0 / zoom;
  const x = x0 + fx * w0 - fx * w, y = y0 + fy * h0 - fy * h;
  return { x: Math.max(0, x), y: Math.max(0, y), w: Math.min(w, W), h: Math.min(h, H) };
}

function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/(\s+)/);
    let line = '';
    for (const w of words) {
      const test = line + w;
      if (ctx.measureText(test).width > maxW && line.trim()) { out.push(line.trim()); line = w.trimStart(); }
      else line = test;
    }
    out.push(line.trim());
  }
  return out;
}

export async function renderSpread(spread, project, byId, mode = 'print', maxW = 2400) {
  const info = sizeInfo(project.size);
  let trimW, trimH, bleed;
  if (mode === 'print') {
    bleed = Math.round(info.bleedIn * info.dpi);
    trimW = Math.round(info.wIn * info.dpi); trimH = Math.round(info.hIn * info.dpi);
  } else {
    bleed = 0; trimW = maxW; trimH = Math.round(maxW / info.aspect);
  }
  const canvas = new OffscreenCanvas(trimW + 2 * bleed, trimH + 2 * bleed);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = spread.bg || '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawShape = (sh) => {
    // shapes touching an edge run into the bleed like photos do
    let x = bleed + sh.x * trimW, y = bleed + sh.y * trimH, w = sh.w * trimW, h = sh.h * trimH;
    if (sh.fill) {
      if (sh.x < 0.002) { x -= bleed; w += bleed; }
      if (sh.y < 0.002) { y -= bleed; h += bleed; }
      if (sh.x + sh.w > 0.998) w += bleed;
      if (sh.y + sh.h > 0.998) h += bleed;
    }
    ctx.beginPath();
    if (sh.circle) ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else ctx.rect(x, y, w, h);
    if (sh.fill) { ctx.fillStyle = sh.fill; ctx.fill(); }
    if (sh.stroke) {
      const lw = Math.max(1, (sh.lw || 0.002) * trimH);
      ctx.lineWidth = lw; ctx.strokeStyle = sh.stroke;
      ctx.beginPath(); ctx.rect(x + lw / 2, y + lw / 2, w - lw, h - lw); ctx.stroke();
    }
  };
  for (const sh of spread.shapes || []) if (!sh.front) drawShape(sh);

  for (const c of spread.cells) {
    const p = byId.get(c.photoId);
    if (!p) continue;
    let x = bleed + c.x * trimW, y = bleed + c.y * trimH, w = c.w * trimW, h = c.h * trimH;
    // photos touching the edge run into the bleed so nothing white shows after trimming
    if (c.x < 0.002) { x -= bleed; w += bleed; }
    if (c.y < 0.002) { y -= bleed; h += bleed; }
    if (c.x + c.w > 0.998) w += bleed;
    if (c.y + c.h > 0.998) h += bleed;
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    // keep the visible (trim) crop identical to the screen: compute on the trim box, then extend
    const visAspect = (c.w * trimW) / (c.h * trimH);
    const src = sourceRect(p, visAspect, c.fx ?? 0.5, c.fy ?? 0.42, c.zoom || 1);
    const pxPerSrc = (c.w * trimW) / src.w;
    const ext = {
      x: src.x - (bleed && c.x < 0.002 ? bleed / pxPerSrc : 0),
      y: src.y - (bleed && c.y < 0.002 ? bleed / pxPerSrc : 0),
      w: w / pxPerSrc, h: h / pxPerSrc
    };
    ext.x = Math.max(0, Math.min(ext.x, p.width - ext.w));
    ext.y = Math.max(0, Math.min(ext.y, p.height - ext.h));
    ext.w = Math.min(ext.w, p.width); ext.h = Math.min(ext.h, p.height);
    const buf = await api().photos.crop(p.path, ext, w, h, { rot: p.rot || 0, flipH: !!p.flipH, flipV: !!p.flipV });
    const bmp = await createImageBitmap(new Blob([buf], { type: 'image/jpeg' }));
    if (c.shadow) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = trimH * 0.03; ctx.shadowOffsetX = trimH * 0.006; ctx.shadowOffsetY = trimH * 0.012;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      if (c.round === 'circle') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else ctx.rect(x, y, w, h);
      ctx.fill(); ctx.restore();
    }
    if (c.border) {
      const b = c.border.w * trimH;
      ctx.fillStyle = c.border.color || '#FFFFFF';
      ctx.beginPath();
      if (c.round === 'circle') ctx.ellipse(x + w / 2, y + h / 2, w / 2 + b, h / 2 + b, 0, 0, Math.PI * 2); else ctx.rect(x - b, y - b, w + 2 * b, h + 2 * b);
      ctx.fill();
    }
    ctx.save();
    if (c.fade != null) ctx.globalAlpha = c.fade;
    if (c.bw) ctx.filter = 'grayscale(1)';
    if (c.round === 'circle') { ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.clip(); }
    if (c.round === 'arch') {
      const r = Math.min(w / 2, h);
      ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.arc(x + w / 2, y + r, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.clip();
    }
    ctx.drawImage(bmp, x, y, w, h);
    ctx.restore();
    bmp.close();
  }
  for (const sh of spread.shapes || []) if (sh.front) drawShape(sh);

  for (const a of spread.arts || []) {
    const w = a.w * trimW;
    await drawArt(ctx, a, bleed + a.x * trimW, bleed + a.y * trimH, w, w * a.ar);
  }

  for (const t of spread.texts || []) {
    const fs = t.size * trimH;
    ctx.font = `${t.italic ? 'italic ' : ''}${t.bold ? 700 : 500} ${fs}px ${FONTS[t.font] || FONTS.serif}`;
    ctx.fillStyle = t.color || '#3B3026';
    ctx.textBaseline = 'top';
    const boxW = t.w * trimW;
    const lines = wrapLines(ctx, t.text, boxW);
    const lh = fs * 1.2;
    const x0 = bleed + t.x * trimW, y0 = bleed + t.y * trimH;
    if (t.shadow) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = fs * 0.25; ctx.shadowOffsetY = fs * 0.04; }
    lines.forEach((ln, i) => {
      const lw = ctx.measureText(ln).width;
      const lx = t.align === 'center' ? x0 + (boxW - lw) / 2 : t.align === 'right' ? x0 + boxW - lw : x0;
      ctx.fillText(ln, lx, y0 + i * lh + fs * 0.1);
    });
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }
  return canvas;
}

export function fileBase(project) {
  return (project.couple || 'album').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'album';
}

export async function exportAlbum(project, byId, { dir, format = 'jpg', indices, onProgress }) {
  const list = indices || project.spreads.map((_, i) => i);
  const base = fileBase(project);
  const dpi = sizeInfo(project.size).dpi;
  const written = [];
  for (let k = 0; k < list.length; k++) {
    const i = list[k];
    const canvas = await renderSpread(project.spreads[i], project, byId, 'print');
    const nn = String(i + 1).padStart(2, '0');
    if (format === 'tiff') {
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      written.push(await api().exporter.writeTiff(dir, `${base}_spread_${nn}.tif`, await blob.arrayBuffer(), dpi));
    } else {
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.97 });
      written.push(await api().exporter.writeJpeg(dir, `${base}_spread_${nn}.jpg`, await blob.arrayBuffer(), dpi));
    }
    if (onProgress) onProgress(k + 1, list.length);
  }
  return written;
}

export async function webSpreadJpeg(spread, project, byId, maxW = 2400) {
  const canvas = await renderSpread(spread, project, byId, 'web', maxW);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
  return new Uint8Array(await blob.arrayBuffer());
}
