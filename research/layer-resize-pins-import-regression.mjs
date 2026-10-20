import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {inspectRpSemantics} from './scripts/read-rp-semantics.mjs';
import {inspectRpSemantics as previousSemantics} from '../.build/before-layer-resize/research/scripts/read-rp-semantics.mjs';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
const urls=new Map();
function url(file){
 file=path.resolve(file);if(urls.has(file))return urls.get(file);
 const code=stripTypeScriptTypes(fs.readFileSync(file,'utf8')).replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,r)=>`from ${JSON.stringify(url(path.resolve(path.dirname(file),r.endsWith('.ts')?r:r+'.ts')))}`);
 const result='data:text/javascript;base64,'+Buffer.from(code).toString('base64');urls.set(file,result);return result;
}
const current=await import(url('src/model/import-rp.ts')),previous=await import(url('.build/before-layer-resize/src/model/import-rp.ts'));
const parse=await import(url('src/model/document.ts'));
const names=new Set(['pinHorizontal','pinVertical','fixedWidth','fixedHeight']);
const strip=value=>Array.isArray(value)?value.map(strip):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!names.has(key)).map(([key,value])=>[key,strip(value)])):value;
const samples=[];
for(const sample of readJson('research/native-layers-format-census.json').samples){
 assert.equal(sha256(sample.file),sample.sha256);
 const semantics=inspectRpSemantics(sample.file),old=previousSemantics(sample.file);
 let a,b,err,oldErr;
 try{a=current.importRpSemantics(semantics)}catch(e){err=e.message}
 try{b=previous.importRpSemantics(old)}catch(e){oldErr=e.message}
 const record={file:sample.file,sha256:sample.sha256,readerBytes:Buffer.byteLength(JSON.stringify(semantics)),oldError:oldErr,error:err,
  currentWidgets:a?.report.widgetsImported,previousWidgets:b?.report.widgetsImported,currentNested:a?.report.nestedWidgetsImported,previousNested:b?.report.nestedWidgetsImported,
  unsupportedPins:semantics.diagrams.flatMap(d=>d.widgets.filter(w=>w.authorResizePinRecovery?.status==='unsupported-author-resize-pins').map(w=>({packageId:d.packageId,id:w.id,reason:w.authorResizePinRecovery.reason}))),
  newSkipped:a?.report.issues.filter(i=>i.severity==='skipped'&&!b?.report.issues.some(j=>j.severity==='skipped'&&i.sourceId===j.sourceId&&i.packageId===j.packageId))??[]};
 if(a&&b){
  try{assert.deepEqual(strip(a.document),b.document);record.onlyPinsChanged=true;}catch(e){record.onlyPinsChanged=false;record.difference=String(e.message).slice(0,2000)}
  try{assert.deepEqual(parse.parseDocument(parse.serializeDocument(a.document)),a.document);record.roundtrip=true;}catch(e){record.roundtrip=false;record.roundtripError=String(e.message).slice(0,2000)}
  let fields=0;const walk=v=>{if(v&&typeof v==='object'){for(const [key,value] of Object.entries(v)){if(names.has(key))fields++;walk(value)}}};walk(a.document);record.preservedPinFields=fields;
 }else record.sameRejection=err===oldErr;
 samples.push(record);
}
const report={originalDllExecuted:false,originalGuiCompared:false,samples,summary:{files:samples.length,admitted:samples.filter(s=>s.currentWidgets!==undefined).length,onlyPinsChanged:samples.filter(s=>s.onlyPinsChanged).length,roundtrips:samples.filter(s=>s.roundtrip).length,sameRejections:samples.filter(s=>s.sameRejection).length,preservedPinFields:samples.reduce((n,s)=>n+(s.preservedPinFields??0),0),newSkipped:samples.reduce((n,s)=>n+s.newSkipped.length,0)},
 sources:['research/layer-resize-pins-import-regression.mjs','research/scripts/read-rp-semantics.mjs',...urls.keys()].map(file=>({file:path.relative(process.cwd(),path.resolve(file)).replaceAll('\\','/'),sha256:sha256(file)}))};
const suffix=process.argv[2]??'first';
assert(/^[a-z0-9-]+$/.test(suffix));
fs.writeFileSync(`research/layer-resize-pins-import-${suffix}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report.summary));
if(samples.some(s=>!(s.sameRejection||s.onlyPinsChanged&&s.roundtrip)))process.exitCode=1;
