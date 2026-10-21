// Retained SelectionButton HTML writer control flow; explicit CSS/image/font sinks.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
process.on('uncaughtException',error=>{
 const message=String(error.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<retained-DOM-adapter>');
 let n=1;while(fs.existsSync(`research/selection-layout-render-dom-failure-${n}.json`))n++;
 fs.writeFileSync(`research/selection-layout-render-dom-failure-${n}.json`,JSON.stringify({message,probeSha256:sha('research/selection-layout-render-dom-probe.mjs')},null,2)+'\n');
 console.error(message);process.exitCode=1;
});
const adapterFile='research/text-autofit-dom-replay.mjs';
let code=fs.readFileSync(adapterFile,'utf8').split('const results=[];')[0];
code=code.replace("'./gradient-angle-static-flow.mjs'",JSON.stringify(pathToFileURL('research/gradient-angle-static-flow.mjs').href))
 .replace("'./text-autofit-native-literals.mjs'",JSON.stringify(pathToFileURL('research/text-autofit-native-literals.mjs').href))
 .replace("const methods=new Map(sources", "sources.push('research/rp-selection-layout-radio-html-cil.json','research/selection-layout-render-tags-cil.json','research/selection-layout-render-input-id-cil.json');\nconst methods=new Map(sources")
 .replace("i.Resolved.endsWith('VectorShape')&&v?.kind==='shape'?v:null",
  "(i.Resolved.endsWith('VectorShape')&&v?.kind==='shape')||(i.Resolved.endsWith('RadioButton')&&v?.kind==='radio')?v:null")
 .replace("throw Error(`Unmodelled ${c} in ${name} at ${i.Offset}`);",String.raw`
   if(c==='kJm2.KJm7::iJqD'){pop();s.push('checkbox');continue}
   if(c==='fNiZ.FNiU::YNi4'){pop();s.push(true);continue}
   if(c==='Axure.DocumentModel.Objects.SelectionButton::zNUD'){pop();s.push({dispose:true});continue}
   if(c==='kJm2.KJm7::IJpz'){pop();s.push('label');continue}
   if(c==='kJm2.KJm7::oIYX'){pop();s.push('data-label');continue}
   if(c==='fNiZ.FNiU::CNPv'){pop();s.push(true);continue}
   if(c==='kJm2.KJm7::vJqV'){pop();s.push('');continue}
   if(c==='fNiZ.FNiU::MNP1'){pop();pop();s.push('');continue}
   if(c==='uNL7.JNLP::xNKd'){pop();s.push(false);continue}
   if(c==='fNiZ.FNiU::zNPc'){const a=s.splice(s.length-4,4);s.push(run('zNPc',a,out).value);continue}
   if(c==='UNxR.xNxg::wNxE'){s.splice(s.length-6,6);s.push('ax_default');continue}
   if(c==='uNL7.JNLP::kNLm'){pop();pop();out.events.push({kind:'label-css-sink'});continue}
   if(c==='uNL7.JNLP::SNLp'){s.splice(s.length-6,6);out.events.push({kind:'owner-css-sink'});continue}
   if(c==='kJm2.KJm7::CJOf'){pop();s.push(1);continue}
   if(c==='fNiZ.FNiU::aNP5'){s.splice(s.length-5,5);s.push('<svg>image-sink</svg>');continue}
   if(c==='oNCN.BNCJ::uNCx'){s.splice(s.length-5,5);out.events.push({kind:'indicator-svg-sink'});continue}
   if(c==='oNCN.BNCJ::rNCc'){run('rNCc',s.splice(s.length-2,2),out);continue}
   if(c==='oNCN.BNCJ::gNCW'){run('gNCW',[pop()],out);continue}
   if(c==='oNCN.BNCJ::JNCt'){const args=s.splice(s.length-12,12);out.events.push({kind:'input-sink',args:args.slice(1)});continue}
   if(c==='Axure.DocumentModel.Objects.RadioButton::get_RadioGroup'){pop();s.push('');continue}
   if(c==='kJm2.KJm7::PJqk'){pop();s.push(null);continue}
   if(c==='fNiZ.FNiU::jNiY'){s.push(run('jNiY',[pop()],out).value);continue}
   if(c==='System.Array::Empty<generic>'){s.push([]);continue}
   throw Error('Unmodelled '+c+' in '+name+' at '+i.Offset);`);
code+=String.raw`
export function render(kind){
 const shape={kind,id:'u1',text:'Choice',rect:{x:100,y:100,width:100,height:20},panel:{},asImage:false};
 return run('pNPt',[shape,{writer:{GNCy:{hasValue:false}},css:{idClasses:false}}]).out;
}
export const boundSources=sources;
`;
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const results=[];
for(const kind of ['checkbox','radio']){
 const out=api.render(kind);
 const dom=out.events.filter(e=>['open','rich-content','close','input-sink','indicator-svg-sink'].includes(e.kind));
 const labels=dom.filter(e=>e.kind==='open'&&e.tag==='label');
 assert.equal(dom[0].attributes.id,'u1');
 assert.equal(labels.length,1);
 const labelStart=dom.indexOf(labels[0]),textStart=dom.findIndex(e=>e.kind==='open'&&e.attributes.id==='u1_text');
 const labelEnd=dom.findIndex(e=>e.kind==='close'&&e.tag==='label');
 assert(labelStart<textStart&&textStart<labelEnd);
 results.push({kind,passed:true,dom,trace:out.trace});
}
fs.writeFileSync('research/selection-layout-render-dom-probes.json',JSON.stringify({
 method:'Retained CIL HTML writer replay; no native DLL execution, generated project, browser, font or SVG rasterization.',
 sources:[...new Set([...api.boundSources,adapterFile,'research/selection-layout-render-dom-probe.mjs','research/text-autofit-native-literals.mjs','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json'])].map(path=>({path,sha256:sha(path)})),
 summary:{total:results.length,passed:results.length,failed:0},
 sinks:['No adaptive/master/repeater/IX states; provider flags explicit.',
 'Owner classes/CSS generation, indicator asset, native text measurement/rich payload remain sinks.',
 'Input serialization is captured as call arguments; label/text wrappers are replayed.',
 'Safe ASCII identifier/string encoding facade, not general escaping equivalence.'],results
},null,2)+'\n');
console.log(JSON.stringify({total:results.length,passed:results.length}));
