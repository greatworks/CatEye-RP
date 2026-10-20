import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Exact retained JS slices, synthetic declarations and explicit shallow-jQuery/DOM sinks.
// Does not execute the vendor DLL, authenticated GUI, full player or generated project.
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files';
const paths={style:'resources/scripts/axure/style.js',adaptive:'resources/scripts/axure/adaptive.js',player:'resources/scripts/player/axplayer.js',sitemap:'plugins/sitemap/sitemap.js'};
const sha=x=>createHash('sha256').update(x).digest('hex');
const source=Object.fromEntries(Object.entries(paths).map(([key,p])=>[key,fs.readFileSync(path.join(root,p),'utf8')]));
assert.equal(sha(source.style),'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c');
assert.equal(sha(source.adaptive),'e141ea07bb973b6007f2ad7d7205516a041a801ec97e410467352c27af3b2928');
const slices=[];
function slice(key,first,last,label){const text=source[key].split(/\r?\n/).slice(first-1,last).join('\n');slices.push({path:path.join(root,paths[key]),first,last,label,sha256:sha(text)});return text;}
const styleCode=slice('style',349,592,'state constants and predicates')+'\n'+slice('style',1763,1915,'normal/state/full style resolution');
const pageCode=slice('adaptive',208,219,'page normal style lookup');
const applyCode=slice('adaptive',271,317,'adaptive object application with paint sinks');
const cursorCode=slice('adaptive',523,580,'setDeviceMode branch body');
const playerCode=slice('player',1654,1673,'view dimensions/cursor and device decision');
const clone=x=>JSON.parse(JSON.stringify(x));
const extend=(target,...items)=>{for(const item of items)if(item)for(const k in item)if(item[k]!==undefined)target[k]=item[k];return target;};
const results=[];
function test(name,fn){try{results.push({name,status:'pass',observed:fn()});}catch(e){results.push({name,status:'fail',error:e.stack});}}
function realm({base={},views={},styles={},parent,rich=false,page={},panel={}}={}){
 const w={type:'buttonShape',owner:{type:'Axure:Page'},isContained:!!parent,parent,style:clone(base),adaptiveStyles:clone(views)};
 const objects={w}; const chain=id=>id==='leaf'?['parent','leaf']:id?[id]:[];const paint=[];
 const $=()=>({hasClass:()=>false});$.extend=extend;$.isEmptyObject=x=>!Object.keys(x).length;
 const ax={style:{},document:{stylesheet:{defaultStyle:{documentDefault:true},stylesById:clone(styles)}},deepCopy:clone,
  adaptive:{currentViewId:'leaf',getAdaptiveIdChain:chain},getObjectFromElementId:id=>objects[id],
  visibility:{GetCurrentPanelDiagram:()=>Object.keys(panel).length?{style:panel}:undefined},
  pageData:{page:{style:clone(page.style??{}),adaptiveStyles:clone(page.adaptiveStyles??{})}},
  public:{fn:{convertToSingleImage:()=>paint.push({kind:'convert-single-image'})}},constants:{CONNECTOR_TYPE:'connector'},
  repeater:{getScriptIdFromElementId:id=>id}};
 const c=vm.createContext({$ax:ax,$,$obj:id=>objects[id],$jobj:id=>({id}),_getAdaptiveIdChain:chain,
  _shapesWithSetRichText:rich?{w:true}:{},_style:ax.style,_generateFullState:()=> 'normal'});
 vm.runInContext(styleCode+'\n'+pageCode+'\n'+applyCode,c);
 ax.style.setAdaptiveStyle=(id,style,state)=>paint.push({kind:'paint-sink',id,style:clone(style),state});
 const query=(expr)=>JSON.parse(vm.runInContext('JSON.stringify('+expr+')',c,{timeout:1000}));
 return{w,ax,objects,paint,query,full:(state='normal',view='leaf')=>query(`_computeFullStyle('w',${JSON.stringify(state)},${JSON.stringify(view)})`),
  apply:()=>{c.limbo={};c.hidden={};vm.runInContext("_applyAdaptiveViewOnObject($obj('w'),'w',['parent','leaf'],'leaf',limbo,hidden)",c);return {paint:clone(paint),limbo:clone(c.limbo),hidden:clone(c.hidden)};}};
}

