import { expect, test, type Locator, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, uid } from '../../src/model/document';
import type { Action, Document, Interaction, WidgetType } from '../../src/model/types';

function interaction(actions: Omit<Action, 'id'>[]): Interaction {
  return { id: uid(), name: 'Expression fixture', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) };
}

function expressionFixture(): Document {
  const doc = createDocument(); doc.name = 'Safe expression regression';
  doc.variables = { Count: '0', Subtotal: '0', Threshold: '50', Name: ' Ada ' };
  const page = doc.pages[0]; page.width = 1100; page.height = 800;
  const make = (type: WidgetType, name: string, text: string, x: number, y: number, width?: number) => {
    const widget = createWidget(type, x, y); widget.name = name; widget.text = text;
    if (width !== undefined) widget.width = width;
    page.widgets.push(widget); return widget;
  };
  const quantity = make('input', 'Quantity', '3', 40, 40);
  const price = make('input', 'Unit price', '12.5', 300, 40);
  const calculate = make('button', 'Calculate total', 'Calculate', 40, 100);
  const counter = make('text', 'Calculation count', 'Count 0', 300, 105, 500);
  const total = make('text', 'Computed total', 'Awaiting calculation', 40, 170, 700);
  const functions = make('text', 'String function result', 'Awaiting calculation', 40, 215, 700);
  const lazy = make('text', 'Lazy branch result', 'Awaiting calculation', 40, 260, 700);
  calculate.interactions = [interaction([
    { type: 'setVariable', targetId: 'Subtotal', value: `[[Widget.${quantity.id}.text * Widget.${price.id}.text]]` },
    { type: 'setVariable', targetId: 'Count', value: '[[Count + 1]]' },
    { type: 'setText', targetId: total.id, value: '[[concat("Total ", Math.round(Subtotal * 100) / 100)]]' },
    { type: 'setText', targetId: counter.id, value: 'Count [[Count]]' },
    { type: 'setText', targetId: functions.id, value: '[[concat(upper(trim(Name)), ":", len(trim(Name)), ":", substring("abcdef", 1, 4))]]' },
    { type: 'setText', targetId: lazy.id, value: '[[if(Count > 0 && Subtotal >= 0, "ready", 1 / 0)]]' },
  ])];
  const validate = make('button', 'Validate total', 'Validate', 40, 310);
  const decision = make('text', 'Condition result', 'Pending', 300, 315, 500);
  validate.interactions = [{ ...interaction([{ type: 'setText', targetId: decision.id, value: '[[if(Subtotal >= Threshold && Count == 2, "Approved", "Review")]]' }]),
    conditions: [{ source: 'variable', key: 'Subtotal', operator: 'greater', value: '[[Threshold - 10]]' }] }];
  const literal = make('input', 'Expression literal input', '', 40, 370);
  const echo = make('button', 'Echo expression literal', 'Echo literal', 300, 370);
  const literalResult = make('text', 'Expression literal output', 'Awaiting input', 490, 375, 540);
  echo.interactions = [interaction([{ type: 'setText', targetId: literalResult.id, value: `[[Widget.${literal.id}.text]]` }])];
  const threats = [
    ['globalThis', '[[globalThis.__reaExpressionProbe("globalThis")]]'],
    ['window', '[[window.__reaExpressionProbe("window")]]'],
    ['constructor', '[[constructor.constructor("globalThis.__reaExpressionProbe(\'constructor\')")()]]'],
  ];
  threats.forEach(([name, value], index) => {
    const button = make('button', `Reject ${name}`, name, 40 + index * 200, 450, 180);
    button.interactions = [interaction([{ type: 'setText', targetId: literalResult.id, value }])];
  });
  const unsafeRender = make('text', 'Unsafe render text', '[[globalThis.__reaRenderProbe()]]', 40, 530, 720);
  unsafeRender.hidden = true;
  const render = make('button', 'Render unsafe text', 'Render unsafe text', 640, 450, 180);
  render.interactions = [interaction([{ type: 'show', targetId: unsafeRender.id }])];
  return doc;
}

