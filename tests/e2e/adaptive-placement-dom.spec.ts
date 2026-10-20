import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../../src/model/document';

function fixture() {
  const doc = createDocument(), page = doc.pages[0], embedded = createPage('Embedded state'); doc.name = 'Placement DOM lifecycle'; doc.caseSelection = 'never';
  page.width = 1200; page.height = 800; page.adaptiveBaseSize = { width: 1200, height: 0 }; page.adaptiveSelection = 'native-size';
  const input = createWidget('input', 30, 30); input.id = 'placement-input'; input.name = 'Retained input'; input.text = 'Original';
  const nested = createWidget('input', 10, 10); nested.id = 'placement-nested-input'; nested.name = 'Panel input';
  const holder = createWidget('panel', 30, 100); holder.id = 'placement-panel'; holder.states = [{ id: uid(), name: 'State', widgets: [nested] }]; holder.activeStateId = holder.states[0].id;
  const frame = createWidget('inlineFrame', 30, 300); frame.id = 'placement-frame'; frame.name = 'Retained frame'; frame.width = 500; frame.height = 260; frame.inlineFrame!.target = { kind: 'page', pageId: embedded.id };
  const initialFrame = structuredClone(frame); initialFrame.id = 'placement-initial-frame'; initialFrame.name = 'Initially unplaced frame'; initialFrame.x = 600; initialFrame.placed = false;
  const count = createWidget('text', 20, 20), add = createWidget('button', 20, 80); count.id = 'placement-count'; count.text = 'Count [[Count]]'; add.id = 'placement-add'; add.text = 'Add one';
  add.interactions = [{ id: uid(), name: 'Increment', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setVariable', targetId: 'Count', value: '[[Count + 1]]' }] }];
  embedded.width = 500; embedded.height = 260; embedded.widgets = [count, add]; doc.variables.Count = '1';
  page.widgets = [input, holder, frame, initialFrame]; page.adaptiveViews = [{ id: 'away', name: 'Unplaced', width: 768, overrides: Object.fromEntries([input, holder, frame].map(w => [w.id, { placed: false }])) }, { id: 'back', name: 'Placed child', width: 390, baseViewId: 'away', overrides: Object.fromEntries([input, holder, frame, initialFrame].map(w => [w.id, { placed: true }])) }];
  doc.pages.push(embedded); return doc;
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: unplacement retains input and embedded document identity`, async ({ page, browser }, info) => {
  const doc = fixture(), source = serializeDocument(doc), errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/');
  const chooser = page.waitForEvent('filechooser'); await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'placement-dom.rea.json', mimeType: 'application/json', buffer: Buffer.from(source) }); await expect(page.locator('.titlebar')).toContainText(doc.name);
  let player = page; const context = mode === 'offline' ? await browser.newContext({ offline: true, viewport: { width: 1200, height: 1000 } }) : undefined;
  if (context) { const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const html = info.outputPath('placement-dom.html'); await (await pending).saveAs(html); player = await context.newPage(); player.on('pageerror', e => errors.push(e.message)); await player.goto(pathToFileURL(html).href); }
  else await page.getByTitle('Preview (F5)', { exact: true }).click();
  const scope = mode === 'preview' ? player.locator('.preview-overlay') : player.locator('main').first(), view = (mode === 'preview' ? scope : player).getByRole('combobox', { name: 'Adaptive view', exact: true });
  const input = scope.locator('[data-widget-id="placement-input"] input'), nested = scope.locator('[data-widget-id="placement-nested-input"] input'), frame = scope.locator('iframe[data-inline-frame="placement-frame"]');
  await input.fill('Typed Unicode 字'); await nested.fill('Nested input retained');
  const child = frame.contentFrame(); await expect(child.locator('[data-widget-id="placement-count"]')).toHaveText('Count 1'); await child.locator('[data-widget-id="placement-add"]').click(); await expect(child.locator('[data-widget-id="placement-count"]')).toHaveText('Count 2');
  const inputHandle = await input.elementHandle(), nestedHandle = await nested.elementHandle(), frameHandle = await frame.elementHandle();
  const visibleDisplay = await input.locator('..').evaluate(el => getComputedStyle(el).display);
  const initialFrame = scope.locator('iframe[data-inline-frame="placement-initial-frame"]'), initialChild = initialFrame.contentFrame(), initialHandle = await initialFrame.elementHandle();
  await expect(initialFrame).toBeHidden(); await expect(initialChild.locator('[data-widget-id="placement-count"]')).toHaveText('Count 1');
  await initialChild.locator('body').evaluate(el => { el.dataset.placementIdentity = 'initial-hidden-document'; });
  await child.locator('body').evaluate(el => { el.dataset.placementIdentity = 'retained-document'; });
  for (const choice of [{ kind: 'view', viewId: 'away' }, { kind: 'view', viewId: 'back' }, { kind: 'view', viewId: 'away' }, { kind: 'base' }]) {
    await view.selectOption(JSON.stringify(choice)); const unplaced = choice.kind === 'view' && choice.viewId === 'away';
    await expect(scope.locator('[data-widget-id="placement-input"]')).toHaveCSS('display', unplaced ? 'none' : visibleDisplay);
    expect(await input.evaluate((el, old) => el === old, inputHandle)).toBe(true); expect(await nested.evaluate((el, old) => el === old, nestedHandle)).toBe(true); expect(await frame.evaluate((el, old) => el === old, frameHandle)).toBe(true);
    await expect(input).toHaveValue('Typed Unicode 字'); await expect(nested).toHaveValue('Nested input retained');
    await expect(child.locator('body')).toHaveAttribute('data-placement-identity', 'retained-document'); await expect(child.locator('[data-widget-id="placement-count"]')).toHaveText('Count 2');
    expect(await initialFrame.evaluate((el, old) => el === old, initialHandle)).toBe(true); await expect(initialChild.locator('body')).toHaveAttribute('data-placement-identity', 'initial-hidden-document');
    if (choice.kind === 'view' && choice.viewId === 'back') await expect(initialFrame).toBeVisible(); else await expect(initialFrame).toBeHidden();
    if (unplaced) { await expect(frame).toBeHidden(); await expect(nested).toBeHidden(); } else await expect(frame).toBeVisible();
  }
  await child.locator('[data-widget-id="placement-add"]').click(); await expect(child.locator('[data-widget-id="placement-count"]')).toHaveText('Count 3');
  if (context) await context.close(); else await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const saved = info.outputPath('after-placement.rea.json'); await (await download).saveAs(saved); expect(JSON.parse(await readFile(saved, 'utf8'))).toEqual(doc); expect(errors).toEqual([]);
});
