import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inspectRpObjects } from './read-rp-objects.mjs';
import { recoverAdaptiveSets, NATIVE_BASE_VIEW_ID } from './read-rp-adaptive.mjs';

import { id, guid, ref, map, object, pack, get, set, fixture } from '../adaptive-import-sets-fixture.mjs';
const decode = f => recoverAdaptiveSets({packages:f.packages});

test('complete synthetic named hierarchy preserves object/stored identities, scope, dimensions and provenance',()=>{
  const f=fixture(),before=structuredClone(f),result=decode(f),set=result.sets[0];
  assert.equal(result.status,'decoded-adaptive-sets');assert.equal(set.status,'supported-adaptive-set');
  assert.equal(set.sourceId,id(2));assert.equal(set.id,id(102));assert.equal(set.base.sourceId,id(3));assert.equal(set.base.id,NATIVE_BASE_VIEW_ID);
  assert.deepEqual(set.views.map(v=>[v.id,v.baseViewId,v.width,v.height,v.cursor]),[[id(104),NATIVE_BASE_VIEW_ID,768,0,1],[id(105),id(104),390,640,1]]);
  assert.deepEqual(set.provenance,{version:[11,0,0,0],sourcePartSha256:'a'.repeat(64),documentSourceId:id(1)});
  assert.equal(result.pages[0].status,'assigned');assert.equal(result.pages[0].setId,id(102));assert.equal(result.pages[0].setSourceId,id(2));assert.equal(result.pages[0].setPackageId,id(1000));
  assert.deepEqual(f,before);
});
test('two pages can point to the same complete set by its stored GUID across package boundaries',()=>{
 const f=fixture();f.packages.push(pack(2001,[object(12,'Axure:Page',{AdaptiveViewSetId:guid(id(102)),AdaptiveViewSet:ref(id(0))})]));
 assert.deepEqual(decode(f).pages.map(p=>[p.status,p.setId]),[['assigned',id(102)],['assigned',id(102)]]);
});
test('zero assignment is unassigned; orphan match caches never create live definitions',()=>{
 const f=fixture();set(f.page,'AdaptiveViewSetId',guid(id(0)));set(f.page,'AdaptiveViewMatchInfos',[map({Id:guid(id(999)),Name:'Phone',Size:map({Width:390,Height:0})})]);
 assert.equal(decode(f).pages[0].status,'unassigned');set(f.page,'AdaptiveViewSetId',guid(id(999)));
 const result=decode(f);assert.equal(result.pages[0].status,'unsupported-assignment');assert.equal(result.sets.length,1);assert.match(result.pages[0].reason,/unresolved/);
});
test('Page direct ref does not supersede the proven ID getter, but is retained and diagnosed',()=>{
 const f=fixture();set(f.page,'AdaptiveViewSet',ref(id(777)));
 const result=decode(f);assert.equal(result.pages[0].status,'assigned');assert.equal(result.pages[0].directSetSourceId,id(777));
 assert.ok(result.diagnostics.some(d=>d.code==='ignored-page-direct-reference'));
 set(f.page,'AdaptiveViewSetId',guid(id(0)));assert.equal(decode(f).pages[0].status,'unassigned');
});
test('unknown active cursor is rejected rather than silently treated as Desktop',()=>{
 const f=fixture();set(f.phone,'Cursor',2);assert.equal(decode(f).sets[0].status,'unsupported-adaptive-set');
});
test('Desktop and Touch are both retained, without claiming a product rendering default',()=>{
 const f=fixture();set(f.tablet,'Cursor',0);assert.deepEqual(decode(f).sets[0].views.map(v=>v.cursor),[0,1]);
});
test('explicit complete modern carriers accept only the existing object-reader version allowlist',()=>{
 for(const version of [[9,0,0,0],[9,0,1,0],[10,0,1,0],[10,0,3,0],[10,0,4,0],[11,0,0,0]]){const f=fixture();f.packages.forEach(p=>p.version=version);assert.equal(decode(f).sets[0].status,'supported-adaptive-set');}
 for(const version of [undefined,[8,0,0,0],[12,0,0,0],[11,0,1,0]]){const f=fixture();f.packages[0].version=version;assert.equal(decode(f).sets.filter(s=>s.status==='supported-adaptive-set').length,0);}
});
for(const [name,mutate,pattern] of [
 ['missing view',f=>f.packages[0].objects.pop(),/unresolved/],
 ['wrong view type',f=>f.phone.type='Axure:Style',/wrong type/],
 ['wrong reference tag',f=>get(f.setObject,'AdaptiveViews')[0].referenceTag=22,/reference/],
 ['repeated named reference',f=>get(f.setObject,'AdaptiveViews').push(ref(f.phone.id)),/duplicate/],
 ['duplicate stored view ID',f=>set(f.phone,'Id',guid(id(104))),/duplicate/],
 ['zero named view ID',f=>set(f.phone,'Id',guid(id(0))),/reserved/],
 ['Base sentinel as named',f=>set(f.phone,'Id',guid(NATIVE_BASE_VIEW_ID)),/reserved/],
 ['wrong Base ID',f=>set(f.base,'Id',guid(id(888))),/Base/],
 ['wrong Base parent',f=>set(f.base,'BaseViewId',guid(id(104))),/Base/],
 ['named self parent',f=>set(f.phone,'BaseViewId',guid(id(105))),/cycle/],
 ['named cycle',f=>set(f.tablet,'BaseViewId',guid(id(105))),/cycle/],
 ['cross-set or missing parent',f=>set(f.phone,'BaseViewId',guid(id(900))),/parent/],
 ['wrong parent set object',f=>set(f.phone,'ParentAdaptiveViewSet',ref(id(102))),/parent set/],
 ['duplicate property',f=>f.phone.properties.$map.push(['Cursor',0]),/duplicate/],
 ['unknown view field',f=>set(f.phone,'Enabled',false),/unsupported.*Enabled/],
 ['compat Condition field',f=>set(f.phone,'Condition',7),/unsupported.*Condition/],
 ['nonfinite dimension',f=>set(f.phone,'Size',map({Width:{$number:'NaN',numberTag:6},Height:0})),/dimension/],
 ['negative dimension',f=>set(f.phone,'Size',map({Width:-1,Height:0})),/dimension/],
 ['oversize dimension',f=>set(f.phone,'Size',map({Width:100001,Height:0})),/dimension/],
 ['duplicate Width key',f=>get(f.phone,'Size').$map.push(['Width',5]),/duplicate/],
 ['bad GUID tag',f=>set(f.phone,'Id',{$reference:id(105),referenceTag:3}),/GUID/],
 ['missing required Name',f=>f.phone.properties.$map.splice(f.phone.properties.$map.findIndex(([k])=>k==='Name'),1),/Name/],
])test(`set recovery is atomic for ${name}`,()=>{const f=fixture();mutate(f);const result=decode(f);assert.equal(result.sets[0].status,'unsupported-adaptive-set');assert.match(result.sets[0].reason,pattern);assert(!('views'in result.sets[0]));assert.equal(result.pages[0].status,'unsupported-assignment');});
test('an invalid sibling set does not erase an independent complete set',()=>{
 const f=fixture();const bad=object(21,'Axure:AdaptiveViewSet',{Id:guid(id(121)),Name:'Bad',DefaultAdaptiveView:ref(id(999)),AdaptiveViews:[]});f.packages[0].objects.push(bad);get(f.doc,'AdaptiveViewSets').push(ref(bad.id));
 assert.deepEqual(decode(f).sets.map(s=>s.status),['supported-adaptive-set','unsupported-adaptive-set']);assert.equal(decode(f).pages[0].status,'assigned');
});
test('duplicate native set IDs reject both candidates; no ambiguous assignment survives',()=>{
 const f=fixture();const bad=structuredClone(f.setObject);bad.id=id(21);f.packages[0].objects.push(bad);get(f.doc,'AdaptiveViewSets').push(ref(bad.id));
 const result=decode(f);assert(result.sets.every(s=>s.status==='unsupported-adaptive-set'));assert.equal(result.pages[0].status,'unsupported-assignment');
});
test('undeclared sets are not inferred into project scope',()=>{
 const f=fixture();set(f.doc,'AdaptiveViewSets',[]);const result=decode(f);assert.equal(result.sets.length,0);assert.equal(result.pages[0].status,'unsupported-assignment');assert(result.diagnostics.some(d=>d.code==='undeclared-adaptive-set'));
});
test('duplicated package/object IDs and multiple DesignDocument roots are diagnosed, not overwritten in a Map',()=>{
 for(const mutate of [f=>f.packages.push(structuredClone(f.packages[0])),f=>f.packages[0].objects.push(structuredClone(f.phone)),f=>f.packages[1].objects.push(object(77,'Axure:DesignDocument',{AdaptiveViewSets:[]}))]){
  const f=fixture();mutate(f);const result=decode(f);assert.equal(result.sets.filter(s=>s.status==='supported-adaptive-set').length,0);assert(result.diagnostics.some(d=>/duplicate|multiple/.test(d.reason)));
 }
});
test('wrong Page assignment tags cannot become a best-effort ID',()=>{
 const f=fixture();set(f.page,'AdaptiveViewSetId',ref(id(102)));assert.equal(decode(f).pages[0].status,'unsupported-assignment');
});
test('package sha/version provenance must be well formed before exposing a supported graph',()=>{
 const f=fixture();f.packages[0].sha256='bad';const result=decode(f);assert.equal(result.sets.filter(s=>s.status==='supported-adaptive-set').length,0);assert(result.diagnostics.some(d=>/SHA/.test(d.reason)));
});

