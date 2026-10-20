import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, uid } from '../../src/model/document';
import type { Document } from '../../src/model/types';

function fixture() {
  const doc = createDocument(); doc.name = 'Named repeater authoring'; doc.caseSelection = 'never';
  const repeater = createWidget('repeater', 40, 40); repeater.name = 'Data target'; repeater.repeater!.columns = ['Name', 'Age']; repeater.repeater!.rows = [];
  const alternate = createWidget('repeater', 40, 300); alternate.name = 'Alternate data'; alternate.repeater!.columns = ['Other']; alternate.repeater!.rows = [];
  const button = createWidget('button', 500, 40); button.name = 'Rule author'; button.text = 'Configure';
  const panel = createWidget('panel', 500, 250); panel.name = 'Not a repeater';
  doc.pages[0].widgets = [repeater, alternate, button, panel];
  return { doc, repeater, alternate, button, panel };
}
async function menu(page: Page, action: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}
async function open(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'named-rules.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page: Page, path: string): Promise<Document> {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); await (await download).saveAs(path);
  return JSON.parse(await readFile(path, 'utf8')) as Document;
}
async function reopen(page: Page, path: string, name: string) {
  await menu(page, 'New Ctrl+N'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O'); await (await chooser).setFiles(path);
  await expect(page.locator('.titlebar')).toContainText(name);
}
async function editButton(page: Page) {
  await page.locator('.editor-widget.button').click(); const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click(); return inspector;
}
async function addAction(inspector: Locator, type: string, targetId: string) {
  const index = await inspector.locator('.inspector-action').count(); await inspector.getByRole('button', { name: 'Add action', exact: true }).click();
  const card = inspector.locator('.inspector-action').nth(index); await card.getByLabel(`Action ${index + 1} type`, { exact: true }).selectOption(type);
  await card.getByLabel(`Action ${index + 1} target`, { exact: true }).selectOption(targetId); return card;
}

test('Loaded authors multiple named filters and typed sorts, preserving every option through save/open', async ({ page }, testInfo) => {
  page.on('dialog', dialog => dialog.accept()); const { doc, repeater, button, panel } = fixture(); await open(page, doc);
  const inspector = await editButton(page); await inspector.getByRole('button', { name: 'New interaction', exact: true }).click();
  await inspector.getByLabel('Interaction event', { exact: true }).selectOption('load');
  const expected: { type: string; spec: unknown }[] = [];
  for (const mode of ['smart', 'all', 'any']) {
    const card = await addAction(inspector, 'addFilter', repeater.id);
    await card.getByLabel('Named filter name', { exact: true }).fill(' same name ');
    await card.getByLabel('Named filter expression', { exact: true }).fill('[[TargetItem.Name == "Alice"]]');
    await card.getByLabel('Named filter combination', { exact: true }).selectOption(mode);
    if (mode !== 'any') await card.getByLabel('Named filter column group', { exact: true }).selectOption('Name');
    if (mode === 'any') await card.getByLabel('Remove other filters', { exact: true }).check();
    await expect(card.getByRole('alert')).toHaveCount(0); await expect(card).toContainText('Same-name filters are appended');
    expected.push({ type: 'addFilter', spec: { name: ' same name ', expression: '[[TargetItem.Name == "Alice"]]', mode, removeOthers: mode === 'any', ...(mode === 'any' ? {} : { column: 'Name' }) } });
  }
  const sort = await addAction(inspector, 'addSort', repeater.id);
  const target = sort.getByLabel('Action 4 target', { exact: true });
  await expect(target.locator(`option[value="${button.id}"]`)).toHaveCount(0); await expect(target.locator(`option[value="${panel.id}"]`)).toHaveCount(0);
  await expect(target.locator('option')).toHaveCount(3); await expect(sort.getByLabel('Named sort column', { exact: true })).toHaveValue('Name');
  await sort.getByLabel('Named sort name', { exact: true }).fill('Priority'); await sort.getByLabel('Named sort column', { exact: true }).selectOption('Age');
  await sort.getByLabel('Named sort direction', { exact: true }).selectOption('desc');
  for (const type of ['number', 'text', 'textCase', 'natural', 'dateYMD', 'dateMDY', 'dateDMY']) await sort.getByLabel('Named sort data type', { exact: true }).selectOption(type);
  await sort.getByLabel('Toggle existing sort direction', { exact: true }).check(); await sort.getByLabel('Remove other sorts', { exact: true }).check();
  expected.push({ type: 'addSort', spec: { name: 'Priority', column: 'Age', direction: 'desc', dataType: 'dateDMY', toggle: true, removeOthers: true } });
  const secondSort = await addAction(inspector, 'addSort', repeater.id); await secondSort.getByLabel('Named sort name', { exact: true }).fill('Priority');
  expected.push({ type: 'addSort', spec: { name: 'Priority', column: 'Name', direction: 'asc', dataType: 'text', toggle: false, removeOthers: false } });
  const removeFilter = await addAction(inspector, 'removeFilter', repeater.id); await removeFilter.getByLabel('Remove filter name', { exact: true }).fill(' same name ');
  expected.push({ type: 'removeFilter', spec: { name: ' same name ' } });
  const removeSort = await addAction(inspector, 'removeSort', repeater.id); await removeSort.getByLabel('Remove sort scope', { exact: true }).selectOption('all');
  await expect(removeSort.getByLabel('Remove sort name', { exact: true })).toHaveCount(0); expected.push({ type: 'removeSort', spec: { all: true } });
  const path = testInfo.outputPath('loaded-named-rules.rea.json'), saved = await save(page, path), interaction = saved.pages[0].widgets[2].interactions[0];
  expect(interaction.event).toBe('load'); expect(interaction.actions.map(action => ({ type: action.type, spec: JSON.parse(action.value!) }))).toEqual(expected);
  expect(interaction.actions.every(action => action.targetId === repeater.id)).toBe(true);
  expect(saved.pages[0].widgets[0].repeater).toEqual(repeater.repeater); expect(saved.pages[0].widgets[0].repeater!.rows).toEqual([]);
  await reopen(page, path, doc.name); expect(await save(page, testInfo.outputPath('loaded-named-rules-reopened.rea.json'))).toEqual(saved);
  await editButton(page); await expect(inspector.getByLabel('Interaction event', { exact: true })).toHaveValue('load');
  await expect(inspector.getByLabel('Named filter name', { exact: true })).toHaveCount(3);
  for (let index = 0; index < 3; index++) await expect(inspector.getByLabel('Named filter name', { exact: true }).nth(index)).toHaveValue(' same name ');
  await expect(inspector.getByLabel('Named filter combination', { exact: true }).nth(2)).toHaveValue('any');
  await expect(inspector.getByLabel('Named sort data type', { exact: true }).first()).toHaveValue('dateDMY');
  await expect(inspector.getByLabel('Toggle existing sort direction', { exact: true }).first()).toBeChecked();
  await expect(inspector.getByLabel('Remove sort scope', { exact: true })).toHaveValue('all');
});

test('named rule editors expose invalid expressions and target changes without migrating legacy actions', async ({ page }, testInfo) => {
  page.on('dialog', dialog => dialog.accept()); const { doc, repeater, alternate, button } = fixture();
  const legacyFilter = '{ "column": "Name", "operator": "contains", "value": "A" }';
  button.interactions = [{ id: uid(), event: 'click', name: 'Legacy rules', enabled: true, conditions: [], conditionMode: 'all', actions: [
    { id: uid(), type: 'filterRows', targetId: repeater.id, value: legacyFilter }, { id: uid(), type: 'sortRows', targetId: repeater.id, value: 'Name:asc' },
  ] }];
  await open(page, doc); const inspector = await editButton(page);
  await expect(inspector.getByLabel('Filter', { exact: true })).toBeVisible(); await expect(inspector.getByLabel('Sort column', { exact: true })).toHaveValue('Name');
  await expect(inspector.getByLabel('Sort direction', { exact: true })).toHaveValue('asc');
  const filter = await addAction(inspector, 'addFilter', repeater.id); await filter.getByLabel('Named filter name', { exact: true }).fill('');
  await filter.getByLabel('Named filter expression', { exact: true }).fill('[[true]][[false]]'); await expect(filter.getByRole('alert')).toContainText('one complete nonempty');
  await filter.getByLabel('Named filter expression', { exact: true }).fill('[[true]]'); await expect(filter.getByRole('alert')).toHaveCount(0);
  await filter.getByLabel('Named filter column group', { exact: true }).selectOption('Age'); await filter.getByLabel('Action 3 target', { exact: true }).selectOption(alternate.id);
  await expect(filter.getByLabel('Named filter column group', { exact: true })).toHaveValue(''); await expect(filter.getByLabel('Named filter column group', { exact: true }).locator('option')).toHaveText(['No column group (advanced expression)', 'Other']);
  const sort = await addAction(inspector, 'addSort', repeater.id); await sort.getByLabel('Action 4 target', { exact: true }).selectOption(alternate.id);
  await expect(sort.getByLabel('Named sort column', { exact: true })).toHaveValue('Other'); await sort.getByLabel('Named sort name', { exact: true }).fill(' ');
  const removal = await addAction(inspector, 'removeFilter', repeater.id); await expect(removal).toContainText('empty name removes nothing and refreshes');
  await removal.getByLabel('Remove filter scope', { exact: true }).selectOption('all'); await expect(removal.getByLabel('Remove filter name', { exact: true })).toHaveCount(0);
  await removal.getByLabel('Remove filter scope', { exact: true }).selectOption('name'); await expect(removal.getByLabel('Remove filter name', { exact: true })).toHaveValue('');
  const path = testInfo.outputPath('legacy-and-named.rea.json'), saved = await save(page, path), actions = saved.pages[0].widgets[2].interactions[0].actions;
  expect(actions.slice(0, 2)).toEqual(button.interactions[0].actions);
  expect(JSON.parse(actions[2].value!)).toEqual({ name: '', expression: '[[true]]', mode: 'smart', removeOthers: false }); expect(actions[2].targetId).toBe(alternate.id);
  expect(JSON.parse(actions[3].value!)).toEqual({ name: ' ', column: 'Other', direction: 'asc', dataType: 'text', toggle: false, removeOthers: false });
  expect(actions[4].value).toBe('{"name":""}');
  await reopen(page, path, doc.name); expect(await save(page, testInfo.outputPath('legacy-and-named-reopened.rea.json'))).toEqual(saved);
  await editButton(page); await expect(inspector.getByLabel('Named filter name', { exact: true })).toHaveValue(''); await expect(inspector.getByLabel('Named sort name', { exact: true })).toHaveValue(' ');
});
