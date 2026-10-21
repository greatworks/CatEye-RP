import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDocument, createWidget, serializeDocument } from '../../src/model/document';
import type { Document, Widget } from '../../src/model/types';

// Browser host/transaction checks, not an execution of native Axure. Native
// single SelectionButton handles are west/east; persistent fit transitions
// require ordered out/back frames. Font/line metrics here are browser-derived.
const runRoot = path.resolve('.build/selection-pointer-host-e2e', `${Date.now()}-${process.pid}`);
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Properties inspector' });
function fixture(type: 'checkbox' | 'radio' = 'checkbox', fit = false) {
  const doc = createDocument(); doc.name = 'Selection pointer resize';
  doc.pages[0].width = 1200; doc.pages[0].height = 800;
  const widget = createWidget(type, 100, 100);
  Object.assign(widget, { id: 'pointer-first', name: 'Pointer first', text: 'First label', width: 240, height: 20,
    selectionText: { autoFitWidth: fit, autoFitHeight: false, alignRight: false } });
  Object.assign(widget.style, { fill: '#ffffff', stroke: '#123456', strokeWidth: 1, radius: 0,
    fontFamily: 'monospace', fontSize: 16, fontWeight: 400, lineHeight: 1.25,
    textAlign: 'left', verticalAlign: 'top', textPadding: [0, 0, 0, 0], selectionButtonSize: 14 });
  doc.pages[0].widgets = [widget]; return { doc, widget };
}
async function output(info: TestInfo, file: string) {
  const dir = path.join(runRoot, info.testId.replace(/[^a-zA-Z0-9_-]/g, '_'), `retry-${info.retry}`);
  await mkdir(dir, { recursive: true }); return path.join(dir, file);
}
async function open(page: Page, doc: Document, info: TestInfo) {
  await writeFile(await output(info, 'source.rea.json'), serializeDocument(doc));
  await page.goto('/'); const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'selection-pointer.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('rea-prototype-document-v1'))).toBe(serializeDocument(doc));
  await page.reload(); await expect(page.locator('.titlebar')).toContainText(doc.name);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
}
async function select(page: Page, type: 'checkbox' | 'radio' = 'checkbox', hasNativeLayout = true) {
  // Locator click positions are CSS screen offsets, including at 50% zoom.
  await page.locator(`.canvas-surface .editor-widget.${type}`).first().click();
  await expect(inspector(page).getByLabel('Widget name', { exact: true })).toHaveValue('Pointer first');
  if (hasNativeLayout) await expect(page.locator(`.canvas-surface .editor-widget.${type} label`).first()).toHaveAttribute('data-selection-fonts', 'ready');
}
async function save(page: Page, info: TestInfo, name: string): Promise<Document> {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = await output(info, `${name}.rea.json`); await (await download).saveAs(file);
  return JSON.parse(await readFile(file, 'utf8'));
}
async function cached(page: Page): Promise<Document> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('rea-prototype-document-v1')!));
}
async function shot(page: Page, info: TestInfo, name: string) { await page.screenshot({ path: await output(info, `${name}.png`) }); }
async function begin(page: Page, handle: string, name = 'Pointer first') {
  const group = page.locator(`.selection-group-frame .resize-handle.${handle}`);
  const target = await group.count() ? group : page.locator('.selection-frame').filter({ hasText: name }).locator(`.resize-handle.${handle}`);
  const box = await target.locator('..').boundingBox();
  if (!box) throw Error(`Missing ${handle} resize handle`);
  const zoom = Number(await page.getByLabel('Zoom', { exact: true }).inputValue());
  // obNM.zbNw/kI8w's logical origin is independent of the press position and
  // CSS hot-zone center. Side midpoints use size-1; right/bottom add that 1 back.
  const start = { x: handle.includes('w') ? box.x : handle.includes('e') ? box.x + box.width : box.x + (box.width - zoom) / 2,
    y: handle.includes('n') ? box.y : handle.includes('s') ? box.y + box.height : box.y + (box.height - zoom) / 2 };
  await page.mouse.move(start.x, start.y); await page.mouse.down(); return start;
}
async function drag(page: Page, handle: string, dx: number, dy = 0) {
  const start = await begin(page, handle); await page.mouse.move(start.x + dx, start.y + dy); await page.mouse.up();
}
async function number(page: Page, label: string, value: number) {
  const field = inspector(page).getByLabel(label, { exact: true }); await field.fill(String(value)); await field.press('Enter');
}
type Probe = { calls: number; failures: number; events: unknown[]; release(): Promise<void>; restore(): void };
type ProbedWindow = Window & { selectionPointerProbe: Probe };
async function instrument(page: Page, options: { delay?: boolean; failText?: string } = {}) {
  await page.evaluate(async options => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const load = document.fonts.load, rectangle = Range.prototype.getBoundingClientRect;
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    const outstanding: Promise<FontFace[]>[] = [];
    const probe: Probe = {
      calls: 0, failures: 0, events: [],
      async release() { release(); await Promise.allSettled(outstanding); await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); },
      restore() { document.fonts.load = load; Range.prototype.getBoundingClientRect = rectangle; },
    };
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture', 'dragstart']) document.addEventListener(type, event => {
      const record = { type, target: (event.target as HTMLElement).className, pointerId: (event as PointerEvent).pointerId,
        x: (event as PointerEvent).clientX, y: (event as PointerEvent).clientY, time: performance.now(),
        selection: getSelection()?.toString(), defaultPreventedAtDocumentCapture: event.defaultPrevented,
        notice: document.querySelector('.statusbar')?.textContent };
      probe.events.push(record);
    }, true);
    for (const type of ['blur', 'focus']) window.addEventListener(type, () => probe.events.push({ type, time: performance.now() }));
    if (options.delay) document.fonts.load = function(font, text) {
      probe.calls++; const pending = gate.then(() => load.call(this, font, text)); outstanding.push(pending); return pending;
    };
    Range.prototype.getBoundingClientRect = function() {
      const node = this.commonAncestorContainer, element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
      const owner = element?.closest<HTMLElement>('[data-selection-author-measure]');
      if (owner && options.failText && owner.textContent?.includes(options.failText)) {
        probe.failures++; throw Error('Intentional second selection pointer measurement failure');
      }
      return rectangle.call(this);
    };
    (window as unknown as ProbedWindow).selectionPointerProbe = probe;
  }, options);
}
async function waiting(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as unknown as ProbedWindow).selectionPointerProbe.calls)).toBeGreaterThan(0);
}
async function release(page: Page) { await page.evaluate(() => (window as unknown as ProbedWindow).selectionPointerProbe.release()); }
async function clean(page: Page) { await expect(page.locator('[data-selection-author-measure], [data-selection-display-measure]')).toHaveCount(0); }
async function undoExactly(page: Page, info: TestInfo, doc: Document, name: string) {
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, name)).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
}

