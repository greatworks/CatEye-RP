import { expect, test, type Browser, type BrowserContext, type FrameLocator, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument as createNativeDocument, createPage as createNativePage, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Document, EventType, Interaction, Widget } from '../../src/model/types';

// Retained saved-project regressions intentionally use the original max-width schema.
function createPage(name?: string) { const page = createNativePage(name); delete page.adaptiveSelection; delete page.adaptiveBaseSize; return page; }
function createDocument() { const doc = createNativeDocument(); for (const page of doc.pages) { delete page.adaptiveSelection; delete page.adaptiveBaseSize; } return doc; }

type Step = Omit<Action, 'id'>;
function event(type: EventType, ...actions: Step[]): Interaction {
  return { id: uid(), name: type, event: type, enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: uid() })) };
}
function widget(type: Widget['type'], id: string, x: number, y: number, text = id): Widget {
  const item = createWidget(type, x, y);
  return { ...item, id, name: id, text, width: 240, height: 50, style: { ...item.style, fontFamily: 'Arial', fontSize: 20, color: '#123456' } };
}
function button(id: string, x: number, y: number, ...actions: Step[]): Widget {
  return { ...widget('button', id, x, y), width: 180, height: 36, interactions: [event('click', ...actions)] };
}
async function openDocument(page: Page, doc: Document, info: TestInfo) {
  await writeFile(info.outputPath('source.rea.json'), serializeDocument(doc));
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/');
  const pending = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await pending).setFiles({ name: 'adaptive-transition.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function playerFor(mode: 'preview' | 'offline', page: Page, browser: Browser, info: TestInfo, width = 1200) {
  let context: BrowserContext | undefined;
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click();
    return { player: page, scope: page.locator('.preview-overlay'), close: async () => { await page.getByRole('button', { name: 'Close preview', exact: true }).click(); } };
  }
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  const output = info.outputPath('adaptive-transition.html'); await (await pending).saveAs(output);
  context = await browser.newContext({ offline: true, viewport: { width, height: 1000 } });
  const player = await context.newPage(); await player.goto(pathToFileURL(output).href);
  return { player, scope: player.locator('main').first(), close: () => context!.close() };
}
async function unchangedDocument(page: Page, doc: Document, info: TestInfo) {
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const output = info.outputPath('unchanged.rea.json'); await (await pending).saveAs(output);
  expect(JSON.parse(await readFile(output, 'utf8'))).toEqual(doc);
}
const byId = (scope: Locator | FrameLocator, id: string) => scope.locator(`[data-widget-id="${id}"]`);

