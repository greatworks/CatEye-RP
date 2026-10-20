import {expect,test,type Page,type Locator} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {menuFixture} from '../fixtures/menus';
import {createWidget,serializeDocument} from '../../src/model/document';
async function open(page:Page){const doc=menuFixture();const overlap=createWidget('box',60,215);Object.assign(overlap,{id:'menu-overlap',name:'Later ordinary sibling',text:'Behind open submenu',width:130,height:50});doc.pages[0].widgets.push(overlap);await page.goto('/');const chooser=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await chooser).setFiles({name:'menus.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);return doc}
async function exercise(page:Page,scope:Locator,screenshot:string){
 const w=(id:string)=>scope.locator(`[data-widget-id="${id}"]`),status=w('menu-status');
 await expect(w('menu-main')).toHaveCSS('width','472px');await expect(w('menu-main')).toHaveCSS('height','54px');await expect(w('menu-file')).toHaveCount(0);await expect(w('menu-recent')).toHaveCount(0);
 await w('menu-main-item-0').hover();await expect(w('menu-file')).toBeVisible();await expect(w('menu-recent')).toHaveCount(0);
 const first=await w('menu-file-item-0').boundingBox();expect(await page.evaluate(point=>document.elementFromPoint(point.x,point.y)?.closest('[data-widget-id]')?.getAttribute('data-widget-id'),{x:first!.x+first!.width/2,y:first!.y+first!.height/2})).toBe('menu-file-item-0');await w('menu-file-item-0').click();await expect(status).toHaveText('Created a new project');
 await w('menu-file-item-2').hover();await expect(w('menu-recent')).toBeVisible();await w('menu-recent-item-0').click();await expect(status).toHaveText('Opened Alpha project');await expect(w('menu-recent')).toBeVisible();await expect(w('menu-recent-item-0')).toHaveCSS('background-color','rgb(209, 250, 229)');await page.screenshot({path:screenshot,fullPage:true});
 await w('menu-main-item-1').hover();await expect(w('menu-edit')).toBeVisible();await expect(w('menu-file')).toHaveCount(0);await expect(w('menu-recent')).toHaveCount(0);await w('menu-edit-item-0').click();await expect(status).toHaveText('Undo chosen');await expect(w('menu-edit')).toBeVisible();
 await w('menu-caption').hover();await expect(w('menu-edit')).toHaveCount(0);
 // A browser-only geometry probe: model padding positions the table, whereas
 // this injected CSS padding deliberately exercises jQuery content-box bounds.
 for(const outside of[false,true]){
   await w('menu-caption').hover();await w('menu-main-item-0').hover();await expect(w('menu-file')).toBeVisible();
   const box=await w('menu-file').evaluate(element=>{const node=element as HTMLElement;node.style.boxSizing='border-box';node.style.borderWidth='4px';node.style.padding='3px 8px 5px 6px';const rect=node.getBoundingClientRect(),css=getComputedStyle(node);return{left:rect.left,top:rect.top,width:parseFloat(css.width)-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)-parseFloat(css.borderLeftWidth)-parseFloat(css.borderRightWidth)}});
   await page.mouse.move(box.left+box.width+(outside?1:-1),box.top+1);
   if(outside)await expect(w('menu-file')).toHaveCount(0);else await expect(w('menu-file')).toBeVisible();
 }

 await w('menu-main-item-2').click();await expect(status).toHaveText('Root menu handled this click');
 await w('menu-side-item-1').hover();await expect(w('menu-reports')).toBeVisible();const parent=await w('menu-side-item-1').boundingBox(),child=await w('menu-reports').boundingBox();expect(child!.x).toBeCloseTo(parent!.x+parent!.width,0);await w('menu-reports-item-1').click();await expect(status).toHaveText('Weekly report chosen');
 await w('menu-noops').click();await expect(status).toHaveText('Menu bounds and state unchanged');await expect(w('menu-main')).toHaveCSS('width','472px');await w('menu-main-item-0').hover();await expect(w('menu-file')).toBeVisible();
 await w('menu-toggle').click();await expect(w('menu-main')).toHaveCount(0);await w('menu-toggle').click();await expect(w('menu-main')).toBeVisible();
 await w('menu-read').click();await expect(status).toContainText('Alpha project');await expect(status).toContainText('Undo');
 const rows=w('menu-repeater').locator('.repeater-row'),output=(n:number)=>rows.nth(n).locator('[data-widget-id="menu-row-result"]');await expect(rows).toHaveCount(2);
 await rows.nth(1).locator('[data-widget-id="menu-row-item-0"]').hover();await expect(rows.nth(1).locator('[data-widget-id="menu-row-sub"]')).toBeVisible();await expect(rows.nth(0).locator('[data-widget-id="menu-row-sub"]')).toHaveCount(0);await rows.nth(1).locator('[data-widget-id="menu-row-sub-item-0"]').click();await expect(output(1)).toHaveText('Opened Beta');await expect(output(0)).toHaveText('No row action yet');
}
for(const mode of['preview','offline']as const)test(`${mode}: classic menus hover, nest, close, dispatch and isolate row instances`,async({page,browser},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const doc=await open(page);
 if(mode==='preview'){await page.getByTitle('Preview (F5)',{exact:true}).click();await exercise(page,page.locator('.preview-overlay'),info.outputPath('menu-preview.png'));await page.getByTitle('Restart prototype',{exact:true}).click();await expect(page.locator('.preview-overlay [data-widget-id="menu-file"]')).toHaveCount(0);await expect(page.locator('.preview-overlay [data-widget-id="menu-row-result"]')).toHaveText(['No row action yet','No row action yet']);await page.getByRole('button',{name:'Close preview',exact:true}).click()}
 else{const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('menus.html');await(await pending).saveAs(file);const context=await browser.newContext({offline:true,viewport:{width:1500,height:1250}});try{const player=await context.newPage(),network:string[]=[];player.on('pageerror',e=>errors.push(e.message));player.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});await player.goto(pathToFileURL(file).href);await exercise(player,player.locator('main'),info.outputPath('menu-offline.png'));await player.reload();await expect(player.locator('[data-widget-id="menu-file"]')).toHaveCount(0);await expect(player.locator('[data-widget-id="menu-row-result"]')).toHaveText(['No row action yet','No row action yet']);expect(network).toEqual([])}finally{await context.close()}}
 const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath('menus-after.rea.json');await(await pending).saveAs(file);expect(JSON.parse(await readFile(file,'utf8'))).toEqual(doc);expect(errors).toEqual([]);
});
