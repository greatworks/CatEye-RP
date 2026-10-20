import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Uses the browser suite's saved legal fixture, never imports/executes that suite.
const root = path.resolve(import.meta.dirname, '..');
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node scripts/smoke-adaptive-hierarchy.mjs <packaged-executable.exe> <fixture-file-or-directory>');
const exe = path.resolve(process.argv[2]), fixtureInput = path.resolve(process.argv[3]);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-adaptive-hierarchy-'));
const auditPath = path.join(root, '.build/adaptive-hierarchy-desktop-audit.json');
const asarPath = path.join(path.dirname(exe), 'resources/app.asar');
await fs.mkdir(path.dirname(auditPath), { recursive: true }); await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath: exe, fixtureInput, userData,
  appAsarSha256: null, source: null, checks: {}, saves: [], exports: [], screenshots: [], viewportResizes: [], errors: [], consoleErrors: [], failedRequests: [], network: [],
  originalAxureGuiCompared: false, fixtureKind: 'independent author-created fixture from adaptive-hierarchy.spec.ts' };
const byId = (scope, id) => scope.locator(`[data-widget-id="${id}"]`);
const settle = player => player.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });

async function candidates(input) {
  const stat = await fs.stat(input); if (stat.isFile()) return [input];
  const files = [];
  for (const entry of await fs.readdir(input, { withFileTypes: true })) {
    const file = path.join(input, entry.name);
    if (entry.isDirectory()) files.push(...await candidates(file));
    else if (entry.name === 'adaptive-hierarchy-source.rea.json') files.push(file);
  }
  return files.sort();
}
async function loadFixture() {
  for (const file of await candidates(fixtureInput)) {
    const bytes = await fs.readFile(file), doc = JSON.parse(bytes);
    if (doc.name !== 'Adaptive hierarchy runtime' || doc.pages[0]?.adaptiveSelection !== 'native-size') continue;
    expect(doc.pages[0].adaptiveBaseSize).toEqual({ width: 1200, height: 0 });
    audit.source = { file, sha256: sha(bytes), name: doc.name }; return { file, doc };
  }
  throw new Error(`No saved native-size hierarchy fixture found at ${fixtureInput}`);
}

async function exercise(scope, host) {
  const w = id => byId(scope, id), marker = w('hierarchy-marker');
  audit.activeStage = `${host.mode}-base-and-chain`;
  await expect(marker).toHaveCSS('width', '180px'); await expect(marker).toHaveCSS('left', '20px');
  await host.mobile(); await expect(marker).toHaveCSS('width', '220px'); await expect(marker).toHaveCSS('background-color', 'rgb(221, 238, 255)');
  await expect(w('hierarchy-hidden')).toBeHidden();
  await host.tablet(); await expect(marker).toHaveCSS('width', '280px'); await expect(marker).toHaveCSS('left', '24px'); await expect(marker).toHaveCSS('top', '150px');
  await expect(marker).toHaveCSS('color', 'rgb(19, 87, 155)'); await expect(marker).toHaveCSS('background-color', 'rgb(204, 238, 221)');
  await expect(w('hierarchy-events')).toHaveText('Events: 0');
  await host.click(w('hierarchy-mutate')); await expect(marker).toHaveCSS('width', '300px'); await expect(marker).toHaveCSS('opacity', '0.25');
  await expect(w('hierarchy-hidden')).toBeVisible(); await expect(w('hierarchy-events')).toHaveText('Events: 1');
  await host.same(); await expect(marker).toHaveCSS('width', '300px'); await expect(marker).toHaveCSS('opacity', '0.25');
  await host.base(); await expect(marker).toHaveCSS('width', '180px'); await expect(marker).toHaveCSS('left', '20px'); await expect(marker).toHaveCSS('color', 'rgb(18, 52, 86)');
  await expect(marker).toHaveText('Runtime hierarchy'); await expect(marker).toHaveCSS('opacity', '1');
  await host.tablet(); await expect(marker).toHaveCSS('width', '280px'); await expect(w('hierarchy-hidden')).toBeHidden(); await expect(w('hierarchy-events')).toHaveText('Events: 1');
  await host.capture('inherited');
  audit.checks[`${host.mode}-inheritance`] = { explicitDesktopBaseSize: [1200, 0], widths: [180, 220, 280], parentColorAndLeftInherited: true, childFillAndTopApplied: true,
    silentVisibilityRestoration: true, sameViewPreservesActions: true, differentViewClearsActions: true, runtimeTextPreserved: true };

  audit.activeStage = `${host.mode}-nested-height`;
  await host.click(w('hierarchy-frames'));
  const middle = scope.frameLocator('[data-inline-frame="hierarchy-outer-frame"]');
  const inner = middle.frameLocator('[data-inline-frame="hierarchy-inner-frame"]'), heightMarker = byId(inner, 'hierarchy-height-marker');
  await expect(heightMarker).toHaveCSS('width', '180px'); await expect(heightMarker).toHaveCSS('background-color', 'rgb(221, 0, 0)');
  expect(await inner.locator('body').evaluate(() => [innerWidth, innerHeight])).toEqual([390, 300]);
  await host.click(byId(middle, 'hierarchy-grow')); await expect(heightMarker).toHaveCSS('width', '260px'); await expect(heightMarker).toHaveCSS('background-color', 'rgb(0, 170, 0)');
  await expect(heightMarker).toHaveCSS('color', 'rgb(255, 255, 255)'); expect(await inner.locator('body').evaluate(() => [innerWidth, innerHeight])).toEqual([390, 600]);
  await host.capture('nested-tall');
  await host.click(byId(middle, 'hierarchy-shrink')); await expect(heightMarker).toHaveCSS('width', '180px');
  audit.checks[`${host.mode}-nestedHeight`] = { depth: 2, actualViewportSizes: [[390, 300], [390, 600], [390, 300]], selectedWidths: [180, 260, 180], inheritedColor: true };
}

