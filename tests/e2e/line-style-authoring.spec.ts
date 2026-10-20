import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDocument, createWidget, parseDocument, serializeDocument } from '../../src/model/document';
import type { Document, GradientFill } from '../../src/model/types';

const inspector=(page:Page)=>page.getByRole('complementary',{name:'Properties inspector'});
const line=(page:Page)=>page.locator('.editor-widget.line');
const box=(page:Page)=>page.locator('.editor-widget.box');
const gradient:GradientFill={type:'linear',start:{x:-.25,y:0},end:{x:1.25,y:1},stops:[{offset:0,color:'#cc2200'},{offset:1,color:'#0055cc'}]};
function fixture(){
  const doc=createDocument();doc.name='Line style authoring';doc.caseSelection='never';
  const arrow=createWidget('line',80,80);arrow.name='Arrow target';arrow.width=240;arrow.height=40;arrow.style.strokeWidth=5;arrow.style.strokeGradient=structuredClone(gradient);
  const rectangle=createWidget('box',80,180);rectangle.name=rectangle.text='Rectangle target';rectangle.width=200;rectangle.height=100;rectangle.style.strokeWidth=6;rectangle.style.borderWidths=[3,6,9,12];rectangle.style.strokeGradient=structuredClone(gradient);
  const input=createWidget('input',370,90);input.name='Other input';input.text='Preserved';
  const table=createWidget('table',80,380);table.name='Style cells';
  doc.pages[0].widgets=[arrow,rectangle,input,table];doc.pages[0].adaptiveViews=[{id:'phone',name:'Phone',width:650,overrides:{}}];return doc;
}
async function open(page:Page,doc:Document){await page.goto('/');const pending=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await pending).setFiles({name:'line-style.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name)}
async function save(page:Page,path:string){const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();await(await pending).saveAs(path);return parseDocument(await readFile(path,'utf8'))}
async function select(page:Page,label:string,value:string){await inspector(page).getByLabel(label,{exact:true}).selectOption(value)}

test('line patterns and both arrow ends preserve gradient paint, are undoable, and save/reopen without legacy defaults',async({page},info)=>{
  const doc=fixture();await open(page,doc);await line(page).click();expect(await save(page,info.outputPath('unchanged.rea.json'))).toEqual(doc);
  await expect(inspector(page).getByLabel('Line pattern',{exact:true}).locator('option')).toHaveCount(10);
  await expect(inspector(page).getByLabel('Start arrow',{exact:true}).locator('option')).toHaveCount(29);
  await select(page,'Line pattern','long-dash-short-dash');await select(page,'Start arrow','large-hollow-diamond');await select(page,'End arrow','crow-cross-bar');
  const authored=await save(page,info.outputPath('authored.rea.json'));expect(authored.pages[0].widgets[0].style).toEqual({...doc.pages[0].widgets[0].style,linePattern:'long-dash-short-dash',lineEnds:{start:'large-hollow-diamond',end:'crow-cross-bar'}});expect(authored.pages[0].widgets.slice(1)).toEqual(doc.pages[0].widgets.slice(1));
  await page.getByTitle('Undo',{exact:true}).click();expect((await save(page,info.outputPath('undo.rea.json'))).pages[0].widgets[0].style.lineEnds).toEqual({start:'large-hollow-diamond',end:'none'});
  await page.getByTitle('Redo',{exact:true}).click();expect(await save(page,info.outputPath('redo.rea.json'))).toEqual(authored);await line(page).click();
  await select(page,'Line pattern','none');const hidden=await save(page,info.outputPath('none.rea.json'));expect(hidden.pages[0].widgets[0].style).toEqual({...authored.pages[0].widgets[0].style,linePattern:'none'});
  await select(page,'Line pattern','solid');await inspector(page).getByRole('button',{name:'Use default line ends',exact:true}).click();const reset=await save(page,info.outputPath('reset.rea.json'));expect(reset.pages[0].widgets[0].style.linePattern).toBe('solid');expect(reset.pages[0].widgets[0].style.lineEnds).toBeUndefined();expect(reset.pages[0].widgets[0].style.strokeGradient).toEqual(gradient);
  await open(page,authored);expect(await save(page,info.outputPath('reopened.rea.json'))).toEqual(authored);
});

test('Selected, MouseOver and Set style independently override or inherit full line-end pairs',async({page},info)=>{
  const doc=fixture();doc.pages[0].widgets[0].style.lineEnds={start:'cross-bar',end:'hollow-circle'};await open(page,doc);await line(page).click();
  await inspector(page).getByLabel('Custom selected style',{exact:true}).check();await inspector(page).getByLabel('Override Selected line ends',{exact:true}).check();await select(page,'Selected start arrow','none');
  const selected=await save(page,info.outputPath('selected.rea.json'));expect(selected.pages[0].widgets[0].selectedStyle).toEqual({lineEnds:{start:'none',end:'hollow-circle'}});
  await inspector(page).getByLabel('Override Selected line ends',{exact:true}).uncheck();expect((await save(page,info.outputPath('selected-inherit.rea.json'))).pages[0].widgets[0].selectedStyle).toEqual({});
  await inspector(page).getByRole('tab',{name:'Interactions',exact:true}).click();await inspector(page).getByLabel('Effect to add',{exact:true}).selectOption('mouseOverStyle');await inspector(page).getByRole('button',{name:'Add style effect',exact:true}).click();
  await inspector(page).getByLabel('Override MouseOver line pattern',{exact:true}).check();await select(page,'MouseOver line pattern','dot');await inspector(page).getByLabel('Override MouseOver line ends',{exact:true}).check();await select(page,'MouseOver end arrow','double-hollow-triangle');await inspector(page).getByRole('button',{name:'Close effect',exact:true}).click();
  await inspector(page).getByRole('button',{name:'New interaction',exact:true}).click();await inspector(page).getByRole('button',{name:'Add action',exact:true}).click();await select(page,'Action 1 type','setStyle');await select(page,'Action 1 target',doc.pages[0].widgets[0].id);
  await inspector(page).getByLabel('Override Action 1 line pattern',{exact:true}).check();await select(page,'Action 1 line pattern','none');await inspector(page).getByLabel('Override Action 1 line ends',{exact:true}).check();await select(page,'Action 1 start arrow','none');await select(page,'Action 1 end arrow','none');
  const result=await save(page,info.outputPath('effects-action.rea.json'));const target=result.pages[0].widgets[0];expect(target.style).toEqual(doc.pages[0].widgets[0].style);expect(target.mouseOverStyle).toEqual({linePattern:'dot',lineEnds:{start:'cross-bar',end:'double-hollow-triangle'}});expect(target.interactions[0].actions[0].style).toEqual({fill:'#2563eb',linePattern:'none',lineEnds:{start:'none',end:'none'}});
  await inspector(page).getByLabel('Override Action 1 line ends',{exact:true}).uncheck();expect((await save(page,info.outputPath('action-inherit.rea.json'))).pages[0].widgets[0].interactions[0].actions[0].style).toEqual({fill:'#2563eb',linePattern:'none'});
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info.outputPath('undo-action.rea.json'))).toEqual(result);await open(page,result);expect(await save(page,info.outputPath('reopened.rea.json'))).toEqual(result);
});

