import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins={'events.js':'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3','action.js':'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3','../jquery-3.7.1.min.js':'8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85'},sources={};
const hash=b=>createHash('sha256').update(b).digest('hex');const files=Object.entries(pins).map(([file,sha256])=>{const absolute=path.resolve(base,file),bytes=fs.readFileSync(absolute);assert.equal(hash(bytes),sha256);sources[file]=bytes.toString('utf8').split(/\r?\n/);return{file,path:absolute,sha256}});
const slice=(file,start,end)=>sources[file].slice(start-1,end).join('\n');
const ranges=[['events.js',281,415],['events.js',432,500],['events.js',528,595],['events.js',605,626],['events.js',638,648],['action.js',351,368],['action.js',399,449]];
const bindings=['events.js',1260,1314];
const setup=`
var trace=[],objects={},currentEvent,eventNesting=0,eventNestingTime=Date.now(),_enteredWidgets={},_widgetToFocusParent={},_eventTypeToKey={},suppressedEventStatus={},suppressingEvents={},preventDefaultEvents=['OnContextMenu','OnKeyUp','OnKeyDown'],allowBubble=['OnFocus','OnResize','OnMouseOut','OnMouseOver'],_objectIdToEventHandlers={},pending=[];
var _event={mouseOverIds:[],mouseOverObjectId:'parent',mouseDownObjectId:''},$jobj=id=>$('#'+id),$obj=id=>objects[id],_actionHandlers={},_action={flushAllResizeMoveActions:()=>{}},conditionPass=true;
var _isSuppressedEvent=()=>false,_removeSuppressedEvent=()=>{},_getCanClick=()=>true,_notAllowedInvisible=()=>true,postMessage=(kind,data)=>trace.push({kind,...data});
var $ax={event:_event,getjBrowserEvent:()=>currentEvent,deepCopy:value=>structuredClone(value),eventCopy:value=>structuredClone(value),recording:{maybeRecordEvent:()=>{}},style:{getObjVisible:id=>!objects[id]?.hidden,IsWidgetDisabled:id=>Boolean(objects[id]?.disabled)},features:{eventNames:{mouseDownName:'mousedown',mouseUpName:'mouseup'}},annotation:{updateLinkLocations:()=>{}},GetParentIdFromLink:()=> 'parent',splice:(a,i)=>a.splice(i,1),repeater:{getScriptIdFromElementId:id=>id,refreshRepeater:()=>{}},expr:{evaluateExpr:value=>typeof value==='object'?'literal' in value?value.literal:conditionPass:value},navigate:options=>trace.push({kind:'navigate',options}),action:{repeatersToRefresh:[],flushAllResizeMoveActions:()=>{},tryRefreshRepeaters:()=>{}},document:{configuration:{}},legacy:{SuppressBubble:e=>e.stopPropagation()}};
for(const method of ['SetLinkHover','SetLinkNotHover','SetLinkMouseDown','SetLinkNotMouseDown','SetWidgetMouseDown'])$ax.style[method]=(...args)=>trace.push({kind:method,args});
var _includeVars=()=>false,shouldUseStartHtml=()=>false,_showCaseLinks=()=>{};
window.setTimeout=(callback,delay)=>{pending.push({callback,delay});return pending.length};
${ranges.map(r=>slice(...r)).join('\n')}
_actionHandlers.record=(info,actions,index)=>{trace.push({kind:'record',source:info.source,label:actions[index].label});_dispatchAction(info,actions,index+1)};
_actionHandlers.linkWindow=linkActionHelper;
function act(action,extra={}){return{action,displayName:action,description:action,actionInfoDescriptions:{},...extra}}
function kase(actions,extra={}){return{actions,description:'Case',...extra}}
function definition(cases){return{description:'Click',eventType:'OnClick',cases}}
function reset(options={}){trace=[];currentEvent=undefined;eventNesting=0;pending=[];conditionPass=true;_event.mouseOverIds=[];_event.mouseOverObjectId='parent';document.body.innerHTML='<div id="parent" style="padding:50px"><a id="link"><span id="linkrun">Link</span></a></div>';objects={parent:{disabled:!!options.parentDisabled},link:{type:'hyperlink',disabled:!!options.linkDisabled,hidden:!!options.hidden}};
 $ax.document.configuration.linkStyle=options.menu?'alwaysDisplayTargets':'neverDisplayTargets';
 const nav=act('linkWindow',{linkType:options.target??'new',target:{targetType:'webUrl',urlLiteral:{literal:options.url??'https://example.invalid/destination'}}});
 const wait=act('wait',{waitTime:0});
 let cases=[kase(options.empty?[]:options.wait?[wait,act('record',{label:'after-wait'}),nav]:[act('record',{label:'link'}),nav],{disabled:!!options.disabled,condition:options.condition?{value:true}:undefined})];
 if(options.groups)cases=[kase([wait,act('record',{label:'delayed-first'})]),kase([act('record',{label:'second'})],{isNewIfGroup:true})];
 if(options.none)cases=[];
 _objectIdToEventHandlers={link:{click:[function(e){currentEvent=e;_handleEvent('link',{source:'link',cursor:{x:0,y:0}},definition(cases))}]}};
 const dObj=objects.link,$element=$('#link');${slice(...bindings)}
 $('#parent').on('click',function(e){trace.push({kind:'parentDOM',handled:!!e.originalEvent?.handled})});
 _attachDefaultObjectEvent($('#parent'),'parent','click',function(e){currentEvent=e;_handleEvent('parent',{source:'parent'},definition([kase([act('record',{label:'parent'})])]),true)});
 document.body.addEventListener('click',function(e){trace.push({kind:'bodyDOM',handled:!!e.handled,defaultPrevented:e.defaultPrevented})},{once:true});}
document.addEventListener('click',e=>{currentEvent=$.Event(e)},true);
window.linkProbe={reset,get:()=>({trace:structuredClone(trace),pending:pending.map(p=>({delay:p.delay})),menus:document.querySelectorAll('.intcases').length}),flush:()=>{const jobs=pending.splice(0);for(const job of jobs)job.callback()},condition:value=>conditionPass=value};
`;
new Function(setup);
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage(),network=[],errors=[],cases=[];
await page.route('**/*',route=>{network.push(route.request().url());return route.abort()});page.on('pageerror',error=>errors.push(error.message));
try{
 await page.setContent('<!doctype html><body></body>');await page.addScriptTag({content:sources['../jquery-3.7.1.min.js'].join('\n')});await page.addScriptTag({content:setup});
 async function probe(name,options,check){await page.evaluate(options=>linkProbe.reset(options),options);await page.locator('#linkrun').click();const before=await page.evaluate(()=>linkProbe.get());const result=await check(before);cases.push({name,options,before,...result,passed:true});}
 for(const target of ['current','new'])await probe('external '+target+' navigation',{target},r=>{assert.equal(r.trace.find(t=>t.kind==='navigate').options.target,target);assert.equal(r.trace.find(t=>t.kind==='parentDOM').handled,true);return {}});
 await probe('Wait0 marks original click handled before delayed continuation',{wait:true},async before=>{assert.equal(before.pending[0].delay,0);assert.equal(before.trace.some(t=>t.kind==='record'),false);assert.equal(before.trace.find(t=>t.kind==='parentDOM').handled,true);await page.evaluate(()=>linkProbe.flush());const after=await page.evaluate(()=>linkProbe.get());assert.deepEqual(after.trace.filter(t=>t.kind==='record').map(t=>t.label),['after-wait']);return{after}});
 await probe('independent second IF group runs before earlier Wait0 continuation',{groups:true},async before=>{assert.deepEqual(before.trace.filter(t=>t.kind==='record').map(t=>t.label),['second']);assert.equal(before.trace.find(t=>t.kind==='parentDOM').handled,true);await page.evaluate(()=>linkProbe.flush());const after=await page.evaluate(()=>linkProbe.get());assert.deepEqual(after.trace.filter(t=>t.kind==='record').map(t=>t.label),['second','delayed-first']);return{after}});
 await probe('menu blocks parent click before option selection',{menu:true},async before=>{assert.equal(before.menus,1);assert.equal(before.trace.some(t=>t.kind==='record'),false);assert.equal(before.trace.find(t=>t.kind==='parentDOM').handled,true);await page.locator('.intcaselink').click();const after=await page.evaluate(()=>linkProbe.get());assert.equal(after.menus,0);assert.deepEqual(after.trace.filter(t=>t.kind==='record').map(t=>t.label),['link']);return{after}});
 await probe('menu closes after synchronous Wait prefix but does not cancel continuation',{menu:true,wait:true},async before=>{assert.equal(before.menus,1);await page.locator('.intcaselink').click();const selected=await page.evaluate(()=>linkProbe.get());assert.equal(selected.menus,0);assert.equal(selected.pending.length,1);await page.evaluate(()=>linkProbe.flush());const after=await page.evaluate(()=>linkProbe.get());assert.deepEqual(after.trace.filter(t=>t.kind==='record').map(t=>t.label),['after-wait']);return{selected,after}});
 await probe('always conditional menu evaluates condition only when menu selected',{menu:true,condition:true},async before=>{assert.equal(before.menus,1);await page.evaluate(()=>linkProbe.condition(false));await page.locator('.intcaselink').click();const after=await page.evaluate(()=>linkProbe.get());assert.equal(after.menus,0);assert.equal(after.trace.some(t=>t.kind==='record'),false);return{after}});
 for(const [name,options,expected] of [['disabled parent',{parentDisabled:true},[]],['disabled only case',{disabled:true},['parent']],['link own disabled flag is not binding guard',{linkDisabled:true},['link']],['hidden link event guard permits parent fallback',{hidden:true},['parent']],['empty matching case blocks parent',{empty:true},[]],['no case allows parent',{none:true},['parent']]])await probe(name,options,r=>{assert.deepEqual(r.trace.filter(t=>t.kind==='record').map(t=>t.label),expected);return{}});
 assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
 fs.writeFileSync('research/hyperlink-runtime-event-probe.json',JSON.stringify({capturedAt:new Date().toISOString(),method:'Exact original event, menu, Wait and link-action slices in isolated DOM; deterministic timer queue and navigation sink',browser:browser.version(),files,sourceSlices:[...ranges,bindings].map(r=>({file:r[0],first:r[1],last:r[2],source:slice(...r)})),cases,network,pageErrors:errors,limits:['Event copy, conditions and data lookups are bounded fixture stubs','Menu positioning is a stub, action dispatch/closure/removal are original','Timer queue records exact scheduling and manual continuation; no real URL opened','Original generated href/tabindex remains unknown']},null,2)+'\n');console.log(JSON.stringify({passed:cases.length,network:network.length,errors:errors.length}));
}finally{await browser.close()}


