import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..'), executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-shadows-'));
const source = path.join(root, 'artifacts/shadow-demo.rea.json'), sourceBytes = await fs.readFile(source), authored = JSON.parse(sourceBytes);
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, sourceSha256: sha(sourceBytes), userData, errors: [], network: [], screenshots: [], pickerResponsesMocked: true, originalAxureGuiCompared: false };
let app;
try {
  if (executablePath) audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observe = page => page.on('pageerror', error => audit.errors.push(error.message)); app.on('window', observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1600, 1100); w.webContents.setBackgroundThrottling(false); return w.id; });
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const open = async file => { await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file); await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened'); };
  const save = async name => { const file = path.join(userData, name); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file); await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${name}`); return JSON.parse(await fs.readFile(file, 'utf8')); };
  const capture = async (file, id, target = page) => {
    // capturePage can otherwise return the compositor frame from before the last
    // click even after computed styles have updated in a hidden window.
    await app.evaluate(({ BrowserWindow }, id) => { const w = BrowserWindow.fromId(id); w.webContents.setBackgroundThrottling(false); w.webContents.invalidate(); }, id);
    await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), id), 'base64');
    expect(bytes.length).toBeGreaterThan(1000); await fs.writeFile(path.join(root, file), bytes); audit.screenshots.push({ file, sha256: sha(bytes) });
  };
  // Hidden OOPIF input requires a compositor frame after any scroll; preserve real pointer input.
  const click = async locator => { await locator.scrollIntoViewIfNeeded(); const window = await app.browserWindow(locator.page()); await window.evaluate(async w => (await w.webContents.capturePage(undefined, { stayHidden: true })).toPNG().length); await window.dispose(); await locator.click(); };
  await open(source); expect(await save('initial.rea.json')).toEqual(authored);
  const canvas = page.locator('.editor-widget.box').filter({ hasText: 'Surface shadow' }); await canvas.click();
  const inspector = page.locator('.inspector'); await inspector.getByRole('tab', { name: 'Style', exact: true }).click();
  await expect(inspector.getByLabel('Outer shadow enabled', { exact: true })).toBeChecked();
  const offset = inspector.getByLabel('Outer shadow Offset X', { exact: true }); await offset.fill('-11'); await offset.press('Enter');
  const edited = await save('edited.rea.json'); expect(edited.pages[0].widgets.find(w => w.id === 'shadow-card').style.outerShadow.offsetX).toBe(-11);
  const expected = structuredClone(authored); expected.pages[0].widgets.find(w => w.id === 'shadow-card').style.outerShadow.offsetX = -11; expect(edited).toEqual(expected);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save('undo.rea.json')).toEqual(authored);
  await capture('artifacts/shadow-editor.png', mainId);
  const exercise = async scope => {
    const widget = id => scope.locator(`[data-widget-id="${id}"]`), card = widget('shadow-card');
    await expect(card).toHaveCSS('box-shadow', 'rgba(36, 60, 120, 0.4) 8px 9px 6px 0px');
    await expect(widget('shadow-inset')).toHaveCSS('box-shadow', 'rgba(80, 37, 153, 0.65) 5px 4px 7px 3px inset');
    await expect(widget('shadow-lettering').locator('.widget-text')).toHaveCSS('text-shadow', 'rgba(78, 70, 184, 0.55) 2px 3px 1px');
    await expect(widget('shadow-child').locator('.widget-text')).toHaveCSS('text-shadow', 'none');
    await expect(widget('shadow-row')).toHaveCount(2);
    const before = await card.evaluate(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }));
    await click(widget('shadow-off'));
    await expect(card).toHaveCSS('box-shadow', 'none'); await expect(widget('shadow-inset')).toHaveCSS('box-shadow', 'none');
    await expect(widget('shadow-lettering').locator('.widget-text')).toHaveCSS('text-shadow', 'none');
    for (const row of await widget('shadow-row').all()) await expect(row).toHaveCSS('box-shadow', 'none');
    await click(widget('shadow-on')); await expect(card).toHaveCSS('box-shadow', 'rgba(36, 60, 120, 0.4) 8px 9px 6px 0px');
    expect(await card.evaluate(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }))).toEqual(before);
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay'); await exercise(preview);
  await capture('artifacts/shadow-preview.png', mainId);
  await preview.locator('[data-page-id="shadow-frame-page"]').click(); const nested = preview.frameLocator('iframe[data-inline-frame="shadow-frame"]'); await exercise(nested);
  audit.fixedFramePlayer = true; await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  expect(await save('after-preview.rea.json')).toEqual(authored);
  const exported = path.join(root, 'artifacts/shadow-demo.html'); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, exported);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  await app.context().setOffline(true);
  const pending = app.waitForEvent('window'), offlineId = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ show: false, width: 1600, height: 1100, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } }); w.setContentSize(1600, 1100); void w.loadURL('about:blank'); return w.id; });
  const offline = await pending;
  try {
    await app.evaluate(({ BrowserWindow }, data) => BrowserWindow.fromId(data.id).loadURL(data.url), { id: offlineId, url: pathToFileURL(exported).href }); await exercise(offline.locator('body'));
    await capture('artifacts/shadow-offline.png', offlineId, offline);
    await offline.locator('nav').getByRole('button', { name: 'Embedded comparison', exact: true }).click(); await exercise(offline.frameLocator('iframe[data-inline-frame="shadow-frame"]'));
    audit.offlineNestedPlayer = true;
  } finally { await offline.close(); await app.context().setOffline(false); }
  expect(await save('after-offline.rea.json')).toEqual(authored);
  const nativeFile = path.join(root, 'research/samples/Default.rplib'), nativeHash = sha(await fs.readFile(nativeFile));
  expect(nativeHash).toBe('9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50');
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, nativeFile);
  await menu('Import Axure .rp (experimental)…'); const report = page.getByRole('dialog', { name: 'RP import report', exact: true });
  await expect(report).toContainText('40 page(s), 34 recovered widget(s), 6 skipped item(s).'); await report.getByRole('button', { name: 'Close report', exact: true }).click();
  const native = await save('native-shadow.rea.json'), nativePage = 'rp-p-36c2002954b54b97b14662a24587dbf9', nativeId = 'rp-w-36c2002954b54b97b14662a24587dbf9-fd98c89bf60143758b00e772e08f4b42';
  const imported = native.pages.find(p => p.id === nativePage).widgets.find(w => w.id === nativeId);
  expect(imported.style.outerShadow).toEqual({ on: true, offsetX: 5, offsetY: 5, blurRadius: 5, color: '#00000033' });
  await open(path.join(userData, 'native-shadow.rea.json')); expect(await save('native-reopened.rea.json')).toEqual(native);
  await page.getByTitle('Preview (F5)', { exact: true }).click(); await preview.locator(`[data-page-id="${nativePage}"]`).click();
  await expect(preview.locator(`[data-widget-id="${nativeId}"] .widget-vector`)).toHaveCSS('filter', 'drop-shadow(rgba(0, 0, 0, 0.2) 5px 5px 5px)');
  await capture('artifacts/shadow-native-preview.png', mainId); await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  audit.native = { file: nativeFile, sha256: nativeHash, widgetId: nativeId, outerShadow: imported.style.outerShadow, workerImport: true, saveReopen: true, actualSvgFilter: true };
  expect(sha(await fs.readFile(nativeFile))).toBe(nativeHash); await open(source);
  expect(await save('final.rea.json')).toEqual(authored); expect(sha(await fs.readFile(source))).toBe(audit.sourceSha256); expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(w => !w.isVisible()))).toBe(true);
  if (executablePath) expect(sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit, { ok: true, sourceUnchanged: true, designUnchanged: true, hiddenWindows: true });
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally { try { if (app) await app.close(); } finally { audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, '.build/shadow-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); } }
