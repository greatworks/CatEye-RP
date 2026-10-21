import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDocument, createWidget, serializeDocument } from '../../src/model/document';
import type { Document, Widget } from '../../src/model/types';

// Independent author-host checks: browser fonts/Range are measured, while the
// persistence and source-derived P94 expectations below are explicit. No test
// imports the transaction/planner to calculate its own expected result.
const runRoot = path.resolve('.build/selection-author-properties-evidence', `${Date.now()}-${process.pid}`);
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Properties inspector' });
function fixture(options: { rich?: boolean; mixed?: boolean; fit?: boolean } = {}) {
  const doc = createDocument(); doc.name = 'Selection author property transactions';
  doc.pages[0].width = 1200; doc.pages[0].height = 800;
  const widget = createWidget('checkbox', 100, 100);
  Object.assign(widget, { id: 'property-check', name: 'Property check', text: 'MMMMMMMMMMMM', width: 240, height: 40,
    selectionText: { autoFitWidth: options.fit ?? false, autoFitHeight: false, alignRight: false } });
  Object.assign(widget.style, { fill: '#ffffff', stroke: '#123456', strokeWidth: 1, radius: 0,
    fontFamily: 'monospace', fontSize: 16, fontWeight: 400, lineHeight: 1.25,
    textAlign: 'left', verticalAlign: 'top', textPadding: [0, 0, 0, 0], selectionButtonSize: 14 });
  if (options.rich) widget.richText = { expressionMode: 'literal', paragraphs: [{ lineHeightPx: 20, runs: [
    { text: 'MMMMMM', style: { fontSize: 10, color: '#123456' } },
    { text: 'MMMMMM', style: { fontSize: 24, fontWeight: 700 } },
  ] }] };
  doc.pages[0].widgets = [widget];
  if (options.mixed) {
    const box = createWidget('box', 450, 100);
    Object.assign(box, { id: 'property-box', name: 'Ordinary box', text: 'Ordinary text', width: 180, height: 60 });
    Object.assign(box.style, { fontFamily: 'monospace', fontSize: 16, textPadding: [3, 5, 7, 9] });
    doc.pages[0].widgets.push(box);
  }
  return { doc, widget };
}
async function output(info: TestInfo, file: string) {
  const dir = path.join(runRoot, info.testId.replace(/[^a-zA-Z0-9_-]/g, '_'), `retry-${info.retry}`);
  await mkdir(dir, { recursive: true }); return path.join(dir, file);
}
async function open(page: Page, doc: Document, info: TestInfo) {
  await writeFile(await output(info, 'source.rea.json'), serializeDocument(doc));
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'selection-author-properties.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('rea-prototype-document-v1'))).toBe(serializeDocument(doc));
  await page.reload();
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
}
async function select(page: Page) {
  await page.locator('.canvas-surface .editor-widget.checkbox').click({ position: { x: 30, y: 10 } });
  await expect(inspector(page).getByLabel('Widget name', { exact: true })).toHaveValue('Property check');
  await expect(page.locator('.canvas-surface .editor-widget.checkbox label')).toHaveAttribute('data-selection-fonts', 'ready');
}
async function number(page: Page, label: string, value: number) {
  const field = inspector(page).getByLabel(label, { exact: true });
  await field.fill(String(value)); await field.press('Enter');
}
async function saved(page: Page): Promise<Document> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('rea-prototype-document-v1')!));
}
async function save(page: Page, info: TestInfo, name: string): Promise<Document> {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = await output(info, `${name}.rea.json`); await (await download).saveAs(file);
  return JSON.parse(await readFile(file, 'utf8'));
}
async function screenshot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: await output(info, `${name}.png`) });
}
async function clean(page: Page) {
  await expect(page.locator('[data-selection-author-measure], [data-selection-display-measure]')).toHaveCount(0);
}
type FontProbe = {
  calls: number; failures: number; reads: { text: string; fontSize: string; width: number }[];
  release(): Promise<void>; restore(): void;
};
type ProbedWindow = Window & { selectionPropertiesProbe: FontProbe };
async function instrument(page: Page, options: { delay?: boolean; fail?: boolean } = {}) {
  await page.evaluate(async options => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const nativeLoad = document.fonts.load, nativeRect = Range.prototype.getBoundingClientRect;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const outstanding: Promise<FontFace[]>[] = [];
    const probe: FontProbe = {
      calls: 0, failures: 0, reads: [],
      async release() {
        release(); await Promise.allSettled(outstanding); await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      },
      restore() { document.fonts.load = nativeLoad; Range.prototype.getBoundingClientRect = nativeRect; },
    };
    if (options.delay) document.fonts.load = function(font, text) {
      probe.calls++; const request = gate.then(() => nativeLoad.call(this, font, text));
      outstanding.push(request); return request;
    };
    Range.prototype.getBoundingClientRect = function() {
      const node = this.commonAncestorContainer;
      const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
      const owner = element?.closest<HTMLElement>('[data-selection-author-measure]');
      if (owner && options.fail) { probe.failures++; throw Error('Intentional selection property measurement failure'); }
      const rect = nativeRect.call(this);
      if (owner) probe.reads.push({ text: owner.textContent ?? '', fontSize: getComputedStyle(owner).fontSize, width: rect.width });
      return rect;
    };
    (window as unknown as ProbedWindow).selectionPropertiesProbe = probe;
  }, options);
}
async function waiting(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as unknown as ProbedWindow).selectionPropertiesProbe.calls)).toBeGreaterThan(0);
}
async function release(page: Page) {
  await page.evaluate(() => (window as unknown as ProbedWindow).selectionPropertiesProbe.release());
}
async function observations(page: Page) {
  return page.evaluate(() => {
    const { calls, failures, reads } = (window as unknown as ProbedWindow).selectionPropertiesProbe;
    return { calls, failures, reads };
  });
}
function withGeometry(original: Widget, updated: Widget) {
  return { ...original, x: updated.x, y: updated.y, width: updated.width, height: updated.height };
}

