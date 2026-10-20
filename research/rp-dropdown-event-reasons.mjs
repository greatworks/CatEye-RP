import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {inspectRpSemantics} from './scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const url=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const strip=file=>stripTypeScriptTypes(fs.readFileSync(file,'utf8'));
const vector=url(strip('src/model/vector.ts')),tree=url(strip('src/model/page-tree-core.ts')),types=url(strip('src/model/types.ts'));
const documentUrl=url(strip('src/model/document.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./page-tree-core'",JSON.stringify(tree)).replace("'./types'",JSON.stringify(types)));
const {importRpSemantics}=await import(url(strip('src/model/import-rp.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./document'",JSON.stringify(documentUrl)).replace("'./page-tree-core'",JSON.stringify(tree)).replace("'./types'",JSON.stringify(types))));
const audit=JSON.parse(fs.readFileSync('research/dropdown-import-audit.json','utf8'));
const sample=audit.samples.find(s=>s.file.endsWith('Sample form patterns.rplib'));
if(sha(sample.file)!==sample.sha256)throw Error('Source hash changed');
const semantics=inspectRpSemantics(sample.file),result=importRpSemantics(semantics);
const walk=widgets=>widgets.flatMap(w=>[w,...walk((w.states??[]).flatMap(s=>s.widgets))]);
const imported=new Map(walk(result.document.pages.flatMap(p=>p.widgets)).map(w=>[w.id,w]));
const events=[];
for(const diagram of semantics.diagrams)for(const owner of diagram.widgets)if(owner.typeCandidate?.type==='select')for(const [eventIndex,event] of owner.interactionRecovery.events.entries())if(event.status==='supported-event'){
 const targets=event.cases.flatMap(c=>c.actions).map(action=>{const target=diagram.widgets.find(w=>w.id===action.targetSourceId);return {actionType:action.type,targetId:action.targetSourceId,label:target?.label,nativeType:target?.type,typeCandidate:target?.typeCandidate,imported:imported.has(`rp-w-${diagram.packageId}-${action.targetSourceId}`),selectionRecovery:target?.selectionRecovery,storedFlags:target?.storedFlags,issues:result.report.issues.filter(i=>i.packageId===diagram.packageId&&i.sourceId===action.targetSourceId)};});
 events.push({packageId:diagram.packageId,page:diagram.name,ownerId:owner.id,ownerLabel:owner.label,ownerImported:imported.has(`rp-w-${diagram.packageId}-${owner.id}`),eventId:event.id,eventType:event.event,eventIndex,targets,importIssues:result.report.issues.filter(i=>i.packageId===diagram.packageId&&i.sourceId===owner.id&&i.code==='interaction-event-skipped'&&i.details?.eventIndex===eventIndex)});
}
const output={method:'Read-only one-sample pure importer audit; no product mutations or full test suite',sample:{file:sample.file,sha256:sample.sha256},sources:['src/model/import-rp.ts','research/scripts/read-rp-semantics.mjs','research/scripts/read-rp-interactions.mjs','research/dropdown-import-audit.json'].map(file=>({file,sha256:sha(file)})),summary:{decodedSelectOwnerEvents:events.length,importedSelectOwnerEvents:[...imported.values()].filter(w=>w.type==='select').reduce((n,w)=>n+w.interactions.length,0),formEventsImported:result.report.eventsImported,allCorpusAddedEvents:audit.addedEvents},events};
fs.writeFileSync('research/rp-dropdown-event-reasons.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({summary:output.summary,targets:[...new Map(events.flatMap(e=>e.targets).map(t=>[t.targetId,{id:t.targetId,label:t.label,imported:t.imported,selection:t.selectionRecovery}])).values()]},null,2));
