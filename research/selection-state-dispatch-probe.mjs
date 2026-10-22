import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/';
const paths={style:root+'resources/scripts/axure/style.js',events:root+'resources/scripts/axure/events.js',query:root+'resources/scripts/axure/axQuery.std.js',jquery:root+'resources/scripts/jquery-3.7.1.min.js',css:root+'resources/css/axure_rp_page.css'};
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const text=Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,fs.readFileSync(p,'utf8')]));
assert.equal(sha(paths.style),'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c');
const slice=(name,start,end)=>text[name].split(/\r?\n/).slice(start-1,end).join('\n');
const ranges=[['events',805,838],['events',1214,1251],['query',1087,1137],['query',1181,1255]];
const enabled=text.query.slice(text.query.indexOf('    $ax.public.fn.enabled = function() {'),text.query.indexOf('    $ax.public.fn.visible = function() {'));
const selected=slice('query',1181,1255);
const error=text.query.slice(text.query.indexOf('    $ax.public.fn.error = function () {'),text.query.indexOf('    $ax.public.fn.selected = function() {'));
assert(enabled.includes('return this;'));assert(error.includes('SetWidgetError'));
const instrument=`
const sourceSvg=_applySvg,sourceApply=_applyImageAndTextJson;
_applySvg=function(id,event,style){window.trace.push({kind:'svg',id,event,style:structuredClone(style??_computeFullStyle(id,event,$ax.adaptive.currentViewId))});return sourceSvg.apply(this,arguments);};
_applyImageAndTextJson=function(id,event,blockTransition){window.trace.push({kind:'apply',id,event,blockTransition:!!blockTransition});return sourceApply.apply(this,arguments);};
window.sourceInternals={hasState:_widgetHasState,state:_generateFullState};
`;
const ending=text.style.lastIndexOf('});');assert(ending>0);
const instrumented=text.style.slice(0,ending)+instrument+text.style.slice(ending);
const setup=`
window.makeFixture=input=>{
 document.body.innerHTML='<div id="u"><label for="u_input"><svg id="u_img" width="14" height="14" viewBox="0 0 14 14"><path class="fill" d="M0 0H14V14H0Z" fill="#ffffff" stroke="none"/><path class="stroke" d="M.5 .5H13.5V13.5H.5Z" fill="none" stroke="#123456" stroke-width="1"/><path id="mark" class="stroke btn_check" d="M3 7L6 10L11 3"/></svg></label><input id="u_input" name="u"/></div>';
 const owner=document.getElementById('u'),control=document.getElementById('u_input'),mark=document.getElementById('mark');
 owner.className=input.classSelected?'selected':'';control.type=input.type==='checkbox'?'checkbox':'radio';control.checked=!!input.checked;
 mark.setAttribute('fill',input.type==='checkbox'?'none':'#123456');mark.setAttribute('stroke',input.type==='checkbox'?'#123456':'none');if(input.type==='checkbox')mark.setAttribute('stroke-width','3');
 window.trace=[];
 const base={size:{width:100,height:24},buttonSize:14,borderWidth:1,linePattern:'solid',fill:{fillType:'solid',color:0xffffffff,opacity:1},borderFill:{fillType:'solid',color:0xff123456,opacity:1}};
 window.objects={u:{id:'u',type:input.type,friendlyType:input.type==='checkbox'?'Checkbox':'Radio Button',buttonSize:14,style:{...base,stateStyles:input.states??{}},adaptiveStyles:input.adaptive??{},owner:{type:'page'},selected:!!input.authoredSelected,disabled:!!input.authoredDisabled,error:false}};
 window.$=window.jQuery;window.$obj=id=>objects[id];window.$jobj=id=>$('#'+id);
 const query=selector=>{const id=selector.replace(/^#/,'');const q={getElementIds:()=>[id],jQuery:()=>$('#'+id)};for(const name of ['selected','enabled','error'])q[name]=function(...args){return $ax.public.fn[name].apply(q,args);};return q;};
 window.$ax=query;window.$axure=query;$axure.internal=fn=>fn($ax);
 $ax.public={fn:{}};for(const name of ['IsDynamicPanel','IsLayerOrRdo','IsImageBox','IsTreeNodeObject','IsVector','IsTableCell','IsTextArea','IsTextBox','IsListBox','IsComboBox','IsRepeater'])$ax.public.fn[name]=()=>false;
 $ax.public.fn.IsCheckBox=t=>t==='checkbox';$ax.public.fn.IsRadioButton=t=>t==='radioButton';
 $ax.document={stylesheet:{stylesById:{},defaultStyle:{}}};
 $ax.adaptive={currentViewId:input.view??'',getAdaptiveIdChain:id=>id?[id]:[],getImageForStateAndView:()=>null};
 $ax.visibility={GetCurrentPanelDiagram:()=>null,isScriptIdLimbo:()=>false};
 $ax.repeater={refreshType:{reset:'reset',preEval:'preEval'},getScriptIdFromElementId:id=>id,getItemIdFromElementId:()=>undefined,applySuffixToElementId:(id,suffix)=>id+suffix};
 $ax.event={mouseOverIds:[],mouseDownObjectId:null,raiseSelectedEvents:(id,value)=>trace.push({kind:'selected-event',id,value}),raiseErrorEvents:(id,value)=>trace.push({kind:'error-event',id,value})};
 $ax.getObjectFromElementId=id=>objects[id];$ax.getTypeFromElementId=id=>objects[id].type;$ax.getPathFromScriptId=id=>[id];$ax.getElementIdFromPath=path=>path.at(-1);
 $ax.GetTextPanelId=()=>undefined;$ax.INPUT=id=>id+'_input';$ax.deepCopy=structuredClone;$ax.updateRadioButtonSelected=(name,id)=>trace.push({kind:'radio-selected',name,id});
 window.PLAIN_TEXT_TYPES=[];
};
window.readFixture=()=>{const m=document.getElementById('mark'),c=getComputedStyle(m);return{selected:$ax.style.IsWidgetSelected('u'),disabled:$ax.style.IsWidgetDisabled('u'),error:$ax.style.IsWidgetError('u'),checked:document.getElementById('u_input').checked,nativeDisabled:document.getElementById('u_input').disabled,classes:document.getElementById('u').className,state:sourceInternals.state('u'),mark:{stroke:c.stroke,fill:c.fill,width:c.strokeWidth,widthAttribute:m.getAttribute('stroke-width')}};};
window.initializeBase=()=>{const elementId='u',dObj=objects.u,$element=$jobj(elementId),itemId=undefined,refreshType=undefined,isDynamicPanel=false,skipSelectedIds=new Set();${slice('events',805,838)}};
window.bindOriginalClick=()=>{const elementId='u',dObj=objects.u;${slice('events',1214,1251)}};
window.runStep=step=>{const start=trace.length,before=readFixture();
 if(step.call==='init')initializeBase();else if(step.call==='bind')bindOriginalClick();else if(step.call==='click')document.getElementById('u_input').click();
 else if(step.call==='public-selected')$ax('#u').selected(step.value);else if(step.call==='public-enabled')$ax('#u').enabled(step.value);
 else if(step.call==='mutation'){objects.u.style.stateStyles=step.states;}
 else if(step.call==='reselect')$ax.style.reselectElements();
 else if(step.call==='initialize-style')$ax.style.initialize();
 else $ax.style[step.call]('u',step.value,step.force);
 return {step,before,after:readFixture(),trace:trace.slice(start)};
};
`;
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:600,height:300}});page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent('<!doctype html><html><head></head><body></body></html>');await page.addStyleTag({content:text.css});await page.addScriptTag({content:text.jquery});await page.addScriptTag({content:setup});
 const run=async(name,input,steps)=>{
  await page.evaluate(input=>makeFixture(input),input);await page.addScriptTag({content:instrumented});await page.addScriptTag({content:enabled+'\n'+error+'\n'+selected});
  const initial=await page.evaluate(()=>readFixture());const actual=await page.evaluate(steps=>steps.map(runStep),steps);const item={name,input,initial,actual};results.push(item);return item;
 };
 const count=row=>row.trace.filter(x=>x.kind==='svg').length;
 const makeStates=(mode,state)=>mode==='none'?{}:mode==='empty'?{[state]:{}}:mode==='color'?{[state]:{borderFill:{fillType:'solid',color:0xff654321,opacity:.5}}}:{[state]:{borderWidth:3}};
 const calls={selected:'SetWidgetSelected',disabled:'SetWidgetEnabled',mouseOver:'SetWidgetHover',mouseDown:'SetWidgetMouseDown',focused:'SetWidgetFocused',error:'SetWidgetError'};
 for(const type of ['checkbox','radioButton'])for(const state of Object.keys(calls))for(const mode of ['none','empty','color','width']){
  const input={type,states:makeStates(mode,state)},values=state==='disabled'?[false,false,true,true]:[true,true,false,false];
  const item=await run('direct-'+state+'-'+mode,input,values.map(value=>({call:calls[state],value})));
  const expected=mode==='none'||mode==='empty'?0:1;for(const row of item.actual)assert.equal(count(row),expected,item.name);
  if(state==='selected')assert.deepEqual(item.actual.map(row=>row.trace.filter(x=>x.kind==='selected-event').length),[1,0,1,0]);
  if(expected){for(let i=0;i<4;i++){const style=item.actual[i].trace.find(x=>x.kind==='svg').style;const active=i<2;if(mode==='width')assert.equal(style.borderWidth,active?3:1);if(mode==='color')assert.equal(style.borderFill.color,active?0xff654321:0xff123456);}}
 }
 for(const type of ['checkbox','radioButton'])for(const authoredSelected of [false,true])for(const checked of [false,true])for(const classSelected of [false,true])for(const authoredDisabled of [false,true])for(const mode of ['none','width']){
  const states=mode==='none'?{}:{selected:{borderWidth:3},disabled:{borderWidth:0}};
  const input={type,authoredSelected,checked,classSelected,authoredDisabled,states};
  const item=await run('initialization-'+mode,input,[{call:'initialize-style'},{call:'init'},{call:'bind'}]);
  assert.equal(count(item.actual[0]),0);
  const beforeBind=item.actual[2].before;assert.equal(count(item.actual[2]),beforeBind.selected&&!beforeBind.disabled?1:0);
  const expectedBeforeDisable=authoredSelected&&!checked?1:0;const expectedDisable=authoredDisabled&&mode==='width'?1:0;assert.equal(count(item.actual[1]),expectedBeforeDisable+expectedDisable);
 }
 for(const type of ['checkbox','radioButton'])for(const mode of ['none','empty','width']){
  const item=await run('public-selected-'+mode,{type,states:makeStates(mode,'selected')},[{call:'bind'},...[true,true,false,false].map(value=>({call:'public-selected',value})),{call:'click'},{call:'click'}]);
  assert.deepEqual(item.actual.slice(1,5).map(count),[1,0,1,0]);assert.deepEqual(item.actual.slice(5).map(count),[1,1]);
 }
 for(const type of ['checkbox','radioButton'])for(const state of Object.keys(calls)){
  const item=await run('adaptive-empty-'+state,{type,view:'v1',adaptive:{v1:{stateStyles:{[state]:{}}}}},[{call:calls[state],value:state==='disabled'?false:true}]);
  assert.equal(count(item.actual[0]),1);
 }
 for(const type of ['checkbox','radioButton']){
  const states={selected:{borderWidth:3},disabled:{borderWidth:0},mouseOver:{borderWidth:2},mouseDown:{borderWidth:4},focused:{borderWidth:5},error:{borderWidth:6}};
  const item=await run('disabled-blocks-and-hover', {type,states},[{call:'SetWidgetEnabled',value:false},...['SetWidgetSelected','SetWidgetFocused','SetWidgetMouseDown','SetWidgetError','SetWidgetHover'].map(call=>({call,value:true,force:true})),{call:'SetWidgetEnabled',value:true}]);
  assert.deepEqual(item.actual.map(count),[1,0,0,0,0,1,1]);assert.equal(item.actual[5].trace.find(x=>x.kind==='svg').event,'disabled');
  const batch=await run('same-turn-nonzero-to-zero',{type,states:{selected:{borderWidth:3},disabled:{borderWidth:0}}},[{call:'SetWidgetSelected',value:true,force:true},{call:'SetWidgetEnabled',value:false}]);
  assert.deepEqual(batch.actual.flatMap(x=>x.trace.filter(t=>t.kind==='svg').map(t=>t.style.borderWidth)),[3,0]);
  assert.equal(batch.actual[1].after.mark.widthAttribute,'3');
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync('research/selection-state-dispatch-probes.json',JSON.stringify({method:'Complete retained style.js module executes; source instrumentation only wraps original private functions to record calls, then forwards unchanged. Exact public selected/enabled/error functions and initialization/click blocks execute with declared page/type/document facades.',sources:[...Object.values(paths),import.meta.filename].map(path=>({path,sha256:sha(path)})),ranges,summary:{sequences:results.length,steps:results.reduce((n,r)=>n+r.actual.length,0),svgCalls:results.reduce((n,r)=>n+r.actual.reduce((m,s)=>m+count(s),0),0),passed:results.length,failed:0},errors,results},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({sequences:results.length,steps:results.reduce((n,r)=>n+r.actual.length,0)}));
}catch(error){let n=1;while(fs.existsSync('research/selection-state-dispatch-failure-'+n+'.json'))n++;fs.copyFileSync(import.meta.filename,'research/selection-state-dispatch-attempt-'+n+'.mjs');fs.writeFileSync('research/selection-state-dispatch-failure-'+n+'.json',JSON.stringify({message:error.stack,scriptSha256:sha(import.meta.filename),results,errors},null,2)+'\n',{flag:'wx'});throw error;}finally{await browser.close();}
