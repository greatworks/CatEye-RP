import {expect,test,type Page,type TestInfo} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {parseDocument,serializeDocument} from '../../src/model/document';
import type {Document} from '../../src/model/types';
import {expectedPointEditingPath,nativePointEditingFixture} from '../fixtures/native-point-editing';

const inspector=(page:Page)=>page.getByRole('complementary',{name:'Properties inspector'});
const overlay=(page:Page)=>page.locator('.vector-canvas-overlay[data-vector-mode="points"]');
const anchor=(page:Page,index:number)=>overlay(page).locator(`[data-vector-anchor="${index}"]:not([data-vector-handle])`);
async function open(page:Page,doc:Document){await page.goto('/');const pending=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await pending).setFiles({name:'point-editing.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);}
async function select(page:Page){await page.locator('.canvas-surface .editor-widget').click();}
async function save(page:Page,info:TestInfo,name:string){const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath(`${name}.rea.json`);await(await pending).saveAs(file);return parseDocument(await readFile(file,'utf8'));}
async function number(page:Page,label:string,value:number){const field=inspector(page).getByLabel(label,{exact:true});await field.fill(String(value));await field.press('Tab');}

test('entering point mode derives current corner anchors without rewriting the saved shape',async({page},info)=>{
  const doc=nativePointEditingFixture();await open(page,doc);await select(page);
  await expect(inspector(page).getByLabel('Node Y %',{exact:true})).toHaveValue('30');
  await page.getByRole('button',{name:'Edit points',exact:true}).click();
  await expect(anchor(page,0)).toHaveAttribute('y','14');
  expect(await save(page,info,'entered')).toEqual(doc);
  await writeFile('artifacts/native-point-editing-source.rea.json',serializeDocument(doc));
  await page.getByRole('button',{name:'Done editing points',exact:true}).click();
  expect(await save(page,info,'exited')).toEqual(doc);
});

test('numeric node edits convert the current outline once and undo restores its parameters',async({page},info)=>{
  const doc=nativePointEditingFixture();await open(page,doc);await select(page);
  await number(page,'Node X %',10);
  const changed=await save(page,info,'converted'),target=changed.pages[0].widgets[0];
  expect(target.type).toBe('path');expect(target.vectorPath!.commands[0]).toEqual({op:'M',x:.1,y:.3});
  const expected=expectedPointEditingPath();expected.commands[0]={op:'M',x:.1,y:.3};
  // Numeric inspector changes one command; the remaining newly generated anchors/handles stay exact.
  expect(target.vectorPath!.commands).toHaveLength(expected.commands.length);
  expected.commands.forEach((command,i)=>{expect(target.vectorPath!.commands[i].op).toBe(command.op);for(const [key,value]of Object.entries(command))if(typeof value==='number')expect((target.vectorPath!.commands[i] as unknown as Record<string,number>)[key]).toBeCloseTo(value,12);});
  expect(target.style).toEqual(doc.pages[0].widgets[0].style);
  await expect(inspector(page).getByLabel('Radius',{exact:true})).toHaveCount(0);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'undone')).toEqual(doc);
  await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'redone')).toEqual(changed);
  await open(page,doc);await open(page,changed);expect(await save(page,info,'reopened')).toEqual(changed);
});

test('a cancelled or returned-to-start point drag leaves the native snapshot intact',async({page},info)=>{
  const doc=nativePointEditingFixture();await open(page,doc);await select(page);await page.getByRole('button',{name:'Edit points',exact:true}).click();
  await expect(anchor(page,0)).toHaveAttribute('y','14');
  const box=await anchor(page,0).boundingBox();expect(box).not.toBeNull();const x=box!.x+box!.width/2,y=box!.y+box!.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+30,y+15,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();
  expect(await save(page,info,'cancelled')).toEqual(doc);
  await page.getByRole('button',{name:'Edit points',exact:true}).click();
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+30,y+15,{steps:5});await page.mouse.move(x,y,{steps:5});await page.mouse.up();
  expect(await save(page,info,'returned')).toEqual(doc);
});

test('double clicking the regenerated curved border enters points instead of editing text',async({page},info)=>{
  const doc=nativePointEditingFixture(),w=doc.pages[0].widgets[0];w.height=120;w.style.radius=50;
  await open(page,doc);const box=await page.locator('.canvas-surface').boundingBox();const zoom=Number(await page.getByLabel('Zoom',{exact:true}).inputValue());
  // Native .44 cubic midpoint is (14.5,14.5); old thin-capsule snapshot is over 10px away.
  await page.mouse.dblclick(box!.x+(w.x+14.5)*zoom,box!.y+(w.y+14.5)*zoom);
  await expect(overlay(page)).toBeVisible();await expect(anchor(page,0)).toHaveAttribute('y','46');
  expect(await save(page,info,'double-click')).toEqual(doc);
});

