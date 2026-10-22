// New bounded research replay. Executes retained CIL records, never loads/invokes Axure DLL.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readJson,fields,sha256} from './gradient-angle-static-flow.mjs';
import {decodeLiteral} from './text-autofit-native-literals.mjs';
const sources=['research/text-autofit-dom-writer-cil.json','research/text-autofit-dom-attributes-cil.json','research/text-autofit-dom-close-cil.json','research/text-autofit-dom-shape-dispatch-cil.json','research/text-autofit-native-text-callers-cil.json'];
const methods=new Map(sources.flatMap(f=>readJson(f).Types.flatMap(t=>t.Methods)).map(m=>[m.Name,m]));
function run(name,args,out={trace:[],calls:[],events:[]}){
 const method=methods.get(name),s=[],l=[],at=new Map(method.Instructions.map((i,n)=>[i.Offset,n]));let pc=0,steps=0;
 const pop=()=>{assert.ok(s.length,`${name} stack underflow`);return s.pop()};
 const deref=x=>x?.local!==undefined?l[x.local]:x?.arg!==undefined?args[x.arg]:x?.field!==undefined?x.object[x.field]:x;
 const setref=(x,v)=>{if(x.local!==undefined)l[x.local]=v;else throw Error('Unknown ref')};
 while(pc<method.Instructions.length){assert.ok(++steps<5000,`${name} step limit`);const i=method.Instructions[pc++],op=i.Op,n=i.Operand;out.trace.push({method:name,il:i.Offset});
  const jump=()=>{assert.ok(at.has(n));pc=at.get(n)};
  if(['nop','box','constrained.'].includes(op))continue;
  if(['br','br.s','leave','leave.s'].includes(op)){jump();continue}
  if(op==='ldarga.s'){s.push({arg:n});continue}if(op==='ldloca.s'){s.push({local:n});continue}
  if(op.startsWith('ldarg.')){s.push(args[op==='ldarg.s'?n:Number(op.slice(6))]);continue}
  if(op==='starg.s'){args[n]=pop();continue}
  if(op.startsWith('ldloc.')){s.push(l[op==='ldloc.s'?n:Number(op.slice(6))]);continue}
  if(op.startsWith('stloc.')){l[op==='stloc.s'?n:Number(op.slice(6))]=pop();continue}
  if(op.startsWith('ldc.i4')){s.push(op==='ldc.i4'||op==='ldc.i4.s'?n:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue}
  if(op==='ldc.r8'){s.push(n);continue}if(op==='ldstr'){s.push(i.Resolved??n);continue}if(op==='ldnull'){s.push(null);continue}
  if(op==='dup'){s.push(s.at(-1));continue}if(op==='pop'){pop();continue}
  if(op==='neg'){s.push(-pop());continue}if(op==='not'){s.push(~pop());continue}
  if(['add','sub','xor','shl','shr'].includes(op)){const b=pop(),a=pop();s.push(op==='add'?a+b:op==='sub'?a-b:op==='xor'?a^b:op==='shl'?a<<b:a>>b);continue}
  if(op==='ceq'){const b=pop(),a=pop();s.push(a===b);continue}
  if(op==='beq'){const b=pop(),a=pop();if(a===b)jump();continue}
  if(op==='brtrue'||op==='brfalse'){const v=pop();if(op==='brtrue'?!!v:!v)jump();continue}
  if(op==='ldsfld'){if(fields.has(n))throw Error('Direct module scalar unsupported');s.push(i.Resolved==='fNiZ.FNiU::eN7V'?[]:i.Resolved.includes('::<>9__')?null:i.Resolved===' .<>c::<>9'?{}:{module:true});continue}
  if(op==='stsfld'){pop();continue}
  if(op==='ldfld'){const obj=pop();s.push(obj.module?fields.get(n).value:obj[i.Resolved.split('::')[1]]);continue}
  if(op==='stfld'){const value=pop();pop()[i.Resolved.split('::')[1]]=value;continue}
  if(op==='ldflda'){s.push({object:pop(),field:i.Resolved.split('::')[1]});continue}
  if(op==='isinst'){const v=pop();s.push(i.Resolved.endsWith('VectorShape')&&v?.kind==='shape'?v:null);continue}
  if(op==='ldftn'){s.push({function:n});continue}
  if(op==='newobj'){
   if(i.Resolved==='TypeSpecification:1B0000B0::.ctor')s.push({});
   else if(i.Resolved.startsWith('.<>c__DisplayClass'))s.push({});
   else if(i.Resolved==='cNig.FNi3::.ctor')s.push({image:pop()});
   else if(i.Resolved==='TypeSpecification:1B000CD6::.ctor'){pop();pop();s.push({callback:true});}
   else throw Error('Unsupported ctor '+i.Resolved);continue;
  }
  if(op==='call'||op==='callvirt'){
   const c=i.Resolved;out.calls.push({method:name,il:i.Offset,callee:c});
   if(c==='wIhA.zIhQ::sIho'){s.push(decodeLiteral(pop()));continue}
   if(c==='System.String::IsNullOrEmpty'){const v=pop();s.push(v===null||v===undefined||v==='');continue}
   if(c==='System.String::Concat'){const b=pop(),a=pop();s.push((a??'')+(b??''));continue}
   if(c==='TypeSpecification:1B0000B0::ContainsKey'){const key=pop();s.push(Object.hasOwn(pop(),key));continue}
   if(c==='TypeSpecification:1B0000B0::get_Item'){const key=pop();s.push(pop()[key]);continue}
   if(c==='TypeSpecification:1B0000B0::set_Item'){const value=pop(),key=pop();pop()[key]=value;continue}
   if(c.endsWith('::GetEnumerator')){const v=pop();s.push({items:Array.isArray(v)?v:Object.entries(v),index:-1});continue}
   if(c.endsWith('::MoveNext')){const v=deref(pop());s.push(++v.index<v.items.length);continue}
   if(c.endsWith('::get_Current')){const v=deref(pop());s.push(v.items[v.index]);continue}
   if(c==='TypeSpecification:1B0000CB::get_Key'){s.push(deref(pop())[0]);continue}
   if(c==='TypeSpecification:1B0000CB::get_Value'){s.push(deref(pop())[1]);continue}
   if(c==='System.IDisposable::Dispose'){pop();continue}
   if(c==='TypeSpecification:1B000013::get_HasValue'){s.push(!!deref(pop())?.hasValue);continue}
   if(c==='oNCN.BNCJ::nNCY'){const tag=pop();pop();out.events.push({kind:'open',tag,attributes:{}});continue}
   if(c==='oNCN.BNCJ::MNCS'){const id=pop();pop();s.push(id);continue} // ID prefix sink; no layout meaning.
   if(c==='nNCA.cNCQ::nNiB'){assert.equal(pop(),1);s.push(pop());continue} // Safe ASCII fixture only; no encoder claim.
   if(c==='oNCN.BNCJ::sNCT'){const value=pop(),key=pop();pop();out.events.findLast(e=>e.kind==='open').attributes[key]=value;continue}
   if(c==='oNCN.BNCJ::NNC4'){const compact=pop();pop();out.events.push({kind:'end-open',compact});continue}
   if(c==='oNCN.BNCJ::HNC8'){const compact=pop(),tag=pop();pop();out.events.push({kind:'close',tag,compact});continue}
   if(c==='oNCN.BNCJ::FNCR'){run('FNCR',[pop()],out);continue}
   if(c==='oNCN.BNCJ::DNCg'){const v=s.splice(s.length-9,9);run('DNCg',v,out);continue}
   if(c==='oNCN.BNCJ::UNCe'){const rich=pop();pop();out.events.push({kind:'rich-content',value:rich});continue}
   if(c==='System.Runtime.CompilerServices.DefaultInterpolatedStringHandler::.ctor'){pop();pop();setref(pop(),{text:''});continue}
   if(c.startsWith('System.Runtime.CompilerServices.DefaultInterpolatedStringHandler::Append')){const value=pop();deref(pop()).text+=value;continue}
   if(c==='System.Runtime.CompilerServices.DefaultInterpolatedStringHandler::ToStringAndClear'){s.push(deref(pop()).text);continue}
   const rectKey={'h5uH.j5u5::P3j2':'width','h5uH.j5u5::j3jh':'height','h5uH.j5u5::K5un':'x','h5uH.j5u5::c5u8':'y'}[c];if(rectKey){s.push(deref(pop())[rectKey]);continue}
   if(c==='UNxR.xNxg::nNeE'){s.push(pop().writer);continue}if(c==='UNxR.xNxg::uNeW'){s.push(pop().css);continue}
   if(c==='UNxR.xNxg::WNM9'){pop();s.push(null);continue}if(c==='UNxR.xNxg::INev'){pop();s.push({hasValue:false});continue}
   if(c==='UNxR.xNxg::ENMg'){pop();s.push(false);continue}
   if(c==='UNxR.xNxg::JNxP'){const shape=pop();pop();s.push(shape.id);continue}
   if(c==='uNL7.JNLP::nNKZ'){s.push(pop().idClasses);continue}
   if(c==='UNxR.xNxg::CNeo'){pop();s.push({});continue}if(c==='vtf2.ttf7::ColorSaturation'){pop();s.push(0);continue}
   if(c==='RtnB.ztnG::op_Inequality'){const b=pop(),a=pop();s.push(a!==b);continue}
   if(c==='kJm2.KJm7::nJq3'){pop();s.push(false);continue}
   if(c==='kJm2.KJm7::XJqg'){pop();pop();continue}
   if(c==='kJm2.KJm7::uIuQ'){pop();s.push(0);continue}
   if(c==='kJm2.KJm7::sJpb'){s.splice(s.length-5,5);s.push(null);continue}
   if(c==='kJm2.KJm7::get_HtmlRect'){s.push({...pop().rect});continue}
   if(c==='kJm2.KJm7::get_Text'){s.push(pop().text);continue}
   if(c==='kJm2.KJm7::get_AttributedString'){s.push(pop().text);continue}
   if(c==='Axure.DocumentModel.Objects.RichTextObject::get_RichTextPanel'){s.push(pop().panel);continue}
   if(c==='kJm2.KJm7::lJ0A'){pop();pop();s.push({});continue}
   if(c==='zSaT.kSaf::pSau'){s.push(pop().length>0);continue}
   if(c==='Axure.DocumentModel.Objects.VectorShape::IN4v'){pop();pop();s.push(false);continue}
   if(c==='Axure.DocumentModel.Objects.TextRectObject::VIyK'){pop();pop();s.push(pop().asImage);continue}
   if(c==='Axure.DocumentModel.Objects.TextRectObject::get_Image'){pop();s.push(null);continue}
   if(c==='fNiZ.FNiU::KNP6'){pop();continue}
   if(c==='fNiZ.FNiU::iNPu'){s.splice(s.length-4,4);s.push('asset-sink');continue}
   if(c==='CbiJ.Bbib::lbiN<generic>'){pop();pop();s.push([]);continue} // No IX variants in controlled case.
   if(c==='fNiZ.FNiU::rNPL'){s.splice(s.length-8,8);out.events.push({kind:'text-css-sink'});continue}
   if(c==='nNCA.cNCQ::ONiF'){pop();pop();pop();pop();s.push(pop());continue} // Rich payload stays opaque.
   if(c==='fNiZ.FNiU::fNPD'){run('fNPD',s.splice(s.length-3,3),out);continue}
   if(c==='fNiZ.FNiU::sNP3'||c==='fNiZ.FNiU::nNPR'){
    // This call boundary is independently audited against the retained four call-site slices.
    const v=s.splice(s.length-(c.endsWith('sNP3')?9:7),c.endsWith('sNP3')?9:7),[shape,context,rect,id]=v;
    out.events.push({kind:'shape-writer-boundary',branch:c,rect,id});
    run('DNCg',[context.writer,id,'resolved-owner-class transition notrs',null,null,true,null,false,{}],out);
    if(c.endsWith('nNPR'))run('DNCg',[context.writer,id+'_div','',null,null,true,null,true,{}],out);
    else out.events.push({kind:'image-leaf-sink'});
    continue;
   }
   throw Error(`Unmodelled ${c} in ${name} at ${i.Offset}`);
  }
  if(op==='ret')return {out,value:s.pop()};
  throw Error(`Unmodelled ${op} in ${name} at ${i.Offset}`);
 }
 throw Error('No ret');
}
const results=[];
for(const visible of [true,false])for(const hasValue of [false,true])for(const withStyle of [false,true]){
 const writer={GNCy:{hasValue}},extra=withStyle?{style:'width: 95px; height: 27px;'}:null;
 const {out}=run('DNCg',[writer,'u1','shape',null,null,visible,null,false,extra]);
 const open=out.events[0];assert.equal(open.tag,'div');assert.equal(open.attributes.id,'u1');assert.equal(open.attributes.class,'shape');
 const suffix=!visible?'display:none; visibility: hidden':hasValue?'visibility: inherit':'';
 assert.equal(open.attributes.style,(withStyle?'width: 95px; height: 27px;':'')+suffix||undefined);
 assert.ok(!JSON.stringify(open.attributes).includes('overflow'));
 assert.equal(out.events.some(e=>e.kind==='close'),false);results.push({kind:'container',visible,hasValue,withStyle,...out});
}
for(const compact of [true,false]){
 const {out}=run('DNCg',[{GNCy:{hasValue:false}},'u1_div','',null,null,true,null,compact,{}]);
 assert.equal(out.events.some(e=>e.kind==='close'),compact);results.push({kind:'close-contract',compact,...out});
}
for(const inline of [false,true])for(const includePosition of [false,true]){
 const {out,value}=run('zNPc',[{x:800,y:169,width:95,height:27},inline,includePosition,null]);
 assert.deepEqual(value,inline?{style:'width: 95px; height: 27px;'+(includePosition?' left: 800px; top: 169px;':'')}:{});
 results.push({kind:'geometry-attribute',inline,includePosition,output:value,...out});
}
for(const asImage of [false,true]){
 const shape={kind:'shape',id:'u1',text:'Problems',rect:{x:800,y:169,width:95,height:27},panel:{},asImage};
 const {out}=run('vNPI',[shape,{writer:{GNCy:{hasValue:false}},css:{idClasses:false}},false]);
 const dom=out.events.filter(e=>['open','rich-content','close'].includes(e.kind));
 assert.deepEqual(dom.map(e=>e.kind==='open'?'open:'+e.attributes.id:e.kind==='close'?'close:'+e.tag:'rich'),asImage?['open:u1','open:u1_text','rich','close:div','close:div']:['open:u1','open:u1_div','close:div','open:u1_text','rich','close:div','close:div']);
 assert.equal(dom.find(e=>e.kind==='open'&&e.attributes.id==='u1_text').attributes.class,'text ');
 results.push({kind:'shape-text-attachment',asImage,...out});
}
const report={method:'Bounded retained-CIL replay of DNCg/zNPc/fNPD/vNPI/FNCR with explicit output and geometry-provider sinks; not original Axure execution.',boundaries:['Escaping/ID prefix providers use safe ASCII identity fixtures; they are not asserted byte-equivalent.','Shape writer call boundary is captured separately; its full image/CSS generation is not executed.','vNPI uses no reference view, no IX variants, no raster asset and deterministic provider flags.','Native rich payload, text measurement, pixel layout and complete base stylesheet remain opaque sinks.','No final browser-computed overflow is asserted.'],sources:[...sources,'research/text-autofit-dom-literals.json','research/text-autofit-native-literals.mjs','research/gradient-angle-flow-init-cil.json','research/rotation-runtime-shape-writer-cil.json'].map(file=>({file,sha256:sha256(file)})),results};
fs.writeFileSync('research/text-autofit-dom-replay.json',JSON.stringify(report,null,2)+'\n');console.log(`${results.length}/${results.length} focused DOM CIL replay cases passed`);
