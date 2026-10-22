import { expect, test, type FrameLocator, type Locator } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Widget } from '../../src/model/types';

function fixture() {
  const doc = createDocument(); doc.name = 'Selection runtime paint'; doc.caseSelection = 'never';
  const control = (id: string, type: 'checkbox' | 'radio', y: number, size = 14) => {
    const w = createWidget(type, 70, y);
    Object.assign(w, { id, name: id, text: id, width: 260, height: 40,
      selectionText: { autoFitWidth: true, autoFitHeight: false, alignRight: false } });
    Object.assign(w.style, { selectionButtonSize: size, strokeWidth: 0, radius: 0, fill: '#ffffff', stroke: '#123456',
      fontFamily: 'Arial', fontSize: 14, fontWeight: 400, textAlign: 'left', verticalAlign: 'middle', textPadding: [0,2,0,2] });
    return w;
  };
  const initial = control('initial-selected', 'radio', 50); initial.checked = true;
  const disabled = control('initial-disabled', 'radio', 110); disabled.checked = true; disabled.disabled = true;
  disabled.mouseOverStyle = { strokeWidth: 4 };
  const click = control('click-radio', 'radio', 170);
  const radio = control('history-radio', 'radio', 250), checkbox = control('history-checkbox', 'checkbox', 320, 28);
  const histories = [radio, checkbox];
  for (const w of histories) {
    w.selectedStyle = { strokeWidth: 3, stroke: '#aa2211', fill: 'rgba(18,52,86,.35)' };
    w.disabledStyle = { strokeWidth: 0, stroke: '#2244aa', fill: 'transparent' };
  }
  const button = (name: string, y: number, actions: Omit<Action, 'id'>[]) => {
    const w = createWidget('button', 420, y); w.name = w.text = name; w.width = 240;
    w.interactions = [{ id: uid(), event: 'click', name, enabled: true, conditionMode: 'all', conditions: [],
      actions: actions.map(action => ({ id: uid(), ...action })) }];
    return w;
  };
  const batch = button('Select then disable', 250, histories.flatMap(w => [
    { type: 'setSelected' as const, targetId: w.id, value: 'true' }, { type: 'disable' as const, targetId: w.id },
  ]));
  const enable = button('Enable controls', 310, histories.map(w => ({ type: 'enable', targetId: w.id })));
  const clear = button('Clear selection', 370, histories.map(w => ({ type: 'setSelected', targetId: w.id, value: 'false' })));
  doc.pages[0].width = 1000; doc.pages[0].height = 600;
  doc.pages[0].widgets = [initial, disabled, click, ...histories, batch, enable, clear];
  const page = createPage('State paint frame'), frame = createWidget('inlineFrame', 10, 10);
  Object.assign(frame, { id: 'paint-frame', width: 1000, height: 600 });
  frame.inlineFrame!.target = { kind: 'page', pageId: doc.pages[0].id }; frame.inlineFrame!.hideBorders = true;
  page.widgets = [frame]; page.width = 1100; page.height = 700; doc.pages.push(page);
  return { doc, histories };
}

