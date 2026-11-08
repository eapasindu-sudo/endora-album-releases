// Endora Cloud – Cloudflare Worker (one per photographer, set up automatically by the app)
// Desktop app API (album upload), private client viewer, comments, approvals.
import VIEWER_HTML from './viewer.html';

export const WORKER_VERSION = 5;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const bad = (msg, status = 400) => json({ error: msg }, status);
const now = () => Date.now();
const enc = new TextEncoder();

function hex(buf) { return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function randomHex(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return hex(a); }
const ALPHA = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomSlug(n = 10) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return [...a].map((b) => ALPHA[b % ALPHA.length]).join('');
}
export async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function body(req) { try { return await req.json(); } catch { return {}; } }

// ---------- album covers the client can choose ----------
export const COVER = {
  materials: {
    leather: ['#4A3226', '#1C1C1E', '#A9774A', '#5C1F2B', '#1F2C44', '#E9E1D2'],
    linen: ['#D8CDB8', '#9A9893', '#9FAF96', '#D9B8AE', '#2C3B57', '#3A3A3C'],
    velvet: ['#5A1A2A', '#1F4D3A', '#23366B', '#141416', '#C28E92', '#CBB48F']
  },
  styles: ['plain', 'glass', 'photo'],
  finishes: ['gold', 'silver', 'rosegold', 'black']
};
function cleanCoverOptions(o) {
  if (!o || !o.enabled) return null;
  const materials = (o.materials || []).filter((m) => COVER.materials[m]);
  const styles = (o.styles || []).filter((x) => COVER.styles.includes(x));
  return { enabled: true, materials: materials.length ? materials : Object.keys(COVER.materials), styles: styles.length ? styles : ['plain'], tag: !!o.tag };
}
function cleanCoverChoice(c, opts, spreads) {
  if (!c || !opts) return null;
  const material = opts.materials.includes(c.material) ? c.material : null;
  if (!material) return null;
  const color = COVER.materials[material].includes(String(c.color).toUpperCase()) ? String(c.color).toUpperCase() : COVER.materials[material][0];
  const style = opts.styles.includes(c.style) ? c.style : opts.styles[0];
  const out = { material, color, style };
  if (style !== 'plain' && c.photo) out.photo = { spread: Math.max(0, Math.min(spreads - 1, c.photo.spread | 0)), side: c.photo.side === 'L' ? 'L' : 'R' };
  if (opts.tag && c.tag && c.tag.on) out.tag = { on: true, text: String(c.tag.text || '').slice(0, 40), finish: COVER.finishes.includes(c.tag.finish) ? c.tag.finish : 'gold' };
  return out;
}

// secret for client viewer tokens, created once and kept in the database
let cachedSecret = null;
async function viewerSecret(env) {
  if (cachedSecret) return cachedSecret;
  let row = await env.DB.prepare("SELECT value FROM config WHERE key = 'viewer_secret'").first();
  if (!row) {
    await env.DB.prepare("INSERT OR IGNORE INTO config (key, value) VALUES ('viewer_secret', ?)").bind(randomHex(32)).run();
    row = await env.DB.prepare("SELECT value FROM config WHERE key = 'viewer_secret'").first();
  }
  cachedSecret = row.value;
  return cachedSecret;
}

// ---------- rate limit ----------
async function limited(env, key, max) {
  const row = await env.DB.prepare('SELECT count, reset_at FROM attempts WHERE key = ?').bind(key).first();
  return row && row.reset_at > now() && row.count >= max;
}
async function failAttempt(env, key, windowMs) {
  const row = await env.DB.prepare('SELECT count, reset_at FROM attempts WHERE key = ?').bind(key).first();
  if (!row || row.reset_at < now()) await env.DB.prepare('INSERT OR REPLACE INTO attempts (key, count, reset_at) VALUES (?, 1, ?)').bind(key, now() + windowMs).run();
  else await env.DB.prepare('UPDATE attempts SET count = count + 1 WHERE key = ?').bind(key).run();
}

