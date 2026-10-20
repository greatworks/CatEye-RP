import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {recoverInteractionMap} from './scripts/read-rp-interactions.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const auditFile='research/rich-text-format-import-audit.json';
const audit=JSON.parse(fs.readFileSync(auditFile,'utf8'));
const sample=audit.samples.find(s=>s.sha256==='1044b386c12c170876c0423ccd07b515d9c9e063d4cde108cb6a4bbe96131179');
assert.equal(sha(sample.file),sample.sha256);
const raw=inspectRpObjects(sample.file),packages=new Map(raw.packages.filter(p=>p.objects).map(p=>[p.packageId,{...p,byId:new Map(p.objects.map(o=>[o.id,o]))}]));
const prop=(value,key)=>{assert.ok(Array.isArray(value?.$map));const pairs=value.$map.filter(p=>p[0]===key);assert.ok(pairs.length<=1);return pairs[0]?.[1]};
const local=(p,ref)=>{assert.equal(ref.referenceTag,3);const o=p.byId.get(ref.$reference);assert.ok(o,ref.$reference);return o};
const parts=id=>{const [,kind,packageId,objectId]=id.split('-');assert.equal(kind,'w');return {packageId,objectId,p:packages.get(packageId)}};
const records=new Map();
function verify(id,expected) {
  const {packageId,objectId,p}=parts(id),widget=p.byId.get(objectId);assert.ok(widget);
  const myStyle=local(p,prop(widget.properties,'MyStyle'));
  const outer=prop(myStyle.properties,'PropList').filter(v=>(prop(v,'DOAName')&0x0fffffff)===21);assert.equal(outer.length,1);
  const outerDOA=prop(outer[0],'DOAName');assert.equal(outerDOA>>>30,3);
  const selected=local(p,prop(prop(outer[0],'Value'),'Selected'));assert.equal(prop(selected.properties,'All'),false);assert.equal(prop(selected.properties,'MatchInfo'),undefined);
  const sourceProps=prop(selected.properties,'PropList');assert.ok(Array.isArray(sourceProps));
  const seen=new Set();const decisions=sourceProps.map(item=>{const flags=prop(item,'DOAName');assert.equal(Number.isInteger(flags),true);const key=flags&0x0fffffff;assert.ok(!seen.has(key));seen.add(key);return {property:key,rawDOA:flags,active:flags>>>30===3,value:prop(item,'Value')}});
  const active=decisions.filter(d=>d.active),patch={};
  for(const item of active){assert.ok([6,7,8].includes(item.property),`Unexpected active prop ${item.property} at ${id}`);assert.equal(prop(item.value,'fill-type'),'solid');const value=prop(item.value,'fill-color');assert.equal(Number.isInteger(value),true);const hex=(value>>>0).toString(16).padStart(8,'0');patch[({6:'color',7:'fill',8:'stroke'})[item.property]]=`#${hex.slice(2)}${hex.startsWith('ff')?'':hex.slice(0,2)}`;}
  assert.deepEqual(patch,expected,id);
  records.set(id,{id,packageId,objectId,packageSha256:p.sha256,nativeType:widget.type,localStyleId:myStyle.id,selectedStyleId:selected.id,outerDOA,decisions,patch});
}
const events=[];
for(const change of sample.eventChanges){
  assert.deepEqual(change.oldEvents,[],'This audit covers wholly new events');
  const {packageId,objectId,p}=parts(change.id),owner=p.byId.get(objectId);
  const decoded=recoverInteractionMap({owner,objects:p.byId,packageId});assert.equal(decoded.status,'decoded-interaction-tree');
  for(const imported of change.interactions){
    const indices=imported.id.split('-').slice(-2).map(Number);const event=decoded.events[indices[0]];assert.equal(event.status,'supported-event');const source=event.cases[indices[1]];
    assert.equal(imported.event,event.event);for(const key of ['name','enabled','isNewIfGroup','conditionMode','conditions'])assert.deepEqual(imported[key],source[key]);assert.equal(imported.actions.length,source.actions.length);
    for(let index=0;index<source.actions.length;index++) {const native=source.actions[index],action=imported.actions[index];assert.equal(native.type,'setSelected');assert.equal(action.type,native.type);assert.equal(action.value,native.value);assert.equal(action.targetId,`rp-w-${packageId}-${native.targetSourceId}`);assert.deepEqual(Object.keys(native).sort(),['sourceId','targetSourceId','type','value']);const target=change.targets.find(t=>t.targetId===action.targetId);assert.ok(target);verify(action.targetId,target.selectedStyle);}
    events.push({owner:change.id,event:imported.event,nativeEventId:event.id,nativeCaseId:source.id,actions:source.actions});
  }
}
for(const added of sample.added){assert.equal(added.type,'radio');verify(added.id,added.selectedStyle);}
assert.equal(events.length,36);assert.equal(sample.added.length,2);
const counts=events.reduce((a,e)=>(a[e.event]=(a[e.event]??0)+1,a),{});
const output={capturedAt:new Date().toISOString(),method:'Fresh original object-package decoding; independent OD flag/color conversion compared with complete imported events from retained audit; no original GUI/native DLL execution',source:{file:sample.file,sha256:sample.sha256},extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',totals:{owners:sample.eventChanges.length,events:events.length,eventTypes:counts,addedRadios:2,uniqueStateTargets:records.size,activeProps:[...records.values()].reduce((n,r)=>n+r.decisions.filter(d=>d.active).length,0),inactiveProps:[...records.values()].reduce((n,r)=>n+r.decisions.filter(d=>!d.active).length,0)},events,stateTargets:[...records.values()],files:[auditFile,'research/selected-style-filter-verify-import.mjs','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-interactions.mjs','research/scripts/read-rp-semantics.mjs','src/model/import-rp.ts'].map(file=>({file,sha256:sha(file)}))};
fs.writeFileSync('research/selected-style-filter-import-verification.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.totals,null,2));
