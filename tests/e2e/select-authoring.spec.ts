import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Properties inspector' });
async function fileMenu(page: Page, name: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click();
}
async function open(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'select-authoring.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page: Page, path: string): Promise<Document> {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); await (await download).saveAs(path);
  return JSON.parse(await readFile(path, 'utf8')) as Document;
}
async function reopen(page: Page, path: string, name: string) {
  await fileMenu(page, 'New Ctrl+N'); const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O'); await (await chooser).setFiles(path);
  await expect(page.locator('.titlebar')).toContainText(name);
}
async function select(page: Page, index = 0) {
  await page.locator('.editor-widget.select').nth(index).click(); await inspector(page).getByRole('tab', { name: 'Style', exact: true }).click();
}
const indices = (element: HTMLSelectElement) => Array.from(element.selectedOptions, option => option.index);
function fixture() {
  const doc = createDocument(); doc.name = 'Literal option authoring'; doc.caseSelection = 'never';
  const field = createWidget('select', 48, 70); field.name = 'Choices'; field.text = 'Legacy text retained'; field.options = [' A ', 'repeat', 'repeat', '', 'two\nlines']; field.selectedIndices = [2]; field.height = 150;
  const second = createWidget('select', 360, 70); second.name = 'Other choices'; second.options = ['Other']; second.selectedIndices = [0];
  const input = createWidget('input', 48, 270); input.name = 'Input stays intact'; input.text = 'Keep input';
  const button = createWidget('button', 360, 270); button.name = button.text = 'Choose option';
  doc.pages[0].widgets = [field, second, input, button]; return { doc, field, second, input, button };
}

test('authors literal options and exact indices through reorder/delete/multiple/undo/save/reopen, including an empty list', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { doc } = fixture(); await open(page, doc); const initial = await save(page, info.outputPath('initial.rea.json')); await select(page);
  const control = page.locator('.editor-widget.select').first().locator('select');
  expect(await control.evaluate(indices)).toEqual([2]); expect(await control.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(initial.pages[0].widgets[0].options);
  await expect(inspector(page).getByLabel('Widget text', { exact: true })).toHaveCount(0); await expect(inspector(page).getByLabel('Option 3 selected', { exact: true })).toBeChecked();
  await inspector(page).getByRole('button', { name: 'Move option 3 up', exact: true }).click(); await inspector(page).getByRole('button', { name: 'Remove option 1', exact: true }).click();
  await expect(inspector(page).getByLabel('Option 1 selected', { exact: true })).toBeChecked();
  await inspector(page).getByLabel('Option 1 text', { exact: true }).fill(' Keep \n inside '); await inspector(page).getByRole('button', { name: 'Add option', exact: true }).click();
  await inspector(page).getByLabel('Allow multiple selection', { exact: true }).check(); await expect(inspector(page).getByLabel('Select presentation', { exact: true })).toHaveValue('listbox');
  await inspector(page).getByLabel('Option 3 selected', { exact: true }).check(); await inspector(page).getByLabel('Option 5 selected', { exact: true }).check();
  await inspector(page).getByRole('button', { name: 'Move option 5 up', exact: true }).click(); await inspector(page).getByRole('button', { name: 'Remove option 2', exact: true }).click();
  const path = info.outputPath('multiple.rea.json'), multiple = await save(page, path);
  expect(multiple.pages[0].widgets[0]).toEqual({ ...initial.pages[0].widgets[0], options: [' Keep \n inside ', '', '', 'two\nlines'], selectedIndices: [0, 1, 2], multiple: true, selectMode: 'listbox' });
  expect(await control.evaluate(indices)).toEqual([0, 1, 2]); await expect(control).toHaveAttribute('size', '2');
  await inspector(page).getByLabel('Allow multiple selection', { exact: true }).uncheck(); expect((await save(page, info.outputPath('single.rea.json'))).pages[0].widgets[0].selectedIndices).toEqual([0]);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('undone.rea.json'))).toEqual(multiple);
  await reopen(page, path, doc.name); expect(await save(page, info.outputPath('reopened.rea.json'))).toEqual(multiple);
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay'), live = preview.locator('select[aria-label="Choices"]');
  expect(await live.evaluate(indices)).toEqual([0, 1, 2]); await live.selectOption([{ index: 2 }, { index: 3 }]); expect(await live.evaluate(indices)).toEqual([2, 3]);
  expect(await live.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual([' Keep \n inside ', '', '', 'two\nlines']);
  await preview.getByRole('button', { name: 'Close preview' }).click(); expect(await save(page, info.outputPath('after-preview.rea.json'))).toEqual(multiple);
  await select(page); await inspector(page).getByRole('button', { name: 'Clear option selection', exact: true }).click();
  for (let count = 4; count > 0; count--) await inspector(page).getByRole('button', { name: 'Remove option 1', exact: true }).click();
  await expect(inspector(page)).toContainText('No options.'); expect(await control.evaluate(indices)).toEqual([]); await expect(control.locator('option')).toHaveCount(0);
  const emptyPath = info.outputPath('empty.rea.json'), empty = await save(page, emptyPath); expect(empty.pages[0].widgets[0]).toEqual({ ...multiple.pages[0].widgets[0], options: [], selectedIndices: [] });
  await reopen(page, emptyPath, doc.name); await page.getByTitle('Preview (F5)', { exact: true }).click(); await expect(preview.locator('select[aria-label="Choices"] option')).toHaveCount(0); expect(await preview.locator('select[aria-label="Choices"]').evaluate(indices)).toEqual([]);
  expect(errors).toEqual([]);
});

