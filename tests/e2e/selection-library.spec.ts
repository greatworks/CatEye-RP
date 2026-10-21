import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';

async function save(page: Page, info: TestInfo, name: string): Promise<Document> {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath(`${name}.rea.json`); await (await download).saveAs(file);
  return JSON.parse(await readFile(file, 'utf8'));
}
async function open(page: Page, doc: Document) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'library.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
}

for (const type of ['checkbox', 'radio'] as const) for (const entry of ['double-click', 'drag', 'canvas', 'quick'] as const) {
  test(`${type} ${entry}: library declarations reach author controls, undo and saved files`, async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const before = await save(page, info, 'before');
    const libraryName = type === 'checkbox' ? 'Checkbox' : 'Radio button';
    const library = page.getByTitle(`Drag ${libraryName} onto the canvas`, { exact: true });
    if (entry === 'double-click') await library.dblclick();
    else if (entry === 'drag') await library.dragTo(page.locator('.canvas-surface'), { targetPosition: { x: 300, y: 230 } });
    else if (entry === 'canvas') { await library.click(); await page.locator('.canvas-surface').click({ position: { x: 300, y: 230 } }); }
    else {
      await page.getByTitle('Quick actions (/)', { exact: true }).click();
      await page.getByPlaceholder('Insert a widget or go to a page…').fill(libraryName);
      await page.locator('.quick-dialog section').getByRole('button', { name: `${libraryName} Insert widget`, exact: true }).click();
    }
    const owner = page.locator(`.editor-widget.${type}`);
    await expect(owner).toHaveCount(1);
    await expect(owner.locator('label')).toHaveAttribute('data-selection-display', 'browser-derived');
    await expect(page.locator('.selection-frame .resize-handle')).toHaveCount(2);
    await expect(page.getByLabel('Fit selection width to text', { exact: true })).toBeChecked();
    await expect(page.getByLabel('Fit selection height to text', { exact: true })).not.toBeChecked();
    await expect(page.getByLabel('Indicator size', { exact: true })).toHaveValue('13');
    const created = await save(page, info, 'created'), widget = created.pages[0].widgets[0];
    expect(widget).toMatchObject({ type, width: type === 'checkbox' ? 75 : 93, height: 15,
      text: type === 'checkbox' ? 'Checkbox' : 'Radio Button', checked: false,
      selectionText: { autoFitWidth: true, autoFitHeight: false, alignRight: false },
      style: { fill: '#ffffff', stroke: '#797979', strokeWidth: 1, selectionButtonSize: 13, fontSize: 13, textPadding: [0, 2, 0, 2] },
      disabledStyle: { fill: '#f0f0f0' } });
    await page.getByTitle('Undo', { exact: true }).click();
    expect(await save(page, info, 'undo')).toEqual(before);
    await page.getByTitle('Redo', { exact: true }).click();
    expect(await save(page, info, 'redo')).toEqual(created);
    await open(page, created); await expect(owner.locator('label')).toHaveAttribute('data-selection-display', 'browser-derived');
    expect(await save(page, info, 'reopened')).toEqual(created);
    await owner.click({ position: { x: 25, y: 7 } });
    await page.getByLabel('Selection indicator on right', { exact: true }).check();
    const right = await save(page, info, 'right-side');
    expect(right.pages[0].widgets[0].selectionText).toEqual({ autoFitWidth: true, autoFitHeight: false, alignRight: true });
    await expect(owner.locator('svg')).toHaveCSS('left', `${right.pages[0].widgets[0].width - 13}px`);
    await page.getByTitle('Undo', { exact: true }).click();
    expect(await save(page, info, 'undo-side')).toEqual(created);
    if (entry === 'double-click') await page.screenshot({ path: info.outputPath(`${type}-created.png`) });
    expect(errors).toEqual([]);
  });
}

test('library insertion respects current adaptive branch and disabled fill survives preview', async ({ page }, info) => {
  const doc = createDocument();
  doc.pages[0].adaptiveViews = [
    { id: 'library-mobile', name: 'Mobile', width: 700, overrides: {} },
    { id: 'library-sibling', name: 'Sibling', width: 900, overrides: {} },
  ];
  await page.goto('/'); await open(page, doc);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('library-mobile');
  await page.getByLabel('Affect all views', { exact: true }).uncheck();
  await page.getByTitle('Drag Checkbox onto the canvas', { exact: true }).dblclick();
  const created = await save(page, info, 'branch-created');
  expect(created.pages[0].widgets).toHaveLength(1);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('library-sibling');
  await expect(page.locator('.editor-widget.checkbox')).toHaveCount(0);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('library-mobile');
  await expect(page.locator('.editor-widget.checkbox')).toHaveCount(1);
  expect(await save(page, info, 'branch-view-only')).toEqual(created);
  await page.getByTitle('Undo', { exact: true }).click();
  expect(await save(page, info, 'branch-undo')).toEqual(doc);

  // An explicit disabled fixture exercises the actual template overlay without
  // pretending this verifies original _applySvg state transition eligibility.
  const disabled = structuredClone(created); disabled.pages[0].widgets[0].disabled = true;
  await open(page, disabled);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption('library-mobile');
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  await page.locator('.preview-toolbar').getByLabel('Adaptive view', { exact: true }).selectOption({ label: 'Mobile' });
  const input = page.locator('.preview-overlay input[type=checkbox]');
  await expect(input).toBeDisabled();
  await expect(page.locator('.preview-overlay [data-selection-fill]')).toHaveCSS('fill', 'rgb(240, 240, 240)');
});
