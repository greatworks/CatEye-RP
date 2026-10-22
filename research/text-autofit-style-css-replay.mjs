// Research-only bounded CIL replay: no original assembly load, no font/DOM measurement.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fields,readJson,sha256} from './gradient-angle-static-flow.mjs';
import {decodeLiteral} from './text-autofit-native-literals.mjs';
const sources=['research/text-autofit-native-child-css-cil.json','research/text-autofit-native-child-selector-cil.json','research/font-size-runtime-rect-values-cil.json','research/font-size-runtime-rect-css-cil.json','research/font-size-runtime-layout-writer-cil.json','research/text-autofit-style-extra-css-cil.json','research/text-autofit-style-modes-cil.json','research/font-size-runtime-textrect-layout-cil.json'];
const methods=new Map(sources.flatMap(file=>readJson(file).Types.flatMap(t=>t.Methods)).map(m=>[m.Name,m]));
export function replay(name,args,output={calls:[],trace:[]}){
 const method=methods.get(name),s=[],l=[],at=new Map(method.Instructions.map((i,n)=>[i.Offset,n]));let pc=0,steps=0;
 const pop=()=>{assert.ok(s.length,`${name} stack underflow`);return s.pop()};
 const deref=x=>x?.local!==undefined?l[x.local]:x?.arg!==undefined?args[x.arg]:x?.field!==undefined?x.object[x.field]:x;
 while(pc<method.Instructions.length){assert.ok(++steps<3000);const i=method.Instructions[pc++],op=i.Op,n=i.Operand;output.trace.push({method:name,il:i.Offset});
  const jump=()=>{assert.ok(at.has(n));pc=at.get(n)};
  if(['br','br.s','leave','leave.s'].includes(op)){jump();continue}if(['nop','box','constrained.'].includes(op))continue;
  if(op==='ldnull'){s.push(null);continue}if(op==='pop'){pop();continue}
  if(op==='initobj'){const ref=pop();assert.ok(ref.local!==undefined);l[ref.local]=null;continue}
  if(op==='ldarga.s'){s.push({arg:n});continue}if(op==='ldloca.s'){s.push({local:n});continue}
  if(op==='ldflda'){s.push({object:pop(),field:i.Resolved.split('::')[1]});continue}
  if(op.startsWith('ldarg.')){s.push(args[op==='ldarg.s'?n:Number(op.slice(6))]);continue}
  if(op.startsWith('ldloc.')){s.push(l[op==='ldloc.s'?n:Number(op.slice(6))]);continue}
  if(op.startsWith('stloc.')){l[op==='stloc.s'?n:Number(op.slice(6))]=pop();continue}
  if(op.startsWith('ldc.i4')){s.push(op==='ldc.i4'||op==='ldc.i4.s'?n:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue}
  if(op==='ldc.r8'){s.push(n);continue}if(op==='ldstr'){s.push(i.Resolved??n);continue}if(op==='dup'){s.push(s.at(-1));continue}
  if(op==='newarr'){const length=pop();assert.ok(length>=0&&length<=4);s.push(Array(length));continue}
  if(op==='stelem.ref'){const value=pop(),index=pop(),array=pop();array[index]=value;continue}
  if(op==='ldsfld'){s.push({module:true});continue}if(op==='ldfld'){const obj=pop();if(obj.module){assert.ok(fields.has(n));s.push(fields.get(n).value)}else s.push(obj[i.Resolved.split('::')[1]]);continue}
  if(op==='isinst'){const value=pop();s.push(i.Resolved.endsWith('VectorShape')&&value?.type==='vector'?value:null);continue}
  if(op==='neg'){s.push(-pop());continue}if(op==='not'){s.push(~pop());continue}
  if(['add','sub','div','xor','shl','shr'].includes(op)){const b=pop(),a=pop();s.push(op==='add'?a+b:op==='sub'?a-b:op==='div'?a/b:op==='xor'?a^b:op==='shl'?a<<b:a>>b);continue}
  if(op==='beq'){const b=pop(),a=pop();if(a===b)jump();continue}
  if(op==='brtrue'||op==='brfalse'){const value=pop();if(op==='brtrue'?!!value:!value)jump();continue}
  if(op==='newobj'&&['TypeSpecification:1B0000B0::.ctor','.mSiO::.ctor'].includes(i.Resolved)){s.push({});continue}
  if(op==='newobj'&&i.Resolved==='m5wr.f5wV::.ctor'){const y=pop(),x=pop();s.push({x,y});continue}
  if(op==='call'||op==='callvirt'){
   const callee=i.Resolved;output.calls.push({method:name,il:i.Offset,callee});
   if(callee==='wIhA.zIhQ::sIho'){s.push(decodeLiteral(pop()));continue}
   if(callee==='RtnB.ztnG::op_Inequality'){const b=pop(),a=pop();s.push(a!==b);continue}
   if(callee==='Axure.DocumentModel.Objects.VectorShape::IN4v'){assert.equal(pop(),0);pop();s.push(false);continue}
   if(callee==='uNL7.JNLP::xNKd'){s.push(replay('xNKd',[pop()],output).returnValue);continue}
   if(callee==='h5uH.j5u5::Y5s3'){const r=deref(pop());s.push(Object.values(r).some(Number.isNaN));continue}
   if(callee.startsWith('.mSiO::')){const v=pop(),cache=pop();cache[callee.split('::')[1]]=v;continue}
   if(callee==='TypeSpecification:1B000E1C::set_Item'){const v=pop(),key=pop();pop()[key]=v;continue}
   if(callee.endsWith('::GetEnumerator')){const obj=deref(pop());s.push({values:Object.entries(obj),index:-1});continue}
   if(callee.endsWith('::MoveNext')){const e=deref(pop());s.push(++e.index<e.values.length);continue}
   if(callee.endsWith('::get_Current')){const e=deref(pop());s.push(e.values[e.index]);continue}
   if(callee==='TypeSpecification:1B0000CB::get_Key'){s.push(deref(pop())[0]);continue}
   if(callee==='TypeSpecification:1B0000CB::get_Value'){s.push(deref(pop())[1]);continue}
   if(callee==='System.IDisposable::Dispose'){pop();continue}
   if(callee==='TypeSpecification:1B0000B0::set_Item'){const value=pop(),key=pop();pop()[key]=value;continue}
   if(callee==='Axure.DocumentModel.Objects.VectorShape::RNnp'){s.push(pop().padding);continue}
   if(callee==='Axure.DocumentModel.Objects.TextRectObject::jNZf'){const owner=pop();assert.equal(owner.shape,0);assert.equal(owner.rotation,0);owner.GNYt={x:0,y:0,width:owner.width,height:owner.height};s.push(owner.width);continue} // Narrow Shape0 DIyx→base size-local rect, independently retained CIL.
   if(callee==='Axure.DocumentModel.Objects.RichTextObject::get_RichTextPanel'){s.push(pop().panel);continue}
   if(callee==='Axure.DocumentModel.Objects.TextPanel::get_Height'){s.push(pop().rect.height);continue}
   if(callee==='Axure.DocumentModel.Objects.TextRectObject::get_HeightPadding'){const owner=pop();s.push(owner.padding[0]+owner.padding[2]);continue}
   if(callee==='Axure.DocumentModel.Objects.RichTextPanel::LNOE'){const point=pop(),even=v=>{const f=Math.floor(v),d=v-f;return d===0.5?(f%2===0?f:f+1):Math.round(v)};Object.assign(pop().rect,{x:even(point.x),y:even(point.y)});continue} // LNOE→w5wJ(0,0): Math.Round ToEven; not browser positioning.
   if(callee==='kJm2.KJm7::SJOQ'){s.push(pop().padding[3]);continue}
   if(callee==='kJm2.KJm7::GJOA'){s.push(pop().padding[0]);continue}
   if(callee==='kJm2.KJm7::VJOz'){s.push(pop().padding[2]);continue}
   if(callee==='kJm2.KJm7::OJOl'){s.push(pop().align);continue}
   if(callee==='GSqK.cSqL::Center'){s.push(pop()==='center');continue}if(callee==='GSqK.cSqL::Far'){s.push(pop()==='far');continue}
   const paddingGetter=['g5m7.j5mP::F5mO','g5m7.j5mP::a5mq','g5m7.j5mP::k5mZ','g5m7.j5mP::S5m0'].indexOf(callee);
   if(paddingGetter>=0){s.push(deref(pop())[paddingGetter]);continue}
   if(callee==='cbDk.ebDE::nbDz'){const values=pop(),format=pop();s.push(format.replace(/\{(\d+)\}/g,(_,index)=>values[index]));continue}
   if(callee==='uNL7.JNLP::ENLX'){const params=s.splice(s.length-5,5);replay('ENLX',params,output);continue}
   if(callee==='cbDk.ebDE::GbDa'){const value=pop();assert.equal(value,'','Only empty suffix is in scope');s.push(false);continue}
   if(callee==='System.String::Concat'){const count=i.Offset===92?3:2;s.push(s.splice(s.length-count,count).join(''));continue}
   if(callee==='uNL7.JNLP::RNKP'){const flag=pop(),selector=pop();pop();assert.ok(!flag);output.selector='#'+selector;output.style={};output.rules??=[];output.rules.push({selector:output.selector,style:output.style});continue}
   if(callee==='uNL7.JNLP::gNKh'){const value=pop(),key=pop();pop();output.style[key]=value;continue}
   if(callee==='uNL7.JNLP::bNKX'){const style=pop();pop();Object.assign(output.style,style??{});continue}if(callee==='uNL7.JNLP::BNK2'){pop();continue}
   if(callee==='uNL7.JNLP::TNKD'){replay('TNKD',s.splice(s.length-5,5),output);continue}
   if(callee==='uNL7.JNLP::hNKx'){s.push(replay('hNKx',s.splice(s.length-5,5),output).returnValue);continue}
   if(callee==='uNL7.JNLP::eNLq'){const values=s.splice(s.length-3,3);assert.equal(values[1],null);replay('eNLq',values,output);continue}
   if(callee==='uNL7.JNLP::QNKC'){const prior=pop(),angle=pop();pop();assert.equal(prior,null);assert.equal(angle,0);continue} // Zero rotation, source QNKC branch audited.
   if(callee==='uNL7.JNLP::xNKi'){const prior=pop(),opacity=pop();pop();assert.equal(prior,null);assert.equal(opacity,1);continue} // Identity opacity only.
   if(callee==='h5uH.j5u5::r5uc'){const round=pop(),rect=deref(pop());assert.ok(!round);s.push({...rect});continue}
   const rectKey={'h5uH.j5u5::K5un':'x','h5uH.j5u5::c5u8':'y','h5uH.j5u5::P3j2':'width','h5uH.j5u5::j3jh':'height'}[callee];
   if(rectKey){s.push(deref(pop())[rectKey]);continue}
   if(callee==='cbDk.ebDE::QbLj'){const v=pop();s.push(String(v)+'px');continue} // QbLj100688629 appends px unconditionally; decimal formatting bounded fixtures.
   throw Error(`Out-of-scope call ${callee} at ${i.Offset}`);
  }
  if(op==='ret'){output.returnValue=s.pop();return output}
  throw Error(`Out-of-scope opcode ${op} at ${i.Offset}`);
 }
 throw Error('No ret');
}
