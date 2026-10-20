import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, uid } from '../../src/model/document';
import type { Action, Document, EventType, Interaction, WidgetType } from '../../src/model/types';

type Scope = Locator | Page;
const widget = (scope: Scope, name: string) => scope.locator(`.widget[aria-label="${name}"]`);
function interaction(event: EventType, actions: Omit<Action, 'id'>[]): Interaction {
  return { id: uid(), name: event, event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) };
}
const increment = (name: string): Omit<Action, 'id'> => ({ type: 'setVariable', targetId: name, value: `[[${name} + 1]]` });
function fixture(): Document {
  const doc = createDocument(); doc.name = 'Password and focus behavior'; doc.caseSelection = 'never';
  doc.variables = { Focus: '0', Blur: '0', Parent: '0', OtherFocus: '0', OtherBlur: '0', LastPassword: '' };
  const make = (type: WidgetType, name: string, text: string, x: number, y: number, width = 300) => {
    const item = createWidget(type, x, y); Object.assign(item, { name, text, width }); doc.pages[0].widgets.push(item); return item;
  };
  make('input', 'Ordinary text field', '', 40, 40);
  const panel = make('panel', 'Input container', '', 40, 130); panel.height = 160;
  panel.interactions = [interaction('focus', [increment('Parent')]), interaction('blur', [increment('Parent')])];
  const error = make('text', 'Focus error message', 'Please complete the fields', 420, 40, 650);
  const password = createWidget('input', 20, 20); password.name = 'Password field'; password.inputType = 'password';
  password.interactions = [interaction('focus', [increment('Focus'), { type: 'hide', targetId: error.id }]), interaction('blur', [increment('Blur'), { type: 'setVariable', targetId: 'LastPassword', value: `[[Widget.${password.id}.text]]` }])];
  const disabled = createWidget('input', 20, 90); disabled.name = 'Disabled password field'; disabled.inputType = 'password'; disabled.disabled = true;
  disabled.interactions = [interaction('focus', [increment('Focus')]), interaction('blur', [increment('Blur')])];
  panel.states![0].widgets = [password, disabled];
  const show = make('button', 'Show focus error', 'Show error', 420, 100);
  show.interactions = [interaction('click', [{ type: 'show', targetId: error.id }])];
  make('text', 'Password focus counts', 'Focus [[Focus]] Blur [[Blur]] Parent [[Parent]]', 420, 165, 650);
  make('text', 'Password value read by action', '[[LastPassword]]', 420, 215, 650);
  make('text', 'Other control focus counts', 'Focus [[OtherFocus]] Blur [[OtherBlur]]', 420, 270, 650);
  (['textarea', 'select', 'checkbox', 'radio'] as const).forEach((type, index) => {
    const control = make(type, `Focused ${type}`, type === 'select' ? 'Option 1' : type, 40, 330 + index * 105);
    control.interactions = [interaction('focus', [increment('OtherFocus')]), interaction('blur', [increment('OtherBlur')])];
  });
  return doc;
}
async function menu(page: Page, action: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}
async function openFixture(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'input-focus.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function exercise(scope: Scope) {
  const password = scope.locator('input[aria-label="Password field"]');
  const ordinary = scope.locator('input[aria-label="Ordinary text field"]');
  await expect(password).toHaveAttribute('type', 'password'); await expect(ordinary).toHaveAttribute('type', 'text');
  await expect(scope.locator('input[aria-label="Disabled password field"]')).toBeDisabled();
  await expect(widget(scope, 'Focus error message')).toBeVisible();
  await password.click(); await expect(widget(scope, 'Focus error message')).toHaveCount(0);
  await expect(widget(scope, 'Password focus counts')).toHaveText('Focus 1 Blur 0 Parent 0');
  await password.fill('s3cret[[Focus + 1]]'); await password.press('Home'); await password.press('ArrowRight'); await password.press('X');
  await expect(password).toHaveValue('sX3cret[[Focus + 1]]');
  await expect(widget(scope, 'Password focus counts')).toHaveText('Focus 1 Blur 0 Parent 0');
  await ordinary.click();
  await expect(widget(scope, 'Password focus counts')).toHaveText('Focus 1 Blur 1 Parent 0');
  await expect(widget(scope, 'Password value read by action')).toHaveText('sX3cret[[Focus + 1]]');
  await widget(scope, 'Show focus error').click(); await expect(widget(scope, 'Focus error message')).toBeVisible();
  await password.click(); await password.click(); await expect(widget(scope, 'Focus error message')).toHaveCount(0);
  await expect(widget(scope, 'Password focus counts')).toHaveText('Focus 2 Blur 1 Parent 0');
  await password.press('Tab'); // Disabled input is skipped; focus leaves the password once.
  await expect(widget(scope, 'Password focus counts')).toHaveText('Focus 2 Blur 2 Parent 0');
  for (const [index, type] of ['textarea', 'select', 'checkbox', 'radio'].entries()) {
    const tag = type === 'textarea' || type === 'select' ? type : 'input';
    await scope.locator(`${tag}[aria-label="Focused ${type}"]`).click();
    await expect(widget(scope, 'Other control focus counts')).toHaveText(`Focus ${index + 1} Blur ${index}`);
  }
  await ordinary.click(); await expect(widget(scope, 'Other control focus counts')).toHaveText('Focus 4 Blur 4');
  await expect(widget(scope, 'Password focus counts')).toHaveText('Focus 2 Blur 2 Parent 0');
  await expect(password).toHaveValue('sX3cret[[Focus + 1]]');
  await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: password controls preserve raw values and focus/blur dispatch once without container bubbling`, async ({ page, browser }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await openFixture(page, fixture());
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page.locator('.preview-overlay'));
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const path = testInfo.outputPath('password-focus.html'); await (await download).saveAs(path);
    const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
    try {
      const exported = await context.newPage(), requests: string[] = [];
      exported.on('pageerror', error => errors.push(error.message)); exported.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      await exported.goto(pathToFileURL(path).href); await exercise(exported); expect(requests).toEqual([]);
    } finally { await context.close(); }
  }
  expect(errors).toEqual([]);
});

for (const mode of ['preview', 'offline'] as const) test(`${mode}: a focus case menu can be cancelled without restoring focus reopening it`, async ({ page, browser }, testInfo) => {
  const doc = createDocument(); doc.name = 'Focus menu cancellation'; doc.caseSelection = 'always'; doc.variables = { Runs: '0', Blur: '0' };
  const input = createWidget('input', 40, 40); input.name = 'Menu focus input';
  input.interactions = [interaction('focus', [increment('Runs')]), interaction('blur', [increment('Blur')])];
  const other = createWidget('input', 350, 40); other.name = 'Other menu focus input';
  const result = createWidget('text', 40, 140); result.name = 'Menu focus result'; result.text = 'Focus [[Runs]] Blur [[Blur]]'; result.width = 400; doc.pages[0].widgets = [input, other, result];
  await openFixture(page, doc);
  const verify = async (runtimePage: Page, scope: Scope) => {
    await scope.locator('input[aria-label="Menu focus input"]').click();
    const cases = scope.getByRole('menu', { name: 'Choose a case', exact: true }); await expect(cases).toHaveCount(1);
    await expect(cases.getByRole('menuitem')).toHaveText(['focus']); // Menu focus must not create a blur menu.
    await cases.getByRole('button', { name: 'Cancel', exact: true }).click();
    // Let the existing requestAnimationFrame focus restoration finish before checking cancellation.
    await runtimePage.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(cases).toHaveCount(0); await expect(widget(scope, 'Menu focus result')).toHaveText('Focus 0 Blur 0');
    await expect(scope.locator('input[aria-label="Menu focus input"]')).toBeFocused();
    await scope.locator('input[aria-label="Other menu focus input"]').click();
    await expect(cases).toHaveCount(1); await expect(cases.getByRole('menuitem')).toHaveText(['blur']);
    await cases.getByRole('menuitem', { name: 'blur', exact: true }).click();
    await runtimePage.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(cases).toHaveCount(0); await expect(widget(scope, 'Menu focus result')).toHaveText('Focus 0 Blur 1');
  };
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click(); await verify(page, page.locator('.preview-overlay'));
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const path = testInfo.outputPath('password-focus-menu.html'); await (await download).saveAs(path);
    const context = await browser.newContext({ offline: true });
    try { const exported = await context.newPage(); await exported.goto(pathToFileURL(path).href); await verify(exported, exported); }
    finally { await context.close(); }
  }
});

test('Inspector saves and reopens password mode and a Got focus hide action', async ({ page }, testInfo) => {
  page.on('dialog', dialog => dialog.accept());
  const doc = createDocument(), input = createWidget('input', 40, 40), error = createWidget('text', 40, 120);
  doc.name = 'Authored password focus'; input.name = 'Authored password'; error.name = 'Authored error'; error.text = 'Fill both fields';
  doc.pages[0].widgets = [input, error]; await openFixture(page, doc);
  await page.locator('.editor-widget.input').click(); const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await expect(inspector.getByLabel('Input type', { exact: true })).toHaveValue('text');
  await inspector.getByLabel('Input type', { exact: true }).selectOption('password');
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click();
  await inspector.getByRole('button', { name: 'New interaction', exact: true }).click();
  await inspector.getByLabel('Interaction event', { exact: true }).selectOption('focus');
  await inspector.getByRole('button', { name: 'Add action', exact: true }).click();
  await inspector.getByLabel('Action 1 type', { exact: true }).selectOption('hide');
  await inspector.getByLabel('Action 1 target', { exact: true }).selectOption(error.id);
  const save = async (name: string) => { const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const path = testInfo.outputPath(name); await (await download).saveAs(path); return { path, document: JSON.parse(await readFile(path, 'utf8')) as Document }; };
  const saved = await save('password-focus.rea.json');
  expect(saved.document.pages[0].widgets[0]).toMatchObject({ inputType: 'password', interactions: [{ event: 'focus', actions: [{ type: 'hide', targetId: error.id }] }] });
  await menu(page, 'New Ctrl+N'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O'); await (await chooser).setFiles(saved.path);
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  expect((await save('password-focus-reopened.rea.json')).document).toEqual(saved.document);
  await page.locator('.editor-widget.input').click(); await inspector.getByRole('tab', { name: 'Style', exact: true }).click();
  await expect(inspector.getByLabel('Input type', { exact: true })).toHaveValue('password');
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click(); await expect(inspector.getByLabel('Interaction event', { exact: true })).toHaveValue('focus');
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = page.locator('.preview-overlay');
  await expect(widget(preview, 'Authored error')).toBeVisible();
  await preview.locator('input[aria-label="Authored password"]').click(); await expect(widget(preview, 'Authored error')).toHaveCount(0);
  await expect(preview.locator('input[aria-label="Authored password"]')).toHaveAttribute('type', 'password');
});
