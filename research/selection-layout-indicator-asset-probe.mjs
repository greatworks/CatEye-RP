// Static CIL control-flow replay of forced checkmark asset generation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const adapter='research/layer-resize-controller-probe.mjs';
let code=fs.readFileSync(adapter,'utf8').split('for(let mask=0;mask<16;mask++)')[0]
 .replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace("const loadArg=i=>copy(args[i])","const loadArg=i=>args[i]?.__ref?args[i]:copy(args[i])")
 .replace("else if(op==='isinst')","else if(op==='stobj'){const v=stack.pop(),r=stack.pop();set(r,v);}\nelse if(op==='isinst')");
code+=String.raw`
const extraFiles=['research/selection-layout-indicator-html-geometry-cil.json'];
for(const file of extraFiles)for(const t of read(file).Types)for(const m of t.Methods)methods.set(m.Token,{...m,file});
bind(100695613,1,()=>({scope:'disable-transform'}));
bind(100699651,2,([w,out])=>{set(out,rect(0,0,14,14));return rect(2,3,14,14);});
bind(100695435,3,()=>({inset:0}));
bind(100722100,2,([r,_])=>r);
bind(100695308,1,([w])=>w.selected);
bind(100695309,2,([w,v])=>{w.selected=!!v;context.calls.push({setSelected:!!v});return VOID;});
bind(167775900,2,([v,flag])=>(v&flag)===flag);
bind(100699685,5,([w,ctx,id,state,r])=>{context.calls.push({render:{selected:w.selected,id,state,rect:r}});return 'asset.svg';});
export function asset(selected,state){
 context={calls:[]};const w={selected},out={value:null};
 const result=execute(100699650,[w,{},'u_img',state,addr(out,'value')]);
 return {result,finalSelected:w.selected,calls:context.calls,output:out.value};
}
export const sourceFiles=[...inputFiles,...extraFiles];
`;
process.on('uncaughtException',error=>{
 const message=String(error.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<retained-asset-adapter>');
 let n=1;while(fs.existsSync(`research/selection-layout-indicator-asset-failure-${n}.json`))n++;
 fs.writeFileSync(`research/selection-layout-indicator-asset-failure-${n}.json`,JSON.stringify({message,sourceHash:sha(import.meta.filename)},null,2)+'\n');
 console.error(message);process.exitCode=1;
});
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const results=[];
for(const selected of [false,true])for(const state of [0,1,2,4,8,9,16,24]){
 const actual=api.asset(selected,state),during=actual.calls.find(x=>x.render).render.selected;
 assert.equal(during,state===0||(state&8)!==0?true:selected);
 assert.equal(actual.finalSelected,selected);
 results.push({input:{selected,state},actual,passed:true});
}
fs.writeFileSync('research/selection-layout-indicator-asset-probes.json',JSON.stringify({
 method:'Retained aNP5 instructions interpreted; graphics/image writer and local indicator rectangle remain declared sinks. No vendor code executes.',
 sources:[...new Set([...api.sourceFiles,adapter,'research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json',import.meta.filename])].map(path=>({path,sha256:sha(path)})),
 summary:{total:results.length,passed:results.length,failed:0},
 boundaries:['Normal state0 and flags containing8 force Selected=true while rendering, then restore prior Selected.','Other flags in these cases retain the prior value.','Successful completion only: exception/finally selected restore is not proven by these runs.','Image generation, shadow expansion and graphics transform are not executed.'],results
},null,2)+'\n');
console.log({passed:results.length});
