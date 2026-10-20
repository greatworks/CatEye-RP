/** New-stage audit only. Never rewrites any preceding format/bindings evidence. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {recoverInteractionMap as after} from './scripts/read-rp-interactions.mjs';
import {recoverInteractionMap as before} from '../.build/before-runtime-transform/research/scripts/read-rp-interactions.mjs';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const property=(o,k)=>o.properties?.$map?.find(([n])=>n===k)?.[1];
const reference=file=>({file,sha256:hash(file)});
const input=JSON.parse(fs.readFileSync('research/runtime-transform-bindings-case-census.json','utf8'));
const sourcePaths=['research/scripts/read-rp-interactions.mjs','research/scripts/read-rp-transform.test.mjs','research/scripts/read-rp-objects.mjs','.build/before-runtime-transform/research/scripts/read-rp-interactions.mjs','research/runtime-transform-bindings-evidence.json','research/runtime-transform-bindings-case-census.json'];
const initialHashes=sourcePaths.map(reference),samples=[],changes=[],checks=[],isolatedActions=[];
const ZERO='0'.repeat(32),ref=id=>({$reference:id,referenceTag:3});
// Diagnostic isolation: keep every original action/info/expression/path object
// unchanged and replace only the owner tree with one synthetic Click/case.
// This must never be counted as a source event or product admission.
function isolated(owner,objects,packageId,actionId){
 const map=new Map(objects),copy=structuredClone(owner);map.set(owner.id,copy);let n=1;
 const add=(type,props={})=>{const id='facefeed'+(n++).toString(16).padStart(24,'0');assert.ok(!map.has(id));const o={id,type,properties:{$map:Object.entries(props)}};map.set(id,o);return o;};
 const event=add('Axure:InteractionEvent',{Disabled:false,'event-type':16,'master-containing-raised-event':{$reference:ZERO,referenceTag:16},'raised-event-id':{$guid:ZERO},'variable-id':{$guid:ZERO}}),c=add('Axure:InteractionCase',{Disabled:false,Description:'SYNTHETIC carrier isolation',Condition:ref(ZERO),IsNewIfGroup:true}),tree=add('Axure:Tree'),en=add('Axure:Node'),cn=add('Axure:Node'),an=add('Axure:Node');
 for(const[o,parent,children]of[[en,tree,[cn]],[cn,en,[an]],[an,cn,[]]])o.properties.$map=Object.entries({'parent-node':ref(parent.id),tree:ref(tree.id),children:children.map(x=>ref(x.id))});
 tree.properties.$map=Object.entries({tree:ref(tree.id),children:[ref(en.id)]});
 const m=add('Axure:InteractionTreeMap',{PackageMode:false,tree:ref(tree.id),'node-table':{$map:[[ref(en.id),ref(event.id)],[ref(cn.id),ref(c.id)],[ref(an.id),ref(actionId)]]}}),key=owner.type.startsWith('Axure:DiagramObject:')?'InteractionMap':'interactionmap';
 copy.properties.$map=copy.properties.$map.filter(([k])=>k!==key);copy.properties.$map.push([key,ref(m.id)]);
 const e=after({owner:copy,objects:map,packageId}).events[0];assert.equal(e.status,'supported-event',e.reason);assert.equal(e.cases[0].actions.length,1);return e.cases[0].actions[0];
}
let owners=0,previouslySupported=0,preservedSupported=0,addedEvents=0,addedActions=0;
for(const sample of input.samples){
 assert.equal(hash(sample.file),sample.sha256);const data=inspectRpObjects(sample.file);let ownerCount=0,supportedBefore=0,supportedAfter=0;
 for(const pack of data.packages){if(!pack.objects)continue;const objects=new Map(pack.objects.map(o=>[o.id,o]));
  const relevant=input.cases.filter(c=>c.file===sample.file&&c.packageId===pack.packageId),seenActions=new Set();
  for(const c of relevant)for(const a of c.orderedActions){if(!a.infos||seenActions.has(a.sourceId))continue;seenActions.add(a.sourceId);isolatedActions.push({method:'SYNTHETIC Click/case isolation of an unchanged real action carrier; not source-event recovery',file:sample.file,sha256:sample.sha256,packageId:pack.packageId,sourcePartSha256:pack.sha256,ownerId:c.owners[0].id,originalEventId:c.eventId,originalNativeEventType:c.nativeEventType,action:isolated(objects.get(c.owners[0].id),objects,pack.packageId,a.sourceId)});}
  for(const owner of pack.objects){const map=property(owner,owner.type.startsWith('Axure:DiagramObject:')?'InteractionMap':'interactionmap');if(!map||map.$reference==='0'.repeat(32))continue;
   owners++;ownerCount++;const b=before({owner,objects,packageId:pack.packageId}),a=after({owner,objects,packageId:pack.packageId});
   assert.equal(a.status,b.status,'tree structural status must remain unchanged');
   for(const previous of b.events){const current=a.events.find(e=>e.id===previous.id);assert.ok(current,'prior event identity retained');
    if(previous.status==='supported-event'){previouslySupported++;supportedBefore++;assert.deepEqual(current,previous,'already-supported complete event must not change');preservedSupported++;}
    if(current.status==='supported-event')supportedAfter++;
    if(JSON.stringify(previous)!==JSON.stringify(current)){
     const row={file:sample.file,sha256:sample.sha256,packageId:pack.packageId,sourcePartSha256:pack.sha256,ownerId:owner.id,ownerType:owner.type,ownerName:property(owner,'Name')??property(owner,'name'),before:previous,after:current};changes.push(row);
     if(current.status==='supported-event'){addedEvents++;addedActions+=current.cases.flatMap(c=>c.actions).filter(a=>a.type==='move'||a.type==='resize').length;}
    }
   }
  }
 }
 assert.equal(hash(sample.file),sample.sha256);samples.push({...sample,owners:ownerCount,supportedBefore,supportedAfter});
}
assert.equal(addedEvents,10);assert.ok(changes.filter(c=>c.after.status==='supported-event').every(c=>c.after.nativeEventType===16));
const caseResults=input.cases.map(c=>{const change=changes.find(x=>x.packageId===c.packageId&&x.ownerId===c.owners[0].id&&x.after.id===c.eventId);return{file:c.file,packageId:c.packageId,caseId:c.caseId,eventId:c.eventId,ownerIds:c.owners.map(o=>o.id),mixedMoveSize:c.mixedMoveSize,nativeEventType:c.nativeEventType,result:change?.after??c.freshReaderDiagnostics[0].result};});
assert.equal(caseResults.filter(c=>c.mixedMoveSize).length,6);assert.ok(caseResults.filter(c=>c.mixedMoveSize).every(c=>c.result.status==='unsupported-event'));
checks.push({name:'All11 original source hashes unchanged',passed:true},{name:'All previously supported events byte-equivalent in JSON projection',passed:true},{name:'Exactly10 complete source Click events newly decoded; no event gate broadened',passed:true},{name:'All6 mixed Move/Size cases still reject their unsupported native event',passed:true});
assert.equal(isolatedActions.length,55);
const output={method:'Fresh11-sample native container/object read and per-owner interaction-reader comparison against the immutable pre-transform reader. Reader support is not product import admission. All originals remain unchanged.',originalDllExecuted:false,originalAxureGuiCompared:false,sources:initialHashes,samples,totals:{samples:samples.length,owners,previouslySupported,preservedSupported,addedEvents,addedTransformActions:addedActions,changedDiagnostics:changes.filter(c=>c.after.status!=='supported-event').length,sourceTransformActions:55,sourceTransformTargetRecords:63,sourceBoundaries:12,mixedMoveSizeCases:6,recoveredMixedMoveSizeCases:0,syntheticIsolatedCarriers:isolatedActions.length},changes,caseResults,isolatedActions,checks:{total:checks.length,passed:checks.length,results:checks},sourceStableDuringAudit:initialHashes.every(x=>hash(x.file)===x.sha256)};
assert.equal(output.sourceStableDuringAudit,true);fs.writeFileSync('research/runtime-transform-import-reader-audit.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({totals:output.totals,checks:output.checks,sha256:hash('research/runtime-transform-import-reader-audit.json')}));
