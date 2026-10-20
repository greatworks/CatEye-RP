import {expect,test,type Page,type TestInfo} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {parseDocument,serializeDocument} from '../../src/model/document';
import type {Document} from '../../src/model/types';
import {nativePillsFixture} from '../fixtures/native-pills';
import {checkNativePillsPlayer} from '../../scripts/native-pills-scenario.mjs';

const inspector=(page:Page)=>page.getByRole('complementary',{name:'Properties inspector'});
async function open(page:Page,doc:Document){const pending=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await pending).setFiles({name:'native-pills.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);}
async function save(page:Page,info:TestInfo,name:string){const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const file=info.outputPath(`${name}.rea.json`);await(await pending).saveAs(file);return parseDocument(await readFile(file,'utf8'));}
async function number(page:Page,label:string,value:number){const field=inspector(page).getByLabel(label,{exact:true});await field.fill(String(value));await field.press('Tab');}

for(const mode of ['preview','offline'] as const)test(`${mode}: 18 recovered capsule paths, independent radius, resizing and interaction styles`,async({page,browser},info)=>{
  const doc=nativePillsFixture(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await open(page,doc);expect(await save(page,info,'initial')).toEqual(doc);await writeFile('artifacts/native-pills-source.rea.json',serializeDocument(doc));
  let player=page,context:Awaited<ReturnType<typeof browser.newContext>>|undefined;
  if(mode==='preview')await page.getByTitle('Preview (F5)',{exact:true}).click();else{
    const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('native-pills.html');await(await pending).saveAs(file);
    context=await browser.newContext({offline:true,viewport:{width:1600,height:1100},deviceScaleFactor:1});player=await context.newPage();player.on('pageerror',error=>errors.push(error.message));await player.goto(pathToFileURL(file).href);
  }
  try{await checkNativePillsPlayer(mode==='preview'?player.locator('.preview-overlay'):player.locator('main').first(),player,{capture:()=>player.screenshot({path:info.outputPath(`native-pills-${mode}.png`),fullPage:true})});}
  finally{await context?.close();if(mode==='preview')await page.getByRole('button',{name:'Close preview',exact:true}).click();}
  expect(await save(page,info,'after-runtime')).toEqual(doc);expect(errors).toEqual([]);
});

test('a recovered slider keeps its original path and independent parameters through authoring, undo and reopen',async({page},info)=>{
  const doc=nativePillsFixture();page.on('dialog',dialog=>dialog.accept());await page.goto('/');await open(page,doc);
  await page.locator('.canvas-surface .editor-widget.box').last().click();await expect(inspector(page).getByLabel('Radius',{exact:true})).toHaveValue('5');
  await number(page,'W',260);await number(page,'H',80);await number(page,'Radius',18);await inspector(page).getByLabel('Corner top left rounded',{exact:true}).uncheck();
  const expected=structuredClone(doc),target=expected.pages[0].widgets.find(w=>w.id==='pills-target')!;target.width=260;target.height=80;target.style.radius=18;target.style.cornerVisibility=[false,true,true,true];
  expect(await save(page,info,'edited')).toEqual(expected);const fill=page.locator('.canvas-surface .editor-widget.box').last().locator('[data-shadow-fill]');expect(((await fill.getAttribute('d'))?.match(/C /g)??[]).length).toBe(3);
  for(let i=0;i<4;i++)await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'undo')).toEqual(doc);
  for(let i=0;i<4;i++)await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info,'redo')).toEqual(expected);await open(page,expected);expect(await save(page,info,'reopened')).toEqual(expected);
});

test('editing an actual capsule handle stores custom identity and undo restores its native parameters',async({page},info)=>{
  const doc=nativePillsFixture();page.on('dialog',dialog=>dialog.accept());await page.goto('/');await open(page,doc);await page.locator('.canvas-surface .editor-widget.box').last().click();
  await inspector(page).getByLabel('Path node',{exact:true}).selectOption('1');await number(page,'Control 1 X %',10);await expect(inspector(page).getByLabel('Radius',{exact:true})).toHaveCount(0);
  const expected=structuredClone(doc),target=expected.pages[0].widgets.find(w=>w.id==='pills-target')!,command=target.vectorPath!.commands[1];if(command.op!=='C')throw Error('Expected real capsule cubic');command.x1=.1;target.type='path';
  const actual=await save(page,info,'node-edited'),actualPath=actual.pages[0].widgets.find(w=>w.id==='pills-target')!.vectorPath!;
  // Regeneration computes normalized .44 controls from the current physical size;
  // source-snapshot arithmetic may differ at the last floating-point bit.
  expect(actualPath.fillRule).toBe(target.vectorPath!.fillRule);expect(actualPath.commands).toHaveLength(target.vectorPath!.commands.length);
  target.vectorPath!.commands.forEach((expectedCommand,i)=>{const observed=actualPath.commands[i];expect(Object.keys(observed).sort()).toEqual(Object.keys(expectedCommand).sort());expect(observed.op).toBe(expectedCommand.op);for(const [key,value]of Object.entries(expectedCommand))if(typeof value==='number')expect((observed as unknown as Record<string,number>)[key]).toBeCloseTo(value,12);});
  target.vectorPath=actualPath;expect(actual).toEqual(expected);await open(page,expected);await page.locator('.canvas-surface .editor-widget.path').click();await expect(inspector(page).getByLabel('Radius',{exact:true})).toHaveCount(0);
  await open(page,doc);await page.locator('.canvas-surface .editor-widget.box').last().click();await inspector(page).getByLabel('Path node',{exact:true}).selectOption('1');await number(page,'Control 1 X %',10);await page.getByTitle('Undo',{exact:true}).click();await page.locator('.canvas-surface .editor-widget.box').last().click();await expect(inspector(page).getByLabel('Radius',{exact:true})).toHaveValue('5');expect(await save(page,info,'node-undo')).toEqual(doc);
});
