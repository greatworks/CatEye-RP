// Original function slices, real shipped jQuery and an isolated standards-mode DOM.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.argv[2]??'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins={'style.js':'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c','expr.js':'530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6','axQuery.std.js':'0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd','../jquery-3.7.1.min.js':'8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85'};
const sha=b=>createHash('sha256').update(b).digest('hex'),sources={};
const files=Object.entries(pins).map(([file,hash])=>{const name=path.resolve(base,file),bytes=fs.readFileSync(name);assert.equal(sha(bytes),hash);sources[file]=bytes.toString('utf8').split(/\r?\n/);return{file,path:name,sha256:hash}});
const slice=(file,start,end)=>sources[file].slice(start-1,end).join('\n');
const ranges=[['style.js',75,166],['style.js',1647,1714],['style.js',18,73],['style.js',349,592],['style.js',1763,1915],['style.js',2028,2042],['style.js',2076,2094],['style.js',2377,2416],['style.js',2427,2532],['style.js',2590,2618],['expr.js',316,385],['expr.js',753,758],['axQuery.std.js',883,924]];
const setup=`
var _style={},_originalTextCache={},_shapesWithSetRichText={},_adaptiveStyledWidgets={},_exprFunctions={},objects={},trace=[],viewChain=[];
var $jobj=id=>$('#'+id),$obj=id=>objects[id];
var $ax={style:_style,constants:{LINK_TYPE:'hyperlink'},getObjectFromElementId:id=>objects[id],
document:{stylesheet:{defaultStyle:{fontName:'Arial',fontSize:'14px',fontStyle:'normal',fontWeight:400},stylesById:{}}},
adaptive:{currentViewId:'',getAdaptiveIdChain:()=>viewChain},deepCopy:value=>structuredClone(value),
GetTextPanelId:id=>id+'_text',GetShapeIdFromText:id=>id.replace(/_text$/,''),INPUT:id=>id+'_input',public:{fn:{IsCheckBox:t=>t==='checkbox'}},
visibility:{GetCurrentPanelDiagram:()=>null,SetVisible:(element,visible)=>{trace.push({kind:'visible',id:element?.id,visible});if(element)element.style.visibility=visible?'visible':'hidden'}},
repeater:{getScriptIdFromElementId:id=>id.split('-')[0]},getParentRepeaterFromScriptId:()=>undefined,placeholderManager:{refreshPlaceholder:()=>{}},GetParentIdFromLink:()=> 'w',event:{mouseOverObjectId:'',mouseDownObjectId:''}};
var autofitWidget=id=>trace.push({kind:'autofit',id});
${ranges.map(r=>slice(...r)).join('\n')}
function reset(decoration='underline'){document.body.innerHTML='<div id="w"><div class="text" id="w_text"><p><span id="run">Old</span></p></div></div>';document.getElementById('run').style.textDecoration=decoration;_originalTextCache={};_shapesWithSetRichText={};trace=[];viewChain=[];CACHE_COUNTER=0;objects={w:{id:'w',type:'shape',owner:{type:'page'},style:{stateStyles:{}},adaptiveStyles:{}}};$ax.document.stylesheet.stylesById={};}
function snap(){const root=document.getElementById('w_text');return{html:root.innerHTML,text:getWidgetText('w'),rich:!!_shapesWithSetRichText.w,trace:structuredClone(trace),nodes:[...root.querySelectorAll('*')].map(e=>({tag:e.tagName,id:e.id,text:e.textContent,inline:e.style.textDecoration,computed:getComputedStyle(e).textDecorationLine,css:e.style.cssText}))}}
var nativeSetWidgetHover=$ax.style.SetWidgetHover,nativeSetWidgetMouseDown=$ax.style.SetWidgetMouseDown;
$ax.style.SetWidgetHover=(id,value)=>trace.push({kind:'parentHover',id,value});$ax.style.SetWidgetMouseDown=(id,value)=>trace.push({kind:'parentDown',id,value});
function linkFixture(){reset('none');document.getElementById('w_text').innerHTML='<p><span id="outside" style="text-decoration:line-through">Outside</span><a id="link"><span id="linkrun" style="text-decoration:underline">Link</span></a></p>';objects.link={id:'link',type:'hyperlink',owner:{type:'page'},style:{stateStyles:{}},adaptiveStyles:{}};$ax.event.mouseOverObjectId='';$ax.event.mouseDownObjectId='';}
var _idToAppliedStyles={};
$ax.public.fn.IsImageBox=()=>false;$ax.repeater.applySuffixToElementId=(id,suffix)=>id+suffix;
var _computeFullStyle=()=>({}),_applySvg=()=>{},_updateStateClasses=()=>{},_updateCornersForBorders=()=>{};
function installNativeParent(){
 $ax.style.SetWidgetHover=nativeSetWidgetHover;$ax.style.SetWidgetMouseDown=nativeSetWidgetMouseDown;
 $ax.style.getElementImageOverride=()=>false;$ax.style.ShowingHint=()=>false;
 $ax.style.IsWidgetError=id=>!!objects[id]?.error;$ax.style.IsWidgetSelected=id=>!!objects[id]?.selected;
 $ax.style.IsWidgetDisabled=id=>!!objects[id]?.disabled;
}
var _isWidgetDisabled=id=>!!objects[id]?.disabled,_hasAnyFocusedClass=()=>false,_updateElementIdImageStyle=()=>{},_enableStateTransitions=()=>false;
window.decorationProbe={reset,snap,props:_getCssStyleProperties,apply:style=>_applyTextStyle('w_text',style),cache:()=>$ax.style.CacheOriginalText('w_text'),restore:()=>_resetTextJson('w','w_text'),set:(value,plain)=>_exprFunctions.SetWidgetRichText(['w'],value,plain),paint:(state='normal')=>{_resetTextJson('w','w_text');_applyTextStyle('w_text',_computeAllOverrides('w',undefined,state,''))},overrides:(state='normal')=>_computeAllOverrides('w',undefined,state,'')};
`;

