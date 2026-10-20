import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createPage, createWidget, uid } from '../../src/model/document';
import type { Action, Interaction, Widget, WidgetType } from '../../src/model/types';

// These expectations distinguish measured HTML behavior from unproven native
// generator details. A fixed authored value attribute preserves the initial
// step base; subsequent SetText and user edits must only change the live value.
function fixture() {
  const doc = createDocument(); doc.name = 'Input edge lifecycle'; doc.caseSelection = 'never'; doc.variables.FileRead = '';
  const first = doc.pages[0]; first.id = 'input-edge-page'; first.name = 'Input edge page'; first.width = 1020; first.height = 740;
  const other = createPage('Other page'); other.id = 'input-edge-other'; doc.pages.push(other);
  const make = (id: string, name: string, type: WidgetType, x: number, y: number, text = '', extra: Partial<Widget> = {}) => {
    const w = createWidget(type, x, y); Object.assign(w, { id, name, text, width: 270, height: 40 }, extra); return w;
  };
  const interaction = (...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: 'Click', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ id: uid(), ...action })) });
  const button = (id: string, name: string, x: number, y: number, ...actions: Omit<Action, 'id'>[]) => make(id, name, 'button', x, y, name, { interactions: [interaction(...actions)] });
  const write = (targetId: string, value: string): Omit<Action, 'id'> => ({ type: 'setText', targetId, value });
  const number = make('step-number', 'Step number', 'input', 30, 35, '1.5', { inputType: 'number' });
  const time = make('step-time', 'Step time', 'input', 30, 95, '12:30:01', { inputType: 'time' });
  const draft = make('draft-number', 'Draft number', 'input', 30, 170, '', { inputType: 'number', mouseOverStyle: { fill: '#ffeeaa' }, focusedStyle: { stroke: '#cc3300' } });
  const upload = make('upload-file', 'Upload file', 'input', 20, 25, '', { inputType: 'file', width: 560 });
  const panel = make('upload-panel', 'Upload panel', 'panel', 30, 270, '', { width: 610, height: 130 });
  const uploadState = panel.states![0]; uploadState.id = 'upload-state'; uploadState.name = 'Upload state'; uploadState.widgets = [upload]; panel.activeStateId = uploadState.id;
  panel.states!.push({ id: 'other-upload-state', name: 'Other state', widgets: [make('other-state-label', 'Other state label', 'text', 20, 25, 'Other state is active')] });
  const repaint = button('hover-marker', 'Hover marker', 355, 170, { type: 'setVariable', targetId: 'Unused', value: 'unused' });
  repaint.mouseOverStyle = { fill: '#55bbcc' };
  first.widgets = [
    number, time, draft, repaint, panel,
    button('step-compatible', 'Compatible values', 355, 35, write(number.id, '2.5'), write(time.id, '13:30:01')),
    button('step-mismatch', 'Mismatched values', 665, 35, write(number.id, '2'), write(time.id, '12:30:00')),
    button('hide-upload', 'Hide upload', 665, 270, { type: 'hide', targetId: upload.id }),
    button('show-upload', 'Show upload', 665, 325, { type: 'show', targetId: upload.id }),
    button('other-state', 'Switch away', 30, 440, { type: 'setState', targetId: panel.id, value: 'other-upload-state' }),
    button('upload-state-button', 'Switch back', 355, 440, { type: 'setState', targetId: panel.id, value: uploadState.id }),
    button('clear-upload', 'Clear upload', 665, 440, write(upload.id, '')),
    button('read-upload', 'Read upload', 30, 505, { type: 'setVariable', targetId: 'FileRead', value: `[[Widget.${upload.id}.text]]` }),
    make('upload-readback', 'Upload readback', 'text', 355, 505, 'file=[[FileRead]]', { width: 560 }),
    button('leave-page', 'Leave page', 30, 575, { type: 'openPage', targetId: other.id }),
  ];
  other.widgets = [make('destination-marker', 'Destination marker', 'text', 30, 35, 'Destination'), button('return-page', 'Return to input page', 30, 95, { type: 'openPage', targetId: first.id })];
  return doc;
}

const widget = (scope: Locator, name: string) => scope.locator(`.widget[aria-label="${name}"]`);
const control = (scope: Locator, name: string) => widget(scope, name).locator('input');
async function open(page: Page, doc: unknown) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const pending = page.waitForEvent('filechooser'); await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await pending).setFiles({ name: 'input-edge.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
}
async function save(page: Page, filename: string) {
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); await (await pending).saveAs(filename);
  return JSON.parse(await readFile(filename, 'utf8'));
}

