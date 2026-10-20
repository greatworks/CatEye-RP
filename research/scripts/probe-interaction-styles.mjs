// Research-only SHA-pinned original function slices; no Axure app or browser is launched.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const base = process.argv[2] ?? 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins = {
  'style.js':'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c',
  'events.js':'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3',
  'axQuery.std.js':'0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd',
  '../../css/axure_rp_page.css':'595bfcd275dc80732aeecbb8365067ccecc4f0277df316ea47656816939ece4a',
  '../../css/default.css':'c386bd6c672653bd7dc596ef3f0349d272b8451e47c5a5cd295f60e3d31677de',
  '../../css/jquery-ui-themes.css':'03dbf997552f2d834c25e06b4f835d49fb5d9c902ae0a6246082c525c13f521a',
};
const sources = {}, sha = data => crypto.createHash('sha256').update(data).digest('hex');
const files = Object.entries(pins).map(([file, digest]) => { const filename=path.join(base,file),bytes=fs.readFileSync(filename); assert.equal(sha(bytes),digest); sources[file]=bytes.toString('utf8').split(/\r?\n/); return {file,path:filename,sha256:digest}; });
const slice=(file,start,end)=>sources[file].slice(start-1,end).join('\n');
const ranges = [
  ['style.js',74,166], ['style.js',176,269], ['style.js',322,343], ['style.js',349,592],
  ['style.js',1647,1714], ['style.js',1716,1736], ['style.js',1763,1915],
  ['events.js',1343,1351], ['events.js',1361,1436], ['events.js',1786,1794],
  ['events.js',735,747], ['axQuery.std.js',1087,1137], ['axQuery.std.js',1181,1255],
];
const staticRanges = [['events.js',759,785],['events.js',803,835],['events.js',1220,1236],['events.js',1668,1686],['axQuery.std.js',1085,1137],['axQuery.std.js',1187,1251]];
const setup = `
var objects={},dom={},paints=[],events=[],viewChain=[];
var _style={},_selectedWidgets={},_disabledWidgets={},_errorWidgets={},_hintWidgets={},_shapesWithSetRichText={},_idToAppliedStyles={};
var document={id:'document'},window={},PLAIN_TEXT_TYPES=[];
function element(id){return dom[id]??=( {id,classes:new Set(),handlers:[],attrs:{}} );}
function query(value){var el=typeof value==='string'?element(value.slice(1)):element(value.id);var q={length:1,
hasClass:c=>el.classes.has(c),addClass:c=>(el.classes.add(c),q),removeClass:c=>(el.classes.delete(c),q),
attr:(k,v)=>v===undefined?el.attrs[k]:(el.attrs[k]=v,q),find:()=>({length:0,css:()=>{}}),css:()=>q,
prop:(k,v)=>v===undefined?el[k]:(el[k]=v,q),is:type=>type==='div',bind:(type,fn)=>q.on(type,fn),focus:fn=>q.on('focus',fn),blur:fn=>q.on('blur',fn),
on:(type,fn)=>(el.handlers.push({type,fn}),q),one:(type,data,fn)=>(el.handlers.push({type,data:fn?data:undefined,fn:fn??data,once:true}),q),
off:(type,fn)=>(el.handlers=el.handlers.filter(h=>!(h.type.split('.')[0]===type.split('.')[0]&&(!fn||h.fn===fn))),q),
trigger:e=>(fire(el.id,e.type,e),q)};return q;}
var $=query,$jobj=id=>query('#'+id),$obj=id=>objects[id];
$.extend=function(target,...sources){for(var source of sources)if(source)for(var key of Object.keys(source))if(source[key]!==undefined)target[key]=source[key];return target;};
$.isEmptyObject=o=>Object.keys(o).length===0;$.inArray=(x,list)=>list.indexOf(x);
var _event={mouseOverIds:[],mouseOverObjectId:'',mouseDownObjectId:''};
var $ax={style:_style,event:_event,features:{eventNames:{mouseDownName:'mousedown',mouseUpName:'mouseup'}},constants:{TEXT_TYPE:'text'},
 getObjectFromElementId:id=>objects[id],getTypeFromElementId:id=>objects[id].type,INPUT:id=>id+'_input',GetTextPanelId:()=>undefined,
 getPathFromScriptId:id=>[id],getElementIdFromPath:p=>p.at(-1),
 deepCopy:o=>JSON.parse(JSON.stringify(o)),splice:(a,i,n)=>a.splice(i,n),
 document:{stylesheet:{defaultStyle:{fontSize:10,opacity:1},stylesById:{}}},
 adaptive:{currentViewId:'',getAdaptiveIdChain:()=>viewChain},
 visibility:{GetCurrentPanelDiagram:()=>null,isScriptIdLimbo:()=>false},
 public:{fn:{IsDynamicPanel:t=>t==='panel',IsLayerOrRdo:()=>false,IsRepeater:t=>t==='repeater',IsTreeNodeObject:()=>false,IsImageBox:()=>false,
 IsVector:t=>t==='shape',IsTableCell:()=>false,IsCheckBox:t=>t==='checkbox',IsRadioButton:t=>t==='radio',IsTextBox:t=>t==='input',IsTextArea:t=>t==='textarea',IsListBox:t=>t==='list',IsComboBox:t=>t==='select',IsButton:t=>t==='button'}},
 dynamicPanelManager:{parentHandlesStyles:()=>null},annotation:{updateLinkLocations:()=>{}},
 repeater:{applySuffixToElementId:(id,s)=>id+s,getItemIdFromElementId:()=>undefined,getScriptIdFromElementId:id=>id}};
$ax.event.raiseSelectedEvents=(id,value)=>events.push({id,value});$ax.event.getFocusableWidgetOrChildId=id=>['shape','button'].includes(objects[id].type)?id:id+'_input';$ax.IsTreeNodeObject=()=>false;
$ax.style.ShowingHint=()=>false;$ax.style.IsWidgetError=()=>false;
var _enableStateTransitions=()=>false,_updateElementIdImageStyle=()=>{},_updateCornersForBorders=()=>{};
var _applySvg=(id,state,style)=>paints.push({id,state,style:JSON.parse(JSON.stringify(style))});
function reset(states={mouseOver:{fill:{color:2},borderWidth:4},mouseDown:{fill:{color:3},fontSize:20},focused:{fill:{color:4},paddingLeft:8},selected:{fill:{color:5},fontSize:21},disabled:{fill:{color:6},opacity:0.25}}){
 dom={};paints=[];events=[];viewChain=[];_selectedWidgets={};_disabledWidgets={};_elementIdsToImageOverrides={};_rolloverOverrides=[];_idToAppliedStyles={};
 _event.mouseOverIds=[];_event.mouseOverObjectId='';_event.mouseDownObjectId='';
 objects={w:{id:'w',type:'shape',owner:{type:'page'},adaptiveStyles:{},style:{fill:{color:1},borderWidth:1,fontSize:12,opacity:0.8,paddingLeft:2,stateStyles:states}}};
 element('w_input').checked=false;
 _attachIxStyleEvents(objects.w,'w',$jobj('w'),false);
}
function fire(id,type,event={}){var el=element(id);for(var h of [...el.handlers])if(h.type.split('.')[0]===type){if(h.once)el.handlers=el.handlers.filter(x=>x!==h);h.fn.call(el,{...event,type,data:h.data});}}
function snap(){var last=paints.at(-1);return{state:last?.state??null,classes:[...element('w').classes].sort(),paintCount:paints.length,mouseOver:[..._event.mouseOverIds],mouseDown:_event.mouseDownObjectId,
 style:last?Object.fromEntries(['fill','borderWidth','fontSize','opacity','paddingLeft'].map(k=>[k,last.style[k]])):null};}
`;
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
vm.runInContext(setup+ranges.map(r=>slice(...r)).join('\n')+'\nfunction wireFocus(dObj,elementId){\n'+slice('events.js',759,785)+'\n}',context,{timeout:1000});
const run=code=>JSON.parse(vm.runInContext(`JSON.stringify((()=>{${code}})())`,context,{timeout:1000}));
const experiments=[];
function probe(name,code,check){const actual=run(code);check(actual);experiments.push({name,actual,pass:true});}
const style=(fill,borderWidth=1,fontSize=12,opacity=.8,paddingLeft=2)=>({fill:{color:fill},borderWidth,fontSize,opacity,paddingLeft});

