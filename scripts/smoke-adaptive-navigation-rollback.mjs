import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
if (!process.argv[2]) throw new Error('Usage: node scripts/smoke-adaptive-navigation-rollback.mjs <packaged-executable.exe> [fixture-file-or-directory]');
const exe = path.resolve(process.argv[2]);
const fixturePath = path.resolve(process.argv[3] ?? path.join(root, '.build/adaptive-rollback-red-results'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-adaptive-navigation-rollback-'));
const auditPath = path.join(root, '.build/adaptive-navigation-rollback-desktop-audit.json');
const asarPath = path.join(path.dirname(exe), 'resources/app.asar');
await fs.mkdir(path.dirname(auditPath), { recursive: true }); await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
const audit = { ok: false, startedAt: new Date().toISOString(), executablePath: exe, fixtureInput: fixturePath, userData,
  appAsarSha256: null, source: null, checks: {}, expectedAlerts: [], errors: [], network: [], saves: [], screenshots: [],
  originalAxureGuiCompared: false, fixtureKind: 'legal author-created fixture from adaptive-navigation-rollback.spec.ts' };
const byId = (scope, id) => scope.locator(`[data-widget-id="${id}"]`);
const settle = page => page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });

async function candidates(input) {
  const stat = await fs.stat(input); if (stat.isFile()) return [input];
  const files = [];
  for (const entry of await fs.readdir(input, { withFileTypes: true })) {
    const file = path.join(input, entry.name);
    if (entry.isDirectory()) files.push(...await candidates(file));
    else if (entry.isFile() && entry.name === 'adaptive-rollback-source.rea.json') files.push(file);
  }
  return files.sort();
}
async function fixture() {
  for (const file of await candidates(fixturePath)) {
    const bytes = await fs.readFile(file), doc = JSON.parse(bytes);
    if (doc.name !== 'Adaptive navigation rollback') continue;
    // Require the saved legal expression fixture, not the first rejected literal.
    const failing = doc.pages.find(page => page.id === 'rollback-destination')?.interactions
      ?.flatMap(interaction => interaction.actions).find(action => action.type === 'setSelected');
    if (failing?.value !== '[[InvalidSelected]]' || doc.variables.InvalidSelected !== 'invalid') continue;
    audit.source = { file, sha256: sha(bytes), name: doc.name }; return { file, doc };
  }
  throw new Error(`No legal Adaptive navigation rollback source fixture found at ${fixturePath}`);
}

async function exercise(scope, player, mode, mobile, capture) {
  const target = id => byId(scope, id), status = target('rollback-status'), marker = target('rollback-marker');
  audit.activeStage = `${mode}-before-failure`;
  await expect(status).toHaveText('Page loads: 1 | Items: 1 | Actions: 0 | Armed: false');
  await target('rollback-arm').click();
  await expect(marker).toHaveCSS('left', '280px');
  await expect(status).toHaveText('Page loads: 1 | Items: 1 | Actions: 0 | Armed: true');
  await mobile();
  await expect(player.getByRole('alert')).toContainText('Invalid selected state');
  const expectedAlert = await player.getByRole('alert').textContent(); audit.expectedAlerts.push({ mode, message: expectedAlert });
  await expect(marker).toBeVisible(); await expect(target('rollback-invalid-selection')).toHaveCount(0);
  await expect(marker).toHaveCSS('left', '280px'); await expect(marker).toHaveCSS('width', '320px');
  await expect(marker).toHaveCSS('color', 'rgb(18, 52, 86)');
  await expect(status).toHaveText('Page loads: 1 | Items: 1 | Actions: 0 | Armed: true');
  await expect(target('rollback-destination-status')).toHaveText('Destination loads: 0');
  await capture('restored');
  audit.activeStage = `${mode}-unrelated-action`;
  await target('rollback-unrelated').click(); await expect(status).toContainText('Actions: 1'); await settle(player);
  const observed = { status: await status.textContent(), destination: await target('rollback-destination-status').textContent(),
    marker: await marker.evaluate(element => ({ left: getComputedStyle(element).left, width: getComputedStyle(element).width, color: getComputedStyle(element).color })) };
  // Keep the observed values even if this is accidentally run on an old candidate.
  audit.checks[mode] = { expectedAlert, afterUnrelated: observed, passed: false };
  await capture('after-unrelated');
  await expect(status).toHaveText('Page loads: 1 | Items: 1 | Actions: 1 | Armed: true');
  await expect(target('rollback-destination-status')).toHaveText('Destination loads: 0');
  await expect(marker).toHaveCSS('left', '280px'); await expect(marker).toHaveCSS('width', '320px');
  await expect(marker).toHaveCSS('color', 'rgb(18, 52, 86)');
  audit.checks[mode].passed = true;
}

