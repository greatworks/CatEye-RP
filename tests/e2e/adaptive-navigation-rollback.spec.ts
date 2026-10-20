import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument as createNativeDocument, createPage as createNativePage, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Document, EventType, Interaction, Widget } from '../../src/model/types';

// Retained saved-project regressions intentionally use the original max-width schema.
function createPage(name?: string) { const page = createNativePage(name); delete page.adaptiveSelection; delete page.adaptiveBaseSize; return page; }
function createDocument() { const doc = createNativeDocument(); for (const page of doc.pages) { delete page.adaptiveSelection; delete page.adaptiveBaseSize; } return doc; }

type Step = Omit<Action, 'id'>;
function interaction(event: EventType, ...steps: Step[]): Interaction {
  return { id: uid(), name: event, event, enabled: true, conditionMode: 'all', conditions: [],
    actions: steps.map(step => ({ ...step, id: uid() })) };
}
function widget(type: Widget['type'], id: string, text: string, x: number, y: number): Widget {
  const value = createWidget(type, x, y);
  return { ...value, id, name: id, text, width: 300, height: 45,
    style: { ...value.style, fontFamily: 'Arial', fontSize: 20, color: '#123456' } };
}
function fixture(): Document {
  const doc = createDocument(); doc.name = 'Adaptive navigation rollback'; doc.caseSelection = 'never';
  doc.variables = { PageLoads: '0', ItemLoads: '0', Clicks: '0', Armed: 'false', DestinationLoads: '0', InvalidSelected: 'invalid' };
  const source = doc.pages[0]; source.id = 'rollback-source'; source.name = 'Rollback source'; source.width = 1200; source.height = 850;
  const destination = createPage('Failing destination'); destination.id = 'rollback-destination'; destination.width = 1200;
  const marker = widget('box', 'rollback-marker', 'Source view restored', 20, 210);
  const arm = widget('button', 'rollback-arm', 'Arm navigation', 20, 20);
  arm.interactions = [interaction('click', { type: 'setVariable', targetId: 'Armed', value: 'true' },
    { type: 'move', targetId: marker.id, x: 280, y: 210 }, { type: 'resize', targetId: marker.id, x: 320, y: 45 })];
  const unrelated = widget('button', 'rollback-unrelated', 'Unrelated action', 20, 85);
  unrelated.interactions = [interaction('click', { type: 'setVariable', targetId: 'Clicks', value: '[[Clicks+1]]' })];
  const status = widget('text', 'rollback-status', 'Page loads: [[PageLoads]] | Items: [[ItemLoads]] | Actions: [[Clicks]] | Armed: [[Armed]]', 20, 300);
  status.width = 900;
  const destinationStatus = widget('text', 'rollback-destination-status', 'Destination loads: [[DestinationLoads]]', 20, 360);
  const row = widget('box', 'rollback-row', 'Stable row', 0, 0); row.width = 260;
  const list = widget('repeater', 'rollback-list', '', 20, 430); list.width = 300; list.height = 80;
  list.repeater = { columns: ['Name'], rows: [{ Name: 'Only row' }], template: [row], itemHeight: 60, itemWidth: 300, gap: 0, layout: 'vertical' };
  list.interactions = [interaction('itemLoad', { type: 'setVariable', targetId: 'ItemLoads', value: '[[ItemLoads+1]]' }), {
    ...interaction('itemLoad', { type: 'openPage', targetId: destination.id }),
    conditions: [{ source: 'variable', key: 'Armed', operator: 'equals', value: 'true' }],
  }];
  source.interactions = [interaction('load', { type: 'setVariable', targetId: 'PageLoads', value: '[[PageLoads+1]]' },
    { type: 'setVariable', targetId: 'Armed', value: 'false' })];
  source.widgets = [arm, unrelated, marker, status, destinationStatus, list];
  source.adaptiveViews = [{ id: 'rollback-phone', name: 'Phone', width: 400, overrides: {
    [marker.id]: { x: 10, width: 180, style: { color: '#dd0000' } },
  } }];
  const invalid = widget('box', 'rollback-invalid-selection', 'Destination must roll back', 20, 20);
  destination.widgets = [invalid];
  destination.interactions = [interaction('load', { type: 'setVariable', targetId: 'DestinationLoads', value: '[[DestinationLoads+1]]' },
    { type: 'setSelected', targetId: invalid.id, value: '[[InvalidSelected]]' })];
  doc.pages.push(destination); return doc;
}

