import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createPage, createWidget, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Properties inspector' });
async function fileMenu(page: Page, action: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}
async function open(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'form-properties.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
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
async function select(page: Page, type: string, tab = 'Style') {
  await page.locator(`.editor-widget.${type}`).click(); await inspector(page).getByRole('tab', { name: tab, exact: true }).click();
}
async function length(page: Page, value: string) {
  const input = inspector(page).getByLabel('Maximum length', { exact: true }); await input.fill(value); await input.press('Tab');
}
function fixture() {
  const doc = createDocument(); doc.name = 'Form properties authoring'; doc.caseSelection = 'never';
  const input = createWidget('input', 48, 64); input.name = 'Name'; input.text = 'Existing full text';
  const textarea = createWidget('textarea', 48, 160); textarea.name = 'Comments'; textarea.text = 'First line\nSecond line';
  const button = createWidget('button', 384, 64); button.name = button.text = 'Submit';
  const panel = createWidget('panel', 384, 160); panel.name = 'Container';
  const repeater = createWidget('repeater', 48, 380); repeater.name = 'Rows';
  const other = createPage('Elsewhere'); other.widgets = [createWidget('button')]; other.widgets[0].name = 'Other page button';
  doc.pages[0].widgets = [input, textarea, button, panel, repeater]; doc.pages.push(other); return { doc, input, textarea, button, panel, repeater, other };
}

test('authors and removes read-only, maximum length, submit and focus options with save/reopen and undo', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { doc, input, button, panel, repeater, other } = fixture(); await open(page, doc); const initial = await save(page, info.outputPath('initial.rea.json'));
  await select(page, 'input'); await expect(inspector(page).getByLabel('Maximum length', { exact: true })).toHaveValue('');
  const submit = inspector(page).getByLabel('Submit button', { exact: true });
  for (const target of [panel, repeater, other.widgets[0]]) await expect(submit.locator(`option[value="${target.id}"]`)).toHaveCount(0);
  await expect(submit.locator(`option[value="${button.id}"]`)).toHaveCount(1);
  await inspector(page).getByLabel('Read only', { exact: true }).check(); await length(page, '7'); await submit.selectOption(button.id);
  await length(page, '1.5'); await expect(inspector(page).getByRole('alert')).toContainText('whole number');
  const invalid = await save(page, info.outputPath('invalid-draft.rea.json')); expect(invalid.pages[0].widgets[0].maxLength).toBe(7);
  await length(page, '0'); await expect(inspector(page).getByRole('alert')).toHaveCount(0);
  await select(page, 'textarea'); await expect(inspector(page).getByLabel('Maximum length', { exact: true })).toHaveCount(0);
  await inspector(page).getByLabel('Read only', { exact: true }).check(); await inspector(page).getByLabel('Submit button', { exact: true }).selectOption(button.id);
  await select(page, 'button', 'Interactions'); await inspector(page).getByRole('button', { name: 'New interaction', exact: true }).click();
  await inspector(page).getByRole('button', { name: 'Add action', exact: true }).click();
  await inspector(page).getByLabel('Action 1 type', { exact: true }).selectOption('setFocus'); await inspector(page).getByLabel('Action 1 target', { exact: true }).selectOption(input.id);
  await inspector(page).getByLabel('Select text', { exact: true }).check();
  const path = info.outputPath('authored.rea.json'), authored = await save(page, path), [savedInput, savedArea, savedButton] = authored.pages[0].widgets;
  expect(savedInput).toEqual({ ...initial.pages[0].widgets[0], readOnly: true, maxLength: 0, submitButtonId: button.id });
  expect(savedArea).toEqual({ ...initial.pages[0].widgets[1], readOnly: true, submitButtonId: button.id });
  expect(savedButton.interactions[0].actions[0]).toMatchObject({ type: 'setFocus', targetId: input.id, selectText: true });
  await reopen(page, path, doc.name); expect(await save(page, info.outputPath('reopened.rea.json'))).toEqual(authored);
  await select(page, 'input'); await expect(inspector(page).getByLabel('Read only', { exact: true })).toBeChecked(); await expect(inspector(page).getByLabel('Maximum length', { exact: true })).toHaveValue('0');
  await length(page, ''); const noLimit = await save(page, info.outputPath('no-limit.rea.json')); expect(noLimit.pages[0].widgets[0]).not.toHaveProperty('maxLength');
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('limit-restored.rea.json'))).toEqual(authored);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info.outputPath('limit-removed-again.rea.json'))).toEqual(noLimit);
  await select(page, 'input'); await inspector(page).getByLabel('Read only', { exact: true }).uncheck(); await inspector(page).getByLabel('Submit button', { exact: true }).selectOption('');
  await select(page, 'textarea'); await inspector(page).getByLabel('Read only', { exact: true }).uncheck(); await inspector(page).getByLabel('Submit button', { exact: true }).selectOption('');
  await select(page, 'button', 'Interactions'); await expect(inspector(page).getByLabel('Select text', { exact: true })).toBeChecked();
  await inspector(page).getByLabel('Action 1 type', { exact: true }).selectOption('show');
  await expect(inspector(page).getByLabel('Select text', { exact: true })).toHaveCount(0);
  const clearedPath = info.outputPath('cleared.rea.json'), cleared = await save(page, clearedPath);
  expect(cleared.pages[0].widgets[0]).toEqual(initial.pages[0].widgets[0]); expect(cleared.pages[0].widgets[1]).toEqual(initial.pages[0].widgets[1]);
  expect(cleared.pages[0].widgets[2].interactions[0].actions[0]).not.toHaveProperty('selectText');
  await reopen(page, clearedPath, doc.name); expect(await save(page, info.outputPath('cleared-reopened.rea.json'))).toEqual(cleared); expect(errors).toEqual([]);
});

