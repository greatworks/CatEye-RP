import {expect,test,type Page,type TestInfo} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createDocument,createWidget,parseDocument,serializeDocument} from '../../src/model/document';
import type {Document,GradientFill} from '../../src/model/types';
// @ts-expect-error Shared real-browser and exact-package scenario.
import {allViewsTarget,exerciseAllViewsFill,checkAllViewsFillPlayer,selectAllViewsTarget,paddingFixture,exerciseAllViewsPadding,checkAllViewsPaddingPlayer} from '../../scripts/adaptive-all-views-scenario.mjs';

export function allViewsFixture():Document{
  const doc=createDocument();doc.name='Affect all views authoring';doc.caseSelection='never';
  const target=createWidget('box',40,80),untouched=createWidget('box',340,300);
  target.id=allViewsTarget;target.name=target.text='All views target';target.width=180;target.height=60;
  const gradient:GradientFill={type:'linear',start:{x:0,y:0},end:{x:1,y:1},stops:[{offset:0,color:'#ccddff'},{offset:1,color:'#ffffff'}]};
  target.style.fill='#ccddff';target.style.fillGradient=gradient;target.selectedStyle={color:'#aa0000'};
  untouched.id='all-views-untouched';untouched.name=untouched.text='Untouched widget';
  doc.pages[0].widgets=[target,untouched];doc.pages[0].adaptiveViews=[];
  doc.adaptiveViewSets=[{id:'all-views-set',name:'Authoring set',baseSize:{width:1200,height:0},views:[
    {id:'all-tablet',name:'Tablet',width:768,height:0},
    {id:'all-phone',name:'Phone',width:390,height:0,baseViewId:'all-tablet'},
    {id:'all-other',name:'Other branch',width:600,height:0},
  ]}];
  doc.pages[0].adaptiveViewSetId='all-views-set';delete doc.pages[0].adaptiveSelection;delete doc.pages[0].adaptiveBaseSize;
  doc.pages[0].adaptiveOverrides={
    'all-tablet':{[target.id]:{x:60,y:110,width:220,style:{fill:'#aabbcc',fontSize:19}},[untouched.id]:{hidden:true,style:{fill:'#aaff00'}}},
    'all-phone':{[target.id]:{x:80,y:140,height:90,style:{fill:'#ddeeff',color:'#123456'},stateStyles:{mouseOver:{opacity:0.6}}}},
    'all-other':{[target.id]:{x:100,y:200,style:{fillGradient:structuredClone(gradient),stroke:'#998877'}}},
    'inactive-view':{[target.id]:{x:230,y:250,placed:false,style:{fill:'#bbccdd',fillGradient:structuredClone(gradient),radius:12},stateStyles:{focused:{stroke:'#dd0000'}}}},
  };
  return parseDocument(serializeDocument(doc));
}

async function open(page:Page,doc:Document){
  const pending=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();
  await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();
  await(await pending).setFiles({name:'adaptive-all-views.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});
  await expect(page.locator('.titlebar')).toContainText(doc.name);
}
async function save(page:Page,info:TestInfo,suffix:string){
  const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();
  const file=info.outputPath(`all-views-${suffix}.rea.json`);await(await pending).saveAs(file);return parseDocument(await readFile(file,'utf8'));
}

function expectedGeometry(source:Document,patch:{x:number;y:number}|{width:number;height:number}):Document{
  const expected=structuredClone(source),page=expected.pages[0];Object.assign(page.widgets[0],patch);
  for(const map of [...page.adaptiveViews.map(view=>view.overrides),...Object.values(page.adaptiveOverrides??{})]){
    const local=map[allViewsTarget];if(!local)continue;
    for(const key of Object.keys(patch))delete (local as Record<string,unknown>)[key];
    if(!Object.keys(local).length)delete map[allViewsTarget];
  }
  return expected;
}
const properties=(page:Page)=>page.getByRole('complementary',{name:'Properties inspector'});
async function field(page:Page,label:string,value:number){const input=properties(page).getByLabel(label,{exact:true});await input.fill(String(value));await input.press('Tab');}
async function startAllViews(page:Page,doc:Document){
  page.on('dialog',dialog=>dialog.accept());await page.goto('/');await open(page,doc);
  await page.getByLabel('Adaptive view',{exact:true}).selectOption('all-phone');await selectAllViewsTarget(page);
  await page.getByLabel('Affect all views',{exact:true}).check();
}

test('all-view X and W edits use the native whole point and size without touching other declarations',async({page},info)=>{
  const source=allViewsFixture();await startAllViews(page,source);
  await field(page,'X',80);expect(await save(page,info,'unchanged-x')).toEqual(source);
  await field(page,'X',132);const moved=expectedGeometry(source,{x:132,y:140});expect(await save(page,info,'point')).toEqual(moved);
  await field(page,'W',280);const resized=expectedGeometry(moved,{width:280,height:90});expect(await save(page,info,'size')).toEqual(resized);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'size-undo')).toEqual(moved);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'point-undo')).toEqual(source);
  await page.getByTitle('Redo',{exact:true}).click();await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'geometry-redo')).toEqual(resized);
  await open(page,resized);
  for(const view of ['', 'all-tablet','all-phone','all-other']){
    await page.getByLabel('Adaptive view',{exact:true}).selectOption(view);await selectAllViewsTarget(page);
    for(const [label,value]of [['X',132],['Y',140],['W',280],['H',90]] as const)await expect(properties(page).getByLabel(label,{exact:true})).toHaveValue(String(value));
  }
});

