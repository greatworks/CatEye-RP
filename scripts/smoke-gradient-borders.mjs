import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..'), executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-gradient-borders-'));
const source = path.join(root, 'artifacts/gradient-border-demo.rea.json'), sourceBytes = await fs.readFile(source), authored = JSON.parse(sourceBytes);
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, sourceSha256: sha(sourceBytes), userData, errors: [], network: [], screenshots: [], pickerResponsesMocked: true, originalAxureGuiCompared: false };
let app;
try {
  if (executablePath) audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observe = page => page.on('pageerror', error => audit.errors.push(error.message)); app.on('window', observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1600, 1350); w.webContents.setBackgroundThrottling(false); return w.id; });
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
  const canvas = page.locator('.editor-widget.box').filter({ hasText: 'Linear / solid fill' }); await canvas.click();
  const inspector = page.locator('.inspector'); await inspector.getByRole('tab', { name: 'Style', exact: true }).click();
  await expect(inspector.getByLabel('Border type', { exact: true })).toHaveValue('linear');
  await inspector.getByRole('button', { name: 'Edit Border gradient', exact: true }).click();
  const offset = inspector.getByLabel('Border Stop 2 offset', { exact: true }); await offset.fill('0.6');
  await inspector.getByRole('button', { name: 'Apply Border gradient', exact: true }).click();
  const edited = await save('edited.rea.json'); expect(edited.pages[0].widgets.find(w => w.id === 'border-linear').style.strokeGradient.stops[1].offset).toBe(0.6);
  const expected = structuredClone(authored); expected.pages[0].widgets.find(w => w.id === 'border-linear').style.strokeGradient.stops[1].offset = 0.6; expect(edited).toEqual(expected);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save('undo.rea.json')).toEqual(authored);
  await capture('artifacts/gradient-border-editor.png', mainId);
  const exercise = async scope => {
    const widget = id => scope.locator('[data-widget-id="'+id+'"]'), card = widget('border-linear');
    await expect(card).toHaveCSS('background-image', /data:image\/svg\+xml/);
    await expect(widget('border-radial')).toHaveCSS('background-image', /radialGradient/);
    await expect(widget('border-corners')).toHaveCSS('border-top-width', '8px');
    await expect(widget('border-corners')).toHaveCSS('border-right-width', '20px');
    await expect(widget('border-input').locator('input')).toHaveValue('Type here');
    await expect(widget('border-image')).toHaveCSS('border-top-color','rgb(25, 94, 220)');
    await expect(widget('border-image-radial')).toHaveCSS('border-top-color','rgba(0, 0, 0, 0)');
    const vector=widget('border-vector'),fill=vector.locator('[data-shadow-fill]'),stroke=vector.locator('[data-shadow-stroke]');
    await expect(vector.locator('linearGradient')).toHaveCount(1);await expect(vector.locator('radialGradient')).toHaveCount(1);
    await expect(fill).toHaveAttribute('fill',/^url\(#/);await expect(stroke).toHaveAttribute('stroke',/^url\(#/);await expect(fill).toHaveAttribute('filter',/^url\(#/);
    const fillPaint=await fill.getAttribute('fill');expect(await stroke.getAttribute('stroke')).not.toBe(fillPaint);
    await expect(widget('border-line').locator('[data-line-shaft]')).toHaveAttribute('stroke',/^url\(#/);
    await expect(widget('border-row')).toHaveCount(2);
    const rows=await widget('border-row').locator('linearGradient').evaluateAll(elements=>elements.map(e=>e.id));expect(new Set(rows).size).toBe(2);
    const before=await card.evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));
    await click(widget('border-solid'));await expect(card).toHaveCSS('background-image','none');await expect(card).toHaveCSS('border-top-color','rgb(72, 92, 120)');
    await expect(stroke).toHaveAttribute('stroke','#485c78');await expect(fill).toHaveAttribute('fill',fillPaint);await expect(fill).toHaveAttribute('filter',/^url\(#/);
    await expect(widget('border-line').locator('[data-line-shaft]')).toHaveAttribute('stroke','#485c78');
    for(const row of await widget('border-row').all())await expect(row.locator('[data-shadow-stroke]')).toHaveAttribute('stroke','#485c78');
    await click(widget('border-restore'));await expect(card).toHaveCSS('background-image',/data:image\/svg\+xml/);await expect(stroke).toHaveAttribute('stroke',/^url\(#/);await expect(fill).toHaveAttribute('fill',fillPaint);
    expect(await card.evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))).toEqual(before);
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay'); await exercise(preview);
  await capture('artifacts/gradient-border-preview.png', mainId);
  await preview.locator('[data-page-id="border-frame-page"]').click(); const nested = preview.frameLocator('iframe[data-inline-frame="border-frame"]'); await exercise(nested);
  audit.fixedFramePlayer = true; await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  expect(await save('after-preview.rea.json')).toEqual(authored);
  const exported = path.join(root, 'artifacts/gradient-border-demo.html'); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, exported);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  await app.context().setOffline(true);
  const pending = app.waitForEvent('window'), offlineId = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ show: false, width: 1600, height: 1350, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } }); w.setContentSize(1600, 1350); void w.loadURL('about:blank'); return w.id; });
  const offline = await pending;
  try {
    await app.evaluate(({ BrowserWindow }, data) => BrowserWindow.fromId(data.id).loadURL(data.url), { id: offlineId, url: pathToFileURL(exported).href }); await exercise(offline.locator('body'));
    await capture('artifacts/gradient-border-offline.png', offlineId, offline);
    await offline.locator('nav').getByRole('button', { name: 'Embedded borders', exact: true }).click(); await exercise(offline.frameLocator('iframe[data-inline-frame="border-frame"]'));
    audit.offlineNestedPlayer = true;
  } finally { await offline.close(); await app.context().setOffline(false); }
  expect(await save('after-offline.rea.json')).toEqual(authored);
  expect(await save('final.rea.json')).toEqual(authored); expect(sha(await fs.readFile(source))).toBe(audit.sourceSha256); expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(w => !w.isVisible()))).toBe(true);
  if (executablePath) expect(sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit, { ok: true, sourceUnchanged: true, designUnchanged: true, hiddenWindows: true });
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally { try { if (app) await app.close(); } finally { audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, '.build/gradient-border-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); } }
