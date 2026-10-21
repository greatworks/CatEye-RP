import { expect, test, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Document, Widget } from '../../src/model/types';

// The retained original setter + AutoFit + Resize Edge probe measures 135px
// for this exact monospace fixture (12px padding included, no indicator term).
// See research/selection-layout-render-browser-probes.json, both control types.
const value = 'A longer label';
function fixture() {
  const doc = createDocument(); doc.name = 'Selection text measurement'; doc.caseSelection = 'never';
  doc.pages[0].id = 'selection-measure-main'; doc.pages[0].width = 1200; doc.pages[0].height = 1000;
  const target = (id: string, type: 'checkbox' | 'radio', y: number): Widget => {
    const w = createWidget(type, 400, y);
    Object.assign(w, { id, name: id, text: 'Before', width: 100, height: 20,
      selectionText: { autoFitWidth: true, autoFitHeight: false, alignRight: false } });
    Object.assign(w.style, { fontFamily: 'monospace', fontSize: 16, fontWeight: 400, lineHeight: 1.25,
      textPadding: [2, 7, 3, 5], verticalAlign: 'bottom', textAlign: 'right', strokeWidth: 0,
      selectionButtonSize: type === 'checkbox' ? 12 : 28 });
    w.richText = { paragraphs: [{ lineHeightPx: 20, runs: [{ text: w.text }] }] };
    return w;
  };
  const button = (id: string, x: number, y: number, actions: Omit<Action, 'id'>[]) => {
    const w = createWidget('button', x, y); Object.assign(w, { id, name: id, text: id, width: 170, height: 34 });
    w.interactions = [{ id: uid(), name: id, event: 'click', enabled: true, conditions: [], conditionMode: 'all',
      actions: actions.map(action => ({ ...action, id: uid() })) }]; return w;
  };
  const check = target('measure-check', 'checkbox', 130), radio = target('measure-radio', 'radio', 180);
  const linked = target('measure-linked', 'checkbox', 230), hidden = target('measure-hidden', 'radio', 280);
  const linkId = uid(); linked.richText = { paragraphs: [{ runs: [{ text: 'Before', linkId }] }],
    links: [{ id: linkId, name: 'Label link', interactions: [] }] };
  hidden.hidden = true;
  const resize = createWidget('text', 650, 130), move = createWidget('text', 650, 180);
  Object.assign(resize, { id: 'measure-resize-log', name: 'Resize log', text: 'no resize' });
  Object.assign(move, { id: 'measure-move-log', name: 'Move log', text: 'no move' });
  check.interactions = (['resize', 'move'] as const).map(event => ({
    id: uid(), event, name: event, enabled: true, conditions: [], conditionMode: 'all',
    actions: [{ id: uid(), type: 'setText', targetId: event === 'resize' ? resize.id : move.id,
      value: event === 'resize' ? 'unexpected resize' : '[[This.x]]|[[This.width]]' }],
  }));
  const invalid = target('measure-height', 'checkbox', 340); invalid.selectionText!.autoFitHeight = true;
  const repeater = createWidget('repeater', 100, 420), row = target('measure-row', 'checkbox', 0);
  row.x = 80;
  Object.assign(repeater, { id: 'measure-rows', width: 650, height: 150 });
  repeater.repeater = { columns: ['Name'], rows: [{ Name: 'First' }, { Name: 'Second' }],
    template: [row, button('measure-row-set', 300, 0, [{ type: 'setText', targetId: row.id, value }])],
    itemWidth: 650, itemHeight: 60, gap: 10, layout: 'vertical', fitToContent: false };
  doc.pages[0].widgets = [check, radio, linked, hidden, invalid, resize, move, repeater,
    button('measure-grow', 30, 30, [check, radio].map(w => ({ type: 'setText', targetId: w.id, value }))),
    button('measure-links', 220, 30, [{ type: 'setText', targetId: linked.id, value: 'One' }]),
    button('measure-reveal', 410, 30, [{ type: 'setText', targetId: hidden.id, value }, { type: 'show', targetId: hidden.id }]),
    button('measure-empty', 600, 30, [check, radio].map(w => ({ type: 'setText', targetId: w.id, value: '' }))),
    button('measure-invalid', 790, 30, [{ type: 'setText', targetId: invalid.id, value }]),
  ];
  const embedded = createPage('Selection frame'); embedded.width = 1250; embedded.height = 1100;
  const frame = createWidget('inlineFrame', 10, 10);
  Object.assign(frame, { id: 'selection-measure-frame', name: 'Selection measurement frame', width: 1200, height: 1000 });
  frame.inlineFrame!.hideBorders = true; frame.inlineFrame!.target = { kind: 'page', pageId: doc.pages[0].id };
  embedded.widgets = [frame]; doc.pages.push(embedded);
  return doc;
}
async function open(page: Page, doc: Document) {
  await page.goto('/');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'selection-measure.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
const rect = (owner: Locator) => owner.evaluate(element => {
  const style = (element as HTMLElement).style;
  return { x: parseFloat(style.left), y: parseFloat(style.top), width: parseFloat(style.width), height: parseFloat(style.height) };
});
async function exercise(scope: Locator | FrameLocator) {
  const w = (id: string) => scope.locator(`[data-widget-id="${id}"]`);
  for (const [id, y] of [['measure-check', 130], ['measure-radio', 180]] as const)
    expect(await rect(w(id))).toEqual({ x: 400, y, width: 100, height: 20 });
  await w('measure-grow').click();
  for (const [id, y] of [['measure-check', 130], ['measure-radio', 180]] as const) {
    await expect.poll(() => rect(w(id))).toEqual({ x: 365, y, width: 100, height: 20 });
    await expect(w(id).locator('label .selection-text')).toHaveCSS('white-space', 'nowrap');
    await expect(w(id).locator('[data-rich-run]')).toHaveText(value);
  }
  await expect(w('measure-resize-log')).toHaveText('no resize');
  await expect(w('measure-move-log')).toHaveText('365|100');
  await w('measure-grow').click();
  await expect.poll(() => rect(w('measure-check'))).toEqual({ x: 330, y: 130, width: 100, height: 20 });
  await w('measure-links').click();
  await expect.poll(() => rect(w('measure-linked'))).toEqual({ x: 488, y: 230, width: 100, height: 20 });
  await expect(w('measure-linked').locator('a [data-rich-run]')).toHaveText('One');
  await w('measure-reveal').click();
  await expect.poll(() => rect(w('measure-hidden'))).toEqual({ x: 365, y: 280, width: 100, height: 20 });
  const rows = w('measure-row'); await expect(rows).toHaveCount(2);
  const other = await rect(rows.nth(0));
  await w('measure-row-set').nth(1).click();
  await expect.poll(() => rect(rows.nth(1))).toEqual({ x: 45, y: 0, width: 100, height: 20 });
  expect(await rect(rows.nth(0))).toEqual(other);
  await w('measure-empty').click();
  await expect.poll(() => rect(w('measure-check'))).toEqual({ x: 418, y: 130, width: 100, height: 20 });
  await expect(w('measure-check').locator('.selection-text')).toHaveCSS('display', 'none');
  await w('measure-grow').click();
  await expect.poll(() => rect(w('measure-check'))).toEqual({ x: 383, y: 130, width: 100, height: 20 });
  await expect(w('measure-check').locator('.selection-text')).toHaveCSS('display', 'block');
  await expect(scope.locator('[data-shape-text-measure], [data-selection-text-measure]')).toHaveCount(0);
  await w('measure-invalid').click();
  await expect(scope.getByRole('alert')).toContainText('Native selection text height AutoFit is unsupported');
  expect(await rect(w('measure-height'))).toEqual({ x: 400, y: 340, width: 100, height: 20 });
  await expect(w('measure-height')).toHaveText('Before');
}

for (const mode of ['preview', 'offline', 'frame'] as const) test(`${mode}: selection measures actual DOM, preserves owner size, moves alignment and rolls back unsupported height`, async ({ page, browser }, info) => {
  const doc = fixture(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await open(page, doc);
  let context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    if (mode === 'offline') {
      const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
      const file = info.outputPath('selection-measure.html'); await (await download).saveAs(file);
      context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1100 } });
      const player = await context.newPage(), requests: string[] = [];
      player.on('pageerror', error => errors.push(error.message));
      player.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()) });
      await player.goto(pathToFileURL(file).href);
      await exercise(player.locator('body'));
      await player.getByRole('button', { name: 'Selection frame', exact: true }).click();
      await exercise(player.frameLocator('[data-inline-frame="selection-measure-frame"]'));
      await player.screenshot({ path: info.outputPath('selection-measure-offline.png'), fullPage: true });
      expect(requests).toEqual([]);
    } else {
      await page.getByTitle('Preview (F5)', { exact: true }).click();
      const overlay = page.locator('.preview-overlay');
      if (mode === 'frame') {
        await overlay.getByRole('button', { name: 'Selection frame', exact: true }).click();
        await exercise(page.frameLocator('[data-inline-frame="selection-measure-frame"]'));
      } else await exercise(overlay);
      await page.screenshot({ path: info.outputPath(`selection-measure-${mode}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Close preview', exact: true }).click();
    }
  } finally { await context?.close() }
  const saved = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath('unchanged.rea.json'); await (await saved).saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(doc);
  expect(errors).toEqual([]);
});
