const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const MAX_BYTES = 25 * 1024 * 1024;
let mainWindow;
let importingRp = false;
const externalPreviews = new Map();
function checkedWebUrl(value) {
  if (typeof value !== 'string' || value.length > 4096 || value !== value.trim() || !/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007f\\]/.test(value) || value.includes('[[')) throw new Error('Invalid web URL');
  const parsed = new URL(value); if (!parsed.hostname || parsed.username || parsed.password) throw new Error('Invalid web URL');
  return value;
}
function readRp(file) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(path.join(__dirname,'import-rp-worker.cjs'),{workerData:{file},resourceLimits:{maxOldGenerationSizeMb:256}});
    let completed=false;
    const finish=(error,value)=>{if(completed)return;completed=true;clearTimeout(timer);void worker.terminate();error?reject(error):resolve(value)};
    const timer=setTimeout(()=>finish(new Error('RP import exceeded the 30 second analysis limit')),30000);
    worker.once('message',result=>finish(result.ok?null:new Error(result.error),result.semantics));
    worker.once('error',error=>finish(error));
    worker.once('exit',code=>{if(!completed)finish(new Error(`RP analysis ended without a result (code ${code})`))});
  });
}
if (process.env.REA_HEADLESS_TEST === '1' && process.env.REA_TEST_USER_DATA) app.setPath('userData', process.env.REA_TEST_USER_DATA);
function allowedSender(event) { return event.sender === mainWindow?.webContents && event.senderFrame === mainWindow?.webContents.mainFrame; }
function assertText(text) { if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_BYTES) throw new Error('Document exceeds the 25 MB limit.'); }
async function atomicWrite(destination, text) {
  const temporary = `${destination}.${process.pid}.tmp`;
  try { await fs.writeFile(temporary, text, 'utf8'); await fs.rename(temporary, destination); }
  catch (error) { await fs.rm(temporary, { force: true }); throw error; }
}
app.whenReady().then(() => {
  mainWindow = new BrowserWindow({ show: process.env.REA_HEADLESS_TEST !== '1', width: 1480, height: 960, minWidth: 1060, minHeight: 700, backgroundColor: '#ffffff', title: 'REA Prototype Studio', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  ipcMain.handle('prototype:open-url', async (event, value, target, previewId) => {
    if (!allowedSender(event)) throw new Error('Unauthorized sender');
    const url = checkedWebUrl(value);
    if (!['current','new'].includes(target) || typeof previewId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(previewId)) throw new Error('Invalid navigation target');
    let preview = target === 'current' ? externalPreviews.get(previewId) : undefined;
    if (!preview || preview.isDestroyed()) {
      preview = new BrowserWindow({ parent: mainWindow, show: process.env.REA_HEADLESS_TEST !== '1', width: 1200, height: 850, title: new URL(url).origin, autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
      preview.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      preview.webContents.on('will-attach-webview', event => event.preventDefault());
      const guard = (event, destination) => { try { checkedWebUrl(destination); } catch { event.preventDefault(); } };
      preview.webContents.on('will-navigate', guard); preview.webContents.on('will-redirect', guard);
      if (target === 'current') { externalPreviews.set(previewId, preview); preview.on('closed', () => externalPreviews.delete(previewId)); }
    }
    await preview.loadURL(url);
  });
  ipcMain.handle('document:open', async (event) => {
    if (!allowedSender(event)) throw new Error('Unauthorized sender');
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'REA Prototype', extensions: ['json'] }] });
    if (result.canceled) return null;
    const file = result.filePaths[0];
    if ((await fs.stat(file)).size > MAX_BYTES) throw new Error('Document exceeds the 25 MB limit.');
    return { name: path.basename(file), text: await fs.readFile(file, 'utf8') };
  });
  ipcMain.handle('document:import-rp',async(event)=>{
    if(!allowedSender(event))throw new Error('Unauthorized sender');
    if(importingRp)throw new Error('Another RP import is still running');
    importingRp=true;
    try{
      const result=await dialog.showOpenDialog(mainWindow,{properties:['openFile'],filters:[{name:'Axure RP project',extensions:['rp']}]});
      if(result.canceled)return null;
      const file=result.filePaths[0];
      if((await fs.stat(file)).size>128*1024*1024)throw new Error('RP file exceeds the 128 MB limit');
      return {name:path.basename(file),semantics:await readRp(file)};
    }finally{importingRp=false}
  });
  ipcMain.handle('document:save', async (event, text, suggestedName) => {
    if (!allowedSender(event)) throw new Error('Unauthorized sender');
    assertText(text);
    const parsed = JSON.parse(text);
    if (parsed.format !== 'rea-prototype' || parsed.version !== 1) throw new Error('Invalid document format');
    const safeName = String(suggestedName || 'Untitled').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0,120);
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: `${safeName}.rea.json`, filters: [{ name: 'REA Prototype', extensions: ['json'] }] });
    if (result.canceled || !result.filePath) return null;
    await atomicWrite(result.filePath, text);
    return path.basename(result.filePath);
  });
  ipcMain.handle('prototype:export', async (event, html, suggestedName) => {
    if (!allowedSender(event)) throw new Error('Unauthorized sender');
    assertText(html);
    const safeName = String(suggestedName || 'prototype').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0,120);
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: `${safeName}.html`, filters: [{ name: 'HTML prototype', extensions: ['html'] }] });
    if (result.canceled || !result.filePath) return null;
    await atomicWrite(result.filePath, html);
    return path.basename(result.filePath);
  });
});
app.on('window-all-closed', () => app.quit());