function transitionFixture() {
  const doc = createDocument(); doc.name = 'Adaptive declaration transition'; doc.caseSelection = 'never'; doc.variables = { Events: '0' };
  const main = doc.pages[0]; main.width = 1200; main.height = 900;
  const rich = widget('box', 'adaptive-rich', 80, 120, 'Authored text'); rich.height = 70;
  rich.richText = { expressionMode: 'literal', paragraphs: [{ runs: [{ text: 'Authored text', style: { fontSize: 20, color: '#123456' } }] }] };
  const visible = widget('box', 'adaptive-visible', 20, 240), hidden = widget('box', 'adaptive-hidden', 20, 310); hidden.hidden = true;
  for (const item of [visible, hidden]) item.interactions = ['show', 'hide'].map(type => event(type as EventType, { type: 'setVariable', targetId: 'Events', value: '[[Events+1]]' }));
  const field = widget('input', 'adaptive-input', 20, 380, 'Retained input'); field.disabledStyle = { color: '#993300' };
  const selected = widget('box', 'adaptive-selected', 20, 450); selected.selectedStyle = { fill: '#00aa00' };
  const errored = widget('input', 'adaptive-error', 20, 520, 'Retained error'); errored.errorStyle = { stroke: '#ff0000', strokeWidth: 3 };
  main.widgets = [rich, visible, hidden, field, selected, errored,
    widget('text', 'adaptive-events', 20, 590, 'Events: [[Events]]'),
    button('adaptive-mutate', 20, 20,
      { type: 'move', targetId: rich.id, x: 280, y: 140 }, { type: 'resize', targetId: rich.id, x: 380, y: 80 },
      { type: 'setStyle', targetId: rich.id, style: { color: '#ff0000', fontSize: 28, opacity: 0.25 } },
      { type: 'setText', targetId: rich.id, value: 'Runtime content' },
      { type: 'hide', targetId: visible.id }, { type: 'show', targetId: hidden.id },
      { type: 'move', targetId: field.id, x: 60, y: 380 }, { type: 'resize', targetId: field.id, x: 320, y: 60 },
      { type: 'disable', targetId: field.id }, { type: 'setSelected', targetId: selected.id, value: 'true' },
      { type: 'setError', targetId: errored.id, value: 'true' })];
  main.adaptiveViews = [{ id: 'adaptive-phone', name: 'Phone', width: 390, overrides: {
    [rich.id]: { x: 20, y: 120, width: 200, height: 90, style: { fontSize: 18, color: '#112233', opacity: 0.8 } },
    [field.id]: { x: 10, width: 250 },
  } }];
  return doc;
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: crossing a view restores declarations silently while same-view resize keeps actions`, async ({ page, browser }, info) => {
  const doc = transitionFixture(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await openDocument(page, doc, info);
  const player = await playerFor(mode, page, browser, info); player.player.on('pageerror', error => errors.push(error.message));
  const w = (id: string) => byId(player.scope, id), rich = w('adaptive-rich');
  try {
    await w('adaptive-mutate').click(); await expect(rich).toHaveCSS('left', '280px'); await expect(rich).toHaveCSS('width', '380px');
    await expect(rich.locator('[data-rich-run]')).toHaveCSS('font-size', '28px'); await expect(w('adaptive-events')).toHaveText('Events: 2');
    if (mode === 'preview') await player.scope.getByTitle('Tablet', { exact: true }).click();
    else await player.player.setViewportSize({ width: 1100, height: 1000 });
    await expect(rich).toHaveCSS('width', '380px'); await expect(rich).toHaveCSS('opacity', '0.25');
    if (mode === 'preview') await player.scope.getByTitle('Mobile', { exact: true }).click();
    else await player.player.setViewportSize({ width: 390, height: 1000 });
    await expect(rich).toHaveCSS('left', '20px'); await expect(rich).toHaveCSS('width', '200px'); await expect(rich).toHaveCSS('height', '90px');
    await expect(rich).toHaveText('Runtime content'); await expect(rich).toHaveCSS('opacity', '0.8');
    await expect(rich.locator('[data-rich-run]')).toHaveCSS('font-size', '18px'); await expect(rich.locator('[data-rich-run]')).toHaveCSS('color', 'rgb(17, 34, 51)');
    await expect(w('adaptive-visible')).toBeVisible(); await expect(w('adaptive-hidden')).toBeHidden(); await expect(w('adaptive-events')).toHaveText('Events: 2');
    await expect(w('adaptive-input')).toHaveCSS('left', '10px'); await expect(w('adaptive-input')).toHaveCSS('width', '250px');
    await expect(w('adaptive-input').locator('input')).toBeDisabled(); await expect(w('adaptive-input').locator('input')).toHaveValue('Retained input');
    await expect(w('adaptive-selected')).toHaveCSS('background-color', 'rgb(0, 170, 0)'); await expect(w('adaptive-error')).toHaveCSS('border-top-color', 'rgb(255, 0, 0)');
    if (mode === 'preview') await player.scope.getByTitle('Desktop', { exact: true }).click();
    else await player.player.setViewportSize({ width: 1200, height: 1000 });
    await expect(rich).toHaveCSS('left', '80px'); await expect(rich).toHaveCSS('width', '240px'); await expect(rich).toHaveCSS('opacity', '1');
    await expect(rich.locator('[data-rich-run]')).toHaveCSS('font-size', '20px'); await expect(rich.locator('[data-rich-run]')).toHaveCSS('color', 'rgb(18, 52, 86)');
    await expect(w('adaptive-events')).toHaveText('Events: 2');
    await player.player.screenshot({ path: info.outputPath(`adaptive-transition-${mode}.png`), fullPage: true });
  } finally { await player.close(); }
  await unchangedDocument(page, doc, info); expect(errors).toEqual([]);
});

function loadingFixture() {
  const doc = createDocument(); doc.name = 'Adaptive load-time reads'; doc.caseSelection = 'never';
  const main = doc.pages[0]; main.id = 'adaptive-main'; main.width = 390; main.height = 850;
  const detail = createPage('Adaptive destination'); detail.id = 'adaptive-detail'; detail.width = 1200; detail.height = 850;
  for (const [target, prefix, viewWidth, width] of [[main, 'first', 400, 211], [detail, 'next', 500, 277]] as const) {
    const log = widget('text', `${prefix}-log`, 20, 20, 'Waiting'); log.width = 340;
    const hidden = widget('box', `${prefix}-hidden`, 20, 110); hidden.hidden = true; hidden.width = 99;
    hidden.interactions = [event('load', { type: 'setText', targetId: log.id, value: 'Hidden width: [[This.width]]' })];
    const panel = widget('panel', `${prefix}-panel`, 20, 230), inactive = widget('box', `${prefix}-inactive`, 0, 0); inactive.width = 88;
    const inactiveLog = widget('text', `${prefix}-inactive-log`, 20, 75, 'Waiting'); inactiveLog.width = 340;
    inactive.interactions = [event('load', { type: 'setText', targetId: inactiveLog.id, value: 'Inactive width: [[This.width]]' })];
    panel.states = [{ id: `${prefix}-active`, name: 'Active', widgets: [] }, { id: `${prefix}-other`, name: 'Inactive', widgets: [inactive] }]; panel.activeStateId = `${prefix}-active`;
    target.widgets = [log, inactiveLog, hidden, panel];
    target.adaptiveViews = [{ id: `${prefix}-view`, name: `${prefix} view`, width: viewWidth, overrides: { [hidden.id]: { width }, [inactive.id]: { width: width + 1 } } }];
  }
  main.widgets.push(button('adaptive-go', 20, 340, { type: 'openPage', targetId: detail.id }));
  doc.pages.push(detail); return doc;
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: hidden and inactive Loaded actions see the selected view before their first render and after navigation`, async ({ page, browser }, info) => {
  const doc = loadingFixture(); await openDocument(page, doc, info); const player = await playerFor(mode, page, browser, info, 390);
  try {
    await expect(byId(player.scope, 'first-log')).toHaveText('Hidden width: 211');
    await expect(byId(player.scope, 'first-inactive-log')).toHaveText('Inactive width: 212');
    if (mode === 'preview') await player.scope.getByTitle('Mobile', { exact: true }).click();
    await byId(player.scope, 'adaptive-go').click();
    await expect(byId(player.scope, 'next-log')).toHaveText('Hidden width: 277');
    await expect(byId(player.scope, 'next-inactive-log')).toHaveText('Inactive width: 278');
  } finally { await player.close(); }
});

