import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Research only: exact retained functions, with explicit paint/DOM sinks.
const root = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const pins = {
  'adaptive.js': 'e141ea07bb973b6007f2ad7d7205516a041a801ec97e410467352c27af3b2928',
  'style.js': 'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c',
  'visibility.js': 'bbf8974eaa4ffa2b9800797725ada6805c47c532f47d9a5647dc205966ab8a53',
};
const sources = Object.fromEntries(['adaptive.js','style.js','visibility.js','repeater.js','events.js','flyout.js'].map(name => {
  const text = fs.readFileSync(path.join(root,name),'utf8');
  if (pins[name]) assert.equal(sha(text),pins[name]);
  return [name,text];
}));
const used = [];
function slice(file,first,last,label) {
  const text = sources[file].split(/\r?\n/).slice(first-1,last).join('\n');
  used.push({file,first,last,label,sha256:sha(text)}); return text;
}
const parts = [
  slice('style.js',74,96,'widgetHasState'),
  slice('style.js',137,166,'generateFullState/compoundStates'),
  slice('style.js',255,257,'IsWidgetSelected'),
  slice('style.js',271,273,'IsWidgetError'),
  slice('style.js',287,289,'ShowingHint'),
  slice('style.js',322,324,'IsWidgetDisabled'),
  slice('style.js',349,592,'state constants/predicates/generateState'),
  slice('style.js',964,989,'clearAppliedStyles'),
  slice('style.js',1647,1736,'applyImageAndTextJson/updateStateClasses'),
  slice('style.js',1763,1915,'FONT_PROPS/computeAllOverrides/computeFullStyle'),
  slice('style.js',2328,2416,'reselect/clearStateForRepeater/clearAdaptiveStyles/setAdaptiveStyle'),
  slice('adaptive.js',48,159,'switchView'),
  slice('adaptive.js',245,317,'applyView/applyAdaptiveViewOnObject'),
];
const svgStyleExpression = slice('style.js',1001,1008,'applySvg style source only');
const refreshAll = slice('repeater.js',472,479,'refreshAllRepeaters');
const refreshPrefix = slice('repeater.js',74,84,'refreshRepeater state reset prefix');
const initializeVisibility = slice('visibility.js',1433,1444,'visibility initialize');
const geometryLoop = slice('adaptive.js',70,92,'early inline reset loop');
const treeReset = slice('adaptive.js',59,67,'tree expansion reset');
const hintFunctions = slice('flyout.js',214,256,'placeholder registration/update');
const hintInit = slice('events.js',923,932,'placeholder post-registration initialization');
const copy = value => JSON.parse(JSON.stringify(value));
const results = [];
const blankState = () => ({selected:false,error:false,hint:false,disabled:false});