const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),network=[],errors=[],cases=[];
await context.route('**/*',route=>{network.push(route.request().url());return route.abort()});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
 await page.setContent('<!doctype html><body></body>');await page.addScriptTag({content:sources['../jquery-3.7.1.min.js'].join('\n')});await page.addScriptTag({content:setup});
 const inspect=String.raw`return [...document.querySelectorAll('#w_text span')].map(e=>({id:e.id,text:e.textContent,color:e.style.color,weight:e.style.fontWeight,decoration:getComputedStyle(e).textDecorationLine}));`;
 async function probe(name,code,check){const result=await page.evaluate(code=>Function(code)(),code);check(result);cases.push({name,result,passed:true});}
 const leaf=r=>r.find(x=>x.id==='linkrun');
 await probe('normal link style and parent base are excluded from overrides',
 "linkFixture();objects.w.style.foreGroundFill={color:0x112233};objects.link.style.foreGroundFill={color:0x445566};objects.link.style.fontWeight=700;decorationProbe.cache();$ax.style.SetLinkHover('link');return {overrides:_computeAllOverrides('link','w','mouseOver',''),html:document.getElementById('w_text').innerHTML};",r=>assert.deepEqual(r.overrides,{}));
 await probe('parent hover then link enter applies parent hover and link hover, leave restores parent paint',
 "linkFixture();objects.w.style.stateStyles.mouseOver={strikethrough:true};objects.link.style.stateStyles.mouseOver={underline:true};decorationProbe.cache();$ax.style.SetWidgetHover=(id,v)=>{trace.push({kind:'parentHover',id,v});_applyImageAndTextJson(id,v?'mouseOver':'normal',true)};$ax.event.mouseOverObjectId='w';_applyImageAndTextJson('w','mouseOver',true);const parent=decorationProbe.snap();$ax.style.SetLinkHover('link');const enter=decorationProbe.snap();$ax.style.SetLinkNotHover('link');return{parent,enter,leave:decorationProbe.snap()};",r=>{assert.equal(r.parent.nodes.find(n=>n.id==='linkrun').computed,'line-through');assert.equal(r.enter.nodes.find(n=>n.id==='linkrun').computed,'underline line-through');assert.equal(r.leave.nodes.find(n=>n.id==='linkrun').computed,'line-through')});
 await probe('parent selected repaint removes current link hover; new link hover ignores selected',
 "linkFixture();objects.w.style.stateStyles.selected={strikethrough:true};objects.link.style.stateStyles.mouseOver={underline:false};decorationProbe.cache();$ax.event.mouseOverObjectId='w';$ax.style.SetLinkHover('link');const enter=decorationProbe.snap();_applyImageAndTextJson('w','mouseOverSelected',true);const selected=decorationProbe.snap();$ax.style.SetLinkHover('link');return{enter,selected,enterAgain:decorationProbe.snap()};",r=>{assert.equal(r.enter.nodes.find(n=>n.id==='linkrun').computed,'none');assert.equal(r.selected.nodes.find(n=>n.id==='linkrun').computed,'line-through');assert.equal(r.enterAgain.nodes.find(n=>n.id==='linkrun').computed,'none')});
 await probe('parent error repaint removes link hover',
 "linkFixture();objects.w.style.stateStyles.error={strikethrough:true};objects.link.style.stateStyles.mouseOver={underline:false};decorationProbe.cache();$ax.style.SetLinkHover('link');_applyImageAndTextJson('w','mouseOverError',true);return decorationProbe.snap();",r=>assert.equal(r.nodes.find(n=>n.id==='linkrun').computed,'line-through'));
 await probe('link adaptive fields override parent hover fields before link hover',
 "linkFixture();viewChain=['phone'];objects.w.style.stateStyles.mouseOver={fontWeight:700,foreGroundFill:{color:0x112233}};objects.link.adaptiveStyles.phone={fontWeight:300,foreGroundFill:{color:0x445566}};objects.link.style.stateStyles.mouseOver={fontWeight:900};decorationProbe.cache();$ax.style.SetLinkHover('link');return{overrides:_computeAllOverrides('link','w','mouseOver','phone'),snapshot:decorationProbe.snap()};",r=>{assert.equal(r.overrides.fontWeight,900);assert.equal(r.overrides.foreGroundFill.color,0x445566)});
 await probe('link mousedown requests parent mousedown only, not its hover state',
 "linkFixture();objects.w.style.stateStyles={mouseOver:{fontWeight:700},mouseDown:{foreGroundFill:{color:0x112233}},selected:{fontSize:'30px'}};objects.link.style.stateStyles.mouseDown={underline:false};decorationProbe.cache();$ax.style.SetLinkMouseDown('link');return{overrides:_computeAllOverrides('link','w','mouseDown',''),snapshot:decorationProbe.snap()};",r=>{assert.equal(r.overrides.fontWeight,undefined);assert.equal(r.overrides.fontSize,undefined);assert.equal(r.overrides.foreGroundFill.color,0x112233);assert.equal(r.snapshot.nodes.find(n=>n.id==='linkrun').computed,'none')});
 await probe('link mouseup reapplies link hover after parent reset',
 "linkFixture();objects.w.style.stateStyles.mouseOver={strikethrough:true};objects.link.style.stateStyles={mouseOver:{underline:true},mouseDown:{underline:false}};decorationProbe.cache();$ax.event.mouseOverObjectId='w';$ax.style.SetWidgetHover=(id,v)=>_applyImageAndTextJson(id,v?'mouseOver':'normal',true);$ax.style.SetLinkMouseDown('link');const down=decorationProbe.snap();$ax.style.SetLinkNotMouseDown('link');return{down,up:decorationProbe.snap()};",r=>{assert.equal(r.down.nodes.find(n=>n.id==='linkrun').computed,'none');assert.equal(r.up.nodes.find(n=>n.id==='linkrun').computed,'underline line-through')});
 await probe('parent adaptive text application replaces link hover until next link styling call',
 "linkFixture();objects.link.style.stateStyles.mouseOver={underline:false};decorationProbe.cache();$ax.style.SetLinkHover('link');$ax.style.setAdaptiveStyle('w',{strikethrough:true});return decorationProbe.snap();",r=>assert.equal(r.nodes.find(n=>n.id==='linkrun').computed,'line-through'));
 await probe('plain SetText mixed span parent drops hyperlink and retains first ordinary span style',
 "linkFixture();decorationProbe.set('Replacement',true);return{snapshot:decorationProbe.snap(),links:document.querySelectorAll('#w_text a').length};",r=>{assert.equal(r.links,0);assert.equal(r.snapshot.text,'Replacement');assert.equal(r.snapshot.nodes.find(n=>n.tag==='SPAN').computed,'line-through')});
 await probe('plain SetText parent sole one span nested in link keeps link wrapper and event',
 "linkFixture();document.getElementById('outside').remove();let clicks=0;$('#link').on('click',()=>clicks++);decorationProbe.set('Replacement',true);$('#linkrun').trigger('click');return{links:document.querySelectorAll('#w_text a').length,clicks,snapshot:decorationProbe.snap()};",r=>{assert.equal(r.links,1);assert.equal(r.clicks,1);assert.equal(r.snapshot.text,'Replacement')});
 await probe('plain multiline parent replacement drops even sole hyperlink',
 "linkFixture();document.getElementById('outside').remove();decorationProbe.set('First\\nSecond',true);return{links:document.querySelectorAll('#w_text a').length,snapshot:decorationProbe.snap()};",r=>{assert.equal(r.links,0);assert.equal(r.snapshot.text,'First\nSecond')});
 await probe('SetText addressed to link retains its outer identity and handler',
 "linkFixture();let clicks=0;$('#link').on('click',()=>clicks++);_exprFunctions.SetWidgetRichText(['link'],'Replaced',true);$('#linkrun').trigger('click');return{links:document.querySelectorAll('#w_text a').length,clicks,snapshot:decorationProbe.snap()};",r=>{assert.equal(r.links,1);assert.equal(r.clicks,1);assert.equal(r.snapshot.nodes.find(n=>n.id==='linkrun').text,'Replaced')});
 await probe('native link leave without parent hover style does not restore selected paint',
 "linkFixture();installNativeParent();objects.w.selected=true;objects.w.style.stateStyles.selected={strikethrough:true};objects.link.style.stateStyles.mouseOver={underline:false};$ax.event.mouseOverObjectId='w';decorationProbe.cache();_applyImageAndTextJson('w','selected',true);$ax.style.SetLinkHover('link');$ax.style.SetLinkNotHover('link');return decorationProbe.snap();",r=>assert.equal(r.nodes.find(n=>n.id==='linkrun').computed,'underline'));
 await probe('native link leave with parent hover style restores full selected plus hover paint',
 "linkFixture();installNativeParent();objects.w.selected=true;objects.w.style.stateStyles={mouseOver:{fontWeight:500},selected:{strikethrough:true}};objects.link.style.stateStyles.mouseOver={underline:false};$ax.event.mouseOverObjectId='w';decorationProbe.cache();$ax.style.SetLinkHover('link');$ax.style.SetLinkNotHover('link');return decorationProbe.snap();",r=>assert.equal(r.nodes.find(n=>n.id==='linkrun').computed,'line-through'));
 await probe('native link leave while pressed asks guarded full parent mousedown paint',
 "linkFixture();installNativeParent();objects.w.style.stateStyles={mouseOver:{underline:true},mouseDown:{strikethrough:true}};objects.link.style.stateStyles.mouseDown={underline:false};$ax.event.mouseDownObjectId='w';$ax.event.mouseOverObjectId='w';decorationProbe.cache();$ax.style.SetLinkMouseDown('link');$ax.style.SetLinkNotHover('link');return decorationProbe.snap();",r=>assert.equal(r.nodes.find(n=>n.id==='linkrun').computed,'underline line-through'));
 await probe('empty link hover override leaves previous parent selected paint unchanged',
 "linkFixture();installNativeParent();objects.w.selected=true;objects.w.style.stateStyles.selected={strikethrough:true};decorationProbe.cache();_applyImageAndTextJson('w','selected',true);$ax.style.SetLinkHover('link');return decorationProbe.snap();",r=>assert.equal(r.nodes.find(n=>n.id==='linkrun').computed,'line-through'));
 assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
 const report={timestamp:new Date().toISOString(),method:'Bounded original style/text function slices with real jQuery and standards DOM; visual shape/geometry endpoints stubbed',browser:browser.version(),files,sourceSlices:ranges.map(r=>({file:r[0],first:r[1],last:r[2],source:slice(...r)})),cases,network,pageErrors:errors,limits:['Parent state argument supplied explicitly; native state determination remains separately retained evidence','Geometry/autofit/image/state-class side effects are stubs','Fixture anchors do not establish original generated tag/href/tabindex']};
 fs.writeFileSync('research/hyperlink-runtime-style-probe.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:cases.length,network:network.length,errors:errors.length}));
}finally{await browser.close();}

