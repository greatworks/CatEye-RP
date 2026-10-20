import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {property as p,recoverRpSemantics,recoverStyle,recoverRichText,recoverSelection,recoverInteractionStyles} from './scripts/read-rp-semantics.mjs';
import {recoverInteractionMap} from './scripts/read-rp-interactions.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const samples=JSON.parse(fs.readFileSync('research/menu-format-census.json','utf8')).samples;
const plain=v=>Array.isArray(v?.$map)?Object.fromEntries(v.$map.map(([k,v])=>[k,plain(v)])):Array.isArray(v)?v.map(plain):v;
const report={capturedAt:new Date().toISOString(),method:'SHA-pinned source object graph, static self-written readers only; TreeNodeObject excludes SiteTreeMap and general Axure:Tree records',samples:[],trees:[]};
for(const sample of samples){assert.equal(sha(sample.file),sample.sha256);const data=inspectRpObjects(sample.file);let nodes=0,roots=0;
 for(const pack of data.packages){const found=(pack.objects??[]).filter(o=>o.type==='Axure:DiagramObject:TreeNodeObject');if(!found.length)continue;const objects=new Map(pack.objects.map(o=>[o.id,o])),root=objects.get(pack.rootId),semantic=recoverRpSemantics(data),identity=semantic.defaultStyleIdentityRecovery,defaultStyle={id:identity?.defaultStyleId,libraryId:identity?.defaultStyleLibraryId},resolve=r=>objects.get(r?.$reference);
  const describe=o=>{if(!o)return null;const style=resolve(p(o.properties,'MyStyle'));return {id:o.id,type:o.type,offset:o.offset,raw:o.properties,properties:plain(o.properties),style:style??null,appearance:recoverStyle(o,style,root,defaultStyle,resolve,{type:'box'}),richText:recoverRichText(o,{objects,root,packageId:pack.packageId}),selection:recoverSelection(o,style,root,defaultStyle,resolve,{type:'box'}),states:recoverInteractionStyles(o,style,root,defaultStyle,resolve,{type:'box'}),interaction:recoverInteractionMap({owner:o,objects,packageId:pack.packageId})};};
  const entries=found.map(o=>({node:describe(o),label:describe(resolve(p(o.properties,'buttonshape'))),expandImage:describe(resolve(p(o.properties,'plusminus'))),icon:describe(resolve(p(o.properties,'icon')))}));nodes+=found.length;roots+=found.filter(o=>p(o.properties,'rootnode')?.$reference===o.id).length;
  report.trees.push({file:sample.file,sha256:sample.sha256,packageId:pack.packageId,packageSha256:pack.sha256,version:pack.version,rootId:pack.rootId,page:semantic.diagrams.find(d=>d.packageId===pack.packageId)?.name,defaultStyle,nodes:entries,packageObjects:pack.objects});
 }
 report.samples.push({file:sample.file,sha256:sample.sha256,roots,nodes});
}
report.sources=['research/tree-widget-format-census.mjs','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-semantics.mjs','research/scripts/read-rp-interactions.mjs'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/tree-widget-format-census.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({samples:report.samples,trees:report.trees.map(t=>({page:t.page,packageId:t.packageId,nodes:t.nodes.map(({node,label,expandImage,icon})=>({id:node.id,parent:node.properties.parentnode,root:node.properties.rootnode,expanded:node.properties.isexpanded,children:node.properties.childnodes,localStyle:plain(node.style?.properties).PropList,resolved:node.appearance.resolvedGeometry,style:node.appearance.style,label:label&&{id:label.id,text:label.richText.text,location:label.properties.ContainedLocation,size:label.properties.ContainedSize},expandImage:expandImage?.id,icon:icon?.id}))}))},null,2));
