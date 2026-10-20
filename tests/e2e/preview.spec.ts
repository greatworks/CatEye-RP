import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, uid } from '../../src/model/document';
import type { Action, Document as ProjectDocument, EventType, Interaction } from '../../src/model/types';

function interaction(actions: Omit<Action, 'id'>[], event: EventType = 'click'): Interaction {
  return { id: uid(), name: `${event} fixture`, event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) };
}

async function importFixture(page: Page, document: ProjectDocument) {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'runtime-fixture.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  await expect(page.locator('.titlebar')).toContainText(document.name);
}

function restartFixture(): ProjectDocument {
  const doc = createDocument(); doc.name = 'Restart regression'; doc.variables = { Boot: 'unloaded' };
  const page = doc.pages[0];
  const status = createWidget('text', 40, 40); status.name = 'Load status'; status.text = '[[Boot]]'; status.width = 350;
  const mutate = createWidget('button', 40, 100); mutate.name = 'Change variable'; mutate.text = 'Change variable';
  mutate.interactions = [interaction([{ type: 'setVariable', targetId: 'Boot', value: 'changed' }])];
  const delayed = createWidget('button', 220, 100); delayed.name = 'Start delayed action'; delayed.text = 'Start delayed';
  delayed.interactions = [interaction([{ type: 'setVariable', targetId: 'Boot', value: 'pending' }, { type: 'wait', duration: 400 }, { type: 'setVariable', targetId: 'Boot', value: 'stale result' }])];
  const log = createWidget('repeater', 40, 200); log.name = 'Load events';
  log.repeater!.rows = [];
  log.repeater!.template[0].name = 'Load event';
  page.interactions = [interaction([{ type: 'setVariable', targetId: 'Boot', value: 'loaded' }, { type: 'addRow', targetId: log.id, value: '{"Name":"page load"}' }], 'load')];
  status.interactions = [interaction([{ type: 'addRow', targetId: log.id, value: '{"Name":"widget load"}' }], 'load')];
  page.widgets = [status, mutate, delayed, log];
  return doc;
}

function literalFixture(): ProjectDocument {
  const doc = createDocument(); doc.name = 'Literal text regression'; doc.variables = { UserName: 'Alex' };
  const page = doc.pages[0];
  const input = createWidget('input', 40, 40); input.name = 'Literal input';
  const output = createWidget('text', 40, 160); output.name = 'Literal output'; output.text = 'Awaiting input'; output.width = 500;
  const echo = createWidget('button', 300, 40); echo.name = 'Echo literal'; echo.text = 'Echo literal';
  echo.interactions = [interaction([{ type: 'setText', targetId: output.id, value: `[[Widget.${input.id}.text]]` }])];
  const repeater = createWidget('repeater', 40, 240); repeater.name = 'Literal rows'; repeater.width = 760; repeater.height = 160;
  const rowText = createWidget('text', 8, 8); rowText.name = 'Row literal label'; rowText.text = '[[Item.Name]]'; rowText.width = 260;
  const rowInput = createWidget('input', 280, 8); rowInput.name = 'Row literal input'; rowInput.text = '[[Item.Name]]';
  const rowEcho = createWidget('button', 540, 8); rowEcho.name = 'Echo row literal'; rowEcho.text = 'Echo row';
  rowEcho.interactions = [interaction([{ type: 'setText', targetId: output.id, value: '[[Item.Name]]' }])];
  repeater.repeater = { columns: ['Name'], rows: [{ Name: '[[UserName]]' }, { Name: '[[Item.Name]]' }], template: [rowText, rowInput, rowEcho], itemHeight: 60, gap: 8 };
  page.widgets = [input, output, echo, repeater];
  return doc;
}

