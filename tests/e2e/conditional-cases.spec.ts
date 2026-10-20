import { expect, test, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, uid } from '../../src/model/document';
import type { Action, Condition, Document, EventType, Interaction, WidgetType } from '../../src/model/types';

type Scope = Page | Locator;
type Mode = 'preview' | 'offline';
type ActionSpec = Omit<Action, 'id'>;
type ConditionalCase = Interaction & { isNewIfGroup?: boolean };
const WAIT = 1000;
const CLOCK_START = new Date('2026-10-13T12:00:00Z');
const CLOCK_PAUSE = new Date('2026-10-13T13:00:00Z');

function branch(name: string, actions: ActionSpec[], isNewIfGroup?: boolean, conditions: Condition[] = [], event: EventType = 'click', enabled = true): ConditionalCase {
  return { id: uid(), name, event, enabled, conditions, conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })), ...(isNewIfGroup === undefined ? {} : { isNewIfGroup }) };
}
const setVariable = (targetId: string, value: string): ActionSpec => ({ type: 'setVariable', targetId, value });
const setText = (targetId: string, value: string): ActionSpec => ({ type: 'setText', targetId, value });
const find = (scope: Scope, name: string) => scope.locator(`.widget[aria-label="${name}"]`);

function fixture(name: string) {
  const doc = createDocument(); doc.name = name; doc.caseSelection = 'never'; doc.pages[0].width = 1120; doc.pages[0].height = 900;
  const make = (type: WidgetType, name: string, text: string, x: number, y: number, width = 260) => {
    const widget = createWidget(type, x, y); widget.name = name; widget.text = text; widget.width = width;
    doc.pages[0].widgets.push(widget); return widget;
  };
  return { doc, make };
}

function matrixFixture(): Document {
  const { doc, make } = fixture('Conditional dispatch matrix');
  doc.variables = { Boundary: '', Legacy: '' };
  const mode = make('input', 'Choice input', 'alpha', 40, 40);
  const output = make('text', 'Choice result', 'untouched', 390, 40, 640);
  const choose = make('button', 'Dispatch choice', 'Dispatch choice', 40, 110);
  const when = (value: string): Condition[] => [{ source: 'widgetText', key: mode.id, operator: 'equals', value }];
  choose.interactions = [
    branch('Alpha IF', [setText(output.id, 'alpha')], true, when('alpha')),
    branch('Beta ELSE IF', [setText(output.id, 'beta')], false, when('beta')),
    branch('Fallback ELSE', [setText(output.id, 'fallback')], false),
  ];
  const boundary = make('button', 'Dispatch disabled boundaries', 'Disabled boundaries', 40, 210);
  boundary.interactions = [
    branch('Disabled first IF', [setVariable('Boundary', 'wrong first')], true, [], 'click', false),
    branch('Enabled fallback', [setVariable('Boundary', 'fallback')], false),
    branch('Disabled new IF', [setVariable('Boundary', 'wrong new group')], true, [], 'click', false),
    branch('Fallback of new group', [setVariable('Boundary', "[[concat(Boundary, '|after-disabled-IF')]]")], false),
  ];
  make('text', 'Disabled boundary result', '[[Boundary]]', 390, 210, 640);
  const emptyOutput = make('text', 'Empty branch result', 'untouched', 390, 310, 640);
  const empty = make('button', 'Dispatch empty match', 'Empty match', 40, 310);
  empty.interactions = [branch('Matched empty IF', [], true), branch('Skipped ELSE', [setText(emptyOutput.id, 'wrong fallthrough')], false)];
  const legacy = make('button', 'Dispatch legacy cases', 'Legacy independent cases', 40, 410);
  legacy.interactions = [branch('Legacy one', [setVariable('Legacy', 'one')]), branch('Legacy two', [setVariable('Legacy', "[[concat(Legacy, '|two')]]")])];
  make('text', 'Legacy case result', '[[Legacy]]', 390, 410, 640);
  const interleavedOutput = make('text', 'Interleaved event result', 'untouched', 390, 510, 640);
  const interleaved = make('button', 'Dispatch interleaved events', 'Interleaved events', 40, 510);
  interleaved.interactions = [
    branch('First click IF', [setText(interleavedOutput.id, 'first click')], true),
    branch('Other event IF', [setText(interleavedOutput.id, 'wrong other event')], true, [], 'change'),
    branch('Click ELSE after other event', [setText(interleavedOutput.id, 'wrong reset')], false),
  ];
  return doc;
}

