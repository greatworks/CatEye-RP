import { test, expect, type Page, type Locator } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { inlineFrameFixture } from '../fixtures/inline-frames';
import { createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Document } from '../../src/model/types';

async function open(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'frames.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
function button(id: string, x: number, y: number, actions: Omit<Action, 'id'>[]) {
  const w = createWidget('button', x, y); Object.assign(w, { id, name: id, text: id, width: 170, height: 36 });
  w.interactions = [{ id: uid(), name: id, enabled: true, event: 'click', conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: uid() })) }]; return w;
}
async function exercise(page: Page, scope: Locator, screenshot: string) {
  const w = (id: string) => scope.locator(`[data-widget-id="${id}"]`), left = scope.frameLocator('iframe[data-inline-frame="frame-left"]'), right = scope.frameLocator('iframe[data-inline-frame="frame-right"]');
  const count = (frame: typeof left) => frame.locator('[data-widget-id="frame-child-count"]');
  await expect(count(left)).toHaveText('Count: 1'); await expect(count(right)).toHaveText('Count: 1');
  expect(await left.locator('body').evaluate(async () => {
    await document.fonts.load('14px Roboto'); await document.fonts.ready;
    return { faces: Array.from(document.fonts).filter(font => font.family.replace(/["']/g, '') === 'Roboto').length, loaded: document.fonts.check('14px Roboto') };
  })).toEqual({ faces: 12, loaded: true });
  await expect(scope.locator('iframe[data-inline-frame="frame-left"]')).toHaveAttribute('sandbox', 'allow-scripts allow-forms');
  await left.locator('[data-widget-id="frame-child-increment"]').click(); await expect(count(left)).toHaveText('Count: 2'); await expect(count(right)).toHaveText('Count: 1');
  expect(await left.locator('body').evaluate(() => { try { return typeof (window.parent as unknown as { desktop: unknown }).desktop; } catch { return 'blocked'; } })).toBe('blocked');
  await w('frame-sibling-update').click(); await expect(count(left)).toHaveText('Count: 2');
  await left.locator('[data-widget-id="frame-child-detail"]').click(); await expect(left.locator('[data-widget-id="frame-detail-heading"]')).toHaveText('Detail page'); await expect(count(right)).toHaveText('Count: 1');
  await left.locator('[data-widget-id="frame-detail-back"]').click(); await expect(count(left)).toHaveText('Count: 3');
  await w('frame-reload').click(); await expect(count(left)).toHaveText('Count: 1');
  await left.locator('[data-widget-id="frame-child-increment"]').click(); await w('frame-reload').click(); await expect(count(left)).toHaveText('Count: 1');
  await w('frame-show-detail').click(); await expect(left.locator('[data-widget-id="frame-detail-heading"]')).toBeVisible();
  await page.screenshot({ path: screenshot, fullPage: true });
  await right.locator('[data-widget-id="frame-child-parent"]').click(); await expect(w('frame-parent-heading')).toBeVisible();
  await w('frame-parent-back').click(); await expect(count(left)).toHaveText('Count: 1'); await expect(count(right)).toHaveText('Count: 1');
}
for (const mode of ['preview', 'offline'] as const) test(`${mode}: real isolated inline pages navigate, reload and target their parent`, async ({ page, browser }, info) => {
  const doc = inlineFrameFixture(), errors: string[] = []; doc.pages.find(p => p.id === 'frame-catalog')!.widgets.find(w => w.id === 'frame-child-count')!.style.fontFamily = 'Roboto'; page.on('pageerror', error => errors.push(error.message)); await open(page, doc);
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page, page.locator('.preview-overlay'), info.outputPath('inline-frame-preview.png'));
    await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const file = info.outputPath('inline-frames.html'); await (await download).saveAs(file);
    const context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1000 } });
    try { const player = await context.newPage(); player.on('pageerror', error => errors.push(error.message)); await player.goto(pathToFileURL(file).href); await exercise(player, player.locator('main').first(), info.outputPath('inline-frame-offline.png')); } finally { await context.close(); }
  }
  const saved = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const file = info.outputPath('after.rea.json'); await (await saved).saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(doc); expect(errors).toEqual([]);
});

