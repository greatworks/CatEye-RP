import { expect, test, type Browser, type BrowserContext, type FrameLocator, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Document, EventType, Interaction, Widget } from '../../src/model/types';

type Step = Omit<Action, 'id'>;
function event(type: EventType, ...actions: Step[]): Interaction {
  return { id: uid(), name: type, event: type, enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: uid() })) };
}
function widget(type: Widget['type'], id: string, x: number, y: number, text = id): Widget {
  const item = createWidget(type, x, y);
  return { ...item, id, name: id, text, width: 180, height: 50, style: { ...item.style, fontFamily: 'Arial', fontSize: 18, fill: '#ffffff', color: '#123456' } };
}
function button(id: string, x: number, y: number, text: string, ...actions: Step[]): Widget {
  return { ...widget('button', id, x, y, text), width: 130, height: 36, interactions: [event('click', ...actions)] };
}

export function adaptiveHierarchyFixture(): Document {
  const doc = createDocument(); doc.name = 'Adaptive hierarchy runtime'; doc.caseSelection = 'never'; doc.variables = { Events: '0' };
  const main = doc.pages[0]; main.id = 'hierarchy-main'; main.name = 'Width and inheritance'; main.width = 1200; main.height = 850;
  // Match the player's page-width clamp while retaining an explicit desktop Base.
  main.adaptiveSelection = 'native-size'; main.adaptiveBaseSize = { width: 1200, height: 0 };
  const marker = widget('box', 'hierarchy-marker', 20, 120, 'Authored hierarchy'); marker.height = 60;
  const hidden = widget('box', 'hierarchy-hidden', 20, 250, 'Declared visibility');
  hidden.interactions = ['show', 'hide'].map(type => event(type as EventType, { type: 'setVariable', targetId: 'Events', value: '[[Events+1]]' }));
  main.widgets = [marker, hidden, widget('text', 'hierarchy-events', 20, 330, 'Events: [[Events]]'),
    button('hierarchy-mutate', 20, 20, 'Apply actions', { type: 'move', targetId: marker.id, x: 90, y: 160 }, { type: 'resize', targetId: marker.id, x: 300, y: 80 },
      { type: 'setStyle', targetId: marker.id, style: { color: '#ff0000', opacity: 0.25 } }, { type: 'setText', targetId: marker.id, value: 'Runtime hierarchy' }, { type: 'show', targetId: hidden.id }),
    button('hierarchy-frames', 20, 410, 'Nested size', { type: 'openPage', targetId: 'hierarchy-frame-page' }),
    button('hierarchy-height', 170, 410, 'Height matrix', { type: 'openPage', targetId: 'hierarchy-height-page' })];
  // Intentionally child before parent: the ID chain, not list order, controls inheritance.
  main.adaptiveViews = [
    { id: 'hierarchy-tablet', name: 'Tablet child', width: 768, height: 0, baseViewId: 'hierarchy-phone', overrides: { [marker.id]: { y: 150, width: 280, style: { fill: '#cceedd' } } } },
    { id: 'hierarchy-phone', name: 'Phone parent', width: 390, height: 0, overrides: { [marker.id]: { x: 24, width: 220, style: { fill: '#ddeeff', color: '#13579b' } }, [hidden.id]: { hidden: true } } },
  ];
  const heights = createPage('Equal width heights'); heights.id = 'hierarchy-height-page'; heights.width = 390; heights.height = 720;
  heights.adaptiveSelection = 'native-size'; heights.adaptiveBaseSize = { width: 0, height: 0 };
  const heightMarker = widget('box', 'hierarchy-height-marker', 20, 20, 'Viewport height'); heightMarker.width = 160;
  heights.widgets = [heightMarker];
  heights.adaptiveViews = [
    { id: 'hierarchy-tall', name: 'Tall child', width: 390, height: 500, baseViewId: 'hierarchy-short', overrides: { [heightMarker.id]: { width: 260, style: { fill: '#00aa00' } } } },
    { id: 'hierarchy-short', name: 'Short parent', width: 390, height: 0, overrides: { [heightMarker.id]: { width: 180, style: { fill: '#dd0000', color: '#ffffff' } } } },
  ];
  const middle = createPage('Middle frame'); middle.id = 'hierarchy-middle'; middle.width = 560; middle.height = 800;
  const inner = widget('inlineFrame', 'hierarchy-inner-frame', 10, 10, ''); inner.width = 390; inner.height = 300;
  inner.inlineFrame = { ...inner.inlineFrame!, hideBorders: true, target: { kind: 'page', pageId: heights.id } };
  middle.widgets = [inner,
    button('hierarchy-grow', 10, 650, 'Height 600', { type: 'resize', targetId: inner.id, x: 390, y: 600 }),
    button('hierarchy-shrink', 160, 650, 'Height 300', { type: 'resize', targetId: inner.id, x: 390, y: 300 })];
  const frames = createPage('Nested frame sizes'); frames.id = 'hierarchy-frame-page'; frames.width = 900; frames.height = 900;
  const outer = widget('inlineFrame', 'hierarchy-outer-frame', 20, 20, ''); outer.width = 560; outer.height = 800;
  outer.inlineFrame = { ...outer.inlineFrame!, hideBorders: true, target: { kind: 'page', pageId: middle.id } };
  frames.widgets = [outer]; doc.pages.push(heights, middle, frames); return doc;
}

