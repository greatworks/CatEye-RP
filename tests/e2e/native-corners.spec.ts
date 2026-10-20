import {expect,test,type Page,type TestInfo} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createDocument,createWidget,parseDocument,serializeDocument} from '../../src/model/document';
import type {Document} from '../../src/model/types';
import {nativeCornersFixture,cornerMask,cornerRectangle} from '../fixtures/native-corners';
import {checkNativeCornersPlayer} from '../../scripts/native-corners-scenario.mjs';

const inspector=(page:Page)=>page.getByRole('complementary',{name:'Properties inspector'});
async function open(page:Page,doc:Document){const pending=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await pending).setFiles({name:'native-corners.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);}
async function save(page:Page,info:TestInfo,name:string){const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath(`${name}.rea.json`);await(await pending).saveAs(file);return parseDocument(await readFile(file,'utf8'));}
async function number(page:Page,label:string,value:number){const input=inspector(page).getByLabel(label,{exact:true});await input.fill(String(value));await input.press('Tab');}

for(const mode of ['preview','offline'] as const)test(`${mode}: native corner masks, independent actions, states, repeated rows and nested frames`,async({page,browser},info)=>{
  const doc=nativeCornersFixture(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await open(page,doc);expect(await save(page,info,'opened')).toEqual(doc);
  await writeFile('artifacts/native-corners-source.rea.json',serializeDocument(doc));
  let player=page,context:Awaited<ReturnType<typeof browser.newContext>>|undefined;
  if(mode==='preview')await page.getByTitle('Preview (F5)',{exact:true}).click();else{const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('native-corners.html');await(await pending).saveAs(file);context=await browser.newContext({offline:true,viewport:{width:1600,height:1100},deviceScaleFactor:1});player=await context.newPage();player.on('pageerror',e=>errors.push(e.message));await player.goto(pathToFileURL(file).href);}
  try{const scope=mode==='preview'?player.locator('.preview-overlay'):player.locator('main').first();await checkNativeCornersPlayer(scope,player,{capture:()=>player.screenshot({path:info.outputPath(`native-corners-${mode}.png`),fullPage:true})});
    await(mode==='preview'?scope:player).getByRole('button',{name:'Embedded corners',exact:true}).click();const frame=player.frameLocator('[data-inline-frame="corners-frame"]');const target=frame.locator('[data-widget-id="corners-target"] [data-shadow-fill]');await expect(target).toHaveAttribute('d',/ 20 0/);await frame.locator('[data-widget-id="corners-mask"]').click();expect(((await target.getAttribute('d'))?.match(/C /g)??[]).length).toBe(1);await frame.locator('[data-widget-id="corners-radius"]').click();await expect(target).toHaveAttribute('d',/ 12 0/);
  }finally{await context?.close();if(mode==='preview')await page.getByRole('button',{name:'Close preview',exact:true}).click();}
  expect(await save(page,info,'after-runtime')).toEqual(doc);expect(errors).toEqual([]);
});

function authorFixture(){const doc=createDocument();doc.name='Independent corner authoring';const page=doc.pages[0];page.width=1100;page.height=800;
  page.widgets=[createWidget('box',60,90),createWidget('box',400,260),createWidget('box',650,100)];page.widgets.forEach((w,i)=>{w.id=`author-corner-${i}`;w.name=w.text=`Corner target ${i+1}`;w.width=200;w.height=100;w.style.radius=10+i;w.style.cornerVisibility=cornerMask([15,5,14][i]);});
  page.widgets[0].vectorPath=structuredClone(cornerRectangle);
  doc.adaptiveViewSets=[{id:'corner-set',name:'Corners',baseSize:{width:1200,height:0},views:[{id:'phone',name:'Phone',width:390}]}];page.adaptiveViewSetId='corner-set';page.adaptiveViews=[];delete page.adaptiveSelection;delete page.adaptiveBaseSize;
  page.adaptiveOverrides={phone:{},inactive:{}};page.widgets.forEach((w,i)=>{page.adaptiveOverrides!.phone[w.id]={style:{radius:20+i,cornerVisibility:cornerMask([15,5,14][i]),color:'#123456'}};page.adaptiveOverrides!.inactive[w.id]={x:40+i,style:{radius:30+i,cornerVisibility:cornerMask(10)}};});return parseDocument(serializeDocument(doc));}

for(const allViews of [false,true])test(`corner checkbox changes each target independently and preserves already equal targets; all views ${allViews}`,async({page},info)=>{
  const source=authorFixture();page.on('dialog',d=>d.accept());await page.goto('/');await open(page,source);await page.getByLabel('Adaptive view',{exact:true}).selectOption('phone');
  for(let i=0;i<3;i++)await page.locator('.canvas-surface .editor-widget.box').filter({hasText:`Corner target ${i+1}`}).click(i?{modifiers:['Shift']}:{});
  await page.getByLabel('Affect all views',{exact:true}).setChecked(allViews);await inspector(page).getByLabel('Corner top left rounded',{exact:true}).uncheck();
  const expected=structuredClone(source),p=expected.pages[0];for(let i=0;i<2;i++){const w=p.widgets[i],next=cornerMask(i===0?14:4);if(allViews){w.style.cornerVisibility=next;delete p.adaptiveOverrides!.phone[w.id].style!.cornerVisibility;delete p.adaptiveOverrides!.inactive[w.id].style!.cornerVisibility;}else p.adaptiveOverrides!.phone[w.id].style!.cornerVisibility=next;}
  expect(await save(page,info,'bit')).toEqual(expected);await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'undo')).toEqual(source);await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'redo')).toEqual(expected);await open(page,expected);expect(await save(page,info,'reopened')).toEqual(expected);
});

