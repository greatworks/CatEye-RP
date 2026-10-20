import { expect, test, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Document, EventType, Interaction, Widget, WidgetType } from '../../src/model/types';

// Expectations come from form-properties-evidence.md's shipped-jQuery probe:
// focus handlers see preceding Set Text, selection happens after focus/hint handling,
// hidden/disabled form callbacks are ineffective, and selectText=false keeps a caret.
// Navigation cancellation and bounded cycles are explicit product safety behavior.
const freshText = 'Fresh Ω value';
function fixture() {
  const doc = createDocument(); doc.id = 'focus-boundaries'; doc.name = 'Focus action browser boundaries'; doc.caseSelection = 'never';
  Object.assign(doc.variables, { Blocked: '0', WaitTrace: '', Cycle: 'safe', Recovery: '', Stale: 'clean', Navigation: '' });
  const first = doc.pages[0]; first.id = 'focus-start'; first.name = 'Focus boundaries'; first.width = 1060; first.height = 880;
  const destination = createPage('Destination'); destination.id = 'focus-destination'; doc.pages.push(destination);
  const make = (id: string, type: WidgetType, x: number, y: number, text = '', extra: Partial<Widget> = {}) => {
    const widget = createWidget(type, x, y); Object.assign(widget, { id, name: id, text, width: 290, height: 38 }, extra); return widget;
  };
  const interaction = (event: EventType, actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: event, event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ id: uid(), ...action })) });
  const write = (targetId: string, value: string): Omit<Action, 'id'> => ({ type: 'setText', targetId, value });
  const focus = (targetId: string, selectText = true): Omit<Action, 'id'> => ({ type: 'setFocus', targetId, selectText });
  const variable = (targetId: string, value: string): Omit<Action, 'id'> => ({ type: 'setVariable', targetId, value });
  const log = (value: string) => variable('WaitTrace', `[[WaitTrace]]${value}`);
  const button = (id: string, x: number, y: number, actions: Omit<Action, 'id'>[]) => make(id, 'button', x, y, id, { interactions: [interaction('click', actions)] });
  const label = (id: string, x: number, y: number, text: string) => make(id, 'text', x, y, text, { style: { ...createWidget('text').style, fontSize: 13 } });
  const target = make('Current value', 'input', 360, 40, 'Old value', {
    submitButtonId: 'Keep caret', interactions: [interaction('focus', [write('Focus read', '[[Widget.Current value.text]]')])],
  });
  const blockedFocus = [interaction('focus', [variable('Blocked', '[[number(Blocked)+1]]')])];
  const disabled = make('Disabled target', 'input', 360, 290, 'Disabled text', { disabled: true, interactions: blockedFocus });
  const hidden = make('Hidden target', 'input', 360, 342, 'Hidden text', { hidden: true, interactions: [interaction('focus', [variable('Blocked', '[[number(Blocked)+1]]')])] });
  const ready = make('Shown and enabled', 'input', 360, 444, 'Available now', { hidden: true, disabled: true, interactions: [interaction('focus', [write('Ready result', '[[Widget.Shown and enabled.text]]')])] });
  const waitTarget = make('Wait target', 'input', 360, 550, 'Wait field', { interactions: [interaction('focus', [log('P'), { type: 'wait', duration: 1000 }, log('W')])] });
  const cycleTarget = make('Cycle target', 'input', 360, 604, 'Unchanged cycle text', { interactions: [interaction('focus', [variable('Cycle', 'not committed'), focus('Cycle target')])] });
  const navTarget = make('Navigation target', 'input', 360, 712, 'Old-page target', { interactions: [interaction('focus', [variable('Navigation', 'arrived'), { type: 'openPage', targetId: destination.id }])] });
  const lateTarget = make('Late focus target', 'input', 360, 764, 'Delayed navigation field', { interactions: [interaction('focus', [{ type: 'wait', duration: 500 }, variable('Stale', 'ran'), focus(target.id)])] });
  first.widgets = [
    make('Source', 'input', 40, 40, 'Submit to update and focus', { submitButtonId: 'Write then focus' }), target,
    button('Write then focus', 700, 40, [write(target.id, freshText), focus(target.id), write('After focus read', '[[Widget.Current value.text]]')]),
    label('Focus read', 360, 88, 'Not read'), label('After focus read', 700, 88, 'Not read'),
    button('Keep caret', 40, 88, [focus(target.id, false)]),
    make('Typing hint', 'input', 360, 150, '', { hintText: 'Typing hint stays' }),
    button('Focus typing hint', 40, 150, [focus('Typing hint')]),
    make('Focus hint', 'input', 360, 204, '', { hintText: 'Focus hint disappears', hintHideOn: 'focus' }),
    button('Focus disappearing hint', 40, 204, [focus('Focus hint')]),
    make('Disabled source', 'input', 40, 290, 'Keep this control active', { submitButtonId: 'Try disabled' }), disabled,
    button('Try disabled', 700, 290, [focus(disabled.id)]),
    make('Hidden source', 'input', 40, 342, 'Keep this control active', { submitButtonId: 'Try hidden' }), hidden,
    button('Try hidden', 700, 342, [focus(hidden.id)]), label('Blocked callbacks', 360, 392, '[[Blocked]]'),
    button('Show enable focus', 40, 444, [{ type: 'show', targetId: ready.id }, { type: 'enable', targetId: ready.id }, focus(ready.id)]), ready,
    label('Ready result', 700, 444, 'Not focused'),
    button('Begin focus waits', 40, 550, [focus(waitTarget.id, false), log('D')]), waitTarget,
    button('Independent event', 700, 550, [log('X')]), label('Wait trace', 700, 598, '[[WaitTrace]]'),
    button('Begin focus cycle', 40, 604, [focus(cycleTarget.id)]), cycleTarget,
    label('Cycle result', 360, 652, '[[Cycle]]'), button('Recover', 40, 658, [variable('Recovery', 'responsive')]), label('Recovery result', 700, 652, '[[Recovery]]'),
    button('Navigate during focus', 40, 712, [focus(navTarget.id)]), navTarget,
    button('Leave pending focus waits', 40, 764, [focus(lateTarget.id, false), { type: 'openPage', targetId: destination.id }]), lateTarget,
  ];
  destination.widgets = [
    label('Destination marker', 40, 40, 'Destination remains active'), label('Navigation result', 40, 92, '[[Navigation]]'), label('Stale result', 40, 144, '[[Stale]]'),
    button('Return to start', 40, 200, [{ type: 'openPage', targetId: first.id }]),
  ];
  // Widget IDs deliberately use readable names; expression variables require a
  // token-compatible id, independently of UI labels and document IDs.
  const ids = new Map(first.widgets.concat(destination.widgets).map(widget => [widget.id, widget.id.replaceAll(' ', '-')]));
  for (const widget of first.widgets.concat(destination.widgets)) {
    widget.id = ids.get(widget.id)!; if (widget.submitButtonId) widget.submitButtonId = ids.get(widget.submitButtonId)!;
    for (const item of widget.interactions) for (const action of item.actions) {
      if (action.targetId && ids.has(action.targetId)) action.targetId = ids.get(action.targetId)!;
      if (action.value) for (const [old, id] of ids) action.value = action.value.replaceAll(`Widget.${old}.text`, `Widget.${id}.text`);
    }
  }
  return doc;
}

