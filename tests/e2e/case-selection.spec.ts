import { expect, test, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createPage, createWidget, uid } from '../../src/model/document';
import type { Action, Condition, Document, Interaction, WidgetType } from '../../src/model/types';

type Scope = Page | Locator;
type Mode = 'preview' | 'offline';
type Policy = NonNullable<Document['caseSelection']>;
type ActionSpec = Omit<Action, 'id'>;
const widget = (scope: Scope, name: string) => scope.locator(`.widget[aria-label="${name}"]`);
const menus = (scope: Scope) => scope.getByRole('menu', { name: 'Choose a case', exact: true });
const set = (targetId: string, value: string): ActionSpec => ({ type: 'setVariable', targetId, value });
const text = (targetId: string, value: string): ActionSpec => ({ type: 'setText', targetId, value });
function interaction(name: string, actions: ActionSpec[], options: Partial<Interaction> = {}): Interaction {
  return { id: uid(), name, event: 'click', enabled: true, isNewIfGroup: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })), ...options };
}
function base(name: string, policy: Policy = 'auto') {
  const doc = createDocument(); doc.name = name; doc.caseSelection = policy;
  doc.pages[0].width = 1120; doc.pages[0].height = 900;
  const make = (type: WidgetType, name: string, value: string, x: number, y: number, width = 260) => {
    const item = createWidget(type, x, y); item.name = name; item.text = value; item.width = width;
    doc.pages[0].widgets.push(item); return item;
  };
  return { doc, make };
}

function automaticFixture(policy: Policy | 'legacy' = 'auto'): Document {
  const { doc, make } = base(`Case selection ${policy}`, policy === 'legacy' ? 'never' : policy);
  if (policy === 'legacy') delete doc.caseSelection;
  doc.variables = { Selected: 'idle', Single: 'idle', Conditional: 'idle', DisabledCondition: 'idle' };
  const choose = make('button', 'Choose an automatic case', 'Choose an automatic case', 40, 40);
  choose.interactions = [interaction('Choose first', [set('Selected', 'first')]), interaction('Choose second', [set('Selected', 'second')]), interaction('Empty choice', []), interaction('Disabled choice', [set('Selected', 'wrong disabled')], { enabled: false })];
  make('text', 'Selected case result', '[[Selected]]', 400, 40, 620);
  const single = make('button', 'Run single automatic case', 'Single automatic case', 40, 150);
  single.interactions = [interaction('Single enabled case', [set('Single', 'ran')])];
  make('text', 'Single case result', '[[Single]]', 400, 150, 620);
  const conditional = make('button', 'Run automatic conditions', 'Automatic conditions', 40, 260);
  conditional.interactions = [
    interaction('Unmatched condition', [set('Conditional', 'wrong IF')], { conditions: [{ source: 'variable', key: 'Selected', operator: 'equals', value: 'never matches' }] }),
    interaction('Automatic fallback', [set('Conditional', 'fallback')], { isNewIfGroup: false }),
  ];
  make('text', 'Automatic conditional result', '[[Conditional]]', 400, 260, 620);
  const disabled = make('button', 'Run disabled condition guard', 'Disabled condition guard', 40, 370);
  disabled.interactions = [
    interaction('Disabled conditional case', [], { enabled: false, conditions: [{ source: 'variable', key: 'Selected', operator: 'isEmpty', value: '' }] }),
    interaction('First automatic independent IF', [set('DisabledCondition', 'one')]),
    interaction('Second automatic independent IF', [set('DisabledCondition', "[[concat(DisabledCondition, '|two')]]")]),
  ];
  make('text', 'Disabled condition result', '[[DisabledCondition]]', 400, 370, 620);
  return doc;
}