function realm({previous='',type='buttonShape',contained=false,inRepeater=false,fit=false,states={},mobile={},actionStyle={fill:'action-red',opacity:.25},parent}={}) {
  const baseStates = Object.fromEntries(['selected','error','hint','disabled'].map((key,i)=>[key,{fill:`base-${key}`,opacity:(i+1)/10,[`${key}Only`]:true}]));
  const widget = {type,isContained:contained,fitToContent:fit,owner:{type:'Axure:Page'},style:{fill:'base',opacity:1,stateStyles:baseStates},adaptiveStyles:{mobile:{fill:'mobile',opacity:.8,...mobile},wide:{fill:'wide',opacity:.9}}};
  if(parent) widget.parent = parent;
  else if(contained) widget.parent = {isContained:false,style:widget.style,adaptiveStyles:widget.adaptiveStyles};
  const nodes = Object.fromEntries(['w','w_div','w_text','w_input','w_img','state-dom'].map(id=>[id,{id,style:{top:'31px',left:'19px',width:'111px',height:'77px',opacity:'.25',transform:'rotate(21deg)'},classes:new Set(['action-style']),tagName:id==='w_img'?'svg':'div'}]));
  const trace=[];
  const each=fn=>fn(widget,'w');
  const wrap=node=>{
    const q={length:node?1:0,0:node,hasClass:c=>node?.classes.has(c)??false,
      addClass:c=>(node?.classes.add(c),q), removeClass:c=>(node?.classes.delete(c),q),
      children:selector=>selector?{length:0}:({length:4,css:patch=>{for(const id of ['w_div','w_text','w_input','state-dom'])Object.assign(nodes[id].style,patch);trace.push({kind:'child-reset',patch:copy(patch)});}}),
      css:patch=>{if(typeof patch==='string')return node?.style[patch];Object.assign(node.style,patch);trace.push({kind:'owner-reset',id:node.id,patch:copy(patch)});return q;},
      parent:()=>({hasClass:()=>false}),find:()=>({length:0,css:()=>{}})};
    return q;
  };
  const all={not:()=>all,addClass:name=>trace.push({kind:'view-class',name}),removeClass:name=>trace.push({kind:'remove-view-class',name})};
  const $=x=>x==='*'?all:wrap(typeof x==='string'?nodes[x.replace(/^#/,'')]:x);
  $.extend=(target,...values)=>{for(const value of values)if(value)for(const key in value)if(value[key]!==undefined)target[key]=value[key];return target;};
  $.isEmptyObject=o=>!Object.keys(o).length;
  const ax=()=>({each});
  const viewChain=id=>id==='mobile'?['mobile']:id==='wide'?['wide']:[];
  Object.assign(ax,{
    style:{},event:{mouseOverIds:[],mouseDownObjectId:''},document:{stylesheet:{defaultStyle:{defaultOnly:true},stylesById:{}}},
    adaptive:{currentViewId:previous,getAdaptiveIdChain:viewChain,triggerEvent:event=>trace.push({kind:event})},
    public:{fn:{IsTreeNodeObject:()=>false,IsDynamicPanel:t=>t==='dynamicPanel',IsImageBox:t=>t==='imageBox',IsReferenceDiagramObject:()=>false,IsTableCell:t=>t==='tableCell',convertToSingleImage:()=>{}}},
    constants:{CONNECTOR_TYPE:'connector'},getObjectFromElementId:()=>widget,
    getParentRepeaterFromElementIdExcludeSelf:()=>inRepeater?'r':undefined,
    getParentRepeaterFromScriptId:()=>inRepeater?'r':undefined,GetTextPanelId:()=> 'w_text',GetButtonShapeId:id=>id,
    repeater:{getScriptIdFromElementId:id=>id,applySuffixToElementId:(id,s)=>id+s,refreshAllRepeaters:()=>trace.push({kind:'refresh-repeaters-sink'})},
    visibility:{GetCurrentPanelDiagram:()=>undefined,clearMovedAndResized:()=>trace.push({kind:'clear-geometry'}),clearLimboAndHidden:()=>{},resetLimboAndHiddenToDefaults:()=>{},addLimboAndHiddenIds:(limbo,hidden)=>trace.push({kind:'visibility',limbo:copy(limbo),hidden:copy(hidden)})},
    dynamicPanelManager:Object.fromEntries(['resetFixedPanel','resetAdaptivePercentPanel','setFitToContentCss','updateParentsOfNonDefaultFitPanels','updatePercentPanelCache','updateAllLayerSizeCaches'].map(name=>[name,(...args)=>trace.push({kind:name,args})])),
    expr:{updateAutoFitted:()=>trace.push({kind:'remeasure'})},placeholderManager:{refreshPlaceholder:()=>{}},annotation:{updateAllFootnotes:()=>{}}
  });
  const c=vm.createContext({$ax:ax,$axure:()=>({each}),$,$jobj:id=>wrap(nodes[id]),$obj:()=>widget,
    document:{getElementById:id=>nodes[id]},window:{},console:{log:()=>{}},_loadFinished:false,
    _getAdaptiveIdChain:viewChain,_enableStateTransitions:()=>false,disableStateTransitionsOnEnd:()=>{},_isRolloverOverride:()=>false,
    _resetTextJson:()=>trace.push({kind:'reset-text-cache-sink'}),_clearWidgetAppliedCorners:()=>{},_updateCornersForBorders:()=>{},
    _applyTextStyle:(id,style)=>{trace.push({kind:'text-paint-sink',id,style:copy(style)});return{width:50,height:20};},
    _applyImage:()=>{},_transformTextWithVerticalAlignment:(_id,fn)=>fn(),
    recordPaint:(id,event,style)=>trace.push({kind:'svg-paint-sink',id,event,style:copy(style)}),
  });
  const dicts=Object.fromEntries(Object.entries({...blankState(),...states}).map(([key,val])=>[`_${key==='disabled'?'disabled':key}Widgets`,val?{w:true}:{}]));
  const initial=`var _style=$ax.style,_originalTextCache={},_shapesWithSetRichText={},_adaptiveStyledWidgets=${JSON.stringify(previous?{w:{}}:{})},_idToAppliedStyles=${JSON.stringify(actionStyle?{w:{classList:['action-style'],style:actionStyle}}:{})};\n`+
    Object.entries(dicts).map(([key,val])=>`var ${key}=${JSON.stringify(val)};`).join('\n');
  vm.runInContext(initial+parts.join('\n')+`\nfunction _applySvg(id,event,style){${svgStyleExpression}\nrecordPaint(id,event,overridedStyle);}`,c);
  ax.style.getElementImageOverride=()=>undefined; ax.style.updateElementIdImageStyle=()=>{};
  ax.style.transformTextWithVerticalAlignment=(_id,fn)=>fn();
  const run=code=>vm.runInContext(code,c,{timeout:1000});
  const data=code=>JSON.parse(run(`JSON.stringify(${code})`));
  return{widget,nodes,trace,ax,run,data};
}

function probe(name,fn){const observed=fn();results.push({name,status:'pass',observed});}
for(const flag of ['selected','error','hint','disabled']) probe(`named transition retains ${flag} flag and uses destination state`,()=>{
  const r=realm({states:{[flag]:true},mobile:{stateStyles:{[flag]:{fill:`mobile-${flag}`,opacity:.61}}}});
  r.run("_switchView('mobile')");
  assert.equal(r.data(`_${flag}Widgets`).w,true); assert.deepEqual(r.data('_idToAppliedStyles'),{});
  const paint=r.trace.filter(t=>t.kind==='svg-paint-sink').at(-1);
  assert.equal(paint.style.fill,`mobile-${flag}`);assert.equal(paint.style.opacity,.61);
  return{state:r.run("_generateState('w')"),paint,ownerOpacity:r.nodes.w.style.opacity,applied:r.data('_idToAppliedStyles')};
});
probe('all persistent states compose in Selected Error Hint Disabled priority',()=>{
  const r=realm({states:{selected:true,error:true,hint:true,disabled:true}});r.run("_switchView('mobile')");
  const style=r.data("_computeFullStyle('w',_generateState('w'),'mobile')");
  assert.equal(style.fill,'base-disabled');assert.equal(style.opacity,.4);
  for(const key of ['selectedOnly','errorOnly','hintOnly','disabledOnly'])assert.equal(style[key],true);
  return{state:r.run("_generateState('w')"),style};
});
probe('explicit destination empty stateStyles suppresses inherited state patches, not flags',()=>{
  const r=realm({states:{selected:true,error:true},mobile:{stateStyles:{}}});r.run("_switchView('mobile')");
  const style=r.data("_computeFullStyle('w',_generateState('w'),'mobile')");assert.equal(style.fill,'mobile');assert.equal(style.selectedOnly,undefined);assert.equal(r.run("_generateState('w')"),'selectedError');return style;
});
probe('contained label state style follows containing owner',()=>{
  const parent={isContained:false,style:{stateStyles:{selected:{fill:'parent-selected'}}},adaptiveStyles:{mobile:{stateStyles:{selected:{fill:'parent-mobile-selected'}}}}};
  const r=realm({contained:true,parent,states:{selected:true}});const style=r.data("_computeFullStyle('w',_generateState('w'),'mobile')");assert.equal(style.fill,'parent-mobile-selected');return style;
});
probe('return Base clears action registry but last SVG paint can precede that clear',()=>{
  const r=realm({previous:'mobile',states:{selected:true}});r.run("_switchView('')");
  assert.deepEqual(r.data('_idToAppliedStyles'),{});
  const fresh=r.data("_computeFullStyle('w',_generateState('w'),'')");
  const paint=r.trace.filter(t=>t.kind==='svg-paint-sink').at(-1);
  assert.equal(fresh.fill,'base-selected');assert.equal(paint.style.fill,'action-red');
  return{lastPaint:paint,freshStyle:fresh,trace:r.trace};
});
probe('named to named clears prior action paint before final destination paint',()=>{
  const r=realm({previous:'wide',states:{error:true},mobile:{stateStyles:{error:{fill:'mobile-error'}}}});r.run("_switchView('mobile')");
  const paints=r.trace.filter(t=>t.kind==='svg-paint-sink');assert.equal(paints[0].style.fill,'action-red');assert.equal(paints.at(-1).style.fill,'mobile-error');return paints;
});
probe('same view preserves action style and geometry',()=>{
  const r=realm({previous:'mobile'});r.run("_switchView('mobile')");assert.equal(r.nodes.w.style.opacity,'.25');assert.equal(r.data('_idToAppliedStyles').w.style.fill,'action-red');assert.equal(r.trace.length,0);return{opacity:r.nodes.w.style.opacity,applied:r.data('_idToAppliedStyles')};
});
const ordinaryTypes=['buttonShape','horizontalLine','imageBox','textBox','textArea','comboBox','listBox','checkbox','radioButton','inlineFrame','table','tableCell','menuObject','treeNodeObject','repeater','dynamicPanel'];
for(const type of ordinaryTypes)probe(`early reset gate: ${type}`,()=>{
  const r=realm({type,actionStyle:null});r.run("_switchView('mobile')");assert.equal(r.nodes.w.style.opacity,'');assert.equal(r.nodes.w.style.top,'');
  const childReset=type!=='dynamicPanel';assert.equal(r.nodes['state-dom'].style.opacity,childReset?'':'.25');
  return{ownerReset:r.nodes.w.style.opacity==='',immediateChildrenReset:childReset};
});
for(const config of [{name:'fit panel',type:'dynamicPanel',fit:true},{name:'contained label',contained:true},{name:'row descendant',inRepeater:true}])probe(`early reset exception: ${config.name}`,()=>{
  const r=realm({...config,actionStyle:null});r.run("_switchView('mobile')");const reset=!config.contained&&!config.inRepeater;
  assert.equal(r.nodes.w.style.opacity,reset?'':'.25');assert.equal(r.nodes['state-dom'].style.opacity,reset?'':'.25');return{ownerReset:reset,childrenReset:reset,fitCalls:r.trace.filter(t=>t.kind==='setFitToContentCss')};
});
probe('geometry gate has no parent-panel exclusion for separately enumerated child',()=>{
  const r=realm({actionStyle:null});r.widget.parent={type:'dynamicPanel',fitToContent:false};r.run("_switchView('mobile')");assert.equal(r.nodes.w.style.top,'');return{childOwnerTop:r.nodes.w.style.top,parentType:r.widget.parent.type};
});
probe('adaptive repeater dispatcher uses persist and reinitializes page info',()=>{
  const calls=[];const ax=()=>({each:fn=>{fn({type:'repeater'},'r');fn({type:'repeater'},'limbo');fn({type:'buttonShape'},'other');}});
  Object.assign(ax,{public:{fn:{IsRepeater:t=>t==='repeater'}},visibility:{isElementIdLimboOrInLimboContainer:id=>id==='limbo'},getjBrowserEvent:()=>({}),getEventInfoFromEvent:x=>x});
  const c=vm.createContext({$ax:ax,_repeaterManager:{},_refreshType:{reset:1,persist:2,preEval:3},_initPageInfo:(_o,id)=>calls.push({kind:'page-init',id}),_refreshRepeater:(id,_event,type)=>calls.push({kind:'refresh',id,type})});
  vm.runInContext(refreshAll+'\n_repeaterManager.refreshAllRepeaters()',c);assert.deepEqual(calls,[{kind:'page-init',id:'r'},{kind:'refresh',id:'r',type:2}]);return calls;
});
for(const refreshType of [1,2,3])probe(`repeater state reset prefix mode ${refreshType}`,()=>{
  const r=realm({states:{selected:true,error:true,hint:true,disabled:true},actionStyle:null});r.ax.getChildElementIdsForRepeater=()=>['w'];
  r.run(`var _refreshType={reset:1,persist:2,preEval:3},repeatersReady=true,fullRefresh={};function refreshPrefix(repeaterId,refreshType,itemsPregen){${refreshPrefix}} refreshPrefix('r',${refreshType},false)`);
  const flags=r.data('[_selectedWidgets,_errorWidgets,_hintWidgets,_disabledWidgets]');for(const map of flags)assert.equal(Boolean(map.w),refreshType!==1);return{refreshType,flags};
});
probe('initial limbo comes from ax_default_unplaced class, distinct from hidden',()=>{
  const called=[];const $=selector=>({each:fn=>{for(const id of selector==='.ax_default_hidden'?['hiddenOnly']:['unplacedOnly'])fn(0,{id});}});
  const ax=()=>({query:true});ax.visibility={};ax.repeater={getScriptIdFromElementId:id=>id};
  const c=vm.createContext({$,$ax:ax,HIDDEN_CLASS:'ax_default_hidden',UNPLACED_CLASS:'ax_default_unplaced',_defaultHidden:{},_defaultLimbo:{},_addLimboAndHiddenIds:(limbo,hidden,_query,skipRepeater)=>called.push({limbo:copy(limbo),hidden:copy(hidden),skipRepeater})});
  vm.runInContext(initializeVisibility+'\n$ax.visibility.initialize()',c);
  assert.deepEqual(called,[{limbo:{unplacedOnly:true},hidden:{hiddenOnly:true},skipRepeater:true}]);return called;
});
for(const parentType of ['treeNodeObject','dynamicPanel'])for(const fit of [false,true])probe(`contained direct DOM child through ${parentType}, fit=${fit}`,()=>{
  const objects={parent:{type:parentType,fitToContent:fit},child:{type:'buttonShape',isContained:true}};
  const nodes={parent:{id:'parent',style:{left:'99px'}},child:{id:'child',style:{left:'99px'}}};
  const c=vm.createContext({$axure:()=>({each:fn=>Object.entries(objects).forEach(([id,obj])=>fn(obj,id))}),
    $ax:{getParentRepeaterFromElementIdExcludeSelf:()=>undefined,public:{fn:{IsDynamicPanel:t=>t==='dynamicPanel'}},dynamicPanelManager:{setFitToContentCss:()=>{},resetFixedPanel:()=>{},resetAdaptivePercentPanel:()=>{}}},
    document:{getElementById:id=>nodes[id]},$:node=>({css:style=>Object.assign(node.style,style),children:()=>({length:node.id==='parent'?1:0,css:style=>Object.assign(nodes.child.style,style)})})});
  vm.runInContext(geometryLoop,c);
  assert.equal(nodes.child.style.left,parentType!=='dynamicPanel'||fit?'':'99px');return{parent:nodes.parent.style,containedChild:nodes.child.style};
});
for(const oldHint of [false,true])for(const authoredText of ['','Initial'])probe(`persist Hint initialization old=${oldHint}, template=${JSON.stringify(authoredText)}`,()=>{
  let inputValue=authoredText,hintFlag=oldHint;const writes=[];
  const inputJobj={attr:()=> 'text',val:value=>value===undefined?inputValue:(inputValue=value)};
  const ax={placeholderManager:{},repeater:{applySuffixToElementId:(id,s)=>id+s},style:{SetWidgetPlaceholder:(id,active,text)=>{hintFlag=Boolean(active&&text&&text.length);inputValue=text;writes.push({id,active,text});}}};
  const c=vm.createContext({$ax:ax,ANDROID:false,document:{getElementById:()=>({value:inputValue})},inputJobj,dObj:{placeholderText:'Hint'},elementId:'w'});
  vm.runInContext(hintFunctions+'\n'+hintInit,c);
  const managerActive=ax.placeholderManager.isActive('w');assert.equal(managerActive,!authoredText);
  assert.equal(hintFlag,authoredText?oldHint:true);
  return{oldHint,authoredText,managerActive,hintFlag,inputValue,writes};
});
for(const object of [{type:'treeNodeObject',isExpanded:true},{type:'treeNodeObject',isExpanded:false},{type:'treeNodeObject'},{type:'buttonShape',isExpanded:true}])probe(`declared tree expansion reset ${JSON.stringify(object)}`,()=>{
  const calls=[];const ax=selector=>selector==='*'?{each:fn=>fn(object,'w')}:{expanded:value=>calls.push(value)};ax.public={fn:{IsTreeNodeObject:type=>type==='treeNodeObject'}};
  vm.runInContext(treeReset,vm.createContext({$ax:ax}));
  const expected=object.type==='treeNodeObject'&&Object.hasOwn(object,'isExpanded')?[object.isExpanded]:[];assert.deepEqual(calls,expected);return{object,calls};
});

const output={schema:'adaptive-transition-original-probe-v1',capturedAt:new Date().toISOString(),kind:'Exact retained JavaScript slices in Node VM; synthetic objects and DOM/CSS adapters; terminal SVG/text paints and geometry/panel/repeater full refresh are recording sinks. Not original GUI or generated-page pixels.',artifact:{version:'11.0.0.4150',distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7'},sources:Object.entries(sources).map(([name,text])=>({path:path.join(root,name),sha256:sha(text)})),ranges:used,passed:results.length,results};
fs.writeFileSync('research/adaptive-transition-probe.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({status:'pass',cases:results.length,output:'research/adaptive-transition-probe.json'}));
