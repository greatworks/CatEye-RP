// Narrow native functions in real Edge; never initializes a vendor application.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {installRowOracle} from './repeater-row-quantization-oracle.mjs';

const dpr=Number(process.argv.find(arg=>arg.startsWith('--dpr='))?.slice(6)??1);
assert.ok([1,1.5].includes(dpr),'This evidence matrix supports host 1 / 1.5');
const prior=JSON.parse(fs.readFileSync(new URL('./repeater-box-model-evidence.json',import.meta.url),'utf8'));
const sha=data=>crypto.createHash('sha256').update(data).digest('hex'),texts=new Map();
const files=prior.files.filter(file=>['repeater.js','jquery-3.7.1.min.js','reset.css','axure_rp_page.css'].includes(file.name)).map(file=>{const data=fs.readFileSync(file.path);assert.equal(sha(data),file.sha256,file.name);texts.set(file.name,data.toString('utf8'));return file;});
const lines=texts.get('repeater.js').split(/\r?\n/),slice=(a,b)=>lines.slice(a-1,b).join('\n');
const spans=[[155,172,'raw-envelope'],[232,240,'computed-border-origin'],[270,300,'row-size-move-caches-and-position-increments'],[1080,1289,'logical-size-and-dom-size-separation'],[1483,1490,'element-id']];
const excerpts=spans.map(([startLine,endLine,purpose])=>({file:'repeater.js',startLine,endLine,purpose,text:slice(startLine,endLine)}));
const browser=await chromium.launch({channel:'msedge',headless:true,args:[`--force-device-scale-factor=${dpr}`]}),context=await browser.newContext({viewport:null});
let requests=0;await context.route('**/*',route=>{requests++;return route.abort();});const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
await page.setContent('<!doctype html><html><head></head><body></body></html>');await page.addStyleTag({content:texts.get('reset.css')+'\n'+texts.get('axure_rp_page.css')});await page.addScriptTag({content:texts.get('jquery-3.7.1.min.js')});
await page.addScriptTag({content:`(()=>{
var _repeaterManager={},repeaterIdToItemIds={},geometry={},moved={},events=[],rootWrites=[],obj={repeaterPropMap:{}};
var $jobj=id=>jQuery(document.getElementById(id)),$obj=id=>obj,_getAdaptiveProp=(map,key)=>map[key];
var $ax={getNumFromPx:v=>parseFloat(v),adaptive:{currentViewId:''},visibility:{setResizedSize:(id,width,height)=>geometry[id]={width,height},setMovedLocation:(id,x,y)=>moved[id]={x,y}},dynamicPanelManager:{fitParentPanel:()=>{}},event:{raiseSyntheticEvent:(id,event)=>events.push({id:Number(id.slice(2)),event,geometry:{...geometry[id]},rootGeometry:{...geometry.r}})}};
${slice(1080,1289)}
${slice(1483,1490)}
function box(element){const s=getComputedStyle(element),r=element.getBoundingClientRect();return {inline:[element.style.width,element.style.height],css:[s.width,s.height],inlineXY:[element.style.left,element.style.top],cssXY:[s.left,s.top],rect:[r.x,r.y,r.width,r.height]};}
function snapshot(){return {root:box(document.getElementById('r')),logical:JSON.parse(JSON.stringify(repeaterSizes.r.sizesMap)),geometry:structuredClone(geometry),moved:structuredClone(moved),rows:repeaterIdToItemIds.r.map(id=>({id,...box(document.getElementById('r-'+id))})),events:structuredClone(events)};}
function init(f){
 document.getElementById('r')?.remove();const element=document.createElement('div');element.id='r';Object.assign(element.style,{position:'absolute',left:'40px',top:'40px',boxSizing:'border-box',borderStyle:'solid',borderWidth:f.border.map(v=>v+'px').join(' '),padding:'0',margin:'0'});document.body.append(element);
 var repeaterId='r',orderedIds=f.ids,start=0,end=orderedIds.length,vertical=f.vertical,wrap=f.wrap,offset={width:f.width,height:f.height},viewId='',propMap=obj.repeaterPropMap={horizontalSpacing:f.gapX,verticalSpacing:f.gapY,paddingTop:f.padding[0],paddingRight:f.padding[1],paddingBottom:f.padding[2],paddingLeft:f.padding[3]};
 var repeaterObj=$jobj('r');geometry={};moved={};events=[];repeaterIdToItemIds.r=orderedIds;
 ${slice(155,172)}
 ${slice(232,240)}
 for(var pos=start;pos<end;pos++){var id=orderedIds[pos],copy=jQuery('<div>').attr('id','r-'+id);copy.css({position:'absolute',left:left+'px',top:top+'px',width:offset.width+'px',height:offset.height+'px'});repeaterObj.append(copy);$ax.visibility.setResizedSize('r-'+id,offset.width,offset.height);$ax.visibility.setMovedLocation('r-'+id,left,top);
 ${slice(287,297)}
 }
 repeaterObj.css(repeaterSize);resetItemSizes('r',offset,[start,end],orderedIds,vertical,wrap);return snapshot();
}
window.__rowNative={init,snapshot,resize:(id,w,h)=>({changed:_repeaterManager.setItemSize('r',id,w,h),snapshot:snapshot()})};
})();`});
await page.addScriptTag({content:`(${installRowOracle.toString()})();`});
const fixtures=[];
const baseline={ids:[1,2,3],vertical:true,wrap:-1,width:100,height:20,gapX:0.1,gapY:0.2,padding:[7,4,9,6],border:[3,5,7,2]};
const steps=[{id:1,w:130.1,h:35.2},{id:1,w:130.1,h:35.2},{id:1,w:100.1,h:20.2},{id:1,w:100.1,h:20.2},{id:1,readGeometry:true},{id:1,readGeometry:true},{id:2,w:145.125,h:50.3333},{id:1,w:0.1,h:0.2},{id:1,w:0.1,h:0.2},{id:1,w:0.1,h:0.2},{id:2,w:100,h:20},{id:3,w:90.2,h:19.1}];
for(const vertical of [true,false])fixtures.push({name:(vertical?'vertical':'horizontal')+'-nowrap-fractional-request-vs-measured',fixture:{...baseline,vertical},operations:steps});
const wrappedSteps=[{id:1,w:130.1,h:35.2},{id:2,w:120.2,h:25.1},{id:1,w:90.1,h:10.2},{id:3,w:145.4,h:60.6},{id:1,w:150.3,h:70.1},{id:3,w:80.1,h:15.3},{id:1,w:80.1,h:15.3},{id:2,w:80.1,h:15.3},{id:2,w:80.1,h:15.3},{id:4,readGeometry:true},{id:5,w:33.3,h:55.5},{id:5,w:33.3,h:55.5}];
for(const vertical of [true,false])fixtures.push({name:(vertical?'vertical':'horizontal')+'-wrap-max-owner-switch',fixture:{...baseline,ids:[1,2,3,4,5],vertical,wrap:2,width:100.1,height:20.2,gapX:0.3,gapY:0.7},operations:wrappedSteps});
for(const vertical of [true,false])fixtures.push({name:(vertical?'vertical':'horizontal')+'-subpixel-template',fixture:{...baseline,vertical,width:0.1,height:0.2,padding:[0.1,1.2,2.3,3.4],gapX:0.1,gapY:0.1},operations:[{id:1,w:100,h:20},{id:1,w:0.1,h:0.2},{id:1,w:0.1,h:0.2},{id:1,w:0.1,h:0.2},{id:1,readGeometry:true},{id:1,readGeometry:true},{id:2,w:0.09,h:0.19},{id:2,w:0.09,h:0.19}]});
fixtures.push({name:'zero-border-position-history',fixture:{...baseline,border:[0,0,0,0],width:100.1,height:20.2,gapX:0.333333,gapY:0.333333},operations:steps});
fixtures.push({name:'single-row-small-request-repetition',fixture:{...baseline,ids:[1]},operations:[{id:1,w:0.1,h:0.2},{id:1,w:0.1,h:0.2},{id:1,w:0.1,h:0.2},{id:1,readGeometry:true},{id:1,readGeometry:true},{id:1,w:100,h:20}]});
for(const vertical of [true,false])fixtures.push({name:(vertical?'vertical':'horizontal')+'-five-row-shared-scenario',fixture:{...baseline,ids:[1,2,3,4,5],vertical,wrap:2,width:140.1,height:46.2,gapX:8.4,gapY:6.3,padding:[7.1,4.2,9.3,6.4]},operations:[{id:1,w:vertical?120.05:140.1,h:vertical?46.2:35.1},{id:1,w:180.3,h:62.4},{id:1,w:180.3,h:62.4},{id:3,w:180.3,h:62.4},{id:5,w:180.3,h:62.4},{id:1,w:140.1,h:46.2}]});
const outcomes=[],comparisons=[];
function compare(native,oracle,name){
 const n=structuredClone(native),o=structuredClone(oracle);delete o.rootWrites;
 // Layout rectangle float precision is separate from exact CSS/cache values.
 for(const [a,b] of [[n.root,o.root],...n.rows.map((row,i)=>[row,o.rows[i]])]){for(let i=0;i<4;i++)assert.ok(Math.abs(a.rect[i]-b.rect[i])<1e-4,name+' rect');delete a.rect;delete b.rect;}
 try{assert.deepEqual(n,o,name);return {match:true};}catch(error){return {match:false,message:error.message,native:n,oracle:o};}
}
try{
 for(const item of fixtures){
  const initial=await page.evaluate(f=>({native:window.__rowNative.init(f),oracle:window.__rowOracle.init(f)}),item.fixture),initialComparison=compare(initial.native,initial.oracle,item.name+' initial');
  const operations=[];
  for(const op of item.operations){
   const result=await page.evaluate(op=>{const now=window.__rowNative.snapshot(),g=now.geometry['r-'+op.id],w=op.readGeometry?g.width:op.w,h=op.readGeometry?g.height:op.h;return {requested:[w,h],before:now,native:window.__rowNative.resize(op.id,w,h),oracle:window.__rowOracle.resize(op.id,w,h)};},op);
   assert.equal(result.native.changed,result.oracle.changed,item.name+' changed');const comparison=compare(result.native.snapshot,result.oracle.snapshot,item.name+' '+operations.length);comparisons.push(comparison.match);
   operations.push({operation:op,...result,comparison});
  }
  const refreshedFixture={...item.fixture,ids:[...item.fixture.ids].reverse()},refreshed=await page.evaluate(f=>({native:window.__rowNative.init(f),oracle:window.__rowOracle.init(f)}),refreshedFixture),refreshComparison=compare(refreshed.native,refreshed.oracle,item.name+' refresh');
  outcomes.push({name:item.name,fixture:item.fixture,initial,initialComparison,operations,refreshedFixture,refreshed,refreshComparison});
 }
 assert.deepEqual(errors,[]);assert.equal(requests,0);
 const environment=await page.evaluate(()=>({devicePixelRatio,jquery:jQuery.fn.jquery,userAgent:navigator.userAgent,compatMode:document.compatMode}));
 const result={version:1,target:'Axure RP 11.0.0.4150',files,excerpts,environment:{...environment,browser:await browser.version(),requestedHostScale:dpr,viewportEmulation:false,requests,errors},
  probe:{fixtures:outcomes.length,resizeSteps:comparisons.length,oracleMatches:comparisons.filter(Boolean).length,oracleMismatches:comparisons.filter(x=>!x).length,initialMatches:outcomes.filter(o=>o.initialComparison.match).length,refreshMatches:outcomes.filter(o=>o.refreshComparison.match).length,outcomes,limitations:['Exact native size functions; handwritten equivalent initial DOM construction, with uniform template CSS size equal to offset.','Independent oracle uses measured host DOM rather than a DPR/quantization formula. IEEE-754 nominal arithmetic order is retained intentionally.','Refresh is a reconstruction using the same extracted initialization and resetItemSizes with reversed visible IDs, not the complete original refresh control flow.','Parent fit and event dispatch are recorders; no complete vendor runtime, original GUI, nested fit, CSS transforms or animation.']}};
 const output=JSON.stringify(result,null,2)+'\n',filename=`repeater-row-quantization-host-${String(dpr).replace('.','p')}.json`;fs.writeFileSync(new URL('./'+filename,import.meta.url),output);
 console.log(JSON.stringify({fixtures:outcomes.length,resizeSteps:comparisons.length,oracleMatches:result.probe.oracleMatches,oracleMismatches:result.probe.oracleMismatches,output:filename,sha256:sha(output)}));
 assert.equal(result.probe.oracleMismatches,0,'Native resize / independent DOM oracle mismatch');
 assert.equal(result.probe.initialMatches,outcomes.length,'Native initialization / independent DOM oracle mismatch');
 assert.equal(result.probe.refreshMatches,outcomes.length,'Reinitialization / independent DOM oracle mismatch');
}finally{await context.close();await browser.close();}