function alwaysFixture(): Document {
  const { doc, make } = base('Always case selection gates', 'always'); doc.variables = { Conditional: 'idle', Single: 'idle', Disabled: 'idle' };
  const gate = make('input', 'Selection gate input', 'closed', 40, 40);
  const run = make('button', 'Choose conditional event', 'Choose conditional event', 40, 130);
  const condition: Condition = { source: 'widgetText', key: gate.id, operator: 'equals', value: 'open' };
  run.interactions = [interaction('Open gate IF', [set('Conditional', 'open branch')], { conditions: [condition] }), interaction('Closed gate ELSE', [set('Conditional', 'closed branch')], { isNewIfGroup: false })];
  make('text', 'Always conditional result', '[[Conditional]]', 400, 130, 620);
  const single = make('button', 'Choose single case', 'Choose single case', 40, 240);
  single.interactions = [interaction('Single always choice', [set('Single', 'chosen')])];
  make('text', 'Always single result', '[[Single]]', 400, 240, 620);
  const empty = make('button', 'Choose empty case', 'Choose empty case', 40, 350);
  empty.interactions = [interaction('Single empty choice', [])];
  const disabled = make('button', 'Choose disabled cases', 'Choose disabled cases', 40, 460);
  disabled.interactions = [interaction('Disabled always choice', [set('Disabled', 'wrong disabled')], { enabled: false })];
  make('text', 'Always disabled result', '[[Disabled]]', 400, 460, 620);
  return doc;
}

function scopedFixture(): Document {
  const { doc, make } = base('Case selection ownership and lifecycle');
  doc.variables = { PageLoads: '', WidgetLoad: 'idle', Selected: 'idle' };
  doc.pages[0].interactions = [interaction('First page load', [set('PageLoads', 'first')], { event: 'load' }), interaction('Second page load', [set('PageLoads', "[[concat(PageLoads, '|second')]]")], { event: 'load' })];
  make('text', 'Page load result', '[[PageLoads]]', 40, 40, 400);
  const load = make('text', 'Widget load source', '[[WidgetLoad]]', 510, 40, 450);
  load.interactions = [interaction('Widget load one', [set('WidgetLoad', 'one')], { event: 'load' }), interaction('Widget load two', [set('WidgetLoad', 'two')], { event: 'load' })];
  const choose = make('button', 'Choose global case', 'Choose global case', 40, 120);
  choose.interactions = [interaction('Global first', [set('Selected', 'first')]), interaction('Global second', [set('Selected', 'second')])];
  make('text', 'Global choice result', '[[Selected]]', 510, 120, 450);
  const list = make('repeater', 'Case selection rows', '', 40, 240, 1010); list.height = 260;
  const rowName = createWidget('text', 8, 8); rowName.name = 'Selection row label'; rowName.text = 'Row [[Item.Name]]'; rowName.width = 190;
  const output = createWidget('text', 510, 8); output.name = 'Selection row result'; output.text = 'untouched'; output.width = 440;
  const rowButton = createWidget('button', 230, 8); rowButton.name = 'Choose row case'; rowButton.text = 'Choose row case'; rowButton.width = 230;
  rowButton.interactions = [interaction('Row click one', [text(output.id, 'click one [[Item.Name]]')]), interaction('Row click two', [text(output.id, 'click two [[Item.Name]]')])];
  list.repeater = { columns: ['Name'], rows: [{ Name: 'Alpha' }, { Name: 'Beta' }], template: [rowName, rowButton, output], itemHeight: 75, gap: 15 };
  list.interactions = [interaction('Item load one', [text(output.id, 'load one [[Item.Name]]')], { event: 'itemLoad' }), interaction('Item load two', [text(output.id, 'load two [[Item.Name]]')], { event: 'itemLoad' })];
  const destination = createPage('Selection destination');
  const result = createWidget('text', 40, 40); result.name = 'Destination selection result'; result.text = '[[Selected]]'; result.width = 600;
  destination.widgets = [result]; doc.pages.push(destination);
  return doc;
}

async function menu(page: Page, name: string, action: string) {
  await page.locator('.menubar').getByRole('button', { name, exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}
async function importFixture(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'File', 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'case-selection.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function withRuntime(mode: Mode, page: Page, browser: Browser, testInfo: TestInfo, doc: Document, exercise: (runtimePage: Page, scope: Scope) => Promise<void>) {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await importFixture(page, doc);
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page, page.locator('.preview-overlay'));
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const html = testInfo.outputPath(`${doc.name.replace(/\W/g, '-')}.html`); await (await download).saveAs(html);
    const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
    try {
      const exported = await context.newPage(), requests: string[] = [];
      exported.on('pageerror', error => errors.push(error.message));
      exported.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      await exported.goto(pathToFileURL(html).href); await exercise(exported, exported);
      expect(requests).toEqual([]);
    } finally { await context.close(); }
  }
  expect(errors).toEqual([]);
}