async function exercise(page: Page, scope: Locator, restart: () => Promise<void>) {
  const number = control(scope, 'Step number'), time = control(scope, 'Step time'), draft = control(scope, 'Draft number');
  const state = (input: Locator) => input.evaluate((element: HTMLInputElement) => ({ value: element.value, attribute: element.getAttribute('value'), valid: element.validity.valid, stepMismatch: element.validity.stepMismatch }));
  await expect(number).toHaveValue('1.5'); await expect(time).toHaveValue('12:30:01');
  expect(await state(number)).toEqual({ value: '1.5', attribute: '1.5', valid: true, stepMismatch: false });
  expect(await state(time)).toEqual({ value: '12:30:01', attribute: '12:30:01', valid: true, stepMismatch: false });
  await widget(scope, 'Compatible values').click();
  expect(await state(number)).toEqual({ value: '2.5', attribute: '1.5', valid: true, stepMismatch: false });
  expect(await state(time)).toEqual({ value: '13:30:01', attribute: '12:30:01', valid: true, stepMismatch: false });
  await widget(scope, 'Mismatched values').click();
  expect(await state(number)).toEqual({ value: '2', attribute: '1.5', valid: false, stepMismatch: true });
  expect(await state(time)).toEqual({ value: '12:30:00', attribute: '12:30:01', valid: false, stepMismatch: true });

  await draft.focus(); await draft.pressSequentially('-');
  const badInput = () => draft.evaluate((element: HTMLInputElement) => ({ value: element.value, badInput: element.validity.badInput }));
  expect(await badInput()).toEqual({ value: '', badInput: true });
  await widget(scope, 'Hover marker').hover(); await expect(widget(scope, 'Hover marker')).toHaveCSS('background-color', 'rgb(85, 187, 204)');
  await draft.hover(); await expect(draft).toBeFocused(); expect(await badInput()).toEqual({ value: '', badInput: true });
  await draft.pressSequentially('3'); await expect(draft).toHaveValue('-3'); expect((await badInput()).badInput).toBe(false);

  const upload = () => control(scope, 'Upload file');
  const content = 'Transient file bytes Ω survive hidden and inactive states.';
  const choose = async () => { await upload().setInputFiles({ name: 'cache-proof.txt', mimeType: 'text/plain', buffer: Buffer.from(content) }); };
  const expectSelected = async () => {
    await expect(upload()).toHaveValue('C:\\fakepath\\cache-proof.txt');
    expect(await upload().evaluate(async (element: HTMLInputElement) => ({ count: element.files!.length, name: element.files![0]?.name, text: await element.files![0]?.text() })))
      .toEqual({ count: 1, name: 'cache-proof.txt', text: content });
    await widget(scope, 'Read upload').click(); await expect(widget(scope, 'Upload readback')).toHaveText('file=C:\\fakepath\\cache-proof.txt');
  };
  const expectEmpty = async () => {
    await expect(upload()).toHaveValue(''); expect(await upload().evaluate((element: HTMLInputElement) => element.files!.length)).toBe(0);
    await widget(scope, 'Read upload').click(); await expect(widget(scope, 'Upload readback')).toHaveText('file=');
  };
  await choose(); await expectSelected();
  await widget(scope, 'Hide upload').click(); await expect(upload()).toHaveCount(0);
  await widget(scope, 'Show upload').click(); await expectSelected();
  await widget(scope, 'Switch away').click(); await expect(widget(scope, 'Other state label')).toHaveText('Other state is active'); await expect(upload()).toHaveCount(0);
  await widget(scope, 'Switch back').click(); await expectSelected();
  // Clearing while no control is mounted must invalidate the private File cache.
  await widget(scope, 'Hide upload').click(); await widget(scope, 'Clear upload').click(); await widget(scope, 'Show upload').click(); await expectEmpty();
  await choose(); await widget(scope, 'Switch away').click(); await widget(scope, 'Clear upload').click(); await widget(scope, 'Switch back').click(); await expectEmpty();
  await choose(); await widget(scope, 'Leave page').click(); await expect(widget(scope, 'Destination marker')).toHaveText('Destination');
  await widget(scope, 'Return to input page').click(); await expectEmpty();
  await choose(); await expectSelected(); await restart(); await expectEmpty();
  await expect(scope.locator('[role="alert"],output').filter({ hasText: /\S/ })).toHaveCount(0);
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: fixed step base, incomplete numbers and transient file remounts`, async ({ page, browser }, info) => {
  test.setTimeout(60_000);
  const doc = fixture(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  await page.goto('/'); await open(page, doc); await expect(page.locator('.titlebar')).toContainText(doc.name);
  const before = await save(page, info.outputPath('before.rea.json')); expect(before).toEqual(doc);
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click();
    await exercise(page, page.locator('.preview-overlay'), async () => { await page.getByTitle('Restart prototype', { exact: true }).click(); });
    await page.screenshot({ path: info.outputPath('input-edge-preview.png') }); await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  } else {
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const filename = info.outputPath('input-edge.html'); await (await pending).saveAs(filename);
    const context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1000 } });
    try {
      const offline = await context.newPage(), network: string[] = []; offline.on('pageerror', error => errors.push(error.message));
      offline.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
      await offline.goto(pathToFileURL(filename).href);
      await exercise(offline, offline.locator('body'), async () => { await offline.reload(); });
      await offline.screenshot({ path: info.outputPath('input-edge-offline.png') }); expect(network).toEqual([]);
    } finally { await context.close(); }
  }
  expect(await save(page, info.outputPath('after.rea.json'))).toEqual(before); expect(errors).toEqual([]);
});
