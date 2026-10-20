import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Packaged-app smoke only. Fixtures come from the independently run browser suite;
// this file neither imports that suite nor generates/replaces its source documents.
const root = path.resolve(import.meta.dirname, '..');
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node scripts/smoke-adaptive-transition.mjs <packaged-executable.exe> <fixture-directory>');
const exe = path.resolve(process.argv[2]), fixtureDir = path.resolve(process.argv[3]);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const auditPath = path.join(root, '.build/adaptive-transition-desktop-audit.json');
const asarPath = path.join(path.dirname(exe), 'resources/app.asar');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-adaptive-transition-'));
await fs.mkdir(path.dirname(auditPath), { recursive: true });
await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath: exe, fixtureDirectory: fixtureDir, userData,
  appAsarSha256: null, fixtures: [], checks: {}, screenshots: [], saves: [], exports: [], errors: [], network: [],
  originalAxureGuiCompared: false, fixtureKind: 'author-created projects from adaptive-transition.spec.ts' };
const byId = (scope, id) => scope.locator(`[data-widget-id="${id}"]`);
const settle = player => player.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });

async function discover(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await discover(file));
    else if (entry.isFile() && entry.name === 'source.rea.json') files.push(file);
  }
  return files.sort();
}

async function fixtures() {
  const candidates = new Map(['declarations', 'loads', 'frames', 'rows'].map(key => [key, []]));
  for (const file of await discover(fixtureDir)) {
    const bytes = await fs.readFile(file), doc = JSON.parse(bytes);
    let key;
    if (doc.name === 'Adaptive declaration transition') key = 'declarations';
    else if (doc.name === 'Adaptive repeater persistence') key = 'rows';
    else if (doc.name === 'Adaptive load-time reads') key = doc.pages?.[0]?.widgets?.some(widget => widget.id === 'adaptive-outer-frame') ? 'frames' : 'loads';
    if (key) candidates.get(key).push({ key, file, doc, sha256: sha(bytes) });
  }
  return [...candidates].map(([key, matches]) => {
    if (!matches.length) throw new Error(`No ${key} source.rea.json fixture found in ${fixtureDir}`);
    const selected = matches[0];
    audit.fixtures.push({ kind: key, file: selected.file, sha256: selected.sha256, name: selected.doc.name,
      matchingCandidates: matches.map(match => ({ file: match.file, sha256: match.sha256 })) });
    return selected;
  });
}

async function declarations(scope, host, stage) {
  const w = id => byId(scope, id), rich = w('adaptive-rich');
  await w('adaptive-mutate').click();
  await expect(rich).toHaveCSS('left', '280px'); await expect(rich).toHaveCSS('width', '380px');
  await expect(rich.locator('[data-rich-run]')).toHaveCSS('font-size', '28px');
  await expect(w('adaptive-events')).toHaveText('Events: 2');
  await host.sameView(); await settle(host.player);
  await expect(rich).toHaveCSS('width', '380px'); await expect(rich).toHaveCSS('opacity', '0.25');
  await expect(w('adaptive-events')).toHaveText('Events: 2');
  await host.mobile();
  await expect(rich).toHaveCSS('left', '20px'); await expect(rich).toHaveCSS('width', '200px'); await expect(rich).toHaveCSS('height', '90px');
  await expect(rich).toHaveText('Runtime content'); await expect(rich).toHaveCSS('opacity', '0.8');
  await expect(rich.locator('[data-rich-run]')).toHaveCSS('font-size', '18px');
  await expect(rich.locator('[data-rich-run]')).toHaveCSS('color', 'rgb(17, 34, 51)');
  await expect(w('adaptive-visible')).toBeVisible(); await expect(w('adaptive-hidden')).toBeHidden();
  await expect(w('adaptive-events')).toHaveText('Events: 2');
  await expect(w('adaptive-input')).toHaveCSS('left', '10px'); await expect(w('adaptive-input')).toHaveCSS('width', '250px');
  await expect(w('adaptive-input').locator('input')).toBeDisabled(); await expect(w('adaptive-input').locator('input')).toHaveValue('Retained input');
  await expect(w('adaptive-selected')).toHaveCSS('background-color', 'rgb(0, 170, 0)');
  await expect(w('adaptive-error')).toHaveCSS('border-top-color', 'rgb(255, 0, 0)');
  await host.capture('phone');
  await host.desktop();
  await expect(rich).toHaveCSS('left', '80px'); await expect(rich).toHaveCSS('width', '240px'); await expect(rich).toHaveCSS('opacity', '1');
  await expect(rich.locator('[data-rich-run]')).toHaveCSS('font-size', '20px');
  await expect(rich.locator('[data-rich-run]')).toHaveCSS('color', 'rgb(18, 52, 86)');
  await expect(rich).toHaveText('Runtime content'); await expect(w('adaptive-events')).toHaveText('Events: 2');
  await host.capture('base');
  audit.checks[stage] = { sameViewKeepsGeometryAndAppliedStyle: true, changedViewRestoresDeclarations: true,
    richTextFormattingRestored: true, visibilityRestoredSilently: true, events: 2, textAndControlStatesPreserved: true, baseRestored: true };
}