// ---------- who is calling: a connected PC (its own app key) ----------
async function caller(req, env) {
  const key = req.headers.get('x-app-key') || '';
  const device = req.headers.get('x-device-id') || '';
  if (key.length < 32 || !/^dev_[a-f0-9]{32}$/.test(device)) return null;
  const row = await env.DB.prepare('SELECT key_hash FROM app_keys WHERE key_hash = ?').bind(await sha256(key)).first();
  if (!row) return null;
  let studio = '';
  try { studio = decodeURIComponent(req.headers.get('x-studio') || '').slice(0, 80); } catch (_) { studio = ''; }
  return { owner: 'd:' + device, studio };
}

async function prefixBytes(env, prefix) {
  let bytes = 0, files = 0, cursor;
  do {
    const list = await env.BUCKET.list({ prefix, cursor });
    for (const o of list.objects) { bytes += o.size || 0; files++; }
    cursor = list.truncated ? list.cursor : null;
  } while (cursor);
  return { bytes, files };
}
async function deletePrefix(env, prefix) {
  let cursor;
  do {
    const list = await env.BUCKET.list({ prefix, cursor });
    if (list.objects.length) await env.BUCKET.delete(list.objects.map((o) => o.key));
    cursor = list.truncated ? list.cursor : null;
  } while (cursor);
}
async function deleteAlbum(env, id) {
  await deletePrefix(env, `albums/${id}/`);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM comments WHERE album_id = ?').bind(id),
    env.DB.prepare('DELETE FROM albums WHERE id = ?').bind(id)
  ]);
}
// Links that ended more than 14 days ago are removed so storage stays inside the free 10 GB.
const CLEAN_AFTER = 14 * 86400000;
async function cleanExpired(env) {
  const { results } = await env.DB.prepare('SELECT id FROM albums WHERE expires_at IS NOT NULL AND expires_at < ? LIMIT 20').bind(now() - CLEAN_AFTER).all();
  for (const r of results) await deleteAlbum(env, r.id);
  return results.length;
}

const spreadKey = (albumId, version, i) => `albums/${albumId}/v${version}/spread_${String(i + 1).padStart(2, '0')}.jpg`;
function albumUrl(req, slug) { return `${new URL(req.url).origin}/a/${slug}`; }

