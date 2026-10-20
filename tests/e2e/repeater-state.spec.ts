import { expect, test, type Locator, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, uid } from '../../src/model/document';
import type { Action, Document, EventType, Interaction, WidgetType } from '../../src/model/types';

function interaction(actions: Omit<Action, 'id'>[], event: EventType = 'click'): Interaction {
  return { id: uid(), name: 'Row state fixture', event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) };
}

function repeaterFixture(): Document {
  const doc = createDocument(); doc.name = 'Repeater row state regression';
  const page = doc.pages[0]; page.width = 1100; page.height = 900;
  const make = (type: WidgetType, name: string, text: string, x: number, y: number, width?: number) => {
    const widget = createWidget(type, x, y); widget.name = name; widget.text = text;
    if (width !== undefined) widget.width = width;
    return widget;
  };
  const repeater = make('repeater', 'Isolated list', '', 40, 100, 1000); repeater.height = 680;
  const label = make('text', 'Row label', 'Row [[Item.Name]]', 10, 8, 130);
  const input = make('input', 'Row input', '[[Item.Note]]', 160, 5, 240);
  const checked = make('checkbox', 'Row checkbox', 'Keep row', 430, 10, 160);
  const persist = make('button', 'Persist row input', 'Save row data', 620, 5, 170);
  persist.interactions = [interaction([{ type: 'updateRow', targetId: repeater.id, value: JSON.stringify({ row: 'this', values: { Note: `[[Widget.${input.id}.text]]` } }) }])];
  const panel = make('panel', 'Row panel', '', 10, 55, 220); panel.height = 50;
  const closed = { id: uid(), name: 'Closed', widgets: [make('text', 'Panel status', 'Closed [[Item.Name]]', 5, 8, 200)] };
  const opened = { id: uid(), name: 'Open', widgets: [make('text', 'Panel status', 'Open [[Item.Name]]', 5, 8, 200)] };
  panel.states = [closed, opened]; panel.activeStateId = closed.id;
  const toggle = make('button', 'Toggle row panel', 'Toggle panel', 260, 60, 130);
  toggle.interactions = [interaction([{ type: 'nextState', targetId: panel.id }])];
  const echo = make('button', 'Echo row input', 'Echo row', 420, 60, 130);
  const output = make('text', 'Row echo', 'Echo [[Item.Name]]', 580, 65, 370);
  echo.interactions = [interaction([{ type: 'setText', targetId: output.id, value: `[[Widget.${input.id}.text]]` }])];

  const nested = make('repeater', 'Nested list', '', 10, 120, 940); nested.height = 84;
  const nestedLabel = make('text', 'Nested row label', 'Part [[Item.Part]]', 8, 4, 90);
  const nestedInput = make('input', 'Nested input', '[[Item.Part]]', 110, 0, 220); nestedInput.height = 32;
  const nestedEcho = make('button', 'Echo nested input', 'Echo nested', 360, 0, 140); nestedEcho.height = 32;
  const nestedOutput = make('text', 'Nested echo', 'Echo [[Item.Part]]', 530, 4, 360);
  nestedEcho.interactions = [interaction([{ type: 'setText', targetId: nestedOutput.id, value: `[[Widget.${nestedInput.id}.text]]` }])];
  nested.repeater = { columns: ['Part'], rows: [{ Part: 'One' }, { Part: 'Two' }], template: [nestedLabel, nestedInput, nestedEcho, nestedOutput], itemHeight: 36, gap: 4 };
  repeater.repeater = { columns: ['Name', 'Note'], rows: ['Alpha', 'Beta', 'Gamma'].map(Name => ({ Name, Note: `${Name} note` })), template: [label, input, checked, persist, panel, toggle, echo, output, nested], itemHeight: 214, gap: 8 };
  const controls = [
    ['Sort descending', { type: 'sortRows', targetId: repeater.id, value: 'Name:desc' }],
    ['Hide Alpha', { type: 'filterRows', targetId: repeater.id, value: '{"column":"Name","operator":"notEquals","value":"Alpha"}' }],
    ['Restore all rows', { type: 'filterRows', targetId: repeater.id, value: '' }],
    ['Delete edited Alpha', { type: 'deleteRow', targetId: repeater.id, value: '2' }],
    ['Add fresh Alpha', { type: 'addRow', targetId: repeater.id, value: '{"Name":"Alpha","Note":"Alpha note"}' }],
  ] as const;
  page.widgets = controls.map(([name, action], index) => {
    const button = make('button', name, name, 40 + index * 200, 30, 180);
    button.interactions = [interaction([action])]; return button;
  });
  page.widgets.push(repeater);
  return doc;
}