test('toolbar multi-selection gates arrows by geometry; adaptive resets stay local while cell border sides stay shared',async({page},info)=>{
  const doc=fixture();doc.pages[0].widgets[0].style.linePattern='dash-dot';doc.pages[0].widgets[0].style.lineEnds={start:'filled-circle',end:'filled-triangle'};doc.pages[0].widgets[1].style.borderVisibility=[false,true,false,true];await open(page,doc);await line(page).click();await page.locator('.editor-widget.input').click({modifiers:['Shift']});
  await page.getByLabel('Line style',{exact:true}).click();const toolbar=page.getByRole('group',{name:'Toolbar line style',exact:true});await toolbar.getByLabel('Toolbar end arrow',{exact:true}).selectOption('hollow-square');await toolbar.getByLabel('Toolbar line pattern',{exact:true}).selectOption('short-dash');await toolbar.getByLabel('Toolbar line pattern',{exact:true}).press('Escape');
  const multi=await save(page,info.outputPath('multi.rea.json'));expect(multi.pages[0].widgets[0].style.lineEnds).toEqual({start:'filled-circle',end:'hollow-square'});expect(multi.pages[0].widgets[2].style.lineEnds).toBeUndefined();expect(multi.pages[0].widgets[2].style.linePattern).toBe('short-dash');expect(multi.pages[0].widgets[2].text).toBe('Preserved');expect(multi.pages[0].widgets[1]).toEqual(doc.pages[0].widgets[1]);
  await open(page,doc);await page.getByLabel('Adaptive view',{exact:true}).selectOption('phone');await line(page).click();await select(page,'Line pattern','');await inspector(page).getByRole('button',{name:'Use default line ends',exact:true}).click();
  await box(page).click();await inspector(page).getByRole('button',{name:'Use default border visibility',exact:true}).click();const adaptive=await save(page,info.outputPath('adaptive.rea.json'));expect(adaptive.pages[0].widgets).toEqual(doc.pages[0].widgets);expect(adaptive.pages[0].adaptiveViews[0].overrides).toEqual({[doc.pages[0].widgets[0].id]:{style:{linePattern:'solid',lineEnds:{start:'none',end:'none'}}},[doc.pages[0].widgets[1].id]:{style:{borderVisibility:[true,true,true,true]}}});
  const cells=page.locator('.editor-widget.table').getByRole('gridcell');await cells.nth(0).click();await cells.nth(1).click({modifiers:['Shift']});await select(page,'Line pattern','medium-dash');await inspector(page).getByLabel('Border bottom visible',{exact:true}).uncheck();
  const result=await save(page,info.outputPath('shared-cells.rea.json'));expect(result.pages[0].adaptiveViews[0].overrides).toEqual(adaptive.pages[0].adaptiveViews[0].overrides);expect(result.pages[0].widgets[3].table!.cells.slice(0,2).map(w=>({pattern:w.style.linePattern,sides:w.style.borderVisibility}))).toEqual([{pattern:'medium-dash',sides:[true,true,false,true]},{pattern:'medium-dash',sides:[true,true,false,true]}]);expect(result.pages[0].widgets[3].table!.cells.slice(2)).toEqual(doc.pages[0].widgets[3].table!.cells.slice(2));await open(page,result);expect(await save(page,info.outputPath('reopened.rea.json'))).toEqual(result);
});

