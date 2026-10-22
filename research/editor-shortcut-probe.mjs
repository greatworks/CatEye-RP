// Interprets selected retained CIL; never imports or executes the vendor DLL.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fields as flow} from './gradient-angle-static-flow.mjs';
const files=['research/editor-shortcut-value-cil.json','research/editor-shortcut-win32-normalization-cil.json','research/selection-pointer-modifiers-key-enum.json','research/gradient-angle-flow-init-cil.json','research/gradient-angle-static-flow.mjs'];
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const records=files.slice(0,2).map(read);
const methods=new Map(records.flatMap(r=>r.Types.flatMap(t=>t.Methods)).map(m=>[m.Token,m]));
const type=records[0].Types[0];
const fieldTokens=Object.fromEntries(type.Fields.map(f=>[f.Name,f.Token]));
const enums=Object.fromEntries(read(files[2]).Types[0].Fields.filter(f=>f.Constant).map(f=>[f.Name,Buffer.from(f.Constant,'hex').readInt32LE()]));
const traces=[];
function run(token,args){
  const method=methods.get(token);assert(method,`Missing method ${token}`);
  const list=method.Instructions,byOffset=new Map(list.map((i,n)=>[i.Offset,n]));
  let at=0;const stack=[],locals=[];const trace=[];
  for(let steps=0;steps<1500;steps++){
    const i=list[at++];assert(i,'Instruction overrun');trace.push(i.Offset);
    const op=i.Op,v=i.Operand,jump=()=>{assert(byOffset.has(v));at=byOffset.get(v);};
    if(op==='br'||op==='br.s'){jump();continue;}
    if(op==='ldarg.s'||/^ldarg\.[0-3]$/.test(op)){stack.push(args[op==='ldarg.s'?v:Number(op.slice(-1))]);continue;}
    if(op.startsWith('ldc.i4')){stack.push(op==='ldc.i4'||op==='ldc.i4.s'?v:op==='ldc.i4.m1'?-1:Number(op.slice(7)));continue;}
    if(op==='ldloc.s'){stack.push(locals[v]);continue;}
    if(op==='stloc.s'){locals[v]=stack.pop();continue;}
    if(op==='ldsfld'){stack.push({flow:true});continue;}
    if(op==='ldfld'){const obj=stack.pop();stack.push(obj.flow?flow.get(v).value:obj[v]);continue;}
    if(op==='stind.i4'){const value=stack.pop(),ref=stack.pop();ref.value=value;continue;}
    if(op==='brtrue'||op==='brfalse'){const value=stack.pop();if(op==='brtrue'?!!value:!value)jump();continue;}
    if(op==='beq'){const b=stack.pop(),a=stack.pop();if(a===b)jump();continue;}
    if(op==='sub'||op==='or'||op==='ceq'){const b=stack.pop(),a=stack.pop();stack.push(op==='sub'?(a-b)|0:op==='or'?a|b:Number(a===b));continue;}
    if(op==='isinst'){assert.equal(v,type.Token);const obj=stack.pop();stack.push(obj?.kind==='shortcut'?obj:null);continue;}
    if(op==='call'||op==='callvirt'){assert(methods.has(v),`Unsupported call ${i.Resolved}`);stack.push(run(v,[stack.pop()]));continue;}
    if(op==='ret'){traces.push({token,offsets:trace});return stack.pop();}
    throw new Error(`Unsupported ${op} at ${i.Offset}`);
  }
  throw new Error('Step limit');
}
function shortcut(key,mask){const mod={value:NaN},code={value:NaN};run(100726557,[{},mask,enums[key],mod,code]);return{kind:'shortcut',[fieldTokens.NHXL]:mod.value,[fieldTokens.RHXK]:code.value};}
const C=enums.Control,S=enums.Shift,A=enums.Alt;
assert.equal(C,131072);assert.equal(S,65536);assert.equal(A,262144);
const pairs=[['C',C,C|A],['O',C,C|S],['V',C,C|A],['D',C,C|S|A],['P',C|A,C|S|A],['P',C|S,C|S|A]];
const results=[];
for(const [key,first,second] of pairs){
  const a=shortcut(key,first),b=shortcut(key,second),same=shortcut(key,first);
  const equal=run(100725752,[a,b]),positive=run(100725752,[a,same]);
  assert.equal(equal,0);assert.equal(positive,1);
  results.push({key,first,second,firstCombined:run(100725747,[a]),secondCombined:run(100725747,[b]),equal:Boolean(equal),sameChordEqual:Boolean(positive)});
}
for(let i=0;i<8;i++){
  const mask=(i&1?C:0)|(i&2?S:0)|(i&4?A:0),s=shortcut('C',mask);
  assert.equal(s[fieldTokens.NHXL],mask);assert.equal(s[fieldTokens.RHXK],enums.C);
}
assert.equal(run(100725752,[shortcut('C',C),null]),0);
assert.equal(run(100725752,[shortcut('C',C),{}]),0);
const out={createdAt:new Date().toISOString(),kind:'Bounded interpretation of retained CIL, no native DLL execution or GUI',sourceAssemblySha256:records[0].SHA256,sources:files.concat('research/editor-shortcut-probe.mjs').map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')})),results,win32MasksChecked:8,nonShortcutInputsChecked:2,passed:true,boundaries:['Shortcut objects use explicit key/modifier fixture fields; constructor static initialization and validation are not replayed.','Windows GIoK copy, combined-key getters, and Equals instructions are replayed.','Command labels and mapping come from official documentation, not decoded native registry captions.','Registry registration and lookup callbacks, keyboard focus/IME/AltGraph, OS interception, and physical key dispatch are not replayed.'],traces};
fs.writeFileSync('research/editor-shortcut-probes.json',JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pairs:results.length,win32MasksChecked:8,nonShortcutInputsChecked:2,passed:true}));
