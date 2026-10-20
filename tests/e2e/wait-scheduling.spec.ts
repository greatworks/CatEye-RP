import { expect, test, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { createDocument, createPage, createWidget, uid } from '../../src/model/document';
import type { Action, Document, EventType, Interaction, Widget, WidgetType } from '../../src/model/types';

// Virtual time controls only the browser clock. Import, export and every runtime action use the UI.
const CLOCK_START = new Date('2026-10-13T12:00:00Z');
const CLOCK_PAUSE = new Date('2026-10-13T13:00:00Z');
const WAIT = 1000;
type Scope = Page | Locator;
type Mode = 'preview' | 'offline';
type ActionSpec = Omit<Action, 'id'>;

function interaction(actions: ActionSpec[], event: EventType = 'click', name = 'Wait fixture'): Interaction {
  return { id: uid(), name, event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) };
}

function widget(type: WidgetType, name: string, text: string, x: number, y: number, width = 260): Widget {
  const result = createWidget(type, x, y); result.name = name; result.text = text; result.width = width;
  return result;
}

function variable(targetId: string, value: string): ActionSpec { return { type: 'setVariable', targetId, value }; }
function wait(duration = WAIT): ActionSpec { return { type: 'wait', duration }; }

function eventFixture(): Document {
  const doc = createDocument(); doc.name = 'Wait event scheduling'; doc.caseSelection = 'never';
  doc.variables = { Slow: 'idle', Fast: 'idle', FirstCase: 'idle', SecondCase: 'idle', ErrorPrefix: 'idle' };
  const page = doc.pages[0]; page.width = 1080; page.height = 800;
  const slow = widget('button', 'Start slow event', 'Start slow event', 40, 40);
  slow.interactions = [interaction([variable('Slow', 'pending'), wait(), variable('Slow', 'resumed:[[Fast]]')])];
  const fast = widget('button', 'Commit fast event', 'Commit fast event', 340, 40);
  fast.interactions = [interaction([variable('Fast', 'committed')])];
  const cases = widget('button', 'Run independent cases', 'Run independent cases', 40, 170);
  cases.interactions = [
    interaction([variable('FirstCase', 'pending'), wait(), variable('FirstCase', 'resumed:[[SecondCase]]')], 'click', 'First waiting case'),
    interaction([variable('SecondCase', 'committed')], 'click', 'Second immediate case'),
  ];
  const fail = widget('button', 'Start delayed error', 'Start delayed error', 40, 330);
  fail.interactions = [interaction([variable('ErrorPrefix', 'started'), wait(), variable('ErrorPrefix', '[[1 / 0]]')])];
  page.widgets = [slow, fast, cases, fail,
    widget('text', 'Slow event status', '[[Slow]]', 40, 105, 450),
    widget('text', 'Fast event status', '[[Fast]]', 540, 105, 450),
    widget('text', 'First case status', '[[FirstCase]]', 40, 240, 450),
    widget('text', 'Second case status', '[[SecondCase]]', 540, 240, 450),
    widget('text', 'Delayed error prefix', '[[ErrorPrefix]]', 40, 400, 450),
  ];
  return doc;
}

function rowFixture(): Document {
  const doc = createDocument(); doc.name = 'Wait row load scheduling'; doc.variables = { Trace: '' };
  const page = doc.pages[0]; page.width = 1080; page.height = 700;
  const list = widget('repeater', 'Waiting load list', '', 40, 40, 970); list.height = 300;
  const label = widget('text', 'Waiting row label', 'Row [[Item.Name]]', 8, 8, 260);
  label.interactions = [interaction([variable('Trace', "[[concat(Trace, 'L:', Item.Name, '|')]]")], 'load')];
  const phase = widget('text', 'Waiting row phase', 'unloaded', 300, 8, 400);
  list.repeater = { columns: ['Name'], rows: ['Alpha', 'Beta', 'Gamma'].map(Name => ({ Name })), template: [label, phase], itemHeight: 70, gap: 10 };
  list.interactions = [interaction([
    variable('Trace', "[[concat(Trace, 'I:', Item.Name, '|')]]"),
    { type: 'setText', targetId: phase.id, value: 'pending [[Item.Name]]' }, wait(),
    variable('Trace', "[[concat(Trace, 'D:', Item.Name, '|')]]"),
    { type: 'setText', targetId: phase.id, value: 'done [[Item.Name]]' },
  ], 'itemLoad')];
  const trace = widget('text', 'Row load trace', '[[Trace]]', 40, 390, 970); trace.height = 100;
  page.widgets = [list, trace];
  return doc;
}

