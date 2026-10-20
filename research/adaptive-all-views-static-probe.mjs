// Bounded CIL instruction replay. No target DLL or native GUI is loaded/executed.
// External value/provider/capability/invalidation calls are explicit sinks below.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fields,readJson,sha256} from './gradient-angle-static-flow.mjs';
const sources=['edit-diff','prop-flags','position','geometry-write','property-write','size','clear-geometry'].map(x=>`research/adaptive-all-views-${x}-cil.json`);
const methods=new Map(sources.flatMap(file=>readJson(file).Types.flatMap(t=>t.Methods.map(m=>[m.Token,{...m,file}]))));
const results=[];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function replay(token,args,trace=[]){
 const m=methods.get(token);assert(m,`Missing method ${token}`);const code=m.Instructions,indices=new Map(code.map((i,n)=>[i.Offset,n])),stack=[],locals=[];
 let pc=0,count=0;const ref=(a,i)=>({a,i}),val=x=>x?.a?x.a[x.i]:x;
 const call=(ins)=>{
  const r=ins.Resolved;const take=n=>stack.splice(stack.length-n,n).map(val);const add=(n,fn,returns=true)=>{const values=take(n);const result=fn(...values);if(returns)stack.push(result)};
  if(ins.Operand===100695350||ins.Operand===100695366)return add(4,(...a)=>replay(ins.Operand,a,trace),false);
  if(ins.Operand===100695505)return add(5,(...a)=>replay(ins.Operand,a,trace),false);
  if(ins.Operand===100695538)return add(2,(...a)=>replay(ins.Operand,a,trace),false);
  if(r==='J5jB.e5jG::V5jg')return add(1,x=>x.overridden);
  if(r==='J5jB.e5jG::v5jI')return add(1,x=>x.indeterminate);
  if(r==='J5jB.e5jG::J5jb')return add(2,(a,b)=>equal(a.value,b.value));
  if(r==='J5jB.e5jG::h3FP')return add(2,(_x,cap)=>cap);
  if(r==='J5jB.e5jG::T5jH')return add(1,x=>x.name);
  if(r==='J5jB.e5jG::I3FM')return add(1,x=>x.value);
  if(r==='wIhA.zIhQ::sIho')return add(1,()=>'<opaque-prop-info>');
  if(r==='J5jB.e5jG::Create')return add(3,(name,value,info)=>({name,value,info}));
  if(r==='J5jB.e5jG::t5jR')return add(2,(x,b)=>{x.overridden=b},false);
  if(r==='kJm2.KJm7::GJqn')return add(1,x=>x.location);
  if(r==='kJm2.KJm7::uJqf')return add(1,x=>x.size);
  if(r==='m5wr.f5wV::op_Inequality'||r==='hHBO.fHBd::op_Inequality')return add(2,(a,b)=>!equal(a,b));
  if(r==='kJm2.KJm7::XJdz')return add(1,x=>x.contained??false);
  if(r==='kJm2.KJm7::wJOS')return add(1,x=>({temporary:x.temporary??false}));
  if(r==='TypeSpecification:1B000CC4::tbKf')return add(1,x=>x.temporary);
  if(r==='kJm2.KJm7::get_AllowAdaptive'||r==='kJm2.KJm7::get_AllowAdaptiveLocation')return add(1,x=>x.allowAdaptive??true);
  if(r==='kJm2.KJm7::NJ01')return add(1,()=>trace.push({call:'invalidate-before'}),false);
  if(r==='kJm2.KJm7::DJ0E')return add(3,()=>trace.push({call:'invalidate-after'}),false);
  if(r==='kJm2.KJm7::xJdR')return add(1,()=>1);
  if(r==='hHBO.fHBd::UHB4')return add(2,(size,scale)=>{assert.equal(scale,1);return size});
  if(r==='kJm2.KJm7::NIuy')return add(2,(_owner,size)=>size);
  if(r==='kJm2.KJm7::vJOH')return add(1,owner=>({provider:'current',owner}));
  if(r==='kJm2.KJm7::bJOJ')return add(1,owner=>({provider:'base',owner}));
  if(r==='xtod.jtoq::O5Gq'||r==='xtod.jtoq::P5GO')return add(2,(p,value)=>trace.push({write:p.provider,key:r.endsWith('O5Gq')?101:105,value}),false);
  if(r==='TypeSpecification:1B000328::ltAo')return add(3,(p,key,value)=>trace.push({write:p.provider,key,value}),false);
  if(r==='TypeSpecification:1B000328::TtoG')return add(2,(p,key)=>trace.push({call:'invalidate-provider',provider:p.provider,key}),false);
  if(r==='kJm2.KJm7::WJpV')return add(2,(_owner,keys)=>trace.push({call:'clear-adaptive-property-keys',keys}),false);
  if(r==='TypeSpecification:1B000176::.ctor')return add(1,key=>({key}));
  if(r==='kJm2.KJm7::aJmX')return add(3,()=>trace.push({call:'notify-property'}),false);
  if(r==='TypeSpecification:1B000CCF::.ctor')return add(2,()=>({event:'location'}));
  if(r==='kJm2.KJm7::OnLocationChanged'||r==='kJm2.KJm7::dIuu'||r==='kJm2.KJm7::EIuw')return add(2,()=>trace.push({call:r.split('::')[1]}),false);
  throw Error(`Unmodelled external call ${r} at ${m.Token}/${ins.Offset}`);
 };
 while(pc<code.length){assert(++count<1000,'Bound exceeded');const i=code[pc++],op=i.Op;const branch=()=>{assert(indices.has(i.Operand));pc=indices.get(i.Operand)};
  if(op==='br'||op==='br.s'){branch();continue}
  if(op.startsWith('ldarg.')&&op!=='ldarg.s'){stack.push(args[Number(op.slice(6))]);continue}
  if(op==='ldarg.s'||op==='ldarg'){stack.push(args[i.Operand]);continue}
  if(op==='ldarga.s'||op==='ldarga'){stack.push(ref(args,i.Operand));continue}
  if(op==='starg.s'){args[i.Operand]=stack.pop();continue}
  if(op.startsWith('ldloc.')&&op!=='ldloc.s'){stack.push(locals[Number(op.slice(6))]);continue}
  if(op==='ldloc.s'){stack.push(locals[i.Operand]);continue}
  if(op==='ldloca.s'){stack.push(ref(locals,i.Operand));continue}
  if(op.startsWith('stloc.')){locals[op==='stloc.s'?i.Operand:Number(op.slice(6))]=stack.pop();continue}
  if(op.startsWith('ldc.i4')){stack.push(op==='ldc.i4'||op==='ldc.i4.s'?i.Operand:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue}
  if(op==='ldc.r8'){stack.push(i.Operand);continue}
  if(op==='ldsfld'){stack.push(i.Resolved==='System.EventArgs::Empty'?{}:{module:true});continue}
  if(op==='ldfld'){const o=stack.pop();assert(o.module);assert(fields.has(i.Operand));stack.push(fields.get(i.Operand).value);continue}
  if(op==='brtrue'||op==='brfalse'){const b=!!stack.pop();if(b===(op==='brtrue'))branch();continue}
  if(['beq','bne.un'].includes(op)){const b=stack.pop(),a=stack.pop();if((a===b)===(op==='beq'))branch();continue}
  if(['add','sub','xor','ceq'].includes(op)){const b=stack.pop(),a=stack.pop();stack.push(op==='add'?a+b:op==='sub'?a-b:op==='xor'?a^b:a===b);continue}
  if(op==='ldnull'){stack.push(null);continue}
  if(op==='dup'){stack.push(stack.at(-1));continue}
  if(op==='pop'){stack.pop();continue}
  if(op==='box'||op==='nop')continue;
  if(op==='newarr'){stack.push(new Array(stack.pop()));continue}
  if(op==='stelem.i4'){const v=stack.pop(),index=stack.pop(),arr=stack.pop();arr[index]=v;continue}
  if(op==='call'||op==='callvirt'||op==='newobj'){call(i);continue}
  if(op==='ret')return token===100718006?stack.pop():undefined;
  throw Error(`Unsupported ${op} in ${token} at ${i.Offset}`);
 }
 throw Error('No return');
}
function check(name,fn){const observed=fn();results.push({name,observed});}
for(const [name,value,other,overridden,indeterminate,otherIndeterminate,cap,expected] of [
 ['same effective scalar',12,12,true,false,false,true,false],
 ['changed scalar',13,12,true,false,false,true,true],
 ['same point', {x:20,y:70},{x:20,y:70},true,false,false,true,false],
 ['only x changed is a whole point',{x:21,y:70},{x:20,y:70},true,false,false,true,true],
 ['unoverridden request',13,12,false,false,false,true,false],
 ['indeterminate request',13,12,true,true,false,true,false],
 ['indeterminate current same value',12,12,true,false,true,true,true],
 ['capability rejects changed request',13,12,true,false,false,false,false],
])check(name,()=>{const requested={name:101,value,overridden,indeterminate};const output=replay(100718006,[requested,{value:other,indeterminate:otherIndeterminate},cap]);assert.equal(output!=null,expected);if(output)assert.deepEqual(output.value,value);return {requested,current:other,currentIndeterminate:otherIndeterminate,capability:cap,edit:output??null}});
const owner={location:{x:20,y:70},size:{width:100,height:80}};
for(const [name,token,value,all,key] of [
 ['same location All Views',100695349,{x:20,y:70},true,101],
 ['changed X All Views',100695349,{x:21,y:70},true,101],
 ['changed X current view',100695349,{x:21,y:70},false,101],
 ['same size All Views',100695365,{width:100,height:80},true,105],
 ['changed width All Views',100695365,{width:101,height:80},true,105],
 ['changed width current view',100695365,{width:101,height:80},false,105]
])check(name,()=>{const trace=[];replay(token,[owner,value,all,false,null],trace);const changed=!equal(key===101?owner.location:owner.size,value);const writes=trace.filter(x=>x.write);assert.equal(writes.length,changed?1:0);if(changed){assert.deepEqual(writes[0],{write:all?'base':'current',key,value});assert.equal(trace.some(x=>x.call==='clear-adaptive-property-keys'),all)}return {value,allViews:all,trace}});
const atomics=[];const meta=readJson('research/adaptive-all-views-metadata.json').records.find(x=>x.name==='ituB');const setters=readJson('research/adaptive-all-views-properties-cil.json').Types[0].Methods;
for(const name of ['Location','Size','Fill','BorderFill','CornerRadius','CornerVisibility','BorderWidth','BorderVisibility','PaddingLeft','PaddingTop','PaddingRight','PaddingBottom','LineEnds','IxStyles','OuterShadow','InnerShadow','TextShadow']){
 const prop=meta.properties.find(x=>x.name===name),m=setters.find(x=>x.Token===prop.setter),index=m.Instructions.findIndex(x=>x.Resolved==='JtTZ.WtTU::YtTy');assert(index>=0);const prefix=m.Instructions.slice(0,index),start=prefix.findLastIndex(x=>x.Op==='ldarg.0'),chunk=prefix.slice(start),literal=chunk[1];assert(literal.Op.startsWith('ldc.i4'));const key=literal.Op==='ldc.i4'||literal.Op==='ldc.i4.s'?literal.Operand:Number(literal.Op.slice(7));atomics.push({name,key,setter:prop.setter,il:chunk.map(x=>x.Offset),carrier:chunk.find(x=>x.Op==='box')?.Resolved??'reference value'});
}
assert.deepEqual(atomics.map(x=>x.key),[101,105,7,8,71,81,15,80,11,12,13,14,17,21,72,73,74]);
const files=[...sources,'research/adaptive-all-views-metadata.json','research/adaptive-all-views-properties-cil.json','research/adaptive-placement-authoring-owner-cil.json','research/gradient-angle-flow-init-cil.json','research/gradient-angle-static-flow.mjs'];
const report={schema:1,method:'Bounded static CIL instruction replay, not DLL execution or original GUI',assemblySha256:readJson(sources[0]).SHA256,limitations:['GetEdit object equality modelled structurally for scalar/Point examples; no claim for every arbitrary custom object equality.','Geometry external provider, min-size/scale constraint and event calls are explicit sinks; cases use ordinary non-contained, scale=1, allowed sizes.','clear-adaptive-property-keys is a sink; all-map iteration proven separately by WJpV retained CIL, not simulated as native execution.','No GUI input/drag/undo dispatch was executed.'],sources:files.map(path=>({path,sha256:sha256(path)})),results,atomics};
fs.writeFileSync('research/adaptive-all-views-static-probe.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:results.length,atomicProperties:atomics.length}));
