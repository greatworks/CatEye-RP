import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createLayer, createWidget, findWidget, parseDocument, serializeDocument } from '../../src/model/document';
import { resolveAdaptivePage } from '../../src/model/adaptive-view-sets';
import { resolveAdaptiveWidgets } from '../../src/model/adaptive';
import type { Document, Widget } from '../../src/model/types';

const ui = (page: Page) => page.getByRole('complementary', { name: 'Properties inspector' });
const frame = (widget: Widget) => ({ x: widget.x, y: widget.y, width: widget.width, height: widget.height });
function pair(id = 'group', x = 100, y = 100, width = 100) {
  const a = { ...createWidget('box', x, y), id: `${id}-a`, name: `${id} A`, width: width / 2, height: 100 };
  const b = { ...createWidget('box', x + width / 2, y), id: `${id}-b`, name: `${id} B`, width: width / 2, height: 100 };
  return { ...createLayer([a, b], id), id };
}
function fixture() {
  const doc = createDocument(); doc.name = 'Layer resize authoring';
  doc.pages[0].widgets = [pair()]; return doc;
}
async function open(page: Page, doc: Document) {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'layer-resize.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  // Open is itself undoable. Reload the exact recovered document so gesture
  // history assertions start with an empty stack, without bypassing file open.
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('rea-prototype-document-v1'))).toBe(serializeDocument(doc));
  await page.reload(); await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page: Page, info: TestInfo, name: string) {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath(`${name}.rea.json`); await (await download).saveAs(file);
  return parseDocument(await readFile(file, 'utf8'));
}
async function number(page: Page, label: string, value: number) {
  const field = ui(page).getByLabel(label, { exact: true });
  await field.fill(String(value)); await field.press('Enter');
}
async function beginHandle(page: Page, handle: string, name = 'group') {
  const box = await page.locator('.selection-frame').filter({ hasText: name }).locator(`.resize-handle.${handle}`).boundingBox();
  if (!box) throw new Error('Missing resize handle');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(point.x, point.y); await page.mouse.down(); return point;
}
async function drag(page: Page, handle: string, dx: number, dy: number, name = 'group') {
  const start = await beginHandle(page, handle, name);
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 3 }); await page.mouse.up();
}
function members(doc: Document, id = 'group') { return findWidget(doc.pages[0], id)!.layer!.widgets; }

test('Layer handle and Inspector resize use the same paired geometry and one undo', async ({ page }, info) => {
  const original = fixture(); await open(page, original);
  await page.locator('.editor-widget.layer').click();
  await expect(page.locator('.resize-handle')).toHaveCount(8);
  await drag(page, 'e', 100, 35);
  const byHandle = await save(page, info, 'handle');
  // Controller source-oracle pair: side handle ignores the other axis.
  expect(members(byHandle).map(frame)).toEqual([
    { x: 100, y: 100, width: 100, height: 100 }, { x: 200, y: 100, width: 100, height: 100 },
  ]);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'undo')).toEqual(original);
  await page.getByTitle('Redo', { exact: true }).click();
  expect(await save(page, info, 'redo')).toEqual(byHandle);
  await open(page, original); await page.locator('.editor-widget.layer').click();
  await number(page, 'Group width', 200);
  expect(await save(page, info, 'numeric')).toEqual(byHandle);
  await number(page, 'Group height', 150);
  expect(members(await save(page, info, 'height')).map(frame)).toEqual([
    { x: 100, y: 100, width: 100, height: 150 }, { x: 200, y: 100, width: 100, height: 150 },
  ]);
  await open(page, original);
  await page.locator('.menubar').getByRole('button', { name: 'View', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Zoom to 50%', exact: true }).click();
  await page.locator('.editor-widget.layer').click(); await drag(page, 'e', 50, 0);
  expect(await save(page, info, 'zoom')).toEqual(byHandle);
  await open(page, original); await page.locator('.editor-widget.layer').click();
  await number(page, 'Group width', 4);
  expect(members(await save(page, info, 'below-eight')).map(frame)).toEqual([
    { x: 100, y: 100, width: 2, height: 100 }, { x: 102, y: 100, width: 2, height: 100 },
  ]);
});