function cancellationFixture(): Document {
  const doc = createDocument(); doc.name = 'Wait continuation cancellation'; doc.variables = { Status: 'clean', Prefix: 'idle' };
  const page = doc.pages[0]; page.name = 'Origin';
  const destination = createPage('Destination'); doc.pages.push(destination);
  const start = widget('button', 'Start cancellable wait', 'Start cancellable wait', 40, 40);
  start.interactions = [interaction([variable('Prefix', 'armed'), wait(), variable('Status', 'stale continuation')])];
  const leave = widget('button', 'Leave waiting page', 'Leave waiting page', 340, 40);
  leave.interactions = [interaction([{ type: 'openPage', targetId: destination.id }])];
  page.widgets = [start, leave,
    widget('text', 'Cancellation status', '[[Status]]', 40, 120, 600),
    widget('text', 'Cancellation prefix', '[[Prefix]]', 40, 180, 600),
  ];
  destination.widgets = [
    widget('text', 'Destination status', '[[Status]]', 40, 40, 600),
    widget('text', 'Destination prefix', '[[Prefix]]', 40, 100, 600),
  ];
  return doc;
}

async function importFixture(page: Page, doc: Document) {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'wait-scheduling.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}

const find = (scope: Scope, name: string) => scope.locator(`.widget[aria-label="${name}"]`);
async function paint(page: Page) { await page.clock.runFor(32); }
async function click(page: Page, scope: Scope, name: string) { await find(scope, name).click(); await paint(page); }
async function advancePastWait(page: Page) { await page.clock.runFor(WAIT + 50); await paint(page); }

async function withRuntime(mode: Mode, page: Page, browser: Browser, testInfo: TestInfo, doc: Document,
  exercise: (runtimePage: Page, scope: Scope) => Promise<void>) {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  if (mode === 'preview') await page.clock.install({ time: CLOCK_START });
  await importFixture(page, doc);
  if (mode === 'preview') {
    await page.clock.pauseAt(CLOCK_PAUSE);
    await page.getByTitle('Preview (F5)', { exact: true }).click();
    await paint(page);
    await exercise(page, page.locator('.preview-overlay'));
    await page.screenshot({ path: testInfo.outputPath('wait-preview.png'), fullPage: true });
  } else {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const html = testInfo.outputPath('wait-offline.html'); await (await download).saveAs(html);
    const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
    try {
      const exported = await context.newPage();
      const requests: string[] = [];
      exported.on('pageerror', error => errors.push(error.message));
      exported.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      await exported.clock.install({ time: CLOCK_START });
      await exported.clock.pauseAt(CLOCK_PAUSE);
      await exported.goto(pathToFileURL(html).href);
      await paint(exported);
      await exercise(exported, exported);
      await exported.screenshot({ path: testInfo.outputPath('wait-offline.png'), fullPage: true });
      expect(requests).toEqual([]);
    } finally { await context.close(); }
  }
  expect(errors).toEqual([]);
}

for (const mode of ['preview', 'offline'] as const) {
  test(`${mode}: Wait releases another button and resumes against its committed state`, async ({ page, browser }, testInfo) => {
    await withRuntime(mode, page, browser, testInfo, eventFixture(), async (runtimePage, scope) => {
      await click(runtimePage, scope, 'Start slow event');
      await expect(find(scope, 'Slow event status')).toHaveText('pending');
      await click(runtimePage, scope, 'Commit fast event');
      // The clock has advanced less than WAIT: an assertion after the timer would miss queue blocking.
      await expect(find(scope, 'Fast event status')).toHaveText('committed');
      await expect(find(scope, 'Slow event status')).toHaveText('pending');
      await advancePastWait(runtimePage);
      await expect(find(scope, 'Slow event status')).toHaveText('resumed:committed');
      await expect(find(scope, 'Fast event status')).toHaveText('committed');
    });
  });

  test(`${mode}: a waiting case does not block the next case of the same event`, async ({ page, browser }, testInfo) => {
    await withRuntime(mode, page, browser, testInfo, eventFixture(), async (runtimePage, scope) => {
      await click(runtimePage, scope, 'Run independent cases');
      await expect(find(scope, 'Second case status')).toHaveText('committed');
      await expect(find(scope, 'First case status')).toHaveText('pending');
      await advancePastWait(runtimePage);
      await expect(find(scope, 'First case status')).toHaveText('resumed:committed');
    });
  });

  test(`${mode}: ItemLoaded waits release child Loaded and the following rows`, async ({ page, browser }, testInfo) => {
    await withRuntime(mode, page, browser, testInfo, rowFixture(), async (runtimePage, scope) => {
      const names = ['Alpha', 'Beta', 'Gamma'];
      const prefix = names.map(name => `I:${name}|L:${name}|`).join('');
      await expect(find(scope, 'Row load trace')).toHaveText(prefix);
      await expect(find(scope, 'Waiting row phase')).toHaveText(names.map(name => `pending ${name}`));
      await advancePastWait(runtimePage);
      await expect(find(scope, 'Row load trace')).toHaveText(prefix + names.map(name => `D:${name}|`).join(''));
      await expect(find(scope, 'Waiting row phase')).toHaveText(names.map(name => `done ${name}`));
    });
  });

  test(`${mode}: restarting and leaving a page discard old waiting continuations`, async ({ page, browser }, testInfo) => {
    await withRuntime(mode, page, browser, testInfo, cancellationFixture(), async (runtimePage, scope) => {
      await click(runtimePage, scope, 'Start cancellable wait');
      await expect(find(scope, 'Cancellation prefix')).toHaveText('armed');
      if (mode === 'preview') await scope.getByTitle('Restart prototype', { exact: true }).click();
      else await runtimePage.reload(); // A file reload is the offline viewer's restart operation.
      await paint(runtimePage);
      await expect(find(scope, 'Cancellation prefix')).toHaveText('idle');
      await advancePastWait(runtimePage);
      await expect(find(scope, 'Cancellation status')).toHaveText('clean');
      await click(runtimePage, scope, 'Start cancellable wait');
      await expect(find(scope, 'Cancellation prefix')).toHaveText('armed');
      await click(runtimePage, scope, 'Leave waiting page');
      await expect(find(scope, 'Destination status')).toHaveText('clean');
      await expect(find(scope, 'Destination prefix')).toHaveText('armed');
      await advancePastWait(runtimePage);
      await expect(find(scope, 'Destination status')).toHaveText('clean');
      await expect(find(scope, 'Cancellation status')).toHaveCount(0);
    });
  });

  test(`${mode}: a delayed error is visible and preserves other committed events`, async ({ page, browser }, testInfo) => {
    await withRuntime(mode, page, browser, testInfo, eventFixture(), async (runtimePage, scope) => {
      await click(runtimePage, scope, 'Start delayed error');
      await expect(find(scope, 'Delayed error prefix')).toHaveText('started');
      await click(runtimePage, scope, 'Commit fast event');
      await expect(find(scope, 'Fast event status')).toHaveText('committed');
      await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
      await advancePastWait(runtimePage);
      await expect(scope.getByRole('alert')).toContainText(/Expression/i);
      await expect(find(scope, 'Fast event status')).toHaveText('committed');
      await expect(find(scope, 'Delayed error prefix')).toHaveText('started');
    });
  });
}
