import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createPage, createWidget, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';

function fixture() {
  const doc = createDocument(); doc.name = 'Shared adaptive behavior';
  const first = doc.pages[0]; first.name = 'First'; first.id = 'first';
  const second = createPage('Second'); second.id = 'second'; doc.pages.push(second);
  doc.adaptiveViewSets = [{ id: 'devices', name: 'Devices', baseSize: { width: 0, height: 0 }, views: [
    { id: 'phone', name: 'Phone', width: 390, height: 0 }, { id: 'tall', name: 'Tall', width: 390, height: 800, baseViewId: 'phone' },
  ] }];
  for (const [index, page] of doc.pages.entries()) {
    const w = createWidget('box', 20, 30); w.id = `box-${index}`; w.name = `Box ${index}`; w.text = w.name; page.widgets = [w];
    page.adaptiveViewSetId = 'devices'; delete page.adaptiveSelection; delete page.adaptiveBaseSize;
    page.adaptiveOverrides = { phone: { [w.id]: { x: index ? 70 : 30, stateStyles: { selected: { fill: '#ff0000' } } } } };
  }
  return doc;
}
async function open(page: Page, doc: Document) {
  await page.addInitScript(value => localStorage.setItem('rea-prototype-document-v1', value), serializeDocument(doc));
  await page.goto('/'); await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page: Page, info: TestInfo, name: string): Promise<Document> {
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath(`${name}.rea.json`); await (await pending).saveAs(file); return JSON.parse(await readFile(file, 'utf8'));
}

test('shared dimensions synchronize across pages while local widget declarations remain independent', async ({ page }, info) => {
  const doc = fixture(); await open(page, doc);
  await expect(page.getByLabel('Adaptive view set', { exact: true })).toHaveValue('devices');
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('phone');
  await page.getByLabel('Adaptive view width', { exact: true }).fill('420'); await page.getByLabel('Adaptive view width', { exact: true }).press('Enter');
  await page.getByRole('treeitem', { name: 'Second', exact: true }).dblclick();
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('phone');
  await expect(page.getByLabel('Adaptive view width', { exact: true })).toHaveValue('420');
  await expect(page.locator('.canvas-surface > .widget')).toHaveCSS('left', '70px');
  const saved = await save(page, info, 'shared');
  expect(saved.adaptiveViewSets![0].views[0].width).toBe(420);
  expect(saved.pages.map(p => p.adaptiveViews)).toEqual([[], []]);
  expect(saved.pages[0].adaptiveOverrides).toEqual(doc.pages[0].adaptiveOverrides);
  expect(saved.pages[1].adaptiveOverrides).toEqual(doc.pages[1].adaptiveOverrides);
  await page.getByTitle('Undo', { exact: true }).click();
  await expect(page.getByLabel('Adaptive view width', { exact: true })).toHaveValue('390');
  await page.screenshot({ path: info.outputPath('shared-views.png') });
});

test('view-local effects snapshot inherited effects and restore inheritance without changing Base', async ({ page }, info) => {
  const doc = fixture(); await open(page, doc);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('tall');
  await page.locator('.canvas-surface > .widget').click(); await page.getByRole('tab', { name: 'Interactions', exact: true }).click();
  await expect(page.getByText('Effects inherited from parent', { exact: true })).toBeVisible();
  await page.getByLabel('Effect to add').selectOption('mouseOverStyle'); await page.getByRole('button', { name: 'Add style effect', exact: true }).click();
  await expect(page.getByText('Effects local to this view', { exact: true })).toBeVisible();
  const changed = await save(page, info, 'local-effects');
  expect(changed.pages[0].adaptiveOverrides!.tall['box-0'].stateStyles).toEqual({ selected: { fill: '#ff0000' }, mouseOver: {} });
  expect(changed.pages[0].widgets).toEqual(doc.pages[0].widgets);
  await page.getByRole('button', { name: 'Use inherited effects', exact: true }).click();
  await expect(page.getByText('Effects inherited from parent', { exact: true })).toBeVisible();
  const restored = await save(page, info, 'inherited-effects');
  expect(restored.pages[0].adaptiveOverrides?.tall?.['box-0']?.stateStyles).toBeUndefined();
  expect(restored.pages[0].adaptiveOverrides!.phone).toEqual(doc.pages[0].adaptiveOverrides!.phone);
});

test('authors page adaptive event and literal view targets, then clears the payload when action type changes', async ({ page }, info) => {
  await open(page, fixture()); await page.getByRole('tab', { name: 'Interactions', exact: true }).click();
  await page.getByRole('button', { name: 'New interaction', exact: true }).click();
  await page.getByLabel('Interaction event', { exact: true }).selectOption('adaptiveViewChange');
  await page.getByRole('button', { name: 'Add action', exact: true }).click();
  await page.getByLabel('Action 1 type').selectOption('setAdaptiveView');
  await page.getByLabel('Action 1 adaptive view', { exact: true }).selectOption('view:phone');
  const saved = await save(page, info, 'adaptive-action');
  expect(saved.pages[0].interactions[0]).toMatchObject({ event: 'adaptiveViewChange', actions: [{ type: 'setAdaptiveView', adaptiveView: { kind: 'view', viewId: 'phone' } }] });
  await page.getByLabel('Action 1 type').selectOption('wait');
  expect((await save(page, info, 'changed-action')).pages[0].interactions[0].actions[0]).not.toHaveProperty('adaptiveView');
  await page.locator('.canvas-surface > .widget').click();
  await page.getByRole('button', { name: 'New interaction', exact: true }).click();
  await expect(page.getByLabel('Interaction event').locator('option[value="adaptiveViewChange"]')).toHaveCount(0);
});

test('creates, renames, detaches and deletes an unused set while preserving page declarations', async ({ page }, info) => {
  const doc = fixture(); await open(page, doc);
  const nameSet = async (name: string) => { const dialog = page.getByRole('dialog', { name: 'Adaptive view set name' }); await dialog.getByRole('textbox').fill(name); await dialog.getByRole('button', { name: 'OK', exact: true }).click(); };
  await page.getByRole('button', { name: 'New view set', exact: true }).click(); await nameSet('Draft');
  await expect(page.getByLabel('Adaptive view set', { exact: true }).locator('option:checked')).toHaveText('Draft');
  await page.locator('.adaptive-set-manager > summary').click();
  await expect(page.getByRole('button', { name: 'Delete view set Draft', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Rename view set Draft', exact: true }).click(); await nameSet('Alternate');
  await page.getByLabel('Adaptive view set', { exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Delete view set Alternate', exact: true }).click();
  const saved = await save(page, info, 'managed-sets');
  expect(saved.adaptiveViewSets).toEqual(doc.adaptiveViewSets);
  expect(saved.pages[0]).not.toHaveProperty('adaptiveViewSetId');
  expect(saved.pages[0].adaptiveOverrides).toEqual(doc.pages[0].adaptiveOverrides);
  expect(saved.pages[1]).toEqual(doc.pages[1]);
});
