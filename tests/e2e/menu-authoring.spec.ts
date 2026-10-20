import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, parseDocument, serializeDocument, uid } from '../../src/model/document';
import { createMenu } from '../../src/model/menu';
import type { Document, Widget } from '../../src/model/types';

const inspector=(page:Page)=>page.getByRole('complementary',{name:'Properties inspector'});
const item=(page:Page,id:string)=>page.locator(`[data-menu-item-id="${id}"]`);
const menuBody=(page:Page,id:string)=>page.locator(`[data-menu-id="${id}"]`);
const cells=(menu:Widget)=>menu.menu!.table.table!.cells;
async function command(page:Page,name:string,entry:string){await page.locator('.menubar').getByRole('button',{name,exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:entry,exact:true}).click()}
async function open(page:Page,doc:Document){await page.goto('/');const chooser=page.waitForEvent('filechooser');await command(page,'File','Open… Ctrl+O');await(await chooser).setFiles({name:'menu.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name)}
async function save(page:Page,path:string):Promise<Document>{const download=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();await(await download).saveAs(path);return parseDocument(await readFile(path,'utf8'))}
async function field(page:Page,name:string,value:string){const control=inspector(page).getByLabel(name,{exact:true});await control.fill(value);await control.press('Tab')}
async function button(page:Page,name:string){await inspector(page).getByRole('button',{name,exact:true}).click()}
async function text(page:Page,id:string,value:string,italic=false){await item(page,id).dblclick();const editor=page.getByRole('textbox',{name:'Formatted text content',exact:true});await expect(editor).toBeVisible();await editor.press('Control+a');await editor.press('Backspace');await editor.pressSequentially(value);if(italic){await editor.press('Control+a');await page.getByRole('button',{name:'Italic selection',exact:true}).click()}await page.getByRole('button',{name:'Done editing text',exact:true}).click()}
function fixture(orientation:'horizontal'|'vertical'='vertical'){const doc=createDocument(),menu=createMenu(orientation,100,100),outside=createWidget('text',520,80);doc.name='Menu authoring';doc.pages[0].widgets=[menu,outside];return{doc,menu,outside}}

test('horizontal menu Library creates independent items, nested in-place rich text and submenu padding round-trip',async({page},info)=>{
  page.on('dialog',dialog=>dialog.accept());await page.goto('/');await page.getByTitle('Drag Horizontal Menu onto the canvas',{exact:true}).dblclick();
  let doc=await save(page,info.outputPath('created.rea.json')),root=doc.pages[0].widgets[0];expect(root.type).toBe('menu');expect(root.menu!.orientation).toBe('horizontal');expect(cells(root).map(cell=>cell.text)).toEqual(['File','Edit','View']);expect(root.menu!.submenus).toEqual([]);
  await text(page,cells(root)[0].id,'Products',true);await item(page,cells(root)[0].id).click();await button(page,'Add submenu');
  doc=await save(page,info.outputPath('submenu.rea.json'));root=doc.pages[0].widgets[0];let child=root.menu!.submenus[0];expect(child.menu!.orientation).toBe('vertical');expect(cells(child)).toHaveLength(3);expect(child.menu!.parentCellId).toBe(cells(root)[0].id);await expect(menuBody(page,child.id)).toBeVisible();
  await item(page,cells(child)[1].id).click();await button(page,'Add submenu');doc=await save(page,info.outputPath('nested.rea.json'));root=doc.pages[0].widgets[0];child=root.menu!.submenus[0];let grandchild=child.menu!.submenus[0];await expect(menuBody(page,grandchild.id)).toBeVisible();
  await text(page,cells(grandchild)[0].id,'Deep choice',true);await button(page,'Select containing menu');
  for(const [side,value]of Object.entries({top:'5',right:'9',bottom:'7',left:'11'}))await field(page,`Menu padding ${side}`,value);
  await field(page,'Fill','#fedcba');doc=await save(page,info.outputPath('styled.rea.json'));root=doc.pages[0].widgets[0];grandchild=root.menu!.submenus[0].menu!.submenus[0];
  expect(grandchild.menu!.padding).toEqual([5,9,7,11]);expect(grandchild.menu!.table).toMatchObject({x:11,y:5,width:100,height:90});expect(grandchild).toMatchObject({width:120,height:102,style:{fill:'#fedcba'}});expect(cells(grandchild)[0].text).toBe('Deep choice');expect(cells(grandchild)[0].richText!.paragraphs[0].runs.every(run=>run.style?.fontStyle==='italic')).toBe(true);expect(cells(root)[0].text).toBe('Products');
  await command(page,'File','New Ctrl+N');await open(page,doc);expect(await save(page,info.outputPath('reopened.rea.json'))).toEqual(doc);
  await page.getByRole('button',{name:'Outline',exact:true}).click();await page.getByRole('button',{name:`Select menu item ${cells(grandchild)[0].name}`,exact:true}).last().click();await expect(menuBody(page,grandchild.id)).toBeVisible();await expect(inspector(page).getByLabel('Widget name',{exact:true})).toHaveValue(cells(grandchild)[0].name);
  expect(await save(page,info.outputPath('expanded-session.rea.json'))).toEqual(doc);
});

test('vertical item insert/reorder/delete retains owner identities and submenu subtree deletion is one undo step',async({page},info)=>{
  const{doc}=fixture();await open(page,doc);let root=doc.pages[0].widgets[0];const first=cells(root)[0].id;
  await item(page,first).click();await button(page,'Add submenu');let saved=await save(page,info.outputPath('with-submenu.rea.json'));root=saved.pages[0].widgets[0];const subtree=root.menu!.submenus[0];
  await item(page,first).click();await button(page,'Add menu item before');saved=await save(page,info.outputPath('inserted.rea.json'));root=saved.pages[0].widgets[0];const inserted=cells(root)[0].id;expect(cells(root)[1].id).toBe(first);expect(root.menu!.submenus[0].menu!.parentCellId).toBe(first);
  await button(page,'Move menu item later');saved=await save(page,info.outputPath('reordered.rea.json'));root=saved.pages[0].widgets[0];expect(cells(root).slice(0,2).map(cell=>cell.id)).toEqual([first,inserted]);
  await button(page,'Delete menu item');saved=await save(page,info.outputPath('removed-insert.rea.json'));root=saved.pages[0].widgets[0];expect(cells(root)).toHaveLength(3);expect(root.menu!.submenus[0]).toEqual(subtree);
  await item(page,first).click();await button(page,'Delete submenu');const removed=await save(page,info.outputPath('removed-submenu.rea.json'));expect(removed.pages[0].widgets[0].menu!.submenus).toEqual([]);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info.outputPath('restore-submenu.rea.json'))).toEqual(saved);await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info.outputPath('redo-remove-submenu.rea.json'))).toEqual(removed);
  await item(page,first).click();await button(page,'Select containing menu');await field(page,'W','200');await field(page,'Menu padding left','8');await field(page,'Menu padding right','12');
  saved=await save(page,info.outputPath('resized-menu.rea.json'));root=saved.pages[0].widgets[0];expect(root.width).toBe(220);expect(cells(root).map(cell=>cell.width)).toEqual([200,200,200]);
  await inspector(page).getByLabel('Menu orientation',{exact:true}).selectOption('horizontal');saved=await save(page,info.outputPath('changed-orientation.rea.json'));root=saved.pages[0].widgets[0];expect(root.menu!.table.table!.columnWidths).toEqual([200,200,200]);expect(root.menu!.table.table!.rowHeights).toEqual([30]);expect(root.width).toBe(620);expect(cells(root).map(cell=>cell.id)).toEqual(cells(removed.pages[0].widgets[0]).map(cell=>cell.id));
});

