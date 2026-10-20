import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createLayer, createWidget, parseDocument, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';

async function open(page: Page, document: Document) {
  await page.goto('/');
  const pending = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await pending).setFiles({ name: 'groups.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(document)) });
  await expect(page.locator('.titlebar')).toContainText(document.name);
}
async function save(page: Page, info: TestInfo, name: string) {
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath(`${name}.rea.json`); await (await pending).saveAs(file);
  return parseDocument(await readFile(file, 'utf8'));
}
function fixture() {
  const doc = createDocument(); doc.name = 'Native layer authoring';
  const first = createWidget('box', 140, 100), second = createWidget('text', 360, 130);
  Object.assign(first, { id: 'first', name: 'First', width: 100, height: 60 });
  Object.assign(second, { id: 'second', name: 'Second', width: 160, height: 40, text: 'Second member' });
  doc.pages[0].widgets = [first, second]; return doc;
}
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Properties inspector' });
async function geometry(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox(); if (!box) throw new Error(`Missing ${selector}`);
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

test('groups, moves, edits, ungroups and undoes with one real identity and stable page coordinates', async ({ page }, info) => {
  const original = fixture(); await open(page, original);
  const before = await geometry(page, '.editor-widget.text');
  await page.locator('.editor-widget.box').click(); await page.keyboard.press('Control+a'); await page.keyboard.press('Control+g');
  await expect(page.locator('.editor-widget.layer')).toHaveCount(1);
  await expect(page.locator('.canvas-surface > .editor-widget')).toHaveCount(1);
  expect(await geometry(page, '[data-layer-member-id="second"]')).toEqual(before);
  await expect(inspector(page).getByLabel('Group width', { exact: true })).toHaveValue('380');
  await expect(page.locator('.resize-handle')).toHaveCount(8);
  const grouped = await save(page, info, 'grouped'), group = grouped.pages[0].widgets[0];
  expect(group).toMatchObject({ type: 'layer', x: 140, y: 100, width: 380, height: 70 });
  expect(group.layer!.widgets.map(widget => widget.id)).toEqual(['first', 'second']);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'undo-group')).toEqual(original);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info, 'redo-group')).toEqual(grouped);

  await page.locator('.editor-widget.layer').click(); await page.keyboard.press('Shift+ArrowRight');
  const moved = await save(page, info, 'moved');
  expect(moved.pages[0].widgets[0]).toMatchObject({ x: 150 });
  expect(moved.pages[0].widgets[0].layer!.widgets.map(widget => widget.x)).toEqual([150, 370]);
  const movedBox = await geometry(page, '[data-layer-member-id="second"]');
  expect(movedBox.x).toBeCloseTo(before.x + 10, 4); expect(movedBox.y).toBeCloseTo(before.y, 4);
  await page.locator('.editor-widget.layer').dblclick();
  await expect(page.getByRole('button', { name: 'Exit Group', exact: true })).toBeVisible();
  expect(await geometry(page, '.editor-widget.text')).toEqual(movedBox);
  await page.locator('.editor-widget.text').click();
  await inspector(page).getByLabel('X', { exact: true }).fill('420'); await inspector(page).getByLabel('X', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Exit Group', exact: true }).click();
  await expect(inspector(page).getByLabel('Group width', { exact: true })).toHaveValue('430');
  await page.locator('.editor-widget.layer').click(); await page.keyboard.press('Control+Shift+g');
  const ungrouped = await save(page, info, 'ungrouped');
  expect(ungrouped.pages[0].widgets.map(widget => widget.id)).toEqual(['first','second']);
  expect(ungrouped.pages[0].widgets.map(widget => widget.x)).toEqual([150,420]);
  await page.getByTitle('Undo', { exact: true }).click();
  expect((await save(page, info, 'undo-ungroup')).pages[0].widgets[0].id).toBe(group.id);
  await page.locator('.editor-widget.layer').click();
  await page.getByRole('button', { name: 'Outline', exact: true }).click();
  await page.screenshot({ path: info.outputPath('group-authoring.png') });
});

