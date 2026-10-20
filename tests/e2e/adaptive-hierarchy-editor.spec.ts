import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import type { Document } from '../../src/model/types';

const views = (page: Page) => page.getByRole('group', { name: 'Adaptive views', exact: true });
async function input(page: Page, name: string, value: string) {
  await views(page).getByLabel(name, { exact: true }).fill(value);
  await views(page).getByLabel(name, { exact: true }).press('Tab');
}
async function field(page: Page, name: string, value: string) {
  const control = page.getByRole('complementary', { name: 'Properties inspector' }).getByLabel(name, { exact: true });
  await control.fill(value); await control.press('Tab');
}
async function add(page: Page, name: string) {
  await views(page).getByRole('button', { name: 'Add adaptive view', exact: true }).click();
  const prompt = page.getByRole('dialog', { name: 'Adaptive view name', exact: true });
  await prompt.getByRole('textbox').fill(name); await prompt.getByRole('button', { name: 'OK', exact: true }).click();
  return views(page).getByLabel('Adaptive view', { exact: true }).inputValue();
}
async function save(page: Page, info: TestInfo, name: string) {
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath(name); await (await pending).saveAs(file);
  return { file, doc: JSON.parse(await readFile(file, 'utf8')) as Document };
}
async function open(page: Page, file: string) {
  const pending = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await pending).setFiles(file); await expect(page.locator('.statusbar')).toContainText('Document opened');
}

test('new projects edit and retain inherited local overrides, reset to parent, and reparent children on deletion', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.locator('.canvas-surface')).toBeVisible();
  await expect(views(page).getByLabel('Base view width', { exact: true })).toHaveValue('0');
  await input(page, 'Base view width', '1200');
  await page.getByTitle('Drag Box onto the canvas', { exact: true }).dblclick();
  await field(page, 'Widget name', 'Inherited card'); await field(page, 'X', '20');
  await field(page, 'Fill', '#ffffff');
  const card = page.locator('.editor-widget');
  const parent = await add(page, 'Parent');
  await card.click(); await field(page, 'X', '90'); await field(page, 'Fill', '#dbeafe');
  const child = await add(page, 'Child');
  await input(page, 'Adaptive view height', '600');
  await views(page).getByLabel('Inherit from', { exact: true }).selectOption(parent);
  await expect(page.locator('.canvas-surface')).toHaveCSS('height', '600px');
  await expect(card).toHaveCSS('left', '90px'); await expect(card).toHaveCSS('background-color', 'rgb(219, 234, 254)');
  await card.click(); await field(page, 'X', '140');
  const saved = await save(page, info, 'hierarchy-authored.rea.json');
  const model = saved.doc.pages[0], id = model.widgets[0].id;
  expect(model.adaptiveSelection).toBe('native-size'); expect(model.adaptiveBaseSize).toEqual({ width: 1200, height: 0 });
  expect(model.adaptiveViews.find(view => view.id === child)).toMatchObject({ baseViewId: parent, height: 600, overrides: { [id]: { x: 140 } } });
  expect(model.adaptiveViews.find(view => view.id === child)!.overrides[id]).not.toHaveProperty('style');
  await open(page, saved.file); await views(page).getByLabel('Adaptive view', { exact: true }).selectOption(parent);
  await expect(views(page).getByLabel('Inherit from', { exact: true }).locator(`option[value="${child}"]`)).toHaveCount(0);
  await card.click(); await field(page, 'Fill', '#dcfce7');
  // A parent's later matching value must not erase an existing child command
  // when the author changes unrelated shared content.
  await field(page, 'X', '140');
  await views(page).getByLabel('Adaptive view', { exact: true }).selectOption(child);
  await card.click();
  const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await inspector.getByRole('tab', { name: 'Notes', exact: true }).click();
  await inspector.getByLabel('Widget notes', { exact: true }).fill('Retain the child position');
  const noted = await save(page, info, 'hierarchy-equal-parent-notes.rea.json');
  expect(noted.doc.pages[0].adaptiveViews.find(view => view.id === child)!.overrides[id]?.x).toBe(140);
  await inspector.getByRole('tab', { name: 'Style', exact: true }).click();
  await views(page).getByLabel('Adaptive view', { exact: true }).selectOption(parent);
  await card.click(); await field(page, 'X', '90');
  await views(page).getByLabel('Adaptive view', { exact: true }).selectOption(child);
  await expect(card).toHaveCSS('left', '140px'); await expect(card).toHaveCSS('background-color', 'rgb(220, 252, 231)');
  await page.screenshot({ path: info.outputPath('adaptive-hierarchy-editor.png'), fullPage: true });
  await views(page).getByRole('button', { name: 'Reset adaptive overrides', exact: true }).click();
  await expect(card).toHaveCSS('left', '90px');
  await card.click(); await field(page, 'X', '150');
  await views(page).getByLabel('Adaptive view', { exact: true }).selectOption(parent);
  await views(page).getByRole('button', { name: 'Delete adaptive view', exact: true }).click();
  await views(page).getByLabel('Adaptive view', { exact: true }).selectOption(child);
  await expect(views(page).getByLabel('Inherit from', { exact: true })).toHaveValue('');
  await expect(card).toHaveCSS('left', '150px'); await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.getByTitle('Undo', { exact: true }).click();
  await expect(views(page).getByLabel('Inherit from', { exact: true })).toHaveValue(parent);
  await expect(card).toHaveCSS('background-color', 'rgb(220, 252, 231)');
  await page.getByTitle('Redo', { exact: true }).click();
  await expect(views(page).getByLabel('Inherit from', { exact: true })).toHaveValue('');
  await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await input(page, 'Adaptive view height', '-1'); await expect(views(page).getByRole('alert')).toContainText('between 0 and 100000');
  await input(page, 'Adaptive view height', '0'); await expect(views(page).getByRole('alert')).toHaveCount(0);
  const final = await save(page, info, 'hierarchy-parent-deleted.rea.json');
  expect(final.doc.pages[0].adaptiveViews).toHaveLength(1);
  expect(final.doc.pages[0].adaptiveViews[0].baseViewId).toBeUndefined();
  expect(final.doc.pages[0].adaptiveViews[0].overrides[id]).toEqual({ x: 150 });
  expect(errors).toEqual([]);
});

