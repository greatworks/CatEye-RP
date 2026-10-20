import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';

const weights = [[100, 'Thin'], [300, 'Light'], [400, 'Regular'], [500, 'Medium'], [700, 'Bold'], [900, 'Black']] as const;
const faces = (['normal', 'italic'] as const).flatMap(style => weights.map(([weight, name]) => ({
  weight, name: style === 'normal' ? name : `${name}Italic`, style,
  postScriptName: `Roboto-${style === 'normal' ? name : name === 'Regular' ? 'Italic' : `${name}Italic`}`,
})));
function fixture() {
  const doc = createDocument(); doc.name = 'Embedded Roboto faces';
  doc.pages[0].widgets = faces.map(({ weight, name, style }, index) => {
    const widget = createWidget('text', 30 + Math.floor(index / 6) * 490, 30 + index % 6 * 60); widget.id = `roboto-${weight}-${style}`; widget.name = `Roboto ${name}`; widget.text = `Roboto ${name} 0123456789`;
    widget.width = 460; widget.height = 42; Object.assign(widget.style, { fontFamily: 'Roboto', fontSize: 24, fontWeight: weight, fontStyle: style, textPadding: [0, 0, 0, 0], verticalAlign: 'top', lineHeight: 'normal' }); return widget;
  });
  const phone = createWidget('text', 30, 430); phone.id = 'native-phone-width'; phone.text = 'Phone number'; phone.width = 97; phone.height = 16;
  Object.assign(phone.style, { fontFamily: 'Roboto', fontSize: 14, fontWeight: 400, textPadding: [0, 0, 0, 0], verticalAlign: 'top', lineHeight: 'normal' }); doc.pages[0].widgets.push(phone);
  return doc;
}
async function menu(page: Page, name: string) { await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click(); }
async function open(page: Page, doc: Document) {
  await page.goto('/'); const picker = page.waitForEvent('filechooser'); await menu(page, 'Open… Ctrl+O'); await (await picker).setFiles({ name: 'font-faces.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page: Page, info: TestInfo, name: string) {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const file = info.outputPath(`${name}.rea.json`); await (await download).saveAs(file); return JSON.parse(await readFile(file, 'utf8')) as Document;
}
async function inspectFaces(page: Page, selector: string) {
  await page.evaluate(async faces => {
    await Promise.all(faces.map(({ weight, style }) => document.fonts.load(`${style} ${weight} 24px "Roboto"`)));
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, faces);
  const registered = await page.evaluate(() => Array.from(document.fonts).filter(face => face.family.replace(/"/g, '') === 'Roboto').map(face => ({ weight: face.weight, style: face.style, status: face.status })));
  expect(registered).toEqual(faces.map(({ weight, style }) => ({ weight: String(weight), style, status: 'loaded' })));
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); const { root } = await cdp.send('DOM.getDocument');
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector }); expect(nodeIds).toHaveLength(13);
    const observed = [];
    for (const [index, { weight, name, style, postScriptName }] of faces.entries()) {
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: nodeIds[index] });
      expect(fonts.length).toBeGreaterThan(0); expect(fonts.every(font => font.isCustomFont && font.postScriptName === postScriptName)).toBe(true);
      await expect(page.locator(selector).nth(index)).toHaveCSS('font-style', style);
      observed.push({ weight, name, style, fonts });
    }
    const phone = await page.locator(selector).nth(12).evaluate(element => {
      const range = document.createRange(); range.selectNodeContents(element); const box = element.getBoundingClientRect(), text = range.getBoundingClientRect(), style = getComputedStyle(element);
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), lineTops = new Set<number>(); let node: Node | null;
      while ((node = walker.nextNode())) for (let i = 0; i < (node.textContent?.length ?? 0); i++) { const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1); lineTops.add(r.getBoundingClientRect().top); }
      return { width: box.width, height: box.height, textWidth: text.width, lineCount: lineTops.size, fontFamily: style.fontFamily, fontWeight: style.fontWeight, lineHeight: style.lineHeight };
    });
    expect(phone).toMatchObject({ width: 97, height: 16, lineCount: 1, fontFamily: 'Roboto', fontWeight: '400', lineHeight: 'normal' }); expect(phone.textWidth).toBeLessThan(97);
    return { registered, observed, phone };
  } finally { await cdp.detach(); }
}

test('editor and preview use all twelve real Roboto faces without changing authored styles or geometry', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); const doc = fixture(); await open(page, doc);
  const initial = await save(page, info, 'before'); const editor = await inspectFaces(page, '.editor-widget > .widget-text');
  await page.getByTitle('Preview (F5)', { exact: true }).click(); const preview = await inspectFaces(page, '.preview-page .widget > .widget-text');
  await page.getByRole('button', { name: 'Close preview', exact: true }).click(); expect(await save(page, info, 'after')).toEqual(initial); expect(errors).toEqual([]);
  await info.attach('embedded-platform-fonts', { body: JSON.stringify({ editor, preview }, null, 2), contentType: 'application/json' });
});

test('actual offline HTML embeds all twelve fonts and uses them with networking disabled', async ({ page, browser }, info) => {
  const doc = fixture(); await open(page, doc); const before = await save(page, info, 'before-export');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const file = info.outputPath('embedded-roboto.html'); await (await download).saveAs(file);
  const html = await readFile(file, 'utf8'); expect((html.match(/data:font\/ttf;base64,/g) ?? []).length).toBe(12); expect(html).toContain('Apache License'); expect(html).toContain('Copyright 2011 Google');
  const context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1000 } });
  try {
    const offline = await context.newPage(), errors: string[] = [], requests: string[] = []; offline.on('pageerror', error => errors.push(error.message)); offline.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await offline.goto(pathToFileURL(file).href); const measurement = await inspectFaces(offline, 'main .widget > .widget-text');
    expect(errors).toEqual([]); expect(requests).toEqual([]); await info.attach('offline-embedded-platform-fonts', { body: JSON.stringify(measurement, null, 2), contentType: 'application/json' });
  } finally { await context.close(); }
  expect(await save(page, info, 'after-export')).toEqual(before);
});