for (const type of ['checkbox', 'radio'] as const) test(`${type} exposes only west/east handles and anchors the unchanged side`, async ({ page }, info) => {
  const { doc } = fixture(type); await open(page, doc, info); await select(page, type);
  await expect(page.locator('.selection-frame .resize-handle')).toHaveCount(2);
  await expect(page.locator('.selection-frame .resize-handle.w')).toHaveCount(1);
  await expect(page.locator('.selection-frame .resize-handle.e')).toHaveCount(1);
  await begin(page, 'e'); await page.mouse.up();
  expect(await save(page, info, 'no-move')).toEqual(doc); await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  await drag(page, 'e', 40, 35);
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('280');
  const expected = structuredClone(doc); expected.pages[0].widgets[0].width = 280;
  expect(await save(page, info, 'east')).toEqual(expected); await shot(page, info, 'east');
  await undoExactly(page, info, doc, 'east-undo'); await select(page, type);
  await drag(page, 'w', 40, 35);
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('200');
  const west = structuredClone(doc); Object.assign(west.pages[0].widgets[0], { x: 140, width: 200 });
  expect(await save(page, info, 'west')).toEqual(west); await undoExactly(page, info, doc, 'west-undo'); await clean(page);
});

for (const type of ['checkbox', 'radio'] as const) test(`${type} accepts Shift without enabling a hidden perpendicular resize handle`, async ({ page }, info) => {
  const { doc } = fixture(type, true); await open(page, doc, info); await select(page, type);
  await page.keyboard.down('Shift');
  await drag(page, 'w', 40, 35);
  await page.keyboard.up('Shift');
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('200');
  const expected = structuredClone(doc);
  Object.assign(expected.pages[0].widgets[0], { x: 140, width: 200 });
  expected.pages[0].widgets[0].selectionText!.autoFitWidth = false;
  expect(await save(page, info, 'shift-single')).toEqual(expected);
  await undoExactly(page, info, doc, 'shift-single-undo'); await clean(page);
});

