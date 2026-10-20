import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { Document } from '../../src/model/types';

test('inspector corner radii and repeater action selectors serialize, roundtrip and render in both players', async ({ page, browser }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  // This fixture verifies the combined effects of independent cases, without user case selection.
  await page.locator('.menubar').getByRole('button', { name: 'Project', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Prototype settings…', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Prototype settings', exact: true });
  await settings.getByLabel('Case selection', { exact: true }).selectOption('never');
  await settings.getByRole('button', { name: 'Apply', exact: true }).click();
  const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  const field = async (label: string, value: string) => {
    const input = inspector.getByLabel(label, { exact: true }); await input.fill(value); await input.press('Tab');
  };
  const insert = (name: string) => page.getByTitle(`Drag ${name} onto the canvas`, { exact: true }).dblclick();
  const save = async (name: string) => {
    const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
    const path = testInfo.outputPath(name); await (await download).saveAs(path);
    return { path, doc: JSON.parse(await readFile(path, 'utf8')) as Document };
  };
  await insert('Box');
  await field('Widget name', 'Independent corners');
  await field('X', '40'); await field('Y', '40'); await field('W', '240'); await field('H', '160');
  await field('Radius', '11');
  await inspector.getByRole('checkbox', { name: 'Independent corner radii', exact: true }).check();
  await field('Top left', '2000');
  await expect(inspector.getByLabel('Top left', { exact: true })).toHaveValue('1000');
  await field('Bottom right', '-5');
  await expect(inspector.getByLabel('Bottom right', { exact: true })).toHaveValue('0');
  // Re-entering the unchanged common value must clear overrides too.
  await inspector.getByLabel('Radius', { exact: true }).fill('');
  await field('Radius', '11');
  await expect(inspector.getByRole('checkbox', { name: 'Independent corner radii', exact: true })).not.toBeChecked();
  await expect(page.locator('.editor-widget.box')).toHaveCSS('border-radius', '11px');
  const uniform = await save('uniform-corner-check.rea.json');
  expect(uniform.doc.pages[0].widgets[0].style.radius).toBe(11);
  expect(uniform.doc.pages[0].widgets[0].style).not.toHaveProperty('cornerRadii');
  await inspector.getByRole('checkbox', { name: 'Independent corner radii', exact: true }).check();
  for (const [label, value] of [['Top left', '10'], ['Top right', '20'], ['Bottom right', '30'], ['Bottom left', '40']]) await field(label, value);
  await field('Fill', '#20b8a6');
  await expect(page.locator('.editor-widget.box')).toHaveCSS('border-radius', '10px 20px 30px 40px');

  await insert('Repeater');
  await field('Widget name', 'Inspector rows'); await field('X', '360'); await field('Y', '40');
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click();
  await inspector.getByRole('button', { name: 'New interaction', exact: true }).click();
  await inspector.getByLabel('Interaction event', { exact: true }).selectOption('itemLoad');
  await inspector.getByLabel('Case name', { exact: true }).fill('Load every item');

  await insert('Button');
  await field('Widget name', 'Apply inspector updates');
  await inspector.getByRole('tab', { name: 'Style', exact: true }).click();
  await field('X', '40'); await field('Y', '240'); await field('W', '240');
  await inspector.getByLabel('Widget text', { exact: true }).fill('Apply inspector updates');
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click();
  const values = ['This row', 'All rows', 'Index "quoted"', "Match 'single quote'"];
  for (const [index, mode] of ['this', 'all', 'index', 'matching'].entries()) {
    // Each update must run independently; default appended cases now form an ELSE chain.
    await inspector.getByRole('button', { name: index === 0 ? 'New interaction' : 'New IF', exact: true }).click();
    const card = inspector.locator('.inspector-case').nth(index);
    await expect(card.getByLabel('Interaction event', { exact: true }).locator('option[value="itemLoad"]')).toHaveCount(0);
    await card.getByLabel('Case name', { exact: true }).fill(`Update ${mode}`);
    if (mode === 'this') await card.getByLabel('Enable Update this', { exact: true }).uncheck();
    await card.getByRole('button', { name: 'Add action', exact: true }).click();
    await card.getByLabel('Action 1 type', { exact: true }).selectOption('updateRow');
    await card.getByLabel('Action 1 target', { exact: true }).selectOption({ label: 'Inspector rows' });
    await card.getByLabel('Rows to update', { exact: true }).selectOption(mode);
    if (mode === 'index') {
      const input = card.getByLabel('Update row index (starts at 0)', { exact: true }); await input.fill('1'); await input.press('Tab');
    }
    if (mode === 'matching') {
      await card.getByLabel('Update match column', { exact: true }).selectOption('Name');
      await card.getByLabel('Update match comparison', { exact: true }).selectOption('equals');
      await card.getByLabel('Update match value', { exact: true }).fill('All rows');
    }
    if (mode === 'all') {
      await card.getByLabel('Updated columns', { exact: true }).fill('{"Unknown":"bad"}');
      await card.getByRole('button', { name: 'Apply updated columns', exact: true }).click();
      await expect(card.getByRole('alert')).toContainText('Unknown');
    }
    await card.getByLabel('Updated columns', { exact: true }).fill(JSON.stringify({ Name: values[index] }));
    await card.getByRole('button', { name: 'Apply updated columns', exact: true }).click();
    await expect(card.getByRole('alert')).toHaveCount(0);
  }
  await page.screenshot({ path: testInfo.outputPath('repeater-inspector-edited.png'), fullPage: true });
  const original = await save('inspector-roundtrip.rea.json');
  const [box, repeater, button] = original.doc.pages[0].widgets;
  expect(box.style.cornerRadii).toEqual([10, 20, 30, 40]); expect(box.style.fill).toBe('#20b8a6');
  expect(repeater.interactions[0].event).toBe('itemLoad');
  expect(button.interactions.map(item => JSON.parse(item.actions[0].value!))).toEqual([
    { row: 'this', values: { Name: values[0] } },
    { row: 'all', values: { Name: values[1] } },
    { row: 1, values: { Name: values[2] } },
    { where: { column: 'Name', operator: 'equals', value: 'All rows' }, values: { Name: values[3] } },
  ]);
  expect(button.interactions[0].enabled).toBe(false);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles(original.path);
  await expect(page.locator('.statusbar')).toContainText('Document opened');
  expect((await save('inspector-roundtrip-restored.rea.json')).doc).toEqual(original.doc);

  const exercise = async (scope: Page | Locator) => {
    const corners = scope.locator('.widget[aria-label="Independent corners"]');
    await expect(corners).toHaveCSS('border-top-left-radius', '10px');
    await expect(corners).toHaveCSS('border-top-right-radius', '20px');
    await expect(corners).toHaveCSS('border-bottom-right-radius', '30px');
    await expect(corners).toHaveCSS('border-bottom-left-radius', '40px');
    await expect(corners).toHaveCSS('background-color', 'rgb(32, 184, 166)');
    await scope.locator('.widget[aria-label="Apply inspector updates"]').click();
    await expect(scope.locator('.widget[aria-label="Inspector rows"] > .repeater-row .widget-text')).toHaveText([values[3], values[2], values[3]]);
    await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
  };
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  await exercise(page.locator('.preview-overlay'));
  await page.screenshot({ path: testInfo.outputPath('repeater-inspector-preview.png'), fullPage: true });
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  const htmlDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  const html = testInfo.outputPath('repeater-inspector-offline.html'); await (await htmlDownload).saveAs(html);
  const offline = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
  try {
    const exported = await offline.newPage(); exported.on('pageerror', error => errors.push(error.message));
    await exported.goto(pathToFileURL(html).href); await exercise(exported);
    await exported.screenshot({ path: testInfo.outputPath('repeater-inspector-offline.png'), fullPage: true });
  } finally { await offline.close(); }
  expect(errors).toEqual([]);
});
