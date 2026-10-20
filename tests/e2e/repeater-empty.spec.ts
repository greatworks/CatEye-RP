import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Document, Interaction, Widget } from '../../src/model/types';

type Step = Omit<Action, 'id'>;
type Scope = Page | Locator;
const event = (actions: Step[], trigger: Interaction['event'] = 'click'): Interaction => ({ id: uid(), name: trigger, event: trigger, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) });
const variable = (name: string, value: string): Step => ({ type: 'setVariable', targetId: name, value });
const text = (widget: Widget, value: string): Step => ({ type: 'setText', targetId: widget.id, value });
const widget = (scope: Scope, name: string) => scope.locator(`.widget[aria-label="${name}"]`);

function fixture(): Document {
  const doc = createDocument(); doc.name = 'Empty repeater lifecycle'; doc.caseSelection = 'never';
  doc.variables = { MainTrace: '', MainEmpty: '0', MainIsEmpty: 'false', GuardMode: 'off', PagedTrace: '', PagedLoads: '0', PagedEmpty: '0', TouchedRows: '' };
  doc.pages[0].width = 1080; doc.pages[0].height = 1000;
  const label = (name: string, value: string, x: number, y: number, width = 480, height = 40) => {
    const result = createWidget('text', x, y); result.name = name; result.text = value; result.width = width; result.height = height; result.style.textPadding = [0, 0, 0, 0]; return result;
  };
  const heading = label('Instructions', 'Empty rows: callback order, refresh guards, and visible template targets', 40, 24, 1000, 55); heading.style.fontSize = 21;
  const mainStatus = label('Main empty state', 'Waiting for initial rows', 40, 100), mainCount = label('Main empty callbacks', 'Empty loads: 0', 40, 145);
  const pagedCount = label('Paged callbacks', 'Item callbacks: 0; empty callbacks: 0', 570, 145);
  const pagedTitle = label('Paged title', 'Three rows, two per page', 570, 100);
  const targetLog = label('Visible template targets', 'Selected targets: ', 570, 535, 460, 75);
  const mainLog = label('Main lifecycle log', '', 40, 710, 990, 65), pagedLog = label('Paged lifecycle log', '', 40, 810, 990, 65);
  const mainLogTitle = label('Main log title', 'Main log — I<count>: Item Loaded; L: template Loaded; S: synchronous attempt; W/A: wait/add', 40, 675, 990, 35);
  const pagedLogTitle = label('Paged log title', 'Paged log — deleting all rows on the last page adds no empty callback', 40, 775, 990, 35);
  const main = createWidget('repeater', 40, 200); main.name = 'Unlimited records'; main.width = 460; main.height = 180;
  const paged = createWidget('repeater', 570, 200); paged.name = 'Paged records'; paged.width = 460; paged.height = 180;
  const mainRow = label('Main row', '[[Item.Name]]', 12, 8, 420, 36), pagedRow = label('Paged row', '[[Item.Name]]', 12, 8, 420, 36);
  pagedRow.width = 350;
  const pagedCheck = createWidget('checkbox', 410, 8); pagedCheck.name = 'Paged target checkbox'; pagedCheck.text = ''; pagedCheck.width = 36; pagedCheck.height = 36;
  pagedCheck.interactions = [event([variable('TouchedRows', '[[TouchedRows]][[Item.Name]]|'), text(targetLog, 'Selected targets: [[TouchedRows]]')], 'select')];
  const data = () => ['A', 'B', 'C'].map(Name => ({ Name }));
  main.repeater = { columns: ['Name'], rows: data(), template: [mainRow], itemHeight: 52, gap: 4 };
  paged.repeater = { columns: ['Name'], rows: data(), template: [pagedRow, pagedCheck], itemHeight: 52, gap: 4, pagination: { itemsPerPage: 2, startPage: 1 } };
  const mainTrace = (entry: string): Step[] => [variable('MainTrace', `[[MainTrace]]${entry}`), text(mainLog, '[[MainTrace]]')];
  main.interactions = [event([
    variable('MainIsEmpty', '[[This.itemCount == 0]]'),
    text(mainStatus, '[[if(This.itemCount == 0, "No results", "Rows available")]]'),
    variable('MainEmpty', '[[MainEmpty + if(This.itemCount == 0, 1, 0)]]'), text(mainCount, 'Empty loads: [[MainEmpty]]'),
    ...mainTrace('I[[This.itemCount]]|'),
  ], 'itemLoad')];
  const sync = event([...mainTrace('S|'), { type: 'addRow', targetId: main.id, value: '{"Name":"Synchronous add must be skipped"}' }], 'itemLoad');
  sync.name = 'Try synchronous add during empty refresh'; sync.conditions = [
    { source: 'variable', key: 'MainIsEmpty', operator: 'equals', value: 'true' }, { source: 'variable', key: 'GuardMode', operator: 'equals', value: 'sync' },
  ];
  const deferred = event([variable('GuardMode', 'off'), ...mainTrace('W|'), { type: 'wait', duration: 0 }, { type: 'addRow', targetId: main.id, value: '{"Name":"Recovered after Wait 0"}' }, ...mainTrace('A|')], 'itemLoad');
  deferred.name = 'Add after empty refresh releases its guard'; deferred.conditions = [
    { source: 'variable', key: 'MainIsEmpty', operator: 'equals', value: 'true' }, { source: 'variable', key: 'GuardMode', operator: 'equals', value: 'wait' },
  ];
  main.interactions.push(sync, deferred); mainRow.interactions = [event(mainTrace('L|'), 'load')];
  const pagedTrace = (entry: string): Step[] => [variable('PagedTrace', `[[PagedTrace]]${entry}`), text(pagedLog, '[[PagedTrace]]')];
  paged.interactions = [event([
    variable('PagedLoads', '[[PagedLoads + 1]]'), variable('PagedEmpty', '[[PagedEmpty + if(This.itemCount == 0, 1, 0)]]'),
    text(pagedCount, 'Item callbacks: [[PagedLoads]]; empty callbacks: [[PagedEmpty]]'), ...pagedTrace('I[[This.itemCount]]|'),
  ], 'itemLoad')];
  pagedRow.interactions = [event(pagedTrace('L|'), 'load')];
  const button = (name: string, x: number, y: number, actions: Step[]) => {
    const result = createWidget('button', x, y); result.name = result.text = name; result.width = 220; result.height = 44; result.interactions = [event(actions)]; return result;
  };
  const clear: Step = { type: 'removeFilter', targetId: main.id, value: '{"all":true}' };
  const controls = [
    button('Filter none', 40, 410, [{ type: 'addFilter', targetId: main.id, value: JSON.stringify({ name: 'empty', expression: '[[false]]', mode: 'smart', removeOthers: false }) }]),
    button('Clear filter', 280, 410, [clear]),
    button('Touch main rows', 40, 470, [text(mainRow, 'Touched [[TargetItem.Name]]')]),
    button('Try synchronous add', 280, 470, [variable('GuardMode', 'sync'), { type: 'deleteRow', targetId: main.id, value: 'all' }]),
    button('Restore three rows', 40, 530, [variable('GuardMode', 'off'), clear, ...data().map(row => ({ type: 'addRow' as const, targetId: main.id, value: JSON.stringify(row) }))]),
    button('Delete then Wait 0 add', 280, 530, [variable('GuardMode', 'wait'), { type: 'deleteRow', targetId: main.id, value: 'all' }]),
    button('Refresh main rows', 40, 590, [{ type: 'removeFilter', targetId: main.id, value: '{"name":"absent"}' }]),
    button('Touch page rows', 570, 410, [text(pagedRow, 'Touched [[TargetItem.Name]]'), { type: 'setSelected', targetId: pagedCheck.id, value: 'true' }]),
    button('Next page', 810, 410, [{ type: 'setRepeaterPage', targetId: paged.id, value: 'next' }]),
    button('First page', 570, 470, [{ type: 'setRepeaterPage', targetId: paged.id, value: 'first' }]),
    button('Delete paged rows', 810, 470, [{ type: 'deleteRow', targetId: paged.id, value: 'all' }]),
  ];
  const note = label('Scope note', 'External template actions address visible rows. Empty data creates no placeholder row. Use preview restart to reset the demo.', 40, 915, 990, 55);
  doc.pages[0].widgets = [heading, mainStatus, mainCount, pagedTitle, pagedCount, main, paged, ...controls, targetLog, mainLogTitle, mainLog, pagedLogTitle, pagedLog, note];
  return doc;
}

