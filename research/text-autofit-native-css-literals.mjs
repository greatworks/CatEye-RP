import fs from 'node:fs';
import {decodeLiteral} from './text-autofit-native-literals.mjs';
import {readJson,fields,sha256} from './gradient-angle-static-flow.mjs';
const inputs=[
 ['research/text-autofit-native-owner-input-cil.json',['hNL8']],
 ['research/text-autofit-native-child-selector-cil.json',['ENLX']],
 ['research/text-autofit-native-child-css-cil.json',['nNLd']],
 ['research/font-size-runtime-rect-values-cil.json',['hNKx']],
 ['research/text-autofit-native-style-helper-cil.json',['eNLq','YNKJ','RNKP','BNK2','bNKX']],
 ['research/font-size-runtime-layout-writer-cil.json',['SNLp']],
 ['research/shadow-format-form-cil.json',['rNPL']],
 ['research/rotation-runtime-shape-writer-cil.json',['sNP3','nNPR']],
 ['research/text-autofit-native-text-callers-cil.json',['fNPD','FNPK']],
];
const eligible=op=>op.startsWith('ldc.i4')||['ldsfld','ldfld','add','sub','xor','mul','and','or','not','neg','shl','shr','shr.un'].includes(op);
const records=[];
for(const [file,names]of inputs)for(const m of readJson(file).Types.flatMap(t=>t.Methods).filter(m=>names.includes(m.Name)))for(let n=0;n<m.Instructions.length;n++){
 const i=m.Instructions[n];if(i.Resolved!=='wIhA.zIhQ::sIho')continue;
 let start=n;while(start>0&&eligible(m.Instructions[start-1].Op))start--;
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
const report={method:'Only arithmetic-folded literal offsets from selected owner/text CSS and HTML callers. Static pinned CIL/resource interpreter; no target assembly execution.',sources:[...inputs.map(([file])=>file),'research/gradient-angle-flow-init-cil.json','research/text-autofit-native-literal-dispatch-cil.json','research/text-autofit-native-literal-data-cil.json','research/text-autofit-native-literal-transform-cil.json','research/text-autofit-native-literals.bin'].map(file=>({file,sha256:sha256(file)})),records};
fs.writeFileSync('research/text-autofit-native-css-literals.json',JSON.stringify(report,null,2)+'\n');
console.log(records.map(r=>`${r.method} IL${r.il} @${r.offset}: ${r.text}`).join('\n'));
