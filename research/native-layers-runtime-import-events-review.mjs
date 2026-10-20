import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),bound=p=>({path:p,sha256:hash(p)}),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const auditPath='research/native-layers-format-import-audit.json',censusPath='research/native-layers-format-census.json';
const inputs=[auditPath,censusPath,'research/scripts/read-rp-objects.mjs','research/scripts/read-rp-container.mjs'].map(bound);
const audit=read(auditPath),census=read(censusPath),results=[];
const p=(o,key)=>{const xs=o?.properties?.$map?.filter(([k])=>k===key);assert.ok(xs&&xs.length<=1,'Invalid/duplicate '+key);return xs[0]?.[1]};
const refs=xs=>xs.map(x=>x.$reference);
for(const sample of audit.samples.filter(s=>s.addedEvents.length)){
 assert.equal(hash(sample.file),sample.sha256);inputs.push(bound(sample.file));
 const packages=inspectRpObjects(sample.file).packages;
 const index=new Map();
 const walk=(items,page)=>{for(const w of items){assert.ok(!index.has(w.id),'Duplicate final widget');index.set(w.id,{widget:w,page});if(w.layer)walk(w.layer.widgets,page);for(const s of w.states??[])walk(s.widgets,page);if(w.repeater)walk(w.repeater.template,page);if(w.table)walk(w.table.cells??[],page);}};
 for(const page of sample.document.pages)walk(page.widgets,page.id);
 for(const entry of sample.addedEvents){
  const pack=packages.find(x=>x.packageId===entry.packageId);assert.ok(pack);
  const objects=new Map(pack.objects.map(o=>[o.id,o])),used=new Set();
  const obj=(ref,type)=>{const id=typeof ref==='string'?ref:ref?.$reference,o=objects.get(id);assert.ok(o,'Missing '+id);if(type)assert.equal(o.type,type);used.add(id);return o};
  const owner=obj(entry.sourceId,'Axure:DiagramObject:Layer'),map=obj(p(owner,'InteractionMap'),'Axure:InteractionTreeMap');
  assert.equal(p(map,'PackageMode'),false);
  const bindings=new Map(p(map,'node-table').$map.map(([a,b])=>[a.$reference,b]));
  const tree=obj(p(map,'tree'),'Axure:Tree'),eventNodes=p(tree,'children');assert.equal(eventNodes.length,1);
  const eventNode=obj(eventNodes[0],'Axure:Node'),nativeEvent=obj(bindings.get(eventNode.id),'Axure:InteractionEvent');
  assert.equal(p(nativeEvent,'event-type'),16);assert.equal(p(nativeEvent,'Disabled'),false);
  const caseNodes=p(eventNode,'children');assert.equal(caseNodes.length,1);
  const caseNode=obj(caseNodes[0],'Axure:Node'),nativeCase=obj(bindings.get(caseNode.id),'Axure:InteractionCase');
  assert.equal(p(nativeCase,'Disabled'),false);assert.equal(p(nativeCase,'Condition').$reference,'0'.repeat(32));
  const actionNodes=p(caseNode,'children');assert.equal(actionNodes.length,1);
  const actionNode=obj(actionNodes[0],'Axure:Node'),nativeAction=obj(bindings.get(actionNode.id));
  assert.equal(p(nativeAction,'Disabled'),false);
  assert.equal(entry.event.event,'click');assert.equal(entry.event.enabled,true);assert.equal(entry.event.actions.length,1);
  assert.equal(entry.event.conditions.length,0);assert.equal(entry.event.isNewIfGroup,p(nativeCase,'IsNewIfGroup'));
  const imported=entry.event.actions[0];let target,state,value;
  const targetOf=ref=>{const path=obj(ref,'Axure:DiagramObjectPath');assert.deepEqual(p(path,'rdo-path'),[]);assert.deepEqual(p(path,'repeater-path'),[]);assert.equal(p(path,'is-dummy'),false);return p(path,'object-id').$reference};
  if(imported.type==='setSelected'){
   assert.equal(nativeAction.type,'Axure:InterationActionSetFunction');assert.equal(p(nativeAction,'SetFunction'),'SetCheckState');
   const block=obj(p(nativeAction,'action'),'Axure:Expr:Block'),calls=p(block,'subexpressions');assert.equal(calls.length,1);
   const call=obj(calls[0],'Axure:Expr:FCall');assert.equal(p(call,'function-name'),'SetCheckState');
   const args=p(call,'args');assert.equal(args.length,2);
   target=targetOf(p(obj(args[0],'Axure:Expr:DiagramObjectPathLiteral'),'value'));
   const literal=obj(args[1],'Axure:Expr:StringLiteral');value=p(literal,'value');assert.equal(value,'toggle');assert.equal(imported.value,value);
   assert.ok(refs(p(owner,'DiagramObjects')).includes(target),'Toggle target must be an actual direct member for these ten witnesses');
  }else{
   assert.equal(imported.type,'setState');assert.equal(nativeAction.type,'Axure:InteractionSetPanelStateAction');
   const paths=p(nativeAction,'PanelPaths'),infos=p(nativeAction,'SetStateInfos');assert.equal(paths.length,1);assert.equal(infos.length,1);
   assert.deepEqual(refs(paths),refs(p(nativeAction,'panelobjectpaths')));
   target=targetOf(paths[0]);const info=obj(infos[0],'Axure:SetPanelStateInfo');
   assert.equal(p(info,'set-state-type'),0);state=p(info,'diagram-id').$reference;assert.equal(imported.value,'rp-s-'+state);
   const panel=obj(target,'Axure:DiagramObject:DynamicPanel');assert.ok(refs(p(panel,'panel-diagrams')).includes(state));
  }
  assert.equal(imported.targetId,`rp-w-${entry.packageId}-${target}`);
  const source=index.get(entry.id),dest=index.get(imported.targetId);assert.ok(source&&dest);assert.equal(source.page,dest.page);
  assert.equal(source.widget.layer.propagate,p(owner,'Propagate'));
  if(state){assert.equal(dest.widget.type,'panel');assert.ok(dest.widget.states.some(s=>s.id===imported.value));}
  else assert.ok(['box','path','ellipse','text','image','button','input','checkbox','radio'].includes(dest.widget.type));
  const rawLayer=census.layers.find(x=>x.file===sample.file&&x.packageId===entry.packageId&&x.id===entry.sourceId);assert.ok(rawLayer);assert.equal(pack.sha256,rawLayer.packageSha256);
  results.push({file:sample.file,sourceSha256:sample.sha256,packageId:entry.packageId,packageSha256:pack.sha256,owner:entry.sourceId,propagate:p(owner,'Propagate'),event:entry.event,target,type:dest.widget.type,state,value,checks:{exactRawTarget:true,samePage:true,orderedSingleCase:true,propagatePreserved:true},raw: [...used].map(id=>objects.get(id)),passed:true});
 }
}
assert.equal(results.length,13);
const out='research/native-layers-runtime-import-events-review.json';assert.ok(!fs.existsSync(out),'Preserve '+out);
const report={capturedAt:new Date().toISOString(),kind:'Independent narrow raw-object graph walk for the 13 added Layer Click cases; no reuse of semantic interaction recovery or product importer, no DLL execution. Two original files decoded with the existing binary object parser. Propagate is verified as stored, not treated as a generic click/state action broadcast flag.',inputs,inputStable:inputs.every(x=>hash(x.path)===x.sha256),script:bound(import.meta.filename),totalsAtReview:audit.totals,summary:{total:results.length,passed:results.length,failed:0,setSelected:results.filter(x=>x.value==='toggle').length,setState:results.filter(x=>x.state).length},results};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary:report.summary,inputStable:report.inputStable,totals:report.totalsAtReview},null,2));
