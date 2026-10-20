import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Run only after rebuilding the desktop bundle. An optional argument selects a packaged EXE.
const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'artifacts/repeater-empty-demo.rea.json');
const screenshotPath = path.join(root, 'artifacts/repeater-empty-desktop.png');
const demoHtml = path.join(root, 'artifacts/repeater-empty-demo.html');
const auditPath = path.join(root, '.build/repeater-empty-desktop-audit.json');
const digest = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const sourceHash = await digest(source);
const sourceDocument = JSON.parse(await fs.readFile(source, 'utf8'));
await fs.mkdir(path.join(root, '.build'), { recursive: true });
const userData = await fs.mkdtemp(path.join(root, '.build', 'repeater-empty-desktop-'));
const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const app = await electron.launch({
  ...(executablePath ? { executablePath } : { args: [root] }),
  env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData },
});
const widget = (scope, name) => scope.locator(`.widget[aria-label="${name}"]`);

// Keep this behavior in step with tests/e2e/repeater-empty.spec.ts. Importing that
// file would register Playwright tests instead of providing a standalone smoke.
async function exercise(scope) {
  const mainRows = widget(scope, 'Unlimited records').locator('.repeater-row'), mainLabels = widget(scope, 'Main row');
  const pagedRows = widget(scope, 'Paged records').locator('.repeater-row'), pagedLabels = widget(scope, 'Paged row');
  const mainLog = widget(scope, 'Main lifecycle log'), pageLog = widget(scope, 'Paged lifecycle log');
  const click = name => widget(scope, name).click();
  let trace = 'I3|L|'.repeat(3);
  await expect(mainLabels).toHaveText(['A', 'B', 'C']); await expect(mainLog).toHaveText(trace);
  await expect(widget(scope, 'Main empty state')).toHaveText('Rows available'); await expect(widget(scope, 'Main empty callbacks')).toHaveText('Empty loads: 0');
  await expect(pagedLabels).toHaveText(['A', 'B']); await expect(pageLog).toHaveText('I3|L|'.repeat(2));
  await click('Filter none'); trace += 'I0|L|';
  await expect(mainRows).toHaveCount(0); await expect(mainLabels).toHaveCount(0); await expect(mainLog).toHaveText(trace);
  await expect(widget(scope, 'Main empty state')).toHaveText('No results'); await expect(widget(scope, 'Main empty callbacks')).toHaveText('Empty loads: 1');
  await click('Touch main rows'); await expect(mainRows).toHaveCount(0); await expect(mainLabels).toHaveCount(0); await expect(mainLog).toHaveText(trace);
  await click('Clear filter'); trace += 'I3|L|'.repeat(3); await expect(mainLabels).toHaveText(['A', 'B', 'C']); await expect(mainLog).toHaveText(trace);
  await expect(widget(scope, 'Main empty state')).toHaveText('Rows available');

  await click('Try synchronous add'); trace += 'I0|S|L|';
  await expect(mainRows).toHaveCount(0); await expect(mainLog).toHaveText(trace); await expect(widget(scope, 'Main empty callbacks')).toHaveText('Empty loads: 2');
  await click('Restore three rows'); trace += 'I3|L|'.repeat(3); await expect(mainLabels).toHaveText(['A', 'B', 'C']); await expect(mainLog).toHaveText(trace);
  await click('Delete then Wait 0 add'); trace += 'I0|W|L|A|I1|L|';
  await expect(mainLabels).toHaveText(['Recovered after Wait 0']); await expect(mainLog).toHaveText(trace); await expect(widget(scope, 'Main empty callbacks')).toHaveText('Empty loads: 3');
  await expect(widget(scope, 'Main empty state')).toHaveText('Rows available');
  await click('Refresh main rows'); trace += 'I1|L|'; await expect(mainLog).toHaveText(trace); await expect(mainRows).toHaveCount(1);
  await expect(widget(scope, 'Main empty callbacks')).toHaveText('Empty loads: 3');

  await click('Touch page rows'); await expect(pagedLabels).toHaveText(['Touched A', 'Touched B']); await expect(pageLog).toHaveText('I3|L|'.repeat(2));
  await expect(widget(scope, 'Visible template targets')).toHaveText('Selected targets: A|B|');
  await click('Next page'); await expect(pagedLabels).toHaveText(['C']); await expect(pageLog).toHaveText('I3|L|'.repeat(3));
  await expect(widget(scope, 'Paged callbacks')).toHaveText('Item callbacks: 3; empty callbacks: 0');
  await click('Touch page rows'); await expect(pagedLabels).toHaveText(['Touched C']);
  await expect(widget(scope, 'Visible template targets')).toHaveText('Selected targets: A|B|C|');
  await click('Delete paged rows'); await expect(pagedRows).toHaveCount(0); await expect(pagedLabels).toHaveCount(0);
  await expect(pageLog).toHaveText('I3|L|'.repeat(3)); await expect(widget(scope, 'Paged callbacks')).toHaveText('Item callbacks: 3; empty callbacks: 0');
  await expect(widget(scope, 'Visible template targets')).toHaveText('Selected targets: A|B|C|');
  await click('Touch page rows'); await click('First page'); await expect(pagedRows).toHaveCount(0); await expect(pagedLabels).toHaveCount(0);
  await expect(pageLog).toHaveText('I3|L|'.repeat(3)); await expect(widget(scope, 'Paged callbacks')).toHaveText('Item callbacks: 3; empty callbacks: 0');
  await expect(widget(scope, 'Visible template targets')).toHaveText('Selected targets: A|B|C|');
  await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
}

