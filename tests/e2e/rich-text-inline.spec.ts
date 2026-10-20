import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Document, Widget } from '../../src/model/types';

const tools = (page: Page) => page.getByRole('region', { name: 'Text editing tools', exact: true });
const text = (page: Page) => page.getByRole('textbox', { name: 'Formatted text content', exact: true });
async function menu(page: Page, name: string) { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); }
async function open(page: Page, doc: Document) { await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O'); await (await chooser).setFiles({ name: 'inline.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) }); await expect(page.locator('.titlebar')).toContainText(doc.name); }
async function save(page: Page, path: string): Promise<Document> { const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); await (await download).saveAs(path); return JSON.parse(await readFile(path, 'utf8')); }
async function range(control: Locator, start: number, end: number, backward = false) { await control.focus(); await control.press('Control+Home'); for (let i = 0; i < (backward ? end : start); i++) await control.press('ArrowRight'); for (let i = start; i < end; i++) await control.press(backward ? 'Shift+ArrowLeft' : 'Shift+ArrowRight'); }
async function content(control: Locator) { return control.evaluate(node => Array.from(node.children, p => p.textContent ?? '').join('\n')); }
function fixture() {
  const doc = createDocument(); doc.name = 'Inline formatted text'; const caption = createWidget('box', 55, 55); caption.name = 'Inline caption'; caption.width = 440; caption.height = 210;
  caption.style = { ...caption.style, fontFamily: 'Arial', fontSize: 20, textAlign: 'left', textPadding: [12, 14, 16, 18], verticalAlign: 'top' };
  caption.richText = { paragraphs: [{ runs: [{ text: 'Alpha ', style: { color: '#123456' } }, { text: 'Beta', style: { fontWeight: 700, fontStyle: 'italic' } }] }, { runs: [{ text: 'Second' }] }] }; caption.text = 'Alpha Beta\nSecond';
  doc.pages[0].widgets = [caption]; doc.pages.push(createPage('Other page')); return { doc, caption };
}
function runs(widget: Widget) { return widget.richText!.paragraphs.flatMap(p => p.runs); }

test('canvas WYSIWYG uses actual glyph selection, pending caret marks, soft breaks and backward cross-paragraph replacement', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const { doc } = fixture(); await open(page, doc); const original = await save(page, info.outputPath('before.rea.json'));
  const box = page.locator('.editor-widget.box'); const oldText = await box.locator('[data-rich-run]').filter({ hasText: /^Beta$/ }).boundingBox();
  await box.dblclick(); const editable = text(page); await expect(editable).toBeVisible(); await expect(page.getByRole('dialog', { name: 'Edit formatted text' })).toHaveCount(0);
  const visibleBeta = editable.locator('[data-rich-run]').filter({ hasText: /^Beta$/ }); const newText = await visibleBeta.boundingBox();
  expect(newText!.x).toBeCloseTo(oldText!.x, 2); expect(newText!.y).toBeCloseTo(oldText!.y, 2); await expect(visibleBeta).toHaveCSS('font-style', 'italic');
  // Real pointer selection uses the rendered glyph range, not a synthetic Selection mutation.
  const bounds = await visibleBeta.evaluate(node => { const range = document.createRange(); range.selectNodeContents(node); const r = range.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await page.mouse.move(bounds.x + 0.2, bounds.y + bounds.height / 2); await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width - 0.2, bounds.y + bounds.height / 2, { steps: 8 }); await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Beta'); await tools(page).getByRole('button', { name: 'Underline selection', exact: true }).click(); await tools(page).getByRole('button', { name: 'Strikethrough selection', exact: true }).click(); await expect(visibleBeta).toHaveCSS('text-decoration-line', 'underline line-through');
  await editable.press('Control+End'); await tools(page).getByRole('button', { name: 'Italic selection', exact: true }).click(); await tools(page).getByRole('button', { name: 'Underline selection', exact: true }).click(); await editable.press('!');
  await editable.press('Shift+Enter'); await editable.press('Z'); await editable.press('Enter'); await editable.press('N');
  expect(await content(editable)).toBe('Alpha Beta\nSecond!\nZ\nN'); await expect(editable.locator('[data-rich-paragraph]')).toHaveCount(3); await expect(editable.locator('[data-rich-paragraph="1"]')).toHaveText('Second!\nZ');
  await range(editable, 6, 17, true); await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toContain('Beta'); await editable.press('Q');
  expect(await content(editable)).toBe('Alpha Q!\nZ\nN'); await editable.press('Control+z'); expect(await content(editable)).toBe('Alpha Beta\nSecond!\nZ\nN'); await editable.press('Control+y'); expect(await content(editable)).toBe('Alpha Q!\nZ\nN');
  await tools(page).getByRole('button', { name: 'Done editing text', exact: true }).click(); const saved = await save(page, info.outputPath('edited.rea.json')); expect(saved.pages[0].widgets[0].text).toBe('Alpha Q!\nZ\nN');
  expect(runs(saved.pages[0].widgets[0]).find(run => run.text.includes('!'))?.style).toMatchObject({ fontStyle: 'italic', underline: true });
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('undo.rea.json'))).toEqual(original); await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info.outputPath('redo.rea.json'))).toEqual(saved);
  await page.screenshot({ path: info.outputPath('inline-wysiwyg.png') });
});

