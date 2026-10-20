import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root = path.resolve(import.meta.dirname, '..'), executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), source = path.join(root, 'artifacts/menu-demo.rea.json'), sourceBytes = await fs.readFile(source), authored = JSON.parse(sourceBytes), userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-menus-'));
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, source, sourceSha256: sha(sourceBytes), errors: [], unexpectedNetwork: [], screenshots: [], pickerResponsesMocked: true, originalAxureGuiCompared: false }; let app;
try {
  if (executablePath) audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({ ...executablePath ? { executablePath } : { args: [root] }, env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  app.on('window', page => page.on('pageerror', error => audit.errors.push(error.message)));
  await app.context().route(/^https?:\/\//, route => { audit.unexpectedNetwork.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', error => audit.errors.push(error.message)); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.setContentSize(1550, 1050); window.webContents.setBackgroundThrottling(false); return window.id; });
  const fileMenu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const open = async file => { await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file); await fileMenu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened'); };
  const save = async file => { await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file); await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`); return JSON.parse(await fs.readFile(file, 'utf8')); };
  const capture = async (file, id, target) => { await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), id), 'base64'); expect(bytes.length).toBeGreaterThan(1000); await fs.writeFile(path.join(root, file), bytes); audit.screenshots.push({ file, sha256: sha(bytes) }); };
  await open(source); expect(await save(path.join(userData, 'before.rea.json'))).toEqual(authored);
  const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await page.locator('[data-menu-item-id="menu-main-item-0"]').click(); await inspector.getByRole('button', { name: 'Add menu item after', exact: true }).click();
  const edited = await save(path.join(userData, 'edited.rea.json')), changed = edited.pages[0].widgets.find(widget => widget.id === 'menu-main');
  expect(changed.menu.table.table.cells).toHaveLength(4); expect(new Set(changed.menu.table.table.cells.map(cell => cell.id)).size).toBe(4); expect(changed.menu.submenus[0].menu.parentCellId).toBe('menu-main-item-0');
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(path.join(userData, 'undo.rea.json'))).toEqual(authored);
  await open(path.join(userData, 'edited.rea.json')); expect(await save(path.join(userData, 'reopened.rea.json'))).toEqual(edited); await open(source);
  await page.locator('[data-menu-item-id="menu-main-item-0"]').click(); await inspector.getByRole('button', { name: 'Edit submenu', exact: true }).click(); await expect(page.locator('[data-menu-item-id="menu-file-item-0"]')).toBeVisible();
  await capture('artifacts/menu-editor.png', mainId, page);
  audit.authoring = { independentItemSelection: true, insertionAndIds: true, parentLinks: true, submenuEditing: true, oneStepUndo: true, saveReopen: true }; await open(source);
  const inspect = async (target, scope) => {
    const widget = id => scope.locator(`[data-widget-id="${id}"]`), status = widget('menu-status');
    await expect(widget('menu-file')).toHaveCount(0); await expect(widget('menu-recent')).toHaveCount(0);
    await widget('menu-main-item-0').hover(); await expect(widget('menu-file')).toBeVisible();
    await widget('menu-file-item-2').hover(); await expect(widget('menu-recent')).toBeVisible();
    await widget('menu-recent-item-1').click(); await expect(status).toHaveText('Opened Beta project'); await expect(widget('menu-recent')).toBeVisible(); await expect(widget('menu-recent-item-1')).toHaveCSS('background-color', 'rgb(209, 250, 229)');
    await widget('menu-side-item-1').hover(); await expect(widget('menu-reports')).toBeVisible(); await expect(widget('menu-file')).toHaveCount(0); await expect(widget('menu-recent')).toHaveCount(0);
    await widget('menu-reports-item-1').click(); await expect(status).toHaveText('Weekly report chosen'); await status.hover(); await expect(widget('menu-reports')).toHaveCount(0);
    await widget('menu-main-item-2').click(); await expect(status).toHaveText('Root menu handled this click');
    await widget('menu-noops').click(); await expect(widget('menu-main')).toHaveCSS('width', '472px'); await expect(widget('menu-main')).toHaveCSS('height', '54px'); await widget('menu-main-item-2').click(); await expect(status).toHaveText('Root menu handled this click');
    await widget('menu-toggle').click(); await expect(widget('menu-main')).toHaveCount(0); await widget('menu-toggle').click(); await expect(widget('menu-main')).toBeVisible();
    await widget('menu-read').click(); await expect(status).toContainText('Alpha project\nBeta project\nGamma project'); await expect(widget('menu-recent')).toHaveCount(0);
    const rows = widget('menu-row-item-0'), results = widget('menu-row-result'); await expect(rows).toHaveCount(2); await rows.nth(1).hover(); await expect(widget('menu-row-sub')).toHaveCount(1); await expect(widget('menu-row-sub-item-0')).toHaveText('Open Beta'); await widget('menu-row-sub-item-0').click(); await expect(results.nth(1)).toHaveText('Opened Beta'); await expect(results.nth(0)).toHaveText('No row action yet');
    await widget('menu-main-item-2').click(); await widget('menu-main-item-0').hover(); await widget('menu-file-item-2').hover(); await expect(widget('menu-recent')).toBeVisible();
    return { initialSubmenusHidden: true, nestedHover: true, itemActionsAndSelection: true, leafClickRetainsMenu: true, pointerExitClosesDescendants: true, verticalMenu: true, clickFallback: true, actionBoundaries: true, rootVisibility: true, hiddenDescendantText: true, repeaterInstances: true };
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay'); audit.preview = await inspect(page, preview); await capture('artifacts/menu-preview.png', mainId, page); await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  const html = path.join(root, 'artifacts/menu-demo.html'); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, html); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  await app.context().setOffline(true); const pending = app.waitForEvent('window'), offlineId = await app.evaluate(({ BrowserWindow }) => { const window = new BrowserWindow({ show: false, width: 1550, height: 1050, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); void window.loadURL('about:blank'); return window.id; }), offline = await pending;
  try { await app.evaluate(({ BrowserWindow }, data) => BrowserWindow.fromId(data.id).loadURL(data.url), { id: offlineId, url: pathToFileURL(html).href }); audit.offline = await inspect(offline, offline.locator('main')); await capture('artifacts/menu-offline.png', offlineId, offline); } finally { await offline.close(); await app.context().setOffline(false); }
  expect(await save(path.join(userData, 'after.rea.json'))).toEqual(authored); expect(sha(await fs.readFile(source))).toBe(audit.sourceSha256); expect(audit.errors).toEqual([]); expect(audit.unexpectedNetwork).toEqual([]); expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible()))).toBe(true);
  if (executablePath) expect(sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit, { ok: true, sourceUnchanged: true, designUnchanged: true, hiddenWindows: true });
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally { try { if (app) await app.close(); } finally { audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, '.build/menu-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); } }
