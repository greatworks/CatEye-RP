import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Document, Interaction, VectorCommand, VectorPath, Widget } from '../../src/model/types';

type Scope = Page | Locator;
const widget = (scope: Scope, name: string) => scope.locator(`.widget[aria-label="${name}"]`);
const event = (actions: Omit<Action,'id'>[]): Interaction => ({id:uid(),event:'click',name:'Click',enabled:true,conditions:[],conditionMode:'all',actions:actions.map(action=>({...action,id:uid()}))});
const ring: VectorPath = {fillRule:'evenodd',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'Z'},{op:'M',x:.25,y:.25},{op:'L',x:.75,y:.25},{op:'L',x:.75,y:.75},{op:'L',x:.25,y:.75},{op:'Z'}]};
function fixture() {
  const doc=createDocument();doc.name='Editable vector geometry';doc.caseSelection='never';doc.pages[0].height=800;
  const curve=createWidget('path',80,80);curve.name='Curved path';curve.width=200;curve.height=100;curve.text='Curve <text>';
  curve.vectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:.5},{op:'C',x1:0,y1:-.25,x2:1,y2:-.25,x:1,y:.5},{op:'C',x1:1,y1:1.25,x2:0,y2:1.25,x:0,y:.5},{op:'Z'}]};
  Object.assign(curve.style,{fill:'#dbeafe',stroke:'#2563eb',strokeWidth:4,radius:90,borderWidths:[20,15,10,5]});curve.selectedStyle={fill:'#fee2e2',stroke:'#b91c1c',strokeWidth:7,color:'#7f1d1d'};curve.interactions=[event([{type:'setSelected',targetId:curve.id,value:'toggle'}])];
  const box=createWidget('box',450,70);box.name='Even odd hole';box.width=160;box.height=160;box.vectorPath=ring;Object.assign(box.style,{fill:'#bbf7d0',stroke:'#15803d',strokeWidth:2});
  const ellipse=createWidget('ellipse',680,80);ellipse.name='Stored cubic ellipse';ellipse.width=180;ellipse.height=100;
  ellipse.vectorPath={fillRule:'nonzero',commands:[{op:'M',x:.5,y:0},{op:'C',x1:.78,y1:0,x2:1,y2:.22,x:1,y:.5},{op:'C',x1:1,y1:.78,x2:.78,y2:1,x:.5,y:1},{op:'C',x1:.22,y1:1,x2:0,y2:.78,x:0,y:.5},{op:'C',x1:0,y1:.22,x2:.22,y2:0,x:.5,y:0},{op:'Z'}]};Object.assign(ellipse.style,{fill:'#fef3c7',stroke:'#92400e',strokeWidth:3});
  const panel=createWidget('panel',80,360);panel.name='Path panel';panel.width=280;panel.height=140;
  const child=createWidget('path',20,20);child.name='Nested triangle';child.width=100;child.height=60;child.text='Nested';panel.states![0].widgets=[child];
  const repeater=createWidget('repeater',450,350);repeater.name='Path rows';
  const cell=createWidget('path',10,10);cell.name='Row path';cell.width=160;cell.height=65;cell.text='[[Item.Name]]';cell.style.fill='#e5e7eb';cell.selectedStyle={fill:'#ffedd5',stroke:'#c2410c',strokeWidth:5};cell.interactions=[event([{type:'setSelected',targetId:cell.id,value:'toggle'},{type:'resize',targetId:cell.id,x:130,y:55}])];
  repeater.repeater={columns:['Name'],rows:[{Name:'Alpha'},{Name:'Beta'}],template:[cell],layout:'vertical',itemWidth:190,itemHeight:90,gap:10,fitToContent:false};
  const resize=createWidget('button',80,560);resize.name='Resize vector';resize.text='Move and resize curve';resize.width=240;
  resize.interactions=[event([{type:'move',targetId:curve.id,x:100,y:100},{type:'resize',targetId:curve.id,x:300,y:180},{type:'setStyle',targetId:curve.id,style:{radius:120,borderWidths:[30,25,20,15]}}])];
  doc.pages[0].widgets=[curve,box,ellipse,panel,repeater,resize];return doc;
}
async function menu(page:Page,name:string) {await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name,exact:true}).click();}
async function open(page:Page,doc:Document) {await page.goto('/');const chooser=page.waitForEvent('filechooser');await menu(page,'Open… Ctrl+O');await(await chooser).setFiles({name:'vectors.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);}
async function save(page:Page,path:string) {const download=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();await(await download).saveAs(path);return JSON.parse(await readFile(path,'utf8')) as Document;}
async function exercise(scope:Scope) {
  // Fill geometry and stroke paint are separate SVG layers; both retain their original expectations.
  const curve=widget(scope,'Curved path'),drawing=curve.locator('svg [data-shadow-fill]'),stroke=curve.locator('svg [data-shadow-stroke]');
  await expect(drawing).toHaveAttribute('d','M 0 50 C 0 -25 200 -25 200 50 C 200 125 0 125 0 50 Z');
  await expect(stroke).toHaveAttribute('d','M 0 50 C 0 -25 200 -25 200 50 C 200 125 0 125 0 50 Z');
  await expect(drawing).toHaveAttribute('stroke','none');await expect(stroke).toHaveAttribute('fill','none');await expect(stroke).toHaveAttribute('stroke','#2563eb');
  await expect(curve).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(curve).toHaveCSS('border-top-width','0px');await expect(curve).toHaveCSS('border-radius','0px');await expect(curve).toHaveCSS('overflow','visible');
  await expect(stroke).toHaveAttribute('stroke-width','4');await expect(stroke).toHaveAttribute('vector-effect','non-scaling-stroke');await expect(curve.locator('.widget-text')).toHaveText('Curve <text>');
  await expect(curve.locator('svg')).toHaveCSS('overflow','visible');await expect(curve.locator('.widget-text')).toHaveCSS('overflow','hidden');
  const hole=widget(scope,'Even odd hole').locator('svg [data-shadow-fill]');await expect(hole).toHaveAttribute('fill-rule','evenodd');
  expect(await hole.evaluate(path=>{const shape=path as SVGGeometryElement;return [shape.isPointInFill(new DOMPoint(80,80)),shape.isPointInFill(new DOMPoint(15,15))];})).toEqual([false,true]);
  await expect(widget(scope,'Stored cubic ellipse').locator('svg [data-shadow-fill]')).toHaveAttribute('d','M 90 0 C 140.4 0 180 22 180 50 C 180 78 140.4 100 90 100 C 39.6 100 0 78 0 50 C 0 22 39.6 0 90 0 Z');
  await expect(widget(scope,'Nested triangle').locator('svg [data-shadow-fill]')).toHaveAttribute('d','M 50 0 L 100 60 L 0 60 Z');
  const rows=widget(scope,'Path rows').locator('.repeater-row');await expect(rows).toHaveCount(2);
  await expect(rows.locator('.widget-text')).toHaveText(['Alpha','Beta']);
  await rows.nth(0).locator('.widget').click();await expect(rows.nth(0).locator('svg [data-shadow-fill]')).toHaveAttribute('fill','#ffedd5');await expect(rows.nth(1).locator('svg [data-shadow-fill]')).toHaveAttribute('fill','#e5e7eb');
  await expect(rows.nth(0).locator('svg [data-shadow-fill]')).toHaveAttribute('d','M 65 0 L 130 55 L 0 55 Z');await expect(rows.nth(1).locator('svg [data-shadow-fill]')).toHaveAttribute('d','M 80 0 L 160 65 L 0 65 Z');
  await curve.click();await expect(drawing).toHaveAttribute('fill','#fee2e2');await expect(stroke).toHaveAttribute('stroke','#b91c1c');await expect(stroke).toHaveAttribute('stroke-width','7');await expect(curve).toHaveCSS('color','rgb(127, 29, 29)');
  await widget(scope,'Resize vector').click();await expect(curve).toHaveCSS('left','100px');await expect(curve).toHaveCSS('width','300px');await expect(curve).toHaveCSS('height','180px');
  await expect(drawing).toHaveAttribute('d','M 0 90 C 0 -45 300 -45 300 90 C 300 225 0 225 0 90 Z');await expect(stroke).toHaveAttribute('d','M 0 90 C 0 -45 300 -45 300 90 C 300 225 0 225 0 90 Z');await expect(stroke).toHaveAttribute('stroke-width','7');await expect(curve).toHaveCSS('border-top-width','0px');await expect(curve).toHaveCSS('border-radius','0px');
  await curve.click();await expect(drawing).toHaveAttribute('fill','#dbeafe');await expect(stroke).toHaveAttribute('stroke','#2563eb');await expect(stroke).toHaveAttribute('stroke-width','4');
  await expect(scope.getByRole('alert').filter({hasText:/\S/})).toHaveCount(0);
}

for(const mode of ['preview','offline'] as const)test(`${mode}: cubic vector data, holes, fixed strokes, nested rows and live resize survive saved-file export`,async({page,browser},info)=>{
  page.on('dialog',dialog=>dialog.accept());const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));const doc=fixture();await open(page,doc);
  const saved=info.outputPath('vectors.rea.json');expect(await save(page,saved)).toEqual(doc);
  await menu(page,'New Ctrl+N');const chooser=page.waitForEvent('filechooser');await menu(page,'Open… Ctrl+O');await(await chooser).setFiles(saved);expect(await save(page,info.outputPath('vectors-reopened.rea.json'))).toEqual(doc);
  await mkdir('artifacts',{recursive:true});
  if(mode==='preview'){
    await page.getByTitle('Preview (F5)',{exact:true}).click();await exercise(page.locator('.preview-overlay'));await page.screenshot({path:'artifacts/vector-preview.png'});
    await page.getByRole('button',{name:'Close preview',exact:true}).click();expect(await save(page,info.outputPath('vectors-after-preview.rea.json'))).toEqual(doc);
  }else{
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const html=info.outputPath('vectors.html');await(await download).saveAs(html);
    const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000}});
    try{const exported=await context.newPage(),requests:string[]=[];exported.on('pageerror',error=>errors.push(error.message));exported.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});await exported.goto(pathToFileURL(html).href);await exercise(exported);await exported.screenshot({path:'artifacts/vector-offline.png'});expect(requests).toEqual([]);}finally{await context.close();}
  }
  expect(errors).toEqual([]);
});