probe('hover overlays only its properties and leave restores normal',`reset();fire('w','mouseenter');var a=snap();fire('w','mouseleave');return[a,snap()];`,r=>{assert.deepEqual(r[0].style,style(2,4));assert.deepEqual(r[1].style,style(1));});
probe('down over hover then release on target restores hover',`reset();fire('w','mouseenter');fire('w','mousedown');var a=snap();fire('w','mouseup');return[a,snap()];`,r=>{assert.deepEqual(r[0].style,style(3,4,20));assert.equal(r[0].state,'mouseOverMouseDown');assert.deepEqual(r[1].style,style(2,4));});
probe('leave while held preserves mouseDown and removes hover-only properties',`reset();fire('w','mouseenter');fire('w','mousedown');fire('w','mouseleave');return snap();`,r=>{assert.equal(r.state,'mouseDown');assert.equal(r.mouseDown,'w');assert.deepEqual(r.style,style(3,1,20));});
probe('reenter while held restores hover plus mouseDown',`reset();fire('w','mouseenter');fire('w','mousedown');fire('w','mouseleave');fire('w','mouseenter');return snap();`,r=>{assert.equal(r.state,'mouseOverMouseDown');assert.deepEqual(r.style,style(3,4,20));});
probe('document release outside clears down without creating hover',`reset();fire('w','mouseenter');fire('w','mousedown');fire('w','mouseleave');fire('document','mouseup');return snap();`,r=>{assert.equal(r.state,'normal');assert.equal(r.mouseDown,'');assert.deepEqual(r.classes,[]);assert.deepEqual(r.style,style(1));});
probe('dragend original cleanup forces mouseOver when checkMouseOver is absent',`reset();fire('w','mouseenter');fire('w','mousedown');fire('w','mouseleave');fire('w','dragend');return snap();`,r=>{assert.equal(r.state,'mouseOver');assert.equal(r.mouseDown,'');assert.deepEqual(r.mouseOver,[]);assert.deepEqual(r.style,style(2,4));});
probe('focus suppresses both hover and down, blur recomputes live pointer state',`reset();fire('w','mouseenter');fire('w','mousedown');$ax.style.SetWidgetFocused('w',true);var a=snap();$ax.style.SetWidgetFocused('w',false);return[a,snap()];`,r=>{assert.equal(r[0].state,'focused');assert.deepEqual(r[0].style,style(4,1,12,.8,8));assert.equal(r[1].state,'mouseOverMouseDown');assert.deepEqual(r[1].style,style(3,4,20));});
for(const empty of ['missing','empty'])probe(`DOM focus without effective ${empty} focused effect leaves pointer style active`,`reset();${empty==='missing'?'delete objects.w.style.stateStyles.focused':'objects.w.style.stateStyles.focused={}'};fire('w','mouseenter');var n=paints.length;$ax.style.SetWidgetFocused('w',true);return{n,snap:snap()};`,r=>{assert.equal(r.snap.paintCount,r.n);assert.equal(r.snap.state,'mouseOver');assert.deepEqual(r.snap.classes,['mouseOver']);});
probe('selected overlays focused per-property, unselect restores focus',`reset();fire('w','mouseenter');$ax.style.SetWidgetFocused('w',true);$ax.style.SetWidgetSelected('w',true);var a=snap();$ax.style.SetWidgetSelected('w',false);return[a,snap()];`,r=>{assert.equal(r[0].state,'focusedSelected');assert.deepEqual(r[0].style,style(5,1,21,.8,8));assert.deepEqual(r[1].style,style(4,1,12,.8,8));});
probe('selected overlays hover/down but their unconflicted properties survive',`reset();fire('w','mouseenter');fire('w','mousedown');$ax.style.SetWidgetSelected('w',true);return snap();`,r=>{assert.equal(r.state,'mouseOverMouseDownSelected');assert.deepEqual(r.style,style(5,4,21));});
probe('disabled excludes pointer and focus while retaining selected then disabled precedence',`reset();fire('w','mouseenter');fire('w','mousedown');$ax.style.SetWidgetFocused('w',true);$ax.style.SetWidgetSelected('w',true);$ax.style.SetWidgetEnabled('w',false);return snap();`,r=>{assert.equal(r.state,'selectedDisabled');assert.deepEqual(r.classes,['disabled','selected']);assert.deepEqual(r.style,style(6,1,21,.25));});
probe('disabled without opacity keeps base opacity, no blanket multiplier',`reset();objects.w.style.stateStyles.disabled={fill:{color:6}};$ax.style.SetWidgetEnabled('w',false);return snap();`,r=>{assert.deepEqual(r.style,style(6));});
probe('disable with no disabled style stores flag but does not repaint immediately',`reset();delete objects.w.style.stateStyles.disabled;fire('w','mouseenter');var before=paints.length;$ax.style.SetWidgetEnabled('w',false);return{before,disabled:$ax.style.IsWidgetDisabled('w'),generated:$ax.style.generateState('w'),snap:snap()};`,r=>{assert.equal(r.disabled,true);assert.equal(r.generated,'disabled');assert.equal(r.snap.paintCount,r.before);assert.equal(r.snap.state,'mouseOver');});
probe('disabled mouseDown focused selected setters are ignored',`reset();$ax.style.SetWidgetEnabled('w',false);var n=paints.length;$ax.style.SetWidgetMouseDown('w',true);$ax.style.SetWidgetFocused('w',true);$ax.style.SetWidgetSelected('w',true);return{n,snap:snap(),selected:$ax.style.IsWidgetSelected('w'),events};`,r=>{assert.equal(r.snap.paintCount,r.n);assert.equal(r.selected,false);assert.deepEqual(r.events,[]);});
probe('hover setter can repaint disabled, but generates disabled state',`reset();$ax.style.SetWidgetEnabled('w',false);var n=paints.length;fire('w','mouseenter');return{n,snap:snap()};`,r=>{assert.equal(r.snap.paintCount,r.n+1);assert.equal(r.snap.state,'disabled');assert.deepEqual(r.snap.style,style(6,1,12,.25));});
probe('enable recomputes pointer selected states but lost focused class does not restore itself',`reset();fire('w','mouseenter');$ax.style.SetWidgetFocused('w',true);$ax.style.SetWidgetSelected('w',true);$ax.style.SetWidgetEnabled('w',false);$ax.style.SetWidgetEnabled('w',true);return snap();`,r=>{assert.equal(r.state,'mouseOverSelected');assert.deepEqual(r.style,style(5,4,21));});
probe('adaptive explicit stateStyles map suppresses default missing state fallback',`reset();viewChain=['mobile'];objects.w.adaptiveStyles.mobile={stateStyles:{selected:{fontSize:40}}};fire('w','mouseenter');return snap();`,r=>{assert.equal(r.state,'mouseOver');assert.deepEqual(r.style,style(1));});
probe('adaptive state override uses closest map without filling from lower maps',`reset();viewChain=['wide','mobile'];objects.w.adaptiveStyles.wide={stateStyles:{mouseOver:{fill:{color:8},fontSize:18}}};objects.w.adaptiveStyles.mobile={stateStyles:{mouseOver:{borderWidth:9}}};fire('w','mouseenter');return snap();`,r=>{assert.deepEqual(r.style,style(1,9));});
probe('adaptive empty focused object counts as existing unlike empty default focused object',`reset();delete objects.w.style.stateStyles.focused;viewChain=['mobile'];objects.w.adaptiveStyles.mobile={stateStyles:{focused:{}}};fire('w','mouseenter');$ax.style.SetWidgetFocused('w',true);return snap();`,r=>{assert.equal(r.state,'focused');assert.deepEqual(r.style,style(1));});
probe('state custom style is merged before explicit state properties',`reset();$ax.document.stylesheet.stylesById.theme={fill:{color:9},fontSize:30,borderWidth:8};objects.w.style.stateStyles.mouseOver={baseStyle:'theme',borderWidth:4};fire('w','mouseenter');return snap();`,r=>{assert.deepEqual(r.style,style(9,4,30));});
probe('structured style properties are replaced shallowly, not deep merged',`reset();objects.w.style.fill={color:1,fillType:'solid',opacity:.6};objects.w.style.stateStyles.mouseOver={fill:{color:2}};fire('w','mouseenter');return snap().style.fill;`,r=>assert.deepEqual(r,{color:2}));
probe('explicit zero/false/empty scalar property values survive merging',`reset();objects.w.style.stateStyles.mouseOver={opacity:0,borderWidth:0,fontSize:0,paddingLeft:0,flag:false,label:''};fire('w','mouseenter');return{style:snap().style,flag:paints.at(-1).style.flag,label:paints.at(-1).style.label};`,r=>{assert.deepEqual(r.style,style(1,0,0,0,0));assert.equal(r.flag,false);assert.equal(r.label,'');});
probe('mouseUp handler without real hover forces hover but does not change hover list',`reset();fire('w','mousedown');fire('w','mouseup');return snap();`,r=>{assert.equal(r.state,'mouseOver');assert.deepEqual(r.mouseOver,[]);});
for(const type of ['checkbox','radio']) {
  probe(`${type} checked setter while disabled changes checked but not selected style/events`,`reset();objects.w.type='${type}';var q={getElementIds:()=>['w']};$ax.style.SetWidgetEnabled('w',false);var n=paints.length;$ax.public.fn.selected.call(q,true);return{checked:element('w_input').checked,selected:$ax.style.IsWidgetSelected('w'),n,snap:snap(),events};`,r=>{assert.equal(r.checked,true);assert.equal(r.selected,false);assert.equal(r.snap.paintCount,r.n);assert.deepEqual(r.events,[]);});
  probe(`${type} initial selected before disabled retains both style states`,`reset();objects.w.type='${type}';var q={getElementIds:()=>['w']};$ax.public.fn.selected.call(q,true);$ax.style.SetWidgetEnabled('w',false);return{checked:element('w_input').checked,selected:$ax.style.IsWidgetSelected('w'),snap:snap()};`,r=>{assert.equal(r.checked,true);assert.equal(r.selected,true);assert.equal(r.snap.state,'selectedDisabled');assert.deepEqual(r.snap.style,style(6,1,21,.25));});
}
probe('query enabled on checkbox exits before changing native input.disabled',`reset();objects.w.type='checkbox';$ax.public.fn.enabled.call({getElementIds:()=>['w']},false);return{nativeDisabled:element('w_input').disabled??null,styleDisabled:$ax.style.IsWidgetDisabled('w')};`,r=>assert.deepEqual(r,{nativeDisabled:null,styleDisabled:true}));
probe('query enabled on text input changes native input.disabled too',`reset();objects.w.type='input';$ax.public.fn.enabled.call({getElementIds:()=>['w']},false);return{nativeDisabled:element('w_input').disabled,styleDisabled:$ax.style.IsWidgetDisabled('w')};`,r=>assert.deepEqual(r,{nativeDisabled:true,styleDisabled:true}));
probe('generic shape focus style is wired only when source tabbable is true',`reset();wireFocus(objects.w,'w');fire('w','focus');var a=snap();objects.w.tabbable=true;wireFocus(objects.w,'w');fire('w','focus');return{without:a,with:snap(),tabIndex:element('w').attrs.tabIndex};`,r=>{assert.equal(r.without.paintCount,0);assert.equal(r.with.state,'focused');assert.equal(r.tabIndex,0);});
probe('text input focus/blur style is wired without explicit tabbable',`reset();objects.w.type='input';wireFocus(objects.w,'w');fire('w_input','focus');var a=snap();fire('w_input','blur');return[a,snap()];`,r=>{assert.equal(r[0].state,'focused');assert.equal(r[1].state,'normal');});
probe('ordinary mousedown style handler has no mouse-button filter',`return [0,1,2].map(button=>{reset();fire('w','mouseenter');fire('w','mousedown',{button});var down=snap();fire('document','mouseup',{button:0});return{button,down:down.state,released:snap().state};});`,r=>assert.deepEqual(r,[0,1,2].map(button=>({button,down:'mouseOverMouseDown',released:'mouseOver'}))));

