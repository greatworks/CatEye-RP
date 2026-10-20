import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {property as p} from './scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const samples=JSON.parse(fs.readFileSync('research/inline-frame-format-import-audit.json','utf8')).samples;
const names={72:'outerShadow',73:'innerShadow',74:'textShadow'};
const plain=v=>Array.isArray(v?.$map)?Object.fromEntries(v.$map.map(([k,v])=>[k,plain(v)])):Array.isArray(v)?v.map(plain):v;
const report={capturedAt:new Date().toISOString(),method:'SHA-pinned original packages, static own decoder only',samples:[],counts:{total:0,byKind:{},values:{},activeState:0,on:0},positive:[],stateProperties:[]};
for(const sample of samples){
 if(sha(sample.file)!==sample.sha256)throw Error('Sample drift');
 const data=inspectRpObjects(sample.file),sampleCount={total:0,on:0,kinds:{}};
 for(const pack of data.packages){
  const objects=new Map((pack.objects??[]).map(o=>[o.id,o])),states=new Map(),owners=new Map();
  for(const o of objects.values()){
   const style=p(o.properties,'MyStyle')?.$reference;if(style)owners.set(style,[...(owners.get(style)??[]),{id:o.id,type:o.type,name:p(o.properties,'name')??p(o.properties,'Name'),properties:plain(o.properties)}]);
   if(o.type==='Axure:Style')for(const prop of p(o.properties,'PropList')??[])if((p(prop,'DOAName')&0x0fffffff)===21)for(const [name,ref]of p(prop,'Value')?.$map??[])states.set(ref?.$reference,[...(states.get(ref?.$reference)??[]),{name,ownerStyleId:o.id}]);
  }
  for(const object of objects.values()){
   const identity={sample:path.basename(sample.file),sourceSha256:sample.sha256,packageId:pack.packageId,sourcePartSha256:pack.sha256,objectId:object.id,objectType:object.type};
   const walk=(value,where)=>{
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value.$map)){
     const raw=p(value,'DOAName'),key=Number.isInteger(raw)?raw&0x0fffffff:null;
     if(names[key]){
      const stored=p(value,'Value'),decoded=plain(stored),name=names[key],state=states.get(object.id)??[],entry={...identity,where,key,name,raw,determined:!!(raw&0x80000000),overridden:!!(raw&0x40000000),value:decoded,rawValue:stored,states:state,owners:owners.get(object.id)??[]};
      report.counts.total++;sampleCount.total++;report.counts.byKind[name]=(report.counts.byKind[name]??0)+1;sampleCount.kinds[name]=(sampleCount.kinds[name]??0)+1;
      report.counts.values[name]??={};const v=JSON.stringify(decoded);report.counts.values[name][v]=(report.counts.values[name][v]??0)+1;
      if(decoded?.On===true){report.counts.on++;sampleCount.on++;report.positive.push(entry)}
      if(state.length){report.stateProperties.push(entry);if(entry.determined&&entry.overridden)report.counts.activeState++}
     }
     for(const [key,child]of value.$map)walk(child,where+'.'+key);
    }else if(Array.isArray(value))value.forEach((v,i)=>walk(v,where+'['+i+']'));
   };
   walk(object.properties,'properties');
  }
 }
 report.samples.push({file:sample.file,sha256:sample.sha256,...sampleCount});
}
report.sources=['research/shadow-format-census.mjs','research/scripts/read-rp-objects.mjs','research/inline-frame-format-import-audit.json'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/shadow-format-census.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({counts:report.counts,samples:report.samples,positive:report.positive.map(p=>({sample:p.sample,packageId:p.packageId,id:p.objectId,where:p.where,kind:p.name,value:p.value,flags:[p.determined,p.overridden],states:p.states,owners:p.owners.map(o=>({id:o.id,type:o.type,name:o.name}))}))},null,2));