for (const mode of ['preview', 'frame', 'offline'] as const) test(`${mode}: selection paint follows event order and retains zero-width history`, async ({ page, browser }, info) => {
  const { doc, histories } = fixture(), errors: string[] = [];
  await writeFile(info.outputPath('input.rea.json'), serializeDocument(doc));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'state-paint.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  // Editor glyphs represent the initial authored asset, before prototype init.
  await expect(page.locator('.canvas-surface .editor-widget').nth(0).locator('[data-selection-mark]')).toHaveCSS('stroke', 'none');

  async function exercise(scope: Locator | FrameLocator) {
    const owner = (id: string) => scope.locator(`[data-widget-id="${id}"]`);
    const mark = (id: string) => owner(id).locator('[data-selection-mark]');
    await expect(mark('initial-selected')).toHaveCSS('stroke', 'rgb(18, 52, 86)');
    await expect(mark('initial-selected')).toHaveCSS('stroke-width', '1px');
    await expect(mark('initial-disabled')).toHaveCSS('stroke', 'none');
    // The real style mouseenter entry is eligible while disabled. It resolves
    // disabled/normal paint, not the mouseOver width4 declaration.
    await owner('initial-disabled').hover();
    await expect(mark('initial-disabled')).toHaveCSS('stroke', 'rgb(18, 52, 86)');
    await expect(mark('initial-disabled')).toHaveCSS('stroke-width', '1px');
    await expect(owner('initial-disabled').locator('[data-selection-outline]')).toHaveCSS('stroke-width', '0px');
    await expect(mark('click-radio')).toHaveCSS('stroke', 'none');
    await owner('click-radio').locator('label').click({ position: { x: 7, y: 15 } });
    await expect(mark('click-radio')).toHaveCSS('stroke', 'rgb(18, 52, 86)');
    await expect(mark('click-radio')).toHaveCSS('stroke-width', '1px');
    await expect(owner('click-radio').locator('input')).toBeChecked();
    const geometry = await Promise.all(histories.map(w => owner(w.id).locator('svg').evaluate(svg => ({
      viewBox: svg.getAttribute('viewBox'), paths: [...svg.children].map(child => child.getAttribute('d') ?? child.getAttribute('points')),
    }))));
    await scope.getByRole('button', { name: 'Select then disable', exact: true }).click();
    for (const w of histories) {
      await expect(owner(w.id).locator('input')).toBeChecked(); await expect(owner(w.id).locator('input')).toBeDisabled();
      await expect(owner(w.id).locator('[data-selection-fill]')).toHaveCSS('fill', 'rgba(0, 0, 0, 0)');
      await expect(owner(w.id).locator('[data-selection-outline]')).toHaveCSS('stroke', 'rgb(34, 68, 170)');
      await expect(owner(w.id).locator('[data-selection-outline]')).toHaveCSS('stroke-width', '3px');
      await expect(mark(w.id)).toHaveCSS('stroke', 'rgb(34, 68, 170)');
      await expect(mark(w.id)).toHaveCSS('stroke-width', w.type === 'checkbox' ? '6px' : '3px');
    }
    await scope.getByRole('button', { name: 'Enable controls', exact: true }).click();
    for (const w of histories) {
      await expect(owner(w.id).locator('input')).toBeEnabled();
      await expect(mark(w.id)).toHaveCSS('stroke', 'rgb(170, 34, 17)');
      await expect(owner(w.id).locator('[data-selection-fill]')).toHaveCSS('fill', 'rgba(18, 52, 86, 0.35)');
    }
    await scope.getByRole('button', { name: 'Clear selection', exact: true }).click();
    for (const [index, w] of histories.entries()) {
      await expect(owner(w.id).locator('input')).not.toBeChecked(); await expect(mark(w.id)).toHaveCSS('display', 'none');
      await expect(owner(w.id).locator('[data-selection-outline]')).toHaveCSS('stroke-width', '3px');
      await expect(owner(w.id).locator('[data-selection-outline]')).toHaveCSS('stroke', 'rgb(18, 52, 86)');
      expect(await owner(w.id).locator('svg').evaluate(svg => ({ viewBox: svg.getAttribute('viewBox'),
        paths: [...svg.children].map(child => child.getAttribute('d') ?? child.getAttribute('points')) }))).toEqual(geometry[index]);
    }
    await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
  }
  if (mode === 'offline') {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const output = info.outputPath('state-paint.html'); await (await download).saveAs(output);
    const context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1000 } });
    try {
      const player = await context.newPage(), requests: string[] = [];
      player.on('pageerror', error => errors.push(error.message));
      player.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()) });
      await player.goto(pathToFileURL(output).href); await exercise(player.locator('body'));
      await player.getByRole('button', { name: 'State paint frame', exact: true }).click();
      await exercise(player.frameLocator('[data-inline-frame="paint-frame"]'));
      await player.screenshot({ path: info.outputPath('selection-state-offline.png') }); expect(requests).toEqual([]);
    } finally { await context.close() }
  } else {
    await page.getByTitle('Preview (F5)', { exact: true }).click();
    if (mode === 'frame') {
      await page.locator('.preview-overlay').getByRole('button', { name: 'State paint frame', exact: true }).click();
      await exercise(page.frameLocator('[data-inline-frame="paint-frame"]'));
    } else await exercise(page.locator('.preview-overlay'));
    await page.screenshot({ path: info.outputPath(`selection-state-${mode}.png`) });
    await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  }
  const saved = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const output = info.outputPath('unchanged.rea.json'); await (await saved).saveAs(output);
  expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(doc); expect(errors).toEqual([]);
});
