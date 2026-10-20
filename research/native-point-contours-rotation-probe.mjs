// Bounded static CIL replay. No vendor assembly load/invocation or old report write.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fields,readJson,sha256} from './gradient-angle-static-flow.mjs';
const harnessPath='research/native-point-commit-evidence-probe.mjs';
let harness=fs.readFileSync(harnessPath,'utf8').split('for(const p of ')[0].replace(/^import .*;\r?$/gm,'');
assert(!harness.includes('writeFileSync'));
harness=harness.replace("'div','ceq'","'div','rem','ceq'").replace('div:()=>a/b,','div:()=>a/b,rem:()=>a%b,');
const context={fs,assert,fields,readJson,sha256,structuredClone};
vm.runInNewContext(harness+'\nglobalThis.api={run,common,h,methods,visited,trace,point,rect,center,rounded,expanded,normalized,curveBounds,val};',context);
const {run,common,h,methods,visited,trace,point,rect,center,rounded,expanded,normalized,curveBounds,val}=context.api;
const newSources=fs.readdirSync('research').filter(x=>/^native-point-contours-rotation-.*-cil\.json$/.test(x)).map(x=>`research/${x}`);
const oldSources=['research/native-point-commit-evidence-bounds-cil.json','research/native-point-commit-evidence-scalar-cil.json','research/native-point-commit-evidence-rotation-matrix-cil.json','research/native-point-commit-evidence-rotation-primitives-cil.json','research/adaptive-placement-authoring-owner-cil.json','research/rp-vector-path-point-transform-cil.json','research/rp-vector-path-widget-transform-cil.json','research/rp-vector-path-scale-cil.json','research/rp-vector-path-inset-cil.json','research/line-style-arrow-point-cil.json'];
const chainSources=['research/rotation-format-object-cil.json','research/native-point-commit-evidence-world-input-cil.json','research/native-point-commit-evidence-world-map-cil.json','research/native-point-commit-evidence-live-operations-cil.json'];
for(const file of [...newSources,...oldSources])for(const t of readJson(file).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file});
for(const token of [100688805,100688807,100688808,100688809,100688810,100722141,100722143,100722144,100722207,100722209,100722214])common[token]=h(1,o=>run(token,[o]));
for(const token of [100722208,100722210,100722215])common[token]=h(2,(o,v)=>run(token,[o,v]),false);
common[100722211]=h(1,o=>o.rect);common[100722200]=h(1,o=>center(o.rect));
common[100722075]=h(1,o=>center(val(o)));
for(const [token,name] of [[100722061,'tl'],[100722062,'tr'],[100722064,'bl'],[100722065,'br']])common[token]=h(1,o=>{const r=val(o);return point(r.x+(name.includes('r')?r.width:0),r.y+(name.startsWith('b')?r.height:0))});
for(const [token,name] of [[100722189,'tl'],[100722191,'tr'],[100722193,'bl'],[100722195,'br']])common[token]=h(2,(o,v)=>{o[name]=v},false);
for(const token of [100722217,100722218,100722219,100722220])common[token]=h(1,o=>run(token,[o]),false);
for(const token of [100722204,100722205])common[token]=h(1,o=>run(token,[o]));
common[100721989]=h(2,(p,d)=>run(100721989,[p,d]));
common['System.Math::Sin']=h(1,Math.sin);common['System.Math::Cos']=h(1,Math.cos);
for(const [token,name] of [[100722014,'tl'],[100722015,'tr'],[100722016,'bl'],[100722017,'br']])common[token]=h(1,f=>f.kind?f[name]:point(f.x+(name.includes('r')?f.width:0),f.y+(name.startsWith('b')?f.height:0)));
common[100720547]=h(3,(a,b,t)=>run(100720547,[a,b,t]));
common[100720533]=h(3,(f,x,y)=>run(100720533,[f,x,y]));
function frame(r,angle){return run(100722226,[r,angle],{
 100722221:h(2,(rect,angle)=>{const f={kind:'rotated-frame',rect};run(100722215,[f,angle]);run(100722216,[f]);return f}),
})}
function frameAngle(f){return f.kind?run(100722214,[f]):run(100722141,[f])}
function sc(f){return f.kind?{s:run(100722207,[f]),c:run(100722209,[f])}:{s:run(100722143,[f]),c:run(100722144,[f])}}
function branch(f){const stop={};let observed;try{observed=run(100702689,[{},[],false,{}],{
 100695395:h(1,()=>f),100722035:h(1,frameAngle),100702690:h(4,()=> 'iN4x-unrotated'),
 100702927:h(0,()=>{throw stop}),
 })}catch(e){if(e!==stop)throw e;observed='hN4K-rotated'}return observed}
