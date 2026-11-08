'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const inv = (ch) => (...args) => ipcRenderer.invoke(ch, ...args);

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  settings: { get: inv('settings:get'), set: inv('settings:set') },
  projects: { list: inv('projects:list'), get: inv('projects:get'), save: inv('projects:save'), remove: inv('projects:delete') },
  photos: {
    pick: inv('photos:pick'),
    expandDropped: inv('photos:expandDropped'),
    process: inv('photos:process'),
    crop: inv('photos:crop'),
    pathForFile: (file) => webUtils.getPathForFile(file),
    onProgress: (cb) => {
      const h = (_e, d) => cb(d);
      ipcRenderer.on('photos:progress', h);
      return () => ipcRenderer.removeListener('photos:progress', h);
    }
  },
  video: { pick: inv('video:pick') },
  exporter: {
    chooseDir: inv('export:chooseDir'),
    writeFile: inv('export:writeFile'),
    writeJpeg: inv('export:writeJpegWithDpi'),
    writeTiff: inv('export:writeTiff'),
    openFolder: inv('export:openFolder')
  },
  shell: { open: inv('shell:open') },
  qr: inv('qr:make'),
  cloud: {
    status: inv('cloud:status'), setup: inv('cloud:setup'), disconnect: inv('cloud:disconnect'), test: inv('cloud:test'), openUrl: inv('cloud:openUrl'),
    openTokenPage: inv('cloud:openTokenPage'), openSignup: inv('cloud:openSignup'), openR2: inv('cloud:openR2'),
    request: inv('cloud:request'), upload: inv('cloud:upload'), uploadVideo: inv('cloud:uploadVideo'),
    onProgress: (cb) => {
      const h = (_e, d) => cb(d);
      ipcRenderer.on('cloud:progress', h);
      return () => ipcRenderer.removeListener('cloud:progress', h);
    }
  },
  updates: {
    version: inv('app:version'),
    check: inv('update:check'),
    install: inv('update:install'),
    download: inv('update:download'),
    onStatus: (cb) => {
      const h = (_e, d) => cb(d);
      ipcRenderer.on('update:status', h);
      return () => ipcRenderer.removeListener('update:status', h);
    }
  },
  wordart: { import: inv('wordart:import'), remove: inv('wordart:remove') },
  fileUrl: (p) => 'endora://file/' + encodeURIComponent(p),
  assetUrl: (rel) => 'endora://app/' + rel.split('/').map(encodeURIComponent).join('/')
});
