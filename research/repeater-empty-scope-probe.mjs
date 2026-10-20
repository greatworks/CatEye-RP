// Research only: native SHA-pinned excerpts, no vendor module/application initialization.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const previous=JSON.parse(fs.readFileSync(new URL('./repeater-empty-evidence.json',import.meta.url),'utf8'));
const root=process.argv[2]??path.dirname(previous.files[0].path);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const names=['doc.js','repeater.js','variables.js','events.js','expr.js','action.js'];
const sources=new Map(),files=names.map(name=>{
 const file=previous.files.find(f=>f.name===name),p=path.join(root,name),bytes=fs.readFileSync(p);
 assert.equal(sha(bytes),file.sha256,name);sources.set(name,bytes.toString('utf8').split(/\r?\n/));
 return {name,path:p,sha256:file.sha256,bytes:bytes.length};
});
const slice=(file,a,b)=>sources.get(file).slice(a-1,b).join('\n');
const spans=[
 ['doc.js',107,150,'native-parent-repeater-mapping'],['doc.js',221,244,'target-enumeration'],
 ['doc.js',255,299,'event-frame'],['doc.js',328,543,'item-and-widget-info'],['doc.js',613,624,'contained-widget-parent'],
 ['doc.js',626,633,'register-rendered-item'],['doc.js',669,685,'parent-and-visible-item-ids'],
 ['repeater.js',229,245,'reset-then-register-only-visible-bounds'],['repeater.js',594,669,'native-repeater-count-and-display-providers'],
 ['repeater.js',1070,1078,'remove-old-rendered-item-ids'],['repeater.js',1483,1490,'element-id-single-suffix'],['repeater.js',1503,1519,'single-item-suffix-parser'],
 ['variables.js',33,85,'Item-TargetItem-This-providers'],['events.js',281,415,'event-handler'],['events.js',544,591,'case-group'],
 ['events.js',1701,1717,'synthetic-entry'],['events.js',1921,2018,'container-loaded-traversal'],['events.js',1833,1838,'loaded-wrapper'],
 ['expr.js',76,115,'block-and-path-literal'],['expr.js',127,184,'fcall-target-binding'],['expr.js',285,300,'global-variable-and-form-text-actions'],
 ['expr.js',760,765,'expression-dispatch'],['action.js',351,357,'action-dispatch'],['action.js',370,378,'expression-action'],
];
const excerpts=spans.map(([file,startLine,endLine,purpose])=>({file,startLine,endLine,purpose,text:slice(file,startLine,endLine)}));
const base=`
 var scriptIdToRepeaterId={},repeaterIdToScriptIds={},scriptIdToParentLayer={},repeaterIdToItemIds={},elementIdToObject={},repeaterInfoCache={};
 var repeaterToActiveDataSet={outer:[{index:7}],inner:[]},repeaterToCurrentDataSet={outer:[{Name:'Outer'}],inner:[{Name:'Filtered out'}]},repeaterToPageInfo={outer:{noLimit:true},inner:{noLimit:true}};
 var objMap={outer:{id:'outer',type:'repeater'},outerText:{id:'outerText',type:'text'},inner:{id:'inner',type:'repeater'},child:{id:'child',type:'input'},outside:{id:'outside',type:'input'}};
 objMap.inner.objects=[objMap.child];objMap.outer.objects=[objMap.outerText,objMap.inner];
 var present=new Set(['outer','outer-7','outerText-7','inner','outside','outside_input']),values={},writes=[],events=[],globalValues={};
 var $jobj=id=>({length:present.has(id)?1:0,data:()=>undefined,attr:()=>undefined,css:()=>undefined,val:function(v){if(arguments.length){if(present.has(id)){values[id]=v;writes.push({id,value:v});}return this;}return values[id];}});
 var $=()=>({css:()=>undefined});
 var _repeaterManager={},_globalVariableProvider={},_globalVariableValues={},_exprHandlers={},_exprFunctions={},_actionHandlers={};
 var $ax={repeater:_repeaterManager,expr:{},action:{repeatersToRefresh:[],tryRefreshRepeaters:()=>{},flushAllResizeMoveActions:()=>{}},event:{keyState:()=>({}),updateMouseLocation:()=>{}},drag:{GetWidgetDragInfo:()=>({})},getWindowInfo:()=>({}),mouseLocation:{x:0,y:0},
  public:{fn:{IsRepeater:t=>t==='repeater',IsDynamicPanel:t=>t==='panel',IsReferenceDiagramObject:t=>t==='master',IsLayer:t=>t==='layer',IsTable:()=>false,IsMenuObject:()=>false,IsTreeNodeObject:()=>false}},
  constants:{PAGE_TYPE:'page',REFERENCE_DIAGRAM_OBJECT_TYPE:'master',DYNAMIC_PANEL_TYPE:'panel',ALL_TYPE:'all',REPEATER:'repeater',LAYER_TYPE:'layer'},
  document:{globalVariables:{}},deepCopy:x=>JSON.parse(JSON.stringify(x)),pageData:{masters:{}},
  getScriptIdFromPath:p=>p.at(-1),getjBrowserEvent:()=>null,
  placeholderManager:{updatePlaceholder:()=>{},isActive:()=>false},
  visibility:{},style:{IsWidgetDisabled:()=>false,getObjVisible:()=>false},recording:{maybeRecordEvent:()=>{}},globalVariableProvider:_globalVariableProvider};
 _globalVariableProvider.setVariableValue=(name,value)=>globalValues[name]=value;
 var $obj=id=>objMap[$ax.repeater.getScriptIdFromElementId(id)];
 $ax.getObjectFromElementId=$obj;$ax.getObjectFromScriptId=id=>objMap[id];
 $ax.event.HasTextChanged=()=>false;
 _repeaterManager.isEditItem=()=>false;
 _repeaterManager.applySuffixToElementId=(id,suffix)=>id+suffix;
 var _enteredWidgets={},_widgetToFocusParent={},suppressedEventStatus={},suppressingEvents={},allowBubble=[],preventDefaultEvents=[];
 var eventNesting=0,eventNestingTime=0,_isSuppressedEvent=()=>false,_removeSuppressedEvent=()=>{},_shouldShowCaseDescriptions=()=>false;
 var postMessage=()=>{},_getCanClick=()=>true,_notAllowedInvisible=()=>true;
`;
const selected=spans.filter(s=>!['reset-then-register-only-visible-bounds','remove-old-rendered-item-ids'].includes(s[3]));
const ctx=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
vm.runInContext([base,...selected.map(s=>slice(s[0],s[1],s[2])),`
 $ax.getElementIdsFromPath=(p,e)=>$ax.getElementIdsFromEventAndScriptId(e,p.at(-1));
 mapIdsToRepeaterAndLayer([], [objMap.outer,objMap.outside]);
 $ax.clearItemsForRepeater('outer');$ax.clearItemsForRepeater('inner');$ax.addItemIdToRepeater(7,'outer');
 _exprHandlers.optionLiteral=expr=>expr.value;
`].join('\n'),ctx,{timeout:1000});
const run=code=>JSON.parse(vm.runInContext(`JSON.stringify((function(){${code}})())`,ctx,{timeout:1000}));
const outcomes=[];
function probe(name,code,expected){const actual=run(code);assert.deepEqual(actual,expected,name);outcomes.push({name,actual,pass:true});}
probe('nested-object-map-overwrites-inner-parent-with-self',`return scriptIdToRepeaterId;`,{outer:'outer',outerText:'outer',inner:'inner',child:'inner'});
probe('outer-suffix-is-not-hierarchical-row-path',`return {empty:_repeaterManager.createElementId('inner-7',undefined),next:_repeaterManager.createElementId('inner-7',3),script:_repeaterManager.getScriptIdFromElementId('inner-7-3'),item:_repeaterManager.getItemIdFromElementId('inner-7-3')};`,{empty:'inner-7',next:'inner-7-3',script:'inner',item:'7'});
probe('synthetic-suffixed-inner-source-is-valid-but-not-outer-item',`
 var item=$ax.getItemInfo('inner-7');return {valid:item.valid,indexPresent:Object.hasOwn(item,'index'),repeaterId:item.repeater.elementId,marked:item.ismarked,visible:item.isvisible};
`,{valid:true,indexPresent:false,repeaterId:'inner',marked:false,visible:false});
probe('suffixed-inner-This-counts-use-inner-script-id',`
 var widget=$ax.getWidgetInfo('inner-7');return {valid:widget.valid,id:widget.elementId,self:widget.repeater===widget,data:widget.datacount,items:widget.itemcount,visible:widget.visibleitemcount};
`,{valid:true,id:'inner-7',self:true,data:1,items:0,visible:0});
probe('hypothetical-suffix-targets-inner-template-with-outer-looking-number',`return {inside:$ax.getElementIdsFromEventAndScriptId({srcElement:'inner-7'},'child'),outer:$ax.getElementIdsFromEventAndScriptId({srcElement:'inner-7'},'outerText')};`,{inside:['child-7'],outer:['outerText-7']});
probe('ordinary-external-targets-only-registered-rendered-rows',`
 $ax.addItemIdToRepeater(2,'inner');$ax.addItemIdToRepeater(5,'inner');return $ax.getElementIdsFromEventAndScriptId({srcElement:'outside'},'child');
`,['child-2','child-5']);
probe('zero-rendered-targets-even-while-source-data-remains',`
 $ax.clearItemsForRepeater('inner');return {sourceCount:_repeaterManager.getDataCount('inner'),external:$ax.getElementIdsFromEventAndScriptId({srcElement:'outside'},'child'),empty:$ax.getElementIdsFromEventAndScriptId({srcElement:'inner'},'child')};
`,{sourceCount:1,external:[],empty:[]});
probe('explicit-matching-row-source-does-not-require-visible-registration',`return $ax.getElementIdsFromEventAndScriptId({srcElement:'child-2'},'child');`,['child-2']);
probe('target-row-fallback-only-when-source-has-no-suffix',`return $ax.getElementIdsFromEventAndScriptId({srcElement:'inner',targetElement:'child-5'},'child');`,['child-5']);
probe('no-dom-template-source-can-create-native-event-frame',`
 var e=$ax.getEventInfoFromEvent(null,true,'child');return {source:e.srcElement,item:e.item,widgetValid:e.thiswidget.valid,widgetId:e.thiswidget.elementId,domLength:e.thiswidget.elementQuery.length,repeater:e.thiswidget.repeater.elementId};
`,{source:'child',item:{valid:false},widgetValid:true,widgetId:'child',domLength:0,repeater:'inner'});
probe('no-dom-template-This-Repeater-counts-remain-readable',`
 var e=$ax.getEventInfoFromEvent(null,true,'child'),value=getVariableValue('This',e).repeater;
 return {data:value.datacount,items:value.itemcount,visible:value.visibleitemcount,pages:value.pagecount,page:value.pageindex};
`,{data:1,items:0,visible:0,pages:1,page:1});
probe('explicit-This-path-bypasses-rendered-template-enumeration',`return _exprHandlers.pathLiteral({isThis:true},{srcElement:'child'});`,['child']);
probe('no-dom-child-Loaded-runs-native-case-and-variable-external-form-actions',`
 objMap.child.interactionMap={onLoad:{eventType:'OnLoad',cases:[{isNewIfGroup:true,actions:[{action:'setFunction',expr:{exprType:'block',subExprs:[
 {exprType:'fcall',functionName:'SetGlobalVariableValue',arguments:[{exprType:'optionLiteral',value:'seen'},{exprType:'optionLiteral',value:'loaded'}]},
 {exprType:'fcall',functionName:'SetWidgetFormText',arguments:[{exprType:'pathLiteral',value:['outside']},{exprType:'optionLiteral',value:'external changed'}]},
 {exprType:'fcall',functionName:'SetWidgetFormText',arguments:[{exprType:'pathLiteral',value:['child']},{exprType:'optionLiteral',value:'template named'}]},
 {exprType:'fcall',functionName:'SetWidgetFormText',arguments:[{exprType:'pathLiteral',isThis:true},{exprType:'optionLiteral',value:'template This'}]}
 ]}}]}]}};
 $ax.loadDynamicPanelsAndMasters([objMap.child],[],undefined);
 return {globalValues,writes,templateExists:present.has('child')};
`,{globalValues:{seen:'loaded'},writes:[{id:'outside_input',value:'external changed'}],templateExists:false});
const evidence={version:1,target:'Axure RP 11.0.0.4150',method:'SHA-pinned narrow original JavaScript functions with explicit object tree/jQuery/DOM environment mocks, not original app/browser execution',files,excerpts,probe:{count:outcomes.length,outcomes,limitations:[
 'The nested tree and suffix IDs are constructed inputs, not a generated native nested repeater fixture. They falsify a naive hierarchical suffix interpretation but do not establish a supported native independent nested dataset lifecycle.',
 'Exact native event/frame/case/dispatch/expression/form actions execute, but jQuery empty-selection behavior and an external input are mocked; rich text and layout actions are not tested.',
 'Script-path lookup is a direct synthetic object-ID mapping; master/adaptive-view path resolution is not exercised.',
 'The prior 21 empty lifecycle probes are not rerun by this script.'
]}};
const text=JSON.stringify(evidence,null,2)+'\n';fs.writeFileSync(new URL('./repeater-empty-scope-evidence.json',import.meta.url),text);
console.log(JSON.stringify({pass:true,probes:outcomes.length,files:files.length,excerpts:excerpts.length,sha256:sha(text)}));
