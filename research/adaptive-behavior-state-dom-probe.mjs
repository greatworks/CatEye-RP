import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const pins={'style.js':'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c','../jquery-3.7.1.min.js':'8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85'};
const sources=Object.entries(pins).map(([name,hash])=>{const file=path.join(root,name),data=fs.readFileSync(file);assert.equal(sha(data),hash);return{name,path:file,sha256:hash,text:data.toString('utf8')};});
const slices=[];
const slice=(first,last,label)=>{const text=sources[0].text.split(/\r?\n/).slice(first-1,last).join('\n');slices.push({file:'style.js',first,last,label,sha256:sha(text)});return text;};
const parts=[
  [75,95,'hasState'],[137,166,'generateFullState'],[255,257,'selected getter'],[271,273,'error getter'],[287,289,'hint getter'],[322,324,'disabled getter'],
  [349,592,'state constants and predicates'],[1647,1736,'applyImageAndTextJson / classes'],[1763,1915,'override resolution'],
  [2028,2042,'resetTextJson'],[2076,2094,'transformTextWithVerticalAlignment'],[2427,2532,'applyTextStyle / exact CSS conversion'],[2590,2611,'CacheOriginalText'],
].map(args=>slice(...args));
const setup=`
var _style={},_originalTextCache={},_shapesWithSetRichText={},_adaptiveStyledWidgets={},_idToAppliedStyles={},_selectedWidgets={},_errorWidgets={},_hintWidgets={},_disabledWidgets={},trace=[],widget;
var $jobj=id=>$('#'+id),$obj=()=>widget;
var $ax=()=>({});Object.assign($ax,{style:_style,event:{mouseOverIds:[],mouseDownObjectId:''},deepCopy:x=>structuredClone(x),
 document:{stylesheet:{defaultStyle:{},stylesById:{}}},getObjectFromElementId:()=>widget,GetTextPanelId:()=> 'w_text',GetButtonShapeId:id=>id,GetShapeIdFromText:id=>id.replace(/_text$/,''),
 adaptive:{currentViewId:'leaf',getAdaptiveIdChain:id=>id==='leaf'?['parent','leaf']:id?[id]:[]},
 repeater:{getScriptIdFromElementId:id=>id,applySuffixToElementId:(id,s)=>id+s},
 visibility:{GetCurrentPanelDiagram:()=>undefined},public:{fn:{IsImageBox:()=>false,IsDynamicPanel:()=>false}},constants:{CONNECTOR_TYPE:'connector'}});
var _enableStateTransitions=()=>false,disableStateTransitionsOnEnd=()=>{},_isRolloverOverride=()=>false,_clearWidgetAppliedCorners=()=>{},_updateCornersForBorders=()=>{},_applyImage=()=>{};
${parts.join('\n')}
var _applySvg=(id,state,style)=>trace.push({kind:'svg-sink',id,state,style});
_style.getElementImageOverride=()=>undefined;_style.updateElementIdImageStyle=()=>{};
function reset(config={}){
 document.body.innerHTML='<div id="w"><div id="w_div"></div><svg id="w_img"></svg><div id="w_text"><p style="text-align:left"><span id="first" style="font-size:20px;color:#123456;text-decoration:underline">Original</span><span id="second" style="font-size:30px;color:green;text-decoration:line-through"> second</span><a id="link" style="color:blue;text-decoration:underline"><span id="linked" style="font-size:24px"> link</span></a></p></div></div>';
 widget={type:'buttonShape',owner:{type:'page'},style:config.base||{},adaptiveStyles:config.views||{}};
 _originalTextCache={};_shapesWithSetRichText=config.richSet?{w:true}:{};_idToAppliedStyles={};_selectedWidgets=config.selected?{w:true}:{};_errorWidgets={};_hintWidgets={};_disabledWidgets={};$ax.adaptive.currentViewId='leaf';trace=[];
 $ax.document.stylesheet.stylesById=config.stylesById||{};
 _style.CacheOriginalText('w_text',config.richSet);
}
function snap(){const result={};for(const id of ['first','second','link','linked']){const n=document.getElementById(id),s=getComputedStyle(n);result[id]={inline:n.style.cssText,fontSize:s.fontSize,color:s.color,decoration:s.textDecorationLine,textShadow:s.textShadow};}return{nodes:result,classes:document.getElementById('w').className,rich:!!_shapesWithSetRichText.w,cache:structuredClone(_originalTextCache),trace:structuredClone(trace)};}
window.probe={reset,snap,paint:(view='leaf')=>{$ax.adaptive.currentViewId=view;_applyImageAndTextJson('w',_generateState('w'));},patch:patch=>{widget.adaptiveStyles.leaf=patch;},styles:()=>_computeAllOverrides('w',undefined,_generateState('w'),$ax.adaptive.currentViewId)};
`;
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext();const network=[],errors=[],results=[];
await context.route('**/*',route=>{network.push(route.request().url());return route.abort();});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
try{
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({content:sources[1].text});await page.addScriptTag({content:setup});assert.deepEqual(errors,[]);
  const record=async(name,config,check,after)=>{
    const observed=await page.evaluate(({config,after})=>{const p=window.probe;p.reset(config);p.paint();const first=p.snap();if(after){p.patch(after);p.paint();}return{first,final:p.snap(),resolved:p.styles()};},{config,after});
    check(observed);results.push({name,status:'pass',observed});
  };
  const base={stateStyles:{selected:{fontSize:'26px',foreGroundFill:{color:0xff0000}}}};
  await record('no local map uses ancestor selected formatting for all nested text runs',
    {selected:true,views:{parent:base,leaf:{}}},o=>{for(const id of ['first','second','linked']){assert.equal(o.final.nodes[id].fontSize,'26px');assert.equal(o.final.nodes[id].color,'rgb(255, 0, 0)');}assert.equal(o.final.nodes.link.color,'rgb(0, 0, 255)');});
  await record('empty local map restores separate original run formats and retains selected class',
    {selected:true,views:{parent:base,leaf:{}}},o=>{assert.equal(o.first.nodes.first.fontSize,'26px');assert.equal(o.final.nodes.first.fontSize,'20px');assert.equal(o.final.nodes.second.fontSize,'30px');assert.equal(o.final.nodes.linked.fontSize,'24px');assert.equal(o.final.nodes.first.color,'rgb(18, 52, 86)');assert.ok(o.final.classes.split(' ').includes('selected'));},{stateStyles:{}});
  await record('partial local selected color does not inherit ancestor selected font size',
    {selected:true,views:{parent:base,leaf:{stateStyles:{selected:{foreGroundFill:{color:0x112233}}}}}},o=>{assert.equal(o.final.nodes.first.fontSize,'20px');assert.equal(o.final.nodes.second.fontSize,'30px');assert.equal(o.final.nodes.second.color,'rgb(17, 34, 51)');});
  await record('ordinary adaptive normal fonts remain when state map is empty',
    {selected:true,views:{parent:{fontSize:'18px',...base},leaf:{stateStyles:{}}}},o=>{assert.equal(o.final.nodes.first.fontSize,'18px');assert.equal(o.final.nodes.second.fontSize,'18px');});
  await record('invalid false-underline true-strike compound leaves restored original decoration',
    {selected:true,views:{leaf:{stateStyles:{selected:{underline:false,strikethrough:true}}}}},o=>{assert.equal(o.final.nodes.first.decoration,'underline');assert.equal(o.final.nodes.second.decoration,'line-through');});
  await record('explicit underline false clears both ordinary run decorations but anchor own style stays',
    {selected:true,views:{leaf:{stateStyles:{selected:{underline:false}}}}},o=>{assert.equal(o.final.nodes.first.decoration,'none');assert.equal(o.final.nodes.second.decoration,'none');assert.equal(o.final.nodes.link.decoration,'underline');});
  await record('rich-set marker suppresses direct normal font overrides but preserves active state font',
    {richSet:true,selected:true,views:{parent:{fontSize:'18px'},leaf:{stateStyles:{selected:{fontSize:'25px'}}}}},o=>{assert.equal(o.first.nodes.first.fontSize,'25px');assert.equal(o.final.nodes.first.fontSize,'20px');assert.equal(o.final.nodes.second.fontSize,'30px');assert.equal(o.final.rich,true);},{stateStyles:{}});
  await record('rich-set direct font exclusion still permits named normal font style to re-enter',
    {richSet:true,stylesById:{named:{fontSize:'21px'}},views:{leaf:{baseStyle:'named',fontSize:'34px'}}},o=>{assert.equal(o.final.nodes.first.fontSize,'21px');assert.equal(o.final.nodes.second.fontSize,'21px');});
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
  const report={generatedAt:new Date().toISOString(),kind:'actual-isolated-Edge-DOM-with-retained-jQuery-and-exact-style-slices',nativeGuiExecuted:false,browser:browser.version(),sources:sources.map(({text,...rest})=>rest),slices,
    harness:{path:'research/adaptive-behavior-state-dom-probe.mjs',sha256:sha(fs.readFileSync(import.meta.filename))},
    boundaries:['Synthetic DOM and generated-object records; not a native exported page or native GUI capture.',
      'Lookup, text CSS reset/cache/application and state classes are original slices. SVG draw, geometry/corners, effects and image endpoints are explicit sinks.',
      'Computed font/color/decoration strings were read from actual Edge. No claim about original fonts, visual glyph pixels, or final complete cascade.',
      'Rich-set marker is assigned by harness to isolate subsequent lookup. Setter parsing is covered by frozen earlier research, not executed here.'],
    passed:results.length,failed:0,results,network,errors};
  fs.writeFileSync('research/adaptive-behavior-state-dom-probe.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:results.length,browser:report.browser,network,errors}));
}finally{await context.close();await browser.close();}
