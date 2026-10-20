import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, uid } from '../../src/model/document';
import type { Action, Interaction } from '../../src/model/types';

const event=(actions:Omit<Action,'id'>[],trigger:Interaction['event']='click'):Interaction=>({id:uid(),name:trigger,event:trigger,enabled:true,conditions:[],conditionMode:'all',actions:actions.map(a=>({...a,id:uid()}))});
function fixture() {
  const doc=createDocument();doc.name='Named filters and sorts';doc.caseSelection='never';doc.variables={Threshold:'0'};doc.pages[0].width=1040;doc.pages[0].height=1000;
  const list=createWidget('repeater',40,110);list.name='Catalog';list.width=880;list.height=300;
  const check=createWidget('checkbox',12,10);check.name='Mark product';check.text='';check.width=35;check.height=34;
  const label=createWidget('text',70,10);label.name='Product';label.width=780;label.height=34;label.text='[[Item.ID]] · [[Item.Team]] · [[Item.Name]] · [[Item.Cost]]';
  const action=(type:Action['type'],spec:unknown):Omit<Action,'id'>=>({type,targetId:list.id,value:typeof spec==='string'?spec:JSON.stringify(spec)});
  const filter=(name:string,expression:string,column?:string)=>action('addFilter',{name,expression,...(column?{column}:{}),mode:'smart',removeOthers:false});
  const sort=(column:string,name:string,dataType:string,toggle=false)=>action('addSort',{name,column,direction:'asc',dataType,toggle,removeOthers:false});
  list.repeater={columns:['ID','Team','Name','Cost'],rows:[
    {ID:'A',Team:'red',Name:'Item2',Cost:'10'},{ID:'B',Team:'blue',Name:'Item10',Cost:'2'},
    {ID:'C',Team:'red',Name:'Item1',Cost:'5'},{ID:'D',Team:'green',Name:'Item3',Cost:'8'},{ID:'E',Team:'blue',Name:'Item20',Cost:'20'},
  ],template:[check,label],itemHeight:54,gap:2,pagination:{itemsPerPage:3,startPage:1}};
  list.interactions=[event([sort('Cost','price','number')],'load'),event([action('setSelected','[[Item.isMarked]]')],'itemLoad')];
  list.interactions[1].actions[0].targetId=check.id;
  check.interactions=[event([action('markRows',{row:'this'})],'select'),event([action('unmarkRows',{row:'this'})],'unselect')];
  const title=createWidget('text',40,30);title.name='Instructions';title.text='Combine named filters, change priorities, and keep marked rows.';title.width=930;title.height=45;title.style.fontSize=20;
  const controls:[string,Omit<Action,'id'>[]][]=[
    ['Red rule',[filter('color','[[TargetItem.Team == "red"]]','Team')]],['Blue alternative',[filter('color','[[TargetItem.Team == "blue"]]','Team')]],
    ['Minimum 6',[{type:'setVariable',targetId:'Threshold',value:'6'},filter('minimum','[[TargetItem.Cost >= Threshold]]','Cost')]],
    ['Set threshold 12',[{type:'setVariable',targetId:'Threshold',value:'12'}]],['Refresh rules',[action('removeFilter',{name:'missing'})]],
    ['Remove colors',[action('removeFilter',{name:'color'})]],['Clear filters',[action('removeFilter',{all:true})]],
    ['Sort names',[sort('Name','name','natural')]],['Toggle names',[sort('Name','name','natural',true)]],['Remove name sort',[action('removeSort',{name:'name'})]],
    ['Clear sorts',[action('removeSort',{all:true})]],['Show all',[action('setItemsPerPage','all')]],
    ['Empty result',[filter('empty','[[false]]')]],['Next page',[action('setRepeaterPage','next')]],['Three per page',[action('setItemsPerPage','3')]],
  ];
  doc.pages[0].widgets=[title,list,...controls.map(([name,actions],i)=>{const button=createWidget('button',40+(i%4)*245,470+Math.floor(i/4)*68);button.name=button.text=name;button.width=220;button.height=44;button.interactions=[event(actions)];return button;})];
  const input=createWidget('input',40,810);input.name='Search names';input.text='';input.width=400;input.height=44;
  input.interactions=[event([action('removeFilter',{name:'search'}),filter('search','[[contains(lower(TargetItem.Name), lower(This.text))]]')],'change')];
  doc.pages[0].widgets.push(input);return doc;
}
type Scope=Page|Locator;
const widget=(scope:Scope,name:string)=>scope.locator(`.widget[aria-label="${name}"]`);
async function exercise(scope:Scope) {
  const labels=widget(scope,'Product'), check=(i:number)=>widget(scope,'Catalog').locator('.repeater-row').nth(i).getByRole('checkbox',{name:'Mark product',exact:true});
  const click=(name:string)=>widget(scope,name).click();
  const ids=async(expected:string[])=>expect.poll(async()=>(await labels.allTextContents()).map(text=>text.split(' · ')[0])).toEqual(expected);
  await ids(['B','C','D']);await check(2).check();
  await click('Red rule');await ids(['C','A']);await click('Blue alternative');await ids(['B','C','A']);
  await click('Minimum 6');await ids(['A','E']);await click('Set threshold 12');await ids(['A','E']);
  await click('Refresh rules');await ids(['E']);await click('Remove colors');await ids(['E']);
  await click('Clear filters');await ids(['B','C','D']);await expect(check(2)).toBeChecked();
  await click('Sort names');await ids(['C','A','D']);await expect(check(2)).toBeChecked();
  await click('Toggle names');await ids(['E','B','D']);await expect(check(2)).toBeChecked();
  await click('Remove name sort');await ids(['B','C','D']);
  await click('Next page');await ids(['A','E']);await click('Clear sorts');await ids(['D','E']);await expect(check(0)).toBeChecked();
  await click('Show all');await ids(['A','B','C','D','E']);await click('Empty result');await ids([]);
  await click('Clear filters');await ids(['A','B','C','D','E']);await expect(check(3)).toBeChecked();
  const search=scope.getByRole('textbox',{name:'Search names',exact:true});await search.fill('item1');await search.press('Tab');await ids(['B','C']);
  await search.fill('item2');await search.press('Tab');await ids(['A','E']);
  await search.fill('');await search.press('Tab');await ids(['A','B','C','D','E']);
  await expect(scope.getByRole('alert').filter({hasText:/\S/})).toHaveCount(0);
}
for(const mode of ['preview','offline'] as const) test(`${mode}: named Smart filters, live expressions, typed sort priority, pagination and marks work together`,async({page,browser},info)=>{
  const doc=fixture(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
  const chooser=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:/^Open…/}).click();
  await(await chooser).setFiles({name:'named-queries.rea.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);
  if(mode==='preview'){
    await mkdir('artifacts',{recursive:true});await writeFile('artifacts/repeater-query-demo.rea.json',JSON.stringify(doc,null,2));
    await page.getByTitle('Preview (F5)',{exact:true}).click();await exercise(page.locator('.preview-overlay'));await page.screenshot({path:info.outputPath('query-preview.png')});
  }else{
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const output=info.outputPath('query.html');await(await download).saveAs(output);
    const context=await browser.newContext({offline:true,viewport:{width:1600,height:1100}});
    try{const offline=await context.newPage(),requests:string[]=[];offline.on('pageerror',error=>errors.push(error.message));offline.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});await offline.goto(pathToFileURL(output).href);await exercise(offline);await offline.screenshot({path:info.outputPath('query-offline.png')});expect(requests).toEqual([]);}finally{await context.close();}
  }
  expect(errors).toEqual([]);
});
