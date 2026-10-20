import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Properties inspector' });
async function fileMenu(page: Page, action: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}
async function open(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'error-hint-authoring.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
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
async function select(page: Page, type: string) {
  await page.locator(`.editor-widget.${type}`).click(); await inspector(page).getByRole('tab', { name: 'Interactions', exact: true }).click();
}
async function effect(page: Page, type: 'errorStyle' | 'hintStyle', name: string, colorProperty: 'border' | 'text color' | 'fill', color: string) {
  await inspector(page).getByLabel('Effect to add', { exact: true }).selectOption(type);
  await inspector(page).getByRole('button', { name: 'Add style effect', exact: true }).click();
  await inspector(page).getByLabel(`Override ${name} ${colorProperty}`, { exact: true }).check();
  await inspector(page).getByLabel(`${name} ${colorProperty}`, { exact: true }).fill(color);
  await inspector(page).getByRole('button', { name: 'Close effect', exact: true }).click();
}
function fixture() {
  const doc = createDocument(); doc.name = 'Error and hint authoring'; doc.caseSelection = 'never'; doc.variables.ErrorFlag = 'true';
  const input = createWidget('input', 48, 64); input.name = 'Email'; input.style.color = '#223344';
  const textarea = createWidget('textarea', 48, 160); textarea.name = 'Feedback';
  const button = createWidget('button', 384, 64); button.name = button.text = 'Validation';
  const panel = createWidget('panel', 384, 160); panel.name = 'Error container';
  doc.pages[0].widgets = [input, textarea, button, panel]; return { doc, input, textarea, button, panel };
}
const baseStyles = (doc: Document) => JSON.stringify(doc.pages[0].widgets.map(widget => [widget.id, widget.style]));

test('authors literal input and textarea hints plus initial error, persists them, and removes configuration atomically with undo', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { doc } = fixture(); await open(page, doc); const initial = await save(page, info.outputPath('initial.rea.json'));
  await select(page, 'input'); await expect(inspector(page).getByLabel('Hide hint after', { exact: true })).toHaveValue('typing');
  await inspector(page).getByLabel('Hint text', { exact: true }).fill('Email [[literal hint]]');
  await inspector(page).getByLabel('Hide hint after', { exact: true }).selectOption('focus');
  await effect(page, 'hintStyle', 'Hint', 'text color', '#456789');
  await inspector(page).getByRole('button', { name: 'Edit Hint effect', exact: true }).click();
  await expect(page.locator('.editor-widget.input input')).toHaveValue('Email [[literal hint]]');
  await inspector(page).getByRole('button', { name: 'Close effect', exact: true }).click();
  await inspector(page).getByLabel('Error by default', { exact: true }).check();
  await effect(page, 'errorStyle', 'Error', 'border', '#cc1122');
  await expect(page.locator('.editor-widget.input')).toHaveCSS('border-top-color', 'rgb(204, 17, 34)');
  await expect(page.locator('.editor-widget.input input')).toHaveValue('Email [[literal hint]]');
  await select(page, 'textarea'); await inspector(page).getByLabel('Hint text', { exact: true }).fill('First line\nSecond line');
  await expect(inspector(page).getByLabel('Hide hint after', { exact: true })).toHaveValue('typing');
  await effect(page, 'hintStyle', 'Hint', 'text color', '#667788');
  await expect(page.locator('.editor-widget.textarea textarea')).toHaveValue('First line\nSecond line');
  const authoredPath = info.outputPath('authored.rea.json'), authored = await save(page, authoredPath), [savedInput, savedArea] = authored.pages[0].widgets;
  expect(savedInput).toEqual({ ...initial.pages[0].widgets[0], hintText: 'Email [[literal hint]]', hintHideOn: 'focus', hintStyle: { color: '#456789' }, error: true, errorStyle: { stroke: '#cc1122' } });
  expect(savedArea).toEqual({ ...initial.pages[0].widgets[1], hintText: 'First line\nSecond line', hintStyle: { color: '#667788' } });
  expect(savedInput.text).toBe(''); expect(savedArea.text).toBe(''); expect(savedArea).not.toHaveProperty('hintHideOn'); expect(baseStyles(authored)).toBe(baseStyles(initial));
  await page.screenshot({ path: info.outputPath('error-hint-authored.png') });
  await reopen(page, authoredPath, doc.name); expect(await save(page, info.outputPath('reopened.rea.json'))).toEqual(authored);
  await select(page, 'input'); await expect(inspector(page).getByLabel('Hint text', { exact: true })).toHaveValue('Email [[literal hint]]');
  await expect(inspector(page).getByLabel('Hide hint after', { exact: true })).toHaveValue('focus'); await expect(inspector(page).getByLabel('Error by default', { exact: true })).toBeChecked();
  await inspector(page).getByRole('button', { name: 'Remove hint configuration', exact: true }).click();
  const removed = await save(page, info.outputPath('hint-removed.rea.json'));
  for (const field of ['hintText', 'hintHideOn', 'hintStyle']) expect(removed.pages[0].widgets[0]).not.toHaveProperty(field);
  expect(removed.pages[0].widgets[0].error).toBe(true); expect(removed.pages[0].widgets[0].errorStyle).toEqual({ stroke: '#cc1122' });
  expect(removed.pages[0].widgets[1]).toEqual(savedArea); await expect(page.locator('.editor-widget.input input')).toHaveValue('');
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('hint-remove-undone.rea.json'))).toEqual(authored);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info.outputPath('hint-remove-redone.rea.json'))).toEqual(removed);
  await select(page, 'input'); await inspector(page).getByLabel('Error by default', { exact: true }).uncheck();
  await inspector(page).getByRole('button', { name: 'Edit Error effect', exact: true }).click();
  await inspector(page).getByRole('button', { name: 'Remove Error effect', exact: true }).click();
  const clearedPath = info.outputPath('configuration-cleared.rea.json'), cleared = await save(page, clearedPath);
  expect(cleared.pages[0].widgets[0]).toEqual(initial.pages[0].widgets[0]); expect(baseStyles(cleared)).toBe(baseStyles(initial));
  await reopen(page, clearedPath, doc.name); expect(await save(page, info.outputPath('cleared-reopened.rea.json'))).toEqual(cleared);
  expect(errors).toEqual([]);
});

