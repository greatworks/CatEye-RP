import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const pins = {
  'adaptive.js':'e141ea07bb973b6007f2ad7d7205516a041a801ec97e410467352c27af3b2928',
  'style.js':'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c',
  'events.js':'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3',
};
const source = Object.fromEntries(Object.keys(pins).map(name => {
  const s = fs.readFileSync(path.join(root,name),'utf8'); assert.equal(sha(s), pins[name]); return [name,s];
}));
const ranges=[];
function slice(file,first,last,label) {
  const s=source[file].split(/\r?\n/).slice(first-1,last).join('\n');
  ranges.push({file,first,last,label,sha256:sha(s)});return s;
}
const selection=slice('adaptive.js',376,426,'width/height selector and initialized predicate');
const chain=slice('adaptive.js',171,219,'page/master ancestry and page style');
const controls=[slice('adaptive.js',6,42,'auto/load/resize control'),slice('adaptive.js',48,159,'switch with explicit terminal DOM/style sinks'),slice('adaptive.js',707,752,'public selection/initialize/forced and auto size')].join('\n');
const messages=slice('adaptive.js',429,582,'player message listener; only view and size branches exercised');
const apply=slice('adaptive.js',245,317,'view application object loop');
const imageLookup=slice('adaptive.js',319,365,'image ancestry lookup');
const styles=slice('style.js',1763,1915,'normal and state style ancestry');
const events=[slice('events.js',1840,1861,'page/master adaptive event and player post'),slice('events.js',1901,2018,'page/master traversal and dispatch')].join('\n');
const results=[];
const clone=x=>JSON.parse(JSON.stringify(x));
function test(name,run) {const observed=run();results.push({name,status:'pass',observed});}
function extend(target,...values){for(const v of values)if(v)for(const k in v)if(v[k]!==undefined)target[k]=v[k];return target;}
const view=(id,width,height=0,extra={})=>({id,size:{width,height},...extra});

function choice(base,views) {
  const c=vm.createContext({$ax:{pageData:{defaultAdaptiveView:base}},_enabledViews:views});
  vm.runInContext(selection,c);return (w,h)=>c._getAdaptiveView(w,h);
}
function checkChoice(name,base,views,width,height,expected) {
  test(name,()=>{const actual=choice(base,views)(width,height);assert.equal(actual?.id,expected);return {base,views,width,height,selected:actual?.id??null};});
}
const base=view('',0,0), widths=[view('small',320),view('medium',768),view('large',1200)];
for(const [width,id] of [[0,''],[319.999,''],[320,'small'],[767.999,'small'],[768,'medium'],[1199.999,'medium'],[1200,'large'],[5000,'large']])
  checkChoice(`inclusive lower-width threshold ${width}`,base,widths,width,600,id);
checkChoice('height is not an eligibility filter',base,[view('tall',600,2000)],700,300,'tall');
const heights=[view('h900',500,900),view('h300',500,300),view('h600',500,600)];
for(const [height,id] of [[0,'h300'],[299.999,'h300'],[300,'h300'],[599.999,'h300'],[600,'h600'],[899.999,'h600'],[900,'h900'],[2000,'h900']])
  checkChoice(`equal width height choice ${height}`,base,heights,600,height,id);
checkChoice('largest width wins over fitting shorter width',base,[view('short',400,300),view('tall',500,2000)],600,300,'tall');
checkChoice('no lower width chooses smallest upper width',view('',1000,900),[view('a',600,2000),view('b',800,10)],500,1,'a');
checkChoice('upper width tie chooses smallest positive height',view('',1000,900),[view('zero',600,0),view('h100',600,100),view('h50',600,50)],500,1,'h50');
checkChoice('default wins exact dimension tie',view('',500,300),[view('same',500,300)],500,300,'');
checkChoice('first declaration wins equal named dimensions',base,[view('first',500,300),view('second',500,300)],600,300,'first');
checkChoice('reversing equal named declarations changes winner',base,[view('second',500,300),view('first',500,300)],600,300,'second');
checkChoice('named enabled false is not checked by selector',base,[view('off',500,0,{enabled:false})],600,300,'off');
checkChoice('condition/comparator fields ignored',base,[view('x',500,0,{condition:'lessThan',operator:'<=',maxWidth:1})],600,300,'x');
checkChoice('zero width is actual lower threshold',view('',800,600),[view('zero',0,0)],1,1,'zero');
checkChoice('missing width is not zero in lower comparator',view('',800,600),[{id:'missing',size:{height:0}}],1,1,'');
checkChoice('zero height lower tie beats too-tall candidates',view('',500,0),[view('tall',500,300)],600,200,'');
checkChoice('missing default height leaves equal-width incumbent unchanged', {id:'',size:{width:500}}, [view('h100',500,100)],600,200,'');
checkChoice('fallback dimensions use finite 1000000 sentinel',view('',2000000,1),[{id:'missing',size:{height:0}},view('w1500000',1500000,1)],100,100,'missing');
test('malformed view without size throws rather than silently skipping',()=>{assert.throws(()=>choice(base,[{id:'bad'}])(800,600),/width/);return {throws:true};});
for(const [width,id] of [[0,''],[389.999,''],[390,'phone'],[767.999,'phone'],[768,'tablet'],[1000,'tablet']])
  for(const height of [0,900]) checkChoice(`native default0 phone390 tablet768 w${width} h${height}`,base,[view('phone',390,0),view('tablet',768,0)],width,height,id);
