import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {property as p} from './scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const samples=JSON.parse(fs.readFileSync('research/font-style-import-audit.json','utf8')).samples;
const keys={5:'underline',95:'strikethrough',91:'characterSpacing',92:'baseline'};
const counts={runs:0,runValues:{},properties:0,propertyValues:{},stateValues:{}};
const tally=(group,key,value)=>{group[key]??={};const s=JSON.stringify(value);group[key][s]=(group[key][s]??0)+1;};
const report={method:'Static original package census; no DLL or original app execution',samples:[],interestingRuns:[],interestingProperties:[],stateProperties:[],counts};
for(const sample of samples){
 if(sha(sample.file)!==sample.sha256)throw Error('Source changed');
 const decoded=inspectRpObjects(sample.file);report.samples.push({file:sample.file,sha256:sample.sha256});
 for(const pack of decoded.packages){
  const objects=new Map((pack.objects??[]).map(o=>[o.id,o])),states=new Map();
  for(const owner of objects.values())if(owner.type==='Axure:Style')for(const prop of p(owner.properties,'PropList')??[])if((p(prop,'DOAName')&0x0fffffff)===21)for(const [name,ref]of p(prop,'Value')?.$map??[]){states.set(ref?.$reference,[...(states.get(ref?.$reference)??[]),{name,ownerStyleId:owner.id}]);}
  for(const object of objects.values()){
   const identity={sample:path.basename(sample.file),sourceSha256:sample.sha256,packageId:pack.packageId,sourcePartSha256:pack.sha256,objectId:object.id,objectType:object.type};
   const walk=(value,where)=>{
    if(!value||typeof value!=='object')return;
    if(Array.isArray(value.$map)){
     const type=p(value,'Type');
     if(type==='Axure:AttributedString:AxRun'){
      counts.runs++;const fields=Object.fromEntries(['Underline','Strikethrough','CharacterSpacing','Baseline'].map(k=>[k,p(value,k)]));
      for(const [key,v]of Object.entries(fields))tally(counts.runValues,key,v);
      if(fields.Underline!==false||fields.Strikethrough!==false||fields.CharacterSpacing!==0||fields.Baseline!==0)report.interestingRuns.push({...identity,where,text:p(value,'Text'),...fields,run:value});
     }
     const raw=p(value,'DOAName'),key=Number.isInteger(raw)?raw&0x0fffffff:null;
     if(keys[key]){
      counts.properties++;const stored=p(value,'Value'),entry={...identity,where,key,name:keys[key],raw,determined:!!(raw&0x80000000),overridden:!!(raw&0x40000000),value:stored,states:states.get(object.id)??[]};
      tally(counts.propertyValues,keys[key],stored);
      if((key===5||key===95)?stored!==false:stored!==0)report.interestingProperties.push(entry);
      if(entry.states.length){report.stateProperties.push(entry);tally(counts.stateValues,keys[key]+(entry.determined&&entry.overridden?':active':':inactive'),stored);}
     }
     for(const [key,child]of value.$map)walk(child,where+'.'+String(key));
    }else if(Array.isArray(value))value.forEach((child,index)=>walk(child,where+'['+index+']'));
    else for(const [key,child]of Object.entries(value))walk(child,where+'.'+key);
   };
   walk(object.properties,'properties');
  }
 }
}
report.sources=['research/text-decoration-census.mjs','research/scripts/read-rp-objects.mjs','research/font-style-import-audit.json'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/text-decoration-census.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({counts,decoratedRuns:report.interestingRuns.filter(r=>r.Underline||r.Strikethrough).map(r=>({sample:r.sample,packageId:r.packageId,id:r.objectId,text:r.text,underline:r.Underline,strike:r.Strikethrough,spacing:r.CharacterSpacing,baseline:r.Baseline})),interestingProperties:report.interestingProperties.length,stateProperties:report.stateProperties.length},null,2));
