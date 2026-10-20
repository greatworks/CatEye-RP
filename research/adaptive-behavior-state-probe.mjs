import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Research only. Retained source slices execute in NodeVM; synthetic records,
// jQuery shallow operations, DOM classes and terminal paint/measure sinks are explicit.
const root = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const pins = {
  'adaptive.js': 'e141ea07bb973b6007f2ad7d7205516a041a801ec97e410467352c27af3b2928',
  'style.js': 'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c',
  'events.js': 'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3',
};
const sources = Object.fromEntries(Object.keys(pins).map(file => {
  const text = fs.readFileSync(path.join(root,file),'utf8'); assert.equal(sha(text),pins[file]); return [file,text];
}));
const slices = [];
function slice(file,first,last,label) {
  const text=sources[file].split(/\r?\n/).slice(first-1,last).join('\n');
  slices.push({file,first,last,label,sha256:sha(text)}); return text;
}
const parts = [
  slice('style.js',75,104,'widgetHasState / SetWidgetHover'),
  slice('style.js',129,166,'SetWidgetMouseDown / generateFullState / compoundStates'),
  slice('style.js',176,184,'SetWidgetFocused'),
  slice('style.js',255,257,'IsWidgetSelected'),
  slice('style.js',271,273,'IsWidgetError'),
  slice('style.js',287,289,'ShowingHint'),
  slice('style.js',322,324,'IsWidgetDisabled'),
  slice('style.js',349,592,'state constants / predicates / generateState'),
  slice('style.js',964,989,'clearAppliedStyles'),
  slice('style.js',1647,1736,'applyImageAndTextJson / state classes'),
  slice('style.js',1763,1915,'full style / override / state-map lookup'),
  slice('style.js',2328,2416,'reselect / adaptive clear and set'),
  slice('style.js',2444,2532,'text CSS conversion / per-node application'),
  slice('adaptive.js',48,159,'switchView'),
  slice('adaptive.js',245,317,'applyView / applyAdaptiveViewOnObject'),
];
const svgStyleSource=slice('style.js',1001,1008,'applySvg style input selection only; drawing replaced with recorder');
const focusBindings=slice('events.js',778,784,'focus/blur callback bodies; registration receiver is a harness sink');
const copy=x=>JSON.parse(JSON.stringify(x));
const keys=['normal','mouseOver','mouseDown','focused','selected','error','hint','disabled'];
const flags=['mouseOver','mouseDown','focused','selected','error','hint','disabled'];
const stateMap=prefix=>Object.fromEntries(keys.map((key,i)=>[key,{winner:`${prefix}-${key}`,[`${key}Only`]:prefix,opacity:(i+1)/10}]));
const results=[];
function probe(name,fn) {
  try { results.push({name,status:'pass',observed:fn()}); }
  catch(error){results.push({name,status:'fail',error:error.stack});}
}

