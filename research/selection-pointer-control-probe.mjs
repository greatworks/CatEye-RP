// Retained CIL control replay. Editor selection/history/hot-zone widgets are explicit facades.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
process.on('uncaughtException',e=>{const message=String(e.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<pointer-cil>');let n=1;while(fs.existsSync(`research/selection-pointer-control-failure-${n}.json`))n++;fs.writeFileSync(`research/selection-pointer-control-failure-${n}.json`,JSON.stringify({message,probeSha256:sha(import.meta.filename)},null,2));console.error(message);process.exitCode=1;});
const sourceFile='research/layer-resize-controller-probe.mjs';
const old=fs.readFileSync(sourceFile,'utf8');
let code=old.slice(0,old.indexOf('for(let mask=0;mask<16;mask++)'))
 .replace('Layer:33557506','Page:33557050,Layer:33557506')
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace("else if(op==='ldnull')", "else if(op==='ldftn')stack.push(v); else if(op==='ldnull')")
 .replace("else if(v===67134719)", "else if(v===67119099)stack.push({}); else if(v===67119189)stack.push(null); else if(v===67134719)")
 .replace("else if(op==='stfld')", "else if(op==='stsfld')context.staticWrites.set(v,stack.pop()); else if(op==='stfld')");
code+=String.raw`
const extraFiles=['research/selection-pointer-handles-cil.json','research/selection-pointer-single-cil.json',
 'research/selection-pointer-dependencies-cil.json','research/layer-resize-controller-planner-axis-cil.json','research/layer-resize-controller-planner-selection-cil.json',
 'research/selection-author-resize-class-cil.json'];
for(const file of extraFiles)for(const t of read(file).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file});
for(const [id,n]of [[100686198,1],[100686221,1],[100686222,2],[100686224,2],[100708299,1],[100708300,1],
 [100708301,1],[100708303,2],[100708304,2],[100708345,1],[100708321,1],[100708324,1],[100689230,1],[100686303,2],[100702025,1]])cil(id,n);
bind(100685847,1,x=>x[0]);bind(100682809,1,()=>0);
bind(100686197,1,([h])=>h.selection);
bind(100696225,1,([a])=>a.length);bind(100696231,2,([a,n])=>a[n]);
bind(721422063,1,([a])=>!a?.length?1:0); // ObPm null/empty fixture facade
bind(721420967,1,([a])=>!a?.length?1:0);
bind(100689232,1,([a])=>!a.length?1:0);
bind(100686195,1,()=>0);bind(100695467,1,()=>({kind:'Page'}));
bind(100695939,1,()=>rect(0,0,300,100));bind(100686193,2,()=>VOID);
bind(167775742,2,([target,method])=>({target,method}));
bind(721420476,2,([a,p])=>a.every(x=>execute(p.method,[p.target,x]))?1:0);
bind(100686194,2,([h,on])=>{h.display=!!on;return VOID;});
bind(100686182,1,([h])=>h.handles);
bind(167785161,1,([a])=>enumStart(a));bind(167785162,1,([e])=>deref(e).items[deref(e).index]);
bind(100686095,2,([h,on])=>{h.visible=!!on;return VOID;});
bind(100695242,1,([w])=>w.kind==='SelectionButton'?execute(100702025,[w]):w.sizingFreedom??3);
const rootSlice=methods.get(100686248).Instructions.filter(i=>i.Offset>=491&&i.Offset<=730);
methods.set(-100686248,{Instructions:[...rootSlice,{Offset:1016,Op:'ret',Operand:null},{Offset:1036,Op:'ret',Operand:null}]});
bind(100686235,1,([c])=>c.selection);
bind(167773186,2,([a,n])=>a[n]);
bind(100695481,1,([w])=>w.locked?1:0);
bind(100686258,4,([c,w,delta,angle])=>{context.events.push({name:'obN4',id:w.id,delta:copy(delta),fit:w.autoFitWidth,panel:w.panel});angle.set(NaN);return w.rect;});
bind(100686260,6,([c,w,r,dx,dy,override])=>{context.events.push({name:'VbN8',id:w.id,rect:copy(r),dx,dy,override:!!override});return VOID;});
bind(100686198,1,([h])=>{context.events.push({name:'refresh-hot-zones'});return execute(100686198,[h]);});
bind(100702343,2,([w,value])=>{context.events.push({name:'set-AFW',id:w.id,value:!!value});w.autoFitWidth=!!value;return VOID;});
bind(100688813,2,args=>execute(100688813,args));
bind(100695366,4,()=>VOID);
bind(100688824,1,([x])=>Number.isNaN(x)?1:0);
function setup(input){
 context={events:[],calls:[],effects:[],commits:[],geometryWrites:[],keys:0,staticWrites:new Map()};
 const selection=(input.selection??[{fit:input.fit}]).map((s,n)=>widget('s'+n,'SelectionButton',rect(n*200,30,100,20),{autoFitWidth:!!s.fit,locked:!!s.locked,[67123780]:!!s.locked,sizingFreedom:s.freedom}));
 const h={selection,handles:[1,2,3,4,6,8,9,12].map(handle=>({handle,freedom:execute(100708345,[handle])}))};
 execute(100686198,[h]);return h;
}
export function handles(input){const h=setup(input);return {display:h.display,handles:h.handles.map(x=>({handle:x.handle,freedom:x.freedom,visible:x.visible,fit:!!x[67119112],multi:!!x[67119113]}))};}
export function frames(input){const h=setup(input),c=h.handles.find(x=>x.handle===input.handle);c.selection=h.selection;c[67119110]=h;c.snapshot={};
 const out=[];for(const delta of input.deltas){context.events=[];execute(-100686248,[c,delta.x,delta.y,false,false,false,3,false]);out.push({delta,events:context.events,fit:h.selection[0].autoFitWidth,handles:h.handles.map(x=>({handle:x.handle,visible:x.visible,fit:!!x[67119112]}))});}return out;}
export const inputs=[...inputFiles,...extraFiles];
`;
// Resolve field/MemberRef identities from the recorded selected methods; no textual-name guess at execution.
const all=read('research/selection-pointer-handles-cil.json').Types.flatMap(t=>t.Methods);
const hot=all.find(m=>m.Token===100686198);
const named=n=>hot.Instructions.find(i=>i.Resolved===n).Operand;
const statics=hot.Instructions.filter(i=>i.Op==='ldsfld'&&i.Operand!==67142340).map(i=>i.Operand);
code=code.replace("else if(v===67119099)stack.push({}); else if(v===67119189)stack.push(null);",`else if(v===${statics[0]})stack.push(context.staticWrites.get(v)??null); else if(v===${statics[1]})stack.push({});`);
code=code.replace('bind(167775742,2,',`bind(${named('TypeSpecification:1B000163::.ctor')},2,`);
const entry=read('.build/next-layer-authoring/resize-propagation-cil.json').Types.flatMap(t=>t.Methods).find(m=>m.Token===100686248);
const call=n=>entry.Instructions.find(i=>i.Resolved===n).Operand;
code=code.replace('bind(100686235,1,',`bind(${call('.obNM::dbSS')},1,`).replace('bind(167773186,2,',`bind(${call('TypeSpecification:1B000168::get_Item')},2,`);
const {handles,frames,inputs}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
export const addonSource=code.slice(code.indexOf('const extraFiles='));
export {handles,frames};
if(process.argv[1]?.replaceAll('\\','/').endsWith('/selection-pointer-control-probe.mjs')){
 const cases=[];
 for(const selection of [[{fit:false}],[{fit:true}],[{fit:true},{fit:false}],[{fit:true},{fit:true}],[{fit:true,locked:true}],[{fit:true,locked:true},{fit:true}],[{fit:true,locked:true},{fit:false,locked:true}]])cases.push({name:'Original hot-zone setup',input:{selection},actual:handles({selection})});
 for(const fit of [false,true])for(const handle of [1,4])cases.push({name:'Continuous single source branch',input:{fit,handle,deltas:[{x:20,y:8},{x:0,y:0},{x:40,y:0}]},actual:frames({fit,handle,deltas:[{x:20,y:8},{x:0,y:0},{x:40,y:0}]})});
 for(const c of cases){try{if(c.input.selection){const s=c.input.selection,visible=s.every(x=>x.locked)?[]:s.length===1?[1,4]:[1,2,3,4,6,8,9,12];assert.deepEqual(c.actual.handles.filter(x=>x.visible).map(x=>x.handle),visible);for(const h of c.actual.handles)assert.equal(h.fit,s.length===1&&!s[0].locked&&!!s[0].fit&&[1,4].includes(h.handle));}else{assert(c.actual.every(x=>x.fit===false));assert.equal(c.actual.flatMap(x=>x.events).filter(x=>x.name==='set-AFW').length,c.input.fit?1:0);}c.passed=true;}catch(e){c.passed=false;c.error=e.message;}}
 const out={kind:'retained CIL-record replay with selection/editor/geometry facade',cases,sources:[sourceFile,...new Set(inputs)].map(path=>({path,sha256:sha(path)}))};
 fs.writeFileSync('research/selection-pointer-control-probes.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({total:cases.length,passed:cases.filter(x=>x.passed).length}));if(cases.some(c=>!c.passed))process.exitCode=1;
}