// ---------- desktop app API ----------
async function apiRoutes(req, env, url) {
  const path = url.pathname;
  const m = req.method;
  if (path === '/api/health') return json({ ok: true, version: WORKER_VERSION });

  const me = await caller(req, env);
  if (!me) return bad('This PC is not connected to this Endora Cloud. Open Settings and connect Cloudflare again.', 401);
  if (path === '/api/me') return json({ owner: me.owner, version: WORKER_VERSION });

  // storage used by this PC's albums (and the whole bucket)
  if (path === '/api/storage' && m === 'GET') {
    const cleaned = await cleanExpired(env);
    const { results } = await env.DB.prepare('SELECT id, slug, couple, date, owner, created_at, updated_at, expires_at, active, approved_at, video_key FROM albums ORDER BY updated_at DESC').all();
    const albums = [];
    let total = 0, mine = 0;
    for (const a of results) {
      const { bytes } = await prefixBytes(env, `albums/${a.id}/`);
      total += bytes;
      if (a.owner !== me.owner) continue;
      mine += bytes;
      let videoBytes = 0;
      if (a.video_key) { const h = await env.BUCKET.head(a.video_key); videoBytes = h ? h.size : 0; }
      albums.push({ id: a.id, slug: a.slug, couple: a.couple, date: a.date, url: albumUrl(req, a.slug), bytes, videoBytes,
        createdAt: a.created_at, updatedAt: a.updated_at, expiresAt: a.expires_at, active: !!a.active, approvedAt: a.approved_at });
    }
    const others = results.filter((a) => a.owner !== me.owner).length;
    return json({ totalBytes: total, myBytes: mine, freeBytes: 10 * 1024 ** 3, albums, otherAlbums: others, cleaned, cleanAfterDays: 14 });
  }

  // create or update an album
  if (path === '/api/albums' && m === 'POST') {
    await cleanExpired(env);
    const b = await body(req);
    const spreads = Math.max(1, Math.min(200, b.spreads | 0));
    const pin = /^\d{4,8}$/.test(String(b.pin)) ? String(b.pin) : String(1000 + Math.floor(Math.random() * 9000));
    const expires = b.expiryDays ? now() + Number(b.expiryDays) * 86400000 : null;
    let album = b.albumId ? await env.DB.prepare('SELECT * FROM albums WHERE id = ? AND owner = ?').bind(b.albumId, me.owner).first() : null;
    const version = album ? album.version + 1 : 1;
    const common = [String(b.couple || '').slice(0, 120), String(b.date || '').slice(0, 40), Number(b.aspect) || 3, spreads, version, pin,
      String(b.cover || '#3B2E25').slice(0, 9), ['before', 'page', 'end', 'none'].includes(b.videoPos) ? b.videoPos : 'none', String(b.music || 'video'),
      JSON.stringify(b.perms || {}), JSON.stringify((b.sections || []).slice(0, 200).map((s) => String(s).slice(0, 60))), expires, me.studio, now()];
    if (!album) {
      const id = 'alb_' + randomHex(10);
      let slug = randomSlug();
      while (await env.DB.prepare('SELECT 1 FROM albums WHERE slug = ?').bind(slug).first()) slug = randomSlug();
      await env.DB.prepare(`INSERT INTO albums (id, owner, slug, couple, date, aspect, spreads, version, pin, cover, video_pos, music, perms, sections, expires_at, studio, updated_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, me.owner, slug, ...common, now()).run();
      album = { id, slug, video_key: null };
    } else {
      await env.DB.prepare(`UPDATE albums SET couple = ?, date = ?, aspect = ?, spreads = ?, version = ?, pin = ?, cover = ?, video_pos = ?, music = ?, perms = ?, sections = ?, expires_at = ?, studio = ?, updated_at = ? WHERE id = ?`)
        .bind(...common, album.id).run();
    }
    await env.DB.prepare('UPDATE albums SET cover_options = ? WHERE id = ?').bind(JSON.stringify(cleanCoverOptions(b.coverOptions)), album.id).run();
    const uploads = [];
    for (let i = 0; i < spreads; i++) uploads.push({ kind: 'spread', index: i, route: `/api/albums/${album.id}/spread/${i + 1}?v=${version}` });
    if (b.video && (b.replaceVideo || !album.video_key)) uploads.push({ kind: 'video', route: `/api/albums/${album.id}/video`, contentType: b.video.type || 'video/mp4' });
    else if (!b.video && album.video_key) {
      await env.BUCKET.delete(album.video_key);
      await env.DB.prepare('UPDATE albums SET video_key = NULL, video_type = NULL WHERE id = ?').bind(album.id).run();
    }
    return json({ albumId: album.id, slug: album.slug, version, url: albumUrl(req, album.slug), uploads });
  }

  const am = path.match(/^\/api\/albums\/(alb_[a-f0-9]+)(\/publish|\/spread\/(\d{1,3})|\/video(?:\/(start|part|complete))?|\/comments\/(\d+))?$/);
  if (!am) return bad('Not found', 404);
  const album = await env.DB.prepare('SELECT * FROM albums WHERE id = ? AND owner = ?').bind(am[1], me.owner).first();
  if (!album) return bad('Album not found', 404);
  const sub = am[2] || '';

  // one spread image (small, straight through the Worker)
  if (am[3] && m === 'PUT') {
    const i = +am[3] - 1, v = +url.searchParams.get('v');
    if (i < 0 || i >= album.spreads || v !== album.version) return bad('Old upload, please send again.', 409);
    await env.BUCKET.put(spreadKey(album.id, v, i), req.body, { httpMetadata: { contentType: 'image/jpeg' } });
    return json({ ok: true });
  }

  // video: R2 multipart upload in 50 MB parts, so films of any size work
  if (sub === '/video' && m === 'DELETE') {
    if (album.video_key) await env.BUCKET.delete(album.video_key);
    await env.DB.prepare("UPDATE albums SET video_key = NULL, video_type = NULL, video_pos = 'none' WHERE id = ?").bind(album.id).run();
    return json({ ok: true });
  }
  if (sub.startsWith('/video')) {
    const step = am[4];
    if (step === 'start' && m === 'POST') {
      const b = await body(req);
      const type = ['video/mp4', 'video/quicktime', 'video/webm'].includes(b.type) ? b.type : 'video/mp4';
      const ext = type === 'video/quicktime' ? 'mov' : type === 'video/webm' ? 'webm' : 'mp4';
      const key = `albums/${album.id}/video/${randomHex(6)}.${ext}`;
      const mp = await env.BUCKET.createMultipartUpload(key, { httpMetadata: { contentType: type } });
      return json({ key, uploadId: mp.uploadId, type });
    }
    const key = url.searchParams.get('key') || '';
    const uploadId = url.searchParams.get('uploadId') || '';
    if (!key.startsWith(`albums/${album.id}/video/`)) return bad('Bad video key');
    const mp = env.BUCKET.resumeMultipartUpload(key, uploadId);
    if (step === 'part' && m === 'PUT') {
      const n = Math.max(1, Math.min(10000, +url.searchParams.get('n') || 1));
      const part = await mp.uploadPart(n, req.body);
      return json({ partNumber: part.partNumber, etag: part.etag });
    }
    if (step === 'complete' && m === 'POST') {
      const b = await body(req);
      await mp.complete((b.parts || []).map((p) => ({ partNumber: +p.partNumber, etag: String(p.etag) })));
      if (album.video_key && album.video_key !== key) await env.BUCKET.delete(album.video_key);
      await env.DB.prepare('UPDATE albums SET video_key = ?, video_type = ? WHERE id = ?').bind(key, String(b.type || 'video/mp4'), album.id).run();
      return json({ ok: true });
    }
    return bad('Not found', 404);
  }

  if (sub === '/publish' && m === 'POST') {
    for (let i = 0; i < album.spreads; i++) {
      if (!(await env.BUCKET.head(spreadKey(album.id, album.version, i)))) return bad(`Spread ${i + 1} did not upload. Please try again.`, 409);
    }
    const old = album.live_version;
    await env.DB.prepare('UPDATE albums SET live_version = version, live_spreads = spreads, active = 1, approved_at = NULL, approved_by = NULL, updated_at = ? WHERE id = ?').bind(now(), album.id).run();
    if (old && old !== album.version) {
      const list = await env.BUCKET.list({ prefix: `albums/${album.id}/v${old}/` });
      if (list.objects.length) await env.BUCKET.delete(list.objects.map((o) => o.key));
    }
    return json({ url: albumUrl(req, album.slug) });
  }
  if (am[5] && m === 'PATCH') {
    const b = await body(req);
    await env.DB.prepare('UPDATE comments SET resolved = ? WHERE id = ? AND album_id = ?').bind(b.resolved ? 1 : 0, +am[5], album.id).run();
    return json({ ok: true });
  }
  if (!sub && m === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM comments WHERE album_id = ? ORDER BY created_at DESC').bind(album.id).all();
    return json({
      album: { id: album.id, slug: album.slug, views: album.views, approvedAt: album.approved_at, approvedBy: album.approved_by, active: !!album.active,
        coverChoice: album.cover_choice ? JSON.parse(album.cover_choice) : null, coverChosenAt: album.cover_chosen_at },
      comments: results.map((c) => ({ id: c.id, spread: c.spread, x: c.x, y: c.y, kind: c.kind, name: c.name, text: c.text, resolved: !!c.resolved, createdAt: c.created_at }))
    });
  }
  if (!sub && m === 'PATCH') {
    const b = await body(req);
    if (typeof b.active === 'boolean') await env.DB.prepare('UPDATE albums SET active = ? WHERE id = ?').bind(b.active ? 1 : 0, album.id).run();
    return json({ ok: true });
  }
  if (!sub && m === 'DELETE') {
    await deleteAlbum(env, album.id);
    return json({ ok: true });
  }

  return bad('Not found', 404);
}

// ---------- client viewer ----------
async function viewerToken(env, album) { return (await hmac(await viewerSecret(env), album.id + ':' + album.pin)).slice(0, 40); }

async function liveAlbum(env, slug) {
  const a = await env.DB.prepare('SELECT * FROM albums WHERE slug = ?').bind(slug).first();
  if (!a || !a.live_version) return { error: 'This album link does not exist.', status: 404 };
  if (!a.active) return { error: 'This album link has been turned off by your photographer.', status: 410 };
  if (a.expires_at && a.expires_at < now()) return { error: 'This album link has expired. Please ask your photographer for a new one.', status: 410 };
  return { album: a };
}

async function viewerRoutes(req, env, url) {
  const vm = url.pathname.match(/^\/v\/([A-Za-z0-9]{6,20})\/(unlock|meta|file\/spread_(\d{2,3})\.jpg|video|comments|approve|cover)$/);
  if (!vm) return bad('Not found', 404);
  const { album, error, status } = await liveAlbum(env, vm[1]);
  if (!album) return bad(error, status);
  const action = vm[2];
  const perms = JSON.parse(album.perms || '{}');

  if (action === 'unlock' && req.method === 'POST') {
    const ip = req.headers.get('cf-connecting-ip') || 'x';
    const key = 'pin:' + album.id + ':' + ip;
    if (await limited(env, key, 8)) return bad('Too many wrong PINs. Please wait 15 minutes.', 429);
    const b = await body(req);
    if (!safeEqual(String(b.pin || ''), album.pin)) { await failAttempt(env, key, 15 * 60000); return bad('That PIN is not right.', 403); }
    await env.DB.prepare('UPDATE albums SET views = views + 1 WHERE id = ?').bind(album.id).run();
    return json({ token: await viewerToken(env, album) });
  }
  const t = url.searchParams.get('t') || req.headers.get('x-album-token') || '';
  if (!safeEqual(t, await viewerToken(env, album))) return bad('Please enter the PIN again.', 401);
  const spreads = album.live_spreads || album.spreads;

  if (action === 'meta') {
    const { results } = await env.DB.prepare('SELECT id, spread, x, y, kind, name, text, created_at FROM comments WHERE album_id = ? ORDER BY created_at').bind(album.id).all();
    return json({
      couple: album.couple, date: album.date, studio: album.studio, aspect: album.aspect, spreads,
      version: album.live_version, cover: album.cover, videoPos: album.video_key ? album.video_pos : 'none', hasVideo: !!album.video_key,
      sections: JSON.parse(album.sections || '[]'), perms, approvedAt: album.approved_at, approvedBy: album.approved_by,
      coverOptions: album.cover_options ? JSON.parse(album.cover_options) : null,
      coverChoice: album.cover_choice ? JSON.parse(album.cover_choice) : null,
      comments: results
    });
  }
  if (vm[3]) {
    const i = parseInt(vm[3], 10) - 1;
    if (i < 0 || i >= spreads) return bad('Not found', 404);
    const obj = await env.BUCKET.get(spreadKey(album.id, album.live_version, i));
    if (!obj) return bad('Not found', 404);
    const h = new Headers({ 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=86400' });
    if (url.searchParams.get('dl') === '1') {
      if (!perms.download) return bad('Downloads are turned off for this album.', 403);
      h.set('content-disposition', `attachment; filename="${(album.couple || 'album').replace(/[^A-Za-z0-9]+/g, '_')}_spread_${vm[3]}.jpg"`);
    }
    return new Response(obj.body, { headers: h });
  }
  if (action === 'video') {
    if (!album.video_key) return bad('No video', 404);
    const head = await env.BUCKET.head(album.video_key);
    if (!head) return bad('Video is still uploading.', 404);
    const size = head.size;
    const range = req.headers.get('range');
    let start = 0, end = size - 1, opts = {};
    const r = range && /bytes=(\d*)-(\d*)/.exec(range);
    if (r) {
      if (r[1] === '' && r[2]) { start = Math.max(0, size - +r[2]); end = size - 1; }
      else { start = +r[1]; end = r[2] ? Math.min(+r[2], size - 1) : Math.min(start + 8 * 1048576 - 1, size - 1); }
      if (start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
      opts = { range: { offset: start, length: end - start + 1 } };
    }
    const obj = await env.BUCKET.get(album.video_key, opts);
    const h = new Headers({ 'content-type': album.video_type || 'video/mp4', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=3600' });
    if (r) {
      h.set('content-range', `bytes ${start}-${end}/${size}`);
      h.set('content-length', String(end - start + 1));
      return new Response(obj.body, { status: 206, headers: h });
    }
    h.set('content-length', String(size));
    return new Response(obj.body, { headers: h });
  }
  if (action === 'comments' && req.method === 'POST') {
    const b = await body(req);
    const kind = b.kind === 'swap' ? 'swap' : 'comment';
    if (kind === 'swap' && !perms.swap) return bad('Swap requests are turned off.', 403);
    if (kind === 'comment' && !perms.comment) return bad('Comments are turned off.', 403);
    const text = String(b.text || '').trim().slice(0, 1000);
    if (!text) return bad('Write something first.');
    const spread = Math.max(0, Math.min(spreads - 1, b.spread | 0));
    const clamp = (v) => (v == null ? null : Math.max(0, Math.min(1, Number(v))));
    const res = await env.DB.prepare('INSERT INTO comments (album_id, spread, x, y, kind, name, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(album.id, spread, clamp(b.x), clamp(b.y), kind, String(b.name || '').slice(0, 60), text, now()).run();
    return json({ id: res.meta.last_row_id, createdAt: now() });
  }
  if (action === 'cover' && req.method === 'POST') {
    const opts = album.cover_options ? JSON.parse(album.cover_options) : null;
    if (!opts) return bad('Your photographer has not turned on cover choice for this album.', 403);
    if (album.approved_at) return bad('The album is already approved, so the cover can no longer be changed here. Please ask your photographer.', 409);
    const b = await body(req);
    const choice = cleanCoverChoice(b.choice, opts, spreads);
    if (!choice) return bad('Please choose a material first.');
    if (b.name) choice.by = String(b.name).slice(0, 60);
    await env.DB.prepare('UPDATE albums SET cover_choice = ?, cover_chosen_at = ? WHERE id = ?').bind(JSON.stringify(choice), now(), album.id).run();
    return json({ ok: true, choice });
  }
  if (action === 'approve' && req.method === 'POST') {
    if (!perms.approve) return bad('Approval is turned off for this album.', 403);
    const b = await body(req);
    await env.DB.prepare('UPDATE albums SET approved_at = ?, approved_by = ? WHERE id = ?').bind(now(), String(b.name || 'Client').slice(0, 60), album.id).run();
    return json({ ok: true, approvedAt: now() });
  }
  return bad('Not found', 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/')) return await apiRoutes(req, env, url);
      if (url.pathname.startsWith('/v/')) return await viewerRoutes(req, env, url);
      if (/^\/a\/[A-Za-z0-9]{6,20}\/?$/.test(url.pathname)) {
        return new Response(VIEWER_HTML, { headers: {
          'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
          'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'x-robots-tag': 'noindex, nofollow'
        } });
      }
      if (url.pathname === '/') return new Response('Endora Album', { headers: { 'content-type': 'text/plain' } });
      return bad('Not found', 404);
    } catch (err) {
      console.error(err);
      return bad('Something went wrong on the server.', 500);
    }
  }
};
