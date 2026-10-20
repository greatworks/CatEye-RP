// Research only. Exact SHA-pinned function slices in one VM; no vendor app/compiler startup.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base=process.argv[2]??'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins={
 'doc.js':'986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1',
 'variables.js':'91c71787560b88e597b6baf934bd68075597901afccf4787b6aa9d8c43453188',
 'sto.js':'c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6',
 'expr.js':'530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6',
 'axQuery.std.js':'0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd',
 'action.js':'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3',
 'events.js':'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3',
 'utils.temp.js':'ef33a9174ea5b4cdcd48229f896195d2f67941116aa7eeae6308a99e02b4832f',
 'repeater.js':'d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b',
};
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),source={};
const files=Object.entries(pins).map(([file,hash])=>{const filename=path.join(base,file),bytes=fs.readFileSync(filename);assert.equal(sha(bytes),hash,file);source[file]=bytes.toString('utf8').split(/\r?\n/);return{file,path:filename,sha256:hash};});
const slice=(file,a,b)=>source[file].slice(a-1,b).join('\n');
const ranges={
 'doc.js':[[105,145],[255,347],[349,480],[613,624],[626,633],[652,674]],
 'variables.js':[[33,85]],'sto.js':[[90,113],[145,161],[216,234]],
 'expr.js':[[127,180],[204,244],[712,714]],'utils.temp.js':[[5,49]],
 'axQuery.std.js':[[1437,1575]],'action.js':[[351,368]],
 'events.js':[[432,500],[1701,1712]],
 'repeater.js':[[116,172],[186,206],[276,285],[329,368],[580,592],[1118,1132],[1483,1490],[1503,1519]],
};
const excerpts=Object.entries(ranges).flatMap(([file,rs])=>rs.map(([startLine,endLine])=>({file,startLine,endLine,text:slice(file,startLine,endLine)})));
const setup=`
var objects={},styles={},moved={},resized={},elements={},boundsReads=[],timers=[],sinks=[],links=[],flushes=0;
var _globalVariableProvider={},_globalVariableValues={},_exprHandlers={},_exprFunctions={},_repeaterManager={},_actionHandlers={};
var repeaterIdToItemIds={r:['1','2']};
var $ax=function(selector){var id=selector.slice(1);return{getElementIds:()=>[id],getParents:()=>[[]],offsetBoundingRect:function(...args){boundsReads.push({id,args});return $ax.public.fn.offsetBoundingRect.apply(this,args);},viewportLocation:()=>({left:900,top:800}),text:()=>id+' text'};};
$ax.public={fn:{IsLayer:t=>t==='layer',IsRepeater:t=>t==='repeater',IsDynamicPanel:t=>t==='panel'}};
var $axure={fn:{IsLayer:$ax.public.fn.IsLayer,IsReferenceDiagramObject:()=>false}};
$ax.repeater=_repeaterManager;$ax.globalVariableProvider=_globalVariableProvider;$ax.document={globalVariables:{}};
$ax.expr={};$ax.action={flushAllResizeMoveActions:()=>flushes++};var _action=$ax.action;
$ax.visibility={getMovedLocation:id=>moved[id],getResizedSize:id=>resized[id],getRotatedAngle:()=>0,GetPanelState:()=>undefined};
$ax.style={generateState:()=>'',computeFullStyle:id=>styles[_getScriptIdFromElementId(id)]};
$ax.adaptive={currentViewId:''};$ax.dynamicPanelManager={getPanelSizeChange:()=>undefined};
$ax.move={getRotationDegree:()=>45};$ax.getParentRepeaterFromScriptId=id=>['r','c'].includes(id)?'r':undefined;
$ax.getPathFromScriptId=id=>[id];$ax.getElementIdFromPath=(p,e)=>_createElementId(p.at(-1),e.itemNum);
$ax.getWindowInfo=()=>({width:1000,height:800});$ax.mouseLocation={x:0,y:0};
$ax.event={keyState:()=>({})};$ax.drag={GetWidgetDragInfo:()=>({})};
$ax.getElementIdsFromPath=path=>path;
var $obj=id=>objects[_getScriptIdFromElementId(id)],document={getElementById:id=>elements[id]??null};
var window={document,setTimeout:(callback,ms)=>timers.push({callback,ms})};
var $jobj=id=>({length:elements[id]?1:0,data:()=>'',css:()=>1,attr:()=>undefined});
var $=selector=>({css:()=>'',width:()=>1000,remove:()=>{},append:()=>{},mouseleave:()=>{},click:callback=>links.push(callback)});
var _fixedLocation=()=>({valid:false});
var _populateBoundingRect=rect=>({...rect,right:rect.left+rect.width,bottom:rect.top+rect.height});
var postMessage=()=>{},_showCaseLinks=()=>{},_isEventSimulating=event=>Boolean(event.conditional);
var _handleEvent=(id,info,event)=>$ax.action.dispatchAction(info,event.cases[0].actions);
function reset(){
 objects={s:{type:'shape'},t:{type:'shape'},r:{type:'repeater'},c:{type:'shape'},contained:{type:'text',isContained:true,parent:{id:'s'}}};
 styles={s:{location:{x:10,y:20},size:{width:30,height:40},rotation:90,outerShadow:{on:true,offsetX:9,offsetY:8,blurRadius:7}},t:{location:{x:70,y:80},size:{width:50,height:60},outerShadow:{on:false}},r:{location:{x:100,y:200},size:{width:999,height:999},outerShadow:{on:false}},c:{location:{x:3,y:4},size:{width:10,height:20},outerShadow:{on:false}}};
 moved={r:{left:100,top:200},'r-1':{left:5,top:6},'r-2':{left:5,top:56}};
 resized={r:{width:80,height:106},'r-1':{width:70,height:50},'r-2':{width:70,height:50}};
 elements=Object.fromEntries(['s','t','r','r-1','r-2','c-1','contained'].map(id=>[id,{getAttribute:()=>null}]));
 boundsReads=[];timers=[];sinks=[];links=[];flushes=0;repeaterInfoCache=[];
}
`;
const executionRanges=[['repeater.js',1483,1490],['repeater.js',1503,1519],['doc.js',613,624],['doc.js',320,347],['doc.js',349,543],['doc.js',255,299],['variables.js',33,85],['sto.js',90,113],['sto.js',145,161],['sto.js',216,234],['expr.js',100,115],['expr.js',127,180],['expr.js',204,244],['expr.js',712,714],['expr.js',753,764],['utils.temp.js',5,49],['axQuery.std.js',1438,1575],['action.js',351,368],['events.js',432,500]];
const helpers=`
for(var key of ['getVisibleDataCount','getFilteredDataCount','getDataCount','getPageCount'])_repeaterManager[key]=()=>2;
_repeaterManager.getPageIndex=()=>1;_repeaterManager.isEditItem=()=>false;
_repeaterManager.setDisplayProps=(item,r,index)=>{item.index=Number(index);};
function frame(id){return $ax.getEventInfoFromEvent(null,false,id);}
function leaf(variable,prop){return{sto:'propCall',thisSTO:{sto:'var',name:variable},prop};}
function nested(variable,prop,last){return{sto:'propCall',thisSTO:leaf(variable,prop),prop:last};}
function value(info,variable,prop,scope={}){return $ax.evaluateSTO(leaf(variable,prop),scope,info);}
function geometry(info,variable){return Object.fromEntries(['x','y','width','height','left','right','top','bottom'].map(p=>[p,value(info,variable,p)]));}
function str(value,stos,localVariables={}){return{exprType:'stringLiteral',value,stos,localVariables};}
function readExpr(info,expression){return $ax.expr.evaluateExpr(expression,info);}
function change(id,x=15,y=25,w=35,h=45){moved[id]={left:x,top:y};resized[id]={width:w,height:h};}
_actionHandlers.record=(event,actions,index)=>{sinks.push({this:value(event,'This','width'),itemRepeater:event.item?.valid?$ax.evaluateSTO(nested('Item','repeater','width'),{},event):null});_dispatchAction(event,actions,index+1);};
_exprFunctions.recordTarget=(ids,val,event)=>{sinks.push({ids,val,restoredTarget:event.targetElement??null});};
reset();
`;
const ctx=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
vm.runInContext(setup+executionRanges.map(r=>slice(...r)).join('\n')+helpers,ctx,{timeout:1000});
const run=code=>JSON.parse(vm.runInContext(`JSON.stringify((()=>{${code}})())`,ctx,{timeout:1000}));
const experiments=[];
function test(name,code,expected){const actual=run(code);assert.deepEqual(actual,expected,name);experiments.push({name,pass:true,actual});}
test('frame-creation-is-lazy-for-geometry',`reset();var e=frame('s');return {reads:boundsReads.length,cached:Object.keys(e.thiswidget).filter(k=>['xProp','yProp','widthProp','heightProp'].includes(k))};`,{reads:0,cached:[]});
test('geometry-is-local-unrotated-shadowless',`reset();var e=frame('s');return {value:geometry(e,'This'),flags:boundsReads.map(r=>r.args)};`,{value:{x:10,y:20,width:30,height:40,left:10,right:40,top:20,bottom:60},flags:Array(8).fill([true,true])});
test('retained-widget-object-caches-all-four-on-first-read',`reset();var w=$ax.getWidgetInfo('s');var before=w.x();change('s');return {before,x:w.x(),y:w.y(),w:w.width(),h:w.height(),reads:boundsReads.length};`,{before:10,x:10,y:20,w:30,h:40,reads:1});
test('first-read-late-uses-new-box-even-for-old-widget-object',`reset();var w=$ax.getWidgetInfo('s');change('s');return [w.x(),w.y(),w.width(),w.height()];`,[15,25,35,45]);
test('direct-This-provider-recreates-object-despite-event-cache',`reset();var e=frame('s');var cached=e.thiswidget.width();var a=value(e,'This','width');change('s');return {cached,a,b:value(e,'This','width'),old:e.thiswidget.width()};`,{cached:30,a:30,b:35,old:30});
test('direct-Target-provider-recreates-object',`reset();var e=frame('s');e.targetElement='t';var a=value(e,'Target','width');change('t',1,2,77,88);return {a,b:value(e,'Target','width')};`,{a:50,b:77});
test('repeater-body-source-gets-whole-repeater',`reset();var e=frame('r');return {box:geometry(e,'This'),item:e.item.valid};`,{box:{x:100,y:200,width:80,height:106,left:100,right:180,top:200,bottom:306},item:false});
test('row-source-gets-row-not-whole-repeater',`reset();var e=frame('r-2');return {box:geometry(e,'This'),thisRepeater:$ax.evaluateSTO(nested('This','repeater','width'),{},e),itemRepeater:$ax.evaluateSTO(nested('Item','repeater','width'),{},e),item:e.item.index};`,{box:{x:5,y:56,width:70,height:50,left:5,right:75,top:56,bottom:106},thisRepeater:70,itemRepeater:80,item:2});
test('template-child-gets-template-local-box',`reset();var e=frame('c-1');return {box:geometry(e,'This'),thisRepeater:$ax.evaluateSTO(nested('This','repeater','width'),{},e)};`,{box:{x:3,y:4,width:10,height:20,left:3,right:13,top:4,bottom:24},thisRepeater:80});
test('contained-object-climbs-parent-not-row-suffix',`reset();var e=frame('contained');return {source:e.srcElement,widget:e.thiswidget.elementId,width:value(e,'This','width')};`,{source:'contained',widget:'s',width:30});
test('source-row-read-after-resize-is-live',`reset();var e=frame('r-1');var a=value(e,'This','width');change('r-1',7,8,90,60);return {a,after:geometry(e,'This')};`,{a:70,after:{x:7,y:8,width:90,height:60,left:7,right:97,top:8,bottom:68}});
test('Wait-copy-retains-object-but-direct-This-live',`reset();var e=frame('s');e.thiswidget.width();_dispatchAction(e,[{action:'wait',waitTime:0},{action:'record'}]);change('s');timers[0].callback();return {timer:timers[0].ms,sinks,old:e.thiswidget.width(),flushes};`,{timer:0,sinks:[{this:35,itemRepeater:null}],old:30,flushes:1});
test('actual-eventCopy-shares-item-and-thiswidget-objects',`reset();var e=frame('r-1'),c=$ax.eventCopy(e);return {frameDifferent:c!==e,thisSame:c.thiswidget===e.thiswidget,itemSame:c.item===e.item};`,{frameDifferent:true,thisSame:true,itemSame:true});
test('Wait-retained-ItemRepeater-first-read-before-delay-is-stale',`reset();$ax.cacheRepeaterInfo('r',$ax.getWidgetInfo('r'));var e=frame('r-1');var first=$ax.evaluateSTO(nested('Item','repeater','width'),{},e);_dispatchAction(e,[{action:'wait',waitTime:0},{action:'record'}]);change('r',1,2,180,200);change('r-1',1,2,90,60);$ax.removeCachedRepeaterInfo('r');timers[0].callback();return {first,sinks};`,{first:80,sinks:[{this:90,itemRepeater:80}]});
test('Wait-retained-ItemRepeater-first-read-after-delay-is-current',`reset();$ax.cacheRepeaterInfo('r',$ax.getWidgetInfo('r'));var e=frame('r-1');_dispatchAction(e,[{action:'wait',waitTime:0},{action:'record'}]);change('r',1,2,180,200);change('r-1',1,2,90,60);$ax.removeCachedRepeaterInfo('r');timers[0].callback();return sinks;`,[{this:90,itemRepeater:180}]);
test('refresh-cache-shares-ItemRepeater-first-read-across-row-events',`reset();$ax.cacheRepeaterInfo('r',$ax.getWidgetInfo('r'));var a=frame('r-1');var first=$ax.evaluateSTO(nested('Item','repeater','width'),{},a);change('r',1,2,180,200);var b=frame('r-2');return {first,second:$ax.evaluateSTO(nested('Item','repeater','width'),{},b),thisRepeater:$ax.evaluateSTO(nested('This','repeater','width'),{},frame('c-1'))};`,{first:80,second:80,thisRepeater:180});
for(const conditional of [false,true])test(`actual-menu-callback-This-live-${conditional}`,`reset();var e=frame('s');e.thiswidget.width();_showCaseDescriptions('s',e,{conditional:${conditional},description:'event',cases:[{description:'case',actions:[{action:'record',description:'record',actionInfoDescriptions:{}}]}]},true);change('s');links[0]();return sinks;`,[{this:35,itemRepeater:null}]);
test('GetWidget-local-expression-recreated-per-string-evaluation',`reset();var e=frame('s');var expr=str('[[L.width]]/[[L.height]]',[leaf('L','width'),leaf('L','height')],{L:{exprType:'fcall',functionName:'GetWidget',arguments:[{exprType:'pathLiteral',value:['s']}]}});var a=readExpr(e,expr);change('s');return {a,b:readExpr(e,expr),reads:boundsReads.length};`,{a:'30/40',b:'35/45',reads:2});
test('Target-resolves-per-target-during-fcall-and-is-restored',`reset();var e=frame('s');readExpr(e,{exprType:'fcall',functionName:'recordTarget',arguments:[{exprType:'pathLiteral',value:['s','t']},str('[[Target.right]]',[leaf('Target','right')])]});return {sinks,target:e.targetElement??null};`,{sinks:[{ids:['t'],val:'120',restoredTarget:null},{ids:['s'],val:'40',restoredTarget:null}],target:null});
test('Target-without-target-preserves-string-fragment',`reset();return readExpr(frame('s'),str('left:[[Target.x]]:right',[leaf('Target','x')]));`,'left:[[Target.x]]:right');
test('missing-row-DOM-falls-back-to-template-style-with-valid-object',`reset();delete elements['r-1'];delete moved['r-1'];delete resized['r-1'];return geometry(frame('r-1'),'This');`,{x:100,y:200,width:999,height:999,left:100,right:1099,top:200,bottom:1199});
const evidence={version:1,target:'Axure RP 11.0.0.4150',packageSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',extractionEvidence:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',files,excerpts,executionRanges,experiments,method:'SHA-pinned original getWidgetInfo/getParentElement/getEventInfo/provider/STO/string/fcall/GetWidget/bounds/Wait/eventCopy/menu functions in isolated VM. ASTs are synthetic, not asserted native compiler products.',limitations:['DOM and styles, moved/resized caches, object/script dictionaries and counts are fixture bridges; no vendor GUI/browser or complete source dispatcher runs.','Menu callback body is original. Conditional menu _handleEvent bridge dispatches first case; this probe does not validate native condition grouping.','Fixed-position/RDO geometry, viewport coordinates, navigation teardown and real DOM deletion cleanup are not emulated.','No native compiler type metadata for synthesized ASTs. No real box-model measurement.'],node:process.version};
const out=JSON.stringify(evidence,null,2)+'\n';fs.writeFileSync(new URL('../widget-geometry-evidence.json',import.meta.url),out);console.log(JSON.stringify({pass:true,experiments:experiments.length,files:files.length,excerpts:excerpts.length,sha256:sha(out)}));