const byId = (scope: Locator | FrameLocator, id: string) => scope.locator(`[data-widget-id="${id}"]`);
async function openDocument(page: Page, doc: Document, info: TestInfo, suffix = 'source') {
  const source = serializeDocument(doc); await writeFile(info.outputPath(`adaptive-hierarchy-${suffix}.rea.json`), source);
  if (suffix === 'source') { page.on('dialog', dialog => dialog.accept()); await page.goto('/'); }
  const pending = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await pending).setFiles({ name: 'adaptive-hierarchy.rea.json', mimeType: 'application/json', buffer: Buffer.from(source) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function saveUnchanged(page: Page, doc: Document, info: TestInfo, name: string) {
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath(`${name}.rea.json`); await (await pending).saveAs(file);
  const saved = JSON.parse(await readFile(file, 'utf8')) as Document;
  expect(saved).toEqual(JSON.parse(serializeDocument(doc))); return saved;
}
async function playerFor(mode: 'preview' | 'offline', page: Page, browser: Browser, info: TestInfo) {
  let context: BrowserContext | undefined;
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click();
    return { page, scope: page.locator('.preview-overlay'), close: () => page.getByRole('button', { name: 'Close preview', exact: true }).click() };
  }
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  const output = info.outputPath('adaptive-hierarchy.html'); await (await pending).saveAs(output);
  context = await browser.newContext({ offline: true, viewport: { width: 1200, height: 1000 } });
  const player = await context.newPage(); await player.goto(pathToFileURL(output).href);
  expect(player.url().startsWith('file:')).toBe(true);
  return { page: player, scope: player.locator('main').first(), close: () => context!.close() };
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: native width inheritance, same-view actions, reset and nested frame height survive roundtrip`, async ({ page, browser }, info) => {
  test.setTimeout(70_000);
  const doc = adaptiveHierarchyFixture(), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await openDocument(page, doc, info); const saved = await saveUnchanged(page, doc, info, 'saved'); await openDocument(page, saved, info, 'reopened');
  const player = await playerFor(mode, page, browser, info); player.page.on('pageerror', e => errors.push(e.message));
  const w = (id: string) => byId(player.scope, id), marker = w('hierarchy-marker');
  const device = async (name: 'Desktop' | 'Mobile' | 'Tablet', width: number) => {
    if (mode === 'preview') await player.scope.getByTitle(name, { exact: true }).click();
    else await player.page.setViewportSize({ width, height: 1000 });
  };
  try {
    await expect(marker).toHaveCSS('width', '180px'); await expect(marker).toHaveCSS('left', '20px');
    await device('Mobile', 390); await expect(marker).toHaveCSS('width', '220px'); await expect(marker).toHaveCSS('background-color', 'rgb(221, 238, 255)'); await expect(w('hierarchy-hidden')).toBeHidden();
    await device('Tablet', 768); await expect(marker).toHaveCSS('width', '280px'); await expect(marker).toHaveCSS('left', '24px'); await expect(marker).toHaveCSS('top', '150px');
    await expect(marker).toHaveCSS('background-color', 'rgb(204, 238, 221)'); await expect(marker).toHaveCSS('color', 'rgb(19, 87, 155)');
    await expect(w('hierarchy-events')).toHaveText('Events: 0'); await w('hierarchy-mutate').click();
    await expect(marker).toHaveCSS('left', '90px'); await expect(marker).toHaveCSS('width', '300px'); await expect(marker).toHaveCSS('opacity', '0.25');
    await expect(w('hierarchy-events')).toHaveText('Events: 1'); await expect(w('hierarchy-hidden')).toBeVisible();
    await player.page.setViewportSize(mode === 'preview' ? { width: 1500, height: 950 } : { width: 800, height: 950 });
    await expect(marker).toHaveCSS('width', '300px'); await expect(marker).toHaveCSS('opacity', '0.25');
    await device('Desktop', 1200); await expect(marker).toHaveCSS('width', '180px'); await expect(marker).toHaveCSS('left', '20px'); await expect(marker).toHaveCSS('color', 'rgb(18, 52, 86)');
    await expect(marker).toHaveCSS('opacity', '1'); await expect(marker).toHaveText('Runtime hierarchy'); await expect(w('hierarchy-hidden')).toBeVisible();
    await device('Tablet', 768); await expect(marker).toHaveCSS('width', '280px'); await expect(w('hierarchy-hidden')).toBeHidden(); await expect(w('hierarchy-events')).toHaveText('Events: 1');
    await player.page.screenshot({ path: info.outputPath(`hierarchy-${mode}.png`), fullPage: true });
    await w('hierarchy-frames').click();
    const middle = player.scope.frameLocator('[data-inline-frame="hierarchy-outer-frame"]');
    const inner = middle.frameLocator('[data-inline-frame="hierarchy-inner-frame"]'), heightMarker = byId(inner, 'hierarchy-height-marker');
    await expect(heightMarker).toHaveCSS('width', '180px'); await expect(heightMarker).toHaveCSS('background-color', 'rgb(221, 0, 0)');
    expect(await inner.locator('body').evaluate(() => [innerWidth, innerHeight])).toEqual([390, 300]);
    await byId(middle, 'hierarchy-grow').click(); await expect(heightMarker).toHaveCSS('width', '260px'); await expect(heightMarker).toHaveCSS('background-color', 'rgb(0, 170, 0)');
    await expect(heightMarker).toHaveCSS('color', 'rgb(255, 255, 255)');
    expect(await inner.locator('body').evaluate(() => [innerWidth, innerHeight])).toEqual([390, 600]);
    await byId(middle, 'hierarchy-shrink').click(); await expect(heightMarker).toHaveCSS('width', '180px');
  } finally { await player.close(); }
  await saveUnchanged(page, doc, info, 'after-runtime'); expect(errors).toEqual([]);
});

test('offline: equal width height thresholds are inclusive and independent of canvas dimensions', async ({ page, browser }, info) => {
  const doc = adaptiveHierarchyFixture(); await openDocument(page, doc, info); const player = await playerFor('offline', page, browser, info);
  try {
    await byId(player.scope, 'hierarchy-height').click(); const marker = byId(player.scope, 'hierarchy-height-marker');
    await player.page.setViewportSize({ width: 390, height: 499 }); await expect(marker).toHaveCSS('width', '180px');
    await player.page.setViewportSize({ width: 390, height: 500 }); await expect(marker).toHaveCSS('width', '260px');
    await player.page.setViewportSize({ width: 390, height: 300 }); await expect(marker).toHaveCSS('width', '180px');
    await player.page.setViewportSize({ width: 389, height: 900 }); await expect(marker).toHaveCSS('width', '160px');
    await player.page.setViewportSize({ width: 390, height: 900 }); await expect(marker).toHaveCSS('width', '260px');
  } finally { await player.close(); }
});