async function loadReads(scope, host, stage, nested) {
  const target = nested ? scope.frameLocator('[data-inline-frame="adaptive-outer-frame"]').frameLocator('[data-inline-frame="adaptive-inner-frame"]') : scope;
  await expect(byId(target, 'first-log')).toHaveText('Hidden width: 211');
  await expect(byId(target, 'first-inactive-log')).toHaveText('Inactive width: 212');
  let frameWidth;
  if (nested) { frameWidth = await target.locator('body').evaluate(() => window.innerWidth); expect(frameWidth).toBe(360); }
  await host.capture('initial');
  // Desktop Preview follows the first page's width. Pin the device before
  // navigation so the wider destination still selects its <=500 declaration.
  if (!nested && host.mode === 'preview') await host.mobile();
  await byId(target, 'adaptive-go').click();
  await expect(byId(target, 'next-log')).toHaveText('Hidden width: 277');
  await expect(byId(target, 'next-inactive-log')).toHaveText('Inactive width: 278');
  if (nested) expect(await target.locator('body').evaluate(() => window.innerWidth)).toBe(360);
  await host.capture('destination');
  audit.checks[stage] = { hiddenLoadedInitial: 211, inactiveLoadedInitial: 212,
    hiddenLoadedAfterNavigation: 277, inactiveLoadedAfterNavigation: 278, ...(nested ? { nestingDepth: 2, innerViewportWidth: frameWidth } : {}) };
}

async function rows(scope, host, stage) {
  const w = id => byId(scope, id);
  await expect(w('row-loads')).toHaveText('Loads: 2'); await w('row-mutate').nth(0).click();
  await expect(w('row-selected').nth(0)).toHaveText('Temporary row text');
  await expect(w('row-disabled').nth(0).locator('input')).toBeDisabled();
  await host.mobile();
  await expect(w('row-loads')).toHaveText('Loads: 4'); await expect(w('row-selected')).toHaveText(['Alpha', 'Beta']);
  await expect(w('row-selected').nth(0)).toHaveCSS('width', '180px');
  await expect(w('row-selected').nth(0)).toHaveCSS('background-color', 'rgb(0, 170, 0)');
  await expect(w('row-selected').nth(1)).not.toHaveCSS('background-color', 'rgb(0, 170, 0)');
  await expect(w('row-error').nth(0)).toHaveCSS('border-top-color', 'rgb(255, 0, 0)');
  await expect(w('row-disabled').nth(0).locator('input')).toBeDisabled();
  await expect(w('row-disabled').nth(1).locator('input')).toBeEnabled();
  await host.capture('preserved');
  await w('row-sort').click();
  await expect(w('row-loads')).toHaveText('Loads: 6'); await expect(w('row-selected')).toHaveText(['Beta', 'Alpha']);
  await expect(w('row-selected').nth(1)).not.toHaveCSS('background-color', 'rgb(0, 170, 0)');
  await expect(w('row-error').nth(1)).not.toHaveCSS('border-top-color', 'rgb(255, 0, 0)');
  await expect(w('row-disabled').nth(1).locator('input')).toBeEnabled();
  await host.capture('sorted');
  audit.checks[stage] = { loads: [2, 4, 6], adaptiveRebuildPreservesRowStates: true,
    rowTextReset: true, rowInstancesIsolated: true, ordinarySortResetsRowStates: true, sortedNames: ['Beta', 'Alpha'] };
}

async function exercise(fixture, scope, host) {
  const stage = `${fixture.key}-${host.mode}`;
  audit.activeStage = stage;
  if (fixture.key === 'declarations') await declarations(scope, host, stage);
  else if (fixture.key === 'rows') await rows(scope, host, stage);
  else await loadReads(scope, host, stage, fixture.key === 'frames');
}

