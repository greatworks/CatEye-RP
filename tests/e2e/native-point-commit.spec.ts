import {expect,test,type Page,type TestInfo} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {parseDocument,serializeDocument} from '../../src/model/document';
import type {Document,Widget} from '../../src/model/types';
import {nativePointCommitFixture} from '../fixtures/native-point-commit';

const inspector=(page:Page)=>page.getByRole('complementary',{name:'Properties inspector'});
const overlay=(page:Page)=>page.locator('.vector-canvas-overlay[data-vector-mode="points"]');
const anchor=(page:Page,index:number)=>overlay(page).locator(`[data-vector-anchor="${index}"]:not([data-vector-handle])`);
async function open(page:Page,doc:Document){await page.goto('/');const pending=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await pending).setFiles({name:'point-commit.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);}
async function select(page:Page){await page.locator('.canvas-surface .editor-widget').click();}
async function save(page:Page,info:TestInfo,name:string){const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath(`${name}.rea.json`);await(await pending).saveAs(file);return parseDocument(await readFile(file,'utf8'));}
async function number(page:Page,label:string,value:number){const field=inspector(page).getByLabel(label,{exact:true});await field.fill(String(value));await field.press('Tab');}
function expectFrame(w:Widget,values:number[]){[w.x,w.y,w.width,w.height,w.rotation].forEach((value,index)=>expect(value).toBeCloseTo(values[index],10));}
function absolute(w:Widget){return w.vectorPath!.commands.flatMap(c=>c.op==='Z'?[]:[{x:w.x+c.x*w.width,y:w.y+c.y*w.height}]);}

test('numeric point commit normalizes the exterior frame and retains AutoFit in one undoable change',async({page},info)=>{
  const doc=nativePointCommitFixture();await open(page,doc);await select(page);
  await writeFile('artifacts/native-point-commit-source.rea.json',serializeDocument(doc));
  await number(page,'Node X %',-25);const changed=await save(page,info,'numeric'),w=changed.pages[0].widgets[0];
  expectFrame(w,[50,100,250,100,0]);expect(w.shapeText).toEqual({autoFitWidth:true,autoFitHeight:true});
  expect(absolute(w)).toEqual([{x:50,y:100},{x:300,y:100},{x:300,y:200},{x:100,y:200}]);
  expect(w.vectorPath!.commands[0]).toEqual({op:'M',x:0,y:0});expect(w.style).toEqual(doc.pages[0].widgets[0].style);
  await expect(inspector(page).getByLabel('Node X %',{exact:true})).toHaveValue('0');
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'undo')).toEqual(doc);
  await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'redo')).toEqual(changed);
  await open(page,doc);await open(page,changed);expect(await save(page,info,'reopened')).toEqual(changed);
});

test('a held gesture keeps its frame until release, then preserves canvas positions in the normalized frame',async({page},info)=>{
  const doc=nativePointCommitFixture();await open(page,doc);await select(page);await page.getByRole('button',{name:'Edit points',exact:true}).click();
  const box=await anchor(page,0).boundingBox(),zoom=Number(await page.getByLabel('Zoom',{exact:true}).inputValue());
  const x=box!.x+box!.width/2,y=box!.y+box!.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-20*zoom,y-10*zoom,{steps:5});
  await expect(overlay(page).locator(':scope > g')).toHaveAttribute('transform','translate(100 100) rotate(0 100 50)');
  await page.mouse.up();const changed=await save(page,info,'drag'),w=changed.pages[0].widgets[0];
  expectFrame(w,[80,90,220,110,0]);expect(w.shapeText).toEqual({autoFitWidth:true,autoFitHeight:true});
  const end=await anchor(page,0).boundingBox();expect(end!.x+end!.width/2).toBeCloseTo(x-20*zoom,5);expect(end!.y+end!.height/2).toBeCloseTo(y-10*zoom,5);
  absolute(w).forEach((p,i)=>{expect(p.x).toBeCloseTo([80,300,300,100][i],10);expect(p.y).toBeCloseTo([90,100,200,200][i],10);});
  await expect(anchor(page,0)).toHaveClass(/selected/);await page.keyboard.press('2');
  const curved=await save(page,info,'next-curve');expect(curved.pages[0].widgets[0].vectorPath!.commands.some(c=>c.op==='C')).toBe(true);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'next-curve-undo')).toEqual(changed);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'drag-undo')).toEqual(doc);
  await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'drag-redo')).toEqual(changed);
});

