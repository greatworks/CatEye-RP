import { expect, test, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { importRpSemantics } from '../../src/model/import-rp';
import { findWidget, parseDocument, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sourceEvidence = JSON.parse(readFileSync(path.join(root, 'research/rp-input-types-evidence.json'), 'utf8')) as { samples: { file: string }[] };
const formsFile = sourceEvidence.samples.find(sample => path.basename(sample.file) === 'Sample form patterns.rplib')!.file;
const sourceHash = '1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179';
const widgetPrefix = 'rp-w-784fffad1a36482594f6f965760990d6-';
// Native saved rectangles, independently recorded before the style-chain fix. Do not resize
// these captions to accommodate a browser font's Range/line box (which is not its ink box).
const captions = [
  ['521d7ce3a85d4cf0a40f3934f8677b75', 'First name*', 20, 20, 78],
  ['dd95d9e7839f43bb811c83f46238249a', 'Last name*', 330, 20, 76],
  ['0f045efac5b24769857e5ac8f794f50a', 'Email address*', 20, 125, 101],
  ['c1b87b64b81c4dcab59309167dc6b268', 'Phone number', 20, 230, 97],
  ['c2a9b16835bd4d008aaf88e0b6b5ee2f', 'Date of birth', 20, 335, 83],
  ['739c2aaee48f40b88062ae1a48534bd6', 'Country / Region', 20, 440, 112],
  ['a2c769440f514b97b07eb58d67180cd9', 'Street address', 20, 545, 97],
  ['3057b27358d54974bd35fa392ccca3c9', 'City', 20, 650, 26],
  ['d8d23bfff7314a6ca9331c1bc5e50c1d', 'State / Province', 240, 650, 107],
  ['3eee678743e24793a67aa4d4adae81c6', 'ZIP / Postal', 420, 650, 79],
] as const;

function readNative(file: string) {
  // Do not request the reader CLI's expanded pretty JSON (about 50 MiB for this
  // real library). Suppress its entry-point branch and emit one compact result.
  const script = "import { pathToFileURL } from 'node:url'; const reader = process.argv[1], file = process.argv[2]; process.argv[1] = ''; const { inspectRpSemantics } = await import(pathToFileURL(reader).href); process.stdout.write(JSON.stringify(inspectRpSemantics(file)));";
  const semantics = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script, path.join(root, 'research/scripts/read-rp-semantics.mjs'), file], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
  return parseDocument(serializeDocument(importRpSemantics(semantics, path.basename(file)).document));
}
async function fileMenu(page: Page, name: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click();
}
async function open(page: Page, doc: Document) {
  await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O');
  await (await chooser).setFiles({ name: 'native-captions.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page: Page, file: string) {
  const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); await (await download).saveAs(file);
  return JSON.parse(await readFile(file, 'utf8')) as Document;
}

/** DOM Range measures typographic character boxes. Canvas ink bounds are a separate,
 * explicitly estimated check using the actual computed font, not a product geometry helper.
 * The estimate does not claim native Axure rasterization or exact kerning equivalence. */
async function measure(label: Locator) {
  await expect(label).toBeVisible();
  return label.evaluate(async element => {
    await document.fonts.ready;
    const text = element.querySelector<HTMLElement>(':scope > .widget-text')!, style = getComputedStyle(text);
    const outer = element.getBoundingClientRect(), box = text.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(text); const bounds = range.getBoundingClientRect();
    const rect = (value: DOMRect) => ({ left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height });
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d')!;
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const clip = { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    const outside = (ink: { left: number; top: number; right: number; bottom: number }) => ({ left: Math.max(0, clip.left - ink.left), top: Math.max(0, clip.top - ink.top), right: Math.max(0, ink.right - clip.right), bottom: Math.max(0, ink.bottom - clip.bottom) });
    const lines: number[] = [], chars: { character: string; rect: ReturnType<typeof rect>; inkClipping: ReturnType<typeof outside> }[] = [];
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT); let node: Node | null;
    while ((node = walker.nextNode())) {
      let offset = 0;
      for (const character of node.textContent ?? '') {
        const characterRange = document.createRange(); characterRange.setStart(node, offset); offset += character.length; characterRange.setEnd(node, offset);
        if (!character.trim()) continue;
        const bounds = characterRange.getBoundingClientRect(), metrics = context.measureText(character);
        if (!lines.some(top => Math.abs(top - bounds.top) < .2)) lines.push(bounds.top);
        const baseline = bounds.top + metrics.fontBoundingBoxAscent;
        const ink = { left: bounds.left - metrics.actualBoundingBoxLeft, right: bounds.left + metrics.actualBoundingBoxRight, top: baseline - metrics.actualBoundingBoxAscent, bottom: baseline + metrics.actualBoundingBoxDescent };
        chars.push({ character, rect: rect(bounds), inkClipping: outside(ink) });
      }
    }
    return {
      text: text.textContent, outer: rect(outer), box: rect(box), range: rect(bounds), lineCount: lines.length,
      rangeClipping: outside(bounds), maxEstimatedInkClipping: Math.max(0, ...chars.flatMap(char => Object.values(char.inkClipping))), chars,
      padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
      font: style.font, fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight,
      alignItems: style.alignItems, overflow: style.overflow, textAlign: style.textAlign,
      availableTextWidth: text.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      widgetBorders: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'].map(property => getComputedStyle(element).getPropertyValue(property.replace(/[A-Z]/g, value => `-${value.toLowerCase()}`))),
    };
  });
}
async function checkCaption(label: Locator, text: string, width: number, fontSize = 14) {
  const measurement = await measure(label);
  expect(measurement.text).toBe(text); expect(measurement.outer.width).toBe(width); expect(measurement.outer.height).toBe(16);
  expect(measurement.padding).toEqual(['0px', '0px', '0px', '0px']); expect(measurement.widgetBorders).toEqual(['0px', '0px', '0px', '0px']);
  expect(measurement.fontSize).toBe(`${fontSize}px`); expect(measurement.lineHeight).toBe('normal'); expect(measurement.alignItems).toBe('normal'); expect(measurement.overflow).toBe('visible');
  expect(measurement.availableTextWidth).toBe(width); expect(measurement.lineCount).toBe(1);
  expect(measurement.rangeClipping.left).toBeLessThanOrEqual(.05); expect(measurement.rangeClipping.right).toBeLessThanOrEqual(.05); expect(measurement.rangeClipping.top).toBeLessThanOrEqual(.05);
  // The owner remains 16px, while its independent text layer has natural height.
  // Keep typographic Range bounds distinct from visible ink bounds.
  expect(measurement.rangeClipping.bottom).toBeLessThanOrEqual(1.05);
  expect(measurement.maxEstimatedInkClipping).toBeLessThanOrEqual(.05);
  await expect(label.locator('svg.widget-vector [data-shadow-stroke]')).toHaveCSS('stroke-width', '0px');
  await expect(label.locator('svg.widget-vector [data-shadow-fill]')).toHaveCSS('fill', 'rgba(255, 255, 255, 0)');
  return measurement;
}
async function player(page: Page, browser: Browser, info: TestInfo, mode: 'preview' | 'offline', name: string, run: (scope: Locator | Page, playerPage: Page) => Promise<void>) {
  if (mode === 'preview') {
    await page.getByTitle('Preview (F5)', { exact: true }).click(); await run(page.locator('.preview-overlay'), page); await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  } else {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export HTML', exact: true }).click(); const file = info.outputPath(`${name}.html`); await (await download).saveAs(file);
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, offline: true });
    try {
      const exported = await context.newPage(), errors: string[] = [], requests: string[] = [];
      exported.on('pageerror', error => errors.push(error.message)); exported.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      await exported.goto(pathToFileURL(file).href); await run(exported, exported); expect(errors).toEqual([]); expect(requests).toEqual([]);
    } finally { await context.close(); }
  }
}