async function installExecutionProbe(page: Page) {
  await page.addInitScript(() => {
    const target = globalThis as unknown as { __reaExpressionExecutions: string[]; __reaExpressionProbe: (source: string) => void; __reaRenderProbe: () => void };
    target.__reaExpressionExecutions = [];
    target.__reaExpressionProbe = source => { target.__reaExpressionExecutions.push(source); };
    target.__reaRenderProbe = () => { target.__reaExpressionExecutions.push('render'); };
  });
}

async function importFixture(page: Page, doc: Document) {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'expressions.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}

async function exerciseExpressions(scope: Page | Locator) {
  const widget = (name: string) => scope.locator(`.widget[aria-label="${name}"]`);
  await scope.getByRole('textbox', { name: 'Quantity', exact: true }).fill('3');
  await scope.getByRole('textbox', { name: 'Unit price', exact: true }).fill('12.5');
  await widget('Calculate total').click();
  await expect(widget('Computed total')).toHaveText('Total 37.5');
  await expect(widget('Calculation count')).toHaveText('Count 1');
  await expect(widget('String function result')).toHaveText('ADA:3:bcd');
  await expect(widget('Lazy branch result')).toHaveText('ready');
  await widget('Validate total').click();
  await expect(widget('Condition result')).toHaveText('Pending');
  await scope.getByRole('textbox', { name: 'Quantity', exact: true }).fill('4');
  await widget('Calculate total').click();
  await expect(widget('Computed total')).toHaveText('Total 50');
  await expect(widget('Calculation count')).toHaveText('Count 2');
  await widget('Validate total').click();
  await expect(widget('Condition result')).toHaveText('Approved');
  const input = scope.getByRole('textbox', { name: 'Expression literal input', exact: true });
  await input.fill('[[Count + 1]]');
  await input.press('Tab');
  await widget('Echo expression literal').click();
  await expect(input).toHaveValue('[[Count + 1]]');
  await expect(widget('Expression literal output')).toHaveText('[[Count + 1]]');
}

async function assertUnsafeExpressionsAreErrors(scope: Page | Locator, runtimePage: Page) {
  for (const name of ['globalThis', 'window', 'constructor']) {
    await scope.locator(`.widget[aria-label="Reject ${name}"]`).click();
    await expect(scope.getByRole('alert')).toContainText(/Expression/i);
    await expect(scope.getByRole('alert')).toContainText(name);
    await expect(scope.locator('.widget[aria-label="Expression literal output"]')).toHaveText('[[Count + 1]]');
    expect(await runtimePage.evaluate(() => (globalThis as unknown as { __reaExpressionExecutions: string[] }).__reaExpressionExecutions)).toEqual([]);
  }
  await scope.locator('.widget[aria-label="Render unsafe text"]').click();
  await expect(scope.getByRole('alert')).toContainText('__reaRenderProbe');
  expect(await runtimePage.evaluate(() => (globalThis as unknown as { __reaExpressionExecutions: string[] }).__reaExpressionExecutions)).toEqual([]);
}

for (const mode of ['preview', 'offline'] as const) {
  test(`${mode}: safe expressions calculate fields and conditions while rejecting script access`, async ({ page, browser }, testInfo) => {
    await installExecutionProbe(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await importFixture(page, expressionFixture());
    if (mode === 'preview') {
      await page.getByTitle('Preview (F5)', { exact: true }).click();
      const preview = page.locator('.preview-overlay');
      await exerciseExpressions(preview);
      await page.screenshot({ path: testInfo.outputPath('expressions-preview.png'), fullPage: true });
      await assertUnsafeExpressionsAreErrors(preview, page);
      await page.screenshot({ path: testInfo.outputPath('expressions-preview-rejection.png'), fullPage: true });
    } else {
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
      const html = testInfo.outputPath('expressions-offline.html');
      await (await download).saveAs(html);
      const offline = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
      try {
        const exported = await offline.newPage();
        await installExecutionProbe(exported);
        exported.on('pageerror', error => errors.push(error.message));
        await exported.goto(pathToFileURL(html).href);
        await exerciseExpressions(exported);
        await exported.screenshot({ path: testInfo.outputPath('expressions-offline.png'), fullPage: true });
        await assertUnsafeExpressionsAreErrors(exported, exported);
        await exported.screenshot({ path: testInfo.outputPath('expressions-offline-rejection.png'), fullPage: true });
      } finally { await offline.close(); }
    }
    expect(errors).toEqual([]);
  });
}
