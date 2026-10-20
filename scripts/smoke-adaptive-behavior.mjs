import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { exerciseAdaptiveBehavior } from './adaptive-behavior-scenario.mjs';

const root = path.resolve(import.meta.dirname, '..');
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node scripts/smoke-adaptive-behavior.mjs <candidate.exe> <fixture-file-or-directory>');
const executablePath = path.resolve(process.argv[2]), fixtureInput = path.resolve(process.argv[3]);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-adaptive-behavior-'));
const auditPath = path.join(root, '.build/adaptive-behavior-desktop-audit.json'), asar = path.join(path.dirname(executablePath), 'resources/app.asar');
await fs.mkdir(path.dirname(auditPath), { recursive: true }); await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath, fixtureInput, userData,
  source: null, appAsarSha256: null, checks: {}, saves: [], exports: [], screenshots: [], viewportResizes: [],
  errors: [], consoleErrors: [], failedRequests: [], network: [], originalAxureGuiCompared: false,
  fixtureKind: 'independent authored fixture, validated and saved by adaptive-behavior-runtime.spec.ts' };

async function candidates(input) {
  if ((await fs.stat(input)).isFile()) return [input];
  const result = [];
  for (const entry of await fs.readdir(input, { withFileTypes: true })) {
    const item = path.join(input, entry.name);
    if (entry.isDirectory()) result.push(...await candidates(item));
    else if (entry.name === 'adaptive-behavior-source.rea.json') result.push(item);
  }
  return result.sort();
}
async function fixture() {
  for (const file of await candidates(fixtureInput)) {
    const bytes = await fs.readFile(file), doc = JSON.parse(bytes);
    if (doc.id !== 'ab-document' || doc.name !== 'Adaptive behavior runtime') continue;
    expect(doc.adaptiveViewSets[0]).toMatchObject({ id: 'ab-set', baseSize: { width: 1200, height: 0 } });
    expect(doc.pages.slice(0, 2).every(page => page.adaptiveViewSetId === 'ab-set' && page.adaptiveViews.length === 0)).toBe(true);
    audit.source = { path: file, sha256: sha(bytes) }; return { file, doc };
  }
  throw new Error('No saved adaptive behavior fixture was found');
}

