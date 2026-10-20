import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { inspectRpSemantics } from './scripts/read-rp-semantics.mjs';
const root=path.resolve(import.meta.dirname,'..'),read=file=>JSON.parse(fs.readFileSync(path.resolve(root,file),'utf8').replace(/^\uFEFF/,''));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex'),sha=file=>digest(fs.readFileSync(path.resolve(root,file)));
const modules=new Map(),urls=new Map();
function moduleUrl(file){file=path.resolve(root,file);if(urls.has(file))return urls.get(file);modules.set(file,sha(file));
  const code=stripTypeScriptTypes(fs.readFileSync(file,'utf8')).replace(/from\s+(['"])(\.[^'"]+)\1/g,(_,q,r)=>`from ${JSON.stringify(moduleUrl(path.resolve(path.dirname(file),r.endsWith('.ts')?r:`${r}.ts`)))}`);
  const url=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;urls.set(file,url);return url;
}
const {importRpSemantics}=await import(moduleUrl('src/model/import-rp.ts'));
const {parseDocument,serializeDocument}=await import(moduleUrl('src/model/document.ts'));
const baseline=read('research/rotation-import-baseline.json'),rotations=read('research/rotation-import-audit.json'),prior=read('research/text-autofit-import-audit.json'),declarations=read('research/adaptive-import-styles-census.json');
const inputs=['research/rotation-import-baseline.json','research/rotation-import-audit.json','research/text-autofit-import-audit.json','research/adaptive-import-styles-census.json',...['container','objects','interactions','adaptive','semantics'].map(n=>`research/scripts/read-rp-${n}.mjs`)];
const pins=inputs.map(file=>({file,sha256:sha(file)}));
function walk(ws,all=[]){for(const w of ws){all.push(w);for(const state of w.states??[])walk(state.widgets,all);walk(w.repeater?.template??[],all);walk(w.table?.cells??[],all);walk(w.menu?[w.menu.table,...w.menu.submenus]:[],all);walk(w.tree?.nodes??[],all);walk(w.treeNode?[w.treeNode.label,...w.treeNode.children]:[],all);}return all;}
const nodes=d=>walk(d.pages.flatMap(p=>p.widgets));
const audit={schema:1,startedAt:new Date().toISOString(),ok:false,method:'Import the same 11 pinned real files; reconstruct the frozen complete pre-adaptive documents from rotation + shapeText evidence, compare every prior node and order after removing only source-bound adaptive additions. No native GUI/write-back assertion.',samples:[],failures:[]};
for(const old of baseline.samples){
  const record={name:path.basename(old.file),file:old.file,sourceSha256:old.sha256,ok:false};
  try{
    assert.equal(sha(old.file),old.sha256);const semantic=inspectRpSemantics(old.file),before=prior.samples.find(s=>s.sourceSha256===old.sha256),rotation=rotations.samples.find(s=>s.sha256===old.sha256);assert.ok(before&&rotation);
    record.setsRecovered=semantic.adaptiveRecovery.sets.filter(s=>s.status==='supported-adaptive-set').length;
    record.assignments=Object.fromEntries(['assigned','unassigned','unsupported-assignment'].map(k=>[k,semantic.adaptiveRecovery.pages.filter(p=>p.status===k).length]));
    if(old.importError){assert.throws(()=>importRpSemantics(semantic),e=>e.message===old.importError);record.importError=old.importError;record.rejectionUnchanged=true;}
    else{
      const {document,report}=importRpSemantics(semantic),expected=structuredClone(old.document);
      for(const added of rotation.rotations){const {pageId,sourcePackageId,sourceId,provenance,omittedInteractionIssues,...widget}=added,page=expected.pages.find(p=>p.id===pageId),order=semantic.diagrams.find(d=>d.packageId===sourcePackageId).widgets.map(w=>`rp-w-${sourcePackageId}-${w.id}`),rank=order.indexOf(widget.id),next=page.widgets.findIndex(w=>order.indexOf(w.id)>rank);page.widgets.splice(next<0?page.widgets.length:next,0,widget);}
      const oldNodes=nodes(expected),oldIds=new Set(oldNodes.map(w=>w.id));
      for(const w of oldNodes){const n=before.nodes.find(n=>n.id===w.id);assert.ok(n);if(n.shapeText)w.shapeText=structuredClone(n.shapeText);}
      const newNodes=nodes(document).filter(w=>!oldIds.has(w.id)),allowed=declarations.records.filter(r=>r.sourceSha256===old.sha256);
      record.additions=newNodes.map(w=>{const source=allowed.find(r=>w.id===`rp-w-${r.packageId}-${r.sourceObjectId}`);assert.ok(source,`Unexplained recovered node ${w.id}`);return{id:w.id,type:w.type,sourceId:source.sourceObjectId,packageId:source.packageId,maps:source.maps.length};});
      const reduced=structuredClone(document);delete reduced.adaptiveViewSets;
      const newIds=new Set(newNodes.map(w=>w.id));
      for(const p of reduced.pages){p.widgets=p.widgets.filter(w=>!newIds.has(w.id));delete p.adaptiveOverrides;delete p.adaptiveViewSetId;}
      // This corpus has no assigned page and all newly admitted owners are top-level.
      assert.equal(record.assignments.assigned,0);assert.deepEqual(reduced,expected);record.allPriorDocumentDataPreserved=true;
      assert.deepEqual(parseDocument(serializeDocument(document)),document);record.roundtripEqual=true;
      record.documentSha256=digest(serializeDocument(document));record.counts=Object.fromEntries(Object.entries(report).filter(([k])=>k!=='issues'));
      record.beforeCounts=before.counts;record.delta=Object.fromEntries(Object.entries(record.counts).filter(([,v])=>typeof v==='number').map(([k,v])=>[k,v-before.counts[k]]));
      record.inactiveMaps=document.pages.reduce((n,p)=>n+Object.keys(p.adaptiveOverrides??{}).length,0);
      record.overrideDeclarations=document.pages.reduce((n,p)=>n+Object.values(p.adaptiveOverrides??{}).reduce((a,m)=>a+Object.keys(m).length,0),0);
      record.additionalOwnerIssues=report.issues.filter(i=>record.additions.some(a=>a.sourceId===i.sourceId&&a.packageId===i.packageId));
      const currentIds=new Set(nodes(document).map(w=>w.id));
      record.remainingAdaptiveOwners=allowed.filter(s=>!currentIds.has(`rp-w-${s.packageId}-${s.sourceObjectId}`)).map(s=>({sourceId:s.sourceObjectId,packageId:s.packageId,type:s.type,issues:report.issues.filter(i=>i.packageId===s.packageId&&i.sourceId===s.sourceObjectId&&i.severity==='skipped')}));
    }
    record.ok=true;
  }catch(error){record.error=String(error.message).slice(0,3000);audit.failures.push({sample:record.name,error:record.error});}
  record.sourceUnchanged=sha(old.file)===old.sha256;if(!record.sourceUnchanged)audit.failures.push({sample:record.name,error:'Source changed'});
  audit.samples.push(record);console.log(JSON.stringify({sample:record.name,ok:record.ok,added:record.additions?.length,error:record.error}));
}
for(const pin of pins)assert.equal(sha(pin.file),pin.sha256);for(const[file,hash]of modules)assert.equal(sha(file),hash);
try{
  const directory=path.join(root,'.build/adaptive-import-fixture'),manifest=read(path.join(directory,'manifest.json')),file=path.join(directory,'SYNTHETIC-adaptive.raw.rp');
  assert.equal(sha(file),manifest.rawSha256);const recovered=inspectRpSemantics(file),{document,report}=importRpSemantics(recovered,'SYNTHETIC adaptive import');
  fs.writeFileSync(path.join(directory,'import-report.json'),JSON.stringify(report,null,2)+'\n');
  assert.equal(report.widgetsImported,6);assert.equal(report.eventsImported,4);assert.equal(report.actionsImported,3);assert.equal(report.eventsSkipped,0);
  const p=document.pages[0],ids=manifest.ids,wid=id=>`rp-w-${ids.pagePackage}-${id}`;
  assert.equal(p.adaptiveViewSetId,`rp-avs-${ids.set}`);
  for(const view of ['tablet','phone'])assert.deepEqual(p.adaptiveOverrides[`rp-av-${ids[view]}`][wid(ids.target)],manifest.expected[view]);
  assert.deepEqual(p.adaptiveOverrides[`rp-av-${ids.inactive}`][wid(ids.orphan)],{});assert.deepEqual(parseDocument(serializeDocument(document)),document);
  fs.writeFileSync(path.join(directory,'imported.rea.json'),serializeDocument(document));fs.writeFileSync(path.join(directory,'import-report.json'),JSON.stringify(report,null,2)+'\n');
  audit.synthetic={ok:true,rawSha256:manifest.rawSha256,documentSha256:sha(path.join(directory,'imported.rea.json')),reportSha256:sha(path.join(directory,'import-report.json')),widgets:report.widgetsImported,events:report.eventsImported,actions:report.actionsImported,independentlyEncoded:true,nativeWriteBackVerified:false};
}catch(error){audit.failures.push({sample:'SYNTHETIC adaptive RP',error:String(error.message).slice(0,3000)});}
audit.sources=[...pins,...[...modules].map(([file,sha256])=>({file:path.relative(root,file).replaceAll('\\','/'),sha256}))];
audit.totals={samples:audit.samples.length,admitted:audit.samples.filter(s=>s.roundtripEqual).length,rejected:audit.samples.filter(s=>s.rejectionUnchanged).length,newWidgets:audit.samples.reduce((n,s)=>n+(s.additions?.length??0),0),sets:audit.samples.reduce((n,s)=>n+s.setsRecovered,0),overrideDeclarations:audit.samples.reduce((n,s)=>n+(s.overrideDeclarations??0),0)};
audit.ok=!audit.failures.length;audit.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(root,'research/adaptive-import-corpus-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify({ok:audit.ok,totals:audit.totals,failures:audit.failures}));if(!audit.ok)process.exitCode=1;
