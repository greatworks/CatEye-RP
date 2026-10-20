import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readJson,fields,sha256} from './gradient-angle-static-flow.mjs';
const files=['research/layer-resize-pins-unlinked-style-cil.json','research/layer-resize-pins-linked-predicate-cil.json'];
const methods=new Map(files.flatMap(file=>readJson(file).Types.flatMap(t=>t.Methods)).map(m=>[m.Token,m]));
const DEFAULT_GUID=Object.freeze({defaultGuid:true}),DEFAULT_STYLE=Object.freeze({nativeDefaultStyle:true}),traces=[];
function run(token,args){
 const method=methods.get(token),il=method.Instructions,at=new Map(il.map((i,n)=>[i.Offset,n])),stack=[],locals=[],trace=[];
 let pc=0,steps=0;const pop=()=>{assert(stack.length);return stack.pop()};
 while(pc<il.length){
  assert(++steps<400);const i=il[pc++],op=i.Op,v=i.Operand;trace.push(i.Offset);
  const jump=()=>{assert(at.has(v));pc=at.get(v)};
  if(op==='br'||op==='br.s'){jump();continue}
  if(op==='ldnull'){stack.push(null);continue}
  if(op.startsWith('ldc.i4')){stack.push(op==='ldc.i4'||op==='ldc.i4.s'?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue}
  if(op.startsWith('ldarg.')){stack.push(args[op==='ldarg.s'?v:Number(op.slice(6))]);continue}
  if(op==='ldloc.s'){stack.push(locals[v]);continue}
  if(op==='stloc.s'){locals[v]=pop();continue}
  if(op==='sub'){const b=pop();stack.push(pop()-b);continue}
  if(op==='ceq'){const b=pop();stack.push(Number(pop()===b));continue}
  if(op==='beq'){const b=pop();if(pop()===b)jump();continue}
  if(op==='brtrue'||op==='brfalse'){const a=pop();if(op==='brtrue'?a:!a)jump();continue}
  if(op==='ldsfld'){
   if(v===67142340)stack.push({module:true});
   else if(v===67132971)stack.push(DEFAULT_GUID);
   else if(v===67132875)stack.push(DEFAULT_STYLE);
   else throw Error('Unknown static field '+v);
   continue;
  }
  if(op==='ldfld'){assert(pop().module);assert(fields.has(v));stack.push(fields.get(v).value);continue}
  if(op==='ret'){assert.equal(stack.length,1);const value=pop();traces.push({token,trace});return value}
  if(op==='call'||op==='callvirt'){
   switch(v){
    case 100717259: stack.push(pop().p0??null);break;
    case 100717956: stack.push(run(v,[pop()]));break;
    case 100717988: {const b=pop();stack.push(pop()!==b);break}
    case 100717984: stack.push(Number(pop().overridden));break;
    case 100717982: stack.push(Number(pop().indeterminate));break;
    case 167780105: stack.push(pop().value);break;
    case 167772400: {const b=pop();stack.push(pop()===b);break}
    case 100717244: stack.push(pop().sheet);break;
    case 167777484: {assert.equal(pop(),1);const id=pop();stack.push(pop().get(id)??null);break}
    default: throw Error('Unmodeled call '+v);
   }continue;
  }
  throw Error('Unmodeled instruction '+op);
 }
 throw Error('No return');
}
const linked={resolvedStyle:true},sheet=new Map([['named',linked]]),cases=[
 ['absent P0',undefined,null],['inactive P0',{value:'named',overridden:false,indeterminate:false},null],
 ['indeterminate P0',{value:'named',overridden:true,indeterminate:true},null],
 ['explicit named style',{value:'named',overridden:true,indeterminate:false},linked],
 ['default sentinel P0',{value:DEFAULT_GUID,overridden:true,indeterminate:false},null],
 ['missing named style',{value:'absent',overridden:true,indeterminate:false},null],
];
const results=cases.map(([name,p0,expected])=>{const value=run(100717432,[{p0,sheet}]);assert.equal(value,expected,name);return {name,p0:p0??null,value}});
assert.equal(run(100717243,[{}]),DEFAULT_STYLE);
const report={originalDllExecuted:false,originalGuiExecuted:false,total:7,failed:0,results,traces,
 contract:'Absent, inactive or indeterminate P0 has no linked base. The concrete default getter returns the native static default style. Actual stylesheet lookup and the opaque sentinel GUID are explicit data sinks; its bytes are not guessed.',
 sources:[...files,'research/layer-resize-pins-unlinked-replay.mjs','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json'].map(file=>({file,sha256:sha256(file)}))};
fs.writeFileSync('research/layer-resize-pins-unlinked-replay.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({total:report.total,failed:0}));
