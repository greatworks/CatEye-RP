import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Document, VectorCommand, VectorPath, Widget } from '../../src/model/types';

type XY = { x: number; y: number };
const surface = (page: Page) => page.locator('.canvas-surface');
const overlay = (page: Page) => page.locator('.vector-canvas-overlay[data-vector-mode="points"]');
const anchor = (page: Page, index: number) => overlay(page).locator(`[data-vector-anchor="${index}"]:not([data-vector-handle])`);
const handle = (page: Page, index: number, direction: 'incoming' | 'outgoing') => overlay(page).locator(`[data-vector-anchor="${index}"][data-vector-handle="${direction}"]`);
async function ensurePoints(page: Page) {
  if (await overlay(page).isVisible()) return;
  const edit = page.getByRole('button', { name: 'Edit points', exact: true });
  if (!(await edit.isVisible())) await page.locator('.editor-widget.path').first().click();
  if (await overlay(page).isVisible()) return; // Reselection can restore the remembered point mode.
  await edit.click();
}
async function fileMenu(page: Page, action: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}
async function open(page: Page, doc: Document) {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'vector-editing.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page: Page, file: string): Promise<Document> {
  const download = page.waitForEvent('download');
  await page.getByTitle('Save', { exact: true }).click();
  await (await download).saveAs(file);
  return JSON.parse(await readFile(file, 'utf8')) as Document;
}
async function reopen(page: Page, file: string) {
  await fileMenu(page, 'New Ctrl+N');
  const chooser = page.waitForEvent('filechooser');
  await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles(file);
  await expect(page.locator('.statusbar')).toContainText('Document opened');
}
async function canvasPoint(page: Page, x: number, y: number): Promise<XY> {
  const box = await surface(page).boundingBox();
  expect(box).not.toBeNull();
  const zoom = Number(await page.getByLabel('Zoom', { exact: true }).inputValue());
  return { x: box!.x + x * zoom, y: box!.y + y * zoom };
}
async function clickCanvas(page: Page, x: number, y: number, double = false) {
  const point = await canvasPoint(page, x, y);
  if (double) await page.mouse.dblclick(point.x, point.y); else await page.mouse.click(point.x, point.y);
}
async function center(locator: Locator): Promise<XY> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}
async function drag(page: Page, from: XY, to: XY, options: { shift?: boolean; alt?: boolean; returnToStart?: boolean } = {}) {
  if (options.shift) await page.keyboard.down('Shift');
  if (options.alt) await page.keyboard.down('Alt');
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  if (options.returnToStart) await page.mouse.move(from.x, from.y, { steps: 4 });
  await page.mouse.up();
  if (options.alt) await page.keyboard.up('Alt');
  if (options.shift) await page.keyboard.up('Shift');
}
function expectPoint(actual: XY, expected: XY) {
  expect(actual.x).toBeCloseTo(expected.x, 5); expect(actual.y).toBeCloseTo(expected.y, 5);
}
function unrotatedPoint(widget: Widget, point: XY): XY {
  return { x: widget.x + point.x * widget.width, y: widget.y + point.y * widget.height };
}
function absoluteAnchors(widget: Widget): XY[] {
  return widget.vectorPath!.commands.filter((c): c is Exclude<VectorCommand, { op: 'Z' }> => c.op !== 'Z')
    .map(c => ({ x: widget.x + c.x * widget.width, y: widget.y + c.y * widget.height }));
}
function nodes(path: VectorPath) {
  const points = path.commands.filter((c): c is Exclude<VectorCommand, { op: 'Z' }> => c.op !== 'Z');
  if (path.commands.at(-1)?.op === 'Z' && points.length > 1 && points.at(-1)!.x === points[0].x && points.at(-1)!.y === points[0].y) points.pop();
  return points;
}
function expectNodes(path: VectorPath, expected: XY[]) {
  const actual = nodes(path); expect(actual).toHaveLength(expected.length);
  actual.forEach((point, i) => expectPoint(point, expected[i]));
}
function neighboringControls(path: VectorPath, index: number) {
  const points = nodes(path), point = points[index], next = points[index + 1];
  return {
    incoming: point.op === 'C' ? { x: point.x2, y: point.y2 } : { x: point.x, y: point.y },
    outgoing: next?.op === 'C' ? { x: next.x1, y: next.y1 } : { x: point.x, y: point.y },
  };
}
function expectedPathData(path: VectorPath, width: number, height: number): string {
  // Independent SVG expectation; no product vector conversion or rendering helper.
  return path.commands.map(c => c.op === 'Z' ? 'Z' : c.op === 'C'
    ? `C ${c.x1 * width} ${c.y1 * height} ${c.x2 * width} ${c.y2 * height} ${c.x * width} ${c.y * height}`
    : `${c.op} ${c.x * width} ${c.y * height}`).join(' ');
}
const polygon = (): VectorPath => ({ fillRule: 'nonzero', commands: [
  { op: 'M', x: 0, y: 0 }, { op: 'L', x: 1, y: 0 }, { op: 'L', x: 1, y: 1 }, { op: 'L', x: 0, y: 1 }, { op: 'Z' },
] });
function seed(name = 'Canvas vector editing') {
  const doc = createDocument(); doc.name = name; doc.caseSelection = 'never'; doc.pages[0].height = 800;
  const widget = createWidget('path', 100, 100); widget.name = 'Editable rectangle'; widget.width = 200; widget.height = 100; widget.vectorPath = polygon();
  doc.pages[0].widgets = [widget]; return { doc, widget };
}

