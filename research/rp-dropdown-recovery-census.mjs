import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectRpSemantics} from './scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const samples=JSON.parse(fs.readFileSync('research/rp-form-candidates-evidence.json','utf8')).samples;
const report={method:'Own static reader over eleven SHA-pinned original files; no original GUI or target assembly execution',
 sources:['research/scripts/read-rp-semantics.mjs','research/scripts/read-rp-interactions.mjs','research/scripts/read-rp-dropdown.test.mjs','research/rp-dropdown-evidence.json','research/rp-dropdown-function-records.json','research/rp-dropdown-html-cil.json','research/rp-dropdown-html-writer-cil.json','research/rp-dropdown-option-writer-cil.json','research/rp-dropdown-option-literal-cil.json'].map(file=>({file,sha256:sha(file)})),samples:[],controls:[]};
for(const sample of samples){
 const result=inspectRpSemantics(sample.file);if(result.sourceFileSha256!==undefined&&result.sourceFileSha256!==sample.sha256)throw new Error('Source identity mismatch');if(sha(sample.file)!==sample.sha256)throw new Error('Source file changed');
 const controls=result.diagrams.flatMap(d=>d.widgets.filter(w=>w.selectRecovery).map(w=>({sample:path.basename(sample.file),sourceSha256:sample.sha256,packageId:d.packageId,sourcePartSha256:d.sourcePartSha256,pageOrStateName:d.name,rootType:d.rootType,id:w.id,label:w.label,nativeType:w.type,typeCandidate:w.typeCandidate,storedGeometry:w.storedGeometry,selectRecovery:w.selectRecovery,interactionRecovery:w.interactionRecovery})));
 report.samples.push({file:sample.file,sha256:sample.sha256,controls:controls.length,recovered:controls.filter(c=>c.selectRecovery.status==='decoded-select-properties').length,semanticFailures:result.semanticFailures});
 for(const c of controls){const r=c.selectRecovery;if(r.status==='decoded-select-properties'){
  const selected=r.storedSelectedIndices;
  c.standardHtmlInitialSelection={mappingBoundary:'Independent HTML mapping from proved parameter/control flow; obfuscated native attribute literal names not decoded',size:r.selectMode==='listbox'?2:null,
   effectiveSelectedIndices:r.multiple?selected:selected.length?[selected.at(-1)]:r.selectMode==='dropdown'&&r.options.length?[0]:[],
   rule:r.multiple?'multiple-stored':r.selectMode==='listbox'?'single-listbox-last-selected-or-none':'single-dropdown-first-or-last-selected'};
 }report.controls.push(c);}
}
report.totals={controls:report.controls.length,recovered:report.controls.filter(c=>c.selectRecovery.status==='decoded-select-properties').length,options:report.controls.reduce((n,c)=>n+(c.selectRecovery.options?.length??0),0),supportedOwnerEvents:report.controls.flatMap(c=>c.interactionRecovery.events).filter(e=>e.status==='supported-event').length,unsupportedOwnerEvents:report.controls.flatMap(c=>c.interactionRecovery.events).filter(e=>e.status==='unsupported-event').length};
fs.writeFileSync('research/rp-dropdown-recovery-census.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,samples:report.samples.map(s=>({file:path.basename(s.file),controls:s.controls,recovered:s.recovered}))},null,2));