test('native rectangle radius, resize, effect overrides and SetStyle survive authoring and reopen',async({page},info)=>{
  const doc=authorFixture();doc.pages[0].widgets=doc.pages[0].widgets.slice(0,1);doc.pages[0].adaptiveOverrides={phone:{},inactive:{}};page.on('dialog',d=>d.accept());await page.goto('/');await open(page,doc);await page.locator('.editor-widget.box').click();
  await number(page,'Radius',35);await number(page,'W',320);await number(page,'H',140);await inspector(page).getByLabel('Corner top right rounded',{exact:true}).uncheck();
  const before=await save(page,info,'geometry');expect(before.pages[0].widgets[0].style.radius).toBe(35);expect(before.pages[0].widgets[0].style.cornerVisibility).toEqual(cornerMask(13));expect(before.pages[0].widgets[0].vectorPath).toEqual(doc.pages[0].widgets[0].vectorPath);expect(await page.locator('.editor-widget.box [data-shadow-fill]').getAttribute('d')).toContain('35 0');
  await inspector(page).getByRole('tab',{name:'Interactions',exact:true}).click();await inspector(page).getByLabel('Effect to add',{exact:true}).selectOption('mouseOverStyle');await inspector(page).getByRole('button',{name:'Add style effect',exact:true}).click();await inspector(page).getByLabel('Override MouseOver radius',{exact:true}).check();await number(page,'MouseOver radius',12);await inspector(page).getByLabel('Override MouseOver corner visibility',{exact:true}).check();await inspector(page).getByLabel('MouseOver corner bottom left rounded',{exact:true}).uncheck();await inspector(page).getByRole('button',{name:'Close effect',exact:true}).click();
  await inspector(page).getByRole('button',{name:'New interaction',exact:true}).click();await inspector(page).getByRole('button',{name:'Add action',exact:true}).click();await inspector(page).getByLabel('Action 1 type',{exact:true}).selectOption('setStyle');await inspector(page).getByLabel('Action 1 target',{exact:true}).selectOption(doc.pages[0].widgets[0].id);await inspector(page).getByLabel('Override Action 1 corner visibility',{exact:true}).check();await inspector(page).getByLabel('Action 1 corner top left rounded',{exact:true}).uncheck();
  const result=await save(page,info,'effects-action'),w=result.pages[0].widgets[0];expect(w.mouseOverStyle).toEqual({radius:12,cornerVisibility:cornerMask(5)});expect(w.interactions[0].actions[0].style).toEqual({fill:'#2563eb',cornerVisibility:cornerMask(12)});expect(w.style).toEqual(before.pages[0].widgets[0].style);
  await open(page,result);expect(await save(page,info,'reopened')).toEqual(result);
});
