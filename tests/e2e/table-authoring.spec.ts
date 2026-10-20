import { expect, test, type Page, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, parseDocument, serializeDocument, uid } from '../../src/model/document';
import type { Document, Widget } from '../../src/model/types';

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Properties inspector' });
const table = (page: Page) => page.locator('.editor-widget.table');
const cell = (page: Page, row: number, column: number) => table(page).getByRole('gridcell', { name: `Cell row ${row} column ${column}`, exact: true });
const controls = (page: Page) => page.getByRole('group', { name: 'Table editing controls', exact: true });
async function menu(page: Page, name: string, action: string) { await page.locator('.menubar').getByRole('button', { name, exact: true }).click(); await page.locator('.dropdown-menu').getByRole('button', { name: action, exact: true }).click(); }
async function open(page: Page, doc: Document) { await page.goto('/'); const chooser = page.waitForEvent('filechooser'); await menu(page, 'File', 'Open… Ctrl+O'); await (await chooser).setFiles({ name: 'table.rea.json', mimeType: 'application/json', buffer: Buffer.from(serializeDocument(doc)) }); await expect(table(page)).toHaveCount(1); }
async function save(page: Page, path: string): Promise<Document> { const download = page.waitForEvent('download'); await page.getByTitle('Save', { exact: true }).click(); await (await download).saveAs(path); return parseDocument(await readFile(path, 'utf8')); }
async function field(page: Page, name: string, value: string) { const input = inspector(page).getByLabel(name, { exact: true }); await input.fill(value); await input.press('Tab'); }
async function content(page: Page, target: Locator, value: string) { await target.dblclick(); const editable = page.getByRole('textbox', { name: 'Formatted text content', exact: true }); await expect(editable).toBeVisible(); await editable.press('Control+a'); await editable.press('Backspace'); await editable.pressSequentially(value); await page.getByRole('button', { name: 'Done editing text', exact: true }).click(); }
async function paste(page: Page, text: string) { await page.locator('.canvas-surface').evaluate((element, value) => { const data = new DataTransfer(); data.setData('text/plain', value); element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })); }, text); }
function fixture() { const doc = createDocument(), grid = createWidget('table', 100, 100), target = createWidget('text', 500, 100); doc.name = 'Table authoring'; grid.name = 'Order table'; target.name = 'Outside status'; target.text = 'Waiting'; doc.pages[0].widgets = [grid, target]; return { doc, grid, target }; }

test('table Library creation, inline cell rich text, track insert/delete/reorder and shared geometry save/reopen', async ({ page }, info) => {
  page.on('dialog', dialog => dialog.accept()); await page.goto('/'); await page.getByTitle('Drag Table onto the canvas', { exact: true }).dblclick();
  await expect(table(page)).toHaveCount(1); await expect(table(page).getByRole('gridcell')).toHaveCount(9);
  await expect(cell(page, 1, 1)).toHaveText('Column 1'); await expect(table(page)).toHaveCSS('width', '300px'); await expect(table(page)).toHaveCSS('height', '90px');
  await content(page, cell(page, 2, 2), 'Mixed cell'); await cell(page, 2, 2).dblclick();
  const editable = page.getByRole('textbox', { name: 'Formatted text content', exact: true }); await editable.press('Control+a');
  await page.getByRole('button', { name: 'Italic selection', exact: true }).click(); await page.getByRole('button', { name: 'Done editing text', exact: true }).click();
  const initial = await save(page, info.outputPath('initial.rea.json')), originalId = initial.pages[0].widgets[0].table!.cells[4].id;
  await cell(page, 2, 2).click(); await field(page, 'W', '145'); await field(page, 'H', '48');
  const sized = await save(page, info.outputPath('sized.rea.json'));
  expect(sized.pages[0].widgets[0].table!.columnWidths).toEqual([100, 145, 100]); expect(sized.pages[0].widgets[0].table!.rowHeights).toEqual([30, 48, 30]);
  expect(sized.pages[0].widgets[0].width).toBe(345); expect(sized.pages[0].widgets[0].height).toBe(108);
  await inspector(page).getByRole('button', { name: 'Insert row above', exact: true }).click(); await inspector(page).getByRole('button', { name: 'Insert column left', exact: true }).click();
  let current = await save(page, info.outputPath('inserted.rea.json')); expect(current.pages[0].widgets[0].table!.cells).toHaveLength(16);
  expect(current.pages[0].widgets[0].table!.cells[2 * 4 + 2]).toMatchObject({ id: originalId, text: 'Mixed cell' });
  await inspector(page).getByRole('button', { name: 'Move row up', exact: true }).click(); await inspector(page).getByRole('button', { name: 'Move column left', exact: true }).click();
  current = await save(page, info.outputPath('moved.rea.json')); expect(current.pages[0].widgets[0].table!.cells[1 * 4 + 1].id).toBe(originalId);
  await controls(page).getByRole('button', { name: 'Select row 3', exact: true }).click(); await inspector(page).getByRole('button', { name: 'Delete rows', exact: true }).click();
  await controls(page).getByRole('button', { name: 'Select column 3', exact: true }).click(); await inspector(page).getByRole('button', { name: 'Delete columns', exact: true }).click();
  current = await save(page, info.outputPath('final.rea.json')); const result = current.pages[0].widgets[0]; expect(result.table!.cells).toHaveLength(9); expect(result.table!.cells[4]).toMatchObject({ id: originalId, text: 'Mixed cell' });
  expect(result.table!.cells[4].richText!.paragraphs[0].runs.every(run => run.style?.fontStyle === 'italic')).toBe(true);
  await controls(page).getByRole('button', { name: 'Select row 3', exact: true }).dragTo(controls(page).getByRole('button', { name: 'Select row 1', exact: true }));
  const reordered = await save(page, info.outputPath('drag-reordered.rea.json'));
  expect(reordered.pages[0].widgets[0].table!.cells.slice(0,3).map(cell=>cell.id)).toEqual(result.table!.cells.slice(6,9).map(cell=>cell.id));
  await page.getByTitle('Undo', { exact: true }).click(); expect(await save(page, info.outputPath('drag-reorder-undo.rea.json'))).toEqual(current);
  await menu(page, 'File', 'New Ctrl+N'); await open(page, current); expect(await save(page, info.outputPath('reopened.rea.json'))).toEqual(current);
  await cell(page, 2, 2).click(); await page.getByRole('button', { name: 'Outline', exact: true }).click(); await expect(page.getByRole('button', { name: `Select ${result.name} row 2 column 2`, exact: true })).toHaveClass(/selected/);
});