test('P94 larger than the old owner uses the old panel before measuring the new indicator layout', async ({ page }, info) => {
  const { doc, widget } = fixture(); widget.width = 100; widget.text = 'M';
  await open(page, doc, info); await select(page);
  await number(page, 'Indicator size', 150);
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('236');
  await expect(inspector(page).getByLabel('H', { exact: true })).toHaveValue('150');
  const expected = structuredClone(doc);
  Object.assign(expected.pages[0].widgets[0], { width: 236, height: 150 });
  expected.pages[0].widgets[0].style.selectionButtonSize = 150;
  // Old panel width = 100 - 14 = 86; P94 preflight requests 150 + 86.
  expect(await save(page, info, 'p94-preflight')).toEqual(expected);
  await screenshot(page, info, 'p94-preflight');
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'p94-undo')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled(); await clean(page);
});

test('named-view font edits measure projected runs and preserve raw shared rich text', async ({ page }, info) => {
  const { doc, widget } = fixture({ rich: true, fit: true });
  doc.pages[0].adaptiveViews = [{ id: 'phone', name: 'Phone', width: 700, overrides: {
    [widget.id]: { style: { color: '#345678' } },
  } }];
  await open(page, doc, info); await page.getByLabel('Adaptive view', { exact: true }).selectOption('phone'); await select(page);
  await instrument(page); await number(page, 'Size', 32);
  await expect.poll(async () => (await saved(page)).pages[0].adaptiveViews[0].overrides[widget.id].style?.fontSize).toBe(32);
  const changed = await save(page, info, 'named-font');
  expect(changed.pages[0].widgets).toEqual(doc.pages[0].widgets);
  expect(changed.pages[0].adaptiveViews[0].overrides[widget.id].style).toEqual({ color: '#345678', fontSize: 32 });
  const measured = (await observations(page)).reads.filter(row => row.text === widget.text && row.fontSize === '32px');
  expect(measured.length).toBeGreaterThan(0);
  expect(changed.pages[0].adaptiveViews[0].overrides[widget.id].width).toBe(Math.round(measured.at(-1)!.width) + 14);
  await expect(page.locator('.editor-widget.checkbox [data-rich-run]').first()).toHaveCSS('font-size', '32px');
  await screenshot(page, info, 'named-font');
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'named-font-undo')).toEqual(doc);
  await clean(page);
});

