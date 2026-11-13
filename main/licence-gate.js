'use strict';
// Endora licence gate for Electron apps: call `await ensureLicence({...})` before opening the main window.
// Shows a small "Enter your licence key" window when the app is not licensed (or the trial is over),
// re-checks the key every 6 hours, and quits the app if the licence is revoked or expires.
const { BrowserWindow, ipcMain, shell, app } = require('electron');
const { Licence } = require('./licence');

function page(o) {
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#0b0a09;color:#f5f0e8;font:15px/1.5 "Segoe UI",-apple-system,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;-webkit-app-region:drag}
.b{width:360px;text-align:center;-webkit-app-region:no-drag}h1{font:500 26px Georgia,serif;color:#c8a96a;margin:0 0 6px}p{color:rgba(245,240,232,.7);margin:0 0 18px}
input{width:100%;box-sizing:border-box;background:#161412;color:#f5f0e8;border:1px solid #3a332c;border-radius:4px;padding:12px;font:16px monospace;letter-spacing:.06em;text-align:center;text-transform:uppercase}
button{width:100%;margin-top:10px;background:#c8a96a;color:#0b0a09;border:0;border-radius:4px;padding:12px;font-weight:700;cursor:pointer}button.s{background:transparent;color:#c8a96a;border:1px solid #c8a96a}
.e{color:#ff8a80;min-height:22px;margin-top:8px;font-size:13px}a{color:#c8a96a}.m{font-size:12px;color:rgba(245,240,232,.5);margin-top:16px}</style></head><body><div class="b">
<h1>${esc(o.title)}</h1><p id="msg">${esc(o.message)}</p>
<input id="k" placeholder="EWF-XXX-XXXX-XXXX-XXXX" autocomplete="off" autofocus>
<button id="go">Activate</button>${o.trialLeft ? `<button class="s" id="tr">Continue free trial (${o.trialLeft} day${o.trialLeft === 1 ? '' : 's'} left)</button>` : ''}
<div class="e" id="e"></div><div class="m">No key yet? <a href="#" id="buy">Buy a licence</a> · The key comes on WhatsApp.</div></div>
<script>const {ipcRenderer}=require('electron');const e=document.getElementById('e'),k=document.getElementById('k'),g=document.getElementById('go');
async function go(){if(!k.value.trim()){e.textContent='Paste the licence key from your WhatsApp message.';return}g.disabled=true;e.textContent='Checking…';const r=await ipcRenderer.invoke('endora-lic-activate',k.value);g.disabled=false;e.textContent=r.ok?'':(r.message||'This key did not work.')}
g.onclick=go;k.onkeydown=(x)=>{if(x.key==='Enter')go()};document.getElementById('buy').onclick=(x)=>{x.preventDefault();ipcRenderer.invoke('endora-lic-buy')};
const t=document.getElementById('tr');if(t)t.onclick=()=>ipcRenderer.invoke('endora-lic-trial');</script></body></html>`;
}

/**
 * @param {{product:string,title:string,buyUrl:string,trialDays?:number,icon?:string}} o
 * @returns {Promise<Licence>} resolves once the app may start
 */
function ensureLicence(o) {
  const lic = new Licence(app.getPath('userData'), o.product, { trialDays: o.trialDays || 0 });
  return new Promise(async (resolve) => {
    let s = await lic.refresh();
    let win = null, started = false;
    const done = () => {
      if (started) return;
      started = true;
      if (win && !win.isDestroyed()) win.close();
      ipcMain.removeHandler('endora-lic-activate'); ipcMain.removeHandler('endora-lic-buy'); ipcMain.removeHandler('endora-lic-trial');
      // keep checking while the app runs
      setInterval(async () => {
        const n = await lic.refresh();
        if (!n.ok) { require('electron').dialog.showErrorBox(o.title, n.message || 'Your licence is no longer valid.'); app.quit(); }
      }, 6 * 3600 * 1000);
      resolve(lic);
    };
    if (s.ok && s.state === 'licensed') return done();
    ipcMain.handle('endora-lic-activate', async (e, key) => {
      try { const r = await lic.activate(key); if (r.ok) setTimeout(done, 300); return r; } catch (err) { return { ok: false, message: err.message || 'Could not reach the licence server. Check the internet.' }; }
    });
    ipcMain.handle('endora-lic-buy', () => shell.openExternal(o.buyUrl));
    ipcMain.handle('endora-lic-trial', () => { if (lic.status().state === 'trial') setTimeout(done, 100); });
    win = new BrowserWindow({ width: 480, height: 470, resizable: false, title: o.title + ' – Licence', backgroundColor: '#0b0a09', icon: o.icon, autoHideMenuBar: true, webPreferences: { nodeIntegration: true, contextIsolation: false } });
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page({ title: o.title, message: s.message || 'Enter your licence key to start.', trialLeft: s.state === 'trial' ? s.daysLeft : 0 })));
    win.on('closed', () => { win = null; if (!started) app.quit(); });
  });
}

module.exports = { ensureLicence };
