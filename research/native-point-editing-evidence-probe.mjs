// Bounded static CIL instruction replay. Never loads or executes the target DLL.
// Geometry generation, state providers, UI events, and history are explicit sinks.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fields,foldFlowFields,readJson,sha256} from './gradient-angle-static-flow.mjs';
const files=['shape','mode-transition','gesture-point','gesture-anchor','gesture-handle','edit','state'].map(x=>`research/native-point-editing-evidence-${x}-cil.json`);
files.push('research/native-point-editing-format-shape-cil.json','research/line-style-platform-functions-cil.json');
const methods=new Map(files.flatMap(file=>readJson(file).Types.flatMap(t=>t.Methods.map(m=>[m.Token,{...m,file}]))));
const results=[];
function run(token,args,handlers={},trace=[]){
 const m=methods.get(token);assert(m,`method ${token}`);const code=m.Instructions,at=new Map(code.map((i,n)=>[i.Offset,n])),stack=[],locals=[];let pc=0,count=0;
 const invoke=(i)=>{const h=handlers[i.Resolved]??handlers[i.Operand];assert(h,`unmodelled ${i.Resolved} at ${token}/${i.Offset.toString(16)}`);const values=stack.splice(stack.length-h.n,h.n);const result=h.fn(...values);trace.push({method:token,il:i.Offset,call:i.Resolved,args:values.map(x=>typeof x==='object'?x?.kind??'<object>':x)});if(h.ret!==false)stack.push(result)};
 while(pc<code.length){assert(++count<3000,'loop bound');const i=code[pc++],o=i.Op;const branch=()=>{assert(at.has(i.Operand));pc=at.get(i.Operand)};
  if(o==='br'||o==='br.s'||o==='leave'||o==='leave.s'){branch();continue}
  if(/^ldarg\.[0-3]$/.test(o)){stack.push(args[Number(o.slice(6))]);continue}
  if(o==='ldarg.s'||o==='ldarg'){stack.push(args[i.Operand]);continue}
  if(o==='starg.s'){args[i.Operand]=stack.pop();continue}
  if(/^ldloc\.[0-3]$/.test(o)){stack.push(locals[Number(o.slice(6))]);continue}
  if(o==='ldloc.s'){stack.push(locals[i.Operand]);continue}
  if(o==='ldloca.s'){stack.push({ref:locals,key:i.Operand});continue}
  if(o.startsWith('stloc.')){locals[o==='stloc.s'?i.Operand:Number(o.slice(6))]=stack.pop();continue}
  if(o.startsWith('ldc.i4')){stack.push(o==='ldc.i4'||o==='ldc.i4.s'?i.Operand:o==='ldc.i4.m1'?-1:Number(o.slice(7)));continue}
  if(o==='ldc.r8'){stack.push(i.Operand);continue}
  if(o==='ldnull'){stack.push(null);continue}
  if(o==='ldsfld'){stack.push({module:true});continue}
  if(o==='ldfld'){const x=stack.pop();if(x.module){assert(fields.has(i.Operand));stack.push(fields.get(i.Operand).value)}else stack.push(x[i.Resolved.split('::')[1]]);continue}
  if(o==='stfld'){const v=stack.pop(),x=stack.pop();x[i.Resolved.split('::')[1]]=v;trace.push({method:token,il:i.Offset,write:i.Resolved,value:typeof v==='object'?v?.kind??'<object>':v});continue}
  if(o==='brtrue'||o==='brfalse'){if(!!stack.pop()===(o==='brtrue'))branch();continue}
  if(['beq','bne.un','bge','ble','bgt','blt'].includes(o)){const b=stack.pop(),a=stack.pop();if(({beq:a===b,'bne.un':a!==b,bge:a>=b,ble:a<=b,bgt:a>b,blt:a<b})[o])branch();continue}
  if(['add','sub','mul','div','ceq','cgt','clt','or','and'].includes(o)){const b=stack.pop(),a=stack.pop();stack.push(({add:()=>a+b,sub:()=>a-b,mul:()=>a*b,div:()=>a/b,ceq:()=>a===b,cgt:()=>a>b,clt:()=>a<b,or:()=>a|b,and:()=>a&b})[o]());continue}
  if(o==='dup'){stack.push(stack.at(-1));continue}
  if(o==='pop'){stack.pop();continue}
  if(o==='box'||o==='nop')continue;
  if(o==='newarr'){stack.push(new Array(stack.pop()));continue}
  if(o==='stelem.ref'||o==='stelem.i4'){const v=stack.pop(),index=stack.pop(),arr=stack.pop();arr[index]=v;continue}
  if(o==='call'||o==='callvirt'||o==='newobj'){invoke(i);continue}
  if(o==='ret')return {value:stack.pop(),trace};
  throw Error(`Unsupported ${o} at ${token}/${i.Offset.toString(16)}`);
 }
 throw Error('no return');
}
const h=(n,fn,ret=true)=>({n,fn,ret});
function check(name,fn){results.push({name,observed:fn()})}
const predicates={
 'Axure.DocumentModel.Objects.VectorShape::get_Shape':h(1,x=>x.shape),
 'GSqK.cSqL::DSO4':h(1,x=>run(100708406,[x]).value),
 'GSqK.cSqL::WSO0':h(1,x=>run(100708388,[x]).value),
 'GSqK.cSqL::mSOv':h(1,x=>run(100708417,[x]).value),
 'GSqK.cSqL::XSOy':h(1,x=>run(100708416,[x]).value),
};
for(const shape of [0,300])for(const prior of [false,true])for(const flag of [false,true])check(`conversion helper shape=${shape} prior=${prior} flag=${flag}`,()=>{
 const owner={kind:'owner',shape},host={kind:'history-host',ijkv:null},mode={kind:'mode',Jjg1:owner,gjg7:prior?{kind:'prior-edit'}:null};const trace=[];
 const calls={...predicates,'NjVj.FjVF::HjVJ':h(1,()=>host),'Axure.DocumentModel.Objects.VectorShapeEdit::YN45':h(3,(o,s,f)=>{assert.equal(o,owner);assert.equal(s,300);assert.equal(f,1);return {kind:'conversion-edit'}}),'BS11.pS1H::.ctor':h(1,arr=>({kind:'compound-edit',edits:arr}))};
 const result=run(100685401,[mode,flag],calls,trace);assert.equal(!!result.value,shape!==300);assert.equal(host.ijkv?.kind,shape===300?undefined:flag&&prior?'compound-edit':'conversion-edit');return {shape,prior,flag,result:result.value,history:host.ijkv,trace};
});
for(const shape of [0,300])for(const target of [0,300])check(`line shape adjustment ${shape} to ${target}`,()=>{
 const owner={kind:'owner',shape:target};const trace=[];
 run(100702694,[owner,shape,target===300,false,false],predicates,trace);
 return {inputShape:shape,currentShape:target,trace};
});
for(const firstFlag of [false,true])for(const conversionFlag of [false,true])check(`point-operation wrapper flags ${firstFlag}/${conversionFlag}`,()=>{
 const trace=[],mode={kind:'mode'};
 const result=run(100685514,[{kind:'point-operation'},firstFlag,conversionFlag],{
  '.XbbP::vbb2':h(1,()=>mode),
  'HjIa.AjIh::yj3Y':h(1,()=>{},false),
  'HjIa.AjIh::FjI4':h(2,(_m,flag)=>{assert.equal(flag,conversionFlag);return 1}),
  'MjVE.tjVR::hjVL':h(2,(_m,flag)=>({kind:'scoped-operation',flag})),
 },trace);
 assert(trace.some(x=>x.call==='HjIa.AjIh::FjI4'));
 return {firstFlag,conversionFlag,result:result.value,trace};
});
for(const shape of [0,300])check(`control point getter shape ${shape}`,()=>{
 const owner={kind:'owner',shape,cN89:{kind:'saved-points'}},trace=[],generated={kind:'generated-current-points'};
 const result=run(100702676,[owner,0],{...predicates,
  'Axure.DocumentModel.Objects.VectorShape::jN4k':h(3,(_o,size,offset)=>{assert.equal(size,null);assert.equal(offset,0);return generated}),
  'Axure.DocumentModel.Objects.VectorShape::DN4W':h(2,(o,p)=>{o.cN89=p},false),
 },trace);
 assert.equal(result.value.kind,shape===300?'saved-points':'generated-current-points');return {shape,result:result.value,trace};
});
check('parametric getter passes effective geometry and independent properties to managed builder',()=>{
 const owner={kind:'owner',shape:0,sN8m:null},size={kind:'sizing-rect',width:240,height:60},trace=[];let factory;
 run(100702679,[owner,null,0],{...predicates,
  'kJm2.KJm7::get_SizingRect':h(1,()=>size),'kJm2.KJm7::hJOT':h(1,()=>90),
  'O5ut.K5u9::j3jh':h(1,r=>r.height),'O5ut.K5u9::P3j2':h(1,r=>r.width),'System.Math::Min':h(2,Math.min),
  'kJm2.KJm7::GJOu':h(1,()=>4),'kJm2.KJm7::mJqb':h(1,()=>9),'kJm2.KJm7::QJUF':h(1,()=>15),'kJm2.KJm7::lJUj':h(1,()=>5),
  'R5v6.L5vW::w5Qk':h(8,(...values)=>{factory=values;return {kind:'builder-result'}}),
 },trace);
 assert.deepEqual(factory,[size,0,60,4,9,null,15,5]);return {factory,trace};
});
for(const shape of [0,300])check(`undo snapshot and restore shape ${shape}`,()=>{
 const owner={kind:'owner',shape,sN8m:{kind:'smart-points'},points:{kind:'source-points'}},snapshot={kind:'snapshot'},trace=[];
 const handlers={...predicates,
  'tIaS.UIaN::DkYN':h(0,()=>{},false),
  'TypeSpecification:1B000F30::.ctor':h(2,(s,o)=>{s.ESgn=o},false),
  'kJm2.KJm7::NJ01':h(1,()=>{},false),
  'Axure.DocumentModel.Objects.VectorShape::LN4g':h(2,(o,offset)=>{assert.equal(offset,0);return o.points}),
  'CbiJ.Bbib::Sb73<generic>':h(1,x=>structuredClone(x)),
  'wScF.GScr::.ctor':h(1,()=>({kind:'geometry-style-snapshot-sink'})),
  'y5zl.l5zs::Copy':h(1,x=>structuredClone(x)),
  'Axure.DocumentModel.Objects.VectorShape::set_Shape':h(2,(o,s)=>{o.shape=s},false),
  'Axure.DocumentModel.Objects.VectorShape::DN4W':h(2,(o,p)=>{o.points=p},false),
  'TypeSpecification:1B000E91::Apply':h(1,()=>{},false),
  'Axure.DocumentModel.Objects.VectorShape::TN4D':h(1,()=>{},false),
 };
 run(100702643,[snapshot,owner],handlers,trace);owner.shape=29;owner.points={kind:'changed-points'};owner.sN8m=null;
 run(100702644,[snapshot],handlers,trace);assert.equal(owner.shape,shape);assert.equal(owner.points.kind,'source-points');assert.equal(owner.sN8m.kind,'smart-points');
 return {shape,restored:owner,trace};
});
// Reuse the frozen bounded interpreter definition, not its cases or writers.
const oldProbe='research/native-pills-evidence-probe.mjs',oldSource=fs.readFileSync(oldProbe,'utf8');
const geometryHarness=oldSource.slice(oldSource.indexOf('const read='),oldSource.indexOf('const results=[];'));
const {replay:geometry,compact}=new Function('fs','assert','foldFlowFields',geometryHarness+'\nreturn {replay,compact}')(fs,assert,foldFlowFields);
const geometryCases=[];
for(const dimensions of [
 {width:240,height:60,radius:18}, {width:100,height:40,radius:20}, {width:40,height:100,radius:20},
 {width:40,height:40,radius:20}, {width:200,height:100,radius:180}, {width:90.25,height:30.75,radius:8.125},
 {width:100,height:40,radius:0}, {width:100,height:40,radius:.0001},
])for(let cornerMask=0;cornerMask<16;cornerMask++)for(const offset of [0,.5,2]){
 const input={...dimensions,cornerMask,offset},output=geometry(100722498,[{width:input.width,height:input.height},Math.min(input.radius,input.width,input.height),offset,15,cornerMask,null],0x6cf);
 assert.equal(output.usedOffset,0);const points=output.points.map(compact);assert(points.every(p=>p[6]));
 geometryCases.push({name:`${input.width}x${input.height}-r${input.radius}-mask${cornerMask}-offset${offset}`,input,usedRadius:output.usedRadius,points});
}
const geometryOutput={schema:1,kind:'Bounded retained i5vf/m5vw/P5vT CIL replay, not target DLL execution',sources:[oldProbe,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json','research/native-corners-path-builder-cil.json',...['coalesce','merge','point','handle','point-equality','point-comparison','point-axes','point-constructor','point-setters','scalar-comparison'].map(n=>`research/native-pills-${n}-cil.json`)].map(path=>({path,sha256:sha256(path)})),cases:geometryCases};
fs.writeFileSync('research/native-point-editing-evidence-geometry.json',JSON.stringify(geometryOutput,(_k,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v,2)+'\n');
const output={schema:1,kind:'Bounded static CIL replay with explicit sinks; NOT execution of the original DLL or GUI',sources:files.map(path=>({path,sha256:sha256(path)})),results};
fs.writeFileSync('research/native-point-editing-evidence-probes.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({passed:results.length,geometry:geometryCases.length}));
