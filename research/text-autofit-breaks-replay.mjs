// Interpret a bounded, allowlisted text-only CIL slice; never invokes original code.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { readJson, fields, sha256 } from './gradient-angle-static-flow.mjs';
import { decodeLiteral } from './text-autofit-native-literals.mjs';
const files=['research/rich-text-format-html-text-cil.json','research/rich-text-format-html-linebreak-cil.json','research/text-autofit-breaks-normalize-cil.json'];
const arities=new Map([[100699547,1],[100699548,2],[100699549,2],[100688584,1],[100688605,4]]);
const methods=new Map(files.flatMap(f=>readJson(f).Types.flatMap(t=>t.Methods)).filter(m=>arities.has(m.Token)).map(m=>[m.Token,m]));
const literals=readJson('research/text-autofit-breaks-literals.json').records;
assert.equal(literals.find(r=>r.method==='.cctor'&&r.il===61).text,'\r\n?');
assert.equal(literals.find(r=>r.method==='PbDL'&&r.il===120).text,'\n');
const truth=x=>x!==null&&x!==undefined&&x!==0&&x!==false;
function run(token,args,trace,depth=0){
  if(depth>8)throw Error('Depth limit');const m=methods.get(token);if(!m)throw Error('Unknown method');
  const at=new Map(m.Instructions.map((i,n)=>[i.Offset,n])),stack=[],locals=[];let pc=0,steps=0;
  const pop=()=>{if(!stack.length)throw Error('Stack underflow');return stack.pop();};
  while(pc<m.Instructions.length){
    if(++steps>10000)throw Error('Step limit');const i=m.Instructions[pc++],op=i.Op,v=i.Operand;
    const jump=()=>{if(!at.has(v))throw Error('Unknown branch');pc=at.get(v);};
    const idx=prefix=>op===prefix||op===prefix+'.s'?v:Number(op.slice(prefix.length+1));
    if(op==='nop')continue;
    if(op.startsWith('ldc.i4'))stack.push(op==='ldc.i4'||op==='ldc.i4.s'?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));
    else if(op.startsWith('ldarg'))stack.push(args[idx('ldarg')]);
    else if(op.startsWith('starg'))args[idx('starg')]=pop();
    else if(op.startsWith('ldloc'))stack.push(locals[idx('ldloc')]);
    else if(op.startsWith('stloc'))locals[idx('stloc')]=pop();
    else if(op==='ldstr')stack.push(i.Resolved);
    else if(op==='ldnull')stack.push(null);
    else if(op==='dup')stack.push(stack.at(-1));
    else if(op==='pop')pop();
    else if(op==='ldsfld')stack.push(v===67120068?{regex:'\r\n?'}:{module:true});
    else if(op==='ldfld'){if(!pop()?.module||!fields.has(v))throw Error('Unknown field');stack.push(fields.get(v).value);}
    else if(['add','sub','xor','and','or','shl','shr','shr.un','mul'].includes(op)){const b=pop(),a=pop();stack.push(op==='add'?(a+b)|0:op==='sub'?(a-b)|0:op==='xor'?a^b:op==='and'?a&b:op==='or'?a|b:op==='shl'?a<<b:op==='shr'?a>>b:op==='shr.un'?a>>>b:Math.imul(a,b));}
    else if(op==='not')stack.push(~pop());
    else if(op==='neg')stack.push(-pop()|0);
    else if(op==='ceq'){const b=pop(),a=pop();stack.push(a===b?1:0);}
    else if(op==='br'||op==='br.s')jump();
    else if(op==='brtrue'||op==='brtrue.s'){if(truth(pop()))jump();}
    else if(op==='brfalse'||op==='brfalse.s'){if(!truth(pop()))jump();}
    else if(['beq','bne.un','blt'].includes(op)){const b=pop(),a=pop();if(op==='beq'?a===b:op==='bne.un'?a!==b:a<b)jump();}
    else if(op==='ret'){if(stack.length!==1)throw Error('Return stack');return pop();}
    else if(op==='call'||op==='callvirt'){
      trace.push({method:m.Name,il:i.Offset,call:i.Resolved});
      if(arities.has(v)){const a=stack.splice(stack.length-arities.get(v));stack.push(run(v,a,trace,depth+1));}
      else if(v===100732102)stack.push(decodeLiteral(pop()));
      else if(v===167772538){const replacement=pop(),old=pop(),text=pop();stack.push(text.split(old).join(replacement));}
      else if(v===167776522){const replacement=pop(),text=pop(),regex=pop();if(regex.regex!=='\r\n?')throw Error('Unexpected regex');stack.push(text.replace(/\r\n?/g,replacement));}
      else if(v===167772207){const prefix=pop(),text=pop();stack.push(text.startsWith(prefix));}
      else if(v===167786395){const comparison=pop(),from=pop(),needle=pop(),text=pop();assert.equal(comparison,4);stack.push(text.indexOf(needle,from));}
      else if(v===167774728){const length=pop(),start=pop(),text=pop();stack.push(text.slice(start,start+length));}
      else if(v===167772240){const start=pop(),text=pop();stack.push(text.slice(start));}
      else if(v===167772537)stack.push(pop().length);
      else if(v===167772398){const c=pop(),b=pop(),a=pop();stack.push(a+b+c);}
      else throw Error('Unmodelled call '+i.Resolved);
    }else throw Error('Unmodelled opcode '+op);
  }throw Error('No return');
}
const examples=[['LF','A\nB','A<br>B'],['CRLF','A\r\nB','A<br>B'],['CR','A\rB','A<br>B'],['line separator','A\u2028B','A<br>B'],['repeated LF','A\n\nB','A<br><br>B'],['leading LF','\nB','<br>B'],['trailing LF','A\n','A<br>'],['null',null,''],['empty','',''],['literal HTML','<br>&"','&lt;br&gt;&amp;&quot;'],['mixed','A\r\nB\rC\u2028D\nE','A<br>B<br>C<br>D<br>E'],['paragraph separator untouched','A\u2029B','A\u2029B']];
const cases=[];
for(const [name,input,expected]of examples)for(const leading of [false,true]){const trace=[],actual=run(100699548,[input,leading],trace);assert.equal(actual,expected,name);cases.push({name,input,leadingSpaceFlag:leading,actual,expected,trace});}
const sources=[...files,'research/text-autofit-breaks-normalize-init-cil.json','research/text-autofit-breaks-literals.json','research/text-autofit-native-literals.mjs','research/text-autofit-native-literals.bin','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json','research/text-autofit-breaks-replay.mjs'].map(file=>({file,sha256:sha256(file)}));
fs.writeFileSync('research/text-autofit-breaks-replay.json',JSON.stringify({method:'Actual retained nNiB, zNiG, rNiV, PbDL and SbDY control flow; Int32 fields statically folded. .NET string/Regex operations are explicit sinks over decoded literals. No original DLL/app execution; no browser; this does not replay ONiF paragraph preparation.',sources,cases},null,2)+'\n');
console.log(`${cases.length}/${cases.length} text serializer cases passed`);
