// Interpret retained instructions with explicit property/enumerator data sinks.
// Does not load or run Axure assemblies, UI, or its serialized object model.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { readJson, fields, sha256 } from './gradient-angle-static-flow.mjs';
const input='research/layer-resize-pins-resolution-cil.json';
const method=readJson(input).Types.flatMap(t=>t.Methods).find(m=>m.Token===100717642);
const at=new Map(method.Instructions.map((i,n)=>[i.Offset,n]));
function replay(provider,key,skipIndeterminate=false){
 const args=[provider,key,skipIndeterminate], locals=[], stack=[], trace=[], calls=[];
 let pc=0,steps=0;
 const pop=()=>{assert(stack.length,'stack underflow');return stack.pop()};
 const deref=v=>v?.ref!==undefined?locals[v.ref]:v;
 while(pc<method.Instructions.length){
  assert(++steps<3000,'instruction budget');const i=method.Instructions[pc++],op=i.Op,v=i.Operand;trace.push(i.Offset);
  const jump=(offset=v)=>{assert(at.has(offset));pc=at.get(offset)};
  if(op==='br'||op==='br.s'||op==='leave'){jump();continue}
  if(op==='nop'||op==='constrained.'||op==='box'||op==='unbox.any')continue;
  if(op==='ldnull'){stack.push(null);continue}
  if(op==='dup'){const a=pop();stack.push(a,a);continue}
  if(op==='pop'){pop();continue}
  if(op==='ldloca.s'){stack.push({ref:v});continue}
  if(op==='ldarga.s'){stack.push(args[v]);continue}
  if(op.startsWith('ldarg.')){stack.push(args[op==='ldarg.s'?v:Number(op.slice(6))]);continue}
  if(op.startsWith('ldloc.')){stack.push(locals[op==='ldloc.s'?v:Number(op.slice(6))]);continue}
  if(op.startsWith('stloc.')){locals[op==='stloc.s'?v:Number(op.slice(6))]=pop();continue}
  if(op.startsWith('ldc.i4')){stack.push(op==='ldc.i4'||op==='ldc.i4.s'?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue}
  if(op==='sub'){const b=pop();stack.push(pop()-b);continue}
  if(op==='xor'){const b=pop();stack.push(pop()^b);continue}
  if(op==='beq'){const b=pop();if(pop()===b)jump();continue}
  if(op==='brtrue'||op==='brfalse'){const a=pop();if(op==='brtrue'?a:!a)jump();continue}
  if(op==='ldsfld'){assert.equal(v,67142340);stack.push({module:true});continue}
  if(op==='ldfld'){assert(pop().module);assert(fields.has(v));stack.push(fields.get(v).value);continue}
  if(op==='ret'){assert.equal(stack.length,1);return {value:pop(),trace,calls}}
  if(op==='call'||op==='callvirt'){
   calls.push({il:i.Offset,token:v});
   switch(v){
    case 100732102: pop();stack.push('diagnostic-literal');break;
    case 167772224: stack.push(String(deref(pop())));break;
    case 167772192: {const b=pop();stack.push(String(pop())+b);break}
    case 167786364: {const p=pop();stack.push({items:p.styles,index:-1});break}
    case 167786365: {const e=deref(pop());stack.push(++e.index<e.items.length);break}
    case 167786367: {const e=deref(pop());stack.push(e.items[e.index]);break}
    case 721424171: stack.push(pop().styles.at(-1));break;
    case 167795079: stack.push(pop().defaultStyle);break;
    case 167795078: stack.push(pop().capability);break;
    case 167795080: stack.push(pop().nullable);break;
    case 100724969: {assert.equal(pop(),null);assert.equal(pop(),key);stack.push(pop());break}
    case 100717163: {const k=pop(),s=pop();stack.push(s.props[k]??null);break}
    case 100717183: stack.push(pop().base??null);break;
    case 100716800: case 100717988: {const b=pop();stack.push(pop()!==b);break}
    case 100717984: stack.push(pop().overridden);break;
    case 100717982: stack.push(pop().indeterminate);break;
    case 100718004: {const capability=pop(),p=pop();stack.push(capability&&p.supported!==false);break}
    case 167772304: pop();break;
    default: throw Error(`Unmodeled dependency ${v}: ${i.Resolved}`);
   }
   continue;
  }
  throw Error(`Unmodeled instruction ${i.Offset} ${op}`);
 }
 throw Error('No return');
}
const prop=(tag,value,overridden=true,indeterminate=false,supported=true)=>({tag,value,overridden,indeterminate,supported});
const style=(p,base=null)=>({props:p?{106:p}:{},base});
const defaults=style(prop('native-default',0));
const run=(name,styles,expected,{capability=true,nullable=false,skipIndeterminate=false}={})=>{
 const result=replay({styles,capability,nullable,defaultStyle:defaults},106,skipIndeterminate);
 assert.equal(result.value?.tag??null,expected,name);
 return {name,inputs:{styles,capability,nullable,skipIndeterminate},expected,actual:result.value,trace:result.trace,calls:result.calls};
};
const results=[
 run('first local overridden wins',[style(prop('local',4)),style(prop('ancestor',1))],'local'),
 run('inactive local does not mask ancestor',[style(prop('local',4,false)),style(prop('ancestor',1))],'ancestor'),
 run('linked base is read before next ancestor',[style(null,style(prop('linked',256))),style(prop('ancestor',1))],'linked'),
 run('inactive linked base is skipped',[style(null,style(prop('linked',256,false))),style(prop('ancestor',1))],'ancestor'),
 run('unsupported local is skipped',[style(prop('local',4,true,false,false)),style(prop('ancestor',1))],'ancestor'),
 run('no local or linked override uses default',[style(null)],'native-default'),
 run('nullable no result returns null',[style(null)],null,{nullable:true}),
 run('no capability returns last provider slot',[style(prop('local',4)),style(prop('last',1,false))],'last',{capability:false}),
 run('no capability and absent last uses default',[style(prop('local',4)),style(null)],'native-default',{capability:false}),
 run('normal get_Item does not skip an indeterminate property',[style(prop('indeterminate',4,true,true)),style(prop('ancestor',1))],'indeterminate'),
 run('explicit skip-indeterminate read reaches ancestor',[style(prop('indeterminate',4,true,true)),style(prop('ancestor',1))],'ancestor',{skipIndeterminate:true}),
 run('explicit zero overrides inherited nonzero',[style(prop('zero',0)),style(prop('ancestor',256))],'zero'),
];
// Bind all four native default entries to their actual cctor instruction spans.
const defaultFile='research/layer-resize-pins-style-default-cil.json';
const init=readJson(defaultFile).Types.flatMap(t=>t.Methods).find(m=>m.Token===100717199);
const defaultEntries=[106,107,108,109].map(key=>{
 const n=init.Instructions.findIndex(i=>i.Op==='ldc.i4.s'&&i.Operand===key);
 const span=init.Instructions.slice(n,n+4);
 assert.equal(span[1].Op,'ldc.i4.0');
 assert.equal(span[2].Op,'box');assert.equal(span[3].Operand,167795017);
 return {key,value:key<108?0:false,offsets:span.map(i=>i.Offset),boxedType:span[2].Resolved};
});
const sources=[input,defaultFile,'research/layer-resize-pins-concrete-build-cil.json','research/layer-resize-pins-chain-helpers-cil.json','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',import.meta.filename.replaceAll('\\','/').split('/REA/').at(-1)].map(file=>({file,sha256:sha256(file)}));
const output={originalDllExecuted:false,originalGuiExecuted:false,method:method.Token,
 description:'Bounded HtoV instruction interpretation. Enumerators, effective provider order, linked styles, property flags and capability predicates are explicit plain-data sinks; no cache serialization mapping is assumed.',
 limits:['Provider order construction and cached style identity resolution are not replayed here.','Capability predicate is supplied, not inferred by widget kind.','An indeterminate property is retained as such; a value must not be invented by import.','Exception/finally disposal has no state mutation in the plain iterator sinks.'],
 defaultEntries,total:results.length+defaultEntries.length,failed:0,results,sources};
fs.writeFileSync('research/layer-resize-pins-chain-replay.json',JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({total:output.total,failed:0,defaults:defaultEntries.map(({key,value})=>({key,value}))}));
