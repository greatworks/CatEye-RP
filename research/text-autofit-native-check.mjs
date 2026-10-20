// Focused static evidence assertions, not native application verification.
import assert from 'node:assert/strict';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
import {decodeLiteral} from './text-autofit-native-literals.mjs';
let checks=0;
const check=(name,fn)=>{fn();checks++;console.log(`ok ${checks} - ${name}`)};
const method=(file,name)=>readJson(file).Types.flatMap(t=>t.Methods).find(m=>m.Name===name);
check('pinned assembly and literal resource identity',()=>{
 const r=readJson('research/text-autofit-native-resource.json');
 assert.equal(sha256(r.assembly),'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7');
 assert.equal(sha256(r.file),'9f43dae4b33ade6e7f48d90bbe882de7ab529db13782d1df2184fa122b61b542');
});
check('exact literals, not guessed CSS names',()=>{
 for(const [offset,text]of [[348978,' .text'],[351112,'#{0} {{'],[356274,'white-space'],[356300,'nowrap'],[356316,'word-wrap'],[356338,'break-word'],[349100,'overflow'],[76392,'height'],[31244,'100%']])assert.equal(decodeLiteral(offset),text);
});
check('B5u4 sets the same field read by height getter j3jh',()=>{
 const file='research/text-autofit-native-rect-helper-cil.json';
 const setter=method(file,'B5u4').Instructions.find(i=>i.Op==='stfld');
 const getter=method(file,'j3jh').Instructions.find(i=>i.Op==='ldfld');
 assert.equal(setter.Operand,getter.Operand);assert.equal(getter.Resolved,'h5uH.j5u5::z5s6');
});
check('original hNKx branches around height assignment when input is -1',()=>{
 const m=method('research/font-size-runtime-rect-values-cil.json','hNKx');
 assert.deepEqual(m.Instructions.filter(i=>[335,340,349].includes(i.Offset)).map(i=>[i.Offset,i.Op,i.Operand]),[[335,'call',100722053],[340,'ldc.r8',-1],[349,'beq',437]]);
});
check('SNLp branches around overflow assignment for zero scrollbars',()=>{
 const m=method('research/font-size-runtime-layout-writer-cil.json','SNLp');
 assert.deepEqual(m.Instructions.filter(i=>[452,454].includes(i.Offset)).map(i=>[i.Offset,i.Op,i.Operand]),[[452,'ldarg.s',9],[454,'brfalse',510]]);
 assert.equal(m.Instructions.find(i=>i.Offset===719).Resolved,'uNL7.JNLP::nNLd');
});
check('four real UX owners retain both explicit AutoFit flags and saved bounds',()=>{
 const r=readJson('research/font-size-format-owners.json');assert.equal(r.owners.length,4);
 assert.equal(sha256(r.sample.file),r.sample.sha256);
 for(const owner of r.owners){assert.equal(owner.rawObject.AutoFitWidth,true);assert.equal(owner.rawObject.AutoFitHeight,true);assert.equal(owner.review.height,27);assert.ok([95,54].includes(owner.review.width));}
});
check('four rNPL and ten child/dimension cases are source-current',()=>{
 for(const [file,count]of [['research/text-autofit-native-replay.json',4],['research/text-autofit-native-child-replay.json',10]]){
  const r=readJson(file);assert.equal(r.results.length,count);for(const source of r.sources)assert.equal(sha256(source.file),source.sha256,source.file);
 }
});
console.log(`${checks}/${checks} static evidence checks passed; 14 retained bounded CIL replay cases`);
