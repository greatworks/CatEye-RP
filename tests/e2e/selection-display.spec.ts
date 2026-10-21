import { expect, test, type Locator, type FrameLocator } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Widget } from '../../src/model/types';

function fixture() {
  const doc = createDocument(); doc.name = 'Selection indicator and text'; doc.caseSelection = 'never';
  const selection = (id: string, type: 'checkbox' | 'radio', x: number, y: number, size: number, right = false) => {
    const widget = createWidget(type, x, y);
    Object.assign(widget, { id, name: id, text: 'Before', width: 150, height: 40,
      selectionText: { autoFitWidth: true, autoFitHeight: false, alignRight: right } });
    Object.assign(widget.style, { fill: '#ffffff', stroke: '#123456', strokeWidth: 1, radius: 0,
      fontFamily: 'monospace', fontSize: 16, fontWeight: 400, lineHeight: 1.25,
      textAlign: 'left', verticalAlign: 'bottom', textPadding: [2, 7, 3, 5], selectionButtonSize: size });
    widget.richText = { paragraphs: [{ lineHeightPx: 20, runs: [{ text: widget.text }] }] };
    return widget;
  };
  const check = selection('display-check', 'checkbox', 80, 140, 14);
  const radio = selection('display-radio', 'radio', 80, 220, 28, true);
  const hidden = selection('display-hidden', 'checkbox', 450, 140, 18); hidden.hidden = true;
  const loaded = selection('display-loaded', 'checkbox', 450, 220, 14);
  loaded.interactions = [{ id: uid(), event: 'load', name: 'Replace on load', enabled: true,
    conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setText', targetId: loaded.id, value: 'This text was changed before first paint' }] }];
  const log = createWidget('text', 80, 330); log.id = 'display-log'; log.name = 'Click log'; log.text = '';
  check.interactions = [{ id: uid(), event: 'click', name: 'One click', enabled: true, conditions: [], conditionMode: 'all',
    actions: [{ id: uid(), type: 'setText', targetId: log.id, value: '[[Widget.display-log.text]]X' }] }];
  const button = createWidget('button', 80, 40); button.name = button.text = 'Replace labels';
  button.interactions = [{ id: uid(), event: 'click', name: 'Replace', enabled: true, conditions: [], conditionMode: 'all',
    actions: [...[check, radio, hidden].map(widget => ({ id: uid(), type: 'setText' as const, targetId: widget.id, value: 'A much longer replacement label' })),
      { id: uid(), type: 'show', targetId: hidden.id }] }];
  const complex = createWidget('button', 300, 40); complex.name = complex.text = 'Complex fill';
  complex.interactions = [{ id: uid(), event: 'click', name: 'Complex paint', enabled: true, conditions: [], conditionMode: 'all',
    actions: [{ id: uid(), type: 'setStyle', targetId: check.id, style: {
      fillGradient: { type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 0 },
        stops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#4477ff' }] },
    } }] }];
  doc.pages[0].width = 1100; doc.pages[0].height = 700; doc.pages[0].widgets = [button, complex, check, radio, hidden, loaded, log];
  const embedded = createPage('Selection display frame'), frame = createWidget('inlineFrame', 10, 10);
  embedded.width = 1200; embedded.height = 850;
  Object.assign(frame, { id: 'selection-display-frame', width: 1100, height: 700 });
  frame.inlineFrame!.hideBorders = true; frame.inlineFrame!.target = { kind: 'page', pageId: doc.pages[0].id };
  embedded.widgets = [frame]; doc.pages.push(embedded);
  return { doc, check, radio, hidden, loaded };
}

for (const mode of ['preview', 'offline', 'frame'] as const) test(`${mode}: SVG indicator, authored text layout and native input activation stay separate`, async ({ page, browser }, info) => {
  const { doc, check, radio, hidden, loaded } = fixture(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'selection-display.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);

  async function exercise(scope: Locator | FrameLocator) {
    const owner = (widget: Widget) => scope.locator(`[data-widget-id="${widget.id}"]`);
    for (const widget of [check, radio, loaded]) {
      await expect(owner(widget).locator('label')).toHaveAttribute('data-selection-display', 'browser-derived');
      await expect(owner(widget).locator(':scope > input')).toHaveCSS('width', '0px');
      await expect(owner(widget).locator(':scope > input')).toHaveCSS('height', '0px');
      await expect(owner(widget).locator(':scope > input')).toHaveCSS('opacity', '0');
      await expect(owner(widget).locator('svg[data-selection-indicator]')).toHaveCount(1);
      await expect(owner(widget)).toHaveCSS('border-top-width', '0px');
      await expect(owner(widget)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    }
    await expect(owner(check).locator('.selection-text')).toHaveCSS('left', '14px');
    await expect(owner(check).locator('.selection-text')).toHaveCSS('top', '0px');
    await expect(owner(radio).locator('.selection-text')).toHaveCSS('left', '0px');
    await expect(owner(radio).locator('.selection-text')).toHaveCSS('top', '5px');
    await expect(owner(radio).locator('svg')).toHaveCSS('left', '122px');
    const geometry = await owner(check).locator('.selection-text').evaluate(element => {
      const style = (element as HTMLElement).style; return { left: style.left, top: style.top, width: style.width };
    });
    // A Loaded setter ran before this first paint; its layout still derives
    // from the authored "Before", not the replacement's much larger width.
    await expect(owner(loaded)).toContainText('This text was changed before first paint');
    await expect(owner(loaded).locator('.selection-text')).toHaveCSS('width', geometry.width);
    const input = owner(check).locator(':scope > input');
    await owner(check).locator('label').click({ position: { x: 7, y: 13 } });
    await expect(input).toBeChecked();
    await expect(scope.locator('[data-widget-id="display-log"]')).toHaveText('X');
    await expect(owner(check).locator('[data-selection-mark]')).toHaveCSS('display', 'inline');
    await input.focus(); await input.press('Space'); await expect(input).not.toBeChecked();
    await expect(scope.locator('[data-widget-id="display-log"]')).toHaveText('XX');
    await owner(radio).locator('label').click({ position: { x: 130, y: 12 } });
    await expect(owner(radio).locator(':scope > input')).toBeChecked();
    await scope.getByRole('button', { name: 'Replace labels', exact: true }).click();
    for (const widget of [check, radio, hidden]) {
      await expect(owner(widget)).toContainText('A much longer replacement label');
      await expect(owner(widget)).toHaveCSS('width', '150px'); await expect(owner(widget)).toHaveCSS('height', '40px');
    }
    const after = await owner(check).locator('.selection-text').evaluate(element => {
      const style = (element as HTMLElement).style; return { left: style.left, top: style.top, width: style.width };
    });
    expect(after).toEqual(geometry);
    await expect(owner(hidden).locator('.selection-text')).toHaveCSS('width', geometry.width);
    await expect(scope.locator('[data-selection-display-measure]')).toHaveCount(0);
    await scope.getByRole('button', { name: 'Complex fill', exact: true }).click();
    await expect(owner(check).locator('label')).toHaveAttribute('data-selection-display', 'fallback');
    await expect(owner(check).locator('svg[data-selection-indicator]')).toHaveCount(0);
    await expect(input).toHaveCSS('opacity', '1');
    await expect(owner(check)).not.toHaveCSS('background-image', 'none');
    await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
  }

  if (mode !== 'offline') {
    await page.getByTitle('Preview (F5)', { exact: true }).click();
    if (mode === 'frame') {
      await page.locator('.preview-overlay').getByRole('button', { name: 'Selection display frame', exact: true }).click();
      await exercise(page.frameLocator('[data-inline-frame="selection-display-frame"]'));
    } else await exercise(page.locator('.preview-overlay'));
    await page.screenshot({ path: info.outputPath(`selection-display-${mode}.png`) });
    await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const file = info.outputPath('selection-display.html'); await (await download).saveAs(file);
    const context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1000 } });
    try {
      const player = await context.newPage(), requests: string[] = []; player.on('pageerror', error => errors.push(error.message));
      player.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()) });
      await player.goto(pathToFileURL(file).href); await exercise(player.locator('body'));
      await player.getByRole('button', { name: 'Selection display frame', exact: true }).click();
      await exercise(player.frameLocator('[data-inline-frame="selection-display-frame"]'));
      await player.screenshot({ path: info.outputPath('selection-display-offline.png') }); expect(requests).toEqual([]);
    } finally { await context.close() }
  }
  const saved = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath('unchanged.rea.json'); await (await saved).saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(doc); expect(errors).toEqual([]);
});
