import { test, expect, type Page, type Locator } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { shadowFixture } from '../fixtures/shadows';
import { createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Document, Widget } from '../../src/model/types';

function fixture() {
  const doc=shadowFixture(),page=doc.pages[0];page.height=1000;page.background='#ffffff';
  const vector=(id:string,x:number,y:number):Widget=>{
    const w=createWidget('path',x,y);Object.assign(w,{id,name:id,text:'',width:80,height:80});w.vectorPath={fillRule:'nonzero',commands:[{op:'M',x:.5,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'Z'}]};
    Object.assign(w.style,{fill:'#0050c8',strokeWidth:0,outerShadow:{on:true,offsetX:20,offsetY:0,blurRadius:0,color:'#ff0000'}});return w;
  };
  const pixel=vector('shadow-pixels',700,760),clip=createWidget('panel',850,760);Object.assign(clip,{id:'shadow-clipping',width:100,height:90});Object.assign(clip.style,{strokeWidth:0,fill:'#ffffff'});const clipped=vector('shadow-clipped',20,0);clip.states![0].widgets=[clipped];
  const inner=vector('shadow-inner-pixels',540,760);inner.vectorPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'Z'}]};Object.assign(inner.style,{fill:'#ffffff',outerShadow:{...inner.style.outerShadow!,on:false},innerShadow:{on:true,offsetX:10,offsetY:0,blurRadius:0,color:'#000000',spread:0}});
  const row=page.widgets.find(w=>w.id==='shadow-repeater')!.repeater!.template[0];row.vectorPath=pixel.vectorPath;row.style.innerShadow={...inner.style.innerShadow!};row.mouseOverStyle={innerShadow:{...row.style.innerShadow,offsetX:15}};
  for(const id of ['shadow-off','shadow-on']) { const on=id==='shadow-on',button=page.widgets.find(w=>w.id===id)!;for(const w of [pixel,inner,clipped,row]) for(const field of ['outerShadow','innerShadow'] as const) if(w.style[field])button.interactions[0].actions.push({id:uid(),type:'setStyle',targetId:w.id,style:{[field]:{...w.style[field],on}}}); }
  page.widgets.push(pixel,clip,inner);return doc;
}
async function open(page:Page,doc:Document){await page.goto('/');const chooser=page.waitForEvent('filechooser');await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:'Open… Ctrl+O',exact:true}).click();await(await chooser).setFiles({name:'shadows.rea.json',mimeType:'application/json',buffer:Buffer.from(serializeDocument(doc))});await expect(page.locator('.titlebar')).toContainText(doc.name);}
async function sample(page:Page,target:Locator,points:number[][],extra=40){await target.scrollIntoViewIfNeeded();const b=(await target.boundingBox())!;const bytes=await page.screenshot({clip:{x:b.x,y:b.y,width:b.width+extra,height:b.height+10}});return page.evaluate(async({base64,points})=>{const image=await createImageBitmap(new Blob([Uint8Array.from(atob(base64),char=>char.charCodeAt(0))],{type:'image/png'})),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);return points.map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));},{base64:bytes.toString('base64'),points});}
for(const mode of ['preview','offline'] as const)test(`${mode}: independent shadow paints survive state changes, row instances, clipping and embedded pages`,async({page,browser},info)=>{
  const doc=fixture(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page,doc);
  let player=page,context:Awaited<ReturnType<typeof browser.newContext>>|undefined;
  if(mode==='preview')await page.getByTitle('Preview (F5)',{exact:true}).click();
  else{const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('shadows.html');await(await pending).saveAs(file);context=await browser.newContext({offline:true,viewport:{width:1600,height:1100},deviceScaleFactor:1});player=await context.newPage();player.on('pageerror',e=>errors.push(e.message));await player.goto(pathToFileURL(file).href);}
  try{
    const scope=mode==='preview'?player.locator('.preview-overlay'):player.locator('main').first(),w=(id:string)=>scope.locator(`[data-widget-id="${id}"]`);
    await expect(w('shadow-card')).toHaveCSS('box-shadow',/8px 9px 6px 0px/);await expect(w('shadow-inset')).toHaveCSS('box-shadow',/inset/);
    await expect(w('shadow-lettering').locator('.widget-text')).toHaveCSS('text-shadow',/2px 3px 1px/);await expect(w('shadow-child').locator('.widget-text')).toHaveCSS('text-shadow','none');
    await expect(w('shadow-vector')).toHaveCSS('filter','none');await expect(w('shadow-vector').locator('svg.widget-vector')).toHaveCSS('filter',/drop-shadow/);
    await expect(w('shadow-vector').locator('feGaussianBlur')).toHaveAttribute('stdDeviation','3.5');await expect(w('shadow-vector').locator('[data-shadow-stroke]')).not.toHaveAttribute('filter');
    await w('shadow-card').hover();await expect(w('shadow-card')).toHaveCSS('box-shadow',/-8px 12px 14px/);await w('shadow-heading').hover();await expect(w('shadow-card')).toHaveCSS('box-shadow',/8px 9px 6px/);
    await w('shadow-input').locator('input').focus();await expect(w('shadow-input').locator('input')).toHaveCSS('text-shadow','none');await w('shadow-input').locator('input').blur();await expect(w('shadow-input').locator('input')).toHaveCSS('text-shadow',/2px 3px 1px/);
    const rows=w('shadow-row');await expect(rows).toHaveCount(2);const ids=await rows.locator('filter').evaluateAll(nodes=>nodes.map(node=>node.id));expect(new Set(ids).size).toBe(2);
    await rows.nth(0).hover();await expect(rows.nth(0).locator('feOffset')).toHaveAttribute('dx','15');await expect(rows.nth(1).locator('feOffset')).toHaveAttribute('dx','10');await w('shadow-heading').hover();
    expect(await sample(player,w('shadow-pixels'),[[90,70],[105,10]])).toEqual([[255,0,0,255],[255,255,255,255]]);
    expect(await sample(player,w('shadow-clipping'),[[110,70]],30)).toEqual([[255,255,255,255]]);
    expect(await sample(player,w('shadow-inner-pixels'),[[4,40],[40,40]])).toEqual([[0,0,0,255],[255,255,255,255]]);
    await player.screenshot({path:info.outputPath(`shadows-${mode}.png`),fullPage:true});
    await w('shadow-off').click();await expect(w('shadow-card')).toHaveCSS('box-shadow','none');await expect(w('shadow-lettering').locator('.widget-text')).toHaveCSS('text-shadow','none');await expect(w('shadow-vector').locator('svg')).toHaveCSS('filter','none');await expect(w('shadow-vector').locator('filter')).toHaveCount(0);
    expect(await sample(player,w('shadow-pixels'),[[90,70]])).toEqual([[255,255,255,255]]);expect(await sample(player,w('shadow-inner-pixels'),[[4,40]])).toEqual([[255,255,255,255]]);
    await w('shadow-on').click();await expect(w('shadow-card')).toHaveCSS('box-shadow',/8px 9px 6px/);await expect(w('shadow-vector').locator('filter')).toHaveCount(1);
    await (mode==='preview'?scope:player).getByRole('button',{name:'Embedded comparison',exact:true}).click();const embedded=player.frameLocator('iframe[data-inline-frame="shadow-frame"]');await expect(embedded.locator('[data-widget-id="shadow-card"]')).toHaveCSS('box-shadow',/8px 9px 6px/);await expect(embedded.locator('[data-widget-id="shadow-vector"] svg')).toHaveCSS('filter',/drop-shadow/);await embedded.locator('[data-widget-id="shadow-off"]').click();await expect(embedded.locator('[data-widget-id="shadow-vector"] svg')).toHaveCSS('filter','none');
  }finally{await context?.close();}
  if(mode==='preview')await page.getByRole('button',{name:'Close preview',exact:true}).click();const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();const saved=info.outputPath('after.rea.json');await(await pending).saveAs(saved);expect(JSON.parse(await readFile(saved,'utf8'))).toEqual(doc);expect(errors).toEqual([]);
});

