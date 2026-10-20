import fs from 'node:fs';
import assert from 'node:assert/strict';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {property as p} from './scripts/read-rp-semantics.mjs';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
const samples=readJson('research/native-layers-format-census.json').samples;
const report={method:'Static original-package property census; no DLL or GUI execution.',samples:[],counts:{},nondefault:[],inactive:[]};
function collect(props,source){
 for(const prop of props??[]){
  const raw=p(prop,'DOAName'),key=raw&0x0fffffff;
  if(![106,107,108,109].includes(key))continue;
  const value=p(prop,'Value'),flags=(raw>>>30)&3;
  const countKey=`${source.kind}:P${key}:flags${flags}:${JSON.stringify(value)}`;
  report.counts[countKey]=(report.counts[countKey]??0)+1;
  const item={...source,key,raw,value};
  if(value!==0&&value!==false)report.nondefault.push(item);
  if(flags!==3)report.inactive.push(item);
 }
}
for(const sample of samples){
 assert.equal(sha256(sample.file),sample.sha256);
 const decoded=inspectRpObjects(sample.file);
 for(const pack of decoded.packages){
  const byId=new Map((pack.objects??[]).map(o=>[o.id,o]));
  for(const o of byId.values()){
   if(o.type==='Axure:Style')collect(p(o.properties,'PropList'),{file:sample.file,packageId:pack.packageId,objectId:o.id,kind:'style'});
   const caches=p(p(o.properties,'StyleCache'),'Styles');
   for(const c of caches??[])collect(p(c,'Props'),{file:sample.file,packageId:pack.packageId,objectId:o.id,kind:'cache',info:p(c,'Info')});
  }
 }
 report.samples.push({file:sample.file,sha256:sample.sha256,packages:decoded.packages.length});
}
report.sources=['research/layer-resize-pins-census.mjs','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-semantics.mjs','research/native-layers-format-census.json'].map(file=>({file,sha256:sha256(file)}));
fs.writeFileSync('research/layer-resize-pins-census.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({counts:report.counts,nondefault:report.nondefault.length,inactive:report.inactive.length}));
