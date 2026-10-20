import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Interaction, Widget } from '../../src/model/types';
import { exerciseRepeaterLayout } from '../../scripts/repeater-layout-scenario.mjs';

type Step = Omit<Action, 'id'>;
const event = (actions: Step[], trigger: Interaction['event'] = 'click'): Interaction => ({ id: uid(), event: trigger, name: trigger, enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: uid() })) });
function fixture() {
  const doc = createDocument(); doc.name = 'Repeater layout and Item Resized'; doc.caseSelection = 'never'; doc.variables = { ResizeTrace: '', FitTrace: '' };
  doc.pages[0].width = 1120; doc.pages[0].height = 830;
  const text = (name: string, value: string, x: number, y: number, width = 980, height = 40) => { const w = createWidget('text', x, y); Object.assign(w, { name, text: value, width, height }); w.style.textPadding = [0,0,0,0]; return w; };
  const button = (name: string, value: string, x: number, y: number, width: number, actions: Step[]) => { const w = createWidget('button', x, y); Object.assign(w, { name, text: value, width, height: 38, interactions: [event(actions)] }); return w; };
  const mainLog = text('Resize log', 'Item Resized: ', 40, 700), fitLog = text('Fit log', 'Content fit: ', 40, 750);
  const repeater = (name: string, x: number, y: number, count: number): Widget => {
    const w = createWidget('repeater', x, y); w.name = name; w.style.strokeWidth = 0; w.style.fill = '#f1f5ff'; w.width = 504; w.height = 116;
    w.repeater = { columns: ['Name'], rows: 'ABCDE'.slice(0, count).split('').map(Name => ({ Name })), template: [], itemWidth: 160, itemHeight: 54, gap: 0, layout: 'vertical', wrap: 2, horizontalGap: 12, verticalGap: 8 }; return w;
  };
  const main = repeater('Wrapped records', 40, 170, 5), horizontal = repeater('Horizontal records', 40, 485, 5), fitted = repeater('Fitted records', 650, 170, 2);
  const mainGrow = button('Grow row', 'Grow [[Item.Name]]', 7, 8, 90, [{ type: 'resizeItem', targetId: main.id, x: 210, y: 84 }]);
  const mainShrink = button('Shrink row', 'Reset', 103, 8, 50, [{ type: 'resizeItem', targetId: main.id, x: 160, y: 54 }]);
  mainShrink.style.fontSize = 11; mainShrink.style.textPadding = [0, 0, 0, 0];
  main.repeater!.template = [mainGrow, mainShrink];
  main.interactions = [event([{ type: 'setVariable', targetId: 'ResizeTrace', value: '[[ResizeTrace]][[Item.index]]:[[Item.Name]]|' }, { type: 'setText', targetId: mainLog.id, value: 'Item Resized: [[ResizeTrace]]' }], 'itemResize')];
  horizontal.repeater!.layout = 'horizontal'; horizontal.repeater!.wrap = 3;
  horizontal.repeater!.template = [button('Grow horizontal row', 'Grow [[Item.Name]]', 7, 8, 146, [{ type: 'resizeItem', targetId: horizontal.id, x: 210, y: 84 }])];
  Object.assign(fitted.repeater!, { layout: 'vertical', itemWidth: 330, itemHeight: 70, verticalGap: 10, fitToContent: true }); delete fitted.repeater!.wrap;
  const expand = button('Expand content', 'Expand content [[Item.Name]]', 10, 10, 300, []); expand.height = 50; expand.interactions = [event([{ type: 'resize', targetId: expand.id, x: 300, y: 110 }])]; fitted.repeater!.template = [expand];
  fitted.interactions = [event([{ type: 'setVariable', targetId: 'FitTrace', value: '[[FitTrace]][[Item.index]]:[[Item.Name]]|' }, { type: 'setText', targetId: fitLog.id, value: 'Content fit: [[FitTrace]]' }], 'itemResize')];
  const heading = text('Heading', 'Repeater items have their own size', 40, 28, 1000, 48); heading.style.fontSize = 28; heading.style.fontWeight = 600;
  doc.pages[0].widgets = [heading,
    text('Instructions', 'Grow a row to move the items after it. Repeat the same size: no new resize event.', 40, 90),
    text('Vertical title', 'Vertical · 2 items per column', 40, 130, 520), main,
    text('Fit title', 'Fit to content · child resize', 650, 130, 390), fitted,
    button('Sort and reset rows', 'Sort descending + reset item sizes', 40, 365, 360, [{ type: 'sortRows', targetId: main.id, value: 'Name:desc' }]),
    button('Reset fitted content', 'Refresh + reset content', 650, 410, 330, [{ type: 'removeFilter', targetId: fitted.id, value: '{"all":true}' }]),
    text('Horizontal title', 'Horizontal · 3 items per row', 40, 445, 520), horizontal, mainLog, fitLog];
  return doc;
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: item dimensions, wrapped layout, fit and resize callbacks`, async ({ page, browser }, info) => {
  const doc = fixture(), json = serializeDocument(doc), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name: /^Open…/ }).click();
  await (await chooser).setFiles({ name: 'repeater-layout-demo.rea.json', mimeType: 'application/json', buffer: Buffer.from(json) }); await expect(page.locator('.titlebar')).toContainText(doc.name);
  if (mode === 'preview') {
    await mkdir('artifacts', { recursive: true }); await writeFile('artifacts/repeater-layout-demo.rea.json', json);
    await page.getByTitle('Preview (F5)', { exact: true }).click(); await exerciseRepeaterLayout(page.locator('.preview-overlay'));
    await page.screenshot({ path: info.outputPath('repeater-layout-preview.png') });
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const path = info.outputPath('repeater-layout.html'); await (await download).saveAs(path);
    const context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1100 } });
    try {
      const exported = await context.newPage(), requests: string[] = []; exported.on('pageerror', error => errors.push(error.message)); exported.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      await exported.goto(pathToFileURL(path).href); await exerciseRepeaterLayout(exported); await exported.screenshot({ path: info.outputPath('repeater-layout-offline.png') }); expect(requests).toEqual([]);
    } finally { await context.close(); }
  }
  expect(errors).toEqual([]);
});
