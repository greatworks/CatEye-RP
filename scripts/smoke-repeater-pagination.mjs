import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'artifacts/repeater-pagination-demo.rea.json');
const digest = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const sourceHash = await digest(source);
await fs.mkdir(path.join(root, '.build'), { recursive: true });
const userData = await fs.mkdtemp(path.join(root, '.build', 'repeater-desktop-'));
const executablePath = process.argv[2];
const app = await electron.launch({
  ...(executablePath ? { executablePath } : { args: [root] }),
  env: { ...process.env, REA_HEADLESS_TEST: '1', REA_TEST_USER_DATA: userData },
});
const widget = (scope, name) => scope.locator(`.widget[aria-label="${name}"]`);

async function exercise(scope, capture) {
  const rows = widget(scope, 'Records').locator('.repeater-row');
  const labels = widget(scope, 'Row summary');
  const click = name => widget(scope, name).click();
  const check = index => rows.nth(index).getByRole('checkbox', { name: 'Mark record', exact: true });
  await expect(labels).toHaveText(['A: 1', 'B: 2']);
  await expect(widget(scope, 'Page status')).toHaveText('Page 1 / 3 — 2 of 5 (5 total)');
  await check(0).check(); await click('Next page');
  await expect(labels).toHaveText(['C: 3', 'D: 4']); await check(1).check();
  await click('Last page'); await expect(labels).toHaveText(['E: 5']);
  await click('Filter to E'); await click('Update marked'); await click('Clear filter');
  await expect(labels).toHaveText(['A: 11', 'B: 2']);
  await expect(check(0)).toBeChecked(); await expect(check(1)).not.toBeChecked();
  if (capture) await capture();
  await click('Next page'); await expect(labels).toHaveText(['C: 3', 'D: 14']); await expect(check(1)).toBeChecked();
  await click('Sort descending'); await expect(labels).toHaveText(['C: 3', 'B: 2']);
  await click('Delete marked'); await expect(labels).toHaveText(['B: 2']);
  await expect(widget(scope, 'Page status')).toHaveText('Page 2 / 2 — 1 of 3 (3 total)');
  await click('Show all'); await expect(labels).toHaveText(['E: 5', 'C: 3', 'B: 2']);
  await click('Mark all'); await click('Two per page');
  await expect(check(0)).toBeChecked(); await expect(check(1)).toBeChecked();
  await click('Last page'); await expect(labels).toHaveText(['B: 2']); await expect(check(0)).toBeChecked();
  await check(0).uncheck(); await click('First page'); await click('Delete marked');
  await expect(labels).toHaveText(['B: 2']); await expect(check(0)).not.toBeChecked();
  await check(0).check(); await click('Visit second page'); await click('Return to records');
  await expect(labels).toHaveText(['A: 1', 'B: 2']);
  await expect(check(0)).not.toBeChecked(); await expect(check(1)).not.toBeChecked();
  await expect(widget(scope, 'Page status')).toHaveText('Page 1 / 3 — 2 of 5 (5 total)');
  await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
}

async function exerciseQueries(scope, capture) {
  const labels = widget(scope, 'Product');
  const check = index => widget(scope, 'Catalog').locator('.repeater-row').nth(index).getByRole('checkbox', { name: 'Mark product', exact: true });
  const click = name => widget(scope, name).click();
  const ids = expected => expect.poll(async () => (await labels.allTextContents()).map(text => text.split(' · ')[0])).toEqual(expected);
  await ids(['B','C','D']); await check(2).check();
  await click('Red rule'); await ids(['C','A']); await click('Blue alternative'); await ids(['B','C','A']);
  await click('Minimum 6'); await ids(['A','E']); await click('Set threshold 12'); await ids(['A','E']);
  await click('Refresh rules'); await ids(['E']); await click('Remove colors'); await ids(['E']);
  await click('Clear filters'); await ids(['B','C','D']); await expect(check(2)).toBeChecked();
  await click('Sort names'); await ids(['C','A','D']); await expect(check(2)).toBeChecked();
  if (capture) await capture();
  await click('Toggle names'); await ids(['E','B','D']); await expect(check(2)).toBeChecked();
  await click('Remove name sort'); await ids(['B','C','D']); await click('Next page'); await ids(['A','E']);
  await click('Clear sorts'); await ids(['D','E']); await expect(check(0)).toBeChecked();
  await click('Show all'); await ids(['A','B','C','D','E']); await click('Empty result'); await ids([]);
  await click('Clear filters'); await ids(['A','B','C','D','E']); await expect(check(3)).toBeChecked();
  const search = scope.getByRole('textbox', { name: 'Search names', exact: true });
  await search.fill('item1'); await search.press('Tab'); await ids(['B','C']);
  await search.fill('item2'); await search.press('Tab'); await ids(['A','E']);
  await search.fill(''); await search.press('Tab'); await ids(['A','B','C','D','E']);
  await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
}

