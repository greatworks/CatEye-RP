import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, serializeDocument } from '../../src/model/document';
import type { Document, Widget } from '../../src/model/types';

const effects = [
  ['mouseOverStyle', 'MouseOver', '#dd4422', 'rgb(221, 68, 34)'],
  ['mouseDownStyle', 'MouseDown', '#2266cc', 'rgb(34, 102, 204)'],
  ['focusedStyle', 'Focused', '#448822', 'rgb(68, 136, 34)'],
  ['selectedStyle', 'Selected', '#aa44cc', 'rgb(170, 68, 204)'],
  ['disabledStyle', 'Disabled', '#8899aa', 'rgb(136, 153, 170)'],
] as const;
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Properties inspector' });
const target = (page: Page) => page.locator('.editor-widget.button');
const peer = (page: Page) => page.locator('.editor-widget.input');
async function fileMenu(page: Page, action: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}
async function open(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'interaction-style-authoring.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
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
async function interactions(page: Page) { await inspector(page).getByRole('tab', { name: 'Interactions', exact: true }).click(); }
async function editEffect(page: Page, name: string) {
  await inspector(page).getByRole('button', { name: `Edit ${name} effect`, exact: true }).click();
  await expect(inspector(page).getByRole('group', { name: `${name} style effect`, exact: true })).toBeVisible();
}
async function number(page: Page, name: string, value: number) {
  const input = inspector(page).getByLabel(name, { exact: true }); await input.fill(String(value)); await input.press('Tab');
}
function fixture() {
  const doc = createDocument(); doc.name = 'Style effect authoring'; doc.caseSelection = 'never';
  const button = createWidget('button', 56, 72); button.name = button.text = 'Effect target'; button.width = 224; button.height = 64;
  button.style = { ...button.style, fill: '#f2eadd', stroke: '#334455', strokeWidth: 2, radius: 7, color: '#223344', opacity: 0.9 };
  const input = createWidget('input', 352, 72); input.name = 'Unrelated input'; input.text = 'Keep this control'; input.style.fill = '#effff7';
  const disabled = createWidget('box', 56, 216); disabled.name = disabled.text = 'Ordinary disabled shape'; disabled.disabled = true; disabled.width = 224;
  disabled.style.opacity = 0.85; disabled.disabledStyle = { fill: '#cbd5e1', opacity: 0.55 };
  doc.pages[0].widgets = [button, input, disabled]; return { doc, button, input, disabled };
}
function widget(doc: Document, id: string): Widget { return doc.pages[0].widgets.find(item => item.id === id)!; }
const baseBytes = (doc: Document) => JSON.stringify(doc.pages[0].widgets.map(item => [item.id, item.style]));
async function moveBy(page: Page, locator: Locator, dx: number, dy: number) {
  const box = await locator.boundingBox(); expect(box).not.toBeNull(); const zoom = Number(await page.getByLabel('Zoom', { exact: true }).inputValue());
  const x = box!.x + box!.width / 2, y = box!.y + box!.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx * zoom, y + dy * zoom, { steps: 5 }); await page.mouse.up();
}