test('standalone decoded value parts are ignored, but never hide malformed object packages',()=>{
 const standalone={sha256:'c'.repeat(64),version:[11,0,0,0],schema:50001,status:'decoded-observed-object-structure',rootValue:map({name:'Widget info'}),objects:[]};
 const f=fixture();f.packages.push(standalone);assert.equal(decode(f).sets[0].status,'supported-adaptive-set');
 assert.equal(decode(f).diagnostics.find(d=>d.code==='standalone-value-parts').count,1);
 for(const mutation of [p=>p.objects.push(f.phone),p=>delete p.rootValue,p=>p.sha256='bad',p=>p.rootId=id(9)]){
  const candidate=structuredClone(standalone);mutation(candidate);const bad=fixture();bad.packages.push(candidate);assert.equal(decode(bad).status,'unsupported-adaptive-inventory');
 }
});

test('separate sets may share Base sentinel but not a named native identity',()=>{
 const f=fixture();
 const other=object(21,'Axure:AdaptiveViewSet',{Id:guid(id(121)),Name:'Other',DefaultAdaptiveView:ref(id(22)),AdaptiveViews:[ref(id(23))]});
 const base=structuredClone(f.base);base.id=id(22);set(base,'ParentAdaptiveViewSet',ref(other.id));
 const named=structuredClone(f.phone);named.id=id(23);set(named,'Id',guid(id(123)));set(named,'BaseViewId',guid(NATIVE_BASE_VIEW_ID));set(named,'ParentAdaptiveViewSet',ref(other.id));
 f.packages[0].objects.push(other,base,named);get(f.doc,'AdaptiveViewSets').push(ref(other.id));
 assert.deepEqual(decode(f).sets.map(s=>s.status),['supported-adaptive-set','supported-adaptive-set']);
 set(named,'Id',guid(id(105)));assert(decode(f).sets.every(s=>s.status==='unsupported-adaptive-set'));
});

