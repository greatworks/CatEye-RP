import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {inspectRpSemantics} from './scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const modules=new Map();
function moduleUrl(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);const source=stripTypeScriptTypes(fs.readFileSync(file,'utf8')).replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,relative)=>`from ${JSON.stringify(moduleUrl(path.resolve(path.dirname(file),relative.endsWith('.ts')?relative:relative+'.ts')))}`);const url=`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;modules.set(file,url);return url;}
const {importRpSemantics}=await import(moduleUrl('src/model/import-rp.ts'));
const {parseDocument,serializeDocument}=await import(moduleUrl('src/model/document.ts'));
const previous=JSON.parse(fs.readFileSync('research/rich-hyperlink-import-audit.json','utf8'));
const walk=widgets=>widgets.flatMap(w=>[w,...walk((w.states??[]).flatMap(s=>s.widgets)),...walk(w.table?.cells??[])]);
const report={capturedAt:new Date().toISOString(),method:'SHA-pinned native corpus through self-written static readers and pure importer; strict save/reopen, no native DLL/GUI execution',previousStage:'research/rich-hyperlink-import-audit.json',samples:[],totals:{addedTop:0,addedNested:0,eventDelta:0,tables:0,cells:0,richCells:0,links:0}};
for(const old of previous.samples){
 assert.equal(sha(old.file),old.sha256);const semantic=inspectRpSemantics(old.file),item={file:old.file,sha256:old.sha256,compactSemanticBytes:Buffer.byteLength(JSON.stringify(semantic))};
 try{
  const result=importRpSemantics(semantic),widgets=walk(result.document.pages.flatMap(p=>p.widgets)),{issues,...counts}=result.report;
  assert.deepEqual(parseDocument(serializeDocument(result.document)),result.document);
  item.import=counts;item.delta=Object.fromEntries(Object.keys(counts).filter(k=>typeof counts[k]==='number').map(k=>[k,counts[k]-(old.import?.[k]??0)]));
  const isDefault=old.sha256==='9b4f398eab76f6e081f3275824ad15396f670fd2448e7e36b4e4399c40f85d50';
  assert.equal(item.delta.widgetsImported,isDefault?1:0);assert.equal(item.delta.nestedWidgetsImported,isDefault?9:0);assert.equal(item.delta.eventsImported,0);assert.equal(item.delta.actionsImported,0);
  for(const owner of old.linkedOwners??[])assert.deepEqual(widgets.find(w=>w.id===owner.id)?.richText,owner.richText);
  item.tables=widgets.filter(w=>w.type==='table').map(w=>({id:w.id,name:w.name,geometry:{x:w.x,y:w.y,width:w.width,height:w.height},table:w.table,source:issues.find(i=>i.code==='table-matrix-recovery'&&w.id===`rp-w-${i.packageId}-${i.sourceId}`)?.details}));
  item.menuRejections=issues.filter(i=>i.code==='widget-skipped'&&semantic.diagrams.some(d=>d.widgets.some(w=>w.id===i.sourceId&&w.type==='Axure:DiagramObject:MenuObject'))).map(i=>({sourceId:i.sourceId,packageId:i.packageId,message:i.message}));
  report.totals.addedTop+=item.delta.widgetsImported;report.totals.addedNested+=item.delta.nestedWidgetsImported;report.totals.eventDelta+=item.delta.eventsImported;report.totals.tables+=item.tables.length;report.totals.cells+=widgets.filter(w=>w.type==='tableCell').length;report.totals.richCells+=widgets.filter(w=>w.type==='tableCell'&&w.richText).length;report.totals.links+=widgets.reduce((n,w)=>n+(w.richText?.links?.length??0),0);
 }catch(error){if(path.basename(old.file)!=='Icons.rplib')throw error;item.importError=error.message;assert.equal(item.importError,old.importError);}
 report.samples.push(item);
}
assert.deepEqual(report.totals,{addedTop:1,addedNested:9,eventDelta:0,tables:1,cells:9,richCells:3,links:2});
report.sources=['research/table-format-import-audit.mjs','research/rich-hyperlink-import-audit.json','research/table-format-census.json','research/scripts/read-rp-semantics.mjs','src/model/import-rp.ts','src/model/document.ts','src/model/types.ts'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/table-format-import-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,samples:report.samples.map(s=>({file:path.basename(s.file),top:s.import?.widgetsImported,nested:s.import?.nestedWidgetsImported,events:s.import?.eventsImported,delta:s.delta,bytes:s.compactSemanticBytes,error:s.importError}))},null,2));
