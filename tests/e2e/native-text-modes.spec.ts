import { expect, test, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { nativeTextLayoutFixture } from '../fixtures/native-text-layout';
import { serializeDocument } from '../../src/model/document';

type Scope = Page | Locator | FrameLocator;
async function verify(scope: Scope) {
  for (let column = 0; column < 4; column++) for (let row = 0; row < 3; row++) {
    const target = scope.locator(`[data-widget-id="native-layout-${column}-${row}"]`);
    const value = await target.evaluate(async element => {
      await document.fonts.ready;
      const layer = element.querySelector<HTMLElement>(':scope > .widget-text')!, range = document.createRange(); range.selectNodeContents(layer);
      const owner = element.getBoundingClientRect(), text = layer.getBoundingClientRect(), css = getComputedStyle(layer);
      const lines = new Set(Array.from(range.getClientRects()).filter(r => r.width > 0).map(r => Math.round(r.top * 100) / 100));
      return { width: owner.width, height: owner.height, top: text.top - owner.top, layerHeight: text.height, layerWidth: text.width, lines: lines.size,
        whiteSpace: css.whiteSpace, overflow: css.overflow, padding: css.padding, fontSize: css.fontSize };
    });
    expect(value.width).toBe(180); expect(value.height).toBe(90); expect(value.layerWidth).toBe(180);
    expect(value.padding).toBe('7px 13px 17px 23px'); expect(value.overflow).toBe('visible');
    expect(value.fontSize).toBe('24px'); expect(value.whiteSpace).toBe(column < 2 ? 'normal' : 'nowrap');
    if (column < 2) expect(value.lines).toBeGreaterThan(1); else expect(value.lines).toBe(1);
    expect(value.layerHeight).toBeCloseTo(value.lines * 36 + 24, 0);
    const expectedTop = row === 0 ? 0 : row === 1 ? (90 - value.layerHeight) / 2 : 90 - value.layerHeight;
    expect(value.top).toBeCloseTo(expectedTop, 0);
  }
  const explicit = scope.locator('[data-widget-id="native-layout-breaks"]');
  await expect(explicit.locator('[data-rich-paragraph]')).toHaveCount(2);
  await expect(explicit.locator('[data-rich-run] br')).toHaveCount(4);
  expect(await explicit.locator('[data-rich-run]').first().textContent()).toBe('<br> ABCDE');
  await expect(explicit.locator('.widget-text')).toHaveCSS('height', '162px');
  await expect(scope.locator('[data-widget-id="native-layout-legacy"] .widget-text')).toHaveCSS('white-space', 'pre-wrap');
  await expect(scope.locator('[data-widget-id="native-layout-natural"] .widget-text')).toHaveCSS('line-height', 'normal');
  await scope.locator('[data-widget-id="native-layout-change"]').click();
  const changed = scope.locator('[data-widget-id="native-layout-0-0"]');
  await expect(changed.locator('.widget-text')).toHaveCSS('align-self', 'flex-end');
  await expect(changed.locator('.widget-text')).toHaveCSS('font-size', '30px');
  const measured = await changed.evaluate(element => {
    const owner = element.getBoundingClientRect(), layer = element.querySelector('.widget-text')!.getBoundingClientRect();
    return { width: owner.width, height: owner.height, bottom: layer.bottom - owner.bottom };
  });
  expect(measured).toEqual({ width: 180, height: 90, bottom: 0 });
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: ordinary shape text honors four AutoFit flags, padding and alignment in the page and iframe`, async ({ page, browser }, info) => {
  test.setTimeout(90_000); await page.setViewportSize({ width: 2000, height: 1250 });
  const doc = nativeTextLayoutFixture(), errors: string[] = [], requests: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const chooser = page.waitForEvent('filechooser'); await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'native-text-modes.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  let player = page, context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  if (mode === 'preview') await page.getByTitle('Preview (F5)', { exact: true }).click();
  else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const file = info.outputPath('native-text-modes.html'); await (await download).saveAs(file);
    context = await browser.newContext({ offline: true, viewport: { width: 2000, height: 1250 } }); player = await context.newPage();
    player.on('pageerror', e => errors.push(e.message)); player.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
    await player.goto(pathToFileURL(file).href);
  }
  try {
    await verify(mode === 'preview' ? player.locator('.preview-overlay') : player);
    await player.screenshot({ path: info.outputPath('native-text-modes.png') });
    if (mode === 'preview') await player.locator('.preview-overlay [data-page-id="native-layout-framed"]').click();
    else await player.locator('nav').getByRole('button', { name: 'Embedded layout', exact: true }).click();
    const frame = player.frameLocator('iframe[data-inline-frame="native-layout-frame"]');
    await expect(frame.locator('[data-widget-id="native-layout-0-0"]')).toBeVisible(); await verify(frame);
    expect(errors).toEqual([]); expect(requests).toEqual([]);
  } finally { if (context) await context.close(); else await page.getByRole('button', { name: 'Close preview', exact: true }).click(); }
  const save = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath('after.rea.json'); await (await save).saveAs(file); expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(doc);
});
