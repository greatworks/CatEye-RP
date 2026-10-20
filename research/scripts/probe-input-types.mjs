// Research only. Exact pinned Axure function slices with shipped jQuery and
// actual isolated Edge controls. No vendor app/compiler/product bundle loads.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const pins = {
  'style.js': 'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c',
  'events.js': 'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3',
  'expr.js': '530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6',
  'flyout.js': '13e003db00c1f89f6e628ea61492de4d09053143e5f9c68c5bf30c35e6f2a788',
  'doc.js': '986e90c2fc4ddefc64063b8e865b88466bf76ea76ca26df5d72104f7f3a1e8b1',
  'axQuery.std.js': '0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd',
  'action.js': 'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3',
  '../jquery-3.7.1.min.js': '8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85',
};
const sources = {}, hash = b => crypto.createHash('sha256').update(b).digest('hex');
const files = Object.entries(pins).map(([file, sha256]) => {
  const filename = path.resolve(base, file), bytes = fs.readFileSync(filename);
  assert.equal(hash(bytes), sha256, file); sources[file] = bytes.toString('utf8').split(/\r?\n/);
  return { file, path: filename, sha256 };
});
const slice = (file, first, last) => sources[file].slice(first - 1, last).join('\n');
const ranges = [
  ['style.js', 291, 320], ['flyout.js', 214, 285], ['expr.js', 289, 300], ['expr.js', 586, 590],
  ['events.js', 1796, 1808], ['doc.js', 715, 721], ['axQuery.std.js', 883, 917],
  ['axQuery.std.js', 1257, 1266], ['action.js', 2071, 2093],
];
const wrappedRanges = [['events.js', 855, 933], ['events.js', 1196, 1211]];
const bootstrap = `
var ANDROID=false, objects={}, trace=[], _hintWidgets={}, elementIdToText={}, _exprFunctions={}, _actionHandlers={};
var _generateState=id=>'',_computeAllOverrides=()=>({}),_applyTextStyle=()=>{},_updateStateClasses=()=>{};
var $jobj=id=>$('#'+id),$obj=id=>objects[id];
function $ax(selector){var id=selector.slice(1);return{getElementIds:()=>[id],text:()=>getWidgetText(id),focus:function(){return $ax.public.fn.focus.call(this)}}}
$ax.style={};$ax.public={fn:{IsTextBox:t=>t==='input',IsTextArea:t=>t==='textarea',IsCheckBox:t=>t==='checkbox'}};
$ax.event={getFocusableWidgetOrChildId:id=>id+'_input',raiseSyntheticEvent:(id,event)=>trace.push({event,id,value:$('#'+id+'_input').val(),logical:_exprFunctions.GetWidgetText([id])})};
$ax.repeater={applySuffixToElementId:(id,suffix)=>id+suffix};$ax.adaptive={currentViewId:''};$ax.INPUT=id=>id+'_input';
$ax.getObjectFromElementId=id=>objects[id];$ax.setjBrowserEvent=()=>{};$ax.getElementIdsFromPath=p=>[p.at(-1)];
var _dispatchAction=()=>trace.push({event:'continuation'});
${ranges.map(r=>slice(...r)).join('\n')}
function bindHint(elementId,dObj){var isInput=true,inputJobj=$('#'+elementId+'_input');${slice(...wrappedRanges[0])}}
function bindChange(elementId,dObj){${slice(...wrappedRanges[1])}}
function reset(){document.body.replaceChildren();objects={};trace=[];_hintWidgets={};elementIdToText={};idToPlaceholderInfo={}}
function add(type,{value='',hint,hideOnFocus=false,maxLength,attribute=false}={}){
 reset();var root=document.createElement('div');root.id='w';var input=document.createElement('input');input.id='w_input';input.type=type;
 if(maxLength!==undefined)input.maxLength=maxLength;
 root.append(input);document.body.append(root);objects.w={type:'input',placeholderText:hint,HideHintOnFocused:hideOnFocus,interactionMap:{onTextChange:{}}};
 var error;try{if(attribute)input.setAttribute('value',value);else input.value=value;if(hint!==undefined)bindHint('w',objects.w);bindChange('w',objects.w)}catch(e){error={name:e.name,message:e.message}}
 return {input,error};
}
function snap(){var e=document.getElementById('w_input');return{type:e.type,value:e.value,attribute:e.getAttribute('value'),logical:_exprFunctions.GetWidgetText(['w']),activeHint:$ax.placeholderManager.isActive('w'),hintStyle:Boolean(_hintWidgets.w),valid:e.validity.valid,badInput:e.validity.badInput,typeMismatch:e.validity.typeMismatch,stepMismatch:e.validity.stepMismatch,tooLong:e.validity.tooLong,selection:[e.selectionStart,e.selectionEnd],files:[...e.files??[]].map(f=>({name:f.name,size:f.size,type:f.type})),trace:structuredClone(trace)}}
function setText(value){trace=[];var error;try{_exprFunctions.SetWidgetFormText(['w'],value)}catch(e){error={name:e.name,message:e.message}}return{...snap(),error}}
window.inputProbe={add,reset,snap,setText,focusAction:()=>_actionHandlers.setFocusOnWidget({srcElement:'source'},[{objectPaths:[['w']],selectText:true}],0)};
`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext(), requests = [], errors = [], cases = [];
await context.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ content: sources['../jquery-3.7.1.min.js'].join('\n') });
await page.addScriptTag({ content: bootstrap });
const types = ['text','password','email','number','tel','url','search','file','date','month','time'];
async function probe(name, expression, check) {
  const result = await page.evaluate(expression); try {check(result)} catch(e) {console.error(JSON.stringify({name,result}));throw e}
  cases.push({ name, passed: true, result });
}
try {
  const values = {
    text:[' a\r\nb\tc ','Unicode 字 [[literal]]'], password:[' a\r\nb\tc '], tel:[' a\r\nb\tc '], search:[' a\r\nb\tc '],
    email:[' \t user@example.com \n','a\r\nb@example.com','a b@example.com','\u00a0x@y.com\u00a0','a@b.com, c@d.com','\fuser@example.com\f','\vuser@example.com\v'],
    url:[' \t https://example.com/a\n ','https://exa\nmple.com','a b','\u00a0abc\u00a0'],
    number:['0','-1','1.5','.5','1e2','01','+1','1.',' 1 ','1,000','Infinity','NaN','1e309','-','1e','1e+2','1e-9999','-0','-.5','1.e2','1\n'],
    date:['2024-02-29','2023-02-29','2024-2-09','0000-01-01','0001-01-01','10000-01-01','275760-01-01','275760-09-13','275760-09-14','999999-01-01','1900-02-29','2000-02-29','0004-02-29','10000-02-29',' 2024-01-01 ','2024-01-01\n'],
    month:['2024-02','2024-2','2024-13','0000-01','0001-01','10000-01','275760-09','275760-10','999999-01','2024-02\n'],
    time:['09:05','09:05:00','09:05:01','09:05:01.000','09:05:01.1','09:05:01.10','09:05:01.100','09:05:01.123','09:05:01.1234','9:05','24:00','09:60','09:05\n'],
    file:['','x.txt'],
  };
  const expected = {
    number:['0','-1','1.5','.5','1e2','01','','','','','','','','','','1e+2','1e-9999','-0','-.5','1.e2',''],
    date:['2024-02-29','','','','0001-01-01','10000-01-01','275760-01-01','275760-09-13','','','','2000-02-29','0004-02-29','10000-02-29','',''],
    month:['2024-02','','','','0001-01','10000-01','275760-09','','',''],
    time:['09:05','09:05:00','09:05:01','09:05:01.000','09:05:01.1','09:05:01.10','09:05:01.100','09:05:01.123','','','','',''],
    email:['user@example.com','ab@example.com','a b@example.com','\u00a0x@y.com\u00a0','a@b.com, c@d.com','user@example.com','\vuser@example.com\v'],
  };
  for (const [type, value] of [['number','1'],['date','2024-01-01'],['month','2024-02'],['time','09:05']]) {
    values[type].push(value+'\u2028',value+'\u2029'); expected[type].push('','');
  }
  for (const [type, inputs] of Object.entries(values)) {
    const result = await page.evaluate(({type,inputs})=>inputs.map(value=>{
      const attr=inputProbe.add(type,{value,attribute:true});const initialAttribute={...inputProbe.snap(),error:attr.error};
      const prop=inputProbe.add(type,{value});const initialProperty={...inputProbe.snap(),error:prop.error};
      inputProbe.add(type);const setText=inputProbe.setText(value);return{requested:value,initialAttribute,initialProperty,setText};
    }),{type,inputs});
    for(const row of result){
      if(type==='file'&&row.requested){assert.equal(row.initialAttribute.value,'');assert.equal(row.initialProperty.error.name,'InvalidStateError');assert.equal(row.setText.error.name,'InvalidStateError');}
      else {assert.equal(row.initialProperty.value,row.setText.value);assert.equal(row.initialAttribute.value,row.setText.value);}
    }
    if(['text','password','tel','search'].includes(type)) assert.equal(result[0].setText.value,' ab\tc ');
    if(type==='email')assert.equal(result[0].setText.value,'user@example.com');
    if(type==='url')assert.equal(result[0].setText.value,'https://example.com/a');
    if(expected[type])assert.deepEqual(result.map(row=>row.setText.value),expected[type],`${type} exact values`);
    cases.push({name:`initial attribute/property and native SetText normalization: ${type}`,passed:true,result});
  }
  for(const type of types) {
    const result=await page.evaluate(type=>{const setup=inputProbe.add(type,{hint:'Hint',hideOnFocus:true});const initial={...inputProbe.snap(),error:setup.error};if(setup.error)return{initial};
      document.getElementById('w_input').focus();const focused=inputProbe.snap();document.getElementById('w_input').blur();const blurred=inputProbe.snap();return{initial,focused,blurred}},type);
    assert.equal(result.initial.type,type==='password'?'text':type);
    if(type==='file')assert.equal(result.initial.error.name,'InvalidStateError');
    else {assert.equal(result.initial.activeHint,true);assert.equal(result.initial.logical,'');assert.equal(result.focused.activeHint,false);assert.equal(result.focused.type,type);assert.equal(result.blurred.activeHint,true);}
    cases.push({name:`exact Hint manager focus lifecycle: ${type}`,passed:true,result});
  }
  await probe('nonempty invalid SetText deactivates Hint using requested truthiness even when DOM normalizes empty',()=>{
    inputProbe.add('number',{hint:'123'});const before=inputProbe.snap(),set=inputProbe.setText('invalid');return{before,set};
  },r=>{assert.equal(r.before.value,'123');assert.equal(r.before.logical,'');assert.equal(r.set.value,'');assert.equal(r.set.activeHint,false);assert.equal(r.set.trace.filter(e=>e.event==='onTextChange').length,1)});
  await probe('Hint value normalized by email can differ from the stored hint',()=>{inputProbe.add('email',{hint:'  a@b.com  '});return inputProbe.snap()},r=>{assert.equal(r.value,'a@b.com');assert.equal(r.activeHint,true);assert.equal(r.logical,'')});
  await probe('invalid number SetText from empty does not fire TextChanged when normalized DOM remains empty',()=>{inputProbe.add('number');return inputProbe.setText('bad')},r=>{assert.equal(r.value,'');assert.deepEqual(r.trace,[])});
  await probe('file empty Hint initializes without exception and keeps file type',()=>{const {error}=inputProbe.add('file',{hint:''});return{...inputProbe.snap(),error}},r=>{assert.equal(r.error,undefined);assert.equal(r.type,'file');assert.equal(r.activeHint,true);assert.equal(r.hintStyle,false)});
  await probe('parsed file value attribute is retained as markup but ignored by browser value and native getter',()=>{
    inputProbe.reset();document.body.innerHTML='<div id="w"><input id="w_input" type="file" value="C:\\authored\\fake.txt"></div>';objects.w={type:'input',interactionMap:{onTextChange:{}}};bindChange('w',objects.w);return inputProbe.snap();
  },r=>{assert.equal(r.attribute,'C:\\authored\\fake.txt');assert.equal(r.value,'');assert.equal(r.logical,'');assert.deepEqual(r.files,[])});
  for(const type of ['number','date','month','time']){
    const result=await page.evaluate(type=>{const {error}=inputProbe.add(type,{value:'invalid',attribute:true,hint:'Hint'});return{...inputProbe.snap(),error}},type);
    assert.equal(result.error,undefined);assert.equal(result.value,'');assert.equal(result.activeHint,true);assert.equal(result.hintStyle,true);assert.equal(result.logical,'');
    cases.push({name:`invalid authored ${type} value becomes empty before original Hint initialization`,passed:true,result});
  }

  for(const type of ['text','password','email','number','tel','url','search']){
    await page.evaluate(type=>inputProbe.add(type,{maxLength:3}),type);await page.locator('#w_input').focus();await page.keyboard.type('123456');
    const result=await page.evaluate(()=>inputProbe.snap());assert.equal(result.value,type==='number'?'123456':'123');
    const set=await page.evaluate(()=>inputProbe.setText('123456'));assert.equal(set.value,'123456');
    cases.push({name:`maxlength=3 keyboard and native SetText: ${type}`,passed:true,result:{keyboard:result,setText:set}});
  }
  for(const [type,value] of [['date','2024-02-29'],['month','2024-02'],['time','12:34:56']]){
    await page.evaluate(type=>inputProbe.add(type,{maxLength:3}),type);await page.locator('#w_input').fill(value);
    const result=await page.evaluate(()=>inputProbe.snap());assert.equal(result.value,value);
    cases.push({name:`maxlength=3 browser form-control fill: ${type}`,passed:true,result,boundary:'Playwright fills actual date/month/time control; this is not a human native picker capture'});
  }
  for(const type of types){
    const value=({number:'123',date:'2024-02-29',month:'2024-02',time:'12:34',file:''})[type]??'abcd';
    const result=await page.evaluate(({type,value})=>{inputProbe.add(type,{value});trace=[];var actionError;try{inputProbe.focusAction()}catch(e){actionError={name:e.name,message:e.message}}
      var afterAction=inputProbe.snap(),rangeError;try{document.getElementById('w_input').setSelectionRange(1,2)}catch(e){rangeError={name:e.name,message:e.message}}
      return{afterAction,actionError,afterRange:inputProbe.snap(),rangeError,active:document.activeElement.id}}, {type,value});
    assert.equal(result.actionError,undefined);assert.equal(result.active,'w_input');
    if(['text','password','search','tel','url'].includes(type)){assert.deepEqual(result.afterAction.selection,[0,4]);assert.equal(result.rangeError,undefined);}
    else {assert.deepEqual(result.afterAction.selection,[null,null]);assert.equal(result.rangeError.name,'InvalidStateError');}
    cases.push({name:`native Focus selectText and browser selection API: ${type}`,passed:true,result});
  }
  await page.evaluate(()=>inputProbe.add('file',{maxLength:1}));
  await page.locator('#w_input').setInputFiles({name:'选择-test.txt',mimeType:'text/plain',buffer:Buffer.from('research only')});
  const selectedFile=await page.evaluate(()=>inputProbe.snap());assert.equal(selectedFile.value,'C:\\fakepath\\选择-test.txt');assert.equal(selectedFile.logical,selectedFile.value);assert.equal(selectedFile.files.length,1);
  const fileSame=await page.evaluate(value=>inputProbe.setText(value),selectedFile.value);assert.equal(fileSame.error,undefined);assert.equal(fileSame.value,selectedFile.value);assert.deepEqual(fileSame.trace,[]);
  const fileFailure=await page.evaluate(()=>inputProbe.setText('cannot write path'));assert.equal(fileFailure.error.name,'InvalidStateError');assert.equal(fileFailure.value,selectedFile.value);assert.equal(fileFailure.files.length,1);assert.deepEqual(fileFailure.trace,[]);
  const fileClear=await page.evaluate(()=>inputProbe.setText(''));assert.equal(fileClear.value,'');assert.equal(fileClear.files.length,0);assert.equal(fileClear.trace.filter(e=>e.event==='onTextChange').length,1);
  cases.push({name:'local file selection reads fakepath, maxlength ignored, same value no-op, forbidden SetText preserves selection, empty clears',passed:true,result:{selectedFile,fileSame,fileFailure,fileClear},boundary:'File injected by Playwright local buffer, no native picker/UI; bytes never leave isolated page'});
  await page.evaluate(()=>inputProbe.add('number',{hint:'Hint'}));await page.locator('#w_input').focus();await page.keyboard.type('-');
  const incomplete=await page.evaluate(()=>inputProbe.snap());assert.equal(incomplete.value,'');assert.equal(incomplete.badInput,true);assert.equal(incomplete.activeHint,false);
  await page.locator('#w_input').blur();const afterBlur=await page.evaluate(()=>inputProbe.snap());assert.equal(afterBlur.activeHint,false);
  cases.push({name:'incomplete typed number is badInput and empty but must not reactivate Hint',passed:true,result:{incomplete,afterBlur}});
  assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  const report={timestamp:new Date().toISOString(),nativeVersion:'11.0.0.4150',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',packageSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',nativeDllSha256:'dae5748f6be3e69c063ef117bab0b400586d94adf119f5a9ba260df59dc4e4a7',browser:browser.version(),files,officialSources:['https://docs.axure.com/axure-rp/reference/text-fields-text-areas/'],sourceSlices:[...ranges,...wrappedRanges].map(r=>({file:r[0],first:r[1],last:r[2],source:slice(...r),execution:ranges.includes(r)?'exact function slice':'exact source body wrapped with supplied widget/element IDs'})),cases,networkRequests:requests,pageErrors:errors,limitations:['Only official 11 text-field UI types tested; enum-only checkbox/radio/etc excluded','Actual Edge+jQuery functions but harness-supplied markup/attributes; no original GUI/compiler or full app','Style paint endpoints traced/stubbed; Hint flags/value/type functions are actual shipped source','Focus tests exercise original action and query using a supplied simple input focus target resolver','File bytes supplied locally, no OS chooser or upload; date/month/time browser fill is not a native picker UI capture','Android and other browser engines are not probed; unspecified HTML constraints/min/max/step remain browser defaults','Generated nonempty Hint for file or other restricted types is not established solely by this synthetic combination']};
  fs.writeFileSync('research/input-types-evidence.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:cases.length,browser:report.browser,networkRequests:requests.length,pageErrors:errors.length,evidence:'research/input-types-evidence.json'}));
} finally {await browser.close()}
