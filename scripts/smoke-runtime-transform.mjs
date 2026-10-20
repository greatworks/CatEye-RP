import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
if (!process.argv[2]) throw Error('Pass the candidate executable');
const executablePath = path.resolve(process.argv[2]);
const artifactRoot = path.resolve(root, process.argv[3] ?? 'artifacts');
const asar = path.join(path.dirname(executablePath), 'resources/app.asar');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = async file => hash(await fs.readFile(file));
const sourceFile = path.join(artifactRoot, 'runtime-transform-source.rea.json');
const source = JSON.parse(await fs.readFile(sourceFile, 'utf8'));
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-runtime-transform-'));
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, userData,
  source: { path: sourceFile, sha256: await sha(sourceFile) }, appAsarSha256: await sha(asar),
  saves: [], exports: [], screenshots: [], checks: {}, errors: [], consoleErrors: [], network: [], failedRequests: [],
  originalAxureGuiCompared: false, nativePickerResponsesMocked: true };
let app;
try {
  app = await electron.launch({ executablePath, env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observed = new WeakSet();
  const observe = page => {
    if (observed.has(page)) return;
    observed.add(page);
    page.on('pageerror', error => audit.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') audit.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => audit.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  };
  app.on('window', observe); app.windows().forEach(observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]; window.setContentSize(1600, 1100); window.webContents.setBackgroundThrottling(false); return window.id;
  });
  // Keep native dialogs deterministic while exercising the actual IPC open/save paths.
  const openDocument = async doc => {
    const file = path.join(userData, 'open.rea.json'); await fs.writeFile(file, JSON.stringify(doc));
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file);
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
    await expect(page.locator('.titlebar')).toContainText(doc.name);
    await expect(page.locator('.statusbar')).toContainText('Document opened');
  };
  const savePicker = file => app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file);
  const save = async suffix => {
    const file = path.join(userData, `${suffix}.rea.json`); await savePicker(file); await page.getByTitle('Save', { exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);
    const bytes = await fs.readFile(file); audit.saves.push({ path: file, sha256: hash(bytes) }); return JSON.parse(bytes);
  };
  const capture = async (name, id, view) => {
    await view.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), id), 'base64');
    const file = path.join(artifactRoot, `runtime-transform-${name}.png`); expect(bytes.length).toBeGreaterThan(1000);
    await fs.writeFile(file, bytes); audit.screenshots.push({ path: file, sha256: hash(bytes) });
  };
  await openDocument(source); expect(await save('initial')).toEqual(source);
  await page.getByRole('button', { name: 'Outline', exact: true }).click();
  await page.locator('[data-outline-widget-id="transform-combine"] > span').click();
  const ui = page.getByRole('complementary', { name: 'Properties inspector' });
  await ui.getByRole('tab', { name: 'Interactions', exact: true }).click();
  const moveX = ui.getByLabel('Move target 1 X', { exact: true }); await expect(moveX).toHaveValue('40'); await moveX.fill('50'); await moveX.press('Tab');
  const changed = await save('edited'), expected = structuredClone(source);
  const editedCase = expected.pages[0].widgets.find(widget => widget.id === 'transform-combine').interactions[0];
  editedCase.actions[0].move.targets[0].x.text = '50'; editedCase.isNewIfGroup = true; expect(changed).toEqual(expected);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save('undo')).toEqual(source);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save('redo')).toEqual(changed);
  await openDocument({ ...source, name: 'Motion reset' }); await openDocument(changed); expect(await save('reopened')).toEqual(changed);
  await page.getByLabel('Zoom', { exact: true }).selectOption('0.75');
  await page.locator('[data-outline-widget-id="transform-combine"] > span').click(); await ui.getByRole('tab', { name: 'Interactions', exact: true }).click();
  await expect(moveX).toHaveValue('50'); await capture('authoring', mainId, page);
  await openDocument(source);
  const widget = (scope, id) => scope.locator(`[data-widget-id="${id}"]`);
  const geometry = target => target.evaluate(node => {
    const css = getComputedStyle(node), matrix = new DOMMatrixReadOnly(css.transform);
    return { x: parseFloat(css.left), y: parseFloat(css.top), width: parseFloat(css.width), height: parseFloat(css.height), a: matrix.a, b: matrix.b };
  });
  const at = async (target, x, y) => expect.poll(async () => { const g = await geometry(target); return Math.abs(g.x - x) + Math.abs(g.y - y); }).toBeLessThan(.02);
  const drag = async (view, target, dx, dy) => {
    await target.scrollIntoViewIfNeeded(); const box = await target.boundingBox(); expect(box).not.toBeNull();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await view.mouse.move(x, y); await view.mouse.down(); await view.mouse.move(x + dx, y + dy); await view.mouse.up();
  };
  const exercise = async (view, scope) => {
    const combined = widget(scope, 'transform-combined'); await widget(scope, 'transform-combine').click();
    await expect.poll(async () => { const g = await geometry(combined); return g.width > 200.5 && g.width < 299 && g.b > .01 && g.b < .99; }, { intervals: [10, 15, 20] }).toBe(true);
    await expect.poll(async () => { const g = await geometry(combined); return Math.abs(g.a) + Math.abs(g.b - 1); }).toBeLessThan(.00001);
    const final = await geometry(combined); expect(final.x).toBeCloseTo(140, 2); expect(final.y).toBeCloseTo(190, 2);
    expect(final.width).toBeCloseTo(299.65306122448976, 1); expect(final.height).toBeCloseTo(159.59183673469386, 1);
    await widget(scope, 'transform-ordered').click(); await at(widget(scope, 'transform-first'), 830, 225); await at(widget(scope, 'transform-second'), 800, 160);
    const target = widget(scope, 'transform-drag'); await drag(view, target, 50, 20); await at(target, 650, 380);
    await expect(widget(scope, 'transform-drag-status')).toHaveText('Dropped 50,50'); await target.click(); await expect(widget(scope, 'transform-drag-status')).toHaveText('Clicked');
    const rows = widget(scope, 'transform-row-drag'); await expect(rows).toHaveCount(2);
    await drag(view, rows.first(), 40, 10); await at(rows.first(), 54, 22); await at(rows.nth(1), 14, 12);
    await drag(view, rows.nth(1), 20, 5); await at(rows.nth(1), 34, 17); await at(rows.first(), 54, 22);
    const inner = widget(scope, 'transform-frame').locator('iframe').contentFrame().locator('[data-widget-id="transform-child-drag"]');
    await drag(view, inner, 35, 15); await at(inner, 65, 85); return final;
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); audit.previewGeometry = await exercise(page, page.locator('.preview-overlay'));
  await capture('preview', mainId, page); await page.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save('after-preview')).toEqual(source);
  const html = path.join(artifactRoot, 'runtime-transform.html'); await savePicker(html); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  await expect(page.locator('.statusbar')).toContainText('Exported'); audit.exports.push({ path: html, sha256: await sha(html) });
  await app.context().setOffline(true); let offline;
  try {
    const pending = app.waitForEvent('window');
    const id = await app.evaluate(({ BrowserWindow }) => {
      const window = new BrowserWindow({ show: false, width: 1600, height: 1100, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
      window.setContentSize(1600, 1100); void window.loadURL('about:blank'); return window.id;
    });
    offline = await pending; observe(offline); await app.evaluate(({ BrowserWindow }, { id, url }) => BrowserWindow.fromId(id).loadURL(url), { id, url: pathToFileURL(html).href });
    audit.offlineGeometry = await exercise(offline, offline); await capture('offline', id, offline);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible()))).toBe(true);
  } finally { if (offline && !offline.isClosed()) await offline.close(); await app.context().setOffline(false); }
  expect(await save('after-offline')).toEqual(source);
  const demo = path.join(artifactRoot, 'runtime-transform-demo.rea.json'); await fs.writeFile(demo, JSON.stringify(changed, null, 2) + '\n'); audit.demo = { path: demo, sha256: await sha(demo) };
  audit.checks = { authoredPayload: true, singleUndo: true, redo: true, reopened: true, reopenedFromDifferentDocument: true,
    preview: true, offline: true, combinedAnimatedIntermediateState: true, orderedLocalTargets: true, mouseDrag: true,
    dragGeneratedClickSuppressed: true, subsequentClickWorks: true, rowIsolation: true, independentEmbeddedFrame: true, sourceDocumentUnchangedDuringPlayback: true };
  expect(await sha(sourceFile)).toBe(audit.source.sha256); expect(await sha(asar)).toBe(audit.appAsarSha256);
  for (const field of ['errors', 'consoleErrors', 'network', 'failedRequests']) expect(audit[field]).toEqual([]);
  audit.ok = true;
} catch (error) { audit.failure = error.stack ?? String(error); process.exitCode = 1; }
finally {
  if (app) try { await app.close(); } catch (error) { audit.errors.push(String(error)); audit.ok = false; process.exitCode = 1; }
  audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, '.build/runtime-transform-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2));
}