test('library and Inspector create and edit cubic nodes without JSON, preserving normalized geometry after moving, scaling and reopening',async({page},info)=>{
  page.on('dialog',dialog=>dialog.accept());await page.goto('/');await page.locator('.widget-library').getByRole('button',{name:'Path',exact:true}).dblclick();
  const inspector=page.getByRole('complementary',{name:'Properties inspector'});await expect(inspector.getByLabel('Path node',{exact:true})).toBeVisible();
  await expect(inspector.getByLabel('Radius',{exact:true})).toHaveCount(0);await expect(inspector.getByLabel('Independent border widths',{exact:true})).toHaveCount(0);
  const set=async(label:string,value:string)=>{const field=inspector.getByLabel(label,{exact:true});await field.fill(value);await field.press('Tab');};
  // Each numeric input is relative to the CURRENT frame. A point commit can
  // reframe all normalized coordinates, but must preserve every other world
  // coordinate. Keep these UI semantics independent of the bounds algorithm.
  const world=(w:Widget):VectorCommand[]=>w.vectorPath!.commands.map(command=>Object.fromEntries(Object.entries(command).map(([key,value])=>[key,typeof value==='number'?(key.startsWith('x')?w.x+value*w.width:w.y+value*w.height):value])) as VectorCommand);
  let step=0;
  const edit=async(action:()=>Promise<unknown>,expected:(commands:VectorCommand[],w:Widget)=>void)=>{
    const before=await save(page,info.outputPath(`node-${step}-before.rea.json`)),w=before.pages[0].widgets[0],commands=world(w);expected(commands,w);
    await action();const after=await save(page,info.outputPath(`node-${step++}-after.rea.json`)),result=after.pages[0].widgets[0],actual=world(result);
    expect(result.vectorPath!.fillRule).toBe(w.vectorPath!.fillRule);
    expect(actual).toHaveLength(commands.length);actual.forEach((command,index)=>{
      expect(Object.keys(command).sort()).toEqual(Object.keys(commands[index]).sort());
      for(const[key,value]of Object.entries(commands[index])){const found=(command as unknown as Record<string,unknown>)[key];if(typeof value==='number')expect(found).toBeCloseTo(value,8);else expect(found).toEqual(value);}
    });
    const restored=structuredClone(after);Object.assign(restored.pages[0].widgets[0],{x:w.x,y:w.y,width:w.width,height:w.height,vectorPath:w.vectorPath});expect(restored).toEqual(before);
    return result;
  };
  const coordinate=async(label:string,key:string,value:number)=>{
    const selected=Number(await inspector.getByLabel('Path node',{exact:true}).inputValue());
    return edit(()=>set(label,String(value)),(commands,w)=>{(commands[selected] as unknown as Record<string,unknown>)[key]=key.startsWith('x')?w.x+value/100*w.width:w.y+value/100*w.height;});
  };
  const button=(name:string)=>inspector.getByRole('button',{name,exact:true}).click();
  await inspector.getByLabel('Path node',{exact:true}).selectOption('1');
  await edit(()=>inspector.getByLabel('Path segment type',{exact:true}).selectOption('C'),commands=>{
    const from=commands[0],to=commands[1];if(from.op==='Z'||to.op==='Z')throw Error('Expected triangle anchors');commands[1]={op:'C',x1:from.x,y1:from.y,x2:to.x,y2:to.y,x:to.x,y:to.y};
  });
  for(const[label,key,value]of [['Control 1 X %','x1',25],['Control 1 Y %','y1',-20],['Control 2 X %','x2',120],['Control 2 Y %','y2',75],['Node X %','x',90],['Node Y %','y',80]] as const)await coordinate(label,key,value);
  await inspector.getByLabel('Path fill rule',{exact:true}).selectOption('evenodd');
  await edit(()=>button('New subpath'),(commands,w)=>{commands.push({op:'M',x:w.x+.25*w.width,y:w.y+.25*w.height});});
  await edit(()=>button('Add line node'),(commands,w)=>{const end=commands.at(-1)!;if(end.op==='Z')throw Error('Expected open subpath');commands.push({op:'L',x:end.x+.1*w.width,y:end.y});});
  await coordinate('Node X %','x',75);await coordinate('Node Y %','y',25);
  await edit(()=>button('Add curve node'),(commands,w)=>{const end=commands.at(-1)!;if(end.op==='Z')throw Error('Expected open subpath');commands.push({op:'C',x1:end.x,y1:end.y-.1*w.height,x2:end.x+.1*w.width,y2:end.y-.1*w.height,x:end.x+.1*w.width,y:end.y});});
  await edit(()=>button('Delete node'),commands=>{commands.pop();});
  const authored=await edit(()=>button('Close subpath'),commands=>{commands.push({op:'Z'});});
  expect(authored.vectorPath!.commands.map(command=>command.op)).toEqual(['M','C','L','Z','M','L','Z']);
  const expected=structuredClone(authored.vectorPath!);expect(expected.fillRule).toBe('evenodd');
  // Ordinary move/resize scales the committed normalized path without rebounding.
  await set('X','170');await set('Y','130');await set('W','240');await set('H','120');await set('Stroke','6');await inspector.getByLabel('Widget text',{exact:true}).fill('Authored curve');
  const saved=info.outputPath('authored-vector.rea.json'),doc=await save(page,saved),path=doc.pages[0].widgets[0];expect(path).toMatchObject({type:'path',x:170,y:130,width:240,height:120,text:'Authored curve',vectorPath:expected,style:{strokeWidth:6}});
  await menu(page,'New Ctrl+N');const chooser=page.waitForEvent('filechooser');await menu(page,'Open… Ctrl+O');await(await chooser).setFiles(saved);expect(await save(page,info.outputPath('authored-vector-reopened.rea.json'))).toEqual(doc);
  await page.getByTitle('Preview (F5)',{exact:true}).click();const displayed=widget(page.locator('.preview-overlay'),path.name);
  const expectedD=expected.commands.map(command=>command.op==='Z'?'Z':command.op==='C'?`C ${command.x1*240} ${command.y1*120} ${command.x2*240} ${command.y2*120} ${command.x*240} ${command.y*120}`:`${command.op} ${command.x*240} ${command.y*120}`).join(' ');
  await expect(displayed.locator('svg [data-shadow-fill]')).toHaveAttribute('d',expectedD);await expect(displayed.locator('svg [data-shadow-stroke]')).toHaveAttribute('stroke-width','6');
});