function waitFixture(): Document {
  const { doc, make } = fixture('Conditional Wait dispatch'); doc.variables = { Trace: '', Prefix: 'idle', Other: 'idle' };
  const slow = make('button', 'Start conditional wait', 'Start conditional wait', 40, 40);
  slow.interactions = [
    branch('Matched waiting IF', [setVariable('Prefix', 'started'), setVariable('Trace', 'IF|'), { type: 'wait', duration: WAIT }, setVariable('Trace', "[[concat(Trace, 'R:', Other, '|')]]")], true),
    branch('Unrelated change IF', [setVariable('Trace', 'wrong change')], true, [], 'change'),
    branch('Suppressed waiting ELSE', [setVariable('Trace', 'wrong ELSE')], false),
    branch('Independent IF sees prefix', [setVariable('Trace', "[[concat(Trace, 'next|')]]")], true, [{ source: 'variable', key: 'Prefix', operator: 'equals', value: 'started' }]),
  ];
  const other = make('button', 'Commit unrelated event', 'Commit unrelated event', 350, 40);
  other.interactions = [branch('Other click', [setVariable('Other', 'committed')], true)];
  make('text', 'Conditional wait trace', '[[Trace]]', 40, 120, 980);
  make('text', 'Unrelated event result', '[[Other]]', 40, 180, 980);
  return doc;
}

async function menu(page: Page, action: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}
async function importFixture(page: Page, doc: Document) {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'conditional-cases.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page: Page, path: string): Promise<Document> {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  await (await download).saveAs(path); return JSON.parse(await readFile(path, 'utf8')) as Document;
}
async function offline(page: Page, browser: Browser, testInfo: TestInfo, exercise: (runtimePage: Page) => Promise<void>, clock = false) {
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  const html = testInfo.outputPath('conditional-cases.html'); await (await download).saveAs(html);
  const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
  try {
    const exported = await context.newPage(), errors: string[] = [], requests: string[] = [];
    exported.on('pageerror', error => errors.push(error.message));
    exported.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    if (clock) { await exported.clock.install({ time: CLOCK_START }); await exported.clock.pauseAt(CLOCK_PAUSE); }
    await exported.goto(pathToFileURL(html).href); if (clock) await exported.clock.runFor(32);
    await exercise(exported);
    await exported.screenshot({ path: testInfo.outputPath('conditional-offline.png'), fullPage: true });
    expect(errors).toEqual([]); expect(requests).toEqual([]);
  } finally { await context.close(); }
}
async function withRuntime(mode: Mode, page: Page, browser: Browser, testInfo: TestInfo, doc: Document, exercise: (runtimePage: Page, scope: Scope) => Promise<void>, clock = false) {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  if (mode === 'preview' && clock) await page.clock.install({ time: CLOCK_START });
  await importFixture(page, doc);
  if (mode === 'offline') await offline(page, browser, testInfo, exported => exercise(exported, exported), clock);
  else {
    if (clock) await page.clock.pauseAt(CLOCK_PAUSE);
    await page.getByTitle('Preview (F5)', { exact: true }).click(); if (clock) await page.clock.runFor(32);
    await exercise(page, page.locator('.preview-overlay'));
    await page.screenshot({ path: testInfo.outputPath('conditional-preview.png'), fullPage: true });
  }
  expect(errors).toEqual([]);
}

