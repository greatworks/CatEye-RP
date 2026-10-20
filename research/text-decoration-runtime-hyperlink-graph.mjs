import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {recoverInteractionMap} from './scripts/read-rp-interactions.mjs';
const file='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Libraries/Sample UI patterns.rplib';
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
assert.equal(sha(file),'cf1787fded7a74278209f9aee4b07a266a10360f2e0dd552c49cca158f65e36b');
const result=inspectRpObjects(file),source=result.packages.find(p=>p.packageId==='27f59a68aaf249d298b4edbb44f8e2ae'),objects=new Map(source.objects.map(o=>[o.id,o]));
assert.equal(source.sha256,'cc2b3da179954b69e2823a357d04fae6e4b57f9d3d4a7742aa24e9f91e6999b3');
const property=(value,key)=>value?.$map?.find(([k])=>k===key)?.[1];
const owner=objects.get('14ea8a9456d14c888e8e483e64492173'),block=property(owner.properties,'RichTextBlock');
const links=[];function walk(value,path){if(!value||typeof value!=='object')return;if(value.$map&&property(value,'Type')==='Axure:AttributedString:AxHyperlink')links.push({path,value});if(Array.isArray(value))value.forEach((v,i)=>walk(v,`${path}/${i}`));else for(const [k,v]of Object.entries(value))walk(v,`${path}/${k}`);}walk(block,'RichTextBlock');assert.equal(links.length,1);
const linkId=property(links[0].value,'Link').$reference;assert.equal(linkId,'e96f6fd2341e436c86fd6ac86116dfea');
const graph=[],pending=[linkId],seen=new Set();function refs(value,result=[]){if(value&&typeof value==='object'){if(value.$reference)result.push(value.$reference);for(const v of Object.values(value))refs(v,result);}return result;}
while(pending.length){const id=pending.shift();if(seen.has(id))continue;seen.add(id);if(id==='0'.repeat(32))continue;assert.ok(seen.size<100,'Bounded link graph');const object=objects.get(id);assert.ok(object,`unresolved local reference ${id}`);graph.push(object);pending.push(...refs(object.properties));}
const styleIds=new Set(['20c251d4040c41b98d8c62b117875bb9','63f36273a7d24dd7a6993286cd42f6ad','59b827b912864e03b9502cc23178e317']);
const namedStyleCandidates=[];
for(const pkg of result.packages)for(const object of pkg.objects??[]){const cache=property(object.properties,'StyleCache');for(const entry of property(cache,'Styles')??[]){const info=property(entry,'Info');if(styleIds.has(property(info,'Id')?.$guid))namedStyleCandidates.push({packageId:pkg.packageId,packageSha256:pkg.sha256,ownerId:object.id,entry});}}
const report={capturedAt:new Date().toISOString(),method:'Fresh object-package decoding and local-reference graph; no native execution or URL visit',file,sha256:sha(file),packageId:source.packageId,packageSha256:source.sha256,ownerId:owner.id,ownerType:owner.type,inline:links[0],linkId,graph,namedStyleCandidates,decodedInteractions:recoverInteractionMap({owner:objects.get(linkId),objects,packageId:source.packageId}),sourceHashes:['research/scripts/read-rp-objects.mjs','research/scripts/read-rp-interactions.mjs','research/text-decoration-runtime-hyperlink-graph.mjs'].map(file=>({file,sha256:sha(file)}))};
fs.writeFileSync('research/text-decoration-runtime-hyperlink-graph.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({linkId,graph:graph.map(o=>({id:o.id,type:o.type})),namedStyleCandidates:namedStyleCandidates.map(c=>({packageId:c.packageId,info:property(c.entry,'Info'),propertyCount:property(c.entry,'Props')?.length})),decoded:report.decodedInteractions},null,2));
