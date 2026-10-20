import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, serializeDocument } from '../../src/model/document';

for (const mode of ['preview', 'offline'] as const) test(`${mode}: native plain text without an explicit line height uses natural font metrics`, async ({ page, browser }, info) => {
  const doc = createDocument(); doc.name = 'Native natural line height';
  const shape = createWidget('box', 60, 60); Object.assign(shape, { id: 'natural-line-height', name: 'Natural line height', text: 'Natural font metrics', width: 120, height: 20, shapeText: { autoFitWidth: true, autoFitHeight: false } });
  Object.assign(shape.style, { strokeWidth: 0, fontFamily: 'Roboto', fontSize: 24, textPadding: [0, 0, 0, 0], verticalAlign: 'top' }); delete shape.style.lineHeight;
  doc.pages[0].widgets = [shape]; await page.goto('/'); await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const choose = page.waitForEvent('filechooser'); await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await choose).setFiles({ name: 'natural-line-height.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  let player = page, context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  if (mode === 'preview') await page.getByTitle('Preview (F5)', { exact: true }).click();
  else {
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const file = info.outputPath('natural-line-height.html'); await (await pending).saveAs(file);
    context = await browser.newContext({ offline: true }); player = await context.newPage(); await player.goto(pathToFileURL(file).href);
  }
  try {
    const value = await player.locator('[data-widget-id="natural-line-height"]').evaluate(async element => {
      await document.fonts.ready;
      const layer = element.querySelector<HTMLElement>('.widget-text')!, style = getComputedStyle(layer);
      const reference = document.createElement('span'); reference.textContent = layer.textContent;
      // Independent ordinary inline-block with the same font, outside the app's
      // widget class. CSS initial line-height supplies natural font metrics.
      Object.assign(reference.style, { position: 'absolute', display: 'inline-block', font: `400 24px Roboto`, lineHeight: 'normal', whiteSpace: 'nowrap', padding: '0', border: '0' });
      document.body.append(reference); const expectedHeight = reference.getBoundingClientRect().height; reference.remove();
      return { lineHeight: style.lineHeight, height: layer.getBoundingClientRect().height, expectedHeight, ownerWidth: element.getBoundingClientRect().width, ownerHeight: element.getBoundingClientRect().height };
    });
    await info.attach('natural-line-measurements', { body: JSON.stringify(value), contentType: 'application/json' });
    expect.soft(value.lineHeight).toBe('normal'); expect.soft(value.height).toBe(value.expectedHeight);
    expect(value.ownerWidth).toBe(120); expect(value.ownerHeight).toBe(20);
  } finally { if (context) await context.close(); }
});