test('downloaded prototype runs on an ordinary insecure HTTP origin without randomUUID',async({page,browser},info)=>{
  const address=Object.values(networkInterfaces()).flat().find(item=>item?.family==='IPv4'&&!item.internal)?.address;
  test.skip(!address,'A non-loopback local IPv4 address is needed to exercise an actual insecure HTTP origin.');
  await open(page,fixture());const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const file=info.outputPath('http-shadows.html');await(await pending).saveAs(file);const html=await readFile(file);
  const server=createServer((req,res)=>{if(req.url==='/shadows.html'){res.writeHead(200,{'content-type':'text/html;charset=utf-8'});res.end(html);}else{res.writeHead(404);res.end();}});
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,address!,resolve);});
  const port=(server.address() as {port:number}).port,context=await browser.newContext({viewport:{width:1600,height:1100}}),errors:string[]=[];
  try{const player=await context.newPage();player.on('pageerror',e=>errors.push(e.message));await player.goto(`http://${address}:${port}/shadows.html`);
    const capabilities=await player.evaluate(()=>({secureContext:isSecureContext,randomUUID:typeof crypto.randomUUID,getRandomValues:typeof crypto.getRandomValues}));expect(capabilities).toEqual({secureContext:false,randomUUID:'undefined',getRandomValues:'function'});
    await expect(player.locator('[data-widget-id="shadow-card"]')).toHaveCSS('box-shadow',/8px 9px 6px/);await player.locator('[data-widget-id="shadow-off"]').click();await expect(player.locator('[data-widget-id="shadow-card"]')).toHaveCSS('box-shadow','none');
    await player.getByRole('button',{name:'Embedded comparison',exact:true}).click();const frame=player.frameLocator('[data-inline-frame="shadow-frame"]');await expect(frame.locator('[data-widget-id="shadow-vector"] svg')).toHaveCSS('filter',/drop-shadow/);
    await info.attach('http-origin-capabilities',{body:JSON.stringify(capabilities,null,2),contentType:'application/json'});expect(errors).toEqual([]);
  }finally{await context.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
