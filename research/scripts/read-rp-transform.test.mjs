import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectRpObjects} from './read-rp-objects.mjs';
const {recoverInteractionMap}=await import(process.env.TRANSFORM_READER_BASELINE==='1'?'../../.build/before-runtime-transform/research/scripts/read-rp-interactions.mjs':'./read-rp-interactions.mjs');
const ZERO='0'.repeat(32), ref=(id,referenceTag=3)=>({$reference:id,referenceTag});
const p=(o,k)=>o.properties.$map.find(([n])=>n===k)?.[1];
const set=(o,k,v)=>{const pair=o.properties.$map.find(([n])=>n===k);if(pair)pair[1]=v;else o.properties.$map.push([k,v]);};
// Explicitly synthetic native object graph. Fields come from the frozen CIL/
// source census, not a semantic-report imitation. No original file is changed.
function fixture(kind='move'){
 let counter=1;const objects=new Map(),add=(type,properties={})=>{const o={id:(counter++).toString(16).padStart(32,'0'),type,properties:{$map:Object.entries(properties)}};objects.set(o.id,o);return o;};
 const owner=add('Axure:DiagramObject:VectorShape'),other=add('Axure:DiagramObject:DynamicPanel');
 const path=(id)=>add('Axure:DiagramObjectPath',{'rdo-path':[],'repeater-path':[],'object-id':ref(id,22),'is-dummy':false});
 const literal=(text,bindings={},direction)=>{
  const o=add(direction===undefined?'Axure:Expr:StringLiteral':'Axure:Expr:BoundaryDirectionLiteral',{value:text,'variable-identifiers':[],'repeater-scope':ref(ZERO),TargetRepeaterScope:ref(ZERO),...(direction===undefined?{}:{boundaryDirection:direction})});
  const entries=Object.entries(bindings).map(([name,id])=>{const d=path(id),l=add('Axure:Expr:DiagramObjectPathLiteral',{value:ref(d.id)}),f=add('Axure:Expr:FCall',{'function-name':'GetWidget',args:[ref(l.id)]});return[name,ref(f.id)];});
  if(entries.length)set(o,'scope',{$map:entries});
  for(const m of text.matchAll(/\b(This|Target|Window|DragX|DragY)\b/gi)){const i=add('Axure:Expr:TextVariableIdentifier',{Id:{$guid:(counter+1000).toString(16).padStart(32,'0')},Name:m[0],Expr:ref(o.id),TargetOverride:false});p(o,'variable-identifiers').push(ref(i.id));}
  return o;
 };
 const x=literal('[[Track.left - Target.width]]',{Track:other.id}),y=literal(' 0 '),targetPath=path(ZERO);
 const info=kind==='move'?add('Axure:MoveWidgetInfo',{Duration:500,Easing:0,XValue:ref(x.id),YValue:ref(y.id),MoveType:1,MoveTrajectory:0,BoundaryCondition:ref(ZERO),scope:{$map:[]}}):add('Axure:SetWidgetSizeInfo',{width:ref(x.id),height:ref(y.id),anchor:'top left',easing:0,duration:500});
 const action=add(kind==='move'?'Axure:InteractionMoveWidgetAction':'Axure:InteractionSetWidgetSizeAction',{Disabled:false,panelobjectpaths:[ref(targetPath.id)],WidgetPaths:[ref(targetPath.id)],[kind==='move'?'MoveInfos':'SetSizeInfos']:[ref(info.id)]});
 const event=add('Axure:InteractionEvent',{Disabled:false,'event-type':16,'master-containing-raised-event':ref(ZERO,16),'raised-event-id':{$guid:ZERO},'variable-id':{$guid:ZERO}});
 const caseObject=add('Axure:InteractionCase',{Disabled:false,Description:'SYNTHETIC ordered transform',Condition:ref(ZERO),IsNewIfGroup:true});
 const tree=add('Axure:Tree'),en=add('Axure:Node'),cn=add('Axure:Node'),an=add('Axure:Node');
 for(const [o,parent,children]of [[en,tree.id,[cn]],[cn,en.id,[an]],[an,cn.id,[]]])o.properties.$map=Object.entries({'parent-node':ref(parent),tree:ref(tree.id),children:children.map(o=>ref(o.id))});
 tree.properties.$map=Object.entries({tree:ref(tree.id),children:[ref(en.id)]});
 const map=add('Axure:InteractionTreeMap',{'node-table':{$map:[[ref(en.id),ref(event.id)],[ref(cn.id),ref(caseObject.id)],[ref(an.id),ref(action.id)]]},tree:ref(tree.id),PackageMode:false});set(owner,'InteractionMap',ref(map.id));
 const compare=(direction,operator,left,right)=>add('Axure:Expr:BinaryExpr',{operation:operator,'left-expr':ref(literal(left,{},direction).id),'right-expr':ref(literal(right,{track:other.id}).id)});
 return{owner,other,objects,packageId:'f'.repeat(32),add,path,literal,compare,info,action,event,map,tree,cn,x,y,targetPath};
}
const decode=f=>recoverInteractionMap(f).events[0];
const recovered=f=>{const e=decode(f);assert.equal(e.status,'supported-event',e.reason);return e.cases[0].actions[0];};
const motion=f=>({text:'[[Track.left - Target.width]]',bindings:{track:{kind:'widget',targetSourceId:f.other.id}}});
test('synthetic Move retains exact text, canonical binding, This and one ordered action',()=>{const f=fixture(),before=JSON.stringify([...f.objects]);assert.deepEqual(recovered(f),{sourceId:f.action.id,type:'move',move:{targets:[{target:{kind:'this'},mode:'delta',x:motion(f),y:{text:' 0 '},trajectory:'straight',easing:'none',duration:500}]}});assert.equal(JSON.stringify([...f.objects]),before);});
test('synthetic Set Size uses independent width/height scope and exact anchor',()=>{const f=fixture('resize');set(f.info,'height',ref(f.literal('[[Window.height-Target.y]]').id));assert.deepEqual(recovered(f),{sourceId:f.action.id,type:'resize',resize:{targets:[{target:{kind:'this'},width:motion(f),height:{text:'[[Window.height-Target.y]]'},anchor:'top left',easing:'none',duration:500}]}});});
test('synthetic numeric input keeps original signed exponent text and typed scalar toFixed grammar',()=>{const f=fixture();set(f.info,'XValue',ref(f.literal(' +2.5e1 ').id));set(f.info,'YValue',ref(f.literal('[[ ((This.x-Track.left)/Target.width).toFixed(0) ]]',{Track:f.other.id}).id));const a=recovered(f).move.targets[0];assert.equal(a.x.text,' +2.5e1 ');assert.deepEqual(a.y,{text:'[[ ((This.x-Track.left)/Target.width).toFixed(0) ]]',bindings:{track:{kind:'widget',targetSourceId:f.other.id}}});});
for(const[name,mutate]of Object.entries({'unknown anchor':f=>set(f.info,'anchor','automatic'),'extra Size mode':f=>set(f.info,'mode','by'),'duplicate width':f=>f.info.properties.$map.push(['width',p(f.info,'width')]),'wrong duration type':f=>set(f.info,'duration','500'),'unknown Size easing':f=>set(f.info,'easing',33)}))test('synthetic strict Set Size rejection: '+name,()=>{const f=fixture('resize');mutate(f);assert.equal(decode(f).status,'unsupported-event');});
test('target order and duplicate identities remain inside a single native action',()=>{const f=fixture();const other=f.path(f.other.id);set(f.action,'WidgetPaths',[ref(other.id),ref(f.targetPath.id),ref(other.id)]);set(f.action,'panelobjectpaths',p(f.action,'WidgetPaths'));set(f.action,'MoveInfos',[ref(f.info.id),ref(f.info.id),ref(f.info.id)]);assert.deepEqual(recovered(f).move.targets.map(x=>x.target),[{kind:'widget',sourceId:f.other.id},{kind:'this'},{kind:'widget',sourceId:f.other.id}]);});
test('all9 source Move modes and all3 trajectories retain their numeric enum identity',()=>{const modes=['location','delta','drag','dragX','dragY','locationBeforeDrag','withThis','sizeDeltaX','sizeDeltaY'];for(let i=0;i<modes.length;i++)for(let t=0;t<3;t++){const f=fixture();set(f.info,'MoveType',i);set(f.info,'MoveTrajectory',t);set(f.info,'Easing',1);const a=recovered(f).move.targets[0];assert.equal(a.mode,modes[i]);assert.equal(a.trajectory,['straight','arcClockwise','arcAntiClockwise'][t]);}});
test('boundary preserves mixed AND/OR tree, direction and all four comparison operators',()=>{const f=fixture(),leaves=[f.compare('left',5,'[[Target.left + DragX]]','[[track.left]]'),f.compare('right',6,'[[Target.right + DragX]]','[[track.right]]'),f.compare('top',7,'[[Target.top]]','0'),f.compare('bottom',8,'[[Target.bottom]]','100')],join=(op,l,r)=>f.add('Axure:Expr:BinaryExpr',{operation:op,'left-expr':ref(l.id),'right-expr':ref(r.id)});set(f.info,'BoundaryCondition',ref(join(1,join(2,leaves[0],leaves[1]),join(1,leaves[2],leaves[3])).id));const b=recovered(f).move.targets[0].boundary;assert.equal(b.kind,'and');assert.equal(b.left.kind,'or');assert.deepEqual([b.left.left,b.left.right,b.right.left,b.right.right].map(x=>[x.operator,x.direction]),[['>','left'],['<','right'],['>=','top'],['<=','bottom']]);assert.deepEqual(b.left.left.right,{text:'[[track.left]]',bindings:{track:{kind:'widget',targetSourceId:f.other.id}}});});
test('strict top>0 is retained as conditional boundary, not flattened into unconditional clamp',()=>{const f=fixture();set(f.info,'BoundaryCondition',ref(f.compare('top',5,'[[This.y - (This.y - Target.y)]]','0').id));assert.deepEqual(recovered(f).move.targets[0].boundary,{kind:'compare',operator:'>',direction:'top',left:{text:'[[This.y - (This.y - Target.y)]]'},right:{text:'0',bindings:{track:{kind:'widget',targetSourceId:f.other.id}}}});});
test('Move and Size with Rotate remain distinct in one ordered case (synthetic only)',()=>{const f=fixture(),size=f.add('Axure:InteractionSetWidgetSizeAction',{Disabled:false,panelobjectpaths:[ref(f.targetPath.id)],WidgetPaths:[ref(f.targetPath.id)],SetSizeInfos:[ref(f.add('Axure:SetWidgetSizeInfo',{width:ref(f.y.id),height:ref(f.y.id),anchor:'center',easing:0,duration:500}).id)]}),rotate=f.add('Axure:InteractionRotateWidgetAction',{Disabled:false,panelobjectpaths:[ref(f.targetPath.id)],Paths:[ref(f.targetPath.id)],Infos:[ref(f.add('Axure:RotateWidgetInfo',{Clockwise:true,Duration:500,Degree:ref(f.y.id),RotateType:1,Easing:0,OffsetX:ref(f.y.id),OffsetY:ref(f.y.id),Anchor:'center'}).id)]});for(const a of[size,rotate]){const n=f.add('Axure:Node',{'parent-node':ref(f.cn.id),tree:ref(f.tree.id),children:[]});p(f.cn,'children').push(ref(n.id));p(f.map,'node-table').$map.push([ref(n.id),ref(a.id)]);}const e=decode(f);assert.equal(e.status,'supported-event',e.reason);assert.deepEqual(e.cases[0].actions.map(a=>a.type),['move','resize','rotate']);});
const mutations={
 'unknown info':f=>set(f.info,'Extra',1),'wrong info type':f=>f.info.type='Axure:MoveInfo',
 'mode string':f=>set(f.info,'MoveType','1'),'mode outside enum':f=>set(f.info,'MoveType',9),'trajectory outside enum':f=>set(f.info,'MoveTrajectory',3),
 'negative duration':f=>set(f.info,'Duration',-1),'large duration':f=>set(f.info,'Duration',60001),'string duration':f=>set(f.info,'Duration','500'),'easing outside enum':f=>set(f.info,'Easing',33),
 'nonempty MoveInfo scope':f=>set(f.info,'scope',{$map:[['x',ref(f.x.id)]]}),'missing MoveInfo scope':f=>f.info.properties.$map=f.info.properties.$map.filter(([k])=>k!=='scope'),
 'legacy path mismatch':f=>set(f.action,'panelobjectpaths',[]),'missing info':f=>set(f.action,'MoveInfos',[]),'disabled action':f=>set(f.action,'Disabled',true),
 'unresolved target':f=>set(f.targetPath,'object-id',ref('e'.repeat(32),22)),'compound target':f=>set(f.targetPath,'rdo-path',[ref(f.owner.id)]),'dummy target':f=>set(f.targetPath,'is-dummy',true),
 'nonliteral expression':f=>f.x.type='Axure:Expr:NumericLiteral','unknown literal field':f=>set(f.x,'Other',true),'unknown syntax':f=>set(f.x,'value','[[eval(1)]]'),'unbound name':f=>set(f.x,'value','[[missing.x]]'),
 'property escape':f=>set(f.x,'value','[[Track.constructor]]'),'nonzero literal scope':f=>set(f.x,'repeater-scope',ref(f.other.id)),
 'scope duplicate casing':f=>p(f.x,'scope').$map.push(['track',p(f.x,'scope').$map[0][1]]),'reserved alias':f=>p(f.x,'scope').$map[0][0]='Target',
 'wrong binding call':f=>set(f.objects.get(p(f.x,'scope').$map[0][1].$reference),'function-name','GetWidgetText'),
 'identifier wrong backref':f=>set(f.objects.get(p(f.x,'variable-identifiers')[0].$reference),'Expr',ref(f.y.id)),
 'identifier TargetOverride':f=>set(f.objects.get(p(f.x,'variable-identifiers')[0].$reference),'TargetOverride',true),
 'missing variable identity':f=>set(f.x,'variable-identifiers',[]),
 'unknown boundary operator':f=>set(f.info,'BoundaryCondition',ref(f.compare('left',3,'[[Target.left]]','0').id)),
 'unknown boundary direction':f=>set(f.info,'BoundaryCondition',ref(f.compare('center',5,'[[Target.left]]','0').id)),
 'cyclic boundary':f=>{const b=f.compare('left',5,'[[Target.left]]','0');set(b,'operation',1);set(b,'left-expr',ref(b.id));set(f.info,'BoundaryCondition',ref(b.id));},
 'unsupported event':f=>set(f.event,'event-type',273),
 'page This':f=>{f.owner.type='Axure:Page';set(f.owner,'interactionmap',p(f.owner,'InteractionMap'));},
 'hyperlink This':f=>f.owner.type='Axure:DiagramObject:Hyperlink',
 'unknown sibling':f=>{const a=f.add('Axure:InteractionUnknownAction',{Disabled:false}),n=f.add('Axure:Node',{'parent-node':ref(f.cn.id),tree:ref(f.tree.id),children:[]});p(f.cn,'children').push(ref(n.id));p(f.map,'node-table').$map.push([ref(n.id),ref(a.id)]);}
};
for(const[name,mutate]of Object.entries(mutations))test('synthetic strict whole-event rejection: '+name,()=>{const f=fixture();mutate(f);const e=decode(f);assert.equal(e.status,'unsupported-event');assert.equal(e.cases,undefined);});
test('actual source corpus reader admits only complete known events; all6 mixed cases retain original rejection',()=>{
 const census=JSON.parse(fs.readFileSync(new URL('../runtime-transform-bindings-case-census.json',import.meta.url))),byFile=Map.groupBy(census.cases,c=>c.file);let newlySupported=0;
 for(const[file,cases]of byFile){const d=inspectRpObjects(file);assert.equal(d.fileSha256,cases[0].sha256);for(const c of cases){const pack=d.packages.find(p=>p.packageId===c.packageId),objects=new Map(pack.objects.map(o=>[o.id,o]));for(const owner of c.owners){const e=recoverInteractionMap({owner:objects.get(owner.id),objects,packageId:c.packageId}).events.find(e=>e.id===c.eventId);if(e.status==='supported-event'){newlySupported++;assert.ok([16].includes(c.nativeEventType));assert.ok(e.cases.some(c=>c.actions.some(a=>a.type==='move')));}if(c.mixedMoveSize)assert.equal(e.status,'unsupported-event');}}}
 assert.equal(newlySupported,10);
});
test('all55 actual Move/Size carriers and12 boundaries decode in explicitly synthetic Click isolation, without altering source bytes',()=>{
 const census=JSON.parse(fs.readFileSync(new URL('../runtime-transform-bindings-case-census.json',import.meta.url))),groups=Map.groupBy(census.cases,c=>c.file);let actions=0,targets=0,boundaries=0;
 const visited=new Set(),modes=['location','delta','drag','dragX','dragY','locationBeforeDrag','withThis','sizeDeltaX','sizeDeltaY'];
 for(const[file,cases]of groups){const d=inspectRpObjects(file);assert.equal(d.fileSha256,cases[0].sha256);for(const c of cases)for(const source of c.orderedActions){if(!source.infos||visited.has(c.packageId+source.sourceId))continue;visited.add(c.packageId+source.sourceId);
  const pack=d.packages.find(p=>p.packageId===c.packageId),f=fixture(),originals=new Map(pack.objects.map(o=>[o.id,structuredClone(o)]));
  const actualOwner=originals.get(c.owners[0].id),ownerMap=p(f.owner,'InteractionMap');for(const[id,o]of f.objects){assert.ok(!originals.has(id),'synthetic IDs must not collide');originals.set(id,o);}f.objects=originals;f.owner=actualOwner;f.packageId=c.packageId;set(f.owner,f.owner.type.startsWith('Axure:DiagramObject:')?'InteractionMap':'interactionmap',ownerMap);p(f.map,'node-table').$map[2][1]=ref(source.sourceId);
  const result=recovered(f),move=source.type==='Axure:InteractionMoveWidgetAction',out=result[move?'move':'resize'].targets;assert.equal(result.sourceId,source.sourceId);assert.equal(out.length,source.infos.length);actions++;
  source.infos.forEach((native,i)=>{targets++;assert.deepEqual(out[i].target,native.target.thisTarget?{kind:'this'}:{kind:'widget',sourceId:native.target.objectId});for(const key of move?['XValue','YValue']:['width','height']){const e=native.expressions[key],resultKey=key==='XValue'?'x':key==='YValue'?'y':key;assert.deepEqual(out[i][resultKey],{text:e.text,...(e.bindings.length?{bindings:Object.fromEntries(e.bindings.map(b=>[b.name.toLowerCase(),{kind:'widget',targetSourceId:b.value.args[0].path.objectId}]))}:{})});}if(move){assert.equal(out[i].mode,modes[native.mode]);if(native.boundary){boundaries++;assert.ok(out[i].boundary);const leaves=b=>b.kind==='compare'?[b]:[...leaves(b.left),...leaves(b.right)];assert.deepEqual(leaves(out[i].boundary).map(x=>x.operator),native.boundary.operation===1?['>=','<=']:['>']);}}});
 }}
 assert.deepEqual({actions,targets,boundaries},{actions:55,targets:63,boundaries:12});
});
