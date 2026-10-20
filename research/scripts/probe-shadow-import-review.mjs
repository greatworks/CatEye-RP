// Independent, bounded readback of the six newly unblocked native SelectedChange cases.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { inspectRpObjects } from './read-rp-objects.mjs';
import { recoverInteractionMap } from './read-rp-interactions.mjs';
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const auditFile='research/shadow-format-import-audit.json',audit=JSON.parse(fs.readFileSync(auditFile));
const sample=audit.samples.find(s=>s.file.endsWith('Sample form patterns.rplib'));
assert.equal(sha(sample.file),sample.sha256);
const source=inspectRpObjects(sample.file),packages=['b3e7e9d52abc4ff08e65a0f16e143f53','2489016f8aaa4629be08e839e24f65df'];
const prop=(object,key)=>(object?.properties??object)?.$map?.find(([name])=>name===key)?.[1];
const results=[];
for(const imported of sample.shadows.filter(w=>w.name.startsWith('Choice ')&&packages.some(id=>w.pageId.endsWith(id)))){
  const packageId=imported.pageId.slice(5),pkg=source.packages.find(p=>p.packageId===packageId),objects=new Map(pkg.objects.map(o=>[o.id,o])),owner=objects.get(imported.id.slice(-32));
  const myStyle=objects.get(prop(owner,'MyStyle').$reference),entries=prop(myStyle,'PropList');
  const ix=prop(entries.find(p=>(prop(p,'DOAName')&0x3fffffff)===21),'Value'),selected=objects.get(prop(ix,'Selected').$reference);
  const active=prop(selected,'PropList').filter(p=>(prop(p,'DOAName')>>>30)===3).map(p=>({key:prop(p,'DOAName')&0x3fffffff,value:prop(p,'Value')}));
  const nativeShadow=active.find(p=>p.key===72);assert.ok(nativeShadow);
  const fields=Object.fromEntries(nativeShadow.value.$map);assert.deepEqual(fields,{On:true,OffsetX:0,OffsetY:0,BlurRadius:7,Color:874420439,Spread:0});
  assert.deepEqual(imported.styles.selectedStyle.outerShadow,{on:true,offsetX:0,offsetY:0,blurRadius:7,color:'#1e98d734'});
  const tree=recoverInteractionMap({owner,objects,packageId});assert.equal(tree.status,'decoded-interaction-tree');assert.equal(tree.events.length,1);
  const event=tree.events[0];assert.equal(event.status,'supported-event');assert.equal(event.nativeEventType,52);assert.equal(event.cases.length,1);
  const c=event.cases[0],output=imported.interactions[0];assert.equal(output.event,'selectedChange');assert.equal(c.actions.length,2);assert.equal(output.actions.length,2);
  for(let i=0;i<2;i++){assert.equal(c.actions[i].type,'toggle');assert.equal(output.actions[i].type,'toggle');assert.equal(output.actions[i].targetId,`rp-w-${packageId}-${c.actions[i].targetSourceId}`);assert.ok(objects.has(c.actions[i].targetSourceId));}
  results.push({ownerId:owner.id,packageId,sourcePartSha256:pkg.sha256,selectedStyleId:selected.id,activePropertyKeys:active.map(p=>p.key),outerShadow:fields,eventId:event.id,nativeEventType:event.nativeEventType,caseId:c.id,targets:c.actions.map(a=>a.targetSourceId),pass:true});
}
assert.equal(results.length,6);
fs.writeFileSync('research/shadow-runtime-native-review.json',JSON.stringify({timestamp:new Date().toISOString(),method:'Read-only native package graph cross-check; independently checks six style gates, event/case cardinality and action target/order, uses existing interaction decoder for enum semantics',source:{path:sample.file,sha256:sample.sha256},audit:{path:auditFile,sha256:sha(auditFile)},results},null,2)+'\n');
console.log('6/6 native owner/style/event/ordered-target checks passed');
