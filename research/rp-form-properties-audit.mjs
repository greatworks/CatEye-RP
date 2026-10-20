import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {inspectRpSemantics,property as p} from './scripts/read-rp-semantics.mjs';
import {recoverInteractionMap} from './scripts/read-rp-interactions.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const url=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const strip=file=>stripTypeScriptTypes(fs.readFileSync(file,'utf8'));
const vector=url(strip('src/model/vector.ts')),tree=url(strip('src/model/page-tree-core.ts'));
const docModule=url(strip('src/model/document.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./page-tree-core'",JSON.stringify(tree)));
const {importRpSemantics}=await import(url(strip('src/model/import-rp.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./document'",JSON.stringify(docModule)).replace("'./page-tree-core'",JSON.stringify(tree))));
const flatten=ws=>ws.flatMap(w=>[w,...(w.states??[]).flatMap(s=>flatten(s.widgets))]);
const inputs=JSON.parse(fs.readFileSync('research/rp-form-candidates-evidence.json','utf8')).samples;
const count=(object,key)=>object[key]=(object[key]??0)+1;
const sources=['research/rp-form-candidates-evidence.json','research/rp-form-properties-audit.mjs','research/rp-form-properties-metadata.ps1','research/rp-form-properties-metadata.json','research/rp-form-properties-html-cil.json','research/rp-form-properties-html-writer-cil.json','research/rp-form-properties-focus-cil.json','research/rp-interaction-TextBox-cil.json','research/rp-interaction-PlainTextObject-cil.json','research/rp-interaction-InputType-cil.json','research/rp-interaction-IxDiagramObjectPathsAction-cil.json','research/scripts/read-rp-semantics.mjs','research/scripts/read-rp-interactions.mjs','src/model/import-rp.ts','research/scripts/read-rp-form-properties.test.mjs','tests/import-rp-form-properties.test.ts'];
const report={method:'Pure self-written package decoding and static metadata/CIL inspection; no target assembly execution or original GUI verification',sources:sources.map(file=>({file,sha256:sha(file)})),samples:[],inputs:[],focus:[],totals:{inputTypes:{},readOnly:{},maxLength:{},submit:{},focusActions:0}};
for(const sample of inputs){
 const decoded=inspectRpObjects(sample.file);if(decoded.fileSha256!==sample.sha256)throw new Error('Original source changed');
 const semantic=inspectRpSemantics(sample.file),summary={file:sample.file,sha256:sample.sha256,inputCount:0,readOnlyTrue:0,focusActions:0,nonzeroSubmit:0};report.samples.push(summary);
 for(const pack of decoded.packages){
  const objects=new Map((pack.objects??[]).map(o=>[o.id,o]));
  const diagram=semantic.diagrams.find(d=>d.packageId===pack.packageId),members=new Map((diagram?.widgets??[]).map(w=>[w.id,w]));
  const identity=o=>({sample:path.basename(sample.file),sampleSha256:sample.sha256,packageId:pack.packageId,packageSha256:pack.sha256,version:pack.version,id:o.id,type:o.type,label:p(p(o.properties,'name-block'),'text')??null});
  for(const o of objects.values()){
   if(/:(TextBox|TextArea)$/.test(o.type)){
    const fields=Object.fromEntries(['ReadOnly','MaxLength','Type','WordWrap','SubmitButton'].map(k=>[k,p(o.properties,k)??null]));
    summary.inputCount++;if(fields.ReadOnly===true)summary.readOnlyTrue++;
    count(report.totals.inputTypes,`${o.type}:${fields.Type}`);count(report.totals.readOnly,String(fields.ReadOnly));count(report.totals.maxLength,`${o.type}:${fields.MaxLength}`);
    const submit=fields.SubmitButton?.$reference==='0'.repeat(32)&&fields.SubmitButton.referenceTag===3?'zero':'nonzero-or-invalid';count(report.totals.submit,submit);if(submit!=='zero')summary.nonzeroSubmit++;
    report.inputs.push({...identity(o),fields,directMember:members.has(o.id),recovery:members.get(o.id)?.formPropertiesRecovery??null,typeCandidate:members.get(o.id)?.typeCandidate??null});
   }
   if(o.type==='Axure:InteractionSetFocusOnWidgetAction'){
    summary.focusActions++;report.totals.focusActions++;
    const paths=(p(o.properties,'panelobjectpaths')??[]).map(ref=>objects.get(ref.$reference));
    const owner=[];for(const w of objects.values()){const map=objects.get(p(w.properties,'InteractionMap')?.$reference);if((p(map?.properties,'node-table')?.$map??[]).some(([,r])=>r.$reference===o.id))owner.push({id:w.id,type:w.type,label:p(p(w.properties,'name-block'),'text')??null,directMember:members.has(w.id),interactionRecovery:recoverInteractionMap({owner:w,objects,packageId:pack.packageId})});}
    report.focus.push({...identity(o),properties:o.properties,paths:paths.map(q=>({id:q?.id,type:q?.type,properties:q?.properties})),owners:owner});
   }
  }
 }
 try{const result=importRpSemantics(semantic,sample.file),ws=result.document.pages.flatMap(p=>flatten(p.widgets));summary.import={widgets:result.report.widgetsImported,skipped:result.report.widgetsSkipped,nested:result.report.nestedWidgetsImported,nestedSkipped:result.report.nestedWidgetsSkipped,readOnlyTrue:ws.filter(w=>w.readOnly===true).map(w=>({id:w.id,name:w.name,type:w.type})),maxLength:ws.filter(w=>w.maxLength!==undefined).length,focusActions:ws.flatMap(w=>w.interactions).flatMap(i=>i.actions).filter(a=>a.type==='setFocus').length};}catch(error){summary.import={rejected:error.message};}
}
fs.writeFileSync('research/rp-form-properties-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,samples:report.samples.map(s=>({...s,file:path.basename(s.file)}))},null,2));