test('set/view collection budgets reject before partially resolving a graph',()=>{
 const f=fixture();set(f.setObject,'AdaptiveViews',Array.from({length:51},(_,i)=>ref(id(100+i))));assert.match(decode(f).sets[0].reason,/oversized AdaptiveViews/);
 const g=fixture();set(g.doc,'AdaptiveViewSets',Array.from({length:101},(_,i)=>ref(id(100+i))));assert.equal(decode(g).sets.length,0);assert(decode(g).diagnostics.some(d=>/oversized DesignDocument/.test(d.reason)));
});

for(const [name,width,height] of [['Default.rplib',0,0],['Flow.rplib',0,0],['Prototype Starter.rp',1366,1000]])test(`original ${name} has one complete Base-only set without a guessed page assignment`,()=>{
 const original=JSON.parse(fs.readFileSync('research/adaptive-behavior-format-census.json','utf8')).samples.find(s=>path.basename(s.file)===name);
 const decoded=inspectRpObjects(original.file);assert.equal(decoded.fileSha256,original.sha256);
 const result=recoverAdaptiveSets(decoded);assert.equal(result.status,'decoded-adaptive-sets');assert.equal(result.sets.length,1);
 const set=result.sets[0];assert.equal(set.status,'supported-adaptive-set');assert.deepEqual(set.views,[]);
 assert.deepEqual([set.base.width,set.base.height,set.base.cursor],[width,height,1]);assert.equal(set.base.id,NATIVE_BASE_VIEW_ID);
 assert(result.pages.length>0);assert(result.pages.every(p=>p.status==='unassigned'));assert.equal(set.provenance.sourcePartSha256.length,64);
});