async function exercise(scope: Scope) {
  const mainRows = widget(scope, 'Unlimited records').locator('.repeater-row'), mainLabels = widget(scope, 'Main row');
  const pagedRows = widget(scope, 'Paged records').locator('.repeater-row'), pagedLabels = widget(scope, 'Paged row');
  const mainLog = widget(scope, 'Main lifecycle log'), pageLog = widget(scope, 'Paged lifecycle log');
  const click = (name: string) => widget(scope, name).click();
  let trace = 'I3|L|'.repeat(3);
  await expect(mainLabels).toHaveText(['A', 'B', 'C']); await expect(mainLog).toHaveText(trace);
  await expect(widget(scope, 'Main empty state')).toHaveText('Rows available'); await expect(widget(scope, 'Main empty callbacks')).toHaveText('Empty loads: 0');
  await expect(pagedLabels).toHaveText(['A', 'B']); await expect(pageLog).toHaveText('I3|L|'.repeat(2));
  await click('Filter none'); trace += 'I0|L|';
  await expect(mainRows).toHaveCount(0); await expect(mainLabels).toHaveCount(0); await expect(mainLog).toHaveText(trace);
  await expect(widget(scope, 'Main empty state')).toHaveText('No results'); await expect(widget(scope, 'Main empty callbacks')).toHaveText('Empty loads: 1');
  await click('Touch main rows'); await expect(mainRows).toHaveCount(0); await expect(mainLabels).toHaveCount(0); await expect(mainLog).toHaveText(trace);
  await click('Clear filter'); trace += 'I3|L|'.repeat(3); await expect(mainLabels).toHaveText(['A', 'B', 'C']); await expect(mainLog).toHaveText(trace);
  await expect(widget(scope, 'Main empty state')).toHaveText('Rows available');

  await click('Try synchronous add'); trace += 'I0|S|L|';
  await expect(mainRows).toHaveCount(0); await expect(mainLog).toHaveText(trace); await expect(widget(scope, 'Main empty callbacks')).toHaveText('Empty loads: 2');
  await click('Restore three rows'); trace += 'I3|L|'.repeat(3); await expect(mainLabels).toHaveText(['A', 'B', 'C']); await expect(mainLog).toHaveText(trace);
  await click('Delete then Wait 0 add'); trace += 'I0|W|L|A|I1|L|';
  await expect(mainLabels).toHaveText(['Recovered after Wait 0']); await expect(mainLog).toHaveText(trace); await expect(widget(scope, 'Main empty callbacks')).toHaveText('Empty loads: 3');
  await expect(widget(scope, 'Main empty state')).toHaveText('Rows available');
  await click('Refresh main rows'); trace += 'I1|L|'; await expect(mainLog).toHaveText(trace); await expect(mainRows).toHaveCount(1);
  await expect(widget(scope, 'Main empty callbacks')).toHaveText('Empty loads: 3');

  await click('Touch page rows'); await expect(pagedLabels).toHaveText(['Touched A', 'Touched B']); await expect(pageLog).toHaveText('I3|L|'.repeat(2));
  await expect(widget(scope, 'Visible template targets')).toHaveText('Selected targets: A|B|');
  await click('Next page'); await expect(pagedLabels).toHaveText(['C']); await expect(pageLog).toHaveText('I3|L|'.repeat(3));
  await expect(widget(scope, 'Paged callbacks')).toHaveText('Item callbacks: 3; empty callbacks: 0');
  await click('Touch page rows'); await expect(pagedLabels).toHaveText(['Touched C']);
  await expect(widget(scope, 'Visible template targets')).toHaveText('Selected targets: A|B|C|');
  await click('Delete paged rows'); await expect(pagedRows).toHaveCount(0); await expect(pagedLabels).toHaveCount(0);
  await expect(pageLog).toHaveText('I3|L|'.repeat(3)); await expect(widget(scope, 'Paged callbacks')).toHaveText('Item callbacks: 3; empty callbacks: 0');
  await expect(widget(scope, 'Visible template targets')).toHaveText('Selected targets: A|B|C|');
  await click('Touch page rows'); await click('First page'); await expect(pagedRows).toHaveCount(0); await expect(pagedLabels).toHaveCount(0);
  await expect(pageLog).toHaveText('I3|L|'.repeat(3)); await expect(widget(scope, 'Paged callbacks')).toHaveText('Item callbacks: 3; empty callbacks: 0');
  await expect(widget(scope, 'Visible template targets')).toHaveText('Selected targets: A|B|C|');
  await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: empty repeater callbacks, Wait guard release and visible-only template actions`, async ({ page, browser }, info) => {
  const doc = fixture(), json = serializeDocument(doc), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message)); await page.goto('/');
  const chooser = page.waitForEvent('filechooser'); await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: /^Open…/ }).click();
  await (await chooser).setFiles({ name: 'repeater-empty-demo.rea.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  if (mode === 'preview') {
    await mkdir('artifacts', { recursive: true }); await writeFile('artifacts/repeater-empty-demo.rea.json', json);
    await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page.locator('.preview-overlay'));
    await page.screenshot({ path: info.outputPath('repeater-empty-preview.png') });
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const path = info.outputPath('repeater-empty.html'); await (await download).saveAs(path);
    const context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1100 } });
    try {
      const exported = await context.newPage(), requests: string[] = []; exported.on('pageerror', error => errors.push(error.message));
      exported.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      await exported.goto(pathToFileURL(path).href); await exercise(exported); await exported.screenshot({ path: info.outputPath('repeater-empty-offline.png') });
      expect(requests).toEqual([]);
    } finally { await context.close(); }
  }
  expect(errors).toEqual([]);
});
