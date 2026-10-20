import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Document, EventType, Interaction, Widget } from '../../src/model/types';

function interaction(event: EventType, ...actions: Omit<Action, 'id'>[]): Interaction {
  return { id: uid(), name: event, event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) };
}
function shape(name: string, x: number, y: number): Widget {
  const widget = createWidget('box', x, y);
  return { ...widget, name, text: 'Initial', width: 80, height: 60, shapeText: { autoFitWidth: true, autoFitHeight: true },
    style: { ...widget.style, fontFamily: 'Arial', fontSize: 20, fontWeight: 400, strokeWidth: 0, textPadding: [0,0,0,0], textAlign: 'left', verticalAlign: 'top', lineHeight: 1.2 } };
}
function button(name: string, x: number, y: number, actions: Omit<Action, 'id'>[]): Widget {
  return { ...createWidget('button', x, y), name, text: name, interactions: [interaction('click', ...actions)] };
}
async function openPreview(page: Page, doc: Document) {
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/');
  await page.locator('.menubar').getByRole('button', { name: 'File', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.dropdown-menu').getByRole('button', { name: 'Open… Ctrl+O', exact: true }).click();
  await (await chooser).setFiles({ name: 'runtime-text-autofit.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) });
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  await page.getByTitle('Preview (F5)', { exact: true }).click();
  await page.evaluate(async () => { await document.fonts.ready; });
  return page.locator('.preview-overlay');
}
async function bounds(target: Locator) {
  return target.evaluate(element => { const style = (element as HTMLElement).style; return { x: parseFloat(style.left), y: parseFloat(style.top), width: parseFloat(style.width), height: parseFloat(style.height) }; });
}
// Independent DOM oracle: an inline Arial span in a fixed-line-height block.
// It does not import the product's text measurement or runtime implementation.
async function naturalLine(page: Page, text: string, fontSize = 20, weight = 400, lineHeight = 24) {
  return page.evaluate(({ text, fontSize, weight, lineHeight }) => {
    const block = document.createElement('div'), span = document.createElement('span');
    Object.assign(block.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', fontFamily: 'Arial', fontSize: `${fontSize}px`, fontWeight: String(weight), lineHeight: `${lineHeight}px`, padding: '0', border: '0' });
    span.textContent = text; block.append(span); document.body.append(block);
    const result = { width: span.offsetWidth, height: parseFloat(getComputedStyle(block).height) }; block.remove(); return result;
  }, { text, fontSize, weight, lineHeight });
}
async function unchangedAuthorDocument(page: Page, doc: Document, file: string) {
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); await (await pending).saveAs(file);
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(doc);
}

test('preview measures SetText after painting, preserves first rich formatting, and exposes resize before alignment move', async ({ page }, info) => {
  const doc = createDocument(); doc.name = 'Runtime text geometry'; doc.caseSelection = 'never';
  const target = shape('Fitted rich shape', 400, 180); target.rotation = 30; target.style.textAlign = 'right'; target.style.verticalAlign = 'bottom';
  target.richText = { expressionMode: 'literal', paragraphs: [{ textAlign: 'right', lineHeightPx: 24, runs: [{ text: 'Initial', style: { fontSize: 20, fontWeight: 700 } }, { text: ' second', style: { fontSize: 30 } }] }, { runs: [{ text: 'paragraph' }] }] };
  target.text = 'Initial second\nparagraph';
  const resizeLog = { ...createWidget('text', 30, 330), name: 'Resize log', text: 'not resized', width: 800 }, moveLog = { ...createWidget('text', 30, 380), name: 'Move log', text: 'not moved', width: 800 };
  target.interactions = [interaction('resize', { type: 'setText', targetId: resizeLog.id, value: '[[This.width]]|[[This.height]]|[[This.x]]|[[This.y]]|[[This.widthchange]]' }), interaction('move', { type: 'setText', targetId: moveLog.id, value: '[[This.width]]|[[This.height]]|[[This.x]]|[[This.y]]' })];
  const value = 'A much longer first-formatted line', raw = '  <b>A\rB\u2028C\r\n\nD\n';
  doc.pages[0].widgets = [target, resizeLog, moveLog,
    button('Grow text', 30, 30, [{ type: 'setText', targetId: target.id, value }]),
    button('Raw text', 190, 30, [{ type: 'setText', targetId: target.id, value: raw }]),
    button('Empty text', 350, 30, [{ type: 'setText', targetId: target.id, value: '' }]),
  ];
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const preview = await openPreview(page, doc), owner = preview.locator(`[data-widget-id="${target.id}"]`);
  expect(await bounds(owner)).toEqual({ x: 400, y: 180, width: 80, height: 60 });
  const expected = await naturalLine(page, value, 20, 700);
  await preview.getByRole('button', { name: 'Grow text', exact: true }).click();
  await expect.poll(() => bounds(owner)).toEqual({ x: 480 - expected.width, y: 240 - expected.height, ...expected });
  await expect(owner).toHaveCSS('transform', 'matrix(0.866025, 0.5, -0.5, 0.866025, 0, 0)');
  await expect(owner.locator('[data-rich-paragraph]')).toHaveCount(1); await expect(owner.locator('[data-rich-run]')).toHaveCount(1);
  await expect(owner.locator('[data-rich-run]')).toHaveCSS('font-weight', '700'); await expect(owner.locator('[data-rich-run]')).toHaveCSS('font-size', '20px');
  await expect(preview.locator(`[data-widget-id="${resizeLog.id}"]`)).toHaveText(`${expected.width}|${expected.height}|400|180|${expected.width - 80}`);
  await expect(preview.locator(`[data-widget-id="${moveLog.id}"]`)).toHaveText(`${expected.width}|${expected.height}|${480 - expected.width}|${240 - expected.height}`);
  await preview.getByRole('button', { name: 'Raw text', exact: true }).click();
  const run = owner.locator('[data-rich-run]'); await expect(run.locator(':scope > br')).toHaveCount(3); await expect(run.locator(':scope > span')).toHaveCount(2);
  expect(await run.evaluate(element => Array.from(element.childNodes, node => [node.nodeName, node.textContent]))).toEqual([
    ['SPAN', '  <b>A\rB\u2028C'], ['BR', ''], ['BR', ''], ['SPAN', 'D'], ['BR', ''],
  ]);
  await expect(owner.locator('b')).toHaveCount(0);
  await preview.getByRole('button', { name: 'Empty text', exact: true }).click();
  await expect(owner.locator('.widget-text')).toHaveCSS('display', 'none'); await expect(owner.locator('[data-rich-run] br')).toHaveCount(0);
  await expect.poll(() => bounds(owner)).toEqual({ x: 480, y: 240, width: 0, height: 0 });
  await preview.getByRole('button', { name: 'Grow text', exact: true }).click(); await expect(owner.locator('.widget-text')).toHaveCSS('display', 'block');
  await page.screenshot({ path: info.outputPath('runtime-text-autofit-preview.png') });
  expect(errors).toEqual([]); await unchangedAuthorDocument(page, doc, info.outputPath('runtime-text-autofit-author-unchanged.rea.json'));
});

test('preview measures hidden shapes safely and repeater mutations keep row-local text and geometry', async ({ page }) => {
  const doc = createDocument(); doc.name = 'Hidden and row-local text geometry'; doc.caseSelection = 'never';
  const hidden = shape('Hidden fitted shape', 40, 140); hidden.hidden = true;
  const panel = createWidget('panel', 30, 430), panelChild = shape('Hidden disabled panel child', 10, 10);
  panel.hidden = true; panel.disabled = true; panelChild.disabledStyle = { fontSize: 30, lineHeight: 1 }; panel.states![0].widgets = [panelChild];
  const value = 'Measured while hidden';
  const repeater = createWidget('repeater', 400, 150), child = shape('Row fitted shape', 10, 10); child.height = 30;
  const rowButton = button('Change row text', 10, 50, [{ type: 'setText', targetId: child.id, value: '[[Item.Name]]\nOne\nTwo\nThree' }]); rowButton.height = 30;
  repeater.repeater = { columns: ['Name'], rows: [{ Name: 'First row' }, { Name: 'Second row' }], template: [child, rowButton], layout: 'vertical', itemWidth: 220, itemHeight: 80, gap: 10, fitToContent: true };
  repeater.width = 220; repeater.height = 170;
  doc.pages[0].widgets = [hidden, panel, repeater, button('Set hidden text', 30, 30, [{ type: 'setText', targetId: hidden.id, value }, { type: 'setText', targetId: panelChild.id, value }]), button('Show hidden shape', 200, 30, [{ type: 'show', targetId: hidden.id }, { type: 'show', targetId: panel.id }])];
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const preview = await openPreview(page, doc), expected = await naturalLine(page, value);
  await preview.getByRole('button', { name: 'Set hidden text', exact: true }).click();
  await expect(preview.locator(`[data-widget-id="${hidden.id}"]`)).toHaveCount(0);
  await preview.getByRole('button', { name: 'Show hidden shape', exact: true }).click();
  const revealed = preview.locator(`[data-widget-id="${hidden.id}"]`); await expect(revealed).toBeVisible();
  expect(await bounds(revealed)).toEqual({ x: 40, y: 140, ...expected });
  const nested = preview.locator(`[data-widget-id="${panelChild.id}"]`);
  await expect(nested).toHaveCSS('font-size', '30px');
  expect(await bounds(nested)).toEqual({ x: 10, y: 10, ...await naturalLine(page, value, 30, 400, 30) });
  const rows = preview.locator(`[data-widget-id="${repeater.id}"] > .repeater-row`); await expect(rows).toHaveCount(2);
  const first = rows.nth(0).locator(`[data-widget-id="${child.id}"]`), second = rows.nth(1).locator(`[data-widget-id="${child.id}"]`);
  const beforeFirst = await bounds(first); await rows.nth(1).getByRole('button', { name: 'Change row text', exact: true }).click();
  await expect(second.locator('[data-rich-run] br')).toHaveCount(3);
  await expect(second).toHaveCSS('height', '96px'); expect(await bounds(first)).toEqual(beforeFirst); await expect(first).toHaveText('Initial');
  await expect(rows.nth(1)).toHaveCSS('height', '106px'); await expect(rows.nth(0)).toHaveCSS('height', '80px');
  await expect(page.locator('[data-shape-text-measure]')).toHaveCount(0); expect(errors).toEqual([]);
});

test('adaptive view changes remeasure registered text only and leave initial AutoFit owners untouched', async ({ page }) => {
  const doc = createDocument(); doc.name = 'Registered adaptive AutoFit'; doc.caseSelection = 'never';
  const target = shape('Registered shape', 40, 160), untouched = shape('Unregistered shape', 180, 160);
  target.shapeText = untouched.shapeText = { autoFitWidth: false, autoFitHeight: true };
  target.width = untouched.width = 100; target.height = untouched.height = 80;
  target.text = untouched.text = 'A repeated phrase that wraps into several lines';
  // This regression checks the prior max-width switch, not the new size selection.
  delete doc.pages[0].adaptiveSelection; delete doc.pages[0].adaptiveBaseSize;
  doc.pages[0].adaptiveViews = [{ id: uid(), name: 'Phone text', width: 390, overrides: { [target.id]: { style: { fontSize: 30 } }, [untouched.id]: { style: { fontSize: 30 } } } }];
  doc.pages[0].widgets = [target, untouched, button('Register text', 30, 30, [{ type: 'setText', targetId: target.id, value: target.text }])];
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const preview = await openPreview(page, doc), registered = preview.locator(`[data-widget-id="${target.id}"]`), initial = preview.locator(`[data-widget-id="${untouched.id}"]`);
  await expect(registered).toHaveCSS('height', '80px'); await expect(initial).toHaveCSS('height', '80px');
  await preview.getByRole('button', { name: 'Register text', exact: true }).click();
  const desktopHeight = (await bounds(registered)).height;
  await expect.poll(() => registered.locator('.widget-text').evaluate(element => parseFloat(getComputedStyle(element).height))).toBe(desktopHeight);
  await preview.getByTitle('Mobile', { exact: true }).click();
  await expect(registered.locator('[data-rich-run]')).toHaveCSS('font-size', '30px');
  await expect.poll(async () => (await bounds(registered)).height).toBeGreaterThan(desktopHeight);
  expect((await bounds(registered)).height).toBe(await registered.locator('.widget-text').evaluate(element => parseFloat(getComputedStyle(element).height)));
  await expect(initial).toHaveCSS('height', '80px'); await expect(initial.locator('.widget-text')).toHaveCSS('font-size', '30px');
  expect(errors).toEqual([]);
});
