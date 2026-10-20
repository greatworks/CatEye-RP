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
const previous=JSON.parse(fs.readFileSync('research/text-decoration-import-audit.json','utf8'));
const font=JSON.parse(fs.readFileSync('research/font-style-import-audit.json','utf8'));
const rich=JSON.parse(fs.readFileSync('research/rich-text-format-import-audit.json','utf8'));
const walk=widgets=>widgets.flatMap(w=>[w,...walk((w.states??[]).flatMap(s=>s.widgets))]);
const report={capturedAt:new Date().toISOString(),method:'Self-written native readers and importer, strict model save/reopen; no vendor assembly, browser, URL or GUI execution',previousStage:'research/text-decoration-import-audit.json',protocol:{runStyleSchemaVersion:2,linkSchemaVersion:1},samples:[],totals:{richWidgets:0,richRuns:0,linkedOwners:0,links:0,addedWidgets:0,lostWidgets:0,addedEvents:0,addedLinkEvents:0,addedOrdinaryEvents:0,addedActions:0}};
for(const old of previous.samples){
 assert.equal(sha(old.file),old.sha256);const semantic=inspectRpSemantics(old.file),item={file:old.file,sha256:old.sha256,compactSemanticBytes:Buffer.byteLength(JSON.stringify(semantic))};
 const priorFont=font.samples.find(s=>s.sha256===old.sha256),priorRich=rich.samples.find(s=>s.sha256===old.sha256);
 const baseline=new Map((priorFont.members??[]).map(m=>[m.id,m]));for(const m of priorRich.added??[])baseline.set(m.id,{...m,events:[]});for(const m of priorRich.eventChanges??[])baseline.set(m.id,{...baseline.get(m.id),events:m.interactions});
 try{
  const result=importRpSemantics(semantic),widgets=walk(result.document.pages.flatMap(p=>p.widgets));assert.deepEqual(parseDocument(serializeDocument(result.document)),result.document);
  const {issues,...counts}=result.report;item.import=counts;item.delta=Object.fromEntries(Object.keys(counts).filter(k=>typeof counts[k]==='number').map(k=>[k,counts[k]-(old.import?.[k]??0)]));
  item.added=widgets.filter(w=>!baseline.has(w.id)).map(w=>({id:w.id,type:w.type,name:w.name,richText:w.richText}));item.lost=[...baseline.keys()].filter(id=>!widgets.some(w=>w.id===id));assert.deepEqual(item.lost,[]);
  item.ordinaryEventChanges=widgets.filter(w=>JSON.stringify(w.interactions)!==JSON.stringify(baseline.get(w.id)?.events??[])).map(w=>({id:w.id,name:w.name,previous:baseline.get(w.id)?.events??[],interactions:w.interactions}));
  item.linkedOwners=widgets.filter(w=>w.richText?.links?.length).map(w=>({id:w.id,name:w.name,text:w.text,richText:w.richText,source:issues.find(i=>i.code==='rich-text-links-recovery'&&w.id===`rp-w-${i.packageId}-${i.sourceId}`)?.details}));
  item.richOwners=widgets.filter(w=>w.richText).length;item.richRuns=widgets.reduce((n,w)=>n+(w.richText?.paragraphs.reduce((n,p)=>n+p.runs.length,0)??0),0);
  const links=item.linkedOwners.flatMap(w=>w.richText.links),linkEvents=links.reduce((n,l)=>n+new Set(l.interactions.map(i=>i.event)).size,0);
  const ordinaryEvents=item.ordinaryEventChanges.reduce((n,w)=>n+new Set(w.interactions.map(i=>i.event)).size-new Set(w.previous.map(i=>i.event)).size,0);
  assert.equal(counts.eventsImported-old.import.eventsImported,linkEvents+ordinaryEvents);
  Object.assign(report.totals,{richWidgets:report.totals.richWidgets+item.richOwners,richRuns:report.totals.richRuns+item.richRuns,linkedOwners:report.totals.linkedOwners+item.linkedOwners.length,links:report.totals.links+links.length,addedWidgets:report.totals.addedWidgets+item.added.length,lostWidgets:report.totals.lostWidgets+item.lost.length,addedEvents:report.totals.addedEvents+item.delta.eventsImported,addedLinkEvents:report.totals.addedLinkEvents+linkEvents,addedOrdinaryEvents:report.totals.addedOrdinaryEvents+ordinaryEvents,addedActions:report.totals.addedActions+item.delta.actionsImported});
 }catch(error){if(path.basename(old.file)!=='Icons.rplib')throw error;item.importError=error.message;assert.equal(item.importError,old.importError);}
 report.samples.push(item);
}
assert.equal(report.totals.linkedOwners,2);assert.equal(report.totals.links,2);assert.equal(report.totals.addedWidgets,2);assert.equal(report.totals.lostWidgets,0);
report.sources=['research/rich-hyperlink-import-audit.mjs','research/text-decoration-import-audit.json','research/rich-hyperlink-format-census.json','research/rich-text-format-import-audit.json','research/font-style-import-audit.json','research/scripts/read-rp-semantics.mjs','research/scripts/read-rp-interactions.mjs','src/model/import-rp.ts','src/model/document.ts','src/model/rich-text.ts','src/model/types.ts'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/rich-hyperlink-import-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totals:report.totals,samples:report.samples.map(s=>({file:path.basename(s.file),top:s.import?.widgetsImported,nested:s.import?.nestedWidgetsImported,events:s.import?.eventsImported,delta:s.delta,bytes:s.compactSemanticBytes,error:s.importError}))},null,2));