for (const mode of ['preview', 'offline'] as const) {
  test(`${mode}: automatic menus pause dispatch, select one case and cancel without changing automatic or legacy rules`, async ({ page, browser }, testInfo) => {
    await withRuntime(mode, page, browser, testInfo, automaticFixture(), async (runtimePage, scope) => {
      await widget(scope, 'Choose an automatic case').click(); await expect(menus(scope)).toHaveCount(1);
      await expect(widget(scope, 'Selected case result')).toHaveText('idle');
      await expect(menus(scope).getByRole('menuitem')).toHaveText(['Choose first', 'Choose second', 'Empty choice']);
      await runtimePage.screenshot({ path: `artifacts/case-selection-${mode}-menu.png`, fullPage: true });
      await menus(scope).getByRole('menuitem', { name: 'Choose second', exact: true }).click();
      await expect(menus(scope)).toHaveCount(0); await expect(widget(scope, 'Selected case result')).toHaveText('second');
      await widget(scope, 'Choose an automatic case').click();
      await menus(scope).getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(menus(scope)).toHaveCount(0); await expect(widget(scope, 'Selected case result')).toHaveText('second');
      await widget(scope, 'Choose an automatic case').click(); await runtimePage.keyboard.press('Escape');
      await expect(menus(scope)).toHaveCount(0); await expect(widget(scope, 'Selected case result')).toHaveText('second');
      await widget(scope, 'Choose an automatic case').click(); await menus(scope).getByRole('menuitem', { name: 'Empty choice', exact: true }).click();
      await expect(menus(scope)).toHaveCount(0); await expect(widget(scope, 'Selected case result')).toHaveText('second');
      await widget(scope, 'Run single automatic case').click(); await expect(widget(scope, 'Single case result')).toHaveText('ran');
      await widget(scope, 'Run automatic conditions').click(); await expect(widget(scope, 'Automatic conditional result')).toHaveText('fallback');
      await widget(scope, 'Run disabled condition guard').click(); await expect(widget(scope, 'Disabled condition result')).toHaveText('one|two');
      await expect(menus(scope)).toHaveCount(0);
    });
    for (const policy of ['never', 'legacy'] as const) await withRuntime(mode, page, browser, testInfo, automaticFixture(policy), async (_runtimePage, scope) => {
      await widget(scope, 'Choose an automatic case').click(); await expect(widget(scope, 'Selected case result')).toHaveText('second');
      await expect(menus(scope)).toHaveCount(0);
    });
  });

  test(`${mode}: Always offers Run event for conditions and evaluates them when chosen`, async ({ page, browser }, testInfo) => {
    await withRuntime(mode, page, browser, testInfo, alwaysFixture(), async (_runtimePage, scope) => {
      await widget(scope, 'Choose conditional event').click();
      await expect(menus(scope).getByRole('menuitem')).toHaveText(['Run event']);
      await expect(widget(scope, 'Always conditional result')).toHaveText('idle');
      await scope.getByRole('textbox', { name: 'Selection gate input', exact: true }).fill('open');
      // Editing outside the menu neither cancels it nor freezes the previous condition value.
      await expect(menus(scope)).toHaveCount(1);
      await menus(scope).getByRole('menuitem', { name: 'Run event', exact: true }).click();
      await expect(widget(scope, 'Always conditional result')).toHaveText('open branch');
      await widget(scope, 'Choose conditional event').click();
      await scope.getByRole('textbox', { name: 'Selection gate input', exact: true }).fill('closed');
      await menus(scope).getByRole('menuitem', { name: 'Run event', exact: true }).click();
      await expect(widget(scope, 'Always conditional result')).toHaveText('closed branch');
      await widget(scope, 'Choose single case').click(); await expect(widget(scope, 'Always single result')).toHaveText('idle');
      await menus(scope).getByRole('menuitem', { name: 'Single always choice', exact: true }).click();
      await expect(widget(scope, 'Always single result')).toHaveText('chosen');
      await widget(scope, 'Choose empty case').click(); await expect(menus(scope).getByRole('menuitem')).toHaveText(['Single empty choice']);
      await menus(scope).getByRole('menuitem', { name: 'Single empty choice', exact: true }).click(); await expect(menus(scope)).toHaveCount(0);
      await widget(scope, 'Choose disabled cases').click(); await expect(menus(scope)).toHaveCount(1);
      await expect(menus(scope).getByRole('menuitem')).toHaveCount(0); await expect(widget(scope, 'Always disabled result')).toHaveText('idle');
      await menus(scope).getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(menus(scope)).toHaveCount(0); await expect(widget(scope, 'Always disabled result')).toHaveText('idle');
    });
  });

  test(`${mode}: lifecycle and row menus retain independent owners and navigation discards stale choices`, async ({ page, browser }, testInfo) => {
    await withRuntime(mode, page, browser, testInfo, scopedFixture(), async (_runtimePage, scope) => {
      await expect(widget(scope, 'Page load result')).toHaveText('first|second');
      await expect(widget(scope, 'Widget load source')).toHaveText('idle');
      await expect(menus(scope)).toHaveCount(3); // Widget Loaded plus one ItemLoaded menu per row; Page Loaded bypasses menus.
      const rows = widget(scope, 'Case selection rows').locator(':scope > .repeater-row');
      const row = (name: string) => rows.filter({ hasText: `Row ${name}` });
      const result = (name: string) => widget(row(name), 'Selection row result');
      await expect(result('Alpha')).toHaveText('untouched'); await expect(result('Beta')).toHaveText('untouched');
      // Loaded menus share the fallback anchor. Operate the visible topmost row menu first.
      await menus(scope).filter({ hasText: 'Item load one' }).nth(1).getByRole('menuitem', { name: 'Item load two', exact: true }).click();
      await expect(result('Beta')).toHaveText('load two Beta'); await expect(result('Alpha')).toHaveText('untouched');
      await menus(scope).filter({ hasText: 'Item load one' }).getByRole('button', { name: 'Cancel', exact: true }).click();
      await menus(scope).filter({ hasText: 'Widget load one' }).getByRole('button', { name: 'Cancel', exact: true }).click();
      await widget(row('Alpha'), 'Choose row case').click();
      await menus(scope).getByRole('menuitem', { name: 'Row click two', exact: true }).click();
      await expect(result('Alpha')).toHaveText('click two Alpha'); await expect(result('Beta')).toHaveText('load two Beta');
      await widget(row('Alpha'), 'Choose row case').click(); await widget(row('Beta'), 'Choose row case').click({ position: { x: 5, y: 5 } });
      await widget(scope, 'Choose global case').click(); await expect(menus(scope)).toHaveCount(3);
      await menus(scope).filter({ hasText: 'Global first' }).getByRole('menuitem', { name: 'Global first', exact: true }).click();
      await expect(widget(scope, 'Global choice result')).toHaveText('first'); await expect(menus(scope)).toHaveCount(2);
      await menus(scope).last().getByRole('button', { name: 'Cancel', exact: true }).click();
      await menus(scope).getByRole('button', { name: 'Cancel', exact: true }).click();
      // The first click anchors its menu over the source center; its top-left corner remains visible.
      await widget(scope, 'Choose global case').click(); await widget(scope, 'Choose global case').click({ position: { x: 5, y: 5 } });
      await expect(menus(scope)).toHaveCount(1); // Re-triggering the same owner replaces its previous selection.
      await widget(row('Beta'), 'Choose row case').click(); await expect(menus(scope)).toHaveCount(2);
      await scope.getByRole('button', { name: 'Selection destination', exact: true }).click();
      await expect(menus(scope)).toHaveCount(0); await expect(widget(scope, 'Destination selection result')).toHaveText('first');
      await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    });
  });
}