test('Shift on a handle preserves an individually selected legacy group member', async ({ page }, info) => {
  const { doc, widget } = fixture(); const second = structuredClone(widget);
  widget.groupId = 'legacy-flat-group';
  Object.assign(second, { id: 'pointer-second', name: 'Pointer second', x: 450, width: 180, groupId: widget.groupId });
  doc.pages[0].widgets.push(second); await open(page, doc, info);
  await page.getByRole('button', { name: 'Outline', exact: true }).click();
  await page.locator('[data-outline-widget-id="pointer-first"] > span').click();
  await expect(page.locator('.selection-frame')).toHaveCount(1);
  await expect(page.locator('.canvas-surface .editor-widget.checkbox label').first()).toHaveAttribute('data-selection-fonts', 'ready');
  await page.keyboard.down('Shift'); const start = await begin(page, 'e');
  await expect(page.locator('.selection-frame')).toHaveCount(1);
  await page.mouse.move(start.x + 40, start.y); await page.mouse.up(); await page.keyboard.up('Shift');
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('280');
  const expected = structuredClone(doc); expected.pages[0].widgets[0].width = 280;
  expect(await save(page, info, 'shift-individual-group-member')).toEqual(expected);
  await undoExactly(page, info, doc, 'shift-individual-group-undo'); await clean(page);
});

test('Shift multi-resize projects the common frame before text height correction and final location', async ({ page }, info) => {
  const { doc, widget } = fixture(); const second = structuredClone(widget);
  Object.assign(second, { id: 'pointer-second', name: 'Pointer second', x: 450, width: 180 });
  doc.pages[0].widgets.push(second); await open(page, doc, info); await select(page); await page.keyboard.press('Control+a');
  await page.keyboard.down('Shift'); await drag(page, 'e', 106); await page.keyboard.up('Shift');
  // Retained hInw/CbNX/Size instructions request heights 24 at y98. Actual
  // monospace text measures 20 high; the final requested y98 is written last.
  const expected = structuredClone(doc);
  Object.assign(expected.pages[0].widgets[0], { y: 98, width: 288 });
  Object.assign(expected.pages[0].widgets[1], { x: 520, y: 98, width: 216 });
  expect(await save(page, info, 'shift-multiple')).toEqual(expected);
  await shot(page, info, 'shift-multiple');
  await undoExactly(page, info, doc, 'shift-multiple-undo'); await clean(page);
});

test('queued Shift move survives release with changed keys after fonts finish', async ({ page }, info) => {
  const { doc, widget } = fixture(); const second = structuredClone(widget);
  Object.assign(second, { id: 'pointer-second', name: 'Pointer second', x: 450, width: 180 });
  doc.pages[0].widgets.push(second); await open(page, doc, info); await select(page); await page.keyboard.press('Control+a');
  await instrument(page, { delay: true }); const start = await begin(page, 'e');
  await page.keyboard.down('Shift'); await page.mouse.move(start.x + 106, start.y); await waiting(page);
  await page.keyboard.up('Shift'); await page.mouse.up();
  // Native PF4p -> Moved finalizes history without another CbNX size frame.
  // Releasing Shift before pointer-up must not replace the last move's aspect.
  await page.keyboard.down('Shift'); expect(await cached(page)).toEqual(doc); await release(page);
  await expect(page.getByTitle('Undo', { exact: true })).toBeEnabled(); await page.keyboard.up('Shift');
  const expected = structuredClone(doc); Object.assign(expected.pages[0].widgets[0], { y: 98, width: 288 });
  Object.assign(expected.pages[0].widgets[1], { x: 520, y: 98, width: 216 });
  expect(await save(page, info, 'shift-queued-final-up')).toEqual(expected);
  await undoExactly(page, info, doc, 'shift-queued-undo'); await clean(page);
});

for (const snap of [false, true]) test(`Alt bypasses resize snapping without rejecting the gesture; Snap ${snap}`, async ({ page }, info) => {
  const { doc } = fixture(); await open(page, doc, info); await select(page);
  await page.getByRole('checkbox', { name: 'Snap', exact: true }).setChecked(snap);
  await page.keyboard.down('Alt'); await drag(page, 'e', 21); await page.keyboard.up('Alt');
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('261');
  const expected = structuredClone(doc); expected.pages[0].widgets[0].width = 261;
  expect(await save(page, info, 'alt-bypass')).toEqual(expected);
  await undoExactly(page, info, doc, 'alt-bypass-undo'); await clean(page);
});