test('all-view P94 style cleanup leaves internal Size current-only and inactive geometry intact', async ({ page }, info) => {
  const { doc, widget } = fixture(); widget.width = 100; widget.text = 'M';
  doc.pages[0].adaptiveViews = [
    { id: 'tablet', name: 'Tablet', width: 900, overrides: { [widget.id]: { width: 110, height: 60, style: { selectionButtonSize: 20, color: '#123456' } } } },
    { id: 'phone', name: 'Phone', width: 700, baseViewId: 'tablet', overrides: { [widget.id]: { width: 100, height: 40, style: { selectionButtonSize: 14 } } } },
    { id: 'sibling', name: 'Sibling', width: 800, overrides: { [widget.id]: { width: 180, height: 80, style: { selectionButtonSize: 22 } } } },
  ];
  doc.pages[0].adaptiveOverrides = { inactive: { [widget.id]: { width: 190, height: 81, style: { selectionButtonSize: 30, underline: true } } } };
  await open(page, doc, info); await page.getByLabel('Adaptive view', { exact: true }).selectOption('phone'); await select(page);
  await page.getByLabel('Affect all views', { exact: true }).check(); await number(page, 'Indicator size', 150);
  await expect(inspector(page).getByLabel('W', { exact: true })).toHaveValue('236');
  const expected = structuredClone(doc); expected.pages[0].widgets[0].style.selectionButtonSize = 150;
  expected.pages[0].adaptiveViews[0].overrides[widget.id] = { width: 110, height: 60, style: { color: '#123456' } };
  expected.pages[0].adaptiveViews[1].overrides[widget.id] = { width: 236, height: 150 };
  expected.pages[0].adaptiveViews[2].overrides[widget.id] = { width: 180, height: 80 };
  expected.pages[0].adaptiveOverrides!.inactive[widget.id] = { width: 190, height: 81, style: { underline: true } };
  expect(await save(page, info, 'all-view-style')).toEqual(expected);
  await screenshot(page, info, 'all-view-style');
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'all-view-style-undo')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled(); await clean(page);
});

test('mixed selection measurement failure commits no ordinary styles; retry is one undoable command', async ({ page }, info) => {
  const { doc, widget } = fixture({ mixed: true });
  await open(page, doc, info); await select(page); await page.keyboard.press('Control+a');
  await expect(page.locator('.selection-frame')).toHaveCount(2);
  await instrument(page, { fail: true }); await number(page, 'Padding left', 18);
  await expect(page.locator('.statusbar')).toContainText('Intentional selection property measurement failure');
  expect((await observations(page)).failures).toBe(1);
  expect(await save(page, info, 'mixed-rejected')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  await page.evaluate(() => (window as unknown as ProbedWindow).selectionPropertiesProbe.restore());
  // NumberField already contains the rejected draft. Commit a distinct valid
  // value rather than assuming rejection must reset that unrelated field UI.
  await number(page, 'Padding left', 19);
  await expect.poll(async () => (await saved(page)).pages[0].widgets[0].style.textPadding).toEqual([0, 0, 0, 19]);
  const changed = await save(page, info, 'mixed-retry');
  expect(changed.pages[0].widgets[1]).toEqual({ ...doc.pages[0].widgets[1], style: { ...doc.pages[0].widgets[1].style, textPadding: [3, 5, 7, 19] } });
  expect(changed.pages[0].widgets[0]).toEqual({ ...withGeometry(widget, changed.pages[0].widgets[0]), style: { ...widget.style, textPadding: [0, 0, 0, 19] } });
  await screenshot(page, info, 'mixed-retry');
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'mixed-undo')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled(); await clean(page);
});

test('font-delayed different property fields and continuous plain text survive FIFO with per-command undo', async ({ page }, info) => {
  const { doc, widget } = fixture({ fit: true });
  await open(page, doc, info); await select(page); await instrument(page, { delay: true });
  await number(page, 'Size', 24); await waiting(page);
  await number(page, 'Padding left', 9);
  const text = inspector(page).getByLabel('Widget text', { exact: true });
  await text.fill('New'); await text.press('End'); await text.pressSequentially(' label'); await text.press('Tab');
  await inspector(page).getByLabel('Font family', { exact: true }).fill('Courier New');
  await inspector(page).getByLabel('Font family', { exact: true }).press('Tab');
  expect(await save(page, info, 'fifo-pending')).toEqual(doc);
  await release(page);
  await expect.poll(async () => {
    const w = (await saved(page)).pages[0].widgets[0];
    return { text: w.text, size: w.style.fontSize, padding: w.style.textPadding, family: w.style.fontFamily };
  }).toEqual({ text: 'New label', size: 24, padding: [0, 0, 0, 9], family: 'Courier New' });
  const changed = await save(page, info, 'fifo-complete');
  expect(changed.pages[0].widgets[0].selectionText).toEqual(widget.selectionText);
  const trace = await observations(page); expect(trace.failures).toBe(0);
  expect(trace.reads.some(row => row.text === widget.text && row.fontSize === '24px')).toBe(true);
  expect(trace.reads.some(row => row.text === 'New label' && row.fontSize === '24px')).toBe(true);
  await screenshot(page, info, 'fifo-complete');
  // Each accepted property transaction remains undoable. The latest family
  // commit must not roll back the previous size, padding and text commands.
  await page.getByTitle('Undo', { exact: true }).click();
  const undone = await save(page, info, 'fifo-one-undo');
  expect(undone.pages[0].widgets[0]).toMatchObject({ text: 'New label', style: { fontSize: 24, textPadding: [0, 0, 0, 9], fontFamily: 'monospace' } });
  await clean(page);
});

