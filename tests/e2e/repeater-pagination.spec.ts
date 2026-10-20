import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, uid } from '../../src/model/document';
import type { Action, Document, EventType, Interaction } from '../../src/model/types';

type Scope = Page | Locator;
const widget=(scope:Scope,name:string)=>scope.locator(`.widget[aria-label="${name}"]`);
const interaction=(actions:Omit<Action,'id'>[],event:EventType='click'):Interaction=>({id:uid(),event,name:event,enabled:true,conditions:[],conditionMode:'all',actions:actions.map(a=>({...a,id:uid()}))});
function fixture():Document {
  const doc=createDocument(); doc.name='Marked rows and pagination'; doc.caseSelection='never'; doc.pages[0].width=1000; doc.pages[0].height=900;
  const list=createWidget('repeater',40,140); list.name='Records'; list.width=600; list.height=310;
  const check=createWidget('checkbox',14,8); check.name='Mark record'; check.text=''; check.width=40; check.height=36;
  const label=createWidget('text',70,8); label.name='Row summary'; label.width=480; label.height=36; label.text='[[Item.Name]]: [[Item.Count]]';
  const status=createWidget('text',40,65); status.name='Page status'; status.width=850; status.height=45;
  list.repeater={columns:['Name','Count'],rows:['A','B','C','D','E'].map((Name,i)=>({Name,Count:String(i+1)})),template:[check,label],itemHeight:54,gap:4,pagination:{itemsPerPage:2,startPage:1}};
  list.interactions=[interaction([{type:'setSelected',targetId:check.id,value:'[[Item.isMarked]]'},{type:'setText',targetId:status.id,value:'Page [[Item.Repeater.pageIndex]] / [[Item.Repeater.pageCount]] — [[Item.Repeater.visibleItemCount]] of [[Item.Repeater.itemCount]] ([[Item.Repeater.dataCount]] total)'}],'itemLoad')];
  check.interactions=[interaction([{type:'markRows',targetId:list.id,value:'{"row":"this"}'}],'select'),interaction([{type:'unmarkRows',targetId:list.id,value:'{"row":"this"}'}],'unselect')];
  doc.pages[0].widgets=[list,status];
  const actions:[string,Action['type'],string][]=[['Next page','setRepeaterPage','next'],['Previous page','setRepeaterPage','previous'],['First page','setRepeaterPage','first'],['Last page','setRepeaterPage','last'],['Update marked','updateRow','{"row":"marked","values":{"Count":"[[TargetItem.Count + 10]]"}}'],['Delete marked','deleteRow','{"row":"marked"}'],['Filter to E','filterRows','{"column":"Name","operator":"equals","value":"E"}'],['Clear filter','filterRows',''],['Sort descending','sortRows','Name:desc'],['Show all','setItemsPerPage','all'],['Two per page','setItemsPerPage','2'],['Mark all','markRows','{"row":"all"}']];
  actions.forEach(([name,type,value],i)=>{const b=createWidget('button',40+(i%4)*220,500+Math.floor(i/4)*70);b.name=name;b.text=name;b.width=200;b.height=44;b.interactions=[interaction([{type,targetId:list.id,value}])];doc.pages[0].widgets.push(b);});
  const second=createDocument().pages[0];second.name='Second page';doc.pages.push(second);
  const visit=createWidget('button',40,760);visit.name=visit.text='Visit second page';visit.width=200;visit.interactions=[interaction([{type:'openPage',targetId:second.id}])];doc.pages[0].widgets.push(visit);
  const back=createWidget('button',40,80);back.name=back.text='Return to records';back.width=220;back.interactions=[interaction([{type:'openPage',targetId:doc.pages[0].id}])];second.widgets=[back];
  return doc;
}
async function menu(page:Page,name:string) {await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name,exact:true}).click();}
async function open(page:Page,doc:Document) {await page.goto('/');const chooser=page.waitForEvent('filechooser');await menu(page,'Open… Ctrl+O');await(await chooser).setFiles({name:'paging.rea.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);}
async function exercise(scope:Scope) {
  const rows=widget(scope,'Records').locator('.repeater-row'), summaries=widget(scope,'Row summary');
  const click=async(name:string)=>widget(scope,name).click();
  const check=(i:number)=>rows.nth(i).getByRole('checkbox',{name:'Mark record',exact:true});
  await expect(summaries).toHaveText(['A: 1','B: 2']); await expect(widget(scope,'Page status')).toHaveText('Page 1 / 3 — 2 of 5 (5 total)');
  await check(0).check(); await click('Next page'); await expect(summaries).toHaveText(['C: 3','D: 4']); await check(1).check();
  await click('Last page'); await expect(summaries).toHaveText(['E: 5']); await expect(widget(scope,'Page status')).toHaveText('Page 3 / 3 — 1 of 5 (5 total)');
  await click('Filter to E'); await expect(summaries).toHaveText(['E: 5']); await expect(widget(scope,'Page status')).toHaveText('Page 1 / 1 — 1 of 1 (5 total)');
  await click('Update marked'); await click('Clear filter'); await expect(summaries).toHaveText(['A: 11','B: 2']); await expect(check(0)).toBeChecked(); await expect(check(1)).not.toBeChecked();
  await click('Next page'); await expect(summaries).toHaveText(['C: 3','D: 14']); await expect(check(1)).toBeChecked();
  await click('Sort descending'); await expect(summaries).toHaveText(['C: 3','B: 2']); await expect(check(0)).not.toBeChecked();
  await click('Delete marked'); await expect(summaries).toHaveText(['B: 2']); await expect(widget(scope,'Page status')).toHaveText('Page 2 / 2 — 1 of 3 (3 total)');
  await click('Show all'); await expect(summaries).toHaveText(['E: 5','C: 3','B: 2']); await expect(widget(scope,'Page status')).toHaveText('Page 1 / 1 — 3 of 3 (3 total)');
  await click('Mark all'); await click('Two per page'); await expect(summaries).toHaveText(['E: 5','C: 3']); await expect(check(0)).toBeChecked(); await expect(check(1)).toBeChecked();
  await click('Last page'); await expect(summaries).toHaveText(['B: 2']); await expect(check(0)).toBeChecked();
  await check(0).uncheck(); await click('First page'); await click('Delete marked'); await expect(summaries).toHaveText(['B: 2']); await expect(check(0)).not.toBeChecked();
  await expect(widget(scope,'Page status')).toHaveText('Page 1 / 1 — 1 of 1 (1 total)');
  await check(0).check(); await click('Visit second page'); await click('Return to records');
  await expect(summaries).toHaveText(['A: 1','B: 2']); await expect(check(0)).not.toBeChecked(); await expect(check(1)).not.toBeChecked();
  await expect(widget(scope,'Page status')).toHaveText('Page 1 / 3 — 2 of 5 (5 total)');
  await expect(scope.getByRole('alert').filter({hasText:/\S/})).toHaveCount(0);
}
for(const mode of ['preview','offline'] as const) {
  test(`${mode}: marked checkboxes survive pages and filters and drive hidden-row updates and deletion`,async({page,browser},info)=>{
    const doc=fixture(), errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message)); await open(page,doc);
    if(mode==='preview') {
      await mkdir('artifacts',{recursive:true}); await writeFile('artifacts/repeater-pagination-demo.rea.json',JSON.stringify(doc,null,2));
      await page.getByTitle('Preview (F5)',{exact:true}).click(); await exercise(page.locator('.preview-overlay'));
      await page.screenshot({path:info.outputPath('repeater-pagination-preview.png')});
    } else {
      const download=page.waitForEvent('download'); await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('repeater-pagination.html');await(await download).saveAs(file);
      const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000}});
      try {const exported=await context.newPage(),requests:string[]=[];exported.on('pageerror',e=>errors.push(e.message));exported.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await exported.goto(pathToFileURL(file).href);await exercise(exported);await exported.screenshot({path:info.outputPath('repeater-pagination-offline.png')});expect(requests).toEqual([]);} finally {await context.close();}
    }
    expect(errors).toEqual([]);
  });
  test(`${mode}: an invalid initial fractional page shows an error and a first-page action recovers`,async({page,browser},info)=>{
    const doc=fixture();doc.pages[0].widgets[0].repeater!.pagination={itemsPerPage:3,startPage:1.5};const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page,doc);
    const exerciseError=async(scope:Scope)=>{await expect(scope.getByRole('alert')).toContainText('fractional row index');await widget(scope,'First page').click();await expect(widget(scope,'Row summary')).toHaveText(['A: 1','B: 2','C: 3']);await expect(scope.getByRole('alert').filter({hasText:/\S/})).toHaveCount(0);};
    if(mode==='preview'){await page.getByTitle('Preview (F5)',{exact:true}).click();await exerciseError(page.locator('.preview-overlay'));}
    else {const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('fractional-error.html');await(await download).saveAs(file);const context=await browser.newContext({offline:true});try{const exported=await context.newPage();exported.on('pageerror',e=>errors.push(e.message));await exported.goto(pathToFileURL(file).href);await exerciseError(exported);}finally{await context.close();}}
    expect(errors).toEqual([]);
  });
}
