import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { importRpSemantics } from '../../src/model/import-rp';
import { parseDocument, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';

const root = fileURLToPath(new URL('../../', import.meta.url));
const nativeFile = path.join(root, 'research/samples/UX Prototyping.rp');
const nativeHash = '1c95cf119e7cda30943c87f8ba9f95406835b988adb55e49da6e010f028eca72';
function imported() {
  expect(createHash('sha256').update(readFileSync(nativeFile)).digest('hex')).toBe(nativeHash);
  const code = "import {pathToFileURL} from 'node:url';const reader=process.argv[1],file=process.argv[2];process.argv[1]='';const {inspectRpSemantics}=await import(pathToFileURL(reader).href);process.stdout.write(JSON.stringify(inspectRpSemantics(file)));";
  const semantics = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code, path.join(root, 'research/scripts/read-rp-semantics.mjs'), nativeFile], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
  return parseDocument(serializeDocument(importRpSemantics(semantics, 'UX Prototyping').document));
}
async function open(page: Page, doc: Document) {
  await page.goto('/'); await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const chooser = page.waitForEvent('filechooser'); await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'native-text-layout.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: native UX AutoFit headings keep their saved owner rectangles and 28px font while remaining on one line`, async ({ page, browser }, info) => {
  test.setTimeout(90_000); const doc = imported(); await open(page, doc);
  const errors: string[] = [], requests: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let player = page, context: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  if (mode === 'preview') await page.getByTitle('Preview (F5)', { exact: true }).click();
  else {
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    const file = info.outputPath('native-text-layout.html'); await (await pending).saveAs(file);
    context = await browser.newContext({ offline: true, viewport: { width: 1700, height: 1100 } }); player = await context.newPage();
    player.on('pageerror', error => errors.push(error.message)); player.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await player.goto(pathToFileURL(file).href);
  }
  const observed: { page: string; text: string; expectedWidth: number; width: number; height: number; textHeight: number; fontSize: string; lineCount: number; overflow: string; whiteSpace: string }[] = [];
  try {
    const owners = doc.pages.filter(item => ['Problems and ideas', 'Sample problems and ideas'].includes(item.name)); expect(owners).toHaveLength(2);
    for (const owner of owners) {
      if (mode === 'preview') await player.locator(`.preview-overlay [data-page-id="${owner.id}"]`).click();
      else await player.locator('nav').getByRole('button', { name: owner.name, exact: true }).click();
      const headings = owner.widgets.filter(widget => ['Problems', 'Ideas'].includes(widget.text)); expect(headings).toHaveLength(2);
      for (const widget of headings) {
        const expectedWidth = widget.text === 'Problems' ? 95 : 54;
        expect(widget).toMatchObject({ width: expectedWidth, height: 27, y: 169 });
        const target = player.locator(`[data-widget-id="${widget.id}"]`); await expect(target).toBeVisible();
        const measured = await target.evaluate(async element => {
          await document.fonts.ready;
          const layer = element.querySelector<HTMLElement>(':scope > .widget-text')!, run = layer.querySelector<HTMLElement>('[data-rich-run]') ?? layer;
          const range = document.createRange(); range.selectNodeContents(run);
          const rect = element.getBoundingClientRect(), style = getComputedStyle(run);
          return { width: rect.width, height: rect.height, textHeight: layer.getBoundingClientRect().height, fontSize: style.fontSize, lineCount: new Set(Array.from(range.getClientRects()).filter(item => item.width > 0).map(item => Math.round(item.top * 100) / 100)).size, overflow: getComputedStyle(layer).overflow, whiteSpace: style.whiteSpace };
        });
        // Observe actual rendered ink outside the stored owner width. DOM Range
        // alone would still report glyphs that an ancestor clips.
        const spill = await target.evaluate(element => {
          const run = element.querySelector('[data-rich-run]')!, range = document.createRange(); range.selectNodeContents(run);
          const glyph = range.getBoundingClientRect(), owner = element.getBoundingClientRect();
          const x = Math.ceil(owner.right + 1), y = Math.floor(owner.top);
          return { x, y, width: Math.ceil(glyph.right) - x, height: Math.ceil(glyph.bottom) - y };
        });
        expect(spill.width).toBeGreaterThan(8);
        const pixels = await player.screenshot({ clip: spill, path: info.outputPath(`${owner.id}-${widget.text}-spill.png`) });
        const ink = await player.evaluate(async base64 => {
          const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
          const data = context.getImageData(0, 0, canvas.width, canvas.height).data; let count = 0;
          for (let index = 0; index < data.length; index += 4) if (data[index] < 180 && data[index + 1] < 180 && data[index + 2] < 180 && data[index + 3] > 200) count++;
          return count;
        }, pixels.toString('base64'));
        expect(ink, `${owner.name}/${widget.text} visible ink outside owner`).toBeGreaterThan(10);
        expect(measured.overflow).toBe('visible');
        observed.push({ page: owner.name, text: widget.text, expectedWidth, ...measured });
      }
    }
    await info.attach('native-text-layer-measurements', { body: JSON.stringify(observed, null, 2), contentType: 'application/json' });
    await player.screenshot({ path: info.outputPath('native-text-layout.png') });
    for (const item of observed) {
      expect.soft(item.width, `${item.page}/${item.text} saved width`).toBe(item.expectedWidth);
      expect.soft(item.height, `${item.page}/${item.text} saved height`).toBe(27);
      expect.soft(item.fontSize, `${item.page}/${item.text} native run size`).toBe('28px');
      expect.soft(item.lineCount, `${item.page}/${item.text} AutoFitWidth prevents wrapping`).toBe(1);
      expect.soft(item.textHeight, `${item.page}/${item.text} text has intrinsic height`).toBeGreaterThan(27);
    }
    expect(errors).toEqual([]); expect(requests).toEqual([]);
  } finally {
    if (context) await context.close(); else await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  }
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); const file = info.outputPath('after.rea.json'); await (await pending).saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(doc); expect(createHash('sha256').update(readFileSync(nativeFile)).digest('hex')).toBe(nativeHash);
});
