import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createDocument, createWidget, uid } from '../src/model/document.ts';
import { createOfflineRuntime } from '../src/runtime/export-runtime.ts';
import { createBrowserBoxReader } from '../src/runtime/browser-box.ts';
import { evaluateExpression } from '../src/runtime/expressions.ts';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const event=actions=>({id:uid(),name:'Test',event:'click',enabled:true,conditionMode:'all',conditions:[],actions:actions.map(a=>({id:uid(),...a}))});
const report={verifiedAt:new Date().toISOString(),method:'Serialized product runtime in actual Edge host 1 and 1.5, compared with previously recorded native function results. Exact CSS strings, nominal sizes, geometry and movement caches, event counts, refresh.',sourceFiles:{},environments:[],originalGuiCompared:false};
for(const file of ['src/runtime/export-runtime.ts','src/runtime/browser-box.ts','src/runtime/expressions.ts'])report.sourceFiles[file]=sha(file);
for(const scale of [1,1.5]){
 const file=`research/repeater-row-quantization-host-${String(scale).replace('.','p')}.json`,evidence=JSON.parse(fs.readFileSync(file,'utf8'));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:[`--force-device-scale-factor=${scale}`]}),context=await browser.newContext({viewport:null});
 const page=await context.newPage(),errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',r=>{network.push(r.request().url());return r.abort();});
 try{
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({content:`window.makeRuntime=(${createOfflineRuntime.toString()});window.makeBox=(${createBrowserBoxReader.toString()});window.evalExpression=(${evaluateExpression.toString()});`});
  const outcomes=[];
  for(const fixture of evidence.probe.outcomes){
   const f=fixture.fixture,doc=createDocument(),list=createWidget('repeater',40,40);doc.caseSelection='never';doc.variables={Count:'0'};
   Object.assign(list.style,{strokeWidth:0,borderWidths:f.border});
   list.repeater={columns:['Name'],rows:f.ids.map(id=>({Name:String(id)})),template:[],itemWidth:f.width,itemHeight:f.height,layout:f.vertical?'vertical':'horizontal',gap:0,horizontalGap:f.gapX,verticalGap:f.gapY,padding:f.padding,...(f.wrap===-1?{}:{wrap:f.wrap})};
   list.interactions=[{...event([{type:'setVariable',targetId:'Count',value:'[[Count + 1]]'}]),event:'itemResize'}];doc.pages[0].widgets=[list];
   await page.evaluate(async ({doc})=>{window.rt?.dispose();document.body.replaceChildren();window.doc=doc;window.list=doc.pages[0].widgets[0];window.rt=window.makeRuntime(doc,undefined,window.evalExpression,window.makeBox());await window.rt.start();}, {doc});
   const snapshot=()=>page.evaluate(()=>{
    const list=window.list,rt=window.rt,state=rt.state(),rows=rt.rows(list),root=document.createElement('div');
    Object.assign(root.style,{position:'absolute',left:'40px',top:'40px',boxSizing:'border-box',borderStyle:'solid',borderWidth:list.style.borderWidths.map(v=>v+'px').join(' '),padding:'0',margin:'0'});
    const size=rt.renderSize(list);root.style.width=size.width+'px';root.style.height=size.height+'px';document.body.replaceChildren(root);
    const box=el=>{const cs=getComputedStyle(el);return {inline:[el.style.width,el.style.height],css:[cs.width,cs.height],inlineXY:[el.style.left,el.style.top],cssXY:[cs.left,cs.top]};};
    const logical={},geometry={r:state.repeaterBounds[list.id]},moved={},rowBoxes=[];
    for(const row of rows){const id=Number(row.data.Name),el=document.createElement('div');Object.assign(el.style,{position:'absolute',left:row.x+'px',top:row.y+'px',width:row.width+'px',height:row.height+'px',border:'0',padding:'0',margin:'0',boxSizing:'border-box'});root.append(el);
     const n=state.itemLayouts[list.id][row.id],g=state.itemGeometry[list.id][row.id];logical[id]={itemId:id,width:n.width,height:n.height};geometry['r-'+id]={width:g.width,height:g.height};moved['r-'+id]={x:g.x,y:g.y};rowBoxes.push({id,...box(el)});
    }
    return {root:box(root),logical,geometry,moved,rows:rowBoxes,eventCount:Number(state.variables.Count)};
   });
   const expected=s=>({root:(({rect,...rest})=>rest)(s.root),logical:s.logical,geometry:s.geometry,moved:s.moved,rows:s.rows.map(({rect,...r})=>r),eventCount:s.events.length});
   assert.deepEqual(await snapshot(),expected(fixture.initial.native),fixture.name+' initial');
   let steps=0;
   for(const operation of fixture.operations){
    const [width,height]=operation.requested,id=operation.operation.id;
    const action=event([{type:'resizeItem',targetId:list.id,x:width,y:height}]);
    await page.evaluate(async ({id,action})=>{const row=window.rt.rows(window.list).find(r=>Number(r.data.Name)===id);await window.rt.execute(action,row.data,row.context);},{id,action});
    assert.deepEqual(await snapshot(),expected(operation.native.snapshot),fixture.name+' step '+steps);steps++;
   }
   const refresh=event([{type:'setVariable',targetId:'Count',value:'0'},{type:'addSort',targetId:list.id,value:JSON.stringify({name:'Descending',column:'Name',direction:'desc',dataType:'number',toggle:false,removeOthers:true})}]);
   await page.evaluate(async action=>window.rt.execute(action),refresh);
   assert.deepEqual(await snapshot(),expected(fixture.refreshed.native),fixture.name+' refreshed');
   outcomes.push({name:fixture.name,steps,initial:true,refresh:true,passed:true});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  const result={scale,browser:await browser.version(),evidence:file,evidenceSha256:sha(file),fixtures:outcomes.length,steps:outcomes.reduce((n,o)=>n+o.steps,0),outcomes};report.environments.push(result);console.log(JSON.stringify({...result,outcomes:undefined}));
 }finally{await context.close();await browser.close();}
}
fs.writeFileSync('research/repeater-row-product-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,fixtures:report.environments.reduce((n,e)=>n+e.fixtures,0),steps:report.environments.reduce((n,e)=>n+e.steps,0),output:'research/repeater-row-product-verification.json'}));
