import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Document, Interaction } from '../../src/model/types';

function fixture() {
  const doc = createDocument(); doc.name = 'Row option menu source'; doc.caseSelection = 'auto';
  const result = createWidget('text', 40, 350); result.name = 'Chosen row'; result.text = 'No choice run'; result.width = 500;
  const field = createWidget('select', 12, 8); field.name = 'Row choices'; field.options = ['A', 'B', 'B', '']; field.selectedIndices = [0]; field.width = 240; field.height = 40;
  field.interactions = ['Read this row', 'Other choice'].map((name): Interaction => ({ id: uid(), name, event: 'change', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setText', targetId: result.id, value: `${name}: [[Item.Name]] / [[Widget.${field.id}.text]]` }] }));
  const button = createWidget('button', 270, 8); button.name = button.text = 'Set B'; button.width = 110; button.height = 40;
  button.interactions = [{ id: uid(), name: 'Set this row to B', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setSelectedOption', targetId: field.id, value: 'B' }] }];
  const repeater = createWidget('repeater', 40, 70); repeater.name = 'Choices by row'; repeater.width = 400; repeater.height = 210;
  repeater.repeater = { columns: ['Name'], rows: [{ Name: 'Alpha' }, { Name: 'Beta' }], template: [field, button], itemHeight: 70, gap: 20 };
  doc.pages[0].widgets = [repeater, result]; return doc;
}
async function fileMenu(page: Page, name: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click();
}
async function save(page: Page, path: string): Promise<Document> {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); await (await download).saveAs(path); return JSON.parse(await readFile(path, 'utf8'));
}
async function exercise(player: Page, scope: Locator) {
  const controls = scope.locator('select[aria-label="Row choices"]'), first = controls.nth(0), second = controls.nth(1), menu = scope.getByRole('menu', { name: 'Choose a case', exact: true }), result = scope.locator('.widget[aria-label="Chosen row"]');
  await expect(controls).toHaveCount(2);
  const selected = (element: HTMLSelectElement) => Array.from(element.selectedOptions, option => option.index);
  async function assertMenu() {
    await expect(menu).toHaveCount(1); await expect(menu.getByRole('menuitem')).toHaveCount(2); await expect(result).toHaveText('No choice run');
    const sourceRect = await second.boundingBox(), menuRect = await menu.boundingBox(); expect(sourceRect).not.toBeNull(); expect(menuRect).not.toBeNull();
    expect(Math.abs(menuRect!.x - sourceRect!.x)).toBeLessThan(1); expect(Math.abs(menuRect!.y - sourceRect!.y - sourceRect!.height)).toBeLessThan(1);
  }
  async function restored() {
    await expect(second).toBeFocused(); await expect(first).not.toBeFocused();
    await player.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(menu).toHaveCount(0); await expect(second).toBeFocused(); expect(await first.evaluate(selected)).toEqual([0]); await expect(result).toHaveText('No choice run');
  }
  // Choose the second duplicate by its identity, not by its repeated value.
  await second.selectOption({ index: 2 }); await assertMenu(); expect(await second.evaluate(selected)).toEqual([2]);
  await menu.getByRole('button', { name: 'Cancel', exact: true }).click(); await restored();
  await second.selectOption({ index: 3 }); await assertMenu(); await player.keyboard.press('Escape'); await restored(); expect(await second.evaluate(selected)).toEqual([3]);
  // A programmatic choice must anchor to its target select, not to the row's
  // triggering button or the first DOM instance of that template widget.
  await scope.locator('.widget[aria-label="Set B"]').nth(1).click(); await assertMenu(); expect(await second.evaluate(selected)).toEqual([1]);
  await menu.getByRole('button', { name: 'Cancel', exact: true }).click(); await restored();
  await second.selectOption({ index: 3 }); await assertMenu(); await menu.getByRole('button', { name: 'Cancel', exact: true }).click(); await restored();
  await second.selectOption({ index: 1 }); await assertMenu(); await menu.getByRole('menuitem', { name: 'Read this row', exact: true }).click();
  await expect(result).toHaveText('Read this row: Beta / B'); await expect(menu).toHaveCount(0); await expect(second).toBeFocused(); await expect(first).not.toBeFocused(); expect(await second.evaluate(selected)).toEqual([1]);
  await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: change menus keep the second row source, exact duplicate choice and focus after Cancel or Escape`, async ({ page, browser }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  const doc = fixture(); await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'dropdown-case-menu.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) }); await expect(page.locator('.titlebar')).toContainText(doc.name);
  expect(await save(page, info.outputPath('before.rea.json'))).toEqual(doc);
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page, page.locator('.preview-overlay')); await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const path = info.outputPath('row-selection.html'); await (await download).saveAs(path);
    const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
    try {
      const player = await context.newPage(), network: string[] = []; player.on('pageerror', error => errors.push(error.message)); player.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
      await player.goto(pathToFileURL(path).href); await exercise(player, player.locator('body')); expect(network).toEqual([]);
    } finally { await context.close(); }
  }
  expect(await save(page, info.outputPath('after.rea.json'))).toEqual(doc); expect(errors).toEqual([]);
});
