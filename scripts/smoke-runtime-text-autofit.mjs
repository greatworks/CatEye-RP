import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
if (!process.argv[2]) throw new Error('Usage: node scripts/smoke-runtime-text-autofit.mjs <packaged-executable.exe>');
const exe = path.resolve(process.argv[2]), source = path.join(root, 'artifacts/runtime-text-autofit-demo.rea.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceBytes = await fs.readFile(source), doc = JSON.parse(sourceBytes);
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-runtime-text-autofit-'));
await fs.mkdir(path.join(root, '.build'), { recursive: true });
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath: exe, userData, sourceSha256: sha(sourceBytes), appAsarSha256: null,
  checks: {}, screenshots: [], saves: [], errors: [], network: [], originalAxureGuiCompared: false, fixtureKind: 'author-created deterministic project' };
const id = key => `runtime-autofit-${key}`;
const find = (scope, key) => scope.locator(`[data-widget-id="${id(key)}"]`);
const bounds = target => target.evaluate(element => { const s = element.style; return { x: parseFloat(s.left), y: parseFloat(s.top), width: parseFloat(s.width), height: parseFloat(s.height) }; });
const naturalLine = (scope, text, fontSize = 20, fontWeight = 400, lineHeight = 24) => scope.locator('[data-widget-id]').first().evaluate(async (element, value) => {
  const document = element.ownerDocument; await document.fonts.ready;
  const block = document.createElement('div'), span = document.createElement('span');
  Object.assign(block.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', fontFamily: 'Arial', fontSize: `${value.fontSize}px`, fontWeight: String(value.fontWeight), lineHeight: `${value.lineHeight}px`, padding: '0', border: '0' });
  span.textContent = value.text; block.append(span); document.body.append(block);
  // Independent inline-span oracle. No product/runtime measurement helper.
  const size = { width: span.offsetWidth, height: parseFloat(document.defaultView.getComputedStyle(block).height) }; block.remove(); return size;
}, { text, fontSize, fontWeight, lineHeight });

async function geometry(scope, stage, capture) {
  const owner = find(scope, 'rich'); await expect(owner).toBeVisible();
  expect(await bounds(owner)).toEqual({ x: 400, y: 220, width: 80, height: 60 });
  const expected = await naturalLine(scope, 'A much longer first-formatted line', 20, 700);
  await scope.getByRole('button', { name: 'Grow text', exact: true }).click();
  await expect.poll(() => bounds(owner)).toEqual({ x: 480 - expected.width, y: 280 - expected.height, ...expected });
  await expect(owner).toHaveCSS('transform', 'matrix(0.866025, 0.5, -0.5, 0.866025, 0, 0)');
  await expect(owner.locator('[data-rich-paragraph]')).toHaveCount(1); await expect(owner.locator('[data-rich-run]')).toHaveCount(1);
  await expect(owner.locator('[data-rich-run]')).toHaveCSS('font-weight', '700'); await expect(owner.locator('[data-rich-run]')).toHaveCSS('font-size', '20px');
  const resize = `${expected.width}|${expected.height}|400|220|${expected.width - 80}`, move = `${expected.width}|${expected.height}|${480 - expected.width}|${280 - expected.height}`;
  await expect(find(scope, 'resize-log')).toHaveText(resize); await expect(find(scope, 'move-log')).toHaveText(move);
  await capture();
  await scope.getByRole('button', { name: 'Raw text', exact: true }).click();
  const run = owner.locator('[data-rich-run]'); await expect(run.locator(':scope > br')).toHaveCount(3);
  expect(await run.evaluate(element => [...element.childNodes].map(node => [node.nodeName, node.textContent]))).toEqual([
    ['SPAN', '  <b>A\rB\u2028C'], ['BR', ''], ['BR', ''], ['SPAN', 'D'], ['BR', ''],
  ]); await expect(owner.locator('b')).toHaveCount(0);
  await scope.getByRole('button', { name: 'Empty text', exact: true }).click();
  await expect(owner.locator('.widget-text')).toHaveCSS('display', 'none'); await expect(run.locator('br')).toHaveCount(0);
  await expect.poll(() => bounds(owner)).toEqual({ x: 480, y: 280, width: 0, height: 0 });
  await scope.getByRole('button', { name: 'Grow text', exact: true }).click(); await expect(owner.locator('.widget-text')).toHaveCSS('display', 'block');
  audit.checks[stage] = { initialOwnerUnchanged: true, independentDomMeasurement: expected, firstRichRunPreserved: true, rawWhitespaceAndMarkup: true, resizeBeforeMove: { resize, move }, emptyLayerAndZeroCss: true, rotationPreserved: true };
}

async function hiddenAndRows(scope, stage) {
  const expected = await naturalLine(scope, 'Measured while hidden');
  await scope.getByRole('button', { name: 'Set hidden text', exact: true }).click(); await expect(find(scope, 'hidden')).toBeHidden();
  await scope.getByRole('button', { name: 'Show hidden shape', exact: true }).click(); await expect(find(scope, 'hidden')).toBeVisible();
  expect(await bounds(find(scope, 'hidden'))).toEqual({ x: 40, y: 180, ...expected });
  const child = find(scope, 'hidden-child'), disabledExpected = await naturalLine(scope, 'Measured while hidden', 30, 400, 30);
  await expect(child).toHaveCSS('font-size', '30px'); expect(await bounds(child)).toEqual({ x: 10, y: 10, ...disabledExpected });
  const rows = scope.locator(`[data-widget-id="${id('rows')}"] > .repeater-row`); await expect(rows).toHaveCount(2);
  const first = find(rows.nth(0), 'row-shape'), second = find(rows.nth(1), 'row-shape'), before = await bounds(first);
  await rows.nth(1).getByRole('button', { name: 'Change row text', exact: true }).click();
  await expect(second.locator('[data-rich-run] br')).toHaveCount(3); await expect(second).toHaveCSS('height', '96px');
  expect(await bounds(first)).toEqual(before); await expect(first).toHaveText('Initial');
  await expect(rows.nth(1)).toHaveCSS('height', '106px'); await expect(rows.nth(0)).toHaveCSS('height', '80px');
  await expect(scope.locator('[data-shape-text-measure]')).toHaveCount(0);
  audit.checks[stage] = { hiddenMeasurement: expected, hiddenDisabledPanelMeasurement: disabledExpected, rowInstanceIsolation: true, rowFit: [80,106], temporaryMeasureNodesRemoved: true };
}

async function adaptive(scope, stage, mobile, desktop) {
  const target = find(scope, 'registered'), untouched = find(scope, 'untouched');
  await expect(target).toHaveCSS('height', '80px'); await expect(untouched).toHaveCSS('height', '80px');
  await scope.getByRole('button', { name: 'Register text', exact: true }).click();
  const before = (await bounds(target)).height;
  expect(before).toBe(await target.locator('.widget-text').evaluate(element => parseFloat(getComputedStyle(element).height)));
  await mobile(); await expect(target.locator('[data-rich-run]')).toHaveCSS('font-size', '30px');
  await expect.poll(async () => (await bounds(target)).height).toBeGreaterThan(before);
  const after = (await bounds(target)).height;
  expect(after).toBe(await target.locator('.widget-text').evaluate(element => parseFloat(getComputedStyle(element).height)));
  await expect(untouched).toHaveCSS('height', '80px'); await expect(untouched.locator('.widget-text')).toHaveCSS('font-size', '30px');
  await desktop(); await expect(target.locator('[data-rich-run]')).toHaveCSS('font-size', '20px');
  await expect.poll(async () => (await bounds(target)).height).toBe(before);
  audit.checks[stage] = { desktopHeight: before, mobileHeight: after, registeredOnly: true, desktopRestored: true };
}

let app;
try {
  audit.appAsarSha256 = sha(await fs.readFile(path.join(path.dirname(exe), 'resources/app.asar')));
  app = await electron.launch({ executablePath: exe, env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observed = new WeakSet(), observe = page => { if (!observed.has(page)) { observed.add(page); page.on('pageerror', error => audit.errors.push(error.message)); } };
  app.on('window', observe); app.windows().forEach(observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.setContentSize(2000, 1250); window.webContents.setBackgroundThrottling(false); return window.id; });
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const open = async file => {
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file);
    await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened'); await expect(page.locator('.titlebar')).toContainText(doc.name);
  };
  const save = async name => {
    const file = path.join(userData, name); await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file);
    await page.getByTitle('Save', { exact: true }).click(); await expect(page.locator('.statusbar')).toContainText(`Saved ${name}`);
    const bytes = await fs.readFile(file); expect(JSON.parse(bytes)).toEqual(doc); audit.saves.push({ file, sha256: sha(bytes), unchangedDocument: true }); return file;
  };
  const capture = async (name, windowId = mainId, player = page) => {
    await player.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).webContents.invalidate(), windowId);
    const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), windowId), 'base64');
    expect(bytes.length).toBeGreaterThan(1000); const file = `artifacts/runtime-text-autofit-${name}.png`; await fs.writeFile(path.join(root, file), bytes); audit.screenshots.push({ file, sha256: sha(bytes) });
  };
  await open(source); const saved = await save('initial.rea.json'); await open(saved); await save('reopened.rea.json');
  audit.checks.nativeOpenSaveReopen = true;
  await capture('editor');
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay');
  await geometry(preview, 'previewGeometry', () => capture('preview'));
  await preview.locator(`[data-page-id="${id('hidden-page')}"]`).click(); await hiddenAndRows(preview, 'previewHiddenRows'); await capture('preview-hidden');
  await preview.locator(`[data-page-id="${id('adaptive-page')}"]`).click();
  await adaptive(preview, 'previewAdaptive', () => preview.getByTitle('Mobile', { exact: true }).click(), () => preview.getByTitle('Desktop', { exact: true }).click()); await capture('preview-adaptive');
  await preview.locator(`[data-page-id="${id('frame-page')}"]`).click();
  await geometry(page.frameLocator(`iframe[data-inline-frame="${id('frame')}"]`), 'previewFrameGeometry', () => capture('preview-frame'));
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); await save('after-preview.rea.json');

  const exported = path.join(root, 'artifacts/runtime-text-autofit-demo.html');
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, exported);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  const exportedBytes = await fs.readFile(exported); expect(exportedBytes.length).toBeGreaterThan(1000); audit.exportedHtml = { file: exported, sha256: sha(exportedBytes) };
  await app.context().setOffline(true); const pending = app.waitForEvent('window');
  const offlineId = await app.evaluate(({ BrowserWindow }) => { const window = new BrowserWindow({ show: false, width: 2000, height: 1250, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); window.setContentSize(2000, 1250); void window.loadURL('about:blank'); return window.id; });
  const offline = await pending; observe(offline);
  try {
    await app.evaluate(({ BrowserWindow }, { id, url }) => BrowserWindow.fromId(id).loadURL(url), { id: offlineId, url: pathToFileURL(exported).href });
    expect(offline.url().startsWith('file:')).toBe(true);
    await geometry(offline, 'offlineGeometry', () => capture('offline', offlineId, offline));
    await offline.locator('nav').getByRole('button', { name: 'Hidden and rows', exact: true }).click(); await hiddenAndRows(offline, 'offlineHiddenRows'); await capture('offline-hidden', offlineId, offline);
    await offline.locator('nav').getByRole('button', { name: 'Adaptive registration', exact: true }).click();
    const size = width => app.evaluate(({ BrowserWindow }, { id, width }) => BrowserWindow.fromId(id).setContentSize(width, 1250), { id: offlineId, width });
    await adaptive(offline, 'offlineAdaptive', () => size(390), () => size(2000)); await capture('offline-adaptive', offlineId, offline);
    await offline.locator('nav').getByRole('button', { name: 'Embedded runtime', exact: true }).click();
    await geometry(offline.frameLocator(`iframe[data-inline-frame="${id('frame')}"]`), 'offlineFrameGeometry', () => capture('offline-frame', offlineId, offline));
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible()))).toBe(true);
    audit.checks.offlineFileRootAndFrame = true; audit.checks.hiddenWindows = true;
  } finally { await offline.close(); await app.context().setOffline(false); }
  await save('after-export.rea.json');
  expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(sha(await fs.readFile(source))).toBe(audit.sourceSha256);
  expect(sha(await fs.readFile(path.join(path.dirname(exe), 'resources/app.asar')))).toBe(audit.appAsarSha256);
  audit.checks.authorAndSourceUnchanged = true; audit.ok = true;
} catch (error) { audit.failure = error.stack ?? error.message; process.exitCode = 1; }
finally {
  if (app) await app.close(); audit.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(root, '.build/runtime-text-autofit-desktop-audit.json'), JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2));
}