for (const mode of ['preview', 'offline'] as const) test(`${mode}: nested inline players initialize and navigate with their own viewport`, async ({ page, browser }, info) => {
  const doc = loadingFixture(), child = doc.pages[0]; child.width = 1200;
  const middle = createPage('Adaptive middle'), root = createPage('Adaptive root'); middle.width = root.width = 1200;
  const inner = widget('inlineFrame', 'adaptive-inner-frame', 0, 0, ''); inner.width = 360; inner.height = 650; inner.inlineFrame!.hideBorders = true; inner.inlineFrame!.target = { kind: 'page', pageId: child.id };
  const outer = widget('inlineFrame', 'adaptive-outer-frame', 20, 20, ''); outer.width = 700; outer.height = 720; outer.inlineFrame!.hideBorders = true; outer.inlineFrame!.target = { kind: 'page', pageId: middle.id };
  middle.widgets = [inner]; root.widgets = [outer]; doc.pages = [root, middle, ...doc.pages];
  await openDocument(page, doc, info); const player = await playerFor(mode, page, browser, info);
  try {
    const frame = player.scope.frameLocator('[data-inline-frame="adaptive-outer-frame"]').frameLocator('[data-inline-frame="adaptive-inner-frame"]');
    await expect(byId(frame, 'first-log')).toHaveText('Hidden width: 211'); await expect(byId(frame, 'first-inactive-log')).toHaveText('Inactive width: 212');
    expect(await frame.locator('body').evaluate(() => window.innerWidth)).toBe(360);
    await byId(frame, 'adaptive-go').click(); await expect(byId(frame, 'next-log')).toHaveText('Hidden width: 277'); await expect(byId(frame, 'next-inactive-log')).toHaveText('Inactive width: 278');
  } finally { await player.close(); }
});

