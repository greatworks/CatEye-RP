import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function menu(page: Page, name: string, action: string) {
  await page.locator('.menubar').getByRole('button', { name, exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click();
}

async function insert(page: Page, name: string) {
  await page.getByTitle(`Drag ${name} onto the canvas`, { exact: true }).dblclick();
}

async function field(page: Page, name: string, value: string) {
  const input = page.getByRole('complementary', { name: 'Properties inspector' }).getByLabel(name, { exact: true });
  await input.fill(value);
  await input.press('Tab');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.application')).toBeVisible();
  await expect(page.locator('.canvas-surface')).toBeVisible();
});

test('library drag, move, resize, text, undo/redo, copy and page switching', async ({ page }, testInfo) => {
  const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await page.getByTitle('Drag Box onto the canvas', { exact: true }).dragTo(page.locator('.canvas-surface'), { targetPosition: { x: 150, y: 130 } });
  const widget = page.locator('.editor-widget');
  await expect(widget).toHaveCount(1);
  const originalX = Number(await inspector.getByLabel('X', { exact: true }).inputValue());
  const originalY = Number(await inspector.getByLabel('Y', { exact: true }).inputValue());
  const box = await widget.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 40, box!.y + 35);
  await page.mouse.down();
  await page.mouse.move(box!.x + 110, box!.y + 85, { steps: 5 });
  await page.mouse.up();
  await expect(inspector.getByLabel('X', { exact: true })).toHaveValue(String(originalX + 70));
  await expect(inspector.getByLabel('Y', { exact: true })).toHaveValue(String(originalY + 50));

  await field(page, 'W', '240');
  await field(page, 'H', '120');
  await expect(widget).toHaveCSS('width', '240px');
  await expect(widget).toHaveCSS('height', '120px');
  const handle = await page.locator('.resize-handle.se').boundingBox();
  expect(handle).not.toBeNull();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle!.x + handle!.width / 2 + 30, handle!.y + handle!.height / 2 + 20, { steps: 4 });
  await page.mouse.up();
  await expect(inspector.getByLabel('W', { exact: true })).toHaveValue('270');
  await expect(inspector.getByLabel('H', { exact: true })).toHaveValue('140');

  await inspector.getByLabel('Widget text', { exact: true }).fill('Hello prototype');
  await expect(widget.locator('.widget-text')).toHaveText('Hello prototype');
  await page.getByTitle('Undo', { exact: true }).click();
  await expect(widget.locator('.widget-text')).toHaveText('');
  await page.getByTitle('Redo', { exact: true }).click();
  await expect(widget.locator('.widget-text')).toHaveText('Hello prototype');
  await widget.click();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect(page.locator('.editor-widget')).toHaveCount(2);
  await expect(page.locator('.editor-widget .widget-text')).toHaveText(['Hello prototype', 'Hello prototype']);

  await page.getByTitle('Add page', { exact: true }).click();
  await expect(inspector.getByLabel('Page name', { exact: true })).toHaveValue('Page 2');
  await expect(page.locator('.editor-widget')).toHaveCount(0);
  await page.locator('.tree-list').getByRole('button', { name: 'Page 1', exact: true }).dblclick();
  await expect(page.locator('.editor-widget')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('editor-layout.png'), fullPage: true });
});