for (const mode of ['preview', 'offline'] as const) test(`${mode}: hidden and inactive panel frames keep their browsing contexts`, async ({ page, browser }, info) => {
  const doc = inlineFrameFixture(), home = doc.pages[0], left = home.widgets.find(w => w.id === 'frame-left')!, panel = createWidget('panel', left.x, left.y);
  home.widgets = home.widgets.filter(w => w !== left); left.x = 0; left.y = 0; panel.id = 'frame-panel'; panel.width = left.width; panel.height = left.height;
  panel.states = [{ id: 'frame-visible-state', name: 'Visible', widgets: [left] }, { id: 'frame-empty-state', name: 'Empty', widgets: [] }]; panel.activeStateId = 'frame-visible-state';
  home.widgets.push(panel,
    button('frame-hide', 48, 720, [{ type: 'hide', targetId: left.id }]), button('frame-show', 230, 720, [{ type: 'show', targetId: left.id }]),
    button('frame-state-away', 420, 720, [{ type: 'setState', targetId: panel.id, value: 'frame-empty-state' }]), button('frame-state-back', 610, 720, [{ type: 'setState', targetId: panel.id, value: 'frame-visible-state' }]));
  await open(page, doc); let player = page, context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  if (mode === 'preview') await page.getByTitle('Preview (F5)', { exact: true }).click();
  else { const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const file = info.outputPath('lifecycle.html'); await (await download).saveAs(file); context = await browser.newContext({ offline: true }); player = await context.newPage(); await player.goto(pathToFileURL(file).href); }
  try {
    const scope = mode === 'preview' ? player.locator('.preview-overlay') : player.locator('main').first(), frame = scope.frameLocator('iframe[data-inline-frame="frame-left"]'), count = frame.locator('[data-widget-id="frame-child-count"]');
    await expect(count).toHaveText('Count: 1'); await frame.locator('[data-widget-id="frame-child-increment"]').click(); await expect(count).toHaveText('Count: 2');
    for (const [hide, show] of [['frame-hide', 'frame-show'], ['frame-state-away', 'frame-state-back']]) {
      await scope.locator(`[data-widget-id="${hide}"]`).click(); await expect(scope.locator('iframe[data-inline-frame="frame-left"]')).toBeHidden();
      await scope.locator(`[data-widget-id="${show}"]`).click(); await expect(count).toHaveText('Count: 2');
    }
  } finally { await context?.close(); }
});

for (const mode of ['preview', 'offline'] as const) test(`${mode}: a nested frame changes only its immediate parent and recursion is bounded`, async ({ page, browser }, info) => {
  const doc = inlineFrameFixture(), catalog = doc.pages.find(p => p.id === 'frame-catalog')!, detail = doc.pages.find(p => p.id === 'frame-detail')!;
  catalog.widgets = catalog.widgets.filter(w => w.id === 'frame-child-heading');
  const nested = createWidget('inlineFrame', 18, 85); Object.assign(nested, { id: 'frame-nested', name: 'Nested document', width: 450, height: 250 }); nested.inlineFrame!.target = { kind: 'page', pageId: detail.id }; catalog.widgets.push(nested);
  detail.widgets = [button('frame-nested-parent', 20, 40, [{ type: 'openLinkInFrame', frameScope: 'parent', frameTarget: { kind: 'page', pageId: 'frame-parent-destination' } }])];
  const loop = createWidget('inlineFrame', 20, 100); Object.assign(loop, { id: 'frame-self-loop', name: 'Recursion guard', width: 390, height: 100 }); loop.inlineFrame!.target = { kind: 'page', pageId: detail.id }; detail.widgets.push(loop);
  await open(page, doc); let player = page, context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  if (mode === 'preview') await page.getByTitle('Preview (F5)', { exact: true }).click();
  else { const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const file = info.outputPath('nested.html'); await (await pending).saveAs(file); context = await browser.newContext({ offline: true }); player = await context.newPage(); await player.goto(pathToFileURL(file).href); }
  try {
    const scope = mode === 'preview' ? player.locator('.preview-overlay') : player.locator('main').first();
    const left = scope.frameLocator('[data-inline-frame="frame-left"]'), right = scope.frameLocator('[data-inline-frame="frame-right"]');
    const nestedFrame = left.frameLocator('[data-inline-frame="frame-nested"]');
    await expect(nestedFrame.locator('iframe[data-frame-error]')).toHaveCount(1);
    await expect(nestedFrame.frameLocator('[data-inline-frame="frame-self-loop"]').getByRole('alert')).toContainText('nesting limit');
    await nestedFrame.locator('[data-widget-id="frame-nested-parent"]').click();
    await expect(left.locator('[data-widget-id="frame-parent-heading"]')).toBeVisible(); await expect(right.locator('[data-widget-id="frame-child-heading"]')).toBeVisible();
    await expect(scope.locator('[data-widget-id="frame-heading"]')).toBeVisible();
  } finally { await context?.close(); }
});