test('normal missing and explicit empty child both inherit ancestor',()=>{
 const r=realm({base:{fontSize:12},views:{parent:{fontSize:20,visible:false},leaf:{}}});const observed=r.full();
 assert.equal(observed.fontSize,20);assert.equal(observed.visible,false);return observed;
});
test('inactive orphan declaration is not selected by unrelated chain',()=>{
 const r=realm({base:{fontSize:12},views:{orphan:{fontSize:99,stateStyles:{selected:{fontSize:98}}}}});assert.equal(r.full('selected').fontSize,12);return r.full('selected');
});
test('normal named ancestor then local child overlay, dictionaries not mutated',()=>{
 const r=realm({base:{baseStyle:'base'},styles:{base:{fontSize:12,color:'black'},named:{fontSize:18,color:'red',opacity:.7}},views:{parent:{baseStyle:'named',fontSize:20},leaf:{color:'blue'}}});
 const observed=r.full();assert.equal(observed.fontSize,20);assert.equal(observed.color,'blue');assert.deepEqual(r.ax.document.stylesheet.stylesById.named,{fontSize:18,color:'red',opacity:.7});return observed;
});
for(const key of ['fill','borderFill','outerShadow','innerShadow','textShadow','location','size'])test(`${key} is an atomic shallow replacement`,()=>{
 const r=realm({base:{[key]:{base:true}},views:{parent:{[key]:{first:1,second:2}},leaf:{[key]:{first:0}}}});const observed=r.full()[key];assert.deepEqual(observed,{first:0});return observed;
});
for(const value of [false,0,'',null])test(`explicit primitive ${JSON.stringify(value)} survives normal overlay`,()=>{
 const r=realm({base:{testValue:1},views:{parent:{testValue:2},leaf:{testValue:value}}});assert.deepEqual(r.full().testValue,value);return r.full();
});
const stateKeys=['mouseOver','mouseDown','focused','selected','error','hint','disabled'];
for(const state of stateKeys)test(`${state}: empty normal map inherits, empty state map blocks`,()=>{
 const base={stateStyles:{[state]:{fontSize:17,color:'base'}}};
 const inherited=realm({base,views:{parent:{stateStyles:{[state]:{color:'parent'}}},leaf:{}}}).full(state);
 const blocked=realm({base,views:{parent:{stateStyles:{[state]:{color:'parent'}}},leaf:{stateStyles:{}}}}).full(state);
 assert.equal(inherited.color,'parent');assert.equal(blocked.color,undefined);assert.equal(inherited.fontSize,undefined);return{inherited,blocked};
});
for(const state of stateKeys)test(`${state}: empty state entry is also a whole-map barrier`,()=>{
 const r=realm({base:{stateStyles:{[state]:{fontSize:99}}},views:{parent:{stateStyles:{[state]:{fontSize:77}}},leaf:{stateStyles:{[state]:{}}}}});assert.equal(r.full(state).fontSize,undefined);return r.full(state);
});
test('null entire state map inherits, null entry inside a map blocks',()=>{
 const base={stateStyles:{selected:{fontSize:17}}};const inherited=realm({base,views:{leaf:{stateStyles:null}}}).full('selected');const blocked=realm({base,views:{leaf:{stateStyles:{selected:null}}}}).full('selected');
 assert.equal(inherited.fontSize,17);assert.equal(blocked.fontSize,undefined);return{inherited,blocked};
});
test('state named style and local style compose without merging ancestor state',()=>{
 const r=realm({styles:{s:{fontSize:21,underline:true}},base:{stateStyles:{selected:{baseOnly:1}}},views:{parent:{stateStyles:{selected:{parentOnly:1}}},leaf:{stateStyles:{selected:{baseStyle:'s',fontSize:22}}}}});
 const observed=r.full('selected');assert.equal(observed.fontSize,22);assert.equal(observed.underline,true);assert.equal(observed.parentOnly,undefined);return observed;
});
test('normal state participates after ordinary view style',()=>{
 const r=realm({base:{fontSize:12},views:{leaf:{fontSize:20,stateStyles:{normal:{fontSize:25}}}}});assert.equal(r.full().fontSize,25);return r.full();
});
for(const [state,last] of [['mouseOverMouseDownSelectedErrorHint','hint'],['focusedSelectedErrorHint','hint'],['selectedErrorHintDisabled','disabled']])test(`compound priority ${state}`,()=>{
 const map=Object.fromEntries(['normal',...stateKeys].map(k=>[k,{winner:k,[k+'Only']:true}]));const r=realm({views:{leaf:{stateStyles:map}}});const observed=r.full(state);assert.equal(observed.winner,last);return observed;
});
test('contained object uses own normal view declarations but parent state map',()=>{
 const parent={style:{stateStyles:{selected:{color:'owner-base'}}},adaptiveStyles:{leaf:{fontSize:77,stateStyles:{selected:{color:'owner-view'}}}}};
 const r=realm({parent,base:{fontSize:12},views:{leaf:{fontSize:20,stateStyles:{selected:{color:'child-view'}}}}});const observed=r.full('selected');assert.equal(observed.fontSize,20);assert.equal(observed.color,'owner-view');return observed;
});
test('rich setter marker removes direct adaptive font props, not paint or state font',()=>{
 const r=realm({rich:true,base:{fontSize:12},views:{leaf:{fontSize:20,fill:{fillType:'solid'},stateStyles:{selected:{fontSize:30}}}}});const normal=r.full(),selected=r.full('selected');assert.equal(normal.fontSize,12);assert.equal(selected.fontSize,30);assert.deepEqual(normal.fill,{fillType:'solid'});assert.equal(r.w.adaptiveStyles.leaf.fontSize,20);return{normal,selected};
});
test('rich marker still permits named adaptive font fallback',()=>{
 const r=realm({rich:true,base:{fontSize:12},styles:{s:{fontSize:18}},views:{leaf:{baseStyle:'s',fontSize:20}}});assert.equal(r.full().fontSize,18);return r.full();
});
test('current panel diagram style sits below computed adaptive overrides',()=>{
 const r=realm({base:{fontSize:12,color:'base'},panel:{fontSize:18,color:'panel'},views:{leaf:{fontSize:20}}});const observed=r.full();assert.equal(observed.fontSize,20);assert.equal(observed.color,'panel');return observed;
});
test('page normal style applies ancestors then leaf with shallow atomic replacement',()=>{
 const r=realm({page:{style:{fill:{base:1},size:{width:100,height:80},pageAlignment:'center'},adaptiveStyles:{parent:{fill:{parent:1},size:{width:200,height:90}},leaf:{fill:{leaf:1}}}}});const observed=r.query('_getPageStyle()');assert.deepEqual(observed.fill,{leaf:1});assert.deepEqual(observed.size,{width:200,height:90});assert.equal(observed.pageAlignment,'center');return observed;
});
test('page lookup does not resolve normal named baseStyle',()=>{
 const r=realm({styles:{s:{fontSize:99}},page:{style:{fontSize:12},adaptiveStyles:{leaf:{baseStyle:'s'}}}});const observed=r.query('_getPageStyle()');assert.equal(observed.fontSize,12);return observed;
});
for(const visible of [undefined,false,true,0,null])test(`apply visible ${String(visible)} uses strict false`,()=>{
 const r=realm({base:{visible:false},views:{leaf:visible===undefined?{}:{visible}}});const observed=r.apply();assert.deepEqual(observed.hidden,(visible===undefined||visible===false)?{w:true}:{});return observed;
});
for(const contained of [false,true])test(`apply limbo/size/paint contained=${contained}`,()=>{
 const parent=contained?{style:{},adaptiveStyles:{}}:undefined;const r=realm({parent,views:{leaf:{limbo:true,visible:false,size:{width:10,height:20},location:{x:-7,y:2}}}});const observed=r.apply();
 assert.deepEqual(observed.limbo,contained?{}:{w:true});assert.deepEqual(observed.hidden,{w:true});assert.equal(observed.paint.filter(p=>p.kind==='paint-sink').length,contained?0:1);assert.equal(observed.paint[0].kind,'convert-single-image');return observed;
});