test('interaction editor persists disabled state, conditions, multiple actions and page navigation', async ({ page }, testInfo) => {
  const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await page.getByTitle('Add page', { exact: true }).click();
  await page.locator('.tree-list').getByRole('button', { name: 'Page 1', exact: true }).dblclick();
  await insert(page, 'Button');
  await field(page, 'Widget name', 'Open details');
  await inspector.getByLabel('Widget text', { exact: true }).fill('Launch');
  await inspector.getByRole('tab', { name: 'Interactions', exact: true }).click();
  await inspector.getByRole('button', { name: 'New interaction', exact: true }).click();
  await inspector.getByLabel('Case name', { exact: true }).fill('Launch when ready');
  await inspector.getByRole('button', { name: 'Add condition', exact: true }).click();
  await inspector.getByLabel('Condition source', { exact: true }).selectOption('widgetText');
  await inspector.getByLabel('Condition target', { exact: true }).selectOption({ label: 'Open details' });
  await inspector.getByLabel('Condition comparison', { exact: true }).selectOption('equals');
  await inspector.getByLabel('Condition value', { exact: true }).fill('Launch');
  await inspector.getByLabel('Condition match mode', { exact: true }).selectOption('all');

  await inspector.getByRole('button', { name: 'Add action', exact: true }).click();
  await inspector.getByLabel('Action 1 type', { exact: true }).selectOption('setText');
  await inspector.getByLabel('Action 1 target', { exact: true }).selectOption({ label: 'Open details' });
  await inspector.getByLabel('Action value', { exact: true }).fill('Ready');
  await inspector.getByRole('button', { name: 'Add action', exact: true }).click();
  await inspector.getByLabel('Action 2 type', { exact: true }).selectOption('openPage');
  await inspector.getByLabel('Target page', { exact: true }).selectOption({ label: 'Page 2' });
  await inspector.getByLabel('Enable Launch when ready', { exact: true }).uncheck();
  await page.screenshot({ path: testInfo.outputPath('interaction-editor.png'), fullPage: true });
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  const preview = page.locator('.preview-overlay');
  await preview.locator('.widget[aria-label="Open details"]').click();
  await expect(preview.locator('.preview-toolbar')).toContainText('Page 1');
  await expect(preview.locator('.widget[aria-label="Open details"]')).toContainText('Launch');
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click();
  await inspector.getByLabel('Enable Launch when ready', { exact: true }).check();
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  await preview.locator('.widget[aria-label="Open details"]').click();
  await expect(preview.locator('.preview-toolbar')).toContainText('Page 2');
  await preview.getByRole('button', { name: 'Page 1', exact: true }).click();
  // Re-entering a page rebuilds its controls from the authored values.
  await expect(preview.locator('.widget[aria-label="Open details"]')).toContainText('Launch');
  await preview.locator('.widget[aria-label="Open details"]').click();
  await expect(preview.locator('.preview-toolbar')).toContainText('Page 2');
});

