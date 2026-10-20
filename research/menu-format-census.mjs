import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {property as p,recoverRpSemantics,recoverStyle,recoverRichText,recoverSelection,recoverInteractionStyles,recoverErrorHint} from './scripts/read-rp-semantics.mjs';
import {recoverInteractionMap} from './scripts/read-rp-interactions.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const samples=JSON.parse(fs.readFileSync('research/rich-hyperlink-format-census.json','utf8')).samples;
const plain=value=>Array.isArray(value?.$map)?Object.fromEntries(value.$map.map(([k,v])=>[k,plain(v)])):Array.isArray(value)?value.map(plain):value;
const report={capturedAt:new Date().toISOString(),method:'SHA-pinned native object graph census with independent read-only readers; no vendor assembly execution or GUI',samples:[],menus:[]};
for(const sample of samples){
 assert.equal(sha(sample.file),sample.sha256);const decoded=inspectRpObjects(sample.file),counts={menus:0,tables:0,cells:0,nonemptySubmenuCollections:0};let semantic;
 for(const pack of decoded.packages){
  const objects=new Map((pack.objects??[]).map(o=>[o.id,o])),root=objects.get(pack.rootId),menus=[...objects.values()].filter(o=>o.type==='Axure:DiagramObject:MenuObject');
  if(!menus.length)continue;
  semantic??=recoverRpSemantics(decoded);const identity=semantic.defaultStyleIdentityRecovery,defaultStyle={id:identity?.defaultStyleId,libraryId:identity?.defaultStyleLibraryId},resolve=ref=>objects.get(ref?.$reference);
  const describe=object=>{
   const style=resolve(p(object.properties,'MyStyle')),kind=object.type.endsWith(':TableCell')?'tableCell':object.type.endsWith(':Table')?'table':'menu';
   return {id:object.id,type:object.type,offset:object.offset,raw:object.properties,properties:plain(object.properties),style:style??null,
    appearance:recoverStyle(object,style,root,defaultStyle,resolve,{type:kind}),richText:recoverRichText(object,{objects,root,packageId:pack.packageId}),
    selection:recoverSelection(object,style,root,defaultStyle,resolve,{type:kind}),states:recoverInteractionStyles(object,style,root,defaultStyle,resolve,{type:kind}),
    errorHint:recoverErrorHint(object,style,root,defaultStyle,resolve,{type:kind}),interaction:recoverInteractionMap({owner:object,objects,packageId:pack.packageId})};
  };
  for(const menu of menus){
   const submenus=p(menu.properties,'submenus'),refs=p(menu.properties,'diagram-objects'),tables=(refs??[]).map(resolve).filter(o=>o?.type==='Axure:DiagramObject:Table'),cells=tables.flatMap(t=>(p(t.properties,'cells')??[]).map(resolve));
   counts.menus++;counts.tables+=tables.length;counts.cells+=cells.length;if(Array.isArray(submenus)&&submenus.length)counts.nonemptySubmenuCollections++;
   report.menus.push({file:sample.file,sha256:sample.sha256,packageId:pack.packageId,packageSha256:pack.sha256,version:pack.version,rootId:pack.rootId,rootType:root?.type,page:semantic.diagrams.find(d=>d.packageId===pack.packageId)?.name,
    menu:describe(menu),tables:tables.map(describe),cells:cells.map(describe),parents:[...objects.values()].filter(o=>(p(o.properties,'diagram-objects')??[]).some?.(ref=>ref?.$reference===menu.id)).map(o=>({id:o.id,type:o.type})),defaultStyle});
  }
 }
 report.samples.push({file:sample.file,sha256:sample.sha256,...counts,packageFailures:decoded.packages.filter(p=>p.status==='unsupported').map(p=>({path:p.path,reason:p.reason}))});
}
report.sources=['research/menu-format-census.mjs','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-semantics.mjs','research/scripts/read-rp-interactions.mjs'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/menu-format-census.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({samples:report.samples.map(s=>({...s,file:path.basename(s.file)})),menus:report.menus.map(m=>({page:m.page,packageId:m.packageId,parents:m.parents,menu:m.menu.properties,menuStyle:m.menu.style,tables:m.tables.map(t=>({id:t.id,properties:t.properties,style:t.style})),cells:m.cells.map(c=>({id:c.id,text:c.richText.text,properties:c.properties,style:c.appearance.style,events:c.interaction.events,states:c.states.states}))}))},null,2));
