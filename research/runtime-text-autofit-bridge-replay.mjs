import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fields,readJson,sha256} from './gradient-angle-static-flow.mjs';
import {decodeLiteral} from './text-autofit-native-literals.mjs';
const inputFiles=['research/runtime-text-autofit-bridge-width-cil.json','research/runtime-text-autofit-bridge-height-cil.json','research/runtime-text-autofit-bridge-bool-cil.json','research/runtime-text-autofit-bridge-bool-value-cil.json','research/line-style-json-friendly-cil.json'];
const methods=new Map(inputFiles.flatMap(f=>readJson(f).Types.flatMap(t=>t.Methods)).map(m=>[m.Token,m]));
const widthToken=100702342,heightToken=100702366,writerToken=100690308;
const widthField=methods.get(widthToken).Instructions.find(i=>i.Resolved?.endsWith('::GNZZ')).Operand;
const heightField=methods.get(heightToken).Instructions.find(i=>i.Resolved?.endsWith('::mNYN')).Operand;
function execute(token,args,start=0){
 const m=methods.get(token),code=m.Instructions,at=new Map(code.map((i,n)=>[i.Offset,n]));let pc=at.get(start),steps=0;const stack=[],locals=[];
 const pop=()=>{assert.ok(stack.length);return stack.pop();};const truth=x=>x!==null&&x!==undefined&&x!==false&&x!==0;
 while(pc<code.length){assert.ok(++steps<2000);const i=code[pc++],op=i.Op,v=i.Operand;const jump=()=>{assert.ok(at.has(v));pc=at.get(v)};
  const idx=p=>op===p||op===p+'.s'?v:Number(op.slice(p.length+1));
  if(op.startsWith('ldc.i4'))stack.push(op==='ldc.i4'||op==='ldc.i4.s'?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));
  else if(op==='ldc.r8')stack.push(v);
  else if(op.startsWith('ldarg'))stack.push(args[idx('ldarg')]);
  else if(op.startsWith('ldloc'))stack.push(locals[idx('ldloc')]);
  else if(op.startsWith('stloc'))locals[idx('stloc')]=pop();
  else if(op==='ldnull')stack.push(null);
  else if(op==='ldsfld')stack.push({module:true});
  else if(op==='ldfld'){const o=pop();stack.push(o.module?fields.get(v).value:o[v]);}
  else if(op==='isinst'){const o=pop();assert.equal(i.Resolved,'Axure.DocumentModel.Objects.TextRectObject');stack.push(o.textRect?o:null);}
  else if(op==='neg')stack.push(-pop()|0);else if(op==='not')stack.push(~pop());
  else if(['add','sub','xor','and','or','mul','shl','shr','shr.un','ceq'].includes(op)){const b=pop(),a=pop();stack.push(op==='add'?(a+b)|0:op==='sub'?(a-b)|0:op==='xor'?a^b:op==='and'?a&b:op==='or'?a|b:op==='mul'?Math.imul(a,b):op==='shl'?a<<b:op==='shr'?a>>b:op==='shr.un'?a>>>b:a===b?1:0);}
  else if(op==='br'||op==='br.s'||op==='leave')jump();
  else if(op==='brtrue'||op==='brtrue.s'){if(truth(pop()))jump();}
  else if(op==='brfalse'||op==='brfalse.s'){if(!truth(pop()))jump();}
  else if(op==='beq'||op==='bne.un'){const b=pop(),a=pop();if(op==='beq'?a===b:a!==b)jump();}
  else if(op==='ret')return stack.pop();
  else if(op==='call'||op==='callvirt'){
   if(v===100732102)stack.push(decodeLiteral(pop()));
   else if(v===100695610)stack.push(pop().transform);
   else if(v===100723734)stack.push(pop().sx);
   else if(v===100723736)stack.push(pop().sy);
   else if(v===widthToken||v===heightToken)stack.push(execute(v,[pop()]));
   else if(v===writerToken){const formatting=pop(),value=pop(),key=pop(),writer=pop();execute(v,[writer,key,value,formatting]);}
   else if(v===100690263){const formatting=pop(),key=pop(),writer=pop();writer.pending={key,formatting};}
   else if(v===100690269){const value=pop(),writer=pop();writer.entries.push({...writer.pending,value:!!value});}
   else throw Error('Unmodelled call '+i.Resolved+' at '+i.Offset);
  }else throw Error('Unmodelled opcode '+op);
 }
 throw Error('Missing ret');
}
const transforms=[null,{sx:1,sy:1},{sx:2,sy:1},{sx:1,sy:2},{sx:-1,sy:1},{sx:1,sy:-1},{sx:NaN,sy:1},{sx:1,sy:NaN}];
const records=[];
for(const width of [false,true])for(const height of [false,true])for(const transform of transforms){
 const object={textRect:true,[widthField]:width,[heightField]:height,transform},writer={entries:[]};
 execute(100694305,[object,writer,{}],3098);
 const expected={autoFitWidth:width&&(!transform||transform.sx===1),autoFitHeight:height&&(!transform||transform.sy===1)};
 assert.deepEqual(Object.fromEntries(writer.entries.map(e=>[e.key,e.value])),expected);assert.ok(writer.entries.every(e=>e.formatting===0));
 records.push({stored:{width,height},transform:transform?{sx:Number.isNaN(transform.sx)?'NaN':transform.sx,sy:Number.isNaN(transform.sy)?'NaN':transform.sy}:null,emitted:writer.entries,expected});
}
for(const type of ['VectorShape','TableCell','ImageBox','SelectionButton','Repeater','Table','TreeNodeObject','TextBox','TextArea']){
 const metadata=readJson('research/runtime-text-autofit-bridge-metadata.json').types.find(x=>x.name==='Axure.DocumentModel.Objects.'+type);assert.ok(metadata);
 const textRect=metadata.base==='Axure.DocumentModel.Objects.TextRectObject',writer={entries:[]};execute(100694305,[{textRect,[widthField]:true,[heightField]:true,transform:null},writer,{}],3098);
 assert.equal(writer.entries.length,textRect?2:0);records.push({scopeType:type,base:metadata.base,emitted:writer.entries});
}
const sources=[...inputFiles,'research/runtime-text-autofit-bridge-metadata.json','research/gradient-angle-flow-init-cil.json','research/gradient-angle-static-flow.mjs','research/text-autofit-native-literals.mjs'].map(file=>({file,sha256:sha256(file)}));
fs.writeFileSync('research/runtime-text-autofit-bridge-replay.json',JSON.stringify({method:'Bounded interpretation of two complete getter instruction bodies, jJeK tail IL3098 onward and hbUB; metadata and writer sinks injected. No original DLL/JS execution.',sources,cases:records.length,passed:records.length,limits:['Does not replay earlier unrelated jJeK fields or full generator','TITl and tITy writer sinks capture writes, not generated page output','Transform resolution is injected; exact effective transform chain remains prior evidence','NaN scale cases are synthetic gate tests, not admitted native import values'],records},null,2)+'\n');
console.log(JSON.stringify({cases:records.length,passed:records.length}));
