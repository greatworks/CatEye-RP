import { chromium, expect, test, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Interaction } from '../../src/model/types';
import { exerciseRepeaterRows, ROW_BOX } from '../../scripts/repeater-row-scenario.mjs';

type Step=Omit<Action,'id'>;
const event=(actions:Step[],trigger:Interaction['event']='click'):Interaction=>({id:uid(),event:trigger,name:trigger,enabled:true,isNewIfGroup:true,conditionMode:'all',conditions:[],actions:actions.map(action=>({...action,id:uid()}))});
function fixture(){
  const doc=createDocument();doc.name='Fractional repeater rows and native geometry';doc.caseSelection='never';doc.variables={};
  doc.pages[0].width=1280;doc.pages[0].height=780;doc.pages[0].background='#f5f7fc';
  const text=(name:string,value:string,x:number,y:number,width=580,height=44,size=14)=>{const w=createWidget('text',x,y);Object.assign(w,{name,text:value,width,height});Object.assign(w.style,{textPadding:[0,0,0,0],lineHeight:1.25,fontSize:size,color:'#26334d'});return w;};
  const button=(name:string,value:string,x:number,y:number,width:number,actions:Step[],height=34)=>{const w=createWidget('button',x,y);Object.assign(w,{name,text:value,width,height,interactions:[event(actions)]});Object.assign(w.style,{textPadding:[0,0,0,0],fontSize:12,lineHeight:'normal',fill:'#e7efff',stroke:'#7795c7',color:'#173866',radius:4});return w;};
  const heading=text('Heading','Fractional rows: CSS assignments and geometry caches',32,24,1200,48,27);heading.style.fontWeight=600;
  doc.pages[0].widgets=[heading,text('Instructions','Trim a nonmaximal row, grow it twice, grow later groups, then restore and refresh. Geometry logs read native This values.',32,82,1210,44,15)];
  for(const direction of ['vertical','horizontal'] as const){
    const x=direction==='vertical'?32:696,prefix=direction==='vertical'?'Vertical':'Horizontal',counter=`${prefix}Events`,loads=`${prefix}Loads`;doc.variables[counter]='0';doc.variables[loads]='';
    const resizeLog=text(`${direction} resize log`,'No resize yet',x,482,552,90,13),loadLog=text(`${direction} load log`,'Waiting for rows',x,584,552,58,13),rootLog=text(`${direction} root log`,'Inspect root geometry',x,652,552,32,13);
    const list=createWidget('repeater',x,186);list.name=`${direction} fractional records`;Object.assign(list.style,{fill:'#edf3ff',stroke:'#3560a8',borderWidths:[...ROW_BOX.borders],radius:0});
    list.repeater={columns:['Name'],rows:'ABCDE'.split('').map(Name=>({Name})),template:[],itemWidth:ROW_BOX.width,itemHeight:ROW_BOX.height,gap:0,layout:direction,wrap:ROW_BOX.wrap,horizontalGap:ROW_BOX.gapX,verticalGap:ROW_BOX.gapY,padding:[...ROW_BOX.padding] as [number,number,number,number],fitToContent:false};
    list.interactions=[event([{type:'setVariable',targetId:loads,value:`[[${loads}]][[Item.Name]]:[[This.width]],[[This.height]]|`},{type:'setText',targetId:loadLog.id,value:`Loaded [[${loads}]]`}],'itemLoad'),event([
      {type:'setVariable',targetId:counter,value:`[[${counter}+1]]`},
      {type:'setText',targetId:resizeLog.id,value:`Resize [[${counter}]]: [[Item.Name]]|[[This.x]]|[[This.y]]|[[This.width]]|[[This.height]]|[[Item.Repeater.width]]|[[Item.Repeater.height]]`},
    ],'itemResize')];
    const label=text('Row identity','Row [[Item.Name]]',5,2,120,16,11);
    const grow=button('Grow fractional row','Grow',5,21,38,[{type:'resizeItem',targetId:list.id,x:ROW_BOX.growWidth,y:ROW_BOX.growHeight}],20);
    const restore=button('Restore fractional row','Reset',47,21,40,[{type:'resizeItem',targetId:list.id,x:ROW_BOX.width,y:ROW_BOX.height}],20);
    const trim=button('Trim cross axis','Trim',91,21,38,[{type:'resizeItem',targetId:list.id,...(direction==='vertical'?{x:ROW_BOX.trimWidth}:{y:ROW_BOX.trimHeight})}],20);
    grow.style.fontSize=restore.style.fontSize=trim.style.fontSize=10;list.repeater.template=[label,grow,restore,trim];
    doc.pages[0].widgets.push(text(`${direction} title`,`${prefix} · 2 items per ${direction==='vertical'?'column':'row'}`,x,142,552,34,19),list,resizeLog,loadLog,rootLog,
      button(`Inspect ${direction} root`,'Read root cache',x,710,170,[{type:'setText',targetId:list.id,value:'Root [[Target.width]]|[[Target.height]]'},{type:'setText',targetId:rootLog.id,value:`[[Widget.${list.id}.text]]`}]),
      button(`Refresh ${direction} rows`,'Refresh · reverse order',x+190,710,220,[{type:'setVariable',targetId:loads,value:''},{type:'sortRows',targetId:list.id,value:'Name:desc'}]));
  }
  return doc;
}
async function menu(page:Page,name:string){await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name,exact:true}).click();}
async function save(page:Page,path:string){const pending=page.waitForEvent('download');await page.getByTitle('Save',{exact:true}).click();await(await pending).saveAs(path);return JSON.parse(await readFile(path,'utf8'));}

