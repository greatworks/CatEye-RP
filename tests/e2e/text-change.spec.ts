import { expect, test, type Locator, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Interaction } from '../../src/model/types';

type Scope = Page | Locator;
const widget = (scope: Scope, name: string) => scope.locator(`.widget[aria-label="${name}"]`);
function change(actions: Omit<Action, 'id'>[]): Interaction {
  return { id: uid(), name: 'Text changed', event: 'change', enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: uid() })) };
}
function fixture() {
  const doc = createDocument(); doc.name = 'Text input change timing'; doc.caseSelection = 'never'; doc.variables = {};
  for (const [index, kind] of ['input', 'password', 'textarea', 'select'].entries()) {
    const field = createWidget(kind === 'password' ? 'input' : kind as 'input' | 'textarea' | 'select', 40, 40 + index * 155);
    field.name = `${kind} field`; field.text = kind === 'select' ? 'First' : ''; field.width = 340; field.height = kind === 'textarea' ? 95 : 45;
    if (kind === 'password') field.inputType = 'password';
    if (kind === 'select') field.options = ['First', 'Second', 'Third'];
    const count = createWidget('text', 420, field.y), value = createWidget('text', 420, field.y + 45);
    count.name = `${kind} count`; count.text = `[[${kind}Count]]`; count.width = 450;
    value.name = `${kind} value`; value.text = 'Not changed'; value.width = 650; value.height = 95;
    doc.variables[`${kind}Count`] = '0';
    field.interactions = [change([
      { type: 'setVariable', targetId: `${kind}Count`, value: `[[${kind}Count + 1]]` },
      { type: 'setText', targetId: value.id, value: `[[Widget.${field.id}.text]]` },
    ])];
    doc.pages[0].widgets.push(field, count, value);
  }
  const blur = createWidget('button', 40, 690); blur.name = 'Blur target'; blur.text = 'Finish editing'; doc.pages[0].widgets.push(blur);
  return doc;
}
async function settled(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function exercise(page: Page, scope: Scope) {
  for (const kind of ['input', 'password', 'textarea'] as const) {
    const field = scope.locator(`${kind === 'textarea' ? 'textarea' : 'input'}[aria-label="${kind} field"]`);
    await field.click(); await field.pressSequentially('A');
    await expect(field).toBeFocused(); await expect(widget(scope, `${kind} count`)).toHaveText('1');
    await expect(widget(scope, `${kind} value`)).toHaveText('A');
    if (kind === 'textarea') {
      await field.press('Enter'); await expect(widget(scope, `${kind} count`)).toHaveText('2');
      await field.pressSequentially('B');
    } else await field.pressSequentially('B');
    const expected = kind === 'textarea' ? 'A\nB' : 'AB', count = kind === 'textarea' ? '3' : '2';
    await expect(field).toHaveValue(expected); await expect(field).toBeFocused();
    await expect(widget(scope, `${kind} count`)).toHaveText(count);
    expect(await widget(scope, `${kind} value`).textContent()).toBe(expected);
    // A repeated DOM input notification with unchanged text must be ignored.
    await field.dispatchEvent('input'); await field.dispatchEvent('input');
    await settled(page); await expect(widget(scope, `${kind} count`)).toHaveText(count);
    // Native text change is input-driven; change/blur must not dispatch a second case.
    await field.dispatchEvent('change'); await widget(scope, 'Blur target').click();
    await settled(page); await expect(widget(scope, `${kind} count`)).toHaveText(count);
    expect(await widget(scope, `${kind} value`).textContent()).toBe(expected);
  }
  const select = scope.locator('select[aria-label="select field"]');
  await select.selectOption('Second'); await expect(widget(scope, 'select count')).toHaveText('1');
  await expect(widget(scope, 'select value')).toHaveText('Second');
  await select.dispatchEvent('input'); await settled(page); await expect(widget(scope, 'select count')).toHaveText('1');
  await select.selectOption('Third'); await expect(widget(scope, 'select count')).toHaveText('2');
  await expect(widget(scope, 'select value')).toHaveText('Third');
  await widget(scope, 'Blur target').click(); await settled(page); await expect(widget(scope, 'select count')).toHaveText('2');
  await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: text input fires change while typing, deduplicates unchanged text and keeps select change separate`, async ({ page, browser }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  const doc = fixture(); await (await chooser).setFiles({ name: 'text-change.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page, page.locator('.preview-overlay'));
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const path = info.outputPath('text-change.html'); await (await download).saveAs(path);
    const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
    try {
      const exported = await context.newPage(), requests: string[] = [];
      exported.on('pageerror', error => errors.push(error.message)); exported.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      await exported.goto(pathToFileURL(path).href); await exercise(exported, exported); expect(requests).toEqual([]);
    } finally { await context.close(); }
  }
  expect(errors).toEqual([]);
});
