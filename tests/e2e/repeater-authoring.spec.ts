import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget } from '../../src/model/document';
import type { Document } from '../../src/model/types';

function fixture() {
  const doc = createDocument(); doc.name = 'Repeater authoring'; doc.caseSelection = 'never';
  const repeater = createWidget('repeater', 40, 40); repeater.name = 'Rows target'; repeater.height = 500;
  repeater.repeater!.rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(Name => ({ Name }));
  const marked = createWidget('checkbox', 230, 9); marked.name = 'Marked row checkbox'; marked.text = ''; marked.width = 35; repeater.repeater!.template.push(marked);
  const button = createWidget('button', 500, 40); button.name = 'Authored actions'; button.text = 'Actions';
  const panel = createWidget('panel', 500, 250); panel.name = 'Not a repeater'; doc.pages[0].widgets = [repeater, button, panel];
  return { doc, repeater, button, panel };
}
async function menu(page: Page, action: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}
async function openFixture(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'repeater-authoring.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page: Page, path: string): Promise<Document> {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); await (await download).saveAs(path); return JSON.parse(await readFile(path, 'utf8')) as Document;
}
async function reopen(page: Page, path: string, name: string) {
  await menu(page, 'New Ctrl+N'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O'); await (await chooser).setFiles(path); await expect(page.locator('.titlebar')).toContainText(name);
}

test('initial repeater pagination retains decimals, displays exact editor bounds and is removable after save/open', async ({ page }, testInfo) => {
  page.on('dialog', dialog => dialog.accept()); const { doc } = fixture(); await openFixture(page, doc);
  await page.locator('.editor-widget.repeater').click(); const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  const rows = page.locator('.editor-widget.repeater > div > .repeater-row .widget-text');
  await expect(rows).toHaveText(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']); await expect(inspector.getByLabel('Enable pagination', { exact: true })).not.toBeChecked();
  await inspector.getByLabel('Enable pagination', { exact: true }).check(); await expect(inspector.getByLabel('Items per page', { exact: true })).toHaveValue('20'); await expect(inspector.getByLabel('Starting page', { exact: true })).toHaveValue('1');
  const field = async (name: string, value: string) => { const input = inspector.getByLabel(name, { exact: true }); await input.fill(value); await input.press('Tab'); };
  await field('Items per page', '2.5'); await expect(rows).toHaveText(['A', 'B', 'C']);
  await field('Items per page', '2'); await field('Starting page', '1.5'); await expect(rows).toHaveText(['B', 'C']);
  await field('Items per page', '3'); await expect(page.locator('.editor-widget.repeater').getByRole('alert')).toContainText('whole row index (1.5)');
  await field('Items per page', '2'); await expect(page.locator('.editor-widget.repeater').getByRole('alert')).toHaveCount(0);
  const path = testInfo.outputPath('initial-pagination.rea.json'), saved = await save(page, path);
  expect(saved.pages[0].widgets[0].repeater!.pagination).toEqual({ itemsPerPage: 2, startPage: 1.5 }); expect(saved.pages[0].widgets[0].repeater!.rows).toEqual(doc.pages[0].widgets[0].repeater!.rows);
  await reopen(page, path, doc.name); expect(await save(page, testInfo.outputPath('initial-pagination-reopened.rea.json'))).toEqual(saved);
  await page.locator('.editor-widget.repeater').click(); await expect(inspector.getByLabel('Starting page', { exact: true })).toHaveValue('1.5'); await expect(rows).toHaveText(['B', 'C']);
  await inspector.getByLabel('Enable pagination', { exact: true }).uncheck(); await expect(inspector.getByLabel('Items per page', { exact: true })).toHaveCount(0); await expect(rows).toHaveText(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  const clearedPath = testInfo.outputPath('pagination-removed.rea.json'), cleared = await save(page, clearedPath); expect(cleared.pages[0].widgets[0].repeater).not.toHaveProperty('pagination');
  expect(cleared.pages[0].widgets[0].repeater!.rows).toEqual(saved.pages[0].widgets[0].repeater!.rows); await reopen(page, clearedPath, doc.name); await expect(rows).toHaveCount(8);
});

test('row-action editors preserve Marked/matching selectors, legacy Delete values and paging expressions through save/open', async ({ page }, testInfo) => {
  page.on('dialog', dialog => dialog.accept()); const { doc, repeater, panel, button } = fixture(); await openFixture(page, doc);
  await page.locator('.editor-widget.button').click(); const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click(); await inspector.getByRole('button', { name: 'New interaction', exact: true }).click();
  const add = async (type: string) => {
    const index = await inspector.locator('.inspector-action').count(); await inspector.getByRole('button', { name: 'Add action', exact: true }).click();
    const card = inspector.locator('.inspector-action').nth(index); await card.getByLabel(`Action ${index + 1} type`, { exact: true }).selectOption(type);
    const target = card.getByLabel(`Action ${index + 1} target`, { exact: true });
    await expect(target.locator(`option[value="${panel.id}"]`)).toHaveCount(0); await expect(target.locator(`option[value="${button.id}"]`)).toHaveCount(0); await expect(target.locator('option')).toHaveCount(2); await target.selectOption(repeater.id); return card;
  };
  const mark = await add('markRows'); await expect(mark.getByLabel('Rows to mark', { exact: true }).locator('option[value="marked"]')).toHaveCount(0); await expect(mark.getByLabel('Rows to mark', { exact: true })).toHaveValue('this');
  await mark.getByLabel('Rows to mark', { exact: true }).selectOption('matching'); await mark.getByLabel('Mark match comparison', { exact: true }).selectOption('contains'); await mark.getByLabel('Mark match value', { exact: true }).fill('[[TargetItem.Name]]');
  const unmark = await add('unmarkRows'); await expect(unmark.getByLabel('Rows to unmark', { exact: true }).locator('option[value="marked"]')).toHaveCount(0); await unmark.getByLabel('Rows to unmark', { exact: true }).selectOption('all');
  const update = await add('updateRow'); await update.getByLabel('Rows to update', { exact: true }).selectOption('marked');
  await update.getByLabel('Updated columns', { exact: true }).fill('{"Unknown":"bad"}'); await update.getByRole('button', { name: 'Apply updated columns', exact: true }).click(); await expect(update.getByRole('alert')).toContainText('Unknown');
  await update.getByLabel('Updated columns', { exact: true }).fill('{"Name":"[[Item.isMarked]]"}'); await update.getByRole('button', { name: 'Apply updated columns', exact: true }).click(); await expect(update.getByRole('alert')).toHaveCount(0);
  const removeMarked = await add('deleteRow'); await removeMarked.getByLabel('Rows to delete', { exact: true }).selectOption('marked');
  const removeMatching = await add('deleteRow'); await removeMatching.getByLabel('Rows to delete', { exact: true }).selectOption('matching'); await removeMatching.getByLabel('Delete match comparison', { exact: true }).selectOption('isEmpty'); await expect(removeMatching.getByLabel('Delete match value', { exact: true })).toHaveCount(0);
  const legacy = await add('deleteRow'); await legacy.getByLabel('Delete all rows', { exact: true }).check(); await expect(legacy.getByLabel('Rows to delete', { exact: true })).toHaveValue('all');
  await legacy.getByLabel('Delete all rows', { exact: true }).uncheck(); await legacy.getByLabel('Row index (starts at 0)', { exact: true }).fill('2'); await legacy.getByLabel('Row index (starts at 0)', { exact: true }).press('Tab');
  const setPage = await add('setRepeaterPage'); await expect(setPage.getByLabel('Repeater page mode', { exact: true })).toHaveValue('next');
  for (const mode of ['previous', 'first', 'last', 'value']) await setPage.getByLabel('Repeater page mode', { exact: true }).selectOption(mode);
  await setPage.getByLabel('Repeater page value', { exact: true }).fill('[[Item.Repeater.pageIndex + 1]]');
  const pageSize = await add('setItemsPerPage'); await pageSize.getByLabel('Items per page value', { exact: true }).fill('2.5'); await expect(pageSize.getByLabel('Items per page value', { exact: true })).toHaveValue('2.5'); await pageSize.getByLabel('Items per page mode', { exact: true }).selectOption('all');
  await page.locator('.editor-widget.repeater').click(); await inspector.getByRole('button', { name: 'New interaction', exact: true }).click(); await inspector.getByLabel('Interaction event', { exact: true }).selectOption('itemLoad');
  await inspector.getByRole('button', { name: 'Add action', exact: true }).click(); await inspector.getByLabel('Action 1 type', { exact: true }).selectOption('setSelected'); await inspector.getByLabel('Action 1 target', { exact: true }).selectOption({ label: 'Rows target / Item / Marked row checkbox' });
  await inspector.getByLabel('Selection value', { exact: true }).selectOption('expression'); await expect(inspector.getByLabel('Selection expression', { exact: true })).toHaveValue('[[Item.isMarked]]');
  const path = testInfo.outputPath('row-actions.rea.json'), saved = await save(page, path), actions = saved.pages[0].widgets[1].interactions[0].actions;
  expect(actions.map(action => [action.type, action.targetId])).toEqual(['markRows', 'unmarkRows', 'updateRow', 'deleteRow', 'deleteRow', 'deleteRow', 'setRepeaterPage', 'setItemsPerPage'].map(type => [type, repeater.id]));
  expect(actions.map(action => action.value)).toEqual([
    JSON.stringify({ where: { column: 'Name', operator: 'contains', value: '[[TargetItem.Name]]' } }), JSON.stringify({ row: 'all' }),
    JSON.stringify({ row: 'marked', values: { Name: '[[Item.isMarked]]' } }), JSON.stringify({ row: 'marked' }), JSON.stringify({ where: { column: 'Name', operator: 'isEmpty', value: '' } }), '2', '[[Item.Repeater.pageIndex + 1]]', 'all',
  ]);
  expect(saved.pages[0].widgets[0].interactions).toMatchObject([{ event: 'itemLoad', actions: [{ type: 'setSelected', targetId: repeater.repeater!.template[1].id, value: '[[Item.isMarked]]' }] }]);
  await reopen(page, path, doc.name); expect(await save(page, testInfo.outputPath('row-actions-reopened.rea.json'))).toEqual(saved);
  await page.locator('.editor-widget.button').click(); await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click();
  await expect(inspector.getByLabel('Rows to mark', { exact: true })).toHaveValue('matching'); await expect(inspector.getByLabel('Rows to update', { exact: true })).toHaveValue('marked');
  await expect(inspector.getByLabel('Rows to delete', { exact: true })).toHaveCount(3); await expect(inspector.getByLabel('Rows to delete', { exact: true }).nth(0)).toHaveValue('marked'); await expect(inspector.getByLabel('Rows to delete', { exact: true }).nth(1)).toHaveValue('matching'); await expect(inspector.getByLabel('Row index (starts at 0)', { exact: true })).toHaveValue('2');
  await page.locator('.editor-widget.repeater').click(); await expect(inspector.getByLabel('Interaction event', { exact: true })).toHaveValue('itemLoad'); await expect(inspector.getByLabel('Selection value', { exact: true })).toHaveValue('expression'); await expect(inspector.getByLabel('Selection expression', { exact: true })).toHaveValue('[[Item.isMarked]]');
});