for(const [height,id] of [[0,'h0'],[399.999,'h0'],[400,'h400'],[899.999,'h400'],[900,'h900']])
  checkChoice(`native equalwidth768 height0/400/900 at ${height}`,base,[view('h0',768,0),view('h400',768,400),view('h900',768,900)],768,height,id);

function realm({baseView=base,views=widths,useViews=true,width=800,height=600,player=true,objects=[]}={}) {
  const trace=[];const viewport={width,height};let resize,message;
  const $=x=>({height:()=>viewport.height,width:()=>viewport.width,removeClass:name=>trace.push(['removeClass',name]),addClass:name=>trace.push(['addClass',name]),not(){return this;},children:()=>({length:0}),css:()=>{},length:0});
  $.extend=extend;
  const query={each:fn=>objects.forEach(o=>fn(o,o.id)),jQuery:()=>$('all')};
  const ax=()=>query;
  const sink=name=>(...args)=>trace.push([name,...args]);
  Object.assign(ax,{adaptive:{triggerEvent:sink('bindable:viewChanged')},pageData:{defaultAdaptiveView:baseView,adaptiveViews:views,page:{style:{},adaptiveStyles:{},diagram:{objects:[]}},masters:{}},
    document:{configuration:{useViews},stylesheet:{defaultStyle:{},stylesById:{}}},
    style:{clearAdaptiveStyles:sink('clearAdaptiveStyles'),reselectElements:sink('reselectElements'),updateElementIdImageStyle:()=>{},clearAppliedStyles:sink('clearAppliedStyles'),updateImage:()=>{},transformTextWithVerticalAlignment:()=>{},getElementImageOverride:()=>{},generateState:()=> 'normal',computeAllOverrides:()=>({}),setAdaptiveStyle:()=>{}},
    visibility:{resetLimboAndHiddenToDefaults:()=>{},clearMovedAndResized:sink('clearGeometry'),clearLimboAndHidden:()=>{}},
    repeater:{refreshAllRepeaters:sink('repeaters'),getScriptIdFromElementId:x=>x},
    placeholderManager:{refreshPlaceholder:()=>{}},annotation:{updateAllFootnotes:sink('footnotes')},expr:{updateAutoFitted:sink('autofit')},
    dynamicPanelManager:Object.fromEntries(['updateParentsOfNonDefaultFitPanels','updatePercentPanelCache','updateAllLayerSizeCaches','resetFixedPanel','resetAdaptivePercentPanel'].map(x=>[x,()=>{}])),
    getParentRepeaterFromElementIdExcludeSelf:()=>false,public:{fn:{IsTreeNodeObject:()=>false,IsDynamicPanel:()=>false}},
    viewChangePageAndMasters:sink('page-master-viewchange'),postAdaptiveViewChanged:sink('player-post'),postResize:sink('resize'),
    messageCenter:{addMessageListener:fn=>{message=fn;}},constants:{CONNECTOR_TYPE:'connector'}});
  const axure=()=>query;axure.resize=fn=>{resize=fn;};axure.utils={isInPlayer:()=>player};
  const c=vm.createContext({$ax:ax,$axure:axure,$,window:{location:{href:'https://example.invalid/demo.html?x=1'}},document:{getElementById:()=>undefined},_applyView:sink('applyView'),console:{log:()=>{}}});
  vm.runInContext([controls,selection,chain,messages].join('\n'),c);
  return {c,ax,trace,viewport,resize:()=>resize({tag:'resize'}),message:(name,data)=>message(name,data),read:code=>vm.runInContext(code,c)};
}
function eventNames(trace){return trace.map(x=>x[0]);}
test('useViews false disables automatic candidates but retains forced IDs',()=>{
  const r=realm({useViews:false});r.ax.adaptive.initialize();assert.equal(r.ax.adaptive.currentViewId,undefined);assert.equal(r.read('_enabledViews.length'),0);
  r.ax.adaptive.setAdaptiveView('medium');assert.equal(r.ax.adaptive.currentViewId,'medium');assert.equal(r.read('_auto'),false);
  return {enabled:r.read('_enabledViews.length'),forced:r.ax.adaptive.currentViewId,trace:r.trace};
});
test('per-view enabled false still included when configuration enabled',()=>{
  const r=realm({views:[view('disabled',500,0,{enabled:false})]});r.ax.adaptive.initialize();assert.equal(r.ax.adaptive.currentViewId,'disabled');return {selected:r.ax.adaptive.currentViewId};
});
test('page isAdaptiveEnabled false is not an active guard',()=>{const r=realm();r.ax.pageData.isAdaptiveEnabled=false;r.ax.adaptive.initialize();assert.equal(r.ax.adaptive.currentViewId,'medium');return {current:r.ax.adaptive.currentViewId};});
test('automatic initialize selects before loadFinished page/master event',()=>{
  const r=realm();r.ax.adaptive.initialize();assert.equal(r.ax.adaptive.currentViewId,'medium');assert.ok(!eventNames(r.trace).includes('page-master-viewchange'));
  r.ax.adaptive.loadFinished();r.ax.adaptive.loadFinished();assert.equal(eventNames(r.trace).filter(x=>x==='page-master-viewchange').length,1);return {trace:r.trace};
});
test('Base loadFinished only posts player notification',()=>{
  const r=realm({width:100});r.ax.adaptive.initialize();r.ax.adaptive.loadFinished();assert.deepEqual(r.trace,[['player-post']]);return {trace:r.trace};
});
test('same-view resize sends resize but not view event',()=>{
  const r=realm();r.ax.adaptive.initialize();r.ax.adaptive.loadFinished();r.trace.length=0;r.viewport.width=900;r.resize();assert.deepEqual(eventNames(r.trace),['resize']);return {trace:r.trace};
});
test('different-view resize posts view before resize',()=>{
  const r=realm();r.ax.adaptive.initialize();r.ax.adaptive.loadFinished();r.trace.length=0;r.viewport.width=1300;r.resize();
  const names=eventNames(r.trace);assert.ok(names.indexOf('bindable:viewChanged')<names.indexOf('page-master-viewchange'));assert.ok(names.indexOf('page-master-viewchange')<names.indexOf('resize'));return {trace:r.trace};
});
test('forced selection disables resizing; auto recomputes immediately',()=>{
  const r=realm();r.ax.adaptive.initialize();r.ax.adaptive.setAdaptiveView('small');r.viewport.width=1300;r.resize();assert.equal(r.ax.adaptive.currentViewId,'small');
  r.ax.adaptive.setAdaptiveView('auto');assert.equal(r.ax.adaptive.currentViewId,'large');return {current:r.ax.adaptive.currentViewId,auto:r.read('_auto')};
});
test('default alias forces Base; setAuto true alone does not recompute',()=>{
  const r=realm();r.ax.adaptive.initialize();r.ax.adaptive.setAdaptiveView('default');assert.equal(r.ax.adaptive.currentViewId,'');r.ax.adaptive.setAuto(true);assert.equal(r.ax.adaptive.currentViewId,'');r.resize();assert.equal(r.ax.adaptive.currentViewId,'medium');return {trace:r.trace};
});
test('forced same-view only player post when explicit force token supplied',()=>{
  const r=realm();r.ax.adaptive.initialize();r.ax.adaptive.loadFinished();r.trace.length=0;r.read("_handleLoadViewId('medium','forced')");assert.deepEqual(r.trace,[['player-post','forced']]);return {trace:r.trace};
});
test('pre-initialize forced selection deferred and applied',()=>{
  const r=realm();r.ax.adaptive.setAdaptiveView('large');assert.equal(r.ax.adaptive.currentViewId,undefined);r.ax.adaptive.initialize();assert.equal(r.ax.adaptive.currentViewId,'large');return {auto:r.read('_auto'),current:r.ax.adaptive.currentViewId};
});
test('empty view list does not apply pending forced view during initialize',()=>{
  const r=realm({views:[]});r.ax.adaptive.setAdaptiveView('missing');r.ax.adaptive.initialize();assert.equal(r.ax.adaptive.currentViewId,undefined);return {trace:r.trace,initialized:r.read('_isAdaptiveInitialized()')};
});
test('unknown forced ID is accepted by native control layer',()=>{
  const r=realm();r.ax.adaptive.initialize();r.ax.adaptive.setAdaptiveView('missing');assert.equal(r.ax.adaptive.currentViewId,'missing');assert.deepEqual(clone(r.ax.adaptive.getAdaptiveIdChain('missing')),[]);return {current:r.ax.adaptive.currentViewId,trace:r.trace};
});
test('sidebar size preinitialize takes priority over pending forced ID',()=>{
  const r=realm();r.ax.adaptive.setAdaptiveView('large');r.message('setAdaptiveViewForSize',{width:400,height:300});r.ax.adaptive.initialize();assert.equal(r.ax.adaptive.currentViewId,'small');return {current:r.ax.adaptive.currentViewId,auto:r.read('_auto'),sidebar:r.read('_autoIsHandledBySidebar')};
});
test('sidebar size forces selection even while auto false without enabling auto',()=>{
  const r=realm();r.ax.adaptive.initialize();r.ax.adaptive.setAdaptiveView('large');r.message('setAdaptiveViewForSize',{width:400,height:300});assert.equal(r.ax.adaptive.currentViewId,'small');assert.equal(r.read('_auto'),false);return {trace:r.trace,auto:r.read('_auto')};
});
test('sidebar-owned auto suppresses normal window resize',()=>{
  const r=realm();r.ax.adaptive.initialize();r.message('setAdaptiveViewForSize',{width:400,height:300});r.viewport.width=1300;r.resize();assert.equal(r.ax.adaptive.currentViewId,'small');r.ax.adaptive.setAdaptiveView('auto');assert.equal(r.ax.adaptive.currentViewId,'small');return {trace:r.trace};
});
test('switch message requires player and matching decoded filename',()=>{
  const r=realm();r.ax.adaptive.initialize();r.message('switchAdaptiveView',{src:'other.html',view:'large'});assert.equal(r.ax.adaptive.currentViewId,'medium');r.message('switchAdaptiveView',{src:'demo.html',view:'large'});assert.equal(r.ax.adaptive.currentViewId,'large');
  const x=realm({player:false});x.ax.adaptive.initialize();x.message('switchAdaptiveView',{src:'demo.html',view:'large'});assert.equal(x.ax.adaptive.currentViewId,'medium');return {matching:r.ax.adaptive.currentViewId,notPlayer:x.ax.adaptive.currentViewId};
});