test('option editing stays on the current widget in mixed selection, and authors exact selected-option actions and conditions', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { doc, field, second, input, button } = fixture(); await open(page, doc); const initial = await save(page, info.outputPath('mixed-initial.rea.json')); await select(page);
  await page.locator('.editor-widget.select').nth(1).click({ modifiers: ['Shift'] }); await page.locator('.editor-widget.input').click({ modifiers: ['Shift'] });
  await expect(page.locator('.editor-widget.is-selected')).toHaveCount(3); await expect(inspector(page).getByLabel('Widget name', { exact: true })).toHaveValue(field.name);
  await inspector(page).getByLabel('Option 3 text', { exact: true }).fill(' Same selection\nchanged value '); await inspector(page).getByLabel('Allow multiple selection', { exact: true }).check();
  await inspector(page).getByLabel('Option 4 selected', { exact: true }).check();
  const mixed = await save(page, info.outputPath('mixed-edited.rea.json'));
  expect(mixed.pages[0].widgets.slice(1)).toEqual(initial.pages[0].widgets.slice(1)); expect(mixed.pages[0].widgets[0]).toMatchObject({ selectedIndices: [2, 3], multiple: true, selectMode: 'listbox' });
  await page.locator('.editor-widget.button').click(); await inspector(page).getByRole('tab', { name: 'Interactions', exact: true }).click();
  await inspector(page).getByRole('button', { name: 'New interaction', exact: true }).click(); await inspector(page).getByRole('button', { name: 'Add action', exact: true }).click();
  const actionType = inspector(page).getByLabel('Action 1 type', { exact: true }), target = inspector(page).getByLabel('Action 1 target', { exact: true });
  await actionType.selectOption('setText'); await expect(target.locator(`option[value="${field.id}"]`)).toHaveCount(0); await expect(target.locator(`option[value="${input.id}"]`)).toHaveCount(1);
  await actionType.selectOption('setSelectedOption'); expect(await target.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(['', field.id, second.id]);
  await target.selectOption(field.id); await inspector(page).getByLabel('Action value', { exact: true }).fill('');
  await inspector(page).getByRole('button', { name: 'Add condition', exact: true }).click(); await inspector(page).getByLabel('Condition source', { exact: true }).selectOption('selectedOption');
  const conditionTarget = inspector(page).getByLabel('Condition target', { exact: true }); expect(await conditionTarget.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(['', field.id, second.id]);
  await conditionTarget.selectOption(field.id); await inspector(page).getByLabel('Condition value', { exact: true }).fill(' Same selection\nchanged value ');
  const path = info.outputPath('selection-actions.rea.json'), authored = await save(page, path), actionCase = authored.pages[0].widgets.find(widget => widget.id === button.id)!.interactions[0];
  expect(actionCase.conditions[0]).toMatchObject({ source: 'selectedOption', key: field.id, value: ' Same selection\nchanged value ' });
  expect(actionCase.actions[0]).toMatchObject({ type: 'setSelectedOption', targetId: field.id, value: '' });
  await reopen(page, path, doc.name); expect(await save(page, info.outputPath('selection-actions-reopened.rea.json'))).toEqual(authored);
  await expect(page.locator('.editor-widget.input input')).toHaveValue('Keep input'); expect(await page.locator('.editor-widget.select').nth(1).locator('select').evaluate(indices)).toEqual([0]); expect(errors).toEqual([]);
});