test('out-back, Escape and adaptive context switches discard the entire gesture', async ({ page }, info) => {
  const original = fixture();
  original.pages[0].adaptiveViews = [{ id: 'phone', name: 'Phone', width: 390, overrides: {} }];
  await open(page, original); await page.locator('.editor-widget.layer').click();
  let start = await beginHandle(page, 'se');
  await page.mouse.move(start.x + 60, start.y + 30); await page.mouse.move(start.x, start.y); await page.mouse.up();
  expect(await save(page, info, 'out-back')).toEqual(original);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  start = await beginHandle(page, 'se');
  await page.mouse.move(start.x + 50, start.y + 20); await page.keyboard.press('Escape'); await page.mouse.up();
  expect(await save(page, info, 'escape')).toEqual(original);
  await expect(page.locator('.selection-frame')).toHaveCount(1);
  start = await beginHandle(page, 'e');
  await page.mouse.move(start.x + 50, start.y);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('phone');
  await page.mouse.up();
  expect(await save(page, info, 'context-switch')).toEqual(original);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
});

test('nested Layers keep panel-local coordinates and do not apply the Layer degree as a frame rotation', async ({ page }, info) => {
  const doc = fixture(), inner = pair('inner', 10, 20), outer = { ...createLayer([inner], 'outer'), id: 'outer', rotation: 37 };
  const panel = createWidget('panel', 60, 60); panel.name = 'Panel'; panel.width = 600; panel.height = 400;
  panel.states![0].widgets = [outer]; doc.pages[0].widgets = [panel];
  await open(page, doc); await page.locator('.editor-widget.panel').dblclick(); await page.locator('.editor-widget.layer').click();
  await drag(page, 'se', 100, 50, 'outer');
  const saved = await save(page, info, 'nested');
  expect(members(saved, 'inner').map(frame)).toEqual([
    { x: 10, y: 20, width: 100, height: 150 }, { x: 110, y: 20, width: 100, height: 150 },
  ]);
  expect(findWidget(saved.pages[0], 'outer')!.rotation).toBe(37);
  expect(frame(saved.pages[0].widgets[0])).toEqual(frame(panel));
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'nested-undo')).toEqual(doc);
});

test('resizing remains current-view with Affect all views checked and preserves inactive declarations', async ({ page }, info) => {
  const doc = fixture(); members(doc)[0].shapeText = { autoFitWidth: true, autoFitHeight: true };
  doc.adaptiveViewSets = [{ id: 'set', name: 'Shared', baseSize: { width: 1200, height: 0 }, views: [
    { id: 'parent', name: 'Parent', width: 768 }, { id: 'phone', name: 'Phone', width: 390, baseViewId: 'parent' }, { id: 'sibling', name: 'Sibling', width: 900 },
  ] }];
  Object.assign(doc.pages[0], { adaptiveViewSetId: 'set', adaptiveViews: [], adaptiveOverrides: {
    parent: { 'group-a': { style: { fill: '#ff0000' } } }, phone: { 'group-b': { style: { opacity: .7 } } },
    sibling: { 'group-a': { x: 90, y: 80 } }, inactive: { 'group-a': { x: 10, y: 20, width: 30, height: 40, style: { fixedHeight: true } } },
  } });
  delete doc.pages[0].adaptiveSelection; delete doc.pages[0].adaptiveBaseSize;
  await open(page, doc); await page.getByLabel('Adaptive view', { exact: true }).selectOption('phone');
  await page.getByLabel('Affect all views', { exact: true }).check(); await page.locator('.editor-widget.layer').click();
  await number(page, 'Group width', 200);
  const saved = await save(page, info, 'current-view'), maps = saved.pages[0].adaptiveOverrides!;
  expect(maps.parent).toEqual(doc.pages[0].adaptiveOverrides!.parent);
  expect(maps.sibling).toEqual(doc.pages[0].adaptiveOverrides!.sibling);
  expect(maps.inactive).toEqual(doc.pages[0].adaptiveOverrides!.inactive);
  expect(maps.phone['group-a']).toEqual({ width: 100, height: 100 });
  expect(maps.phone['group-b']).toEqual({ x: 200, y: 100, width: 100, height: 100, style: { opacity: .7 } });
  expect(members(saved).map(frame)).toEqual(members(doc).map(frame));
  expect(members(saved)[0].shapeText).toEqual({ autoFitWidth: false, autoFitHeight: true });
  expect(saved.adaptiveViewSets).toEqual(doc.adaptiveViewSets);
  const projected = resolveAdaptiveWidgets(resolveAdaptivePage(saved, saved.pages[0]), 'phone');
  expect(projected[0]).toMatchObject({ x: 100, y: 100, width: 200, height: 100 });
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'current-undo')).toEqual(doc);
  await open(page, saved); expect(await save(page, info, 'reopen')).toEqual(saved);
});