let app;
try {
  const { file, doc } = await fixture();
  audit.appAsarSha256 = sha(await fs.readFile(asarPath));
  app = await electron.launch({ executablePath: exe, env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData } });
  const observed = new WeakSet(), observe = page => {
    if (observed.has(page)) return; observed.add(page);
    page.on('pageerror', error => audit.errors.push({ url: page.url(), message: error.message }));
  };
  app.on('window', observe); app.windows().forEach(observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page); await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]; window.setContentSize(2000, 1250); window.webContents.setBackgroundThrottling(false); return window.id;
  });
  const open = async source => {
    await app.evaluate(({ dialog }, source) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] }); }, source);
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText('Document opened'); await expect(page.locator('.titlebar')).toContainText(doc.name);
  };
  const saveDialog = file => app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file);
  const save = async stage => {
    const name = `adaptive-navigation-rollback-${stage}.rea.json`, output = path.join(userData, name);
    await saveDialog(output); await page.getByTitle('Save', { exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText(`Saved ${name}`);
    const bytes = await fs.readFile(output); expect(JSON.parse(bytes)).toEqual(doc);
    audit.saves.push({ stage, file: output, sha256: sha(bytes), unchangedDocument: true }); return output;
  };
  const capture = async (name, windowId = mainId, player = page) => {
    await settle(player); await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).webContents.invalidate(), windowId);
    const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) =>
      (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), windowId), 'base64');
    expect(bytes.length).toBeGreaterThan(1000); const file = `artifacts/adaptive-navigation-rollback-${name}.png`;
    await fs.writeFile(path.join(root, file), bytes); audit.screenshots.push({ file, sha256: sha(bytes) });
  };
  await open(file); const saved = await save('initial'); await open(saved); await save('reopened'); await capture('editor');
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay');
  try {
    await exercise(preview, page, 'preview', () => preview.getByTitle('Mobile', { exact: true }).click(), suffix => capture(`preview-${suffix}`));
  } finally { await page.getByRole('button', { name: 'Close preview', exact: true }).click(); }
  await save('after-preview');

  const exported = path.join(root, 'artifacts/adaptive-navigation-rollback-demo.html');
  await saveDialog(exported); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  await expect(page.locator('.statusbar')).toContainText('Exported');
  const bytes = await fs.readFile(exported); expect(bytes.length).toBeGreaterThan(1000); audit.exportedHtml = { file: exported, sha256: sha(bytes) };
  await app.context().setOffline(true); let offline;
  try {
    const pending = app.waitForEvent('window');
    const offlineId = await app.evaluate(({ BrowserWindow }) => {
      const window = new BrowserWindow({ show: false, width: 1200, height: 1000, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
      window.setContentSize(1200, 1000); void window.loadURL('about:blank'); return window.id;
    });
    offline = await pending; observe(offline);
    await app.evaluate(({ BrowserWindow }, { id, url }) => BrowserWindow.fromId(id).loadURL(url), { id: offlineId, url: pathToFileURL(exported).href });
    expect(offline.url().startsWith('file:')).toBe(true); expect(await offline.evaluate(() => window.innerWidth)).toBe(1200);
    // The exported page's navigation is separate from its viewport policy. Hide
    // only the sidebar to keep the narrow error/status screenshots more legible.
    await offline.getByRole('button', { name: 'Toggle pages', exact: true }).click();
    await exercise(offline.locator('main').first(), offline, 'offline', async () => {
      await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).setContentSize(390, 1000), offlineId);
      await expect.poll(() => offline.evaluate(() => window.innerWidth)).toBe(390);
    }, suffix => capture(`offline-${suffix}`, offlineId, offline));
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible()))).toBe(true);
  } finally {
    if (offline && !offline.isClosed()) await offline.close(); await app.context().setOffline(false);
  }
  await save('after-offline');
  expect(audit.expectedAlerts).toHaveLength(2); expect(audit.errors).toEqual([]); expect(audit.network).toEqual([]);
  expect(sha(await fs.readFile(file))).toBe(audit.source.sha256); expect(sha(await fs.readFile(asarPath))).toBe(audit.appAsarSha256);
  audit.checks.authorAndSourceUnchanged = true; audit.checks.hiddenWindows = true; audit.checks.packageUnchanged = true;
  delete audit.activeStage; audit.ok = true;
} catch (error) { audit.failure = error.stack ?? error.message; process.exitCode = 1; }
finally {
  if (app) try { await app.close(); } catch (error) { audit.errors.push({ stage: 'close', message: error.message }); audit.ok = false; process.exitCode = 1; }
  audit.finishedAt = new Date().toISOString(); await fs.writeFile(auditPath, JSON.stringify(audit, null, 2) + '\n');
  console.log(JSON.stringify(audit, null, 2));
}
