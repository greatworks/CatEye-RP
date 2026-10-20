import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { textDecorationFixture } from '../fixtures/text-decoration';
import { serializeDocument } from '../../src/model/document';

const baseline = ['none', 'underline', 'line-through', 'underline line-through'];
async function decoration(scope: Locator, expected: string[]) {
  const runs = scope.locator('[data-widget-id="deco-rich"] [data-rich-run]'); await expect(runs).toHaveCount(expected.length);
  for (let i = 0; i < expected.length; i++) await expect(runs.nth(i)).toHaveCSS('text-decoration-line', expected[i]);
}
async function exercise(scope: Locator) {
  const rich = scope.locator('[data-widget-id="deco-rich"]'), heading = scope.locator('[data-widget-id="deco-heading"]');
  await decoration(scope, baseline);
  // A run's none must really clear base underline; no decorated ancestor may remain.
  expect(await rich.locator('[data-rich-run]').first().evaluate(element => { const lines: string[] = []; for (let p = element.parentElement; p; p = p.parentElement) lines.push(getComputedStyle(p).textDecorationLine); return lines; })).not.toContain('underline');
  await expect(scope.getByRole('textbox', { name: 'Decorated input' })).toHaveCSS('text-decoration-line', 'underline line-through');
  await expect(scope.locator('[data-widget-id="deco-child"] .widget-text')).toHaveCSS('text-decoration-line', 'none');
  await rich.hover(); await decoration(scope, Array(4).fill('line-through'));
  await heading.hover(); await decoration(scope, baseline);
  const click = (name: string) => scope.locator(`.widget[aria-label="${name}"]`).click();
  await click('Select mixture'); await decoration(scope, Array(4).fill('none'));
  await rich.hover(); await decoration(scope, baseline); // Original false/true CSS write is ignored after cache reset.
  await heading.hover(); await decoration(scope, Array(4).fill('none'));
  await click('Disable mixture'); await decoration(scope, Array(4).fill('underline line-through'));
  await click('Enable mixture'); await click('Clear selection'); await decoration(scope, baseline);
  await click('Replace text'); await decoration(scope, ['none']);
  await expect(rich).toHaveText('Replacement keeps the first text format.');
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: original decoration matrix preserves mixed baselines, overrides and adaptive reset`, async ({ page, browser }, info) => {
  const doc = textDecorationFixture(), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'decorations.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) }); await expect(page.locator('.titlebar')).toContainText(doc.name);
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click(); const scope = page.locator('.preview-overlay'); await exercise(scope);
    await expect(scope.locator('[data-widget-id="deco-adaptive"] [data-rich-run]')).toHaveCSS('text-decoration-line', 'line-through');
    await scope.getByTitle('Mobile', { exact: true }).click(); await expect(scope.locator('[data-widget-id="deco-adaptive"] [data-rich-run]')).toHaveCSS('text-decoration-line', 'underline');
    await scope.getByRole('button', { name: 'Close preview', exact: true }).click();
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const file = info.outputPath('decorations.html'); await (await download).saveAs(file);
    const context = await browser.newContext({ offline: true, viewport: { width: 1450, height: 1000 } });
    try {
      const offline = await context.newPage(), network: string[] = []; offline.on('pageerror', e => errors.push(e.message)); offline.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); }); await offline.goto(pathToFileURL(file).href); const scope = offline.locator('body'); await exercise(scope);
      await expect(scope.locator('[data-widget-id="deco-adaptive"] [data-rich-run]')).toHaveCSS('text-decoration-line', 'line-through');
      await offline.setViewportSize({ width: 390, height: 844 }); await expect(scope.locator('[data-widget-id="deco-adaptive"] [data-rich-run]')).toHaveCSS('text-decoration-line', 'underline'); expect(network).toEqual([]);
    } finally { await context.close(); }
  }
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const saved = info.outputPath('after.rea.json'); await (await download).saveAs(saved); expect(JSON.parse(await readFile(saved, 'utf8'))).toEqual(doc); expect(errors).toEqual([]);
});