async function fileMenu(page: Page, name: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click();
}
async function save(page: Page, path: string): Promise<Document> {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); await (await download).saveAs(path);
  return JSON.parse(await readFile(path, 'utf8')) as Document;
}
type Mode = 'preview' | 'offline';
async function withPlayer(page: Page, browser: Browser, info: TestInfo, mode: Mode, exercise: (player: Page, scope: Locator) => Promise<void>, doc = fixture()) {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'focus-boundaries.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name); expect(await save(page, info.outputPath('before.rea.json'))).toEqual(doc);
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page, page.locator('.preview-overlay'));
    await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const path = info.outputPath('focus-boundaries.html'); await (await download).saveAs(path);
    const context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1100 } });
    try {
      const player = await context.newPage(), network: string[] = []; player.on('pageerror', error => errors.push(error.message)); player.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
      await player.goto(pathToFileURL(path).href); await exercise(player, player.locator('body')); expect(network).toEqual([]);
    } finally { await context.close(); }
  }
  expect(await save(page, info.outputPath('after.rea.json'))).toEqual(doc); expect(errors).toEqual([]);
}
const widget = (scope: Locator, name: string) => scope.locator(`.widget[aria-label="${name}"]`);
const control = (scope: Locator, name: string) => widget(scope, name).locator('input,textarea');
const selection = (input: Locator) => input.evaluate(element => { const input = element as HTMLInputElement; return [input.selectionStart, input.selectionEnd]; });

