import { expect, test, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Document, Widget } from '../../src/model/types';

const raw = '  A  B  \rX\u2028Y<z>';
function fixture() {
  const doc = createDocument(); doc.name = 'Runtime native text measurement'; doc.caseSelection = 'never';
  const page = doc.pages[0]; page.id = 'measure-main'; page.name = 'Measurement'; page.width = 1200; page.height = 850;
  const caption = (id: string, x: number, y: number): Widget => {
    const w = createWidget('box', x, y); Object.assign(w, { id, name: id, text: 'Original', width: 130, height: 70, shapeText: { autoFitWidth: true, autoFitHeight: true } });
    Object.assign(w.style, { fontFamily: 'Arial', fontSize: 13, fontWeight: 400, textAlign: 'left', verticalAlign: 'top', textPadding: [0, 0, 0, 0], strokeWidth: 0, radius: 0 });
    w.richText = { paragraphs: [{ lineHeightPx: 20, runs: [{ text: 'Original', style: { fontSize: 13, color: '#123456' } }] }, { runs: [{ text: 'Second paragraph', style: { fontSize: 17 } }] }] };
    w.text = 'Original\nSecond paragraph'; return w;
  };
  const button = (id: string, x: number, y: number, actions: Omit<Action, 'id'>[]) => {
    const w = createWidget('button', x, y); Object.assign(w, { id, name: id, text: id, width: 145, height: 38 });
    w.interactions = [{ id: uid(), name: id, event: 'click', enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: uid() })) }]; return w;
  };
  const text = caption('measure-caption', 50, 60), untouched = caption('measure-untouched', 230, 60), hidden = caption('measure-hidden', 410, 60), link = caption('measure-link', 590, 60);
  hidden.hidden = true;
  const linkId = uid(); link.richText = { paragraphs: [{ runs: [{ text: 'Linked', linkId }] }], links: [{ id: linkId, name: 'Retained link', interactions: [] }] }; link.text = 'Linked';
  const repeater = createWidget('repeater', 50, 390); repeater.id = 'measure-repeater'; repeater.width = 430; repeater.height = 180;
  const row = caption('measure-row', 0, 0); row.width = 130; row.height = 70;
  repeater.repeater = { columns: ['Name'], rows: [{ Name: 'Alpha' }, { Name: 'Beta' }], template: [row, button('measure-row-set', 200, 10, [{ type: 'setText', targetId: row.id, value: 'Updated [[Item.Name]]\nend' }])], itemWidth: 430, itemHeight: 86, gap: 0, layout: 'vertical', fitToContent: false };
  page.widgets = [text, untouched, hidden, link, repeater,
    button('measure-lines', 50, 185, [{ type: 'setText', targetId: text.id, value: 'A\n\n' }]),
    button('measure-raw', 210, 185, [{ type: 'setText', targetId: text.id, value: raw }]),
    button('measure-empty', 370, 185, [{ type: 'setText', targetId: text.id, value: '' }]),
    button('measure-show', 530, 185, [{ type: 'setText', targetId: hidden.id, value: 'A\n\n' }, { type: 'show', targetId: hidden.id }]),
    button('measure-linked', 690, 185, [{ type: 'setText', targetId: link.id, value: 'Replacement' }]),
    button('measure-font', 50, 240, [{ type: 'setStyle', targetId: text.id, style: { fontSize: 26 } }]),
  ];
  // This regression checks the prior max-width switch, not the new size selection.
  delete page.adaptiveSelection; delete page.adaptiveBaseSize;
  page.adaptiveViews = [{ id: 'measure-mobile', name: 'Mobile', width: 800, overrides: { [text.id]: { style: { fontSize: 26 } }, [untouched.id]: { style: { fontSize: 26 } } } }];
  const embedded = createPage('Embedded measurement'); embedded.id = 'measure-embedded'; embedded.width = 1250; embedded.height = 930;
  const inner = createWidget('inlineFrame', 10, 10); Object.assign(inner, { id: 'measure-frame', name: 'Measurement frame', width: 1200, height: 860 }); inner.inlineFrame!.hideBorders = true; inner.inlineFrame!.target = { kind: 'page', pageId: page.id }; embedded.widgets = [inner];
  const nested = createPage('Nested measurement'); nested.id = 'measure-nested'; nested.width = 1280; nested.height = 1000;
  const outer = createWidget('inlineFrame', 10, 10); Object.assign(outer, { id: 'measure-outer-frame', name: 'Nested measurement frame', width: 1250, height: 940 }); outer.inlineFrame!.hideBorders = true; outer.inlineFrame!.target = { kind: 'page', pageId: embedded.id }; nested.widgets = [outer];
  doc.pages.push(embedded, nested); return doc;
}

