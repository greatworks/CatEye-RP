import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const foundation='research/selection-state-dispatch-probe-extended.mjs';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const foundationCode=fs.readFileSync(foundation,'utf8').split("const browser=await chromium.launch")[0].replace("import {chromium} from '@playwright/test';",'')+ '\nexport {setup,instrumented,paths,text,enabled,error,selected};';
const base=await import('data:text/javascript;base64,'+Buffer.from(foundationCode).toString('base64'));
const actionPath=base.paths.style.replace('/style.js','/action.js'),action=fs.readFileSync(actionPath,'utf8');
const slice=(source,a,b)=>source.split(/\r?\n/).slice(a-1,b).join('\n');
const events=base.text.events;
const callbackBoot=`
window.installHandlers=(mode)=>{
 var _enteredWidgets={},_widgetToFocusParent={},eventNestingTime=0,eventNesting=0,suppressedEventStatus={},suppressingEvents={},allowBubble=[],preventDefaultEvents=[];
 var _isSuppressedEvent=()=>false,_removeSuppressedEvent=()=>{},_getCanClick=()=>true,_shouldShowCaseDescriptions=()=>false;
 var postMessage=(kind,payload)=>{if(kind==='axEvent')trace.push({kind:'event-enter',event:payload.event.eventType,visible:readFixture()});};
 $ax.recording={maybeRecordEvent:()=>{}};$ax.getjBrowserEvent=()=>null;$ax.getEventInfoFromEvent=()=>({});$ax.eventCopy=structuredClone;
 $ax.action={repeatersToRefresh:[],flushAllResizeMoveActions:()=>{},tryRefreshRepeaters:()=>{}};var _action=$ax.action,_actionHandlers={};
 ${slice(action,351,368)}
 _actionHandlers.marker=(info,actions,index)=>{const action=actions[index];trace.push({kind:'handler-action',label:action.label,visible:readFixture()});_dispatchAction(info,actions,index+1);if(action.label==='deferred-done')window.finishCallback();};
 _actionHandlers.setter=(info,actions,index)=>{const action=actions[index];$ax.style[action.method]('u',action.value,action.force);_dispatchAction(info,actions,index+1);};
 ${slice(events,281,415)}
 ${slice(events,544,591)}
 ${slice(events,1688,1717)}
 const marker=label=>({action:'marker',label,displayName:label,actionInfoDescriptions:{}});
 const setter=(method,value,force)=>({action:'setter',method,value,force,displayName:method,actionInfoDescriptions:{}});
 const wait={action:'wait',waitTime:1,displayName:'wait',actionInfoDescriptions:{}};
 const event=(eventType,actions)=>({eventType,cases:[{description:'controlled',actions}]});
 const deferred=mode.endsWith('-deferred');window.callbackFinished=new Promise(resolve=>window.finishCallback=resolve);
 let map={};
 if(mode==='selected-log')map={onSelectedChange:event('OnSelectedChange',[marker('change')]),onSelect:event('OnSelect',[marker('select')])};
 if(mode.startsWith('selected-nested'))map={onSelectedChange:event('OnSelectedChange',[...(deferred?[wait]:[]),marker('change-before'),setter('SetWidgetEnabled',false),marker(deferred?'deferred-done':'change-after')]),onSelect:event('OnSelect',[marker('select')])};
 if(mode.startsWith('error-nested'))map={onErrorSet:event('OnErrorSet',[...(deferred?[wait]:[]),marker('error-before'),setter(deferred?'SetWidgetEnabled':'SetWidgetSelected',deferred?false:true,true),marker(deferred?'deferred-done':'error-after')])};
 if(mode==='error-without-state-nested')map={onErrorSet:event('OnErrorSet',[marker('error-before'),setter('SetWidgetSelected',true,true),marker('error-after')])};
 objects.u.interactionMap=map;
};
`;
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent('<!doctype html><html><head></head><body></body></html>');await page.addStyleTag({content:base.text.css});await page.addScriptTag({content:base.text.jquery});await page.addScriptTag({content:base.setup});await page.addScriptTag({content:callbackBoot});
 for(const type of ['checkbox','radioButton'])for(const mode of ['selected-log','selected-nested-inline','selected-nested-deferred','error-nested-inline','error-nested-deferred','error-without-state-nested']){
  const states={selected:{borderWidth:3},disabled:{borderWidth:0},...(mode==='error-without-state-nested'?{}:{error:{borderWidth:6}})};
  await page.evaluate(input=>makeFixture(input),{type,states});await page.addScriptTag({content:base.instrumented});
  const actual=await page.evaluate(async mode=>{installHandlers(mode);const initial=readFixture();if(mode.startsWith('selected'))$ax.style.SetWidgetSelected('u',true,true);else $ax.style.SetWidgetError('u',true);const afterReturn={visible:readFixture(),trace:structuredClone(trace)};if(mode.endsWith('-deferred'))await callbackFinished;if(mode==='selected-log')$ax.style.SetWidgetSelected('u',true,true);return{initial,afterReturn,final:readFixture(),trace};},mode);
  const item={type,mode,states,actual};results.push(item);
  const relevant=actual.trace.filter(t=>['svg','handler-action'].includes(t.kind));const widths=actual.trace.filter(t=>t.kind==='svg').map(t=>t.style.borderWidth);const labels=actual.trace.filter(t=>t.kind==='handler-action').map(t=>t.label);
  if(mode==='selected-log'){assert.deepEqual(widths,[3,3]);assert.deepEqual(labels,['change','select']);assert.equal(relevant[0].kind,'svg');assert.equal(relevant[1].visible.selected,true);}
  if(mode==='selected-nested-inline'){assert.deepEqual(widths,[3,0]);assert.deepEqual(labels,['change-before','change-after','select']);assert.equal(relevant[0].kind,'svg');assert.equal(actual.final.disabled,true);}
  if(mode==='selected-nested-deferred'){assert.deepEqual(widths,[3,0]);assert.deepEqual(labels,['select','change-before','deferred-done']);assert.equal(actual.afterReturn.visible.disabled,false);assert.equal(actual.final.disabled,true);}
  if(mode==='error-nested-inline'){assert.deepEqual(widths,[6,6]);assert.deepEqual(labels,['error-before','error-after']);assert.equal(relevant[0].kind,'handler-action');assert.equal(relevant[0].visible.error,true);assert.equal(relevant.at(-1).kind,'svg');}
  if(mode==='error-nested-deferred'){assert.deepEqual(widths,[6,0]);assert.deepEqual(labels,['error-before','deferred-done']);assert.equal(relevant[0].kind,'svg');assert.equal(actual.afterReturn.visible.disabled,false);}
  if(mode==='error-without-state-nested'){assert.deepEqual(widths,[3,3]);assert.deepEqual(labels,['error-before','error-after']);assert.equal(relevant[0].kind,'handler-action');}
 }
 assert.deepEqual(errors,[]);
 const sources=[...Object.values(base.paths),actionPath,foundation,import.meta.filename].map(path=>({path,sha256:sha(path)}));
 fs.writeFileSync('research/selection-state-dispatch-callback-probes.json',JSON.stringify({method:'Complete original style module plus retained original raiseSelectedEvents/raiseErrorEvents/raiseSyntheticEvent/handleEvent/handleCaseGroup/dispatchAction/wait; controlled marker and setter action handlers, case-description/suppression/environment facades.',sources,ranges:[{source:'events.js',start:281,end:415},{source:'events.js',start:544,end:591},{source:'events.js',start:1688,end:1717},{source:'action.js',start:351,end:368}],summary:{sequences:results.length,passed:results.length,failed:0},errors,results},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({passed:results.length}));
}catch(error){fs.writeFileSync('research/selection-state-dispatch-callback-failure.json',JSON.stringify({message:error.stack,results,errors,sha256:sha(import.meta.filename)},null,2)+'\n',{flag:'wx'});throw error;}finally{await browser.close();}
