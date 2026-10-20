// Research-only bounded CIL replay: no original assembly load, no font/DOM measurement.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fields,readJson,sha256} from './gradient-angle-static-flow.mjs';
import {decodeLiteral} from './text-autofit-native-literals.mjs';
const sources=['research/text-autofit-native-child-css-cil.json','research/text-autofit-native-child-selector-cil.json','research/font-size-runtime-rect-values-cil.json'];
const methods=new Map(sources.flatMap(file=>readJson(file).Types.flatMap(t=>t.Methods)).map(m=>[m.Name,m]));
function replay(name,args,output={calls:[],trace:[]}){
 const method=methods.get(name),s=[],l=[],at=new Map(method.Instructions.map((i,n)=>[i.Offset,n]));let pc=0,steps=0;
 const pop=()=>{assert.ok(s.length,`${name} stack underflow`);return s.pop()};
 const deref=x=>x?.local!==undefined?l[x.local]:x?.arg!==undefined?args[x.arg]:x;
 while(pc<method.Instructions.length){assert.ok(++steps<3000);const i=method.Instructions[pc++],op=i.Op,n=i.Operand;output.trace.push({method:name,il:i.Offset});
  const jump=()=>{assert.ok(at.has(n));pc=at.get(n)};
  if(op==='br'||op==='br.s'){jump();continue}if(op==='nop'||op==='box')continue;
  if(op==='ldarga.s'){s.push({arg:n});continue}if(op==='ldloca.s'){s.push({local:n});continue}
  if(op.startsWith('ldarg.')){s.push(args[op==='ldarg.s'?n:Number(op.slice(6))]);continue}
  if(op.startsWith('ldloc.')){s.push(l[op==='ldloc.s'?n:Number(op.slice(6))]);continue}
  if(op.startsWith('stloc.')){l[op==='stloc.s'?n:Number(op.slice(6))]=pop();continue}
  if(op.startsWith('ldc.i4')){s.push(op==='ldc.i4'||op==='ldc.i4.s'?n:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue}
  if(op==='ldc.r8'){s.push(n);continue}if(op==='ldstr'){s.push(i.Resolved??n);continue}if(op==='dup'){s.push(s.at(-1));continue}
  if(op==='newarr'){const length=pop();assert.ok(length>=0&&length<=4);s.push(Array(length));continue}
  if(op==='stelem.ref'){const value=pop(),index=pop(),array=pop();array[index]=value;continue}
  if(op==='ldsfld'){s.push({module:true});continue}if(op==='ldfld'){assert.equal(pop().module,true);assert.ok(fields.has(n));s.push(fields.get(n).value);continue}
  if(op==='isinst'){const value=pop();s.push(i.Resolved.endsWith('VectorShape')&&value.type==='vector'?value:null);continue}
  if(op==='neg'){s.push(-pop());continue}if(op==='not'){s.push(~pop());continue}
  if(['add','sub','xor','shl','shr'].includes(op)){const b=pop(),a=pop();s.push(op==='add'?a+b:op==='sub'?a-b:op==='xor'?a^b:op==='shl'?a<<b:a>>b);continue}
  if(op==='beq'){const b=pop(),a=pop();if(a===b)jump();continue}
  if(op==='brtrue'||op==='brfalse'){const value=pop();if(op==='brtrue'?!!value:!value)jump();continue}
  if(op==='newobj'&&i.Resolved==='TypeSpecification:1B0000B0::.ctor'){s.push({});continue}
  if(op==='call'||op==='callvirt'){
   const callee=i.Resolved;output.calls.push({method:name,il:i.Offset,callee});
   if(callee==='wIhA.zIhQ::sIho'){s.push(decodeLiteral(pop()));continue}
   if(callee==='TypeSpecification:1B0000B0::set_Item'){const value=pop(),key=pop();pop()[key]=value;continue}
   if(callee==='Axure.DocumentModel.Objects.VectorShape::RNnp'){s.push(pop().padding);continue}
   if(callee==='kJm2.KJm7::OJOl'){s.push(pop().align);continue}
   if(callee==='GSqK.cSqL::Center'){s.push(pop()==='center');continue}if(callee==='GSqK.cSqL::Far'){s.push(pop()==='far');continue}
   const paddingGetter=['g5m7.j5mP::F5mO','g5m7.j5mP::a5mq','g5m7.j5mP::k5mZ','g5m7.j5mP::S5m0'].indexOf(callee);
   if(paddingGetter>=0){s.push(deref(pop())[paddingGetter]);continue}
   if(callee==='cbDk.ebDE::nbDz'){const values=pop(),format=pop();s.push(format.replace(/\{(\d+)\}/g,(_,index)=>values[index]));continue}
   if(callee==='uNL7.JNLP::ENLX'){const params=s.splice(s.length-5,5);replay('ENLX',params,output);continue}
   if(callee==='cbDk.ebDE::GbDa'){const value=pop();assert.equal(value,'','Only empty suffix is in scope');s.push(false);continue}
   if(callee==='System.String::Concat'){const count=i.Offset===92?3:2;s.push(s.splice(s.length-count,count).join(''));continue}
   if(callee==='uNL7.JNLP::RNKP'){const flag=pop(),selector=pop();pop();assert.equal(flag,false);output.selector='#'+selector;continue}
   if(callee==='uNL7.JNLP::bNKX'){output.style=pop();pop();continue}if(callee==='uNL7.JNLP::BNK2'){pop();continue}
   if(callee==='h5uH.j5u5::r5uc'){const round=pop(),rect=deref(pop());assert.equal(round,false);s.push({...rect});continue}
   const rectKey={'h5uH.j5u5::K5un':'x','h5uH.j5u5::c5u8':'y','h5uH.j5u5::P3j2':'width','h5uH.j5u5::j3jh':'height'}[callee];
   if(rectKey){s.push(deref(pop())[rectKey]);continue}
   if(callee==='cbDk.ebDE::QbLj'){s.push(String(pop()));continue} // Decimal serialization is a sink; integer fixtures only.
   throw Error(`Out-of-scope call ${callee} at ${i.Offset}`);
  }
  if(op==='ret'){output.returnValue=s.pop();return output}
  throw Error(`Out-of-scope opcode ${op} at ${i.Offset}`);
 }
 throw Error('No ret');
}
const results=[];
for(const align of ['near','center','far'])for(const padding of [[0,0,0,0],[1,2,3,4]]){
 const result=replay('nNLd',[{},'u1',{type:'vector',padding,align},false]);
 assert.equal(result.selector,'#u1 .text');
 assert.deepEqual(result.style,{'position':'absolute','align-self':align==='near'?'flex-start':align==='center'?'center':'flex-end','box-sizing':'border-box',padding:padding.map(v=>v+'px').join(' '),width:'100%'});
 results.push({kind:'shape-child-css',align,padding,...result});
}
for(const [width,height]of [[132,-1],[95,27],[-1,27],[-1,-1]]){
 const result=replay('hNKx',[{},{x:0,y:0,width,height},'absolute',null,false]);
 assert.deepEqual(result.returnValue,{position:'absolute',left:'0',top:'0',...(width===-1?{}:{width:String(width)}),...(height===-1?{}:{height:String(height)})});
 results.push({kind:'rectangle-css',width,height,...result});
}
const report={method:'Actual retained nNLd/ENLX/hNKx instructions replayed with bounded allowlisted sinks. No original DLL, GUI, DOM or native font engine executes.',boundaries:['VectorShape only; original RNnp padding and OJOl alignment values supplied at the call boundary.','ENLX empty suffix and default selector flag only.','hNKx prior-style null, rounding disabled, integer fixtures; QbLj number formatting is a sink.','CSS specificity/used geometry is not executed by these checks.'],sources:[...sources,'research/gradient-angle-flow-init-cil.json','research/text-autofit-native-literals.mjs','research/text-autofit-native-css-literals.json'].map(file=>({file,sha256:sha256(file)})),results};
fs.writeFileSync('research/text-autofit-native-child-replay.json',JSON.stringify(report,null,2)+'\n');
console.log(`${results.length}/${results.length} child-selector / dimension-omission CIL cases passed`);
