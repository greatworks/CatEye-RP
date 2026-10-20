import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..'), executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = path.join(root, 'artifacts/hyperlink-demo.rea.json'), sourceSha256 = sha(await fs.readFile(source));
const authored = JSON.parse(await fs.readFile(source, 'utf8')), userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-hyperlinks-'));
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, source, sourceSha256, errors: [], unexpectedNetwork: [], interceptedNavigation: [], screenshots: [], pickerResponsesMocked: true, originalAxureGuiCompared: false };
let app;
try {
  if (executablePath) audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  app.on('window', page => page.on('pageerror', error => audit.errors.push(error.message)));
  await app.context().route(/^https?:\/\//, route => {
    const url = route.request().url(); if (url.startsWith('https://example.test/')) { audit.interceptedNavigation.push(url); return route.fulfill({ contentType: 'text/html', body: '<title>Local intercepted destination</title><p>Only a local test response.</p>' }); }
    audit.unexpectedNetwork.push(url); return route.abort();
  });
  const page = await app.firstWindow(); page.on('pageerror', error => audit.errors.push(error.message)); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1550, 1050); w.webContents.setBackgroundThrottling(false); return w.id; });
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const open = async file => { await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file); await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened'); };
  const save = async file => { await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file); await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`); return JSON.parse(await fs.readFile(file, 'utf8')); };
  const capture = async (file, id, target) => { await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), id), 'base64'); expect(bytes.length).toBeGreaterThan(1000); await fs.writeFile(path.join(root, file), bytes); audit.screenshots.push({ file, sha256: sha(bytes) }); };
  await open(source); expect(await save(path.join(userData, 'before.rea.json'))).toEqual(authored);
  await page.locator('.editor-widget').filter({ hasText: /^Read Rich link or click the surrounding text\.$/ }).dblclick();
  const editable = page.getByRole('textbox', { name: 'Formatted text content', exact: true }), toolbar = page.getByRole('region', { name: 'Text editing tools', exact: true });
  await editable.press('Control+Home'); for (let i = 0; i < 6; i++) await editable.press('ArrowRight');
  await toolbar.getByRole('button', { name: 'Edit hyperlink', exact: true }).click(); await expect(page.getByRole('group', { name: 'Hyperlink settings', exact: true })).toBeVisible();
  await page.getByLabel('Link name', { exact: true }).fill('Edited rich link'); await page.getByRole('button', { name: 'Apply link', exact: true }).click();
  await capture('artifacts/hyperlink-editor.png', mainId, page); await toolbar.getByRole('button', { name: 'Done editing text', exact: true }).click();
  const editedFile = path.join(userData, 'edited.rea.json'), edited = await save(editedFile); expect(edited.pages[0].widgets.find(w => w.id === 'link-mixed').richText.links[0].name).toBe('Edited rich link');
  await open(editedFile); expect(await save(path.join(userData, 'reopened.rea.json'))).toEqual(edited);
  await open(source); audit.authoring = { actualCaret: true, editLink: true, saveReopen: true, sourceUnchanged: true };
  const inspect = async (target, scope) => {
    const mixed = scope.locator('[data-widget-id="link-mixed"]'), link = mixed.getByRole('link'), leaves = link.locator('[data-rich-run]'), status = scope.locator('[data-widget-id="link-status"]');
    await expect(link).toHaveCount(1); await expect(leaves).toHaveCount(2); await link.hover(); await expect(leaves.nth(0)).toHaveCSS('text-decoration-line', 'line-through'); await target.mouse.down(); await expect(leaves.nth(0)).toHaveCSS('font-weight', '700'); await target.mouse.up(); await expect(status).toHaveText('Link finished');
    await mixed.getByText('Read ', { exact: true }).click(); await expect(status).toHaveText('Parent clicked'); await scope.locator('[data-widget-id="link-fallback"]').getByRole('link').click(); await expect(status).toHaveText('Fallback reached parent');
    const menuLink = scope.locator('[data-widget-id="link-menu"]').getByRole('link'); await menuLink.click(); await target.getByRole('menuitem', { name: 'Second link case', exact: true }).click(); await expect(status).toHaveText('Second chosen'); await expect(menuLink).toBeFocused();
    await scope.locator('.widget[aria-label="Replace linked text"]').click(); const solo = scope.locator('[data-widget-id="link-solo"]').getByRole('link'); await expect(solo).toHaveText('Link survives Set Text'); await solo.click(); await expect(status).toHaveText('Retained link clicked');
    const rows = scope.locator('[data-widget-id="link-row"]').getByRole('link'); await expect(rows).toHaveCount(2); await expect(rows.nth(1)).toHaveText('Beta'); await rows.nth(1).click(); await expect(status).toHaveText('Row Beta clicked');
    return { groupedRuns: true, pointerStyles: true, linkAndParentDispatch: true, waitAndMenu: true, restoredLinkFocus: true, setTextPreservesLink: true, rowExpressionAndIdentity: true };
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay'); audit.preview = await inspect(page, preview);
  await capture('artifacts/hyperlink-preview.png', mainId, page);
  const firstWindow = app.waitForEvent('window'); await preview.locator('[data-widget-id="link-current"]').getByRole('link').click(); const current = await firstWindow; await expect(current).toHaveURL('https://example.test/current');
  await preview.locator('[data-widget-id="link-current"]').getByRole('link').click(); await expect(current).toHaveURL('https://example.test/current'); await expect.poll(async () => app.windows().length).toBe(2);
  const nextWindow = app.waitForEvent('window'); await preview.locator('[data-widget-id="link-new"]').getByRole('link').click(); const fresh = await nextWindow; await expect(fresh).toHaveURL('https://example.test/new'); expect(app.windows()).toHaveLength(3);
  for (const target of [current, fresh]) expect(await target.evaluate(() => ({ desktop: typeof window.desktop, require: typeof window.require, opener: window.opener }))).toEqual({ desktop: 'undefined', require: 'undefined', opener: null });
  expect(await app.evaluate(({ BrowserWindow }, mainId) => BrowserWindow.getAllWindows().filter(w => w.id !== mainId).every(w => { const prefs = w.webContents.getLastWebPreferences(); return prefs.sandbox && prefs.contextIsolation && !prefs.nodeIntegration && !prefs.preload; }), mainId)).toBe(true);
  const rejected = await page.evaluate(async () => { const result = []; for (const value of ['javascript:alert(1)', 'file:///C:/Windows/win.ini', 'https://user:secret@example.test/', 'https://example.test/[[v]]']) { try { await window.desktop.openUrl(value, 'new', 'invalid-test'); result.push(false); } catch { result.push(true); } } return result; }); expect(rejected).toEqual([true, true, true, true]); expect(app.windows()).toHaveLength(3);
  await current.close(); await fresh.close(); audit.navigation = { currentReused: true, newWindow: true, subsequentAction: true, noNodeOrPreload: true, invalidUrlsRejected: 4, destinationsIntercepted: true };
  await expect(preview.locator('[data-widget-id="link-status"]')).toHaveText('New destination requested'); await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  const html = path.join(root, 'artifacts/hyperlink-demo.html'); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, html); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  await app.context().setOffline(true); const pending = app.waitForEvent('window'), offlineId = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ show: false, width: 1550, height: 1050, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); void w.loadURL('about:blank'); return w.id; }), offline = await pending;
  try { await app.evaluate(({ BrowserWindow }, data) => BrowserWindow.fromId(data.id).loadURL(data.url), { id: offlineId, url: pathToFileURL(html).href }); audit.offline = await inspect(offline, offline.locator('main')); await capture('artifacts/hyperlink-offline.png', offlineId, offline); } finally { await offline.close(); await app.context().setOffline(false); }
  expect(await save(path.join(userData, 'after-playback.rea.json'))).toEqual(authored); expect(sha(await fs.readFile(source))).toBe(sourceSha256); expect(audit.errors).toEqual([]); expect(audit.unexpectedNetwork).toEqual([]);
  expect(audit.interceptedNavigation.filter(url => url === 'https://example.test/current').length).toBeGreaterThanOrEqual(2); expect(audit.interceptedNavigation).toContain('https://example.test/new');
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(w => !w.isVisible()))).toBe(true);
  if (executablePath) expect(sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit, { ok: true, sourceUnchanged: true, designUnchanged: true, hiddenWindows: true });
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally { try { if (app) await app.close(); } finally { audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, '.build/hyperlink-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); } }
