// Restricted CIL replay of the original rNPL CSS control flow. Geometry measurement is an explicit sink.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fields,readJson,sha256} from './gradient-angle-static-flow.mjs';
import {decodeLiteral} from './text-autofit-native-literals.mjs';
const file='research/shadow-format-form-cil.json',method=readJson(file).Types.flatMap(t=>t.Methods).find(m=>m.Token===100699663);
function replay(autoFitWidth,hideText=false){
 const owner={type:'vector',autoFitWidth,paddingLeft:0,paddingRight:0,rect:{x:800,y:169,width:95,height:27},rotation:0,textRotation:0};
 const panel={rect:{x:0,y:0,width:95,height:27},owner};
 const args=[panel,{},owner,'u1_text',!hideText,false,0,{}],s=[],l=[],trace=[],calls=[];let output;
 const index=new Map(method.Instructions.map((i,n)=>[i.Offset,n]));let pc=0,steps=0;
 const pop=()=>{assert.ok(s.length,'stack nonempty');return s.pop()},deref=x=>x?.local!==undefined?l[x.local]:x;
 while(pc<method.Instructions.length){assert.ok(++steps<2000);const i=method.Instructions[pc++],op=i.Op,n=i.Operand;trace.push(i.Offset);
  const jump=()=>{assert.ok(index.has(n));pc=index.get(n)};
  if(op==='br'||op==='br.s'){jump();continue}
  if(op==='nop')continue;
  if(op==='ldarg.s'||op.startsWith('ldarg.')){s.push(args[op==='ldarg.s'?n:Number(op.slice(6))]);continue}
  if(op==='ldloc.s'){s.push(l[n]);continue}if(op==='stloc.s'){l[n]=pop();continue}if(op==='ldloca.s'){s.push({local:n});continue}
  if(op.startsWith('ldc.i4')){s.push(op==='ldc.i4'||op==='ldc.i4.s'?n:Number(op.slice(7)));continue}if(op==='ldc.r8'){s.push(n);continue}
  if(op==='ldnull'){s.push(null);continue}if(op==='dup'){s.push(s.at(-1));continue}if(op==='pop'){pop();continue}
  if(op==='ldsfld'){if(n===67142340)s.push('module');else if(i.Resolved==='h5uH.j5u5::O5sD')s.push({x:0,y:0,width:0,height:0});else if(i.Resolved==='h5uH.j5u5::D5sx')s.push({x:NaN,y:NaN,width:NaN,height:NaN});else throw Error('Unknown static field');continue}if(op==='ldfld'){assert.equal(pop(),'module');s.push(fields.get(n).value);continue}
  if(op==='isinst'){const v=pop();s.push(i.Resolved.endsWith('VectorShape')||i.Resolved.endsWith('RichTextObject')?v:null);continue}
  if(op==='xor'||op==='sub'||op==='add'||op==='shl'||op==='shr'){const b=pop(),a=pop();s.push(op==='xor'?a^b:op==='sub'?a-b:op==='add'?a+b:op==='shl'?a<<b:a>>b);continue}
  if(op==='beq'){const b=pop(),a=pop();if(a===b)jump();continue}if(op==='brtrue'||op==='brfalse'){const v=pop();if(op==='brtrue'?!!v:!v)jump();continue}
  if(op==='newobj'&&i.Resolved==='TypeSpecification:1B0000B0::.ctor'){s.push({});continue}
  if(op==='call'||op==='callvirt'){
   calls.push({il:i.Offset,callee:i.Resolved,token:n});
   if(i.Resolved==='wIhA.zIhQ::sIho'){s.push(decodeLiteral(pop()));continue}
   if(i.Resolved==='Axure.DocumentModel.Objects.RichTextObject::get_AutoFitWidth'){s.push(pop().autoFitWidth);continue}
   if(i.Resolved==='TypeSpecification:1B0000B0::set_Item'){const value=pop(),key=pop(),dict=pop();dict[key]=value;continue}
   if(i.Resolved==='kJm2.KJm7::qJU9'){pop();s.push({on:false});continue}
   if(i.Resolved==='Y5y4.a5yY::c5yl'){s.push(pop().on);continue}
   if(i.Resolved==='xtod.jtoq::ValueAsObject'){assert.equal(pop(),93);pop();s.push(null);continue}
   if(i.Resolved==='Axure.DocumentModel.Objects.TextRectObject::PNZ8'){assert.equal(pop(),owner);panel.rect={x:0,y:0,width:autoFitWidth?132:95,height:39};continue}
   if(i.Resolved==='Axure.DocumentModel.Objects.TextPanel::get_Rect'){s.push({...pop().rect});continue}
   if(i.Resolved==='h5uH.j5u5::h5ud'){s.push(deref(pop()).x);continue}
   if(i.Resolved==='h5uH.j5u5::P3j2'){s.push(deref(pop()).width);continue}
   if(i.Resolved==='h5uH.j5u5::Q5uO'){const value=pop();deref(pop()).x=value;continue}
   if(i.Resolved==='h5uH.j5u5::z5uY'){const value=pop();deref(pop()).width=value;continue}
   if(i.Resolved==='h5uH.j5u5::B5u4'){const value=pop();deref(pop()).height=value;continue}
   if(i.Resolved==='kJm2.KJm7::SJOQ'){s.push(pop().paddingLeft);continue}
   if(i.Resolved==='kJm2.KJm7::QJOo'){s.push(pop().paddingRight);continue}
   if(i.Resolved==='kJm2.KJm7::mJqo'){s.push(pop().textRotation);continue}
   if(i.Resolved==='kJm2.KJm7::uIuQ'){s.push(pop().rotation);continue}
   if(i.Resolved==='Ebxh.rbx2::TbxU'){const epsilon=pop(),value=pop();s.push(Math.abs(value)<epsilon);continue}
   if(i.Resolved==='uNL7.JNLP::YNKJ'){const ref=pop(),visible=pop();pop();if(!visible)deref(ref).visibility='hidden';continue}
   if(i.Resolved==='uNL7.JNLP::SNLp'){const values=s.splice(s.length-13,13);output={rectangle:values[2],style:values[6],scrollBars:values[9],defaultBorder:values[10],displayFlex:values[11],ownerObject:values[5]};continue}
   throw Error('Unproved call '+i.Resolved+' at '+i.Offset);
  }
  if(op==='ret')return {autoFitWidth,hideText,ownerBounds:owner.rect,output,calls,trace};
  throw Error('Unproved opcode '+op+' at '+i.Offset);
 }
 throw Error('No ret');
}
const results=[];
for(const autoFitWidth of [true,false])for(const hidden of [false,true]){
 const r=replay(autoFitWidth,hidden);
 assert.deepEqual(r.ownerBounds,{x:800,y:169,width:95,height:27});
 assert.equal(r.output.style['white-space'],autoFitWidth?'nowrap':undefined);
 assert.equal(r.output.style['word-wrap'],autoFitWidth?undefined:'break-word');
 assert.equal(r.output.style.visibility,hidden?'hidden':undefined);
 assert.equal(r.output.scrollBars,0);assert.equal(r.output.ownerObject,null);
 assert.equal(r.output.rectangle.width,autoFitWidth?132:95);assert.equal(r.output.rectangle.height,-1);
 assert.equal(r.calls.some(c=>c.callee.endsWith('::PNZ8')),true);
 results.push(r);
}
const report={method:'Bounded static replay of actual rNPL instruction records with statically decoded literals. PNZ8 text measurement and zero-rotation geometry are injected sinks, not original native pixel measurements.',sources:[file,'research/gradient-angle-flow-init-cil.json','research/text-autofit-native-css-literals.json','research/text-autofit-native-literals.mjs'].map(file=>({file,sha256:sha256(file)})),boundaries:['No target assembly load or execution.','Injected measured text size132x39 has no claim to actual Problems font metrics.','Zero rotation, no text shadow, no letter casing, no selection-button branch.','YNKJ visible/hidden sink follows its separately retained CIL; no DOM stylesheet cascade is asserted.'],results};
fs.writeFileSync('research/text-autofit-native-replay.json',JSON.stringify(report,null,2)+'\n');
console.log(`${results.length}/${results.length} rNPL static CSS cases passed`);