const cssSearch=Object.keys(pins).filter(file=>file.endsWith('.css')).map(file=>({file,pattern:'disabled|opacity',matches:sources[file].flatMap((text,index)=>/disabled|opacity/.test(text)?[{line:index+1,text}]:[])}));
const output={date:'2026-10-13',evidenceType:'isolated-original-function-probes',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',nativeVersion:'11.0.0.4150',installerSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',nativeDllSha256:'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7',officialSources:['https://docs.axure.com/axure-rp/reference/style-effects/','https://docs.axure.com/axure-rp/reference/styling-widgets/','https://docs.axure.com/axure-rp/reference/checkboxes/'],files,scope:'Original style state setters, combiners, per-property merge, class updater and ordinary pointer handler functions. Synthetic widget data and a minimal jQuery/DOM event adapter; paint endpoints record style arguments. No generated stylesheet, browser paint, original compiler, GUI, touch or container propagation parity claim.',excerpts:[...ranges,...staticRanges,['events.js',759,785]].map(([file,startLine,endLine])=>({file,startLine,endLine,text:slice(file,startLine,endLine)})),cssSearch,experiments};
fs.writeFileSync('research/interaction-styles-evidence.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({status:'pass',probes:experiments.length,output:'research/interaction-styles-evidence.json'},null,2));