function verifySavedFields(document) {
  const find = name => document.pages[0].widgets.find(item => item.name === name);
  const main = find('Unlimited records'), paged = find('Paged records');
  expect(main.repeater.rows).toEqual([{ Name: 'A' }, { Name: 'B' }, { Name: 'C' }]);
  expect(main.repeater).not.toHaveProperty('pagination');
  expect(paged.repeater.pagination).toEqual({ itemsPerPage: 2, startPage: 1 });
  expect(main.interactions[0].event).toBe('itemLoad');
  expect(main.interactions[0].actions.slice(0, 2)).toMatchObject([{ type: 'setVariable', targetId: 'MainIsEmpty', value: '[[This.itemCount == 0]]' }, { type: 'setText', value: '[[if(This.itemCount == 0, "No results", "Rows available")]]' }]);
  expect(main.repeater.template[0].interactions[0].event).toBe('load');
  expect(main.repeater.template[0].interactions[0].actions[0]).toMatchObject({ type: 'setVariable', targetId: 'MainTrace', value: '[[MainTrace]]L|' });
  const deferred = main.interactions.find(item => item.name === 'Add after empty refresh releases its guard');
  expect(deferred.event).toBe('itemLoad');
  expect(deferred.conditions).toEqual([{ source: 'variable', key: 'MainIsEmpty', operator: 'equals', value: 'true' }, { source: 'variable', key: 'GuardMode', operator: 'equals', value: 'wait' }]);
  const waitIndex = deferred.actions.findIndex(action => action.type === 'wait');
  expect(waitIndex).toBeGreaterThanOrEqual(0); expect(deferred.actions[waitIndex].duration).toBe(0);
  expect(deferred.actions[waitIndex + 1]).toMatchObject({ type: 'addRow', targetId: main.id, value: '{"Name":"Recovered after Wait 0"}' });
  const filter = find('Filter none').interactions[0].actions[0];
  expect(filter.type).toBe('addFilter'); expect(JSON.parse(filter.value)).toEqual({ name: 'empty', expression: '[[false]]', mode: 'smart', removeOthers: false });
  expect(find('Touch page rows').interactions[0].actions.map(action => action.type)).toEqual(['setText', 'setSelected']);
  expect(paged.repeater.template[1].interactions[0].event).toBe('select');
}

