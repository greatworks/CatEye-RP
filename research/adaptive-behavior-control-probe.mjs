import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const pins={
  'adaptive.js':'e141ea07bb973b6007f2ad7d7205516a041a801ec97e410467352c27af3b2928',
  'action.js':'c3c051ceb20b76128619df0f3a691f2cf59539c48eb28c7bec311907010c44c3',
  'events.js':'a4af00772806e3951b0cfaa849361c7481613cc4b361038ccbbd52221c850bb3',
};
const sources=Object.fromEntries(Object.entries(pins).map(([name,pin])=>{const text=fs.readFileSync(path.join(root,name),'utf8');assert.equal(hash(text),pin);return [name,text]}));
const ranges=[];
function slice(file,first,last,label){const text=sources[file].split(/\r?\n/).slice(first-1,last).join('\n');ranges.push({file,first,last,label,sha256:hash(text)});return text}
const code=[
  slice('adaptive.js',6,42,'automatic mode and loadFinished'),
  slice('adaptive.js',48,159,'actual switch control; DOM/style operations are sinks'),
  slice('adaptive.js',376,426,'actual size selection'),
  slice('adaptive.js',707,752,'public selection and initialization'),
  slice('action.js',351,377,'actual recursive dispatcher, Wait and expression continuation'),
  slice('action.js',393,398,'actual Set Adaptive View handler'),
  slice('events.js',544,595,'actual one-case-group condition and action dispatch'),
  slice('events.js',1840,1861,'actual adaptive page/master event and player post'),
  slice('events.js',1901,2018,'actual page/master/container event traversal'),
].join('\n');
const view=(id,width)=>({id,size:{width,height:0}});
const expression=label=>({action:'expr',expr:label,actionInfoDescriptions:{}});
const change=value=>({action:'setAdaptiveView',setAdaptiveViewTo:value,actionInfoDescriptions:{}});
const wait={action:'wait',waitTime:0,actionInfoDescriptions:{}};
function realm({initialize=true,loaded=true}={}){
  const trace=[],timers=[],viewport={width:800,height:600};let resize;
  const query={each(){},jQuery(){return $()}},$=()=>({width:()=>viewport.width,height:()=>viewport.height,removeClass(){},children:()=>({length:0}),length:0});
  const ax=()=>query,axure=()=>query;
  const sink=name=>(...args)=>trace.push([name,...args]);
  const empty=()=>{};
  Object.assign(ax,{
    adaptive:{triggerEvent:sink('bindable')},pageData:{defaultAdaptiveView:view('',0),adaptiveViews:[view('phone',390),view('tablet',768)],page:{name:'Probe',diagram:{objects:[]},interactionMap:{}},masters:{}},
    document:{configuration:{useViews:true}},style:{clearAdaptiveStyles:empty,reselectElements:empty,updateElementIdImageStyle:empty,clearAppliedStyles:empty},
    visibility:{resetLimboAndHiddenToDefaults:empty,clearMovedAndResized:empty,clearLimboAndHidden:empty},
    repeater:{refreshAllRepeaters:sink('refresh'),getScriptIdFromElementId:x=>x},expr:{updateAutoFitted:sink('autofit'),evaluateExpr:label=>{trace.push(['expression',label]);return true}},
    annotation:{updateAllFootnotes:empty},dynamicPanelManager:{updateParentsOfNonDefaultFitPanels:empty,updatePercentPanelCache:empty,updateAllLayerSizeCaches:empty},
    public:{fn:{IsTreeNodeObject:()=>false,IsReferenceDiagramObject:()=>false,IsDynamicPanel:()=>false,IsRepeater:()=>false,IsLayer:()=>false}},
    constants:{PAGE_TYPE:'page',REFERENCE_DIAGRAM_OBJECT_TYPE:'master',DYNAMIC_PANEL_TYPE:'panel',REPEATER:'repeater',ALL_TYPE:'all'},
    getjBrowserEvent:()=>undefined,getEventInfoFromEvent:()=>({}),eventCopy:value=>({...value}),
    action:{flushAllResizeMoveActions:sink('flush'),tryRefreshRepeaters:empty},messageCenter:{postMessage:sink('player')},
  });
  axure.resize=callback=>{resize=callback};axure.messageCenter=ax.messageCenter;
  const context=vm.createContext({$ax:ax,$axure:axure,$,_action:ax.action,_actionHandlers:{},_applyView:sink('apply'),eventNesting:0,CHROME_5_LOCAL:false,SAFARI:false,IOS:false,SHARE_APP:false,postMessage:empty,
    window:{name:'mainFrame',setTimeout:callback=>{timers.push(callback);return timers.length}},document:{getElementById:()=>undefined}});
  vm.runInContext(code,context,{timeout:1000});
  // Event policy/menus are intentionally outside this narrow probe. The real
  // page traversal calls this terminal adapter, which invokes the real case
  // group and original action dispatcher for the fixture's one enabled case.
  context._handleEvent=(_id,info,event)=>context._handleCaseGroup(info,event.cases,[]);
  const actions=items=>context._handleCaseGroup({},[{actions:items}],[]);
  const drain=()=>{for(let n=0;timers.length;n++){if(n>20)throw Error('Probe timer limit');timers.shift()()}};
  if(initialize)ax.adaptive.initialize();if(loaded)ax.adaptive.loadFinished();trace.length=0;
  return {ax,context,trace,timers,viewport,actions,drain,resize:()=>resize({}),auto:()=>vm.runInContext('_auto',context)};
}
const results=[];
function test(name,body){const observed=body();results.push({name,status:'pass',observed})}
const expressions=r=>r.trace.filter(item=>item[0]==='expression').map(item=>item[1]);