test('panel states, repeater JSON validation, notes and saved project import roundtrip', async ({ page }, testInfo) => {
  page.on('dialog', dialog => dialog.accept());
  const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await insert(page, 'Dynamic panel');
  await field(page, 'Widget name', 'States fixture');
  await inspector.getByRole('button', { name: 'Add state', exact: true }).click();
  await inspector.getByLabel('State name State 2', { exact: true }).fill('Details');
  await expect(inspector.getByLabel('Show Details', { exact: true })).toBeChecked();
  await inspector.getByLabel('Show State 1', { exact: true }).check();
  await expect(inspector.getByLabel('Show State 1', { exact: true })).toBeChecked();
  await insert(page, 'Repeater');
  await field(page, 'Widget name', 'Contacts fixture');
  const rows = inspector.getByLabel('Rows', { exact: true });
  await rows.fill('[{"Name":42}]');
  await inspector.getByRole('button', { name: 'Apply rows', exact: true }).click();
  await expect(inspector.getByRole('alert')).toContainText('text values');
  await rows.fill('[{"Name":"Alice"},{"Name":"Bob"}]');
  await inspector.getByRole('button', { name: 'Apply rows', exact: true }).click();
  await expect(inspector.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.editor-widget.repeater .repeater-row')).toHaveCount(2);
  await expect(page.locator('.editor-widget.repeater')).toContainText('Alice');
  await inspector.getByRole('tab', { name: 'Notes', exact: true }).click();
  await inspector.getByLabel('Widget notes', { exact: true }).fill('Reusable contact list — 中文备注');

  const firstDownload = page.waitForEvent('download');
  await page.getByTitle('Save', { exact: true }).click();
  const firstFile = testInfo.outputPath('roundtrip.rea.json');
  await (await firstDownload).saveAs(firstFile);
  const original = JSON.parse(await readFile(firstFile, 'utf8'));
  expect(original.pages[0].widgets).toHaveLength(2);
  expect(original.pages[0].widgets[0].states.map((state: { name: string }) => state.name)).toEqual(['State 1', 'Details']);
  expect(original.pages[0].widgets[1].repeater.rows).toEqual([{ Name: 'Alice' }, { Name: 'Bob' }]);
  expect(original.pages[0].widgets[1].notes).toBe('Reusable contact list — 中文备注');

  await menu(page, 'File', 'New Ctrl+N');
  await expect(page.locator('.editor-widget')).toHaveCount(0);
  const chooser = page.waitForEvent('filechooser');
  await menu(page, 'File', 'Open… Ctrl+O');
  await (await chooser).setFiles(firstFile);
  await expect(page.locator('.statusbar')).toContainText('Document opened');
  await expect(page.locator('.editor-widget')).toHaveCount(2);
  await expect(page.locator('.editor-widget.repeater')).toContainText('Bob');
  const secondDownload = page.waitForEvent('download');
  await page.getByTitle('Save', { exact: true }).click();
  const secondFile = testInfo.outputPath('roundtrip-restored.rea.json');
  await (await secondDownload).saveAs(secondFile);
  expect(JSON.parse(await readFile(secondFile, 'utf8'))).toEqual(original);
  await page.screenshot({ path: testInfo.outputPath('roundtrip-restored.png'), fullPage: true });
});

test('linked components sync content, preserve placement, roundtrip without duplicate IDs and detach independently', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  await insert(page, 'Text');
  await inspector.getByLabel('Widget text', { exact: true }).fill('Component version 1');
  await menu(page, 'Arrange', 'Create component');
  const componentPrompt = page.getByRole('dialog', { name: 'Component name', exact: true });
  await componentPrompt.getByRole('textbox', { name: 'Component name', exact: true }).fill('Reusable caption');
  await componentPrompt.getByRole('button', { name: 'OK', exact: true }).click();
  const components = page.locator('.component-list');
  await expect(components.getByRole('button', { name: 'Reusable caption', exact: true })).toBeVisible();
  await components.getByRole('button', { name: 'Reusable caption', exact: true }).click();
  await field(page, 'Widget name', 'Instance one');
  await field(page, 'X', '100');
  await field(page, 'Y', '200');
  await components.getByRole('button', { name: 'Reusable caption', exact: true }).click();
  await field(page, 'Widget name', 'Instance two');
  await field(page, 'X', '420');
  await field(page, 'Y', '300');
  const instances = page.locator('.editor-widget.panel');
  await expect(instances).toHaveCount(2);
  await expect(instances.nth(0)).toHaveCSS('left', '100px');
  await expect(instances.nth(1)).toHaveCSS('left', '420px');

  async function publish(text: string) {
    await instances.nth(0).dblclick();
    const child = page.locator('.editor-widget.text');
    await expect(child).toHaveCount(1);
    await child.click();
    await inspector.getByLabel('Widget text', { exact: true }).fill(text);
    await components.getByRole('button', { name: 'Update linked copies', exact: true }).click();
    await expect(page.locator('.statusbar')).toContainText('Component changes applied to all linked copies');
    await page.locator('.page-tabs').getByRole('button', { name: 'Exit Instance one', exact: true }).click();
  }

  async function save(name: string) {
    const download = page.waitForEvent('download');
    await page.getByTitle('Save', { exact: true }).click();
    const path = testInfo.outputPath(name);
    await (await download).saveAs(path);
    await expect(page.locator('.statusbar')).toContainText('Saved');
    const doc = JSON.parse(await readFile(path, 'utf8'));
    const ids: string[] = [];
    const collect = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if (!Array.isArray(value) && typeof (value as { id?: unknown }).id === 'string') ids.push((value as { id: string }).id);
      Object.values(value).forEach(collect);
    };
    collect(doc);
    expect(new Set(ids).size).toBe(ids.length);
    return { path, doc };
  }

  await publish('Component version 2');
  await expect(instances.nth(0)).toContainText('Component version 2');
  await expect(instances.nth(1)).toContainText('Component version 2');
  await expect(instances.nth(0)).toHaveCSS('top', '200px');
  await expect(instances.nth(1)).toHaveCSS('top', '300px');
  const linked = await save('components-linked.rea.json');
  expect(linked.doc.components).toHaveLength(1);
  expect(linked.doc.pages[0].widgets.filter((widget: { componentInstance?: unknown }) => widget.componentInstance)).toHaveLength(2);
  await menu(page, 'File', 'New Ctrl+N');
  const chooser = page.waitForEvent('filechooser');
  await menu(page, 'File', 'Open… Ctrl+O');
  await (await chooser).setFiles(linked.path);
  await expect(page.locator('.statusbar')).toContainText('Document opened');
  await expect(instances).toHaveCount(2);
  await expect(instances.nth(1)).toContainText('Component version 2');
  await expect(instances.nth(1)).toHaveCSS('left', '420px');

  await instances.nth(1).click();
  await components.getByRole('button', { name: 'Detach selected instance', exact: true }).click();
  await expect(components.getByRole('button', { name: 'Detach selected instance', exact: true })).toBeDisabled();
  await publish('Component version 3');
  await expect(instances.nth(0)).toContainText('Component version 3');
  await expect(instances.nth(1)).toContainText('Component version 2');
  const detached = await save('components-detached.rea.json');
  const first = detached.doc.pages[0].widgets.find((widget: { name: string }) => widget.name === 'Instance one');
  const second = detached.doc.pages[0].widgets.find((widget: { name: string }) => widget.name === 'Instance two');
  expect(first.componentInstance).toBeDefined();
  expect(second.componentInstance).toBeUndefined();
  expect(second.componentId).toBeUndefined();
  expect(first.states[0].widgets[0].text).toBe('Component version 3');
  expect(second.states[0].widgets[0].text).toBe('Component version 2');
  await page.screenshot({ path: testInfo.outputPath('component-sync-and-detach.png'), fullPage: true });
  expect(errors).toEqual([]);
});