test('Pen creates a closed path in one undo step and preserves open paths on Escape and double click', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept());
  const doc = createDocument(); doc.name = 'Pen completion modes'; doc.pages[0].widgets = [];
  await open(page, doc); await page.keyboard.press('p');
  await clickCanvas(page, 100, 100); await clickCanvas(page, 240, 100); await clickCanvas(page, 240, 220); await clickCanvas(page, 100, 100);
  await expect(page.locator('.editor-widget.path')).toHaveCount(1);
  let current = await save(page, info.outputPath('closed.rea.json'));
  const closed = current.pages[0].widgets[0];
  expect(closed.vectorPath!.commands.at(-1)?.op).toBe('Z');
  const closedAnchors = absoluteAnchors(closed);
  // Explicit closing line is acceptable only if it repeats the first anchor once.
  if (closedAnchors.length === 4) expectPoint(closedAnchors.pop()!, closedAnchors[0]);
  expect(closedAnchors).toHaveLength(3);
  [{ x: 100, y: 100 }, { x: 240, y: 100 }, { x: 240, y: 220 }].forEach((p, i) => expectPoint(closedAnchors[i], p));
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info.outputPath('closed-undone.rea.json'))).toEqual(doc);
  await page.getByTitle('Redo', { exact: true }).click();
  expect(await save(page, info.outputPath('closed-redone.rea.json'))).toEqual(current);

  await page.keyboard.press('Control+Shift+p');
  await clickCanvas(page, 340, 100); await clickCanvas(page, 480, 170); await page.keyboard.press('Escape');
  await expect(page.locator('.editor-widget.path')).toHaveCount(2);
  current = await save(page, info.outputPath('escape-open.rea.json'));
  expect(current.pages[0].widgets[1].vectorPath!.commands.map(c => c.op)).toEqual(['M', 'L']);
  absoluteAnchors(current.pages[0].widgets[1]).forEach((p, i) => expectPoint(p, [{ x: 340, y: 100 }, { x: 480, y: 170 }][i]));

  await page.getByTitle(/^Pen \(/).click();
  await clickCanvas(page, 100, 320); await clickCanvas(page, 200, 360); await clickCanvas(page, 300, 320, true);
  await expect(page.locator('.editor-widget.path')).toHaveCount(3);
  current = await save(page, info.outputPath('double-click-open.rea.json'));
  expect(current.pages[0].widgets[2].vectorPath!.commands.map(c => c.op)).toEqual(['M', 'L', 'L']);
  absoluteAnchors(current.pages[0].widgets[2]).forEach((p, i) => expectPoint(p, [{ x: 100, y: 320 }, { x: 200, y: 360 }, { x: 300, y: 320 }][i]));
  await page.screenshot({ path: info.outputPath('pen-completion.png') });
});

