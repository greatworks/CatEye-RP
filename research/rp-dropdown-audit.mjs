import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {inspectRpSemantics,property as p} from './scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const url=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const strip=file=>stripTypeScriptTypes(fs.readFileSync(file,'utf8'));
const vector=url(strip('src/model/vector.ts')),tree=url(strip('src/model/page-tree-core.ts')),types=url(strip('src/model/types.ts'));
const docModule=url(strip('src/model/document.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./page-tree-core'",JSON.stringify(tree)).replace("'./types'",JSON.stringify(types)));
const {importRpSemantics}=await import(url(strip('src/model/import-rp.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./document'",JSON.stringify(docModule)).replace("'./page-tree-core'",JSON.stringify(tree)).replace("'./types'",JSON.stringify(types))));
const report={method:'Static original package/CIL inspection and own pure parser/importer; no target execution',sources:['research/rp-dropdown-audit.mjs','research/scripts/read-rp-semantics.mjs','research/scripts/read-rp-interactions.mjs','src/model/import-rp.ts','research/rp-dropdown-ComboBox-cil.json','research/rp-dropdown-ListBox-cil.json','research/rp-dropdown-ListObject-cil.json','research/rp-dropdown-select-object-cil.json','research/rp-dropdown-html-cil.json','research/rp-dropdown-html-writer-cil.json','research/rp-dropdown-option-writer-cil.json','research/rp-dropdown-metadata.json'].map(file=>({file,sha256:sha(file)})),samples:[],controls:[]};
const samples=JSON.parse(fs.readFileSync('research/rp-form-candidates-evidence.json','utf8')).samples;
for(const sample of samples){
 const decoded=inspectRpObjects(sample.file);if(decoded.fileSha256!==sample.sha256)throw new Error('Original source hash changed');
 const semantic=inspectRpSemantics(sample.file);let imported;try{imported=importRpSemantics(semantic,sample.file);}catch{}
 const summary={file:sample.file,sha256:sample.sha256,controls:0};report.samples.push(summary);
 for(const pack of decoded.packages){const objects=new Map((pack.objects??[]).map(o=>[o.id,o])),diagram=semantic.diagrams.find(d=>d.packageId===pack.packageId);
  for(const widget of objects.values())if(/:(ComboBox|ListBox)$/.test(widget.type)){
   summary.controls++;
   const refs=p(widget.properties,'list-options'),options=Array.isArray(refs)?refs.map((ref,index)=>{const o=objects.get(ref?.$reference);return{index,reference:ref,...o,label:p(o?.properties,'object'),selected:p(o?.properties,'selected')};}):null;
   const keys=new Set((options??[]).flatMap(o=>(o.properties?.$map??[]).map(([k])=>k))),labels=options?.map(o=>o.label)??[],selected=options?.filter(o=>o.selected===true).map(o=>o.index)??[];
   const recovery=diagram?.widgets.find(w=>w.id===widget.id);
   const interactionMap=objects.get(p(widget.properties,'InteractionMap')?.$reference),nodeRefs=p(p(interactionMap?.properties,'node-table'),'x');
   const nodes=(p(interactionMap?.properties,'node-table')?.$map??[]).map(([,ref])=>objects.get(ref?.$reference)).filter(Boolean);
   const flags=Object.fromEntries(['multiple','WordWrap','ReadOnly','PlaceholderText','HideHintOnFocus','Type','SubmitButton','Disabled','Selected','Error','IsContained','VisibleFromSettings','AdaptiveStyles'].map(k=>[k,p(widget.properties,k)]));
   report.controls.push({sample:path.basename(sample.file),sourceSha256:sample.sha256,packageId:pack.packageId,packageSha256:pack.sha256,version:pack.version,pageOrStateName:diagram?.name,rootType:diagram?.rootType,id:widget.id,type:widget.type,name:p(p(widget.properties,'name-block'),'text'),text:p(p(widget.properties,'TextBlock'),'text'),flags,optionSummary:{count:options?.length,selectedIndexes:selected,optionKeys:[...keys],duplicateLabels:labels.filter((v,i)=>labels.indexOf(v)!==i),allLabelsStrings:labels.every(v=>typeof v==='string'),allSelectedBooleans:options?.every(o=>typeof o.selected==='boolean'),allExactReferences:refs?.every(r=>r.referenceTag===3&&Object.keys(r).sort().join(',')==='$reference,referenceTag'),allSelectObject:options?.every(o=>o.type==='Axure:SelectObject'),allUniqueReferences:new Set(refs?.map(r=>r.$reference)).size===refs?.length,whitespaceLabels:labels.map((value,index)=>({value,index})).filter(o=>typeof o.value==='string'&&o.value.trim()!==o.value)},nativeWidget:widget,options,recovery,interactionNodes:nodes,importIssues:imported?.report.issues.filter(i=>i.packageId===pack.packageId&&i.sourceId===widget.id)??[]});
  }
 }
}
report.totals={controls:report.controls.length,byType:report.controls.reduce((a,c)=>(a[c.type]=(a[c.type]??0)+1,a),{}),options:report.controls.reduce((a,c)=>a+c.optionSummary.count,0),selectedCountDistribution:report.controls.reduce((a,c)=>(a[c.optionSummary.selectedIndexes.length]=(a[c.optionSummary.selectedIndexes.length]??0)+1,a),{}),optionKeys:[...new Set(report.controls.flatMap(c=>c.optionSummary.optionKeys))]};
fs.writeFileSync('research/rp-dropdown-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,controls:report.controls.map(c=>({sample:c.sample,page:c.pageOrStateName,id:c.id,name:c.name,multiple:c.flags.multiple,count:c.optionSummary.count,selected:c.optionSummary.selectedIndexes,duplicates:c.optionSummary.duplicateLabels,events:c.recovery?.interactionRecovery.events?.map(e=>({type:e.nativeEventType,status:e.status,reason:e.reason}))}))},null,2));