async function assertLiteralInputs(scope: Page | Locator) {
  const input = scope.getByRole('textbox', { name: 'Literal input', exact: true });
  for (const literal of ['[[UserName]]', '[[Item.Name]]']) {
    await input.fill(literal);
    await input.press('Tab');
    await expect(input).toHaveValue(literal);
    await scope.locator('.widget[aria-label="Echo literal"]').click();
    await expect(scope.locator('.widget[aria-label="Literal output"]')).toHaveText(literal);
    await expect(input).toHaveValue(literal);
  }
  await expect(scope.locator('.widget[aria-label="Row literal label"]')).toHaveText(['[[UserName]]', '[[Item.Name]]']);
  const rowInputs = scope.getByRole('textbox', { name: 'Row literal input', exact: true });
  await expect(rowInputs.nth(0)).toHaveValue('[[UserName]]');
  await expect(rowInputs.nth(1)).toHaveValue('[[Item.Name]]');
  await scope.locator('.widget[aria-label="Echo row literal"]').nth(0).click();
  await expect(scope.locator('.widget[aria-label="Literal output"]')).toHaveText('[[UserName]]');
  await scope.locator('.widget[aria-label="Echo row literal"]').nth(1).click();
  await expect(scope.locator('.widget[aria-label="Literal output"]')).toHaveText('[[Item.Name]]');
}

async function openDemo(page: Page) {
  await page.goto('/');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open interactive example', exact: true }).click();
  await expect(page.locator('.titlebar')).toContainText('Product workspace');
}

test('demo preview supports panel states, navigation and conditional form actions without changing the design', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openDemo(page);
  await page.getByLabel('Zoom', { exact: true }).selectOption('0.75');
  await page.screenshot({ path: testInfo.outputPath('demo-editor.png'), fullPage: true });
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  const preview = page.locator('.preview-overlay');
  await expect(preview.locator('.widget[aria-label="Page title"]')).toContainText('Good morning, Alex');
  await expect(preview.locator('.widget[aria-label="Welcome title"]')).toHaveText('Make something great.');
  await preview.locator('.widget[aria-label="Panel next"]').click();
  await expect(preview.locator('.widget[aria-label="News title"]')).toHaveText('A little more dynamic.');
  await expect(preview.locator('.widget[aria-label="Welcome title"]')).toHaveCount(0);
  await preview.locator('.widget[aria-label="Panel back"]').click();
  await expect(preview.locator('.widget[aria-label="Welcome title"]')).toBeVisible();
  await preview.locator('.widget[aria-label="New project"]').click();
  await expect(preview.locator('.preview-toolbar')).toContainText('Project details');
  await preview.locator('.widget[aria-label="Save project"]').click();
  await expect(preview.locator('.widget[aria-label="Form feedback"]')).toHaveCount(0);
  await preview.getByRole('textbox', { name: 'Project name input', exact: true }).fill('Edge test project');
  await preview.locator('.widget[aria-label="Save project"]').click();
  await expect(preview.locator('.widget[aria-label="Form feedback"]')).toContainText('Created “Edge test project”');
  await page.screenshot({ path: testInfo.outputPath('demo-preview-form.png'), fullPage: true });
  await preview.getByTitle('Restart prototype', { exact: true }).click();
  await expect(preview.locator('.preview-toolbar')).toContainText('Dashboard');
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByTitle('Save', { exact: true }).click();
  const saved = testInfo.outputPath('demo-after-preview.rea.json');
  await (await download).saveAs(saved);
  const doc = JSON.parse(await readFile(saved, 'utf8'));
  expect(doc.variables.LastProject).toBeUndefined();
  const detail = doc.pages.find((item: { name: string }) => item.name === 'Project details');
  expect(detail.widgets.find((item: { name: string }) => item.name === 'Form feedback').hidden).toBe(true);
  expect(detail.widgets.find((item: { name: string }) => item.name === 'Project name input').text).toBe('');
  expect(errors).toEqual([]);
});