for (const mode of ['preview', 'offline'] as const) {
  test(`${mode}: conditional chains stop at the first enabled match while legacy cases stay independent`, async ({ page, browser }, testInfo) => {
    await withRuntime(mode, page, browser, testInfo, matrixFixture(), async (_runtimePage, scope) => {
      for (const [input, expected] of [['alpha', 'alpha'], ['beta', 'beta'], ['neither', 'fallback']]) {
        await scope.getByRole('textbox', { name: 'Choice input', exact: true }).fill(input);
        await find(scope, 'Dispatch choice').click(); await expect(find(scope, 'Choice result')).toHaveText(expected);
      }
      await find(scope, 'Dispatch disabled boundaries').click();
      await expect(find(scope, 'Disabled boundary result')).toHaveText('fallback|after-disabled-IF');
      await find(scope, 'Dispatch empty match').click(); await expect(find(scope, 'Empty branch result')).toHaveText('untouched');
      await find(scope, 'Dispatch legacy cases').click(); await expect(find(scope, 'Legacy case result')).toHaveText('one|two');
      await find(scope, 'Dispatch interleaved events').click(); await expect(find(scope, 'Interleaved event result')).toHaveText('first click');
      await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    });
  });

  test(`${mode}: matched Wait suppresses ELSE while the next IF sees its prefix and another event runs`, async ({ page, browser }, testInfo) => {
    await withRuntime(mode, page, browser, testInfo, waitFixture(), async (runtimePage, scope) => {
      await find(scope, 'Start conditional wait').click(); await runtimePage.clock.runFor(32);
      await expect(find(scope, 'Conditional wait trace')).toHaveText('IF|next|');
      await find(scope, 'Commit unrelated event').click(); await runtimePage.clock.runFor(32);
      await expect(find(scope, 'Unrelated event result')).toHaveText('committed');
      await expect(find(scope, 'Conditional wait trace')).toHaveText('IF|next|');
      await runtimePage.clock.runFor(WAIT + 50); await runtimePage.clock.runFor(32);
      await expect(find(scope, 'Conditional wait trace')).toHaveText('IF|next|R:committed|');
      await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    }, true);
  });
}

