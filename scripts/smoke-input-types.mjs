import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { inputTypesFixture, exerciseInputTypes } from './input-types-scenario.mjs';

const root = path.resolve(import.meta.dirname, '..');
const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-input-types-'));
const auditFile = path.join(root, '.build/input-types-desktop-audit.json');
await fs.mkdir(path.join(root, '.build'), { recursive: true });
await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
const audit = {
  ok: false, startedAt: new Date().toISOString(), executablePath: executablePath ?? null, userData,
  errors: [], network: [], screenshots: [], pickerResponsesMocked: true, originalAxureGuiCompared: false,
  pickerBoundary: 'Open/save/import dialog responses supply exact local paths; the native OS picker UI is not exercised. File selection uses Playwright setInputFiles with an in-memory local text file; no upload is performed.',
};
const doc = inputTypesFixture(), source = path.join(userData, 'input-types.rea.json');
await fs.writeFile(source, JSON.stringify(doc)); const sourceSha = sha(await fs.readFile(source));
let app;
try {
  if (executablePath) audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({
    ...(executablePath ? { executablePath } : { args: [root] }),
    env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData },
  });
  const observed = new WeakSet();
  const observe = page => { if (observed.has(page)) return; observed.add(page); page.on('pageerror', error => audit.errors.push(error.message)); };
  app.on('window', observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setContentSize(1600, 1100); return window.id;
  });
  const menu = async name => {
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click();
  };
  const open = async file => {
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file);
    await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened');
  };
  const save = async file => {
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file);
    await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);
    return JSON.parse(await fs.readFile(file, 'utf8'));
  };
  const capture = async (name, id, renderPage = page) => {
    await renderPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const encoded = await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), id);
    const bytes = Buffer.from(encoded, 'base64'); expect(bytes.length).toBeGreaterThan(1000);
    const file = path.join(root, 'artifacts', name); await fs.writeFile(file, bytes); audit.screenshots.push({ file, sha256: sha(bytes) });
  };

  await open(source); await expect(page.locator('.titlebar')).toContainText(doc.name);
  const saved = path.join(userData, 'saved-input-types.rea.json'); expect(await save(saved)).toEqual(doc);
  await open(saved); expect(await save(path.join(userData, 'reopened-input-types.rea.json'))).toEqual(doc);
  await page.locator('.editor-widget.input').filter({ has: page.getByRole('textbox', { name: 'Field tel', exact: true }) }).click();
  const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await inspector.getByRole('tab', { name: 'Style', exact: true }).click(); const dropdown = inspector.getByLabel('Input type', { exact: true });
  await expect(dropdown).toHaveValue('tel'); await dropdown.scrollIntoViewIfNeeded();
  const options = await dropdown.locator('option').evaluateAll(items => items.map(item => ({ value: item.value, text: item.textContent })));
  expect(options.map(item => item.value)).toEqual(['text', 'password', 'email', 'number', 'tel', 'url', 'search', 'file', 'date', 'month', 'time']);
  expect(options.find(item => item.value === 'tel').text).toBe('Phone');
  await dropdown.click(); await capture('input-types-authoring.png', mainId); await dropdown.press('Escape'); await expect(dropdown).toHaveValue('tel');
  audit.authoringDropdown = { options, selected: 'tel', captureBoundary: 'capturePage records the renderer surface; an OS-owned native select popup may be absent from the PNG.' };
  expect(await save(path.join(userData, 'after-authoring-inspection.rea.json'))).toEqual(doc);

  await page.getByTitle('Preview (F5)', { exact: true }).click(); await exerciseInputTypes(page, page.locator('.preview-overlay'));
  await page.locator('.preview-scroll').evaluate(element => { element.scrollTop = 0; }); await capture('input-types-desktop.png', mainId);
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save(path.join(userData, 'after-preview.rea.json'))).toEqual(doc);
  const html = path.join(userData, 'input-types.html');
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, html);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  expect((await fs.stat(html)).size).toBeGreaterThan(1000);
  await app.context().setOffline(true);
  const pending = app.waitForEvent('window');
  const offlineId = await app.evaluate(({ BrowserWindow }) => {
    const window = new BrowserWindow({ show: false, width: 1600, height: 1100, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    // Attach Playwright and observers before loading the actual exported file.
    void window.loadURL('about:blank'); return window.id;
  });
  const offline = await pending; observe(offline);
  try {
    await app.evaluate(({ BrowserWindow }, { id, url }) => BrowserWindow.fromId(id).loadURL(url), { id: offlineId, url: pathToFileURL(html).href });
    await offline.waitForLoadState('domcontentloaded'); await exerciseInputTypes(offline, offline);
    await offline.locator('.offline-viewport').evaluate(element => { element.scrollTop = 0; }); await capture('input-types-desktop-offline.png', offlineId, offline);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible()))).toBe(true);
  } finally { await offline.close(); await app.context().setOffline(false); }
  expect(await save(path.join(userData, 'after-export.rea.json'))).toEqual(doc);
  await fs.copyFile(saved, path.join(root, 'artifacts/input-types-demo.rea.json')); await fs.copyFile(html, path.join(root, 'artifacts/input-types-demo.html'));

  const evidence = JSON.parse(await fs.readFile(path.join(root, 'research/rp-input-types-evidence.json'), 'utf8'));
  const nativeSample = evidence.samples.find(sample => path.basename(sample.file) === 'Sample form patterns.rplib');
  expect(nativeSample, 'The audited shipped form library must be available').toBeTruthy();
  const nativeFile = path.resolve(root, nativeSample.file), nativeBefore = sha(await fs.readFile(nativeFile)); expect(nativeBefore).toBe(nativeSample.sha256);
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, nativeFile);
  await menu('Import Axure .rp (experimental)…'); const report = page.getByRole('dialog', { name: 'RP import report', exact: true });
  await expect(report).toBeVisible({ timeout: 20000 }); audit.nativeImportReport = await report.innerText(); await report.getByRole('button', { name: 'Close report', exact: true }).click();
  const nativeSaved = path.join(userData, 'native-input-types.rea.json'), recovered = await save(nativeSaved);
  const all = widgets => widgets.flatMap(widget => [widget, ...all((widget.states ?? []).flatMap(state => state.widgets)), ...all(widget.repeater?.template ?? [])]);
  const targetId = 'rp-w-784fffad1a36482594f6f965760990d6-ab5ee8299744448f84b17c9c3f1b3142';
  const targetPage = recovered.pages.find(page => all(page.widgets).some(widget => widget.id === targetId));
  expect(targetPage?.name).toBe('Personal information form'); const target = all(targetPage.widgets).find(widget => widget.id === targetId);
  expect(target).toMatchObject({ type: 'input', inputType: 'tel' });
  await open(nativeSaved); expect(await save(path.join(userData, 'native-reopened.rea.json'))).toEqual(recovered);
  await page.locator('.left-pane').getByRole('button', { name: 'Pages', exact: true }).click(); await page.locator(`[data-page-node-id="${targetPage.id}"]`).dblclick();
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const nativeInput = page.locator(`.preview-page [data-widget-id="${targetId}"] input`);
  await expect(nativeInput).toHaveAttribute('type', 'tel'); await expect(nativeInput).toBeEditable(); const entered = '+86 138-0013-8000';
  await nativeInput.click(); await nativeInput.press('ControlOrMeta+A'); await nativeInput.pressSequentially(entered); await expect(nativeInput).toHaveValue(entered);
  await nativeInput.press('Tab'); await expect(nativeInput).toHaveValue(entered); await nativeInput.scrollIntoViewIfNeeded(); await capture('rp-input-types-desktop.png', mainId);
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save(path.join(userData, 'native-after.rea.json'))).toEqual(recovered);
  expect(sha(await fs.readFile(nativeFile))).toBe(nativeBefore); expect(sha(await fs.readFile(source))).toBe(sourceSha);
  audit.nativePhone = {
    file: nativeFile, sourceSha256: nativeBefore, sourceUnchanged: true, targetId, page: targetPage.name, inputType: target.inputType,
    entered, realKeyboardTyping: true, valueRetainedAfterBlur: true, nativeSaveReopen: true, designUnchanged: true,
    pickerFilterBoundary: 'The mocked picker supplies the exact shipped rplib container; the ordinary picker advertises rp projects. This verifies bounded container recovery, not full library-format interoperability.',
  };
  expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  if (executablePath) expect(sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit, {
    ok: true, nativeSaveReopen: true, designUnchanged: true, previewAndActualOfflineExport: true, hiddenWindows: true,
    elevenInputTypes: true, actualKeyboardEditing: true, browserValueNormalization: true, fileSelectionAndClear: true,
    fileNonemptyAssignmentRejected: true, fileValueNotSavedToProject: true, sourceSha256: sourceSha,
    projectSha256: sha(await fs.readFile(saved)), htmlSha256: sha(await fs.readFile(html)),
  });
} catch (error) {
  audit.failure = error.stack ?? String(error); throw error;
} finally {
  try { if (app) await app.close(); }
  finally { audit.finishedAt = new Date().toISOString(); await fs.writeFile(auditFile, JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); }
}