test('mixed input, textarea and button selection only receives supported form fields and duplicates internal references', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { doc, button } = fixture(); await open(page, doc); const initial = await save(page, info.outputPath('mixed-initial.rea.json'));
  await select(page, 'input'); await page.locator('.editor-widget.textarea').click({ modifiers: ['Shift'] }); await page.locator('.editor-widget.button').click({ modifiers: ['Shift'] });
  await expect(page.locator('.editor-widget.is-selected')).toHaveCount(3); await expect(inspector(page).getByLabel('Widget name', { exact: true })).toHaveValue('Name');
  await inspector(page).getByLabel('Read only', { exact: true }).check(); await length(page, '9');
  await inspector(page).getByLabel('Input type', { exact: true }).selectOption('password'); await inspector(page).getByLabel('Submit button', { exact: true }).selectOption(button.id);
  const path = info.outputPath('mixed-authored.rea.json'), authored = await save(page, path), [savedInput, savedArea, savedButton] = authored.pages[0].widgets;
  expect(savedInput).toEqual({ ...initial.pages[0].widgets[0], readOnly: true, maxLength: 9, inputType: 'password', submitButtonId: button.id });
  expect(savedArea).toEqual({ ...initial.pages[0].widgets[1], readOnly: true, submitButtonId: button.id }); expect(savedButton).toEqual(initial.pages[0].widgets[2]);
  await reopen(page, path, doc.name); expect(await save(page, info.outputPath('mixed-reopened.rea.json'))).toEqual(authored);
  await select(page, 'input'); await page.locator('.editor-widget.textarea').click({ modifiers: ['Shift'] }); await page.locator('.editor-widget.button').click({ modifiers: ['Shift'] });
  // Use the actual editor command; focus is on the canvas, not the Inspector form controls.
  await page.keyboard.press('Control+d'); const copied = await save(page, info.outputPath('mixed-duplicated.rea.json'));
  const copies = copied.pages[0].widgets.filter(widget => !authored.pages[0].widgets.some(source => source.id === widget.id));
  expect(copies).toHaveLength(3); const copiedInput = copies.find(widget => widget.type === 'input')!, copiedArea = copies.find(widget => widget.type === 'textarea')!, copiedButton = copies.find(widget => widget.type === 'button')!;
  expect(copiedInput.submitButtonId).toBe(copiedButton.id); expect(copiedArea.submitButtonId).toBe(copiedButton.id); expect(copiedInput.maxLength).toBe(9); expect(copiedArea).not.toHaveProperty('maxLength');
  expect(copied.pages[0].widgets.slice(0, initial.pages[0].widgets.length)).toEqual(authored.pages[0].widgets); expect(errors).toEqual([]);
});
