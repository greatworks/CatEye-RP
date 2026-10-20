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
const previous=JSON.parse(fs.readFileSync('research/font-style-import-audit.json','utf8'));
const mixed=JSON.parse(fs.readFileSync('research/font-style-format-verification.json','utf8'));
const walk=widgets=>widgets.flatMap(w=>[w,...walk((w.states??[]).flatMap(s=>s.widgets))]);
const report={capturedAt:new Date().toISOString(),method:'Current self-written reader/importer and strict save/reopen; no original DLL or GUI execution',previousStage:'research/font-style-import-audit.json',samples:[],totals:{richWidgets:0,mixedOwners:0,mixedParagraphs:0,mixedRuns:0,addedWidgets:0,lostWidgets:0,addedEvents:0}};
for(const sample of previous.samples) {
  assert.equal(sha(sample.file),sample.sha256);
  const semantics=inspectRpSemantics(sample.file),item={file:sample.file,sha256:sample.sha256,compactSemanticBytes:Buffer.byteLength(JSON.stringify(semantics))};
  item.readerRichStatuses=semantics.diagrams.flatMap(d=>d.widgets).reduce((counts,w)=>{const status=w.richTextRecovery?.status??'unrecovered-widget';counts[status]=(counts[status]??0)+1;return counts;},{});
  try {
    const result=importRpSemantics(semantics),widgets=walk(result.document.pages.flatMap(p=>p.widgets)),byId=new Map(widgets.map(w=>[w.id,w]));
    assert.deepEqual(parseDocument(serializeDocument(result.document)),result.document);
    const {issues,...counts}=result.report;item.import=counts;
    item.lost=(sample.members??[]).filter(w=>!byId.has(w.id)).map(w=>({id:w.id,type:w.type,issues:issues.filter(i=>w.id.endsWith(i.sourceId??'!'))}));
    const oldMembers=new Map((sample.members??[]).map(w=>[w.id,w])),oldIds=new Set(oldMembers.keys());
    const native=widget=>{const parts=widget.id.split('-');return semantics.diagrams.find(d=>d.packageId===parts[2])?.widgets.find(w=>w.id===parts[3]);};
    item.added=widgets.filter(w=>!oldIds.has(w.id)).map(w=>({id:w.id,type:w.type,name:w.name,selected:w.selected,selectedStyle:w.selectedStyle,sourceSelection:native(w)?.selectionRecovery}));
    item.eventChanges=widgets.filter(w=>w.interactions.length!==(oldMembers.get(w.id)?.events.length??0)).map(w=>({id:w.id,name:w.name,oldEvents:oldMembers.get(w.id)?.events??[],interactions:w.interactions,targets:w.interactions.flatMap(i=>i.actions).map(a=>{const target=byId.get(a.targetId);return {targetId:a.targetId,selectedStyle:target?.selectedStyle,selectionRecovery:target?native(target)?.selectionRecovery:null};})}));
    item.rich=widgets.filter(w=>w.richText).map(w=>({id:w.id,type:w.type,paragraphs:w.richText.paragraphs.length,runs:w.richText.paragraphs.reduce((n,p)=>n+p.runs.length,0),textLength:w.text.length,literal:w.richText.expressionMode==='literal'}));
    item.textCorrections=widgets.filter(w=>w.richText && native(w)?.text.text!==w.text).map(w=>({id:w.id,previousText:native(w).text.text,text:w.text,removedDuplicateLF:native(w).richTextRecovery.source.normalizedBoundaryLF}));
    item.richOmissions=issues.filter(i=>i.code==='rich-text-omitted');
    item.mixedOwners=[];
    for(const owner of mixed.samples.find(s=>s.sha256===sample.sha256)?.italicOwners??[]) {
      const widget=byId.get(`rp-w-${owner.packageId}-${owner.objectId}`),raw=semantics.diagrams.find(d=>d.packageId===owner.packageId)?.widgets.find(w=>w.id===owner.objectId);
      const entry={packageId:owner.packageId,sourceId:owner.objectId,previouslyImported:owner.imported,readerStatus:raw?.richTextRecovery?.status,readerReason:raw?.richTextRecovery?.reason,imported:!!widget,rich:!!widget?.richText};
      if(owner.imported) {
        assert.ok(widget?.richText,`Missing mixed owner ${owner.objectId}`);
        assert.equal(widget.text,raw.richTextRecovery.text);
        entry.paragraphs=widget.richText.paragraphs.length;entry.runs=widget.richText.paragraphs.reduce((n,p)=>n+p.runs.length,0);
        entry.boundaryLFRemoved=raw.richTextRecovery.source.normalizedBoundaryLF;entry.text=widget.text;
        entry.runFontSizes=[...new Set(widget.richText.paragraphs.flatMap(p=>p.runs.map(r=>r.style.fontSize)))];entry.widgetFontSize=widget.style.fontSize;
        report.totals.mixedOwners++;report.totals.mixedParagraphs+=entry.paragraphs;report.totals.mixedRuns+=entry.runs;
      } else assert.equal(raw?.richTextRecovery?.status,'unsupported-rich-text');
      item.mixedOwners.push(entry);
    }
    item.addedEvents=counts.eventsImported-sample.import.eventsImported;
    report.totals.richWidgets+=item.rich.length;report.totals.addedWidgets+=item.added.length;report.totals.lostWidgets+=item.lost.length;report.totals.addedEvents+=item.addedEvents;
  } catch(error) {
    if(path.basename(sample.file)!=='Icons.rplib')throw error;
    item.importError=error.message;assert.equal(item.importError,sample.importError??sample.error);
  }
  report.samples.push(item);
}
assert.equal(report.totals.mixedOwners,49);assert.equal(report.totals.mixedParagraphs,241);assert.equal(report.totals.mixedRuns,1093);assert.equal(report.totals.lostWidgets,0);
report.sources=['research/rich-text-format-import-audit.mjs','research/font-style-import-audit.json','research/font-style-format-verification.json','research/scripts/read-rp-semantics.mjs','src/model/import-rp.ts','src/model/document.ts','src/model/rich-text.ts'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/rich-text-format-import-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,samples:report.samples.map(s=>({file:path.basename(s.file),rich:s.rich?.length,mixed:s.mixedOwners?.filter(m=>m.rich).length,lost:s.lost?.length,added:s.added?.length,events:s.addedEvents,bytes:s.compactSemanticBytes,error:s.importError}))},null,2));
