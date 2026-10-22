import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash}from'node:crypto';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let program=fs.readFileSync('research/selection-layout-render-dom-probe.mjs','utf8').split('const api=await import(')[0];
program=program.replaceAll('research/selection-layout-render-dom-failure-','research/selection-state-assets-initial-failure-');
program+=String.raw`
code=code.replace("if(c==='kJm2.KJm7::nJq3'){pop();s.push(false);continue}","if(c==='kJm2.KJm7::nJq3'){s.push(pop().disabled);continue}")
.replace("if(c==='kJm2.KJm7::PJqk'){pop();s.push(null);continue}","if(c==='kJm2.KJm7::PJqk'){s.push(pop().selected);continue}")
.replace("if(c==='Axure.DocumentModel.Objects.SelectionButton::zNUD'){pop();s.push({dispose:true});continue}","if(c==='Axure.DocumentModel.Objects.SelectionButton::zNUD'){const d=pop(),v=pop(),w=pop();out.events.push({kind:'trap',selected:v,disabled:d,priorSelected:w.selected,priorDisabled:w.disabled});w.selected=!!v;w.disabled=!!d;w.trapping=true;s.push({dispose:true});continue}")
.replace("if(c==='UNxR.xNxg::wNxE'){s.splice(s.length-6,6);s.push('ax_default');continue}","if(c==='UNxR.xNxg::wNxE'){const a=s.splice(s.length-6,6);out.events.push({kind:'class-call',disabled:a[2],selected:a[3]});s.push('ax_default');continue}")
.replace("if(c==='fNiZ.FNiU::aNP5'){s.splice(s.length-5,5);s.push('<svg>image-sink</svg>');continue}","if(c==='fNiZ.FNiU::aNP5'){const a=s.splice(s.length-5,5);out.events.push({kind:'asset-call',state:a[3],selected:a[0].selected,disabled:a[0].disabled,trapping:a[0].trapping});s.push('<svg>image-sink</svg>');continue}")
.replace("export function render(kind){","export function render(kind,selected,disabled){")
.replace("const shape={kind,id:'u1'","const shape={kind,selected,disabled,id:'u1'");
export const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
`;
const {api}=await import('data:text/javascript;base64,'+Buffer.from(program).toString('base64'));
const results=[];
for(const kind of ['checkbox','radio'])for(const selected of [false,true])for(const disabled of [false,true]){
 const out=api.render(kind,selected,disabled),events=out.events.filter(e=>['trap','class-call','input-sink','asset-call'].includes(e.kind));
 const trap=events.find(e=>e.kind==='trap'),cls=events.find(e=>e.kind==='class-call'),input=events.find(e=>e.kind==='input-sink'),asset=events.find(e=>e.kind==='asset-call');
 assert.deepEqual(trap,{kind:'trap',selected:0,disabled:0,priorSelected:selected,priorDisabled:disabled});
 assert.equal(cls.selected,selected);assert.equal(cls.disabled,disabled);
 assert.equal(input.args[9],selected);assert.equal(input.args[6],0);
 assert.deepEqual(asset,{kind:'asset-call',state:0,selected:false,disabled:false,trapping:true});
 results.push({input:{kind,selected,disabled},events,passed:true});
}
fs.writeFileSync('research/selection-state-assets-initial-probes.json',JSON.stringify({method:'Retained pNPt CIL replay with original static obfuscation fields; zNUD effect facade follows retained token100702045. Captures calls before actual aNP5/HTML class/input sinks. Native rasterizer, full provider lifecycle, disposal and complete HTML generator are not executed.',sources:[...new Set([...api.boundSources,'research/selection-layout-render-dom-probe.mjs','research/text-autofit-dom-replay.mjs','research/selection-author-resize-class-cil.json','research/selection-layout-indicator-asset-probes.json',import.meta.filename])].map(path=>({path,sha256:sha(path)})),summary:{passed:results.length,failed:0},results},null,2)+'\n',{flag:'wx'});console.log({passed:results.length});
