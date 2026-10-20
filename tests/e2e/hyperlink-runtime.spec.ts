import { expect, test, type Page, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { hyperlinkFixture } from '../fixtures/hyperlinks';
import { serializeDocument } from '../../src/model/document';

async function open(page: Page) {
  const doc = hyperlinkFixture(); await page.goto('/');
  const chooser = page.waitForEvent('filechooser'); await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'links.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) }); await expect(page.locator('.titlebar')).toContainText(doc.name); return doc;
}
async function exercise(page: Page, scope: Locator) {
  const owner = scope.locator('[data-widget-id="link-mixed"]'), link = owner.getByRole('link'), leaves = link.locator('[data-rich-run]'), status = scope.locator('[data-widget-id="link-status"]');
  await expect(link).toHaveCount(1); await expect(leaves).toHaveCount(2); await expect(leaves.nth(0)).toHaveCSS('color', 'rgb(37, 99, 235)'); await expect(leaves.nth(1)).toHaveCSS('font-style', 'italic');
  // Keep a real node reference: pointer updates must not replace the anchor.
  await link.evaluate(el => { (window as unknown as { __savedLink: Element }).__savedLink = el; });
  await link.hover(); await expect(leaves.nth(0)).toHaveCSS('color', 'rgb(124, 58, 237)'); await expect(leaves.nth(0)).toHaveCSS('text-decoration-line', 'line-through');
  await page.mouse.down(); await expect(leaves.nth(0)).toHaveCSS('color', 'rgb(190, 18, 60)'); await expect(leaves.nth(0)).toHaveCSS('font-weight', '700'); await page.mouse.up();
  await expect(status).toHaveText('Link finished'); expect(await link.evaluate(el => el === (window as unknown as { __savedLink: Element }).__savedLink)).toBe(true);
  await scope.locator('[data-widget-id="link-heading"]').hover(); await expect(leaves.nth(0)).toHaveCSS('color', 'rgb(37, 99, 235)');
  await owner.getByText('Read ', { exact: true }).click(); await expect(status).toHaveText('Parent clicked');
  await scope.locator('[data-widget-id="link-fallback"]').getByRole('link').click(); await expect(status).toHaveText('Fallback reached parent');
  const menuLink = scope.locator('[data-widget-id="link-menu"]').getByRole('link'); await menuLink.click(); await expect(page.getByRole('menu')).toHaveCount(1); await expect(status).toHaveText('Fallback reached parent');
  await page.getByRole('menuitem', { name: 'Second link case', exact: true }).click(); await expect(page.getByRole('menu')).toHaveCount(0); await expect(status).toHaveText('Second chosen'); await expect(menuLink).toBeFocused();
  await menuLink.press('Enter'); await expect(page.getByRole('menu')).toHaveCount(1); await page.keyboard.press('Escape'); await expect(page.getByRole('menu')).toHaveCount(0);
  await scope.locator('.widget[aria-label="Replace linked text"]').click(); const solo = scope.locator('[data-widget-id="link-solo"]').getByRole('link'); await expect(solo).toHaveText('Link survives Set Text'); await solo.click(); await expect(status).toHaveText('Retained link clicked');
  const rows = scope.locator('[data-widget-id="link-row"]').getByRole('link'); await expect(rows).toHaveCount(2); await expect(rows.nth(0)).toHaveText('Alpha'); await expect(rows.nth(1)).toHaveText('Beta'); await rows.nth(1).click(); await expect(status).toHaveText('Row Beta clicked');
  await expect(rows.nth(0).locator('[data-rich-run]')).toHaveCSS('text-decoration-line', 'underline');
  const disabled = scope.locator('[data-widget-id="link-disabled"]').getByRole('link'); await expect(disabled).toHaveAttribute('aria-disabled', 'true'); await disabled.dispatchEvent('click'); await expect(status).toHaveText('Row Beta clicked');
}
for (const mode of ['preview', 'offline'] as const) test(`${mode}: rich links retain DOM, compose pointer styles, route cases and row expressions`, async ({ page, browser }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); const doc = await open(page);
  if (mode === 'preview') { await page.getByTitle('Preview (F5)', { exact: true }).click(); await exercise(page, page.locator('.preview-overlay')); await page.getByRole('button', { name: 'Close preview', exact: true }).click(); }
  else {
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const file = info.outputPath('links.html'); await (await pending).saveAs(file);
    const context = await browser.newContext({ offline: true, viewport: { width: 1500, height: 1050 } });
    try { const player = await context.newPage(), network: string[] = []; player.on('pageerror', e => errors.push(e.message)); player.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); }); await player.goto(pathToFileURL(file).href); await exercise(player, player.locator('body')); expect(network).toEqual([]); } finally { await context.close(); }
  }
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const file = info.outputPath('after.rea.json'); await (await pending).saveAs(file); expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(doc); expect(errors).toEqual([]);
});
test('preview navigation uses an isolated current window and a fresh new window; actions continue', async ({ page, context }) => {
  await context.route('https://example.test/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Intercepted destination</title><p>Local test response</p>' }));
  await open(page); await page.getByTitle('Preview (F5)', { exact: true }).click(); const scope = page.locator('.preview-overlay'), current = scope.locator('[data-widget-id="link-current"]').getByRole('link');
  const first = context.waitForEvent('page'); await current.click(); const destination = await first; await expect(destination).toHaveURL('https://example.test/current'); await expect(scope.locator('[data-widget-id="link-status"]')).toHaveText('Current destination requested'); expect(await destination.evaluate(() => window.opener)).toBeNull();
  await current.click(); await expect(destination).toHaveURL('https://example.test/current'); expect(context.pages()).toHaveLength(2);
  const next = context.waitForEvent('page'); await scope.locator('[data-widget-id="link-new"]').getByRole('link').click(); const fresh = await next; await expect(fresh).toHaveURL('https://example.test/new'); expect(context.pages()).toHaveLength(3); await expect(scope.locator('[data-widget-id="link-status"]')).toHaveText('New destination requested'); await expect(page.locator('.application')).toBeVisible();
  await destination.close(); await fresh.close();
});
test('offline navigation follows current/new window targets with intercepted HTTP responses', async ({ page, context }, info) => {
  await context.route('https://example.test/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Intercepted destination</title><p>Local test response</p>' }));
  await open(page); const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const file = info.outputPath('link-navigation.html'); await (await pending).saveAs(file); await page.goto(pathToFileURL(file).href);
  const next = context.waitForEvent('page'); await page.locator('[data-widget-id="link-new"]').getByRole('link').click(); const fresh = await next; await expect(fresh).toHaveURL('https://example.test/new'); expect(await fresh.evaluate(() => window.opener)).toBeNull(); await expect(page.locator('[data-widget-id="link-status"]')).toHaveText('New destination requested');
  await page.locator('[data-widget-id="link-current"]').getByRole('link').click(); await expect(page).toHaveURL('https://example.test/current'); await fresh.close();
});