const inheritance=[view('leaf',700,0,{baseViewId:'parent'}),view('unrelated',500),view('parent',900,0,{baseViewId:'grand'}),view('grand',300)];
test('ancestry follows IDs not breakpoint or array order',()=>{const r=realm({views:inheritance});r.ax.adaptive.initialize();const actual=clone(r.ax.adaptive.getAdaptiveIdChain('leaf'));assert.deepEqual(actual,['grand','parent','leaf']);return {chain:actual};});
test('missing parent ends chain; Base and missing views have empty chain',()=>{const r=realm({views:[view('orphan',600,0,{baseViewId:'missing'})]});r.ax.adaptive.initialize();const actual=['orphan','','missing'].map(id=>clone(r.ax.adaptive.getAdaptiveIdChain(id)));assert.deepEqual(actual,[['orphan'],[],[]]);return {chains:actual};});
test('default GUID with self parent is excluded from named view table',()=>{
  const r=realm({baseView:view('native-default-guid',0,0,{baseViewId:'native-default-guid'}),views:[view('phone',390,0,{baseViewId:'native-default-guid'})]});
  r.ax.adaptive.initialize();assert.equal(r.read("Object.hasOwn(_idToView,'native-default-guid')"),false);assert.deepEqual(clone(r.ax.adaptive.getAdaptiveIdChain('phone')),['phone']);
  return {namedIds:r.read('Object.keys(_idToView)'),chain:clone(r.ax.adaptive.getAdaptiveIdChain('phone'))};
});
test('cycle is not guarded in retained ancestry loop',()=>{const r=realm({views:[view('cycle',600,0,{baseViewId:'cycle'})]});r.ax.adaptive.initialize();assert.throws(()=>vm.runInContext("$ax.adaptive.getAdaptiveIdChain('cycle')",r.c,{timeout:30}),/timed out/);return {boundedHarnessTimeoutMs:30};});
test('page style shallow-merges base then ancestor to leaf',()=>{const r=realm({views:inheritance});r.ax.adaptive.initialize();r.ax.pageData.page.style={fill:'base',size:{width:100,height:100},baseOnly:1};r.ax.pageData.page.adaptiveStyles={grand:{fill:'grand',ancestor:1},parent:{fill:'parent',size:{width:200}},leaf:{leafOnly:1}};r.ax.adaptive.currentViewId='leaf';const actual=clone(r.ax.adaptive.getPageStyle());assert.deepEqual(actual,{fill:'parent',size:{width:200},baseOnly:1,ancestor:1,leafOnly:1});return actual;});
test('zero width and height style properties survive inherited merge',()=>{const r=realm({views:inheritance});r.ax.adaptive.initialize();r.ax.pageData.page.style={size:{width:100,height:100}};r.ax.pageData.page.adaptiveStyles={grand:{size:{width:200,height:300}},leaf:{size:{width:0,height:0}}};r.ax.adaptive.currentViewId='leaf';const actual=clone(r.ax.adaptive.getPageStyle());assert.deepEqual(actual.size,{width:0,height:0});return actual;});
test('master ancestry uses independent master view ID table',()=>{const r=realm();r.ax.adaptive.initialize();r.ax.pageData.masters.m={adaptiveViews:[view('parent',1),view('leaf',1,0,{baseViewId:'parent'})]};const actual=clone(r.ax.adaptive.getMasterAdaptiveIdChain('m','leaf'));assert.deepEqual(actual,['parent','leaf']);assert.deepEqual(clone(r.ax.adaptive.getMasterAdaptiveIdChain('m','medium')),[]);return {chain:actual};});

