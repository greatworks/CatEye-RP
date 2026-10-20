import { chromium, expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDocument, createWidget, serializeDocument, uid } from '../../src/model/document';
import type { Action, Interaction, Widget } from '../../src/model/types';
import { exerciseRepeaterBox } from '../../scripts/repeater-box-scenario.mjs';

type Step = Omit<Action,'id'>;
const event = (actions: Step[], trigger: Interaction['event']='click'): Interaction => ({id:uid(),event:trigger,name:trigger,enabled:true,isNewIfGroup:true,
  conditionMode:'all',conditions:[],actions:actions.map(action=>({...action,id:uid()}))});

function fixture() {
  const doc=createDocument();doc.name='Repeater borders, padding and live geometry';doc.caseSelection='never';doc.variables={ResizeEvents:'0'};
  doc.pages[0].width=1140;doc.pages[0].height=830;doc.pages[0].background='#f4f7fb';
  const text=(name:string,value:string,x:number,y:number,width=1000,height=36,size=15)=>{
    const w=createWidget('text',x,y);Object.assign(w,{name,text:value,width,height});Object.assign(w.style,{textPadding:[0,0,0,0],fontSize:size,color:'#26334d',lineHeight:1.3});return w;
  };
  const button=(name:string,value:string,x:number,y:number,width:number,actions:Step[],height=38)=>{
    const w=createWidget('button',x,y);Object.assign(w,{name,text:value,width,height,interactions:[event(actions)]});
    Object.assign(w.style,{fill:'#e7efff',stroke:'#6c88be',color:'#193b76',textPadding:[0,0,0,0],fontSize:13,lineHeight:'normal',radius:5});return w;
  };
  const card=(name:string,x:number,y:number,width:number,height:number)=>{
    const w=createWidget('box',x,y);Object.assign(w,{name,text:'',width,height});Object.assign(w.style,{fill:'#ffffff',stroke:'#d9e1ed',strokeWidth:1,radius:12});return w;
  };
  const thisRow=text('This row log','Waiting for row load',65,310,480,36,14);
  const resizeLog=text('Resize event log','Resize events: 0',65,352,460,28,14);
  const emptyThis=text('Empty This log','Waiting for empty load',650,288,420,36,14);
  const targetLog=text('Target repeater log','Inspect to read live repeater geometry',650,334,420,56,14);
  const repeater=(name:string,x:number,y:number):Widget=>{
    const w=createWidget('repeater',x,y);w.name=name;w.width=110;w.height=36;
    Object.assign(w.style,{fill:'#eef4ff',stroke:'#3560a8',strokeWidth:1,borderWidths:[3,5,7,2],radius:0});
    w.repeater={columns:['Name'],rows:[{Name:'A'}],template:[],itemWidth:100,itemHeight:20,gap:0,layout:'vertical',horizontalGap:8,verticalGap:4,padding:[7,4,9,6],fitToContent:false};return w;
  };
  const main=repeater('Bordered records',80,225),empty=repeater('Empty bordered records',650,225);
  const rowStatus:Step={type:'setText',targetId:thisRow.id,value:'This row [[This.width]]×[[This.height]] | Item.Repeater [[Item.Repeater.width]]×[[Item.Repeater.height]]'};
  main.interactions=[event([rowStatus],'itemLoad'),event([
    {type:'setVariable',targetId:'ResizeEvents',value:'[[ResizeEvents + 1]]'},rowStatus,
    {type:'setText',targetId:resizeLog.id,value:'Resize events: [[ResizeEvents]]'},
  ],'itemResize')];
  const grow=button('Grow bordered row','Grow',3,2,42,[{type:'resizeItem',targetId:main.id,x:130,y:35}],16);
  const reset=button('Reset bordered row','Reset',53,2,44,[{type:'resizeItem',targetId:main.id,x:100,y:20}],16);
  grow.style.fontSize=reset.style.fontSize=10;grow.style.radius=reset.style.radius=2;
  main.repeater!.template=[grow,reset];
  Object.assign(empty.repeater!,{rows:[],wrap:2,padding:[1,1,1,1]});
  // Initial zero rows do not synthesize Item Loaded; read the actual repeater on Loaded.
  empty.interactions=[event([{type:'setText',targetId:emptyThis.id,value:'This raw [[This.width]]×[[This.height]] | no DOM rows'}],'load')];
  const geometryThis=text('This geometry log','Click the target to read This geometry',65,690,990,32,15);
  const geometryTarget=text('Target geometry log','Move + resize to read Target geometry',65,734,990,32,15);
  const target=button('Live geometry target','Read This geometry',65,590,160,[{type:'setText',targetId:geometryThis.id,value:'This x=[[This.x]], y=[[This.y]], width=[[This.width]], height=[[This.height]]'}],42);
  const move=button('Move and resize geometry target','Move + resize target',650,590,230,[
    {type:'move',targetId:target.id,x:290,y:590},{type:'resize',targetId:target.id,x:190,y:64},
    {type:'setText',targetId:target.id,value:'Target x=[[Target.x]], y=[[Target.y]], width=[[Target.width]], height=[[Target.height]]'},
    {type:'setText',targetId:geometryTarget.id,value:`[[Widget.${target.id}.text]]`},
  ]);
  const heading=text('Heading','Borders, padding and live geometry',40,25,1060,48,29);heading.style.fontWeight=600;
  doc.pages[0].widgets=[card('Row layout card',40,132,525,335),card('Empty layout card',615,132,485,335),card('Live geometry card',40,496,1060,305),heading,
    text('Introduction','Grow → reset keeps native border accumulation. Refresh restores the original box.',40,84,1050,30,16),
    text('Row title','1. Row size and border accumulation',65,150,480,35,19),
    text('Row details','Padding T7 R4 B9 L6 · Border T3 R5 B7 L2',65,186,480,28,13),main,
    text('Row position','Row origin: padding − computed border',245,225,290,50,13),thisRow,resizeLog,
    button('Refresh bordered records','Refresh and clear accumulation',65,404,280,[{type:'removeFilter',targetId:main.id,value:'{"all":true}'}]),
    text('Empty title','2. Empty raw size and visible box',640,150,430,35,19),
    text('Empty details','Wrapped, no rows · padding 1 · gaps 8 / 4',640,186,440,28,13),empty,
    text('Empty explanation','CSS box follows display scaling\nRaw geometry: −6 × −2',684,218,360,56,14),emptyThis,targetLog,
    button('Inspect repeater geometry','Read Target repeater sizes',650,404,280,[
      {type:'setText',targetId:main.id,value:'Target root [[Target.width]]×[[Target.height]]'},
      {type:'setText',targetId:empty.id,value:'Target empty [[Target.width]]×[[Target.height]]'},
      {type:'setText',targetId:targetLog.id,value:`[[Widget.${main.id}.text]] | [[Widget.${empty.id}.text]]`},
    ]),
    text('Geometry title','3. This and Target follow current position and size',65,516,990,35,19),
    text('Geometry instructions','Click the target, move + resize it, then click it again. The logs read live geometry.',65,553,990,26,14),target,move,geometryThis,geometryTarget];
  return doc;
}