function transform(p,c,s,k){const x=p.x-c.x,y=p.y-c.y;return point(c.x+x*k-y*s,c.y+x*s+y*k)}
function compose(r,angle,normalizedPoints,kind='polygon',stroke=1){
 const f=frame(r,angle),trig=sc(f),oldCenter=center(r),route=branch(f);
 const world=normalizedPoints.map(p=>run(100720534,[f,p]));
 const local=route==='iN4x-unrotated'?world:world.map(p=>transform(p,oldCenter,-trig.s,trig.c));
 const b=kind==='cubic'?curveBounds(local):rect(Math.min(...local.map(p=>p.x)),Math.min(...local.map(p=>p.y)),Math.max(...local.map(p=>p.x))-Math.min(...local.map(p=>p.x)),Math.max(...local.map(p=>p.y))-Math.min(...local.map(p=>p.y)));
 let raw=b;
 if(route==='hN4K-rotated'){
  const tl=transform(point(b.x,b.y),oldCenter,trig.s,trig.c),br=transform(point(b.x+b.width,b.y+b.height),oldCenter,trig.s,trig.c),c=point((tl.x+br.x)/2,(tl.y+br.y)/2),origin=transform(tl,c,-trig.s,trig.c);raw=rect(origin.x,origin.y,b.width,b.height);
 }
 const round=rounded(raw),owner=expanded(round,Math.max(stroke,1));
 const normalizedPointsOut=world.map(p=>normalized(route==='hN4K-rotated'?transform(p,center(owner),-trig.s,trig.c):p,owner));
 return {suppliedAngle:angle,frameClass:f.kind??'boxed-j5u5',reportedAngle:frameAngle(f),trig,route,world,exactBounds:b,rawOwner:raw,roundedOwner:round,owner,normalizedPoints:normalizedPointsOut};
}
const results=[];
function check(name,fn){results.push({name,observed:fn()})}
const angles=[0,-0,1e-12,-1e-12,1e-6,-1e-6,9.999999e-6,-9.999999e-6,1e-5,-1e-5,1.0000001e-5,-1.0000001e-5,2e-5,-2e-5,360,-360,720,-720,360-5e-6,360+5e-6,-360+5e-6,-360-5e-6,360-2e-5,360+2e-5,-360+2e-5,-360-2e-5,...[90,180,270,-90,-180,-270].flatMap(a=>[a-2e-5,a-5e-6,a,a+5e-6,a+2e-5])];
for(const angle of angles)check(`frame and hN4K dispatch ${Object.is(angle,-0)?'-0':angle}`,()=>{
 const f=frame(rect(100,100,200,100),angle),route=branch(f),reported=frameAngle(f),trig=sc(f);
 assert.equal(route,Math.abs(angle)<1e-5?'iN4x-unrotated':'hN4K-rotated');assert.equal(reported,Math.abs(angle)<1e-5?0:angle);
 return {angle,frameClass:f.kind??'boxed-j5u5',reportedAngle:reported,trig,route};
});
for(const angle of [0,1,90,180,360,-360])check(`degree conversion ${angle}`,()=>{const r=run(100688805,[angle]);assert.equal(r,angle*0.017453292519943295);return {degrees:angle,radians:r}});
const shape=[point(-.25,0),point(1,0),point(1,1),point(0,1)];
for(const angle of angles)check(`polygon commit ${Object.is(angle,-0)?'-0':angle}`,()=>{
 const out=compose(rect(100,100,200,100),angle,shape);
 // Independent analytic checks for this polygon: its local center moves 25 left.
 assert(Math.abs(out.rawOwner.x-(75-25*out.trig.c))<1e-9);
 assert(Math.abs(out.rawOwner.y-(100-25*out.trig.s))<1e-9);
 if(out.trig.s===0&&out.trig.c===1){
  assert.deepEqual(JSON.parse(JSON.stringify(out.owner)),{x:50,y:100,width:250,height:100});
  assert.deepEqual(JSON.parse(JSON.stringify(out.normalizedPoints)),[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:.2,y:1}]);
 }
 return out;
});
for(const angle of [0,9.999999e-6,1e-5,-1e-5,360,-360,360-5e-6,-360+5e-6])check(`cubic commit ${angle}`,()=>{
 const out=compose(rect(100,100,200,100),angle,[point(0,0),point(0,-1),point(1,0),point(1,1)],'cubic');
 if(out.trig.s===0&&out.trig.c===1){
  assert(Math.abs(out.exactBounds.y-(200-100*Math.SQRT2))<1e-9);
  assert.deepEqual(JSON.parse(JSON.stringify(out.owner)),{x:100,y:58,width:200,height:142});
 }
 return out;
});
const sources=[...new Set([harnessPath,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',...oldSources,...chainSources,...newSources,...readJson('research/native-point-commit-evidence-probes.json').sources.map(x=>x.path)])].sort().map(path=>({path,sha256:sha256(path)}));
const report={schema:1,kind:'bounded retained CIL instruction replay and independent numeric composition',generatedAt:new Date().toISOString(),original:{version:'11.0.0.4150',path:readJson(oldSources[0]).AssemblyPath,sha256:readJson(oldSources[0]).SHA256},sources,probe:{path:'research/native-point-contours-rotation-probe.mjs',sha256:sha256('research/native-point-contours-rotation-probe.mjs')},methodsReplayed:[...visited].sort((a,b)=>a-b),caseCount:results.length,results,limits:['No original DLL method or GUI executed.','Source interpreter is reused in memory from the frozen prior probe; its test/output section is never evaluated and no prior file is written.','Factory constructor and point/rectangle storage are explicit sinks; setter/getter, angle special-case dispatch, trig calculation, scalar thresholds, hN4K leading dispatch and numeric primitives execute retained instructions.','Final coordinates independently compose retained hN4K/iN4x formulae; full collection/reindex pipeline and callbacks are not executed.','Inputs here are supplied effective rotation values to SizingRect. General Transform/cache provider precedence, nonfinite values, upstream author angle canonicalization and original GUI pixels are outside coverage.']};
fs.writeFileSync('research/native-point-contours-rotation-probes.json',JSON.stringify(report,null,2)+'\n');
const fixtures=results.filter(x=>x.name.startsWith('polygon commit ')||x.name.startsWith('cubic commit ')).map(({name,observed})=>({name,input:{owner:{x:100,y:100,width:200,height:100},effectiveRotation:observed.suppliedAngle,strokeWidth:1,closed:name.startsWith('polygon'),path:name.startsWith('polygon')?'M -.25 0 L 1 0 L 1 1 L 0 1 Z':'M 0 0 C 0 -1 1 0 1 1'},expected:observed}));
fs.writeFileSync('research/native-point-contours-rotation-fixtures.json',JSON.stringify({schema:1,kind:'source-derived independent numeric composition; not original DLL results',source:{path:'research/native-point-contours-rotation-probes.json',sha256:sha256('research/native-point-contours-rotation-probes.json')},fixtureCount:fixtures.length,numericComparison:{absoluteTolerance:1e-9,appliesTo:'these bounded fixtures only; exact equality for route and frame class',reason:'JS arithmetic sinks and matrix composition do not promise original CLR floating point operation order'},fixtures},null,2)+'\n');
console.log(JSON.stringify({cases:results.length,methods:report.methodsReplayed.length,status:'pass'}));
