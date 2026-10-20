import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

// Actual candidate IPC -> isolated native reader worker -> model -> save/reopen.
// Native picker responses are controlled; original Axure code is never executed.
const root = path.resolve(import.meta.dirname, '..');
if (!process.argv[2] || !/^[a-f0-9]{64}$/.test(process.argv[3] ?? '')) {
  throw Error('Usage: node scripts/smoke-native-layers-native-import.mjs <candidate.exe> <frozen-audit-sha256>');
}
const executablePath = path.resolve(process.argv[2]);
const evidenceFile = path.join(root, 'research/native-layers-format-import-audit.json');
const evidenceSha256 = process.argv[3];
const auditFile = path.join(root, '.build/native-layers-native-import-desktop-audit.json');
const artifactRoot = path.join(root, 'artifacts');
const asarFile = path.join(path.dirname(executablePath), 'resources/app.asar');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = async file => hash(await fs.readFile(file));
const specs = [
  { key: 'form', filename: 'Sample form patterns.rplib', sha256: '1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179', layers: 129, cases: 10 },
  { key: 'ui', filename: 'Sample UI patterns.rplib', sha256: 'cf1787fded7a74278209f9aee4b07a266a10360f2e0dd552c49cca158f65e36b', layers: 40, cases: 0 },
  { key: 'starter', filename: 'Prototype Starter.rp', sha256: '6a961a496fb35d3c51be967c6bc0342aaef334ac4e4b58a31774f131dd3dc714', layers: 12, cases: 3 },
  { key: 'basics', filename: 'Prototyping Basics.rp', sha256: '26b9f0cc5937eb29791a9085d8364c54a50e228a1c8685241726c19e33ff73b7', layers: 1, cases: 0 },
];
const audit = {
  ok: false, startedAt: new Date().toISOString(), executablePath,
  evidence: { file: evidenceFile, sha256: evidenceSha256 },
  checks: {}, samples: [], saves: [], screenshots: [], errors: [], consoleErrors: [], failedRequests: [], network: [],
  nativePickerResponsesMocked: true, originalAxureGuiCompared: false, originalDllExecuted: false,
  boundary: 'Four native samples exercise the packaged parser, full model equality, recursive Layer identities, preserved prior actions, and exact save/reopen. Original GUI/pixels and native writeback are outside this check.',
};
function widgetsIn(value, result = []) {
  if (!value || typeof value !== 'object') return result;
  if (value.id && value.type && value.style && Array.isArray(value.interactions)) result.push(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') widgetsIn(child, result);
  return result;
}
let app;
const pins = [];
try {
  await fs.mkdir(artifactRoot, { recursive: true });
  assert.equal(await sha(evidenceFile), evidenceSha256, 'Frozen native oracle changed');
  const evidence = JSON.parse(await fs.readFile(evidenceFile, 'utf8'));
  assert.deepEqual(evidence.totals, { samples: 11, admitted: 10, layers: 182, lost: 0, unexpectedAdded: 0, changed: 0, addedEvents: 13, maxCompactBytes: 28926107 });
  audit.appAsarSha256 = await sha(asarFile);
  audit.executableSha256 = await sha(executablePath);
  audit.userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-native-layers-import-'));
  app = await electron.launch({ executablePath, env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: audit.userData } });
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
    const window = BrowserWindow.getAllWindows()[0];
    window.setContentSize(1500, 1000); window.webContents.setBackgroundThrottling(false); return window.id;
  });
  const menu = async name => {
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click();
  };
  const openPicker = file => app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file);
  const save = async name => {
    const file = path.join(audit.userData, name);
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, file);
    await page.getByTitle('Save', { exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText(`Saved ${name}`);
    const bytes = await fs.readFile(file); audit.saves.push({ file, sha256: hash(bytes) });
    return { file, document: JSON.parse(bytes) };
  };
  for (const spec of specs) {
    audit.activeStage = `native-import-${spec.key}`;
    const matches = evidence.samples.filter(sample => path.basename(sample.file) === spec.filename && sample.sha256 === spec.sha256);
    assert.equal(matches.length, 1);
    const sample = matches[0];
    assert.equal(sample.priorDocumentExactAfterRemovingNewLayers, true);
    assert.equal(sample.addedLayers.length, spec.layers);
    assert.equal(sample.addedEvents.length, spec.cases);
    assert.equal(await sha(sample.file), spec.sha256); pins.push({ file: sample.file, sha256: spec.sha256 });
    await openPicker(sample.file); await menu('Import Axure .rp (experimental)…');
    const report = page.getByRole('dialog', { name: 'RP import report', exact: true });
    await expect(report).toContainText(spec.sha256, { timeout: 120000 });
    const counts = Object.fromEntries(Object.entries(sample.report).filter(([, value]) => typeof value === 'number'));
    await expect(report).toContainText(`${counts.pagesImported} page(s), ${counts.widgetsImported} recovered widget(s), ${counts.widgetsSkipped} skipped item(s).`);
    await expect(report).toContainText(`${counts.eventsImported} recovered event(s), ${counts.eventsSkipped} skipped event(s), ${counts.casesImported} case(s), ${counts.actionsImported} action(s).`);
    await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).webContents.invalidate(), mainId);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), mainId), 'base64');
    assert.ok(bytes.length > 1000);
    const image = path.join(artifactRoot, `native-layers-native-import-${spec.key}.png`);
    await fs.writeFile(image, bytes); audit.screenshots.push({ path: image, sha256: hash(bytes) });
    await report.getByRole('button', { name: 'Close report', exact: true }).click();
    const saved = await save(`native-layers-${spec.key}.rea.json`);
    assert.equal(saved.document.name, spec.filename.replace(/\.rp$/i, ''));
    assert.deepEqual({ ...saved.document, name: sample.document.name }, sample.document, 'Packaged import must match the full frozen source result');
    const widgets = widgetsIn(saved.document), layers = widgets.filter(widget => widget.type === 'layer');
    assert.equal(layers.length, spec.layers);
    assert.equal(new Set(widgets.map(widget => widget.id)).size, widgets.length, 'A member cannot remain duplicated at its old root');
    assert.equal(layers.reduce((sum, widget) => sum + widget.interactions.length, 0), spec.cases);
    const layerCases = layers.flatMap(widget => widget.interactions.map(interaction => ({ ownerId: widget.id, interaction })));
    for (const layer of layers) assert.ok(Array.isArray(layer.layer?.widgets));
    // Full-document equality above also covers all previous Move/Rotate cases.
    const preservedMotion = Object.fromEntries(['move', 'rotate'].map(type => [type, widgets.reduce((sum, widget) => sum + widget.interactions.flatMap(item => item.actions).filter(action => action.type === type).length, 0)]));
    await openPicker(saved.file); await menu('Open… Ctrl+O');
    await expect(page.locator('.statusbar')).toContainText('Document opened');
    assert.deepEqual((await save(`native-layers-${spec.key}-reopened.rea.json`)).document, saved.document);
    assert.equal(await sha(sample.file), spec.sha256);
    audit.samples.push({ file: sample.file, sha256: spec.sha256, counts, layers: layers.length, layerCases, preservedMotion, fullDocumentMatchedExceptFilenameTitle: true, priorDocumentPreservedByFrozenOracle: true, uniqueOwnership: true, saveReopenExact: true, sourceUnchanged: true });
  }
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible())), true);
  assert.equal(await sha(asarFile), audit.appAsarSha256);
  assert.equal(await sha(evidenceFile), evidenceSha256);
  audit.checks = { nativeFiles: 4, recoveredLayers: 182, recoveredLayerCases: 13, fullDocumentsMatched: true, uniqueOwnership: true, previousMotionPreserved: true, saveReopenExact: true, allWindowsHidden: true, originalFilesUnchanged: true };
  delete audit.activeStage; audit.ok = true;
} catch (error) { audit.failure = error.stack ?? String(error); process.exitCode = 1; }
finally {
  if (app) try { await app.close(); } catch (error) { audit.errors.push(String(error)); audit.ok = false; process.exitCode = 1; }
  for (const pin of pins) try { assert.equal(await sha(pin.file), pin.sha256); } catch (error) { audit.errors.push(`Source integrity: ${error.message}`); }
  for (const key of ['errors', 'consoleErrors', 'failedRequests', 'network']) if (audit[key].length) { audit.ok = false; process.exitCode = 1; }
  audit.finishedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(auditFile), { recursive: true });
  await fs.writeFile(auditFile, JSON.stringify(audit, null, 2) + '\n'); console.log(JSON.stringify(audit, null, 2));
}
