'use strict';
// Sets up Endora Cloud on the photographer's own Cloudflare account, using an API token they paste.
// Creates (or reuses): D1 database, R2 bucket, the Worker (flipbook site) on workers.dev, and an app key for this PC.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API = 'https://api.cloudflare.com/client/v4';
const SCRIPT = 'endora-album';
const DB_NAME = 'endora-album';
const BUCKET = 'endora-albums';
const COMPAT = '2025-09-01';

// Template link: opens Cloudflare's "Create token" page with the right permissions already ticked.
const TOKEN_URL = 'https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=' + encodeURIComponent(JSON.stringify([
  { key: 'workers_scripts', type: 'edit' },
  { key: 'd1', type: 'edit' },
  { key: 'workers_r2', type: 'edit' },
  { key: 'account_settings', type: 'read' }
])) + '&name=' + encodeURIComponent('Endora Album') + '&accountId=*&zoneId=all';

function srcDir() { return path.join(__dirname, '..', 'cloudflare'); }
function bundledWorker() {
  const worker = fs.readFileSync(path.join(srcDir(), 'src', 'worker.js'), 'utf8');
  const viewer = fs.readFileSync(path.join(srcDir(), 'src', 'viewer.html'), 'utf8');
  const schema = fs.readFileSync(path.join(srcDir(), 'schema.sql'), 'utf8');
  const m = /WORKER_VERSION\s*=\s*(\d+)/.exec(worker);
  return { worker, viewer, schema, version: m ? +m[1] : 0 };
}

class CfError extends Error {
  constructor(msg, code) { super(msg); this.code = code; }
}