test('Pen drag authors actual cubic controls, Shift constrains the axis and Alt keeps the incoming corner independent', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept());
  const doc = createDocument(); doc.name = 'Pen handles'; doc.pages[0].widgets = [];
  await open(page, doc); await page.getByTitle('Pen (P)', { exact: true }).click();
  await clickCanvas(page, 100, 100);
  await drag(page, await canvasPoint(page, 240, 100), await canvasPoint(page, 280, 130), { shift: true });
  await clickCanvas(page, 320, 240); await page.keyboard.press('Escape');
  let saved = await save(page, info.outputPath('pen-symmetric.rea.json'));
  const symmetric = saved.pages[0].widgets[0], commands = symmetric.vectorPath!.commands;
  expect(commands.map(c => c.op)).toEqual(['M', 'C', 'C']);
  expectNodes(symmetric.vectorPath!, [{ x: (100 - symmetric.x) / symmetric.width, y: (100 - symmetric.y) / symmetric.height }, { x: (240 - symmetric.x) / symmetric.width, y: (100 - symmetric.y) / symmetric.height }, { x: (320 - symmetric.x) / symmetric.width, y: (240 - symmetric.y) / symmetric.height }]);
  const controls = neighboringControls(symmetric.vectorPath!, 1);
  const absolute = (point: XY, w: Widget) => ({ x: w.x + point.x * w.width, y: w.y + point.y * w.height });
  expectPoint(absolute(controls.incoming, symmetric), { x: 200, y: 100 });
  expectPoint(absolute(controls.outgoing, symmetric), { x: 280, y: 100 });

  await page.getByTitle('Pen (P)', { exact: true }).click();
  await clickCanvas(page, 100, 340);
  await drag(page, await canvasPoint(page, 240, 340), await canvasPoint(page, 280, 370), { alt: true });
  await clickCanvas(page, 320, 440); await page.keyboard.press('Escape');
  saved = await save(page, info.outputPath('pen-independent.rea.json'));
  expect(saved.pages[0].widgets).toHaveLength(2);
  expect(saved.pages[0].widgets[0]).toEqual(symmetric);
  const independent = saved.pages[0].widgets[1], independentControls = neighboringControls(independent.vectorPath!, 1);
  expect(independent.vectorPath!.commands.map(c => c.op)).toEqual(['M', 'L', 'C']);
  expectPoint(absolute(independentControls.incoming, independent), { x: 240, y: 340 });
  expectPoint(absolute(independentControls.outgoing, independent), { x: 280, y: 370 });
  await page.getByTitle('Undo', { exact: true }).click();
  const undone = await save(page, info.outputPath('pen-independent-undone.rea.json'));
  expect(undone.pages[0].widgets).toEqual([symmetric]);
  await page.getByTitle('Redo', { exact: true }).click();
  expect(await save(page, info.outputPath('pen-independent-redone.rea.json'))).toEqual(saved);
});

