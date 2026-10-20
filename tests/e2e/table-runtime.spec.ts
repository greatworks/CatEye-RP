import { expect,test,type Page,type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { tableFixture } from '../fixtures/tables';
import { serializeDocument } from '../../src/model/document';
async function open(page:Page){const doc=tableFixture();await page.goto('/');const chooser=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await chooser).setFiles({name:'tables.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);return doc;}
async function exercise(page:Page,scope:Locator){
  const table=scope.locator('[data-widget-id="table-main"]'),cell=(n:number)=>scope.locator(`[data-widget-id="table-cell-${n}"]`),status=scope.locator('[data-widget-id="table-status"]');
  await expect(table.locator('.tableCell')).toHaveCount(9);await expect(table).toHaveCSS('width','560px');await expect(table).toHaveCSS('height','165px');
  await cell(0).click();await expect(cell(6)).toHaveText('Updated independently');await expect(cell(0)).toHaveCSS('background-color','rgb(209, 250, 229)');await expect(status).toHaveText('Only this cell handled the click');
  await cell(2).click();await expect(status).toHaveText('Only this cell handled the click');await cell(1).click();await expect(status).toHaveText('Table fallback handled');
  await cell(4).click();await page.getByRole('menuitem',{name:'Second cell choice',exact:true}).click();await expect(status).toHaveText('Second cell choice');await cell(3).click();await expect(status).toHaveText('Table fallback handled');
  await cell(5).getByRole('link').click();await expect(status).toHaveText('Cell hyperlink handled');
  await cell(1).dblclick();await expect(status).toHaveText('Table double-click fallback');
  await scope.locator('[data-widget-id="table-noops"]').click();await expect(table).toHaveCSS('width','560px');await expect(cell(0)).toHaveCSS('width','180px');await cell(0).click();await expect(status).toHaveText('Only this cell handled the click');
  await scope.locator('[data-widget-id="table-hide-cell"]').click();await expect(cell(7)).toHaveCount(0);await expect(cell(8)).toHaveCSS('left','360px');await scope.locator('[data-widget-id="table-hide-cell"]').click();await expect(cell(7)).toBeVisible();
  await scope.locator('[data-widget-id="table-move"]').click();await expect(cell(8)).toHaveCSS('left','350px');await expect(cell(8)).toHaveCSS('top','98px');await expect(cell(6)).toHaveCSS('top','110px');await expect(table).toHaveCSS('height','165px');
  await scope.locator('[data-widget-id="table-hide"]').click();await expect(table).toHaveCount(0);await scope.locator('[data-widget-id="table-hide"]').click();await expect(table).toBeVisible();
  const actions=scope.locator('[data-widget-id="table-row-cell-0"]'),outputs=scope.locator('[data-widget-id="table-row-cell-1"]');await expect(actions).toHaveCount(2);await expect(actions.nth(1)).toHaveText('Beta');await actions.nth(1).click();await expect(outputs.nth(1)).toHaveText('Clicked Beta');await expect(outputs.nth(0)).toHaveText('Awaiting row action');
}
for(const mode of ['preview','offline'] as const)test(`${mode}: tables preserve independent cells, dispatch fallback and row instances`,async({page,browser},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const doc=await open(page);
  if(mode==='preview'){await page.getByTitle('Preview (F5)',{exact:true}).click();await exercise(page,page.locator('.preview-overlay'));await page.getByRole('button',{name:'Close preview',exact:true}).click();}
  else{const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('tables.html');await(await pending).saveAs(file);const context=await browser.newContext({offline:true,viewport:{width:1500,height:1050}});try{const player=await context.newPage(),network:string[]=[];player.on('pageerror',e=>errors.push(e.message));player.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});await player.goto(pathToFileURL(file).href);await exercise(player,player.locator('main'));expect(network).toEqual([]);}finally{await context.close();}}
  const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath('after.rea.json');await(await pending).saveAs(file);expect(JSON.parse(await readFile(file,'utf8'))).toEqual(doc);expect(errors).toEqual([]);
});
