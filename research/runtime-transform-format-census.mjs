import fs from 'node:fs';
import {inspectRpObjects} from './scripts/read-rp-objects.mjs';
import {readJson,sha256} from './gradient-angle-static-flow.mjs';
const get=(v,k)=>v?.$map?.find(([key])=>key===k)?.[1];
const refs=(v,out=[])=>{if(v&&typeof v==='object'){if(v.$reference)out.push(v.$reference);else if(Array.isArray(v))v.forEach(x=>refs(x,out));else Object.values(v).forEach(x=>refs(x,out));}return out;};
const names=new Set(['Axure:InteractionMoveWidgetAction','Axure:InteractionSetWidgetSizeAction','Axure:InteractionRotateWidgetAction']);
const samples=[],actions=[];
for(const sample of readJson('research/runtime-rotate-format-census.json').samples){
 const decoded=inspectRpObjects(sample.file);if(decoded.fileSha256!==sample.sha256)throw Error('Original sample changed');
 const counts={move:0,size:0,rotate:0};let objects=0,packages=0;
 for(const p of decoded.packages){if(!p.objects)continue;objects+=p.objects.length;packages++;
  const byId=new Map(p.objects.map(o=>[o.id,o])),reverse=new Map();
  for(const o of p.objects)for(const id of refs(o.properties)){const a=reverse.get(id)??[];a.push(o.id);reverse.set(id,a);}
  for(const action of p.objects.filter(o=>names.has(o.type))){
   const kind=action.type.includes('SetWidgetSize')?'size':action.type.includes('MoveWidget')?'move':'rotate';counts[kind]++;
   const graph=[],pending=[action.id],seen=new Set(pending);let depth=0;
   while(pending.length&&depth++<7){const batch=pending.splice(0);for(const id of batch)for(const parent of reverse.get(id)??[]){if(seen.has(parent))continue;seen.add(parent);const o=byId.get(parent);graph.push({depth,object:o});if(!o.type.startsWith('Axure:DiagramObject:')&&!/Page$/.test(o.type))pending.push(parent);}}
   const infos=(get(action.properties,kind==='move'?'MoveInfos':kind==='size'?'SetSizeInfos':'Infos')??[]).map(r=>byId.get(r.$reference)),paths=(get(action.properties,kind==='rotate'?'Paths':'WidgetPaths')??[]).map(r=>byId.get(r.$reference));
   const closure=[],todo=infos.flatMap(i=>refs(i?.properties)),visited=new Set();
   while(todo.length&&visited.size<200){const id=todo.shift();if(visited.has(id)||!byId.has(id))continue;visited.add(id);const o=byId.get(id);closure.push(o);if(!o.type.startsWith('Axure:DiagramObject:'))todo.push(...refs(o.properties));}
   const cases=[];for(const entry of graph.filter(g=>g.object.type==='Axure:InteractionTreeMap')){const mp=entry.object.properties,bind=new Map((get(mp,'node-table')?.$map??[]).map(([n,m])=>[n.$reference,byId.get(m.$reference)]));const nodeEntry=[...bind].find(([,member])=>member?.id===action.id);if(!nodeEntry)continue;const actionNode=byId.get(nodeEntry[0]),caseNode=byId.get(get(actionNode.properties,'parent-node').$reference),eventNode=byId.get(get(caseNode.properties,'parent-node').$reference);cases.push({id:bind.get(caseNode.id)?.id,properties:bind.get(caseNode.id)?.properties,event:bind.get(eventNode.id),orderedActions:(get(caseNode.properties,'children')??[]).map(r=>bind.get(r.$reference)).map(o=>({id:o.id,type:o.type}))});}
   const owners=graph.filter(g=>g.object.type.startsWith('Axure:DiagramObject:')||g.object.type==='Axure:Page').map(g=>({id:g.object.id,type:g.object.type,name:get(g.object.properties,'Name')??get(g.object.properties,'name')}));
   const root=byId.get(p.rootId);
   actions.push({file:sample.file,sha256:sample.sha256,packagePath:p.path,packageId:p.packageId,sourcePartSha256:p.sha256,version:p.version,packageRoot:root&&{id:root.id,type:root.type,name:get(root.properties,'Name')??get(root.properties,'name')},kind,action,infos,paths,closure,cases,owners,ancestors:graph.filter(g=>!owners.some(o=>o.id===g.object.id))});
  }
 }
 samples.push({file:sample.file,sha256:sample.sha256,objects,packages,counts});
}
const countValues=values=>Object.fromEntries([...new Set(values)].map(v=>[String(v),values.filter(x=>x===v).length]));
const stats={};for(const kind of ['move','size','rotate']){const rows=actions.filter(a=>a.kind===kind),infos=rows.flatMap(a=>a.infos);stats[kind]={actions:rows.length,infos:infos.length,fieldSets:countValues(infos.map(i=>i.properties.$map.map(([k])=>k).sort().join(','))),modes:countValues(infos.map(i=>get(i.properties,'MoveType')??get(i.properties,'RotateType')).filter(v=>v!==undefined)),easings:countValues(infos.map(i=>get(i.properties,kind==='size'?'easing':'Easing'))),durations:countValues(infos.map(i=>get(i.properties,kind==='size'?'duration':'Duration'))),trajectory:countValues(infos.map(i=>get(i.properties,'MoveTrajectory')).filter(v=>v!==undefined)),anchors:countValues(infos.map(i=>get(i.properties,kind==='size'?'anchor':'Anchor')).filter(v=>v!==undefined)),targetCounts:countValues(rows.map(a=>a.infos.length))};}
const report={method:'Read-only real RP object graph census; native serialized objects and ordered same-case siblings retained. No target DLL/GUI execution or import claim.',sources:['research/scripts/read-rp-objects.mjs','research/runtime-rotate-format-census.json'].map(file=>({file,sha256:sha256(file)})),samples,totals:{samples:samples.length,objects:samples.reduce((n,s)=>n+s.objects,0),...stats},actions};fs.writeFileSync('research/runtime-transform-format-census.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.totals));
