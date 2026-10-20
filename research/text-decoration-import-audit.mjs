import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {inspectRpSemantics} from './scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const url=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const strip=file=>stripTypeScriptTypes(fs.readFileSync(file,'utf8'));
const vector=url(strip('src/model/vector.ts')),tree=url(strip('src/model/page-tree-core.ts')),types=url(strip('src/model/types.ts')),rich=url(strip('src/model/rich-text.ts'));
const documentUrl=url(strip('src/model/document.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./page-tree-core'",JSON.stringify(tree)).replace("'./types'",JSON.stringify(types)).replace("'./rich-text'",JSON.stringify(rich)));
const {importRpSemantics}=await import(url(strip('src/model/import-rp.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./document'",JSON.stringify(documentUrl)).replace("'./page-tree-core'",JSON.stringify(tree)).replace("'./types'",JSON.stringify(types))));
const {parseDocument,serializeDocument}=await import(documentUrl);
const previous=JSON.parse(fs.readFileSync('research/rich-text-format-import-audit.json','utf8'));
const walk=widgets=>widgets.flatMap(w=>[w,...walk((w.states??[]).flatMap(s=>s.widgets))]);
const report={capturedAt:new Date().toISOString(),method:'Self-written parser/importer and strict save/reopen; no vendor assembly or GUI execution',previousStage:'research/rich-text-format-import-audit.json',protocol:{runStyleSchemaVersion:2,requiredRunStyleFields:['fontFamily','fontSize','fontWeight','fontStyle','color','underline','strikethrough']},samples:[],totals:{richWidgets:0,richRuns:0,mixedOwners:0,addedWidgets:0,lostWidgets:0,addedEvents:0,addedRichOwners:0,lostRichOwners:0,baseUnderlineTrue:0,baseStrikethroughTrue:0,runUnderlineTrue:0,runStrikethroughTrue:0,decorationStates:0}};
for(const sample of previous.samples) {
 assert.equal(sha(sample.file),sample.sha256);
 const source=inspectRpSemantics(sample.file),item={file:sample.file,sha256:sample.sha256,compactSemanticBytes:Buffer.byteLength(JSON.stringify(source))};
 const native=source.diagrams.flatMap(d=>d.widgets.map(w=>({id:`rp-w-${d.packageId}-${w.id}`,w}))),nativeById=new Map(native.map(o=>[o.id,o.w]));
 item.readerRichStatuses=native.reduce((n,{w})=>{const status=w.richTextRecovery?.status??'unrecovered-widget';n[status]=(n[status]??0)+1;return n;},{});
 try {
  const result=importRpSemantics(source),widgets=walk(result.document.pages.flatMap(p=>p.widgets));
  assert.deepEqual(parseDocument(serializeDocument(result.document)),result.document);
  const {issues,...counts}=result.report;item.import=counts;assert.deepEqual(counts,sample.import);
  const oldIds=new Set(sample.rich.map(w=>w.id)),current=widgets.filter(w=>w.richText),newIds=new Set(current.map(w=>w.id));
  item.rich=current.map(w=>({id:w.id,type:w.type,paragraphs:w.richText.paragraphs.length,runs:w.richText.paragraphs.reduce((n,p)=>n+p.runs.length,0),underlineRuns:w.richText.paragraphs.flatMap(p=>p.runs).filter(r=>r.style.underline).length,strikethroughRuns:w.richText.paragraphs.flatMap(p=>p.runs).filter(r=>r.style.strikethrough).length}));
  for(const w of current)for(const p of w.richText.paragraphs)for(const r of p.runs) {
   assert.deepEqual(Object.keys(r.style).sort(),report.protocol.requiredRunStyleFields.toSorted());
   assert.equal(typeof r.style.underline,'boolean');assert.equal(typeof r.style.strikethrough,'boolean');
   assert.equal(nativeById.get(w.id).richTextRecovery.source.runStyleSchemaVersion,2);
   report.totals.richRuns++;report.totals.runUnderlineTrue+=Number(r.style.underline);report.totals.runStrikethroughTrue+=Number(r.style.strikethrough);
  }
  item.addedRich=current.filter(w=>!oldIds.has(w.id)).map(w=>w.id);item.lostRich=sample.rich.filter(w=>!newIds.has(w.id)).map(w=>w.id);
  item.baseDecorations=widgets.filter(w=>w.style.underline||w.style.strikethrough).map(w=>({id:w.id,underline:w.style.underline,strikethrough:w.style.strikethrough}));
  item.decorationStates=widgets.flatMap(w=>['selectedStyle','mouseOverStyle','mouseDownStyle','focusedStyle','disabledStyle','errorStyle','hintStyle'].filter(field=>w[field]&&(Object.hasOwn(w[field],'underline')||Object.hasOwn(w[field],'strikethrough'))).map(field=>({id:w.id,field,style:w[field]})));
  item.mixedOwners=(sample.mixedOwners??[]).filter(o=>o.previouslyImported).map(o=>{assert.ok(newIds.has(`rp-w-${o.packageId}-${o.sourceId}`));return {packageId:o.packageId,sourceId:o.sourceId};});
  item.boundaryExamples=['14ea8a9456d14c888e8e483e64492173','4f4e187b657a4108aa50438dd7d0fca8','3471e28ded924670841f3dfd061d33a0'].flatMap(id=>native.filter(o=>o.w.id===id).map(o=>({id:o.id,richRecovery:o.w.richTextRecovery,imported:widgets.some(w=>w.id===o.id)})));
  report.totals.richWidgets+=current.length;report.totals.mixedOwners+=item.mixedOwners.length;
  report.totals.addedRichOwners+=item.addedRich.length;report.totals.lostRichOwners+=item.lostRich.length;
  report.totals.baseUnderlineTrue+=widgets.filter(w=>w.style.underline).length;report.totals.baseStrikethroughTrue+=widgets.filter(w=>w.style.strikethrough).length;
  report.totals.decorationStates+=item.decorationStates.length;
 }catch(error){if(path.basename(sample.file)!=='Icons.rplib')throw error;item.importError=error.message;assert.equal(item.importError,sample.importError);}
 report.samples.push(item);
}
assert.equal(report.totals.richWidgets,632);assert.equal(report.totals.mixedOwners,49);assert.equal(report.totals.addedRichOwners,0);assert.equal(report.totals.lostRichOwners,0);
report.sources=['research/text-decoration-import-audit.mjs','research/rich-text-format-import-audit.json','research/scripts/read-rp-semantics.mjs','src/model/import-rp.ts','src/model/document.ts','src/model/rich-text.ts','src/model/types.ts'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/text-decoration-import-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,samples:report.samples.map(s=>({file:path.basename(s.file),rich:s.rich?.length,top:s.import?.widgetsImported,nested:s.import?.nestedWidgetsImported,events:s.import?.eventsImported,bytes:s.compactSemanticBytes,error:s.importError}))},null,2));