test('cell multi-selection and rotated boundary gestures preserve grid geometry, one-step undo and cancellation', async ({ page }, info) => {
  const { doc, grid } = fixture(); grid.rotation = 20; await open(page, doc); await page.getByLabel('Zoom', { exact: true }).selectOption('1.5');
  await cell(page,1,1).click(); await page.keyboard.press('Shift+ArrowRight'); await expect(page.locator('.table-cell-selection')).toHaveCount(2);
  await page.keyboard.press('Shift+ArrowRight'); await expect(page.locator('.table-cell-selection')).toHaveCount(3);
  await page.keyboard.press('Shift+ArrowDown'); await expect(page.locator('.table-cell-selection')).toHaveCount(6);
  await page.keyboard.press('Shift+ArrowLeft'); await expect(page.locator('.table-cell-selection')).toHaveCount(4);
  await page.keyboard.press('ArrowDown'); await expect(page.locator('.table-cell-selection')).toHaveCount(1);
  await expect(inspector(page).getByLabel('Widget name', { exact:true })).toHaveValue(grid.table!.cells[7].name);
  await cell(page, 1, 1).click(); await cell(page, 2, 2).click({ modifiers: ['Shift'] }); await expect(page.locator('.table-cell-selection')).toHaveCount(2);
  await field(page, 'W', '120'); let saved = await save(page, info.outputPath('multi.rea.json')); expect(saved.pages[0].widgets[0].table!.columnWidths).toEqual([120,120,100]);
  await page.getByTitle('Undo', { exact: true }).click(); expect((await save(page, info.outputPath('multi-undo.rea.json'))).pages[0].widgets[0]).toEqual(grid);
  await cell(page, 2, 2).click(); const handle = controls(page).getByRole('separator', { name: 'Resize column 2', exact: true });
  const bounds = await handle.boundingBox(); const x = bounds!.x + bounds!.width / 2, y = bounds!.y + bounds!.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + Math.cos(Math.PI / 9) * 30, y + Math.sin(Math.PI / 9) * 30, { steps: 5 }); await page.mouse.up();
  saved = await save(page, info.outputPath('resized.rea.json')); expect(saved.pages[0].widgets[0].table!.columnWidths[1]).toBeCloseTo(120, 1); expect(saved.pages[0].widgets[0].rotation).toBe(20);
  const resized = saved; await cell(page, 2, 2).click(); const same = await handle.boundingBox(); const sx = same!.x + same!.width / 2, sy = same!.y + same!.height / 2;
  await page.mouse.move(sx,sy); await page.mouse.down(); await page.mouse.move(sx+20,sy+10); await page.mouse.move(sx,sy); await page.mouse.up();
  expect(await save(page, info.outputPath('returned.rea.json'))).toEqual(resized);
  await page.mouse.move(sx,sy); await page.mouse.down(); await page.mouse.move(sx+30,sy+10); await page.keyboard.press('Control+z'); await page.mouse.move(sx+50,sy+15); await page.mouse.up();
  expect(await save(page, info.outputPath('cancelled.rea.json'))).toEqual(resized);
  await page.getByTitle('Undo', { exact: true }).click(); expect((await save(page, info.outputPath('resize-undo.rea.json'))).pages[0].widgets[0]).toEqual(grid);
  await page.getByTitle('Redo', { exact: true }).click(); expect(await save(page, info.outputPath('resize-redo.rea.json'))).toEqual(resized);
  await cell(page,2,2).click(); const owner=controls(page).getByRole('button',{name:'Select whole table',exact:true});const ownerBox=await owner.boundingBox();
  await page.mouse.move(ownerBox!.x+ownerBox!.width/2,ownerBox!.y+ownerBox!.height/2);await page.mouse.down();await page.mouse.move(ownerBox!.x+ownerBox!.width/2+30,ownerBox!.y+ownerBox!.height/2+15,{steps:4});await page.mouse.up();
  const moved=await save(page,info.outputPath('whole-table-drag.rea.json'));expect(moved.pages[0].widgets[0]).toEqual({...resized.pages[0].widgets[0],x:120,y:110});
  await page.keyboard.press('Enter');await expect(page.locator('.inline-text-editor')).toHaveCount(0);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info.outputPath('whole-table-drag-undo.rea.json'))).toEqual(resized);
});

