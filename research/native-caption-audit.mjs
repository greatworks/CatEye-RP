import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {pathToFileURL} from 'node:url';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {inspectRpSemantics,property as p} from './scripts/read-rp-semantics.mjs';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const url=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const strip=file=>stripTypeScriptTypes(fs.readFileSync(file,'utf8'));
const vector=url(strip('src/model/vector.ts')),tree=url(strip('src/model/page-tree-core.ts')),types=url(strip('src/model/types.ts'));
const docModule=url(strip('src/model/document.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./page-tree-core'",JSON.stringify(tree)).replace("'./types'",JSON.stringify(types)));
const {importRpSemantics}=await import(url(strip('src/model/import-rp.ts').replace("'./vector'",JSON.stringify(vector)).replace("'./document'",JSON.stringify(docModule)).replace("'./page-tree-core'",JSON.stringify(tree)).replace("'./types'",JSON.stringify(types))));
const flatten=ws=>ws.flatMap(w=>[w,...(w.states??[]).flatMap(s=>flatten(s.widgets))]);
const inputs=JSON.parse(fs.readFileSync('research/rp-form-candidates-evidence.json','utf8')).samples;
const output=process.argv[2]??'research/native-caption-evidence.json';
if(output==='research/native-caption-baseline.json')throw new Error('The recorded pre-fix baseline is frozen');
const baselineSource='research/native-caption-baseline-reader-source.txt';
let baselineCode=fs.readFileSync(baselineSource,'utf8');
for(const name of ['objects','container','interactions'])baselineCode=baselineCode.replace(`'./read-rp-${name}.mjs'`,JSON.stringify(pathToFileURL(path.resolve(`research/scripts/read-rp-${name}.mjs`)).href));
const baselineParser=await import(url(baselineCode));
const historical=JSON.parse(fs.readFileSync('research/native-caption-baseline.json','utf8'));
const report={method:'Own static package parser and pure importer; no target assembly or original GUI execution',sources:['research/scripts/read-rp-semantics.mjs','src/model/import-rp.ts','research/native-caption-audit.mjs',baselineSource,'research/native-caption-baseline.json','research/native-caption-before.rea.json','research/native-caption-browser-baseline-personal-information.png','research/rp-text-layout-cil.json','research/rp-text-layout-sample-evidence.json'].filter(fs.existsSync).map(file=>({file,sha256:sha(file)})),samples:[]};
for(const sample of inputs){
 const decoded=inspectRpObjects(sample.file);if(decoded.fileSha256!==sample.sha256)throw new Error('Original source changed');
 const semantic=inspectRpSemantics(sample.file),summary={file:sample.file,sha256:sample.sha256};report.samples.push(summary);
 const pack=decoded.packages.find(p=>p.path==='DesignDocument'),objects=new Map((pack?.objects??[]).map(o=>[o.id,o]));
 const doc=objects.get(pack?.rootId),sheetRef=p(doc?.properties,'StyleSheet'),sheet=objects.get(sheetRef?.$reference),defaultRef=p(sheet?.properties,'DefaultStyle'),style=objects.get(defaultRef?.$reference);
 summary.defaultIdentity={packageId:pack?.packageId,packageSha256:pack?.sha256,documentId:doc?.id,sheetRef,defaultRef,id:p(style?.properties,'Id'),libraryId:p(style?.properties,'LibraryId')};
 const ws=semantic.diagrams.flatMap(d=>d.widgets);
 summary.semantic={records:ws.length,completeChains:ws.filter(w=>w.styleRecovery?.cacheChainComplete).length,padding:ws.filter(w=>w.styleRecovery?.style.textPadding).length,normal:ws.filter(w=>w.styleRecovery?.style.lineHeight==='normal').length,failures:semantic.semanticFailures};
 summary.outputBytes={compact:Buffer.byteLength(JSON.stringify(semantic)),pretty:Buffer.byteLength(JSON.stringify(semantic,null,2))};
 try{
  const imported=importRpSemantics(semantic,sample.file),all=imported.document.pages.flatMap(p=>flatten(p.widgets));
  const previousSemantic=baselineParser.inspectRpSemantics(sample.file),previous=importRpSemantics(previousSemantic,sample.file),oldAll=previous.document.pages.flatMap(p=>flatten(p.widgets));
  const previousWidgets=new Map(previousSemantic.diagrams.flatMap(d=>d.widgets.map(w=>[`${d.packageId}:${w.id}`,w])));
  summary.localPrecedenceComparison={checked:0,changes:[]};
  for(const d of semantic.diagrams)for(const w of d.widgets){const old=previousWidgets.get(`${d.packageId}:${w.id}`);for(const[field,source]of Object.entries(old?.styleRecovery?.provenance??{}))if(['local-object-style','stored-active-state-style'].includes(source.kind)){
   summary.localPrecedenceComparison.checked++;if(JSON.stringify(old.styleRecovery.style[field])!==JSON.stringify(w.styleRecovery?.style[field]))summary.localPrecedenceComparison.changes.push({packageId:d.packageId,id:w.id,field,source,before:old.styleRecovery.style[field],after:w.styleRecovery?.style[field]});
  }}
  const recorded=historical.samples.find(s=>s.sha256===sample.sha256).import;
  for(const key of ['widgetsImported','widgetsSkipped','nestedWidgetsImported','nestedWidgetsSkipped','eventsImported','actionsImported'])if(previous.report[key]!==recorded[key])throw Error(`Frozen baseline does not reproduce ${key}`);
  const {issues,...counts}=imported.report;
  summary.import={...counts,types:all.reduce((a,w)=>(a[w.type]=(a[w.type]??0)+1,a),{}),issueCounts:issues.reduce((a,i)=>(a[i.code]=(a[i.code]??0)+1,a),{}),members:all.map(w=>({id:w.id,name:w.name,type:w.type,events:w.interactions.map(i=>({event:i.event,actions:i.actions.map(a=>a.type)}))}))};
  const oldMap=new Map(oldAll.map(w=>[w.id,w]));
  const nativeByModelId=new Map(semantic.diagrams.flatMap(d=>d.widgets.map(w=>[`rp-w-${d.packageId}-${w.id}`,{diagram:d,widget:w}])));
  summary.newAdmissions=all.filter(w=>!oldMap.has(w.id)).map(w=>{
   const n=nativeByModelId.get(w.id),old=previousSemantic.diagrams.find(d=>d.packageId===n.diagram.packageId)?.widgets.find(o=>o.id===n.widget.id);
   return{id:w.id,name:w.name,type:w.type,packageId:n.diagram.packageId,sourceId:n.widget.id,rootType:n.diagram.rootType,pageOrStateName:n.diagram.name,storedFlags:n.widget.storedFlags,selectionRecovery:n.widget.selectionRecovery,oldSelectionRecovery:old?.selectionRecovery,oldImageRecovery:old?.imageRecovery,oldIssues:previous.report.issues.filter(i=>i.sourceId===n.widget.id&&i.packageId===n.diagram.packageId).map(({code,message})=>({code,message})),oldChain:old?.styleRecovery?.cacheChainComplete,newChain:n.widget.styleRecovery?.cacheChainComplete,oldResolvedGeometry:old?.styleRecovery?.resolvedGeometry,newResolvedGeometry:n.widget.styleRecovery?.resolvedGeometry,storedGeometry:n.widget.storedGeometry,states:w.states?.map(s=>({id:s.id,name:s.name,widgetIds:s.widgets.map(w=>w.id)}))};
  });
  const oldPages=new Map(previous.document.pages.map(p=>[p.id,p]));
  summary.newEvents=[...all.map(w=>({owner:w,old:oldMap.get(w.id)})),...imported.document.pages.map(p=>({owner:p,old:oldPages.get(p.id)}))].flatMap(({owner,old})=>owner.interactions.filter(i=>!(old?.interactions??[]).some(j=>j.id===i.id)).map(i=>({ownerId:owner.id,name:owner.name,event:i.event,caseId:i.id,actions:i.actions,conditions:i.conditions,isNewIfGroup:i.isNewIfGroup})));
  if(sample.file.endsWith('Sample form patterns.rplib')){
   const page=semantic.diagrams.find(d=>d.packageId==='784fffad1a36482594f6f965760990d6'),native=decoded.packages.find(p=>p.packageId===page.packageId),map=new Map(native.objects.map(o=>[o.id,o]));
   const caches=p(p(map.get(native.rootId).properties,'StyleCache'),'Styles');
   report.personalForm={packageId:native.packageId,packageSha256:native.sha256,version:native.version,rootId:native.rootId,diagramId:page.diagramId,caches,defaultStyle:style,labels:[]};
   for(const w of page.widgets.filter(w=>['First name*','Last name*','Email address*','Phone number','Date of birth'].includes(w.text?.text))){
    const o=map.get(w.id),local=map.get(p(o.properties,'MyStyle')?.$reference),model=all.find(m=>m.id.endsWith(w.id));
    report.personalForm.labels.push({id:w.id,text:w.text,storedGeometry:w.storedGeometry,storedFlags:w.storedFlags,nativeObject:o,nativeLocalStyle:local,recovery:w.styleRecovery,imported:model?{id:model.id,style:model.style,x:model.x,y:model.y,width:model.width,height:model.height}:null});
   }
  }
 }catch(error){summary.import={rejected:error.message};}
}
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,samples:report.samples.map(s=>({file:path.basename(s.file),chains:s.semantic.completeChains,padding:s.semantic.padding,normal:s.semantic.normal,import:s.import.rejected??{widgets:s.import.widgetsImported,skipped:s.import.widgetsSkipped,nested:s.import.nestedWidgetsImported,nestedSkipped:s.import.nestedWidgetsSkipped,images:s.import.types.image??0,events:s.import.eventsImported,actions:s.import.actionsImported}})),labels:report.personalForm?.labels.map(l=>({id:l.id,text:l.text.text}))},null,2));
