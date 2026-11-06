// Photo analysis on thumbnails (runs in the renderer).
// sharpness (variance of Laplacian), exposure, average colour, dHash, faces.

const W = 256;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + url));
    img.src = url;
  });
}

let faceDetector = null;
try {
  if ('FaceDetector' in window) faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
} catch (_) { faceDetector = null; }
export const hasFaceDetection = () => !!faceDetector;

export async function analyse(url) {
  const img = await loadImage(url);
  const scale = W / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.max(8, Math.round(img.naturalWidth * scale));
  const h = Math.max(8, Math.round(img.naturalHeight * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  let sr = 0, sg = 0, sb = 0, sum = 0, dark = 0, bright = 0;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[j] = y; sum += y; sr += r; sg += g; sb += b;
    if (y < 16) dark++; else if (y > 245) bright++;
  }
  const n = w * h;
  // Laplacian variance over the centre 80% (edges are often soft by design)
  let lsum = 0, lsq = 0, ln = 0;
  const x0 = Math.floor(w * 0.1), x1 = Math.ceil(w * 0.9), y0 = Math.floor(h * 0.1), y1 = Math.ceil(h * 0.9);
  for (let y = Math.max(1, y0); y < Math.min(h - 1, y1); y++) {
    for (let x = Math.max(1, x0); x < Math.min(w - 1, x1); x++) {
      const i = y * w + x;
      const l = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      lsum += l; lsq += l * l; ln++;
    }
  }
  const mean = lsum / ln;
  const sharpness = lsq / ln - mean * mean;

  // dHash 9x8
  const hc = new OffscreenCanvas(9, 8).getContext('2d', { willReadFrequently: true });
  hc.drawImage(img, 0, 0, 9, 8);
  const hd = hc.getImageData(0, 0, 9, 8).data;
  let hash = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const a = (y * 9 + x) * 4, b = (y * 9 + x + 1) * 4;
      const la = hd[a] * 0.299 + hd[a + 1] * 0.587 + hd[a + 2] * 0.114;
      const lb = hd[b] * 0.299 + hd[b + 1] * 0.587 + hd[b + 2] * 0.114;
      hash += la > lb ? '1' : '0';
    }
  }

  let face = null, faces = 0;
  if (faceDetector) {
    try {
      const found = await faceDetector.detect(img);
      faces = found.length;
      if (found.length) {
        // centre of all faces, weighted by size
        let fx = 0, fy = 0, wt = 0;
        for (const f of found) {
          const b = f.boundingBox, a = b.width * b.height;
          fx += (b.x + b.width / 2) * a; fy += (b.y + b.height / 2) * a; wt += a;
        }
        face = { x: fx / wt / img.naturalWidth, y: fy / wt / img.naturalHeight };
      }
    } catch (_) { /* detector unavailable for this image */ }
  }

  const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return {
    sharpness,
    brightness: sum / n / 255,
    clipped: (dark + bright) / n,
    avgColor: '#' + hex(sr) + hex(sg) + hex(sb),
    hash, face, faces
  };
}

export function hamming(a, b) {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

// Mark flags + score across the whole set (thresholds are relative to the shoot).
export function scoreSet(photos) {
  const sharp = photos.map((p) => p.sharpness).filter((v) => v != null).sort((a, b) => a - b);
  const median = sharp.length ? sharp[Math.floor(sharp.length / 2)] : 1;
  const sorted = [...photos].sort((a, b) => a.takenAt - b.takenAt);
  for (const p of photos) {
    p.flags = [];
    if (p.sharpness == null) continue;
    const rel = p.sharpness / (median || 1);
    if (rel < 0.28 && p.sharpness < 60) p.flags.push('blur');
    if (p.brightness < 0.12 || p.brightness > 0.9 || p.clipped > 0.45) p.flags.push('exposure');
    const sharpScore = Math.min(1, rel / 1.5);
    const expoScore = 1 - Math.min(1, Math.abs(p.brightness - 0.5) * 2);
    p.score = 0.6 * sharpScore + 0.3 * expoScore + (p.faces ? 0.1 : 0);
  }
  // near duplicates: compare with the few photos taken just before
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    for (let k = Math.max(0, i - 6); k < i; k++) {
      const q = sorted[k];
      if (q.flags && q.flags.includes('dup')) continue;
      if (Math.abs(p.takenAt - q.takenAt) > 90000) continue;
      if (hamming(p.hash, q.hash) <= 5) {
        const loser = (p.score || 0) >= (q.score || 0) ? q : p;
        if (!loser.flags.includes('dup')) loser.flags.push('dup');
        break;
      }
    }
  }
  return photos;
}

export function applyCull(photos, cull) {
  for (const p of photos) {
    if (p.manual === 'keep') { p.excluded = false; continue; }
    if (p.manual === 'drop') { p.excluded = true; continue; }
    const f = p.flags || [];
    p.excluded = (cull.blur && f.includes('blur')) || (cull.dup && f.includes('dup')) || (cull.exposure && f.includes('exposure'));
  }
}