try {
  const errors = [], network = [], observed = new WeakSet();
  const observe = page => {
    if (observed.has(page)) return;
    observed.add(page); page.on('pageerror', error => errors.push(error.message));
  };
  app.on('window', observe); app.windows().forEach(observe);
  await app.context().route(/^https?:\/\//, route => { network.push(route.request().url()); return route.abort(); });
  const page = await app.firstWindow(); observe(page);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible()))).toBe(true);
  await page.locator('.application').waitFor();

  // Replace native dialog choices only. App UI still invokes the actual read/write IPC handlers.
  const open = async file => {
    await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, file);
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('.dropdown-menu').getByRole('button', { name: /^Open…/ }).click();
    await expect(page.locator('.statusbar')).toContainText('Document opened');
    await expect(page.locator('.titlebar')).toContainText(sourceDocument.name);
  };
  const save = async file => {
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, file);
    await page.getByTitle('Save', { exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);
    return JSON.parse(await fs.readFile(file, 'utf8'));
  };
  await open(source);
  const saved = path.join(userData, 'empty-repeater.rea.json'), document = await save(saved);
  verifySavedFields(document); expect(document).toEqual(sourceDocument);
  await open(saved);
  const reopened = await save(path.join(userData, 'empty-repeater-reopened.rea.json'));
  verifySavedFields(reopened); expect(reopened).toEqual(document);

  await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page.locator('.preview-overlay'));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.invalidate());
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const image = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'));
  const png = Buffer.from(image, 'base64'); expect(png.length).toBeGreaterThan(1000); await fs.writeFile(screenshotPath, png);
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  expect(await save(path.join(userData, 'after-preview.rea.json'))).toEqual(document);

  const html = path.join(userData, 'empty-repeater.html');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, html);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  expect((await fs.stat(html)).size).toBeGreaterThan(1000);
  await app.context().setOffline(true);
  // Attach error observers while the new hidden window is still about:blank.
  const next = app.waitForEvent('window');
  const offlineId = await app.evaluate(({ BrowserWindow }) => {
    const window = new BrowserWindow({ show: false, width: 1600, height: 1100, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    // An explicit navigation attaches Playwright before the exported document loads.
    void window.loadURL('about:blank');
    return window.id;
  });
  const offline = await next; observe(offline);
  try {
    await app.evaluate(({ BrowserWindow }, { id, url }) => BrowserWindow.fromId(id).loadURL(url), { id: offlineId, url: pathToFileURL(html).href });
    await offline.waitForLoadState('domcontentloaded'); expect(offline.url()).toBe(pathToFileURL(html).href);
    await exercise(offline);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().every(window => !window.isVisible()))).toBe(true);
  } finally { await offline.close(); await app.context().setOffline(false); }

  expect(await save(path.join(userData, 'after-export.rea.json'))).toEqual(document);
  expect(await digest(source)).toBe(sourceHash); expect(errors).toEqual([]); expect(network).toEqual([]);
  await fs.copyFile(html, demoHtml);
  const result = {
    ok: true, executablePath: executablePath ?? null, userData,
    nativeSaveReopen: true, savedLoadedWaitAndPagination: true, previewAndActualExportVerified: true,
    emptyItemAndTemplateLoadedOrder: true, noSyntheticRow: true, synchronousAddGuard: true,
    waitZeroReleasesGuard: true, lastPageDeleteSkipsEmptyCallbacks: true, externalTemplateTargetsVisibleOnly: true,
    hiddenWindows: true, exportedHtmlTestedOffline: true, authoredDocumentUnchanged: true,
    sourceHash, savedHash: await digest(saved), exportedHtmlHash: await digest(demoHtml),
    unexpectedNetworkRequests: network.length, pageErrors: errors, screenshotPath, demoHtml,
    verifiedAt: new Date().toISOString(), originalAxureGuiComparison: false,
  };
  await fs.writeFile(auditPath, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} finally { await app.close(); }