test('Project case selection setting defaults to Auto, commits once, undoes and survives save/reopen', async ({ page }, testInfo) => {
  page.on('dialog', dialog => dialog.accept()); await page.goto('/');
  const openSettings = async () => { await menu(page, 'Project', 'Prototype settings…'); return page.getByRole('dialog', { name: 'Prototype settings', exact: true }); };
  const save = async (name: string) => {
    const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
    const path = testInfo.outputPath(name); await (await download).saveAs(path); return { path, doc: JSON.parse(await readFile(path, 'utf8')) as Document };
  };
  let settings = await openSettings(); await expect(settings.getByLabel('Case selection', { exact: true })).toHaveValue('auto');
  await page.screenshot({ path: 'artifacts/case-selection-settings.png', fullPage: true });
  await settings.getByLabel('Case selection', { exact: true }).selectOption('always'); await settings.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  settings = await openSettings(); await expect(settings.getByLabel('Case selection', { exact: true })).toHaveValue('auto');
  await settings.getByLabel('Case selection', { exact: true }).selectOption('always'); await settings.getByRole('button', { name: 'Apply', exact: true }).click();
  expect((await save('selection-always.rea.json')).doc.caseSelection).toBe('always');
  await page.getByTitle('Undo', { exact: true }).click(); expect((await save('selection-undone.rea.json')).doc.caseSelection).toBe('auto');
  await expect(page.getByTitle('Undo', { exact: true })).toBeDisabled();
  await page.getByTitle('Redo', { exact: true }).click(); expect((await save('selection-redone.rea.json')).doc.caseSelection).toBe('always');
  settings = await openSettings(); await settings.getByLabel('Case selection', { exact: true }).selectOption('never');
  await settings.getByRole('button', { name: 'Apply', exact: true }).click(); const saved = await save('selection-never.rea.json');
  expect(saved.doc.caseSelection).toBe('never');
  await menu(page, 'File', 'New Ctrl+N');
  settings = await openSettings(); await expect(settings.getByLabel('Case selection', { exact: true })).toHaveValue('auto');
  await settings.getByRole('button', { name: 'Cancel', exact: true }).click();
  const chooser = page.waitForEvent('filechooser'); await menu(page, 'File', 'Open… Ctrl+O'); await (await chooser).setFiles(saved.path);
  settings = await openSettings(); await expect(settings.getByLabel('Case selection', { exact: true })).toHaveValue('never');
  await settings.getByRole('button', { name: 'Cancel', exact: true }).click(); expect((await save('selection-restored.rea.json')).doc).toEqual(saved.doc);
  await importFixture(page, automaticFixture('legacy'));
  settings = await openSettings(); await expect(settings.getByLabel('Case selection', { exact: true })).toHaveValue('never');
  await settings.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await save('selection-legacy-unchanged.rea.json')).doc).not.toHaveProperty('caseSelection');

  // The same unconditional ELSE is selectable in Auto, but shadowed by its IF in Never.
  const authored = automaticFixture(); authored.pages[0].widgets[0].interactions[1].isNewIfGroup = false;
  await importFixture(page, authored);
  await page.locator('.editor-widget.button').filter({ hasText: 'Choose an automatic case' }).click();
  const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click();
  const branch = inspector.getByRole('region', { name: 'Choose second case', exact: true });
  const choiceHelp = branch.getByText('No conditions: available as a menu choice when enabled.', { exact: true });
  await expect(choiceHelp).toBeVisible(); await expect(branch.locator('.inspector-branch-warning')).toHaveCount(0);
  settings = await openSettings(); await settings.getByLabel('Case selection', { exact: true }).selectOption('never');
  await settings.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(choiceHelp).toHaveCount(0);
  await expect(branch.locator('.inspector-branch-warning')).toHaveText('An earlier enabled branch has no conditions. This branch will not run until that branch gains a condition or is disabled.');
  await expect(branch.getByText('No conditions: runs only when no earlier branch in this group matches.', { exact: true })).toBeVisible();
  settings = await openSettings(); await settings.getByLabel('Case selection', { exact: true }).selectOption('auto');
  await settings.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(choiceHelp).toBeVisible(); await expect(branch.locator('.inspector-branch-warning')).toHaveCount(0);
});