test('bounded spreadsheet paste, Paste as table, cell interaction targets and duplicate identities round-trip', async ({ page }, info) => {
  const { doc, grid, target } = fixture(); doc.pages[0].adaptiveViews = [{ id: uid(), name: 'Phone', width: 390, overrides: {} }]; await open(page, doc);
  await page.getByLabel('Adaptive view', { exact: true }).selectOption(doc.pages[0].adaptiveViews[0].id); await cell(page, 2, 2).click();
  await paste(page, 'A\tB\tclipped\r\n"two\nlines"\tD\tclipped\r\nclipped\tclipped');
  let saved = await save(page, info.outputPath('pasted.rea.json')); expect(saved.pages[0].widgets[0].table!.cells.map(cell => cell.text)).toEqual(['Column 1','Column 2','Column 3','','A','B','','two\nlines','D']); expect(saved.pages[0].adaptiveViews[0].overrides).toEqual({});
  await cell(page, 2, 2).click(); await inspector(page).getByRole('tab', { name: 'Interactions', exact: true }).click();
  await inspector(page).getByRole('button', { name: 'New interaction', exact: true }).click(); await inspector(page).getByRole('button', { name: 'Add action', exact: true }).click();
  await inspector(page).getByLabel('Action 1 type', { exact: true }).selectOption('setText'); await inspector(page).getByLabel('Action 1 target', { exact: true }).selectOption(target.id); await inspector(page).getByLabel('Action value', { exact: true }).fill('Cell clicked');
  saved = await save(page, info.outputPath('cell-action.rea.json')); expect(saved.pages[0].widgets[0].table!.cells[4].interactions[0].actions[0]).toMatchObject({ type:'setText',targetId:target.id,value:'Cell clicked' });
  await controls(page).getByRole('button', { name: 'Select whole table', exact: true }).click(); await page.keyboard.press('Control+d');
  saved = await save(page, info.outputPath('duplicated.rea.json')); const grids = saved.pages[0].widgets.filter(widget => widget.type==='table'); expect(grids).toHaveLength(2);
  expect(grids[1].table!.cells.every((cell,index) => cell.id !== grids[0].table!.cells[index].id)).toBe(true); expect(grids[1].table!.cells[4].interactions[0].id).not.toBe(grids[0].table!.cells[4].interactions[0].id); expect(grids[1].table!.cells[4].interactions[0].actions[0].targetId).toBe(target.id);
  await menu(page,'Edit','Paste as table…'); const dialog=page.getByRole('dialog',{name:'Paste as table',exact:true}); await dialog.getByLabel('Table data',{exact:true}).fill('Name\tCount\n"A\tB"\t2'); await dialog.getByRole('button',{name:'Insert table',exact:true}).click();
  saved=await save(page,info.outputPath('paste-new.rea.json')); const created=saved.pages[0].widgets.at(-1)!; expect(created.type).toBe('table'); expect(created.table!.columnWidths).toEqual([100,100]); expect(created.table!.cells.map(cell=>cell.text)).toEqual(['Name','Count','A\tB','2']);
  expect(grid.table!.cells[4].text).toBe(''); expect(doc.pages[0].widgets[1].text).toBe('Waiting');
});