test('Inspector authors style effects, previews without changing base styles, clears properties and effects, and persists undoable edits', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { doc, button, input, disabled } = fixture(); await open(page, doc);
  const initial = await save(page, info.outputPath('initial.rea.json'));
  await expect(page.locator('.editor-widget.box')).toHaveCSS('background-color', 'rgb(203, 213, 225)');
  await expect(page.locator('.editor-widget.box')).toHaveCSS('opacity', '0.55');
  await target(page).click(); await interactions(page);
  for (const [field, name, color, css] of effects) {
    await inspector(page).getByLabel('Effect to add', { exact: true }).selectOption(field);
    await inspector(page).getByRole('button', { name: 'Add style effect', exact: true }).click();
    await expect(inspector(page).getByRole('group', { name: `${name} style effect`, exact: true })).toBeVisible();
    await inspector(page).getByLabel(`Override ${name} fill`, { exact: true }).check();
    await inspector(page).getByLabel(`${name} fill`, { exact: true }).fill(color);
    await expect(target(page)).toHaveCSS('background-color', css);
    if (field === 'mouseOverStyle') {
      await inspector(page).getByLabel('Override MouseOver border width', { exact: true }).check(); await number(page, 'MouseOver border width', 4);
      await inspector(page).getByLabel('Override MouseOver opacity %', { exact: true }).check(); await number(page, 'MouseOver opacity %', 65);
      await expect(target(page)).toHaveCSS('border-top-width', '4px'); await expect(target(page)).toHaveCSS('opacity', '0.65');
    }
    if (field === 'focusedStyle') {
      await inspector(page).getByLabel('Override Focused text color', { exact: true }).check(); await inspector(page).getByLabel('Focused text color', { exact: true }).fill('#ffffff');
      await expect(target(page)).toHaveCSS('color', 'rgb(255, 255, 255)');
    }
    await inspector(page).getByRole('button', { name: 'Close effect', exact: true }).click();
    await expect(target(page)).toHaveCSS('background-color', 'rgb(242, 234, 221)');
    await expect(target(page)).toHaveCSS('border-top-width', '2px'); await expect(target(page)).toHaveCSS('opacity', '0.9');
  }
  const authored = await save(page, info.outputPath('authored.rea.json'));
  expect(widget(authored, button.id)).toEqual({ ...widget(initial, button.id), mouseOverStyle: { fill: '#dd4422', strokeWidth: 4, opacity: 0.65 }, mouseDownStyle: { fill: '#2266cc' }, focusedStyle: { fill: '#448822', color: '#ffffff' }, selectedStyle: { fill: '#aa44cc' }, disabledStyle: { fill: '#8899aa' } });
  expect(baseBytes(authored)).toBe(baseBytes(initial)); expect(widget(authored, input.id)).toEqual(widget(initial, input.id)); expect(widget(authored, disabled.id)).toEqual(widget(initial, disabled.id));

  // Opening and closing a preview is transient and must not create document history.
  for (const [, name, , css] of effects) {
    await editEffect(page, name); await expect(target(page)).toHaveCSS('background-color', css);
    await inspector(page).getByRole('button', { name: 'Close effect', exact: true }).click();
  }
  expect(await save(page, info.outputPath('preview-only.rea.json'))).toEqual(authored);
  await editEffect(page, 'MouseOver'); await inspector(page).getByLabel('Override MouseOver opacity %', { exact: true }).uncheck();
  await expect(target(page)).toHaveCSS('opacity', '0.9'); await expect(target(page)).toHaveCSS('background-color', 'rgb(221, 68, 34)');
  const cleared = await save(page, info.outputPath('property-cleared.rea.json'));
  expect(widget(cleared, button.id).mouseOverStyle).toEqual({ fill: '#dd4422', strokeWidth: 4 }); expect(baseBytes(cleared)).toBe(baseBytes(initial));
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('property-undo.rea.json'))).toEqual(authored);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info.outputPath('property-redo.rea.json'))).toEqual(cleared);
  await target(page).click(); await interactions(page); await editEffect(page, 'Focused');
  await inspector(page).getByRole('button', { name: 'Remove Focused effect', exact: true }).click();
  await expect(inspector(page).getByRole('button', { name: 'Edit Focused effect', exact: true })).toHaveCount(0);
  const removedPath = info.outputPath('effect-removed.rea.json'), removed = await save(page, removedPath);
  expect(widget(removed, button.id)).not.toHaveProperty('focusedStyle'); expect(baseBytes(removed)).toBe(baseBytes(initial));
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('effect-undo.rea.json'))).toEqual(cleared);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info.outputPath('effect-redo.rea.json'))).toEqual(removed);
  await reopen(page, removedPath, doc.name); expect(await save(page, info.outputPath('reopened.rea.json'))).toEqual(removed);
  await target(page).click(); await interactions(page);
  for (const [, name] of effects) await expect(inspector(page).getByRole('button', { name: `Edit ${name} effect`, exact: true })).toHaveCount(name === 'Focused' ? 0 : 1);
  await editEffect(page, 'MouseOver'); await expect(inspector(page).getByLabel('Override MouseOver opacity %', { exact: true })).not.toBeChecked();
  await expect(inspector(page).getByLabel('MouseOver border width', { exact: true })).toHaveValue('4');
  await expect(peer(page).locator('input')).toHaveValue('Keep this control'); expect(errors).toEqual([]);
});

test('effect preview ends on selection and tab changes and dragging preserves exact base-style bytes with one undo step', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept());
  const { doc, button, input } = fixture(); button.mouseOverStyle = { fill: '#dd4422', strokeWidth: 6, opacity: 0.45 }; input.mouseOverStyle = { fill: '#2266cc' };
  await open(page, doc); const initial = await save(page, info.outputPath('drag-initial.rea.json'));
  await target(page).click(); await interactions(page); await editEffect(page, 'MouseOver');
  await expect(target(page)).toHaveCSS('background-color', 'rgb(221, 68, 34)');
  expect(await save(page, info.outputPath('active-preview.rea.json'))).toEqual(initial);
  await peer(page).click();
  await expect(inspector(page).getByRole('group', { name: 'MouseOver style effect', exact: true })).toHaveCount(0);
  await expect(target(page)).toHaveCSS('background-color', 'rgb(242, 234, 221)'); await expect(peer(page)).toHaveCSS('background-color', 'rgb(239, 255, 247)');
  await editEffect(page, 'MouseOver'); await expect(peer(page)).toHaveCSS('background-color', 'rgb(34, 102, 204)');
  await inspector(page).getByRole('tab', { name: 'Style', exact: true }).click(); await expect(peer(page)).toHaveCSS('background-color', 'rgb(239, 255, 247)');
  await target(page).click(); await interactions(page); await editEffect(page, 'MouseOver');
  await moveBy(page, target(page), 32, 24);
  await expect(target(page)).toHaveCSS('background-color', 'rgb(221, 68, 34)');
  const moved = await save(page, info.outputPath('dragged-during-preview.rea.json'));
  expect(widget(moved, button.id)).toEqual({ ...widget(initial, button.id), x: button.x + 32, y: button.y + 24 });
  expect(widget(moved, input.id)).toEqual(widget(initial, input.id)); expect(baseBytes(moved)).toBe(baseBytes(initial));
  await inspector(page).getByRole('button', { name: 'Close effect', exact: true }).click();
  await expect(target(page)).toHaveCSS('background-color', 'rgb(242, 234, 221)'); await expect(target(page)).toHaveCSS('border-top-width', '2px'); await expect(target(page)).toHaveCSS('opacity', '0.9');
  expect(await save(page, info.outputPath('dragged-preview-closed.rea.json'))).toEqual(moved);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('drag-undone.rea.json'))).toEqual(initial);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info.outputPath('drag-redone.rea.json'))).toEqual(moved);
});
