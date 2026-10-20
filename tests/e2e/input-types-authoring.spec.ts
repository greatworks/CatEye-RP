import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, serializeDocument } from '../../src/model/document';
import type { Document, InputType } from '../../src/model/types';

const types: InputType[] = ['text', 'password', 'email', 'number', 'tel', 'url', 'search', 'file', 'date', 'month', 'time'];
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Properties inspector' });
async function fileMenu(page: Page, name: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click();
}
async function open(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'input-types.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
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
  await page.locator('.editor-widget.input').nth(index).click(); await inspector(page).getByRole('tab', { name: 'Style', exact: true }).click();
}
function fixture(twoInputs = false) {
  const doc = createDocument(); doc.name = 'Input type authoring'; const input = createWidget('input', 40, 70), second = createWidget('input', 370, 70);
  Object.assign(input, { name: 'Preserved input', text: 'Keep text\n不能转换为日期 42', readOnly: true, maxLength: 7, hintText: 'Saved hint', hintHideOn: 'focus', hintStyle: { color: '#334455' } });
  Object.assign(second, { name: 'Second input', text: 'Second field text', hintText: 'Second hint', maxLength: 12 });
  const textarea = createWidget('textarea', 40, 200); textarea.name = 'Text area'; textarea.text = 'Textarea stays unchanged';
  const button = createWidget('button', 370, 200); button.name = button.text = 'Submit'; input.submitButtonId = button.id;
  doc.pages[0].widgets = twoInputs ? [input, second, textarea, button] : [input, textarea, button]; return doc;
}

test('authors all eleven input types without losing text or form settings, with File hint restrictions and undo/save/reopen', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const doc = fixture(); await open(page, doc); const initial = await save(page, info.outputPath('initial.rea.json')); await select(page);
  const type = inspector(page).getByLabel('Input type', { exact: true });
  expect(await type.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(types);
  await expect(type.locator('option[value="tel"]')).toHaveText('Phone'); await expect(type.locator('option[value="url"]')).toHaveText('URL');
  for (const inputType of types) {
    await type.selectOption(inputType); await expect(inspector(page).getByLabel('Widget text', { exact: true })).toHaveValue(initial.pages[0].widgets[0].text);
    const saved = await save(page, info.outputPath(`${inputType}.rea.json`));
    expect(saved).toEqual({ ...initial, pages: [{ ...initial.pages[0], widgets: [{ ...initial.pages[0].widgets[0], inputType }, ...initial.pages[0].widgets.slice(1)] }] });
    if (['number', 'file', 'date', 'month', 'time'].includes(inputType)) await expect(inspector(page)).toContainText('Maximum length is stored but does not limit this input type');
  }
  await page.getByTitle('Undo', { exact: true }).click(); expect((await save(page, info.outputPath('undone.rea.json'))).pages[0].widgets[0].inputType).toBe('month');
  await page.getByTitle('Redo', { exact: true }).click(); expect((await save(page, info.outputPath('redone.rea.json'))).pages[0].widgets[0].inputType).toBe('time');
  await select(page); await type.selectOption('file'); await expect(inspector(page)).toContainText('Files are not uploaded or saved with the project'); await expect(inspector(page)).toContainText('Read only does not apply to File inputs');
  await inspector(page).getByRole('tab', { name: 'Interactions', exact: true }).click();
  await expect(inspector(page).getByLabel('Hint text', { exact: true })).toBeDisabled(); await expect(inspector(page).getByLabel('Hint text', { exact: true })).toHaveValue('Saved hint');
  await expect(inspector(page).getByLabel('Hide hint after', { exact: true })).toBeDisabled(); await expect(inspector(page).getByRole('button', { name: 'Remove hint configuration', exact: true })).toBeDisabled();
  await expect(inspector(page).getByLabel('Effect to add', { exact: true }).locator('option[value="hintStyle"]')).toBeDisabled(); await expect(inspector(page).getByRole('button', { name: 'Edit Hint effect', exact: true })).toBeDisabled();
  await expect(inspector(page)).toContainText('File inputs do not support hints');
  const filePath = info.outputPath('file-persistent.rea.json'), authoredFile = await save(page, filePath); expect(authoredFile.pages[0].widgets[0]).toEqual({ ...initial.pages[0].widgets[0], inputType: 'file' });
  await reopen(page, filePath, doc.name); expect(await save(page, info.outputPath('file-reopened.rea.json'))).toEqual(authoredFile);
  await select(page); await type.selectOption('text'); await expect(inspector(page).getByLabel('Widget text', { exact: true })).toHaveValue(initial.pages[0].widgets[0].text);
  await inspector(page).getByRole('tab', { name: 'Interactions', exact: true }).click(); await expect(inspector(page).getByLabel('Hint text', { exact: true })).toBeEnabled(); await expect(inspector(page).getByLabel('Hide hint after', { exact: true })).toHaveValue('focus');
  await expect(inspector(page).getByRole('button', { name: 'Edit Hint effect', exact: true })).toBeEnabled();
  expect((await save(page, info.outputPath('back-to-text.rea.json'))).pages[0].widgets[0]).toEqual({ ...initial.pages[0].widgets[0], inputType: 'text' }); expect(errors).toEqual([]);
});

test('input type changes apply only to selected inputs and preserve each mixed-selection widget data', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const doc = fixture(true); await open(page, doc); const initial = await save(page, info.outputPath('mixed-initial.rea.json')); await select(page);
  await page.locator('.editor-widget.input').nth(1).click({ modifiers: ['Shift'] }); await page.locator('.editor-widget.textarea').click({ modifiers: ['Shift'] }); await page.locator('.editor-widget.button').click({ modifiers: ['Shift'] });
  await expect(page.locator('.editor-widget.is-selected')).toHaveCount(4); await expect(inspector(page).getByLabel('Widget name', { exact: true })).toHaveValue('Preserved input');
  for (const inputType of ['date', 'file', 'email'] as const) {
    await inspector(page).getByLabel('Input type', { exact: true }).selectOption(inputType); const saved = await save(page, info.outputPath(`mixed-${inputType}.rea.json`));
    expect(saved.pages[0].widgets).toEqual(initial.pages[0].widgets.map(widget => widget.type === 'input' ? { ...widget, inputType } : widget));
  }
  const path = info.outputPath('mixed-final.rea.json'), saved = await save(page, path); await reopen(page, path, doc.name); expect(await save(page, info.outputPath('mixed-reopened.rea.json'))).toEqual(saved);
  await expect(page.locator('.editor-widget.textarea textarea')).toHaveValue('Textarea stays unchanged'); await expect(page.locator('.editor-widget.button')).toHaveText('Submit'); expect(errors).toEqual([]);
});
