import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..'), executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = path.join(root, 'artifacts/inline-text-demo.rea.json'), sourceSha256 = sha(await fs.readFile(source));
const authored = JSON.parse(await fs.readFile(source, 'utf8')), userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-inline-text-'));
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, source, sourceSha256, errors: [], network: [], screenshots: [], pickerResponsesMocked: true, originalAxureGuiCompared: false };
let app;
try {
  if (executablePath) audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  app.on('window', page => page.on('pageerror', error => audit.errors.push(error.message)));
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); page.on('pageerror', error => audit.errors.push(error.message)); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1550, 1050); w.webContents.setBackgroundThrottling(false); return w.id; });
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const open = async file => { await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file); await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened'); };
  const save = async file => { await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file); await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`); return JSON.parse(await fs.readFile(file, 'utf8')); };
  const capture = async (file, id, target) => { await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), id), 'base64'); expect(bytes.length).toBeGreaterThan(1000); await fs.writeFile(path.join(root, file), bytes); audit.screenshots.push({ file, sha256: sha(bytes) }); };
  await open(source); expect(await save(path.join(userData, 'before.rea.json'))).toEqual(authored);
  const target = page.locator('.editor-widget.box'); await target.dblclick();
  const editable = page.getByRole('textbox', { name: 'Formatted text content', exact: true }), toolbar = page.getByRole('region', { name: 'Text editing tools', exact: true });
  await expect(editable).toHaveAttribute('contenteditable', 'true'); await expect(page.getByRole('dialog', { name: 'Edit formatted text' })).toHaveCount(0);
  const box = await target.boundingBox(), textBox = await editable.boundingBox(); expect(textBox.x).toBeGreaterThanOrEqual(box.x); expect(textBox.x).toBeLessThan(box.x + box.width); expect(textBox.y).toBeGreaterThanOrEqual(box.y); expect(textBox.y).toBeLessThan(box.y + box.height);
  await editable.focus(); await editable.press('Control+Home'); for (let i = 0; i < 4; i++) await editable.press('Shift+ArrowRight');
  await toolbar.getByRole('button', { name: 'Underline selection', exact: true }).click(); await toolbar.getByRole('button', { name: 'Strikethrough selection', exact: true }).click();
  await expect(editable.locator('[data-rich-run]').filter({ hasText: /^None$/ })).toHaveCSS('text-decoration-line', 'underline line-through');
  await editable.press('Control+End'); await toolbar.getByRole('button', { name: 'Strikethrough selection', exact: true }).click(); await editable.press('!');
  await expect(editable).toHaveText(authored.pages[0].widgets.find(w => w.id === 'deco-rich').text + '!');
  await editable.press('Control+z'); await expect(editable).toHaveText(authored.pages[0].widgets.find(w => w.id === 'deco-rich').text);
  await editable.press('Control+y'); await expect(editable.locator('[data-rich-run]').filter({ hasText: /^!$/ })).toHaveCSS('text-decoration-line', 'underline');
  await capture('artifacts/inline-text-editor.png', mainId, page);
  await toolbar.getByRole('button', { name: 'Done editing text', exact: true }).click();
  const editedPath = path.join(userData, 'edited.rea.json'), edited = await save(editedPath), editedWidget = edited.pages[0].widgets.find(w => w.id === 'deco-rich');
  expect(editedWidget.richText.paragraphs[0].runs.find(r => r.text === 'None').style).toMatchObject({ underline: true, strikethrough: true });
  expect(editedWidget.richText.paragraphs[0].runs.at(-1)).toMatchObject({ text: '!', style: { underline: true, strikethrough: false } });
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(path.join(userData, 'undo.rea.json'))).toEqual(authored);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(path.join(userData, 'redo.rea.json'))).toEqual(edited);
  await open(editedPath); expect(await save(path.join(userData, 'reopened.rea.json'))).toEqual(edited);
  await target.dblclick(); await editable.press('Control+End'); await editable.press('x'); await editable.press('Escape'); expect(await save(path.join(userData, 'cancel.rea.json'))).toEqual(edited);
  audit.authoring = { canvasInline: true, actualKeyboardSelection: true, independentDecorations: true, caretTypingMarks: true, localUndoRedo: true, oneDocumentUndo: true, saveReopen: true, cancelRestores: true };
  await open(source);
  const inspect = async scope => {
    const rich = scope.locator('[data-widget-id="deco-rich"]'), runs = rich.locator('[data-rich-run]'), baseline = ['none', 'underline', 'line-through', 'underline line-through'];
    const verify = async expected => { for (let i = 0; i < expected.length; i++) await expect(runs.nth(i)).toHaveCSS('text-decoration-line', expected[i]); };
    await verify(baseline); await rich.hover(); await verify(Array(4).fill('line-through')); await scope.locator('[data-widget-id="deco-heading"]').hover(); await verify(baseline);
    await scope.locator('.widget[aria-label="Select mixture"]').click(); await verify(Array(4).fill('none')); await rich.hover(); await verify(baseline);
    await scope.locator('.widget[aria-label="Clear selection"]').click(); await verify(baseline);
    await expect(scope.getByRole('textbox', { name: 'Decorated input' })).toHaveCSS('text-decoration-line', 'underline line-through'); await expect(scope.locator('[data-widget-id="deco-child"] .widget-text')).toHaveCSS('text-decoration-line', 'none');
    return { mixedDecorations: true, partialStateReplacesBoth: true, invalidCombinationRestoresOriginal: true, containerIsolation: true, formDecoration: true };
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay'); audit.preview = await inspect(preview);
  await preview.getByTitle('Mobile', { exact: true }).click(); await expect(preview.locator('[data-widget-id="deco-adaptive"] [data-rich-run]')).toHaveCSS('text-decoration-line', 'underline');
  await preview.getByTitle('Desktop', { exact: true }).click(); await expect(preview.locator('[data-widget-id="deco-adaptive"] [data-rich-run]')).toHaveCSS('text-decoration-line', 'line-through'); audit.preview.adaptiveComposition = true;
  await capture('artifacts/inline-text-preview.png', mainId, page); await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  const html = path.join(root, 'artifacts/inline-text-demo.html'); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, html); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  await app.context().setOffline(true); const pending = app.waitForEvent('window'), offlineId = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ show: false, width: 1550, height: 1050, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); void w.loadURL('about:blank'); return w.id; }), offline = await pending;
  try { await app.evaluate(({ BrowserWindow }, data) => BrowserWindow.fromId(data.id).loadURL(data.url), { id: offlineId, url: pathToFileURL(html).href }); audit.offline = await inspect(offline.locator('main')); await capture('artifacts/inline-text-offline.png', offlineId, offline); } finally { await offline.close(); await app.context().setOffline(false); }
  expect(await save(path.join(userData, 'after-playback.rea.json'))).toEqual(authored); expect(sha(await fs.readFile(source))).toBe(sourceSha256); expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(w => !w.isVisible()))).toBe(true);
  if (executablePath) expect(sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit, { ok: true, sourceUnchanged: true, designUnchanged: true, hiddenWindows: true });
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally { try { if (app) await app.close(); } finally { audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, '.build/inline-text-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); } }
