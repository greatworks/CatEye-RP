// Bounded interpretation of retained CIL records, not execution/loading of the original DLL.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fields } from './gradient-angle-static-flow.mjs';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=['research/font-size-runtime-css-cil.json','research/font-size-runtime-conversion-cil.json','research/font-size-runtime-round-cil.json','research/font-style-format-run-base-cil.json'];
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const documents=files.map(read),methods=new Map(documents.flatMap(j=>j.Types.flatMap(t=>t.Methods)).map(m=>[m.Token,m]));
for(const d of documents)assert.equal(d.SHA256,'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
const traces=[];
function run(token,args){
 const method=methods.get(token),il=method.Instructions,index=new Map(il.map((i,n)=>[i.Offset,n])),stack=[],locals=new Map(),trace=[];let pc=0,steps=0;
 const pop=()=>stack.pop(); const jump=offset=>{pc=index.get(offset);assert.notEqual(pc,undefined)};
 while(pc<il.length){if(++steps>5000)throw Error('Step budget');const i=il[pc++],op=i.Op,n=i.Operand;trace.push(i.Offset);
  if(op==='br.s'||op==='br'||op==='leave'){jump(n);continue}
  if(op.startsWith('ldarg.')){stack.push(args[op==='ldarg.s'?n:Number(op.slice(6))]);continue}
  if(op.startsWith('ldc.i4')){stack.push(op==='ldc.i4'||op==='ldc.i4.s'?n:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue}
  if(op==='ldc.r8'){stack.push(n);continue}
  if(op==='ldsfld'){assert.equal(n,67142340);stack.push({module:true});continue}
  if(op==='ldfld'){const owner=pop();if(owner.module)stack.push(fields.get(n).value);else if(n===67129206)stack.push(owner.base);else throw Error('Unproved field '+n);continue}
  if(op==='ldloc.s'){stack.push(locals.get(n));continue}if(op==='stloc.s'){locals.set(n,pop());continue}
  if(op==='ldloca.s'){stack.push({local:n});continue}if(op==='initobj'){locals.set(pop().local,null);continue}
  if(op==='ldnull'){stack.push(null);continue}if(op==='dup'){stack.push(stack.at(-1));continue}
  if(op==='newarr'){stack.push(new Array(pop()));continue}if(op==='stelem.ref'){const v=pop(),k=pop(),a=pop();a[k]=v;continue}
  if(op==='box'){continue}
  if(['sub','xor','mul','div'].includes(op)){const b=pop(),a=pop();stack.push(op==='sub'?a-b:op==='xor'?a^b:op==='mul'?a*b:a/b);continue}
  if(op==='switch'){const value=pop();if(value>=0&&value<n.length)jump(n[value]);continue}
  if(op==='brtrue'||op==='brfalse'){const a=pop();if(op==='brtrue'?Boolean(a):!a)jump(n);continue}
  if(['beq','bgt','bne.un'].includes(op)){const b=pop(),a=pop();if(op==='beq'?a===b:op==='bgt'?a>b:a!==b)jump(n);continue}
  if(op==='newobj'&&n===167775250){continue}
  if(op==='call'||op==='callvirt'){
   if(n===100732102){stack.push({opaqueStringKey:pop()});continue}
   if(n===100688623){const values=pop(),format=pop();stack.push({format,values});continue}
   if(n===100719575){const b=pop(),a=pop();stack.push(run(n,[a,b]));continue}
   if(n===100688822){const mode=pop(),digits=pop(),value=pop();stack.push(run(n,[value,digits,mode]));continue}
   if(n===167786521){const mode=pop(),digits=pop(),value=pop();assert.equal(mode,1);const p=10**digits;stack.push(Math.sign(value)*Math.floor(Math.abs(value)*p+.5)/p);continue}
   if(n===100717956){stack.push(Boolean(pop()?.od));continue}
   if(n===167777551){stack.push(pop().size);continue}
   if(n===100707823){stack.push(pop().size);continue}
   if(n===100688812){const epsilon=pop(),b=pop(),a=pop();stack.push(Math.abs(a-b)<=epsilon);continue}
   throw Error('Unproved call '+n+' '+i.Resolved);
  }
  if(op==='ret'){traces.push({token,arguments:args,offsets:trace});return pop()}
  throw Error('Unproved opcode '+op+' at '+i.Offset);
 }
 throw Error('Missing return');
}
const results=[];
for(const input of [0,.75,9.75,10.5,13.5,15,15.75,16.5,21,24,28.333,384]){
 const output=run(100699304,[input,{unusedContext:true}]);
 assert.equal(output.values[0],Math.round(input*96/72*1000)/1000);
 results.push({name:'HTML font-size formatter numeric operand',input,output});
}
for(const c of [{run:21,base:15,od:true,expected:21},{run:21,base:21,od:true,expected:null},{run:21,base:15,od:false,expected:21},{run:15,base:15,od:true,expected:null},{run:15.75,base:15,od:true,expected:15.75}]){
 const observed=run(100707849,[{size:c.run,base:{size:c.base,od:c.od}},2]);assert.equal(observed,c.expected);results.push({name:'Run ValueAsObject(P2) compares style before emitting raw run size',...c,observed});
}
const out={timestamp:new Date().toISOString(),method:'Bounded static CIL interpretation; original assembly is neither loaded nor executed',sources:files.map(path=>({path,sha256:hash(path)})),dependencies:['research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json'].map(path=>({path,sha256:hash(path)})),boundaries:['sIho returns a symbolic key; CSS literal suffix was not decrypted','Math.Round is independently modelled for tested non-midpoint decimal inputs using AwayFromZero; not exhaustive binary-double tie parity','P2 provider equality sink uses epsilon compare for cases safely away from threshold; no claim for exact epsilon boundary','No original DOM, font metric or auto-fit pixel execution'],results,traces};
fs.writeFileSync('research/font-size-runtime-replay.json',JSON.stringify(out,null,2)+'\n');console.log(`${results.length}/${results.length} static CIL replay cases passed`);
