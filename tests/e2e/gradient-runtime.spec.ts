import { test, expect, type Page, type Locator } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { gradientFixture } from '../fixtures/gradients';
import { createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Document, GradientFill, Widget } from '../../src/model/types';

function fixture() {
  const doc=gradientFixture(),page=doc.pages[0];page.height=1250;page.background='#ffffff';
  const hard:GradientFill={type:'linear',start:{x:0,y:.5},end:{x:1,y:.5},stops:[{offset:0,color:'#ff0000'},{offset:.5,color:'#ff0000'},{offset:.5,color:'#0000ff'},{offset:1,color:'#0000ff'}]};
  const tile=(id:string,x:number,fill:GradientFill):Widget=>{const w=createWidget('box',x,800);Object.assign(w,{id,name:id,text:'',width:100,height:100});Object.assign(w.style,{fill:'#ff00ff',fillGradient:fill,strokeWidth:0,radius:0});return w;};
  const hardTile=tile('gradient-hard-pixels',50,hard),alpha=tile('gradient-alpha-pixels',190,{...hard,stops:hard.stops.map(stop=>({...stop,color:'#ff000000'}))});
  const vector=tile('gradient-vector-pixels',330,hard);vector.type='path';vector.vectorPath={fillRule:'nonzero',commands:[{op:'M',x:.5,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'Z'}]};
  const radial:GradientFill={type:'radial',center:{x:.5,y:.5},axis1:{x:.5,y:.9},axis2:{x:.7,y:.5},stops:[{offset:0,color:'#ff0000'},{offset:.5,color:'#ff0000'},{offset:.5,color:'#0000ff'},{offset:1,color:'#0000ff'}]};
  const radialTile=tile('gradient-radial-pixels',470,radial),zero=tile('gradient-zero-pixels',610,{...radial,axis1:{...radial.center}}),current=tile('gradient-current-pixels',750,{...hard,stops:hard.stops.map(stop=>({...stop,color:' currentcolor '}))});current.style.color='#123456';
  const quirk=tile('gradient-offset-quirk',890,{type:'linear',start:{x:0,y:.5},end:{x:1,y:.5},stops:[{offset:0,color:'#ff0000'},{offset:1,color:'#0000ff'}]});quirk.type='path';quirk.vectorPath=vector.vectorPath;quirk.mouseOverStyle={fillGradient:{...quirk.style.fillGradient!,stops:[{offset:.2,color:'#00ff00'},{offset:.8,color:'#ffffff'}]}};
  const row=page.widgets.find(w=>w.id==='gradient-repeater')!.repeater!.template[0];row.mouseOverStyle={fillGradient:{...row.style.fillGradient!,stops:row.style.fillGradient!.stops.map(stop=>({...stop,color:'#00ff00'}))}};
  const inset=page.widgets.find(w=>w.id==='gradient-vector')!;inset.style.innerShadow={on:true,offsetX:3,offsetY:2,blurRadius:4,spread:1,color:'#00000080'};
  page.widgets.find(w=>w.id==='gradient-solid')!.interactions[0].actions.push({id:uid(),type:'setStyle',targetId:quirk.id,style:{fill:'#123456'}});
  const inherited=createWidget('panel',50,950);Object.assign(inherited,{id:'gradient-inherited-parent',name:'Inherited gradient context',width:220,height:100});Object.assign(inherited.style,{fill:'transparent',color:'#2456ab',strokeWidth:0});
  const inheritedChild=tile('gradient-inherited-child',10,{...hard,stops:hard.stops.map(stop=>({...stop,color:' currentcolor '}))});inheritedChild.y=10;inheritedChild.width=80;inheritedChild.height=80;inheritedChild.style.color='currentColor';inherited.states![0].widgets=[inheritedChild];
  const colorButton=createWidget('button',310,950);Object.assign(colorButton,{id:'gradient-parent-color',name:'Change inherited color',text:'Change inherited color'});colorButton.interactions=[{id:uid(),name:'Change parent',event:'click',enabled:true,conditions:[],conditionMode:'all',actions:[{id:uid(),type:'setStyle',targetId:inherited.id,style:{color:'#d04020'}}]}];
  const resized=createWidget('repeater',620,970);Object.assign(resized,{id:'gradient-sized-repeater',name:'Sized radial repeater',width:60,height:80});Object.assign(resized.style,{fill:'transparent',strokeWidth:0,fillGradient:{...radial,axis1:{x:1,y:1},axis2:{x:.75,y:.25}}});
  const empty=createWidget('box');Object.assign(empty,{x:0,y:0,width:1,height:1,text:''});Object.assign(empty.style,{fill:'transparent',strokeWidth:0});resized.repeater={columns:['Name'],rows:[{Name:'A'},{Name:'B'}],template:[empty],itemWidth:180,itemHeight:50,layout:'vertical',gap:0,fitToContent:false};
  const reference=tile('gradient-sized-reference',840,structuredClone(resized.style.fillGradient!));reference.y=970;reference.width=180;reference.height=100;
  page.widgets.push(hardTile,alpha,vector,radialTile,zero,current,quirk,inherited,colorButton,resized,reference);return doc;
}
async function open(page:Page,doc:Document){await page.goto('/');const chooser=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await chooser).setFiles({name:'gradients.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);}
async function sample(page:Page,target:Locator,points:number[][]){await target.scrollIntoViewIfNeeded();const b=(await target.boundingBox())!;const bytes=await page.screenshot({clip:{x:b.x,y:b.y,width:b.width,height:b.height}});return page.evaluate(async({base64,points})=>{const image=await createImageBitmap(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:'image/png'})),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d')!;context.drawImage(image,0,0);return points.map(([x,y])=>Array.from(context.getImageData(x,y,1,1).data));},{base64:bytes.toString('base64'),points});}
for(const mode of ['preview','offline'] as const)test(`${mode}: gradients preserve pixel geometry, alpha, SVG state provenance, repeated instances and embedded players`,async({page,browser},info)=>{
  const doc=fixture(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page,doc);
  const authorInherited=page.locator('.editor-widget.panel [data-gradient-context]').locator('..');
  expect(await sample(page,authorInherited,[[40,40]])).toEqual([[36,86,171,255]]);
  await page.locator('.editor-widget.panel').filter({has:page.locator('[data-gradient-context]')}).click({position:{x:180,y:50}});
  await page.getByRole('complementary',{name:'Properties inspector'}).getByLabel('Color',{exact:true}).fill('#d04020');expect(await sample(page,authorInherited,[[40,40]])).toEqual([[208,64,32,255]]);
  await page.getByTitle('Undo',{exact:true}).click();expect(await sample(page,authorInherited,[[40,40]])).toEqual([[36,86,171,255]]);
  const points=[[90,50],[125,70],[90,85],[20,80]];
  expect(await sample(page,page.locator('.editor-widget.repeater').last(),points)).toEqual(await sample(page,page.locator('.editor-widget.box').last(),points));
  let player=page,context:Awaited<ReturnType<typeof browser.newContext>>|undefined;
  if(mode==='preview')await page.getByTitle('Preview (F5)',{exact:true}).click();else{const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('gradients.html');await(await pending).saveAs(file);context=await browser.newContext({offline:true,viewport:{width:1600,height:1200},deviceScaleFactor:1});player=await context.newPage();player.on('pageerror',e=>errors.push(e.message));await player.goto(pathToFileURL(file).href);}
  try{
    const scope=mode==='preview'?player.locator('.preview-overlay'):player.locator('main').first(),w=(id:string)=>scope.locator(`[data-widget-id="${id}"]`);
    await expect(w('gradient-linear')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(w('gradient-linear')).toHaveCSS('background-image',/data:image\/svg\+xml/);
    await expect(w('gradient-child')).toHaveCSS('background-image','none');await expect(w('gradient-child')).toHaveCSS('background-color','rgb(255, 255, 255)');
    await expect(w('gradient-vector').locator('linearGradient')).toHaveCount(1);await expect(w('gradient-vector').locator('filter')).toHaveCount(1);await expect(w('gradient-vector').locator('[data-shadow-fill]')).toHaveAttribute('fill',/^url\(#rea-gradient-/);
    const rows=w('gradient-row');await expect(rows).toHaveCount(2);const ids=await rows.locator('linearGradient').evaluateAll(nodes=>nodes.map(node=>node.id));expect(new Set(ids).size).toBe(2);
    await rows.nth(0).hover();await expect(rows.nth(0).locator('stop').first()).toHaveAttribute('stop-color','#00ff00');await expect(rows.nth(1).locator('stop').first()).toHaveAttribute('stop-color','#2668ec');await w('gradient-heading').hover();
    expect(await sample(player,w('gradient-hard-pixels'),[[25,50],[75,50]])).toEqual([[255,0,0,255],[0,0,255,255]]);
    expect(await sample(player,w('gradient-alpha-pixels'),[[25,50],[75,50]])).toEqual([[255,255,255,255],[255,255,255,255]]);
    expect(await sample(player,w('gradient-vector-pixels'),[[5,5],[25,80],[75,80]])).toEqual([[255,255,255,255],[255,0,0,255],[0,0,255,255]]);
    expect(await sample(player,w('gradient-radial-pixels'),[[50,50],[50,62],[62,50]])).toEqual([[255,0,0,255],[255,0,0,255],[0,0,255,255]]);
    expect(await sample(player,w('gradient-zero-pixels'),[[50,50]])).toEqual([[255,255,255,255]]);expect(await sample(player,w('gradient-current-pixels'),[[50,50]])).toEqual([[18,52,86,255]]);
    expect(await sample(player,w('gradient-inherited-child'),[[40,40]])).toEqual([[36,86,171,255]]);await w('gradient-parent-color').click();expect(await sample(player,w('gradient-inherited-child'),[[40,40]])).toEqual([[208,64,32,255]]);
    await expect(w('gradient-sized-repeater')).toHaveCSS('width','180px');await expect(w('gradient-sized-repeater')).toHaveCSS('height','100px');expect(await sample(player,w('gradient-sized-repeater'),points)).toEqual(await sample(player,w('gradient-sized-reference'),points));
    await w('gradient-offset-quirk').hover();await expect(w('gradient-offset-quirk').locator('stop').first()).toHaveAttribute('offset','0');await expect(w('gradient-offset-quirk').locator('stop').first()).toHaveAttribute('stop-color','#00ff00');
    await player.screenshot({path:info.outputPath(`gradients-${mode}.png`),fullPage:true});
    await w('gradient-solid').click();await expect(w('gradient-linear')).toHaveCSS('background-image','none');await expect(w('gradient-linear')).toHaveCSS('background-color','rgb(217, 226, 242)');await expect(w('gradient-vector').locator('linearGradient')).toHaveCount(0);await expect(w('gradient-vector').locator('filter')).toHaveCount(1);
    await w('gradient-offset-quirk').hover();await expect(w('gradient-offset-quirk').locator('stop').first()).toHaveAttribute('offset','0.2');
    await w('gradient-restore').click();await expect(w('gradient-linear')).toHaveCSS('background-image',/data:image\/svg\+xml/);await expect(w('gradient-vector').locator('linearGradient')).toHaveCount(1);
    await (mode==='preview'?scope:player).getByRole('button',{name:'Embedded comparison',exact:true}).click();const frame=player.frameLocator('[data-inline-frame="gradient-frame"]');await expect(frame.locator('[data-widget-id="gradient-linear"]')).toHaveCSS('background-image',/data:image\/svg\+xml/);await expect(frame.locator('[data-widget-id="gradient-vector"] linearGradient')).toHaveCount(1);await frame.locator('[data-widget-id="gradient-solid"]').click();await expect(frame.locator('[data-widget-id="gradient-linear"]')).toHaveCSS('background-image','none');
  }finally{await context?.close();}
  if(mode==='preview')await page.getByRole('button',{name:'Close preview',exact:true}).click();const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const saved=info.outputPath('after.rea.json');await(await pending).saveAs(saved);expect(JSON.parse(await readFile(saved,'utf8'))).toEqual(doc);expect(errors).toEqual([]);
});
