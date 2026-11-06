'use strict';
const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { parseExifDate } = require('./exif');

let sharp = null;
try { sharp = require('sharp'); } catch (e) { console.error('sharp not available', e); }

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);
const cfSetup = require('./cloudflare-setup');
const { readLayers } = require('./psd');
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm']);
const THUMB_SIZE = 640;

const dataDir = () => app.getPath('userData');
const projectsDir = () => path.join(dataDir(), 'projects');
const wordArtDir = () => path.join(dataDir(), 'wordart');
const assetsDir = () => path.join(__dirname, '..', 'renderer', 'assets');
const projectDir = (id) => path.join(projectsDir(), safeId(id));
const settingsFile = () => path.join(dataDir(), 'settings.json');

// Only files the user picked (or our own cache) may be served to the renderer.
const allowed = new Set();
function allow(p) { if (p) allowed.add(path.resolve(p)); }
function isAllowed(p) {
  const r = path.resolve(p);
  if (allowed.has(r)) return true;
  const roots = [projectsDir(), wordArtDir()].map((d) => path.resolve(d) + path.sep);
  return roots.some((root) => r.startsWith(root));
}

function safeId(id) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(id))) throw new Error('Bad project id');
  return String(id);
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'endora', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true, bypassCSP: false } }
]);

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#141416',
    title: 'Endora Album',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Chromium's FaceDetector (Shape Detection API) is used for face-safe crops.
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