test('authors Error set and Error removed handlers with all setError values and panel targets while Hint is restricted to text forms', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const { doc, panel } = fixture(); await open(page, doc); await select(page, 'button');
  await expect(inspector(page).getByLabel('Hint text', { exact: true })).toHaveCount(0);
  await expect(inspector(page).getByLabel('Effect to add', { exact: true }).locator('option[value="hintStyle"]')).toHaveCount(0);
  await inspector(page).getByLabel('Error by default', { exact: true }).check(); await effect(page, 'errorStyle', 'Error', 'fill', '#ffdddd');
  await inspector(page).getByRole('button', { name: 'New interaction', exact: true }).click();
  await inspector(page).getByLabel('Interaction event', { exact: true }).selectOption('errorSet');
  await inspector(page).getByLabel('Case name', { exact: true }).fill('On error');
  for (const [index, value] of ['true', 'false', 'toggle', 'expression'].entries()) {
    await inspector(page).getByRole('button', { name: 'Add action', exact: true }).click();
    const action = inspector(page).locator('.inspector-action').nth(index);
    await action.getByLabel(`Action ${index + 1} type`, { exact: true }).selectOption('setError');
    await expect(action.getByLabel(`Action ${index + 1} target`, { exact: true }).locator(`option[value="${panel.id}"]`)).toHaveCount(1);
    await action.getByLabel(`Action ${index + 1} target`, { exact: true }).selectOption(panel.id);
    await action.getByLabel('Error state value', { exact: true }).selectOption(value);
    if (value === 'expression') await action.getByLabel('Error expression', { exact: true }).fill('[[ErrorFlag]]');
  }
  await inspector(page).getByRole('button', { name: 'New interaction', exact: true }).click();
  await inspector(page).getByLabel('Interaction event', { exact: true }).last().selectOption('errorRemoved');
  await inspector(page).getByLabel('Case name', { exact: true }).last().fill('After removal');
  await expect(inspector(page).getByLabel('Interaction event', { exact: true }).first().locator('option[value="errorChange"]')).toHaveCount(0);
  const path = info.outputPath('error-actions.rea.json'), authored = await save(page, path), source = authored.pages[0].widgets[2];
  expect(source.error).toBe(true); expect(source.errorStyle).toEqual({ fill: '#ffdddd' });
  expect(source.interactions.map(item => [item.event, item.name])).toEqual([['errorSet', 'On error'], ['errorRemoved', 'After removal']]);
  expect(source.interactions[0].actions.map(action => [action.type, action.targetId, action.value])).toEqual(['true', 'false', 'toggle', '[[ErrorFlag]]'].map(value => ['setError', panel.id, value]));
  await reopen(page, path, doc.name); expect(await save(page, info.outputPath('error-actions-reopened.rea.json'))).toEqual(authored);
  await select(page, 'button'); await expect(inspector(page).getByLabel('Interaction event', { exact: true }).first()).toHaveValue('errorSet');
  await expect(inspector(page).getByLabel('Interaction event', { exact: true }).last()).toHaveValue('errorRemoved');
  await expect(inspector(page).getByLabel('Error expression', { exact: true })).toHaveValue('[[ErrorFlag]]');
  await select(page, 'panel'); await expect(inspector(page).getByLabel('Effect to add', { exact: true }).locator('option[value="hintStyle"]')).toHaveCount(0);
  await expect(inspector(page).getByLabel('Error by default', { exact: true })).toBeVisible();
});

test('hint authoring with a mixed form and shape selection never writes form-only fields to the shape', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const { doc } = fixture(); await open(page, doc);
  const initial = await save(page, info.outputPath('mixed-initial.rea.json'));
  await select(page, 'input'); await page.locator('.editor-widget.button').click({ modifiers: ['Shift'] });
  await expect(page.locator('.editor-widget.is-selected')).toHaveCount(2);
  await expect(inspector(page).getByLabel('Widget name', { exact: true })).toHaveValue('Email');
  await inspector(page).getByLabel('Hint text', { exact: true }).fill('Only text forms');
  await inspector(page).getByLabel('Hide hint after', { exact: true }).selectOption('focus');
  await effect(page, 'hintStyle', 'Hint', 'text color', '#445566');
  const path = info.outputPath('mixed-authored.rea.json'), authored = await save(page, path);
  expect(authored.pages[0].widgets[0]).toEqual({ ...initial.pages[0].widgets[0], hintText: 'Only text forms', hintHideOn: 'focus', hintStyle: { color: '#445566' } });
  expect(authored.pages[0].widgets[2]).toEqual(initial.pages[0].widgets[2]);
  for (const field of ['hintText', 'hintHideOn', 'hintStyle']) expect(authored.pages[0].widgets[2]).not.toHaveProperty(field);
  expect(baseStyles(authored)).toBe(baseStyles(initial));
  await reopen(page, path, doc.name); expect(await save(page, info.outputPath('mixed-reopened.rea.json'))).toEqual(authored);
  await expect(page.locator('.editor-widget.input input')).toHaveValue('Only text forms');
  await expect(page.locator('.editor-widget.button')).toContainText('Validation');
});
