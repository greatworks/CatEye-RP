import { expect, test, type Page, type TestInfo, type Frame } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { serializeDocument } from '../../src/model/document';
import { openSansFaces, openSansFixture, openSansNestedTargets } from '../fixtures/open-sans';

async function open(page: Page) {
  const doc = openSansFixture(); await page.goto('/');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const picker = page.waitForEvent('filechooser'); await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await picker).setFiles({ name: 'open-sans.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name); return doc;
}
async function save(page: Page, info: TestInfo, name: string) {
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click();
  const file = info.outputPath(`${name}.rea.json`); await (await pending).saveAs(file); return JSON.parse(await readFile(file, 'utf8'));
}
async function actualFonts(target: Page | Frame, prefix: string, entries = openSansFaces.map(face => ({ id: face.id, postScriptName: face.postScriptName }))) {
  await target.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
  const page = 'context' in target ? target : target.page();
  const cdp = await page.context().newCDPSession(target);
  try {
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); const { root } = await cdp.send('DOM.getDocument');
    const observed = [];
    for (const [index, entry] of entries.entries()) {
      const selector = prefix === '.canvas-surface' ? `${prefix} > .editor-widget:nth-of-type(${index + 1}) > .widget-text` : `${prefix} [data-widget-id="${entry.id}"] > .widget-text`;
      let { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector }); expect(nodeId, selector).toBeGreaterThan(0);
      const rich = await cdp.send('DOM.querySelector', { nodeId, selector: '[data-rich-run]' }); if (rich.nodeId) nodeId = rich.nodeId;
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      expect(fonts.length).toBeGreaterThan(0); expect(fonts.every(font => font.isCustomFont && font.postScriptName === entry.postScriptName), entry.id).toBe(true);
      observed.push({ ...entry, fonts });
    }
    return observed;
  } finally { await cdp.detach(); }
}

test('Open Sans uses ten actual font files in the editor and preview; font selection, action and undo preserve design', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await open(page); const before = await save(page, info, 'before');
  const editor = await actualFonts(page, '.canvas-surface');
  await page.locator('.canvas-surface > .editor-widget').first().click();
  await expect(page.locator('.style-toolbar').getByLabel('Font family', { exact: true })).toHaveValue('Open Sans');
  await page.locator('.style-toolbar').getByLabel('Font family', { exact: true }).selectOption('Roboto');
  expect((await save(page, info, 'changed')).pages[0].widgets[0].style.fontFamily).toBe('Roboto');
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info, 'undone')).toEqual(before);
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = await actualFonts(page, '.preview-page');
  await page.locator('.preview-page [data-widget-id="open-sans-change"]').click();
  await actualFonts(page, '.preview-page', [{ id: 'open-sans-action-target', postScriptName: 'OpenSans-ExtraBoldItalic' }]);
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save(page, info, 'after')).toEqual(before); expect(errors).toEqual([]);
  await info.attach('open-sans-platform-fonts', { body: JSON.stringify({ editor, preview }, null, 2), contentType: 'application/json' });
});

test('offline export embeds Open Sans for nested table, menu, tree, rich text and an independent iframe without network', async ({ page, browser }, info) => {
  await open(page); const before = await save(page, info, 'before-export');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  const file = info.outputPath('open-sans.html'); await (await pending).saveAs(file); const html = await readFile(file, 'utf8');
  expect((html.match(/data:font\/ttf;base64,/g) ?? []).length).toBe(10); expect(html).toContain('Apache License'); expect(html).toContain('Google Corporation');
  const context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1000 } });
  try {
    const offline = await context.newPage(), errors: string[] = [], network: string[] = []; offline.on('pageerror', e => errors.push(e.message)); offline.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
    await offline.goto(pathToFileURL(file).href); const faces = await actualFonts(offline, 'main');
    await offline.locator('[data-widget-id="open-sans-change"]').click(); await actualFonts(offline, 'main', [{ id: 'open-sans-action-target', postScriptName: 'OpenSans-ExtraBoldItalic' }]);
    await offline.locator('nav').getByRole('button', { name: 'Nested typography', exact: true }).click(); const nested = await actualFonts(offline, 'main', openSansNestedTargets);
    await offline.locator('nav').getByRole('button', { name: 'Embedded typography', exact: true }).click();
    const iframe = offline.locator('iframe[data-inline-frame="open-sans-frame"]'); await expect(iframe).toBeVisible();
    await expect(iframe.contentFrame().locator('[data-widget-id="open-sans-table-cell"]')).toBeVisible();
    const frame = await (await iframe.elementHandle())!.contentFrame(); expect(frame).toBeTruthy(); const embedded = await actualFonts(frame!, 'main', openSansNestedTargets);
    expect(errors).toEqual([]); expect(network).toEqual([]); await info.attach('offline-open-sans-fonts', { body: JSON.stringify({ faces, nested, embedded }, null, 2), contentType: 'application/json' });
  } finally { await context.close(); }
  expect(await save(page, info, 'after-export')).toEqual(before);
});
