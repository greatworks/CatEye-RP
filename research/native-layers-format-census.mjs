import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {property as p} from './scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const plain=v=>Array.isArray(v?.$map)?Object.fromEntries(v.$map.map(([k,v])=>[k,plain(v)])):Array.isArray(v)?v.map(plain):v;
const samples=read('research/runtime-transform-format-census.json').samples;
const report={method:'Read-only SHA-pinned original RP/RPLIB object census. No target assembly execution, no import or rendering claim.',samples:[],layers:[],otherLayerTypes:[]};
for(const sample of samples){
 assert.equal(sha(sample.file),sample.sha256,'Original sample drift');
 const decoded=inspectRpObjects(sample.file),sampleLayers=[];
 for(const pack of decoded.packages){
  const byId=new Map((pack.objects??[]).map(o=>[o.id,o])),root=byId.get(pack.rootId),parents=new Map();
  for(const o of byId.values())for(const field of ['diagram-objects','DiagramObjects'])for(const [index,r] of (p(o.properties,field)??[]).entries())if(r?.$reference)parents.set(r.$reference,[...(parents.get(r.$reference)??[]),{id:o.id,type:o.type,field,index}]);
  const local=o=>{
   const style=byId.get(p(o?.properties,'MyStyle')?.$reference);
   return {id:o?.id,type:o?.type,name:p(p(o?.properties,'name-block'),'text'),contained:p(o?.properties,'IsContained'),parents:parents.get(o?.id)??[],properties:plain(o?.properties),style:style?{id:style.id,type:style.type,properties:plain(style.properties)}:null};
  };
  for(const o of byId.values()){
   if(!o.type.includes('Layer'))continue;
   if(o.type!=='Axure:DiagramObject:Layer'){report.otherLayerTypes.push({file:sample.file,packageId:pack.packageId,id:o.id,type:o.type});continue;}
   const members=p(o.properties,'DiagramObjects'),memberRecords=(members??[]).map((r,index)=>({index,reference:r,...local(byId.get(r?.$reference))}));
   const item={file:sample.file,fileSha256:sample.sha256,packagePath:pack.path,packageId:pack.packageId,packageSha256:pack.sha256,version:pack.version,rootId:root?.id,rootType:root?.type,offset:o.offset,...local(o),members:memberRecords};
   report.layers.push(item);sampleLayers.push(item);
  }
 }
 report.samples.push({file:sample.file,sha256:sample.sha256,packages:decoded.packages.length,layers:sampleLayers.length,directMembers:sampleLayers.reduce((n,l)=>n+l.members.length,0),packageFailures:decoded.packages.filter(p=>p.status==='unsupported').map(p=>({path:p.path,reason:p.reason}))});
}
const counts=(values,key)=>values.reduce((r,x)=>(r[key(x)]=(r[key(x)]??0)+1,r),{});
report.summary={layers:report.layers.length,members:report.layers.reduce((n,l)=>n+l.members.length,0),layerKeys:counts(report.layers,l=>JSON.stringify(Object.keys(l.properties).sort())),memberTypes:counts(report.layers.flatMap(l=>l.members),m=>m.type),layerParents:counts(report.layers.flatMap(l=>l.parents),p=>p.type),layerContained:counts(report.layers,l=>String(l.contained)),memberContained:counts(report.layers.flatMap(l=>l.members),m=>String(m.contained)),adaptiveLayers:report.layers.filter(l=>(l.properties.AdaptiveStyles??[]).length).length,otherLayerTypes:counts(report.otherLayerTypes,x=>x.type)};
const layerIndex=new Map(report.layers.map(l=>[`${l.file}:${l.packageId}:${l.id}`,l]));
const layerDepth=(l,seen=new Set())=>{assert.ok(!seen.has(l.id),'Layer cycle');seen=new Set([...seen,l.id]);return Math.max(0,...l.parents.filter(p=>p.type==='Axure:DiagramObject:Layer').map(p=>1+layerDepth(layerIndex.get(`${l.file}:${l.packageId}:${p.id}`),seen)));};
Object.assign(report.summary,{
 maxNestedLayerDepth:Math.max(...report.layers.map(l=>layerDepth(l))),
 propagate:counts(report.layers,l=>String(l.properties.Propagate)),
 selected:counts(report.layers,l=>String(l.properties.Selected)),
 disabled:counts(report.layers,l=>String(l.properties.Disabled)),
 localProperties:counts(report.layers.flatMap(l=>l.style?.properties.PropList??[]),p=>p.DOAName&0x0fffffff),
 flatScopeMembershipAll:true,directOrderMatchesFlatAll:true,layerBeforeMembersAll:true,
});
for(const l of report.layers){
 const scope=l.parents.filter(p=>p.field==='diagram-objects');assert.equal(scope.length,1);
 assert.equal(l.members.length,new Set(l.members.map(m=>m.id)).size);
 let last=scope[0].index;
 for(const m of l.members){
  assert.ok(m.type,'Unresolved member');
  const direct=m.parents.filter(p=>p.field==='DiagramObjects'),flat=m.parents.filter(p=>p.field==='diagram-objects');
  assert.equal(direct.length,1);assert.equal(direct[0].id,l.id);assert.equal(flat.length,1);assert.equal(flat[0].id,scope[0].id);
  if(flat[0].index<=last)report.summary.directOrderMatchesFlatAll=false;
  if(flat[0].index<=scope[0].index)report.summary.layerBeforeMembersAll=false;
  last=flat[0].index;
 }
}
report.sources=['research/native-layers-format-census.mjs','research/runtime-transform-format-census.json','research/scripts/read-rp-container.mjs','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-semantics.mjs'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/native-layers-format-census.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,samples:report.samples.map(s=>({file:path.basename(s.file),layers:s.layers,members:s.directMembers,failures:s.packageFailures.length})),first:report.layers.slice(0,2)},null,2));