for(const angle of [90,37])test(`rotated point rebounding at ${angle} degrees retains the edited canvas coordinates`,async({page},info)=>{
  const doc=nativePointCommitFixture(),before=doc.pages[0].widgets[0];before.rotation=angle;await open(page,doc);await page.getByLabel('Zoom',{exact:true}).selectOption('1.5');await select(page);
  await number(page,'Node X %',-25);const changed=await save(page,info,'rotated'),w=changed.pages[0].widgets[0];
  expectFrame(w,angle===90?[75,75,250,100,90]:[55,84,251,101,37]);
  const radians=angle*Math.PI/180,world=(owner:Widget,x:number,y:number)=>({x:owner.x+owner.width/2+Math.cos(radians)*(x-owner.width/2)-Math.sin(radians)*(y-owner.height/2),y:owner.y+owner.height/2+Math.sin(radians)*(x-owner.width/2)+Math.cos(radians)*(y-owner.height/2)});
  const expected=[[-50,0],[200,0],[200,100],[0,100]].map(([x,y])=>world(before,x,y));
  const actual=w.vectorPath!.commands.flatMap(c=>c.op==='Z'?[]:[world(w,c.x*w.width,c.y*w.height)]);
  actual.forEach((p,i)=>{expect(p.x).toBeCloseTo(expected[i].x,9);expect(p.y).toBeCloseTo(expected[i].y,9);});
  expect(w.shapeText).toEqual({autoFitWidth:true,autoFitHeight:true});await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'rotated-undo')).toEqual(doc);await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'rotated-redo')).toEqual(changed);
});

test('entry and cancellation retain AutoFit flags and saved bounds',async({page},info)=>{
  const doc=nativePointCommitFixture();await open(page,doc);await select(page);await page.getByRole('button',{name:'Edit points',exact:true}).click();
  expect(await save(page,info,'entry')).toEqual(doc);const box=await anchor(page,0).boundingBox();const x=box!.x+box!.width/2,y=box!.y+box!.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-40,y-20,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();
  expect(await save(page,info,'cancel')).toEqual(doc);
});

test('a cubic handle uses curve extrema and outward rounding rather than the control hull',async({page},info)=>{
  const doc=nativePointCommitFixture(),w=doc.pages[0].widgets[0];
  w.vectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'C',x1:0,y1:0,x2:1,y2:0,x:1,y:1}]};
  await open(page,doc);await select(page);await inspector(page).getByLabel('Path node',{exact:true}).selectOption('1');await number(page,'Control 1 Y %',-100);
  const changed=await save(page,info,'cubic'),target=changed.pages[0].widgets[0];
  // y(t)=-300t+600t²-200t³; the interior minimum is -41.421356…,
  // so native outward rounding produces [-42,100], not the handle hull [-100,100].
  expectFrame(target,[100,58,200,142,0]);const commands=target.vectorPath!.commands;
  expect(commands[0]).toEqual({op:'M',x:0,y:42/142});expect(commands[1]).toEqual({op:'C',x1:0,y1:-58/142,x2:1,y2:42/142,x:1,y:1});
  await expect(inspector(page).getByLabel('Control 1 Y %',{exact:true})).toHaveValue(String(Number((-58/142*100).toFixed(8))));
  expect(target.shapeText).toEqual({autoFitWidth:true,autoFitHeight:true});await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'cubic-undo')).toEqual(doc);
});