test('nested group scopes share the enclosing panel canvas and exit to the actual owner', async ({ page }, info) => {
  const doc = fixture(), panel = createWidget('panel', 60, 60);
  panel.name = 'Panel'; panel.width = 600; panel.height = 400;
  const inner = createLayer(doc.pages[0].widgets, 'Inner'), outer = createLayer([inner], 'Outer');
  panel.states![0].widgets = [outer]; doc.pages[0].widgets = [panel];
  await open(page, doc);
  await page.locator('.editor-widget.panel').dblclick();
  const before = await geometry(page, '[data-layer-member-id="second"]');
  await page.locator('.editor-widget.layer').dblclick();
  await expect(page.getByRole('button', { name: 'Exit Outer', exact: true })).toBeVisible();
  expect(await geometry(page, '[data-layer-member-id="second"]')).toEqual(before);
  await page.locator('.editor-widget.layer').dblclick();
  await expect(page.getByRole('button', { name: 'Exit Inner', exact: true })).toBeVisible();
  await expect(page.locator('.canvas-surface')).toHaveCSS('width', '600px');
  expect(await geometry(page, '.editor-widget.text')).toEqual(before);
  await page.getByRole('button', { name: 'Exit Inner', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit Outer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit Outer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit Panel', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit Panel', exact: true }).click();
  expect(await save(page, info, 'nested-unmodified')).toEqual(doc);
});

test('outline reveals group members and the group itself is an independent action target', async ({ page }, info) => {
  const doc = fixture(), group = createLayer(doc.pages[0].widgets, 'Target group'), button = createWidget('button', 40, 250);
  button.name = 'Trigger'; doc.pages[0].widgets = [group, button]; await open(page, doc);
  await page.getByRole('button', { name: 'Outline', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select group member Second', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Select group member Second', exact: true }).click();
  await expect(inspector(page).getByLabel('Widget name', { exact: true })).toHaveValue('Second');
  await page.getByRole('button', { name: 'Exit Target group', exact: true }).click();
  await page.locator('.editor-widget.button').click(); const ui = inspector(page);
  await ui.getByRole('tab', { name: 'Interactions', exact: true }).click();
  await ui.getByRole('button', { name: 'New interaction', exact: true }).click();
  await ui.getByRole('button', { name: 'Add action', exact: true }).click();
  await ui.getByLabel('Action 1 type', { exact: true }).selectOption('rotate');
  await ui.getByLabel('Action 1 target', { exact: true }).selectOption(group.id);
  await ui.getByLabel('Rotation degrees', { exact: true }).fill('45');
  const saved = await save(page, info, 'group-target');
  expect(saved.pages[0].widgets[1].interactions[0].actions[0]).toMatchObject({ type: 'rotate', targetId: group.id, rotate: { degrees: '45' } });
  await open(page, saved); expect(await save(page, info, 'group-target-reopened')).toEqual(saved);
});

test('authoring repeater rows resolve nested group text exactly once and template editing retains expressions', async ({ page }, info) => {
  const doc = createDocument(); doc.name = 'Group row text';
  const repeater = createWidget('repeater', 80, 70), label = createWidget('text', 20, 10);
  Object.assign(label, { id: 'row-label', name: 'Row label', text: '[[Item.Name]]', width: 180, height: 24 });
  repeater.name = 'Rows'; repeater.repeater!.template = [createLayer([label], 'Row group')];
  repeater.repeater!.rows = [{ Name: 'Alpha' }, { Name: '[[Item.Next]]' }, { Name: 'Gamma' }];
  repeater.repeater!.itemHeight = 40; doc.pages[0].widgets = [repeater];
  await open(page, doc);
  await expect(page.locator('[data-layer-member-id="row-label"]')).toHaveText(['Alpha', '[[Item.Next]]', 'Gamma']);
  await page.locator('.editor-widget.repeater').dblclick();
  await expect(page.locator('[data-layer-member-id="row-label"]')).toHaveText('[[Item.Name]]');
  await page.locator('.editor-widget.layer').dblclick();
  await expect(page.locator('.editor-widget.text')).toHaveText('[[Item.Name]]');
  expect(await save(page, info, 'row-template')).toEqual(doc);
});
