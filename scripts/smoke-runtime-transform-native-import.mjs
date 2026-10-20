import { _electron as electron, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

// Candidate-only desktop import check. The original RP files are never written,
// and no original Axure executable/DLL or stored interaction is executed here.
const root = path.resolve(import.meta.dirname, '..');
if (!process.argv[2]) throw new Error('Usage: node scripts/smoke-runtime-transform-native-import.mjs <candidate.exe>');
const executablePath = path.resolve(process.argv[2]);
const asarFile = path.join(path.dirname(executablePath), 'resources/app.asar');
const auditFile = path.join(root, '.build/runtime-transform-native-import-desktop-audit.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = async file => hash(await fs.readFile(file));
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const evidenceFile = path.join(root, 'research/runtime-transform-mapper-audit.json');
const evidenceSha256 = '8a85e35792fba5e53bb208757dbf93f1826243f6280c605f7179e833c0bacb72';
const fixtureSpecs = [{ key: 'form', suffix: 'Sample form patterns.rplib', sha256: '1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179' }];
const audit = {
  ok: false, startedAt: new Date().toISOString(), executablePath,
  evidence: { file: evidenceFile, sha256: evidenceSha256 },
  checks: {}, samples: [], saves: [], screenshots: [], errors: [], consoleErrors: [], failedRequests: [], network: [],
  nativePickerResponsesMocked: true, originalAxureGuiCompared: false, originalDllExecuted: false,
  boundary: 'Actual candidate native file-open/worker import/save/reopen. Move records are checked in saved projects; animation and original GUI parity are outside this smoke.',
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
  audit.userData = await fs.mkdtemp(path.join(os.tmpdir(), 'rea-runtime-transform-native-import-'));
  for (const spec of fixtureSpecs) {
    const matches = evidence.samples.filter(sample => path.basename(sample.file) === spec.suffix && sample.sha256 === spec.sha256);
    assert.equal(matches.length, 1, `Expected one pinned native source: ${spec.suffix}`);
    spec.sample = matches[0];
    assert.equal(await sha(spec.sample.file), spec.sha256);
    sourcePins.push({ file: spec.sample.file, sha256: spec.sha256 });
    assert.equal(await sha(path.join(root, evidence.baseline.file)), evidence.baseline.sha256);
    const previous = await readJson(path.join(root, evidence.baseline.file));
    spec.document = previous.samples.find(sample => sample.file === spec.sample.file && sample.sha256 === spec.sha256).document;
    spec.additions = evidence.added.filter(record => record.file === spec.sample.file);
    assert.equal(spec.additions.length, 6);
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
    const file = path.join(root, `artifacts/runtime-transform-native-import-${name}.png`);
    await fs.writeFile(file, bytes); audit.screenshots.push({ file, sha256: hash(bytes) });
  };
  let recovered = 0;
  for (const spec of fixtureSpecs) {
    audit.activeStage = `native-import-${spec.key}`;
    await openPicker(spec.sample.file);
    await menu('Import Axure .rp (experimental)…');
    const report = page.getByRole('dialog', { name: 'RP import report', exact: true });
    await expect(report).toContainText(spec.sha256, { timeout: 120000 });
    const counts = spec.sample.report;
    await expect(report).toContainText(`${counts.pagesImported} page(s), ${counts.widgetsImported} recovered widget(s), ${counts.widgetsSkipped} skipped item(s).`);
    await expect(report).toContainText(`${counts.eventsImported} recovered event(s), ${counts.eventsSkipped} skipped event(s), ${counts.casesImported} case(s), ${counts.actionsImported} action(s).`);
    await capture(`${spec.key}-report`);
    await report.getByRole('button', { name: 'Close report', exact: true }).click();
    const saved = await save(`runtime-transform-native-${spec.key}.rea.json`);
    // Desktop supplies the source filename; the static oracle used the importer
    // default title. Only this explicit, independently asserted argument differs.
    assert.equal(saved.document.name, spec.suffix.replace(/\.rp$/i, ''));
    const allWidgets = widgetsIn(saved.document), verified = [], additionIds = new Set(spec.additions.map(record => record.interaction.id));
    for (const expected of spec.additions) {
      const owningPage = saved.document.pages.find(value => value.id === expected.pageId);
      assert.equal(owningPage?.name, expected.pageName);
      const owner = widgetsIn(owningPage).find(widget => widget.id === expected.ownerId);
      assert.ok(owner);
      const matches = owner.interactions.filter(interaction => interaction.id === expected.interaction.id);
      assert.equal(matches.length, 1); assert.deepEqual(matches[0], expected.interaction);
      assert.equal(matches[0].actions.length, 5);
      const moveActions = matches[0].actions.filter(action => action.type === 'move'); assert.equal(moveActions.length, 3);
      for (const action of moveActions) for (const target of action.move.targets) {
        assert.ok(['widget', 'this'].includes(target.target.kind));
        const targetId = target.target.kind === 'this' ? owner.id : target.target.id;
        assert.ok(widgetsIn(owningPage).some(widget => widget.id === targetId), 'Native Move target must resolve inside its page');
      }
      verified.push({ pageId: owningPage.id, ownerId: owner.id, interactionId: matches[0].id, moveActions: 3, siblingActions: 2 }); recovered++;
    }
    const allMoves = allWidgets.flatMap(widget => widget.interactions.flatMap(interaction => interaction.actions.filter(action => action.type === 'move')));
    assert.equal(allMoves.length, 18, 'No missing or additional native Move action');
    const stripped = structuredClone(saved.document);
    function strip(value) {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value.interactions)) value.interactions = value.interactions.filter(interaction => !additionIds.has(interaction.id));
      for (const [key, child] of Object.entries(value)) if (key !== 'interactions') strip(child);
    }
    strip(stripped); stripped.name = spec.document.name;
    assert.deepEqual(stripped, spec.document, 'Entire prior document remains identical after removing the six new complete cases');
    await openPicker(saved.file); await menu('Open… Ctrl+O');
    await expect(page.locator('.statusbar')).toContainText('Document opened');
    assert.deepEqual((await save(`runtime-transform-native-${spec.key}-reopened.rea.json`)).document, saved.document);
    assert.equal(await sha(spec.sample.file), spec.sha256);
    audit.samples.push({ file: spec.sample.file, sha256: spec.sha256, saved: saved.file, sourceUnchanged: true, priorDocumentExactAfterRemovingAdditions: true, saveReopenExact: true, counts, moves: verified });
  }
  assert.equal(recovered, 6);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible())), true);
  assert.equal(await sha(asarFile), audit.appAsarSha256);
  audit.checks = { nativeFiles: 1, recoveredInteractions: 6, recoveredMoveActions: 18, completeSiblingActions: 12, previousDocumentPreserved: true, saveReopenExact: true, allWindowsHidden: true, originalFilesUnchanged: true };
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
