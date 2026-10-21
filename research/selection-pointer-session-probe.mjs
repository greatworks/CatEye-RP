// Retained controller + OI8Z + Size/Location CIL composition on one persistent widget.
// Font measurements, diagram/provider events and identity graphics units remain facades.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {addonSource} from './selection-pointer-control-probe.mjs';
import {sourceFiles as numericSources} from './selection-pointer-numeric-probe.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const oldFile='research/selection-layout-transaction-replay.mjs';
const old=fs.readFileSync(oldFile,'utf8');
let construction=old.slice(0,old.indexOf('const moduleCode='));
const sessionCode=`
import {single,project,rotateHandle} from ${JSON.stringify(pathToFileURL('research/selection-pointer-numeric-probe.mjs').href)};
for(const t of read('research/layer-resize-controller-planner-host-cil.json').Types)for(const m of t.Methods)methods.set(m.Token,m);
for(const t of read('research/selection-pointer-snapshot-history-cil.json').Types)for(const m of t.Methods)methods.set(m.Token,m);
for(const [t,n]of [[100686233,1],[100686216,2],[100686225,1]])cil(t,n);
bind(100708343,2,([h,a])=>rotateHandle(h,a));bind(100686183,2,([h,id])=>h.handles.find(x=>x.handle===id));bind(100686094,1,([h])=>!!h.visible);
bind(721422055,2,()=>0); // PbPp<Layer>: ordinary SelectionButton roots are never Layer
bind(100685874,1,([h])=>h);bind(100664959,3,()=>{event('operation.scope');let done=false;return {dispose(){if(!done){done=true;event('operation.dispose');}}};});
bind(167772304,1,([scope])=>{scope?.dispose?.();return VOID;});
bind(100685894,1,([c])=>c);bind(100685881,1,([c])=>c[67119005]);
bind(100707157,1,([ws])=>{const captured=ws.map(w=>({id:w.id,rect:geometry(w.rect)}));event('snapshot.construct',{captured});return {captured};});
bind(167776549,1,([a])=>a.length);
bind(167785189,1,([a])=>enumStart(a));
bind(100722026,1,([r])=>r.width);bind(100722027,1,([r])=>r.height);
bind(100707220,1,()=>{event('snapshot.complete');return VOID;});
bind(100703557,10,([w,o,b,d,p,handle,freedom,aspect,orientation,pin])=>{assert.equal(pin,null);const request={oldRect:geometry(o),oldAabb:geometry(b),delta:{x:d.x,y:d.y},parent:geometry(p),handle,freedom,angle:0,aspect:!!aspect};const result=project(request);event('INw2.result',{id:w.id,request,rect:result});return rect(result.x,result.y,result.width,result.height);});
bind(100686203,1,()=>({}));
bind(100695934,1,([ws])=>rect(Math.min(...ws.map(w=>w.rect.x)),Math.min(...ws.map(w=>w.rect.y)),0,0)); // post-write editor overlay-only union
for(const [t,n]of [[100685904,2],[100686287,2],[100682865,3],[100682311,3],[100682316,2],[100682310,3],[100682298,1],[100686115,4]])bind(t,n,()=>VOID);
// Override earlier control facades with original fit setter, obN4 numerical replay and VbN8.
bind(100702343,2,args=>{event('AFW.setter',{value:!!args[1],panel:geometry(args[0].panel.rect)});const result=execute(100702343,args);args[0].autoFitWidth=!!args[0][67126826];return result;});
bind(100695366,4,([w,s,all,notify])=>{w.rect={...w.rect,width:s.width,height:s.height};event('style.Size',{width:s.width,height:s.height,allViews:!!all,notify:!!notify});return VOID;});
bind(100686258,4,([c,w,delta,out])=>{const request={rect:c.oldRect,angle:context.input.angle??0,handle:c.handle,freedom:c.freedom,aspect:!!c[67119111],delta:{x:delta.x,y:delta.y}};const answer=single(request);out.set(answer.angle);event('obN4.result',{request,rect:answer.rect,panel:geometry(w.panel.rect)});const r=answer.rect;return rect(r.x,r.y,r.width,r.height);});
bind(100686260,6,args=>{event('VbN8.enter',{requested:geometry(args[2]),panel:geometry(args[1].panel.rect)});return execute(100686260,args);});
bind(100695441,1,()=>size(1,1));
bind(100686186,1,()=>1); // ordinary page diagram scope; no parent-origin adjustment
bind(100695242,1,([w])=>execute(100702025,[w]));
function begin(input){
 ${'__INITIALIZE__'}
 return w;
}
export function session(input){
 const w=begin(input);context.staticWrites=new Map();
 const h={selection:[w],handles:[1,2,3,4,6,8,9,12].map(handle=>({handle,freedom:execute(100708345,[handle])}))};
 execute(100686198,[h]);const c=h.handles.find(x=>x.handle===input.handle);c.selection=[w];c[67119110]=h;c[67119114]=input.handle;c.snapshot={};c.oldRect=geometry(w.rect);
 const results=[];
 for(const delta of input.deltas){
  const before={rect:geometry(w.rect),panel:geometry(w.panel.rect),fit:!!w[67126826],dbNv:!!c[67119112]};context.events=[];
  let error=null;try{execute(100686248,[c,delta.x,delta.y,false,false,!!input.shift,3,false]);}catch(e){error=e.message;}
  results.push({delta,before,after:{rect:geometry(w.rect),panel:geometry(w.panel.rect),fit:!!w[67126826],dbNv:!!c[67119112]},events:context.events,error});
 }
 return results;
}
export function multiple(input){
 const ws=input.rects.map((r,n)=>{const w=begin({...input,rect:r});w.id='selection'+n;w.locked=!!input.locked?.[n];w[67123780]=w.locked;return w;});context.staticWrites=new Map();
 const h={selection:ws,handles:[1,2,3,4,6,8,9,12].map(handle=>({handle,freedom:execute(100708345,[handle])}))};execute(100686198,[h]);
 const c=h.handles.find(x=>x.handle===input.handle),state=controller(ws,c.freedom);Object.assign(c,state);c.selection=ws;h[67119100]=c.nodes;c[67119110]=h;c[67119114]=input.handle;
 const p=input.selectionRect;c[67119117]=rect(p.x,p.y,p.width,p.height);c[67119118]=c[67119117];
 const frames=[];for(const delta of input.deltas){context.events=[];const before=ws.map(w=>({id:w.id,rect:geometry(w.rect),panel:geometry(w.panel.rect),fit:!!w[67126826]}));
 let error=null;try{execute(100686248,[c,delta.x,delta.y,false,false,!!input.shift,3,false]);}catch(e){error=e.message;}
 frames.push({delta,before,after:ws.map(w=>({id:w.id,rect:geometry(w.rect),panel:geometry(w.panel.rect),fit:!!w[67126826]})),events:context.events,error});}return frames;
}
`;
const init=old.slice(old.indexOf(' context={events:[],calls:',old.indexOf('export function transaction(input)')),old.indexOf(' let error=null;',old.indexOf('export function transaction(input)')));
construction+=`
prefix=prefix.replace('Layer:33557506','Page:33557050,Layer:33557506')
 .replace("else if(op==='br'||op==='br.s'||op==='leave'||op==='leave.s')", "else if(op==='endfinally'&&token===100686248)jump(1036); else if(op==='leave'&&token===100686248&&v===1036)jump(1021); else if(op==='br'||op==='br.s'||op==='leave'||op==='leave.s')")
 .replace("else if(op==='stfld')", "else if(op==='stsfld')context.staticWrites.set(v,stack.pop()); else if(op==='stfld')")
 .replace("else if(v===67134719)", "else if(v===67119143)stack.push(context.staticWrites.get(v)??null); else if(v===67119141)stack.push({}); else if(v===67134719)");
export const api=await import('data:text/javascript;base64,'+Buffer.from(prefix+oldAdapter+extension+${JSON.stringify(addonSource)}+${JSON.stringify(sessionCode.replace('__INITIALIZE__',init))}).toString('base64'));
`;
const built=await import('data:text/javascript;base64,'+Buffer.from(construction).toString('base64'));
export const session=built.api.session;
export const multiple=built.api.multiple;
export const sourceFiles=[...new Set([oldFile,'research/layer-resize-controller-probe.mjs','research/selection-author-resize-probe.mjs',
 'research/selection-pointer-control-probe.mjs','research/selection-pointer-numeric-probe.mjs','research/layer-resize-controller-planner-host-cil.json',
 'research/selection-pointer-snapshot-history-cil.json',...built.api.inputs,...built.api.sourceInputs,...numericSources,
 'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json'])];