test('direct editing keeps one history entry per drag and none for point selection or a drag returning to its origin', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept());
  const { doc, widget } = seed(); await open(page, doc);
  await page.locator('.editor-widget.path').click();
  await page.getByRole('button', { name: 'Edit points', exact: true }).click();
  await expect(overlay(page)).toHaveAttribute('data-vector-widget-id', widget.id);
  const first = await center(anchor(page, 1));
  await drag(page, first, { x: first.x - 40, y: first.y + 20 });
  const moved = await save(page, info.outputPath('point-moved.rea.json'));
  expectNodes(moved.pages[0].widgets[0].vectorPath!, [{ x: 0, y: 0 }, { x: .8, y: .2 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  expect({ ...moved.pages[0].widgets[0], vectorPath: widget.vectorPath }).toEqual(widget);
  await anchor(page, 1).click();
  const afterMove = await center(anchor(page, 1));
  await drag(page, afterMove, { x: afterMove.x + 35, y: afterMove.y - 15 }, { returnToStart: true });
  await page.getByRole('button', { name: 'Done editing points', exact: true }).click();
  await page.getByRole('button', { name: 'Edit points', exact: true }).click();
  expect(await save(page, info.outputPath('point-noop.rea.json'))).toEqual(moved);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info.outputPath('point-undone.rea.json'))).toEqual(doc);
  await page.getByTitle('Redo', { exact: true }).click();
  expect(await save(page, info.outputPath('point-redone.rea.json'))).toEqual(moved);
  await ensurePoints(page);

  // Insert on the visible first edge; the expected midpoint is derived from its endpoints.
  const midpoint = await canvasPoint(page, 180, 110);
  await page.mouse.click(midpoint.x, midpoint.y);
  const inserted = await save(page, info.outputPath('point-inserted.rea.json'));
  expectNodes(inserted.pages[0].widgets[0].vectorPath!, [{ x: 0, y: 0 }, { x: .4, y: .1 }, { x: .8, y: .2 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  await anchor(page, 1).click(); await page.keyboard.press('Delete');
  await expect(page.locator('.editor-widget.path')).toHaveCount(1);
  const removed = await save(page, info.outputPath('point-removed.rea.json'));
  expectNodes(removed.pages[0].widgets[0].vectorPath!, [{ x: 0, y: 0 }, { x: .8, y: .2 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info.outputPath('point-delete-undone.rea.json'))).toEqual(inserted);
  await page.getByTitle('Redo', { exact: true }).click();
  expect(await save(page, info.outputPath('point-delete-redone.rea.json'))).toEqual(removed);
  await ensurePoints(page);
  await anchor(page, 1).click(); await page.keyboard.press('2');
  await expect(handle(page, 1, 'incoming')).toBeVisible(); await expect(handle(page, 1, 'outgoing')).toBeVisible();
  const curved = await save(page, info.outputPath('point-curved.rea.json'));
  expectNodes(curved.pages[0].widgets[0].vectorPath!, [{ x: 0, y: 0 }, { x: .8, y: .2 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  const oldControls = neighboringControls(curved.pages[0].widgets[0].vectorPath!, 1);
  expect(oldControls.incoming).not.toEqual({ x: .8, y: .2 });
  expect(oldControls.outgoing).not.toEqual({ x: .8, y: .2 });
  const outgoing = await center(handle(page, 1, 'outgoing'));
  await drag(page, outgoing, { x: outgoing.x + 20, y: outgoing.y - 10 }, { alt: true });
  const broken = await save(page, info.outputPath('point-independent-handle.rea.json'));
  const newControls = neighboringControls(broken.pages[0].widgets[0].vectorPath!, 1);
  // Point commits reframe the curve, so compare the handle positions on canvas.
  expectPoint(unrotatedPoint(broken.pages[0].widgets[0], newControls.incoming), unrotatedPoint(curved.pages[0].widgets[0], oldControls.incoming));
  const oldOutgoing = unrotatedPoint(curved.pages[0].widgets[0], oldControls.outgoing);
  expectPoint(unrotatedPoint(broken.pages[0].widgets[0], newControls.outgoing), { x: oldOutgoing.x + 20, y: oldOutgoing.y - 10 });
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info.outputPath('point-handle-undone.rea.json'))).toEqual(curved);
  await page.getByTitle('Redo', { exact: true }).click();
  expect(await save(page, info.outputPath('point-handle-redone.rea.json'))).toEqual(broken);
  await ensurePoints(page);
  await anchor(page, 1).click(); await page.keyboard.press('1');
  const sharp = await save(page, info.outputPath('point-sharp.rea.json'));
  expect(neighboringControls(sharp.pages[0].widgets[0].vectorPath!, 1)).toEqual({ incoming: { x: .8, y: .2 }, outgoing: { x: .8, y: .2 } });
  await anchor(page, 1).dblclick();
  const toggled = await save(page, info.outputPath('point-double-click-curve.rea.json'));
  expect(neighboringControls(toggled.pages[0].widgets[0].vectorPath!, 1).incoming).not.toEqual({ x: .8, y: .2 });
  await anchor(page, 1).dblclick();
  expect(await save(page, info.outputPath('point-double-click-sharp.rea.json'))).toEqual(sharp);
  await page.getByRole('button', { name: 'Done editing points', exact: true }).click();
  await expect(overlay(page)).toHaveCount(0);
  await clickCanvas(page, 101, 125, true); // Border away from resize handles enters point mode.
  await expect(overlay(page)).toBeVisible();
  expect(await save(page, info.outputPath('point-border-entered.rea.json'))).toEqual(sharp);
  await page.screenshot({ path: info.outputPath('direct-point-editing.png') });
});

test('rotated nested point editing at 150% uses adaptive visible geometry and survives save, preview and offline export', async ({ page, browser }, info) => {
  page.on('dialog', dialog => dialog.accept()); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { doc, widget } = seed('Nested rotated shared path');
  // This existing regression uses the legacy maximum-width document contract.
  // New pages use native minimum-size selection; opening old pages must not migrate them.
  delete doc.pages[0].adaptiveSelection;
  delete doc.pages[0].adaptiveBaseSize;
  widget.name = 'Nested edited vector'; widget.rotation = 30;
  const panel = createWidget('panel', 60, 70); panel.name = 'Vector editing panel'; panel.width = 500; panel.height = 360;
  panel.states![0].widgets = [widget];
  const outside = createWidget('path', 660, 70); outside.name = 'Untouched outer vector'; outside.vectorPath = polygon();
  doc.pages[0].widgets = [panel, outside];
  const viewId = uid();
  doc.pages[0].adaptiveViews = [{ id: viewId, name: 'Tablet path', width: 900, overrides: { [widget.id]: { x: 130, y: 90, width: 240, height: 120, rotation: 90 } } }];
  await open(page, doc);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption(viewId);
  await page.locator('.editor-widget.panel').dblclick();
  await page.getByLabel('Zoom', { exact: true }).selectOption('1.5');
  await page.locator('.editor-widget.path').click();
  await page.getByRole('button', { name: 'Edit points', exact: true }).click();
  // Visible point (1,0) = local (240,0); rotate 90° around (120,60).
  const first = await center(anchor(page, 1));
  expectPoint(first, await canvasPoint(page, 310, 270));
  // Inverse rotate this screen delta: local (-24,+12), normalized (-.1,+.1).
  await drag(page, first, { x: first.x - 18, y: first.y - 36 });
  await page.getByRole('button', { name: 'Done editing points', exact: true }).click();
  const file = info.outputPath('nested-rotated.rea.json'), saved = await save(page, file);
  const edited = saved.pages[0].widgets[0].states![0].widgets[0];
  expectNodes(edited.vectorPath!, [{ x: 0, y: 0 }, { x: .9, y: .1 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  const restored = structuredClone(saved); restored.pages[0].widgets[0].states![0].widgets[0].vectorPath = structuredClone(widget.vectorPath);
  expect(restored).toEqual(doc); // Base layout, outside object, view and existing override untouched.
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info.outputPath('nested-rotated-undone.rea.json'))).toEqual(doc);
  await page.getByTitle('Redo', { exact: true }).click();
  expect(await save(page, info.outputPath('nested-rotated-redone.rea.json'))).toEqual(saved);
  await reopen(page, file);
  expect(await save(page, info.outputPath('nested-rotated-reopened.rea.json'))).toEqual(saved);
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  const preview = page.locator('.preview-overlay'), displayed = preview.locator('.widget[aria-label="Nested edited vector"]');
  await expect(displayed.locator('svg [data-shadow-fill]')).toHaveAttribute('d', expectedPathData(edited.vectorPath!, 200, 100));
  await expect(displayed).toHaveCSS('transform', /matrix\(0\.8660.*0\.5.*-0\.5.*0\.8660/);
  await page.screenshot({ path: info.outputPath('nested-vector-preview.png') });
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  const html = info.outputPath('nested-vector.html'); await (await download).saveAs(html);
  const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
  try {
    const offline = await context.newPage(), requests: string[] = [];
    offline.on('pageerror', error => errors.push(error.message)); offline.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await offline.goto(pathToFileURL(html).href);
    await expect(offline.locator('.widget[aria-label="Nested edited vector"] svg [data-shadow-fill]')).toHaveAttribute('d', expectedPathData(edited.vectorPath!, 200, 100));
    await offline.setViewportSize({ width: 800, height: 900 });
    const adaptive = offline.locator('.widget[aria-label="Nested edited vector"]');
    await expect(adaptive.locator('svg [data-shadow-fill]')).toHaveAttribute('d', expectedPathData(edited.vectorPath!, 240, 120));
    await expect(adaptive).toHaveCSS('transform', 'matrix(0, 1, -1, 0, 0, 0)');
    await offline.screenshot({ path: info.outputPath('nested-vector-offline.png') });
    expect(requests).toEqual([]);
  } finally { await context.close(); }
  expect(errors).toEqual([]);
});

test('pointer cancellation restores the gesture, text fields own their keys, and changing context discards unfinished Pen drafts', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept());
  const { doc } = seed('Transient vector gestures');
  doc.pages.push({ ...structuredClone(doc.pages[0]), id: uid(), name: 'Other canvas', widgets: [] });
  await open(page, doc); await page.locator('.editor-widget.path').click();
  await page.getByRole('button', { name: 'Edit points', exact: true }).click();
  const point = await center(anchor(page, 1));
  await drag(page, point, { x: point.x - 20, y: point.y + 10 });
  const moved = await save(page, info.outputPath('cancel-before.rea.json'));
  expectNodes(moved.pages[0].widgets[0].vectorPath!, [{ x: 0, y: 0 }, { x: .9, y: .1 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  await overlay(page).evaluate(element => {
    element.addEventListener('pointerdown', event => element.setAttribute('data-test-pointer-id', String((event as PointerEvent).pointerId)), { once: true, capture: true });
  });
  const next = await center(anchor(page, 1));
  await page.mouse.move(next.x, next.y); await page.mouse.down();
  await page.mouse.move(next.x + 50, next.y + 30, { steps: 5 });
  // Exercise the browser's event route with the actual pointer ID observed on pointerdown.
  await overlay(page).evaluate(element => {
    const pointerId = Number(element.getAttribute('data-test-pointer-id'));
    if (!pointerId) throw new Error('No captured pointer ID');
    element.dispatchEvent(new PointerEvent('pointercancel', { pointerId, pointerType: 'mouse', bubbles: true }));
  });
  await page.mouse.up();
  expect(await save(page, info.outputPath('cancel-after.rea.json'))).toEqual(moved);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info.outputPath('cancel-undone.rea.json'))).toEqual(doc);
  await page.getByTitle('Redo', { exact: true }).click();
  await ensurePoints(page);
  await anchor(page, 1).click();
  const text = page.getByRole('complementary', { name: 'Properties inspector' }).getByLabel('Widget text', { exact: true });
  await text.fill(''); await text.pressSequentially('p12'); await text.press('Home'); await text.press('Delete');
  await expect(text).toHaveValue('12');
  const typed = await save(page, info.outputPath('text-keys.rea.json'));
  const expected = structuredClone(moved); expected.pages[0].widgets[0].text = '12';
  expect(typed).toEqual(expected);

  await page.getByTitle('Pen (P)', { exact: true }).click();
  await clickCanvas(page, 400, 300); await clickCanvas(page, 500, 380);
  await page.keyboard.press('Delete'); await page.keyboard.press('Backspace'); await page.keyboard.press('ArrowRight');
  await expect(page.locator('.editor-widget.path')).toHaveCount(1);
  await expect(page.locator('.vector-canvas-overlay[data-vector-mode="pen"] [data-vector-anchor]')).toHaveCount(2);
  expect(await save(page, info.outputPath('pen-keys-retain-existing.rea.json'))).toEqual(expected);
  await page.locator('.tree-list').getByRole('button', { name: 'Other canvas', exact: true }).dblclick();
  await expect(page.locator('.editor-widget')).toHaveCount(0);
  expect(await save(page, info.outputPath('page-draft-discarded.rea.json'))).toEqual(expected);
  await page.locator('.tree-list').getByRole('button', { name: doc.pages[0].name, exact: true }).dblclick();
  await expect(page.locator('.editor-widget.path')).toHaveCount(1);
  await expect(page.locator('.vector-canvas-overlay[data-vector-mode="pen"] [data-vector-anchor]')).toHaveCount(0);
  await page.getByTitle('Pen (P)', { exact: true }).click();
  await clickCanvas(page, 400, 300); await clickCanvas(page, 500, 380); await page.keyboard.press('v');
  await expect(page.locator('.vector-canvas-overlay[data-vector-mode="pen"]')).toHaveCount(0);
  expect(await save(page, info.outputPath('tool-draft-discarded.rea.json'))).toEqual(expected);

  // Open exactly the same page/current-ID context; a React key change alone cannot clear this draft.
  await clickCanvas(page, 650, 420); // Nothing selected.
  const sameFile = info.outputPath('same-context.rea.json'); await save(page, sameFile);
  await page.getByTitle('Pen (P)', { exact: true }).click();
  await clickCanvas(page, 400, 300); await clickCanvas(page, 500, 380);
  const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O'); await (await chooser).setFiles(sameFile);
  await expect(page.locator('.statusbar')).toContainText('Document opened');
  await expect(page.locator('.vector-canvas-overlay[data-vector-mode="pen"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  expect(await save(page, info.outputPath('same-context-opened.rea.json'))).toEqual(expected);
});

test('point editing keys cancel a held drag before applying to committed anchors and pointerup cannot resurrect the old node', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept());
  for (const key of ['Delete', '1', '2']) {
    const { doc, widget } = seed(`Held pointer then ${key}`);
    if (key === '1') widget.vectorPath = { fillRule: 'nonzero', commands: [
      { op: 'M', x: 0, y: 0 }, { op: 'C', x1: 0, y1: 0, x2: .8, y2: 0, x: 1, y: 0 },
      { op: 'C', x1: 1, y1: .2, x2: 1, y2: 1, x: 1, y: 1 }, { op: 'L', x: 0, y: 1 }, { op: 'Z' },
    ] };
    await open(page, doc); await page.locator('.editor-widget.path').click(); await page.getByRole('button', { name: 'Edit points', exact: true }).click();
    const first = await center(anchor(page, 1));
    await page.mouse.move(first.x, first.y); await page.mouse.down(); await page.mouse.move(first.x - 40, first.y + 20, { steps: 4 });
    await page.keyboard.press(key); await page.mouse.move(first.x - 70, first.y + 40, { steps: 3 }); await page.mouse.up();
    const edited = await save(page, info.outputPath(`held-${key}.rea.json`)), result = edited.pages[0].widgets[0];
    const expectedNodes = key === 'Delete' ? [{ x: 100, y: 100 }, { x: 300, y: 200 }, { x: 100, y: 200 }] : [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 200 }, { x: 100, y: 200 }];
    const actualNodes = nodes(result.vectorPath!); expect(actualNodes).toHaveLength(expectedNodes.length);
    actualNodes.forEach((point, index) => expectPoint(unrotatedPoint(result, point), expectedNodes[index]));
    if (key === '2') {
      const controls = neighboringControls(result.vectorPath!, 1);
      expect(unrotatedPoint(result, controls.incoming)).not.toEqual({ x: 300, y: 100 });
      expect(unrotatedPoint(result, controls.outgoing)).not.toEqual({ x: 300, y: 100 });
    }
    if (key === '1') expect(neighboringControls(result.vectorPath!, 1)).toEqual({ incoming: { x: 1, y: 0 }, outgoing: { x: 1, y: 0 } });
    // The new round controls have extrema at +/-4/(27*sqrt(2)) of the old size.
    expect([result.x, result.y, result.width, result.height]).toEqual(key === '2' ? [100, 89, 221, 111] : [100, 100, 200, 100]);
    expect({ ...result, x: widget.x, y: widget.y, width: widget.width, height: widget.height, vectorPath: widget.vectorPath }).toEqual(widget);
    await page.getByTitle('Undo', { exact: true }).click();
    expect(await save(page, info.outputPath(`held-${key}-undone.rea.json`))).toEqual(doc);
    await page.getByTitle('Redo', { exact: true }).click();
    expect(await save(page, info.outputPath(`held-${key}-redone.rea.json`))).toEqual(edited);
  }

  const { doc } = seed('Ordinary drag cancellation retains prior point history');
  await open(page, doc); await page.locator('.editor-widget.path').click(); await page.getByRole('button', { name: 'Edit points', exact: true }).click();
  const point = await center(anchor(page, 1));
  await drag(page, point, { x: point.x - 20, y: point.y + 10 });
  const committed = await save(page, info.outputPath('ordinary-drag-committed.rea.json'));
  expectNodes(committed.pages[0].widgets[0].vectorPath!, [{ x: 0, y: 0 }, { x: .9, y: .1 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  await page.getByRole('button', { name: 'Done editing points', exact: true }).click();
  const body = await center(page.locator('.editor-widget.path'));
  await page.mouse.move(body.x, body.y); await page.mouse.down(); await page.mouse.move(body.x + 30, body.y + 20, { steps: 4 });
  await page.keyboard.press('Control+z');
  await page.mouse.move(body.x + 55, body.y + 40, { steps: 3 }); await page.mouse.up();
  expect(await save(page, info.outputPath('ordinary-drag-cancelled.rea.json'))).toEqual(committed);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info.outputPath('ordinary-drag-prior-undone.rea.json'))).toEqual(doc);
  await page.getByTitle('Redo', { exact: true }).click();
  expect(await save(page, info.outputPath('ordinary-drag-prior-redone.rea.json'))).toEqual(committed);
});
