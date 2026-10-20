import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Executes retained JavaScript slices. Vendor application/DLL code is not launched.
const root = path.resolve(import.meta.dirname, '../..');
const prior = JSON.parse(fs.readFileSync(path.join(root, 'research/rotation-runtime-evidence.json')));
const dir = path.dirname(prior.sources.find(x => x.path.endsWith('/action.js')).path);
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
const sourceNames = ['action.js', 'move.js', 'math.js', 'axQuery.std.js', 'events.js', 'visibility.js', 'adaptive.js', 'repeater.js', 'doc.js', '../jquery-3.7.1.min.js'];
const sources = sourceNames.map(name => {
  const file = path.resolve(dir, name), bytes = fs.readFileSync(file), sha256 = hash(bytes);
  const pinned = prior.sources.find(x => path.resolve(x.path) === file);
  if (pinned) assert.equal(sha256, pinned.sha256, file);
  if(name === '../jquery-3.7.1.min.js') assert.equal(sha256, '8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85');
  return { path: file.replaceAll('\\', '/'), sha256, bytes: bytes.length };
});
const ranges = [];
function slice(file, start, end) {
  const text = fs.readFileSync(path.resolve(dir, file), 'utf8').split(/\r?\n/).slice(start - 1, end).join('\n');
  if (!ranges.some(x => x.file === file && x.start === start && x.end === end)) ranges.push({ file, start, end, sha256: hash(text) });
  return text;
}
const results = [];
function record(name, observed, check = () => {}) {
  try { check(observed); results.push({ name, kind: 'exact-source-node-vm-with-explicit-sinks', passed: true, observed }); }
  catch (error) { results.push({ name, kind: 'exact-source-node-vm-with-explicit-sinks', passed: false, observed, error: error.message }); }
}
function batchHarness() {
  const c = vm.createContext({ JSON, Math, logs: [], $jobj: id => ({ id }) });
  vm.runInContext(`var $ax={splice:(a,i,n)=>a.splice(i,n),public:{fn:{convertToSingleImage:j=>logs.push({kind:'singleImage',id:j.id})}}};
  ${slice('action.js', 2, 349)}
  var _addMove=(id,event,info,options)=>logs.push({kind:'move',id,info,options});
  var _addResize=(id,event,info,options,move,rotate)=>logs.push({kind:'resize',id,info,options,move,rotate});
  var _addRotate=(id,event,info,options,move)=>logs.push({kind:'rotate',id,info,options,move});
  ${slice('action.js', 1192, 1197)}
  ${slice('action.js', 1225, 1237)}
  globalThis.H={q:_queueResizeMove,flush:_action.flushAllResizeMoveActions,types:queueTypes,add:_addAnimation,group:_addAnimations,fire:_fireAnimationFromQueue,stop:_applyRotateStop,offset:_updateOffset};`, c);
  return c;
}
for (const to of [false, true]) for (const stop of [{ instant: true }, { start: 0, end: 40, len: 100 }, { start: 40, end: 100, len: 100 }]) {
  const c = batchHarness(), actual = c.H.stop(180, 30, to, stop);
  record(`stop-${to ? 'to' : 'by'}-${stop.start ?? 'instant'}`, { degree: 180, current: 30, stop, actual }, x => assert.equal(x.actual, to ? 150 * (stop.instant ? 1 : (stop.end - stop.start) / (100 - stop.start)) : 180 * (stop.instant ? 1 : (stop.end - stop.start) / 100)));
}
for (const anchor of ['center', 'top', 'bottom', 'left', 'right', 'top left', 'bottom right', 'topleft', 'invalid']) {
  const c = batchHarness(), offset = { x: 10, y: -5 }; c.H.offset(offset, anchor, { width: 200, height: 100 });
  record(`anchor-${anchor}`, offset, x => assert.deepEqual(x, { x: 10 + (anchor.includes('left') ? -100 : 0) + (anchor.includes('right') ? 100 : 0), y: -5 + (anchor.includes('top') ? -50 : 0) + (anchor.includes('bottom') ? 50 : 0) }));
}
const info = (kind, duration, easing = 'linear') => kind === 'resize' ? { name: kind, duration, easing } : { name: kind, degree: 180, options: { duration, easing } };
for (const spec of [
  [['rotate', 100]], [['rotate', 100], ['rotate', 60]],
  [['rotate', 100], ['move', 40]], [['move', 40], ['rotate', 100]],
  [['resize', 70], ['rotate', 100]], [['move', 40], ['resize', 70], ['rotate', 100]],
  [['rotate', 100], ['rotate', 0]], [['rotate', 0], ['rotate', 100]],
  [['rotate', 100, 'swing'], ['move', 40, 'linear']],
]) {
  const c = batchHarness(), event = {};
  for (const [kind, duration, easing] of spec) c.H.q('a', c.H.types[kind], event, info(kind, duration, easing));
  const before = JSON.parse(JSON.stringify(c.logs)); c.H.flush(event);
  record(`batch-${spec.map(x => x.join(':')).join('/')}`, { before, after: JSON.parse(JSON.stringify(c.logs)) }, x => {
    assert.ok(x.after.some(x => x.kind === 'rotate' || x.kind === 'resize'));
    assert.equal(Object.values(event.idToResizeMoveState.a).reduce((n, x) => n + x.queue.length, 0), 0);
  });
}
{
  const c = batchHarness(), log = [];
  c.H.add('a', 5, () => log.push('a1'));
  c.H.add('b', 5, () => log.push('b1'));
  c.H.group([{ id: 'a', type: 5, func: () => log.push('a2') }, { id: 'b', type: 5, func: () => log.push('b2') }]);
  c.H.fire('a', 5); const pending = [...log]; c.H.fire('b', 5);
  record('queue-group-barrier', { pending, done: log }, x => { assert.deepEqual(x.pending, ['a1', 'b1']); assert.deepEqual(x.done, ['a1', 'b1', 'a2', 'b2']); });
}
for(const cfg of [
  {name:'style-angle',angle:30}, {name:'target-cache',angle:30,cache:90}, {name:'zero-cache-falls-back',angle:30,cache:0},
  {name:'positive-shadow',angle:0,shadow:{on:true,offsetX:10,offsetY:20,blurRadius:6}},
  {name:'negative-shadow',angle:0,shadow:{on:true,offsetX:-10,offsetY:-20,blurRadius:6}},
]) {
  const c=vm.createContext({Math,Number,cfg});
  vm.runInContext(`var $ax={public:{fn:{}},visibility:{getMovedLocation:()=>undefined,getResizedSize:()=>undefined,getRotatedAngle:()=>cfg.cache},style:{generateState:()=>'',computeFullStyle:()=>({location:{x:100,y:100},size:{width:200,height:100},rotation:cfg.angle,outerShadow:cfg.shadow||{on:false}})},adaptive:{}};var $axure={fn:$ax.public.fn};var $obj=()=>({});var document={getElementById:()=>({getAttribute:()=>null})};var _fixedLocation=()=>({valid:false});
  ${slice('math.js',2,87)}
  ${slice('math.js',103,149)}
  ${slice('math.js',217,223)}
  ${slice('axQuery.std.js',1299,1323)}
  ${slice('axQuery.std.js',1438,1575)}
  globalThis.result=$ax.public.fn.offsetBoundingRect.call({getElementIds:()=>['a'],getParents:()=>[[]]});`,c);
  record('native-bounds-'+cfg.name,{cfg,rect:JSON.parse(JSON.stringify(c.result))},x=>{
    if(cfg.name==='target-cache'){assert.ok(Math.abs(x.rect.width-100)<1e-9);assert.ok(Math.abs(x.rect.height-200)<1e-9);}
    if(cfg.name==='positive-shadow')assert.deepEqual(x.rect.centerPoint,{x:208,y:163});
    if(cfg.name==='negative-shadow')assert.deepEqual(x.rect.centerPoint,{x:192,y:137});
    if(cfg.name==='zero-cache-falls-back')assert.ok(Math.abs(x.rect.width-(200*Math.cos(Math.PI/6)+50))<1e-9);
  });
}
for(const mode of ['delta','location'])for(const initial of [0,30]){
  const c=vm.createContext({parseFloat,initial});
  vm.runInContext(`var value=initial,events=[];var $jobj=()=>({data:(key,v)=>v===undefined?value:value=v});var $ax={event:{raiseSyntheticEvent:(id,e)=>events.push({id,event:e,value})}};
  ${slice('action.js',1240,1256)}
  globalThis.run=(degree,mode,stop)=>_initRotateLayer('group',{rotateType:mode},degree,{},stop);globalThis.get=()=>({value,events});`,c);
  const first=c.run(180,mode,{start:0,end:40,len:100}),second=c.run(180,mode,{start:40,end:100,len:100});
  record(`layer-split-${mode}-${initial}`,{first,second,...JSON.parse(JSON.stringify(c.get()))},x=>{
    assert.equal(x.first,(mode==='location'?180-initial:180)*.4);
    assert.equal(x.second,mode==='location'?0:180);
    assert.equal(x.value,mode==='location'?180:initial+360);
  });
}
for(const branch of ['layer','rdo','panel','repeater','body']){
  const c=vm.createContext({branch});
  vm.runInContext(`var calls=[];function $ax(){return {childrenBoundingRect:()=>({right:220,bottom:170})}};$ax.public={fn:{IsLayer:t=>t==='layer'}};$ax.getParentRepeaterFromElementId=()=>branch==='repeater'?'r':undefined;$ax.repeater={getItemIdFromElementId:()=>7,createElementId:(id,item)=>id+'-'+item,setItemSize:(...a)=>calls.push(['itemSize',...a])};$ax.adaptive={updateMobileScrollOnBody:()=>calls.push(['bodyScroll'])};var $obj=id=>id==='r'?{repeaterPropMap:{fitToContent:true}}:id?{type:branch}:undefined;var getParentLayerOrRdo=()=>branch==='layer'||branch==='rdo'?'parent':undefined;var getParentPanel=()=>branch==='panel'?{parent:'p',stateId:'s',state:{name:'s'}}:undefined;var _updateLayerRectCache=id=>(calls.push(['layer',id]),false),_updateRdoRect=id=>(calls.push(['rdo',id]),false),_updateMobileScroll=(...a)=>calls.push(['mobileScroll',...a]),_updateFitPanel=(...a)=>(calls.push(['fitPanel',...a]),false);var _dynamicPanelManager={};
  ${slice('repeater.js',1590,1626)}
  _fitParentPanel('child');`,c);
  record('parent-fit-route-'+branch,JSON.parse(JSON.stringify(c.calls)),x=>assert.ok(x.length>0));
}

