import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget } from '../../src/model/document';
import type { Document } from '../../src/model/types';

async function menu(page: Page, action: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}
async function save(page: Page, path: string): Promise<Document> {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); await (await download).saveAs(path);
  return JSON.parse(await readFile(path, 'utf8')) as Document;
}
async function reopen(page: Page, path: string, name: string) {
  await menu(page, 'New Ctrl+N'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O'); await (await chooser).setFiles(path);
  await expect(page.locator('.titlebar')).toContainText(name);
}

test('Inspector authors repeater layout, box sides and resize events, preserves saved values, and clears layout back to legacy', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept());
  const doc = createDocument(); doc.name = 'Layout authoring workflow'; doc.caseSelection = 'never';
  const repeater = createWidget('repeater', 40, 40); repeater.name = 'Layout target';
  const outside = createWidget('button', 600, 40); outside.name = 'Outside repeater'; doc.pages[0].widgets = [repeater, outside];
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'layout-authoring.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  const canvas = page.locator('.editor-widget.repeater'), inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await canvas.click(); await expect(inspector.getByLabel('Repeater layout', { exact: true })).toHaveValue('vertical');
  expect(repeater.repeater).toMatchObject({ layout: 'vertical', gap: 0, itemWidth: 264, itemHeight: 41, fitToContent: true });
  expect([repeater.width, repeater.height]).toEqual([264, 123]); expect(repeater.style).toMatchObject({ strokeWidth: 0, fill: 'transparent' });
  await expect(inspector.getByLabel('Fit repeater items to content', { exact: true })).toBeChecked();
  await expect(inspector.getByLabel('Item width', { exact: true })).toHaveValue(String(repeater.width));
  await expect(inspector.getByLabel('Horizontal gap', { exact: true })).toHaveValue(String(repeater.repeater!.gap));
  await expect(inspector.getByLabel('Vertical gap', { exact: true })).toHaveValue(String(repeater.repeater!.gap));
  const number = async (label: string, value: string) => { const input = inspector.getByLabel(label, { exact: true }); await input.fill(value); await input.press('Tab'); };
  await inspector.getByLabel('Repeater layout', { exact: true }).selectOption('horizontal');
  await inspector.getByLabel('Wrap repeater items', { exact: true }).check(); await expect(inspector.getByLabel('Items before wrap', { exact: true })).toHaveValue('2');
  await number('Items before wrap', '3'); await number('Items before wrap', '2');
  await number('Item width', '100'); await number('Item height', '30'); await number('Horizontal gap', '12'); await number('Vertical gap', '9');
  await inspector.getByLabel('Fit repeater items to content', { exact: true }).check();
  await expect(canvas).toHaveCSS('width', '212px'); await expect(canvas).toHaveCSS('height', '69px');
  const rows = canvas.locator('.repeater-row'); await expect(rows).toHaveCount(3); await expect(rows.nth(2)).toHaveCSS('left', '0px'); await expect(rows.nth(2)).toHaveCSS('top', '39px');
  const sides = ['top', 'right', 'bottom', 'left'] as const, padding = [3, 7, 11, 17], borders = [1, 2, 4, 6];
  await inspector.getByLabel('Independent border widths', { exact: true }).check();
  for (const [index, side] of sides.entries()) {
    await number(`Repeater padding ${side}`, String(padding[index])); await number(`Border ${side}`, String(borders[index]));
  }

  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click(); await inspector.getByRole('button', { name: 'New interaction', exact: true }).click();
  await inspector.getByLabel('Interaction event', { exact: true }).selectOption('itemResize');
  await inspector.getByLabel('Case name', { exact: true }).fill('Item size changed');
  for (let index = 1; index <= 2; index++) {
    await inspector.getByRole('button', { name: 'Add action', exact: true }).click();
    const card = inspector.locator('.inspector-action').nth(index - 1); await card.getByLabel(`Action ${index} type`, { exact: true }).selectOption('resizeItem');
    await expect(card.getByLabel(`Action ${index} target`, { exact: true })).toHaveValue(repeater.id);
    await expect(card.getByLabel(`Action ${index} target`, { exact: true }).locator(`option[value="${outside.id}"]`)).toHaveCount(0);
    await expect(card.getByLabel('Resize item width', { exact: true })).not.toBeChecked(); await expect(card.getByLabel('Resize item height', { exact: true })).not.toBeChecked();
    if (index === 2) {
      await card.getByLabel('Resize item width', { exact: true }).check(); await card.getByLabel('Resize item height', { exact: true }).check();
      await number('Item target width', '0'); await number('Item target height', '0');
    }
  }
  const path = info.outputPath('layout-authored.rea.json'), saved = await save(page, path), savedRepeater = saved.pages[0].widgets[0];
  expect(savedRepeater.repeater).toEqual({ ...repeater.repeater, layout: 'horizontal', wrap: 2, itemWidth: 100, itemHeight: 30, horizontalGap: 12, verticalGap: 9, fitToContent: true, padding });
  expect(savedRepeater.style).toEqual({ ...repeater.style, borderWidths: borders });
  const authored = savedRepeater.interactions[0]; expect(authored.event).toBe('itemResize'); expect(authored.name).toBe('Item size changed');
  expect(authored.actions[0]).toEqual({ id: authored.actions[0].id, type: 'resizeItem', targetId: repeater.id });
  expect(authored.actions[1]).toEqual({ id: authored.actions[1].id, type: 'resizeItem', targetId: repeater.id, x: 0, y: 0 });
  await reopen(page, path, doc.name); expect(await save(page, info.outputPath('layout-reopened.rea.json'))).toEqual(saved);
  await canvas.click(); await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click();
  await expect(inspector.getByLabel('Interaction event', { exact: true })).toHaveValue('itemResize');
  const first = inspector.locator('.inspector-action').first(), second = inspector.locator('.inspector-action').nth(1);
  await expect(first.getByLabel('Resize item width', { exact: true })).not.toBeChecked(); await expect(first.getByLabel('Resize item height', { exact: true })).not.toBeChecked();
  await expect(second.getByLabel('Item target width', { exact: true })).toHaveValue('0'); await expect(second.getByLabel('Item target height', { exact: true })).toHaveValue('0');
  await inspector.getByRole('tab', { name: 'Style', exact: true }).click();
  await expect(inspector.getByLabel('Repeater layout', { exact: true })).toHaveValue('horizontal'); await expect(inspector.getByLabel('Wrap repeater items', { exact: true })).toBeChecked();
  await expect(inspector.getByLabel('Fit repeater items to content', { exact: true })).toBeChecked();
  await expect(inspector.getByLabel('Independent border widths', { exact: true })).toBeChecked();
  for (const [index, side] of sides.entries()) {
    await expect(inspector.getByLabel(`Repeater padding ${side}`, { exact: true })).toHaveValue(String(padding[index]));
    await expect(inspector.getByLabel(`Border ${side}`, { exact: true })).toHaveValue(String(borders[index]));
  }
  // Recommitting the unchanged common width deliberately clears independent sides.
  const commonStroke = inspector.getByLabel('Stroke', { exact: true });
  await commonStroke.fill(''); await commonStroke.fill('0'); await commonStroke.press('Tab');
  await expect(inspector.getByLabel('Independent border widths', { exact: true })).not.toBeChecked();
  await inspector.getByRole('button', { name: 'Clear repeater padding', exact: true }).click();
  const clearedSides = await save(page, info.outputPath('layout-sides-cleared.rea.json'));
  expect(clearedSides.pages[0].widgets[0].style).not.toHaveProperty('borderWidths');
  expect(clearedSides.pages[0].widgets[0].repeater).not.toHaveProperty('padding');
  expect(clearedSides.pages[0].widgets[0].repeater!.layout).toBe('horizontal');
  await number('Stroke', '2'); await inspector.getByLabel('Independent border widths', { exact: true }).check();
  for (const side of sides) await expect(inspector.getByLabel(`Border ${side}`, { exact: true })).toHaveValue('2');
  await number('Border left', '8'); await inspector.getByLabel('Independent border widths', { exact: true }).uncheck();
  await expect(inspector.getByLabel('Stroke', { exact: true })).toHaveValue('2');
  await number('Repeater padding top', '9');
  await inspector.getByLabel('Repeater layout', { exact: true }).selectOption('legacy');
  await expect(inspector.getByLabel('Item width', { exact: true })).toHaveCount(0); await expect(inspector.getByLabel('Wrap repeater items', { exact: true })).toHaveCount(0);
  await expect(canvas).toHaveCSS('width', `${repeater.width}px`); await expect(canvas).toHaveCSS('height', `${repeater.height}px`);
  const legacyPath = info.outputPath('layout-cleared.rea.json'), legacy = await save(page, legacyPath);
  expect(legacy.pages[0].widgets[0].repeater).toEqual({ columns: repeater.repeater!.columns, rows: repeater.repeater!.rows, template: repeater.repeater!.template, gap: 0, itemHeight: 30 });
  expect(legacy.pages[0].widgets[0].style).toEqual({ ...repeater.style, strokeWidth: 2 });
  expect(legacy.pages[0].widgets[0].interactions).toEqual(savedRepeater.interactions);
  await reopen(page, legacyPath, doc.name); expect(await save(page, info.outputPath('layout-cleared-reopened.rea.json'))).toEqual(legacy);
  await canvas.click(); await inspector.getByRole('tab', { name: 'Style', exact: true }).click(); await expect(inspector.getByLabel('Repeater layout', { exact: true })).toHaveValue('legacy');
});
