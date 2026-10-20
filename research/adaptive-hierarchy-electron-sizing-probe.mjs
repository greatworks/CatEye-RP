import { _electron as electron } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
const exe = path.resolve(process.argv[2]);
const asar = path.join(path.dirname(exe), 'resources/app.asar');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-adaptive-sizing-'));
const result = { timestamp: new Date().toISOString(), method: 'Actual packaged Electron hidden isolated about:blank BrowserWindow; setContentSize and DOM viewport readings. No original Axure GUI or product changes.', exe, asarSha256: sha(await fs.readFile(asar)), userData, rows: [], errors: [] };
let app;
try {
  app = await electron.launch({ executablePath: exe, env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  await app.context().route(/^https?:\/\//, route => route.abort());
  result.platform = await app.evaluate(({ screen }) => ({ versions: process.versions, displays: screen.getAllDisplays().map(d => ({ id: d.id, scaleFactor: d.scaleFactor, bounds: d.bounds, workArea: d.workArea })) }));
  const pending = app.waitForEvent('window');
  const windowId = await app.evaluate(({ BrowserWindow }) => {
    const win = new BrowserWindow({ show: false, width: 1200, height: 1000, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    win.setContentSize(1200, 1000); void win.loadURL('about:blank'); return win.id;
  });
  const page = await pending; await page.waitForLoadState();
  page.on('pageerror', error => result.errors.push(error.message));
  for (const [width, height] of [...[300, 495, 496, 497, 498, 499, 500, 501, 502, 503, 504, 505, 900].map(height => [390, height]), ...[386, 387, 388, 389, 390, 391, 392].map(width => [width, 900])]) {
    await app.evaluate(({ BrowserWindow }, { id, width, height }) => BrowserWindow.fromId(id).setContentSize(width, height), { id: windowId, width, height });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const dom = await page.evaluate(() => ({ inner: [innerWidth, innerHeight], outer: [outerWidth, outerHeight], dpr: devicePixelRatio, rect: [document.documentElement.clientWidth, document.documentElement.clientHeight] }));
    const host = await app.evaluate(({ BrowserWindow, screen }, id) => {
      const win = BrowserWindow.fromId(id); return { content: win.getContentSize(), contentBounds: win.getContentBounds(), bounds: win.getBounds(), minimum: win.getMinimumSize(), zoom: win.webContents.getZoomFactor(), scale: screen.getDisplayMatching(win.getBounds()).scaleFactor, visible: win.isVisible() };
    }, windowId);
    result.rows.push({ requested: [width, height], dom, host });
  }
  await page.close();
  if (sha(await fs.readFile(asar)) !== result.asarSha256) throw new Error('Package changed during probe');
  result.ok = result.errors.length === 0;
} catch (error) { result.failure = error.stack ?? String(error); process.exitCode = 1; }
finally { if (app) await app.close(); await fs.writeFile('research/adaptive-hierarchy-electron-sizing-probe.json', JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2)); }