function styleRealm(owner={type:'Axure:Page'}) {
  const r=realm({views:inheritance});r.ax.adaptive.initialize();
  const object={id:'w',owner,type:'buttonShape',style:{fill:'base',baseOnly:1,stateStyles:{selected:{fill:'baseSelected',baseState:1}}},adaptiveStyles:{grand:{fill:'grand',ancestor:1,stateStyles:{selected:{fill:'grandSelected',ancestorState:1}}},parent:{fill:'parent',middle:1},leaf:{fill:'leaf',leafOnly:1}}};
  r.ax.getObjectFromElementId=()=>object;r.ax.deepCopy=clone;r.ax.visibility.GetCurrentPanelDiagram=()=>undefined;
  Object.assign(r.c,{$obj:()=>object,_shapesWithSetRichText:{},NORMAL:'normal',MOUSE_OVER:'mouseOver',MOUSE_DOWN:'mouseDown',FOCUSED:'focused',SELECTED:'selected',ERROR:'error',HINT:'hint',DISABLED:'disabled'});
  for(const name of ['MouseOver','MouseDown','Focused','Selected','Error','Hint','Disabled'])r.c['_stateHas'+name]=state=>state===name.charAt(0).toLowerCase()+name.slice(1);
  vm.runInContext(styles,r.c);return {...r,object};
}
test('ordinary normal properties accumulate over full ancestry',()=>{const r=styleRealm();const actual=clone(r.ax.style.computeFullStyle('w','normal','leaf'));assert.equal(actual.fill,'leaf');assert.equal(actual.ancestor,1);assert.equal(actual.middle,1);assert.equal(actual.baseOnly,1);return actual;});
test('nearest defined state replaces ancestor state as a unit',()=>{const r=styleRealm();r.object.adaptiveStyles.leaf.stateStyles={selected:{color:'leafSelected'}};const actual=clone(r.ax.style.computeFullStyle('w','selected','leaf'));assert.equal(actual.color,'leafSelected');assert.equal(actual.fill,'leaf');assert.equal(actual.ancestorState,undefined);assert.equal(actual.baseState,undefined);return actual;});
test('missing nearest state map inherits nearest ancestor state',()=>{const r=styleRealm();const actual=clone(r.ax.style.computeFullStyle('w','selected','leaf'));assert.equal(actual.fill,'grandSelected');assert.equal(actual.ancestorState,1);assert.equal(actual.baseState,undefined);return actual;});
test('explicit empty state map blocks all older states',()=>{const r=styleRealm();r.object.adaptiveStyles.leaf.stateStyles={};const actual=clone(r.ax.style.computeFullStyle('w','selected','leaf'));assert.equal(actual.fill,'leaf');assert.equal(actual.ancestorState,undefined);assert.equal(actual.baseState,undefined);return actual;});
test('a state map defining only another state still blocks selected inheritance',()=>{const r=styleRealm();r.object.adaptiveStyles.leaf.stateStyles={mouseOver:{color:'blue'}};const actual=clone(r.ax.style.computeFullStyle('w','selected','leaf'));assert.equal(actual.fill,'leaf');assert.equal(actual.ancestorState,undefined);return actual;});
test('master style chain is selected by containing RDO viewOverride',()=>{
  const r=styleRealm({type:'referenceDiagramObject',scriptIds:['rdo'],masterId:'m'});r.ax.pageData.masters.m={adaptiveViews:[view('mBase',1),view('mLeaf',1,0,{baseViewId:'mBase'})]};
  const nativeFull=r.ax.style.computeFullStyle;r.ax.style.computeFullStyle=(id,...args)=>id==='rdo'?{viewOverride:'mLeaf'}:nativeFull(id,...args);
  const actual=clone(r.ax.style.getViewIdChain('leaf','w',r.object));assert.deepEqual(actual,['mBase','mLeaf']);return {chain:actual};
});
test('view application enumerates once with complete chain, then visibility and percent cache',()=>{
  const r=realm({views:inheritance});r.ax.adaptive.initialize();const obj={id:'w',owner:{type:'Axure:Page'},style:{},adaptiveStyles:{grand:{size:{width:10}},leaf:{size:{width:20}}}};
  const trace=[];const jq={add(){return this;},find(){return this;},addClass:id=>trace.push(['class',id])};const query={jQuery:()=>jq,each:fn=>fn(obj,'w')};
  r.ax.annotation.jQueryAnn=()=>jq;r.ax.public.fn.convertToSingleImage=()=>trace.push(['convert']);r.c.$jobj=()=>jq;
  r.ax.style.computeAllOverrides=(id,p,state,current)=>(trace.push(['compute',current]),{visible:false});r.ax.style.setAdaptiveStyle=()=>trace.push(['paint']);r.ax.visibility.addLimboAndHiddenIds=(limbo,hidden)=>trace.push(['visibility',clone(hidden)]);r.ax.dynamicPanelManager.updatePercentPanelCache=()=>trace.push(['percent']);
  vm.runInContext(apply,r.c);r.ax.adaptive.applyView('leaf',query);assert.deepEqual(trace,[['class','leaf'],['convert'],['convert'],['compute','leaf'],['paint'],['visibility',{w:true}],['percent']]);return {trace};
});
test('image lookup prefers most specific view and source-specific image key',()=>{
  const r=realm();r.ax.style.highestPriorityBaseState=s=>s;r.ax.style.getElementImageOverride=()=>undefined;r.ax.style.decomposeState=()=>undefined;vm.runInContext(imageLookup,r.c);
  const images={'selected~grand':'grand','selected~leaf':'leaf','w~selected~leaf':'source-leaf'};
  const actual=r.c._matchImage('w',images,['grand','parent','leaf'],'selected');assert.equal(actual,'source-leaf');return {selected:actual};
});
test('image lookup checks base requested state before state decomposition',()=>{
  const r=realm();r.ax.style.highestPriorityBaseState=s=>s;r.ax.style.getElementImageOverride=()=>undefined;r.ax.style.decomposeState=s=>s==='selected'?'normal':undefined;vm.runInContext(imageLookup,r.c);
  const images={'normal~leaf':'leaf-normal','selected~':'base-selected','normal~':'base-normal'};
  const actual=r.c._matchImage('w',images,['leaf'],'selected');assert.equal(actual,'base-selected');return {selected:actual};
});

