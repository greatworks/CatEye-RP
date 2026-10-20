import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';
import { fontStyleFixture } from '../fixtures/font-style';

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Properties inspector' });
async function fileMenu(page: Page, name: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click();
}
async function open(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'font-style.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) }); await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page: Page, path: string): Promise<Document> {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); await (await download).saveAs(path); return JSON.parse(await readFile(path, 'utf8'));
}
async function reopen(page: Page, path: string, name: string) {
  await fileMenu(page, 'New Ctrl+N'); const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O'); await (await chooser).setFiles(path); await expect(page.locator('.titlebar')).toContainText(name);
}

test('authors independent font style and removable effect overrides, with adaptive normal reset, undo and save/reopen', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const doc = fontStyleFixture(), target = doc.pages[0].widgets[0]; delete target.style.fontStyle; delete target.mouseOverStyle; doc.pages[0].adaptiveViews[0].overrides = {};
  await open(page, doc); const initial = await save(page, info.outputPath('initial.rea.json')), canvas = page.locator('.editor-widget.box'); await canvas.click();
  await inspector(page).getByRole('tab', { name: 'Style', exact: true }).click(); const fontStyle = inspector(page).getByLabel('Font style', { exact: true });
  await expect(fontStyle).toHaveValue(''); await expect(canvas).toHaveCSS('font-style', 'normal');
  await fontStyle.selectOption('italic'); await expect(canvas).toHaveCSS('font-style', 'italic'); await expect(canvas).toHaveCSS('font-weight', '700');
  const italic = await save(page, info.outputPath('italic.rea.json')); expect(italic.pages[0].widgets[0]).toEqual({ ...initial.pages[0].widgets[0], style: { ...initial.pages[0].widgets[0].style, fontStyle: 'italic' } });
  await inspector(page).getByRole('tab', { name: 'Interactions', exact: true }).click(); await inspector(page).getByLabel('Effect to add', { exact: true }).selectOption('mouseOverStyle'); await inspector(page).getByRole('button', { name: 'Add style effect', exact: true }).click();
  const override = inspector(page).getByLabel('Override MouseOver font style', { exact: true }); await override.check(); await inspector(page).getByLabel('MouseOver font style', { exact: true }).selectOption('normal');
  await expect(canvas).toHaveCSS('font-style', 'normal'); await expect(canvas).toHaveCSS('font-weight', '700');
  const effect = await save(page, info.outputPath('effect.rea.json')); expect(effect.pages[0].widgets[0].style).toEqual(italic.pages[0].widgets[0].style); expect(effect.pages[0].widgets[0].mouseOverStyle).toEqual({ fontStyle: 'normal' });
  await override.uncheck(); await expect(canvas).toHaveCSS('font-style', 'italic'); expect((await save(page, info.outputPath('effect-inherited.rea.json'))).pages[0].widgets[0].mouseOverStyle).toEqual({});
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('effect-undo.rea.json'))).toEqual(effect);
  await canvas.click(); await inspector(page).getByRole('tab', { name: 'Style', exact: true }).click();
  await fontStyle.selectOption(''); const cleared = await save(page, info.outputPath('base-default.rea.json')); expect(cleared.pages[0].widgets[0].style).toEqual(initial.pages[0].widgets[0].style);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('base-undo.rea.json'))).toEqual(effect);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption(doc.pages[0].adaptiveViews[0].id); await canvas.click(); await fontStyle.selectOption('');
  await expect(canvas).toHaveCSS('font-style', 'normal'); const path = info.outputPath('adaptive-reset.rea.json'), adaptive = await save(page, path);
  expect(adaptive.pages[0].widgets[0].style.fontStyle).toBe('italic'); expect(adaptive.pages[0].adaptiveViews[0].overrides[target.id]).toEqual({ style: { fontStyle: 'normal' } });
  await reopen(page, path, doc.name); expect(await save(page, info.outputPath('reopened.rea.json'))).toEqual(adaptive);
  await canvas.click(); await expect(canvas).toHaveCSS('font-style', 'italic'); await page.getByLabel('Adaptive view', { exact: true }).selectOption(doc.pages[0].adaptiveViews[0].id); await expect(canvas).toHaveCSS('font-style', 'normal');
  await page.getByRole('button', { name: 'Reset adaptive overrides', exact: true }).click(); await expect(canvas).toHaveCSS('font-style', 'italic');
  expect((await save(page, info.outputPath('adaptive-cleared.rea.json'))).pages[0].adaptiveViews[0].overrides).toEqual({}); expect(errors).toEqual([]);
});

async function exercise(player: Page, scope: Locator) {
  const widget = (name: string) => scope.locator(`.widget[aria-label="${name}"]`), target = widget('Style target');
  await expect(target).toHaveCSS('font-style', 'italic'); await expect(target).toHaveCSS('font-weight', '700');
  await expect(widget('Italic parent')).toHaveCSS('font-style', 'italic'); await expect(widget('Italic repeater')).toHaveCSS('font-style', 'italic');
  for (const type of ['text', 'input', 'textarea', 'select', 'checkbox', 'radio', 'path']) {
    const child = widget(`Legacy ${type}`); await expect(child).toHaveCSS('font-style', 'normal');
    const content = child.locator('input,textarea,select,.widget-text,.check-widget span'); if (await content.count()) for (const item of await content.all()) await expect(item).toHaveCSS('font-style', 'normal');
  }
  await expect(widget('Legacy row caption')).toHaveCount(2); for (const row of await widget('Legacy row caption').all()) await expect(row).toHaveCSS('font-style', 'normal');
  await target.hover(); await expect(target).toHaveCSS('font-style', 'normal'); await player.mouse.move(10, 10); await expect(target).toHaveCSS('font-style', 'italic');
  await widget('Apply normal').click(); await expect(target).toHaveCSS('font-style', 'normal');
  await widget('Apply italic').click(); await expect(target).toHaveCSS('font-style', 'italic');
  await widget('Select target').click(); await expect(target).toHaveCSS('font-style', 'normal');
  await widget('Set error').click(); await expect(target).toHaveCSS('font-style', 'italic');
  await widget('Disable target').click(); await expect(target).toHaveCSS('font-style', 'normal');
  await widget('Enable target').click(); await expect(target).toHaveCSS('font-style', 'italic');
  await widget('Clear error').click(); await expect(target).toHaveCSS('font-style', 'normal');
  await widget('Clear selection').click(); await expect(target).toHaveCSS('font-style', 'italic'); await expect(target).toHaveCSS('font-weight', '700');
  await widget('Apply normal').click(); await expect(target).toHaveCSS('font-style', 'normal'); await expect(target).toHaveCSS('font-weight', '700');
  await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
}
for (const mode of ['preview', 'offline'] as const) test(`${mode}: italic composes by property, normal resets reused DOM and container typography never leaks to legacy children`, async ({ page, browser }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept()); const doc = fontStyleFixture(); await open(page, doc);
  expect(await save(page, info.outputPath('before.rea.json'))).toEqual(doc);
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page, page.locator('.preview-overlay')); await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const path = info.outputPath('font-style.html'); await (await download).saveAs(path);
    const context = await browser.newContext({ offline: true, viewport: { width: 1500, height: 1000 } });
    try {
      const player = await context.newPage(), network: string[] = []; player.on('pageerror', error => errors.push(error.message)); player.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
      await player.goto(pathToFileURL(path).href); await exercise(player, player.locator('body')); expect(network).toEqual([]);
    } finally { await context.close(); }
  }
  expect(await save(page, info.outputPath('after.rea.json'))).toEqual(doc); expect(errors).toEqual([]);
});
