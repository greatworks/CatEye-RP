import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createLayer, createWidget, parseDocument, serializeDocument } from '../../src/model/document';

function fixture() {
  const doc = createDocument(); doc.name = 'Layer adaptive rich display';
  const rich = createWidget('text', 100, 100);
  Object.assign(rich, { id: 'rich-display', name: 'Primary rich', width: 240, height: 60, text: 'Primary accent',
    richText: { paragraphs: [{ runs: [
      { text: 'Primary', style: { fontSize: 14, color: '#000000', fontStyle: 'italic' } },
      { text: ' accent', style: { fontSize: 19, color: '#123456', fontWeight: 700 } },
    ] }] } });
  const partial = createWidget('text', 100, 180);
  Object.assign(partial, { id: 'partial-display', name: 'Partial rich', width: 240, height: 60, text: 'Keep run size',
    richText: { paragraphs: [{ runs: [{ text: 'Keep run size', style: { fontSize: 17, color: '#224466' } }] }] } });
  partial.style.fontSize = 40; // Never flatten this Base default over the explicit 17px run.
  const inner = createLayer([rich, partial], 'Inner rich group');
  const panel = createWidget('panel', 420, 100), panelLabel = createWidget('text', 10, 10);
  Object.assign(panel, { width: 250, height: 110 });
  Object.assign(panelLabel, { id: 'panel-rich-display', width: 200, height: 50, text: 'Panel rich',
    richText: { paragraphs: [{ runs: [{ text: 'Panel rich', style: { fontSize: 13, color: '#000000' } }] }] } });
  panel.states![0].widgets = [createLayer([panelLabel])];
  const repeater = createWidget('repeater', 420, 240), rowLabel = createWidget('text', 10, 5);
  Object.assign(repeater, { width: 250, height: 140 });
  Object.assign(rowLabel, { id: 'row-rich-display', width: 220, height: 45, text: '[[Item.Name]]',
    richText: { paragraphs: [{ runs: [{ text: '[[Item.Name]]', style: { fontSize: 17, color: '#000000' } }] }] } });
  repeater.repeater!.template = [createLayer([createLayer([rowLabel])])];
  repeater.repeater!.itemHeight = 55;
  repeater.repeater!.columns = ['Name', 'Next'];
  repeater.repeater!.rows = [{ Name: 'Alpha', Next: 'WRONG second expansion' }, { Name: '[[Item.Next]]', Next: 'WRONG second expansion' }];
  doc.pages[0].widgets = [createLayer([inner, panel, repeater], 'Outer rich group')];
  doc.pages[0].adaptiveViews = [{ id: 'rich-view', name: 'Rich view', width: 1000, overrides: {
    'rich-display': { style: { fontSize: 32, color: '#ff0000' } },
    'partial-display': { style: { color: '#aa0088' } },
    'panel-rich-display': { style: { fontSize: 26, color: '#0000ff' } },
    'row-rich-display': { style: { fontSize: 24, color: '#008844' } },
  } }];
  return parseDocument(serializeDocument(doc));
}
async function save(page: Page, info: TestInfo, name: string) {
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath(`${name}.rea.json`); await (await pending).saveAs(file);
  return JSON.parse(await readFile(file, 'utf8'));
}
async function richStyle(owner: Locator, size: string, color: string) {
  const runs = owner.locator('[data-rich-run]'); await expect(runs.first()).toBeVisible();
  for (const run of await runs.all()) { await expect(run).toHaveCSS('font-size', size); await expect(run).toHaveCSS('color', color); }
}

test('closed and entered Layers share per-child adaptive rich display without changing saved text or expanding rows twice', async ({ page }, info) => {
  const doc = fixture(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(value => localStorage.setItem('rea-prototype-document-v1', value), serializeDocument(doc));
  await page.goto('/'); await expect(page.locator('.titlebar')).toContainText(doc.name);
  const canvas = page.locator('.canvas-surface');
  const member = (id: string) => canvas.locator(`[data-layer-member-id="${id}"]`);
  await expect(member('rich-display').locator('[data-rich-run]').first()).toHaveCSS('font-size', '14px');
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('rich-view');
  await richStyle(member('rich-display'), '32px', 'rgb(255, 0, 0)');
  await expect(member('rich-display').locator('[data-rich-run]').first()).toHaveCSS('font-style', 'italic');
  await expect(member('rich-display').locator('[data-rich-run]').nth(1)).toHaveCSS('font-weight', '700');
  await richStyle(member('partial-display'), '17px', 'rgb(170, 0, 136)');
  await richStyle(member('panel-rich-display'), '26px', 'rgb(0, 0, 255)');
  await expect(member('row-rich-display')).toHaveText(['Alpha', '[[Item.Next]]']);
  for (const row of await member('row-rich-display').all()) await richStyle(row, '24px', 'rgb(0, 136, 68)');

  await canvas.locator(':scope > .editor-widget.layer').dblclick();
  await expect(page.getByRole('button', { name: 'Exit Outer rich group', exact: true })).toBeVisible();
  await richStyle(member('rich-display'), '32px', 'rgb(255, 0, 0)');
  await canvas.locator(':scope > .editor-widget.layer').dblclick();
  await expect(page.getByRole('button', { name: 'Exit Inner rich group', exact: true })).toBeVisible();
  await richStyle(canvas.locator('.editor-widget.text').filter({ hasText: 'Primary accent' }), '32px', 'rgb(255, 0, 0)');
  await richStyle(canvas.locator('.editor-widget.text').filter({ hasText: 'Keep run size' }), '17px', 'rgb(170, 0, 136)');
  await page.getByRole('button', { name: 'Exit Inner rich group', exact: true }).click();
  await page.getByRole('button', { name: 'Exit Outer rich group', exact: true }).click();
  await richStyle(member('rich-display'), '32px', 'rgb(255, 0, 0)');
  expect(await save(page, info, 'unchanged-after-scopes')).toEqual(doc);

  // A real drag must not write the rendered run projection into shared content.
  const outer = canvas.locator(':scope > .editor-widget.layer'), box = (await outer.boundingBox())!;
  await page.mouse.move(box.x + 8, box.y + 8); await page.mouse.down();
  await page.mouse.move(box.x + 28, box.y + 18, { steps: 3 }); await page.mouse.up();
  const moved = await save(page, info, 'moved');
  const savedRuns = moved.pages[0].widgets[0].layer.widgets[0].layer.widgets[0].richText;
  expect(savedRuns).toEqual(doc.pages[0].widgets[0].layer!.widgets[0].layer!.widgets[0].richText);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'undo-drag')).toEqual(doc);

  await page.getByTitle('Preview (F5)', { exact: true }).click();
  const preview = page.locator('.preview-overlay');
  await preview.getByLabel('Adaptive view', { exact: true }).selectOption(JSON.stringify({ kind: 'view', viewId: 'rich-view' }));
  await richStyle(preview.locator('[data-widget-id="rich-display"]'), '32px', 'rgb(255, 0, 0)');
  await richStyle(preview.locator('[data-widget-id="partial-display"]'), '17px', 'rgb(170, 0, 136)');
  await expect(preview.locator('[data-widget-id="row-rich-display"]')).toHaveText(['Alpha', '[[Item.Next]]']);
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  expect(await save(page, info, 'unchanged-after-preview')).toEqual(doc);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('');
  await expect(member('rich-display').locator('[data-rich-run]').first()).toHaveCSS('font-size', '14px');
  await expect(member('partial-display').locator('[data-rich-run]')).toHaveCSS('font-size', '17px');
  await page.screenshot({ path: info.outputPath('layer-rich-display.png') });
  expect(errors).toEqual([]);
});