function realm({previous='leaf',state={},base={},views={},stylesById={},containedParent,richSet=false,actionStyle=null,type='buttonShape',inRepeater=false}={}) {
  const widget={type,isContained:!!containedParent,owner:{type:'Axure:Page'},style:{winner:'base-normal',baseOnly:true,...base},adaptiveStyles:copy(views)};
  if(containedParent)widget.parent=containedParent;
  const objects={w:widget};
  const nodes=Object.fromEntries(['w','w_div','w_text','w_input','w_img','state-dom'].map(id=>[id,{id,style:{opacity:'.25',width:'111px',height:'77px',left:'19px',top:'31px'},classes:new Set(state.focused?['focused']:[]),tagName:id==='w_img'?'svg':'div'}]));
  const trace=[];
  const wrap=node=>{
    const q={length:node?1:0,0:node,hasClass:c=>node?.classes.has(c)??false,
      addClass:c=>(node?.classes.add(c),q),removeClass:c=>(node?.classes.delete(c),q),
      css:patch=>{if(typeof patch==='string')return node?.style[patch];if(node)Object.assign(node.style,patch);trace.push({kind:'css-sink',id:node?.id,patch:copy(patch)});return q;},
      children:selector=>selector?{length:0}:{length:4,css:patch=>{for(const id of ['w_div','w_text','w_input','state-dom'])Object.assign(nodes[id].style,patch);trace.push({kind:'child-css-sink',patch:copy(patch)});}},
      parent:()=>({hasClass:()=>false}),find:()=>({length:0,css:()=>{}})}; return q;
  };
  const all={not:()=>all,addClass:name=>trace.push({kind:'view-class',name}),removeClass:name=>trace.push({kind:'remove-view-class',name})};
  const $=value=>value==='*'?all:wrap(typeof value==='string'?nodes[value.replace(/^#/,'')]:value);
  $.extend=(target,...items)=>{for(const item of items)if(item)for(const key in item)if(item[key]!==undefined)target[key]=item[key];return target;};
  $.isEmptyObject=value=>!Object.keys(value).length;
  const chain=id=>id==='leaf'?['grand','parent','leaf']:id==='parent'?['grand','parent']:id==='grand'?['grand']:id?[id]:[];
  const each=fn=>fn(widget,'w');
  const ax=selector=>({each,getParents:()=>[['rdo']]});
  Object.assign(ax,{
    style:{},event:{mouseOverIds:state.mouseOver?['w']:[],mouseDownObjectId:state.mouseDown?'w':''},
    document:{stylesheet:{defaultStyle:{defaultOnly:true},stylesById:copy(stylesById)}},deepCopy:copy,
    adaptive:{currentViewId:previous,getAdaptiveIdChain:chain,getMasterAdaptiveIdChain:(id,view)=>{trace.push({kind:'master-chain',id,view});return ['master-parent','master-leaf'];},triggerEvent:event=>trace.push({kind:event})},
    public:{fn:{IsTreeNodeObject:()=>false,IsDynamicPanel:t=>t==='dynamicPanel',IsImageBox:t=>t==='imageBox',IsReferenceDiagramObject:()=>false,IsTableCell:t=>t==='tableCell',convertToSingleImage:()=>{}}},
    constants:{CONNECTOR_TYPE:'connector'},getObjectFromElementId:id=>objects[id],
    getParentRepeaterFromElementIdExcludeSelf:()=>inRepeater?'r':undefined,getParentRepeaterFromScriptId:()=>inRepeater?'r':undefined,
    GetTextPanelId:()=> 'w_text',GetButtonShapeId:id=>id,
    repeater:{getScriptIdFromElementId:id=>id,applySuffixToElementId:(id,suffix)=>id+suffix,refreshAllRepeaters:()=>trace.push({kind:'refresh-repeaters-sink'})},
    visibility:{GetCurrentPanelDiagram:()=>undefined,clearMovedAndResized:()=>trace.push({kind:'clear-geometry-sink'}),clearLimboAndHidden:()=>{},resetLimboAndHiddenToDefaults:()=>{},addLimboAndHiddenIds:(limbo,hidden)=>trace.push({kind:'visibility-sink',limbo:copy(limbo),hidden:copy(hidden)})},
    dynamicPanelManager:Object.fromEntries(['resetFixedPanel','resetAdaptivePercentPanel','setFitToContentCss','updateParentsOfNonDefaultFitPanels','updatePercentPanelCache','updateAllLayerSizeCaches'].map(name=>[name,()=>trace.push({kind:name})])),
    expr:{updateAutoFitted:()=>trace.push({kind:'remeasure-sink'})},placeholderManager:{refreshPlaceholder:()=>{}},annotation:{updateAllFootnotes:()=>{}},
  });
  const c=vm.createContext({$ax:ax,$axure:()=>({each}),$,$jobj:id=>wrap(nodes[id]),$obj:id=>objects[id],
    document:{getElementById:id=>nodes[id]},window:{},console:{log:()=>{}},_loadFinished:false,_getAdaptiveIdChain:chain,
    _enableStateTransitions:()=>false,disableStateTransitionsOnEnd:()=>{},_isRolloverOverride:()=>false,_updateElementIdImageStyle:()=>{},
    _resetTextJson:()=>trace.push({kind:'reset-text-cache-sink'}),_clearWidgetAppliedCorners:()=>{},_updateCornersForBorders:()=>{},
    _applyTextStyle:(id,style)=>{trace.push({kind:'text-paint-sink',id,style:copy(style)});return{width:50,height:20};},
    _applyImage:()=>{},_transformTextWithVerticalAlignment:(_id,fn)=>fn(),recordPaint:(id,event,style)=>trace.push({kind:'svg-style-sink',id,event,style:copy(style)}),
  });
  const initial=`var _style=$ax.style,_originalTextCache={},_shapesWithSetRichText=${JSON.stringify(richSet?{w:true}:{})},_adaptiveStyledWidgets=${JSON.stringify(previous?{w:{}}:{})},_idToAppliedStyles=${JSON.stringify(actionStyle?{w:{classList:['action-style'],style:actionStyle}}:{})};`+
    ['selected','error','hint','disabled'].map(key=>`var _${key}Widgets=${JSON.stringify(state[key]?{w:true}:{})};`).join('\n');
  vm.runInContext(initial+parts.join('\n')+`\nfunction _applySvg(id,event,style){${svgStyleSource}\nrecordPaint(id,event,overridedStyle);}`,c);
  ax.style.getElementImageOverride=()=>undefined; ax.style.updateElementIdImageStyle=()=>{};ax.style.transformTextWithVerticalAlignment=(_id,fn)=>fn();
  const run=code=>vm.runInContext(code,c,{timeout:1000});
  const data=code=>JSON.parse(run(`JSON.stringify(${code})`));
  return{widget,objects,nodes,trace,ax,run,data,full:()=>data("_computeFullStyle('w',_generateState('w'),$ax.adaptive.currentViewId)"),overrides:()=>data("_computeAllOverrides('w',null,_generateState('w'),$ax.adaptive.currentViewId)")};
}

const variants=[
  ['view absent',undefined,'parent'],['view empty',{},'parent'],['map null',{stateStyles:null},'parent'],
  ['map empty',{stateStyles:{}},null],['state null',key=>({stateStyles:{[key]:null}}),null],
  ['state empty',key=>({stateStyles:{[key]:{}}}),null],
  ['state partial',key=>({stateStyles:{[key]:{winner:'leaf'}}}),'leaf'],
  ['other state only',key=>({stateStyles:{[key==='selected'?'hint':'selected']:{winner:'other'}}}),null],
];
for(const key of keys)for(const [name,input,expected] of variants)probe(`${key} lookup: ${name}`,()=>{
  const leaf=typeof input==='function'?input(key):input;
  const views={grand:{stateStyles:stateMap('grand')},parent:{stateStyles:stateMap('parent')}};
  if(leaf!==undefined)views.leaf=leaf;
  const r=realm({base:{stateStyles:stateMap('base')},views});
  const out=r.data(`_computeStateStyleForViewChain($obj('w'),${JSON.stringify(key)},['grand','parent','leaf'],true)`);
  if(expected==='parent')assert.equal(out.winner,`parent-${key}`);
  else if(expected==='leaf'){assert.deepEqual(out,{winner:'leaf'});}
  else assert.deepEqual(out,{});
  return{leaf:leaf??'(absent)',state:key,result:out};
});
for(const key of keys)probe(`${key} falls back to Base without any adaptive map`,()=>{
  const r=realm({base:{stateStyles:stateMap('base')},views:{grand:{opacity:.1},parent:{},leaf:{}}});
  const out=r.data(`_computeStateStyleForViewChain($obj('w'),${JSON.stringify(key)},['grand','parent','leaf'],true)`);assert.equal(out.winner,`base-${key}`);return out;
});
probe('normal declaration composition survives an empty state map barrier',()=>{
  const r=realm({state:{selected:true},base:{stateStyles:{selected:{baseSelected:true}}},views:{grand:{grand:true,fontSize:'10px'},parent:{parent:true,fontSize:'20px',stateStyles:{selected:{parentSelected:true}}},leaf:{leaf:true,stateStyles:{}}}});
  const out=r.overrides();assert.deepEqual(out,{grand:true,fontSize:'20px',parent:true,stateStyles:{},leaf:true});return out;
});
probe('nearest state named style merges before its local state, not ancestor state',()=>{
  const r=realm({state:{selected:true},stylesById:{named:{fontSize:'13px',underline:true,winner:'named'}},views:{parent:{stateStyles:{selected:{parentOnly:true}}},leaf:{stateStyles:{selected:{baseStyle:'named',winner:'leaf'}}}}});
  const out=r.overrides();assert.equal(out.fontSize,'13px');assert.equal(out.underline,true);assert.equal(out.winner,'leaf');assert.equal(out.parentOnly,undefined);return out;
});
probe('normal named baseStyle state map does not act as local state map',()=>{
  const r=realm({state:{selected:true},stylesById:{named:{fontSize:'13px',stateStyles:{selected:{winner:'named-selected'}}}},views:{parent:{stateStyles:{selected:{winner:'parent-selected'}}},leaf:{baseStyle:'named'}}});
  const out=r.overrides();assert.equal(out.winner,'parent-selected');assert.equal(out.fontSize,'13px');return out;
});
for(const adaptive of [false,true])for(const value of [null,{}, {fontSize:'19px'}])probe(`hasState ${adaptive?'adaptive':'Base'} entry ${JSON.stringify(value)}`,()=>{
  const r=realm(adaptive?{views:{leaf:{stateStyles:{focused:value}}}}:{base:{stateStyles:{focused:value}}});
  const actual=r.run("_widgetHasState('w','focused')");assert.equal(actual,adaptive?value!==null:value!==null&&Object.keys(value).length>0);return{actual,value};
});
probe('hasState ignores leaf map barrier while effective focus patch is empty',()=>{
  const r=realm({views:{parent:{stateStyles:{focused:{fontSize:'21px'}}},leaf:{stateStyles:{}}}});
  assert.equal(r.run("_widgetHasState('w','focused')"),true);r.run("$ax.style.SetWidgetFocused('w',true)");
  assert.equal(r.nodes.w.classes.has('focused'),true);assert.equal(r.full().fontSize,undefined);return{classes:[...r.nodes.w.classes],style:r.full(),trace:r.trace};
});
probe('hasState scans current ancestors and Base but never a sibling view',()=>{
  const r=realm({views:{sibling:{stateStyles:{focused:{fontSize:'21px'}}}}});
  assert.equal(r.run("_widgetHasState('w','focused')"),false);
  r.ax.adaptive.currentViewId='sibling';assert.equal(r.run("_widgetHasState('w','focused')"),true);
  r.ax.adaptive.currentViewId='leaf';r.widget.style.stateStyles={focused:{fontSize:'12px'}};
  assert.equal(r.run("_widgetHasState('w','focused')"),true);return{leafWithSiblingOnly:false,sibling:true,leafWithBase:true};
});
probe('hasState image override can independently satisfy existence',()=>{
  const r=realm();r.ax.style.getElementImageOverride=(_id,state)=>state==='focused'?'image.svg':undefined;
  assert.equal(r.run("_widgetHasState('w','focused')"),true);assert.deepEqual(r.data("_computeStateStyleForViewChain($obj('w'),'focused',['leaf'],true)"),{});
  return{exists:true,effectiveStatePatch:{}};
});
probe('contained state climbs two owners but normal declarations remain on label',()=>{
  const parent={isContained:true,parent:{isContained:false,style:{stateStyles:stateMap('owner-base')},adaptiveStyles:{leaf:{fontSize:'99px',stateStyles:{selected:{winner:'owner-selected'}}}}}};
  const r=realm({containedParent:parent,state:{selected:true},views:{leaf:{fontSize:'15px',stateStyles:{selected:{winner:'child-selected'}}}}});
  const out=r.full();assert.equal(out.fontSize,'15px');assert.equal(out.winner,'owner-selected');return out;
});
probe('contained hasState does not climb owner even though state lookup does',()=>{
  const parent={isContained:false,style:{stateStyles:{focused:{fontSize:'19px'}}},adaptiveStyles:{}};
  const r=realm({containedParent:parent});assert.equal(r.run("_widgetHasState('w','focused')"),false);
  const effective=r.data("_computeStateStyleForViewChain($obj('w'),'focused',[],true)");assert.equal(effective.fontSize,'19px');
  r.run("$ax.style.SetWidgetFocused('w',true)");assert.equal(r.trace.length,0);return{effective,focusPaintCalls:r.trace.length};
});
probe('contained owner empty map suppresses child and Base state declarations',()=>{
  const parent={isContained:false,style:{stateStyles:stateMap('owner')},adaptiveStyles:{leaf:{stateStyles:{}}}};
  const r=realm({containedParent:parent,state:{selected:true},base:{stateStyles:stateMap('label')},views:{leaf:{stateStyles:stateMap('label-leaf')}}});
  const out=r.full();assert.equal(out.winner,'base-normal');assert.equal(out.selectedOnly,undefined);return out;
});

// Every physical flag combination is sent through the original string generator
// AND original predicate tables, rather than a synthetic compound-state composer.
for(let mask=0;mask<128;mask++)probe(`generated physical state mask ${mask}`,()=>{
  const state=Object.fromEntries(flags.map((key,i)=>[key,!!(mask&(1<<i))]));
  const r=realm({state,base:{stateStyles:stateMap('base')}});const generated=r.run("_generateState('w')");
  const actual=r.full();const recognized=flags.filter(key=>r.run(`_stateHas${key[0].toUpperCase()+key.slice(1)}(${JSON.stringify(generated)})`));
  let expected=flags.filter(key=>state[key]);
  if(state.disabled)expected=expected.filter(key=>!['mouseOver','mouseDown','focused'].includes(key));
  else if(state.focused)expected=expected.filter(key=>!['mouseOver','mouseDown'].includes(key));
  // Retained 11.0.0.4150 typo: the constant begins with capital M, while the
  // generator returns lower-case m. All state predicates reject this one string.
  if(generated==='mouseOverMouseDownHint')expected=[];
  assert.deepEqual(recognized,expected);
  assert.equal(actual.winner,`base-${expected.at(-1)??'normal'}`);
  return{state,generated,recognized,winner:actual.winner};
});
probe('capitalized native constant and generated hint/down/hover string differ observably',()=>{
  const r=realm({state:{mouseOver:true,mouseDown:true,hint:true},base:{stateStyles:stateMap('base')}});
  const generated=r.run("_generateState('w')");const constant=r.run('MOUSE_OVER_MOUSE_DOWN_HINT');
  assert.equal(generated,'mouseOverMouseDownHint');assert.equal(constant,'MouseOverMouseDownHint');
  const viaConstant=r.data("_computeAllOverrides('w',null,MOUSE_OVER_MOUSE_DOWN_HINT,'leaf')");assert.equal(viaConstant.winner,'base-hint');
  return{generated,constant,generatedWinner:r.full().winner,constantWinner:viaConstant.winner};
});

for(const richSet of [false,true])probe(`adaptive direct font exclusion after rich Set Text: ${richSet}`,()=>{
  const direct={fontName:'Direct',fontSize:'27px',fontWeight:'700',fontStyle:'italic',underline:true,strikethrough:true,foreGroundFill:{color:0xff0000},horizontalAlignment:'right',letterCase:'upper',characterSpacing:3,lineSpacing:'36px',textShadow:{on:false},opacity:.7};
  const r=realm({richSet,views:{leaf:direct}});const out=r.overrides();
  for(const key of ['fontName','fontSize','fontWeight','fontStyle','underline','strikethrough','foreGroundFill','horizontalAlignment','letterCase'])assert.equal(key in out,!richSet);
  for(const key of ['characterSpacing','lineSpacing','textShadow','opacity'])assert.deepEqual(out[key],direct[key]);assert.deepEqual(r.widget.adaptiveStyles.leaf,direct);return out;
});
probe('rich Set Text does not exclude active state fonts',()=>{
  const r=realm({richSet:true,state:{selected:true},views:{leaf:{fontSize:'30px',stateStyles:{selected:{fontSize:'17px',fontStyle:'italic'}}}}});const out=r.overrides();assert.equal(out.fontSize,'17px');return out;
});
probe('rich Set Text named normal style font re-enters after direct font deletion',()=>{
  const r=realm({richSet:true,stylesById:{named:{fontSize:'21px',fontWeight:'500'}},views:{leaf:{baseStyle:'named',fontSize:'30px'}}});const out=r.overrides();assert.equal(out.fontSize,'21px');assert.equal(out.fontWeight,'500');return out;
});
probe('compound state font properties overlay independently and explicit normal resets survive',()=>{
  const r=realm({state:{mouseOver:true,selected:true,error:true},base:{stateStyles:{mouseOver:{fontSize:'25px',fontStyle:'italic',fontWeight:'700'},selected:{fontStyle:'normal',underline:false},error:{fontWeight:'400'}}}});
  const out=r.overrides();assert.equal(out.fontSize,'25px');assert.equal(out.fontStyle,'normal');assert.equal(out.fontWeight,'400');assert.equal(out.underline,false);return out;
});
probe('fill shadow and size objects replace atomically and false zero null remain raw values',()=>{
  const r=realm({state:{selected:true},base:{fill:{fillType:'linearGradient',colors:['red','blue']},outerShadow:{on:true,offsetX:10,offsetY:20},size:{width:20,height:40}},views:{parent:{opacity:.8,fill:{fillType:'linearGradient',colors:['green','white']},stateStyles:{selected:{size:{height:9},outerShadow:{on:false}}}},leaf:{fill:{fillType:'solid',color:0},opacity:0}}});
  const out=r.full();assert.deepEqual(out.fill,{fillType:'solid',color:0});assert.deepEqual(out.outerShadow,{on:false});assert.deepEqual(out.size,{height:9});assert.equal(out.opacity,0);return out;
});
probe('text conversion distinguishes reset values from truthy-only fields',()=>{
  const r=realm();const out=r.data("_getCssStyleProperties({fontName:'',fontSize:0,fontWeight:'normal',fontStyle:'normal',underline:false,strikethrough:true,characterSpacing:0,lineSpacing:0,textShadow:{on:false}})");
  assert.equal(out.runProps.textDecoration,'noneline-through');assert.equal(out.parProps.textShadow,'none');assert.equal(out.runProps.fontSize,undefined);assert.equal(out.runProps.letterSpacing,undefined);assert.equal(out.parProps.lineHeight,undefined);return out;
});
probe('text property applier uses paragraphs and nested runs but skips anchor element itself',()=>{
  const r=realm();r.run("var nodes=[{nodeName:'P',style:{}},{nodeName:'A',style:{}},{nodeName:'SPAN',style:{}}];var props=_getCssStyleProperties({fontSize:'18px',fontStyle:'italic',textShadow:{on:false},lineSpacing:'24px'});nodes.forEach(n=>_applyCssProps(n,props,false))");
  const out=r.data('nodes');assert.deepEqual(out[1].style,{});assert.equal(out[0].style.lineHeight,'24px');assert.equal(out[2].style.fontStyle,'italic');return out;
});

for(const flag of flags)probe(`view transition active ${flag} uses destination declaration without clearing physical state`,()=>{
  const r=realm({previous:'parent',state:{[flag]:true},base:{stateStyles:stateMap('base')},views:{parent:{stateStyles:stateMap('parent')},leaf:{stateStyles:stateMap('leaf')}},actionStyle:{winner:'action',opacity:.2}});
  r.run("_switchView('leaf')");const full=r.full();assert.equal(full.winner,`leaf-${flag}`);assert.deepEqual(r.data('_idToAppliedStyles'),{});
  const paints=r.trace.filter(t=>t.kind==='svg-style-sink');assert.equal(paints.at(-1).style.winner,`leaf-${flag}`);
  return{state:r.run("_generateState('w')"),fresh:full,lastPaint:paints.at(-1),classes:[...r.nodes.w.classes],trace:r.trace};
});
probe('view change into empty state map preserves selected error hint flags but paints destination normal',()=>{
  const r=realm({previous:'parent',state:{selected:true,error:true,hint:true},base:{stateStyles:stateMap('base')},views:{parent:{stateStyles:stateMap('parent')},leaf:{winner:'leaf-normal',stateStyles:{}}}});r.run("_switchView('leaf')");
  assert.equal(r.run("_generateState('w')"),'selectedErrorHint');assert.equal(r.full().winner,'leaf-normal');return{state:r.run("_generateState('w')"),full:r.full(),classes:[...r.nodes.w.classes]};
});
probe('existing focused class survives switch to view without focus capability and still suppresses pointer states',()=>{
  const r=realm({previous:'other',state:{focused:true,mouseOver:true,mouseDown:true},views:{
    other:{stateStyles:{focused:{fontSize:'21px'}}},
    leaf:{stateStyles:{mouseOver:{winner:'hover'},mouseDown:{winner:'down'}}},
  }});
  r.run("_switchView('leaf')");assert.equal(r.run("_widgetHasState('w','focused')"),false);
  assert.equal(r.run("_generateState('w')"),'focused');assert.equal(r.full().winner,'base-normal');
  r.run(`var focusCallback,blurCallback;var focusObj={focus:fn=>focusCallback=fn,blur:fn=>blurCallback=fn},elementId='w';${focusBindings}`);
  const traceLength=r.trace.length;r.run('blurCallback()');assert.equal(r.trace.length,traceLength);assert.equal(r.nodes.w.classes.has('focused'),true);
  return{hasFocusedCapability:false,generated:r.run("_generateState('w')"),classes:[...r.nodes.w.classes],full:r.full(),blurSetterPaints:0};
});
probe('same view retains applied action style and performs no re-paint',()=>{
  const r=realm({previous:'leaf',actionStyle:{fontSize:'44px'},base:{stateStyles:stateMap('base')}});r.run("_switchView('leaf')");assert.equal(r.trace.length,0);assert.equal(r.data('_idToAppliedStyles').w.style.fontSize,'44px');return{trace:r.trace,applied:r.data('_idToAppliedStyles')};
});
probe('named to Base text override recomputes before action clear while SVG style input can retain old action',()=>{
  const r=realm({previous:'leaf',state:{selected:true},base:{stateStyles:{selected:{fontSize:'20px'}}},views:{leaf:{stateStyles:{selected:{fontSize:'30px'}}}},actionStyle:{fontSize:'44px'}});r.run("_switchView('')");
  assert.equal(r.full().fontSize,'20px');assert.deepEqual(r.data('_idToAppliedStyles'),{});
  const svg=r.trace.filter(t=>t.kind==='svg-style-sink').at(-1);const text=r.trace.filter(t=>t.kind==='text-paint-sink').at(-1);
  assert.equal(svg.style.fontSize,'44px');assert.equal(text.style.fontSize,'20px');return{fresh:r.full(),svgStyleInput:svg,textStyleInput:text,trace:r.trace};
});
probe('contained adaptive apply skips terminal setter while pure owner-state lookup still resolves',()=>{
  const parent={isContained:false,style:{stateStyles:stateMap('owner')},adaptiveStyles:{leaf:{stateStyles:{selected:{fontSize:'23px'}}}}};
  const r=realm({previous:'',containedParent:parent,state:{selected:true},views:{leaf:{fontSize:'13px'}}});r.run("_applyAdaptiveViewOnObject($obj('w'),'w',['leaf'])");
  const full=r.data("_computeFullStyle('w',_generateState('w'),'leaf')");assert.equal(full.fontSize,'23px');assert.equal(r.trace.filter(t=>t.kind==='svg-style-sink').length,0);return{full,trace:r.trace};
});
probe('reference owner selects master chain through RDO viewOverride, not page chain',()=>{
  const r=realm({state:{selected:true},views:{'master-parent':{stateStyles:{selected:{winner:'master-parent'}}},'master-leaf':{stateStyles:{}}}});
  r.widget.owner={type:'referenceDiagramObject',scriptIds:['rdo'],masterId:'master-1'};
  r.objects.rdo={type:'referenceDiagramObject',owner:{type:'Axure:Page'},style:{viewOverride:'master-mode'},adaptiveStyles:{leaf:{viewOverride:'master-leaf-mode'}}};
  r.nodes.rdo={id:'rdo',style:{},classes:new Set()};
  const out=r.full();assert.equal(out.winner,'base-normal');assert.equal(r.trace.at(-1).view,'master-leaf-mode');return{full:out,trace:r.trace};
});

const out={generatedAt:new Date().toISOString(),kind:'exact-retained-JavaScript-slices-in-NodeVM',nativeGuiExecuted:false,
  version:'11.0.0.4150',distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',
  sources:Object.entries(sources).map(([file,text])=>({path:path.join(root,file),sha256:sha(text)})),slices,
  harness:{path:'research/adaptive-behavior-state-probe.mjs',sha256:sha(fs.readFileSync(import.meta.filename))},
  boundaries:['Synthetic generated-object records; no claim that null/empty state records are authorable by the native editor.',
    'jQuery extend and DOM class endpoints are explicit minimal sinks, not a full browser or original page.',
    'Original lookup, composition, state generation, CSS conversion, adaptive dispatch execute. SVG drawing/text cache restoration/measurements/repeater refresh/visibility are terminal recording sinks.',
    'Rich node style application observes assigned strings, not browser CSS acceptance or glyph pixels. Master chain retrieval is a controlled sink; the original RDO dispatch is executed.'],
  count:results.length,passed:results.filter(x=>x.status==='pass').length,failed:results.filter(x=>x.status!=='pass').length,results};
fs.writeFileSync('research/adaptive-behavior-state-probe.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({count:out.count,passed:out.passed,failed:out.failed,failures:results.filter(x=>x.status!=='pass')},null,2));
if(out.failed)process.exitCode=1;