let app;
try {
  const source = await fixture(); audit.appAsarSha256 = sha(await fs.readFile(asar));
  app = await electron.launch({ executablePath, env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observed = new WeakSet();
  const observe = page => {
    if (observed.has(page)) return; observed.add(page);
    page.on('pageerror', error => audit.errors.push({ url: page.url(), message: error.message }));
    page.on('console', message => { if (message.type() === 'error') audit.consoleErrors.push({ url: page.url(), text: message.text() }); });
    page.on('requestfailed', request => audit.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  };
  app.on('window', observe); app.windows().forEach(observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(2000, 1250); w.webContents.setBackgroundThrottling(false); return w.id; });
  const open = async file => {
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file);
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText('Document opened'); await expect(page.locator('.titlebar')).toContainText(source.doc.name);
  };
  const destination = file => app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file);
  const save = async suffix => {
    const name = `adaptive-behavior-${suffix}.rea.json`, file = path.join(userData, name); await destination(file); await page.getByTitle('Save', { exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText(`Saved ${name}`);
    const bytes = await fs.readFile(file); expect(JSON.parse(bytes)).toEqual(source.doc); audit.saves.push({ path: file, sha256: sha(bytes), unchangedDocument: true }); return file;
  };
  const syncPointer = async (locator, windowId) => {
    await locator.scrollIntoViewIfNeeded();
    // Hidden Electron compositing/hit-test sync. The following action is still
    // a real Playwright pointer action, never element.click()/dispatchEvent().
    await app.evaluate(async ({ BrowserWindow }, id) => { await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true }); }, windowId);
  };
  const click = async (locator, windowId) => { await syncPointer(locator, windowId); await locator.click(); };
  const hover = async (locator, windowId) => { await syncPointer(locator, windowId); await locator.hover(); };
  const capture = async (suffix, windowId, player) => {
    await player.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), windowId), 'base64');
    expect(bytes.length).toBeGreaterThan(1000);
    const file = path.join(root, `artifacts/adaptive-behavior-${suffix}.png`); await fs.writeFile(file, bytes); audit.screenshots.push({ path: file, sha256: sha(bytes) });
  };
  await open(source.file); await open(await save('initial')); await save('reopened');
  audit.activeStage = 'preview'; await page.getByTitle('Preview (F5)', { exact: true }).click(); const scope = page.locator('.preview-overlay');
  try {
    audit.checks.preview = await exerciseAdaptiveBehavior(scope, {
      selection: scope.getByRole('combobox', { name: 'Adaptive view', exact: true }),
      click: locator => click(locator, mainId), hover: locator => hover(locator, mainId),
      mobile: () => click(scope.getByTitle('Mobile', { exact: true }), mainId), capture: suffix => capture(`preview-${suffix}`, mainId, page),
    });
  } finally { await page.getByRole('button', { name: 'Close preview', exact: true }).click(); }
  await save('after-preview');
  const output = path.join(root, 'artifacts/adaptive-behavior.html'); await destination(output); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  await expect(page.locator('.statusbar')).toContainText('Exported'); audit.exports.push({ path: output, sha256: sha(await fs.readFile(output)) });
  await app.context().setOffline(true); let offline;
  try {
    const pending = app.waitForEvent('window');
    const id = await app.evaluate(({ BrowserWindow }) => { const w = new BrowserWindow({ show: false, width: 1200, height: 1000,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } }); w.setContentSize(1200, 1000); void w.loadURL('about:blank'); return w.id; });
    offline = await pending; observe(offline);
    await app.evaluate(({ BrowserWindow }, { id, url }) => BrowserWindow.fromId(id).loadURL(url), { id, url: pathToFileURL(output).href });
    expect(offline.url().startsWith('file:')).toBe(true); audit.activeStage = 'offline';
    audit.checks.offline = await exerciseAdaptiveBehavior(offline.locator('main').first(), {
      selection: offline.getByRole('combobox', { name: 'Adaptive view', exact: true }),
      click: locator => click(locator, id), hover: locator => hover(locator, id),
      mobile: async () => {
        await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).setContentSize(390, 1000), id);
        await expect.poll(() => offline.evaluate(() => [innerWidth, innerHeight])).toEqual([390, 1000]);
        audit.viewportResizes.push({ requested: [390, 1000], actual: await offline.evaluate(() => [innerWidth, innerHeight]) });
      }, capture: suffix => capture(`offline-${suffix}`, id, offline),
    });
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible()))).toBe(true);
  } finally { if (offline && !offline.isClosed()) await offline.close(); await app.context().setOffline(false); }
  await save('after-offline');
  expect(sha(await fs.readFile(source.file))).toBe(audit.source.sha256); expect(sha(await fs.readFile(asar))).toBe(audit.appAsarSha256);
  expect(audit.network).toEqual([]); expect(audit.errors).toEqual([]); expect(audit.consoleErrors).toEqual([]); expect(audit.failedRequests).toEqual([]);
  audit.checks.nativePickerSaveReopen = true; audit.checks.runtimeDoesNotMutateDesign = true; audit.checks.sourceAndPackageUnchanged = true; audit.checks.hiddenWindows = true;
  delete audit.activeStage; audit.ok = true;
} catch (error) { audit.failure = error.stack ?? String(error); process.exitCode = 1; }
finally {
  if (app) try { await app.close(); } catch (error) { audit.errors.push({ stage: 'close', message: String(error) }); audit.ok = false; process.exitCode = 1; }
  audit.finishedAt = new Date().toISOString(); await fs.writeFile(auditPath, JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2));
}