if(process.argv[1]?.replaceAll('\\','/').endsWith('/selection-pointer-session-probe.mjs')){
 const cases=[];
 for(const widthFit of [false,true])for(const handle of [1,4]){
  const input={widthFit,heightFit:false,handle,rect:{x:100,y:100,width:240,height:40},panel:{x:16,y:10,width:224,height:20},buttonSize:14,measurements:[{width:224,height:20},{width:204,height:40},{width:224,height:20},{width:184,height:60}],deltas:[{x:20,y:0},{x:0,y:0},{x:40,y:0}]};
  const actual=session(input);cases.push({input,actual,passed:actual.every(x=>!x.error)});
 }
 for(const handle of [1,2,3,4,6,8,9,12]){
  const input={widthFit:true,heightFit:false,handle,rects:[{x:100,y:100,width:100,height:40},{x:300,y:100,width:100,height:40}],selectionRect:{x:100,y:100,width:300,height:40},panel:{x:14,y:0,width:86,height:20},buttonSize:14,measurements:[{width:80,height:20}],deltas:[{x:60,y:20},{x:0,y:0}]};const actual=multiple(input);cases.push({input,actual,passed:actual.every(x=>!x.error)});
 }
 for(const base of [...cases]){const input={...base.input,shift:true},actual=input.rects?multiple(input):session(input);cases.push({input,actual,passed:actual.every(x=>!x.error)});}
 for(const locked of [[false,true],[true,false],[true,true]]){const base=cases.find(x=>x.input.rects&&x.input.handle===4).input,input={...base,locked};const actual=multiple(input);cases.push({input,actual,passed:actual.every(x=>!x.error)});}
 for(const firstDelta of [0,1e-6,1e-5]){const input={...cases.find(x=>!x.input.rects&&x.input.widthFit&&x.input.handle===4).input,deltas:[{x:firstDelta,y:0},{x:20,y:0},{x:0,y:0}],epsilonCase:true};const actual=session(input);cases.push({input,actual,passed:actual.every(x=>!x.error)});}
 for(const c of cases)try{
  assert(c.passed,c.actual.find(f=>f.error)?.error);
  for(let i=1;i<c.actual.length;i++)assert.deepEqual(c.actual[i].before,c.actual[i-1].after,'Live owner/panel/flags must survive between calls');
  assert.equal(c.actual.flatMap(x=>x.events).filter(x=>x.name==='snapshot.construct').length,1);
  for(const f of c.actual)for(const e of f.events.filter(x=>x.name==='YJ0S.request'||x.name==='style.Location'||x.name==='style.Size'))assert.equal(e.allViews,false);
  if(!c.input.rects){
   if(c.input.epsilonCase){assert.equal(c.actual[0].after.fit,c.input.deltas[0].x<1e-5);assert(c.actual.slice(1).every(f=>f.after.fit===false));}
   else assert(c.actual.every(f=>f.after.fit===false));
   assert(c.actual.every(f=>f.events.find(e=>e.name==='obN4.result').request.aspect===false),'Single horizontal selection cannot enable aspect through the hidden orthogonal handle');
   const fs=c.actual.flatMap(f=>f.events).filter(e=>e.name==='AFW.setter');assert.equal(fs.length,c.input.epsilonCase&&c.input.deltas[0].x<1e-5?2:c.input.widthFit?1:0);
   for(const f of c.actual){const r=f.events.find(e=>e.name==='obN4.result').rect;assert.equal(f.after.rect.x,r.x);assert.equal(f.after.rect.y,r.y);}
  }else{
   const horizontal=[1,3,4,6,9,12].includes(c.input.handle);
   for(const [index,f]of c.actual.entries())for(const [n,w]of f.after.entries()){
    if(c.input.locked?.[n])assert.deepEqual(w,f.before[n]);
    else assert.equal(w.fit,!horizontal);
   }
  }
 }catch(e){c.passed=false;c.assertion=e.message;}
 fs.writeFileSync('research/selection-pointer-session-probes.json',JSON.stringify({kind:'Composed original CIL on persistent state, controlled font answers and page-only geometry services',sources:sourceFiles.map(path=>({path,sha256:sha(path)})),cases},null,2)+'\n');
 console.log(JSON.stringify({total:cases.length,failed:cases.filter(x=>!x.passed).map(x=>x.actual.filter(y=>y.error).map(y=>y.error))}));
 if(cases.some(c=>!c.passed))process.exitCode=1;
}
