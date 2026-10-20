// Research only: SHA-pinned original functions plus shipped jQuery in an isolated
// Edge document. No vendor app, compiler, product bundle, or network is loaded.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins = {
  'action.js': 'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3',
  'events.js': 'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3',
  'axQuery.std.js': '0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd',
  'doc.js': '986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1',
  'repeater.js': 'd4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b',
  'expr.js': '530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6',
  'style.js': 'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c',
  '../jquery-3.7.1.min.js': '8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85',
};
const sources = {}, sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = Object.entries(pins).map(([file, hash]) => {
  const filename = path.resolve(base, file), bytes = fs.readFileSync(filename); assert.equal(sha(bytes), hash, file);
  sources[file] = bytes.toString('utf8').split(/\r?\n/); return { file, path: filename, sha256: hash };
});
const slice = (file, first, last) => sources[file].slice(first - 1, last).join('\n');
const ranges = [
  ['action.js', 2071, 2093], ['axQuery.std.js', 1257, 1266],
  ['events.js', 693, 710], ['events.js', 605, 618], ['events.js', 778, 784],
  ['events.js', 935, 959], ['events.js', 1629, 1635], ['doc.js', 221, 244],
  ['repeater.js', 1483, 1490], ['repeater.js', 1503, 1526], ['expr.js', 289, 300],
  ['events.js', 217, 226], ['events.js', 281, 415], ['events.js', 1214, 1251],
  ['style.js', 186, 257], ['events.js', 1688, 1693],
];
const staticRanges = [
  ['events.js', 100, 129], ['events.js', 154, 185], ['events.js', 217, 226],
  ['events.js', 281, 324], ['events.js', 650, 669], ['events.js', 759, 790],
  ['events.js', 846, 959], ['events.js', 1195, 1213], ['doc.js', 175, 207],
];
const bootstrap = `
var trace=[],objects={},parents={},itemIds={},placeholders={},paths={},_layerRdoToFocusableWidget={};
var _actionHandlers={},_exprFunctions={},_repeaterManager={},_event={};
var _enteredWidgets={},_widgetToFocusParent={},_selectedWidgets={},_eventTypeToKey={};
var _isSuppressedEvent=()=>false,_getCanClick=()=>true,suppressedEventStatus={},suppressingEvents={},allowBubble=[],preventDefaultEvents=[];
var eventNestingTime=0,eventNesting=0,browserEvent;
var _shouldShowCaseDescriptions=()=>false,postMessage=()=>{};
var _handleCaseGroup=(info,cases)=>{trace.push({kind:'case',id:info.srcElement,event:info.event});return false};
var SELECTED='selected',_widgetHasState=()=>false,_hasAnySelectedClass=()=>false;
var _generateFullState=()=>({}),_applyImageAndTextJson=()=>{},_updateElementIdImageStyle=()=>{};
var $jobj=id=>$('#'+id);
var $ax=function(selector){return Object.assign(Object.create($ax.public.fn),{getElementIds:()=>[selector.slice(1)]})};
$ax.public={fn:{IsCheckBox:type=>type==='checkbox',IsRadioButton:type=>type==='radio',IsDynamicPanel:()=>false,IsLayerOrRdo:()=>false,IsReferenceDiagramObject:()=>false,IsLayer:()=>false,IsVector:()=>false}};$ax.event=_event;$ax.repeater=_repeaterManager;
$ax.INPUT=id=>id+'_input';$ax.deepCopy=value=>structuredClone(value);
$ax.features={supports:{mobile:false}};
$ax.style={IsWidgetDisabled:id=>!!objects[id]?.disabled,SetWidgetFocused:(id,value)=>trace.push({kind:'style',id,value})};
$ax.style.getObjVisible=id=>!objects[id]?.hidden;
var _isWidgetDisabled=id=>$ax.style.IsWidgetDisabled(id),$obj=id=>objects[id];
$ax.getTypeFromElementId=id=>objects[id]?.type;
$ax.recording={maybeRecordEvent:()=>{}};$ax.action={flushAllResizeMoveActions:()=>{},repeatersToRefresh:[]};
$ax.getPathFromScriptId=id=>[id];$ax.getElementIdFromPath=(p,opts)=>$ax.repeater.createElementId(p.at(-1),opts.itemNum);
$ax.visibility={isScriptIdLimbo:()=>false};
$ax.placeholderManager={isActive:id=>!!placeholders[id],updatePlaceholder:(id,active)=>trace.push({kind:'hintUpdate',id,active})};
$ax.getParentRepeaterFromScriptId=id=>parents[id];$ax.getItemIdsForRepeater=id=>itemIds[id];
$ax.getObjectFromElementId=id=>objects[id];
$ax.getScriptIdFromPath=(path,source)=>{trace.push({kind:'path',path,source});return paths[JSON.stringify(path)]??path.at(-1)};
$ax.getElementIdsFromPath=(path,event)=>$ax.getElementIdsFromEventAndScriptId(event,$ax.getScriptIdFromPath(path,event?.srcElement));
$ax.setjBrowserEvent=e=>{browserEvent=e;trace.push({kind:'browserEvent',keyCode:e.keyCode})};$ax.getjBrowserEvent=()=>browserEvent;
var _dispatchAction=(info,actions,index)=>trace.push({kind:'continue',index});
var _shouldIgnoreLabelClickFromCheckboxOrRadioButton=()=>false;
var _raiseSyntheticEvent=(id,event)=>trace.push({kind:'synthetic',id,event});
$ax.event.raiseSyntheticEvent=_raiseSyntheticEvent;
$ax.event.HasTextChanged=()=>true;$ax.event.TryFireTextChanged=id=>trace.push({kind:'textChangedAttempt',id});
${ranges.filter(([file,first])=>!(file==='events.js'&&[778,935,1214].includes(first))).map(([file,a,b])=>slice(file,a,b)).join('\n')}
function caseEndpoint(elementId,name,e){$ax.setjBrowserEvent(e);_handleEvent(elementId,{srcElement:elementId,event:name},{eventType:name,cases:[{actions:[]}]},true,false)}
function bindFocus(elementId,hideHint=false,full=false){
 var focusObj=$jobj($ax.event.getFocusableWidgetOrChildId(elementId));
 ${slice('events.js',778,784)}
 for(const name of ['focus','blur'])_attachDefaultObjectEvent(focusObj,elementId,name,function(e){trace.push({kind:'user',id:elementId,event:name,active:document.activeElement.id,synthetic:!!e.isTrigger});if(full)caseEndpoint(elementId,name,e)});
 if(hideHint)focusObj.on('focus',()=>{placeholders[elementId]=false;trace.push({kind:'hintFocus',id:elementId})});
}
function bindSubmit(elementId,dObj){var $element=$jobj(elementId);${slice('events.js',935,959)}}
function bindCheck(elementId){var dObj=objects[elementId];${slice('events.js',1214,1251)}}
function bindClick(elementId){const input=$jobj(elementId+'_input');_attachDefaultObjectEvent(input.length?input:$jobj(elementId),elementId,'click',e=>caseEndpoint(elementId,'click',e))}
function submitKey(elementId){try{$('#'+elementId+'_input').trigger($.Event('keyup',{keyCode:13}))}catch(error){trace.push({kind:'thrown',name:error.name,message:error.message})}}
function reset(){document.body.innerHTML='<main id="stage"></main>';trace=[];objects={};parents={};itemIds={};placeholders={};paths={};_layerRdoToFocusableWidget={};_selectedWidgets={};browserEvent=undefined;eventNesting=0;}
function add(id,opts={}){
 const root=document.createElement('div');root.id=id;root.style.display=opts.hidden?'none':'';
 let control;if(opts.tag!==false){control=document.createElement(opts.tag??'input');control.id=id+'_input';control.value=opts.value??'abc';control.disabled=!!opts.disabled;control.readOnly=!!opts.readOnly;if(opts.maxLength!==undefined)control.maxLength=opts.maxLength;if(opts.inputType)control.type=opts.inputType;root.append(control)}
 document.getElementById('stage').append(root);objects[id]={id,type:opts.inputType??'text',disabled:!!opts.disabled,hidden:!!opts.hidden};return {root,control};
}
function focusAction(ids,selectText=false,eventInfo={srcElement:'outside'}){const actions=[{objectPaths:ids.map(id=>[id]),selectText}];_actionHandlers.setFocusOnWidget(eventInfo,actions,0)}
function result(id){const input=document.getElementById(id+'_input');return{trace:structuredClone(trace),active:document.activeElement.id,selection:input?[input.selectionStart,input.selectionEnd]:undefined,value:input?.value}}
window.formProbe={reset,add,bindFocus,bindSubmit,bindCheck,bindClick,submitKey,focusAction,result};
`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext(); const requests = [];
await context.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
const page = await context.newPage(), errors=[]; page.on('pageerror', error => errors.push(error.message));
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ content: sources['../jquery-3.7.1.min.js'].join('\n') });
await page.addScriptTag({ content: bootstrap });
const cases=[];
async function probe(name, code, check){const result=await page.evaluate(`(${code})()`);try{check(result)}catch(error){console.error(JSON.stringify({name,result}));throw error}cases.push({name,result,passed:true})}
try {
  await probe('fresh target: synthetic focus handlers, old blur, real focus handlers, continuation', `()=>{formProbe.reset();formProbe.add('old');formProbe.add('w');formProbe.bindFocus('old');formProbe.bindFocus('w');document.getElementById('old_input').focus();trace=[];formProbe.focusAction(['w']);return formProbe.result('w')}`, r=>{assert.equal(r.active,'w_input');assert.deepEqual(r.trace.filter(t=>t.kind==='user').map(t=>[t.id,t.event,t.active]),[['w','focus','old_input'],['old','blur',''],['w','focus','w_input']]);});
  await probe('already focused target still has two jQuery focus dispatches', `()=>{formProbe.reset();formProbe.add('w');formProbe.bindFocus('w');document.getElementById('w_input').focus();trace=[];formProbe.focusAction(['w']);return formProbe.result('w')}`,r=>{assert.equal(r.trace.filter(t=>t.kind==='user').length,2)});
  await probe('only first object path and first mapped row are focused', `()=>{formProbe.reset();for(const id of ['row-3','row-1','other']){formProbe.add(id);formProbe.bindFocus(id)}parents.row='r';itemIds.r=['3','1'];formProbe.focusAction(['row','other'],true);return formProbe.result('row-3')}`,r=>{assert.equal(r.active,'row-3_input');assert.deepEqual(r.selection,[0,3]);assert.deepEqual(r.trace.filter(t=>t.kind==='path').map(t=>t.path),[['row']]);});
  await probe('same repeater source binds its own row before focus', `()=>{formProbe.reset();for(const id of ['row-3','row-1']){formProbe.add(id);formProbe.bindFocus(id)}parents.row='r';parents.source='r';itemIds.r=['3','1'];formProbe.focusAction(['row'],false,{srcElement:'source-1'});return formProbe.result('row-1')}`,r=>assert.equal(r.active,'row-1_input'));
  await probe('selectText false leaves an existing caret unchanged', `()=>{formProbe.reset();const {control}=formProbe.add('w');formProbe.bindFocus('w');control.focus();control.setSelectionRange(1,1);trace=[];formProbe.focusAction(['w'],false);return formProbe.result('w')}`,r=>assert.deepEqual(r.selection,[1,1]));
  await probe('active typing-mode hint prevents text selection', `()=>{formProbe.reset();const {control}=formProbe.add('w',{value:'Hint'});formProbe.bindFocus('w');placeholders.w=true;control.setSelectionRange(0,0);formProbe.focusAction(['w'],true);return formProbe.result('w')}`,r=>assert.deepEqual(r.selection,[0,0]));
  await probe('selection checks hint after focus handler changes active state', `()=>{formProbe.reset();formProbe.add('w',{value:'Hint'});formProbe.bindFocus('w',true);placeholders.w=true;formProbe.focusAction(['w'],true);return formProbe.result('w')}`,r=>assert.deepEqual(r.selection,[0,4]));
  await probe('readonly fields focus and select normally', `()=>{formProbe.reset();formProbe.add('w',{readOnly:true});formProbe.bindFocus('w');formProbe.focusAction(['w'],true);return formProbe.result('w')}`,r=>{assert.equal(r.active,'w_input');assert.deepEqual(r.selection,[0,3]);});
  await probe('disabled native control rejects actual focus and guarded user callbacks; select still runs', `()=>{formProbe.reset();formProbe.add('old');document.getElementById('old_input').focus();formProbe.add('w',{disabled:true});formProbe.bindFocus('w');trace=[];formProbe.focusAction(['w'],true);return formProbe.result('w')}`,r=>{assert.equal(r.active,'old_input');assert.equal(r.trace.filter(t=>t.kind==='user').length,0);assert.deepEqual(r.selection,[0,3]);});
  await probe('hidden control: raw handler invocation differs from actual focus acceptance', `()=>{formProbe.reset();formProbe.add('old');document.getElementById('old_input').focus();formProbe.add('w',{hidden:true});formProbe.bindFocus('w');trace=[];formProbe.focusAction(['w'],true);return formProbe.result('w')}`,r=>{assert.equal(r.active,'old_input');assert.deepEqual(r.selection,[0,3]);assert.equal(r.trace.filter(t=>t.kind==='user').length,2);});
  await probe('layer mapped child focuses but root-only select scan does not find nested input', `()=>{formProbe.reset();const root=formProbe.add('layer',{tag:false}).root;const c=formProbe.add('child');root.append(c.root);_layerRdoToFocusableWidget.layer='child';formProbe.bindFocus('child');c.control.setSelectionRange(1,1);formProbe.focusAction(['layer'],true);return formProbe.result('child')}`,r=>{assert.equal(r.active,'child_input');assert.deepEqual(r.selection,[1,1]);});
  await probe('ordinary non-tabbable panel does not recursively choose a form descendant', `()=>{formProbe.reset();const root=formProbe.add('panel',{tag:false}).root;root.append(formProbe.add('child').root);formProbe.focusAction(['panel'],true);return formProbe.result('child')}`,r=>{assert.equal(r.active,'');});
  await probe('empty paths and absent mapped rows both continue without focus', `()=>{formProbe.reset();formProbe.focusAction([]);parents.row='r';itemIds.r=[];formProbe.focusAction(['row']);return {trace}}`,r=>assert.equal(r.trace.filter(t=>t.kind==='continue').length,2));
  await probe('native dispatcher allows both visible Focus cases and rejects hidden Focus cases', `()=>{formProbe.reset();formProbe.add('w');formProbe.add('hidden',{hidden:true});formProbe.bindFocus('w',false,true);formProbe.bindFocus('hidden',false,true);formProbe.focusAction(['w']);formProbe.focusAction(['hidden']);return{trace,active:document.activeElement.id}}`,r=>{assert.equal(r.active,'w_input');assert.deepEqual(r.trace.filter(t=>t.kind==='case').map(t=>[t.id,t.event]),[['w','focus'],['w','focus']]);});

  const submitSetup = `formProbe.reset();formProbe.add('source',{tag:'textarea'});formProbe.add('button',{tag:false});$('#button').on('click',()=>trace.push({kind:'click',id:'button'}));formProbe.bindSubmit('source',{submitButton:{path:[],id:'button'}});trace=[];`;
  await probe('submit Enter keydown prevents default, keyup fires desktop click', `()=>{${submitSetup}const down=$.Event('keydown',{keyCode:13});$('#source_input').trigger(down);const before=trace.slice();$('#source_input').trigger($.Event('keyup',{keyCode:13}));return{prevented:down.isDefaultPrevented(),before,trace}}`,r=>{assert.equal(r.prevented,true);assert.equal(r.before.length,0);assert.equal(r.trace.filter(t=>t.kind==='click').length,1);});
  await probe('submit does not check Shift/Ctrl/Alt or composition flags', `()=>{${submitSetup}$('#source_input').trigger($.Event('keyup',{keyCode:13,shiftKey:true,ctrlKey:true,altKey:true,isComposing:true}));return{trace}}`,r=>assert.equal(r.trace.filter(t=>t.kind==='click').length,1));
  await probe('submit non-Enter neither prevents nor clicks', `()=>{${submitSetup}const e=$.Event('keydown',{keyCode:65});$('#source_input').trigger(e).trigger($.Event('keyup',{keyCode:65}));return{prevented:e.isDefaultPrevented(),trace}}`,r=>{assert.equal(r.prevented,false);assert.equal(r.trace.length,0);});
  await probe('submit repeat keyups each click and source remains focused', `()=>{${submitSetup}document.getElementById('source_input').focus();for(let i=0;i<2;i++)$('#source_input').trigger($.Event('keyup',{keyCode:13}));return{trace,active:document.activeElement.id}}`,r=>{assert.equal(r.trace.filter(t=>t.kind==='click').length,2);assert.equal(r.active,'source_input');});
  await probe('submit same repeater row and input-child preference', `()=>{formProbe.reset();formProbe.add('source-2');formProbe.add('button-2',{inputType:'checkbox'});parents.source=parents.button='r';$('#button-2_input').on('click',()=>trace.push({kind:'click',id:'button-2_input'}));formProbe.bindSubmit('source-2',{submitButton:{path:[],id:'button'}});$('#source-2_input').trigger($.Event('keyup',{keyCode:13}));return{trace,checked:document.getElementById('button-2_input').checked}}`,r=>{assert.equal(r.trace.find(t=>t.kind==='click').id,'button-2_input');assert.equal(r.checked,true);});
  await probe('submit cross-repeater does not expand target into all rows', `()=>{formProbe.reset();formProbe.add('source-2');formProbe.add('button-1',{tag:false});parents.source='r';parents.button='other';$('#button-1').on('click',()=>trace.push({kind:'click'}));formProbe.bindSubmit('source-2',{submitButton:{path:[],id:'button'}});$('#source-2_input').trigger($.Event('keyup',{keyCode:13}));return{trace}}`,r=>assert.equal(r.trace.filter(t=>t.kind==='click').length,0));
  await probe('mobile submit uses synthetic onClick rather than jQuery click', `()=>{${submitSetup}$ax.features.supports.mobile=true;$('#source_input').trigger($.Event('keyup',{keyCode:13}));$ax.features.supports.mobile=false;return{trace}}`,r=>{assert.equal(r.trace.filter(t=>t.kind==='click').length,0);assert.deepEqual(r.trace.find(t=>t.kind==='synthetic'),{kind:'synthetic',id:'button',event:'onClick'});});
  await probe('native submit checkbox: Click case precedes selected change and select callbacks', `()=>{formProbe.reset();formProbe.add('source');formProbe.add('check',{inputType:'checkbox'});formProbe.bindClick('check');formProbe.bindCheck('check');formProbe.bindSubmit('source',{submitButton:{path:[],id:'check'}});formProbe.submitKey('source');return{trace,checked:document.getElementById('check_input').checked,selected:$ax.style.IsWidgetSelected('check')}}`,r=>{assert.equal(r.checked,true);assert.equal(r.selected,false);assert.deepEqual(r.trace.filter(t=>['case','synthetic'].includes(t.kind)).map(t=>t.event),['click','onSelectedChange','onSelect','click','onSelectedChange','onUnselect']);assert.equal(r.trace.at(-1).kind,'thrown');});
  await probe('native submit hidden checkbox skips Click case but changes checked and emits selection callbacks', `()=>{formProbe.reset();formProbe.add('source');formProbe.add('check',{inputType:'checkbox',hidden:true});formProbe.bindClick('check');formProbe.bindCheck('check');formProbe.bindSubmit('source',{submitButton:{path:[],id:'check'}});formProbe.submitKey('source');return{trace,checked:document.getElementById('check_input').checked,selected:$ax.style.IsWidgetSelected('check')}}`,r=>{assert.equal(r.checked,true);assert.equal(r.selected,false);assert.deepEqual(r.trace.filter(t=>['case','synthetic'].includes(t.kind)).map(t=>t.event),['onSelectedChange','onSelect','onSelectedChange','onUnselect']);assert.equal(r.trace.at(-1).kind,'thrown');});
  await probe('native submit disabled checkbox does not change checked or emit guarded callbacks', `()=>{formProbe.reset();formProbe.add('source');formProbe.add('check',{inputType:'checkbox',disabled:true});formProbe.bindClick('check');formProbe.bindCheck('check');formProbe.bindSubmit('source',{submitButton:{path:[],id:'check'}});formProbe.submitKey('source');return{trace,checked:document.getElementById('check_input').checked,selected:$ax.style.IsWidgetSelected('check')}}`,r=>{assert.equal(r.checked,false);assert.equal(r.selected,false);assert.deepEqual(r.trace.filter(t=>['case','synthetic'].includes(t.kind)),[]);});
  await probe('native submit radio Click case precedes group unselect and target select callbacks', `()=>{formProbe.reset();formProbe.add('source');formProbe.add('a',{inputType:'radio'});formProbe.add('b',{inputType:'radio'});$('#a_input,#b_input').attr('name','group');document.getElementById('a_input').checked=true;_selectedWidgets.a=true;for(const id of ['a','b']){formProbe.bindClick(id);formProbe.bindCheck(id)}formProbe.bindSubmit('source',{submitButton:{path:[],id:'b'}});trace=[];formProbe.submitKey('source');return{trace,a:document.getElementById('a_input').checked,b:document.getElementById('b_input').checked}}`,r=>{assert.equal(r.a,false);assert.equal(r.b,true);assert.deepEqual(r.trace.filter(t=>['case','synthetic'].includes(t.kind)).map(t=>[t.id,t.event]),[['b','click'],['a','onSelectedChange'],['a','onUnselect'],['b','onSelectedChange'],['b','onSelect'],['b','click'],['b','onSelectedChange'],['b','onUnselect'],['b','onSelectedChange'],['b','onSelect']]);assert.equal(r.trace.at(-1).kind,'thrown');});

  // These next experiments use HTML attributes supplied by this harness, not
  // generated vendor HTML. They prove browser/default setter behavior only.
  await page.evaluate(()=>{formProbe.reset();formProbe.add('readonly',{readOnly:true,value:'abc'});formProbe.add('limited',{maxLength:3,value:''});});
  await page.locator('#readonly_input').focus(); await page.keyboard.type('XYZ');
  const ro=await page.locator('#readonly_input').inputValue(); assert.equal(ro,'abc');cases.push({name:'HTML readonly prevents actual keyboard editing',result:ro,passed:true,boundary:'Harness-supplied native HTML attribute, not compiler output'});
  await page.locator('#limited_input').focus(); await page.keyboard.type('abcdef');
  const limit=await page.locator('#limited_input').inputValue();assert.equal(limit,'abc');cases.push({name:'HTML maxlength stops actual keyboard editing',result:limit,passed:true,boundary:'Harness-supplied native HTML attribute, not compiler output'});
  await probe('original SetWidgetFormText bypasses readonly and maxlength', `()=>{trace=[];_exprFunctions.SetWidgetFormText(['readonly','limited'],'abcdef');return{readonly:$('#readonly_input').val(),limited:$('#limited_input').val(),trace}}`,r=>{assert.equal(r.readonly,'abcdef');assert.equal(r.limited,'abcdef');});
  const report={timestamp:new Date().toISOString(),targetVersion:'11.0.0.4150',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',packageSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',browser:browser.version(),files,sourceSlices:[...ranges.map(r=>({file:r[0],first:r[1],last:r[2],mode:'executed',source:slice(...r)})),...staticRanges.map(r=>({file:r[0],first:r[1],last:r[2],mode:'static-only',source:slice(...r)}))],cases,networkRequests:requests,pageErrors:errors,limits:['No original GUI/compiler or full vendor app executed','Raw-focus cases trace after the actual disabled guard; additional cases execute full native handleEvent with its case-group endpoint instrumented and logical visibility fixture supplied','Focus style endpoint is a trace adapter, not full native style paint','Hint active flag and post-focus mutation are supplied fixtures, not a re-run of the separate Hint manager probes','ReadOnly/maxlength HTML attributes are supplied by harness until separate generator/CIL evidence confirms output','Layer mapping table is supplied; native layer mapping construction is static-only','Mobile submit is a branch probe on desktop Edge, not a mobile-device observation','Native checkbox/radio binding in this isolated jQuery host causes a second synthetic click pass and an originalEvent.handled TypeError, explicitly caught and retained; do not assume a complete generated page has this same partial-host anomaly']};
  assert.deepEqual(requests,[]);
  // The three checkable-submit cases intentionally retain this original
  // partial-host exception instead of silently repairing vendor behavior.
  assert.equal(errors.length,3);assert.ok(errors.every(message=>message==="Cannot set properties of undefined (setting 'handled')"));
  fs.writeFileSync('research/form-properties-evidence.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:cases.length,browser:report.browser,requests:requests.length,errors:errors.length,evidence:'research/form-properties-evidence.json'}));
} finally {await browser.close()}
