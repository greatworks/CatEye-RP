// Research-only exact-function probes. No vendor app/compiler/module initialization.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base=process.argv[2]??'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins={
 'repeater.js':'d4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b',
 'action.js':'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3',
 'axQuery.std.js':'0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd',
 'math.js':'f56ab4a6c3f6e91aaba9bebf2e81485965fc82bca63af0c606593d580c1de883',
 'expr.js':'530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6',
 'visibility.js':'bbf8974eaa4ffa2b9800797725ada6805c47c532f47d9a5647dc205966ab8a53',
 'events.js':'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3',
};
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),source={};
const files=Object.entries(pins).map(([file,hash])=>{const filename=path.join(base,file),bytes=fs.readFileSync(filename);assert.equal(sha(bytes),hash);source[file]=bytes.toString('utf8').split(/\r?\n/);return{file,path:filename,sha256:hash};});
const slice=(file,a,b)=>source[file].slice(a-1,b).join('\n');
const ranges={
 'repeater.js':[[116,172],[225,230],[329,374],[1581,1626],[1860,1878],[2022,2078],[2082,2135],[2473,2483]],
 'action.js':[[128,141],[1258,1310],[1528,1551]],
 'axQuery.std.js':[[399,420],[457,482],[541,568],[570,623],[655,663],[1299,1353],[1368,1371],[1438,1575]],
 'math.js':[[2,8],[71,71],[103,109],[132,149],[217,223]],
 'expr.js':[[285,300],[316,330],[379,385],[469,552]],
 'visibility.js':[[15,23],[55,62],[689,703],[733,778]],'events.js':[[1701,1716]],
};
const excerpts=Object.entries(ranges).flatMap(([file,rs])=>rs.map(([startLine,endLine])=>({file,startLine,endLine,text:slice(file,startLine,endLine)})));
const setup=`
var objects={},styles={},elements={},trace=[],children=[],parentPanel={},parentLayer={},panelChanged=false,layerChanged=false,sizes={r:{'1':{width:100,height:40}}};
var _dynamicPanelManager={},_actionHandlers={},_getIdToResizeMoveState=()=>({}),_dispatchAction=()=>trace.push({kind:'next'}),_queueResizeMove=()=>{throw Error('outside probe');};
var document={getElementById:id=>elements[id]??null},window={document},$obj=id=>objects[id];
var $ax=function(selector){var id=selector.slice(1);return{getElementIds:()=>[id],getParents:()=>[[]],offsetBoundingRect:function(){return $ax.public.fn.offsetBoundingRect.call(this);},childrenBoundingRect:()=>_boundingRectForIds(children)};};
$ax.public={fn:{IsDynamicPanel:t=>t==='panel',IsLayer:t=>t==='layer'}};
var $axure={fn:{IsReferenceDiagramObject:()=>false,IsLayer:$ax.public.fn.IsLayer}};
$ax.dynamicPanelManager=_dynamicPanelManager;
$ax.visibility={limboIds:{},getMovedLocation:()=>undefined,getResizedSize:()=>undefined,getRotatedAngle:()=>undefined};
$ax.adaptive={currentViewId:'',updateMobileScrollOnBody:()=>trace.push({kind:'body-scroll'})};
$ax.style={generateState:()=>'',computeFullStyle:id=>styles[id]};
$ax.getParentRepeaterFromElementId=id=>id==='r'||/-1$/.test(id)?'r':undefined;
$ax.expr={evaluateExpr:(expr,event)=>{trace.push({kind:'expr',value:expr,target:event.targetElement??null});return expr;}};
$ax.repeater={getItemSize:(r,i)=>sizes[r]?.[i],setItemSize:(r,i,w,h)=>{trace.push({kind:'size',r,i,w,h});sizes[r][i]={width:w,height:h};},getItemIdFromElementId:id=>id.split('-')[1]??'',createElementId:(id,item)=>item?id+'-'+item:id};
var _fixedLocation=()=>({valid:false});
var getParentLayerOrRdo=id=>parentLayer[id],getParentPanel=id=>parentPanel[id];
var _updateLayerRectCache=id=>{trace.push({kind:'layer-update',id});return layerChanged;},_updateRdoRect=()=>false;
var _updateMobileScroll=(...args)=>trace.push({kind:'panel-scroll',args});
var _updateFitPanel=(id,state)=>{trace.push({kind:'panel-update',id,state});return panelChanged;};
function reset(fit=true){objects={r:{type:'repeater',repeaterPropMap:{fitToContent:fit}}};styles={};elements={};children=[];trace=[];parentPanel={};parentLayer={};panelChanged=false;layerChanged=false;sizes={r:{'1':{width:100,height:40}}};$ax.visibility.limboIds={};}
function child(id,x,y,w,h,rotation=0,hidden=false,type='text'){objects[id]={type};styles[id]={location:{x,y},size:{width:w,height:h},rotation,outerShadow:{on:false}};elements[id]={style:{visibility:hidden?'hidden':'inherit'},getAttribute:()=>null};children.push(id);}
`;
const execRanges=[['visibility.js',15,23],['math.js',2,8],['math.js',71,71],['math.js',103,109],['math.js',132,149],['math.js',217,223],['axQuery.std.js',1299,1353],['axQuery.std.js',1438,1575],['repeater.js',1590,1626],['action.js',1258,1283],['action.js',1528,1551]];
const ctx=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
vm.runInContext(setup+execRanges.map(r=>slice(...r)).join('\n'),ctx,{timeout:1000});
const run=code=>JSON.parse(vm.runInContext(`JSON.stringify((()=>{${code}})())`,ctx,{timeout:1000}));
const outcomes=[];
function test(name,code,expected){const actual=run(code);assert.deepEqual(actual,expected,name);outcomes.push({name,pass:true,actual});}
const fitResult='return trace.filter(e=>e.kind==="size");';
test('positive-offset-right-bottom-not-union-width','reset();child("c-1",10,20,30,40);_fitParentPanel("c-1");'+fitResult,[{kind:'size',r:'r',i:'1',w:40,h:60}]);
test('negative-offset-does-not-shift-origin','reset();child("c-1",-10,-20,30,40);_fitParentPanel("c-1");'+fitResult,[{kind:'size',r:'r',i:'1',w:20,h:20}]);
test('fully-negative-bounds-clamp-to-zero','reset();child("c-1",-50,-60,30,40);_fitParentPanel("c-1");'+fitResult,[{kind:'size',r:'r',i:'1',w:0,h:0}]);
test('rotation-90-contributes-axis-aligned-bounds','reset();child("c-1",10,20,20,100,90);_fitParentPanel("c-1");'+fitResult,[{kind:'size',r:'r',i:'1',w:70,h:80}]);
test('hidden-child-excluded','reset();child("a-1",0,0,20,30);child("b-1",100,200,20,30,0,true);_fitParentPanel("b-1");'+fitResult,[{kind:'size',r:'r',i:'1',w:20,h:30}]);
test('all-hidden-children-zero-size','reset();child("a-1",0,0,20,30,0,true);_fitParentPanel("a-1");'+fitResult,[{kind:'size',r:'r',i:'1',w:0,h:0}]);
test('limbo-excluded','reset();child("a-1",0,0,20,30);child("b-1",100,200,20,30);$ax.visibility.limboIds["b-1"]=true;_fitParentPanel("a-1");'+fitResult,[{kind:'size',r:'r',i:'1',w:20,h:30}]);
test('fixed-panel-excluded','reset();child("a-1",0,0,20,30);child("p-1",100,200,20,30,0,false,"panel");objects["p-1"].fixedHorizontal="left";_fitParentPanel("a-1");'+fitResult,[{kind:'size',r:'r',i:'1',w:20,h:30}]);
test('empty-layer-excluded','reset();child("a-1",0,0,20,30);child("g-1",100,200,0,0,0,false,"layer");_fitParentPanel("a-1");'+fitResult,[{kind:'size',r:'r',i:'1',w:20,h:30}]);
test('default-outer-shadow-contributes','reset();child("a-1",10,20,30,40);styles["a-1"].outerShadow={on:true,offsetX:5,offsetY:6,blurRadius:4};_fitParentPanel("a-1");'+fitResult,[{kind:'size',r:'r',i:'1',w:49,h:70}]);
test('fit-false-does-not-resize','reset(false);child("c-1",10,20,30,40);_fitParentPanel("c-1");'+fitResult,[]);
test('repeater-self-does-not-refit-own-rows','reset();child("c-1",10,20,30,40);_fitParentPanel("r");'+fitResult,[]);
test('unchanged-or-fixed-panel-stops-parent-recursion','reset();child("p-1",0,0,100,50,0,false,"panel");parentPanel["c-1"]={parent:"p-1",state:0,stateId:"p-1_state0"};_fitParentPanel("c-1");'+fitResult,[]);
test('changed-current-panel-recurses','reset();child("p-1",5,10,100,50,0,false,"panel");parentPanel["c-1"]={parent:"p-1",state:0,stateId:"p-1_state0"};panelChanged=true;_fitParentPanel("c-1");'+fitResult,[{kind:'size',r:'r',i:'1',w:105,h:60}]);
test('hidden-parent-can-recalculate-but-is-excluded-by-owner','reset();child("p-1",5,10,100,50,0,true,"panel");parentPanel["c-1"]={parent:"p-1",state:0,stateId:"p-1_state0"};panelChanged=true;_fitParentPanel("c-1");'+fitResult,[{kind:'size',r:'r',i:'1',w:0,h:0}]);
test('unchanged-layer-stops-recursion','reset();child("g-1",5,10,100,50,0,false,"layer");parentLayer["c-1"]="g-1";_fitParentPanel("c-1");'+fitResult,[]);
test('changed-layer-recurses','reset();child("g-1",5,10,100,50,0,false,"layer");parentLayer["c-1"]="g-1";layerChanged=true;_fitParentPanel("c-1");'+fitResult,[{kind:'size',r:'r',i:'1',w:105,h:60}]);
for(const fit of [true,false])test(`explicit-thisItem-resize-does-not-change-fit-${fit}`,`reset(${fit});var event={srcElement:'c-1',targetElement:'prior'};_actionHandlers.setWidgetSize(event,[{objectsToResize:[{objectPath:'thisItem',sizeInfo:{width:'200',height:'60'}}]}],0);return {size:sizes.r['1'],fit:objects.r.repeaterPropMap.fitToContent,target:event.targetElement,evalTargets:trace.filter(e=>e.kind==='expr').map(e=>e.target)};`,{size:{width:200,height:60},fit,target:'prior',evalTargets:[null,null]});
test('later-fit-overwrites-explicit-item-size','reset();child("c-1",10,20,30,40);_actionHandlers.setWidgetSize({srcElement:"c-1"},[{objectsToResize:[{objectPath:"thisItem",sizeInfo:{width:"200",height:"60"}}]}],0);_fitParentPanel("c-1");return sizes.r["1"];',{width:40,height:60});
for(const [label,width,height,expected] of [['blank-invalid','','bad',{width:100,height:40}],['zero-strings','0','0',{width:0,height:0}],['negative-fraction','-5','2.5',{width:0,height:2.5}],['numeric-zero-is-loosely-empty',0,0,{width:100,height:40}]])test(`size-expression-${label}`,`reset();return _getSizeFromInfo({width:${JSON.stringify(width)},height:${JSON.stringify(height)}},{},100,40);`,expected);
// Library values are data evidence, not proof of initial widget factory layout.
const libBytes=fs.readFileSync(new URL('../samples/Default.rplib',import.meta.url));
const parsedBytes=fs.readFileSync(new URL('../samples/Default.rplib.objects.json',import.meta.url));
const lib=JSON.parse(parsedBytes),map=x=>Object.fromEntries(x?.$map??[]),samples=[];
assert.equal(sha(libBytes),lib.fileSha256);
for(const pkg of lib.packages){for(const obj of pkg.objects??[]){if(obj.type!=='Axure:DiagramObject:Repeater')continue;const index=new Map(pkg.objects.map(o=>[o.id,o])),props=map(obj.properties),base=index.get(props.BaseDiagram.$reference),refs=map(base.properties)['diagram-objects'];samples.push({packageId:pkg.packageId,packagePath:pkg.path,packageSha256:pkg.sha256,object:obj,style:index.get(props.MyStyle.$reference),repeaterStyle:index.get(props.RepeaterStyle.$reference),children:refs.map(ref=>{const child=index.get(ref.$reference),p=map(child.properties);return{object:child,style:index.get(p.MyStyle?.$reference)};})});}}
const evidence={version:'11.0.0.4150',packageSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',files,excerpts,executionRanges:execRanges,outcomes,probeCount:outcomes.length,library:{path:'research/samples/Default.rplib',sha256:sha(libBytes),parsedJsonSha256:sha(parsedBytes),samples},limitations:['Source functions only, isolated VM with explicit object/style/visibility bridges; no complete DOM/browser/app.','setItemSize is a recording sink: layout propagation and event order belong to the separate layout-matrix evidence.','Parent panel/layer lookup and change detection are mocks; stop/continue branches are original, actual panel state-change guards are supported by static excerpts.','Expression evaluator returns explicit supplied values; numeric-zero vs string-zero sensitivity is not a claim about generated compiler AST.','No GUI new-widget creation or generated prototype measurement was run.']};
const text=JSON.stringify(evidence,null,2)+'\n';fs.writeFileSync(new URL('../repeater-fit-evidence.json',import.meta.url),text);console.log(JSON.stringify({pass:true,probes:outcomes.length,files:files.length,excerpts:excerpts.length,libraryRepeaters:samples.length,sha256:sha(text)}));
