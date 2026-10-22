import {expect, test, type Page, type TestInfo} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createDocument, createWidget, serializeDocument} from '../../src/model/document';
import type {Document} from '../../src/model/types';

const cache='rea-prototype-document-v1';
function fixture() {
  const doc=createDocument();
  doc.pages[0].widgets=[
    {...createWidget('box',80,80),id:'shortcut-a',name:'First',width:100,height:60,text:'First'},
    {...createWidget('box',300,220),id:'shortcut-b',name:'Second',width:60,height:40,text:'Second'},
  ];
  return doc;
}
async function open(page:Page,doc:Document) {
  await page.addInitScript(({cache,text})=>localStorage.setItem(cache,text),{cache,text:serializeDocument(doc)});
  await page.goto('/');
  await expect(page.locator('.canvas-surface')).toBeVisible();
}
async function save(page:Page,info:TestInfo,name:string):Promise<Document> {
  const pending=page.waitForEvent('download');
  await page.getByTitle('Save',{exact:true}).click();
  const file=info.outputPath(`${name}.rea.json`);await(await pending).saveAs(file);
  return JSON.parse(await readFile(file,'utf8'));
}
async function selectAll(page:Page) {
  await page.locator('.editor-widget').first().click({position:{x:35,y:20}});
  await page.keyboard.press('Control+a');
  await expect(page.locator('.editor-widget.is-selected')).toHaveCount(2);
}

test('unsupported modifier combinations cannot cut, duplicate, paste or create a document',async({page},info)=>{
  await open(page,fixture());
  await selectAll(page);
  await page.keyboard.press('Control+c');
  const before=await save(page,info,'before');
  const dialogs:string[]=[];page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss()});
  for(const chord of ['Control+Alt+x','Control+Alt+v','Control+Shift+Alt+d','Control+Shift+n','Alt+Delete']) {
    await page.locator('.canvas-surface').focus();await page.keyboard.press(chord);
    await expect(page.locator('.editor-widget')).toHaveCount(2);
    expect(await save(page,info,chord.replaceAll('+','-'))).toEqual(before);
  }
  expect(dialogs).toEqual([]);
  await page.locator('.canvas-surface').focus();await page.keyboard.press('Control+d');
  await expect(page.locator('.editor-widget')).toHaveCount(4);
  await page.keyboard.press('Control+z');await expect(page.locator('.editor-widget')).toHaveCount(2);
  await page.keyboard.press('Control+Shift+z');await expect(page.locator('.editor-widget')).toHaveCount(4);
});

test('Ctrl Alt C aligns selected widgets and keeps normal undo and copy independent',async({page},info)=>{
  await open(page,fixture());await selectAll(page);
  const before=await save(page,info,'before');
  await page.locator('.canvas-surface').focus();await page.keyboard.press('Control+Alt+c');
  await expect(page.locator('.editor-widget').nth(0)).toHaveCSS('left','170px');
  await expect(page.locator('.editor-widget').nth(1)).toHaveCSS('left','190px');
  const aligned=await save(page,info,'aligned');
  expect(aligned.pages[0].widgets.map(w=>({x:w.x,y:w.y,width:w.width}))).toEqual([
    {x:170,y:80,width:100},{x:190,y:220,width:60},
  ]);
  await page.locator('.canvas-surface').focus();await page.keyboard.press('Control+z');
  expect(await save(page,info,'undo')).toEqual(before);
  await selectAll(page);await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
  await expect(page.locator('.editor-widget')).toHaveCount(4);
});

test('Ctrl Shift O exports HTML and Ctrl period previews without opening a file',async({page},info)=>{
  await open(page,fixture());
  const files:string[]=[];page.on('filechooser',()=>files.push('open'));
  const downloads:import('@playwright/test').Download[]=[];page.on('download',download=>downloads.push(download));
  await page.locator('.canvas-surface').focus();await page.keyboard.press('Control+Shift+o');
  await expect.poll(()=>downloads.length).toBe(1);
  expect(downloads[0].suggestedFilename()).toMatch(/\.html$/);
  const output=info.outputPath('shortcut-export.html');await downloads[0].saveAs(output);
  const html=await readFile(output,'utf8');expect(html).toContain('First');expect(html).toContain('Second');
  expect(files).toEqual([]);
  await page.keyboard.press('Control+.');await expect(page.locator('.preview-overlay')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('.preview-overlay')).toHaveCount(0);
});

test('insertion and quick action chords work while text fields retain their keyboard input',async({page})=>{
  await open(page,createDocument());
  await page.locator('.canvas-surface').focus();await page.keyboard.press('Control+Shift+b');
  await page.locator('.canvas-surface').click({position:{x:200,y:180}});
  await expect(page.locator('.editor-widget.box')).toHaveCount(1);
  const text=page.getByRole('complementary',{name:'Properties inspector'}).getByLabel('Widget text',{exact:true});
  await text.fill('Readable');await text.press('Control+a');await text.press('Control+Shift+b');await text.press('d');
  await expect(text).toHaveValue('d');await expect(page.locator('.editor-widget')).toHaveCount(1);
  await page.locator('.canvas-surface').focus();await page.keyboard.press('Control+/');
  await expect(page.getByPlaceholder('Insert a widget or go to a page…')).toBeVisible();
});

test('modified Delete and arrows do not edit table cells through the plain-key path',async({page},info)=>{
  const doc=createDocument();const table=createWidget('table',80,80);table.table!.cells[0].text='Keep this cell';table.table!.cells[1].text='Keep second cell';doc.pages[0].widgets=[table];
  await open(page,doc);
  const cell=page.locator('[data-table-cell-id]').filter({hasText:'Keep this cell'}).first();await cell.click();
  const before=await save(page,info,'table-before');
  await page.locator('.canvas-surface').focus();await page.keyboard.press('Control+Alt+Delete');
  expect(await save(page,info,'table-after')).toEqual(before);
  await expect(cell).toContainText('Keep this cell');
  await page.locator('.canvas-surface').focus();await page.keyboard.press('Control+ArrowRight');await page.keyboard.press('Delete');
  const cleared=await save(page,info,'table-plain-delete');
  expect(cleared.pages[0].widgets[0].table!.cells[0].text).toBe('');
  expect(cleared.pages[0].widgets[0].table!.cells[1].text).toBe('Keep second cell');
});
