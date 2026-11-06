// Publishes an album to Endora Cloud (Cloudflare Worker + R2 + D1) and syncs client feedback.
import { webSpreadJpeg } from './exporter.js';
import { sizeInfo } from './layout.js';

const api = () => window.api;

function randomPin() {
  const a = new Uint32Array(1); crypto.getRandomValues(a);
  return String(1000 + (a[0] % 9000));
}

export async function publishAlbum(project, byId, onStep) {
  const share = project.share;
  const step = (label, done, total) => onStep && onStep({ label, done, total });
  const n = project.spreads.length;
  if (!n) throw new Error('Build the album first. There are no spreads to send.');

  // 1. web-size spreads
  const images = [];
  for (let i = 0; i < n; i++) {
    step('Preparing spreads', i, n);
    images.push(await webSpreadJpeg(project.spreads[i], project, byId, 2400));
  }
  step('Preparing spreads', n, n);

  // 2. create / update the album on the server
  const pin = (project.cloud && project.cloud.pin) || randomPin();
  const body = {
    albumId: project.cloud ? project.cloud.albumId : undefined,
    couple: project.couple, date: project.date,
    aspect: sizeInfo(project.size).aspect, spreads: n,
    pin, cover: share.cover, videoPos: share.video ? share.videoPos : 'none', music: share.music,
    perms: share.perms, expiryDays: share.expiryDays,
    sections: project.spreads.map((s) => s.section || ''),
    video: share.video ? { name: share.video.name, bytes: share.video.bytes, type: videoType(share.video.name) } : null,
    replaceVideo: !!(share.video && (!project.cloud || project.cloud.videoPath !== share.video.path))
  };
  step('Creating private link', 0, 1);
  const created = await api().cloud.request('POST', '/api/albums', body);

  // 3. upload spreads (and the film in 50 MB parts) to the photographer's Cloudflare
  const uploads = created.uploads || [];
  const spreads = uploads.filter((u) => u.kind === 'spread');
  let k = 0;
  for (const u of spreads) {
    step('Uploading spreads', k, spreads.length);
    await api().cloud.upload(u.route, 'image/jpeg', images[u.index]);
    k++;
  }
  const vid = uploads.find((u) => u.kind === 'video');
  if (vid) {
    step('Uploading video (this can take a while)', 0, 1);
    const off = api().cloud.onProgress((p) => step('Uploading video (this can take a while)', p.done, p.total));
    try { await api().cloud.uploadVideo(vid.route, share.video.path, vid.contentType); } finally { off(); }
  }
  step('Publishing', 1, 1);
  const pub = await api().cloud.request('POST', `/api/albums/${created.albumId}/publish`, { version: created.version });

  project.cloud = {
    albumId: created.albumId, slug: created.slug, url: pub.url || created.url, pin,
    publishedAt: Date.now(), version: created.version, active: true,
    videoPath: share.video ? share.video.path : null
  };
  if (project.status === 'Designing') project.status = 'Client review';
  return project.cloud;
}

function videoType(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4';
}

export async function fetchFeedback(project) {
  if (!project.cloud) return null;
  const r = await api().cloud.request('GET', `/api/albums/${project.cloud.albumId}`);
  project.comments = r.comments || [];
  if (r.album && r.album.approvedAt && project.status !== 'Printing') project.status = 'Approved';
  project.cloud.views = r.album ? r.album.views : 0;
  project.cloud.approvedAt = r.album ? r.album.approvedAt : null;
  project.cloud.approvedBy = r.album ? r.album.approvedBy : null;
  return r;
}

export async function setLinkActive(project, active) {
  await api().cloud.request('PATCH', `/api/albums/${project.cloud.albumId}`, { active });
  project.cloud.active = active;
}

export async function resolveComment(project, id, resolved) {
  await api().cloud.request('PATCH', `/api/albums/${project.cloud.albumId}/comments/${id}`, { resolved });
}
