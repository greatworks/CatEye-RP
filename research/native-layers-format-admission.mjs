import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {stripTypeScriptTypes} from 'node:module';
import {inspectRpSemantics} from './scripts/read-rp-semantics.mjs';
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const urls=new Map();function url(file){file=path.resolve(file);if(urls.has(file))return urls.get(file);const code=stripTypeScriptTypes(fs.readFileSync(file,'utf8')).replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,r)=>`from ${JSON.stringify(url(path.resolve(path.dirname(file),r.endsWith('.ts')?r:r+'.ts')))}`),u='data:text/javascript;base64,'+Buffer.from(code).toString('base64');urls.set(file,u);return u;}
const {importRpSemantics}=await import(url('src/model/import-rp.ts'));
const census=read('research/native-layers-format-census.json'),samples=[];
for(const sample of census.samples){
 assert.equal(hash(sample.file),sample.sha256);
 const semantics=inspectRpSemantics(sample.file),layers=census.layers.filter(l=>l.file===sample.file);
 let result,error;try{result=importRpSemantics(semantics);}catch(e){error=e.message;}
 const lookup=new Map(semantics.diagrams.flatMap(d=>d.widgets.map(w=>[`${d.packageId}:${w.id}`,w])));
 const admitted=new Set();const walk=v=>{if(v&&typeof v==='object'){if(typeof v.id==='string'&&v.id.startsWith('rp-w-'))admitted.add(v.id);for(const c of Object.values(v))walk(c);}};walk(result?.document);
 const records=layers.map(l=>{const item=lookup.get(`${l.packageId}:${l.id}`);return {id:l.id,packageId:l.packageId,name:l.name,rootType:l.rootType,inSemantic:!!item,candidate:item?.typeCandidate,location:item?.storedGeometry?.location,size:item?.storedGeometry?.size,issues:result?.report.issues.filter(i=>i.packageId===l.packageId&&i.sourceId===l.id&&i.severity==='skipped')??[],directMemberAdmitted:l.members.map(m=>({id:m.id,type:m.type,admitted:admitted.has(`rp-w-${l.packageId}-${m.id}`)}))};});
 samples.push({file:sample.file,sha256:sample.sha256,error,compactBytes:Buffer.byteLength(JSON.stringify(semantics)),document:result?.document,report:result?.report,layers:records});
}
const sources=[...new Set(['research/native-layers-format-admission.mjs','research/native-layers-format-census.json','research/scripts/read-rp-semantics.mjs',...urls.keys()])].map(file=>({file:path.relative(process.cwd(),path.resolve(file)).replaceAll('\\','/'),sha256:hash(file)}));
const out={method:'Fresh pre-implementation native reader→import baseline. No native DLL or GUI execution.',originalAxureGuiCompared:false,sources,samples,totals:{files:samples.length,admitted:samples.filter(s=>s.document).length,layers:samples.reduce((n,s)=>n+s.layers.length,0),semanticLayers:samples.reduce((n,s)=>n+s.layers.filter(l=>l.inSemantic).length,0),maxCompactBytes:Math.max(...samples.map(s=>s.compactBytes))}};
fs.writeFileSync('research/native-layers-format-baseline.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out.totals));
