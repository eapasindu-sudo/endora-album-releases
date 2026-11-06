// Word art: text designs taken from Photoshop layers (a bundled pack + the user's own imports).
// On a spread an item is { id, src: 'b:wa001' | 'u:<id>', x, y, w, ar, color, opacity }:
// x, y, w are fractions of the spread; ar = height / width of the art; color null = original colours.

let pack = [];
let loaded = null;
let current = () => ({});
export function setArtSettings(getter) { current = getter; }

export function loadPack() {
  if (loaded) return loaded;
  loaded = fetch(window.api.assetUrl('wordart/index.json'))
    .then((r) => r.json())
    .then((list) => { pack = list.map((x) => ({ ...x, src: 'b:' + x.id })); return pack; })
    .catch(() => { pack = []; return pack; });
  return loaded;
}

export function packItems() { return pack; }

export function userItems(settings) {
  return (settings.userWordArt || []).map((x) => ({ ...x, src: 'u:' + x.id }));
}

export function artInfo(src, settings = current()) {
  if (!src) return null;
  if (src.startsWith('b:')) return pack.find((x) => x.src === src) || null;
  return userItems(settings || {}).find((x) => x.src === src) || null;
}

export function artUrl(src, settings = current()) {
  const it = artInfo(src, settings);
  if (!it) return '';
  return src.startsWith('b:') ? window.api.assetUrl('wordart/' + it.file) : window.api.fileUrl(it.path);
}

export const ART_COLORS = ['#FFFFFF', '#000000', '#3B3026', '#D4B47C', '#B08D57', '#8E1B2B', '#C2185B', '#1F3A5F', '#2E5E4E', '#7A7A7A'];

// Draw word art (optionally recoloured) into a canvas context at x, y, w, h.
const cache = new Map();
function loadImg(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Word art image missing'));
      img.src = url;
    }));
  }
  return cache.get(url);
}

export async function drawArt(ctx, art, x, y, w, h, settings = current()) {
  const url = artUrl(art.src, settings);
  if (!url) return;
  const img = await loadImg(url);
  const pw = Math.max(1, Math.round(w)), ph = Math.max(1, Math.round(h));
  let source = img;
  if (art.color) {
    const c = new OffscreenCanvas(pw, ph);
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, pw, ph);
    cx.globalCompositeOperation = 'source-in';
    cx.fillStyle = art.color;
    cx.fillRect(0, 0, pw, ph);
    source = c;
  }
  ctx.save();
  ctx.globalAlpha = art.opacity == null ? 1 : art.opacity;
  ctx.drawImage(source, x, y, pw, ph);
  ctx.restore();
}