let app;
try {
  const selected = await fixtures();
  audit.appAsarSha256 = sha(await fs.readFile(asarPath));
  app = await electron.launch({ executablePath: exe, env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observed = new WeakSet();
  const observe = page => { if (!observed.has(page)) { observed.add(page); page.on('pageerror', error => audit.errors.push({ url: page.url(), message: error.message })); } };
  app.on('window', observe); app.windows().forEach(observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]; window.setContentSize(2000, 1250); window.webContents.setBackgroundThrottling(false); return window.id;
  });
  const menu = async name => {
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click();
  };
  const open = async (file, doc) => {
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file);
    await menu('Open… Ctrl+O'); await expect(page.locator('.statusbar')).toContainText('Document opened');
    await expect(page.locator('.titlebar')).toContainText(doc.name);
  };
  const setSaveFile = file => app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file);
  const save = async (fixture, suffix) => {
    const name = `adaptive-transition-${fixture.key}-${suffix}.rea.json`, file = path.join(userData, name);
    await setSaveFile(file); await page.getByTitle('Save', { exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText(`Saved ${name}`);
    const bytes = await fs.readFile(file); expect(JSON.parse(bytes)).toEqual(fixture.doc);
    audit.saves.push({ fixture: fixture.key, stage: suffix, file, sha256: sha(bytes), unchangedDocument: true }); return file;
  };
  const capture = async (name, windowId = mainId, player = page) => {
    await settle(player);
    await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).webContents.invalidate(), windowId);
    const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) =>
      (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), windowId), 'base64');
    expect(bytes.length).toBeGreaterThan(1000);
    const file = `artifacts/adaptive-transition-${name}.png`; await fs.writeFile(path.join(root, file), bytes);
    audit.screenshots.push({ file, sha256: sha(bytes) });
  };

  for (const fixture of selected) {
    audit.activeStage = `${fixture.key}-native-open`;
    await open(fixture.file, fixture.doc);
    const saved = await save(fixture, 'initial'); await open(saved, fixture.doc); await save(fixture, 'reopened');
    await capture(`${fixture.key}-editor`);
    await page.getByTitle('Preview (F5)', { exact: true }).click();
    const scope = page.locator('.preview-overlay');
    try {
      await exercise(fixture, scope, { mode: 'preview', player: page,
        sameView: () => scope.getByTitle('Tablet', { exact: true }).click(),
        mobile: () => scope.getByTitle('Mobile', { exact: true }).click(),
        desktop: () => scope.getByTitle('Desktop', { exact: true }).click(),
        capture: suffix => capture(`${fixture.key}-preview-${suffix}`) });
    } finally { await page.getByRole('button', { name: 'Close preview', exact: true }).click(); }
    await save(fixture, 'after-preview');

    audit.activeStage = `${fixture.key}-export`;
    const exported = path.join(root, `artifacts/adaptive-transition-${fixture.key}.html`);
    await setSaveFile(exported); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText('Exported');
    const bytes = await fs.readFile(exported); expect(bytes.length).toBeGreaterThan(1000);
    audit.exports.push({ fixture: fixture.key, file: exported, sha256: sha(bytes) });
    await app.context().setOffline(true);
    let offline;
    try {
      const width = fixture.key === 'loads' ? 390 : 1200, pending = app.waitForEvent('window');
      const offlineId = await app.evaluate(({ BrowserWindow }, width) => {
        const window = new BrowserWindow({ show: false, width, height: 1000, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
        window.setContentSize(width, 1000); void window.loadURL('about:blank'); return window.id;
      }, width);
      offline = await pending; observe(offline);
      await app.evaluate(({ BrowserWindow }, { id, url }) => BrowserWindow.fromId(id).loadURL(url), { id: offlineId, url: pathToFileURL(exported).href });
      expect(offline.url().startsWith('file:')).toBe(true);
      expect(await offline.evaluate(() => window.innerWidth)).toBe(width);
      const resize = async width => {
        await app.evaluate(({ BrowserWindow }, { id, width }) => BrowserWindow.fromId(id).setContentSize(width, 1000), { id: offlineId, width });
        await expect.poll(() => offline.evaluate(() => window.innerWidth)).toBe(width);
      };
      await exercise(fixture, offline.locator('main').first(), { mode: 'offline', player: offline,
        sameView: () => resize(1100), mobile: () => resize(390), desktop: () => resize(1200),
        capture: suffix => capture(`${fixture.key}-offline-${suffix}`, offlineId, offline) });
      expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible()))).toBe(true);
    } finally {
      if (offline && !offline.isClosed()) await offline.close();
      await app.context().setOffline(false);
    }
    await save(fixture, 'after-offline');
    expect(sha(await fs.readFile(fixture.file))).toBe(fixture.sha256);
    audit.checks[`${fixture.key}-nativeRoundTrip`] = { openSaveReopen: true, authorDocumentUnchangedAfterBothPlayers: true, sourceBytesUnchanged: true };
  }
  expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(sha(await fs.readFile(asarPath))).toBe(audit.appAsarSha256);
  audit.checks.hiddenWindows = true; audit.checks.offlineFilePlayers = 4; audit.checks.packageUnchanged = true;
  delete audit.activeStage; audit.ok = true;
} catch (error) {
  audit.failure = error.stack ?? error.message; process.exitCode = 1;
} finally {
  if (app) try { await app.close(); } catch (error) {
    audit.errors.push({ stage: 'close', message: error.message }); audit.ok = false; process.exitCode = 1;
  }
  audit.finishedAt = new Date().toISOString();
  await fs.writeFile(auditPath, JSON.stringify(audit, null, 2) + '\n');
  console.log(JSON.stringify(audit, null, 2));
}
