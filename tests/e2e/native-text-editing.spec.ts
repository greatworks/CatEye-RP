import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Document, RichText, Widget } from '../../src/model/types';

const editor = (page: Page) => page.getByRole('textbox', { name: 'Formatted text content', exact: true });
const tools = (page: Page) => page.getByRole('region', { name: 'Text editing tools', exact: true });
const paragraphText = (rich: RichText, index: number) => rich.paragraphs[index].runs.map(run => run.text).join('');

async function fileMenu(page: Page, name: string) {
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  await page.locator('.dropdown-menu').getByRole('button', { name, exact: true }).click();
}

async function open(page: Page, document: Document) {
  await page.goto('/');
  const pending = page.waitForEvent('filechooser');
  await fileMenu(page, 'Open… Ctrl+O');
  await (await pending).setFiles({ name: 'native-text-editing.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(document)) });
  await expect(page.locator('.titlebar')).toContainText(document.name);
}

async function save(page: Page, file: string): Promise<Document> {
  const pending = page.waitForEvent('download');
  await page.getByTitle('Save', { exact: true }).click();
  await (await pending).saveAs(file);
  return JSON.parse(await readFile(file, 'utf8'));
}

async function reopen(page: Page, file: string, name: string) {
  await fileMenu(page, 'New Ctrl+N');
  const pending = page.waitForEvent('filechooser');
  await fileMenu(page, 'Open… Ctrl+O');
  await (await pending).setFiles(file);
  await expect(page.locator('.titlebar')).toContainText(name);
}

async function select(control: Locator, start: number, end: number) {
  await control.focus();
  await control.press('Control+Home');
  for (let index = 0; index < start; index++) await control.press('ArrowRight');
  for (let index = start; index < end; index++) await control.press('Shift+ArrowRight');
}

// Observe actual glyphs without depending on whether explicit LF is represented
// by a text node, a BR, or an editor token. This never changes the Selection/DOM.
async function glyph(control: Locator, word: string) {
  return control.evaluate((element, token) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    const text = nodes.map(node => node.data).join(''), start = text.indexOf(token);
    if (start < 0) throw new Error(`Missing rendered text: ${token}`);
    let offset = 0;
    for (const node of nodes) {
      if (start < offset + node.length) {
        const range = document.createRange();
        range.setStart(node, start - offset); range.setEnd(node, start - offset + 1);
        const rect = range.getBoundingClientRect(), style = getComputedStyle(node.parentElement!);
        return { x: rect.x, y: rect.y, height: rect.height, fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, fontStyle: style.fontStyle };
      }
      offset += node.length;
    }
    throw new Error(`No glyph for ${token}`);
  }, word);
}

async function assertBreaks(root: Locator) {
  const first = root.locator('[data-rich-paragraph="0"]');
  const beginning = await glyph(first, 'Linked'), end = await glyph(first, 'line');
  expect(end.y, 'Width AutoFit must not wrap the long linked run').toBeCloseTo(beginning.y, 1);
  const second = root.locator('[data-rich-paragraph="1"]');
  const line = await glyph(second, 'Second'), soft = await glyph(second, 'soft');
  expect(soft.y, 'The authored soft LF must remain a visible line break').toBeGreaterThan(line.y + 10);
}

function invariant(widget: Widget) {
  return { id: widget.id, type: widget.type, x: widget.x, y: widget.y, width: widget.width, height: widget.height, rotation: widget.rotation, shapeText: widget.shapeText, style: widget.style };
}

function fixture() {
  const document = createDocument(); document.name = 'Native shape text editing'; document.caseSelection = 'never';
  const caption = createWidget('box', 55, 65); caption.name = 'AutoFit rich caption';
  caption.width = 160; caption.height = 90;
  // This is the explicitly supported native-text branch; other padding and
  // vertical-alignment combinations deliberately retain their existing layout.
  caption.shapeText = { autoFitWidth: true, autoFitHeight: true };
  caption.style = { ...caption.style, fontFamily: 'Arial', fontSize: 20, fontWeight: 400, textAlign: 'left', verticalAlign: 'top', textPadding: [0, 0, 0, 0] };
  const linkId = uid();
  caption.richText = {
    paragraphs: [
      { runs: [{ text: 'Alpha ', style: { color: '#123456' } }, { text: 'Linked caption must remain on one line', linkId, style: { fontFamily: 'Arial', fontSize: 20, fontWeight: 700, fontStyle: 'italic', color: '#aa2200' } }] },
      { lineHeightPx: 28, runs: [{ text: 'Second\nsoft', style: { fontFamily: 'Arial', fontSize: 16, color: '#552299' } }] },
    ],
    links: [{ id: linkId, name: 'Preserved link', mouseOverStyle: { underline: true }, interactions: [{ id: uid(), name: 'Open literal URL', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'openUrl', value: 'https://example.invalid/native-text', windowTarget: 'new' }] }] }],
  };
  caption.text = caption.richText.paragraphs.map(paragraph => paragraph.runs.map(run => run.text).join('')).join('\n');
  document.pages[0].widgets = [caption];
  return { document, caption, linkId };
}