test('Inspector authors, reorders and repairs conditional chains that survive save/reopen and both players', async ({ page, browser }, testInfo) => {
  const { doc, make } = fixture('Authored conditional groups');
  const input = make('input', 'Authored choice input', 'alpha', 40, 40);
  const trigger = make('button', 'Authored dispatch', 'Dispatch authored cases', 40, 120);
  const result = make('text', 'Authored choice result', 'untouched', 390, 40, 640);
  const observer = make('text', 'Authored observer result', 'untouched', 390, 120, 640);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await importFixture(page, doc);
  await page.locator('.editor-widget.button').filter({ hasText: 'Dispatch authored cases' }).click();
  const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click();
  const card = (name: string) => inspector.getByRole('region', { name: `${name} case`, exact: true });
  const event = inspector.getByRole('region', { name: 'Click or tap event cases', exact: true });
  const renameLast = async (name: string) => { await inspector.getByLabel('Case name', { exact: true }).last().fill(name); return card(name); };
  const condition = async (target: Locator, value: string) => {
    await target.getByRole('button', { name: 'Add condition', exact: true }).click();
    await target.getByLabel('Condition source', { exact: true }).selectOption('widgetText');
    await target.getByLabel('Condition target', { exact: true }).selectOption(input.id);
    await target.getByLabel('Condition comparison', { exact: true }).selectOption('equals');
    await target.getByLabel('Condition value', { exact: true }).fill(value);
  };
  const action = async (target: Locator, targetId: string, value: string) => {
    await target.getByRole('button', { name: 'Add action', exact: true }).click();
    await target.getByLabel('Action 1 type', { exact: true }).selectOption('setText');
    await target.getByLabel('Action 1 target', { exact: true }).selectOption(targetId);
    await target.getByLabel('Action value', { exact: true }).fill(value);
  };
  await inspector.getByRole('button', { name: 'New interaction', exact: true }).click();
  let current = await renameLast('Primary authored'); await condition(current, 'alpha'); await action(current, result.id, 'alpha');
  await event.getByRole('button', { name: 'Add branch', exact: true }).click();
  current = await renameLast('Secondary authored'); await condition(current, 'beta'); await action(current, result.id, 'beta');
  await event.getByRole('button', { name: 'Add branch', exact: true }).click();
  current = await renameLast('Fallback authored'); await action(current, result.id, 'fallback');
  await expect(card('Primary authored').getByLabel('Case branch type', { exact: true })).toHaveValue('if');
  await expect(card('Secondary authored').getByLabel('Case branch type', { exact: true })).toHaveValue('else');
  await expect(card('Fallback authored').locator('.inspector-branch-label')).toHaveText('ELSE');

  // Moving content preserves the IF/ELSE boundary slots rather than moving the boundary with it.
  await card('Secondary authored').getByRole('button', { name: 'Move case up', exact: true }).click();
  await expect(card('Secondary authored').getByLabel('Case branch type', { exact: true })).toHaveValue('if');
  await expect(card('Primary authored').getByLabel('Case branch type', { exact: true })).toHaveValue('else');
  await card('Secondary authored').getByRole('button', { name: 'Move case down', exact: true }).click();
  await card('Primary authored').getByLabel('Interaction event', { exact: true }).selectOption('doubleClick');
  await expect(card('Secondary authored').getByLabel('Case branch type', { exact: true })).toHaveValue('if');
  await card('Primary authored').getByLabel('Interaction event', { exact: true }).selectOption('click');
  await card('Secondary authored').getByLabel('Case branch type', { exact: true }).selectOption('else');
  await card('Secondary authored').getByRole('button', { name: 'Duplicate interaction', exact: true }).click();
  await card('Secondary authored copy').getByLabel('Action value', { exact: true }).fill('wrong duplicate');
  await card('Secondary authored copy').getByLabel('Enable Secondary authored copy', { exact: true }).uncheck();
  await expect(card('Secondary authored copy').getByLabel('Case branch type', { exact: true })).toHaveValue('else');
  await inspector.getByRole('button', { name: 'New interaction', exact: true }).click();
  current = await renameLast('Default appended branch');
  await expect(current.getByLabel('Case branch type', { exact: true })).toHaveValue('else');
  await current.getByRole('button', { name: 'Delete interaction', exact: true }).click();
  await event.getByRole('button', { name: 'New IF', exact: true }).click();
  await renameLast('Observer group head');
  await event.getByRole('group', { name: 'Click or tap IF group 2', exact: true }).getByRole('button', { name: 'Add branch', exact: true }).click();
  current = await renameLast('Promoted observer'); await action(current, observer.id, `observed [[Widget.${result.id}.text]]`);
  await card('Observer group head').getByRole('button', { name: 'Delete interaction', exact: true }).click();
  await expect(card('Promoted observer').getByLabel('Case branch type', { exact: true })).toHaveValue('if');

  const savedPath = testInfo.outputPath('authored-conditional.rea.json');
  const saved = await save(page, savedPath);
  const cases = saved.pages[0].widgets.find(widget => widget.id === trigger.id)!.interactions as ConditionalCase[];
  expect(cases.map(item => item.name)).toEqual(['Primary authored', 'Secondary authored', 'Secondary authored copy', 'Fallback authored', 'Promoted observer']);
  expect(cases.map(item => item.isNewIfGroup)).toEqual([true, false, false, false, true]);
  expect(cases[2].enabled).toBe(false); expect(cases[2].conditions).toEqual(cases[1].conditions);
  const ids = cases.flatMap(item => [item.id, ...item.actions.map(action => action.id)]); expect(new Set(ids).size).toBe(ids.length);
  await menu(page, 'New Ctrl+N');
  const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O'); await (await chooser).setFiles(savedPath);
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  expect(await save(page, testInfo.outputPath('authored-conditional-restored.rea.json'))).toEqual(saved);
  await page.locator('.editor-widget.button').filter({ hasText: 'Dispatch authored cases' }).click();
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click();
  await expect(card('Secondary authored').getByLabel('Case branch type', { exact: true })).toHaveValue('else');
  await expect(card('Secondary authored copy').getByLabel('Enable Secondary authored copy', { exact: true })).not.toBeChecked();
  await expect(card('Promoted observer').getByLabel('Case branch type', { exact: true })).toHaveValue('if');
  await page.screenshot({ path: 'artifacts/conditional-case-editor.png', fullPage: true });
  const exercise = async (scope: Scope) => {
    for (const [value, expected] of [['alpha', 'alpha'], ['beta', 'beta'], ['other', 'fallback']]) {
      await scope.getByRole('textbox', { name: 'Authored choice input', exact: true }).fill(value);
      await find(scope, 'Authored dispatch').click();
      await expect(find(scope, 'Authored choice result')).toHaveText(expected);
      await expect(find(scope, 'Authored observer result')).toHaveText(`observed ${expected}`);
    }
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay');
  await exercise(preview); await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  await offline(page, browser, testInfo, exported => exercise(exported));
  expect(errors).toEqual([]);
});