test('control expression actions dispatch their successor',()=>{const r=realm();r.actions([expression('before'),expression('after')]);assert.deepEqual(expressions(r),['before','after']);return r.trace});
for(const [name,value] of [['different','phone'],['same','tablet'],['Base','default'],['Auto','auto'],['unknown','missing'],['empty',''],['missing',undefined]])test(`Set Adaptive View ${name} does not dispatch its successor`,()=>{
  const r=realm();r.actions([expression('before'),change(value),expression('after')]);r.drain();assert.deepEqual(expressions(r),['before']);return {trace:r.trace,current:r.ax.adaptive.currentViewId,auto:r.auto(),timers:r.timers.length};
});
test('direct public API returns to its caller; terminal action behavior belongs to its handler',()=>{const r=realm();r.ax.adaptive.setAdaptiveView('phone');r.actions([expression('caller continues')]);assert.deepEqual(expressions(r),['caller continues']);return r.trace});
test('queued preinitialize selection does not later resume the old action list',()=>{const r=realm({initialize:false,loaded:false});r.actions([change('phone'),expression('after')]);assert.equal(r.ax.adaptive.currentViewId,undefined);r.ax.adaptive.initialize();r.ax.adaptive.loadFinished();r.drain();assert.equal(r.ax.adaptive.currentViewId,'phone');assert.deepEqual(expressions(r),[]);return r.trace});
test('actual page event traversal runs its own actions but never the suspended outer successor',()=>{
  const r=realm();r.ax.pageData.page.interactionMap.onAdaptiveViewChange={cases:[{actions:[expression('page event first'),expression('page event second')]}]};
  r.actions([expression('outer before'),change('phone'),expression('outer after')]);r.drain();assert.deepEqual(expressions(r),['outer before','page event first','page event second']);return r.trace;
});
test('page event Wait resumes only the page event action array',()=>{
  const r=realm();r.ax.pageData.page.interactionMap.onAdaptiveViewChange={cases:[{actions:[expression('event prefix'),wait,expression('event continuation')]}]};
  r.actions([change('phone'),expression('outer after')]);assert.deepEqual(expressions(r),['event prefix']);assert.equal(r.timers.length,1);r.drain();assert.deepEqual(expressions(r),['event prefix','event continuation']);return r.trace;
});
test('Wait before a switch resumes to the switch then stops',()=>{const r=realm();r.actions([wait,change('phone'),expression('after')]);assert.equal(r.ax.adaptive.currentViewId,'tablet');assert.equal(r.timers.length,1);r.drain();assert.equal(r.ax.adaptive.currentViewId,'phone');assert.deepEqual(expressions(r),[]);return r.trace});
test('Wait after a switch is not scheduled',()=>{const r=realm();r.actions([change('phone'),wait,expression('after')]);assert.equal(r.timers.length,0);assert.deepEqual(expressions(r),[]);return r.trace});
test('Loaded switch defers the page adaptive event to one-shot loadFinished',()=>{
  const r=realm({loaded:false});r.ax.pageData.page.interactionMap.onAdaptiveViewChange={cases:[{actions:[expression('adaptive event')]}]};
  r.actions([expression('load prefix'),change('phone'),expression('load suffix')]);assert.deepEqual(expressions(r),['load prefix']);
  r.ax.adaptive.loadFinished();r.ax.adaptive.loadFinished();assert.deepEqual(expressions(r),['load prefix','adaptive event']);return r.trace;
});
test('Loaded switch back to Base suppresses initial adaptive interaction event',()=>{
  const r=realm({loaded:false});r.ax.pageData.page.interactionMap.onAdaptiveViewChange={cases:[{actions:[expression('adaptive event')]}]};r.actions([change('default')]);r.ax.adaptive.loadFinished();assert.deepEqual(expressions(r),[]);return r.trace;
});

const output={schema:'adaptive-behavior-original-control-v1',capturedAt:new Date().toISOString(),artifact:{version:'11.0.0.4150',distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7'},sources:Object.keys(pins).map(file=>({path:path.join(root,file),sha256:pins[file]})),ranges,passed:results.length,results,boundaries:{executed:'Exact retained action dispatcher, SetAdaptiveView/Wait/expr handlers, adaptive control/switch, page event traversal and case-group dispatch in Node VM.',sinks:['DOM/style/repeater refresh and AutoFit are traced terminal sinks','expression evaluator records fixture markers','event policy/menus replaced by a one-case-group adapter','timers are queued and explicitly drained; no wall-clock ordering claim'],notExecuted:['native DLL or GUI','complete generated page','full _handleEvent case menus and bubbling','player navigation or URL persistence'],productChanged:false,network:false}};
fs.writeFileSync('research/adaptive-behavior-control-probe.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({passed:results.length,path:'research/adaptive-behavior-control-probe.json'}));
