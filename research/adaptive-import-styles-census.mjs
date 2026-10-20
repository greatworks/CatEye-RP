import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Pure joins of frozen source records. No reader/importer or original program runs.
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const input = 'research/adaptive-behavior-format-census.json';
const hierarchyInput = 'research/adaptive-hierarchy-format-census.json';
const baselineInput = 'research/text-autofit-import-audit.json';
const c = JSON.parse(fs.readFileSync(input));
const hierarchy = JSON.parse(fs.readFileSync(hierarchyInput));
const baseline = JSON.parse(fs.readFileSync(baselineInput));
const get = (o,k) => o?.properties?.$map?.find(([name])=>name===k)?.[1];
const guid = value => { assert.match(value?.$guid??'', /^[0-9a-f]{32}$/); return value.$guid; };
const key = (o,id=o.id) => [o.sha256,o.packageId,id].join('/');
const expectedKeys = ['LibraryId','LibraryName','LegacyName','style-name','Id','PropList','Capabilities','All'];
const sourceBefore = c.samples.map(s=>({path:s.file,sha256:sha(s.file),expected:s.sha256}));
for(const s of sourceBefore) assert.equal(s.sha256,s.expected);
const targets = new Map(c.adaptiveStyleTargets.map(t=>[key(t,t.ownerId)+'/'+guid(t.viewId),t]));
assert.equal(targets.size,75);
const records=[];
for(const o of c.adaptiveStyles) {
  const pairs=get(o,'AdaptiveStyles'); assert.ok(Array.isArray(pairs)); assert.equal(pairs.length%2,0);
  const seen=new Set(); const maps=[];
  for(let i=0;i<pairs.length;i+=2) {
    const viewId=guid(pairs[i]); assert.ok(!seen.has(viewId)); seen.add(viewId);
    const ref=pairs[i+1]; assert.equal(ref.referenceTag,3); assert.match(ref.$reference,/^[0-9a-f]{32}$/);
    const t=targets.get(key(o)+'/'+viewId); assert.ok(t); assert.equal(t.target.id,ref.$reference);
    assert.equal(t.target.type,'Axure:Style'); assert.deepEqual(t.target.properties.$map.map(([k])=>k),expectedKeys);
    assert.equal(get(t.target,'All'),false); assert.deepEqual(get(t.target,'PropList'),[]);
    const knownViews=hierarchy.views.filter(v=>v.sha256===o.sha256).map(v=>guid(get(v,'Id')));
    assert.ok(!knownViews.includes(viewId));
    maps.push({sourceViewId:viewId,sourceStyleObjectId:ref.$reference,referenceTag:3,
      storedStyleId:guid(get(t.target,'Id')),libraryId:guid(get(t.target,'LibraryId')),
      styleName:get(t.target,'style-name'),capabilities:get(t.target,'Capabilities'),all:false,
      propList:[],association:'orphan-no-declared-view',sourceTargetSha256:createHash('sha256').update(JSON.stringify(t.target)).digest('hex')});
  }
  assert.equal(get(o,'IsContained'),false);
  const repeaterStyles=get(o,'AdaptiveRepeaterStyles'); if(repeaterStyles!==undefined) assert.deepEqual(repeaterStyles,[]);
  const oldSample=baseline.samples.find(s=>s.sourceSha256===o.sha256);
  const oldNode=oldSample?.nodes.find(n=>n.packageId===o.packageId&&n.sourceId===o.id);
  records.push({sourceFile:o.file,sourceSha256:o.sha256,packageId:o.packageId,packageSha256:o.packageSha256,
    sourceObjectId:o.id,type:o.type,name:get(o,'Name'),isContained:false,maps,
    ...(repeaterStyles!==undefined?{adaptiveRepeaterStyles:[]}:{}),
    inFrozenVectorNodeAudit:!!oldNode});
}
const count=(values)=>Object.fromEntries([...new Set(values)].map(v=>[v,values.filter(x=>x===v).length]));
const perSample=c.samples.map(s=>{const owners=records.filter(o=>o.sourceSha256===s.sha256);return{
  name:path.basename(s.file),path:s.file,sha256:s.sha256,owners:owners.length,targets:owners.reduce((n,o)=>n+o.maps.length,0),
  types:count(owners.map(o=>o.type)),nonemptyPropertyLists:0};});
const defaultViews=hierarchy.views.map(v=>({file:v.file,sha256:v.sha256,packageId:v.packageId,sourceObjectId:v.id,
  storedViewId:guid(get(v,'Id')),size:Object.fromEntries(get(v,'Size').$map),cursor:get(v,'Cursor')}));
const pageSnapshotFiles=['research/samples/Default.rplib.objects.json','research/samples/the-basics-tab-menu.rp.objects.json','research/samples/complex-interactions-required-fields.rp.objects.json'];
const pageWitnesses=pageSnapshotFiles.map(file=>{
 const snapshot=JSON.parse(fs.readFileSync(file));
 const pages=snapshot.packages.flatMap(p=>(p.objects??[]).filter(o=>o.type==='Axure:Page').map(o=>({packageId:p.packageId,id:o.id,
  pageStyle:get(o,'page-style'),adaptiveStyles:get(o,'AdaptiveStyles')})));
 assert.ok(pages.every(p=>Array.isArray(p.adaptiveStyles)&&p.adaptiveStyles.length===0));
 return{file,sha256:sha(file),pages:pages.length,explicitEmptyAdaptiveStyles:pages.length,first:pages[0]};
});
const after=sourceBefore.map(s=>({path:s.path,sha256:sha(s.path)}));
after.forEach((s,i)=>assert.equal(s.sha256,sourceBefore[i].sha256));
const report={schema:1,capturedAt:new Date().toISOString(),method:'Read-only JSON joins of frozen raw-object snapshots; no re-import, no native execution.',
  sourceIdentity:{version:'11.0.0.4150',distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7'},
  totals:{samples:perSample.length,owners:records.length,targets:targets.size,types:count(records.map(o=>o.type)),
    distinctViewIds:new Set(records.flatMap(o=>o.maps.map(m=>m.sourceViewId))).size,nonemptyPropertyLists:0,
    emptyRepeaterStyleMaps:records.filter(o=>o.adaptiveRepeaterStyles).length,containedOwners:0,
    vectorOwnersAbsentFromFrozenVectorNodeAudit:records.filter(o=>o.type.endsWith(':VectorShape')&&!o.inFrozenVectorNodeAudit).length},
  perSample,defaultViews,records,pageWitnesses,nonemptyPageAdaptiveStylesInFullFrozenCensus:c.adaptiveStyles.filter(o=>o.type==='Axure:Page').length,
  sources:[input,hierarchyInput,baselineInput,...pageSnapshotFiles,'research/adaptive-import-styles-census.mjs'].map(path=>({path,sha256:sha(path)})),
  originalSources:sourceBefore.map(({expected,...s})=>s),sourceAfter:after,sourceUnchanged:true,
  limits:['The frozen vector-node audit is not a current importer run, and contains no repeater coverage assertion.',
    'Empty serialized local PropList does not prove an emitted generator style object has no type-specific synthesized fields.',
    'No declared view has any of the six orphan keys. This does not justify inventing their sizes, names, parents or set membership.']};
fs.writeFileSync('research/adaptive-import-styles-census.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:true,totals:report.totals,perSample:perSample.map(({name,owners,targets})=>({name,owners,targets})),defaultViews},null,2));
