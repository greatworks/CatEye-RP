// Bounded retained-CIL interpretation and exact original-JS slices; no target DLL execution.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {foldFlowFields} from './gradient-angle-static-flow.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const bind=p=>({path:p,sha256:hash(p)});
const files=['research/native-corners-path-builder-cil.json','research/line-style-platform-functions-cil.json',...['coalesce','merge','point','handle','point-equality','point-comparison','point-axes','point-constructor','point-setters','scalar-comparison'].map(n=>`research/native-pills-${n}-cil.json`)];
const methods=new Map(files.flatMap(p=>{const j=read(p);assert.equal(j.SHA256,'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');return j.Types.flatMap(t=>t.Methods.map(m=>[m.Token,m]));}));
const fields=foldFlowFields();
const emptyPoint=()=>({g5ws:NaN,r5wl:NaN}),pt=(x,y)=>({g5ws:x,r5wl:y});
const unwrap=x=>x&&x.ref?x.ref[x.key]:x;
const resolveField=i=>i.Resolved.split('::').at(-1);
const captures=[];
function replay(token,args,stop=null,depth=0){
 assert(depth<20);const m=methods.get(token);assert(m,`Missing ${token}`);
 const code=m.Instructions,at=new Map(code.map((x,i)=>[x.Offset,i])),stack=[],locals=[];
 let pc=0,steps=0;
 while(pc<code.length){assert(++steps<20000);const i=code[pc++],op=i.Op;
  if(i.Offset===stop)return{points:stack.at(-1),usedRadius:args[1],usedOffset:args[2],steps};
  const branch=()=>{assert(at.has(i.Operand));pc=at.get(i.Operand)},pop=()=>unwrap(stack.pop());
  if(op==='br'||op==='br.s'){branch();continue;}
  if(op==='ldarg.s'||/^ldarg\.\d+$/.test(op)){stack.push(args[op==='ldarg.s'?i.Operand:Number(op.slice(6))]);continue;}
  if(op==='ldarga.s'){stack.push({ref:args,key:i.Operand});continue;}
  if(op==='starg.s'){args[i.Operand]=pop();continue;}
  if(op==='ldloc.s'||/^ldloc\.\d+$/.test(op)){stack.push(locals[op==='ldloc.s'?i.Operand:Number(op.slice(6))]);continue;}
  if(op==='ldloca.s'){stack.push({ref:locals,key:i.Operand});continue;}
  if(op==='stloc.s'||/^stloc\.\d+$/.test(op)){locals[op==='stloc.s'?i.Operand:Number(op.slice(6))]=pop();continue;}
  if(op.startsWith('ldc.i4')){stack.push(op==='ldc.i4'||op==='ldc.i4.s'?i.Operand:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue;}
  if(op==='ldc.r8'){stack.push(i.Operand);continue;}
  if(op==='ldnull'){stack.push(null);continue;}
  if(op==='newarr'){stack.push(new Array(pop()));continue;}
  if(op==='ldsfld'){if(i.Resolved==='m5wr.f5wV::m5wA')stack.push(emptyPoint());else if(i.Operand===67142340)stack.push({opaqueFlow:true});else throw Error(`Unknown static field ${i.Resolved}`);continue;}
  if(op==='ldfld'||op==='ldflda'){const target=pop();if(target?.opaqueFlow){assert(fields.has(i.Operand));stack.push(fields.get(i.Operand).value);}else stack.push(op==='ldflda'?{ref:target,key:resolveField(i)}:target[resolveField(i)]);continue;}
  if(op==='stfld'){const value=pop(),target=pop();target[resolveField(i)]=value;continue;}
  if(op==='initobj'){const ref=stack.pop();if(ref.ref)ref.ref[ref.key]={};else for(const key of Object.keys(ref))delete ref[key];continue;}
  if(op==='stelem'){const value=pop(),index=pop(),array=pop();array[index]=value;continue;}
  if(op==='ldelem'){const index=pop(),array=pop();stack.push(array[index]);continue;}
  if(op==='box')continue;
  if(op==='dup'){stack.push(stack.at(-1));continue;}
  if(op==='pop'){stack.pop();continue;}
  if(['and','add','sub','mul','div','ceq','clt'].includes(op)){const b=pop(),a=pop();stack.push(op==='and'?a&b:op==='add'?a+b:op==='sub'?a-b:op==='mul'?a*b:op==='div'?a/b:op==='clt'?a<b:a===b);continue;}
  if(['brtrue','brfalse','brtrue.s','brfalse.s'].includes(op)){if(Boolean(pop())===op.startsWith('brtrue'))branch();continue;}
  if(['blt','bgt','beq','bne.un','bge'].includes(op)){const b=pop(),a=pop();if(op==='blt'?a<b:op==='bgt'?a>b:op==='beq'?a===b:op==='bne.un'?a!==b:a>=b)branch();continue;}
  if(op==='newobj'){
   if(i.Resolved==='m5wr.f5wV::.ctor'){assert.equal(i.Operand,100721941);const y=pop(),x=pop(),target={};replay(i.Operand,[target,x,y],null,depth+1);stack.push(target);continue;}
   if(i.Resolved==='TypeSpecification:1B000800::.ctor'){stack.push([]);continue;}
   if(i.Resolved==='F5Ek.z5EE::.ctor'){assert.equal(i.Operand,100719025);const values=stack.splice(stack.length-4,4).map(unwrap),target={};replay(i.Operand,[target,...values],null,depth+1);stack.push(target);continue;}
   throw Error(`Unhandled constructor ${i.Resolved}`);
  }
  if(op==='call'||op==='callvirt'){
   const r=i.Resolved,take=n=>stack.splice(stack.length-n,n).map(unwrap),add=(n,fn)=>stack.push(fn(...take(n)));
   if(r.startsWith('GSqK.cSqL::')){add(1,x=>replay(i.Operand,[x],null,depth+1));continue;}
   if(r==='System.Enum::HasFlag'){add(2,(a,b)=>(a&b)===b);continue;}
   if(r==='TypeSpecification:1B00140B::get_HasValue'){add(1,x=>x!==null);continue;}
   if(r==='TypeSpecification:1B00140B::get_Value'){add(1,x=>{assert.notEqual(x,null);return x;});continue;}
   if(r==='O5ut.K5u9::P3j2'){add(1,x=>x.width);continue;}
   if(r==='O5ut.K5u9::j3jh'){add(1,x=>x.height);continue;}
   if(r==='System.Math::Min'||r==='System.Math::Max'){add(2,r.endsWith('Min')?Math.min:Math.max);continue;}
   if(r==='System.Math::Abs'||r==='System.Math::Floor'){add(1,r.endsWith('Abs')?Math.abs:Math.floor);continue;}
   if(r==='System.Double::IsNaN'){add(1,Number.isNaN);continue;}
   if(r==='tIaS.UIaN::DkYN')continue; // opaque init already statically folded from retained initializer
   if(r==='CbiJ.Bbib::First<generic>'){add(1,a=>a[0]);continue;}
   if(r==='CbiJ.Bbib::Last<generic>'){add(1,a=>a.at(-1));continue;}
   if(r.startsWith('TypeSpecification:1B000800::')){
    const name=r.split('::')[1];if(name==='Add'){const [a,v]=take(2);a.push(v);}else if(name==='RemoveAt'){const[a,i]=take(2);a.splice(i,1);}else if(name==='set_Item'){const[a,i,v]=take(3);a[i]=v;}else if(name==='get_Item')add(2,(a,i)=>a[i]);else if(name==='get_Count')add(1,a=>a.length);else throw Error(r);continue;
   }
   if(i.Operand===100722500){const values=take(2);if(token===100722498)captures.push(structuredClone(values[0]));stack.push(replay(i.Operand,values,null,depth+1));continue;}
   const arity=new Map([[100722499,2],[100719039,2],[100721975,2],[100721978,2],[100721980,2],[100721982,2],[100688812,3],[100719037,1],[100719038,1],[100721939,1],[100721934,1],[100721936,1],[100719020,1],[100719021,2],[100721935,2],[100721937,2]]);
   if(arity.has(i.Operand)){const returned=replay(i.Operand,take(arity.get(i.Operand)),null,depth+1);if(![100719021,100721935,100721937].includes(i.Operand))stack.push(returned);continue;}
   throw Error(`Unmodelled call ${r} in ${token}`);
  }
  if(op==='ret')return pop();
  throw Error(`Unsupported ${op} at ${token}/${i.Offset.toString(16)}`);
 }
 throw Error('No stop/return');
}
const compact=p=>[p.g5Eq.g5ws,p.g5Eq.r5wl,p.E5Ed.g5ws,p.E5Ed.r5wl,p.a5EO.g5ws,p.a5EO.r5wl,Boolean(p.W5EU)];
const results=[];
for(const input of [
 {name:'horizontal-capsule',width:100,height:40,radius:20,count:6},
 {name:'vertical-capsule',width:40,height:100,radius:20,count:6},
 {name:'square-full-round',width:40,height:40,radius:20,count:4},
 {name:'rounded-rectangle',width:100,height:40,radius:19,count:8},
 {name:'raw-radius30-clamp',width:48,height:24,radius:30,count:6},
 {name:'raw-radius5-thin',width:200,height:6,radius:5,count:6},
])for(const offset of [0,.5,2]){
 const before=captures.length,observed=replay(100722498,[{width:input.width,height:input.height},input.radius,offset,15,15,null],0x6cf);
 assert.equal(captures.length,before+1);assert.equal(observed.points.length,input.count);
 results.push({name:input.name+'-offset-'+offset,kind:'bounded-retained-CIL',input:{...input,offset},observed:{...observed,points:observed.points.map(compact),beforeMerge:captures.at(-1).map(compact)},pass:true});
}
// Exact retained source equality/coalescing guards, independent from pill generation.
const cp=(x,lower=emptyPoint(),higher=emptyPoint(),segment=true)=>({g5Eq:pt(x,0),E5Ed:lower,a5EO:higher,W5EU:segment});
for(const [name,points,expected] of [
 ['coincident-forward',[cp(0,pt(-1,0)),cp(0,emptyPoint(),pt(1,0),false),cp(2)],2],
 ['nondegenerate-connecting-higher',[cp(0,emptyPoint(),pt(.2,0)),cp(0),cp(2)],3],
 ['nondegenerate-connecting-lower',[cp(0),cp(0,pt(-.2,0)),cp(2)],3],
 ['near-anchor-within-normalized-epsilon',[cp(0),cp(.000009),cp(2)],2],
 ['anchor-at-normalized-epsilon',[cp(0),cp(.00001),cp(2)],3],
 ['closing-seam',[cp(0,emptyPoint(),pt(1,0)),cp(2),cp(0,pt(-1,0))],2],
]){
 const input=points.map(compact),out=replay(100722500,[structuredClone(points),0]);assert.equal(out.length,expected);results.push({name,kind:'retained-CIL-coalescing',input,observed:out.map(compact),pass:true});
}
const inventoryFile='research/native-pills-format-inventory.json',inventory=read(inventoryFile);
const rawPills=inventory.owners.filter(o=>o.shape===0&&o.observed.vertexCounts?.[0]===6&&o.effective?.[81]?.value===15);
assert.equal(rawPills.length,28);
for(const owner of rawPills){
 const num=n=>typeof n==='object'&&n?.$number==='NaN'?NaN:n;
 const actual=owner.normalizedControlPoints[0].map(p=>[num(p.Path.X),num(p.Path.Y),num(p.LowerHandle.X),num(p.LowerHandle.Y),num(p.HigherHandle.X),num(p.HigherHandle.Y),p.HigherSegmentExists]);
 const output=replay(100722498,[{width:owner.size.Width,height:owner.size.Height},owner.effective[71].value,0,15,15,null],0x6cf).points.map(compact);
 const same=(a,b)=>a.length===b.length&&a.every((p,i)=>p.every((n,k)=>typeof n==='boolean'?n===b[i][k]:Number.isNaN(n)?Number.isNaN(b[i][k]):Math.abs(n-b[i][k])<1e-12));
 const shift=output.findIndex((_,i)=>same(actual,output.slice(i).concat(output.slice(0,i))));assert(shift>=0,owner.sourceId);
 results.push({name:'raw-pill-'+owner.sourceId,kind:'retained-raw-vs-bounded-CIL-coordinate-join',source:{sample:owner.sample,sha256:owner.sha256,packageId:owner.packageId,sourcePartSha256:owner.sourcePartSha256,sourceId:owner.sourceId},input:{width:owner.size.Width,height:owner.size.Height,radius:owner.effective[71].value},observed:{cycleShift:shift,raw:actual,replayed:output},pass:true});
}
// Reuse frozen harness setup without running its cases or writing its old report.
const harnessFile='research/native-corners-runtime-probe.mjs',harness=fs.readFileSync(harnessFile,'utf8');
const prefix=harness.slice(harness.indexOf('const base='),harness.indexOf('const results=[];'));
const {context,sources,slices}=new Function('fs','path','crypto','vm','assert',prefix+'\nreturn {context,sources,slices};')(fs,path,crypto,vm,assert);
for(const input of [
 {name:'dynamic-horizontal-capsule',width:100,height:40,radius:20,borderWidth:1},
 {name:'dynamic-vertical-capsule',width:40,height:100,radius:20,borderWidth:1},
 {name:'dynamic-square',width:40,height:40,radius:20,borderWidth:1},
 {name:'dynamic-clamped-raw30',width:48,height:24,radius:30,borderWidth:1},
 {name:'dynamic-zero-border-skips',width:100,height:40,radius:20,borderWidth:0},
 {name:'dynamic-none-skips',width:100,height:40,radius:20,borderWidth:1,linePattern:'none'},
]){
 const observed=JSON.parse(vm.runInContext(`JSON.stringify(cornerResult(${JSON.stringify({...input,cornerVisibility:'left top right bottom',borderVisibility:'top right bottom left'})}))`,context,{timeout:1000}));
 if(input.borderWidth===0||input.linePattern==='none')assert.equal(observed.fillD,null);else assert.equal((observed.fillD.match(/\bC\b/g)||[]).length,4);
 results.push({name:input.name,kind:'exact-retained-JS-VM-mocked-DOM',input,observed,pass:true});
}
const report={capturedAt:new Date().toISOString(),method:'Bounded CIL replay through i5vf IL06CA followed by exact retained m5vw/P5vT and point/handle comparisons; exact retained JS VM slices with mocked DOM. No vendor DLL or GUI execution.',assemblySha256:'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7',sources:[...files,...['research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',harnessFile,inventoryFile,'research/native-corners-shape-factory-cil.json','research/native-corners-geometry-metadata.json','research/native-corners-runtime-probes.json']].map(bind).concat(sources.map(({lines,...s})=>s)),slices:slices.map(({text,...s})=>({...s,sha256:crypto.createHash('sha256').update(text).digest('hex')})),probe:bind('research/native-pills-evidence-probe.mjs'),results,summary:{passed:results.length,failed:0},sinks:['Known Rect Width/Height getters','Point sentinel with both coordinates NaN','Generic List methods First/Last/Add/RemoveAt/get/set/count','System.Math and Double.IsNaN','Opaque initializer skipped only after retained static field constant folding; target DLL never loaded'],limits:['Stops after coalescing before contour split and final SVG generation.','All generated-coordinate cases use all-visible sides/mask15; previously frozen evidence covers partial masks.','Dynamic calls use object/DOM sinks, not browser pixels.','Normalized point equality tolerance is native implementation behavior; not a recommendation to silently accept arbitrary near-pill input.','Managed points are normalized source geometry, not final SVG stroke clipping or painted pixels.']};
fs.writeFileSync('research/native-pills-evidence-probes.json',JSON.stringify(report,(_k,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v,2)+'\n');
console.log(JSON.stringify(report.summary));