test('a held point gesture paints the edited contour and commits one reversible shape conversion',async({page},info)=>{
  const doc=nativePointEditingFixture();await open(page,doc);await select(page);await page.getByRole('button',{name:'Edit points',exact:true}).click();
  const box=await anchor(page,0).boundingBox();const x=box!.x+box!.width/2,y=box!.y+box!.height/2;
  const zoom=Number(await page.getByLabel('Zoom',{exact:true}).inputValue());
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+24*zoom,y+6*zoom,{steps:5});
  const draftD=(await page.locator('.editor-widget [data-shadow-fill]').getAttribute('d'))!.split(/\s+/);
  expect(draftD[0]).toBe('M');expect(Number(draftD[1])).toBeCloseTo(24,10);expect(Number(draftD[2])).toBeCloseTo(24,10);
  await page.mouse.up();const changed=await save(page,info,'dragged');const target=changed.pages[0].widgets[0];
  expect(target.type).toBe('path');const first=target.vectorPath!.commands[0];expect(first.op).toBe('M');if(first.op==='Z')throw Error('Missing first anchor');expect(first.x).toBeCloseTo(.1,12);expect(first.y).toBeCloseTo(.4,12);
  expect([target.x,target.y,target.width,target.height]).toEqual([100,100,240,60]);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'drag-undo')).toEqual(doc);
  await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'drag-redo')).toEqual(changed);
});

test('editing a path back into a rectangle keeps its custom identity in preview and offline HTML',async({page,browser},info)=>{
  const doc=nativePointEditingFixture();await open(page,doc);await select(page);await number(page,'Node X %',10);await number(page,'Node X %',0);
  const converted=await save(page,info,'custom'),w=converted.pages[0].widgets[0];expect(w.type).toBe('path');
  // Persisted corner parameters/effects remain metadata and must not regenerate custom geometry.
  w.style.radius=55;w.selected=true;w.selectedStyle={radius:2,cornerVisibility:[false,false,false,false]};
  await open(page,converted);await select(page);await expect(inspector(page).getByLabel('Radius',{exact:true})).toHaveCount(0);
  const authorD=await page.locator('.editor-widget [data-shadow-fill]').getAttribute('d');expect(authorD).toMatch(/^M 0 18 /);
  await page.getByTitle('Preview (F5)',{exact:true}).click();await expect(page.locator('.preview-overlay [data-widget-id="point-target"] [data-shadow-fill]')).toHaveAttribute('d',authorD!);await page.getByRole('button',{name:'Close preview',exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('custom-path.html');await(await download).saveAs(file);
  const context=await browser.newContext({offline:true});try{const offline=await context.newPage();await offline.goto(pathToFileURL(file).href);await expect(offline.locator('[data-widget-id="point-target"] [data-shadow-fill]')).toHaveAttribute('d',authorD!);}finally{await context.close();}
  expect(await save(page,info,'after-players')).toEqual(converted);
});

for(const allViews of [false,true])test(`adaptive point conversion shares only identity and path, preserving inactive view styles; all views ${allViews}`,async({page},info)=>{
  const doc=nativePointEditingFixture(),p=doc.pages[0],w=p.widgets[0];
  doc.adaptiveViewSets=[{id:'point-set',name:'Point sizes',baseSize:{width:1000,height:0},views:[{id:'point-phone',name:'Phone',width:390}]}];p.adaptiveViewSetId='point-set';p.adaptiveViews=[];delete p.adaptiveSelection;delete p.adaptiveBaseSize;
  p.adaptiveOverrides={'point-phone':{[w.id]:{x:80,width:300,height:100,style:{radius:20,color:'#123456'},stateStyles:{selected:{radius:12}}}},inactive:{[w.id]:{x:55,style:{radius:44,cornerVisibility:[true,false,true,false]}}}};
  await open(page,doc);await page.getByLabel('Adaptive view',{exact:true}).selectOption('point-phone');await page.getByLabel('Affect all views',{exact:true}).setChecked(allViews);await select(page);
  await expect(inspector(page).getByLabel('Node Y %',{exact:true})).toHaveValue('20');await number(page,'Node X %',10);
  const changed=await save(page,info,'adaptive-changed'),actual=changed.pages[0].widgets[0];
  expect(actual.type).toBe('path');expect(actual.vectorPath!.commands[0]).toEqual({op:'M',x:.1,y:.2});
  expect({...actual,vectorPath:w.vectorPath,type:w.type}).toEqual(w);expect(changed.pages[0].adaptiveOverrides).toEqual(p.adaptiveOverrides);
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'adaptive-undo')).toEqual(doc);
  await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'adaptive-redo')).toEqual(changed);
  await page.getByLabel('Adaptive view',{exact:true}).selectOption('');await select(page);await expect(inspector(page).getByLabel('Radius',{exact:true})).toHaveCount(0);
});

for(const mode of ['hidden-side','independent-corners'] as const)test(`unsupported ${mode} reconstruction cannot expose stale node controls`,async({page},info)=>{
  const doc=nativePointEditingFixture(),w=doc.pages[0].widgets[0];
  if(mode==='hidden-side')w.style.borderVisibility=[true,false,true,true];else w.style.cornerRadii=[8,14,20,26];
  await open(page,doc);await select(page);
  await expect(inspector(page).getByLabel('Path node',{exact:true})).toHaveCount(0);
  const edit=page.getByRole('button',{name:'Edit points',exact:true});if(await edit.count())await expect(edit).toBeDisabled();
  await expect(inspector(page)).toContainText('Point editing is unavailable');
  await page.keyboard.press('Control+Alt+p');await expect(overlay(page)).toHaveCount(0);
  expect(await save(page,info,'unsupported')).toEqual(doc);
});
