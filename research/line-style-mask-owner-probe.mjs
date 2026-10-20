import fs from 'node:fs';import{createHash}from'node:crypto';import{inspectRpObjects}from'./scripts/read-rp-objects.mjs';import{property as p}from'./scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'),audit='research/line-style-import-audit.json',report=JSON.parse(fs.readFileSync(audit));
const contains=(v,id)=>v&&typeof v==='object'&&(v.$reference===id||Object.values(v).some(x=>contains(x,id)));
const records=[];
for(const s of report.samples.filter(s=>s.visibilityOmissions?.length)){
 const d=inspectRpObjects(s.file);
 for(const missing of s.visibilityOmissions){
  const pack=d.packages.find(p=>p.packageId===missing.packageId),parents=pack.objects.filter(a=>contains(a.properties,missing.id)).map(a=>({type:a.type,id:a.id,keys:a.properties.$map?.filter(([k,v])=>contains(v,missing.id)).map(([k])=>k)}));
  const owners=[];
  for(const parent of parents.filter(p=>['Axure:RepeatableDiagram','Axure:PanelDiagram'].includes(p.type)))for(const pp of d.packages)for(const o of pp.objects??[]){if(!o.type.startsWith('Axure:DiagramObject:')||!contains(o.properties,parent.id))continue;owners.push({packageId:pp.packageId,id:o.id,type:o.type,referenceKeys:o.properties.$map.filter(([k,v])=>contains(v,parent.id)).map(([k])=>k),importIssues:s.skippedObjects.filter(i=>i.packageId===pp.packageId&&i.sourceId===o.id)});}
  records.push({sample:missing.sample,sha256:s.sha256,packageId:missing.packageId,id:missing.id,mask:missing.mask,parents,owners,reason:parents.some(p=>p.type==='Axure:RepeatableDiagram')?'native repeater template is not admitted by the current native decoder':'panel state owner is omitted by the existing fit-content child-bounds guard'});
 }
}
const result={method:'Read-only original object-reference traces; exact missing-owner list comes from current 11-file import audit',audit:{file:audit,sha256:sha(audit)},records,sources:['research/line-style-mask-owner-probe.mjs','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-semantics.mjs'].map(file=>({file,sha256:sha(file)}))};
fs.writeFileSync('research/line-style-mask-owner-probe.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({missing:records.length,reasons:records.reduce((a,r)=>(a[r.reason]=(a[r.reason]??0)+1,a),{}),owners:records.map(r=>r.owners).flat()}));