test('legacy project keeps max-width selection until the author explicitly chooses size rules', async ({ page }, info) => {
  await page.goto('/'); await expect(page.locator('.canvas-surface')).toBeVisible();
  const initial = await save(page, info, 'blank.rea.json');
  delete initial.doc.pages[0].adaptiveSelection; delete initial.doc.pages[0].adaptiveBaseSize;
  initial.doc.pages[0].adaptiveViews = [{ id: 'legacy-phone', name: 'Phone', width: 390, overrides: {} }];
  const legacy = info.outputPath('legacy.rea.json'); await writeFile(legacy, JSON.stringify(initial.doc));
  await open(page, legacy); await views(page).getByLabel('Adaptive view', { exact: true }).selectOption('legacy-phone');
  await expect(views(page).getByLabel('Adaptive view max width', { exact: true })).toHaveValue('390');
  const preserved = await save(page, info, 'legacy-preserved.rea.json');
  expect(preserved.doc.pages[0]).not.toHaveProperty('adaptiveSelection');
  await views(page).getByRole('button', { name: 'Use view size rules', exact: true }).click();
  await expect(views(page).getByLabel('Adaptive view width', { exact: true })).toHaveValue('390');
  const converted = await save(page, info, 'legacy-size-rules.rea.json');
  expect(converted.doc.pages[0]).toMatchObject({ adaptiveSelection: 'native-size', adaptiveBaseSize: { width: 0, height: 0 } });
});