test('all-view drag derives each frame from the original document and cancellation preserves local declarations',async({page},info)=>{
  const source=allViewsFixture();await startAllViews(page,source);
  const widget=page.locator('.canvas-surface .editor-widget.box').filter({hasText:'All views target'});
  const bounds=await widget.boundingBox();expect(bounds).not.toBeNull();
  const x=bounds!.x+bounds!.width/2,y=bounds!.y+bounds!.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+32,y+16,{steps:3});await page.mouse.move(x+64,y+32,{steps:3});await page.mouse.move(x,y,{steps:3});await page.mouse.up();
  expect(await save(page,info,'drag-returned')).toEqual(source);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+32,y+16,{steps:3});
  await page.locator('.application').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
  expect(await save(page,info,'drag-cancelled')).toEqual(source);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+32,y+16,{steps:3});await page.mouse.move(x+64,y+32,{steps:3});await page.mouse.up();
  const moved=expectedGeometry(source,{x:144,y:172});expect(await save(page,info,'drag-committed')).toEqual(moved);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'drag-undo')).toEqual(source);
  await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'drag-redo')).toEqual(moved);
});

test('editing one effect applies the complete current effect map to all views while preserving normal styles',async({page},info)=>{
  const source=allViewsFixture();await startAllViews(page,source);
  await properties(page).getByRole('tab',{name:'Interactions',exact:true}).click();await properties(page).getByRole('button',{name:'Edit MouseOver effect',exact:true}).click();
  const input=properties(page).getByLabel('MouseOver opacity %',{exact:true});await input.fill('40');await input.press('Tab');
  const expected=structuredClone(source);delete expected.pages[0].widgets[0].selectedStyle;expected.pages[0].widgets[0].mouseOverStyle={opacity:0.4};
  for(const map of Object.values(expected.pages[0].adaptiveOverrides!))delete map[allViewsTarget].stateStyles;
  expect(await save(page,info,'effect-map')).toEqual(expected);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'effect-undo')).toEqual(source);
  await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'effect-redo')).toEqual(expected);
  await open(page,expected);await page.getByTitle('Preview (F5)',{exact:true}).click();const scope=page.locator('.preview-overlay');
  try{for(const id of [null,'all-tablet','all-phone','all-other']){
    await scope.getByRole('combobox',{name:'Adaptive view',exact:true}).selectOption(JSON.stringify(id?{kind:'view',viewId:id}:{kind:'base'}));
    const widget=scope.locator(`[data-widget-id="${allViewsTarget}"]`);await widget.hover();await expect(widget).toHaveCSS('opacity','0.4');
  }}finally{await page.getByRole('button',{name:'Close preview',exact:true}).click();}
  expect(await save(page,info,'effect-after-preview')).toEqual(expected);
});

