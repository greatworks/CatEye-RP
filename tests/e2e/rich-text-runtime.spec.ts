import { expect, test, type Page, type Locator } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { richTextFixture } from '../fixtures/rich-text';
import { serializeDocument } from '../../src/model/document';

async function exercise(page: Page, scope: Locator) {
  const target = scope.locator('[data-widget-id="rich-target"]'), paragraphs = target.locator('[data-rich-paragraph]'), runs = paragraphs.nth(0).locator('[data-rich-run]');
  await expect(runs).toHaveCount(3); await expect(runs.nth(0)).toHaveCSS('font-size', '26px'); await expect(runs.nth(1)).toHaveCSS('font-style', 'italic'); await expect(runs.nth(2)).toHaveCSS('font-weight', '700');
  await expect(paragraphs.nth(2)).toHaveCSS('text-align', 'right'); await expect(paragraphs.nth(3)).toHaveText('Literal: [[...]] and <b>text</b>'); await expect(target.locator('b')).toHaveCount(0);
  expect(await paragraphs.nth(1).evaluate(el => el.getBoundingClientRect().height)).toBe(28);
  await expect(scope.locator('[data-widget-id="rich-row"]')).toHaveCount(2); await expect(scope.locator('[data-widget-id="rich-row"]').nth(0)).toHaveText('Item Alpha'); await expect(scope.locator('[data-widget-id="rich-row"]').nth(1)).toHaveText('Item Beta');
  await expect(scope.locator('[data-widget-id="rich-row"]').nth(1).getByText('Beta', { exact: true })).toHaveCSS('font-style', 'italic');
  await target.hover(); await expect(runs.nth(1)).toHaveCSS('font-style', 'normal'); await scope.locator('[data-widget-id="rich-heading"]').hover(); await expect(runs.nth(1)).toHaveCSS('font-style', 'italic');
  const button = (name: string) => scope.locator(`.widget[aria-label="${name}"]`);
  await button('Select text').click(); for (const run of await runs.all()) await expect(run).toHaveCSS('color', 'rgb(30, 152, 215)');
  await button('Clear selection').click(); await expect(runs.nth(1)).toHaveCSS('color', 'rgb(109, 40, 217)');
  await scope.getByRole('textbox', { name: 'Text before rich click' }).fill('Blur must retain the pending button click');
  await button('Set error').click(); for (const run of await runs.all()) await expect(run).toHaveCSS('font-style', 'italic');
  await button('Clear error').click(); await expect(runs.nth(0)).toHaveCSS('font-style', 'normal'); await expect(runs.nth(1)).toHaveCSS('font-style', 'italic');
  await button('Use plain text').click(); await expect(paragraphs).toHaveCount(3); await expect(paragraphs.nth(0)).toHaveText('Replacement'); await expect(paragraphs.nth(1)).toHaveCSS('line-height', '36px'); expect(await paragraphs.nth(1).evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(36);
  for (const run of await target.locator('[data-rich-run]').all()) { await expect(run).toHaveCSS('font-size', '26px'); await expect(run).toHaveCSS('font-style', 'normal'); }
  await button('Set all italic').click(); for (const run of await target.locator('[data-rich-run]').all()) await expect(run).toHaveCSS('font-style', 'italic');
  await button('Set all normal').click(); for (const run of await target.locator('[data-rich-run]').all()) await expect(run).toHaveCSS('font-style', 'normal');
  expect(await scope.locator('[role="alert"]').allTextContents()).not.toContain(expect.stringMatching(/Error/));
}
for (const mode of ['preview', 'offline'] as const) test(`${mode}: renders mixed runs, native literal text, paragraph gaps, cross-run expressions and state restoration`, async ({ page, browser }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); const doc = richTextFixture();
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click(); await (await chooser).setFiles({ name: 'rich.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  if (mode === 'preview') { await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page, page.locator('.preview-overlay')); await page.getByRole('button', { name: 'Close preview', exact: true }).click(); }
  else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const path = info.outputPath('rich-text.html'); await (await download).saveAs(path);
    const context = await browser.newContext({ offline: true, viewport: { width: 1450, height: 1000 } });
    try { const player = await context.newPage(), network: string[] = []; player.on('pageerror', e => errors.push(e.message)); player.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); }); await player.goto(pathToFileURL(path).href); await exercise(player, player.locator('body')); expect(network).toEqual([]); } finally { await context.close(); }
  }
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const saved = info.outputPath('after.rea.json'); await (await download).saveAs(saved); expect(JSON.parse(await readFile(saved, 'utf8'))).toEqual(doc); expect(errors).toEqual([]);
});
