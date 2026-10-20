import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { exerciseRepeaterBox } from './repeater-box-scenario.mjs';

const root = path.resolve(import.meta.dirname, '..'), source = path.join(root, 'artifacts/repeater-box-demo.rea.json');
const screenshotPath = path.join(root, 'artifacts/repeater-box-desktop.png'), demoHtml = path.join(root, 'artifacts/repeater-box-demo.html');
const digest = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const sourceHash = await digest(source), document = JSON.parse(await fs.readFile(source, 'utf8'));
await fs.mkdir(path.join(root, '.build'), { recursive: true });
const userData = await fs.mkdtemp(path.join(root, '.build', 'repeater-box-desktop-'));
const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
try {
  const errors = [], network = [], observed = new WeakSet();
  const observe = page => { if (!observed.has(page)) { observed.add(page); page.on('pageerror', error => errors.push(error.message)); } };
  app.on('window', observe); app.windows().forEach(observe);
  await app.context().route(/^https?:\/\//, route => { network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setContentSize(1600, 1100); });
  const open = async file => {
    await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, file);
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name: /^Open…/ }).click();
    await expect(page.locator('.statusbar')).toContainText('Document opened'); await expect(page.locator('.titlebar')).toContainText(document.name);
  };
  const save = async file => {
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, file);
    await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual(document);
  };
  await open(source); const saved = path.join(userData, 'box.rea.json'); await save(saved); await open(saved); await save(path.join(userData, 'reopened.rea.json'));
  await page.getByTitle('Preview (F5)', { exact: true }).click(); await exerciseRepeaterBox(page.locator('.preview-overlay'));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.invalidate());
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const image = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'));
  const png = Buffer.from(image, 'base64'); expect(png.length).toBeGreaterThan(1000); await fs.writeFile(screenshotPath, png);
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); await save(path.join(userData, 'after-preview.rea.json'));
  const html = path.join(userData, 'box.html');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, html);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  expect((await fs.stat(html)).size).toBeGreaterThan(1000); await app.context().setOffline(true);
  const next = app.waitForEvent('window');
  const offlineId = await app.evaluate(({ BrowserWindow }) => {
    const window = new BrowserWindow({ show: false, width: 1600, height: 1100, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    void window.loadURL('about:blank'); return window.id;
  });
  const offline = await next; observe(offline);
  try {
    await app.evaluate(({ BrowserWindow }, { id, url }) => BrowserWindow.fromId(id).loadURL(url), { id: offlineId, url: pathToFileURL(html).href });
    await offline.waitForLoadState('domcontentloaded'); await exerciseRepeaterBox(offline);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible()))).toBe(true);
  } finally { await offline.close(); await app.context().setOffline(false); }
  await save(path.join(userData, 'after-export.rea.json')); expect(await digest(source)).toBe(sourceHash); expect(errors).toEqual([]); expect(network).toEqual([]);
  await fs.copyFile(html, demoHtml);
  const result = { ok: true, executablePath: executablePath ?? null, userData, nativeSaveReopen: true, previewAndActualExportVerified: true,
    paddingAndIndependentBorders: true, borderBoxComputedMinimum: true, nativeBorderAccumulationAndRefresh: true,
    sourceAndTargetGeometryExpressions: true, emptyRawGeometryAndCssMinimum: true, hiddenWindows: true, exportedHtmlTestedOffline: true, authoredDocumentUnchanged: true,
    sourceHash, savedHash: await digest(saved), exportedHtmlHash: await digest(demoHtml), unexpectedNetworkRequests: network.length, pageErrors: errors,
    screenshotPath, demoHtml, verifiedAt: new Date().toISOString(), originalAxureGuiComparison: false };
  await fs.writeFile(path.join(root, '.build/repeater-box-desktop-audit.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} finally { await app.close(); }