let app;
try {
  const fixture = await loadFixture(); audit.appAsarSha256 = sha(await fs.readFile(asarPath));
  app = await electron.launch({ executablePath: exe, env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const seen = new WeakSet();
  const observe = page => { if (seen.has(page)) return; seen.add(page);
    page.on('pageerror', error => audit.errors.push({ url: page.url(), message: error.message }));
    page.on('console', message => { if (message.type() === 'error') audit.consoleErrors.push({ url: page.url(), text: message.text() }); });
    page.on('requestfailed', request => audit.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  };
  app.on('window', observe); app.windows().forEach(observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(2000, 1250); w.webContents.setBackgroundThrottling(false); return w.id; });
  const menu = async name => { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); };
  const open = async file => {
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file);
    await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened'); await expect(page.locator('.titlebar')).toContainText(fixture.doc.name);
  };
  const destination = file => app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file);
  const save = async suffix => {
    const name = `adaptive-hierarchy-${suffix}.rea.json`, file = path.join(userData, name); await destination(file); await page.getByTitle('Save', { exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText(`Saved ${name}`); const bytes = await fs.readFile(file); expect(JSON.parse(bytes)).toEqual(fixture.doc);
    audit.saves.push({ file, sha256: sha(bytes), unchangedDocument: true }); return file;
  };
  const capture = async (name, windowId = mainId, player = page) => {
    await settle(player); await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).webContents.invalidate(), windowId);
    const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), windowId), 'base64');
    expect(bytes.length).toBeGreaterThan(1000); const file = `artifacts/adaptive-hierarchy-${name}.png`; await fs.writeFile(path.join(root, file), bytes); audit.screenshots.push({ file, sha256: sha(bytes) });
  };
  const click = async (locator, windowId = mainId) => {
    await locator.scrollIntoViewIfNeeded();
    // Hidden Electron compositor/hit-test synchronization; retain real pointer click.
    await app.evaluate(async ({ BrowserWindow }, id) => { await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true }); }, windowId);
    await locator.click();
  };
  await open(fixture.file); await open(await save('initial')); await save('reopened');
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const scope = page.locator('.preview-overlay');
  try {
    await exercise(scope, { mode: 'preview', click: locator => click(locator),
      mobile: () => click(scope.getByTitle('Mobile', { exact: true })), tablet: () => click(scope.getByTitle('Tablet', { exact: true })), base: () => click(scope.getByTitle('Desktop', { exact: true })),
      same: () => app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).setContentSize(1900, 1200), mainId), capture: suffix => capture(`preview-${suffix}`) });
  } finally { await page.getByRole('button', { name: 'Close preview', exact: true }).click(); }
  await save('after-preview');
  const exported = path.join(root, 'artifacts/adaptive-hierarchy.html'); await destination(exported); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  await expect(page.locator('.statusbar')).toContainText('Exported'); const bytes = await fs.readFile(exported); audit.exports.push({ file: exported, sha256: sha(bytes) });
  await app.context().setOffline(true); let offline;
  try {
    const pending = app.waitForEvent('window');
    const offlineId = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ show: false, width: 1200, height: 1000,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); w.setContentSize(1200, 1000); void w.loadURL('about:blank'); return w.id; });
    offline = await pending; observe(offline);
    const load = () => app.evaluate(({ BrowserWindow }, { id, url }) => BrowserWindow.fromId(id).loadURL(url), { id: offlineId, url: pathToFileURL(exported).href });
    const resize = async (width, height = 1000) => {
      await app.evaluate(({ BrowserWindow }, { id, width, height }) => BrowserWindow.fromId(id).setContentSize(width, height), { id: offlineId, width, height });
      await expect.poll(() => offline.evaluate(() => [innerWidth, innerHeight])).toEqual([width, height]);
      const actual = await offline.evaluate(() => ({ width: innerWidth, height: innerHeight, devicePixelRatio }));
      const host = await app.evaluate(({ BrowserWindow, screen }, id) => { const win = BrowserWindow.fromId(id); return { contentSize: win.getContentSize(), scaleFactor: screen.getDisplayMatching(win.getBounds()).scaleFactor, zoomFactor: win.webContents.getZoomFactor() }; }, offlineId);
      const observed = { stage: audit.activeStage, requested: [width, height], actual: [actual.width, actual.height], devicePixelRatio: actual.devicePixelRatio, ...host };
      audit.viewportResizes.push(observed); return observed;
    };
    await load(); expect(offline.url().startsWith('file:')).toBe(true);
    await exercise(offline.locator('main').first(), { mode: 'offline', click: locator => click(locator, offlineId),
      mobile: () => resize(390), tablet: () => resize(768), base: () => resize(1200), same: () => resize(800, 950), capture: suffix => capture(`offline-${suffix}`, offlineId, offline) });
    audit.activeStage = 'offline-inclusive-height'; await resize(1200); await load();
    const rootScope = offline.locator('main').first(); await click(byId(rootScope, 'hierarchy-height'), offlineId); const marker = byId(rootScope, 'hierarchy-height-marker');
    // This Windows 150%-scale host rounds requested odd content dimensions up:
    // 499 -> 500 and 389 -> 390. Use measured reachable values on both sides,
    // retaining exact requested/actual checks. Browser tests still cover 499/500.
    const matrix = [[390, 498, 180], [390, 500, 260], [390, 300, 180], [388, 900, 160], [390, 900, 260]];
    audit.checks.offlineHeightMatrix = [];
    for (const [width, height, expected] of matrix) {
      const observed = await resize(width, height); await expect(marker).toHaveCSS('width', `${expected}px`);
      audit.checks.offlineHeightMatrix.push({ ...observed, expectedMarkerWidth: expected, actualMarkerWidth: await marker.evaluate(element => parseFloat(getComputedStyle(element).width)) });
    }
    audit.checks.windowsSizingBoundary = { desktopHeightValues: [498, 500], desktopWidthValues: [388, 390], exact499Claimed: false,
      evidence: 'research/adaptive-hierarchy-electron-sizing-probe.json', browserExactBoundary: 'tests/e2e/adaptive-hierarchy.spec.ts retains 499/500 and 389/390' };
    await capture('offline-height', offlineId, offline);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(w => !w.isVisible()))).toBe(true);
  } finally { if (offline && !offline.isClosed()) await offline.close(); await app.context().setOffline(false); }
  await save('after-offline'); expect(sha(await fs.readFile(fixture.file))).toBe(audit.source.sha256); expect(sha(await fs.readFile(asarPath))).toBe(audit.appAsarSha256);
  expect(audit.network).toEqual([]); expect(audit.errors).toEqual([]); expect(audit.consoleErrors).toEqual([]); expect(audit.failedRequests).toEqual([]);
  audit.checks.nativePickerSaveReopen = true; audit.checks.sourceAndPackageUnchanged = true; audit.checks.runtimeDoesNotMutateDesign = true; audit.checks.hiddenWindows = true;
  delete audit.activeStage; audit.ok = true;
} catch (error) { audit.failure = error.stack ?? error.message; process.exitCode = 1; }
finally {
  if (app) try { await app.close(); } catch (error) { audit.errors.push({ stage: 'close', message: error.message }); audit.ok = false; process.exitCode = 1; }
  audit.finishedAt = new Date().toISOString(); await fs.writeFile(auditPath, JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2));
}