test('multi-selection edits only the current vector while another path and a text input remain intact',async({page},info)=>{
  page.on('dialog',dialog=>dialog.accept());const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const doc=createDocument();doc.name='Current vector in mixed selection';
  const current=createWidget('path',80,80);current.name='Current triangle';
  const input=createWidget('input',350,80);input.name='Unchanged input';input.text='Keep this literal';
  const other=createWidget('path',660,80);other.name='Other triangle';
  doc.pages[0].widgets=[current,input,other];await open(page,doc);
  await page.locator('.editor-widget').filter({has:page.locator('svg')}).first().click();
  await page.locator('.editor-widget.input').click({modifiers:['Shift']});
  await page.locator('.editor-widget.path').last().click({modifiers:['Shift']});
  await expect(page.locator('.style-toolbar')).toContainText('3 selected');
  const inspector=page.getByRole('complementary',{name:'Properties inspector'});
  await inspector.getByLabel('Path fill rule',{exact:true}).selectOption('evenodd');
  await inspector.getByLabel('Path node',{exact:true}).selectOption('0');
  const node=inspector.getByLabel('Node X %',{exact:true});await node.fill('25');await node.press('Tab');
  await expect(page.locator('.editor-widget.input input')).toHaveValue('Keep this literal');
  await expect(page.locator('.editor-widget.path').last().locator('svg [data-shadow-fill]')).toHaveAttribute('d','M 90 0 L 180 90 L 0 90 Z');
  const saved=info.outputPath('mixed-vector-selection.rea.json'),edited=await save(page,saved);
  expect(edited.pages[0].widgets[0].vectorPath).toEqual({...current.vectorPath,fillRule:'evenodd',commands:[{op:'M',x:.25,y:0},...current.vectorPath!.commands.slice(1)]});
  expect(edited.pages[0].widgets[1]).toEqual(input);expect(edited.pages[0].widgets[1]).not.toHaveProperty('vectorPath');expect(edited.pages[0].widgets[2]).toEqual(other);
  await menu(page,'New Ctrl+N');const chooser=page.waitForEvent('filechooser');await menu(page,'Open… Ctrl+O');await(await chooser).setFiles(saved);
  expect(await save(page,info.outputPath('mixed-vector-selection-reopened.rea.json'))).toEqual(edited);
  await page.getByTitle('Preview (F5)',{exact:true}).click();const preview=page.locator('.preview-overlay');
  await expect(widget(preview,current.name).locator('svg [data-shadow-fill]')).toHaveAttribute('d','M 45 0 L 180 90 L 0 90 Z');
  await expect(widget(preview,other.name).locator('svg [data-shadow-fill]')).toHaveAttribute('d','M 90 0 L 180 90 L 0 90 Z');
  await expect(preview.locator('input[aria-label="Unchanged input"]')).toHaveValue('Keep this literal');
  await preview.locator('input[aria-label="Unchanged input"]').fill('Still editable');await expect(preview.locator('input[aria-label="Unchanged input"]')).toHaveValue('Still editable');
  expect(errors).toEqual([]);
});
