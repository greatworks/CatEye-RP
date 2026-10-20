import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { assertNativeTextMetadataOnly } from './native-text-baseline.mjs';

const root = path.resolve(import.meta.dirname, '..'), exe = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = path.join(root, 'artifacts/text-autofit-demo.rea.json'), sourceBytes = await fs.readFile(source), doc = JSON.parse(sourceBytes);
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-text-autofit-'));
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath: exe, userData, sourceSha256: sha(sourceBytes), errors: [], network: [], screenshots: [], layouts: [], headings: [], originalAxureGuiCompared: false, runtimeOwnerAutoFitImplemented: false };
let app;
try {
  if (exe) audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(exe), 'resources/app.asar')));
  app = await electron.launch({ ...(exe ? { executablePath: exe } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const observe = target => target.on('pageerror', error => audit.errors.push(error.message)); app.on('window', observe);
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(2000, 1250); w.webContents.setBackgroundThrottling(false); return w.id; });
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const save = async name => {
    const file = path.join(userData, name); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file);
    await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${name}`); return JSON.parse(await fs.readFile(file, 'utf8'));
  };
  const capture = async (file, id = mainId, target = page) => {
    await target.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).webContents.invalidate(), id);
    const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), id), 'base64');
    await fs.writeFile(path.join(root, file), bytes); audit.screenshots.push({ file, sha256: sha(bytes) });
  };
  const verify = async (scope, stage) => {
    for (let column = 0; column < 4; column++) for (let row = 0; row < 3; row++) {
      const value = await scope.locator(`[data-widget-id="native-layout-${column}-${row}"]`).evaluate(async element => {
        await document.fonts.ready; const layer = element.querySelector(':scope > .widget-text'), range = document.createRange(); range.selectNodeContents(layer);
        const owner = element.getBoundingClientRect(), rect = layer.getBoundingClientRect();
        return { width: owner.width, height: owner.height, textHeight: rect.height, top: rect.top - owner.top, lines: new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top * 100) / 100)).size, whiteSpace: getComputedStyle(layer).whiteSpace };
      });
      expect(value.width).toBe(180); expect(value.height).toBe(90); expect(value.whiteSpace).toBe(column < 2 ? 'normal' : 'nowrap');
      if (column < 2) expect(value.lines).toBeGreaterThan(1); else expect(value.lines).toBe(1);
      expect(value.textHeight).toBeCloseTo(36 * value.lines + 24, 0); expect(value.top).toBeCloseTo(row === 0 ? 0 : row === 1 ? (90 - value.textHeight) / 2 : 90 - value.textHeight, 0);
      audit.layouts.push({ stage, column, row, ...value });
    }
    await expect(scope.locator('[data-widget-id="native-layout-breaks"] [data-rich-run] br')).toHaveCount(4);
    await expect(scope.locator('[data-widget-id="native-layout-natural"] .widget-text')).toHaveCSS('line-height', 'normal');
  };
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, source); await menu('Open… Ctrl+O');
  await expect(page.locator('.statusbar')).toContainText('Document opened'); expect(await save('initial.rea.json')).toEqual(doc); await expect(page.locator('.canvas-surface > .editor-widget').nth(doc.pages[0].widgets.findIndex(w => w.id === 'native-layout-natural')).locator('.widget-text')).toHaveCSS('line-height', 'normal'); await capture('artifacts/text-autofit-editor.png');
  await page.getByTitle('Preview (F5)', { exact: true }).click(); await verify(page.locator('.preview-overlay'), 'preview'); await capture('artifacts/text-autofit-preview.png');
  await page.locator('.preview-overlay [data-page-id="native-layout-framed"]').click();
  const frame = page.frameLocator('iframe[data-inline-frame="native-layout-frame"]'); await expect(frame.locator('[data-widget-id="native-layout-0-0"]')).toBeVisible(); await verify(frame, 'preview-iframe');
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save('after-preview.rea.json')).toEqual(doc);
  const exported = path.join(root, 'artifacts/text-autofit-demo.html'); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, exported);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  await app.context().setOffline(true); const pending = app.waitForEvent('window');
  const offlineId = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ show: false, width: 2000, height: 1250, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } }); w.setContentSize(2000, 1250); void w.loadURL('about:blank'); return w.id; });
  const offline = await pending; observe(offline);
  try {
    await app.evaluate(({ BrowserWindow }, data) => BrowserWindow.fromId(data.id).loadURL(data.url), { id: offlineId, url: pathToFileURL(exported).href });
    await verify(offline, 'offline'); await capture('artifacts/text-autofit-offline.png', offlineId, offline);
    await offline.locator('nav').getByRole('button', { name: 'Embedded layout', exact: true }).click();
    const frame = offline.frameLocator('iframe[data-inline-frame="native-layout-frame"]'); await expect(frame.locator('[data-widget-id="native-layout-0-0"]')).toBeVisible(); await verify(frame, 'offline-iframe');
  } finally { await offline.close(); await app.context().setOffline(false); }
  expect(await save('after-export.rea.json')).toEqual(doc);
  const nativeFile = path.join(root, 'research/samples/UX Prototyping.rp'), nativeHash = sha(await fs.readFile(nativeFile));
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, nativeFile); await menu('Import Axure .rp (experimental)…');
  const report = page.getByRole('dialog', { name: 'RP import report', exact: true }); await expect(report).toContainText('129 recovered widget(s)'); await report.getByRole('button', { name: 'Close report', exact: true }).click();
  const native = await save('native.rea.json'); audit.nativeMetadataCount = await assertNativeTextMetadataOnly(native, JSON.parse(await fs.readFile(path.join(root, 'research/font-size-imported-before.rea.json'), 'utf8')), nativeHash);
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  for (const owner of native.pages.filter(p => ['Problems and ideas', 'Sample problems and ideas'].includes(p.name))) {
    await page.locator(`.preview-overlay [data-page-id="${owner.id}"]`).click();
    for (const w of owner.widgets.filter(w => ['Problems', 'Ideas'].includes(w.text))) {
      const value = await page.locator(`[data-widget-id="${w.id}"]`).evaluate(async element => {
        await document.fonts.ready; const run = element.querySelector('[data-rich-run]'), layer = element.querySelector('.widget-text'), range = document.createRange(); range.selectNodeContents(run);
        const rect = element.getBoundingClientRect(); return { width: rect.width, height: rect.height, textHeight: layer.getBoundingClientRect().height, fontSize: getComputedStyle(run).fontSize, overflow: getComputedStyle(layer).overflow, lines: new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top * 100) / 100)).size };
      });
      expect(value.width).toBe(w.text === 'Problems' ? 95 : 54); expect(value.height).toBe(27); expect(value.fontSize).toBe('28px'); expect(value.textHeight).toBeGreaterThan(27); expect(value.lines).toBe(1); expect(value.overflow).toBe('visible'); audit.headings.push({ id: w.id, text: w.text, page: owner.name, ...value });
    }
    await capture(`artifacts/text-autofit-native-${owner.name.startsWith('Sample') ? 'sample' : 'ux'}.png`);
  }
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save('native-after.rea.json')).toEqual(native); expect(sha(await fs.readFile(nativeFile))).toBe(nativeHash);
  expect(audit.headings).toHaveLength(4); expect(audit.layouts).toHaveLength(48); expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(w => !w.isVisible()))).toBe(true);
  if (exe) expect(sha(await fs.readFile(path.join(path.dirname(exe), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  expect(sha(await fs.readFile(source))).toBe(audit.sourceSha256); Object.assign(audit, { ok: true, sourceUnchanged: true, designUnchanged: true, nativePriorFieldsUnchanged: true, hiddenWindows: true });
} catch (error) { audit.failure = error.stack ?? error.message; process.exitCode = 1; }
finally { if (app) await app.close(); audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, '.build/text-autofit-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); }
