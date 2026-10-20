import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..'), executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-dropdown-'));
const evidence = JSON.parse(await fs.readFile(path.join(root, 'research/rp-dropdown-evidence.json'), 'utf8'));
const source = path.resolve(root, evidence.samples.find(s => s.file.endsWith('Sample form patterns.rplib')).file), sourceSha256 = sha(await fs.readFile(source));
expect(sourceSha256).toBe('1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179');
const ids = ['d8fa7295bba34065956efd90f1c4b300', '89ea7c71f7b54eed986cd4e8569b14e5'], prefix = 'rp-w-784fffad1a36482594f6f965760990d6-';
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, source, sourceSha256, userData, errors: [], network: [], screenshots: [], pickerResponsesMocked: true, originalAxureGuiCompared: false };
let app;
try {
  if (executablePath) audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observe = page => page.on('pageerror', e => audit.errors.push(e.message)); app.on('window', observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1600, 1100); w.webContents.setBackgroundThrottling(false); return w.id; });
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const open = async file => { await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file); await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened'); };
  const save = async file => { await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file); await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`); return JSON.parse(await fs.readFile(file, 'utf8')); };
  const capture = async (file, id, target) => { await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), id), 'base64'); expect(bytes.length).toBeGreaterThan(1000); await fs.writeFile(path.join(root, file), bytes); audit.screenshots.push({ file, sha256: sha(bytes) }); };
  const offline = async (name, check) => {
    const html = path.join(root, 'artifacts', `${name}.html`); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, html); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported'); await app.context().setOffline(true);
    const pending = app.waitForEvent('window'); const id = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ show: false, width: 1600, height: 1100, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); void w.loadURL('about:blank'); return w.id; }); const target = await pending;
    try { await app.evaluate(({ BrowserWindow }, data) => BrowserWindow.fromId(data.id).loadURL(data.url), { id, url: pathToFileURL(html).href }); await check(target); await capture(`artifacts/${name}-offline.png`, id, target); } finally { await target.close(); await app.context().setOffline(false); }
  };
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, source); await menu('Import Axure .rp (experimental)…');
  const report = page.getByRole('dialog', { name: 'RP import report', exact: true }); await expect(report).toBeVisible({ timeout: 20000 }); audit.importReport = await report.innerText(); await report.getByRole('button', { name: 'Close report', exact: true }).click();
  const nativeFile = path.join(root, 'artifacts/native-dropdown-demo.rea.json'), doc = await save(nativeFile), nativePage = doc.pages.find(p => p.name === 'Personal information form');
  for (const [index, id] of ids.entries()) { const w = nativePage.widgets.find(w => w.id === prefix + id), raw = evidence.controls.find(c => c.id === id); expect(w).toMatchObject({ type: 'select', selectMode: 'dropdown', multiple: false, selectedIndices: [0], width: index ? 160 : 400, height: 48, x: index ? 240 : 20, y: index ? 676 : 466 }); expect(w.options).toEqual(raw.options.map(o => o.label)); }
  await open(nativeFile); expect(await save(path.join(userData, 'native-reopened.rea.json'))).toEqual(doc);
  await page.locator('.left-pane').getByRole('button', { name: 'Pages', exact: true }).click(); await page.locator(`[data-page-node-id="${nativePage.id}"]`).dblclick();
  const nativeCheck = async scope => {
    const result = [];
    for (const id of ids) { const control = scope.locator(`[data-widget-id="${prefix + id}"] select`), expected = nativePage.widgets.find(w => w.id === prefix + id).options; await expect(control).toHaveValue(' '); expect(await control.locator('option').evaluateAll(os => os.map(o => o.value))).toEqual(expected); await control.selectOption({ index: expected.length - 1 }); await expect(control).toHaveValue(expected.at(-1)); result.push({ id, count: expected.length, initial: ' ', lastSelectedValue: expected.at(-1) }); }
    return result;
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); audit.nativePreview = await nativeCheck(page.locator('.preview-overlay')); await capture('artifacts/native-dropdown-desktop.png', mainId, page); await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await offline('native-dropdown-demo', async target => { await target.getByRole('button', { name: nativePage.name, exact: true }).click(); audit.nativeOffline = await nativeCheck(target); });
  expect(await save(path.join(userData, 'native-after.rea.json'))).toEqual(doc);
  const demoFile = path.join(root, 'artifacts/dropdown-behavior.rea.json'), authored = JSON.parse(await fs.readFile(demoFile, 'utf8')); await open(demoFile); expect(await save(path.join(userData, 'authored-reopened.rea.json'))).toEqual(authored);
  const authoredCheck = async scope => {
    const single = scope.locator('select[aria-label="Single choice"]'), multi = scope.locator('select[aria-label="Multiple choices"]'), button = name => scope.locator(`.widget[aria-label="${name}"]`), indices = control => control.evaluate(e => Array.from(e.selectedOptions, o => o.index));
    await single.focus(); await single.press('ArrowDown'); expect(await indices(single)).toEqual([1]); await expect(button('Single count')).toHaveText('1');
    await button('Set A').click(); expect(await indices(single)).toEqual([1]); await button('Set missing').click(); await button('Set missing').click(); expect(await indices(single)).toEqual([]); await expect(button('Single count')).toHaveText('3');
    await button('Set space').click(); await expect(single).toHaveValue(' '); await button('Disable and set B').click(); await expect(single).toBeDisabled(); await expect(single).toHaveValue('B'); await expect(button('Single count')).toHaveText('5');
    await button('Multi set blank').click(); expect(await indices(multi)).toEqual([]); await button('Multi set A').click(); await button('Multi set A').click(); expect(await indices(multi)).toEqual([0, 1]); await expect(button('Multiple count')).toHaveText('2');
    await multi.selectOption([{ index: 0 }, { index: 4 }]); await button('Multi set comma').click(); expect(await indices(multi)).toEqual([0, 4]); await expect(button('Multiple count')).toHaveText('3');
    const rows = scope.locator('select[aria-label="Row choice"]'); await rows.nth(1).selectOption({ index: 1 }); expect(await indices(rows.nth(0))).toEqual([0]); expect(await indices(rows.nth(1))).toEqual([1]); await expect(button('Row echo')).toHaveText('2:One');
    await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    return { duplicateIdentity: true, missingClearsAndRepeats: true, whitespace: true, disabledProgrammaticChange: true, multipleDuplicates: true, multipleLooseEquality: true, rowIsolation: true };
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); audit.authoredPreview = await authoredCheck(page.locator('.preview-overlay')); await capture('artifacts/dropdown-behavior-desktop.png', mainId, page); await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await offline('dropdown-behavior', async target => { audit.authoredOffline = await authoredCheck(target); });
  expect(await save(path.join(userData, 'authored-after.rea.json'))).toEqual(authored); expect(sha(await fs.readFile(source))).toBe(sourceSha256); expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(w => !w.isVisible()))).toBe(true);
  if (executablePath) expect(sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit, { ok: true, sourceUnchanged: true, designUnchanged: true, savedAndReopened: true, hiddenWindows: true });
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally { try { if (app) await app.close(); } finally { audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, '.build/dropdown-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); } }