test('rich Done waits for new-content measurement then closes and saves one shared-content transaction', async ({ page }, info) => {
  const { doc, widget } = fixture({ rich: true, fit: true });
  await open(page, doc, info); await select(page);
  await inspector(page).getByRole('button', { name: 'Edit formatted text', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Formatted text content', exact: true });
  await editor.click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('Edited rich label');
  await instrument(page, { delay: true });
  await page.getByRole('button', { name: 'Done editing text', exact: true }).click(); await waiting(page);
  await expect(editor).toBeVisible();
  await expect(editor).toHaveAttribute('aria-readonly', 'true');
  // Read the persisted document without invoking an outside-editor action.
  // Save would intentionally attempt to leave the pending rich transaction.
  expect(await saved(page)).toEqual(doc);
  await release(page); await expect(editor).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).pages[0].widgets[0].text).toBe('Edited rich label');
  const changed = await save(page, info, 'rich-complete'), w = changed.pages[0].widgets[0];
  expect(w.richText?.paragraphs.map(p => p.runs.map(r => r.text).join('')).join('\n')).toBe('Edited rich label');
  expect(w.style).toEqual(widget.style); expect(w.selectionText).toEqual(widget.selectionText);
  expect((await observations(page)).reads.some(row => row.text === 'Edited rich label')).toBe(true);
  await screenshot(page, info, 'rich-complete');
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'rich-undo')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled(); await clean(page);
});

test('an untouched focused X draft cannot overwrite the font-fit Location or add an undo entry', async ({ page }, info) => {
  const { doc, widget } = fixture({ fit: true });
  widget.text = 'MMMMMMMMMMMMMMMMMMMM'; widget.style.textAlign = 'center';
  await open(page, doc, info); await select(page); await instrument(page, { delay: true });
  await number(page, 'Size', 32); await waiting(page);
  const x = inspector(page).getByLabel('X', { exact: true });
  await x.focus(); await expect(x).toBeFocused(); await expect(x).toHaveValue(String(widget.x));
  await release(page);
  await expect.poll(async () => (await saved(page)).pages[0].widgets[0].style.fontSize).toBe(32);
  const afterFont = await saved(page), resized = afterFont.pages[0].widgets[0];
  expect(resized.x).not.toBe(widget.x);
  expect(resized.x).toBe(widget.x + Math.floor(widget.width / 2) - Math.floor(resized.width / 2));
  await expect(x).toBeFocused();
  await writeFile(await output(info, 'untouched-x-before-blur.rea.json'), serializeDocument(afterFont));
  await screenshot(page, info, 'untouched-x-before-blur');
  // No fill/type occurs in X. Its draft is deliberately older than the
  // canonical Location written by the completed font transaction.
  await x.press('Tab');
  await expect(x).toHaveValue(String(resized.x));
  expect(await save(page, info, 'untouched-x-after-blur')).toEqual(afterFont);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'untouched-x-one-undo')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled(); await clean(page);
});

test('a width command queued behind font preparation preserves both intents and their undo order', async ({ page }, info) => {
  const { doc, widget } = fixture();
  await open(page, doc, info); await select(page); await instrument(page, { delay: true });
  await number(page, 'Size', 24); await waiting(page);
  await number(page, 'W', 350);
  expect(await saved(page)).toEqual(doc);
  await release(page);
  await expect.poll(async () => {
    const w = (await saved(page)).pages[0].widgets[0];
    return { width: w.width, height: w.height, fontSize: w.style.fontSize };
  }).toEqual({ width: 350, height: 30, fontSize: 24 });
  const afterFont = structuredClone(doc);
  afterFont.pages[0].widgets[0].style.fontSize = 24;
  afterFont.pages[0].widgets[0].height = 30;
  const final = structuredClone(afterFont); final.pages[0].widgets[0].width = 350;
  expect(await save(page, info, 'font-then-width')).toEqual(final);
  await screenshot(page, info, 'font-then-width');
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'font-then-width-undo-width')).toEqual(afterFont);
  expect(afterFont.pages[0].widgets[0].width).toBe(widget.width);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'font-then-width-undo-font')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled(); await clean(page);
});

