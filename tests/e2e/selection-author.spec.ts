import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';

function fixture() {
  const doc = createDocument(); doc.name = 'Selection author commands';
  const widget = createWidget('checkbox', 100, 120);
  Object.assign(widget, { id: 'author-check', name: 'Author check', text: 'Longer label', width: 240, height: 40,
    selectionText: { autoFitWidth: false, autoFitHeight: false, alignRight: false } });
  Object.assign(widget.style, { fill: '#ffffff', stroke: '#123456', strokeWidth: 1, radius: 0,
    fontFamily: 'monospace', fontSize: 16, fontWeight: 400, lineHeight: 1.25,
    textAlign: 'left', verticalAlign: 'middle', textPadding: [1, 7, 1, 5], selectionButtonSize: 14 });
  widget.richText = { paragraphs: [{ lineHeightPx: 20, runs: [{ text: widget.text }] }] };
  doc.pages[0].widgets = [widget];
  return { doc, widget };
}
async function open(page: Page, doc: Document) {
  await page.goto('/');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'selection-author.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page: Page, info: TestInfo, name: string): Promise<Document> {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath(`${name}.rea.json`); await (await download).saveAs(file);
  return JSON.parse(await readFile(file, 'utf8'));
}
async function select(page: Page) {
  await page.locator('.canvas-surface .editor-widget.checkbox').click({ position: { x: 30, y: 10 } });
  await expect(page.getByLabel('Widget name', { exact: true })).toHaveValue('Author check');
}

test('selection text fit is one undoable command, persists through reopen, and indicator side is independent', async ({ page }, info) => {
  const { doc, widget } = fixture(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page, doc); await select(page);
  const owner = page.locator('.canvas-surface .editor-widget.checkbox');
  await expect(owner.locator('label')).toHaveAttribute('data-selection-fonts', 'ready');
  const textWidth = await owner.locator('[data-rich-paragraph]').evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    const width = range.getBoundingClientRect().width; range.detach(); return width;
  });
  const fittedWidth = Math.round(textWidth) + 26;
  await page.getByLabel('Fit selection width to text', { exact: true }).check();
  await expect(page.getByLabel('W', { exact: true })).toHaveValue(String(fittedWidth));
  const fitted = await save(page, info, 'width-fit');
  expect(fitted.pages[0].widgets[0]).toMatchObject({ width: fittedWidth, height: 20,
    selectionText: { autoFitWidth: true, autoFitHeight: false, alignRight: false } });
  await page.getByLabel('Fit selection height to text', { exact: true }).check();
  await expect(page.getByLabel('H', { exact: true })).toHaveValue('22');
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'undo-height')).toEqual(fitted);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'undo-width')).toEqual(doc);
  await page.getByTitle('Redo', { exact: true }).click();
  await page.getByTitle('Redo', { exact: true }).click();
  await select(page);
  await page.getByLabel('Selection indicator on right', { exact: true }).check();
  await expect(owner.locator('svg[data-selection-indicator]')).toHaveCSS('left', `${fittedWidth - 14}px`);
  const final = await save(page, info, 'right-indicator');
  expect(final.pages[0].widgets[0]).toMatchObject({ x: widget.x, y: widget.y - 1, width: fittedWidth, height: 22,
    selectionText: { autoFitWidth: true, autoFitHeight: true, alignRight: true } });
  await open(page, final); await select(page);
  await expect(page.getByLabel('Selection indicator on right', { exact: true })).toBeChecked();
  expect(await save(page, info, 'reopened')).toEqual(final);
  await page.screenshot({ path: info.outputPath('selection-author-fit.png') });
  expect(errors).toEqual([]);
});

test('all-view Size and internal current-view correction preserve their ordered scopes', async ({ page }, info) => {
  const { doc, widget } = fixture();
  doc.pages[0].adaptiveViews = [
    { id: 'author-mobile', name: 'Mobile', width: 700, overrides: { [widget.id]: { width: 260, height: 80, x: 150, style: { color: '#aa0000' } } } },
    { id: 'author-sibling', name: 'Sibling', width: 800, overrides: { [widget.id]: { width: 280, height: 90, y: 200, style: { color: '#0000aa' } } } },
  ];
  await open(page, doc);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('author-mobile'); await select(page);
  await page.getByLabel('Affect all views', { exact: true }).check();
  await page.getByLabel('W', { exact: true }).fill('300'); await page.getByLabel('W', { exact: true }).press('Enter');
  await expect(page.getByLabel('H', { exact: true })).toHaveValue('20');
  const edited = await save(page, info, 'all-views');
  expect(edited.pages[0].widgets[0]).toMatchObject({ width: 300, height: 80, x: widget.x, y: widget.y });
  expect(edited.pages[0].adaptiveViews[0].overrides[widget.id]).toEqual({ width: 300, height: 20, x: 150, style: { color: '#aa0000' } });
  expect(edited.pages[0].adaptiveViews[1].overrides[widget.id]).toEqual({ y: 200, style: { color: '#0000aa' } });
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'undo-all-views')).toEqual(doc);
});

test('current-view fit changes shared flags without overwriting sibling geometry', async ({ page }, info) => {
  const { doc, widget } = fixture();
  doc.pages[0].adaptiveViews = [
    { id: 'author-mobile', name: 'Mobile', width: 700, overrides: { [widget.id]: { width: 260, height: 80 } } },
    { id: 'author-sibling', name: 'Sibling', width: 800, overrides: { [widget.id]: { width: 280, height: 90 } } },
  ];
  await open(page, doc);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('author-mobile'); await select(page);
  await page.getByLabel('Affect all views', { exact: true }).check();
  await page.getByLabel('Fit selection width to text', { exact: true }).check();
  await expect(page.getByLabel('H', { exact: true })).toHaveValue('20');
  const edited = await save(page, info, 'local-fit');
  expect(edited.pages[0].widgets[0]).toEqual({ ...widget, selectionText: { ...widget.selectionText!, autoFitWidth: true } });
  expect(edited.pages[0].adaptiveViews[1]).toEqual(doc.pages[0].adaptiveViews[1]);
  expect(edited.pages[0].adaptiveViews[0].overrides[widget.id]).toMatchObject({ height: 20 });
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('author-sibling');
  expect(await save(page, info, 'view-only')).toEqual(edited);
});
