// New bounded single-SelectionButton obN4 replay; no vendor DLL is loaded.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=['research/selection-pointer-single-cil.json','research/selection-pointer-dependencies-cil.json',
 'research/selection-layout-transaction-rect-values-cil.json','research/font-size-runtime-round-cil.json','research/selection-pointer-vector-rotation-cil.json'];
let code=fs.readFileSync('research/layer-resize-numeric-replay.mjs','utf8')
 .replace("v && typeof v === 'object' && !v.get", "v && typeof v === 'object' && !v.get && !v.__reference")
 .replace("op === 'ldc.r4') stack.push(a)","op === 'ldc.r4') stack.push(Number(a))")
 .replace("execute(a, [ref(holder, 0), ...values]); stack.push(copy(holder[0]));", "execute(a, [ref(holder, 0), ...values]); if([100722221,100722225].includes(a))holder[0].__reference=true; stack.push(copy(holder[0]));")
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace("else if (op === 'stobj')", "else if(op==='isinst'){const v=pop();stack.push(null);} else if(op==='stind.r8'){const v=pop(),r=pop();assert(r?.set);r.set(v);} else if (op === 'stobj')");
code+=`
for(const file of ${JSON.stringify(files)})for(const t of read(file).Types)for(const m of t.Methods)methods.set(m.Token,m);
export const pointerFiles=[...sourceFiles,...${JSON.stringify(files)}];
export function single(input){
 const r=makeRect(input.rect.x,input.rect.y,input.rect.width,input.rect.height), out=[null];
 const rt=methods.get(100688822).Instructions.find(i=>i.Resolved==='System.Math::Round').Operand;
 const options=geometryOptions(input.angle??0,{sinks:new Map([
  [100686247,[1,()=>({})]], [100707160,[2,()=>r]],
  [100686229,[1,()=>input.handle]], [100686099,[1,()=>input.freedom??1]], [100686215,[1,()=>input.aspect?1:0]],
  [100695441,[1,()=>({67135088:1,67135089:1})]],
  [rt,[3,(v,digits,mode)=>{assert.equal(digits,0);assert.equal(mode,1);return Math.sign(v)*Math.floor(Math.abs(v)+.5);}]],
 ])});
 const answer=replay(100686258,[{}, {},makeVector(input.delta.x,input.delta.y),ref(out,0)],options);
 return {rect:rectValues(answer.value),angle:out[0],instructions:answer.total};
}
`;
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
export const single=api.single;
export const rotateHandle=(handle,angle)=>api.replay(100708343,[handle,angle],api.geometryOptions()).value;
export function project(input){const r=p=>api.makeRect(p.x,p.y,p.width,p.height);return api.runINw2(r(input.oldRect),r(input.oldAabb??input.oldRect),api.makeVector(input.delta.x,input.delta.y),r(input.parent),input.handle,input.freedom,!!input.aspect,3,null,input.angle??0).value;}
export const sourceFiles=['research/layer-resize-numeric-replay.mjs',...new Set(api.pointerFiles)];
if(process.argv[1]?.replaceAll('\\','/').endsWith('/selection-pointer-numeric-probe.mjs')){
 const cases=[];for(const angle of [0,30,90])for(const handle of [1,4])for(const dx of [-120,-20,0,.5,20,120]){
  const input={rect:{x:20,y:30,width:100,height:20},angle,handle,delta:{x:dx,y:7}};
  try{const actual=single(input),r=input.rect,a=angle*Math.PI/180,cos=angle===90?0:Math.cos(a),sin=angle===90?1:Math.sin(a),local=dx*cos+input.delta.y*sin,deltaWidth=(handle===1?-1:1)*local,round=Math.sign(deltaWidth)*Math.floor(Math.abs(deltaWidth)+.5),width=Math.max(1,r.width+round),shift=(handle===1?-1:1)*(width-r.width)/2;
   const expected={x:r.x+r.width/2+shift*cos-width/2,y:r.y+shift*sin,width,height:r.height};
   for(const k of Object.keys(expected))assert(Math.abs(actual.rect[k]-expected[k])<1e-8,k+': '+actual.rect[k]+' vs '+expected[k]);
   assert(Number.isNaN(actual.angle));cases.push({input,actual,expected,passed:true});}catch(e){cases.push({input,passed:false,error:e.message});break;}
 }
 fs.writeFileSync('research/selection-pointer-numeric-probes.json',JSON.stringify({kind:'Original CIL-record numeric replay; effective angle and 1x1 minimum supplied; ordinary Selection only',sources:sourceFiles.map(path=>({path,sha256:sha(path)})),cases},null,2)+'\n');
 console.log(JSON.stringify({total:cases.length,failed:cases.filter(c=>!c.passed)}));
 if(cases.some(c=>!c.passed))process.exitCode=1;
}
