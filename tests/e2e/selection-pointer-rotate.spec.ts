import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDocument, createWidget, serializeDocument } from '../../src/model/document';
import type { Document } from '../../src/model/types';
import nativeFixtures from '../../research/selection-rotation-browser-fixtures.json' with {type:'json'};

const runRoot=path.resolve('.build/selection-rotation-host-e2e',`${Date.now()}-${process.pid}`);
function fixture(){
  const doc=createDocument();doc.name='Selection orbit';doc.pages[0].width=1200;doc.pages[0].height=800;
  doc.pages[0].widgets=(['checkbox','radio'] as const).map((type,index)=>{
    const widget=createWidget(type,index?450:100,300);
    Object.assign(widget,{id:`orbit-${index}`,name:`Orbit ${type}`,text:`${type} label`,width:index?180:240,height:20,
      selectionText:{autoFitWidth:true,autoFitHeight:false,alignRight:false}});
    Object.assign(widget.style,{fontFamily:'monospace',fontSize:16,fontWeight:400,lineHeight:1.25,
      textAlign:'left',verticalAlign:'top',textPadding:[0,0,0,0],selectionButtonSize:14});
    return widget;
  });return doc;
}
async function output(info:TestInfo,name:string){
  const dir=path.join(runRoot,info.testId.replace(/[^a-zA-Z0-9_-]/g,'_'),`retry-${info.retry}`);
  await mkdir(dir,{recursive:true});return path.join(dir,name);
}
async function open(page:Page,doc:Document,info:TestInfo){
  await writeFile(await output(info,'source.rea.json'),serializeDocument(doc));await page.goto('/');
  const chooser=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();
  await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();
  await(await chooser).setFiles({name:'orbit.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('rea-prototype-document-v1'))).toBe(serializeDocument(doc));
  await page.reload();await expect(page.getByTitle('Undo',{exact:true})).toBeDisabled();
  await page.locator('.canvas-surface .editor-widget.checkbox').first().click();await page.keyboard.press('Control+a');
  await expect(page.locator('.selection-group-frame')).toHaveCount(1);
}
async function save(page:Page,info:TestInfo,name:string):Promise<Document>{
  const download=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();
  const file=await output(info,`${name}.rea.json`);await(await download).saveAs(file);return JSON.parse(await readFile(file,'utf8'));
}
async function quarterTurn(page:Page){
  const frame=await page.locator('.selection-group-frame').boundingBox();if(!frame)throw Error('Missing shared frame');
  const scale=Number(await page.getByLabel('Zoom',{exact:true}).inputValue());
  const start={x:frame.x+frame.width,y:frame.y+(frame.height-scale)/2};
  const end={x:frame.x+frame.width/2+scale/2,y:frame.y+frame.height/2+frame.width/2};
  await page.keyboard.down('Control');await page.mouse.move(start.x,start.y);await page.mouse.down();
  await page.mouse.move(end.x,end.y);await page.mouse.up();await page.keyboard.up('Control');
}
async function beginAt(page:Page,down:{x:number;y:number}){
  const surface=await page.locator('.canvas-surface').boundingBox();if(!surface)throw Error('Missing canvas');
  const zoom=Number(await page.getByLabel('Zoom',{exact:true}).inputValue());
  const screen=(p:{x:number;y:number})=>({x:surface.x+p.x*zoom,y:surface.y+p.y*zoom});
  await page.keyboard.down('Control');const at=screen(down);await page.mouse.move(at.x,at.y);await page.mouse.down();
  return async(p:{x:number;y:number})=>{const to=screen(p);await page.mouse.move(to.x,to.y)};
}
async function keys(page:Page,mask:number){
  for(const [key,bit] of [['Control',131072],['Shift',65536],['Alt',262144]] as const)
    await page.keyboard[mask&bit?'down':'up'](key);
}
function expectLocations(actual:Document,expected:Document,rects:{x:number;y:number}[]){
  for(let i=0;i<rects.length;i++)for(const key of ['x','y'] as const){
    expect(actual.pages[0].widgets[i][key]).toBeCloseTo(rects[i][key],8);
    expected.pages[0].widgets[i][key]=actual.pages[0].widgets[i][key];
  }
  expect(actual).toEqual(expected);
}

test('Ctrl multiple selection orbits centers while checkbox and radio keep their orientation and fit flags',async({page},info)=>{
  const doc=fixture();await open(page,doc,info);await quarterTurn(page);
  const actual=await save(page,info,'quarter-turn'),expected=structuredClone(doc);
  Object.assign(expected.pages[0].widgets[0],{x:245,y:155});Object.assign(expected.pages[0].widgets[1],{x:275,y:475});
  for(let i=0;i<2;i++)for(const key of ['x','y'] as const){
    expect(actual.pages[0].widgets[i][key]).toBeCloseTo(expected.pages[0].widgets[i][key],9);
    expected.pages[0].widgets[i][key]=actual.pages[0].widgets[i][key];
  }
  expect(actual).toEqual(expected);await page.screenshot({path:await output(info,'quarter-turn.png')});
  await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'undo')).toEqual(doc);
  await expect(page.getByTitle('Undo',{exact:true})).toBeDisabled();await page.getByTitle('Redo',{exact:true}).click();
  expect(await save(page,info,'redo')).toEqual(actual);
});