for(const mode of ['preview','offline'] as const)test(`${mode}: Set Text still follows the retained AutoFit flags after point commit`,async({page,browser},info)=>{
  const doc=nativePointCommitFixture(),w=doc.pages[0].widgets[0],value='A\nB';doc.caseSelection='never';
  w.interactions=[{id:'commit-settext',name:'Replace text',event:'click',enabled:true,conditionMode:'all',conditions:[],actions:[{id:'commit-settext-action',type:'setText',targetId:w.id,value}]}];
  await open(page,doc);await select(page);await number(page,'Node X %',-25);const changed=await save(page,info,'before-player');expectFrame(changed.pages[0].widgets[0],[50,100,250,100,0]);expect(changed.pages[0].widgets[0].shapeText).toEqual(w.shapeText);
  let context:Awaited<ReturnType<typeof browser.newContext>>|undefined,player=page;
  try{
    if(mode==='preview')await page.getByTitle('Preview (F5)',{exact:true}).click();
    else{const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('point-commit.html');await(await pending).saveAs(file);context=await browser.newContext({offline:true});player=await context.newPage();await player.goto(pathToFileURL(file).href);}
    const target=player.locator(`${mode==='preview'?'.preview-overlay ':''}[data-widget-id="${w.id}"]`);await target.click();await expect(target).toContainText('A');
    // The retained flags still allow the established runtime AutoFit setter.
    await expect.poll(()=>target.evaluate(e=>parseFloat((e as HTMLElement).style.width))).toBeLessThan(30);
    await expect.poll(()=>target.evaluate(e=>parseFloat((e as HTMLElement).style.height))).toBeLessThan(60);
    if(mode==='preview')await page.getByRole('button',{name:'Close preview',exact:true}).click();
  }finally{await context?.close();}
  expect(await save(page,info,'after-player')).toEqual(changed);
});

for(const allViews of [false,true])test(`point rebounding writes only the active view geometry; Affect all views ${allViews}`,async({page},info)=>{
  const doc=nativePointCommitFixture(),p=doc.pages[0],w=p.widgets[0];
  doc.adaptiveViewSets=[{id:'commit-set',name:'Commit views',baseSize:{width:1200,height:0},views:[{id:'commit-phone',name:'Phone',width:390},{id:'commit-child',name:'Child',width:360,baseViewId:'commit-phone'},{id:'commit-other',name:'Other',width:768}]}];
  p.adaptiveViewSetId='commit-set';p.adaptiveViews=[];delete p.adaptiveSelection;delete p.adaptiveBaseSize;
  p.adaptiveOverrides={'commit-phone':{[w.id]:{x:400,y:300,width:400,height:200,style:{color:'#123456'}}},'commit-child':{[w.id]:{style:{fill:'#ff0000'}}},'commit-other':{[w.id]:{x:700,width:300,placed:false}},orphan:{[w.id]:{x:900,width:700,style:{radius:3}}}};
  await open(page,doc);await page.getByLabel('Adaptive view',{exact:true}).selectOption('commit-phone');await page.getByLabel('Affect all views',{exact:true}).setChecked(allViews);await select(page);await number(page,'Node X %',-25);
  const changed=await save(page,info,'named'),expected=structuredClone(doc);expected.pages[0].widgets[0].vectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:.2,y:1},{op:'Z'}]};
  Object.assign(expected.pages[0].adaptiveOverrides!['commit-phone'][w.id],{x:300,y:300,width:500,height:200});expect(changed).toEqual(expected);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'named-undo')).toEqual(doc);await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'named-redo')).toEqual(changed);
  await open(page,doc);await page.getByLabel('Adaptive view',{exact:true}).selectOption('');await page.getByLabel('Affect all views',{exact:true}).setChecked(allViews);await select(page);await number(page,'Node X %',-25);
  const base=await save(page,info,'base'),baseExpected=structuredClone(doc);Object.assign(baseExpected.pages[0].widgets[0],{x:50,width:250,vectorPath:expected.pages[0].widgets[0].vectorPath});expect(base).toEqual(baseExpected);
});
