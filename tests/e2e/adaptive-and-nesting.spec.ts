import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { Document } from '../../src/model/types';

async function insert(page: Page, name: string) {
  await page.getByTitle(`Drag ${name} onto the canvas`, { exact: true }).dblclick();
}

async function field(page: Page, name: string, value: string) {
  const input = page.getByRole('complementary', { name: 'Properties inspector' }).getByLabel(name, { exact: true });
  await input.fill(value);
  await input.press('Tab');
}

async function save(page: Page, testInfo: TestInfo, name: string) {
  const download = page.waitForEvent('download');
  await page.getByTitle('Save', { exact: true }).click();
  const path = testInfo.outputPath(name);
  await (await download).saveAs(path);
  return { path, document: JSON.parse(await readFile(path, 'utf8')) as Document };
}

async function open(page: Page, path: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles(path);
  await expect(page.locator('.statusbar')).toContainText('Document opened');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.canvas-surface')).toBeVisible();
  page.on('dialog', dialog => dialog.accept());
});

test('adaptive view keeps Base layout and shared text through mobile preview, offline export, import and reset', async ({ page, browser }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await insert(page, 'Box');
  await field(page, 'Widget name', 'Adaptive card');
  await field(page, 'X', '120');
  await field(page, 'W', '240');
  await field(page, 'Fill', '#e2e8f0');
  await field(page, 'Widget text', 'Base text');
  const widget = page.locator('.editor-widget');
  const views = page.getByRole('group', { name: 'Adaptive views', exact: true });
  // New projects select by native size; Base represents desktop in this fixture.
  await views.getByLabel('Base view width', { exact: true }).fill('1200');
  await views.getByLabel('Base view width', { exact: true }).press('Tab');
  await views.getByRole('button', { name: 'Add adaptive view', exact: true }).click();
  const viewPrompt = page.getByRole('dialog', { name: 'Adaptive view name', exact: true });
  await viewPrompt.getByRole('textbox', { name: 'Adaptive view name', exact: true }).fill('Canceled view');
  await viewPrompt.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(viewPrompt).toHaveCount(0);
  await expect(views.getByLabel('Adaptive view', { exact: true }).locator('option')).toHaveCount(1);
  await expect(widget).toHaveCSS('left', '120px');
  await views.getByRole('button', { name: 'Add adaptive view', exact: true }).click();
  await viewPrompt.getByRole('textbox', { name: 'Adaptive view name', exact: true }).fill('Mobile');
  await viewPrompt.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(views.getByLabel('Adaptive view width', { exact: true })).toHaveValue('390');
  const mobileId = await views.getByLabel('Adaptive view', { exact: true }).inputValue();
  expect(mobileId).not.toBe('');
  await widget.click();
  await field(page, 'X', '20');
  await field(page, 'W', '330');
  await field(page, 'Fill', '#ffe4e6');
  await field(page, 'Widget text', 'Shared mobile edit');
  await expect(widget).toHaveCSS('left', '20px');
  await expect(widget).toHaveCSS('width', '330px');
  await expect(widget).toHaveCSS('background-color', 'rgb(255, 228, 230)');
  await views.getByLabel('Adaptive view', { exact: true }).selectOption('');
  await expect(widget).toHaveCSS('left', '120px');
  await expect(widget).toHaveCSS('width', '240px');
  await expect(widget).toHaveCSS('background-color', 'rgb(226, 232, 240)');
  await expect(widget).toHaveText('Shared mobile edit');

  const saved = await save(page, testInfo, 'adaptive-view.rea.json');
  const model = saved.document.pages[0], base = model.widgets[0];
  expect(base).toMatchObject({ x: 120, width: 240, text: 'Shared mobile edit', style: { fill: '#e2e8f0' } });
  expect(model.adaptiveViews[0]).toMatchObject({ name: 'Mobile', width: 390, overrides: { [base.id]: { x: 20, width: 330, style: { fill: '#ffe4e6' } } } });
  expect(model.adaptiveViews[0].overrides[base.id]).not.toHaveProperty('text');

  await page.getByTitle('Preview (F5)', { exact: true }).click();
  const preview = page.locator('.preview-overlay');
  const previewWidget = preview.locator('.widget[aria-label="Adaptive card"]');
  await expect(previewWidget).toHaveCSS('left', '120px');
  await preview.getByTitle('Mobile', { exact: true }).click();
  await expect(preview.locator('.preview-page')).toHaveCSS('width', '390px');
  await expect(previewWidget).toHaveCSS('left', '20px');
  await expect(previewWidget).toHaveCSS('width', '330px');
  await expect(previewWidget).toHaveCSS('background-color', 'rgb(255, 228, 230)');
  await expect(previewWidget).toHaveText('Shared mobile edit');
  await page.screenshot({ path: testInfo.outputPath('adaptive-mobile-preview.png'), fullPage: true });
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  const html = testInfo.outputPath('adaptive-offline.html');
  await (await download).saveAs(html);
  const offline = await browser.newContext({ offline: true, viewport: { width: 390, height: 844 } });
  try {
    const exported = await offline.newPage();
    exported.on('pageerror', error => errors.push(error.message));
    await exported.goto(pathToFileURL(html).href);
    const mobileWidget = exported.locator('.widget[aria-label="Adaptive card"]');
    await expect(exported.locator('main')).toHaveCSS('width', '390px');
    await expect(mobileWidget).toHaveCSS('left', '20px');
    await expect(mobileWidget).toHaveCSS('width', '330px');
    await expect(mobileWidget).toHaveCSS('background-color', 'rgb(255, 228, 230)');
    await expect(mobileWidget).toHaveText('Shared mobile edit');
    await exported.screenshot({ path: testInfo.outputPath('adaptive-mobile-offline.png'), fullPage: true });
  } finally { await offline.close(); }

  await open(page, saved.path);
  await views.getByLabel('Adaptive view', { exact: true }).selectOption(mobileId);
  await expect(widget).toHaveCSS('left', '20px');
  await expect(widget).toHaveCSS('width', '330px');
  await expect(widget).toHaveCSS('background-color', 'rgb(255, 228, 230)');
  await views.getByRole('button', { name: 'Reset adaptive overrides', exact: true }).click();
  await expect(widget).toHaveCSS('left', '120px');
  await expect(widget).toHaveCSS('width', '240px');
  await expect(widget).toHaveCSS('background-color', 'rgb(226, 232, 240)');
  await expect(widget).toHaveText('Shared mobile edit');
  await expect(views.getByRole('button', { name: 'Reset adaptive overrides', exact: true })).toBeDisabled();
  const reset = await save(page, testInfo, 'adaptive-reset.rea.json');
  expect(reset.document.pages[0].adaptiveViews[0].overrides).toEqual({});
  expect(reset.document.pages[0].widgets[0].text).toBe('Shared mobile edit');
  expect(errors).toEqual([]);
});