for (const mode of ['preview', 'offline'] as const) test(`${mode}: real native form captions retain saved geometry and one-line ink after style recovery, with Required Fields control`, async ({ page, browser }, info) => {
  test.setTimeout(90_000); page.on('dialog', dialog => dialog.accept()); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  expect(createHash('sha256').update(readFileSync(formsFile)).digest('hex')).toBe(sourceHash);
  const doc = readNative(formsFile), personal = doc.pages.find(page => page.name === 'Personal information form')!;
  expect(personal).toBeTruthy();
  for (const [nativeId, text, x, y, width] of captions) {
    const widget = findWidget(personal, widgetPrefix + nativeId)!;
    expect(widget).toMatchObject({ text, x, y, width, height: 16, style: { textPadding: [0, 0, 0, 0], verticalAlign: 'top', lineHeight: 'normal', strokeWidth: 0, fontFamily: 'Roboto', fontSize: 14 } });
    expect(widget.style.fill).toBe('#ffffff00');
  }
  await open(page, doc); const savedPath = info.outputPath('captions-saved.rea.json'); expect(await save(page, savedPath)).toEqual(doc);
  await fileMenu(page, 'New Ctrl+N'); const chooser = page.waitForEvent('filechooser'); await fileMenu(page, 'Open… Ctrl+O'); await (await chooser).setFiles(savedPath); await expect(page.locator('.titlebar')).toContainText(doc.name);
  expect(await save(page, info.outputPath('captions-reopened.rea.json'))).toEqual(doc);
  const measurements: unknown[] = [];
  await player(page, browser, info, mode, 'native-form-captions', async (scope, playerPage) => {
    const nav = scope.locator(mode === 'preview' ? '.preview-pages' : 'nav'); await nav.getByRole('button', { name: personal.name, exact: true }).click();
    for (const [nativeId, text, , , width] of captions) measurements.push({ id: widgetPrefix + nativeId, ...await checkCaption(scope.locator(`.widget[data-widget-id="${widgetPrefix + nativeId}"]`), text, width) });
    await playerPage.screenshot({ path: info.outputPath('personal-information-captions.png'), fullPage: true });
  });
  expect(await save(page, info.outputPath('captions-after-player.rea.json'))).toEqual(doc);

  const required = readNative(path.join(root, 'research/samples/complex-interactions-required-fields.rp')); await open(page, required);
  await player(page, browser, info, mode, 'required-fields-control', async (scope, playerPage) => {
    for (const name of ['Email', 'Password']) {
      const model = required.pages[0].widgets.find(widget => widget.text === name)!;
      measurements.push({ control: name, ...await checkCaption(scope.locator('.widget').filter({ hasText: new RegExp(`^${name}$`) }), name, model.width) });
    }
    await scope.locator('.widget').filter({ hasText: /^Sign Up$/ }).click(); const error = scope.locator('.widget[aria-label="Error Message"]');
    const errorBounds = await measure(error); expect(errorBounds.lineCount).toBe(1); expect(Object.values(errorBounds.rangeClipping)).toEqual([0, 0, 0, 0]); expect(errorBounds.maxEstimatedInkClipping).toBe(0); measurements.push({ control: 'Error Message', ...errorBounds });
    await scope.locator('input[aria-label="Email Field"]').fill('person@example.test'); await scope.locator('input[aria-label="Password Field"]').fill('secret'); await scope.locator('.widget').filter({ hasText: /^Sign Up$/ }).click();
    const thanks = scope.locator('.widget').filter({ hasText: /^Thank you for signing up!$/ }); const thanksBounds = await measure(thanks);
    expect(thanksBounds.lineCount).toBe(1); expect(Object.values(thanksBounds.rangeClipping)).toEqual([0, 0, 0, 0]); expect(thanksBounds.maxEstimatedInkClipping).toBe(0); measurements.push({ control: 'Thank you', ...thanksBounds });
    await playerPage.screenshot({ path: info.outputPath('required-fields-control.png'), fullPage: true });
  });
  expect(await save(page, info.outputPath('required-after-player.rea.json'))).toEqual(required);
  expect(errors).toEqual([]); expect(createHash('sha256').update(readFileSync(formsFile)).digest('hex')).toBe(sourceHash);
  await info.attach('caption-boundary-measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
});