function rowMenuFixture() {
  const doc = createDocument(); doc.name = 'Programmatic row focus menu'; doc.caseSelection = 'auto';
  const result = createWidget('text', 40, 300); result.name = 'Chosen row'; result.text = 'No case chosen'; result.width = 540;
  const target = createWidget('input', 8, 8); target.name = 'Row focus target'; target.text = '[[Item.Name]]'; target.width = 230; target.height = 36;
  const refocus = createWidget('button', 260, 8); refocus.name = refocus.text = 'Refocus this row'; refocus.width = 200; refocus.height = 36; target.submitButtonId = refocus.id;
  const makeCase = (name: string, event: EventType, actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name, event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ id: uid(), ...action })) });
  target.interactions = [
    makeCase('Read this row', 'focus', [{ type: 'setText', targetId: result.id, value: 'Chosen [[Item.Name]]' }]),
    makeCase('Other choice', 'focus', [{ type: 'setText', targetId: result.id, value: 'Other [[Item.Name]]' }]),
  ];
  refocus.interactions = [makeCase('Focus same control', 'click', [{ type: 'setFocus', targetId: target.id, selectText: false }])];
  const repeater = createWidget('repeater', 40, 70); repeater.name = 'Focus rows'; repeater.width = 500; repeater.height = 150;
  repeater.repeater = { columns: ['Name'], rows: [{ Name: 'Alpha' }, { Name: 'Beta' }], template: [target, refocus], itemHeight: 60, gap: 18 };
  doc.pages[0].widgets = [repeater, result]; return doc;
}