for(const mode of ['preview','offline','offline-host-1.5'] as const)test(`${mode}: repeater border box, raw empty size and live This/Target geometry`,async({page,browser},info)=>{
  const doc=fixture(),json=serializeDocument(doc),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');const chooser=page.waitForEvent('filechooser');
  await page.locator('.menubar').getByRole('button',{name:'File',exact:true}).click();await page.locator('.dropdown-menu').getByRole('button',{name:/^Open…/}).click();
  await(await chooser).setFiles({name:'repeater-box-demo.rea.json',mimeType:'application/json',buffer:Buffer.from(json)});
  await expect(page.locator('.titlebar')).toContainText(doc.name);
  await mkdir('artifacts',{recursive:true});
  if(mode==='preview'){
    await writeFile('artifacts/repeater-box-demo.rea.json',json);
    await page.getByTitle('Preview (F5)',{exact:true}).click();await exerciseRepeaterBox(page.locator('.preview-overlay'));
    await page.screenshot({path:info.outputPath('repeater-box-preview.png')});await page.screenshot({path:'artifacts/repeater-box-preview.png'});
  }else{
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export HTML',exact:true}).click();
    const htmlPath=info.outputPath('repeater-box.html');await(await download).saveAs(htmlPath);
    // CDP deviceScaleFactor emulation does not reproduce host border rounding.
    const forcedBrowser=mode==='offline-host-1.5'?await chromium.launch({channel:'msedge',headless:true,args:['--force-device-scale-factor=1.5','--window-size=2400,1650']}):undefined;
    let context:Awaited<ReturnType<typeof browser.newContext>>|undefined;
    try{
      // Clear the runner's Desktop Edge emulation defaults for the host-scale case.
      context=await(forcedBrowser??browser).newContext({offline:true,viewport:forcedBrowser?null:{width:1600,height:1100},...(forcedBrowser?{deviceScaleFactor:undefined,isMobile:undefined}:{})});
      const exported=await context.newPage(),requests:string[]=[];exported.on('pageerror',error=>errors.push(error.message));
      exported.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
      await exported.goto(pathToFileURL(htmlPath).href);
      if(forcedBrowser){
        expect(await exported.evaluate(()=>devicePixelRatio)).toBe(1.5);
        // Prove this is host-scale rounding, not only a DPR value override.
        await expect(exported.locator('.widget[aria-label="Empty bordered records"]')).toHaveCSS('border-right-width','4.66667px');
      }
      await exerciseRepeaterBox(exported);
      const filename=forcedBrowser?'repeater-box-offline-host-1p5.png':'repeater-box-offline.png';
      await exported.screenshot({path:info.outputPath(filename),fullPage:true});await exported.screenshot({path:'artifacts/'+filename,fullPage:true});expect(requests).toEqual([]);
    }finally{await context?.close();await forcedBrowser?.close();}
  }
  expect(errors).toEqual([]);
});