app.whenReady().then(async () => {
  await fsp.mkdir(projectsDir(), { recursive: true });
  protocol.handle('endora', async (request) => {
    const u = new URL(request.url);
    let p;
    if (u.host === 'app') {
      // files shipped with the app (word art pack); never outside renderer/assets
      p = path.resolve(assetsDir(), decodeURIComponent(u.pathname.replace(/^\//, '')));
      if (!p.startsWith(path.resolve(assetsDir()) + path.sep)) return new Response('Forbidden', { status: 403 });
    } else {
      p = decodeURIComponent(u.pathname.replace(/^\//, ''));
      if (u.host !== 'file' || !isAllowed(p)) return new Response('Forbidden', { status: 403 });
    }
    const res = await net.fetch(pathToFileURL(p).toString(), { headers: request.headers });
    // CORS header so the renderer can read pixels (sharpness / face analysis) without tainting canvases
    const headers = new Headers(res.headers);
    headers.set('access-control-allow-origin', '*');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  });
  createWindow();
  setupUpdates();
  setTimeout(upgradeCloud, 8000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ---------- auto updates ----------
// New versions are published as GitHub Releases (see .github/workflows/release.yml).
// Windows installs updates by itself. A Mac app must be signed by Apple to update itself,
// so an unsigned Mac build shows a "Download" button that opens the new .dmg instead.
const pkg = require('../package.json');
const MAC_SIGNED = !!(pkg.endora && pkg.endora.macSigned);
let updater = null;
let lastInfo = null;
const sendUpdate = (data) => { if (win && !win.isDestroyed()) win.webContents.send('update:status', data); };

function canSelfInstall() {
  return process.platform === 'win32' || (process.platform === 'darwin' && MAC_SIGNED);
}

function setupUpdates() {
  if (!app.isPackaged) return;
  try { updater = require('electron-updater').autoUpdater; } catch (e) { console.error('electron-updater missing', e); return; }
  updater.autoDownload = canSelfInstall();
  updater.autoInstallOnAppQuit = canSelfInstall();
  updater.on('checking-for-update', () => sendUpdate({ state: 'checking' }));
  updater.on('update-not-available', () => sendUpdate({ state: 'latest', version: app.getVersion() }));
  updater.on('update-available', (info) => {
    lastInfo = info;
    sendUpdate({ state: canSelfInstall() ? 'downloading' : 'available', version: info.version, notes: info.releaseNotes || '', percent: 0 });
  });
  updater.on('download-progress', (p) => sendUpdate({ state: 'downloading', version: lastInfo && lastInfo.version, percent: Math.round(p.percent) }));
  updater.on('update-downloaded', (info) => sendUpdate({ state: 'ready', version: info.version }));
  updater.on('error', (err) => sendUpdate({ state: 'error', message: String((err && err.message) || err).split('\n')[0] }));
  const check = () => updater.checkForUpdates().catch(() => {});
  setTimeout(check, 5000);
  setInterval(check, 4 * 60 * 60 * 1000);
}

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) return { state: 'dev', version: app.getVersion() };
  if (!updater) return { state: 'error', message: 'Updater is not available' };
  await updater.checkForUpdates().catch((e) => sendUpdate({ state: 'error', message: e.message }));
  return { state: 'checking' };
});
ipcMain.handle('update:install', () => { if (updater) setImmediate(() => updater.quitAndInstall(false, true)); });
ipcMain.handle('update:download', async () => {
  // unsigned Mac: open the release page; the photographer picks the .dmg for their Mac
  const pub = (pkg.build.publish || [])[0] || {};
  const v = lastInfo ? 'tag/v' + lastInfo.version : 'latest';
  await shell.openExternal(`https://github.com/${pub.owner}/${pub.repo}/releases/${v}`);
});

// ---------- settings ----------
async function readSettings() {
  try { return JSON.parse(await fsp.readFile(settingsFile(), 'utf8')); } catch { return {}; }
}
ipcMain.handle('settings:get', async () => {
  const s = await readSettings();
  (s.userWordArt || []).forEach((w) => allow(w.path));
  return s;
});
ipcMain.handle('settings:set', async (_e, patch) => {
  const next = { ...(await readSettings()), ...patch };
  await fsp.writeFile(settingsFile(), JSON.stringify(next, null, 2));
  return next;
});

// ---------- projects ----------
ipcMain.handle('projects:list', async () => {
  const out = [];
  for (const d of await fsp.readdir(projectsDir()).catch(() => [])) {
    try {
      const p = JSON.parse(await fsp.readFile(path.join(projectsDir(), d, 'project.json'), 'utf8'));
      out.push({
        id: p.id, couple: p.couple, date: p.date, status: p.status, size: p.size,
        photoCount: (p.photos || []).length, spreadCount: (p.spreads || []).length,
        cover: p.photos && p.photos[0] ? p.photos[0].thumb : null, updatedAt: p.updatedAt,
        cloud: p.cloud || null
      });
      (p.photos || []).slice(0, 1).forEach((ph) => allow(ph.thumb));
    } catch (_) { /* skip broken folders */ }
  }
  return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
});

ipcMain.handle('projects:get', async (_e, id) => {
  const p = JSON.parse(await fsp.readFile(path.join(projectDir(id), 'project.json'), 'utf8'));
  (p.photos || []).forEach((ph) => { allow(ph.path); allow(ph.thumb); });
  if (p.share && p.share.video) allow(p.share.video);
  return p;
});

ipcMain.handle('projects:save', async (_e, project) => {
  const dir = projectDir(project.id);
  await fsp.mkdir(dir, { recursive: true });
  project.updatedAt = Date.now();
  const tmp = path.join(dir, 'project.json.tmp');
  await fsp.writeFile(tmp, JSON.stringify(project));
  await fsp.rename(tmp, path.join(dir, 'project.json'));
  return project.updatedAt;
});

ipcMain.handle('projects:delete', async (_e, id) => {
  await fsp.rm(projectDir(id), { recursive: true, force: true });
  return true;
});

// ---------- photos ----------
async function walk(dir, out, depth = 0) {
  if (depth > 6) return;
  for (const ent of await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(p, out, depth + 1);
    else if (IMAGE_EXT.has(path.extname(ent.name).toLowerCase())) out.push(p);
  }
}

ipcMain.handle('photos:pick', async (_e, mode) => {
  const res = await dialog.showOpenDialog(win, {
    title: mode === 'files' ? 'Choose photos' : 'Choose a folder of photos',
    properties: mode === 'files' ? ['openFile', 'multiSelections'] : ['openDirectory', 'multiSelections'],
    filters: mode === 'files' ? [{ name: 'Photos', extensions: [...IMAGE_EXT].map((x) => x.slice(1)) }] : undefined
  });
  if (res.canceled) return [];
  const out = [];
  for (const p of res.filePaths) {
    const st = await fsp.stat(p);
    if (st.isDirectory()) await walk(p, out);
    else if (IMAGE_EXT.has(path.extname(p).toLowerCase())) out.push(p);
  }
  return out;
});

ipcMain.handle('photos:expandDropped', async (_e, paths) => {
  const out = [];
  for (const p of paths || []) {
    const st = await fsp.stat(p).catch(() => null);
    if (!st) continue;
    if (st.isDirectory()) await walk(p, out);
    else if (IMAGE_EXT.has(path.extname(p).toLowerCase())) out.push(p);
  }
  return out;
});

async function processOne(projectId, file) {
  const st = await fsp.stat(file);
  const key = crypto.createHash('sha1').update(file + '|' + st.size + '|' + st.mtimeMs).digest('hex').slice(0, 20);
  const thumbDir = path.join(projectDir(projectId), 'thumbs');
  await fsp.mkdir(thumbDir, { recursive: true });
  const thumb = path.join(thumbDir, key + '.jpg');
  let width = 0, height = 0, takenAt = null;
  const img = sharp(file, { failOn: 'none' });
  const meta = await img.metadata();
  width = meta.width || 0; height = meta.height || 0;
  if ((meta.orientation || 1) >= 5) [width, height] = [height, width];
  takenAt = parseExifDate(meta.exif);
  if (!fs.existsSync(thumb)) {
    await sharp(file, { failOn: 'none' }).rotate()
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 }).toFile(thumb);
  }
  allow(file); allow(thumb);
  return {
    id: key, path: file, thumb, name: path.basename(file), width, height,
    takenAt: takenAt || st.mtimeMs, bytes: st.size
  };
}

ipcMain.handle('photos:process', async (e, projectId, files) => {
  if (!sharp) throw new Error('Image engine (sharp) is missing. Run npm install again.');
  safeId(projectId);
  const results = new Array(files.length);
  let done = 0, next = 0;
  const failed = [];
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      try { results[i] = await processOne(projectId, files[i]); }
      catch (err) { failed.push({ file: files[i], error: String(err.message || err) }); }
      done++;
      if (done % 5 === 0 || done === files.length) e.sender.send('photos:progress', { done, total: files.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, files.length) }, worker));
  return { photos: results.filter(Boolean), failed };
});

// Crop + resize one original for print/web export (sharp reads JPG, PNG, WebP, TIFF; EXIF rotation applied).
ipcMain.handle('photos:crop', async (_e, file, rect, outW, outH) => {
  if (!sharp) throw new Error('Image engine (sharp) is missing.');
  if (!isAllowed(file)) throw new Error('File not allowed');
  const left = Math.max(0, Math.round(rect.x)), top = Math.max(0, Math.round(rect.y));
  const m = await sharp(file, { failOn: 'none' }).metadata();
  const meta = (m.orientation || 1) >= 5 ? { width: m.height, height: m.width } : { width: m.width, height: m.height };
  const width = Math.max(1, Math.min(meta.width - left, Math.round(rect.w)));
  const height = Math.max(1, Math.min(meta.height - top, Math.round(rect.h)));
  const buf = await sharp(file, { failOn: 'none' }).rotate()
    .extract({ left, top, width, height })
    .resize(Math.max(1, Math.round(outW)), Math.max(1, Math.round(outH)), { fit: 'fill', kernel: 'lanczos3' })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toBuffer();
  return buf;
});

// ---------- word art import (PSD layers / PNG) ----------
function inkInfo(rgba, w, h) {
  const counts = new Map(); let total = 0;
  const step = Math.max(1, Math.floor((w * h) / 40000));
  for (let i = 0; i < w * h; i += step) {
    if (rgba[i * 4 + 3] < 150) continue;
    const key = ((rgba[i * 4] >> 5) << 6) | ((rgba[i * 4 + 1] >> 5) << 3) | (rgba[i * 4 + 2] >> 5);
    counts.set(key, (counts.get(key) || 0) + 1); total++;
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return { color: '#000000', mono: true };
  const k = top[0], c = (v) => Math.min(255, (v << 5) + 16).toString(16).padStart(2, '0');
  return { color: '#' + c(k >> 6) + c((k >> 3) & 7) + c(k & 7), mono: top[1] / total > 0.7 };
}

async function saveArt(rgba, w, h, name) {
  await fsp.mkdir(wordArtDir(), { recursive: true });
  let img = sharp(rgba, { raw: { width: w, height: h, channels: 4 } });
  try { img = sharp(await img.png().toBuffer()).trim({ threshold: 1 }); } catch (_) { /* fully used */ }
  const { data, info } = await img.resize(1400, 1400, { fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // skip layers that are almost empty
  let ink = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 40) ink++;
  if (ink < 60) return null;
  const id = 'u' + crypto.randomBytes(6).toString('hex');
  const file = path.join(wordArtDir(), id + '.png');
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file);
  allow(file);
  return { id, path: file, name: (name || 'Word art').replace(/\s+/g, ' ').trim().slice(0, 60), w: info.width, h: info.height, ...inkInfo(data, info.width, info.height) };
}

ipcMain.handle('wordart:import', async () => {
  if (!sharp) throw new Error('Image engine (sharp) is missing.');
  const res = await dialog.showOpenDialog(win, {
    title: 'Add word art from Photoshop files or PNGs', properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Photoshop or PNG', extensions: ['psd', 'psb', 'png'] }]
  });
  if (res.canceled) return { items: [], skipped: [] };
  const items = [], skipped = [];
  for (const f of res.filePaths) {
    try {
      if (/\.png$/i.test(f)) {
        const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const it = await saveArt(data, info.width, info.height, path.basename(f, path.extname(f)));
        if (it) items.push(it);
        continue;
      }
      const psd = readLayers(await fsp.readFile(f));
      for (const l of psd.layers) {
        const full = l.width >= psd.width * 0.95 && l.height >= psd.height * 0.95;
        if (/^(background|layer 0)$/i.test(l.name) || (!l.hasAlpha && full)) continue;
        if (l.width < 12 || l.height < 12) continue;
        // a layer with no transparent pixels is a photo or a box, not word art
        let clear = 0; for (let i = 3; i < l.rgba.length; i += 4 * 7) if (l.rgba[i] < 20) clear++;
        if (clear < (l.rgba.length / 28) * 0.05) { skipped.push(l.name); continue; }
        const it = await saveArt(l.rgba, l.width, l.height, /^layer \d+/i.test(l.name) ? path.basename(f, path.extname(f)) : l.name);
        if (it) items.push(it);
      }
    } catch (err) { skipped.push(path.basename(f) + ': ' + err.message); }
  }
  return { items, skipped };
});

ipcMain.handle('wordart:remove', async (_e, file) => {
  if (file && path.resolve(file).startsWith(path.resolve(wordArtDir()) + path.sep)) await fsp.rm(file, { force: true });
  return true;
});

// ---------- video ----------
ipcMain.handle('video:pick', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose highlight video', properties: ['openFile'],
    filters: [{ name: 'Video', extensions: [...VIDEO_EXT].map((x) => x.slice(1)) }]
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const p = res.filePaths[0];
  allow(p);
  const st = await fsp.stat(p);
  return { path: p, name: path.basename(p), bytes: st.size };
});

// ---------- export ----------
ipcMain.handle('export:chooseDir', async (_e, suggested) => {
  const res = await dialog.showOpenDialog(win, { title: 'Export album to folder', properties: ['openDirectory', 'createDirectory'], defaultPath: suggested });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle('export:writeFile', async (_e, dir, name, data) => {
  if (!dir || /[\\/]|\.\./.test(name)) throw new Error('Bad export name');
  const target = path.join(dir, name);
  await fsp.writeFile(target, Buffer.from(data));
  return target;
});

ipcMain.handle('export:writeJpegWithDpi', async (_e, dir, name, data, dpi) => {
  if (!dir || /[\\/]|\.\./.test(name)) throw new Error('Bad export name');
  const target = path.join(dir, name);
  let buf = Buffer.from(data);
  if (sharp) buf = await sharp(buf).withMetadata({ density: dpi || 300 }).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
  await fsp.writeFile(target, buf);
  return target;
});

ipcMain.handle('export:writeTiff', async (_e, dir, name, data, dpi) => {
  if (!sharp) throw new Error('TIFF export needs sharp');
  if (!dir || /[\\/]|\.\./.test(name)) throw new Error('Bad export name');
  const target = path.join(dir, name);
  await sharp(Buffer.from(data)).withMetadata({ density: dpi || 300 }).tiff({ compression: 'lzw' }).toFile(target);
  return target;
});

ipcMain.handle('export:openFolder', async (_e, dir) => { if (dir) await shell.openPath(dir); });

// ---------- misc ----------
ipcMain.handle('shell:open', async (_e, url) => {
  if (/^(https:\/\/|mailto:)/.test(url)) await shell.openExternal(url);
});

ipcMain.handle('qr:make', async (_e, text) => {
  const QR = require('qrcode');
  return QR.toDataURL(text, { margin: 1, width: 512, color: { dark: '#141416', light: '#ffffff' } });
});

// ---------- cloud (the photographer's own Cloudflare) ----------
// Settings → Connect Cloudflare: the photographer pastes an API token once; cloudflare-setup.js
// creates the database, storage and the flipbook site on their free workers.dev address.
// The token and this PC's app key are kept encrypted with the operating system's keychain.
async function writeSettings(s) { await fsp.writeFile(settingsFile(), JSON.stringify(s, null, 2)); }
const seal = (txt) => (safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(txt).toString('base64') : 'raw:' + txt);
const unseal = (v) => {
  if (!v) return '';
  if (v.startsWith('enc:')) { try { return safeStorage.decryptString(Buffer.from(v.slice(4), 'base64')); } catch { return ''; } }
  return v.startsWith('raw:') ? v.slice(4) : '';
};

async function deviceId() {
  const s = await readSettings();
  if (s.deviceId) return s.deviceId;
  const id = 'dev_' + crypto.randomBytes(16).toString('hex');
  await writeSettings({ ...s, deviceId: id });
  return id;
}

async function cloudConn() {
  const s = await readSettings();
  if (!s.cloud || !s.cloud.url || !s.appKey) throw new Error('Connect Cloudflare first (Settings → Connect Cloudflare).');
  return { url: s.cloud.url, key: unseal(s.appKey), studio: s.studio || '' };
}
async function cloudHeaders(extra) {
  const c = await cloudConn();
  return { url: c.url, headers: { 'x-app-key': c.key, 'x-device-id': await deviceId(), 'x-studio': encodeURIComponent(c.studio), 'x-app-version': app.getVersion(), ...(extra || {}) } };
}
async function readJson(res) {
  const text = await res.text();
  let j; try { j = JSON.parse(text); } catch { j = { error: text.slice(0, 200) }; }
  if (!res.ok) throw new Error(j.error || ('Endora Cloud error ' + res.status));
  return j;
}
async function cloudFetch(route, init) {
  if (!/^\/api\//.test(route)) throw new Error('Bad route');
  const { url, headers } = await cloudHeaders(init.headers);
  try { return await net.fetch(url + route, { ...init, headers }); }
  catch (_) { throw new Error('Cannot reach your Endora Cloud. Check the internet connection.'); }
}

ipcMain.handle('cloud:status', async () => {
  const s = await readSettings();
  return s.cloud ? { connected: true, url: s.cloud.url, accountName: s.cloud.accountName, live: s.cloud.live !== false } : { connected: false };
});
ipcMain.handle('cloud:openTokenPage', () => shell.openExternal(cfSetup.TOKEN_URL));
ipcMain.handle('cloud:openSignup', () => shell.openExternal('https://dash.cloudflare.com/sign-up'));
ipcMain.handle('cloud:openR2', async () => shell.openExternal('https://dash.cloudflare.com/?to=/:account/r2/overview'));
ipcMain.handle('cloud:setup', async (e, token) => {
  const res = await cfSetup.setup({
    token, label: require('os').hostname(),
    onStep: (p) => { if (!e.sender.isDestroyed()) e.sender.send('cloud:progress', p); }
  });
  const s = await readSettings();
  await writeSettings({ ...s, cloud: res.config, appKey: seal(res.appKey), cfToken: seal(token.trim()) });
  return { connected: true, url: res.config.url, accountName: res.config.accountName, live: res.config.live };
});
ipcMain.handle('cloud:disconnect', async () => {
  const s = await readSettings();
  delete s.cloud; delete s.appKey; delete s.cfToken;
  await writeSettings(s);
  return true;
});

ipcMain.handle('cloud:request', async (_e, method, route, body) => {
  const res = await cloudFetch(route, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return readJson(res);
});

// one spread image
ipcMain.handle('cloud:upload', async (_e, route, contentType, data) => {
  const buf = Buffer.from(data);
  return readJson(await cloudFetch(route, { method: 'PUT', headers: { 'content-type': contentType, 'content-length': String(buf.length) }, body: buf }));
});

// highlight video in 50 MB parts (Workers accept up to 100 MB per request)
const PART = 50 * 1048576;
ipcMain.handle('cloud:uploadVideo', async (e, route, filePath, type) => {
  if (!isAllowed(filePath)) throw new Error('File not allowed');
  const size = (await fsp.stat(filePath)).size;
  const start = await readJson(await cloudFetch(route + '/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type }) }));
  const q = `key=${encodeURIComponent(start.key)}&uploadId=${encodeURIComponent(start.uploadId)}`;
  const parts = [];
  const total = Math.max(1, Math.ceil(size / PART));
  for (let i = 0; i < total; i++) {
    const from = i * PART, to = Math.min(size, from + PART) - 1;
    const buf = await new Promise((resolve, reject) => {
      const chunks = [];
      fs.createReadStream(filePath, { start: from, end: to }).on('data', (c) => chunks.push(c)).on('end', () => resolve(Buffer.concat(chunks))).on('error', reject);
    });
    let tries = 0, part;
    while (!part) {
      try { part = await readJson(await cloudFetch(`${route}/part?${q}&n=${i + 1}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream', 'content-length': String(buf.length) }, body: buf })); }
      catch (err) { if (++tries >= 3) throw err; await new Promise((r) => setTimeout(r, 2000 * tries)); }
    }
    parts.push({ partNumber: part.partNumber, etag: part.etag });
    if (!e.sender.isDestroyed()) e.sender.send('cloud:progress', { label: 'Uploading video', done: i + 1, total });
  }
  return readJson(await cloudFetch(`${route}/complete?${q}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ parts, type: start.type }) }));
});

// After an app update with a newer flipbook site, upload it to the photographer's Cloudflare quietly.
async function upgradeCloud() {
  try {
    const s = await readSettings();
    if (!s.cloud || !s.cfToken) return;
    const v = await cfSetup.upgradeIfNeeded({ token: unseal(s.cfToken), config: s.cloud });
    if (v) { const s2 = await readSettings(); s2.cloud.workerVersion = v; await writeSettings(s2); }
  } catch (err) { console.error('cloud upgrade failed', err.message); }
}