try {
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await page.locator('.application').waitFor();
  const errors = [], network = [];
  page.on('pageerror', error => errors.push(error.message));
  await app.context().route(/^https?:\/\//, route => { network.push(route.request().url()); return route.abort(); });
  const open = async file => {
    await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, file);
    await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
    await page.locator('.dropdown-menu').getByRole('button', { name: /^Open…/ }).click();
    await expect(page.locator('.statusbar')).toContainText('Document opened');
  };
  const save = async file => {
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, file);
    await page.getByTitle('Save', { exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText(`Saved ${path.basename(file)}`);
  };
  await open(source);
  const saved = path.join(userData, 'pagination.rea.json'); await save(saved);
  const document = JSON.parse(await fs.readFile(saved, 'utf8'));
  const repeater = document.pages[0].widgets.find(widget => widget.name === 'Records');
  expect(repeater.repeater.pagination).toEqual({ itemsPerPage: 2, startPage: 1 });
  expect(repeater.interactions[0].actions[0]).toMatchObject({ type: 'setSelected', value: '[[Item.isMarked]]' });
  expect(repeater.repeater.template[0].interactions.map(item => item.actions[0].type)).toEqual(['markRows', 'unmarkRows']);
  await open(saved);
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  const screenshotPath = path.join(root, 'artifacts/repeater-pagination-desktop.png');
  await exercise(page.locator('.preview-overlay'), async () => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.invalidate());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const image = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'));
    await fs.writeFile(screenshotPath, Buffer.from(image, 'base64'));
  });
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  const html = path.join(userData, 'pagination.html');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, html);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  await expect(page.locator('.statusbar')).toContainText('Exported');
  const next = app.waitForEvent('window');
  await app.evaluate(({ BrowserWindow }, url) => {
    const window = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    void window.loadURL(url);
  }, pathToFileURL(html).href);
  const offline = await next; offline.on('pageerror', error => errors.push(error.message));
  await offline.waitForLoadState('domcontentloaded'); await exercise(offline); await offline.close();
  const afterPreview = path.join(userData, 'unchanged.rea.json'); await save(afterPreview);
  expect(JSON.parse(await fs.readFile(afterPreview, 'utf8'))).toEqual(document);
  expect(await digest(source)).toBe(sourceHash);
  expect(errors).toEqual([]); expect(network).toEqual([]);
  const demoHtml = path.join(root, 'artifacts/repeater-pagination-demo.html'); await fs.copyFile(html, demoHtml);
  const querySource = path.join(root, 'artifacts/repeater-query-demo.rea.json'), queryHash = await digest(querySource);
  await open(querySource);
  const querySaved = path.join(userData, 'queries.rea.json'); await save(querySaved); await open(querySaved);
  const queryDocument = JSON.parse(await fs.readFile(querySaved, 'utf8'));
  const catalog = queryDocument.pages[0].widgets.find(widget => widget.name === 'Catalog');
  expect(catalog.interactions[0].actions[0].type).toBe('addSort');
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  const queryScreenshot = path.join(root, 'artifacts/repeater-query-desktop.png');
  await exerciseQueries(page.locator('.preview-overlay'), async () => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.invalidate());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const image = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true })).toPNG().toString('base64'));
    await fs.writeFile(queryScreenshot, Buffer.from(image, 'base64'));
  });
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  const queryHtml = path.join(userData, 'queries.html');
  await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, queryHtml);
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); await expect(page.locator('.statusbar')).toContainText('Exported');
  const queryNext = app.waitForEvent('window');
  await app.evaluate(({ BrowserWindow }, url) => {
    const window = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    void window.loadURL(url);
  }, pathToFileURL(queryHtml).href);
  const queryOffline = await queryNext; queryOffline.on('pageerror', error => errors.push(error.message));
  await queryOffline.waitForLoadState('domcontentloaded'); await exerciseQueries(queryOffline); await queryOffline.close();
  const queryAfter = path.join(userData, 'queries-unchanged.rea.json'); await save(queryAfter);
  expect(JSON.parse(await fs.readFile(queryAfter, 'utf8'))).toEqual(queryDocument);
  expect(await digest(querySource)).toBe(queryHash); expect(errors).toEqual([]); expect(network).toEqual([]);
  const queryDemoHtml = path.join(root, 'artifacts/repeater-query-demo.html'); await fs.copyFile(queryHtml, queryDemoHtml);
  const result = {
    ok: true, executablePath: executablePath ? path.resolve(executablePath) : null,
    nativeSaveReopen: true, previewAndActualExportVerified: true,
    crossPageCheckboxRestore: true, hiddenMarkedUpdateAndDelete: true,
    sortingAndPageSize: true, pageReentryResetsDataAndMarks: true,
    authoredDocumentUnchanged: true, sourceHash, unexpectedNetworkRequests: network.length,
    pageErrors: errors, screenshotPath, demoHtml, verifiedAt: new Date().toISOString(),
    originalAxureGuiComparison: false,
    namedQueries: { nativeSaveReopen: true, smartCombinationAndDuplicateNames: true, dynamicGlobalAndSourceText: true, sortPriorityAndToggle: true, emptyResultRecovery: true, marksAndPagination: true, previewAndActualExportVerified: true, authoredDocumentUnchanged: true, sourceHash: queryHash, screenshotPath: queryScreenshot, demoHtml: queryDemoHtml },
  };
  await fs.writeFile(path.join(root, '.build/repeater-desktop-audit.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await app.close(); }