function cursorRealm({inPlayer=true,mobile=false}={}) {
 const trace=[],html={style:{},classes:[]},body={style:{}};
 const document={addEventListener:(name)=>trace.push({kind:'listener',name})};
 const wrap=o=>({css:(k,v)=>{if(v===undefined)return o.style[k];o.style[k]=v;trace.push({kind:'css',target:o===html?'html':'body',key:k,value:v});return wrap(o);},
  addClass:k=>{if(!o.classes.includes(k))o.classes.push(k);},removeClass:k=>{o.classes=o.classes.filter(v=>v!==k);},
  find:()=>({attr:()=>undefined})});
 const $=value=>typeof value==='function'?value():wrap(value==='html'?html:value==='body'?body:document);
 const c=vm.createContext({$,$axure:{utils:{isInPlayer:()=>inPlayer},browser:{isEdge:false}},$ax:{dynamicPanelManager:{initMobileScroll:()=>trace.push({kind:'mobile-scroll'})}},
  document,MOBILE_DEVICE:mobile,IE:false,_isDeviceMode:false,
  _removeNiceScroll:()=>trace.push({kind:'remove-scroll'}),_addNiceScroll:(_node,opts)=>trace.push({kind:'add-scroll',opts:clone(opts)}),_setHorizontalScroll:value=>trace.push({kind:'horizontal-scroll',value})});
 vm.runInContext(`function receive(data){${cursorCode}\n}`,c);
 return{receive:data=>{c.data=data;vm.runInContext('receive(data)',c);return{html:clone(html),body:clone(body),trace:clone(trace)};}};
}
for(const cursor of [0,1,undefined])test(`player device cursor ${String(cursor)}`,()=>{
 const observed=cursorRealm().receive({device:true,cursor});assert.equal(observed.html.style.cursor,cursor===0?'default':'url(resources/css/images/touch.svg) 16 16, auto');return observed;
});
test('device cursor ignored outside player',()=>{const observed=cursorRealm({inPlayer:false}).receive({device:true,cursor:1});assert.deepEqual(observed.trace,[]);return observed;});
test('mobile device skips emulated touch cursor',()=>{const observed=cursorRealm({mobile:true}).receive({device:true,cursor:1});assert.equal(observed.html.style.cursor,undefined);return observed;});
test('leaving device mode clears cursor and class',()=>{const r=cursorRealm();r.receive({device:true,cursor:1});const observed=r.receive({device:false});assert.equal(observed.html.style.cursor,'');assert.deepEqual(observed.html.classes,[]);return observed;});
test('Touch then Desktop retains mobileFrameCursor class in exact branch',()=>{const r=cursorRealm();r.receive({device:true,cursor:1});const observed=r.receive({device:true,cursor:0});assert.equal(observed.html.style.cursor,'default');assert.deepEqual(observed.html.classes,['mobileFrameCursor']);return observed;});
for(const [width,height] of [[0,0],[390,0],[0,720],[1366,1000]])test(`player device decision ${width}x${height}`,()=>{
 const $=selector=>selector==='.currentAdaptiveView'?{attr:name=>name==='data-dim'?`${width}x${height}`:'1'}:selector==='.vpScaleOption'?{find:()=>({parent:()=>({attr:()=> '0'})})}:{attr:()=>{}};
 const c=vm.createContext({$,$axure:{player:{}}});vm.runInContext(playerCode,c);const observed={isDevice:c.isDevice,width:c.w,height:c.h,cursor:c.cursor};assert.equal(!!observed.isDevice,height!==0);return observed;
});
const report={schema:1,capturedAt:new Date().toISOString(),kind:'exact-retained-JavaScript-NodeVM',
 method:'Exact retained JS function/switch-branch slices. Synthetic declarations; jQuery shallow extend and DOM/style/scroll/paint are explicit sinks. No vendor GUI, DLL, full generated project or pixel comparison.',
 sources:Object.entries(paths).map(([key,p])=>({path:path.join(root,p),sha256:sha(source[key])})),slices,results,
 totals:{cases:results.length,passed:results.filter(r=>r.status==='pass').length,failed:results.filter(r=>r.status==='fail').length},
 dependencies:['Synthetic page/widget/style records and view chain','jQuery $.extend reproduces shallow enumerable copies and skips undefined','DOM class/CSS, image conversion, panel style and scroll functions are controlled sinks','Player branch uses explicit MOBILE_DEVICE/IE/player flags'],
 limits:['No generated CSS location/size layout or real pointer cursor pixel proof.','Named style dictionaries in probes are generated JS data, not unresolved native source references.','Raw P21 null malformed-storage acceptance is not recommended just because the JS consumer has truthiness behavior.']};
fs.writeFileSync('research/adaptive-import-styles-probe.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.totals));for(const failure of results.filter(r=>r.status==='fail'))console.error(failure.name+'\n'+failure.error);
assert.equal(report.totals.failed,0);