test('exported HTML opens from file without network and retains live interactions', async ({ page, browser }, testInfo) => {
  await openDemo(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  const htmlFile = testInfo.outputPath('offline-prototype.html');
  await (await download).saveAs(htmlFile);
  const html = await readFile(htmlFile, 'utf8');
  expect(html).toContain('prototype-data');
  expect(html).not.toMatch(/<script[^>]+src=/i);
  const offline = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
  try {
    const exported = await offline.newPage();
    const requests: string[] = [], errors: string[] = [];
    exported.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    exported.on('pageerror', error => errors.push(error.message));
    await exported.goto(pathToFileURL(htmlFile).href);
    await expect(exported.locator('.widget[aria-label="Page title"]')).toContainText('Good morning, Alex');
    await expect(exported.locator('.widget[aria-label="Project list"] .repeater-row')).toHaveCount(3);
    await exported.locator('.widget[aria-label="Panel next"]').click();
    await expect(exported.locator('.widget[aria-label="News title"]')).toHaveText('A little more dynamic.');
    await exported.locator('.widget[aria-label="Project name"]').first().click();
    await expect(exported.getByRole('textbox', { name: 'Project name input', exact: true })).toBeVisible();
    await exported.getByRole('button', { name: 'Save project', exact: true }).click();
    await expect(exported.locator('.widget[aria-label="Form feedback"]')).toHaveCount(0);
    await exported.getByRole('textbox', { name: 'Project name input', exact: true }).fill('Offline project');
    await exported.getByRole('button', { name: 'Save project', exact: true }).click();
    await expect(exported.locator('.widget[aria-label="Form feedback"]')).toContainText('Created “Offline project”');
    await expect(exported.getByRole('alert')).toBeEmpty();
    await exported.screenshot({ path: testInfo.outputPath('offline-prototype.png'), fullPage: true });
    await exported.getByRole('button', { name: 'Back to dashboard', exact: true }).click();
    await expect(exported.locator('.widget[aria-label="Page title"]')).toBeVisible();
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await offline.close();
  }
});

test('same-page restart reruns page load and discards delayed actions from the previous runtime', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await importFixture(page, restartFixture());
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  const preview = page.locator('.preview-overlay');
  const status = preview.locator('.widget[aria-label="Load status"]');
  await expect(status).toHaveText('loaded');
  const loadEvents = preview.locator('.widget[aria-label="Load event"]');
  await expect(loadEvents).toHaveText(['page load', 'widget load']);
  await preview.locator('.widget[aria-label="Change variable"]').click();
  await expect(status).toHaveText('changed');
  await preview.getByTitle('Restart prototype', { exact: true }).click();
  await expect(status).toHaveText('loaded');
  await expect(loadEvents).toHaveText(['page load', 'widget load']);
  await preview.locator('.widget[aria-label="Start delayed action"]').click();
  await expect(status).toHaveText('pending');
  await preview.getByTitle('Restart prototype', { exact: true }).click();
  await expect(status).toHaveText('loaded');
  // Observe beyond the old action's 400 ms timer: an eventual assertion alone would miss a late stale write.
  await page.waitForTimeout(650);
  await expect(status).toHaveText('loaded');
  await expect(loadEvents).toHaveText(['page load', 'widget load']);
  await page.screenshot({ path: testInfo.outputPath('restart-isolation.png'), fullPage: true });
  expect(errors).toEqual([]);
});

for (const mode of ['preview', 'offline'] as const) {
  test(`${mode}: user input, setText and repeater data preserve literal placeholder syntax`, async ({ page, browser }, testInfo) => {
    await importFixture(page, literalFixture());
    if (mode === 'preview') {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.getByTitle('Preview (F5)', { exact: true }).click();
      await assertLiteralInputs(page.locator('.preview-overlay'));
      await page.screenshot({ path: testInfo.outputPath('literal-preview.png'), fullPage: true });
      expect(errors).toEqual([]);
      return;
    }
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const htmlFile = testInfo.outputPath('literal-offline.html');
    await (await download).saveAs(htmlFile);
    const offline = await browser.newContext({ offline: true });
    try {
      const exported = await offline.newPage();
      const errors: string[] = [];
      exported.on('pageerror', error => errors.push(error.message));
      await exported.goto(pathToFileURL(htmlFile).href);
      await assertLiteralInputs(exported);
      await exported.screenshot({ path: testInfo.outputPath('literal-offline.png'), fullPage: true });
      expect(errors).toEqual([]);
    } finally {
      await offline.close();
    }
  });
}
