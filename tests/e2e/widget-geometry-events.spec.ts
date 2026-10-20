import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, uid } from '../../src/model/document';
import type { Document } from '../../src/model/types';

async function fileMenu(page: Page, action: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}
async function save(page: Page, path: string): Promise<Document> {
  const download = page.waitForEvent('download');
  await page.getByTitle('Save', { exact: true }).click();
  await (await download).saveAs(path);
  return JSON.parse(await readFile(path, 'utf8')) as Document;
}

test('ordinary widget move and resize events can be authored, saved and reopened without becoming page or row events', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept());
  const doc = createDocument(); doc.name = 'Widget geometry event authoring';
  const shape = createWidget('box', 40, 40); shape.name = 'Geometry event target'; shape.text = 'Observe my geometry';
  doc.pages[0].widgets = [shape];
  doc.pages[0].interactions = [{ id: uid(), name: 'Existing page case', event: 'click', enabled: true, conditionMode: 'all', conditions: [], actions: [] }];
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'geometry-events.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await page.locator('.editor-widget.box').click();
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click();
  for (const [event, name, value] of [
    ['resize', 'Size changed', '[[This.width]] × [[This.height]]'],
    ['move', 'Position changed', '[[This.x]], [[This.y]]'],
  ] as const) {
    await inspector.getByRole('button', { name: 'New interaction', exact: true }).click();
    await inspector.getByLabel('Interaction event', { exact: true }).last().selectOption(event);
    await inspector.getByLabel('Case name', { exact: true }).last().fill(name);
    const card = inspector.getByRole('region', { name: `${name} case`, exact: true });
    await expect(card.getByLabel('Interaction event', { exact: true }).locator('option[value="itemResize"]')).toHaveCount(0);
    await card.getByRole('button', { name: 'Add action', exact: true }).click();
    await card.getByLabel('Action 1 type', { exact: true }).selectOption('setText');
    await card.getByLabel('Action 1 target', { exact: true }).selectOption(shape.id);
    await card.getByLabel('Action value', { exact: true }).fill(value);
  }
  await inspector.getByLabel('Enable Position changed', { exact: true }).uncheck();
  const savedPath = info.outputPath('widget-geometry-events.rea.json'), saved = await save(page, savedPath);
  const authored = saved.pages[0].widgets[0].interactions;
  expect(authored.map(({ event, name, enabled }) => ({ event, name, enabled }))).toEqual([
    { event: 'resize', name: 'Size changed', enabled: true }, { event: 'move', name: 'Position changed', enabled: false },
  ]);
  expect(authored.map(caseOf => caseOf.actions.map(({ id: _id, ...action }) => action))).toEqual([
    [{ type: 'setText', targetId: shape.id, value: '[[This.width]] × [[This.height]]' }],
    [{ type: 'setText', targetId: shape.id, value: '[[This.x]], [[This.y]]' }],
  ]);
  expect({ ...saved.pages[0].widgets[0], interactions: [] }).toEqual(shape);
  expect(saved.pages[0].interactions).toEqual(doc.pages[0].interactions);
  await fileMenu(page, 'New Ctrl+N');
  const reopen = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O'); await (await reopen).setFiles(savedPath);
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  expect(await save(page, info.outputPath('widget-geometry-events-reopened.rea.json'))).toEqual(saved);
  await page.locator('.editor-widget.box').click();
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click();
  await expect(inspector.getByRole('region', { name: 'Resized event cases', exact: true })).toBeVisible();
  await expect(inspector.getByRole('region', { name: 'Moved event cases', exact: true })).toBeVisible();
  await expect(inspector.getByLabel('Enable Position changed', { exact: true })).not.toBeChecked();
  await page.screenshot({ path: info.outputPath('widget-geometry-events.png'), fullPage: true });
  await page.locator('.canvas-surface').click({ position: { x: 450, y: 300 } });
  const pageEvent = inspector.getByLabel('Interaction event', { exact: true });
  await expect(inspector.getByLabel('Case name', { exact: true })).toHaveValue('Existing page case');
  for (const event of ['resize', 'move', 'itemResize']) await expect(pageEvent.locator(`option[value="${event}"]`)).toHaveCount(0);
  expect(await save(page, info.outputPath('widget-geometry-events-page-context.rea.json'))).toEqual(saved);
});
