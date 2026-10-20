import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..'), executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-rich-text-'));
const source = path.join(root, 'artifacts/rich-text-demo.rea.json'), sourceSha256 = sha(await fs.readFile(source));
const authored = JSON.parse(await fs.readFile(source, 'utf8'));
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, source, sourceSha256, errors: [], network: [], screenshots: [], pickerResponsesMocked: true, originalAxureGuiCompared: false };
let app;
try {
  if (executablePath) audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observe = page => page.on('pageerror', e => audit.errors.push(e.message)); app.on('window', observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1550, 1050); w.webContents.setBackgroundThrottling(false); return w.id; });
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const open = async file => { await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file); await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened'); };
  const save = async file => { await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file); await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`); return JSON.parse(await fs.readFile(file, 'utf8')); };
  const capture = async (file, id, target) => { await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), id), 'base64'); expect(bytes.length).toBeGreaterThan(1000); await fs.writeFile(path.join(root, file), bytes); audit.screenshots.push({ file, sha256: sha(bytes) }); };
  const inspect = async (targetPage, scope) => {
    const target = scope.locator('[data-widget-id="rich-target"]'), paragraphs = target.locator('[data-rich-paragraph]'), first = paragraphs.nth(0).locator('[data-rich-run]');
    await expect(first).toHaveCount(3); await expect(first.nth(0)).toHaveCSS('font-size', '26px'); await expect(first.nth(1)).toHaveCSS('font-style', 'italic'); await expect(first.nth(2)).toHaveCSS('font-weight', '700');
    await expect(paragraphs.nth(3)).toHaveText('Literal: [[...]] and <b>text</b>'); await expect(target.locator('b')).toHaveCount(0);
    const emptyParagraphHeight = await paragraphs.nth(1).evaluate(el => el.getBoundingClientRect().height); expect(emptyParagraphHeight).toBe(28);
    await expect(scope.locator('[data-widget-id="rich-row"]').nth(0)).toHaveText('Item Alpha'); await expect(scope.locator('[data-widget-id="rich-row"]').nth(1)).toHaveText('Item Beta');
    await target.hover(); await expect(first.nth(1)).toHaveCSS('font-style', 'normal'); await scope.locator('[data-widget-id="rich-heading"]').hover(); await expect(first.nth(1)).toHaveCSS('font-style', 'italic');
    // Only runs name Roboto in the target; the outer widget deliberately names Arial.
    await targetPage.evaluate(async () => { await document.fonts.load('italic 400 26px Roboto'); await document.fonts.ready; });
    const cdp = await targetPage.context().newCDPSession(targetPage); let fonts;
    try { await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); const { root } = await cdp.send('DOM.getDocument'); const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-widget-id="rich-target"] [data-rich-paragraph="0"] [data-rich-run="1"]' }); ({ fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })); expect(fonts.length).toBeGreaterThan(0); expect(fonts.every(font => font.isCustomFont && font.postScriptName === 'Roboto-Italic')).toBe(true); } finally { await cdp.detach(); }
    return { emptyParagraphHeight, fonts, literalMarkup: true, mixedRuns: true, rowExpressions: true, hoverRestored: true };
  };
  await open(source); const saved = path.join(userData, 'round-trip.rea.json'); expect(await save(saved)).toEqual(authored); await open(saved);
  await page.getByTitle('Preview (F5)', { exact: true }).click(); audit.preview = await inspect(page, page.locator('.preview-page')); await capture('artifacts/rich-text-desktop.png', mainId, page);
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save(path.join(userData, 'after-preview.rea.json'))).toEqual(authored);
  const html = path.join(root, 'artifacts/rich-text-demo.html'); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, html); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  const exported = await fs.readFile(html, 'utf8'); expect((exported.match(/data:font\/ttf;base64,/g) ?? []).length).toBe(12);
  await app.context().setOffline(true); const pending = app.waitForEvent('window'), offlineId = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ show: false, width: 1550, height: 1050, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); void w.loadURL('about:blank'); return w.id; }), offline = await pending;
  try { await app.evaluate(({ BrowserWindow }, data) => BrowserWindow.fromId(data.id).loadURL(data.url), { id: offlineId, url: pathToFileURL(html).href }); audit.offline = await inspect(offline, offline.locator('main')); await capture('artifacts/rich-text-offline.png', offlineId, offline); } finally { await offline.close(); await app.context().setOffline(false); }
  expect(await save(path.join(userData, 'after-export.rea.json'))).toEqual(authored); expect(sha(await fs.readFile(source))).toBe(sourceSha256); expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(w => !w.isVisible()))).toBe(true);
  if (executablePath) expect(sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit, { ok: true, sourceUnchanged: true, designUnchanged: true, savedAndReopened: true, hiddenWindows: true });
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally { try { if (app) await app.close(); } finally { audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, '.build/rich-text-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); } }
