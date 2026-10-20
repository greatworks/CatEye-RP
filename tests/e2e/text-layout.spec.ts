import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, uid } from '../../src/model/document';
import type { Document, WidgetType } from '../../src/model/types';

type Scope = Page | Locator;
function fixture(): Document {
  const doc = createDocument(); doc.name = 'Text layout proof'; doc.caseSelection = 'never';
  const add = (type: WidgetType, name: string, x: number, y: number, height = 100) => {
    const w = createWidget(type, x, y); Object.assign(w, { name, text: type === 'select' ? 'Option 1' : name, width: 300, height });
    Object.assign(w.style, { strokeWidth: 0, textAlign: 'left' }); doc.pages[0].widgets.push(w); return w;
  };
  for (const [index, verticalAlign] of (['top', 'middle', 'bottom'] as const).entries()) {
    const w = add('text', `Aligned ${verticalAlign}`, 40, 40 + index * 120);
    Object.assign(w.style, { textPadding: [7, 13, 17, 23], verticalAlign, lineHeight: 'normal' });
  }
  const native = add('text', 'Short native label', 40, 415, 16); native.text = 'Password';
  Object.assign(native.style, { textPadding: [0, 0, 0, 0], verticalAlign: 'top', lineHeight: 'normal' });
  const multiline = add('text', 'Multiline ratio', 40, 455); multiline.text = 'First line\nSecond line';
  Object.assign(multiline.style, { textPadding: [1, 2, 3, 4], verticalAlign: 'top', lineHeight: 2 });
  for (const [index, type] of (['input', 'textarea', 'select'] as const).entries()) {
    const w = add(type, `Padded ${type}`, 420, 40 + index * 120);
    Object.assign(w.style, { textPadding: [3, 11, 5, 19], verticalAlign: 'bottom', lineHeight: 3 });
  }
  const change = add('button', 'Change text layout', 420, 410, 45);
  change.interactions = [{ id: uid(), event: 'click', name: 'Apply layout', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: doc.pages[0].widgets[0].id, style: { textPadding: [2, 4, 6, 8], verticalAlign: 'bottom', lineHeight: 1.5 } }] }];
  add('text', 'Legacy label', 420, 480, 40); add('input', 'Legacy input', 420, 540, 40);
  return doc;
}
async function menu(page: Page, name: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click();
}
async function openFixture(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'text-layout.rea.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
const widget = (scope: Scope, name: string) => scope.locator(`.widget[aria-label="${name}"]`);
async function textBounds(item: Locator) {
  return item.evaluate(element => {
    const span = element.querySelector('.widget-text')!, range = document.createRange(); range.selectNodeContents(span);
    const outer = element.getBoundingClientRect(), text = range.getBoundingClientRect();
    return { left: text.left - outer.left, top: text.top - outer.top, right: text.right - outer.left, bottom: text.bottom - outer.top, textHeight: text.height, width: outer.width, height: outer.height };
  });
}
async function verify(scope: Scope, mode: 'preview' | 'offline') {
  for (const [align, css] of [['top', 'flex-start'], ['middle', 'center'], ['bottom', 'flex-end']] as const) {
    const item = widget(scope, `Aligned ${align}`), span = item.locator('.widget-text');
    await expect(span).toHaveCSS('padding', '7px 13px 17px 23px'); await expect(span).toHaveCSS('align-items', css);
    await expect(span).toHaveCSS('display', 'flex'); await expect(span).toHaveCSS('line-height', 'normal');
    const bounds = await textBounds(item), expected = align === 'top' ? 7 : align === 'bottom' ? 100 - 17 - bounds.textHeight : 7 + (100 - 7 - 17 - bounds.textHeight) / 2;
    expect(Math.abs(bounds.top - expected)).toBeLessThanOrEqual(1); expect(bounds.left).toBeCloseTo(23, 0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.width - 13); expect(bounds.bottom).toBeLessThanOrEqual(bounds.height - 17);
  }
  const native = await textBounds(widget(scope, 'Short native label'));
  expect(native.top).toBeGreaterThanOrEqual(0); expect(native.bottom).toBeLessThanOrEqual(16); expect(native.textHeight).toBeGreaterThan(0);
  await expect(widget(scope, 'Multiline ratio').locator('.widget-text')).toHaveCSS('line-height', '28px');
  for (const type of ['input', 'textarea', 'select']) {
    const control = scope.locator(`${type}[aria-label="Padded ${type}"]`);
    await expect(control).toHaveCSS('padding', '3px 11px 5px 19px');
    expect(await control.evaluate(element => ({ align: element.style.alignItems, line: element.style.lineHeight }))).toEqual({ align: '', line: '' });
  }
  await expect(widget(scope, 'Legacy label').locator('.widget-text')).toHaveCSS('padding', '5px');
  await expect(scope.locator('input[aria-label="Legacy input"]')).toHaveCSS('padding', mode === 'preview' ? '5px 8px' : '7px');
  await widget(scope, 'Change text layout').click();
  const changed = widget(scope, 'Aligned top').locator('.widget-text');
  await expect(changed).toHaveCSS('padding', '2px 4px 6px 8px'); await expect(changed).toHaveCSS('align-items', 'flex-end'); await expect(changed).toHaveCSS('line-height', '21px');
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: text insets and vertical alignment position real glyphs, including a 16px native label`, async ({ page, browser }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await openFixture(page, fixture());
  if (mode === 'preview') { await page.getByTitle('Preview (F5)', { exact: true }).click(); await verify(page.locator('.preview-overlay'), mode); }
  else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const path = testInfo.outputPath('text-layout.html'); await (await download).saveAs(path);
    const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 } });
    try {
      const exported = await context.newPage(), requests: string[] = []; exported.on('pageerror', error => errors.push(error.message));
      exported.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      await exported.goto(pathToFileURL(path).href); await verify(exported, mode); expect(requests).toEqual([]);
    } finally { await context.close(); }
  }
  expect(errors).toEqual([]);
});

test('Inspector authors optional text layout, saves, reopens and clears it without changing old defaults', async ({ page }, testInfo) => {
  page.on('dialog', dialog => dialog.accept());
  const doc = createDocument(), label = createWidget('text', 40, 40); doc.name = 'Authored text layout'; label.text = 'Authored label'; label.height = 100; doc.pages[0].widgets = [label]; await openFixture(page, doc);
  await page.locator('.editor-widget.text').click(); const inspector = page.getByRole('complementary', { name: 'Properties inspector' });
  const field = async (name: string, value: string) => { const input = inspector.getByLabel(name, { exact: true }); await input.fill(value); await input.press('Tab'); };
  await inspector.getByRole('checkbox', { name: 'Custom text padding', exact: true }).check();
  for (const [side, value] of [['top', '7'], ['right', '13'], ['bottom', '17'], ['left', '23']]) await field(`Padding ${side}`, value);
  await inspector.getByLabel('Vertical alignment', { exact: true }).selectOption('bottom');
  await inspector.getByLabel('Line height', { exact: true }).selectOption('custom'); await field('Line height ratio', '1.5');
  await expect(page.locator('.editor-widget.text .widget-text')).toHaveCSS('padding', '7px 13px 17px 23px');
  await expect(page.locator('.editor-widget.text .widget-text')).toHaveCSS('align-items', 'flex-end');
  const save = async (name: string) => { const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const path = testInfo.outputPath(name); await (await download).saveAs(path); return { path, doc: JSON.parse(await readFile(path, 'utf8')) as Document }; };
  const saved = await save('text-layout.rea.json'); expect(saved.doc.pages[0].widgets[0].style).toMatchObject({ textPadding: [7, 13, 17, 23], verticalAlign: 'bottom', lineHeight: 1.5 });
  await menu(page, 'New Ctrl+N'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O'); await (await chooser).setFiles(saved.path);
  await expect(page.locator('.titlebar')).toContainText(doc.name); expect((await save('reopened-text-layout.rea.json')).doc).toEqual(saved.doc);
  await page.locator('.editor-widget.text').click();
  await expect(inspector.getByLabel('Vertical alignment', { exact: true })).toHaveValue('bottom'); await expect(inspector.getByLabel('Line height ratio', { exact: true })).toHaveValue('1.5');
  await inspector.getByRole('checkbox', { name: 'Custom text padding', exact: true }).uncheck(); await inspector.getByLabel('Vertical alignment', { exact: true }).selectOption(''); await inspector.getByLabel('Line height', { exact: true }).selectOption('');
  const cleared = (await save('cleared-text-layout.rea.json')).doc;
  for (const key of ['textPadding', 'verticalAlign', 'lineHeight']) expect(cleared.pages[0].widgets[0].style).not.toHaveProperty(key);
  await expect(page.locator('.editor-widget.text .widget-text')).toHaveCSS('padding', '5px');
});