for(const mode of ['preview','offline','offline-host-1.5'] as const)test(`${mode}: fractional row CSS, native geometry, wrapped pushes and refresh`,async({page,browser},info)=>{
  page.on('dialog',dialog=>dialog.accept());
  const doc=fixture(),json=serializeDocument(doc),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
  const chooser=page.waitForEvent('filechooser');await menu(page,'Open… Ctrl+O');await(await chooser).setFiles({name:'repeater-row-demo.rea.json',mimeType:'application/json',buffer:Buffer.from(json)});await expect(page.locator('.titlebar')).toContainText(doc.name);
  const savedPath=info.outputPath('row-saved.rea.json');expect(await save(page,savedPath)).toEqual(doc);
  await menu(page,'New Ctrl+N');const reopened=page.waitForEvent('filechooser');await menu(page,'Open… Ctrl+O');await(await reopened).setFiles(savedPath);await expect(page.locator('.titlebar')).toContainText(doc.name);expect(await save(page,info.outputPath('row-reopened.rea.json'))).toEqual(doc);
  await mkdir('artifacts',{recursive:true});
  if(mode==='preview'){
    await writeFile('artifacts/repeater-row-demo.rea.json',await readFile(savedPath));await page.getByTitle('Preview (F5)',{exact:true}).click();await exerciseRepeaterRows(page.locator('.preview-overlay'));
    await page.screenshot({path:info.outputPath('repeater-row-preview.png')});await page.screenshot({path:'artifacts/repeater-row-preview.png'});
    await page.getByRole('button',{name:'Close preview',exact:true}).click();expect(await save(page,info.outputPath('row-after-preview.rea.json'))).toEqual(doc);
  }else{
    const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();const html=info.outputPath('repeater-row.html');await(await pending).saveAs(html);
    const forced=mode==='offline-host-1.5'?await chromium.launch({channel:'msedge',headless:true,args:['--force-device-scale-factor=1.5','--window-size=2400,1650']}):undefined;
    let context:Awaited<ReturnType<typeof browser.newContext>>|undefined;
    try{
      context=await(forced??browser).newContext({offline:true,viewport:forced?null:{width:1600,height:1100},...(forced?{deviceScaleFactor:undefined,isMobile:undefined}:{})});const exported=await context.newPage(),requests:string[]=[];
      exported.on('pageerror',error=>errors.push(error.message));exported.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});await exported.goto(pathToFileURL(html).href);
      if(forced){expect(await exported.evaluate(()=>devicePixelRatio)).toBe(1.5);await expect(exported.locator('.widget[aria-label="vertical fractional records"]')).toHaveCSS('border-right-width','4.66667px');}
      await exerciseRepeaterRows(exported);const filename=forced?'repeater-row-offline-host-1p5.png':'repeater-row-offline.png';await exported.screenshot({path:info.outputPath(filename),fullPage:true});await exported.screenshot({path:'artifacts/'+filename,fullPage:true});expect(requests).toEqual([]);
    }finally{await context?.close();await forced?.close();}
    expect(await save(page,info.outputPath('row-after-export.rea.json'))).toEqual(doc);
  }
  expect(errors).toEqual([]);
});