test('font preparation retains ordered frames after pointer-up and completes with one undo', async ({ page }, info) => {
  const { doc } = fixture('checkbox', true); await open(page, doc, info); await select(page); await instrument(page, { delay: true });
  const start = await begin(page, 'e');
  for (const dx of [20, 0, 40]) await page.mouse.move(start.x + dx, start.y);
  await page.mouse.up(); await waiting(page);
  expect(await cached(page)).toEqual(doc); await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  const downloads: unknown[] = []; const downloaded = (item: unknown) => downloads.push(item); page.on('download', downloaded);
  await page.getByTitle('Save', { exact: true }).click();
  await expect(page.locator('.statusbar')).toContainText('Finish or cancel the selection resize');
  expect(await cached(page)).toEqual(doc); expect(downloads).toHaveLength(0); page.off('download', downloaded);
  await shot(page, info, 'finishing-before-fonts'); await release(page);
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('280');
  const expected = structuredClone(doc); expected.pages[0].widgets[0].width = 280;
  expected.pages[0].widgets[0].selectionText!.autoFitWidth = false;
  expect(await save(page, info, 'finishing-completed')).toEqual(expected);
  await undoExactly(page, info, doc, 'finishing-undo');
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info, 'finishing-redo')).toEqual(expected); await clean(page);
});

test('an out-and-back pointer gesture retains the first width-fit transition', async ({ page }, info) => {
  const { doc } = fixture('checkbox', true); await open(page, doc, info); await select(page);
  const start = await begin(page, 'e'); await page.mouse.move(start.x + 20, start.y);
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('260');
  await page.mouse.move(start.x, start.y); await page.mouse.up();
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('240');
  const expected = structuredClone(doc); expected.pages[0].widgets[0].selectionText!.autoFitWidth = false;
  expect(await save(page, info, 'out-back')).toEqual(expected);
  await undoExactly(page, info, doc, 'out-back-undo'); await clean(page);
});

