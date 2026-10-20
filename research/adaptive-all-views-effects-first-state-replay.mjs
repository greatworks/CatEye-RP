// Replay only the observed empty-map branch from stored CIL. No target execution.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readJson,fields,sha256} from './gradient-angle-static-flow.mjs';
const files=['state-commit','provider','provider-set'].map(n=>'research/adaptive-all-views-effects-'+n+'-cil.json');
const methods=new Map(files.flatMap(f=>readJson(f).Types.flatMap(t=>t.Methods)).map(m=>[m.Name,m]));
function run(name,args,trace){
 const m=methods.get(name),stack=[],locals=[],index=new Map(m.Instructions.map((i,n)=>[i.Offset,n]));let pc=0,steps=0;
 const pop=()=>{assert.ok(stack.length,'stack underflow '+name);return stack.pop()};
 while(pc<m.Instructions.length){assert.ok(++steps<2000);const i=m.Instructions[pc++],op=i.Op,v=i.Operand;trace.push({method:name,il:i.Offset});const jump=()=>{assert.ok(index.has(v));pc=index.get(v)};
  if(op==='br'||op==='br.s'){jump();continue}
  if(op.startsWith('ldc.i4')){stack.push(op==='ldc.i4'||op==='ldc.i4.s'?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue}
  if(op.startsWith('ldarg.')){stack.push(args[op==='ldarg.s'?v:Number(op.slice(6))]);continue}
  if(op.startsWith('ldloc.')){stack.push(locals[op==='ldloc.s'?v:Number(op.slice(6))]);continue}
  if(op.startsWith('stloc.')){locals[op==='stloc.s'?v:Number(op.slice(6))]=pop();continue}
  if(op==='sub'){const b=pop();stack.push(pop()-b);continue}
  if(op==='beq'||op==='bne.un'){const b=pop(),a=pop();if(op==='beq'?a===b:a!==b)jump();continue}
  if(op==='brtrue'||op==='brfalse'){const a=pop();if(op==='brtrue'?!!a:!a)jump();continue}
  if(op==='ldsfld'){assert.match(i.Resolved,/<Module>/);stack.push({module:true});continue}
  if(op==='ldfld'){assert.equal(pop().module,true);assert.ok(fields.has(v));stack.push(fields.get(v).value);continue}
  if(op==='box')continue;
  if(op==='ret'){assert.equal(stack.length,0,name+' void return');return}
  if(op==='call'||op==='callvirt'){
   const c=i.Resolved;
   if(c==='kJm2.KJm7::lJOC'){stack.push(pop().effectiveMap);continue}
   if(c==='wtXX.FtXa::ftXp'){stack.push(Object.values(pop()).every(v=>v===null));continue}
   if(c==='kJm2.KJm7::vJOH'){stack.push(pop().provider);continue}
   if(c==='wtXX.FtXa::StXm'){const value=pop(),state=pop();stack.push({[state]:value});continue}
   if(c==='xtod.jtoq::N5VF'){const value=pop(),provider=pop();run('N5VF',[provider,value],trace);continue}
   if(c==='TypeSpecification:1B000328::ltAo'){const value=pop(),key=pop(),provider=pop();run('ltAo',[provider,key,value],trace);continue}
   if(c==='TypeSpecification:1B001242::utoB'){assert.equal(pop(),21);stack.push(pop().currentProp);continue}
   if(c==='J5jB.e5jG::v5jI'){stack.push(pop().indeterminate);continue}
   if(c==='J5jB.e5jG::o5jJ'){const v=pop();stack.push(JSON.stringify(pop().value)===JSON.stringify(v));continue}
   if(c==='TypeSpecification:1B001242::htoW'){const provider=pop();stack.push(provider.chain[provider.index]);continue}
   if(c==='JtTZ.WtTU::YtTy'){assert.equal(pop(),0);const value=pop(),key=pop(),style=pop();style[key]=value;continue}
   if(c==='TypeSpecification:1B001242::Otoj'){assert.equal(pop(),1);const key=pop(),provider=pop();provider.currentProp={value:provider.chain[provider.index][key],indeterminate:false};continue}
   if(c==='TypeSpecification:1B001242::ltAQ'){const key=pop(),provider=pop();provider.notifications.push(key);continue}
   throw Error('Unmodelled branch '+c);
  }
  throw Error('Unmodelled opcode '+op);
 }
 throw Error('Missing return '+name);
}
const results=[];
for(const editAll of [false,true]){
 const current={},base={},sibling={21:{1:{props:[[6,'sibling-cyan']]}}};
 const beforeSibling=structuredClone(sibling),beforeBase=structuredClone(base),effect={props:[[6,'new-red']]};
 const widget={editAll,effectiveMap:{1:null,2:null,8:null,64:null,32:null,4:null,16:null},provider:{index:0,chain:[current,base],currentProp:{value:{},indeterminate:false},notifications:[]}};
 const trace=[];run('YrgK',[widget,8,effect],trace);
 assert.deepEqual(current,{21:{8:effect}});assert.deepEqual(base,beforeBase);assert.deepEqual(sibling,beforeSibling);
 assert.deepEqual(widget.provider.notifications,[21]);
 assert.ok(trace.some(t=>t.method==='YrgK'&&t.il===46));assert.ok(!trace.some(t=>t.method==='YrgK'&&t.il===168));
 results.push({name:`first effect with EditAllAdaptive=${editAll}`,editAll,current,base,sibling,notifications:widget.provider.notifications,trace});
}
const output={method:'Bounded retained-CIL replay of YrgK -> N5VF -> ltAo first-state branch, with declared ordinary current provider; not original DLL or GUI',passed:results.length,count:results.length,sources:files.map(file=>({file,sha256:sha256(file)})),stubs:{provider:'ordinary current chain index0, as independently inspected factory/constructor; no temporary effect-preview override',property:'current effective P21 map has all seven entries null; comparator exact record equality only',notification:'records key21; separately inspected dJpF cache/change path, not original event subscribers or UI execution'},cases:results};
fs.writeFileSync('research/adaptive-all-views-effects-first-state-replay.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify({passed:results.length}));
