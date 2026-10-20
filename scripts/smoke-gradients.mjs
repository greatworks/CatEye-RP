import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..'), executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-gradients-'));
const source = path.join(root, 'artifacts/gradient-demo.rea.json'), sourceBytes = await fs.readFile(source), authored = JSON.parse(sourceBytes);
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
  const canvas = page.locator('.editor-widget.box').filter({ hasText: 'Linear fill' }); await canvas.click();
  const inspector = page.locator('.inspector'); await inspector.getByRole('tab', { name: 'Style', exact: true }).click();
  await expect(inspector.getByLabel('Fill type', { exact: true })).toHaveValue('linear');
  await inspector.getByRole('button', { name: 'Edit Fill gradient', exact: true }).click();
  const offset = inspector.getByLabel('Fill Stop 2 offset', { exact: true }); await offset.fill('0.6');
  await inspector.getByRole('button', { name: 'Apply Fill gradient', exact: true }).click();
  const edited = await save('edited.rea.json'); expect(edited.pages[0].widgets.find(w => w.id === 'gradient-linear').style.fillGradient.stops[1].offset).toBe(0.6);
  const expected = structuredClone(authored); expected.pages[0].widgets.find(w => w.id === 'gradient-linear').style.fillGradient.stops[1].offset = 0.6; expect(edited).toEqual(expected);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save('undo.rea.json')).toEqual(authored);
  await capture('artifacts/gradient-editor.png', mainId);
  const exercise = async scope => {
    const widget = id => scope.locator(`[data-widget-id="${id}"]`), card = widget('gradient-linear');
    await expect(card).toHaveCSS('background-image', /data:image\/svg\+xml/);
    await expect(widget('gradient-radial')).toHaveCSS('background-image', /radialGradient/);
    await expect(widget('gradient-transparent')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(widget('gradient-child')).toHaveCSS('background-image', 'none');
    await expect(widget('gradient-vector').locator('linearGradient')).toHaveCount(1);
    await expect(widget('gradient-vector').locator('[data-shadow-fill]')).toHaveAttribute('fill', /^url\(#/);
    await expect(widget('gradient-row')).toHaveCount(2);
    const before = await card.evaluate(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }));
    const rowIds = await widget('gradient-row').locator('linearGradient').evaluateAll(elements => elements.map(element => element.id)); expect(rowIds.length).toBe(2); expect(new Set(rowIds).size).toBe(2);
    await click(widget('gradient-solid'));
    await expect(card).toHaveCSS('background-image', 'none'); await expect(card).toHaveCSS('background-color', 'rgb(217, 226, 242)');
    await expect(widget('gradient-radial')).toHaveCSS('background-image', 'none');
    await expect(widget('gradient-vector').locator('[data-shadow-fill]')).toHaveAttribute('fill', '#d9e2f2');
    for (const row of await widget('gradient-row').all()) await expect(row.locator('[data-shadow-fill]')).toHaveAttribute('fill', '#d9e2f2');
    await click(widget('gradient-restore')); await expect(card).toHaveCSS('background-image', /data:image\/svg\+xml/);
    await expect(widget('gradient-vector').locator('[data-shadow-fill]')).toHaveAttribute('fill', /^url\(#/);
    expect(await card.evaluate(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }))).toEqual(before);
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay'); await exercise(preview);
  await capture('artifacts/gradient-preview.png', mainId);
  await preview.locator('[data-page-id="gradient-frame-page"]').click(); const nested = preview.frameLocator('iframe[data-inline-frame="gradient-frame"]'); await exercise(nested);
  audit.fixedFramePlayer = true; await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  expect(await save('after-preview.rea.json')).toEqual(authored);
  const exported = path.join(root, 'artifacts/gradient-demo.html'); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, exported);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  await app.context().setOffline(true);
  const pending = app.waitForEvent('window'), offlineId = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ show: false, width: 1600, height: 1100, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } }); w.setContentSize(1600, 1100); void w.loadURL('about:blank'); return w.id; });
  const offline = await pending;
  try {
    await app.evaluate(({ BrowserWindow }, data) => BrowserWindow.fromId(data.id).loadURL(data.url), { id: offlineId, url: pathToFileURL(exported).href }); await exercise(offline.locator('body'));
    await capture('artifacts/gradient-offline.png', offlineId, offline);
    await offline.locator('nav').getByRole('button', { name: 'Embedded comparison', exact: true }).click(); await exercise(offline.frameLocator('iframe[data-inline-frame="gradient-frame"]'));
    audit.offlineNestedPlayer = true;
  } finally { await offline.close(); await app.context().setOffline(false); }
  expect(await save('after-offline.rea.json')).toEqual(authored);
  const nativeFile = path.join(root, 'research/samples/Prototype Starter.rp'), nativeHash = sha(await fs.readFile(nativeFile));
  expect(nativeHash).toBe('6a961a496fb35d3c51be967c6bc0342aaef334ac4e4b58a31774f131dd3dc714');
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, nativeFile);
  await menu('Import Axure .rp (experimental)…'); const report = page.getByRole('dialog', { name: 'RP import report', exact: true });
  await expect(report).toContainText('8 page(s), 58 recovered widget(s), 30 skipped item(s).'); await report.getByRole('button', { name: 'Close report', exact: true }).click();
  const native = await save('native-gradient.rea.json'), nativePage = 'rp-p-dbf50f111c33407cab8d0fdc6bcae297';
  const importedPage = native.pages.find(p => p.id === nativePage);
  const expectedGradients = JSON.parse(await fs.readFile(path.join(root, 'research/gradient-format-import-audit.json'), 'utf8')).samples.find(sample => sample.sha256 === nativeHash).gradients;
  expect(expectedGradients.length).toBe(8);
  for (const expected of expectedGradients) expect(importedPage.widgets.find(w => w.id === expected.id).style.fillGradient).toEqual(expected.gradient);
  await open(path.join(userData, 'native-gradient.rea.json')); expect(await save('native-reopened.rea.json')).toEqual(native);
  await page.getByTitle('Preview (F5)', { exact: true }).click(); await preview.locator(`[data-page-id="${nativePage}"]`).click();
  for (const expected of expectedGradients) {
    const rendered = preview.locator(`[data-widget-id="${expected.id}"]`);
    await expect(rendered.locator(expected.gradient.type === 'linear' ? 'linearGradient' : 'radialGradient')).toHaveCount(1);
    await expect(rendered.locator('[data-shadow-fill]')).toHaveAttribute('fill', /^url\(#/);
  }
  await capture('artifacts/gradient-native-preview.png', mainId); await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  audit.native = { file: nativeFile, sha256: nativeHash, gradientWidgets: expectedGradients.length, linear: expectedGradients.filter(w => w.gradient.type === 'linear').length, radial: expectedGradients.filter(w => w.gradient.type === 'radial').length, workerImport: true, saveReopen: true, actualSvgPaint: true };
  expect(sha(await fs.readFile(nativeFile))).toBe(nativeHash); await open(source);
  expect(await save('final.rea.json')).toEqual(authored); expect(sha(await fs.readFile(source))).toBe(audit.sourceSha256); expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(w => !w.isVisible()))).toBe(true);
  if (executablePath) expect(sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit, { ok: true, sourceUnchanged: true, designUnchanged: true, hiddenWindows: true });
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally { try { if (app) await app.close(); } finally { audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, '.build/gradient-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); } }
