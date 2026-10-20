import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {property as p,recoverStyle} from './scripts/read-rp-semantics.mjs';
import {recoverInteractionMap} from './scripts/read-rp-interactions.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const zero='0'.repeat(32),samples=JSON.parse(fs.readFileSync('research/text-decoration-import-audit.json','utf8')).samples;
const plain=value=>Array.isArray(value?.$map)?Object.fromEntries(value.$map.map(([k,v])=>[k,plain(v)])):Array.isArray(value)?value.map(plain):value;
const refs=(value,out=[])=>{if(value&&typeof value==='object'){if(value.referenceTag===3&&value.$reference!==zero)out.push(value.$reference);for(const v of Object.values(value))refs(v,out);}return out;};
const report={capturedAt:new Date().toISOString(),method:'All11 SHA-pinned files, local native references and exact stored fields; no target code or destination execution',samples:[],owners:[]};
for(const sample of samples){
 assert.equal(sha(sample.file),sample.sha256);const raw=inspectRpObjects(sample.file);let count=0;
 for(const pack of raw.packages){
  const objects=new Map((pack.objects??[]).map(o=>[o.id,o])),root=objects.get(pack.rootId);
  for(const owner of objects.values()){
   const block=p(owner.properties,'RichTextBlock');if(!block)continue;
   const inlines=[];const walk=(value,where)=>{if(!value||typeof value!=='object')return;if(p(value,'Type')==='Axure:AttributedString:AxHyperlink')inlines.push({path:where,raw:value,value:plain(value)});if(Array.isArray(value?.$map))for(const [key,v]of value.$map)walk(v,`${where}.${key}`);else if(Array.isArray(value))value.forEach((v,i)=>walk(v,`${where}[${i}]`));};
   // property() is strict; inspect type only on native maps.
   const scan=(value,where)=>{if(!value||typeof value!=='object')return;if(Array.isArray(value.$map)){if(p(value,'Type')==='Axure:AttributedString:AxHyperlink')inlines.push({path:where,raw:value,value:plain(value)});for(const [key,v]of value.$map)scan(v,`${where}.${key}`);}else if(Array.isArray(value))value.forEach((v,i)=>scan(v,`${where}[${i}]`));};
   scan(block,'RichTextBlock');if(!inlines.length)continue;count++;
   const item={file:sample.file,sha256:sample.sha256,packageId:pack.packageId,packageSha256:pack.sha256,rootId:pack.rootId,rootType:root?.type,ownerId:owner.id,ownerType:owner.type,owner:owner,block:plain(block),inlines,links:[]};
   for(const inline of inlines){
    const linkId=p(inline.raw,'Link').$reference,link=objects.get(linkId),graph=[],seen=new Set(),pending=[linkId];
    while(pending.length){const id=pending.shift();if(seen.has(id))continue;seen.add(id);assert.ok(seen.size<150,'Bounded local link graph');const o=objects.get(id);assert.ok(o,`Missing local ${id}`);graph.push(o);pending.push(...refs(o.properties));}
    const linkStyle=objects.get(p(link.properties,'MyStyle')?.$reference),styles=graph.filter(o=>o.type==='Axure:Style');
    const styleIds=new Set(styles.flatMap(o=>(p(o.properties,'PropList')??[]).filter(prop=>(p(prop,'DOAName')&0x0fffffff)===0).map(prop=>p(prop,'Value')?.$guid)));
    const candidates=(p(p(root?.properties,'StyleCache'),'Styles')??[]).filter(c=>styleIds.has(p(p(c,'Info'),'Id')?.$guid));
    item.links.push({linkId,link:plain(link.properties),graph,styles:styles.map(o=>({id:o.id,fields:plain(o.properties),props:(p(o.properties,'PropList')??[]).map(prop=>({key:p(prop,'DOAName')&0x0fffffff,determined:!!(p(prop,'DOAName')&0x80000000),overridden:!!(p(prop,'DOAName')&0x40000000),value:plain(p(prop,'Value'))}))})),namedCaches:candidates.map(plain),decoded:recoverInteractionMap({owner:link,objects,packageId:pack.packageId})});
   }
   report.owners.push(item);
  }
 }
 report.samples.push({file:sample.file,sha256:sample.sha256,hyperlinkOwners:count});
}
report.sources=['research/rich-hyperlink-format-census.mjs','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-semantics.mjs','research/scripts/read-rp-interactions.mjs'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/rich-hyperlink-format-census.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.owners.map(o=>({file:path.basename(o.file),packageId:o.packageId,ownerId:o.ownerId,paragraphs:o.block['attributed-string'].Paragraphs.length,links:o.links.map(l=>({id:l.linkId,link:l.link,styles:l.styles,caches:l.namedCaches,actions:l.graph.filter(g=>/InteractionEvent|InteractionCase|InteractionLinkWindowAction|InteractionTarget|StringLiteral/.test(g.type)).map(g=>({id:g.id,type:g.type,properties:plain(g.properties)})),decoded:l.decoded}))})),null,2));
