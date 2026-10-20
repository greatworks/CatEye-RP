import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

// Candidate-only desktop import check. The original RP files are never written,
// and no original Axure executable/DLL or stored interaction is executed here.
const root = path.resolve(import.meta.dirname, '..');
if (!process.argv[2]) throw new Error('Usage: node scripts/smoke-runtime-rotate-native-import.mjs <candidate.exe>');
const executablePath = path.resolve(process.argv[2]);
const asarFile = path.join(path.dirname(executablePath), 'resources/app.asar');
const auditFile = path.join(root, '.build/runtime-rotate-native-import-desktop-audit.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = async file => hash(await fs.readFile(file));
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const evidenceFile = path.join(root, 'research/runtime-rotate-format-import-audit.json');
const evidenceSha256 = 'f290630bea46a048fa300a3892100a05c27d69e9b0c7afbaba0831ed82b35c26';
const fixtureSpecs = [
  {
    key: 'ui', suffix: 'Sample UI patterns.rplib',
    sha256: 'cf1787fded7a74278209f9aee4b07a266a10360f2e0dd552c49cca158f65e36b',
    expectedDocument: 'research/runtime-rotate-format-ui-imported.rea.json',
    expectedDocumentSha256: 'd21e22663f760f3f848b20e57b211db43e9a53bae6f07d14f5b4e90d6db15981',
    cases: [
      { page: '27f59a68aaf249d298b4edbb44f8e2ae', pageName: 'Instructions', owner: '9b72d47e5d95453aa10143545881679d', target: '9b72d47e5d95453aa10143545881679d', event: 'load', duration: 1500 },
      { page: '4d4b15a019754649b2e63d5d7577f323', pageName: 'Loading spinner', owner: 'b5179b0a92bd40daafc6d834cb9e62ae', target: 'b5179b0a92bd40daafc6d834cb9e62ae', event: 'load', duration: 1500 },
    ],
  },
  {
    key: 'basics', suffix: 'Prototyping Basics.rp',
    sha256: '26b9f0cc5937eb29791a9085d8364c54a50e228a1c8685241726c19e33ff73b7',
    expectedDocument: 'research/runtime-rotate-format-basics-imported.rea.json',
    expectedDocumentSha256: '49bb3df9eb9ad280ea0a6fc0491accf27434bc056b6165695226ad4ce7988364',
    cases: [
      { page: '8165e87159f34c58a974459d9e910e34', pageName: 'Getting started', owner: '5c18ef71a1e44eb7ada22074090a3376', target: 'c1cbc6b0f52c4a14b43558fa1e406afb', event: 'click', duration: 2000 },
    ],
  },
];
const audit = {
  ok: false, startedAt: new Date().toISOString(), executablePath,
  evidence: { file: evidenceFile, sha256: evidenceSha256 },
  checks: {}, samples: [], saves: [], screenshots: [], errors: [], consoleErrors: [], failedRequests: [], network: [],
  nativePickerResponsesMocked: true, originalAxureGuiCompared: false, originalDllExecuted: false,
  boundary: 'Actual candidate native file-open/worker import/save/reopen. Rotate records are checked in saved projects; animation and original GUI parity are outside this smoke.',
};
let app;
const sourcePins = [];
function widgetsIn(value, result = []) {
  if (!value || typeof value !== 'object') return result;
  if (value.id && value.type && value.style && Array.isArray(value.interactions)) result.push(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') widgetsIn(child, result);
  return result;
}
try {
  await fs.mkdir(path.dirname(auditFile), { recursive: true });
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  assert.equal(await sha(evidenceFile), evidenceSha256, 'Frozen native import oracle changed');
  const evidence = await readJson(evidenceFile);
  audit.appAsarSha256 = await sha(asarFile);
  audit.executableSha256 = await sha(executablePath);
  audit.userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-runtime-rotate-native-import-'));
  for (const spec of fixtureSpecs) {
    const matches = evidence.samples.filter(sample => path.basename(sample.file) === spec.suffix && sample.sha256 === spec.sha256);
    assert.equal(matches.length, 1, `Expected one pinned native source: ${spec.suffix}`);
    spec.sample = matches[0];
    assert.equal(await sha(spec.sample.file), spec.sha256);
    sourcePins.push({ file: spec.sample.file, sha256: spec.sha256 });
    assert.equal(await sha(path.join(root, spec.expectedDocument)), spec.expectedDocumentSha256);
    spec.document = await readJson(path.join(root, spec.expectedDocument));
  }
  app = await electron.launch({ executablePath, env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: audit.userData } });
  const observed = new WeakSet();
  const observe = page => {
    if (observed.has(page)) return;
    observed.add(page);
    page.on('pageerror', error => audit.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') audit.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => audit.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  };
  app.on('window', observe);
  app.windows().forEach(observe);
  await app.context().route(/^https?:\/\//, route => { audit.network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page);
  await page.locator('.application').waitFor();
  const mainId = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.setContentSize(1500, 1000); window.webContents.setBackgroundThrottling(false);
    return window.id;
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
    const bytes = await fs.readFile(file);
    audit.saves.push({ file, sha256: hash(bytes) });
    return { file, document: JSON.parse(bytes) };
  };
  const capture = async name => {
    await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).webContents.invalidate(), mainId);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bytes = Buffer.from(await app.evaluate(async ({ BrowserWindow }, id) => (await BrowserWindow.fromId(id).webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'), mainId), 'base64');
    assert.ok(bytes.length > 1000, 'Expected actual captured PNG bytes');
    const file = path.join(root, `artifacts/runtime-rotate-native-import-${name}.png`);
    await fs.writeFile(file, bytes); audit.screenshots.push({ file, sha256: hash(bytes) });
  };
  let recovered = 0;
  for (const spec of fixtureSpecs) {
    audit.activeStage = `native-import-${spec.key}`;
    await openPicker(spec.sample.file);
    await menu('Import Axure .rp (experimental)…');
    const report = page.getByRole('dialog', { name: 'RP import report', exact: true });
    await expect(report).toContainText(spec.sha256, { timeout: 120000 });
    const counts = spec.sample.import;
    await expect(report).toContainText(`${counts.pagesImported} page(s), ${counts.widgetsImported} recovered widget(s), ${counts.widgetsSkipped} skipped item(s).`);
    await expect(report).toContainText(`${counts.eventsImported} recovered event(s), ${counts.eventsSkipped} skipped event(s), ${counts.casesImported} case(s), ${counts.actionsImported} action(s).`);
    await capture(`${spec.key}-report`);
    await report.getByRole('button', { name: 'Close report', exact: true }).click();
    const saved = await save(`runtime-rotate-native-${spec.key}.rea.json`);
    // Desktop supplies the source filename; the static oracle used the importer
    // default title. Only this explicit, independently asserted argument differs.
    assert.equal(saved.document.name, spec.suffix.replace(/\.rp$/i, ''));
    assert.deepEqual({ ...saved.document, name: spec.document.name }, spec.document);
    const allWidgets = widgetsIn(saved.document), verified = [];
    const allRotateActions = allWidgets.flatMap(widget => widget.interactions.flatMap(interaction => interaction.actions.filter(action => action.type === 'rotate')));
    assert.equal(allRotateActions.length, spec.cases.length, 'No missing or extra native Rotate action');
    for (const item of spec.cases) {
      const pageId = `rp-p-${item.page}`, widgetId = `rp-w-${item.page}-${item.owner}`, targetId = `rp-w-${item.page}-${item.target}`;
      const owningPage = saved.document.pages.find(value => value.id === pageId);
      assert.equal(owningPage?.name, item.pageName);
      const owner = widgetsIn(owningPage).find(widget => widget.id === widgetId);
      assert.ok(owner, `Missing native owner ${widgetId}`);
      const matching = owner.interactions.filter(interaction => interaction.event === item.event && interaction.actions.some(action => action.type === 'rotate'));
      assert.equal(matching.length, 1);
      const expected = evidence.additions.find(record => record.widgetId === widgetId);
      assert.ok(expected); assert.deepEqual(matching[0], expected.interaction);
      assert.equal(matching[0].actions.length, 1);
      assert.deepEqual(matching[0].actions[0].rotate, { mode: 'by', degrees: '360', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'linear', duration: item.duration });
      assert.equal(matching[0].actions[0].targetId, targetId);
      assert.ok(widgetsIn(owningPage).some(widget => widget.id === targetId), 'Target must resolve in its native page scope');
      if (spec.key === 'ui') assert.equal(targetId, widgetId, 'Native zero/This path must resolve to its owner');
      verified.push({ pageId, pageName: item.pageName, widgetId, targetId, event: item.event, nativeThisResolved: spec.key === 'ui' });
      recovered++;
    }
    await openPicker(saved.file); await menu('Open… Ctrl+O');
    await expect(page.locator('.statusbar')).toContainText('Document opened');
    assert.deepEqual((await save(`runtime-rotate-native-${spec.key}-reopened.rea.json`)).document, saved.document);
    assert.equal(await sha(spec.sample.file), spec.sha256);
    audit.samples.push({ file: spec.sample.file, sha256: spec.sha256, expectedDocument: spec.expectedDocument, expectedDocumentSha256: spec.expectedDocumentSha256, saved: saved.file, sourceUnchanged: true, fullDocumentMatchedExceptFilenameTitle: true, saveReopenExact: true, counts, rotations: verified });
  }
  assert.equal(recovered, 3);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible())), true);
  assert.equal(await sha(asarFile), audit.appAsarSha256);
  audit.checks = { nativeFiles: 2, recoveredInteractions: 3, recoveredRotateActions: 3, thisTargets: 2, explicitTargets: 1, fullDocumentsMatched: true, saveReopenExact: true, allWindowsHidden: true, originalFilesUnchanged: true };
  delete audit.activeStage;
  audit.ok = true;
} catch (error) {
  audit.failure = error.stack ?? String(error); audit.ok = false; process.exitCode = 1;
} finally {
  if (app) try { await app.close(); } catch (error) { audit.errors.push(String(error)); audit.ok = false; process.exitCode = 1; }
  for (const source of sourcePins) {
    try { assert.equal(await sha(source.file), source.sha256); }
    catch (error) { audit.errors.push(`Source integrity: ${error.message}`); audit.ok = false; process.exitCode = 1; }
  }
  for (const key of ['errors', 'consoleErrors', 'failedRequests', 'network']) if (audit[key].length) { audit.ok = false; process.exitCode = 1; }
  audit.finishedAt = new Date().toISOString();
  await fs.mkdir(path.dirname(auditFile), { recursive: true });
  await fs.writeFile(auditFile, JSON.stringify(audit, null, 2) + '\n');
  console.log(JSON.stringify(audit, null, 2));
}
