// Album covers the client can choose on the flipbook link (same catalogue as cloudflare/src/viewer.html).
import { esc } from './dom.js';

export const MATERIALS = {
  leather: { name: 'Leather', colors: [['Chocolate', '#4A3226'], ['Black', '#1C1C1E'], ['Tan', '#A9774A'], ['Burgundy', '#5C1F2B'], ['Navy', '#1F2C44'], ['Ivory', '#E9E1D2']] },
  linen: { name: 'Linen', colors: [['Natural', '#D8CDB8'], ['Grey', '#9A9893'], ['Sage', '#9FAF96'], ['Blush', '#D9B8AE'], ['Navy', '#2C3B57'], ['Charcoal', '#3A3A3C']] },
  velvet: { name: 'Velvet', colors: [['Wine', '#5A1A2A'], ['Emerald', '#1F4D3A'], ['Royal blue', '#23366B'], ['Black', '#141416'], ['Dusty pink', '#C28E92'], ['Champagne', '#CBB48F']] }
};
export const COVER_STYLES = { plain: 'Plain', glass: 'Glass top', photo: 'Photo cover' };
export const FINISHES = { gold: 'Gold', silver: 'Silver', rosegold: 'Rose gold', black: 'Black' };

export function defaultCoverOptions() {
  return { enabled: true, materials: Object.keys(MATERIALS), styles: Object.keys(COVER_STYLES), tag: true };
}

export function colorName(material, hex) {
  const m = MATERIALS[material];
  const c = m && m.colors.find((x) => x[1] === String(hex).toUpperCase());
  return c ? c[0] : hex;
}

export function coverSummary(c) {
  if (!c) return '';
  const parts = [`${MATERIALS[c.material] ? MATERIALS[c.material].name : c.material} · ${colorName(c.material, c.color)}`, COVER_STYLES[c.style] || c.style];
  if (c.photo && c.style !== 'plain') parts.push(`photo: spread ${c.photo.spread + 1} ${c.photo.side === 'L' ? 'left' : 'right'} page`);
  if (c.tag && c.tag.on) parts.push(`${FINISHES[c.tag.finish] || c.tag.finish} name tag "${c.tag.text}"`);
  return parts.join(' · ');
}

const light = (hex) => { const n = parseInt(String(hex).slice(1), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) > 150; };

/**
 * HTML for a closed album cover at width W (px). photoHTML(spreadIndex, side, w, h) returns the page
 * picture to place in the glass top / photo cover.
 */
export function coverHTML(c, { couple, date, aspect, W, photoHTML }) {
  const pa = aspect / 2;
  const H = W / pa;
  const color = c ? c.color : '#4A3226';
  const mat = c ? c.material : 'leather';
  const style = c ? c.style : 'plain';
  let h = `<div class="cvr" style="width:${W}px;height:${H}px;background:${esc(color)}"><div class="tex tex-${mat}"></div>`;
  if (mat === 'leather') h += '<div class="stitch"></div>';
  const p = (c && c.photo) || { spread: 0, side: 'R' };
  if (style === 'photo') h += `<div class="full">${photoHTML(p.spread, p.side, W, H)}</div><div class="gloss"></div>`;
  if (style === 'glass') h += `<div class="win">${photoHTML(p.spread, p.side, W * 0.66, H * 0.52)}<div class="gloss"></div></div>`;
  h += '<div class="spine"></div>';
  const tag = c && c.tag && c.tag.on ? c.tag : null;
  if (tag) h += `<div class="tag tag-${esc(tag.finish)}" style="top:${style === 'glass' ? 72 : style === 'photo' ? 80 : 45}%;font-size:${H * 0.056}px">${esc(tag.text || couple)}</div>`;
  else if (style === 'plain') h += `<div class="foil" style="top:38%;color:${light(color) ? '#7A5A22' : '#D4B47C'}"><b style="font-size:${H * 0.09}px">${esc(couple)}</b><span style="font-size:${H * 0.036}px">${esc(date || '')}</span></div>`;
  return h + '</div>';
}