test('native TT shape editing preserves nowrap, soft breaks, paragraphs, link identity and fixed owner geometry across history and reopen', async ({ page }, info) => {
  test.setTimeout(90_000);
  page.on('dialog', dialog => dialog.accept());
  const errors: string[] = [], openedLinks: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().startsWith('https://example.invalid/')) openedLinks.push(request.url()); });
  const { document, caption, linkId } = fixture(); await open(page, document);
  const original = await save(page, info.outputPath('before.rea.json'));
  const owner = page.locator('.editor-widget.box');
  await owner.evaluate(element => element.ownerDocument.fonts.ready.then(() => undefined));
  const bounds = await owner.boundingBox(); expect(bounds).toMatchObject({ width: 160, height: 90 });
  await assertBreaks(owner);
  const originalLinkedGlyph = await glyph(owner.locator('[data-rich-paragraph="0"]'), 'Linked');

  await owner.dblclick(); const editable = editor(page); await expect(editable).toBeVisible();
  expect(await owner.boundingBox()).toEqual(bounds); await assertBreaks(editable);
  expect(await glyph(editable.locator('[data-rich-paragraph="0"]'), 'Linked')).toEqual(originalLinkedGlyph);
  await select(editable, 6, 12); await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('Linked');
  await tools(page).getByRole('button', { name: 'Underline selection', exact: true }).click();
  const selectedRun = editable.locator('[data-rich-run]').filter({ hasText: /^Linked$/ });
  await expect(selectedRun).toHaveCSS('text-decoration-line', 'underline');
  await editable.press('Control+z');
  await expect(editable.locator('[data-rich-link-id][data-rich-run]').first()).toHaveCSS('text-decoration-line', 'none');
  await editable.press('Control+y'); await expect(selectedRun).toHaveCSS('text-decoration-line', 'underline');

  await editable.press('Control+End'); await editable.press('Shift+Enter'); await page.keyboard.insertText('追加');
  await expect(editable.locator('[data-rich-paragraph]')).toHaveCount(2);
  await editable.press('Enter'); await page.keyboard.insertText('Third');
  await expect(editable.locator('[data-rich-paragraph]')).toHaveCount(3);
  await assertBreaks(editable); expect(await owner.boundingBox()).toEqual(bounds);
  await tools(page).getByRole('button', { name: 'Done editing text', exact: true }).click();

  const file = info.outputPath('edited.rea.json'), saved = await save(page, file), edited = saved.pages[0].widgets[0], rich = edited.richText!;
  expect(invariant(edited)).toEqual(invariant(caption));
  expect(edited.text).toBe(`${caption.text}\n追加\nThird`);
  expect(rich.paragraphs).toHaveLength(3);
  expect(paragraphText(rich, 0)).toBe(paragraphText(caption.richText!, 0));
  expect(paragraphText(rich, 1)).toBe('Second\nsoft\n追加');
  expect(paragraphText(rich, 2)).toBe('Third');
  expect(rich.paragraphs[1].lineHeightPx).toBe(28);
  expect(rich.links).toEqual(caption.richText!.links);
  expect(rich.paragraphs[0].runs[0]).toEqual(caption.richText!.paragraphs[0].runs[0]);
  const linked = rich.paragraphs.flatMap(paragraph => paragraph.runs).filter(run => run.linkId === linkId);
  expect(linked.map(run => run.text).join('')).toBe('Linked caption must remain on one line');
  for (const run of linked) expect(run.style).toMatchObject(caption.richText!.paragraphs[0].runs[1].style!);
  expect(linked.find(run => run.text === 'Linked')?.style?.underline).toBe(true);
  expect(rich.paragraphs[1].runs[0].style).toMatchObject(caption.richText!.paragraphs[1].runs[0].style!);

  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('undo.rea.json'))).toEqual(original);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info.outputPath('redo.rea.json'))).toEqual(saved);
  await reopen(page, file, document.name); expect(await save(page, info.outputPath('reopened.rea.json'))).toEqual(saved);
  await assertBreaks(owner); expect(await owner.boundingBox()).toEqual(bounds);

  await owner.dblclick(); await editor(page).press('Control+End'); await page.keyboard.insertText('Discard this draft');
  await tools(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editor(page)).toHaveCount(0); expect(await save(page, info.outputPath('cancelled.rea.json'))).toEqual(saved);
  await assertBreaks(owner); expect(await owner.boundingBox()).toEqual(bounds);
  expect(errors).toEqual([]); expect(openedLinks).toEqual([]);
  await page.screenshot({ path: info.outputPath('native-text-editing.png') });
});