for (const mode of ['preview', 'offline'] as const) {
  test(`${mode}: focus flushes new text and visibility, preserves caret, respects hints and blocked controls`, async ({ page, browser }, info) => {
    await withPlayer(page, browser, info, mode, async (_player, scope) => {
      const source = control(scope, 'Source'), target = control(scope, 'Current value'); await source.click(); await source.press('Enter');
      await expect(target).toBeFocused(); await expect(target).toHaveValue(freshText); await expect(widget(scope, 'Focus read')).toHaveText(freshText); await expect(widget(scope, 'After focus read')).toHaveText(freshText);
      await expect.poll(() => selection(target)).toEqual([0, freshText.length]);
      await target.press('Home'); for (let i = 0; i < 3; i++) await target.press('ArrowRight'); await expect.poll(() => selection(target)).toEqual([3, 3]);
      await target.press('Enter'); await expect(target).toBeFocused(); await expect.poll(() => selection(target)).toEqual([3, 3]); await expect(target).toHaveValue(freshText);
      await widget(scope, 'Focus typing hint').click(); const typingHint = control(scope, 'Typing hint'); await expect(typingHint).toBeFocused(); await expect(typingHint).toHaveValue('Typing hint stays'); await expect.poll(() => selection(typingHint)).toEqual([0, 0]);
      await widget(scope, 'Focus disappearing hint').click(); const focusHint = control(scope, 'Focus hint'); await expect(focusHint).toBeFocused(); await expect(focusHint).toHaveValue(''); await expect.poll(() => selection(focusHint)).toEqual([0, 0]);
      const disabledSource = control(scope, 'Disabled source'); await disabledSource.click(); await disabledSource.press('Enter'); await expect(disabledSource).toBeFocused(); await expect(control(scope, 'Disabled target')).toBeDisabled(); await expect(widget(scope, 'Blocked callbacks')).toHaveText('0');
      const hiddenSource = control(scope, 'Hidden source'); await hiddenSource.click(); await hiddenSource.press('Enter'); await expect(hiddenSource).toBeFocused(); await expect(control(scope, 'Hidden target')).toHaveCount(0); await expect(widget(scope, 'Blocked callbacks')).toHaveText('0');
      await widget(scope, 'Show enable focus').click(); const ready = control(scope, 'Shown and enabled'); await expect(ready).toBeVisible(); await expect(ready).toBeEnabled(); await expect(ready).toBeFocused();
      await expect(widget(scope, 'Ready result')).toHaveText('Available now'); await expect.poll(() => selection(ready)).toEqual([0, 'Available now'.length]);
      await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    });
  });

  test(`${mode}: focus Wait releases events, navigation cancels stale tails, and recursive focus reports a recoverable error`, async ({ page, browser }, info) => {
    await withPlayer(page, browser, info, mode, async (player, scope) => {
      await widget(scope, 'Begin focus waits').click(); await expect(control(scope, 'Wait target')).toBeFocused(); await expect(widget(scope, 'Wait trace')).toHaveText('PPD');
      await widget(scope, 'Independent event').click(); await expect(widget(scope, 'Wait trace')).toHaveText('PPDX'); await expect(widget(scope, 'Wait trace')).toHaveText('PPDXWW');
      await widget(scope, 'Begin focus cycle').click(); await expect(scope.getByRole('alert')).toContainText('Focus event cycle limit exceeded');
      await expect(widget(scope, 'Cycle result')).toHaveText('safe'); await expect(control(scope, 'Cycle target')).toHaveValue('Unchanged cycle text');
      await widget(scope, 'Recover').click(); await expect(widget(scope, 'Recovery result')).toHaveText('responsive'); await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
      await widget(scope, 'Navigate during focus').click(); await expect(widget(scope, 'Destination marker')).toHaveText('Destination remains active'); await expect(widget(scope, 'Navigation result')).toHaveText('arrived'); await expect(control(scope, 'Navigation target')).toHaveCount(0);
      await widget(scope, 'Return to start').click(); await expect(widget(scope, 'Source')).toBeVisible();
      await widget(scope, 'Leave pending focus waits').click(); await expect(widget(scope, 'Destination marker')).toBeVisible(); await expect(widget(scope, 'Stale result')).toHaveText('clean');
      // Observe beyond the authored 500ms delay; no old-page callback may run.
      await player.waitForTimeout(650); await expect(widget(scope, 'Stale result')).toHaveText('clean'); await expect(widget(scope, 'Destination marker')).toBeVisible();
      await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    });
  });

  test(`${mode}: programmatic Focus menu restores its already-focused second row on Cancel and Escape`, async ({ page, browser }, info) => {
    await withPlayer(page, browser, info, mode, async (player, scope) => {
      const inputs = control(scope, 'Row focus target'), first = inputs.nth(0), second = inputs.nth(1), menu = scope.getByRole('menu', { name: 'Choose a case', exact: true });
      await expect(inputs).toHaveCount(2); await expect(first).toHaveValue('Alpha'); await expect(second).toHaveValue('Beta');
      const assertReturnedToSecond = async () => {
        await expect(second).toBeFocused(); await expect(first).not.toBeFocused();
        // Focus restoration uses requestAnimationFrame and queues runtime work.
        // Let both settle before checking that accessibility focus did not open a new menu.
        await player.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await expect(menu).toHaveCount(0); await expect(second).toBeFocused(); await expect(widget(scope, 'Chosen row')).toHaveText('No case chosen');
      };
      // Establish focus via an actual click, then close its ordinary Focus menu.
      await second.click(); await expect(menu).toHaveCount(1); await expect(menu.getByRole('menuitem')).toHaveCount(2);
      await menu.getByRole('button', { name: 'Cancel', exact: true }).click(); await assertReturnedToSecond();
      // Enter submits to a single-case Click action which focuses this same row.
      // Two synthetic Focus rounds replace the same source menu; only one remains.
      await second.press('Enter'); await expect(menu).toHaveCount(1); await expect(menu.getByRole('menuitem')).toHaveCount(2);
      await menu.getByRole('button', { name: 'Cancel', exact: true }).click(); await assertReturnedToSecond();
      await second.press('Enter'); await expect(menu).toHaveCount(1); await player.keyboard.press('Escape'); await assertReturnedToSecond();
      await second.press('Enter'); await expect(menu).toHaveCount(1); await menu.getByRole('menuitem', { name: 'Read this row', exact: true }).click();
      await expect(widget(scope, 'Chosen row')).toHaveText('Chosen Beta'); await expect(menu).toHaveCount(0); await expect(second).toBeFocused(); await expect(first).not.toBeFocused();
      await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    }, rowMenuFixture());
  });
}