async function open(page: Page, doc: Document) {
  page.on('dialog', dialog => dialog.accept()); await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'adaptive-rollback-source.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: failed adaptive ItemLoaded navigation restores lifecycle before an unrelated action`, async ({ page, browser }, info) => {
  const doc = fixture(), errors: string[] = [], network: string[] = [];
  await writeFile(info.outputPath('adaptive-rollback-source.rea.json'), serializeDocument(doc));
  page.on('pageerror', error => errors.push(error.message)); await open(page, doc);
  let context: BrowserContext | undefined, player = page;
  if (mode === 'preview') await page.getByTitle('Preview (F5)', { exact: true }).click();
  else {
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const file = info.outputPath('adaptive-rollback-offline.html'); await (await pending).saveAs(file);
    context = await browser.newContext({ offline: true, viewport: { width: 1200, height: 1000 } }); player = await context.newPage();
    player.on('pageerror', error => errors.push(error.message));
    player.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
    await player.goto(pathToFileURL(file).href);
  }
  const scope = mode === 'preview' ? page.locator('.preview-overlay') : player.locator('main').first();
  const target = (id: string) => scope.locator(`[data-widget-id="${id}"]`);
  try {
    await expect(target('rollback-status')).toHaveText('Page loads: 1 | Items: 1 | Actions: 0 | Armed: false');
    await target('rollback-arm').click();
    await expect(target('rollback-marker')).toHaveCSS('left', '280px');
    await expect(target('rollback-status')).toHaveText('Page loads: 1 | Items: 1 | Actions: 0 | Armed: true');
    if (mode === 'preview') await scope.getByTitle('Mobile', { exact: true }).click();
    else await player.setViewportSize({ width: 390, height: 1000 });
    await expect(player.getByRole('alert')).toContainText('Invalid selected state');
    await expect(target('rollback-marker')).toBeVisible();
    await expect(target('rollback-invalid-selection')).toHaveCount(0);
    await expect(target('rollback-marker')).toHaveCSS('left', '280px');
    await expect(target('rollback-marker')).toHaveCSS('width', '320px');
    await expect(target('rollback-marker')).toHaveCSS('color', 'rgb(18, 52, 86)');
    await expect(target('rollback-status')).toHaveText('Page loads: 1 | Items: 1 | Actions: 0 | Armed: true');
    await expect(target('rollback-destination-status')).toHaveText('Destination loads: 0');
    await player.screenshot({ path: info.outputPath('adaptive-rollback-restored.png'), fullPage: true });

    // This has no navigation or repeater action. A stale committedNavigation
    // checkpoint must not cause settle() to load the restored source page again.
    await target('rollback-unrelated').click();
    await expect(target('rollback-status')).toContainText('Actions: 1');
    await player.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await writeFile(info.outputPath('adaptive-rollback-observed.json'), JSON.stringify({ mode,
      status: await target('rollback-status').textContent(), destination: await target('rollback-destination-status').textContent(),
      marker: await target('rollback-marker').evaluate(element => ({ left: getComputedStyle(element).left, width: getComputedStyle(element).width, color: getComputedStyle(element).color })),
      alert: await player.getByRole('alert').allTextContents(), errors, network }, null, 2));
    await player.screenshot({ path: info.outputPath('adaptive-rollback-after-unrelated.png'), fullPage: true });
    await expect(target('rollback-status')).toHaveText('Page loads: 1 | Items: 1 | Actions: 1 | Armed: true');
    await expect(target('rollback-destination-status')).toHaveText('Destination loads: 0');
    await expect(target('rollback-marker')).toHaveCSS('left', '280px');
    await expect(target('rollback-marker')).toHaveCSS('width', '320px');
    expect(errors).toEqual([]); expect(network).toEqual([]);
  } finally {
    if (context) await context.close();
    else await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  }
  const saved = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const readback = info.outputPath('adaptive-rollback-unchanged.rea.json'); await (await saved).saveAs(readback);
  expect(JSON.parse(await readFile(readback, 'utf8'))).toEqual(doc);
});