async function open(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'runtime-measure.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
const rect = (target: Locator) => target.evaluate(element => {
  const style = getComputedStyle(element); return { x: parseFloat(style.left), y: parseFloat(style.top), width: parseFloat(style.width), height: parseFloat(style.height) };
});

async function exercise(scope: Locator | FrameLocator) {
  const w = (id: string) => scope.locator(`[data-widget-id="${id}"]`), target = w('measure-caption');
  // Authored AutoFit flags alone do not resize the initial owner.
  await expect(target).toHaveCSS('width', '130px'); await expect(target).toHaveCSS('height', '70px');
  const initial = await rect(target);
  await w('measure-lines').click();
  await expect(target).toHaveCSS('width', '9px'); await expect(target).toHaveCSS('height', '40px');
  expect((await rect(target)).x).toBe(initial.x); expect((await rect(target)).y).toBe(initial.y);
  await expect(target.locator('[data-rich-paragraph]')).toHaveCount(1);
  const run = target.locator('[data-rich-run="0"]');
  expect(await run.evaluate(element => [...element.childNodes].map(node => [node.nodeName, node.textContent]))).toEqual([['SPAN', 'A'], ['BR', ''], ['BR', '']]);
  await expect(run).toHaveCSS('color', 'rgb(18, 52, 86)');
  await w('measure-raw').click();
  expect(await run.textContent()).toBe(raw); await expect(run.locator('br')).toHaveCount(0); await expect(run.locator('z')).toHaveCount(0);
  await w('measure-empty').click();
  await expect(target).toHaveCSS('width', '0px'); await expect(target).toHaveCSS('height', '0px');
  await expect(target.locator(':scope > .widget-text')).toHaveCSS('display', 'none'); await expect(target.locator('br')).toHaveCount(0);
  await w('measure-show').click();
  await expect(w('measure-hidden')).toHaveCSS('width', '9px'); await expect(w('measure-hidden')).toHaveCSS('height', '40px');
  await expect(scope.locator('[data-shape-text-measure]')).toHaveCount(0);
  await w('measure-linked').click();
  await expect(w('measure-link')).toHaveCSS('width', '0px'); await expect(w('measure-link').locator('a [data-rich-run]')).toHaveText('Replacement');
  const rows = w('measure-row'); await expect(rows).toHaveCount(2); const second = await rect(rows.nth(1));
  await w('measure-row-set').nth(0).click();
  await expect(rows.nth(0).locator('[data-rich-paragraph]')).toHaveCount(1); await expect(rows.nth(0)).toHaveCSS('height', '40px');
  expect(await rows.nth(0).textContent()).toBe('Updated Alphaend'); expect(await rect(rows.nth(1))).toEqual(second);
  await expect(w('measure-untouched')).toHaveCSS('width', '130px'); await expect(w('measure-untouched')).toHaveCSS('height', '70px');
  return { w, target };
}

for (const mode of ['offline', 'fixed-frame'] as const) test(`${mode}: runtime text AutoFit measures native setter DOM, hidden and row instances without changing design`, async ({ page, browser }, info) => {
  const doc = fixture(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await open(page, doc);
  let context: Awaited<ReturnType<typeof browser.newContext>> | undefined, player = page;
  try {
    if (mode === 'offline') {
      const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
      const file = info.outputPath('runtime-text-autofit.html'); await (await download).saveAs(file);
      context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1100 } }); player = await context.newPage(); player.on('pageerror', error => errors.push(error.message)); await player.goto(pathToFileURL(file).href);
      const { w, target } = await exercise(player.locator('main').first());
      await w('measure-lines').click(); await w('measure-font').click();
      // Same-view resizing must not implicitly AutoFit a style-only change.
      await expect(target).toHaveCSS('width', '9px'); await player.setViewportSize({ width: 1500, height: 1050 }); await expect(target).toHaveCSS('width', '9px');
      // A true adaptive-view transition remeasures registered instances only.
      await player.setViewportSize({ width: 760, height: 1050 }); await expect(target).toHaveCSS('width', '17px');
      await expect(w('measure-untouched')).toHaveCSS('width', '130px'); await expect(w('measure-untouched')).toHaveCSS('height', '70px');
      await player.setViewportSize({ width: 1600, height: 1100 });
      await player.getByRole('button', { name: 'Nested measurement', exact: true }).click();
    } else {
      await page.getByTitle('Preview (F5)', { exact: true }).click();
      await page.locator('.preview-overlay').getByRole('button', { name: 'Nested measurement', exact: true }).click();
    }
    // Fixed player and recursively serialized offline bootstrap both execute the
    // same real DOM adapter in their own opaque frame realms.
    const nested = player.frameLocator('[data-inline-frame="measure-outer-frame"]').frameLocator('[data-inline-frame="measure-frame"]');
    await exercise(nested);
    await player.screenshot({ path: info.outputPath(`runtime-text-autofit-${mode}.png`), fullPage: true });
    expect(errors).toEqual([]);
  } finally { await context?.close(); }
  if (mode === 'fixed-frame') await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  const saved = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const file = info.outputPath('unchanged.rea.json'); await (await saved).saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(doc);
});