test('nested panel and repeater template edits persist in the tree and render for every row', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await insert(page, 'Dynamic panel');
  await field(page, 'Widget name', 'Outer panel');
  await field(page, 'X', '30');
  await field(page, 'Y', '40');
  await field(page, 'W', '420');
  await field(page, 'H', '260');
  await page.locator('.editor-widget.panel').dblclick();
  await insert(page, 'Dynamic panel');
  await field(page, 'Widget name', 'Inner panel');
  await field(page, 'X', '20');
  await field(page, 'Y', '30');
  await field(page, 'W', '350');
  await field(page, 'H', '150');
  await page.locator('.editor-widget.panel').dblclick();
  await expect(page.locator('.page-tabs')).toContainText('Inner panel / State 1');
  await insert(page, 'Text');
  await field(page, 'Widget name', 'Nested caption');
  await field(page, 'X', '10');
  await field(page, 'Y', '12');
  await field(page, 'Widget text', 'Nested content edited');
  await page.locator('.page-tabs').getByRole('button', { name: 'Exit Inner panel', exact: true }).click();
  await expect(page.locator('.editor-widget.panel')).toHaveCount(1);
  await expect(page.locator('.editor-widget.panel')).toContainText('Nested content edited');
  await page.locator('.page-tabs').getByRole('button', { name: 'Exit Outer panel', exact: true }).click();

  await insert(page, 'Repeater');
  await field(page, 'Widget name', 'Editable rows');
  await field(page, 'X', '500');
  await field(page, 'Y', '100');
  await field(page, 'W', '450');
  await page.locator('.editor-widget.repeater').dblclick();
  await expect(page.locator('.page-tabs')).toContainText('Editable rows / Item template');
  await page.locator('.editor-widget.text').click();
  await field(page, 'Widget name', 'Row caption');
  await field(page, 'Widget text', 'Updated [[Item.Name]]');
  await insert(page, 'Button');
  await field(page, 'Widget name', 'Row action');
  await field(page, 'X', '270');
  await field(page, 'Y', '7');
  await field(page, 'Widget text', 'Open [[Item.Name]]');
  await page.locator('.page-tabs').getByRole('button', { name: 'Exit Editable rows', exact: true }).click();
  await expect(page.locator('.editor-widget')).toHaveCount(2);
  const saved = await save(page, testInfo, 'nested-containers.rea.json');
  const widgets = saved.document.pages[0].widgets;
  expect(widgets).toHaveLength(2);
  expect(widgets[0]).toMatchObject({ type: 'panel', name: 'Outer panel' });
  const inner = widgets[0].states![0].widgets;
  expect(inner).toHaveLength(1);
  expect(inner[0]).toMatchObject({ type: 'panel', name: 'Inner panel', x: 20, y: 30 });
  expect(inner[0].states![0].widgets).toHaveLength(1);
  expect(inner[0].states![0].widgets[0]).toMatchObject({ name: 'Nested caption', text: 'Nested content edited', x: 10, y: 12 });
  expect(widgets[1].repeater!.template).toHaveLength(2);
  expect(widgets[1].repeater!.template.map(item => [item.name, item.text])).toEqual([['Row caption', 'Updated [[Item.Name]]'], ['Row action', 'Open [[Item.Name]]']]);
  expect(widgets[1].repeater!.rows).toEqual([{ Name: 'Item 1' }, { Name: 'Item 2' }, { Name: 'Item 3' }]);

  await open(page, saved.path);
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  const preview = page.locator('.preview-overlay');
  await expect(preview.locator('.widget[aria-label="Outer panel"] .widget[aria-label="Inner panel"] .widget[aria-label="Nested caption"]')).toHaveText('Nested content edited');
  await expect(preview.locator('.widget[aria-label="Row caption"]')).toHaveText(['Updated Item 1', 'Updated Item 2', 'Updated Item 3']);
  await expect(preview.locator('.widget[aria-label="Row action"]')).toHaveText(['Open Item 1', 'Open Item 2', 'Open Item 3']);
  await page.screenshot({ path: testInfo.outputPath('nested-containers-preview.png'), fullPage: true });
  expect(errors).toEqual([]);
});