test('multiple Layers use each target width and preserve a no-op target in one numeric command', async ({ page }, info) => {
  const doc = fixture(); doc.pages[0].widgets.push(pair('second', 400, 100, 200));
  await open(page, doc); await page.locator('.editor-widget.layer').first().click(); await page.keyboard.press('Control+a');
  await number(page, 'Group width', 200);
  const saved = await save(page, info, 'multiple');
  expect(members(saved).map(frame)).toEqual([{ x: 100, y: 100, width: 100, height: 100 }, { x: 200, y: 100, width: 100, height: 100 }]);
  expect(findWidget(saved.pages[0], 'second')).toEqual(findWidget(doc.pages[0], 'second'));
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'multiple-undo')).toEqual(doc);
  await page.locator('.editor-widget.layer').first().click(); await page.keyboard.press('Control+a');
  // Editing the displayed first width to its existing value must still update
  // the second selected Layer, while the true no-op first target stays exact.
  const width = ui(page).getByLabel('Group width', { exact: true });
  await width.press('Control+a'); await width.press('Backspace');
  await width.pressSequentially('100'); await width.press('Enter');
  const equalFirst = await save(page, info, 'multiple-equal-first');
  expect(findWidget(equalFirst.pages[0], 'group')).toEqual(findWidget(doc.pages[0], 'group'));
  expect(members(equalFirst, 'second').map(frame)).toEqual([
    { x: 400, y: 100, width: 50, height: 100 }, { x: 450, y: 100, width: 50, height: 100 },
  ]);
});

test('mixed selections and unsupported descendants fail atomically without losing selection', async ({ page }, info) => {
  const doc = fixture(); doc.pages[0].widgets.push({ ...createWidget('box', 400, 100), name: 'ordinary' });
  await open(page, doc); await page.locator('.editor-widget.layer').click(); await page.keyboard.press('Control+a');
  await drag(page, 'e', 80, 0);
  await expect(page.locator('.statusbar')).toContainText('Resize groups separately from ordinary widgets');
  await expect(page.locator('.selection-frame')).toHaveCount(2);
  expect(await save(page, info, 'mixed-handle')).toEqual(doc);
  await number(page, 'Group width', 200);
  expect(await save(page, info, 'mixed-number')).toEqual(doc);
  await expect(page.locator('.selection-frame')).toHaveCount(2);

  const unsupported = fixture(), panel = createWidget('panel', 300, 100); panel.name = 'unclosed panel';
  unsupported.pages[0].widgets = [createLayer([...members(unsupported), panel], 'unsupported')];
  await open(page, unsupported); await page.locator('.editor-widget.layer').click();
  await number(page, 'Group width', 700);
  await expect(page.locator('.statusbar')).toContainText('Group resize unavailable');
  expect(await save(page, info, 'unsupported')).toEqual(unsupported);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
});

