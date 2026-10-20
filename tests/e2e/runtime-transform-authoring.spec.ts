import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, parseDocument, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';
import { motionEvent, moveSpec } from '../fixtures/runtime-transform';

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Properties inspector' });
async function open(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'transform.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page: Page, info: TestInfo, name: string) {
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const file = info.outputPath(`${name}.rea.json`);
  await (await pending).saveAs(file); return parseDocument(await readFile(file, 'utf8'));
}
function fixture() {
  const doc = createDocument(); doc.name = 'Motion authoring'; doc.pages[0].widgets = [createWidget('button', 40, 50), createWidget('box', 300, 100), createWidget('box', 550, 100)];
  doc.pages[0].widgets[0].text = 'Run'; doc.pages[0].widgets[1].name = 'First'; doc.pages[0].widgets[2].name = 'Second';
  for (const widget of doc.pages[0].widgets.slice(1)) widget.groupId = 'flat-visual-group'; return doc;
}
async function selectInteractions(page: Page) {
  await page.locator('.canvas-surface .editor-widget.button').click(); await inspector(page).getByRole('tab', { name: 'Interactions', exact: true }).click();
}
async function addMotion(page: Page, kind: 'move' | 'resize') {
  await selectInteractions(page); await inspector(page).getByRole('button', { name: 'New interaction', exact: true }).click();
  await inspector(page).getByRole('button', { name: 'Add action', exact: true }).click(); await inspector(page).getByLabel('Action 1 type', { exact: true }).selectOption(kind);
}

test('authors ordered Move targets, scoped bindings and a nested boundary; undo and reopening preserve the complete object', async ({ page }, info) => {
  test.setTimeout(90_000);
  const doc = fixture(); await open(page, doc); await addMotion(page, 'move'); const ui = inspector(page), first = doc.pages[0].widgets[1], second = doc.pages[0].widgets[2];
  await expect(ui.getByLabel('Move target 1', { exact: true }).locator('option[value="widget:flat-visual-group"]')).toHaveCount(0);
  await expect(ui.getByLabel('Move target 1 animation', { exact: true }).locator('option')).toHaveCount(33);
  await expect(ui.getByLabel('Move target 1 duration', { exact: true })).toBeDisabled(); await expect(ui.getByLabel('Move target 1 path', { exact: true })).toBeDisabled();
  await ui.getByLabel('Move target 1', { exact: true }).selectOption(`widget:${first.id}`);
  await ui.getByText('Move target 1 X local widgets', { exact: true }).click();
  const xScope = ui.locator('.inspector-motion-expression').filter({ has: page.getByLabel('Move target 1 X', { exact: true }) });
  await xScope.getByRole('button', { name: 'Add local widget', exact: true }).click();
  await ui.getByLabel('Move target 1 X local widget local1', { exact: true }).selectOption(second.id);
  await ui.getByLabel('Move target 1 X', { exact: true }).fill('[[local1.x + 12.5]]');
  await ui.getByLabel('Move target 1 X local name local1', { exact: true }).fill('Track'); await ui.getByLabel('Move target 1 X local name local1', { exact: true }).press('Tab');
  await expect(ui.getByLabel('Move target 1 X', { exact: true })).toHaveValue('[[track.x + 12.5]]');
  await ui.getByLabel('Move target 1 animation', { exact: true }).selectOption('easeInOutCubic'); await ui.getByLabel('Move target 1 path', { exact: true }).selectOption('arcClockwise');
  await ui.getByText('Move target 1 boundary', { exact: true }).click(); await ui.getByLabel('Enable Move target 1 boundary', { exact: true }).check();
  await ui.getByLabel('Move target 1 boundary match', { exact: true }).selectOption('and');
  await ui.getByLabel('Move target 1 boundary second edge', { exact: true }).selectOption('right');
  await ui.getByLabel('Move target 1 boundary second position', { exact: true }).fill('[[Target.x + Target.width]]');
  await ui.getByLabel('Move target 1 boundary second comparison', { exact: true }).selectOption('<');
  await ui.getByLabel('Move target 1 boundary second limit', { exact: true }).fill('900');
  await ui.getByRole('button', { name: 'Add target', exact: true }).click(); await ui.getByLabel('Move target 2', { exact: true }).selectOption(`widget:${second.id}`);
  await ui.getByLabel('Move target 2 mode', { exact: true }).selectOption('delta'); await ui.getByLabel('Move target 2 X', { exact: true }).fill('-25');
  const before = await save(page, info, 'before-reorder'); await ui.getByRole('button', { name: 'Move Move target 2 up', exact: true }).click();
  const saved = await save(page, info, 'ordered'); const move = saved.pages[0].widgets[0].interactions[0].actions[0].move!;
  expect(move.targets.map(target => target.target)).toEqual([{ kind: 'widget', id: second.id }, { kind: 'widget', id: first.id }]);
  expect(move.targets[1]).toMatchObject({ x: { text: '[[track.x + 12.5]]', bindings: { track: { kind: 'widget', targetId: second.id } } }, easing: 'easeInOutCubic', trajectory: 'arcClockwise', boundary: { kind: 'and', right: { kind: 'compare', direction: 'right', operator: '<', right: { text: '900' } } } });
  await ui.screenshot({ path: info.outputPath('authoring.png') });
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'undo')).toEqual(before);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info, 'redo')).toEqual(saved);
  await open(page, saved); expect(await save(page, info, 'reopened')).toEqual(saved);
});

