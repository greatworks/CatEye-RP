import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const pins={'style.js':'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c','expr.js':'530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6','adaptive.js':'e141ea07bb973b6007f2ad7d7205516a041a801ec97e410467352c27af3b2928','../jquery-3.7.1.min.js':'8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85'};
const files=Object.entries(pins).map(([name,hash])=>{const file=path.join(root,name),data=fs.readFileSync(file);assert.equal(sha(data),hash);return{name,path:file,sha256:hash,text:data.toString('utf8')};});
const ranges=[];
function slice(file,first,last){const text=files.find(f=>f.name===file).text.split(/\r?\n/).slice(first-1,last).join('\n');ranges.push({file,first,last,sha256:sha(text)});return text;}
const pieces=[['style.js',74,96],['style.js',137,166],['style.js',255,257],['style.js',271,273],['style.js',287,289],['style.js',322,324],['style.js',349,592],['style.js',848,852],['style.js',875,926],['style.js',964,989],['style.js',1647,1736],['style.js',1763,1915],['style.js',2028,2042],['style.js',2076,2094],['style.js',2328,2416],['style.js',2427,2532],['style.js',2590,2611],['expr.js',316,385],['expr.js',753,758],['adaptive.js',48,159],['adaptive.js',245,317]].map(a=>slice(...a));
const setup=`
var _style={},_originalTextCache={},_shapesWithSetRichText={},_adaptiveStyledWidgets={},_selectedWidgets={},_disabledWidgets={},_errorWidgets={},_hintWidgets={},_exprFunctions={},trace=[],widget;
var _loadFinished=false;
var $jobj=id=>$('#'+id),$obj=id=>widget,$axure=()=>({each:fn=>fn(widget,'w')});
var _getAdaptiveIdChain=id=>id?['mobile']:[];
var $ax=()=>({each:fn=>fn(widget,'w')});
Object.assign($ax,{style:_style,event:{mouseOverIds:[],mouseDownObjectId:''},constants:{LINK_TYPE:'hyperlink',CONNECTOR_TYPE:'connector'},
document:{stylesheet:{defaultStyle:{},stylesById:{}}},getObjectFromElementId:()=>widget,
GetTextPanelId:id=>id+'_text',GetShapeIdFromText:id=>id.replace(/_text$/,''),GetButtonShapeId:id=>id,
getParentRepeaterFromScriptId:()=>undefined,getParentRepeaterFromElementIdExcludeSelf:()=>undefined,
adaptive:{currentViewId:'',getAdaptiveIdChain:_getAdaptiveIdChain,triggerEvent:()=>{}},deepCopy:value=>structuredClone(value),
repeater:{getScriptIdFromElementId:id=>id,applySuffixToElementId:(id,s)=>id+s,refreshAllRepeaters:()=>{}},
public:{fn:{IsImageBox:()=>false,IsDynamicPanel:()=>false,IsTreeNodeObject:()=>false,IsReferenceDiagramObject:()=>false,convertToSingleImage:()=>{}}},
visibility:{GetCurrentPanelDiagram:()=>undefined,SetVisible:(el,v)=>el.style.display=v?'':'none',clearMovedAndResized:()=>{},clearLimboAndHidden:()=>{},resetLimboAndHiddenToDefaults:()=>{},addLimboAndHiddenIds:()=>{}},
dynamicPanelManager:{resetFixedPanel:()=>{},resetAdaptivePercentPanel:()=>{},updateParentsOfNonDefaultFitPanels:()=>{},updatePercentPanelCache:()=>{},updateAllLayerSizeCaches:()=>{}},
placeholderManager:{refreshPlaceholder:()=>{}},annotation:{updateAllFootnotes:()=>{}},expr:{updateAutoFitted:()=>{}}});
var _enableStateTransitions=()=>false,disableStateTransitionsOnEnd=()=>{},_clearWidgetAppliedCorners=()=>{},_updateCornersForBorders=()=>{},_isRolloverOverride=()=>false;
var _applyImage=()=>{},autofitWidget=()=>{};
${pieces.join('\n')}
var _applySvg=(id,state,style)=>trace.push({kind:'svg-paint-sink',id,state,style});
_style.getElementImageOverride=()=>undefined;_style.updateElementIdImageStyle=()=>{};
function reset(mixed=false){
 document.body.innerHTML='<div id="w"><div id="w_div"></div><svg id="w_img"></svg><div id="w_text"><p style="text-align:left"><span id="first" style="font-size:20px;color:#123456">Original</span>'+(mixed?'<span style="font-size:30px;color:green"> Second</span>':'')+'</p></div></div>';
 widget={type:'buttonShape',owner:{type:'page'},style:{},adaptiveStyles:{mobile:{fontSize:'18px',foreGroundFill:{fillType:'solid',color:0xff112233}}}};
 _originalTextCache={};_shapesWithSetRichText={};_adaptiveStyledWidgets={};_idToAppliedStyles={};_selectedWidgets={};_disabledWidgets={};_errorWidgets={};_hintWidgets={};$ax.adaptive.currentViewId='';trace=[];
}
function snap(){const leaf=document.querySelector('#w_text span');return{text:document.getElementById('w_text').textContent,inlineSize:leaf.style.fontSize,inlineColor:leaf.style.color,size:getComputedStyle(leaf).fontSize,color:getComputedStyle(leaf).color,cache:structuredClone(_originalTextCache),applied:structuredClone(_idToAppliedStyles),rich:!!_shapesWithSetRichText.w,html:document.getElementById('w_text').innerHTML};}
window.transitionProbe={reset,snap,action:()=>_style.applyWidgetStyle('w','action-font',{fontSize:'28px',foreGroundFill:{fillType:'solid',color:0xffff0000}},undefined,true),set:(value,plain=true)=>_exprFunctions.SetWidgetRichText(['w'],value,plain),view:id=>_switchView(id)};
`;
// CSS is an explicit harness action-effect fixture, not claimed generated Axure CSS.
const css='#w.action-font span{font-size:28px!important;color:red!important}';
const browser=await chromium.launch({channel:'msedge',headless:true});
const ctx=await browser.newContext();const requests=[],errors=[],results=[];
await ctx.route('**/*',r=>{requests.push(r.request().url());return r.abort();});
const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
  await page.setContent('<!doctype html><html><head><style>'+css+'</style></head><body></body></html>');
  await page.addScriptTag({content:files.find(f=>f.name.startsWith('../jquery')).text});
  await page.addScriptTag({content:setup});
  assert.deepEqual(errors,[],'Original-slice bootstrap must parse before probes');
  for(const mixed of [false,true]){
    const result=await page.evaluate(mixed=>{const p=window.transitionProbe;p.reset(mixed);const initial=p.snap();p.action();const action=p.snap();p.set('Runtime content');const setter=p.snap();p.view('mobile');const mobile=p.snap();p.view('');return{initial,action,setter,mobile,base:p.snap()};},mixed);
    assert.equal(result.action.size,'28px');assert.equal(result.setter.text,'Runtime content');assert.equal(result.mobile.size,'18px');assert.equal(result.mobile.color,'rgb(17, 34, 51)');
    assert.equal(result.base.text,'Runtime content');assert.equal(result.base.size,'20px');assert.equal(result.base.color,'rgb(18, 52, 86)');assert.deepEqual(result.base.applied,{});assert.equal(result.base.rich,false);
    results.push({name:`plain SetText ${mixed?'mixed-to-first-run':'sole-span'} preserves content and original inline formatting on Base`,observed:result,status:'pass'});
  }
  const rich=await page.evaluate(()=>{const p=window.transitionProbe;p.reset();p.set('<p><span style="font-size:32px;color:purple">Rich replacement</span></p>',false);p.view('mobile');const mobile=p.snap();p.view('');return{mobile,base:p.snap()};});
  assert.equal(rich.mobile.size,'32px');assert.equal(rich.base.size,'32px');assert.equal(rich.base.rich,true);results.push({name:'nonplain rich replacement deliberately replaces original cache and excludes normal adaptive font overrides',observed:rich,status:'pass'});
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  const report={schema:'adaptive-transition-text-original-dom-v1',capturedAt:new Date().toISOString(),browser:browser.version(),kind:'Actual isolated Edge DOM with retained jQuery and exact retained style/expr/adaptive slices; synthetic widget data and explicit action-effect CSS fixture. SVG paint, visibility, AutoFit, repeater and panel endpoints are sinks; not complete original generated page or native GUI.',sources:files.map(({text,...f})=>f),ranges,results,passed:results.length,requests,errors};
  fs.writeFileSync('research/adaptive-transition-text-probe.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'pass',cases:results.length,browser:report.browser}));
}finally{await browser.close();}
