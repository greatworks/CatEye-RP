import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..'), args = process.argv.slice(2), authoredOnly = args.includes('--authored-only'), executableArgument = args.find(arg => !arg.startsWith('--')), executablePath = executableArgument ? path.resolve(executableArgument) : undefined;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-rotation-'));
const source = path.join(root, 'artifacts/rotation-demo.rea.json'), sourceBytes = await fs.readFile(source), authored = JSON.parse(sourceBytes);
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, authoredOnly, sourceSha256: sha(sourceBytes), userData, errors: [], network: [], screenshots: [], native: [], pickerResponsesMocked: true, originalAxureGuiCompared: false };
let app;
try {
  if (executablePath) audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')));
  app = await electron.launch({ ...(executablePath ? { executablePath } : { args: [root] }), env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observe = page => page.on('pageerror', error => audit.errors.push(error.message)); app.on('window', observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1600, 1250); w.webContents.setBackgroundThrottling(false); return w.id; });
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const open = async file => { await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file); await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened'); };
  const save = async name => { const file = path.join(userData, name); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file); await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${name}`); return JSON.parse(await fs.readFile(file, 'utf8')); };
  const capture = async (file, id = mainId, target = page) => {
    await app.evaluate(({ BrowserWindow }, id) => { const w = BrowserWindow.fromId(id); w.webContents.setBackgroundThrottling(false); w.webContents.invalidate(); }, id);
    await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), id), 'base64');
    expect(bytes.length).toBeGreaterThan(1000); await fs.writeFile(path.join(root, file), bytes); audit.screenshots.push({ file, sha256: sha(bytes) });
  };
  const click = async locator => { await locator.scrollIntoViewIfNeeded(); const window = await app.browserWindow(locator.page()); await window.evaluate(async w => (await w.webContents.capturePage(undefined, { stayHidden: true })).toPNG().length); await window.dispose(); await locator.click(); };
  const geometry = async (locator, widget, ancestors = []) => {
    const actual = await locator.evaluate(element => {
      const s = getComputedStyle(element), m = new DOMMatrix(s.transform), b = element.getBoundingClientRect();
      return { matrix: [m.a, m.b, m.c, m.d, m.e, m.f], origin: s.transformOrigin.split(' ').slice(0, 2).map(parseFloat), width: parseFloat(element.style.width), height: parseFloat(element.style.height), left: parseFloat(element.style.left), top: parseFloat(element.style.top), computedWidth: parseFloat(s.width), computedHeight: parseFloat(s.height), bounds: { width: b.width, height: b.height } };
    });
    const angle = widget.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    [cos, sin, -sin, cos, 0, 0].forEach((expected, i) => expect(actual.matrix[i]).toBeCloseTo(expected, 5));
    expect(actual.left).toBeCloseTo(widget.x, 3); expect(actual.top).toBeCloseTo(widget.y, 3);
    expect(actual.width).toBeCloseTo(widget.width, 3); expect(actual.height).toBeCloseTo(widget.height, 3);
    // Chromium quantizes layout dimensions to 1/64 CSS px. Check the authored
    // style separately; transform-origin is half the actual layout dimension.
    expect(Math.abs(actual.computedWidth - widget.width)).toBeLessThanOrEqual(1 / 64 + 0.0001);
    expect(Math.abs(actual.computedHeight - widget.height)).toBeLessThanOrEqual(1 / 64 + 0.0001);
    expect(actual.origin[0]).toBeCloseTo(actual.computedWidth / 2, 3); expect(actual.origin[1]).toBeCloseTo(actual.computedHeight / 2, 3);
    const worldAngle = [widget.rotation, ...ancestors].reduce((a, b) => a + b, 0) * Math.PI / 180;
    expect(actual.bounds.width).toBeCloseTo(Math.abs(widget.width * Math.cos(worldAngle)) + Math.abs(widget.height * Math.sin(worldAngle)), 1);
    expect(actual.bounds.height).toBeCloseTo(Math.abs(widget.width * Math.sin(worldAngle)) + Math.abs(widget.height * Math.cos(worldAngle)), 1);
  };
  const exercise = async scope => {
    const widget = id => scope.locator(`[data-widget-id="${id}"]`);
    for (const item of authored.pages[0].widgets.filter(w => w.rotation)) await geometry(widget(item.id), item);
    for (const id of ['rotation-arrow', 'rotation-curve']) {
      const paths = widget(id).locator('[data-line-arrow="end"]'); expect(await paths.count()).toBeGreaterThan(0);
      expect(await paths.evaluateAll(nodes => nodes.every(node => { const b = node.getBBox(); return b.width > 0 && b.height > 0 && !/NaN|Infinity/.test(node.outerHTML); }))).toBe(true);
    }
    await widget('rotation-input').getByRole('textbox').fill('Rotated input remains editable');
    await expect(widget('rotation-input').getByRole('textbox')).toHaveValue('Rotated input remains editable');
    await click(widget('rotation-button')); await expect(widget('rotation-result')).toHaveText('The rotated click reached its target.');
  };
  const nested = async scope => {
    const panel = authored.pages[1].widgets.find(w => w.id === 'rotation-panel'), child = panel.states[0].widgets[0];
    await geometry(scope.locator('[data-widget-id="rotation-panel"]'), panel);
    await geometry(scope.locator('[data-widget-id="rotation-child"]'), child, [panel.rotation]);
  };
  await open(source); expect(await save('initial.rea.json')).toEqual(authored);
  await page.getByLabel('Zoom', { exact: true }).selectOption('1');
  await page.locator('.editor-widget.box').filter({ hasText: /^90°$/ }).click();
  const center = async selector => { const b = await page.locator(selector).boundingBox(); if (!b) throw Error(`Missing ${selector}`); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const east = await center('.resize-handle.e'), west = await center('.resize-handle.w');
  await page.mouse.move(east.x, east.y); await page.mouse.down(); await page.mouse.move(east.x, east.y + 40, { steps: 4 }); await page.mouse.up();
  const resized = await save('resized.rea.json'), original = authored.pages[0].widgets.find(w => w.id === 'rotation-box-90'), changed = resized.pages[0].widgets.find(w => w.id === original.id);
  expect(changed.width).toBe(220); expect(changed.height).toBe(original.height); expect(changed.x).toBeCloseTo(original.x - 20, 6); expect(changed.y).toBeCloseTo(original.y + 20, 6);
  const fixed = await center('.resize-handle.w'); expect(fixed.x).toBeCloseTo(west.x, 1); expect(fixed.y).toBeCloseTo(west.y, 1);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save('undo.rea.json')).toEqual(authored);
  await capture('artifacts/rotation-editor.png'); audit.rotatedResizeAndUndo = true;
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay'); await exercise(preview); await capture('artifacts/rotation-preview.png');
  await preview.locator('[data-page-id="rotation-nested-page"]').click(); await nested(preview); await capture('artifacts/rotation-nested.png');
  await preview.locator('[data-page-id="rotation-frame-page"]').click(); await exercise(preview.frameLocator('iframe[data-inline-frame="rotation-frame"]')); audit.fixedFramePlayer = true;
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save('after-preview.rea.json')).toEqual(authored);
  const exported = path.join(root, 'artifacts/rotation-demo.html'); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, exported);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  await app.context().setOffline(true);
  const pending = app.waitForEvent('window'), offlineId = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ show: false, width: 1600, height: 1250, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } }); w.setContentSize(1600, 1250); void w.loadURL('about:blank'); return w.id; });
  const offline = await pending;
  try {
    await app.evaluate(({ BrowserWindow }, data) => BrowserWindow.fromId(data.id).loadURL(data.url), { id: offlineId, url: pathToFileURL(exported).href }); await exercise(offline.locator('body')); await capture('artifacts/rotation-offline.png', offlineId, offline);
    await offline.locator('nav').getByRole('button', { name: 'Nested rotation', exact: true }).click(); await nested(offline.locator('body'));
    await offline.locator('nav').getByRole('button', { name: 'Embedded rotation', exact: true }).click(); await exercise(offline.frameLocator('iframe[data-inline-frame="rotation-frame"]')); audit.offlineNestedPlayer = true;
  } finally { await offline.close(); await app.context().setOffline(false); }
  expect(await save('after-offline.rea.json')).toEqual(authored);
  if (!authoredOnly) {
  const corpus = JSON.parse(await fs.readFile(path.join(root, 'research/rotation-import-audit.json'), 'utf8'));
  for (const sample of corpus.samples.filter(s => s.rotations?.length)) {
    expect(sha(await fs.readFile(sample.file))).toBe(sample.sha256);
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, sample.file);
    await menu('Import Axure .rp (experimental)…'); const report = page.getByRole('dialog', { name: 'RP import report', exact: true });
    await expect(report).toContainText(`${sample.import.pagesImported} page(s), ${sample.import.widgetsImported} recovered widget(s), ${sample.import.widgetsSkipped} skipped item(s).`);
    await report.getByRole('button', { name: 'Close report', exact: true }).click();
    const name = `native-${audit.native.length}.rea.json`, native = await save(name); await open(path.join(userData, name)); expect(await save(`reopened-${name}`)).toEqual(native);
    await page.getByTitle('Preview (F5)', { exact: true }).click();
    for (const item of sample.rotations) {
      const owner = native.pages.find(p => p.widgets.some(w => w.id === item.id)); expect(owner).toBeTruthy(); const stored = owner.widgets.find(w => w.id === item.id);
      for (const key of ['x', 'y', 'width', 'height', 'rotation', 'style', 'vectorPath']) expect(stored[key]).toEqual(item[key]);
      await preview.locator(`[data-page-id="${owner.id}"]`).click(); const rendered = preview.locator(`[data-widget-id="${item.id}"]`); await rendered.scrollIntoViewIfNeeded(); await geometry(rendered, item);
      await expect(rendered.locator('[data-shadow-fill]')).toHaveCount(1);
      if (item.style.lineEnds?.end && item.style.lineEnds.end !== 'none') expect(await rendered.locator('[data-line-arrow="end"]').count()).toBeGreaterThan(0);
    }
    if (sample.rotations.some(w => w.style.lineEnds?.end !== 'none' && w.style.lineEnds?.end)) await capture(`artifacts/rotation-native-${audit.native.length}.png`);
    await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
    audit.native.push({ file: sample.file, sha256: sample.sha256, rotations: sample.rotations.length, workerImport: true, saveReopen: true, actualGeometry: true });
    expect(sha(await fs.readFile(sample.file))).toBe(sample.sha256);
  }
  expect(audit.native.reduce((n, item) => n + item.rotations, 0)).toBe(12);
  }
  await open(source); expect(await save('final.rea.json')).toEqual(authored); expect(sha(await fs.readFile(source))).toBe(audit.sourceSha256);
  expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]); expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(w => !w.isVisible()))).toBe(true);
  if (executablePath) expect(sha(await fs.readFile(path.join(path.dirname(executablePath), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  Object.assign(audit, { ok: true, sourceUnchanged: true, designUnchanged: true, hiddenWindows: true });
} catch (error) { audit.failure = error.stack ?? String(error); throw error; }
finally { try { if (app) await app.close(); } finally { audit.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(root, authoredOnly ? '.build/rotation-authored-desktop-audit.json' : '.build/rotation-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2)); } }