test('authors Set size anchors and drag events and clears incompatible action fields', async ({ page }, info) => {
  const doc = fixture(); await open(page, doc); await addMotion(page, 'resize'); const ui = inspector(page);
  await ui.getByLabel('Interaction event', { exact: true }).selectOption('dragDrop');
  await ui.getByLabel('Resize target 1', { exact: true }).selectOption(`widget:${doc.pages[0].widgets[1].id}`);
  await ui.getByLabel('Resize target 1 width', { exact: true }).fill('[[Target.width + 40]]'); await ui.getByLabel('Resize target 1 height', { exact: true }).fill('120');
  await ui.getByLabel('Resize target 1 anchor', { exact: true }).selectOption('bottom right'); await ui.getByLabel('Resize target 1 animation', { exact: true }).selectOption('easeOutBounce');
  await ui.getByLabel('Resize target 1 duration', { exact: true }).fill('1250'); await ui.getByLabel('Resize target 1 duration', { exact: true }).press('Tab');
  const saved = await save(page, info, 'resize'); expect(saved.pages[0].widgets[0].interactions[0]).toMatchObject({ event: 'dragDrop', actions: [{ type: 'resize', resize: { targets: [{ width: { text: '[[Target.width + 40]]' }, height: { text: '120' }, anchor: 'bottom right', easing: 'easeOutBounce', duration: 1250 }] } }] });
  await ui.getByLabel('Action 1 type', { exact: true }).selectOption('move'); const moved = await save(page, info, 'changed-to-move');
  expect(moved.pages[0].widgets[0].interactions[0].actions[0]).not.toHaveProperty('resize'); await expect(ui.getByLabel('Move target 1 mode', { exact: true })).toHaveValue('location');
  await ui.getByLabel('Action 1 type', { exact: true }).selectOption('wait'); const waited = await save(page, info, 'changed-to-wait');
  expect(waited.pages[0].widgets[0].interactions[0].actions[0]).toMatchObject({ type: 'wait', duration: 500 }); expect(waited.pages[0].widgets[0].interactions[0].actions[0]).not.toHaveProperty('move');
});

test('keeps legacy numeric actions unchanged until an explicit conversion', async ({ page }, info) => {
  const doc = fixture(), source = doc.pages[0].widgets[0], target = doc.pages[0].widgets[1];
  source.interactions = [motionEvent('legacy', 'click', [{ type: 'move', targetId: target.id, x: 123, y: 234 }])];
  await open(page, doc); await selectInteractions(page); expect(await save(page, info, 'legacy')).toEqual(doc);
  await inspector(page).getByRole('button', { name: 'Add animation and expressions', exact: true }).click();
  const saved = await save(page, info, 'converted'), action = saved.pages[0].widgets[0].interactions[0].actions[0];
  expect(action.move?.targets[0]).toMatchObject({ target: { kind: 'widget', id: target.id }, mode: 'location', x: { text: '123' }, y: { text: '234' }, easing: 'none' });
  expect(action).not.toHaveProperty('targetId'); expect(action).not.toHaveProperty('x'); expect(action).not.toHaveProperty('y');
});

test('discards an invalid local name draft when targets are reordered or restored by Undo', async ({ page }) => {
  const doc = fixture(), source = doc.pages[0].widgets[0], first = doc.pages[0].widgets[1], second = doc.pages[0].widgets[2];
  source.interactions = [motionEvent('names', 'click', [{ type: 'move', move: { targets: [first, second].map(target => moveSpec(target.id, { x: { text: '[[local1.x]]', bindings: { local1: { kind: 'widget', targetId: target.id } } } })) } }])];
  await open(page, doc); await selectInteractions(page); const ui = inspector(page);
  for (const index of [1, 2]) await ui.getByText(`Move target ${index} X local widgets (1)`, { exact: true }).click();
  await ui.getByLabel('Move target 1 X local name local1', { exact: true }).fill('bad name'); await ui.getByRole('button', { name: 'Move Move target 1 down', exact: true }).click();
  await expect(ui.getByLabel('Move target 1', { exact: true })).toHaveValue(`widget:${second.id}`);
  for (const index of [1, 2]) await expect(ui.getByLabel(`Move target ${index} X local name local1`, { exact: true })).toHaveValue('local1');
  await expect(ui.getByRole('alert')).toHaveCount(0);
  await ui.getByLabel('Move target 1 X local name local1', { exact: true }).fill('another bad name'); await page.getByTitle('Undo', { exact: true }).click();
  await selectInteractions(page);
  await expect(ui.getByLabel('Move target 1', { exact: true })).toHaveValue(`widget:${first.id}`); await expect(ui.getByLabel('Move target 1 X local name local1', { exact: true })).toHaveValue('local1');
});

test('keeps targetless Move and unsupported legacy line Resize editable without silently converting them', async ({ page }, info) => {
  for (const kind of ['move', 'resize'] as const) {
    const doc = fixture(); doc.pages[0].widgets[1] = createWidget('line', 300, 100);
    doc.pages[0].widgets[0].interactions = [motionEvent(`guard-${kind}`, 'click', [{ type: kind, ...(kind === 'resize' ? { targetId: doc.pages[0].widgets[1].id } : {}), x: 123, y: 234 }])];
    await open(page, doc); await selectInteractions(page);
    await expect(inspector(page).getByRole('button', { name: 'Add animation and expressions', exact: true })).toBeDisabled(); expect(await save(page, info, `guard-${kind}`)).toEqual(doc);
  }
});
