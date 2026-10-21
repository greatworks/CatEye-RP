import fs from 'node:fs';
import {decodeLiteral} from './text-autofit-native-literals.mjs';
import {readJson,fields,sha256} from './gradient-angle-static-flow.mjs';
const inputs=process.argv.slice(2).map(f=>[f,[]]);
const eligible=op=>op.startsWith('ldc.i4')||['ldsfld','ldfld','add','sub','xor','mul','and','or','not','neg','shl','shr','shr.un'].includes(op);
const records=[];
for(const [file,names]of inputs)for(const m of readJson(file).Types.flatMap(t=>t.Methods).filter(m=>(!names.length||names.includes(m.Name))))for(let n=0;n<m.Instructions.length;n++){
 const i=m.Instructions[n];if(i.Resolved!=='wIhA.zIhQ::sIho')continue;
 let start=n;while(start>0&&eligible(m.Instructions[start-1].Op)&&(m.Instructions[start-1].Op!=='ldfld'||fields.has(m.Instructions[start-1].Operand)))start--;
 const stack=[];
 for(const x of m.Instructions.slice(start,n)){
  const op=x.Op;if(op.startsWith('ldc.i4'))stack.push(op==='ldc.i4'||op==='ldc.i4.s'?x.Operand:op==='ldc.i4.m1'?-1:Number(op.slice(7)));
  else if(op==='ldsfld')stack.push({module:true});
  else if(op==='ldfld'){if(!stack.pop()?.module||!fields.has(x.Operand))throw Error('Unknown module field');stack.push(fields.get(x.Operand).value);}
  else if(op==='not')stack.push(~stack.pop());
  else if(op==='neg')stack.push(-stack.pop()|0);
  else{const b=stack.pop(),a=stack.pop();if(!Number.isInteger(a)||!Number.isInteger(b))throw Error('Incomplete expression');stack.push(op==='add'?(a+b)|0:op==='sub'?(a-b)|0:op==='mul'?Math.imul(a,b):op==='xor'?a^b:op==='and'?a&b:op==='or'?a|b:op==='shl'?a<<b:op==='shr'?a>>b:a>>>b);}
 }
 const offset=stack.at(-1);if(!Number.isInteger(offset))throw Error('Offset not constant');
 records.push({file,method:m.Name,token:m.Token,il:i.Offset,constantFirstIL:m.Instructions[start].Offset,offset,text:decodeLiteral(offset)});
}
const report={method:'Arithmetic-folded offsets from exactly selected context/class/CSS writers, using frozen static literal-resource interpreter; no DLL/app execution.',sources:[...inputs.map(([file])=>file),'research/gradient-angle-flow-init-cil.json','research/text-autofit-native-literals.mjs','research/text-autofit-native-manifest.json'].map(file=>({file,sha256:sha256(file)})),records};
fs.writeFileSync('research/selection-layout-render-literals.json',JSON.stringify(report,null,2)+'\n');
console.log(records.map(r=>`${r.method} IL${r.il} @${r.offset}: ${r.text}`).join('\n'));




