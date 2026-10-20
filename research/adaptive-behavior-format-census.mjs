import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source='research/rich-hyperlink-format-census.json';
const report={method:'Static original corpus parsed by self-written container/object readers; no DLL or app execution.',samples:[],configurations:[],actions:[],adaptivePageEvents:[],pageAssignments:[],adaptiveStyles:[],stateProperties:[],sets:[],adaptiveStyleTargets:[]};
const get=(o,k)=>o?.properties?.$map?.find(([n])=>n===k)?.[1];
for(const sample of JSON.parse(fs.readFileSync(source)).samples){
 assert.equal(sha(sample.file),sample.sha256);
 const d=inspectRpObjects(sample.file), counts={objects:0,actions:0,adaptivePageEvents:0,adaptiveStyleFields:0,nonemptyAdaptiveStyles:0,pages:0,nonzeroPageAssignments:0,configurations:0,stateProperties:0};
 for(const p of d.packages){const prov={file:sample.file,sha256:sample.sha256,packageId:p.packageId,packageSha256:p.sha256,version:p.version};
  const record=o=>({...prov,id:o.id,type:o.type,offset:o.offset,properties:o.properties});
  const index=new Map((p.objects??[]).map(o=>[o.id,o]));
  for(const o of p.objects??[]){counts.objects++;
   if(o.type==='Axure:InteractionSetAdaptiveView'||o.type==='Axure:Expr:AdaptiveViewLiteral'){report.actions.push(record(o));counts.actions++;}
   if(o.type==='Axure:InteractionEvent'&&get(o,'event-type')===338){report.adaptivePageEvents.push(record(o));counts.adaptivePageEvents++;}
   if(o.type==='Axure:HtmlPrototypeGeneratorConfiguration'){report.configurations.push(record(o));counts.configurations++;}
   if(o.type==='Axure:AdaptiveViewSet')report.sets.push(record(o));
   if(o.type==='Axure:Page'){counts.pages++;const id=get(o,'AdaptiveViewSetId'),ref=get(o,'AdaptiveViewSet');if(id?.$guid!=='00000000000000000000000000000000'||ref?.$reference!=='00000000000000000000000000000000')counts.nonzeroPageAssignments++;report.pageAssignments.push({...prov,id:o.id,type:o.type,setId:id,setReference:ref,matchInfos:get(o,'AdaptiveViewMatchInfos')});}
   const a=get(o,'AdaptiveStyles');if(a!==undefined){counts.adaptiveStyleFields++;if(!Array.isArray(a)||a.length){counts.nonemptyAdaptiveStyles++;report.adaptiveStyles.push({...record(o),properties:{$map:o.properties.$map.filter(([k])=>k!=='ControlPoints'&&k!=='RichTextBlock')}});if(Array.isArray(a))for(let n=0;n<a.length;n+=2){const target=index.get(a[n+1]?.$reference);report.adaptiveStyleTargets.push({...prov,ownerId:o.id,viewId:a[n],styleReference:a[n+1],target:target??null});}}}
   const props=get(o,'PropList');if(Array.isArray(props))for(const prop of props){const pm=Object.fromEntries(prop?.$map??[]);if((pm.DOAName&0x3fffffff)===21){counts.stateProperties++;report.stateProperties.push({...prov,styleId:o.id,styleType:o.type,styleName:get(o,'Name'),entry:prop});}}
  }
 }
 report.samples.push({file:sample.file,sha256:sample.sha256,...counts,packageFailures:d.packages.filter(p=>p.status==='unsupported').map(p=>({id:p.packageId,reason:p.reason}))});
}
report.sources=[source,'research/adaptive-behavior-format-census.mjs','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-container.mjs'].map(file=>({file,sha256:sha(file)}));
fs.writeFileSync('research/adaptive-behavior-format-census.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({samples:report.samples,totals:Object.fromEntries(['actions','adaptivePageEvents','adaptiveStyles','stateProperties','pageAssignments','configurations','sets'].map(k=>[k,report[k].length]))},null,2));