test('the first effect in an empty current map follows the original local write path before later global edits',async({page},info)=>{
  const source=allViewsFixture();source.pages[0].adaptiveOverrides!['all-phone'][allViewsTarget].stateStyles={};
  await startAllViews(page,source);await properties(page).getByRole('tab',{name:'Interactions',exact:true}).click();
  await properties(page).getByLabel('Effect to add',{exact:true}).selectOption('mouseOverStyle');await properties(page).getByRole('button',{name:'Add style effect',exact:true}).click();
  const first=structuredClone(source);first.pages[0].adaptiveOverrides!['all-phone'][allViewsTarget].stateStyles={mouseOver:{}};
  expect(await save(page,info,'first-effect')).toEqual(first);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'first-effect-undo')).toEqual(source);
  await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'first-effect-redo')).toEqual(first);
  await selectAllViewsTarget(page);await properties(page).getByRole('tab',{name:'Interactions',exact:true}).click();await properties(page).getByRole('button',{name:'Edit MouseOver effect',exact:true}).click();
  await properties(page).getByLabel('Override MouseOver opacity %',{exact:true}).check();
  const changed=structuredClone(first);delete changed.pages[0].widgets[0].selectedStyle;changed.pages[0].widgets[0].mouseOverStyle={opacity:1};
  for(const map of Object.values(changed.pages[0].adaptiveOverrides!))delete map[allViewsTarget].stateStyles;
  expect(await save(page,info,'next-effect-global')).toEqual(changed);
});

for(const mode of ['preview','offline'] as const)test(`${mode}: all-view padding clears one side and keeps later inheritance live`,async({page,browser},info)=>{
  test.setTimeout(70_000);const source=paddingFixture(allViewsFixture()) as Document;await startAllViews(page,source);
  const result=await exerciseAllViewsPadding(page,source,{save:(suffix:string)=>save(page,info,suffix),open:(doc:Document)=>open(page,doc)});
  const context=mode==='offline'?await browser.newContext({offline:true,viewport:{width:1200,height:1000}}):undefined;
  let player=page,scope=page.locator('.preview-overlay');
  if(context){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const html=info.outputPath('all-views-padding.html');await(await pending).saveAs(html);player=await context.newPage();await player.goto(pathToFileURL(html).href);scope=player.locator('main').first();}
  else await page.getByTitle('Preview (F5)',{exact:true}).click();
  try{result.checks[mode]=await checkAllViewsPaddingPlayer(scope,(context?player:scope).getByRole('combobox',{name:'Adaptive view',exact:true}));await player.screenshot({path:info.outputPath(`all-views-padding-${mode}.png`),fullPage:true});}
  finally{if(context)await context.close();else await page.getByRole('button',{name:'Close preview',exact:true}).click();}
  expect(await save(page,info,'padding-after-runtime')).toEqual(result.expected);await writeFile(info.outputPath('padding-checks.json'),JSON.stringify(result.checks,null,2));
});

for(const mode of ['preview','offline'] as const)test(`${mode}: Affect All Views changes fill across branches without copying the current layout`,async({page,browser},info)=>{
  test.setTimeout(70_000);const source=allViewsFixture(),errors:string[]=[],requests:string[]=[];
  await writeFile(info.outputPath('all-views-source.rea.json'),serializeDocument(source));
  page.on('dialog',dialog=>dialog.accept());page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await open(page,source);
  const result=await exerciseAllViewsFill(page,source,{save:(suffix:string)=>save(page,info,suffix),open:(doc:Document)=>open(page,doc)});
  await page.screenshot({path:info.outputPath('all-views-authoring.png'),fullPage:true});
  const context=mode==='offline'?await browser.newContext({offline:true,viewport:{width:1200,height:1000}}):undefined;
  let player=page,scope=page.locator('.preview-overlay');
  if(context){
    const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();
    const html=info.outputPath('all-views.html');await(await pending).saveAs(html);await context.route(/^https?:\/\//,route=>{requests.push(route.request().url());return route.abort();});
    player=await context.newPage();player.on('pageerror',error=>errors.push(error.message));await player.goto(pathToFileURL(html).href);scope=player.locator('main').first();
  }else await page.getByTitle('Preview (F5)',{exact:true}).click();
  try{
    result.checks[mode]=await checkAllViewsFillPlayer(scope,(context?player:scope).getByRole('combobox',{name:'Adaptive view',exact:true}));
    await player.screenshot({path:info.outputPath(`all-views-${mode}.png`),fullPage:true});
  }finally{if(context)await context.close();else await page.getByRole('button',{name:'Close preview',exact:true}).click();}
  expect(await save(page,info,'after-runtime')).toEqual(result.expected);expect(errors).toEqual([]);expect(requests).toEqual([]);
  await writeFile(info.outputPath('all-views-checks.json'),JSON.stringify(result.checks,null,2));
});
