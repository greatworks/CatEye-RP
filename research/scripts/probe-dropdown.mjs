// Research only. Executes SHA-pinned original function slices with the shipped
// jQuery in an isolated browser. No original app, generated page, or product.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins = {
  'expr.js': '530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6',
  'events.js': 'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3',
  'axQuery.std.js': '0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd',
  'sto.js': 'c1ff17b0ed8a2e3a34cba550c7f4e9447827d131e38542d397e686c0e0b6b9b6',
  'repeater.js': 'd4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b',
  '../jquery-3.7.1.min.js': '8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85',
};
const sha = b => crypto.createHash('sha256').update(b).digest('hex'), sources = {};
const files = Object.entries(pins).map(([file, hash]) => {
  const name = path.resolve(base, file), bytes = fs.readFileSync(name);
  assert.equal(sha(bytes), hash); sources[file] = bytes.toString('utf8').split(/\r?\n/);
  return { file, path: name, sha256: hash };
});
const slice = (file, first, last) => sources[file].slice(first - 1, last).join('\n');
const ranges = [
  ['sto.js', 210, 214], ['expr.js', 15, 59],
  ['expr.js', 127, 180], ['expr.js', 204, 233], ['expr.js', 242, 244],
  ['expr.js', 273, 283], ['expr.js', 562, 565], ['expr.js', 586, 590],
  ['axQuery.std.js', 840, 881], ['axQuery.std.js', 883, 916], ['axQuery.std.js', 951, 991],
  ['axQuery.std.js', 1257, 1266], ['events.js', 693, 710],
  ['events.js', 217, 226], ['events.js', 281, 415], ['events.js', 605, 618],
  ['events.js', 1701, 1717], ['events.js', 1810, 1814],
];
const bindings = [['events.js', 1184, 1190], ['events.js', 935, 959]];
const staticRanges = [['axQuery.std.js', 87, 104], ['events.js', 772, 790], ['events.js', 805, 838], ['repeater.js', 205, 280]];
const bootstrap = `
var _exprFunctions={},_exprHandlers={},_event={},trace=[],objects={},handlers={},browserEvent;
var _enteredWidgets={},_widgetToFocusParent={},_eventTypeToKey={},_layerRdoToFocusableWidget={};
var eventNestingTime=0,eventNesting=0,suppressedEventStatus={},suppressingEvents={},allowBubble=[],preventDefaultEvents=[];
var _isSuppressedEvent=()=>false,_getCanClick=()=>true,_shouldShowCaseDescriptions=()=>false,postMessage=()=>{};
var _shouldIgnoreLabelClickFromCheckboxOrRadioButton=()=>false;
var $jobj=id=>$('#'+id),$obj=id=>objects[id];
var $ax=function(selector){return Object.assign(Object.create($ax.public.fn),{getElementIds:()=>[selector.slice(1)],jQuery:()=>$(selector)})};
$ax.public={fn:{IsComboBox:t=>t==='combo',IsListBox:t=>t==='list',IsCheckBox:t=>t==='checkbox',IsRadioButton:t=>t==='radio',IsTextBox:t=>t==='text',IsTextArea:t=>t==='textarea',IsLayerOrRdo:()=>false,IsReferenceDiagramObject:()=>false,IsLayer:()=>false,IsVector:()=>false}};
$ax.event=_event;$ax.INPUT=id=>id+'_input';$ax.getTypeFromElementId=id=>objects[id]?.type;
$ax.getObjectFromElementId=id=>objects[id];$ax.style={IsWidgetDisabled:id=>!!objects[id]?.disabled,getObjVisible:id=>!objects[id]?.hidden};
$ax.placeholderManager={isActive:()=>false};$ax.deepCopy=v=>structuredClone(v);
$ax.recording={maybeRecordEvent:()=>{}};$ax.action={flushAllResizeMoveActions:()=>{},repeatersToRefresh:[]};
$ax.repeater={applySuffixToElementId:(id,suffix)=>id+suffix,getScriptIdFromElementId:id=>id.split('-')[0],getItemIdFromElementId:id=>id.includes('-')?id.split('-')[1]:undefined,createElementId:(id,row)=>row?id+'-'+row:id};
$ax.getParentRepeaterFromScriptId=id=>id.startsWith('row')?'r':undefined;
$ax.getScriptIdFromPath=p=>p.at(-1);
$ax.getjBrowserEvent=()=>browserEvent;$ax.setjBrowserEvent=e=>browserEvent=e;
$ax.getEventInfoFromEvent=(e,skip,id)=>({srcElement:id,event:'onSelectionChange'});
var _evaluateExpr=(expr,eventInfo)=>expr.callback?expr.callback(eventInfo):expr.value;
$ax.expr={evaluateExpr:_evaluateExpr};$ax.evaluateSTO=sto=>sto.result;
var _handleCaseGroup=info=>{const input=document.getElementById(info.srcElement+'_input');trace.push({kind:'case',id:info.srcElement,event:info.event,value:input?.value,index:input?.selectedIndex});handlers[info.srcElement]?.();return false};
${ranges.map(r=>slice(...r)).join('\n')}
function bindChange(elementId){var dObj=objects[elementId],$element=$jobj(elementId);${slice(...bindings[0])}}
function bindSubmit(elementId){var dObj=objects[elementId],$element=$jobj(elementId);${slice(...bindings[1])}}
$ax.event.fireClick=id=>trace.push({kind:'submit',id,value:document.activeElement.value});
function reset(){document.body.innerHTML='<main id="stage"></main>';trace=[];objects={};handlers={};browserEvent=undefined;eventNesting=0;}
function add(id,opts={}){
 const root=document.createElement('div');root.id=id;if(opts.hidden)root.style.display='none';const input=document.createElement('select');input.id=id+'_input';input.multiple=!!opts.multiple;if(opts.size!==undefined)input.size=opts.size;input.disabled=!!opts.disabled;
 for(const item of opts.items??['A','B','C']){const option=document.createElement('option');if(typeof item==='string'){option.textContent=item;if(opts.explicit!==false)option.value=item}else{option.textContent=item.text;if(item.value!==undefined)option.value=item.value;option.disabled=!!item.disabled;if(item.selected!==undefined)option.selected=item.selected}input.append(option)}
 root.append(input);document.getElementById('stage').append(root);if(opts.index!==undefined)input.selectedIndex=opts.index;if(opts.indices)Array.from(input.options).forEach((o,i)=>o.selected=opts.indices.includes(i));
 objects[id]={type:opts.multiple||opts.size>1?'list':'combo',disabled:!!opts.disabled,hidden:!!opts.hidden,submitButton:opts.submitButton,interactionMap:opts.events===false?{}:{onSelectionChange:{eventType:'OnSelectionChange',cases:[{actions:[]}]}}};bindChange(id);if(opts.submitButton)bindSubmit(id);return input;
}
function state(id){const input=document.getElementById(id+'_input');return {value:input?.value,index:input?.selectedIndex,jq:input?$(input).val():null,selected:input?Array.from(input.options).flatMap((o,i)=>o.selected?[i]:[]):[],texts:input?Array.from(input.selectedOptions).map(o=>o.textContent):[],read:_exprFunctions.GetSelectedOption([id]),text:_exprFunctions.GetWidgetText([id]),queryValue:$ax('#'+id).value(),trace:structuredClone(trace),active:document.activeElement.id}}
window.dropProbe={reset,add,state,set:(ids,value)=>_exprFunctions.SetSelectedOption(ids,value),on:(id,fn)=>handlers[id]=fn,bindFocus:(id)=>{const input=$jobj(id+'_input');for(const name of ['focus','blur'])_attachDefaultObjectEvent(input,id,name,()=>trace.push({kind:'focus',id,event:name,active:document.activeElement.id}))},focus:id=>$ax('#'+id).focus(),trace:()=>trace};
`;
const browser=await chromium.launch({channel:'msedge',headless:true}), context=await browser.newContext(), requests=[],errors=[],cases=[];
await context.route('**/*',route=>{requests.push(route.request().url());return route.abort()});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({content:sources['../jquery-3.7.1.min.js'].join('\n')});await page.addScriptTag({content:bootstrap});
async function probe(name,body,check){const result=await page.evaluate(`(()=>{${body}})()`);try{check(result)}catch(e){console.error(JSON.stringify({name,result}));throw e}cases.push({name,result,passed:true})}
const events=r=>r.trace.filter(e=>e.kind==='case');
try{
 await probe('single default first',`dropProbe.reset();dropProbe.add('w');return dropProbe.state('w')`,r=>{assert.equal(r.index,0);assert.equal(r.read,'A');assert.equal(events(r).length,0)});
 await probe('empty droplist has no synthetic placeholder',`dropProbe.reset();dropProbe.add('w',{items:[]});return dropProbe.state('w')`,r=>{assert.equal(r.index,-1);assert.equal(r.value,'');assert.equal(r.jq,null);assert.equal(r.text,'')});
 await probe('selected none is preserved by DOM selectedIndex -1',`dropProbe.reset();dropProbe.add('w',{index:-1});return dropProbe.state('w')`,r=>{assert.equal(r.index,-1);assert.equal(r.read,'');assert.equal(r.queryValue,'')});
 await probe('program changed value emits synchronous selection case after assignment',`dropProbe.reset();dropProbe.add('w');dropProbe.set(['w'],'B');trace.push({kind:'after'});return dropProbe.state('w')`,r=>{assert.equal(r.index,1);assert.deepEqual(r.trace.map(e=>e.kind),['case','after']);assert.equal(events(r)[0].value,'B')});
 await probe('same string value emits nothing',`dropProbe.reset();dropProbe.add('w');dropProbe.set(['w'],'A');return dropProbe.state('w')`,r=>assert.equal(events(r).length,0));
 await probe('single GetWidgetText returns selected value string',`dropProbe.reset();dropProbe.add('w',{index:1});return dropProbe.state('w')`,r=>{assert.equal(r.text,'B');assert.equal(typeof r.text,'string')});
 await probe('public query text setter does not select option or rewrite select options',`dropProbe.reset();dropProbe.add('w');$ax('#w').text('B');return {state:dropProbe.state('w'),options:Array.from(document.getElementById('w_input').options).map(o=>o.textContent)}`,r=>{assert.equal(r.state.value,'A');assert.deepEqual(r.options,['A','B','C']);assert.equal(events(r.state).length,0)});
 await probe('matching old value returns from whole multi-target loop',`dropProbe.reset();dropProbe.add('a');dropProbe.add('b',{index:1});dropProbe.set(['a','b'],'A');return {a:dropProbe.state('a'),b:dropProbe.state('b')}`,r=>{assert.equal(r.b.value,'B');assert.equal(events(r.a).length,0)});
 await probe('later matching target skips all still later targets',`dropProbe.reset();dropProbe.add('a',{index:1});dropProbe.add('b');dropProbe.add('c',{index:2});dropProbe.set(['a','b','c'],'A');return {a:dropProbe.state('a'),c:dropProbe.state('c')}`,r=>{assert.equal(r.a.value,'A');assert.equal(r.c.value,'C');assert.equal(events(r.a).length,1)});
 await probe('actual fcall path fanout isolates matching targets and calls setters in reverse order',`dropProbe.reset();dropProbe.add('a');dropProbe.add('b',{index:1});dropProbe.add('c',{index:2});const info={srcElement:'source',targetElement:'original'};_exprHandlers.fcall({functionName:'SetSelectedOption',arguments:[{exprType:'pathLiteral',value:['a','b','c']},{value:'A'}]},info);return {a:dropProbe.state('a'),b:dropProbe.state('b'),c:dropProbe.state('c'),info}`,r=>{assert.equal(r.b.value,'A');assert.equal(r.c.value,'A');assert.deepEqual(events(r.a).map(e=>e.id),['c','b']);assert.equal(r.info.targetElement,'original')});
 await probe('fcall evaluates every target argument before reverse mutations',`dropProbe.reset();dropProbe.add('a');dropProbe.add('b');_exprHandlers.fcall({functionName:'SetSelectedOption',arguments:[{exprType:'pathLiteral',value:['a','b']},{callback:info=>{trace.push({kind:'evaluate',target:info.targetElement});return 'B'}}]},{srcElement:'source'});return dropProbe.state('a')`,r=>assert.deepEqual(r.trace.map(e=>e.kind==='evaluate'?e.target:e.id),['a','b','b','a']));
 await probe('duplicate value assignment from different value chooses first matching option',`dropProbe.reset();dropProbe.add('w',{items:['A','A','B'],index:2});dropProbe.set(['w'],'A');return dropProbe.state('w')`,r=>{assert.equal(r.index,0);assert.equal(events(r).length,1)});
 await probe('same duplicate value preserves second selected index',`dropProbe.reset();dropProbe.add('w',{items:['A','A','B'],index:1});dropProbe.set(['w'],'A');return dropProbe.state('w')`,r=>{assert.equal(r.index,1);assert.equal(events(r).length,0)});
 await probe('unmatched value clears selection and emits on every unmatched request',`dropProbe.reset();dropProbe.add('w');dropProbe.set(['w'],'missing');dropProbe.set(['w'],'missing');return dropProbe.state('w')`,r=>{assert.equal(r.index,-1);assert.equal(r.value,'');assert.equal(events(r).length,2)});
 await probe('empty request without empty option remains none but emits each time',`dropProbe.reset();dropProbe.add('w');dropProbe.set(['w'],'');dropProbe.set(['w'],'');return dropProbe.state('w')`,r=>{assert.equal(r.index,-1);assert.equal(events(r).length,2)});
 await probe('explicit empty value option can be selected',`dropProbe.reset();dropProbe.add('w',{items:['A','','B']});dropProbe.set(['w'],'');return dropProbe.state('w')`,r=>{assert.equal(r.index,1);assert.equal(r.read,'');assert.equal(r.jq,'')});
 await probe('explicit whitespace option value retains literal while implicit value collapses',`dropProbe.reset();dropProbe.add('a',{items:['  A \\n B  ']});dropProbe.add('b',{items:['  A \\n B  '],explicit:false});return {a:dropProbe.state('a'),b:dropProbe.state('b')}`,r=>{assert.equal(r.a.value,'  A \n B  ');assert.equal(r.b.value,'A B');assert.equal(r.a.queryValue,'  A \n B  ')});
 await probe('selected option getter reads value, query value reads display text',`dropProbe.reset();dropProbe.add('w',{items:[{text:'Shown',value:'Stored'}]});return dropProbe.state('w')`,r=>{assert.equal(r.read,'Stored');assert.equal(r.text,'Stored');assert.equal(r.queryValue,'Shown')});
 await probe('number request uses loose equality and therefore no change for string zero',`dropProbe.reset();dropProbe.add('w',{items:['0','1']});dropProbe.set(['w'],0);return dropProbe.state('w')`,r=>assert.equal(events(r).length,0));
 await probe('boolean false request loosely equals current empty string',`dropProbe.reset();dropProbe.add('w',{items:['','false']});dropProbe.set(['w'],false);return dropProbe.state('w')`,r=>{assert.equal(r.index,0);assert.equal(events(r).length,0)});
 await probe('program selection of disabled widget changes value and runs synthetic case',`dropProbe.reset();dropProbe.add('w',{disabled:true});dropProbe.set(['w'],'B');return dropProbe.state('w')`,r=>{assert.equal(r.index,1);assert.equal(events(r).length,1)});
 await probe('program selection of hidden widget runs synthetic case',`dropProbe.reset();dropProbe.add('w',{hidden:true});dropProbe.set(['w'],'B');return dropProbe.state('w')`,r=>{assert.equal(r.index,1);assert.equal(events(r).length,1)});
 await probe('missing event map changes selection without dispatch',`dropProbe.reset();dropProbe.add('w',{events:false});dropProbe.set(['w'],'B');return dropProbe.state('w')`,r=>{assert.equal(r.index,1);assert.equal(events(r).length,0)});
 await probe('reentrant selection completes nested case before outer continuation',`dropProbe.reset();dropProbe.add('w');dropProbe.on('w',()=>{if(document.getElementById('w_input').value==='B')dropProbe.set(['w'],'C')});dropProbe.set(['w'],'B');trace.push({kind:'after'});return dropProbe.state('w')`,r=>{assert.equal(r.value,'C');assert.deepEqual(events(r).map(e=>e.value),['B','C']);assert.equal(r.trace.at(-1).kind,'after')});
 await probe('listbox DOM size>1 default none',`dropProbe.reset();dropProbe.add('w',{size:4});return dropProbe.state('w')`,r=>{assert.equal(r.index,-1);assert.equal(r.jq,null)});
 await probe('multiple DOM default none',`dropProbe.reset();dropProbe.add('w',{multiple:true});return dropProbe.state('w')`,r=>{assert.deepEqual(r.selected,[]);assert.deepEqual(r.jq,[]);assert.deepEqual(r.text,[]);assert.equal(r.read,'')});
 await probe('multiple getter reads topmost selected; text getter retains array; query value concatenates',`dropProbe.reset();dropProbe.add('w',{multiple:true,indices:[0,2]});return dropProbe.state('w')`,r=>{assert.equal(r.read,'A');assert.deepEqual(r.text,['A','C']);assert.equal(r.queryValue,'AC')});
 await probe('multiple one selected array loosely equals request and preserves it',`dropProbe.reset();dropProbe.add('w',{multiple:true,indices:[1]});dropProbe.set(['w'],'B');return dropProbe.state('w')`,r=>{assert.deepEqual(r.selected,[1]);assert.equal(events(r).length,0)});
 await probe('multiple scalar assignment replaces existing selections',`dropProbe.reset();dropProbe.add('w',{multiple:true,indices:[0,2]});dropProbe.set(['w'],'B');return dropProbe.state('w')`,r=>{assert.deepEqual(r.selected,[1]);assert.equal(events(r).length,1)});
 await probe('single array assignment selects first matching DOM option rather than array order',`dropProbe.reset();dropProbe.add('w');dropProbe.set(['w'],['C','B']);return dropProbe.state('w')`,r=>{assert.equal(r.index,1);assert.equal(r.value,'B')});
 await probe('multiple array assignment can select distinct options at low-level API',`dropProbe.reset();dropProbe.add('w',{multiple:true});dropProbe.set(['w'],['C','A']);return dropProbe.state('w')`,r=>assert.deepEqual(r.selected,[0,2]));
 await probe('equal-content array assignment still raises event because arrays differ by identity',`dropProbe.reset();dropProbe.add('w',{multiple:true,indices:[0]});dropProbe.set(['w'],['A']);return dropProbe.state('w')`,r=>{assert.deepEqual(r.selected,[0]);assert.equal(events(r).length,1)});
 await probe('single-placeholder native stringLiteral preserves an array result without string coercion',`dropProbe.reset();dropProbe.add('w',{multiple:true});const value=_exprHandlers.stringLiteral({value:'[[X]]',localVariables:{},stos:[{sto:'fixture',result:['A','C']}]},{});dropProbe.set(['w'],value);return {value,state:dropProbe.state('w')}`,r=>{assert.deepEqual(r.value,['A','C']);assert.deepEqual(r.state.selected,[0,2])});
 await probe('surrounding text forces array result into comma string',`dropProbe.reset();const value=_exprHandlers.stringLiteral({value:'before [[X]] after',localVariables:{},stos:[{sto:'fixture',result:['A','C']}]},{});return {value}`,r=>assert.equal(r.value,'before A,C after'));
 await probe('native equality accepts multi text array vs comma string and empty array vs empty or false',`dropProbe.reset();dropProbe.add('w',{multiple:true,indices:[0,2]});const a=_exprFunctions.GetWidgetText(['w']);dropProbe.add('empty',{multiple:true});const b=_exprFunctions.GetWidgetText(['empty']);return {array:a,comma:isEqual(a,'A,C',false),bool:isEqual(a,true,false),emptyString:isEqual(b,'',false),emptyFalse:isEqual(b,false,false)}`,r=>assert.deepEqual(r,{array:['A','C'],comma:true,bool:false,emptyString:true,emptyFalse:true}));
 await probe('native getBool arrays avoid lowercase and preserve case-sensitive singleton quirks',`dropProbe.reset();return ['false','FALSE','true','TRUE','0'].map(v=>{dropProbe.add(v,{items:[v],multiple:true,indices:[0]});const a=_exprFunctions.GetWidgetText([v]);return {text:v,array:a,falseEqual:isEqual(a,false,false),trueEqual:isEqual(a,true,false),selectedFalse:isEqual(_exprFunctions.GetSelectedOption([v]),false,false)}})`,r=>assert.deepEqual(r.map(x=>[x.text,x.falseEqual,x.trueEqual,x.selectedFalse]),[['false',true,false,true],['FALSE',false,false,true],['true',false,true,false],['TRUE',false,false,false],['0',true,false,true]]));
 await probe('two native array expressions compare enumerable elements recursively',`dropProbe.reset();return {same:isEqual(['A','B'],['A','B'],false),different:isEqual(['A','B'],['A','C'],false)}`,r=>assert.deepEqual(r,{same:true,different:false}));
 await probe('multiple duplicate values selects every matching option',`dropProbe.reset();dropProbe.add('w',{items:['A','A','B'],multiple:true,indices:[2]});dropProbe.set(['w'],'A');return dropProbe.state('w')`,r=>{assert.deepEqual(r.selected,[0,1]);assert.equal(events(r).length,1)});
 await probe('multiple duplicates repeated scalar request still emits',`dropProbe.reset();dropProbe.add('w',{items:['A','A','B'],multiple:true,indices:[0,1]});dropProbe.set(['w'],'A');return dropProbe.state('w')`,r=>{assert.deepEqual(r.selected,[0,1]);assert.equal(events(r).length,1)});
 await probe('multiple array joined comma can suppress a distinct scalar option',`dropProbe.reset();dropProbe.add('w',{items:['A','B','A,B'],multiple:true,indices:[0,1]});dropProbe.set(['w'],'A,B');return dropProbe.state('w')`,r=>{assert.deepEqual(r.selected,[0,1]);assert.equal(events(r).length,0)});
 await probe('multiple no selection array loosely equals empty request and does not select empty option',`dropProbe.reset();dropProbe.add('w',{items:['','A'],multiple:true});dropProbe.set(['w'],'');return dropProbe.state('w')`,r=>{assert.deepEqual(r.selected,[]);assert.equal(events(r).length,0)});
 await probe('multiple unmatched clears selected and repeated invalid requests emit',`dropProbe.reset();dropProbe.add('w',{multiple:true,indices:[1]});dropProbe.set(['w'],'missing');dropProbe.set(['w'],'missing');return dropProbe.state('w')`,r=>{assert.deepEqual(r.selected,[]);assert.equal(events(r).length,2)});
 await probe('program setting disabled option is reflected by DOM getter but filtered from jQuery val',`dropProbe.reset();dropProbe.add('w',{items:[{text:'A',value:'A'},{text:'B',value:'B',disabled:true}]});dropProbe.set(['w'],'B');return dropProbe.state('w')`,r=>{assert.equal(r.index,1);assert.equal(r.read,'B');assert.equal(r.jq,null)});
 await probe('focus query dispatches twice on select as on other native controls',`dropProbe.reset();dropProbe.add('w');dropProbe.bindFocus('w');dropProbe.focus('w');return dropProbe.state('w')`,r=>{assert.equal(r.active,'w_input');assert.equal(r.trace.filter(e=>e.kind==='focus'&&e.event==='focus').length,2)});
 await probe('disabled select rejects actual focus and guarded user Focus callbacks',`dropProbe.reset();dropProbe.add('w',{disabled:true});dropProbe.bindFocus('w');dropProbe.focus('w');return dropProbe.state('w')`,r=>{assert.notEqual(r.active,'w_input');assert.equal(r.trace.filter(e=>e.kind==='focus').length,0)});
 await probe('select Submit Enter prevents default and clicks assigned target on keyup',`dropProbe.reset();dropProbe.add('w',{submitButton:{path:[],id:'button'}});const down=$.Event('keydown',{keyCode:13});$('#w_input').trigger(down);const before=structuredClone(trace);$('#w_input').trigger($.Event('keyup',{keyCode:13}));return {prevented:down.isDefaultPrevented(),before,trace}`,r=>{assert.equal(r.prevented,true);assert.deepEqual(r.before,[]);assert.deepEqual(r.trace.map(e=>e.kind),['submit'])});
 await page.evaluate(()=>{dropProbe.reset();dropProbe.add('w',{items:['A','A','B']})});
 await page.locator('#w_input').focus();await page.locator('#w_input').press('ArrowDown');
 const duplicateUser=await page.evaluate(()=>dropProbe.state('w'));assert.equal(duplicateUser.index,1);assert.equal(duplicateUser.value,'A');assert.equal(events(duplicateUser).length,1);cases.push({name:'actual keyboard selection of duplicate text changes index and emits change',result:duplicateUser,passed:true});
 await page.evaluate(()=>{dropProbe.reset();dropProbe.add('w',{index:2})});await page.locator('#w_input').focus();await page.locator('#w_input').press('ArrowDown');
 const unchangedUser=await page.evaluate(()=>dropProbe.state('w'));assert.equal(unchangedUser.index,2);assert.equal(events(unchangedUser).length,0);cases.push({name:'actual ArrowDown at final option does not emit change',result:unchangedUser,passed:true});
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 const report={timestamp:new Date().toISOString(),target:'Axure RP 11.0.0.4150',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',browser:browser.version(),files,sourceSlices:[...ranges,...bindings].map(r=>({file:r[0],first:r[1],last:r[2],mode:'executed',source:slice(...r)})).concat(staticRanges.map(r=>({file:r[0],first:r[1],last:r[2],mode:'static-only',source:slice(...r)}))),cases,networkRequests:requests,pageErrors:errors,limits:['Harness markup, options and object metadata supplied; generated HTML/canvas GUI not executed','Exact original getter/setter/synthetic event dispatcher; case-group action endpoint instrumented','fcall argument evaluator and STO provider instrumented; supplied array result is not proof of an ordinary editor compiler output','Visibility/disabled style getters are explicit fixtures, not full style paint','Focus original query plus disabled event wrapper; native style visuals not reproduced','Submit uses original binding but fireClick endpoint trace; target click/default behavior researched separately','Value/display differences with explicit or implicit option values are host observations pending generator evidence','Disabled options are a browser boundary; audited native option records have no disabled field','Programmatic select value assignment is distinct from SetText and generic selected/checked state','No original app, target DLL execution, product changes, or vendor implementation copied into product']};
 fs.writeFileSync('research/dropdown-evidence.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:cases.length,browser:browser.version(),network:requests.length,errors:errors.length}));
}finally{await browser.close()}
