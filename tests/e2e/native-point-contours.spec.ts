import {expect,test,type Page,type TestInfo} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {parseDocument,serializeDocument} from '../../src/model/document';
import type {Document,VectorPath} from '../../src/model/types';
import {CONTOUR_TARGET_ID,nativePointContoursFixture,expectedDetachedContourCommit} from '../fixtures/native-point-contours';

const inspector=(page:Page)=>page.getByRole('complementary',{name:'Properties inspector'});
const anchor=(page:Page,index:number)=>page.locator(`.vector-canvas-overlay[data-vector-mode="points"] [data-vector-anchor="${index}"]:not([data-vector-handle])`);
async function open(page:Page,doc:Document){await page.goto('/');const pending=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await pending).setFiles({name:'point-contours.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);}
async function select(page:Page){await page.locator('.canvas-surface .editor-widget').click();}
async function save(page:Page,info:TestInfo,name:string){const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath(`${name}.rea.json`);await(await pending).saveAs(file);return parseDocument(await readFile(file,'utf8'));}
async function number(page:Page,label:string,value:number){const field=inspector(page).getByLabel(label,{exact:true});await field.fill(String(value));await field.press('Tab');}
function expectPath(actual:VectorPath,expected:VectorPath){expect(actual.fillRule).toBe(expected.fillRule);expect(actual.commands.length).toBe(expected.commands.length);expected.commands.forEach((c,i)=>{expect(Object.keys(actual.commands[i]).sort()).toEqual(Object.keys(c).sort());for(const[k,v]of Object.entries(c)){const n=(actual.commands[i]as unknown as Record<string,unknown>)[k];if(typeof v==='number')expect(Math.abs((n as number)-v)).toBeLessThan(1e-10);else expect(n).toEqual(v);}});}
function expectDocument(actual:Document,expected:Document){expectPath(actual.pages[0].widgets[0].vectorPath!,expected.pages[0].widgets[0].vectorPath!);const copy=structuredClone(actual);copy.pages[0].widgets[0].vectorPath=expected.pages[0].widgets[0].vectorPath;expect(copy).toEqual(expected);}

test('a detached tiny contour stays in saved data without inflating the edited owner',async({page},info)=>{
  const doc=nativePointContoursFixture();await writeFile('artifacts/native-point-contours-source.rea.json',serializeDocument(doc));await open(page,doc);await select(page);await number(page,'Node X %',-25);
  const changed=await save(page,info,'detached'),expected=structuredClone(doc),result=expectedDetachedContourCommit();Object.assign(expected.pages[0].widgets[0],result.bounds,{vectorPath:result.vectorPath});expectDocument(changed,expected);
  await expect(anchor(page,0)).toHaveCount(1);await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'detached-undo')).toEqual(doc);await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'detached-redo')).toEqual(changed);
  await open(page,changed);expect(await save(page,info,'detached-reopen')).toEqual(changed);
});

test('deleting to M-only commits once and keeps the surviving anchor editable across another drag',async({page},info)=>{
  const doc=nativePointContoursFixture(),w=doc.pages[0].widgets[0];w.vectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:1}]};await open(page,doc);await select(page);await page.getByRole('button',{name:'Edit points',exact:true}).click();await anchor(page,1).click();await page.keyboard.press('Delete');
  const single=await save(page,info,'single'),expected=structuredClone(doc);Object.assign(expected.pages[0].widgets[0],{x:99,y:99,width:1,height:1,vectorPath:{fillRule:'nonzero',commands:[{op:'M',x:1,y:1}]}});expectDocument(single,expected);await expect(anchor(page,0)).toHaveClass(/selected/);await expect(anchor(page,1)).toHaveCount(0);
  const box=await anchor(page,0).boundingBox(),zoom=Number(await page.getByLabel('Zoom',{exact:true}).inputValue()),x=box!.x+box!.width/2,y=box!.y+box!.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+8*zoom,y+6*zoom,{steps:4});await page.mouse.up();
  const dragged=await save(page,info,'single-drag'),after=structuredClone(expected);Object.assign(after.pages[0].widgets[0],{x:107,y:105});expectDocument(dragged,after);await expect(anchor(page,0)).toHaveClass(/selected/);
  // The first-anchor native fallback skips outward rounding. World X108.25
  // stays in owner X107, rather than shifting the one-pixel owner to X108.
  await number(page,'Node X %',125);const fractional=await save(page,info,'single-fractional'),fractionalExpected=structuredClone(after);fractionalExpected.pages[0].widgets[0].vectorPath!.commands[0]={op:'M',x:1.25,y:1};expectDocument(fractional,fractionalExpected);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'fractional-undo')).toEqual(dragged);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'drag-undo')).toEqual(single);await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'delete-undo')).toEqual(doc);await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'delete-redo')).toEqual(single);await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'drag-redo')).toEqual(dragged);
  await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'fractional-redo')).toEqual(fractional);
  await open(page,fractional);expect(await save(page,info,'single-reopen')).toEqual(fractional);
});

