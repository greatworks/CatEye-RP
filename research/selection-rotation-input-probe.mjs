import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {beginRotation,rotationInput,rotationFiles} from './selection-rotation-input-replay.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const clean=value=>JSON.parse(JSON.stringify(value,(k,v)=>k==='__struct'||k==='trace'?undefined:v));
// Separately written source formula from the frozen grid report, never product code.
const formulaText=fs.readFileSync('research/selection-input-grid-probe.mjs','utf8');
const sandbox={};vm.runInNewContext(formulaText.slice(formulaText.indexOf('const empty='),formulaText.indexOf('const handles='))+';this.formulaCandidate=formulaCandidate;this.formulaCorrection=formulaCorrection;',sandbox);
const results=[],coverage=new Map();
function match(actual,expected){if(typeof expected==='number'){assert.ok(Object.is(actual,expected)||Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);return;}if(expected&&typeof expected==='object'){for(const key of Object.keys(expected))match(actual?.[key],expected[key]);return;}assert.equal(actual,expected);}
function check(name,input,actual,expected,extra){for(const t of actual.trace??[]){const set=coverage.get(t.token)??new Set();set.add(t.offset);coverage.set(t.token,set);}const value=clean(actual);let error;try{match(value,expected);extra?.(value);}catch(e){error=e.message;}results.push({name,input,actual:value,expected,passed:!error,...error?{error}:{}});}
const handles=[1,2,3,4,6,8,9,12];
const targets=[{id:'a',rect:{x:100,y:100,width:240,height:20}},{id:'b',rect:{x:450,y:100,width:180,height:20}}];
const bounds={x:100,y:100,width:530,height:20};
const logical=(r,h)=>({x:h&1?r.x:h&4?r.x+r.width:r.x+(r.width-1)/2,y:h&2?r.y:h&8?r.y+r.height:r.y+(r.height-1)/2});
for(const handle of handles)for(const offset of [{x:0,y:0},{x:1.5,y:1.5},{x:-2.5,y:.5}])for(const zoom of [.5,2]){
 const start=logical(bounds,handle),down={x:start.x+offset.x,y:start.y+offset.y};
 const input={rect:bounds,targets,handle,keys:131072,down,zoom,count:2};
 check(`capture h${handle} offset${offset.x}/${offset.y} zoom${zoom}`,input,beginRotation(input),{accepted:true,mode:2,logicalStart:start,down,initialBounds:bounds,members:['a','b'],snapshotIds:[]},value=>{
  const writes=value.events.filter(x=>x.name==='field.write');
  assert.deepEqual(writes.map(x=>x.field),[67117547,67119115,67119117,67119118,67119119]);
 });
}
// All live key combinations, old mode retained; modifier changes do not recreate the controller.
for(const handle of handles)for(let keyBits=0;keyBits<8;keyBits++)for(const gridEnabled of [false,true])for(const live of [bounds,{x:80,y:60,width:400,height:170}]){
 const keys=(keyBits&1?65536:0)|(keyBits&2?131072:0)|(keyBits&4?262144:0),shift=!!(keyBits&1),alt=!!(keyBits&4),start=logical(bounds,handle);
 const input={rect:bounds,currentBounds:live,handle,keys,shift,alt,gridEnabled,count:2,start,point:{x:start.x+106,y:start.y+29},zoom:1};
 const active=gridEnabled&&!alt,candidate=active?sandbox.formulaCandidate(input):null,correction=active?sandbox.formulaCorrection({...input,rect:candidate}):{x:0,y:0};
 const delta={x:(input.point.x+correction.x)-start.x,y:(input.point.y+correction.y)-start.y};
 check(`move h${handle} keys${keys} grid${gridEnabled} live${live.width}`,input,rotationInput(input),{mode:2,candidate,correction,delta,rawPoint:input.point,shift,flag:false,orientation:3,tail:false,liveReads:active?1:0});
}
// A concrete fixture shows grid-enabled rotation changes the delta, while its raw point stays unchanged.
const examples=[];
for(const keys of [131072,196608,393216,458752]){
 const input={rect:bounds,currentBounds:bounds,handle:12,keys,alt:!!(keys&262144),gridEnabled:true,count:2,start:{x:630,y:120},point:{x:736,y:124}};
 const actual=rotationInput(input);examples.push({keys,input,output:clean(actual),downPoint:{x:631.5,y:121.5},controllerAnglePoint:{x:631.5+actual.delta.x,y:121.5+actual.delta.y}});
}
const sources=[...new Set([...rotationFiles,'research/selection-rotation-input-replay.mjs','research/selection-rotation-input-probe.mjs','research/selection-input-grid-replay.mjs','research/selection-input-grid-probe.mjs','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json'])].map(file=>({file,sha256:sha(file)}));
const report={kind:'mode2 upstream retained CIL replay with explicit services',originalDllExecuted:false,originalGuiCompared:false,createdAt:new Date().toISOString(),summary:{total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length},facades:['ordinary handle hit-test succeeds; ordinary SelectionButton same page diagram scope','current owner union and initial member union provided by finite rectangle services','snapshot constructors/transaction containers/visual feedback are injected non-geometric services; mode2 does not use mode1 TbN1 list','Device→World conversion represented by supplied absolute diagram points and uniform zoom for tolerance','guides and object providers explicitly disabled','CbNX downstream effects are a recording sink; angle/write behavior independently investigated by sibling agent'],methods:[...coverage].map(([token,offsets])=>({token,visitedOffsets:[...offsets].sort((a,b)=>a-b)})),sources,examples,results};
fs.writeFileSync('research/selection-rotation-input-probes.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
for(const failure of results.filter(r=>!r.passed).slice(0,5))console.log(JSON.stringify(failure));
if(report.summary.failed)process.exitCode=1;