test('pin edits preserve heterogeneous targets and clear only the edited All-views field', async ({ page }, info) => {
  const doc = fixture(), second = pair('second', 400, 100);
  doc.pages[0].widgets.push(second);
  Object.assign(doc.pages[0].widgets[0].style, { pinHorizontal: 'left', pinVertical: 'top', fixedWidth: true });
  Object.assign(second.style, { pinHorizontal: 'right', pinVertical: 'bottom', fixedHeight: true });
  doc.pages[0].adaptiveViews = [{ id: 'phone', name: 'Phone', width: 900, overrides: {
    group: { style: { pinHorizontal: 'both', pinVertical: 'center', fixedHeight: true } },
    second: { style: { pinHorizontal: 'none', pinVertical: 'both', fixedWidth: false } },
  } }];
  doc.pages[0].adaptiveOverrides = { inactive: {
    group: { style: { pinHorizontal: 'right', fixedWidth: false } },
    second: { style: { pinHorizontal: 'left', fixedHeight: false } },
  } };
  await open(page, doc); await page.getByLabel('Adaptive view', { exact: true }).selectOption('phone');
  await page.locator('.editor-widget.layer').first().click(); await page.keyboard.press('Control+a');
  await ui(page).getByLabel('Horizontal pin', { exact: true }).selectOption('center');
  const local = await save(page, info, 'pin-local');
  expect(local.pages[0].widgets).toEqual(doc.pages[0].widgets);
  expect(local.pages[0].adaptiveOverrides).toEqual(doc.pages[0].adaptiveOverrides);
  expect(local.pages[0].adaptiveViews[0].overrides.group.style).toEqual({ pinHorizontal: 'center', pinVertical: 'center', fixedHeight: true });
  expect(local.pages[0].adaptiveViews[0].overrides.second.style).toEqual({ pinHorizontal: 'center', pinVertical: 'both', fixedWidth: false });
  await page.getByLabel('Affect all views', { exact: true }).check();
  await ui(page).getByLabel('Horizontal pin', { exact: true }).selectOption('none');
  const all = await save(page, info, 'pin-all');
  expect(all.pages[0].widgets.map(widget => widget.style)).toEqual(doc.pages[0].widgets.map(widget => ({ ...widget.style, pinHorizontal: 'none' })));
  expect(all.pages[0].adaptiveViews[0].overrides.group.style).toEqual({ pinVertical: 'center', fixedHeight: true });
  expect(all.pages[0].adaptiveViews[0].overrides.second.style).toEqual({ pinVertical: 'both', fixedWidth: false });
  expect(all.pages[0].adaptiveOverrides).toEqual({ inactive: {
    group: { style: { fixedWidth: false } }, second: { style: { fixedHeight: false } },
  } });
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'pin-undo')).toEqual(local);
  await open(page, all); expect(await save(page, info, 'pin-reopen')).toEqual(all);
});

test('multiple Layer handle plans are atomic and crossing the opposite side cannot flip members', async ({ page }, info) => {
  const doc = fixture(); doc.pages[0].widgets.push(pair('second', 400, 100));
  await open(page, doc); await page.locator('.editor-widget.layer').first().click(); await page.keyboard.press('Control+a');
  await drag(page, 'e', 100, 0);
  const saved = await save(page, info, 'multi-handle');
  // Original CbNX uses the shared 400px selection frame: 400 -> 500.
  expect(saved.pages[0].widgets.map(widget=>widget.width)).toEqual([125, 125]);
  expect(members(saved, 'second').map(frame)).toEqual([
    { x: 475, y: 100, width: 62.5, height: 100 }, { x: 537.5, y: 100, width: 62.5, height: 100 },
  ]);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'multi-handle-undo')).toEqual(doc);
  const locked = structuredClone(doc); locked.pages[0].widgets[1].locked = true;
  await open(page, locked); await page.locator('.editor-widget.layer').first().click(); await page.keyboard.press('Control+a');
  await drag(page, 'e', 100, 0);
  const withLocked = await save(page, info, 'locked-selection');
  expect(withLocked.pages[0].widgets[0].width).toBe(125);
  expect(withLocked.pages[0].widgets[1]).toEqual(locked.pages[0].widgets[1]);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'locked-undo')).toEqual(locked);
  const single = fixture(); await open(page, single); await page.locator('.editor-widget.layer').click();
  await drag(page, 'e', -150, 0);
  await expect(page.locator('.statusbar')).toContainText('Group resize unavailable');
  expect(await save(page, info, 'cross-side')).toEqual(single);
  await expect(page.locator('.selection-frame')).toHaveCount(1);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();

  const unsupported = fixture(), panel = createWidget('panel', 400, 100);
  unsupported.pages[0].widgets.push(createLayer([panel], 'unclosed'));
  await open(page, unsupported); await page.locator('.editor-widget.layer').first().click(); await page.keyboard.press('Control+a');
  await number(page, 'Group width', 300);
  await expect(page.locator('.statusbar')).toContainText('Group resize unavailable');
  expect(await save(page, info, 'multi-unsupported')).toEqual(unsupported);
  await expect(page.locator('.selection-frame')).toHaveCount(2);
});
