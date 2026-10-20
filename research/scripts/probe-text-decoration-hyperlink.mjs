import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins={'events.js':'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3','action.js':'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3','../jquery-3.7.1.min.js':'8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85'},sources={};
const hash=b=>createHash('sha256').update(b).digest('hex');const files=Object.entries(pins).map(([file,sha256])=>{const absolute=path.resolve(base,file),bytes=fs.readFileSync(absolute);assert.equal(hash(bytes),sha256);sources[file]=bytes.toString('utf8').split(/\r?\n/);return{file,path:absolute,sha256}});
const slice=(file,start,end)=>sources[file].slice(start-1,end).join('\n');
const ranges=[['events.js',281,415],['events.js',544,595],['events.js',605,626],['events.js',638,648],['action.js',399,449]];
const bindings=['events.js',1260,1314];
const setup=`
var trace=[],objects={},currentEvent,eventNesting=0,eventNestingTime=Date.now(),_enteredWidgets={},_widgetToFocusParent={},_eventTypeToKey={},suppressedEventStatus={},suppressingEvents={},preventDefaultEvents=['OnContextMenu','OnKeyUp','OnKeyDown'],allowBubble=['OnFocus','OnResize','OnMouseOut','OnMouseOver'],_objectIdToEventHandlers={};
var _event={mouseOverIds:[],mouseOverObjectId:'parent',mouseDownObjectId:''},$jobj=id=>$('#'+id),$obj=id=>objects[id];
var _isSuppressedEvent=()=>false,_removeSuppressedEvent=()=>{},_getCanClick=()=>true,_notAllowedInvisible=()=>true,_shouldShowCaseDescriptions=()=>false,postMessage=()=>{};
var $ax={event:_event,getjBrowserEvent:()=>currentEvent,deepCopy:value=>structuredClone(value),recording:{maybeRecordEvent:()=>{}},style:{getObjVisible:()=>true,IsWidgetDisabled:id=>Boolean(objects[id]?.disabled)},features:{eventNames:{mouseDownName:'mousedown',mouseUpName:'mouseup'}},annotation:{updateLinkLocations:id=>trace.push({kind:'annotations',id})},GetParentIdFromLink:()=> 'parent',splice:(a,i)=>a.splice(i,1),repeater:{getScriptIdFromElementId:id=>id,refreshRepeater:()=>{}},expr:{evaluateExpr:value=>typeof value==='object'?'literal' in value?value.literal:value.pass:value},navigate:options=>trace.push({kind:'navigate',options}),action:{repeatersToRefresh:[],flushAllResizeMoveActions:()=>{},tryRefreshRepeaters:()=>{},dispatchAction:(info,actions)=>{trace.push({kind:'actions',source:info.source,count:actions.length});for(let i=0;i<actions.length;i++)if(actions[i].action==='linkWindow')linkActionHelper(info,actions,i)}}};
for(const method of ['SetLinkHover','SetLinkNotHover','SetLinkMouseDown','SetLinkNotMouseDown','SetWidgetMouseDown'])$ax.style[method]=(...args)=>trace.push({kind:method,args});
var _includeVars=()=>false,shouldUseStartHtml=()=>false,_dispatchAction=(info,actions,index)=>trace.push({kind:'continuation',index,link:info.link});
${ranges.map(r=>slice(...r)).join('\n')}
function definition(cases){return{eventType:'OnClick',cases}}
function reset(options={}){trace=[];currentEvent=undefined;eventNesting=0;_event.mouseOverIds=[];_event.mouseOverObjectId='parent';document.body.innerHTML='<div id="parent" style="padding:50px"><a id="link"><span id="linkrun">Learn more about Repeaters</span></a></div>';objects={parent:{disabled:!!options.parentDisabled},link:{type:'hyperlink'}};
 const action={action:'linkWindow',displayName:'Open Link',actionInfoDescriptions:{},linkType:'new',target:{targetType:'webUrl',urlLiteral:{literal:'https://docs.axure.com/axure-rp/widgets/repeaters/'}}};
 const cases=options.noCases?[]:[{disabled:!!options.caseDisabled,condition:options.conditionFalse?{pass:false}:undefined,actions:options.emptyActions?[]:[action]}];
 _objectIdToEventHandlers={link:{click:[function(e){currentEvent=e;_handleEvent('link',{source:'link'},definition(cases))}]}};
 const dObj=objects.link,$element=$('#link');${slice(...bindings)}
 $('#parent').on('click',function(e){trace.push({kind:'parentDOMClick',handled:!!e.originalEvent?.handled})});
 _attachDefaultObjectEvent($('#parent'),'parent','click',function(e){currentEvent=e;_handleEvent('parent',{source:'parent'},definition([{actions:[{action:'parent',actionInfoDescriptions:{}}]}]))});
 $('#parent').on('mousedown',()=>trace.push({kind:'parentDOMDown'}));
 document.body.addEventListener('click',function(e){trace.push({kind:'bodyDOMClick',handled:!!e.handled,defaultPrevented:e.defaultPrevented})},{once:true});}
window.linkProbe={reset,get:()=>structuredClone(trace)};
`;
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage(),network=[],errors=[],cases=[];
await page.route('**/*',route=>{network.push(route.request().url());return route.abort()});page.on('pageerror',error=>errors.push(error.message));
try{
 await page.setContent('<!doctype html><body></body>');await page.addScriptTag({content:sources['../jquery-3.7.1.min.js'].join('\n')});await page.addScriptTag({content:setup});
 for(const [name,options,expectedSources] of [['enabled external link',{},['link']],['empty actions still match',{emptyActions:true},['link']],['disabled only case bubbles',{caseDisabled:true},['parent']],['false condition bubbles',{conditionFalse:true},['parent']],['no cases bubbles',{noCases:true},['parent']],['disabled parent suppresses link and parent handlers',{parentDisabled:true},[]]]){
  await page.evaluate(options=>linkProbe.reset(options),options);await page.locator('#linkrun').click();const trace=await page.evaluate(()=>linkProbe.get());
  assert.deepEqual(trace.filter(t=>t.kind==='actions').map(t=>t.source),expectedSources,name);
  if(name==='enabled external link'){assert.deepEqual(trace.find(t=>t.kind==='navigate').options,{url:'https://docs.axure.com/axure-rp/widgets/repeaters/',target:'new',includeVariables:false,useGlobalVarNameInUrl:false});assert.equal(trace.find(t=>t.kind==='parentDOMClick').handled,true);assert.equal(trace.find(t=>t.kind==='bodyDOMClick').defaultPrevented,false);assert.equal(trace.some(t=>t.kind==='parentDOMDown'),false);}
  cases.push({name,options,trace,passed:true});
 }
 assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
 const report={capturedAt:new Date().toISOString(),method:'Original hyperlink DOM binding, default parent-event attachment, event dispatcher, case-group and navigation-helper slices; fixture maps/conditions and navigation sink; no URL visited',browser:browser.version(),files,sourceSlices:[...ranges,bindings].map(r=>({file:r[0],first:r[1],last:r[2],source:slice(...r)})),cases,network,pageErrors:errors,limits:['Fixture markup uses an anchor without href; original generator element name/href/tab focus not proved','IsWidgetDisabled and style/annotation endpoints are explicit stubs; style behavior separately probed with original functions','Navigation captured at original $ax.navigate boundary; no new window or network navigation executed']};
 fs.writeFileSync('research/text-decoration-runtime-hyperlink-probe.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:cases.length,network:network.length,errors:errors.length}));
}finally{await browser.close();}
