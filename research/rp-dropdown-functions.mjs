import fs from 'node:fs';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {property as p} from './scripts/read-rp-semantics.mjs';
const samples=JSON.parse(fs.readFileSync('research/rp-form-candidates-evidence.json','utf8')).samples;
const output=[];
const references=value=>value&&typeof value==='object'?[...(value.$reference?[value.$reference]:[]),...Object.values(value).flatMap(references)]:[];
for(const sample of samples){
 const decoded=inspectRpObjects(sample.file);if(decoded.fileSha256!==sample.sha256)throw new Error('Source hash changed');
 for(const pack of decoded.packages){const objects=new Map((pack.objects??[]).map(o=>[o.id,o]));
  for(const call of objects.values())if(call.type==='Axure:Expr:FCall'&&['GetSelectedOption','SetSelectedOption'].includes(p(call.properties,'function-name'))){
   const args=p(call.properties,'args').map(r=>objects.get(r.$reference)),paths=args.filter(o=>o?.type==='Axure:Expr:DiagramObjectPathLiteral').map(o=>objects.get(p(o.properties,'value').$reference));
   const targets=paths.map(o=>objects.get(p(o.properties,'object-id').$reference)).filter(Boolean).map(o=>({id:o.id,type:o.type,name:p(p(o.properties,'name-block'),'text')}));
   const directParents=[...objects.values()].filter(o=>references(o.properties).includes(call.id));
   const ancestors=new Set([call.id]);let pending=[call.id];
   while(pending.length){const current=pending.shift();for(const o of objects.values())if(!ancestors.has(o.id)&&references(o.properties).includes(current)){ancestors.add(o.id);pending.push(o.id);}}
   const owners=[...ancestors].map(id=>objects.get(id)).filter(o=>o.type.startsWith('Axure:DiagramObject:')).map(o=>({id:o.id,type:o.type,name:p(p(o.properties,'name-block'),'text')}));
   const cases=[...ancestors].map(id=>objects.get(id)).filter(o=>o.type==='Axure:InteractionCase');
   const comparisons=directParents.filter(o=>o.type==='Axure:Expr:BinaryExpr').map(o=>{const right=objects.get(p(o.properties,'right-expr').$reference);return {id:o.id,operation:p(o.properties,'operation'),right,option:right.type==='Axure:Expr:OptionLiteral'?objects.get(p(right.properties,'Option').$reference):undefined};});
   output.push({file:sample.file,sha256:sample.sha256,packageId:pack.packageId,packageSha256:pack.sha256,call,args,paths,targets,directParents,owners,cases,comparisons});
  }
 }
}
fs.writeFileSync('research/rp-dropdown-function-records.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.map(o=>({packageId:o.packageId,id:o.call.id,targets:o.targets,owners:o.owners,comparisons:o.comparisons.map(c=>({operation:c.operation,value:p(c.right.properties,'value')}))})),null,2));
