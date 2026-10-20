// Narrow read-only CIL/literal investigation. Never loads or executes the target DLL.
import fs from 'node:fs';
import { decodeLiteral } from './text-autofit-native-literals.mjs';
import { readJson, fields, sha256 } from './gradient-angle-static-flow.mjs';
const files = ['research/rich-text-format-html-cil.json', 'research/rich-text-format-html-text-cil.json', 'research/rich-text-format-html-linebreak-cil.json', 'research/rich-text-format-html-inline-cil.json', 'research/text-autofit-breaks-normalize-cil.json', 'research/text-autofit-breaks-normalize-init-cil.json'];
const selected = new Set(['ONiF', 'zNiG', 'nNiB', 'rNiV', 'KNiN', 'BNiS', 'VNij', 'kNib', 'zNiJ', 'PbDL', 'GbDa', 'SbDY', '.cctor']);
const eligible = op => op.startsWith('ldc.i4') || ['ldsfld','ldfld','add','sub','xor','mul','and','or','not','neg','shl','shr','shr.un'].includes(op);
const records=[];
for (const file of files) for (const m of readJson(file).Types.flatMap(t=>t.Methods).filter(m=>selected.has(m.Name))) for (let n=0;n<m.Instructions.length;n++) {
  const i=m.Instructions[n]; if(i.Resolved!=='wIhA.zIhQ::sIho')continue;
  let start=n;while(start>0&&eligible(m.Instructions[start-1].Op))start--;
  const stack=[];
  for(const x of m.Instructions.slice(start,n)){
    const op=x.Op;
    if(op.startsWith('ldc.i4'))stack.push(op==='ldc.i4'||op==='ldc.i4.s'?x.Operand:op==='ldc.i4.m1'?-1:Number(op.slice(7)));
    else if(op==='ldsfld')stack.push({module:true});
    else if(op==='ldfld'){if(!stack.pop()?.module||!fields.has(x.Operand))throw Error('Unknown field');stack.push(fields.get(x.Operand).value);}
    else if(op==='not')stack.push(~stack.pop());
    else if(op==='neg')stack.push(-stack.pop()|0);
    else{const b=stack.pop(),a=stack.pop();if(!Number.isInteger(a)||!Number.isInteger(b))throw Error('Incomplete expression');stack.push(op==='add'?(a+b)|0:op==='sub'?(a-b)|0:op==='mul'?Math.imul(a,b):op==='xor'?a^b:op==='and'?a&b:op==='or'?a|b:op==='shl'?a<<b:op==='shr'?a>>b:a>>>b);}
  }
  const offset=stack.at(-1);if(!Number.isInteger(offset))throw Error('Nonconstant literal');
  records.push({file,method:m.Name,token:m.Token,il:i.Offset,constantFirstIL:m.Instructions[start].Offset,offset,text:decodeLiteral(offset)});
}
const dependencies=[...files,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json','research/text-autofit-native-literals.mjs','research/text-autofit-native-literals.bin'];
fs.writeFileSync('research/text-autofit-breaks-literals.json',JSON.stringify({method:'Fold exact selected method literal arguments; existing bounded static resource decoder. No DLL or application execution.',sources:dependencies.map(file=>({file,sha256:sha256(file)})),records},null,2)+'\n');
console.log(records.map(r=>`${r.method} IL${r.il}: ${JSON.stringify(r.text)}`).join('\n'));
