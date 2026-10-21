// Bounded retained-CIL records, not vendor CLR or GUI execution.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const adapter = 'research/layer-resize-controller-probe.mjs'
let code = fs.readFileSync(adapter, 'utf8').split('for(let mask=0;mask<16;mask++)')[0]
  .replace("'./gradient-angle-static-flow.mjs'", JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
  .replace("else if(v===67134719)", "else if(v===67134732) stack.push(rect(0,0,0,0));\nelse if(v===67134733) stack.push(rect(0,0,1,1));\nelse if(v===67135091) stack.push(size(1,1));\nelse if(v===67134719)")
  .replace("else if(op==='isinst')", "else if(op==='ble.un'){const b=deref(stack.pop()),a=deref(stack.pop());if(a<=b||Number.isNaN(a)||Number.isNaN(b))jump(v);}\nelse if(op==='isinst')")
code += String.raw`
const extraFiles=['research/selection-layout-border-chain-cil.json','research/selection-layout-border-asset-values-cil.json','research/selection-layout-border-render-entry-cil.json','research/selection-layout-border-size-static-cil.json','research/native-point-contours-topology-rect-static-cil.json','research/selection-layout-transaction-dependencies-cil.json','research/line-style-platform-functions-cil.json','research/selection-layout-border-boxmodel-cil.json'];
for(const file of extraFiles)for(const t of read(file).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file});
for(const [id,n]of [[100695435,3],[100722159,4],[100722439,2]])cil(id,n);
bind(100716800,2,([a,b])=>a!==b);
bind(100695273,1,([w])=>w.boxModel);
cil(100708190,1);
cil(100688826,1);bind(167778491,1,([x])=>Math.floor(x));
bind(100721972,3,([p,n,pos])=>{p=deref(p);assert.equal(pos,768);return rect(p.x-n/2,p.y-n/2,n,n)});
bind(100722104,2,([r,s])=>rect(r.x,r.y,r.width+s.width,r.height+s.height));
bind(100695584,1,([w])=>w.strokeWidth);
bind(100695361,1,([w])=>size(w.width,w.height));
bind(100695369,1,([w])=>rect(w.x,w.y,w.width,w.height));
bind(100695600,1,([w])=>w.shadow);
bind(100695605,1,()=>null);
bind(100722419,1,([s])=>s?.on||false);
bind(100722443,2,([a,b])=>a===b);
bind(100722426,1,([s])=>s.blur);
bind(100722425,1,([s])=>point(s.dx,s.dy));
bind(100720336,2,([a,b])=>a===b);
bind(100722108,2,([r,n])=>rect(r.x-n,r.y-n,r.width+2*n,r.height+2*n));
bind(100722102,2,([r,p])=>rect(r.x+p.x,r.y+p.y,r.width,r.height));
bind(100722101,2,([a,b])=>rect(a.x-b.x,a.y-b.y,a.width-b.width,a.height-b.height));
bind(100722100,2,([a,b])=>rect(a.x+b.x,a.y+b.y,a.width+b.width,a.height+b.height));
bind(100720524,3,([a,b,ignoreEmpty])=>{
 const zero=r=>r.x===0&&r.y===0&&r.width===0&&r.height===0;
 if(ignoreEmpty&&zero(a))return b;if(ignoreEmpty&&zero(b))return a;
 return rect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.max(a.x+a.width,b.x+b.width)-Math.min(a.x,b.x),Math.max(a.y+a.height,b.y+b.height)-Math.min(a.y,b.y));
});
bind(100722085,2,([r])=>r.width===0||r.height===0);
bind(100688813,2,([v,eps])=>Math.abs(v)<eps);
bind(100722954,1,([s])=>s.width);
bind(100722956,1,([s])=>s.height);
// Unreached selection-vs-vector branches intentionally fail if entered.
export function padding(w){context={calls:[]};const actual=execute(100695435,[{kind:'SelectionButton',x:100,y:70,width:100,height:30,boxModel:0,strokeWidth:1,shadow:null,...w},true,false]);return actual;}
export const sourceFiles=[...inputFiles,...extraFiles];
`
process.on('uncaughtException', error => {
  const message = String(error.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, '<retained-border-adapter>')
  let n = 1
  while (fs.existsSync(`research/selection-layout-border-failure-${n}.json`)) n++
  fs.writeFileSync(`research/selection-layout-border-failure-${n}.json`, JSON.stringify({ message, sourceHash: hash(import.meta.filename) }, null, 2) + '\n')
  console.error(message); process.exitCode = 1
})
const api = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const results=[]
for(const strokeWidth of [0,1,2,3,5]){
  const input={strokeWidth,boxModel:0},actual=api.padding(input)
  results.push({input,actual})
}
for(const shadow of [{on:false,dx:4,dy:5,blur:3},{on:true,dx:4,dy:5,blur:3},{on:true,dx:-7,dy:-2,blur:4},{on:true,dx:0,dy:0,blur:0}]){
 const input={strokeWidth:2,boxModel:0,shadow},actual=api.padding(input);results.push({input,actual})
}
for(const {actual}of results)assert.ok(['x','y','width','height'].every(k=>Number.isFinite(actual[k])))
for(let n=0;n<5;n++){
 const w=results[n].input.strokeWidth
 const expected=w<=1?{x:0,y:0,width:1,height:1}:{x:-w/2,y:-w/2,width:w+1,height:w+1}
 for(const k of Object.keys(expected))assert.equal(results[n].actual[k],expected[k])
}
const shadowExpected=[[-1,-1,3,3],[-1,-1,10,11],[-12,-7,14,11],[-1,-1,3,3]]
for(let n=0;n<shadowExpected.length;n++)assert.deepEqual(['x','y','width','height'].map(k=>results[n+5].actual[k]),shadowExpected[n])
fs.writeFileSync('research/selection-layout-border-padding-probes.json',JSON.stringify({method:'Retained UJ0a/f5yT/d5up instructions with geometry/union predicates explicitly supplied; no complete SVG viewport composition.',passed:results.length,failed:0,boundaries:['Explicit document BoxModel0; SelectionButton non-Vector branch.','Point/rect arithmetic and union are source-bound facade implementations.','This is the asset-padding helper, not final SVG dimensions, viewBox, stylesheet position or clipping.','The first-observations file remains unchanged: missing dereference in a point facade produced NaN, serialized there as null. Corrected output is this distinct file.'],sources:[...new Set([...api.sourceFiles,adapter,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',import.meta.filename])].map(path=>({path,sha256:hash(path)})),results},null,2)+'\n')
console.log(JSON.stringify(results,null,2))
