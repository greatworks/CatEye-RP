import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, uid } from '../../src/model/document';
import type { Action, Document, EventType, Interaction, Widget, WidgetType } from '../../src/model/types';

type Scope = Locator | Page;
const widget = (scope: Scope, name: string) => scope.locator(`.widget[aria-label="${name}"]`);
function interaction(event: EventType, actions: Omit<Action, 'id'>[]): Interaction {
  return { id: uid(), event, name: event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ id: uid(), ...action })) };
}
function selectionTrace(w: Widget, variable: string) {
  w.interactions.push(...(['selectedChange', 'select', 'unselect', 'change'] as const).map(event => interaction(event, [{ type: 'setVariable', targetId: variable, value: `[[${variable}]]${w.name}:${event};` }])));
}
function fixture(): Document {
  const doc = createDocument(); doc.name = 'Selection behavior'; doc.caseSelection = 'never'; doc.variables = { Tabs: '', Forms: '' };
  const add = (type: WidgetType, name: string, x: number, y: number) => {
    const w = createWidget(type, x, y); w.name = name; w.text = name; w.width = 220; doc.pages[0].widgets.push(w); return w;
  };
  const tabs = ['Tab A', 'Tab B'].map((name, index) => {
    const w = add('box', name, 40 + index * 260, 40); w.height = 60; w.selectionGroup = 'navigation'; w.selected = index === 0;
    w.style.fill = '#eeeeee'; w.style.stroke = '#999999'; w.selectedStyle = { fill: '#123456', stroke: '#ff0000', color: '#ffffff' };
    w.interactions = [interaction('click', [{ type: 'setSelected', targetId: w.id, value: 'true' }])]; selectionTrace(w, 'Tabs'); return w;
  });
  const passive = add('box', 'Passive shape', 560, 40); passive.height = 60; passive.selectedStyle = { fill: '#123456' };
  const base = add('button', 'Change base fill', 40, 130); base.interactions = [interaction('click', [{ type: 'setStyle', targetId: tabs[1].id, style: { fill: '#00aa00' } }])];
  const unselect = add('button', 'Unselect B', 300, 130); unselect.interactions = [interaction('click', [{ type: 'setSelected', targetId: tabs[1].id, value: 'false' }])];
  const toggle = add('button', 'Toggle B', 560, 130); toggle.interactions = [interaction('click', [{ type: 'setSelected', targetId: tabs[1].id, value: 'toggle' }])];
  const checkbox = add('checkbox', 'Check', 40, 220); checkbox.selectedStyle = { color: '#cc0000' }; selectionTrace(checkbox, 'Forms');
  for (const [index, name] of ['Radio A', 'Radio B'].entries()) {
    const radio = add('radio', name, 300 + index * 260, 220); radio.radioGroup = 'choice'; radio.selectedStyle = { color: '#cc0000' }; selectionTrace(radio, 'Forms');
  }
  const disabled = add('radio', 'Disabled radio', 40, 290); disabled.disabled = true; disabled.radioGroup = 'choice'; selectionTrace(disabled, 'Forms');
  const tabLog = add('text', 'Tab events', 40, 360); tabLog.text = '[[Tabs]]'; tabLog.width = 1080; tabLog.height = 140;
  const formLog = add('text', 'Form events', 40, 530); formLog.text = '[[Forms]]'; formLog.width = 1080; formLog.height = 200;
  return doc;
}
async function menu(page: Page, action: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}
async function openFixture(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'selection.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function exercise(scope: Scope) {
  const a = widget(scope, 'Tab A'), b = widget(scope, 'Tab B');
  await expect(a).toHaveCSS('background-color', 'rgb(18, 52, 86)'); await expect(b).toHaveCSS('background-color', 'rgb(238, 238, 238)');
  await widget(scope, 'Passive shape').click(); await expect(widget(scope, 'Passive shape')).not.toHaveCSS('background-color', 'rgb(18, 52, 86)');
  await b.click(); let tabs = 'Tab A:selectedChange;Tab A:unselect;Tab B:selectedChange;Tab B:select;';
  await expect(widget(scope, 'Tab events')).toHaveText(tabs); await expect(a).toHaveCSS('background-color', 'rgb(238, 238, 238)'); await expect(b).toHaveCSS('color', 'rgb(255, 255, 255)'); await expect(b).toHaveCSS('border-color', 'rgb(255, 0, 0)');
  await b.click(); await expect(widget(scope, 'Tab events')).toHaveText(tabs); // Programmatic same-value selection emits no duplicate events.
  await widget(scope, 'Change base fill').click(); await expect(b).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  await widget(scope, 'Unselect B').click(); tabs += 'Tab B:selectedChange;Tab B:unselect;';
  await expect(widget(scope, 'Tab events')).toHaveText(tabs); await expect(b).toHaveCSS('background-color', 'rgb(0, 170, 0)');
  await widget(scope, 'Toggle B').click(); tabs += 'Tab B:selectedChange;Tab B:select;'; await expect(widget(scope, 'Tab events')).toHaveText(tabs); await expect(b).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  const check = scope.locator('input[aria-label="Check"]'); await check.check(); let forms = 'Check:selectedChange;Check:select;Check:change;';
  await expect(widget(scope, 'Form events')).toHaveText(forms); await expect(widget(scope, 'Check')).toHaveCSS('color', 'rgb(204, 0, 0)');
  await check.uncheck(); forms += 'Check:selectedChange;Check:unselect;Check:change;'; await expect(widget(scope, 'Form events')).toHaveText(forms);
  const radioA = scope.locator('input[aria-label="Radio A"]'), radioB = scope.locator('input[aria-label="Radio B"]');
  await radioA.click(); forms += 'Radio A:selectedChange;Radio A:select;Radio A:change;'; await expect(widget(scope, 'Form events')).toHaveText(forms);
  await radioB.click(); forms += 'Radio A:selectedChange;Radio A:unselect;Radio B:selectedChange;Radio B:select;Radio B:change;';
  await expect(radioA).not.toBeChecked(); await expect(radioB).toBeChecked(); await expect(widget(scope, 'Form events')).toHaveText(forms);
  await radioB.click(); forms += 'Radio B:selectedChange;Radio B:unselect;Radio B:selectedChange;Radio B:select;';
  await expect(widget(scope, 'Form events')).toHaveText(forms); await expect(radioB).toBeChecked();
  await expect(scope.locator('input[aria-label="Disabled radio"]')).toBeDisabled(); await expect(scope.locator('input[aria-label="Disabled radio"]')).not.toBeChecked();
  await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: selected styles, groups and real form clicks use the shared selection dispatch`, async ({ page, browser }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await openFixture(page, fixture());
  if (mode === 'preview') { await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page.locator('.preview-overlay')); }
  else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const path = testInfo.outputPath('selection.html'); await (await download).saveAs(path);
    const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
    try { const exported = await context.newPage(), requests: string[] = []; exported.on('pageerror', error => errors.push(error.message)); exported.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); }); await exported.goto(pathToFileURL(path).href); await exercise(exported); expect(requests).toEqual([]); }
    finally { await context.close(); }
  }
  expect(errors).toEqual([]);
});

test('Inspector saves and reopens selection fields, action values and panel fit, and removes style overrides', async ({ page }, testInfo) => {
  page.on('dialog', dialog => dialog.accept()); const doc = createDocument(); doc.name = 'Authored selection'; doc.caseSelection = 'never';
  const box = createWidget('box', 40, 40); box.name = 'Authored tab'; box.text = 'Tab'; const radio = createWidget('radio', 280, 40), panel = createWidget('panel', 40, 250); panel.name = 'Fitted panel';
  doc.pages[0].widgets = [box, radio, panel]; await openFixture(page, doc);
  const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  const field = async (name: string, value: string) => { const input = inspector.getByLabel(name, { exact: true }); await input.fill(value); await input.press('Tab'); };
  await page.locator('.editor-widget.box').click(); await inspector.getByRole('checkbox', { name: 'Selected by default', exact: true }).check(); await field('Selection group', 'Authored tabs');
  await inspector.getByRole('checkbox', { name: 'Custom selected style', exact: true }).check(); await field('Selected fill', '#123456'); await field('Selected text color', '#ffffff'); await field('Selected border', '#ff0000');
  await expect(page.locator('.editor-widget.box')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  await inspector.getByLabel('Selected style', { exact: true }).fill('{"fill":"url(https://example.com/x)"}'); await inspector.getByRole('button', { name: 'Apply selected style', exact: true }).click(); await expect(inspector.getByRole('alert')).toContainText('expected a color');
  await inspector.getByLabel('Selected style', { exact: true }).fill('{"fill":"#123456","color":"#ffffff","stroke":"#ff0000","textPadding":[1,2,3,4]}'); await inspector.getByRole('button', { name: 'Apply selected style', exact: true }).click(); await expect(inspector.getByRole('alert')).toHaveCount(0);
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click(); await inspector.getByRole('button', { name: 'New interaction', exact: true }).click();
  await inspector.getByRole('button', { name: 'Add action', exact: true }).click(); await inspector.getByLabel('Action 1 type', { exact: true }).selectOption('setSelected');
  await expect(inspector.getByLabel('Action 1 target', { exact: true }).locator(`option[value="${panel.id}"]`)).toHaveCount(0);
  await inspector.getByLabel('Action 1 target', { exact: true }).selectOption(box.id); await inspector.getByLabel('Selection value', { exact: true }).selectOption('toggle');
  for (const event of ['selectedChange', 'select', 'unselect']) {
    await inspector.getByRole('button', { name: 'New interaction', exact: true }).click();
    await inspector.locator('section[aria-label="Click or tap event cases"]').getByLabel('Interaction event', { exact: true }).last().selectOption(event);
  }
  await page.locator('.editor-widget.radio').click(); await inspector.getByRole('tab', { name: 'Style', exact: true }).click(); await field('Radio group', 'Authored radios'); await inspector.getByRole('checkbox', { name: 'Checked by default', exact: true }).check();
  await page.locator('.editor-widget.panel').click(); await inspector.getByRole('checkbox', { name: 'Fit to content', exact: true }).check();
  const save = async (name: string) => { const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const path = testInfo.outputPath(name); await (await download).saveAs(path); return { path, doc: JSON.parse(await readFile(path, 'utf8')) as Document }; };
  const saved = await save('selection.rea.json'); expect(saved.doc.pages[0].widgets[0]).toMatchObject({ selected: true, selectionGroup: 'Authored tabs', selectedStyle: { fill: '#123456', color: '#ffffff', stroke: '#ff0000', textPadding: [1, 2, 3, 4] } });
  // New interaction inserts after the existing click case before being changed to another event.
  expect(saved.doc.pages[0].widgets[0].interactions.map(item => item.event)).toEqual(['click', 'unselect', 'select', 'selectedChange']); expect(saved.doc.pages[0].widgets[0].interactions[0].actions).toMatchObject([{ type: 'setSelected', value: 'toggle' }]);
  expect(saved.doc.pages[0].widgets[1]).toMatchObject({ checked: true, radioGroup: 'Authored radios' }); expect(saved.doc.pages[0].widgets[2].fitToContent).toBe(true);
  await menu(page, 'New Ctrl+N'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O'); await (await chooser).setFiles(saved.path); await expect(page.locator('.titlebar')).toContainText(doc.name); expect((await save('selection-reopened.rea.json')).doc).toEqual(saved.doc);
  await page.locator('.editor-widget.box').click(); await inspector.getByRole('checkbox', { name: 'Custom selected style', exact: true }).uncheck(); await expect(page.locator('.editor-widget.box')).toHaveCSS('background-color', 'rgb(255, 255, 255)'); expect((await save('selection-cleared.rea.json')).doc.pages[0].widgets[0]).not.toHaveProperty('selectedStyle');
});

for (const mode of ['preview', 'offline'] as const) test(`${mode}: grouped radios support Tab, arrows and Space with one selection dispatch path`, async ({ page, browser }, testInfo) => {
  const doc = fixture(), before = createWidget('input', 40, 10); before.name = 'Before radio group';
  doc.pages[0].widgets = [before, ...doc.pages[0].widgets.filter(w => ['Radio A', 'Radio B', 'Disabled radio', 'Form events'].includes(w.name))];
  const rows = createWidget('repeater', 40, 320); rows.name = 'Radio rows'; rows.width = 700; rows.height = 160;
  const rowA = createWidget('radio', 10, 5), rowB = createWidget('radio', 240, 5); rowA.name = 'Row radio A'; rowB.name = 'Row radio B'; rowA.radioGroup = rowB.radioGroup = 'choice';
  rows.repeater = { columns: ['Name'], rows: [{ Name: 'One' }, { Name: 'Two' }], itemHeight: 65, gap: 0, template: [rowA, rowB] }; doc.pages[0].widgets.push(rows);
  await openFixture(page, doc);
  const verify = async (scope: Scope) => {
    const before = scope.locator('input[aria-label="Before radio group"]'), a = scope.locator('input[aria-label="Radio A"]'), b = scope.locator('input[aria-label="Radio B"]');
    await before.click(); await before.press('Tab'); await expect(a).toBeFocused();
    await a.press('Space'); let events = 'Radio A:selectedChange;Radio A:select;Radio A:change;'; await expect(widget(scope, 'Form events')).toHaveText(events); await expect(a).toBeChecked();
    await a.press('ArrowRight'); await expect(b).toBeFocused(); await expect(a).not.toBeChecked(); await expect(b).toBeChecked();
    events += 'Radio A:selectedChange;Radio A:unselect;Radio B:selectedChange;Radio B:select;Radio B:change;'; await expect(widget(scope, 'Form events')).toHaveText(events);
    // Native Chromium emits no click when Space is pressed on an already checked radio.
    // Pointer re-clicks do emit click and their unselect/select cycle is tested separately above.
    await b.press('Space'); await expect(widget(scope, 'Form events')).toHaveText(events);
    await expect(a).not.toBeChecked(); await expect(b).toBeChecked();
    const rowAs = scope.locator('input[aria-label="Row radio A"]'), rowBs = scope.locator('input[aria-label="Row radio B"]');
    await b.press('Tab'); await expect(rowAs.nth(0)).toBeFocused(); await rowAs.nth(0).press('Space'); await rowAs.nth(0).press('ArrowRight'); await expect(rowBs.nth(0)).toBeFocused(); await expect(rowBs.nth(0)).toBeChecked();
    await rowBs.nth(0).press('Tab'); await expect(rowAs.nth(1)).toBeFocused(); await rowAs.nth(1).press('Space');
    await expect(rowAs.nth(1)).toBeChecked(); await expect(rowBs.nth(0)).toBeChecked(); await expect(b).toBeChecked();
    const names = await Promise.all([b, rowBs.nth(0), rowAs.nth(1)].map(item => item.getAttribute('name'))); expect(names.every(Boolean)).toBe(true); expect(new Set(names).size).toBe(3);
    await expect(widget(scope, 'Form events')).toHaveText(events); // Row groups cannot dispatch outer radio events.
  };
  if (mode === 'preview') { await page.getByTitle('Preview (F5)', { exact: true }).click(); await verify(page.locator('.preview-overlay')); }
  else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const path = testInfo.outputPath('selection-keyboard.html'); await (await download).saveAs(path);
    const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
    try { const exported = await context.newPage(); await exported.goto(pathToFileURL(path).href); await verify(exported); } finally { await context.close(); }
  }
});
