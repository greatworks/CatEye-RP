// Research-only, SHA-pinned partial-function probes. No vendor app/module initialization.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = process.argv[2] ?? 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins = {
  'repeater.js':'d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b',
  'action.js':'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3',
  'doc.js':'986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1',
  'variables.js':'91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188',
  'sto.js':'c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6',
  'events.js':'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3',
  'expr.js':'530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6',
  'utils.temp.js':'ef33a9174ea5b4cdcd48229f896195d2f67941116aa7eeae6308a99e02b4832f',
  'visibility.js':'bbf8974eaa4ffa2b9800797725ada6805c47c532f47d9a5647dc205966ab8a53',
};
const source = new Map();
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = Object.entries(pins).map(([name, hash]) => {
  const sourcePath=path.join(root,name), bytes=fs.readFileSync(sourcePath);
  assert.equal(sha(bytes),hash,name); source.set(name,bytes.toString('utf8').split(/\r?\n/));
  return {name,path:sourcePath,bytes:bytes.length,sha256:hash};
});
const slice=(file,first,last)=>source.get(file).slice(first-1,last).join('\n');
const spans=[
 ['repeater.js',73,149,'refresh-start-old-count-new-bounds'],['repeater.js',225,245,'reset-sizes-before-row-creation'],
 ['repeater.js',329,375,'empty-sentinel-and-load-order'],['repeater.js',594,669,'count-functions-and-page-clamp'],
 ['repeater.js',1080,1134,'row-size-initialization-and-resize-event'],['repeater.js',1136,1289,'push-state-before-resize-event'],
 ['repeater.js',1291,1316,'column-read-and-has-data'],['repeater.js',1332,1340,'column-read-real-item-id'],['repeater.js',1483,1519,'source-id-without-item'],
 ['repeater.js',1590,1626,'content-fit-to-item-size'],['action.js',128,141,'refresh-action-guard'],
 ['action.js',351,368,'wait-continuation'],['action.js',1258,1271,'explicit-this-item-resize'],
 ['action.js',1745,1785,'mark-no-refresh-guard'],['action.js',1793,1839,'data-action-guard'],
 ['action.js',1936,1997,'paging-action-guard-refresh'],['doc.js',221,244,'template-target-resolution'],
 ['doc.js',291,299,'event-item-snapshot'],['doc.js',328,347,'invalid-item-info'],['doc.js',349,397,'this-repeater-properties'],
 ['events.js',1701,1716,'synthetic-event-entry'],['events.js',1833,1838,'load-wrapper'],['events.js',1921,2018,'template-child-load-traversal'],
 ['variables.js',33,85,'invalid-item-fallback'],['sto.js',90,161,'metadata-and-column-sto'],['sto.js',216,234,'typed-casts'],
 ['expr.js',204,244,'failed-expression-retains-literal'],['utils.temp.js',5,49,'event-copy'],['visibility.js',1392,1394,'size-storage-not-event'],
];
const excerpts=spans.map(([file,startLine,endLine,purpose])=>({file,startLine,endLine,purpose,text:slice(file,startLine,endLine)}));
const makeContext=code=>{const c=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});vm.runInContext(code,c,{timeout:1000});return c;};
const result=(c,code)=>JSON.parse(vm.runInContext(`JSON.stringify((function(){${code}})())`,c,{timeout:1000}));
const outcomes=[];
const record=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);outcomes.push({name,pass:true,actual});};
const base=`
 var _repeaterManager={}, repeaterToActiveDataSet={r:[]},repeaterToCurrentDataSet={r:[]},repeaterToPageInfo={r:{noLimit:true}},repeaterInfoCache={};
 var _globalVariableProvider={},_globalVariableValues={},_exprHandlers={},funcs={},trace=[],eventNesting=0;
 var _getParentElement=id=>id,_getWidgetInfo=id=>({valid:true,elementId:id}),$jobj=id=>({length:id==='r'?1:0});
 var $ax={repeater:_repeaterManager,document:{globalVariables:{}},globalVariableProvider:_globalVariableProvider,expr:{},
   getParentRepeaterFromScriptId:id=>id?'r':undefined, getScriptIdFromPath:p=>p.at(-1),
   constants:{PAGE_TYPE:'page',REFERENCE_DIAGRAM_OBJECT_TYPE:'master',DYNAMIC_PANEL_TYPE:'panel',ALL_TYPE:'all',REPEATER:'repeater',LAYER_TYPE:'layer'},
   public:{fn:{IsReferenceDiagramObject:t=>t==='master',IsDynamicPanel:t=>t==='panel',IsRepeater:t=>t==='repeater',IsLayer:t=>t==='layer',IsTable:()=>false,IsMenuObject:()=>false,IsTreeNodeObject:()=>false}},
   messageCenter:{getState:()=>false,setState:()=>{}},event:{raiseSyntheticEvent:(id,event)=>trace.push({id,event})}};
 $ax.expr.displayWidgetAndParents=()=>()=>{};
 _repeaterManager.isEditItem=()=>false;
`;
const common=[slice('repeater.js',594,669),slice('repeater.js',1483,1490),slice('repeater.js',1503,1519),slice('doc.js',328,347),slice('variables.js',33,85)].join('\n');
const lifecycle=makeContext(base+common+slice('events.js',1921,2018)+slice('events.js',1833,1838));
const cases=[
 ['initial-empty',0,0,null,1,0],['unlimited-delete-all',3,0,null,1,1],['unlimited-filter-all',3,0,null,1,1],
 ['already-empty-refresh',0,0,null,1,0],['empty-to-nonempty',0,2,null,1,2],
 ['paged-first-has-next-page-delete-all',3,0,2,1,1],['paged-single-page-delete-all',2,0,2,1,0],
 ['paged-last-page-delete-all',5,0,2,3,0],['paged-middle-delete-all',5,0,2,2,1],
 ['paged-nonzero-shrink-no-extra',3,2,2,1,2],['page-past-end-clamps-to-real-rows',3,3,2,99,1],
];
for(const [name,oldLength,newLength,limit,page,eventCount] of cases){
 const actual=result(lifecycle,`
 trace=[];repeaterToActiveDataSet.r=Array.from({length:${oldLength}},(_,i)=>({index:i+1}));
 repeaterToPageInfo.r=${JSON.stringify(limit===null?{noLimit:true}:{noLimit:false,itemsPerPage:limit,currPage:page})};
 var repeaterId='r',previousItemCount=_repeaterManager.getItemCount('r');
 repeaterToActiveDataSet.r=Array.from({length:${newLength}},(_,i)=>({index:i+1}));
 var orderedIds=Array.from({length:${newLength}},(_,i)=>i+1), bounds=_getVisibleDataBounds(repeaterToPageInfo.r,orderedIds.length),start=bounds[0],end=bounds[1];
 var preevalMap={},obj={objects:[{id:'child',type:'text'}]},path=[],pos,itemId,itemElementId;
 ${slice('repeater.js',332,357)}
 return {previousItemCount,currentItemCount,trace,page:repeaterToPageInfo.r.currPage??1};
 `);
 assert.equal(actual.trace.filter(x=>x.event==='onItemLoad').length,eventCount,name);
 for(let i=0;i<actual.trace.length;i+=3) assert.deepEqual(actual.trace.slice(i,i+3).map(x=>x.event),['onBeforeItemLoad','onItemLoad','onLoad']);
 if(newLength===0&&eventCount) assert.deepEqual(actual.trace.map(x=>x.id),['r','r','child']);
 outcomes.push({name,pass:true,actual});
}
const expressions=makeContext([base,common,slice('repeater.js',1291,1316),slice('repeater.js',1332,1340),slice('sto.js',90,161),slice('sto.js',216,234),slice('expr.js',204,244)].join('\n'));
record('empty-source-item-has-only-valid-false',result(expressions,`return $ax.getItemInfo('r');`),{valid:false});
record('empty-source-no-target-item-providers-undefined',result(expressions,`var e={srcElement:'r',item:$ax.getItemInfo('r')};return {item:getVariableValue('Item',e)===undefined,target:getVariableValue('TargetItem',e)===undefined};`),{item:true,target:true});
record('empty-property-string-interpolation-preserves-literal-without-target',result(expressions,`
 var e={srcElement:'r',item:$ax.getItemInfo('r')};
 return ['valid','index','isfirst','islast','iseven','isodd','ismarked','repeater'].map(prop=>{
   var s={sto:'propCall',thisSTO:{sto:'var',name:'Item'},prop};
   return _substituteSTOs({value:'[[Item.'+prop+']]',localVariables:{},stos:[s]},e);
 });
`),['valid','index','isfirst','islast','iseven','isodd','ismarked','repeater'].map(p=>`[[Item.${p}]]`));
record('nonrow-target-invalid-metadata-casts-depend-on-sto-type',result(expressions,`
 var e={srcElement:'r',item:$ax.getItemInfo('r'),targetElement:'outside'};
 return ['string','bool','int'].map(type=>_substituteSTOs({value:'[[Item.index]]',localVariables:{},stos:[{sto:'propCall',thisSTO:{sto:'var',name:'Item'},prop:'index',computedType:type}]},e));
`),['undefined','false','NaN']);
record('empty-source-column-interpolation-retains-literal',result(expressions,`
 var e={srcElement:'r',item:$ax.getItemInfo('r')};
 return [false,true].map(isTarget=>_substituteSTOs({value:'[['+(isTarget?'TargetItem':'Item')+'.Name]]',localVariables:{},stos:[{sto:'item',name:'Name',isTarget}]},e));
`),['[[Item.Name]]','[[TargetItem.Name]]']);
record('empty-repeater-count-providers-unlimited-versus-paged',result(expressions,`
 function counts(){return {data:_repeaterManager.getDataCount('r'),filtered:_repeaterManager.getFilteredDataCount('r'),visible:_repeaterManager.getVisibleDataCount('r'),pages:_repeaterManager.getPageCount('r'),page:_repeaterManager.getPageIndex('r')};}
 var unlimited=counts();repeaterToPageInfo.r={noLimit:false,itemsPerPage:2,currPage:1};var paged=counts();
 repeaterToCurrentDataSet.r=[{}, {}, {}];var filtered=counts();return {unlimited,paged,filtered};
`),{unlimited:{data:0,filtered:0,visible:0,pages:1,page:1},paged:{data:0,filtered:0,visible:0,pages:0,page:1},filtered:{data:3,filtered:0,visible:0,pages:0,page:1}});
// This is the exact original size implementation; CSS and parent fit are explicit mocks.
const sizes=makeContext(`
 var _repeaterManager={},repeaterSizes={},trace=[];
 var css={r:{width:100,height:40},'r-1':{width:100,height:20,left:0,top:0},'r-2':{width:100,height:20,left:0,top:20}};
 var $jobj=id=>({css:function(k,v){if(v===undefined)return css[id][k]??0;css[id][k]=v;},attr:()=>id});
 var $ax={repeater:_repeaterManager,getNumFromPx:Number,visibility:{setResizedSize:()=>{},setMovedLocation:()=>{}},dynamicPanelManager:{fitParentPanel:id=>trace.push({kind:'parent-fit',id})},event:{raiseSyntheticEvent:(id,event)=>trace.push({kind:'event',id,event,css:JSON.parse(JSON.stringify(css)),size:JSON.parse(JSON.stringify(repeaterSizes.r.sizesMap[1]))})}};
 ${slice('repeater.js',1483,1490)}
 ${slice('repeater.js',1080,1289)}
 resetItemSizes('r',{width:100,height:20},[0,2],[1,2],true,-1);
`);
record('item-resize-zero-delta-does-not-fire',result(sizes,`return {changed:_repeaterManager.setItemSize('r',1,100,20),trace};`),{changed:false,trace:[]});
const resized=result(sizes,`var changed=_repeaterManager.setItemSize('r',1,120,30);return {changed,trace};`);
assert.equal(resized.changed,true);assert.equal(resized.trace.filter(x=>x.kind==='event').length,1);
const resizeEvent=resized.trace.find(x=>x.kind==='event');
assert.deepEqual(resizeEvent.size,{itemId:1,width:120,height:30});assert.equal(resizeEvent.css['r-2'].top,30);assert.equal(resizeEvent.css.r.height,50);
outcomes.push({name:'item-resize-fires-once-after-both-axes-and-sibling-layout',pass:true,actual:resized});
record('empty-size-map-has-no-resizable-sentinel-item',result(sizes,`resetItemSizes('r',{width:100,height:20},[0,0],[],true,-1);try{_repeaterManager.setItemSize('r',undefined,10,10);return {threw:false};}catch(e){return {threw:true};}`),{threw:true});
const waits=makeContext(`
 var callbacks=[],calls=[],_action={},_actionHandlers={};
 var window={setTimeout:(fn,ms)=>callbacks.push({fn,ms})};
 var $ax={action:_action,eventCopy:e=>JSON.parse(JSON.stringify(e)),getElementIdsFromPath:p=>[p],deepCopy:x=>JSON.parse(JSON.stringify(x)),repeater:{addItem:(id,row,e)=>calls.push({id,row,item:e.item})}};
 _action.flushAllResizeMoveActions=()=>{};
 ${slice('action.js',128,141)}
 ${slice('action.js',351,368)}
 ${slice('action.js',1793,1808)}
`);
record('empty-event-synchronous-add-blocked-but-wait-tail-runs-after-refresh',result(waits,`
 var e={srcElement:'r',item:{valid:false}},add={action:'addItemsToDataSet',dataSetsToAddTo:[{path:'r',data:[{Name:'new'}]}]};
 _action.refreshStart('r');_dispatchAction(e,[add],0);var blocked=calls.length===0;
 _dispatchAction(e,[{action:'wait',waitTime:0},add],0);var scheduled=callbacks.length===1&&calls.length===0;
 _action.refreshEnd();callbacks.shift().fn();return {blocked,scheduled,calls,refreshes:_repeatersToRefresh};
`),{blocked:true,scheduled:true,calls:[{id:'r',row:{Name:'new'},item:{valid:false}}],refreshes:['r']});
const evidence={version:1,target:'Axure RP 11.0.0.4150',method:'Static inspection and SHA-pinned exact excerpts/functions executed in isolated VM with explicit mocks; not full application/browser execution',files,excerpts,probe:{count:outcomes.length,outcomes,limitations:['Lifecycle probe executes actual count/bounds/load-loop/child-traversal sections, not the full DOM refresh function.','Size probe uses original size functions with mocked CSS and parent fitting.','Generated STO metadata is synthesized explicitly; arbitrary original expression compilation and rich text are not covered.','Wait probe replaces scheduler with a manually released callback and eventCopy with JSON-safe copy.']}};
const output=JSON.stringify(evidence,null,2)+'\n';fs.writeFileSync(new URL('./repeater-empty-evidence.json',import.meta.url),output);
console.log(JSON.stringify({pass:true,probes:outcomes.length,files:files.length,excerpts:excerpts.length,sha256:sha(output)}));