test('pending rich application blocks an outside selection change until its content is accepted', async ({ page }, info) => {
  const { doc } = fixture({ rich: true, fit: true, mixed: true });
  await open(page, doc, info); await select(page);
  await inspector(page).getByRole('button', { name: 'Edit formatted text', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Formatted text content', exact: true });
  await editor.click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('Outside click must keep this draft');
  await instrument(page, { delay: true });
  await page.getByRole('button', { name: 'Done editing text', exact: true }).click(); await waiting(page);
  await expect(editor).toHaveAttribute('aria-readonly', 'true');
  await expect(page.getByRole('button', { name: 'Done editing text', exact: true })).toBeDisabled();
  await page.locator('.canvas-surface .editor-widget.box').click({ position: { x: 80, y: 30 } });
  await expect(editor).toBeVisible(); await expect(editor).toContainText('Outside click must keep this draft');
  await expect(inspector(page).getByLabel('Widget name', { exact: true })).toHaveValue('Property check');
  expect(await saved(page)).toEqual(doc);
  await screenshot(page, info, 'rich-outside-blocked');
  await release(page); await expect(editor).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).pages[0].widgets[0].text).toBe('Outside click must keep this draft');
  const changed = await save(page, info, 'rich-outside-accepted');
  expect(changed.pages[0].widgets[1]).toEqual(doc.pages[0].widgets[1]);
  await expect(inspector(page).getByLabel('Widget name', { exact: true })).toHaveValue('Property check');
  // The blocked pointer is not replayed. A new click may select the other widget.
  await page.locator('.canvas-surface .editor-widget.box').click({ position: { x: 80, y: 30 } });
  await expect(inspector(page).getByLabel('Widget name', { exact: true })).toHaveValue('Ordinary box');
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'rich-outside-undo')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled(); await clean(page);
});

test('rich measurement failure retains an editable draft for retry and pending Cancel cannot commit later', async ({ page }, info) => {
  const { doc } = fixture({ rich: true, fit: true });
  await open(page, doc, info); await select(page);
  await inspector(page).getByRole('button', { name: 'Edit formatted text', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Formatted text content', exact: true });
  await editor.click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('Retained after measurement failure');
  await instrument(page, { delay: true, fail: true });
  await page.getByRole('button', { name: 'Done editing text', exact: true }).click(); await waiting(page);
  await expect(editor).toHaveAttribute('aria-readonly', 'true');
  await release(page);
  await expect(editor).toHaveAttribute('aria-readonly', 'false');
  await expect(editor).toContainText('Retained after measurement failure');
  await expect(page.getByRole('button', { name: 'Done editing text', exact: true })).toBeEnabled();
  await expect(page.getByText('Text could not be applied. Your draft is still available; retry or cancel.', { exact: true })).toBeVisible();
  expect((await observations(page)).failures).toBe(1); expect(await saved(page)).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  await writeFile(await output(info, 'rich-failed-persisted.rea.json'), serializeDocument(await saved(page)));
  await screenshot(page, info, 'rich-failure-retains-draft');
  await page.evaluate(() => (window as unknown as ProbedWindow).selectionPropertiesProbe.restore());
  await page.getByRole('button', { name: 'Done editing text', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).pages[0].widgets[0].text).toBe('Retained after measurement failure');
  const accepted = await save(page, info, 'rich-failure-retry');
  expect(accepted.pages[0].widgets[0].richText?.paragraphs.map(p => p.runs.map(r => r.text).join('')).join('\n')).toBe('Retained after measurement failure');
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'rich-failure-retry-undo')).toEqual(doc);
  await select(page);
  await inspector(page).getByRole('button', { name: 'Edit formatted text', exact: true }).click();
  await editor.click(); await page.keyboard.press('Control+a'); await page.keyboard.insertText('Cancelled pending draft');
  await instrument(page, { delay: true });
  await page.getByRole('button', { name: 'Done editing text', exact: true }).click(); await waiting(page);
  await expect(editor).toHaveAttribute('aria-readonly', 'true');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await release(page);
  // Save reads the live document after cancellation, not a debounced cache.
  expect(await save(page, info, 'rich-cancel-after-release')).toEqual(doc);
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  await screenshot(page, info, 'rich-cancel-after-release'); await clean(page);
});
