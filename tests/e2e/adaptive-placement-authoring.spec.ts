import {expect,test,type Page,type TestInfo} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {createDocument,createWidget,serializeDocument} from '../../src/model/document';
import type {Document} from '../../src/model/types';

function fixture(){
  const doc=createDocument();doc.name='Placement authoring';
  const target=createWidget('box',40,80);target.id='placed-target';target.name='Placement target';target.text='Placement target';
  doc.pages[0].widgets=[target];doc.pages[0].adaptiveViews=[{id:'tablet',name:'Tablet',width:768,overrides:{}},{id:'phone',name:'Phone',width:390,baseViewId:'tablet',overrides:{[target.id]:{style:{fill:'#aaffcc'}}}}];
  return doc;
}
async function open(page:Page,data:string){const pending=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await pending).setFiles({name:'placement-authoring.rea.json',mimeType:'application/json',buffer:Buffer.from(data)});await expect(page.locator('.titlebar')).toContainText('Placement authoring');}
async function save(page:Page,info:TestInfo,suffix:string){const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath(`placement-${suffix}.rea.json`);await(await pending).saveAs(file);return JSON.parse(await readFile(file,'utf8')) as Document;}
async function command(page:Page,name:string){await page.locator('.menubar').getByRole('button',{name:'Edit',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name,exact:true}).click();}
const view=(page:Page,id:string)=>page.getByLabel('Adaptive view',{exact:true}).selectOption(id);
const canvas=(page:Page)=>page.locator('.canvas-surface .editor-widget').filter({hasText:'Placement target'});
const row=(page:Page)=>page.locator('.tree-row').filter({hasText:'Placement target'});

test('child Delete retains the object; Outline placement, undo and All Views survive save/reopen',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto('/');await open(page,serializeDocument(fixture()));await page.getByRole('button',{name:'Outline',exact:true}).click();
  await view(page,'tablet');await row(page).locator('span').click();await page.keyboard.press('Delete');await expect(canvas(page)).toHaveCount(0);await expect(row(page)).toBeVisible();
  const unplaced=await save(page,info,'unplaced');expect(unplaced.pages[0].widgets).toHaveLength(1);expect(unplaced.pages[0].widgets[0].hidden).toBe(false);expect(unplaced.pages[0].adaptiveViews[0].overrides['placed-target']).toMatchObject({placed:false});
  await view(page,'phone');await expect(canvas(page)).toHaveCount(0);await row(page).getByTitle('Place in view',{exact:true}).click();await expect(canvas(page)).toHaveCount(1);
  await page.getByTitle('Undo',{exact:true}).click();await expect(canvas(page)).toHaveCount(0);await page.getByTitle('Redo',{exact:true}).click();await expect(canvas(page)).toHaveCount(1);
  await row(page).locator('span').click();await command(page,'Unplace from All Views');await expect(canvas(page)).toHaveCount(0);
  const all=await save(page,info,'all-unplaced');expect(all.pages[0].widgets[0]).toMatchObject({placed:false,hidden:false});for(const item of all.pages[0].adaptiveViews)expect(item.overrides['placed-target']??{}).not.toHaveProperty('placed');expect(all.pages[0].adaptiveViews[1].overrides['placed-target'].style?.fill).toBe('#aaffcc');
  await command(page,'Place in All Views');await expect(canvas(page)).toHaveCount(1);const restored=await save(page,info,'restored');await open(page,serializeDocument(restored));await view(page,'tablet');await expect(canvas(page)).toHaveCount(1);await view(page,'phone');await expect(canvas(page)).toHaveCount(1);
  await page.screenshot({path:info.outputPath('placement-authoring-restored.png'),fullPage:true});await writeFile(info.outputPath('checks.json'),JSON.stringify({childDeleteKeepsGraph:true,outlineRestore:true,undoRedo:true,allViewsClearsPlacementOnly:true,saveReopen:true}));expect(errors).toEqual([]);
});

test('child insertion is local by default and explicit all-view insertion stays shared',async({page},info)=>{
  page.on('dialog',d=>d.accept());await page.goto('/');await open(page,serializeDocument(fixture()));await view(page,'phone');
  await page.getByTitle('Drag Box onto the canvas',{exact:true}).dblclick();
  const local=await save(page,info,'local-insertion'),added=local.pages[0].widgets.find(w=>w.id!=='placed-target')!;expect(added).toBeDefined();expect(added).toMatchObject({placed:false});expect(local.pages[0].adaptiveViews.find(v=>v.id==='phone')!.overrides[added.id]).toMatchObject({placed:true});
  await view(page,'');await expect(page.locator('.canvas-surface .editor-widget')).toHaveCount(1);
  await view(page,'phone');await page.getByLabel('Affect all views',{exact:true}).check();await page.getByTitle('Drag Box onto the canvas',{exact:true}).dblclick();
  const shared=await save(page,info,'all-insertion'),newShared=shared.pages[0].widgets.find(w=>w.id!=='placed-target'&&w.id!==added.id)!;expect(newShared).toBeDefined();expect(newShared.placed).not.toBe(false);
  await view(page,'');await expect(page.locator('.canvas-surface .editor-widget')).toHaveCount(2);await page.getByRole('button',{name:'Outline',exact:true}).click();await row(page).locator('span').click();await page.keyboard.press('Delete');const deleted=await save(page,info,'base-delete');expect(deleted.pages[0].widgets.some(w=>w.id==='placed-target')).toBe(false);
});

test('Outline placement uses its own target after cell selection and keeps unplaced objects recoverable',async({page},info)=>{
  const doc=fixture(),table=createWidget('table',350,300);table.id='placement-table';table.name='Placement table';doc.pages[0].widgets.push(table);
  page.on('dialog',d=>d.accept());await page.goto('/');await open(page,serializeDocument(doc));await page.getByRole('button',{name:'Outline',exact:true}).click();
  await page.locator('.canvas-surface .editor-widget.table [data-table-cell-id]').first().click();
  await row(page).getByTitle('Unplace from view',{exact:true}).click();await expect(canvas(page)).toHaveCount(0);await expect(row(page)).toHaveAttribute('data-placed','false');
  const filter=page.getByLabel('Outline placement filter',{exact:true});await filter.selectOption({label:'Unplaced'});await expect(row(page)).toBeVisible();await expect(page.locator('.tree-row').filter({hasText:'Placement table'})).toHaveCount(0);
  await row(page).locator('span').click();await page.keyboard.press('ArrowRight');const unmoved=await save(page,info,'outline-unplaced');expect(unmoved.pages[0].widgets[0]).toMatchObject({x:40,placed:false});
  await filter.selectOption({label:'Placed'});await expect(row(page)).toHaveCount(0);await expect(page.locator('.tree-row').filter({hasText:'Placement table'})).toBeVisible();
  await filter.selectOption({label:'All widgets'});await row(page).getByTitle('Place in view',{exact:true}).click();await expect(canvas(page)).toHaveCount(1);await expect(row(page)).toHaveAttribute('data-placed','true');
  const restored=await save(page,info,'outline-restored');expect(restored.pages[0].widgets[0]).toMatchObject({x:40,placed:true,hidden:false});expect(restored.pages[0].widgets[1]).toEqual(table);
});