function makeClient(token, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  return async function cf(method, route, body, extraHeaders) {
    const headers = { authorization: 'Bearer ' + token, ...(extraHeaders || {}) };
    let payload = body;
    if (body && !(body instanceof FormData) && typeof body !== 'string') { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    let res;
    try { res = await doFetch(API + route, { method, headers, body: payload }); }
    catch (_) { throw new CfError('Cannot reach Cloudflare. Check your internet connection.'); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.success === false) {
      const e = (j.errors && j.errors[0]) || {};
      throw new CfError(e.message || ('Cloudflare error ' + res.status), e.code || res.status);
    }
    return j.result;
  };
}

function friendly(err, step) {
  const c = err.code;
  if (c === 10042 || /enable R2/i.test(err.message)) {
    return new CfError('R2 storage is not turned on yet. In Cloudflare open R2 Object Storage, press "Purchase R2 plan" (the first 10 GB are free), then press Connect again.', 'R2_OFF');
  }
  if (c === 9109 || c === 10000 || c === 403 || /auth/i.test(err.message)) {
    return new CfError(`The token is missing a permission (${step}). Make the token again with the button in step 2.`, 'PERM');
  }
  return new CfError(`${step}: ${err.message}`, c);
}

/**
 * Runs the whole setup. onStep({ label, done, total }) reports progress.
 * Returns the config to save in settings (without the token).
 */
async function setup({ token, label, onStep, fetchImpl, waitMs = 90000 }) {
  const cf = makeClient(token.trim(), fetchImpl);
  const doFetch = fetchImpl || fetch;
  const steps = 8; let n = 0;
  const step = (l) => onStep && onStep({ label: l, done: n++, total: steps });
  const run = async (label2, fn) => { try { return await fn(); } catch (e) { throw e instanceof CfError && e.code === 'R2_OFF' ? e : friendly(e, label2); } };
  const b = bundledWorker();

  step('Checking the token');
  const accounts = await run('Checking the token', () => cf('GET', '/accounts?per_page=50'));
  if (!accounts || !accounts.length) throw new CfError('This token cannot see any Cloudflare account. Make the token again with "All accounts".');
  const account = accounts[0];
  const acc = `/accounts/${account.id}`;

  step('Creating the database');
  let db = (await run('Database', () => cf('GET', `${acc}/d1/database?name=${DB_NAME}`)) || []).find((d) => d.name === DB_NAME);
  if (!db) db = await run('Database', () => cf('POST', `${acc}/d1/database`, { name: DB_NAME }));
  const dbId = db.uuid;

  step('Preparing the database tables');
  const statements = b.schema.replace(/--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean);
  for (const sql of statements) await run('Database tables', () => cf('POST', `${acc}/d1/database/${dbId}/query`, { sql }));

  step('Creating photo storage (R2)');
  let haveBucket = false;
  try { await cf('GET', `${acc}/r2/buckets/${BUCKET}`); haveBucket = true; }
  catch (e) { if (e.code === 10042) throw friendly(e, 'R2'); }
  if (!haveBucket) await run('R2 storage', () => cf('POST', `${acc}/r2/buckets`, { name: BUCKET }));

  step('Getting your free workers.dev address');
  let sub = null;
  try { sub = (await cf('GET', `${acc}/workers/subdomain`)).subdomain; } catch (_) { sub = null; }
  if (!sub) {
    const base = 'endora-' + crypto.randomBytes(3).toString('hex');
    sub = (await run('workers.dev address', () => cf('PUT', `${acc}/workers/subdomain`, { subdomain: base }))).subdomain || base;
  }

  step('Uploading the flipbook site');
  await deployScript(cf, acc, dbId, b);

  step('Turning the site on');
  await run('Site address', () => cf('POST', `${acc}/workers/scripts/${SCRIPT}/subdomain`, { enabled: true, previews_enabled: false }));
  const url = `https://${SCRIPT}.${sub}.workers.dev`;

  step('Connecting this PC');
  const appKey = crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(appKey).digest('hex');
  await run('Connecting this PC', () => cf('POST', `${acc}/d1/database/${dbId}/query`, {
    sql: 'INSERT OR REPLACE INTO app_keys (key_hash, label, created_at) VALUES (?, ?, ?)', params: [keyHash, String(label || 'PC').slice(0, 60), Date.now()]
  }));

  // a brand-new workers.dev address can take a minute or two to come online
  let live = false;
  const until = Date.now() + waitMs;
  while (Date.now() < until) {
    try { const r = await doFetch(url + '/api/health'); if (r.ok) { live = true; break; } } catch (_) { /* not yet */ }
    await new Promise((r) => setTimeout(r, 4000));
  }
  onStep && onStep({ label: 'Done', done: steps, total: steps });
  return {
    config: { url, accountId: account.id, accountName: account.name, dbId, bucket: BUCKET, script: SCRIPT, subdomain: sub, workerVersion: b.version, connectedAt: Date.now(), live },
    appKey
  };
}

async function deployScript(cf, acc, dbId, b) {
  b = b || bundledWorker();
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({
    main_module: 'worker.js',
    compatibility_date: COMPAT,
    bindings: [
      { type: 'd1', name: 'DB', id: dbId },
      { type: 'r2_bucket', name: 'BUCKET', bucket_name: BUCKET }
    ]
  })], { type: 'application/json' }));
  form.append('worker.js', new Blob([b.worker], { type: 'application/javascript+module' }), 'worker.js');
  form.append('viewer.html', new Blob([b.viewer], { type: 'text/plain' }), 'viewer.html');
  try { await cf('PUT', `${acc}/workers/scripts/${SCRIPT}`, form); }
  catch (e) { throw friendly(e, 'Uploading the site'); }
  return b.version;
}

// Re-upload the Worker after an app update brings a newer flipbook/server version.
async function upgradeIfNeeded({ token, config, fetchImpl }) {
  const b = bundledWorker();
  if (!config || !token || (config.workerVersion || 0) >= b.version) return null;
  const cf = makeClient(token, fetchImpl);
  const acc = `/accounts/${config.accountId}`;
  const statements = b.schema.replace(/--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean);
  for (const sql of statements) await cf('POST', `${acc}/d1/database/${config.dbId}/query`, { sql });
  await deployScript(cf, acc, config.dbId, b);
  return b.version;
}

module.exports = { setup, upgradeIfNeeded, bundledWorker, TOKEN_URL, CfError };
