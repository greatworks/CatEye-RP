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
const sourceFile = path.join(artifactRoot, 'native-layers-runtime-source.rea.json');
const source = JSON.parse(await fs.readFile(sourceFile, 'utf8'));
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-native-layers-'));
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
    const file = path.join(artifactRoot, `native-layers-${name}.png`); expect(bytes.length).toBeGreaterThan(1000);
    await fs.writeFile(file, bytes); audit.screenshots.push({ path: file, sha256: hash(bytes) });
  };
  await openDocument(source); expect(await save('initial')).toEqual(source);
  await page.getByRole('button', { name: 'Outline', exact: true }).click();
  await page.locator('[data-outline-widget-id="layer-motion"] > span').click();
  const ui = page.getByRole('complementary', { name: 'Properties inspector' });
  const groupX = ui.getByLabel('X', { exact: true });
  await expect(groupX).toHaveValue('100'); await groupX.fill('110'); await groupX.press('Tab');
  const changed = await save('edited'), expected = structuredClone(source);
  const group = expected.pages[0].widgets.find(widget => widget.id === 'layer-motion');
  function shiftLayer(widget) { widget.x += 10; for (const child of widget.layer?.widgets ?? []) shiftLayer(child); }
  shiftLayer(group); expect(changed).toEqual(expected);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save('undo')).toEqual(source);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save('redo')).toEqual(changed);
  await openDocument({ ...source, name: 'Layer reset' }); await openDocument(changed); expect(await save('reopened')).toEqual(changed);
  await page.locator('[data-outline-widget-id="layer-motion"] > span').click();
  await expect(groupX).toHaveValue('110'); await capture('authoring', mainId, page);
  await openDocument(source);
  const widget = (scope, id) => scope.locator(`[data-widget-id="${id}"]`);
  const geometry = target => target.evaluate(node => {
    const css = getComputedStyle(node), matrix = new DOMMatrixReadOnly(css.transform);
    return { x: parseFloat(css.left), y: parseFloat(css.top), width: parseFloat(css.width), height: parseFloat(css.height), a: matrix.a, b: matrix.b };
  });
  const at = async (target, wanted) => expect.poll(async () => {
    const value = await geometry(target);
    return Object.entries(wanted).reduce((sum, [field, expected]) => sum + Math.abs(value[field] - expected), 0);
  }).toBeLessThan(.02);
  const exercise = async (view, scope) => {
    const root = widget(scope, 'layer-motion'), first = widget(scope, 'layer-first'), second = widget(scope, 'layer-second');
    await at(first, { x: 100, y: 100 }); await at(second, { x: 160, y: 100 });
    const initial = await first.boundingBox(), rootBox = await root.boundingBox();
    expect(initial.x).toBeCloseTo(rootBox.x, 3); expect(initial.y).toBeCloseTo(rootBox.y, 3);
    await widget(scope, 'layer-combine').click();
    await at(first, { x: 120, y: 110, width: 80, height: 40 });
    await at(second, { x: 240, y: 110, width: 80, height: 40 });
    await widget(scope, 'layer-rotate').click();
    await at(first, { x: 180, y: 50, width: 80, height: 40, a: 0, b: 1 });
    await at(second, { x: 180, y: 170, width: 80, height: 40, a: 0, b: 1 });
    await expect(root).toHaveCSS('transform', 'none');
    const drawnFirst = await first.boundingBox(), drawnSecond = await second.boundingBox();
    expect(drawnSecond.y - drawnFirst.y).toBeCloseTo(120, 2); expect(drawnSecond.x).toBeCloseTo(drawnFirst.x, 2);
    await widget(scope, 'layer-style-direct').hover();
    await expect(widget(scope, 'layer-style-direct')).toHaveCSS('background-color', 'rgb(255, 0, 0)');
    await expect(widget(scope, 'layer-style-blocked')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await widget(scope, 'layer-select').click();
    await expect(widget(scope, 'layer-style-direct')).toHaveCSS('background-color', 'rgb(0, 170, 68)');
    await expect(widget(scope, 'layer-style-blocked')).toHaveCSS('background-color', 'rgb(0, 170, 68)');
    const rows = widget(scope, 'layer-row-leaf'); await expect(rows).toHaveCount(4);
    await rows.nth(0).click(); await at(rows.nth(0), { x: 32, y: 8 });
    for (let i = 1; i < 4; i++) await at(rows.nth(i), { x: 12, y: 8 });
    await rows.nth(3).click(); await at(rows.nth(3), { x: 32, y: 8 }); await at(rows.nth(0), { x: 32, y: 8 });
    const frame = widget(scope, 'layer-frame').locator('iframe').contentFrame(), member = frame.locator('[data-widget-id="layer-frame-leaf"]');
    await at(member, { x: 30, y: 70 }); await frame.locator('[data-widget-id="layer-frame-move"]').click(); await at(member, { x: 65, y: 85 });
    return { first: await geometry(first), second: await geometry(second), rowRects: await rows.evaluateAll(nodes => nodes.map(node => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; })) };
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); audit.previewGeometry = await exercise(page, page.locator('.preview-overlay'));
  await capture('preview', mainId, page); await page.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save('after-preview')).toEqual(source);
  const html = path.join(artifactRoot, 'native-layers.html'); await savePicker(html); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
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
  const demo = path.join(artifactRoot, 'native-layers-demo.rea.json'); await fs.writeFile(demo, JSON.stringify(changed, null, 2) + '\n'); audit.demo = { path: demo, sha256: await sha(demo) };
  audit.checks = { authoredGroupMove: true, nestedMembersTranslatedOnce: true, singleUndo: true, redo: true, reopened: true, reopenedFromDifferentDocument: true,
    preview: true, offline: true, combinedMoveResizeThenRotate: true, nonRotatingLayerWrapper: true, sameCoordinateScope: true,
    hoverPropagationBarrier: true, selectedRecursionIgnoresBarrier: true, nestedRowIsolation: true, independentEmbeddedFrame: true, sourceDocumentUnchangedDuringPlayback: true };
  expect(await sha(sourceFile)).toBe(audit.source.sha256); expect(await sha(asar)).toBe(audit.appAsarSha256);
  for (const field of ['errors', 'consoleErrors', 'network', 'failedRequests']) expect(audit[field]).toEqual([]);
  audit.ok = true;
} catch (error) { audit.failure = error.stack ?? String(error); process.exitCode = 1; }
finally {
  if (app) try { await app.close(); } catch (error) { audit.errors.push(String(error)); audit.ok = false; process.exitCode = 1; }
  audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, '.build/native-layers-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2));
}
