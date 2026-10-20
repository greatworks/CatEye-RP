const { contextBridge, ipcRenderer } = require('electron');
if (process.isMainFrame) contextBridge.exposeInMainWorld('desktop', {
  openUrl: (url, target, previewId) => ipcRenderer.invoke('prototype:open-url', url, target, previewId),
  openDocument: () => ipcRenderer.invoke('document:open'),
  importRpDocument: () => ipcRenderer.invoke('document:import-rp'),
  saveDocument: (text, name) => ipcRenderer.invoke('document:save', text, name),
  exportPrototype: (html, name) => ipcRenderer.invoke('prototype:export', html, name),
});