function eventRealm() {
  const r=realm();const trace=[];const constants={PAGE_TYPE:'page',REFERENCE_DIAGRAM_OBJECT_TYPE:'rdo',DYNAMIC_PANEL_TYPE:'panel',REPEATER:'repeater',LAYER_TYPE:'layer',ALL_TYPE:'all'};
  r.ax.constants=constants;r.ax.public.fn=Object.fromEntries(Object.entries({ReferenceDiagramObject:'rdo',DynamicPanel:'panel',Repeater:'repeater',Layer:'layer',Table:'table',MenuObject:'menu',TreeNodeObject:'tree'}).map(([k,v])=>['Is'+k,t=>t===v]));
  r.ax.getScriptIdFromPath=p=>p.includes('limbo')?undefined:p.join('/');r.ax.getjBrowserEvent=()=>({});r.ax.getEventInfoFromEvent=(e,skip,id)=>({id});r.ax.event={raiseSyntheticEvent:(...args)=>trace.push(['synthetic',...args])};
  r.ax.pageData.page.name='Page';r.ax.pageData.page.interactionMap={onAdaptiveViewChange:{name:'Page'}};
  r.axure=undefined;r.c.$axure.messageCenter={postMessage:(name,data)=>trace.push(['post',name,clone(data)])};r.c.window.name='mainFrame';r.c.window.parent={};
  Object.assign(r.c,{CHROME_5_LOCAL:false,_event:{},eventNesting:0,_handleEvent:(id,info,event,skip,synthetic)=>trace.push(['event',event.name,id,skip,synthetic])});
  vm.runInContext(events,r.c);return {...r,eventTrace:trace};
}
test('page/master dispatch preorder includes every panel state and layer, excludes repeater descent',()=>{
  const r=eventRealm();const master=(id,name,objects=[])=>r.ax.pageData.masters[id]={interactionMap:{onAdaptiveViewChange:{name}},diagram:{objects}};
  master('m1','M1',[{id:'nested',type:'rdo',masterId:'m2'}]);master('m2','M2');master('m3','M3');
  r.ax.pageData.page.diagram.objects=[{id:'first',type:'rdo',masterId:'m1'},{id:'p',type:'panel',diagrams:[{objects:[{id:'stateA',type:'rdo',masterId:'m3'}]},{objects:[{id:'stateB',type:'rdo',masterId:'m3'}]}]},{id:'r',type:'repeater',objects:[{id:'unseen',type:'rdo',masterId:'m3'}]},{id:'layer',type:'layer',objs:[{id:'insideLayer',type:'rdo',masterId:'m3'}]},{id:'limbo',type:'rdo',masterId:'m3'},{id:'box',type:'box'}];
  r.ax.viewChangePageAndMasters('auto');const eventIds=r.eventTrace.filter(x=>x[0]==='event').map(x=>x[2]);assert.deepEqual(eventIds,['','first','first/nested','stateA','stateB','insideLayer']);assert.equal(r.eventTrace.at(-1)[0],'post');assert.ok(r.eventTrace.filter(x=>x[0]==='event').every(x=>x[3]===false&&x[4]===true));return {trace:r.eventTrace};
});
test('notification posts only to recognized player; cross-origin access is caught',()=>{
  const r=eventRealm();r.c.window.name='other';r.c.window.parent={};r.ax.postAdaptiveViewChanged('auto');assert.deepEqual(r.eventTrace,[]);
  r.c.window.parent={$:()=>({length:1})};r.ax.postAdaptiveViewChanged('auto');assert.equal(r.eventTrace.length,1);
  r.eventTrace.length=0;Object.defineProperty(r.c.window,'parent',{get(){throw Error('cross-origin');},configurable:true});r.ax.postAdaptiveViewChanged('auto');assert.deepEqual(r.eventTrace,[]);return {caughtCrossOrigin:true};
});

const output={schema:'adaptive-hierarchy-original-probe-v1',capturedAt:new Date().toISOString(),
  artifact:{version:'11.0.0.4150',distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7'},
  kind:'Exact retained JavaScript slices in Node VM. View data, jQuery shallow extend/window sizes, DOM/style endpoints and terminal event actions are controlled adapters. No original GUI or complete generated-page DOM/CSS execution.',
  sources:Object.keys(source).map(name=>({path:path.join(root,name),sha256:sha(source[name])})),ranges,passed:results.length,results,
  bounds:{comparatorNameSearch:{name:'_getCondCompare',retainedAdaptiveFileContains:source['adaptive.js'].includes('_getCondCompare')},cycleHarnessTimeoutMs:30,noNetwork:true,productChanged:false}};
fs.writeFileSync('research/adaptive-hierarchy-probe.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({passed:results.length,output:'research/adaptive-hierarchy-probe.json'}));