for(const source of nativeFixtures.cases)test(`source input/controller composition: ${source.name}`,async({page},info)=>{
  const doc=fixture();if(source.locked)doc.pages[0].widgets[1].locked=true;
  await open(page,doc,info);if(source.grid)await page.getByRole('checkbox',{name:'Snap',exact:true}).check();
  const move=await beginAt(page,source.down);
  for(const frame of source.moves){await keys(page,frame.keys);await move(frame.point)}
  // Release keys alone does not add a controller frame.
  await keys(page,0);await page.mouse.up();await expect(page.locator('.statusbar')).toContainText('Selection rotated');
  const actual=await save(page,info,source.name),expected=structuredClone(doc);
  expectLocations(actual,expected,source.expected.map(w=>w.rect));
  if(source.name==='out-and-back')await expect(page.getByTitle('Undo',{exact:true})).toBeDisabled();
  else{
    await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'undo')).toEqual(doc);
    await expect(page.getByTitle('Undo',{exact:true})).toBeDisabled();await page.getByTitle('Redo',{exact:true}).click();
    expect(await save(page,info,'redo')).toEqual(actual);
  }
  if(source.name==='grid-live-bounds'||source.name==='locked-pivot')await page.screenshot({path:await output(info,`${source.name}.png`)});
});

test('rotation does not wait for font preparation or reject selected-state font overrides',async({page},info)=>{
  const doc=fixture();for(const widget of doc.pages[0].widgets){widget.checked=true;widget.selectedStyle={fontSize:28};}
  await open(page,doc,info);
  await page.evaluate(async()=>{
    await document.fonts.ready;
    // Rendering may request fonts again, but Location-only authoring must
    // finish even while any subsequent font load remains pending.
    document.fonts.load=()=>new Promise<FontFace[]>(()=>{});
  });
  await quarterTurn(page);await expect(page.locator('.statusbar')).toContainText('Selection rotated');
  expectLocations(await save(page,info,'without-font-readiness'),structuredClone(doc),[{x:245,y:155},{x:275,y:475}]);
});

test('rotation writes complete current-view Location pairs despite Affect all views',async({page},info)=>{
  const doc=fixture();doc.pages[0].adaptiveViews=[
    {id:'tablet',name:'Tablet',width:900,overrides:{'orbit-0':{x:100,y:300},'orbit-1':{x:450,y:300}}},
    {id:'phone',name:'Phone',width:600,baseViewId:'tablet',overrides:{'orbit-0':{style:{color:'#456789'}}}},
    {id:'wide',name:'Wide',width:1100,overrides:{'orbit-1':{x:700,y:400}}},
  ];doc.pages[0].adaptiveOverrides={inactive:{'orbit-0':{x:71,y:91,style:{underline:true}}}};
  await open(page,doc,info);await page.getByLabel('Adaptive view',{exact:true}).selectOption('phone');
  await page.locator('.canvas-surface .editor-widget.checkbox').first().click();await page.keyboard.press('Control+a');
  await page.getByLabel('Affect all views',{exact:true}).check();await quarterTurn(page);
  const actual=await save(page,info,'current-view'),expected=structuredClone(doc);
  expected.pages[0].adaptiveViews[1].overrides={'orbit-0':{style:{color:'#456789'},x:245,y:155},'orbit-1':{x:275,y:475}};
  for(const id of ['orbit-0','orbit-1'])for(const key of ['x','y'] as const){
    const value=actual.pages[0].adaptiveViews[1].overrides[id][key]!;
    expect(value).toBeCloseTo(expected.pages[0].adaptiveViews[1].overrides[id][key]!,8);
    expected.pages[0].adaptiveViews[1].overrides[id][key]=value;
  }
  expect(actual).toEqual(expected);await page.getByTitle('Undo',{exact:true}).click();expect(await save(page,info,'undo')).toEqual(doc);
  await expect(page.getByTitle('Undo',{exact:true})).toBeDisabled();
});

for(const cancel of ['Escape','Control+z','Space'] as const)test(`${cancel} cancels an already visible orbit`,async({page},info)=>{
  const doc=fixture();await open(page,doc,info);const move=await beginAt(page,{x:630,y:309.5});
  await keys(page,0);await move({x:365.5,y:575});
  await expect(page.locator('.canvas-surface .editor-widget.checkbox')).toHaveCSS('left','245px');
  await page.keyboard.press(cancel);await page.mouse.up();await keys(page,0);
  expect(await save(page,info,'cancelled')).toEqual(doc);await expect(page.getByTitle('Undo',{exact:true})).toBeDisabled();
});