test('menu item actions, adaptive shared edits and whole-menu duplication preserve independent tables and remap item references',async({page},info)=>{
  const{doc,menu}=fixture('horizontal');doc.pages[0].adaptiveViews=[{id:uid(),name:'Mobile',width:700,overrides:{}}];await open(page,doc);await page.getByLabel('Adaptive view',{exact:true}).selectOption(doc.pages[0].adaptiveViews[0].id);
  const first=cells(menu)[0].id,second=cells(menu)[1].id;await item(page,first).click();await field(page,'W','150');await field(page,'Fill','#abcdef');
  await inspector(page).getByRole('tab',{name:'Interactions',exact:true}).click();await button(page,'New interaction');await button(page,'Add action');await inspector(page).getByLabel('Action 1 type',{exact:true}).selectOption('setText');
  const targets=inspector(page).getByLabel('Action 1 target',{exact:true});await expect(targets.locator(`option[value="${menu.id}"]`)).toHaveCount(0);await targets.selectOption(second);await inspector(page).getByLabel('Action value',{exact:true}).fill('Changed from first');
  let saved=await save(page,info.outputPath('item-action.rea.json'));expect(saved.pages[0].adaptiveViews[0].overrides).toEqual({});expect(cells(saved.pages[0].widgets[0])[0]).toMatchObject({width:150,style:{fill:'#abcdef'},interactions:[{actions:[{type:'setText',targetId:second,value:'Changed from first'}]}]});
  await inspector(page).getByRole('tab',{name:'Style',exact:true}).click();await button(page,'Select containing menu');await page.locator('.canvas-surface').focus();await page.keyboard.press('Control+d');saved=await save(page,info.outputPath('duplicated.rea.json'));const menus=saved.pages[0].widgets.filter(widget=>widget.type==='menu');expect(menus).toHaveLength(2);
  expect(menus[1].id).not.toBe(menus[0].id);expect(menus[1].menu!.table.id).not.toBe(menus[0].menu!.table.id);expect(cells(menus[1])[0].id).not.toBe(first);expect(cells(menus[1])[0].interactions[0].actions[0].targetId).toBe(cells(menus[1])[1].id);expect(cells(menus[1])[0].interactions[0].id).not.toBe(cells(menus[0])[0].interactions[0].id);
  await page.getByTitle('Undo',{exact:true}).click();expect((await save(page,info.outputPath('duplicate-undo.rea.json'))).pages[0].widgets.filter(widget=>widget.type==='menu')).toHaveLength(1);
  await page.getByTitle('Drag Vertical Menu onto the canvas',{exact:true}).dblclick();saved=await save(page,info.outputPath('vertical-library.rea.json'));const added=saved.pages[0].widgets.at(-1)!;expect(added.menu!.orientation).toBe('vertical');expect(added.menu!.table.table!.columnWidths).toEqual([100]);expect(added.menu!.table.table!.rowHeights).toEqual([30,30,30]);
});