test('border-side visibility is independent from widths and paint in Base, Selected and actions',async({page},info)=>{
  const doc=fixture();await open(page,doc);await box(page).click();await inspector(page).getByLabel('Border top visible',{exact:true}).uncheck();await inspector(page).getByLabel('Border left visible',{exact:true}).uncheck();await select(page,'Line pattern','dash-dot-dot');await inspector(page).getByLabel('Custom selected style',{exact:true}).check();await inspector(page).getByLabel('Override Selected border visibility',{exact:true}).check();await inspector(page).getByLabel('Selected border top visible',{exact:true}).check();
  await inspector(page).getByRole('tab',{name:'Interactions',exact:true}).click();await inspector(page).getByRole('button',{name:'New interaction',exact:true}).click();await inspector(page).getByRole('button',{name:'Add action',exact:true}).click();await select(page,'Action 1 type','setStyle');await select(page,'Action 1 target',doc.pages[0].widgets[1].id);await inspector(page).getByLabel('Override Action 1 border visibility',{exact:true}).check();await inspector(page).getByLabel('Action 1 border right visible',{exact:true}).uncheck();
  const saved=await save(page,info.outputPath('sides.rea.json'));const target=saved.pages[0].widgets[1];expect(target.style).toEqual({...doc.pages[0].widgets[1].style,linePattern:'dash-dot-dot',borderVisibility:[false,true,true,false]});expect(target.selectedStyle).toEqual({borderVisibility:[true,true,true,false]});expect(target.interactions[0].actions[0].style).toEqual({fill:'#2563eb',borderVisibility:[false,false,true,false]});await open(page,saved);expect(await save(page,info.outputPath('reopened.rea.json'))).toEqual(saved);
});
