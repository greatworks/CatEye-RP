import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {property as p} from './scripts/read-rp-semantics.mjs';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const samples=JSON.parse(fs.readFileSync('research/rich-hyperlink-format-census.json','utf8')).samples;
const plain=value=>Array.isArray(value?.$map)?Object.fromEntries(value.$map.map(([k,v])=>[k,plain(v)])):Array.isArray(value)?value.map(plain):value;
const report={capturedAt:new Date().toISOString(),method:'SHA-pinned native object census via own read-only parser; no vendor code executed',samples:[],objects:[]};
for(const sample of samples){
 assert.equal(hash(sample.file),sample.sha256);const decoded=inspectRpObjects(sample.file),types={};
 for(const pack of decoded.packages){
  const objects=new Map((pack.objects??[]).map(o=>[o.id,o])),root=objects.get(pack.rootId);
  for(const object of objects.values())if(/Table|Cell|Column|Row/.test(object.type)){
   types[object.type]=(types[object.type]??0)+1;
   report.objects.push({file:sample.file,fileSha256:sample.sha256,packageId:pack.packageId,packageSha256:pack.sha256,packageVersion:pack.version,rootId:pack.rootId,rootType:root?.type,id:object.id,type:object.type,offset:object.offset,raw:object.properties,properties:plain(object.properties),style:objects.get(p(object.properties,'MyStyle')?.$reference)});
  }
 }
 report.samples.push({...sample,hyperlinkOwners:undefined,types,packageFailures:decoded.packages.filter(p=>p.status==='unsupported').map(p=>({path:p.path,reason:p.reason}))});
}
report.sources=['research/table-format-census.mjs','research/scripts/read-rp-container.mjs','research/scripts/read-rp-objects.mjs'].map(file=>({file,sha256:hash(file)}));
fs.writeFileSync('research/table-format-census.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({samples:report.samples.map(s=>({file:path.basename(s.file),types:s.types,failures:s.packageFailures.length})),examples:[...new Set(report.objects.map(o=>o.type))].map(type=>{const o=report.objects.find(o=>o.type===type);return {type,id:o.id,file:path.basename(o.file),packageId:o.packageId,properties:o.properties};})},null,2));
