import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, uid } from '../../src/model/document';
import type { Document } from '../../src/model/types';

test('Inspector preserves native comparison metadata and restricts its equality operators', async ({ page }, testInfo) => {
  const doc = createDocument(), input = createWidget('input', 40, 40), button = createWidget('button', 40, 140);
  doc.name = 'Native condition authoring'; input.name = 'Native comparison input'; button.text = 'Native comparison button';
  button.interactions = [{ id: uid(), event: 'click', name: 'Imported condition', enabled: true, conditionMode: 'all', conditions: [{ source: 'widgetText', key: input.id, operator: 'notEquals', value: '', comparisonMode: 'axure' }], actions: [] }];
  doc.pages[0].widgets = [input, button]; await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'native-comparison.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  await page.locator('.editor-widget.button').filter({ hasText: 'Native comparison button' }).click();
  const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click();
  await expect(inspector.getByText('Native comparison', { exact: true })).toBeVisible();
  const comparison = inspector.getByLabel('Condition comparison', { exact: true });
  expect(await comparison.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(['equals', 'notEquals']);
  await comparison.selectOption('equals'); await inspector.getByLabel('Condition value', { exact: true }).fill('FALSE');
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const path = testInfo.outputPath('native-comparison-edited.rea.json'); await (await download).saveAs(path);
  const saved = JSON.parse(await readFile(path, 'utf8')) as Document;
  expect(saved.pages[0].widgets[1].interactions[0].conditions[0]).toEqual({ source: 'widgetText', key: input.id, operator: 'equals', value: 'FALSE', comparisonMode: 'axure' });
});
