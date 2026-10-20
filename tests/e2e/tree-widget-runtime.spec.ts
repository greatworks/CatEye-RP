import {expect,test,type Page,type Locator} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {treeWidgetFixture} from '../fixtures/tree-widgets';
import {serializeDocument} from '../../src/model/document';
async function open(page:Page){const doc=treeWidgetFixture();await page.goto('/');const chooser=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await chooser).setFiles({name:'tree-widgets.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);return doc}
async function exercise(page:Page,scope:Locator,screenshot:string){
 const w=(id:string)=>scope.locator(`[data-widget-id="${id}"]`),toggle=(id:string)=>scope.locator(`button[data-tree-toggle="${id}"]`),status=w('tree-status');
 await expect(w('tree-home-label')).toBeVisible();const before=await w('tree-archive').boundingBox(),root=await w('tree-main').boundingBox();
 await expect(toggle('tree-workspace')).toHaveCSS('width','9px');await expect(toggle('tree-workspace')).toHaveCSS('height','9px');
 await toggle('tree-workspace').click();await expect(w('tree-home')).toHaveCount(0);await expect(w('tree-pages')).toHaveCount(0);await expect(status).toContainText('Ready');await expect(w('tree-workspace-label')).toHaveCSS('background-color','rgb(224, 231, 255)');
 const collapsed=await w('tree-archive').boundingBox();expect(before!.y-collapsed!.y).toBe(160);expect((await w('tree-main').boundingBox())!.height).toBe(root!.height);
 await toggle('tree-workspace').click();await expect(w('tree-home-label')).toBeVisible();expect((await w('tree-archive').boundingBox())!.y).toBe(before!.y);await expect(status).toContainText('Ready');
 await w('tree-home-label').click();await expect(status).toHaveText('Opened Home page');await expect(w('tree-home-label')).toHaveCSS('background-color','rgb(224, 231, 255)');await expect(w('tree-workspace-label')).not.toHaveCSS('background-color','rgb(224, 231, 255)');
 await w('tree-assets-label').click();await expect(status).toHaveText('Opened Assets');await expect(w('tree-home-label')).not.toHaveCSS('background-color','rgb(224, 231, 255)');
 await w('tree-toggle').click();await expect(w('tree-home')).toHaveCount(0);await expect(w('tree-assets-label')).toBeVisible();const afterNested=await w('tree-archive').boundingBox();expect(before!.y-afterNested!.y).toBe(64);
 await w('tree-collapse').click();await expect(w('tree-pages')).toHaveCount(0);await w('tree-expand').click();await expect(w('tree-pages')).toBeVisible();await expect(w('tree-home')).toHaveCount(0);await expect(toggle('tree-pages')).toHaveAttribute('aria-expanded','false');
 await w('tree-read').click();await expect(status).toHaveText('Workspace\nPages\nHome page\nSettings page\nAssets\nGuides');
 await toggle('tree-pages').click();await expect(w('tree-home-label')).toBeVisible();await expect(status).toContainText('Settings page');await page.screenshot({path:screenshot,fullPage:true});
 const rows=w('tree-repeater').locator('.repeater-row'),within=(n:number,id:string)=>rows.nth(n).locator(`[data-widget-id="${id}"]`);await expect(rows).toHaveCount(2);
 await rows.nth(1).locator('[data-tree-toggle="tree-row-parent"]').click();await expect(within(1,'tree-row-child')).toHaveCount(0);await expect(within(0,'tree-row-child')).toBeVisible();
 await within(0,'tree-row-child-label').click();await expect(within(0,'tree-row-result')).toHaveText('Opened Alpha details');await expect(within(1,'tree-row-result')).toHaveText('No row action yet');await expect(within(1,'tree-row-parent-label')).toHaveCSS('background-color','rgb(224, 231, 255)');
 await rows.nth(1).locator('[data-tree-toggle="tree-row-parent"]').click();await within(1,'tree-row-child-label').click();await expect(within(1,'tree-row-result')).toHaveText('Opened Beta details');await expect(within(0,'tree-row-result')).toHaveText('Opened Alpha details');
 await w('tree-collapse').click();await expect(w('tree-home')).toHaveCount(0);
}
for(const mode of['preview','offline']as const)test(`${mode}: tree branches preserve layout and selection routing with independent repeated rows`,async({page,browser},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const doc=await open(page);
 if(mode==='preview'){await page.getByTitle('Preview (F5)',{exact:true}).click();await exercise(page,page.locator('.preview-overlay'),info.outputPath('tree-preview.png'));await page.getByTitle('Restart prototype',{exact:true}).click();await expect(page.locator('.preview-overlay [data-widget-id="tree-home-label"]')).toBeVisible();await expect(page.locator('.preview-overlay [data-widget-id="tree-row-result"]')).toHaveText(['No row action yet','No row action yet']);await page.getByRole('button',{name:'Close preview',exact:true}).click()}
 else{const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('trees.html');await(await pending).saveAs(file);const context=await browser.newContext({offline:true,viewport:{width:1500,height:1200}});try{const player=await context.newPage(),network:string[]=[];player.on('pageerror',e=>errors.push(e.message));player.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});await player.goto(pathToFileURL(file).href);await exercise(player,player.locator('main'),info.outputPath('tree-offline.png'));await player.reload();await expect(player.locator('[data-widget-id="tree-home-label"]')).toBeVisible();await expect(player.locator('[data-widget-id="tree-row-result"]')).toHaveText(['No row action yet','No row action yet']);expect(network).toEqual([])}finally{await context.close()}}
 const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const saved=info.outputPath('tree-after.rea.json');await(await pending).saveAs(saved);expect(JSON.parse(await readFile(saved,'utf8'))).toEqual(doc);expect(errors).toEqual([]);
});
