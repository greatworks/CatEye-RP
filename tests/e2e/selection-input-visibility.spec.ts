import { expect, test, type Locator } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, serializeDocument, uid } from '../../src/model/document';

for (const mode of ['preview', 'offline'] as const) test(`${mode}: a fitted long selection label keeps the indicator visible and clickable`, async ({ page, browser }, info) => {
  const doc = createDocument(); doc.name = 'Selection input visibility'; doc.caseSelection = 'never';
  const controls = (['checkbox', 'radio'] as const).map((type, index) => {
    const widget = createWidget(type, 100, 140 + index * 80);
    Object.assign(widget, { name: `Visible ${type}`, text: 'Before', width: 100, height: 30,
      selectionText: { autoFitWidth: true, autoFitHeight: false, alignRight: false } });
    Object.assign(widget.style, { fontFamily: 'monospace', fontSize: 16, fontWeight: 400,
      fill: '#ffffff', stroke: '#123456', strokeWidth: 1, radius: 0,
      textAlign: 'left', verticalAlign: 'top', textPadding: [2, 7, 3, 5], selectionButtonSize: 14 });
    return widget;
  });
  const button = createWidget('button', 100, 40); button.name = button.text = 'Long labels';
  button.interactions = [{ id: uid(), event: 'click', name: 'Long labels', enabled: true, conditions: [], conditionMode: 'all',
    actions: controls.map(widget => ({ id: uid(), type: 'setText', targetId: widget.id, value: 'A longer label' })) }];
  doc.pages[0].widgets = [button, ...controls];
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'selection-visible.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  async function exercise(scope: Locator) {
    await scope.getByRole('button', { name: 'Long labels', exact: true }).click();
    for (const widget of controls) {
      const owner = scope.locator(`[data-widget-id="${widget.id}"]`), input = owner.locator('input');
      // The native input is intentionally transparent and 0×0. Verify the
      // painted indicator's real screen intersection and activate its label.
      const visibleWidth = await owner.locator('svg[data-selection-indicator]').evaluate(element => {
        const inputBox = element.getBoundingClientRect(), ownerBox = element.closest('.widget')!.getBoundingClientRect();
        return Math.min(inputBox.right, ownerBox.right) - Math.max(inputBox.left, ownerBox.left);
      });
      expect(visibleWidth).toBeGreaterThan(8);
      await owner.locator('label').click({position:{x:7,y:7}}); await expect(input).toBeChecked();
      await expect(owner).toHaveCSS('width', '100px'); await expect(owner).toHaveCSS('height', '30px');
      // A long label paints beyond the unchanged owner width. Check hit-tested
      // text at the final glyph, so an overflow-clipped run cannot pass.
      const lastGlyphVisible = await owner.locator('[data-rich-run]').evaluate(element => {
        const range = document.createRange(); range.selectNodeContents(element);
        const box = range.getBoundingClientRect();
        const hit = document.elementFromPoint(box.right - 2, (box.top + box.bottom) / 2);
        return hit?.closest('.widget') === element.closest('.widget');
      });
      expect(lastGlyphVisible).toBe(true);
    }
    await expect(scope.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
  }
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click();
    await exercise(page.locator('.preview-overlay'));
    await page.screenshot({ path: info.outputPath('selection-input-visible-preview.png') });
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const file = info.outputPath('selection-visible.html'); await (await download).saveAs(file);
    const context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1000 } });
    try {
      const exported = await context.newPage(); exported.on('pageerror', error => errors.push(error.message));
      await exported.goto(pathToFileURL(file).href); await exercise(exported.locator('body'));
      await exported.screenshot({ path: info.outputPath('selection-input-visible-offline.png') });
    } finally { await context.close() }
  }
  expect(errors).toEqual([]);
});
