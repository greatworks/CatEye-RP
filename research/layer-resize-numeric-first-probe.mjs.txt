import fs from 'node:fs';
import assert from 'node:assert/strict';
import {read,hash,sourceFiles,makeRect,makePin,makeVector,runPin,runProjection,runAspect,runINw2,sizingBounds,coverage,externalCalls} from './layer-resize-numeric-replay.mjs';
import {pinFormula,projectionFormula,aspectFormula,evaluatorFormula,boundsFormula} from './layer-resize-numeric-formula.mjs';
const DLL='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/AxureRP11.dll';
const expectedSHA='dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7';
assert.equal(hash(DLL),expectedSHA);
for(const p of sourceFiles) assert.equal(read(p).SHA256,expectedSHA,p);
const rect=r=>makeRect(r.x,r.y,r.width,r.height);
const same=(a,b)=>typeof a==='number'&&typeof b==='number'?(Object.is(a,b)||Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b))):a&&b&&typeof a==='object'&&typeof b==='object'?Object.keys(a).every(k=>same(a[k],b[k]))&&Object.keys(a).length===Object.keys(b).length:a===b;
const results=[];
function check(group,name,input,actual,expected,detail={}) { results.push({group,name,input,actual,expected,passed:same(actual,expected),...detail}); }
const parent={x:0,y:0,width:200,height:100},original={x:20,y:10,width:50,height:30};
const parentCases=[
  [parent,{x:0,y:0,width:300,height:160},original,{x:30,y:16,width:75,height:48}],
  [{x:10,y:20,width:200,height:100},{x:-10,y:5,width:300,height:160},{x:30,y:30,width:50,height:30},{x:20,y:21,width:75,height:48}],
  [parent,{x:90,y:70,width:20,height:5},original,{x:92,y:70.5,width:5,height:1.5}],
  [parent,{x:0,y:0,width:0,height:0},original,{x:0,y:0,width:0,height:0}],
  [parent,{x:300,y:160,width:-100,height:-60},original,{x:290,y:154,width:-25,height:-18}],
  [{x:0,y:0,width:0,height:0},{x:0,y:0,width:100,height:100},{x:0,y:0,width:0,height:0},{x:0,y:0,width:0,height:0}],
];
for(let ci=0;ci<parentCases.length;ci++) {
  const [oldParent,newParent,o,p]=parentCases[ci];
  for(const h of[0,1,4,5,256])for(const v of[0,2,8,10,512])for(const fw of[false,true])for(const fh of[false,true])for(const anchor of[0,3,6,9,12]) {
    const pin={h,v,fixedWidth:fw,fixedHeight:fh,oldParent,newParent};
    const replay=runPin(makePin(h,v,fw,fh,rect(oldParent),rect(newParent)),rect(o),rect(p),anchor,{trace:true});
    check('pin',`${ci}/${h}/${v}/${+fw}/${+fh}/${anchor}`,{pin,original:o,projected:p,anchor},replay.value,pinFormula(pin,o,p,anchor),{executedOffsets:replay.trace.filter(([t])=>t===100703559).map(([,i])=>i)});
  }
}
const deltas=[{x:100,y:60},{x:-30,y:-20},{x:-200,y:-100},{x:-250,y:-160},{x:250,y:160},{x:0,y:0}];
for(const anchor of[1,2,3,4,6,8,9,12])for(const freedom of[0,1,2,3,65536,131072,196611])for(const bypass of[false,true])for(const delta of deltas) {
  const actual=runProjection(rect(parent),rect(original),makeVector(delta.x,delta.y),anchor,freedom,bypass);
  check('projection',`${anchor}/${freedom}/${+bypass}/${delta.x}/${delta.y}`,{parent,original,delta,anchor,freedom,bypass},{value:actual.value,scaledDelta:actual.scaledDelta},projectionFormula(parent,original,delta,anchor,freedom,bypass));
}
for(const size of[{width:200,height:100},{width:0,height:100},{width:200,height:0},{width:0,height:0}])for(const freedom of[0,1,2,3])for(const orientation of[0,1,2,3])for(const delta of deltas) {
  const p={x:0,y:0,...size};
  check('aspect',`${size.width}/${size.height}/${freedom}/${orientation}/${delta.x}/${delta.y}`,{parent:p,freedom,orientation,delta},runAspect(makeVector(delta.x,delta.y),rect(p),freedom,orientation).value,aspectFormula(delta,p,freedom,orientation));
}
for(const angle of[-360,-270,-180,-90,-1e-5,-1e-6,0,1e-6,1e-5,.99999,.999999,1,1.000001,1.00001,30,45,89.13596303062127,89.999999,90,90.000001,180,270,360,450]) {
  check('sizing-bounds',`${angle}`,{original,angle},sizingBounds(rect(original),angle),boundsFormula(original,angle));
}
for(const angle of[0,1,30,45,89.13596303062127,90,180,270,-90,360])for(const anchor of[1,2,3,4,6,8,9,12])for(const preserveAspect of[false,true])for(const freedom of[1,2,3]) {
  const bbox=sizingBounds(rect(original),angle),delta={x:100,y:60};
  const input={original,bbox,delta,parent,anchor,freedom,preserveAspect,orientation:3,pin:null,angle};
  const replay=runINw2(rect(original),rect(bbox),makeVector(delta.x,delta.y),rect(parent),anchor,freedom,preserveAspect,3,null,angle,{trace:true});
  check('evaluator',`${angle}/${anchor}/${+preserveAspect}/${freedom}`,input,replay.value,evaluatorFormula(input),{executedOffsets:replay.trace.filter(([t])=>t===100703557).map(([,i])=>i)});
}
for(const angle of[0,30,90])for(const anchor of[3,6,9,12])for(const h of[0,1,4,5,256])for(const v of[0,2,8,10,512]) {
  const bbox=sizingBounds(rect(original),angle),delta={x:100,y:60},newParent={x:0,y:0,width:300,height:160};
  const pin={h,v,fixedWidth:false,fixedHeight:true,oldParent:parent,newParent};
  const input={original,bbox,delta,parent,anchor,freedom:3,preserveAspect:false,orientation:3,pin,angle};
  const p=makePin(h,v,false,true,rect(parent),rect(newParent));
  check('evaluator-pin',`${angle}/${anchor}/${h}/${v}`,input,runINw2(rect(original),rect(bbox),makeVector(100,60),rect(parent),anchor,3,false,3,p,angle).value,evaluatorFormula(input));
}
for(const dims of[{width:200,height:100},{width:0,height:100},{width:200,height:0},{width:0,height:0}])for(const angle of[0,30,90])for(const anchor of[3,12])for(const delta of deltas) {
  const p={x:0,y:0,...dims},o={x:0,y:0,width:dims.width/4,height:dims.height/3},bbox=sizingBounds(rect(o),angle);
  const input={original:o,bbox,delta,parent:p,anchor,freedom:3,preserveAspect:false,orientation:3,pin:null,angle};
  check('evaluator-edge',`${dims.width}/${dims.height}/${angle}/${anchor}/${delta.x}/${delta.y}`,input,runINw2(rect(o),rect(bbox),makeVector(delta.x,delta.y),rect(p),anchor,3,false,3,null,angle).value,evaluatorFormula(input));
}
// Static array bridge used by Rotate(Position, degrees), without running unrelated initializer branches.
const cctor=read('research/line-style-platform-functions-cil.json').Types.flatMap(t=>t.Methods).find(m=>m.Token===100708486);
const slice=cctor.Instructions.filter(i=>i.Offset>=0xAB5&&i.Offset<=0xAF4);
const values=slice.filter(i=>i.Op.startsWith('ldc.i4')).map(i=>i.Op==='ldc.i4.s'?i.Operand:Number(i.Op.slice(7)));
assert.deepEqual(values,[3,2,6,4,12,8,9,1]);
const files=[...sourceFiles,'research/layer-resize-numeric-replay.mjs','research/layer-resize-numeric-formula.mjs','research/layer-resize-numeric-probe.mjs','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json','research/line-style-platform-functions-cil.json','.build/next-layer-authoring/resize-enums.json'];
const failed=results.filter(r=>!r.passed);
const report={
  schemaVersion:1,createdAt:new Date().toISOString(),kind:'bounded original CIL instruction interpretation plus independently expressed formula comparison',
  original:{path:DLL,sha256:expectedSHA},sources:files.map(path=>({path,sha256:hash(path)})),
  summary:{total:results.length,passed:results.length-failed.length,failed:failed.length,groups:Object.fromEntries([...new Set(results.map(r=>r.group))].map(g=>[g,results.filter(r=>r.group===g).length]))},
  execution:{vendorDllLoaded:false,vendorDllMethodsExecuted:false,vendorGuiOperated:false,host:'Node.js '+process.version,
    sinks:['System.Math numeric primitives and Double.IsNaN','System.Object constructor no-op and Enum.HasFlag','Bbib array min/max use source-order comparisons','plain affine matrix allocation/application from captured arithmetic','supplied effective widget rotation getter; no style-provider resolution','static sentinel data and source-extracted ordered Position list'],
    limits:['No original GUI/CLR floating-point or final rendering claim.','Pointer controller, snapping, coordinate scope and final writeback are outside these numeric calls.','Nonfinite outputs are recorded with explicit string tags, not silently coerced to zero.','Formula comparison tolerance 1e-8 relative; original CIL branch predicates are executed at exact supplied IEEE-754 doubles.','Unsupported or unexpected instructions/calls fail closed.']},
  methodCoverage:[...coverage].sort(([a],[b])=>a-b).map(([token,offsets])=>({token,executedOffsets:[...offsets].sort((a,b)=>a-b)})),
  externalCalls:[...externalCalls].map(([token,name])=>({token,name})),results,
};
const replacer=(_k,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v;
fs.writeFileSync('research/layer-resize-numeric-probes.json',JSON.stringify(report,replacer,2)+'\n');
console.log(JSON.stringify(report.summary));
if(failed.length){console.log(JSON.stringify(failed.slice(0,8),replacer,2));process.exitCode=1;}