test('rotated nested adaptive inline editing keeps the canvas geometry and shared rich baseline, and commits on leaving while Escape cancels', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const { doc, caption } = fixture(); const panel = createWidget('panel', 20, 30); panel.width = 650; panel.height = 500; panel.states![0].widgets = [caption]; doc.pages[0].widgets = [panel];
  const viewId = uid(); doc.pages[0].adaptiveViews = [{ id: viewId, name: 'Tablet', width: 768, overrides: { [caption.id]: { x: 80, y: 90, width: 320, height: 190, rotation: 20, style: { fontStyle: 'normal' } } } }];
  await open(page, doc); await page.getByLabel('Adaptive view', { exact: true }).selectOption(viewId); await page.locator('.editor-widget.panel').dblclick(); await page.getByLabel('Zoom', { exact: true }).selectOption('1.5');
  const box = page.locator('.editor-widget.box'), beforeRect = await box.boundingBox(), beforeStyle = await box.getAttribute('style'); await box.dblclick();
  await expect(text(page)).toBeVisible(); expect(await box.boundingBox()).toEqual(beforeRect); expect(await box.getAttribute('style')).toBe(beforeStyle); await expect(text(page).locator('[data-rich-run]').filter({ hasText: /^Beta$/ })).toHaveCSS('font-style', 'normal');
  await range(text(page), 0, 5); await tools(page).getByRole('button', { name: 'Underline selection', exact: true }).click(); await tools(page).getByRole('button', { name: 'Done editing text', exact: true }).click(); const saved = await save(page, info.outputPath('nested.rea.json')), child = saved.pages[0].widgets[0].states![0].widgets[0];
  expect({ x: child.x, y: child.y, width: child.width, height: child.height, rotation: child.rotation }).toEqual({ x: caption.x, y: caption.y, width: caption.width, height: caption.height, rotation: caption.rotation }); expect(saved.pages[0].adaptiveViews).toEqual(doc.pages[0].adaptiveViews); expect(child.richText!.paragraphs[0].runs[0].style!.underline).toBe(true); expect(child.richText!.paragraphs[0].runs.at(-1)!.style!.fontStyle).toBe('italic');
  await box.dblclick(); await text(page).press('Control+End'); await text(page).press('X'); await page.getByLabel('Adaptive view', { exact: true }).click(); await page.getByLabel('Adaptive view', { exact: true }).selectOption(''); await expect(text(page)).toHaveCount(0); const left = await save(page, info.outputPath('context-commit.rea.json')); expect(left.pages[0].widgets[0].states![0].widgets[0].text).toBe(caption.text+'X'); await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('context-undo.rea.json'))).toEqual(saved);
  await box.dblclick(); await text(page).press('Control+End'); await text(page).press('Y'); await text(page).press('Escape'); expect(await save(page, info.outputPath('escape-cancel.rea.json'))).toEqual(saved); await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('undo-single-session.rea.json'))).toEqual(doc);
});

test('canvas adaptive and temporary effect decorations compose once and editing unchanged plain text is a history no-op', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const { doc, caption } = fixture();
  delete caption.richText; caption.text = 'Plain caption'; caption.style.underline = true; caption.selected = true; caption.selectedStyle = { underline: false }; caption.mouseOverStyle = { strikethrough: true };
  const rich = createWidget('text', 55, 320); rich.text = 'Rich caption'; rich.style.underline = true; rich.selected = true; rich.selectedStyle = { underline: false }; rich.richText = { paragraphs: [{ runs: [{ text: 'Rich ', style: { underline: true } }, { text: 'caption', style: { underline: false, strikethrough: true } }] }] };
  const viewId = uid(); doc.pages[0].widgets.push(rich); doc.pages[0].adaptiveViews = [{ id: viewId, name: 'Tablet', width: 768, overrides: { [caption.id]: { style: { strikethrough: true } }, [rich.id]: { style: { strikethrough: true } } } }];
  await open(page, doc); const box = page.locator('.editor-widget.box');
  await expect(box.locator('.widget-text')).toHaveText('Plain caption'); await expect(box.locator('.widget-text')).toHaveCSS('text-decoration-line', 'none');
  await page.getByLabel('Adaptive view', { exact: true }).selectOption(viewId);
  // Combined false/true is ignored by the native CSS writer: restore original baselines.
  await expect(box.locator('.widget-text > span')).toHaveCSS('text-decoration-line', 'underline');
  await expect(page.locator('.editor-widget.text [data-rich-run]').nth(0)).toHaveCSS('text-decoration-line', 'underline'); await expect(page.locator('.editor-widget.text [data-rich-run]').nth(1)).toHaveCSS('text-decoration-line', 'line-through');
  await box.click(); const inspector = page.getByRole('complementary', { name: 'Properties inspector' }); await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click(); await inspector.getByRole('button', { name: 'Edit MouseOver effect', exact: true }).click();
  await expect(box.locator('.widget-text > span')).toHaveCSS('text-decoration-line', 'line-through'); await inspector.getByRole('button', { name: 'Close effect', exact: true }).click(); await expect(box.locator('.widget-text > span')).toHaveCSS('text-decoration-line', 'underline');
  expect(await save(page, info.outputPath('projection-only.rea.json'))).toEqual(doc);
  await box.click(); await page.keyboard.press('ArrowRight'); const moved = await save(page, info.outputPath('moved.rea.json')); await box.dblclick(); await tools(page).getByRole('button', { name: 'Done editing text', exact: true }).click(); expect(await save(page, info.outputPath('plain-no-op.rea.json'))).toEqual(moved); await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('no-op-undo.rea.json'))).toEqual(doc);
});