for (const mode of ['preview', 'offline'] as const) test(`${mode}: adaptive repeater rebuild keeps row state while ordinary data refresh resets it`, async ({ page, browser }, info) => {
  const doc = createDocument(); doc.name = 'Adaptive repeater persistence'; doc.caseSelection = 'never'; doc.variables = { Loads: '0' };
  const main = doc.pages[0]; main.width = 1200; main.height = 950;
  const list = widget('repeater', 'adaptive-list', 20, 100, ''); list.width = 340; list.height = 600;
  const selected = widget('box', 'row-selected', 10, 10, '[[Item.Name]]'); selected.width = 150; selected.selectedStyle = { fill: '#00aa00' };
  const error = widget('input', 'row-error', 10, 70, 'Error [[Item.Name]]'); error.errorStyle = { stroke: '#ff0000', strokeWidth: 3 };
  const disabled = widget('input', 'row-disabled', 10, 130, 'Input [[Item.Name]]');
  const mutate = button('row-mutate', 10, 190,
    { type: 'setSelected', targetId: selected.id, value: 'true' }, { type: 'setText', targetId: selected.id, value: 'Temporary row text' },
    { type: 'setError', targetId: error.id, value: 'true' }, { type: 'disable', targetId: disabled.id });
  list.repeater = { columns: ['Name'], rows: [{ Name: 'Alpha' }, { Name: 'Beta' }], template: [selected, error, disabled, mutate], itemHeight: 250, itemWidth: 340, gap: 10, layout: 'vertical' };
  list.interactions = [event('itemLoad', { type: 'setVariable', targetId: 'Loads', value: '[[Loads+1]]' })];
  main.widgets = [list, widget('text', 'row-loads', 20, 20, 'Loads: [[Loads]]'), button('row-sort', 20, 720, { type: 'sortRows', targetId: list.id, value: 'Name:desc' })];
  main.adaptiveViews = [{ id: 'row-phone', name: 'Phone', width: 390, overrides: { [selected.id]: { width: 180 } } }];
  await openDocument(page, doc, info); const player = await playerFor(mode, page, browser, info);
  const w = (id: string) => byId(player.scope, id);
  try {
    await expect(w('row-loads')).toHaveText('Loads: 2'); await w('row-mutate').nth(0).click();
    await expect(w('row-selected').nth(0)).toHaveText('Temporary row text'); await expect(w('row-disabled').nth(0).locator('input')).toBeDisabled();
    if (mode === 'preview') await player.scope.getByTitle('Mobile', { exact: true }).click(); else await player.player.setViewportSize({ width: 390, height: 1000 });
    await expect(w('row-loads')).toHaveText('Loads: 4'); await expect(w('row-selected')).toHaveText(['Alpha', 'Beta']);
    await expect(w('row-selected').nth(0)).toHaveCSS('width', '180px'); await expect(w('row-selected').nth(0)).toHaveCSS('background-color', 'rgb(0, 170, 0)');
    await expect(w('row-selected').nth(1)).not.toHaveCSS('background-color', 'rgb(0, 170, 0)');
    await expect(w('row-error').nth(0)).toHaveCSS('border-top-color', 'rgb(255, 0, 0)'); await expect(w('row-disabled').nth(0).locator('input')).toBeDisabled();
    await expect(w('row-disabled').nth(1).locator('input')).toBeEnabled();
    await w('row-sort').click(); await expect(w('row-loads')).toHaveText('Loads: 6'); await expect(w('row-selected')).toHaveText(['Beta', 'Alpha']);
    await expect(w('row-selected').nth(1)).not.toHaveCSS('background-color', 'rgb(0, 170, 0)');
    await expect(w('row-error').nth(1)).not.toHaveCSS('border-top-color', 'rgb(255, 0, 0)'); await expect(w('row-disabled').nth(1).locator('input')).toBeEnabled();
  } finally { await player.close(); }
});