for(const rotation of [.000009,360])test(`single-anchor numeric edit preserves raw angle ${rotation} and uses the native sizing-frame route`,async({page},info)=>{
  const doc=nativePointContoursFixture(),w=doc.pages[0].widgets[0];w.rotation=rotation;w.vectorPath={fillRule:'nonzero',commands:[{op:'M',x:.25,y:.25}]};await open(page,doc);await select(page);await number(page,'Node X %',50);
  const changed=await save(page,info,'rotation'),expected=structuredClone(doc);Object.assign(expected.pages[0].widgets[0],rotation===360?{x:-1,y:-1,width:1,height:1,vectorPath:{fillRule:'nonzero',commands:[{op:'M',x:201,y:126}]}}:{x:199,y:124,width:1,height:1,vectorPath:{fillRule:'nonzero',commands:[{op:'M',x:1,y:1}]}});expectDocument(changed,expected);expect(changed.pages[0].widgets[0].rotation).toBe(rotation);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'rotation-undo')).toEqual(doc);await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'rotation-redo')).toEqual(changed);
});

for(const allViews of [false,true])test(`compound point commit preserves sibling/inactive views and AutoFit with Affect all views ${allViews}`,async({page},info)=>{
  const doc=nativePointContoursFixture(),p=doc.pages[0],w=p.widgets[0];w.vectorPath!.commands[6]={op:'L',x:3.000001,y:0};
  doc.adaptiveViewSets=[{id:'contours-set',name:'Contour views',baseSize:{width:1200,height:0},views:[{id:'contours-phone',name:'Phone',width:390},{id:'contours-child',name:'Child',width:360,baseViewId:'contours-phone'},{id:'contours-other',name:'Other',width:768}]}];p.adaptiveViewSetId='contours-set';p.adaptiveViews=[];delete p.adaptiveSelection;delete p.adaptiveBaseSize;
  p.adaptiveOverrides={'contours-phone':{[w.id]:{x:400,y:300,width:400,height:200,style:{color:'#123456'}}},'contours-child':{[w.id]:{style:{fill:'#ff0000'}}},'contours-other':{[w.id]:{x:700,width:300,placed:false}},orphan:{[w.id]:{x:900,width:700,style:{radius:3}}}};
  await open(page,doc);await page.getByLabel('Adaptive view',{exact:true}).selectOption('contours-phone');await page.getByLabel('Affect all views',{exact:true}).setChecked(allViews);await select(page);await number(page,'Node X %',-25);
  const changed=await save(page,info,'adaptive'),expected=structuredClone(doc);Object.assign(expected.pages[0].adaptiveOverrides!['contours-phone'][CONTOUR_TARGET_ID],{x:300,width:500});expected.pages[0].widgets[0].vectorPath=expectedDetachedContourCommit().vectorPath;expected.pages[0].widgets[0].vectorPath!.commands[6]={op:'L',x:2.6000008,y:0};expectDocument(changed,expected);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'adaptive-undo')).toEqual(doc);await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'adaptive-redo')).toEqual(changed);await open(page,changed);expect(await save(page,info,'adaptive-reopen')).toEqual(changed);
});