async function importFixture(page: Page, doc: Document = repeaterFixture()) {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'repeater-state.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}

async function exerciseRows(scope: Page | Locator) {
  const list = scope.locator('.widget[aria-label="Isolated list"]');
  const rows = list.locator(':scope > .repeater-row');
  const row = (name: string) => rows.filter({ hasText: `Row ${name}` });
  const input = (name: string) => row(name).getByRole('textbox', { name: 'Row input', exact: true });
  const checkbox = (name: string) => row(name).locator('.widget[aria-label="Row checkbox"]').getByRole('checkbox');
  const nestedRows = (name: string) => row(name).locator('.widget[aria-label="Nested list"] > .repeater-row');
  const nestedInput = (name: string, index: number) => nestedRows(name).nth(index).getByRole('textbox', { name: 'Nested input', exact: true });
  const rowOrder = rows.locator(':scope > .widget[aria-label="Row label"]');
  const click = (name: string) => scope.locator(`.widget[aria-label="${name}"]`).click();
  await expect(rows).toHaveCount(3);
  await expect(rowOrder).toHaveText(['Row Alpha', 'Row Beta', 'Row Gamma']);
  await expect(input('Alpha')).toHaveValue('Alpha note');
  await expect(input('Beta')).toHaveValue('Beta note');
  await expect(input('Gamma')).toHaveValue('Gamma note');

  await input('Alpha').fill('Alpha edited');
  await input('Alpha').press('Tab');
  // Baseline regression: a template-ID-only store changes every repeated input here.
  await expect(input('Beta')).toHaveValue('Beta note');
  await expect(input('Gamma')).toHaveValue('Gamma note');
  await checkbox('Alpha').check();
  await expect(checkbox('Beta')).not.toBeChecked();
  await expect(checkbox('Gamma')).not.toBeChecked();
  await row('Alpha').locator('.widget[aria-label="Toggle row panel"]').click();
  await expect(row('Alpha').locator('.widget[aria-label="Panel status"]')).toHaveText('Open Alpha');
  await expect(row('Beta').locator('.widget[aria-label="Panel status"]')).toHaveText('Closed Beta');
  await row('Alpha').locator('.widget[aria-label="Echo row input"]').click();
  await expect(row('Alpha').locator('.widget[aria-label="Row echo"]')).toHaveText('Alpha edited');
  await expect(row('Beta').locator('.widget[aria-label="Row echo"]')).toHaveText('Echo Beta');
  await input('Beta').fill('Beta edited');
  await row('Beta').locator('.widget[aria-label="Echo row input"]').click();
  await expect(row('Beta').locator('.widget[aria-label="Row echo"]')).toHaveText('Beta edited');
  await expect(input('Alpha')).toHaveValue('Alpha edited');

  await nestedInput('Alpha', 0).fill('Alpha nested One edited');
  await nestedRows('Alpha').nth(0).locator('.widget[aria-label="Echo nested input"]').click();
  await expect(nestedRows('Alpha').nth(0).locator('.widget[aria-label="Nested echo"]')).toHaveText('Alpha nested One edited');
  await expect(nestedInput('Alpha', 1)).toHaveValue('Two');
  await expect(nestedInput('Beta', 0)).toHaveValue('One');
  await expect(nestedInput('Gamma', 0)).toHaveValue('One');

  let savedBeta = 'Beta note';
  const assertReset = async (names: string[]) => {
    for (const name of names) {
      await expect(input(name)).toHaveValue(name === 'Beta' ? savedBeta : `${name} note`);
      await expect(checkbox(name)).not.toBeChecked();
      await expect(row(name).locator('.widget[aria-label="Panel status"]')).toHaveText(`Closed ${name}`);
      await expect(row(name).locator('.widget[aria-label="Row echo"]')).toHaveText(`Echo ${name}`);
      await expect(nestedInput(name, 0)).toHaveValue('One');
      await expect(nestedInput(name, 1)).toHaveValue('Two');
      await expect(nestedRows(name).nth(0).locator('.widget[aria-label="Nested echo"]')).toHaveText('Echo One');
    }
  };
  const dirtyRow = async (name: string) => {
    await input(name).fill(`${name} temporary`);
    await checkbox(name).check();
    await row(name).locator('.widget[aria-label="Toggle row panel"]').click();
    await row(name).locator('.widget[aria-label="Echo row input"]').click();
    await nestedInput(name, 0).fill(`${name} nested temporary`);
    await nestedRows(name).nth(0).locator('.widget[aria-label="Echo nested input"]').click();
    await expect(checkbox(name)).toBeChecked();
    await expect(row(name).locator('.widget[aria-label="Panel status"]')).toHaveText(`Open ${name}`);
    await expect(row(name).locator('.widget[aria-label="Row echo"]')).toHaveText(`${name} temporary`);
  };
  await click('Sort descending');
  await expect(rowOrder).toHaveText(['Row Gamma', 'Row Beta', 'Row Alpha']);
  // RP 11 rebuilds row controls on ordinary repeater refresh. Persisted data is separate.
  await assertReset(['Alpha', 'Beta', 'Gamma']);
  await dirtyRow('Beta');
  savedBeta = 'Beta saved "quoted" [[MissingVariable]]';
  await input('Beta').fill(savedBeta);
  await row('Beta').locator('.widget[aria-label="Persist row input"]').click();
  await assertReset(['Alpha', 'Beta', 'Gamma']);
  await dirtyRow('Alpha');
  await dirtyRow('Beta');
  await click('Hide Alpha');
  await expect(rowOrder).toHaveText(['Row Gamma', 'Row Beta']);
  await expect(row('Alpha')).toHaveCount(0);
  await assertReset(['Beta', 'Gamma']);
  await dirtyRow('Beta');
  await click('Restore all rows');
  await expect(rowOrder).toHaveText(['Row Gamma', 'Row Beta', 'Row Alpha']);
  await assertReset(['Alpha', 'Beta', 'Gamma']);
  await dirtyRow('Alpha');
  await dirtyRow('Beta');
  await click('Delete edited Alpha');
  await expect(rowOrder).toHaveText(['Row Gamma', 'Row Beta']);
  await assertReset(['Beta', 'Gamma']);
  await dirtyRow('Beta');
  await click('Add fresh Alpha');
  await expect(rowOrder).toHaveText(['Row Gamma', 'Row Beta', 'Row Alpha']);
  await assertReset(['Alpha', 'Beta', 'Gamma']);
}

function lifecycleFixture(): Document {
  const doc = createDocument(); doc.name = 'Repeater lifecycle and update regression';
  doc.variables = { Trace: '', HiddenLoads: '0', InactiveLoads: '0' };
  const page = doc.pages[0]; page.width = 1180; page.height = 1020;
  const make = (type: WidgetType, name: string, text: string, x: number, y: number, width = 200) => {
    const widget = createWidget(type, x, y); widget.name = name; widget.text = text; widget.width = width; return widget;
  };
  const log = (value: string): Omit<Action, 'id'> => ({ type: 'setVariable', targetId: 'Trace', value });
  page.interactions = [interaction([log('P|')], 'load')];
  const list = make('repeater', 'Lifecycle list', '', 40, 160, 1100); list.height = 280;
  const label = make('text', 'Lifecycle row label', 'Row [[Item.Name]]', 8, 8, 115);
  label.interactions = [interaction([log("[[concat(Trace, 'L:', Item.Name, ':', Item.index, '|')]]")], 'load')];
  const input = make('textarea', 'Lifecycle input', '[[Item.Note]]', 130, 4, 270); input.height = 38;
  const save = make('button', 'Save lifecycle row', 'Save this row', 420, 5, 140);
  save.interactions = [interaction([{ type: 'updateRow', targetId: list.id, value: JSON.stringify({ row: 'this', values: { Note: `[[Widget.${input.id}.text]]` } }) }])];
  const metadata = make('text', 'Lifecycle metadata', 'Not loaded', 590, 8, 490);
  const note = make('text', 'Lifecycle persisted note', '[[Item.Note]]', 8, 48, 710); note.height = 36;
  const flag = make('text', 'Lifecycle flag', '[[Item.Flag]]', 790, 48, 270);
  list.repeater = { columns: ['Name', 'Note', 'Flag'], rows: ['Alpha', 'Beta', 'Gamma'].map(Name => ({ Name, Note: `${Name} note`, Flag: 'original' })), template: [label, input, save, metadata, note, flag], itemHeight: 88, gap: 6 };
  list.interactions = [
    interaction([log("[[concat(Trace, 'R|')]]")], 'load'),
    interaction([
      log("[[concat(Trace, 'I:', Item.Name, ':', Item.index, '|')]]"),
      { type: 'setText', targetId: metadata.id, value: '[[Item.index]]|[[Item.isFirst]]|[[Item.isLast]]|[[Item.isEven]]|[[Item.isOdd]]' },
      // Native RP suppresses mutations of this repeater during its own synchronous refresh.
      { type: 'updateRow', targetId: list.id, value: JSON.stringify({ row: 'this', values: { Flag: 'invalid recursive mutation' } }) },
    ], 'itemLoad'),
  ];
  const batchInput = make('textarea', 'Matching update input', '', 820, 88, 320); batchInput.height = 48;
  const controls: [string, Omit<Action, 'id'>[]][] = [
    ['Clear lifecycle trace', [log('')]],
    ['Sort lifecycle descending', [{ type: 'sortRows', targetId: list.id, value: 'Name:desc' }]],
    ['Hide lifecycle Alpha', [{ type: 'filterRows', targetId: list.id, value: JSON.stringify({ column: 'Name', operator: 'notEquals', value: 'Alpha' }) }]],
    ['Restore lifecycle rows', [{ type: 'filterRows', targetId: list.id, value: '' }]],
    ['Update matching Alpha', [{ type: 'updateRow', targetId: list.id, value: JSON.stringify({ where: { column: 'Name', operator: 'equals', value: 'Alpha' }, values: { Note: `[[Widget.${batchInput.id}.text]]`, Flag: 'matched' } }) }]],
    ['Update all lifecycle flags', [{ type: 'updateRow', targetId: list.id, value: JSON.stringify({ row: 'all', values: { Flag: "[[concat(TargetItem.Name, ':', TargetItem.Flag)]]" } }) }]],
  ];
  const buttons = controls.map(([name, actions], index) => {
    const button = make('button', name, name, 40 + (index % 4) * 280, 24 + Math.floor(index / 4) * 64, 250);
    button.interactions = [interaction(actions)]; return button;
  });
  const trace = make('text', 'Lifecycle trace', '[[Trace]]', 40, 464, 1100); trace.height = 80;
  const counts = make('text', 'Hidden lifecycle counts', 'Hidden [[HiddenLoads]], inactive [[InactiveLoads]]', 40, 560, 700);
  const makeUnseen = (name: string, variable: string) => {
    const unseen = make('repeater', name, '', 8, 8, 700); unseen.height = 120;
    unseen.repeater!.rows = [{ Name: `${name} One` }, { Name: `${name} Two` }];
    unseen.interactions = [interaction([{ type: 'setVariable', targetId: variable, value: `[[${variable} + 1]]` }], 'itemLoad')];
    return unseen;
  };
  const hidden = makeUnseen('Hidden lifecycle list', 'HiddenLoads'); hidden.hidden = true; hidden.y = 880;
  const inactive = makeUnseen('Inactive lifecycle list', 'InactiveLoads');
  const panel = make('panel', 'Inactive lifecycle panel', '', 40, 650, 1100); panel.height = 150;
  const initial = { id: uid(), name: 'Initial', widgets: [make('text', 'Inactive panel placeholder', 'Inactive repeater is in the other state', 8, 8, 750)] };
  const next = { id: uid(), name: 'Other', widgets: [inactive] };
  panel.states = [initial, next]; panel.activeStateId = initial.id;
  const activate = make('button', 'Show inactive lifecycle list', 'Show other panel state', 820, 560, 320);
  activate.interactions = [interaction([{ type: 'setState', targetId: panel.id, value: next.id }])];
  page.widgets = [...buttons, batchInput, list, trace, counts, activate, panel, hidden];
  return doc;
}

async function exerciseLifecycle(scope: Page | Locator) {
  const list = scope.locator('.widget[aria-label="Lifecycle list"]');
  const rows = list.locator(':scope > .repeater-row');
  const row = (name: string) => rows.filter({ hasText: `Row ${name}` });
  const click = (name: string) => scope.locator(`.widget[aria-label="${name}"]`).click();
  const trace = scope.locator('.widget[aria-label="Lifecycle trace"]');
  const counts = scope.locator('.widget[aria-label="Hidden lifecycle counts"]');
  const rowTrace = (names: string[]) => names.map((name, index) => `I:${name}:${index + 1}|L:${name}:${index + 1}|`).join('');
  const assertRows = async (names: string[]) => {
    await expect(rows.locator(':scope > .widget[aria-label="Lifecycle row label"]')).toHaveText(names.map(name => `Row ${name}`));
    await expect(rows.locator(':scope > .widget[aria-label="Lifecycle metadata"]')).toHaveText(names.map((_, index) => `${index + 1}|${index === 0}|${index === names.length - 1}|${(index + 1) % 2 === 0}|${(index + 1) % 2 === 1}`));
    await expect(counts).toHaveText('Hidden 2, inactive 2');
    await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
  };
  const refresh = async (button: string, names: string[]) => {
    await click('Clear lifecycle trace');
    await click(button);
    await expect(trace).toHaveText(rowTrace(names));
    await assertRows(names);
  };
  await expect(trace).toHaveText(`P|R|${rowTrace(['Alpha', 'Beta', 'Gamma'])}`);
  await assertRows(['Alpha', 'Beta', 'Gamma']);
  await expect(rows.locator(':scope > .widget[aria-label="Lifecycle flag"]')).toHaveText(['original', 'original', 'original']);
  await click('Show inactive lifecycle list');
  await expect(scope.locator('.widget[aria-label="Inactive lifecycle list"] > .repeater-row')).toHaveCount(2);
  await expect(counts).toHaveText('Hidden 2, inactive 2');

  await refresh('Sort lifecycle descending', ['Gamma', 'Beta', 'Alpha']);
  const betaText = 'Beta "O\'Reilly"\n[[UnresolvedText]]';
  await row('Beta').getByRole('textbox', { name: 'Lifecycle input', exact: true }).fill(betaText);
  await click('Clear lifecycle trace');
  await row('Beta').locator('.widget[aria-label="Save lifecycle row"]').click();
  await expect(trace).toHaveText(rowTrace(['Gamma', 'Beta', 'Alpha']));
  await assertRows(['Gamma', 'Beta', 'Alpha']);
  await expect(row('Beta').getByRole('textbox', { name: 'Lifecycle input', exact: true })).toHaveValue(betaText);
  await expect(row('Beta').locator('.widget[aria-label="Lifecycle persisted note"]')).toHaveText(betaText);
  await expect(row('Alpha').locator('.widget[aria-label="Lifecycle persisted note"]')).toHaveText('Alpha note');

  await refresh('Hide lifecycle Alpha', ['Gamma', 'Beta']);
  const alphaText = 'Alpha "matched"\n[[StillLiteral]]';
  await scope.getByRole('textbox', { name: 'Matching update input', exact: true }).fill(alphaText);
  // The matching target is filtered out. Its dataset must still be updated.
  await refresh('Update matching Alpha', ['Gamma', 'Beta']);
  await refresh('Update all lifecycle flags', ['Gamma', 'Beta']);
  await expect(rows.locator(':scope > .widget[aria-label="Lifecycle flag"]')).toHaveText(['Gamma:original', 'Beta:original']);
  await refresh('Restore lifecycle rows', ['Gamma', 'Beta', 'Alpha']);
  await expect(row('Alpha').getByRole('textbox', { name: 'Lifecycle input', exact: true })).toHaveValue(alphaText);
  await expect(row('Alpha').locator('.widget[aria-label="Lifecycle persisted note"]')).toHaveText(alphaText);
  await expect(row('Beta').getByRole('textbox', { name: 'Lifecycle input', exact: true })).toHaveValue(betaText);
  await expect(rows.locator(':scope > .widget[aria-label="Lifecycle flag"]')).toHaveText(['Gamma:original', 'Beta:original', 'Alpha:matched']);
}

for (const mode of ['preview', 'offline'] as const) {
  test(`${mode}: repeater rows isolate controls before refresh and retain only saved dataset values afterward`, async ({ page, browser }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await importFixture(page);
    if (mode === 'preview') {
      await page.getByTitle('Preview (F5)', { exact: true }).click();
      await exerciseRows(page.locator('.preview-overlay'));
      await page.screenshot({ path: testInfo.outputPath('repeater-state-preview.png'), fullPage: true });
    } else {
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
      const html = testInfo.outputPath('repeater-state-offline.html');
      await (await download).saveAs(html);
      const offline = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
      try {
        const exported = await offline.newPage();
        exported.on('pageerror', error => errors.push(error.message));
        await exported.goto(pathToFileURL(html).href);
        await exerciseRows(exported);
        await exported.screenshot({ path: testInfo.outputPath('repeater-state-offline.png'), fullPage: true });
      } finally { await offline.close(); }
    }
    expect(errors).toEqual([]);
  });

  test(`${mode}: repeater lifecycle orders row loads and updates current, matching and hidden rows literally`, async ({ page, browser }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await importFixture(page, lifecycleFixture());
    if (mode === 'preview') {
      await page.getByTitle('Preview (F5)', { exact: true }).click();
      await exerciseLifecycle(page.locator('.preview-overlay'));
      await page.screenshot({ path: testInfo.outputPath('repeater-lifecycle-preview.png'), fullPage: true });
    } else {
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
      const html = testInfo.outputPath('repeater-lifecycle-offline.html');
      await (await download).saveAs(html);
      const offline = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1100 } });
      try {
        const exported = await offline.newPage();
        exported.on('pageerror', error => errors.push(error.message));
        await exported.goto(pathToFileURL(html).href);
        await exerciseLifecycle(exported);
        await exported.screenshot({ path: testInfo.outputPath('repeater-lifecycle-offline.png'), fullPage: true });
      } finally { await offline.close(); }
    }
    expect(errors).toEqual([]);
  });
}