for (const key of ['Escape', 'Control+z']) test(`${key} cancels a finishing gesture and ignores late fonts`, async ({ page }, info) => {
  const { doc } = fixture('checkbox', true); await open(page, doc, info); await select(page); await instrument(page, { delay: true });
  const start = await begin(page, 'e'); await page.mouse.move(start.x + 80, start.y); await page.mouse.up(); await waiting(page);
  await page.keyboard.press(key); await release(page);
  expect(await save(page, info, 'cancelled-finishing')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled(); await clean(page);
});

test('Escape restores an already published preview and cancels all fit changes', async ({ page }, info) => {
  const { doc } = fixture('checkbox', true); await open(page, doc, info); await select(page);
  const start = await begin(page, 'e'); await page.mouse.move(start.x + 40, start.y);
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('280');
  await page.keyboard.press('Escape'); await page.mouse.up();
  expect(await save(page, info, 'cancelled-preview')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled(); await clean(page);
});

test('a view round trip while fonts are pending invalidates the gesture monotonically', async ({ page }, info) => {
  const { doc } = fixture('checkbox', true);
  doc.pages[0].adaptiveViews = [{ id: 'phone', name: 'Phone', width: 600, overrides: {} }];
  await open(page, doc, info); await select(page); await instrument(page, { delay: true });
  const start = await begin(page, 'e'); await page.mouse.move(start.x + 40, start.y); await page.mouse.up(); await waiting(page);
  // selectOption deliberately exercises context invalidation independently of
  // the pointer capture guard used for actual outside clicks.
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('phone');
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('');
  await release(page); expect(await save(page, info, 'view-roundtrip')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled(); await clean(page);
});

test('zoom and snap project the absolute edge and preserve the untouched dimension', async ({ page }, info) => {
  const { doc } = fixture(); await open(page, doc, info);
  await page.getByLabel('Zoom', { exact: true }).selectOption('0.5'); await page.getByRole('checkbox', { name: 'Snap', exact: true }).check();
  await select(page); await drag(page, 'e', 21, 19);
  // 21 screen pixels / .5 moves the edge 340 -> 382 -> grid 384, hence dx44.
  // Native E freedom discards the perpendicular correction for a single owner.
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('284');
  const expected = structuredClone(doc); expected.pages[0].widgets[0].width = 284;
  expect(await save(page, info, 'zoom-snap')).toEqual(expected); await shot(page, info, 'zoom-snap');
  await undoExactly(page, info, doc, 'zoom-snap-undo'); await clean(page);
});

for (const [zoom, delta] of [[1,20],[2,12]]) test(`absolute grid edge honors device tolerance at zoom ${zoom}`, async ({ page }, info) => {
  const { doc, widget } = fixture(); widget.width = 80; widget.text = 'X';
  await open(page, doc, info); await page.getByLabel('Zoom', { exact: true }).selectOption(String(zoom));
  await page.getByRole('checkbox', { name: 'Snap', exact: true }).check(); await select(page);
  await drag(page, 'e', 21);
  const expected = structuredClone(doc); expected.pages[0].widgets[0].width = 80 + delta;
  expect(await save(page, info, 'grid-edge')).toEqual(expected);
  await undoExactly(page, info, doc, 'grid-edge-undo'); await clean(page);
});

test('pressing off the logical hotzone does not replace the native drag origin', async ({ page }, info) => {
  const { doc } = fixture(); await open(page, doc, info); await select(page);
  const box = await page.locator('.selection-frame .resize-handle.e').boundingBox();
  if (!box) throw Error('Missing east handle');
  const surface = await page.locator('.canvas-surface').boundingBox();
  if (!surface) throw Error('Missing canvas');
  // This press is deliberately offset within the 7px hit box. Native kI8w
  // stays x340 regardless of this point; the final logical x is 361.
  await page.mouse.move(box.x + 1, box.y + 1); await page.mouse.down();
  await page.mouse.move(surface.x + 361, surface.y + 109.5); await page.mouse.up();
  const expected = structuredClone(doc); expected.pages[0].widgets[0].width = 261;
  expect(await save(page, info, 'off-center-press')).toEqual(expected);
  await undoExactly(page, info, doc, 'off-center-undo'); await clean(page);
});

test('Alt changes bypass per move and release does not reapply the grid', async ({ page }, info) => {
  const { doc } = fixture(); await open(page, doc, info); await select(page);
  await page.getByRole('checkbox', { name: 'Snap', exact: true }).check();
  const start = await begin(page, 'e'); await page.mouse.move(start.x + 21, start.y);
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('260');
  await page.keyboard.down('Alt'); await page.mouse.move(start.x + 23, start.y);
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('263');
  await page.keyboard.up('Alt'); await page.mouse.up();
  const expected = structuredClone(doc); expected.pages[0].widgets[0].width = 263;
  expect(await save(page, info, 'alt-live-release')).toEqual(expected);
  await undoExactly(page, info, doc, 'alt-live-undo'); await clean(page);
});

test('a single SelectionButton accepts initial Control because it cannot rotate', async ({ page }, info) => {
  const { doc } = fixture(); await open(page, doc, info); await select(page);
  await page.keyboard.down('Control'); await drag(page, 'e', 21); await page.keyboard.up('Control');
  const expected = structuredClone(doc); expected.pages[0].widgets[0].width = 261;
  expect(await save(page, info, 'single-control')).toEqual(expected);
  await undoExactly(page, info, doc, 'single-control-undo'); await clean(page);
});

for (const mode of ['initial-control','later-control','control-alt','control-shift'] as const)
test(`multiple selection captures controller mode: ${mode}`, async ({ page }, info) => {
  const { doc, widget } = fixture(); const second = structuredClone(widget);
  Object.assign(second, { id: 'pointer-second', name: 'Pointer second', x: 450, width: 180 });
  doc.pages[0].widgets.push(second); await open(page, doc, info); await select(page); await page.keyboard.press('Control+a');
  if (mode !== 'later-control') await page.keyboard.down('Control');
  if (mode === 'control-alt') await page.keyboard.down('Alt');
  if (mode === 'control-shift') await page.keyboard.down('Shift');
  const start = await begin(page, 'e');
  if (mode === 'later-control') await page.keyboard.down('Control');
  await page.mouse.move(start.x + 106, start.y); await page.mouse.up();
  await page.keyboard.up('Control'); await page.keyboard.up('Alt'); await page.keyboard.up('Shift');
  if (mode === 'initial-control') {
    // The captured rotation mode snaps this nearly collinear move to zero;
    // it must neither resize the owners nor create an empty undo entry.
    await expect(page.locator('.statusbar')).toContainText('Selection rotated');
    expect(await save(page, info, mode)).toEqual(doc); await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  } else {
    const expected = structuredClone(doc), y = mode === 'control-shift' ? 98 : 100;
    Object.assign(expected.pages[0].widgets[0], { width: 288, y });
    Object.assign(expected.pages[0].widgets[1], { x: 520, width: 216, y });
    expect(await save(page, info, mode)).toEqual(expected); await undoExactly(page, info, doc, `${mode}-undo`);
  }
  await clean(page);
});

for (const delayed of [false,true]) test(`Shift grid frames consume accepted text-layout bounds; delayed fonts ${delayed}`, async ({ page }, info) => {
  const { doc, widget } = fixture(); const second = structuredClone(widget);
  Object.assign(second, { id: 'pointer-second', name: 'Pointer second', x: 450, width: 180 });
  doc.pages[0].widgets.push(second); await open(page, doc, info); await select(page); await page.keyboard.press('Control+a');
  await page.getByRole('checkbox', { name: 'Snap', exact: true }).check();
  if (delayed) await instrument(page, { delay: true });
  await page.keyboard.down('Shift'); const start = await begin(page, 'se');
  await page.mouse.move(start.x + 106, start.y + 4);
  await page.mouse.move(start.x + 122, start.y + 5);
  await page.keyboard.up('Shift'); await page.mouse.up();
  if (delayed) { await waiting(page); expect(await cached(page)).toEqual(doc); await release(page); }
  await expect(page.getByTitle('Undo', { exact: true })).toBeEnabled();
  // Frozen original-input CIL followed by original controller/Size CIL,
  // with an explicit 20px text-height sink. No product planner sets this oracle.
  const oracle = JSON.parse(await readFile('research/selection-input-grid-live-session-probes.json','utf8'));
  const actual = await save(page, info, 'live-grid-frames'), expected = structuredClone(doc);
  for (let i=0;i<2;i++) {
    for (const key of ['x','y','width','height'] as const)
      expect(actual.pages[0].widgets[i][key]).toBeCloseTo(oracle.liveOwners[i].rect[key],9);
    Object.assign(expected.pages[0].widgets[i],Object.fromEntries(['x','y','width','height'].map(key=>[key,actual.pages[0].widgets[i][key as 'x']])));
  }
  expect(actual).toEqual(expected); await shot(page, info, 'live-grid-frames');
  await undoExactly(page, info, doc, 'live-grid-undo'); await clean(page);
});

test('unmapped Space input cannot be mistaken for native exact-Control mode', async ({ page }, info) => {
  const { doc } = fixture(); await open(page, doc, info); await select(page);
  await page.keyboard.down('Control'); await page.keyboard.down('Space'); await drag(page,'e',21);
  await page.keyboard.up('Space'); await page.keyboard.up('Control');
  await expect(page.locator('.statusbar')).toContainText('Space or Meta is not available');
  expect(await save(page,info,'space-blocked')).toEqual(doc); await expect(page.getByTitle('Undo',{exact:true})).toBeDisabled();
  const start=await begin(page,'e'); await page.mouse.move(start.x+40,start.y);
  await expect(inspector(page).getByLabel('W',{exact:true})).toHaveValue('280');
  await page.keyboard.down('Space'); await page.mouse.up(); await page.keyboard.up('Space');
  expect(await save(page,info,'space-cancelled')).toEqual(doc); await expect(page.getByTitle('Undo',{exact:true})).toBeDisabled();
  await clean(page);
});

test('a pending font property blocks pointer start without losing the accepted font intent', async ({ page }, info) => {
  const { doc } = fixture(); await open(page, doc, info); await select(page); await instrument(page, { delay: true });
  await number(page, 'Size', 24); await waiting(page); await drag(page, 'e', 40);
  expect(await cached(page)).toEqual(doc); expect(await page.evaluate(() => getSelection()?.toString())).toBe(''); await release(page);
  await expect.poll(async () => (await cached(page)).pages[0].widgets[0].style.fontSize).toBe(24);
  const afterFont = structuredClone(doc); Object.assign(afterFont.pages[0].widgets[0], { height: 30 }); afterFont.pages[0].widgets[0].style.fontSize = 24;
  // Read the intermediate intent without adding a Save action to this gesture
  // sequence. The final state is still independently saved and reopened below.
  const fontReadback = await cached(page); expect(fontReadback).toEqual(afterFont);
  await writeFile(await output(info, 'font-before-retry.rea.json'), serializeDocument(fontReadback));
  await drag(page, 'e', 40);
  await writeFile(await output(info, 'font-retry-events.json'), JSON.stringify(await page.evaluate(() => ({ events: (window as unknown as ProbedWindow).selectionPointerProbe.events, notice: document.querySelector('.statusbar')?.textContent })), null, 2));
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('280');
  const events = await page.evaluate(() => (window as unknown as ProbedWindow).selectionPointerProbe.events as { type: string }[]);
  expect(events.some(event => event.type === 'dragstart' || event.type === 'pointercancel')).toBe(false);
  const expected = structuredClone(afterFont); expected.pages[0].widgets[0].width = 280;
  expect(await save(page, info, 'font-then-retry')).toEqual(expected);
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'retry-undo')).toEqual(afterFont);
  await undoExactly(page, info, doc, 'font-undo'); await clean(page);
});

test('mixed selection controls and ordinary widgets reject the entire resize', async ({ page }, info) => {
  const { doc } = fixture(); const box = createWidget('box', 450, 100); Object.assign(box, { id: 'pointer-box', name: 'Ordinary box', width: 180, height: 20 });
  doc.pages[0].widgets.push(box); await open(page, doc, info); await select(page); await page.keyboard.press('Control+a');
  await expect(page.locator('.selection-frame')).toHaveCount(2); await drag(page, 'e', 40);
  await expect(page.locator('.statusbar')).toContainText('Resize selection controls separately from other widget types');
  expect(await save(page, info, 'mixed-rejected')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled(); await clean(page);
});

test('failure measuring the second selected control rolls back both targets and creates no undo', async ({ page }, info) => {
  const { doc, widget } = fixture(); const second: Widget = structuredClone(widget);
  Object.assign(second, { id: 'pointer-second', name: 'Pointer second', text: 'SECOND FAIL', x: 450, width: 180 });
  doc.pages[0].widgets.push(second); await open(page, doc, info); await select(page); await page.keyboard.press('Control+a');
  await expect(page.locator('.selection-group-frame')).toHaveCount(1);
  await expect(page.locator('.selection-group-frame .resize-handle')).toHaveCount(8);
  await expect(page.locator('.selection-frame:not(.selection-group-frame) .resize-handle')).toHaveCount(0);
  await instrument(page, { failText: 'SECOND FAIL' });
  await drag(page, 'e', 106);
  await expect(page.locator('.statusbar')).toContainText('Intentional second selection pointer measurement failure');
  await expect.poll(() => page.evaluate(() => (window as unknown as ProbedWindow).selectionPointerProbe.failures)).toBe(1);
  expect(await save(page, info, 'multi-failure')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled(); await shot(page, info, 'multi-failure'); await clean(page);
  await page.evaluate(() => (window as unknown as ProbedWindow).selectionPointerProbe.restore());
  await drag(page, 'e', 106);
  await expect(page.locator('.statusbar')).toContainText('Selection resized');
  // The original INw2 projection uses the shared 530px selection frame, not
  // two independent +106px resizes. Browser text metrics remain a fixture.
  const expected = structuredClone(doc);
  Object.assign(expected.pages[0].widgets[0], { width: 288 });
  Object.assign(expected.pages[0].widgets[1], { x: 520, width: 216 });
  expect(await save(page, info, 'multi-retry')).toEqual(expected);
  await shot(page, info, 'multi-retry'); await undoExactly(page, info, doc, 'multi-retry-undo');
});

test('pointer geometry stays in the current view despite Affect all views, while fit is shared', async ({ page }, info) => {
  const { doc, widget } = fixture('checkbox', true);
  doc.pages[0].adaptiveViews = [
    { id: 'tablet', name: 'Tablet', width: 900, overrides: { [widget.id]: { x: 120, y: 120, width: 260, height: 20 } } },
    { id: 'phone', name: 'Phone', width: 600, baseViewId: 'tablet', overrides: { [widget.id]: { style: { color: '#456789' } } } },
    { id: 'wide', name: 'Wide', width: 1100, overrides: { [widget.id]: { width: 350, height: 70 } } },
  ];
  doc.pages[0].adaptiveOverrides = { inactive: { [widget.id]: { x: 71, y: 91, width: 173, height: 41, style: { underline: true } } } };
  await open(page, doc, info); await page.getByLabel('Adaptive view', { exact: true }).selectOption('phone'); await select(page);
  await page.getByLabel('Affect all views', { exact: true }).check(); await drag(page, 'e', 40);
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('300');
  const expected = structuredClone(doc);
  expected.pages[0].widgets[0].selectionText!.autoFitWidth = false;
  expected.pages[0].adaptiveViews[1].overrides[widget.id] = { style: { color: '#456789' }, width: 300, height: 20 };
  expect(await save(page, info, 'current-view-aav')).toEqual(expected);
  await shot(page, info, 'current-view-aav'); await undoExactly(page, info, doc, 'current-view-aav-undo'); await clean(page);
});

test('abnormal pointer capture loss restores an already published preview', async ({ page }, info) => {
  const { doc } = fixture('checkbox', true); await open(page, doc, info); await select(page); await instrument(page);
  const start = await begin(page, 'e'); await page.mouse.move(start.x + 40, start.y);
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('280');
  const released = await page.evaluate(() => {
    const probe = (window as unknown as ProbedWindow).selectionPointerProbe;
    const down = probe.events.find(row => (row as { type: string }).type === 'pointerdown') as { pointerId: number };
    const handle = document.querySelector<HTMLElement>('.selection-frame .resize-handle.e')!;
    const owned = handle.hasPointerCapture(down.pointerId); handle.releasePointerCapture(down.pointerId); return owned;
  });
  expect(released).toBe(true); await page.mouse.move(start.x + 41, start.y); await page.mouse.up();
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('240');
  expect(await save(page, info, 'lost-capture')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled(); await clean(page);
});

test('locked controls participate in the group frame but are never measured or changed', async ({ page }, info) => {
  const { doc, widget } = fixture(); const locked = structuredClone(widget);
  Object.assign(locked, { id: 'pointer-locked', name: 'Locked control', x: 450, width: 180, locked: true, checked: true,
    selectedStyle: { fontSize: 28 }, text: 'LOCKED MUST NOT MEASURE' });
  doc.pages[0].widgets.push(locked); await open(page, doc, info); await select(page); await page.keyboard.press('Control+a');
  await expect(page.locator('.selection-group-frame .resize-handle')).toHaveCount(8);
  await instrument(page, { failText: 'LOCKED MUST NOT MEASURE' }); await drag(page, 'e', 106);
  await expect(page.locator('.statusbar')).toContainText('Selection resized');
  const expected = structuredClone(doc); expected.pages[0].widgets[0].width = 288;
  expect(await save(page, info, 'mixed-locked')).toEqual(expected);
  expect(await page.evaluate(() => (window as unknown as ProbedWindow).selectionPointerProbe.failures)).toBe(0);
  await undoExactly(page, info, doc, 'mixed-locked-undo'); await clean(page);
  const allLocked = structuredClone(doc); allLocked.pages[0].widgets[0].locked = true;
  await open(page, allLocked, info); await page.locator('.canvas-surface').focus(); await page.keyboard.press('Control+a');
  await expect(page.locator('.selection-group-frame')).toHaveCount(1);
  await expect(page.locator('.selection-frame .resize-handle')).toHaveCount(0);
  expect(await save(page, info, 'all-locked')).toEqual(allLocked); await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
});

test('legacy selection controls retain their existing eight-handle resize policy', async ({ page }, info) => {
  const { doc, widget } = fixture(); delete widget.selectionText; delete widget.style.selectionButtonSize;
  await open(page, doc, info); await select(page, 'checkbox', false);
  await expect(page.locator('.selection-frame .resize-handle')).toHaveCount(8);
  await drag(page, 'e', 40, 35); await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('280');
  const expected = structuredClone(doc); expected.pages[0].widgets[0].width = 280;
  expect(await save(page, info, 'legacy-resize')).toEqual(expected); await undoExactly(page, info, doc, 'legacy-resize-undo'); await select(page, 'checkbox', false);
  await drag(page, 'e', -500); await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('8');
  expected.pages[0].widgets[0].width = 8;
  expect(await save(page, info, 'legacy-minimum')).toEqual(expected); await undoExactly(page, info, doc, 'legacy-minimum-undo');
});
