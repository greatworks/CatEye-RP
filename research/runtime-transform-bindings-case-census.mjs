import fs from 'node:fs';
import assert from 'node:assert/strict';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {recoverInteractionMap} from './scripts/read-rp-interactions.mjs';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
const ZERO='0'.repeat(32), corpus=readJson('research/runtime-transform-format-census.json');
const get=(o,k)=>o?.properties?.$map?.find(([n])=>n===k)?.[1];
const count=xs=>Object.fromEntries([...new Set(xs)].map(x=>[x,xs.filter(y=>y===x).length]));
const prior=readJson('research/runtime-rotate-format-import-after.json');
const refs=(v,a=[])=>{if(v&&typeof v==='object'){if(v.$reference)a.push(v.$reference);else for(const x of Object.values(v))refs(x,a);}return a;};
const imported=new Map(prior.samples.map(s=>{const ids=new Set();const visit=v=>{if(v&&typeof v==='object'){if(typeof v.id==='string')ids.add(v.id);for(const x of Object.values(v))visit(x);}};visit(s.document);return [s.file,ids];}));
const allInfos=[],allCases=[],allLiterals=[],allBoundaries=[],checks=[];
const check=(name,fn)=>{try{fn();checks.push({name,passed:true});}catch(e){checks.push({name,passed:false,error:e.stack});}};
for(const sample of corpus.samples){
 assert.equal(sha256(sample.file),sample.sha256);
 const candidates=corpus.actions.filter(a=>a.file===sample.file&&a.kind!=='rotate');if(!candidates.length)continue;
 const decoded=inspectRpObjects(sample.file), packages=new Map(decoded.packages.filter(p=>p.objects).map(p=>[p.packageId,p]));
 const packageGroups=Map.groupBy(candidates,a=>a.packageId);
 for(const [packageId,actions]of packageGroups){
  const pack=packages.get(packageId),objects=new Map(pack.objects.map(o=>[o.id,o])),local=r=>objects.get(r?.$reference), source={file:sample.file,sha256:sample.sha256,packageId,sourcePartSha256:pack.sha256,version:pack.version};
  const info=o=>o&&({id:o.id,type:o.type,name:get(o,'Name')??get(o,'name')??get(o,'label'),importedInFrozenBaseline:imported.get(sample.file).has(o.type==='Axure:Page'?`rp-p-${packageId}`:`rp-w-${packageId}-${o.id}`),frozenBaselineSkippedIssues:prior.samples.find(s=>s.file===sample.file).report?.issues.filter(i=>i.packageId===packageId&&i.sourceId===o.id&&i.severity==='skipped')??[]});
  const path=r=>{const o=local(r);assert.equal(o?.type,'Axure:DiagramObjectPath');const target=get(o,'object-id');assert.equal(target.referenceTag,22);return {sourceId:o.id,objectId:target.$reference,thisTarget:target.$reference===ZERO,rdoPath:get(o,'rdo-path'),repeaterPath:get(o,'repeater-path'),isDummy:get(o,'is-dummy'),target:info(objects.get(target.$reference))};};
  const expression=(r,seen=new Set())=>{
   const o=local(r);if(!o)return {unresolved:r};if(seen.has(o.id))return {cycle:o.id};seen=new Set([...seen,o.id]);
   const result={sourceId:o.id,type:o.type};
   if(o.type==='Axure:Expr:BinaryExpr')return {...result,operation:get(o,'operation'),left:expression(get(o,'left-expr'),seen),right:expression(get(o,'right-expr'),seen)};
   if(o.type==='Axure:Expr:DiagramObjectPathLiteral')return {...result,path:path(get(o,'value'))};
   if(o.type==='Axure:Expr:FCall')return {...result,functionName:get(o,'function-name'),args:(get(o,'args')??[]).map(x=>expression(x,seen))};
   if(o.type==='Axure:Expr:StringLiteral'||o.type==='Axure:Expr:BoundaryDirectionLiteral'){
    const bindings=(get(o,'scope')?.$map??[]).map(([name,r])=>({name,runtimeName:name.toLowerCase(),value:expression(r,seen)}));
    const identifiers=(get(o,'variable-identifiers')??[]).map(r=>{const v=local(r);return {sourceId:v?.id,type:v?.type,name:get(v,'Name'),storedId:get(v,'Id'),expressionRef:get(v,'Expr'),targetOverride:get(v,'TargetOverride')};});
    return {...result,text:get(o,'value'),direction:get(o,'boundaryDirection'),bindings,identifiers,repeaterScope:get(o,'repeater-scope'),targetRepeaterScope:get(o,'TargetRepeaterScope'),rawProperties:o.properties};
   }
   return {...result,rawProperties:o.properties};
  };
  const recorded=new Set();
  const collect=e=>{if(!e||typeof e!=='object')return;if(e.text!==undefined&&!recorded.has(e.sourceId)){recorded.add(e.sourceId);allLiterals.push({...source,...e});}for(const x of Object.values(e))if(x&&typeof x==='object')Array.isArray(x)?x.forEach(collect):collect(x);};
  const describeAction=(o)=>{
   const out={sourceId:o.id,type:o.type,disabled:get(o,'Disabled'),rawProperties:o.properties};
   if(o.type==='Axure:InterationActionSetFunction')out.functionTree=expression(get(o,'action'));
   const named=candidates.find(a=>a.packageId===packageId&&a.action.id===o.id);
   if(named){out.infos=named.infos.map((i,n)=>{const exprs=Object.fromEntries((named.kind==='move'?['XValue','YValue']:['width','height']).map(k=>[k,expression(get(i,k))]));for(const e of Object.values(exprs))collect(e);const boundary=get(i,'BoundaryCondition');const b=boundary?.$reference!==ZERO&&boundary?expression(boundary):null;if(b){collect(b);allBoundaries.push({...source,actionId:o.id,infoId:i.id,ast:b});}const row={...source,actionId:o.id,infoId:i.id,kind:named.kind,target:path({$reference:named.paths[n].id}),expressions:exprs,boundary:b,mode:get(i,'MoveType'),rawProperties:i.properties};allInfos.push(row);return row;});}
   else {
    const closure=[],todo=refs(o.properties),visited=new Set();
    while(todo.length&&visited.size<100){const id=todo.shift();if(visited.has(id)||!objects.has(id))continue;visited.add(id);const x=objects.get(id);if(x.type.startsWith('Axure:DiagramObject:')){closure.push(info(x));continue;}closure.push(x);todo.push(...refs(x.properties));}
    out.closure=closure;
    out.calls=closure.filter(x=>x.type==='Axure:Expr:FCall').map(x=>expression({$reference:x.id}));
    for(const e of out.calls)collect(e);
    out.pathTargets=closure.filter(x=>x.type==='Axure:DiagramObjectPath').map(x=>path({$reference:x.id}));
   }
   return out;
  };
  const caseMap=new Map();for(const a of actions)for(const c of a.cases){if(!caseMap.has(c.id))caseMap.set(c.id,{c,owners:a.owners});}
  for(const {c,owners}of caseMap.values()){
   const event=get(c.event,'event-type'),ownerRecords=owners.map(x=>info(objects.get(x.id))),orderedActions=c.orderedActions.map(x=>describeAction(objects.get(x.id))),condition=get({properties:c.properties},'Condition');
   const freshDiagnostics=owners.map(x=>({ownerId:x.id,result:recoverInteractionMap({owner:objects.get(x.id),objects,packageId}).events?.find(e=>e.id===c.event.id)}));
   // Synthetic diagnostic isolation only: keep the original owner's whole tree,
   // replacing Move/Size action *members* by already-supported literal Wait(0)
   // would invent data. Instead remove those nodes from a cloned tree and mark
   // this diagnostic explicitly, never as an admitted real event.
   const siblingDiagnostics=owners.map(x=>{
    const clone=new Map([...objects].map(([id,o])=>[id,structuredClone(o)])),owner=clone.get(x.id),map=clone.get(get(owner,'InteractionMap')?.$reference??get(owner,'interactionmap')?.$reference),nodeTable=get(map,'node-table').$map;
    const removed=new Set(nodeTable.filter(([,ref])=>/Interaction(?:MoveWidget|SetWidgetSize)Action$/.test(clone.get(ref.$reference)?.type??'')).map(([ref])=>ref.$reference));
    for(const o of clone.values())if(o.type==='Axure:Node')for(const pair of o.properties.$map)if(pair[0]==='children')pair[1]=pair[1].filter(r=>!removed.has(r.$reference));
    get(map,'node-table').$map=nodeTable.filter(([r])=>!removed.has(r.$reference));
    const eventObject=clone.get(c.event.id);for(const pair of eventObject.properties.$map)if(pair[0]==='event-type')pair[1]=16;
    const result=recoverInteractionMap({owner,objects:clone,packageId}).events?.find(e=>e.id===c.event.id);
    return {ownerId:x.id,method:'Synthetic diagnostic only: transform nodes removed, target event code changed to Click. Original case conditions and remaining sibling payloads unchanged. Not real-case recovery.',result};
   });
   const nameObject=objects.get(pack.rootId);allCases.push({...source,packageRoot:info(nameObject),caseId:c.id,eventId:c.event.id,nativeEventType:event,owners:ownerRecords,condition:condition?.$reference===ZERO?null:expression(condition),caseProperties:c.properties,orderedActions,freshReaderDiagnostics:freshDiagnostics,syntheticSiblingDiagnostics:siblingDiagnostics,mixedMoveSize:orderedActions.some(a=>a.type.includes('MoveWidget'))&&orderedActions.some(a=>a.type.includes('SetWidgetSize'))});
  }
 }
}
// Describing each case can repeat a shared action. Inventory is keyed by package and native identity.
const unique=(xs,key)=>[...new Map(xs.map(x=>[key(x),x])).values()];
const infos=unique(allInfos,x=>x.packageId+':'+x.infoId),literals=unique(allLiterals,x=>x.packageId+':'+x.sourceId),boundaries=unique(allBoundaries,x=>x.packageId+':'+x.infoId);
const bindings=literals.flatMap(x=>x.bindings??[]),ids=literals.flatMap(x=>x.identifiers??[]),mixed=allCases.filter(c=>c.mixedMoveSize);
check('All 11 original samples retain pinned hashes',()=>assert.equal(corpus.samples.length,11));
check('54 Move + 9 Size per-target records retained',()=>{assert.equal(infos.filter(x=>x.kind==='move').length,54);assert.equal(infos.filter(x=>x.kind==='size').length,9);});
check('Every one of 126 Move/Size inputs is StringLiteral, not NumericLiteral or arbitrary direct Expr',()=>{const inputs=infos.flatMap(x=>Object.values(x.expressions));assert.equal(inputs.length,126);assert.ok(inputs.every(e=>e.type==='Axure:Expr:StringLiteral'));});
check('12 boundaries retain native AST; all six real mixed cases retain ordered siblings',()=>{assert.equal(boundaries.length,12);assert.equal(mixed.length,6);assert.ok(mixed.every(c=>c.nativeEventType===273));});
check('Every scope binding in these cases is exactly GetWidget(one local path)',()=>assert.ok(bindings.every(b=>b.value.functionName==='GetWidget'&&b.value.args.length===1&&b.value.args[0].type==='Axure:Expr:DiagramObjectPathLiteral'&&!b.value.args[0].path.isDummy&&b.value.args[0].path.rdoPath.length===0&&b.value.args[0].path.repeaterPath.length===0)));
check('All observed local binding names are distinct after ASCII case folding per expression',()=>{for(const e of literals){assert.ok(e.bindings.every(b=>/^[A-Za-z][A-Za-z0-9_]*$/.test(b.name)));assert.equal(new Set(e.bindings.map(b=>b.runtimeName)).size,e.bindings.length);}});
check('Text-variable identities point back to their expression and do not override Target',()=>{for(const e of literals)for(const i of e.identifiers){assert.equal(i.type,'Axure:Expr:TextVariableIdentifier');assert.equal(i.expressionRef.$reference,e.sourceId);assert.equal(i.targetOverride,false);}});
check('No nonzero repeater scopes are hidden by the binding projection',()=>{for(const e of literals){assert.equal(e.repeaterScope.$reference,ZERO);assert.equal(e.targetRepeaterScope.$reference,ZERO);}});
const report={method:'Fresh read-only source package decoding and structured native graph projection. Current reader diagnostics and frozen-release imported identity membership are separate; no event is newly imported, no runtime/native DLL execution.',originalAxureGuiCompared:false,originalDllExecuted:false,sources:['research/runtime-transform-bindings-case-census.mjs','research/runtime-transform-format-census.json','research/runtime-rotate-format-import-after.json','research/scripts/read-rp-objects.mjs','research/scripts/read-rp-interactions.mjs'].map(file=>({file,sha256:sha256(file)})),samples:corpus.samples.map(({file,sha256})=>({file,sha256})),totals:{infos:infos.length,cases:allCases.length,mixedMoveSizeCases:mixed.length,expressionObjects:literals.length,nonemptyScopeExpressions:literals.filter(e=>e.bindings.length).length,bindings:bindings.length,bindingNames:count(bindings.map(b=>b.name)),identifierNames:count(ids.map(i=>i.name)),events:count(allCases.map(c=>c.nativeEventType)),boundaries:boundaries.length},infos,literals,boundaries,cases:allCases,checks:{total:checks.length,passed:checks.filter(x=>x.passed).length,results:checks}};
fs.writeFileSync('research/runtime-transform-bindings-case-census.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({totals:report.totals,checks:report.checks}));if(checks.some(c=>!c.passed))process.exitCode=1;