const bootstrap = `
var trace=[], models={}, cache={}, vars={}, hooks={}, start=performance.now();
function snap(id){var e=document.getElementById(id);return e?{angle:$ax.move.getRotationDegree(id),inline:e.style.transform,left:parseFloat(e.style.left),top:parseFloat(e.style.top),cache:cache[id]}:null;}
function log(kind,id,value){trace.push({kind,id,value,at:performance.now()-start,snapshot:id?snap(id):undefined});}
function $jobj(id){return jQuery(document.getElementById(id));}
function $obj(id){return models[id];}
function $addAll(j,id){return j;}
function $ax(selector){var ids=Array.isArray(selector)?selector:[selector.slice(1)], q=Object.create($ax.public.fn);q.getElementIds=()=>ids;q.size=()=>({width:parseFloat($jobj(ids[0]).css('width')),height:parseFloat($jobj(ids[0]).css('height'))});q.offsetBoundingRect=()=>{
 var id=ids[0],e=document.getElementById(id),m=models[id];
 if(m.bounds)return JSON.parse(JSON.stringify(m.bounds));
 var x=parseFloat(e.style.left),y=parseFloat(e.style.top),width=parseFloat(e.style.width),height=parseFloat(e.style.height);
 return {x,y,width,height,centerPoint:{x:x+width/2,y:y+height/2}};
};q.getParents=()=>[[]];q.getChildren=()=>[{children:models[ids[0]].children||[]}];return q;}
$ax.public={fn:{IsLayer:t=>t==='layer',IsDynamicPanel:t=>t==='panel',IsTextArea:t=>t==='textarea',compoundIdFromComponent:id=>id.split('_component')[0],convertToSingleImage:j=>log('singleImage',j[0]?.id)}};
$ax.constants={IMAGE_BOX_TYPE:'image',IMAGE_MAP_REGION_TYPE:'hotspot',DYNAMIC_PANEL_TYPE:'panel',VECTOR_SHAPE_TYPE:'vector',VERTICAL_LINE_TYPE:'vline',HORIZONTAL_LINE_TYPE:'hline'};
$ax.getTypeFromElementId=id=>models[id].type;$ax.getNumFromPx=parseFloat;
$ax.getElementIdsFromPath=p=>[p];$ax.deepCopy=o=>JSON.parse(JSON.stringify(o));$ax.eventCopy=o=>({...o});$ax.splice=(a,i,n)=>a.splice(i,n);
$ax.expr={evaluateExpr:(expr,event)=>{log('eval',event.targetElement,expr);return typeof expr==='string'&&expr[0]==='$'?vars[expr.slice(1)]:expr;}};
$ax.event={raiseSyntheticEvent:(id,event)=>{log('event',id,event);if(hooks[event])hooks[event](id);}};
$ax.visibility={setRotatedAngle:(id,v)=>{cache[id]=v;log('cache',id,v)},moveMovedLocation:(id,x,y)=>log('moved',id,{x,y}),IsIdVisible:id=>document.getElementById(id).style.display!=='none',pushContainer:()=>{},popContainer:()=>{}};
$ax.dynamicPanelManager={fitParentPanel:id=>log('fit',id),getFixedInfo:()=>({}),isPercentWidthPanel:()=>false};
$ax.annotation={adjustIconLocation:id=>log('annotation',id)};
var $axure={fn:$ax.public.fn};
${slice('math.js', 2, 109)}
${slice('math.js', 217, 240)}
${slice('action.js', 2, 349)}
var _dispatchAction=(event,actions,index)=>log('dispatch-next',null,index);
var _addMove=(...args)=>log('unexpected-addMove',null,args);
var _addResize=(...args)=>log('unexpected-addResize',null,args);
var _getMoveLoc=(id,info)=>({...info.delta});
var _moveSingleWidget=(id,delta)=>{$jobj(id).css({left:'+='+delta.x,top:'+='+delta.y});_fireAnimationFromQueue(id,queueTypes.move);};
${slice('action.js', 1061, 1256)}
${slice('action.js', 1286, 1506)}
var _getSizeFromInfo=info=>({width:info.width,height:info.height});
var _getCssForResizingWidget=()=>{throw Error('resize shape paint outside harness');};
${slice('move.js', 2, 82)}
${slice('move.js', 230, 491)}
${slice('axQuery.std.js', 541, 568)}
var fireOriginal=$ax.action.fireAnimationFromQueue;
$ax.action.fireAnimationFromQueue=function(id,type){log('fire',id,type);return fireOriginal(id,type)};
function reset(items){trace=[];models={};cache={};vars={};hooks={};animationQueue={};animationsToCount={};actionToActionGroups={};document.body.replaceChildren();start=performance.now();for(var item of items){var e=document.createElement('div');e.id=item.id;Object.assign(e.style,{position:'absolute',left:(item.x??100)+'px',top:(item.y??100)+'px',width:(item.w??200)+'px',height:(item.h??100)+'px',transform:'rotate('+(item.angle??0)+'deg)',transformOrigin:'50% 50%'});if(item.hidden)e.style.display='none';document.body.append(e);models[item.id]={type:item.type||'vector',children:item.children,bounds:item.bounds};}}
function action(id,degree,overrides={},event={}){var rotateInfo={degree,offsetX:0,offsetY:0,anchor:'center',rotateType:'delta',...overrides,options:{clockwise:true,easing:'none',duration:0,...overrides.options}};_actionHandlers.rotateWidget(event,[{objectsToRotate:[{objectPath:id,rotateInfo}]}],0);return event;}
function flush(e){$ax.action.flushAllResizeMoveActions(e);}
function wait(ms){return new Promise(r=>setTimeout(r,ms));}
globalThis.H={reset,action,flush,snap,wait,ax:$ax,vars:()=>vars,trace:()=>trace,hooks:()=>hooks,stop:_applyRotateStop,add:_addAnimation,addRotate:_addRotate,addResize:_addResize};
`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext(), requests = [], errors = [];
await context.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ content: fs.readFileSync(path.resolve(dir, '../jquery-3.7.1.min.js'), 'utf8') });
await page.addScriptTag({ content: bootstrap });
const browserResults = await page.evaluate(async () => {
  const out = [], close = (a,b,tol=0.001) => Math.abs(a-b)<tol;
  async function test(name, run, check) {try{const observed=await run();out.push({name,kind:'actual-edge-retained-jquery-and-function-slices-with-explicit-host-sinks',passed:!!check(observed),observed});}catch(e){out.push({name,passed:false,error:e.stack});}}
  await test('shipped-easing-catalog',()=>({version:$.fn.jquery,ui:$.ui?.version,keys:Object.keys($.easing),samples:Object.fromEntries(Object.entries($.easing).filter(([,v])=>typeof v==='function').map(([k,v])=>[k,[0,.25,.5,.75,1].map(x=>v(x))]))}),x=>x.version==='3.7.1');
  for(const easing of Object.keys($.easing).filter(k=>typeof $.easing[k]==='function')) await test('retained-tween-'+easing,()=>{
    const target={degree:0},steps=[];const tween=$.Tween(target,{duration:100,step:function(now){steps.push({now,previousProperty:target.degree})}},'degree',180,easing);
    const values=[];for(const progress of [0,.1,.25,.5,.75,.9,1]){tween.run(progress);values.push({progress,degree:target.degree});}
    return {steps,values};
  },x=>x.values.every((v,i)=>close(v.degree,180*$.easing[easing](v.progress),1e-8)&&close(x.steps[i].previousProperty,i?x.values[i-1].degree:0,1e-8)));
  for(const [from,degree,to]of [[0,90,false],[30,180,true],[0,-90,false],[720,15,false],[720.5,15,false],[-90.5,10,false],[0,360.5,false],[0,0,false],[30,30,true]])await test('angle-'+[from,degree,to].join('/'),()=>{H.reset([{id:'a',angle:from}]);H.action('a',degree,{rotateType:to?'location':'delta'});return {initial:from,degree,to,final:H.snap('a'),trace:H.trace()};},x=>x.trace.some(e=>e.kind==='event'&&e.value==='onRotate'));
  for(const type of ['vector','image','hotspot','panel','hline','vline','input','textarea','select','tree','table','inlineFrame'])for(const pivot of ['center','top left'])await test('gate-'+type+'-'+pivot,()=>{H.reset([{id:'a',type}]);H.action('a',90,{anchor:pivot});return H.snap('a');},x=>pivot==='center'?close(x.angle,90):(['vector','image','hotspot','panel','hline','vline'].includes(type)?close(x.angle,90):close(x.angle,0)));
  for(const from of [0,90,-45.5])await test('rotated-local-offset-'+from,()=>{H.reset([{id:'a',angle:from}]);const before=H.snap('a');H.action('a',90,{offsetX:30,offsetY:-10});return {before,after:H.snap('a'),trace:H.trace()};},x=>{const r=x.before.angle*Math.PI/180,ox=30*Math.cos(r)+10*Math.sin(r),oy=30*Math.sin(r)-10*Math.cos(r);return close(x.after.left,100+ox+oy,.001)&&close(x.after.top,100+oy-ox,.001)});
  await test('fractional-parse-and-clockwise',()=>{H.reset([{id:'a'}]);H.action('a','22.5suffix',{options:{clockwise:false}});return H.snap('a');},x=>close(x.angle,337.5));
  await test('hidden-disabled-host-not-filtered',()=>{H.reset([{id:'a',hidden:true}]);$('#a').attr('aria-disabled','true');H.action('a',45);return H.snap('a');},x=>close(x.angle,45));
  await test('animation-event-flush-lazy-expressions',async()=>{H.reset([{id:'a'}]);H.vars().n=30;const e=H.action('a','$n',{options:{easing:'linear',duration:100}});const beforeFlush=H.trace().slice();H.vars().n=90;H.flush(e);const atStart=H.snap('a');await H.wait(180);return {beforeFlush,atStart,final:H.snap('a'),trace:H.trace()};},x=>!x.beforeFlush.some(e=>e.kind==='eval')&&close(x.final.angle,90)&&x.atStart.cache===90);
  await test('animation-queue-expression-re-evaluation',async()=>{H.reset([{id:'a'}]);H.vars().n=90;const e=H.action('a','$n',{options:{easing:'linear',duration:90}});H.action('a','$n',{options:{easing:'linear',duration:90}},e);H.flush(e);await H.wait(35);H.vars().n=30;await H.wait(230);return {final:H.snap('a'),trace:H.trace()};},x=>close(x.final.angle,120)&&x.trace.filter(e=>e.kind==='event').length===2);
  await test('animation-next-before-prior-fit',async()=>{H.reset([{id:'a'}]);const e=H.action('a',90,{options:{easing:'linear',duration:60}});H.action('a',30,{options:{easing:'linear',duration:60}},e);H.flush(e);await H.wait(180);return H.trace();},x=>{const events=x.map((e,i)=>[e,i]).filter(([e])=>e.kind==='event');const firstFit=x.findIndex(e=>e.kind==='fit');return events.length===2&&events[1][1]<firstFit;});
  await test('animated-full-turn-does-not-shortest-path',async()=>{H.reset([{id:'a',angle:350}]);const e=H.action('a',10,{rotateType:'location',options:{easing:'linear',duration:160}});H.flush(e);await H.wait(65);const mid=H.snap('a');await H.wait(170);return {mid,final:H.snap('a'),trace:H.trace()};},x=>x.mid.angle>10&&x.mid.angle<300&&close(x.final.angle,10));
  for(const to of [false,true])await test('onRotate-handler-changes-current-before-delta-'+to,()=>{H.reset([{id:'a',angle:30}]);H.hooks().onRotate=()=>$('#a').css('transform','rotate(60deg)');H.action('a',90,{rotateType:to?'location':'delta'});return H.snap('a');},x=>x.angle===(to?90:150));
  await test('center-rotation-replaces-scale-and-translate',()=>{H.reset([{id:'a'}]);$('#a').css('transform','translate(12px, 23px) scale(2, 3) rotate(0deg)');H.action('a',90);return H.snap('a');},x=>x.inline==='rotate(90deg)');
  await test('independent-widget-queues-start-together',async()=>{H.reset([{id:'a'},{id:'b'}]);const e=H.action('a',90,{options:{easing:'linear',duration:150}});H.action('b',180,{options:{easing:'linear',duration:150}},e);H.flush(e);await H.wait(50);const mid={a:H.snap('a'),b:H.snap('b')};await H.wait(190);return {mid,a:H.snap('a'),b:H.snap('b'),trace:H.trace()};},x=>x.mid.a.angle>0&&x.mid.b.angle>0&&close(x.a.angle,90)&&close(x.b.angle,180));
  await test('zero-delta-skips-fit-and-annotation',()=>{H.reset([{id:'a',angle:30}]);H.action('a',30,{rotateType:'location'});return H.trace();},x=>x.some(e=>e.kind==='event')&&!x.some(e=>e.kind==='fit'||e.kind==='annotation'));
  await test('dom-stop-does-not-cancel-private-angle-animation',async()=>{H.reset([{id:'a'}]);H.ax('#a').rotate(180,'linear',160,false,true);await H.wait(40);$('#a').stop(true,true);const mid=H.snap('a');await H.wait(190);return {mid,final:H.snap('a'),trace:H.trace()};},x=>x.mid.angle>0&&x.mid.angle<180&&close(x.final.angle,180));
  await test('adaptive-like-css-rewrite-is-overwritten-by-live-angle-tween',async()=>{H.reset([{id:'a'}]);H.ax('#a').rotate(180,'linear',160,false,true);await H.wait(40);$('#a').css('transform','rotate(12deg)');const rewritten=H.snap('a');await H.wait(190);return {rewritten,final:H.snap('a'),trace:H.trace()};},x=>x.rewritten.angle===12&&close(x.final.angle,180));
  await test('detached-node-animation-completes-host-callback',async()=>{H.reset([{id:'a'}]);const elem=document.getElementById('a');H.ax('#a').rotate(90,'linear',100,false,true);await H.wait(30);elem.remove();await H.wait(150);return {detachedTransform:elem.style.transform,trace:H.trace()};},x=>x.detachedTransform==='rotate(90deg)'&&x.trace.some(e=>e.kind==='fit'));
  await test('same-id-dom-replacement-following-queued-action-uses-replacement',async()=>{H.reset([{id:'a'}]);const e=H.action('a',90,{options:{easing:'linear',duration:100}});H.action('a',30,{options:{easing:'linear',duration:60}},e);H.flush(e);await H.wait(30);const old=document.getElementById('a'),replacement=old.cloneNode();replacement.style.transform='rotate(180deg)';old.replaceWith(replacement);await H.wait(220);return {oldTransform:old.style.transform,replacement:H.snap('a'),trace:H.trace()};},x=>x.oldTransform==='rotate(90deg)'&&x.replacement.angle===210);
  await test('query-multiple-target-late-fit-captures-last-id',async()=>{H.reset([{id:'a'},{id:'b'}]);H.ax(['a','b']).rotate(90,'linear',70,false,true);await H.wait(160);return H.trace().filter(e=>e.kind==='fit');},x=>x.length===2&&x.every(e=>e.id==='b'));
  await test('direct-concurrent-rotate-is-not-action-queue',async()=>{H.reset([{id:'a'}]);H.ax('#a').rotate(90,'linear',180,false,true);await H.wait(30);const current=H.snap('a');H.ax('#a').rotate(-30,'linear',60,false,true);await H.wait(220);return {current,final:H.snap('a'),trace:H.trace()};},x=>close(x.final.angle,90));
  await test('layer-recurses-hidden-and-ineligible-descendants',()=>{H.reset([{id:'g',type:'layer',children:['a','g2'],bounds:{width:400,height:200,centerPoint:{x:200,y:100}}},{id:'a',x:0,y:0,w:100,h:100,hidden:true},{id:'g2',type:'layer',children:['b']},{id:'b',type:'input',x:200,y:0,w:100,h:100}]);H.action('g',90);return {group:H.snap('g'),a:H.snap('a'),b:H.snap('b'),trace:H.trace()};},x=>x.group.angle===90&&close(x.a.angle,90)&&x.b.angle===0&&x.trace.filter(e=>e.kind==='event').length===4);
  await test('layer-empty-does-not-fire-or-advance-queue',()=>{H.reset([{id:'g',type:'layer',children:[]}]);H.action('g',90);return H.trace();},x=>!x.some(e=>e.kind==='event'||e.kind==='fire'));
  await test('compound-none-is-private-one-ms-animation',async()=>{H.reset([{id:'a'}]);$('#a').css('transform','matrix(2,0,0,3,10,20)');H.ax.move.compoundRotateAround('a',90,{x:200,y:150},{x:0,y:0},{x:0,y:0},undefined,'none',0,false,()=>log('completion','a'));const before=H.trace().slice();await H.wait(90);return {before,after:H.snap('a'),matrix:H.ax.public.fn.transformFromElement(document.getElementById('a')),trace:H.trace()};},x=>close(x.matrix[0],0,1e-12)&&x.matrix[1]===2&&x.matrix[2]===-3&&close(x.matrix[3],0,1e-12)&&x.trace.some(e=>e.kind==='completion'));
  await test('offset-animation-final-center-and-double-fit',async()=>{H.reset([{id:'a'}]);const e=H.action('a',90,{anchor:'top left',options:{easing:'linear',duration:100}});H.flush(e);await H.wait(190);return {final:H.snap('a'),trace:H.trace()};},x=>close(x.final.left,-50,.05)&&close(x.final.top,150,.05)&&close(x.final.angle,90)&&x.trace.filter(e=>e.kind==='fit').length===2);
  for(const clockwise of [false,true])await test('coalesced-unchanged-resize-ignores-clockwise-'+clockwise,()=>{H.reset([{id:'a'}]);const e={idToResizeMoveState:{a:{}}};H.addResize('a',e,{width:200,height:100,anchor:'top left'},{easing:'none',duration:0,stop:{instant:true},rotateStop:{instant:true}},undefined,{degree:90,offsetX:0,offsetY:0,anchor:'center',rotateType:'delta',options:{clockwise}});return {final:H.snap('a'),trace:H.trace()};},x=>x.final.angle===90);
  return out;
});
results.push(...browserResults);
const browserVersion = browser.version();
await browser.close();
const output = { schema: 1, generatedAt: new Date().toISOString(), sourceDistributionSha256: prior.distributionSha256 ?? 'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0', sources, ranges, environment: { node: process.version, browser: browserVersion, mode: 'headless Edge local DOM, network aborted, original jQuery and exact source slices' }, substitutions: ['Widget lookup and generated object model, expression evaluation and target path resolver are explicit sinks.', 'fitParentPanel, event execution, annotation and visibility caches are logged sinks; events do not run authored cases.', 'offsetBoundingRect uses the fixture center; fixed positioning, scrolling, containment and auto-fit parent reflow are not emulated.', 'VM batching executes original dispatcher/queues but _addMove/_addResize/_addRotate are recording sinks.', 'Actual browser animation uses the retained full jQuery distribution. No vendor GUI or DLL execution.'], requests, errors, summary: { total: results.length, passed: results.filter(x=>x.passed).length, failed: results.filter(x=>!x.passed).length }, results, script: { path: path.relative(root, import.meta.filename).replaceAll('\\','/'), sha256: hash(fs.readFileSync(import.meta.filename)) } };
fs.writeFileSync(path.join(root, 'research/runtime-rotate-motion-probes.json'), JSON.stringify(output, null, 2)+'\n');
console.log(JSON.stringify({ summary: output.summary, browserVersion, requests, errors, failures: results.filter(x=>!x.passed) },null,2));
if(output.summary.failed||errors.length||requests.length)process.exitCode=1;
