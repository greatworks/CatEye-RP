import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const previous = JSON.parse(fs.readFileSync('research/runtime-rotate-motion-evidence.json', 'utf8'));
const base = path.dirname(previous.sources.find(x => x.path.endsWith('/action.js')).path);
const sources = [], slices = [];
function file(name) {
  const absolute = path.resolve(base, name), bytes = fs.readFileSync(absolute), digest = sha(bytes);
  const pinned = previous.sources.find(x => path.resolve(x.path) === absolute);
  if (pinned) assert.equal(digest, pinned.sha256, name);
  if (name === 'utils.temp.js') assert.equal(digest, 'ef33a9174ea5b4cdcd48229f896195d2f67941116aa7eeae6308a99e02b4832f');
  if (!sources.some(x => x.path === absolute.replaceAll('\\', '/'))) sources.push({ path: absolute.replaceAll('\\', '/'), sha256: digest, bytes: bytes.length });
  return bytes.toString('utf8');
}
function slice(name, from, through) {
  const content = file(name).split(/\r?\n/).slice(from - 1, through).join('\n');
  slices.push({ name, from, through, sha256: sha(content) });
  return content;
}
const jq = file('../jquery-3.7.1.min.js');
const math = file('math.js'), move = file('move.js');
const bootstrap = `
var models={}, vars={}, hooks={}, trace=[], frames=[], begin=0, capturing=false, animationSequence=0, plannedLimit=0, plannedCount=0;
var SAFARI=false, IOS=false, SHARE_APP=false;
const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v));
function $jobj(id){return jQuery(document.getElementById(id));}
function $jobjAll(id){return $jobj(id);}
function $obj(id){return models[id];}
function $addAll(q,id){return q;}
function $ax(selector){const ids=Array.isArray(selector)?selector:[selector.slice(1)];const q=Object.create($ax.public.fn);q.getElementIds=()=>ids;q.getParents=(...args)=>[[]];q.getChildren=()=>[{children:models[ids[0]]?.children||[]}];return q;}
$ax.public={fn:{}};$ax.visibility={};$ax.adaptive={currentViewId:''};
var $axure={fn:$ax.public.fn,internal:fn=>fn($ax)};
function snap(id='a') { const el=document.getElementById(id); if(!el)return null;return {x:parseFloat(el.style.left),y:parseFloat(el.style.top),width:parseFloat(el.style.width),height:parseFloat(el.style.height),angle:$ax.move?.getRotationDegree(id),inline:el.style.transform,moved:copy($ax.visibility.getMovedLocation?.(id)),resized:copy($ax.visibility.getResizedSize?.(id)),rotated:$ax.visibility.getRotatedAngle?.(id),bounds:copy($ax.public.fn.offsetBoundingRect?.call($ax('#'+id))),querySize:copy($ax.public.fn.size?.call($ax('#'+id)))}; }
function log(kind,id,detail){trace.push({n:trace.length,at:performance.now()-begin,kind,id,detail:copy(detail),snapshot:id?snap(id):undefined});}
$ax.expr={evaluateExpr:(expr,event)=>{const value=expr&&typeof expr==='object'&&'value'in expr?expr.value:expr;let result=typeof value==='string'&&value.startsWith('$')?vars[value.slice(1)]:value;log('evaluate',event?.targetElement,{expr,result});return result;},displayWidgetAndParents:()=>()=>{},displayWidgetIfNeeded:id=>({jObject:$jobj(id),trap:()=>{}})};
$ax.event={raiseSyntheticEvent:(id,name)=>{log('event',id,name);if(hooks[name])hooks[name](id);}};
$ax.style={generateState:()=>'',computeFullStyle:id=>models[id].style};
$ax.getTypeFromElementId=id=>models[id]?.type;$ax.getNumFromPx=parseFloat;
$ax.getElementIdsFromPath=p=>Array.isArray(p)?p:[p];
$ax.repeater={removeSuffixFromElementId:id=>id};
$ax.dynamicPanelManager={getFixedInfo:()=>({}),isPercentWidthPanel:()=>false,fitParentPanel:id=>log('fit',id),setFitToContentCss:(...args)=>log('setFitToContentCss',args[0],args.slice(1)),updatePanelPercentWidth:id=>log('panelPercent',id),updatePanelContentPercentWidth:id=>log('panelContentPercent',id)};
$ax.drag={LogMovedWidgetForDrag:()=>{}};$ax.annotation={adjustIconLocation:id=>log('annotation',id)};$ax.flyoutManager={updateFlyout:id=>log('flyout',id)};
$ax.visibility.IsIdVisible=id=>$jobj(id).css('display')!=='none';$ax.visibility.pushContainer=()=>{};$ax.visibility.popContainer=()=>{};
(function(){${slice('utils.temp.js',5,49)}})();
$ax.splice=(a,i,n)=>a.splice(i,n);
(function(){${slice('axQuery.std.js',4,81)}})();
$ax.public.fn.convertToSingleImage=q=>log('singleImage',q[0]?.id);
${math}
(function(){var _visibility=$ax.visibility;${slice('visibility.js',1347,1421)}})();
(function(){var _fixedLocation=()=>({valid:false});${slice('axQuery.std.js',1299,1323)}\n${slice('axQuery.std.js',1438,1575)}\n${slice('axQuery.std.js',1628,1647)}})();
${move}
(function(){${slice('axQuery.std.js',457,482)}\n${slice('axQuery.std.js',514,826)}})();
(function(){${slice('action.js',2,369)}\n${slice('action.js',702,741)}\n${slice('action.js',756,1506)}\n${slice('action.js',1528,1551)}\n${slice('action.js',1571,1732)}
  const oldFire=_fireAnimationFromQueue;_fireAnimationFromQueue=_action.fireAnimationFromQueue=function(id,type){log('release-before',id,type);const out=oldFire(id,type);log('release-after',id,type);return out;};
  for(const name of ['move','resize','rotate']){const old=name==='move'?_addMove:name==='resize'?_addResize:_addRotate;const wrapped=function(id,event,info,opts,m,r){log('planned-'+name,id,{info,opts,move:m,rotate:r});if(plannedLimit&&++plannedCount>plannedLimit)throw new Error('HARNESS_CONSUMER_BUDGET');return old.apply(this,arguments);};if(name==='move')_addMove=wrapped;else if(name==='resize')_addResize=wrapped;else _addRotate=wrapped;}
  _actionHandlers.marker=function(event,actions,index){log('marker',null,actions[index].value);_dispatchAction(event,actions,index+1);};
  globalThis.Native={dispatch:_dispatchAction,flush:_action.flushAllResizeMoveActions,resetQueues:()=>{animationQueue={};animationsToCount={};actionToActionGroups={};},queueState:()=>Object.fromEntries(Object.entries(animationQueue).map(([id,types])=>[id,Object.fromEntries(Object.entries(types).map(([key,list])=>[key,list.length]))]))};
})();
const rawAnimate=$.fn.animate;
$.fn.animate=function(properties,options){const target=this[0],animationId=++animationSequence;const targetKind=target?.nodeType?'element':Object.keys(target||{}).join(',');log('animate-start',target?.id||'a',{animationId,targetKind,properties,options:{duration:options?.duration,easing:options?.easing,queue:options?.queue}});let passed=options;if(options&&typeof options==='object'){passed={...options};const step=options.step,complete=options.complete;passed.step=function(now,fx){if(step)step.apply(this,arguments);if(frames.length<1200)frames.push({kind:'step',animationId,at:performance.now()-begin,property:fx.prop,now,snapshot:snap()});};passed.complete=function(){log('animate-complete-before',target?.id||'a',{animationId,targetKind});if(complete)complete.apply(this,arguments);log('animate-complete-after',target?.id||'a',{animationId,targetKind});};}return rawAnimate.call(this,properties,passed);};
function reset(items=[{}]) { $.timers.splice(0);Native.resetQueues();$ax.visibility.clearMovedAndResized();trace=[];frames=[];models={};vars={};hooks={};animationSequence=0;document.body.replaceChildren();begin=performance.now();for(const item of items){const id=item.id||'a',e=document.createElement('div'),x=item.x??100,y=item.y??100,w=item.width??200,h=item.height??100,angle=item.angle??0;e.id=id;Object.assign(e.style,{position:'absolute',left:x+'px',top:y+'px',width:w+'px',height:h+'px',boxSizing:'border-box',background:'#d9e7ff',transform:'rotate('+angle+'deg)',transformOrigin:'50% 50%'});if(item.hidden)e.style.display='none';document.body.append(e);models[id]={type:item.type||'vectorShape',scriptIds:[id],style:{location:{x,y},size:{width:w,height:h},rotation:angle,outerShadow:item.shadow||{on:false}},children:item.children};} }
function literal(value){return {exprType:'stringLiteral',value};}
function action(kind,opts={}){const id=opts.id||'a',duration=opts.duration??100,easing=opts.easing||'linear';if(kind==='move')return {action:'moveWidget',objectsToMoves:[{objectPath:id,moveInfo:{moveType:opts.mode||'delta',xValue:literal(opts.x??40),yValue:literal(opts.y??20),options:{duration,easing,trajectory:opts.trajectory||'straight'}}}]};if(kind==='resize')return {action:'setWidgetSize',objectsToResize:[{objectPath:id,sizeInfo:{width:literal(opts.width??300),height:literal(opts.height??160),anchor:opts.anchor||'top left',duration,easing}}]};return {action:'rotateWidget',objectsToRotate:[{objectPath:id,rotateInfo:{degree:literal(opts.degree??90),offsetX:literal(opts.offsetX??0),offsetY:literal(opts.offsetY??0),anchor:opts.anchor||'center',rotateType:opts.mode||'delta',options:{duration,easing,clockwise:opts.clockwise??true}}}]};}
function dispatch(actions,event={srcElement:'a'}){Native.dispatch(event,actions);log('event-tail-before-flush','a');Native.flush(event);log('event-tail-after-flush','a');return event;}
async function settle(ms=600){const start=performance.now();while($.timers.length&&performance.now()-start<ms)await new Promise(r=>setTimeout(r,15));await new Promise(r=>setTimeout(r,25));return {final:snap(),trace:copy(trace),frames:copy(frames),timers:$.timers.length,queues:Native.queueState()};}
globalThis.H={reset,action,dispatch,settle,snap,vars:()=>vars,hooks:()=>hooks,trace:()=>trace,frames:()=>frames,ax:$ax,setBudget:n=>{plannedLimit=n;plannedCount=0;}};
`;

const output = process.argv[2] || 'research/runtime-transform-browser-first-probes.json';
assert.ok(path.basename(output).startsWith('runtime-transform-browser-'));
assert.equal(fs.existsSync(output), false, 'Preserve old results');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const requests = [], errors = [];
await context.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
const page = await context.newPage();page.on('pageerror',error=>errors.push(String(error.stack||error)));
let results=[],fatal;
try {
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
  await page.addScriptTag({content:jq});await page.addScriptTag({content:bootstrap});
  results=await page.evaluate(async()=>{
    const out=[],near=(a,b,t=0.02)=>Math.abs(a-b)<t;
    async function test(name,configuration,check){let observed;try{H.reset(configuration.items);if(configuration.vars)Object.assign(H.vars(),configuration.vars);if(configuration.hook)H.hooks()[configuration.hook.event]=id=>{H.vars()[configuration.hook.variable]=configuration.hook.value;};const actions=configuration.actions.map(([kind,opts])=>kind==='marker'?{action:'marker',value:opts}:H.action(kind,opts));H.dispatch(actions);observed=await H.settle(configuration.timeout||900);const basic=observed.timers===0&&Object.values(observed.queues).every(q=>Object.values(q).every(n=>n===0))&&['x','y','width','height','angle'].every(k=>Number.isFinite(observed.final[k]));out.push({name,configuration,passed:basic&&(!check||check(observed)),observed});}catch(error){out.push({name,configuration,passed:false,observed,error:String(error.stack||error)});}}
    await test('baseline-real-resize',{actions:[['resize',{}]]},x=>near(x.final.width,300)&&near(x.final.height,160));
    await test('baseline-real-move',{actions:[['move',{}]]},x=>near(x.final.x,140)&&near(x.final.y,120));
    await test('baseline-real-rotate',{actions:[['rotate',{}]]},x=>near(x.final.angle,90));
    const permutations=values=>values.length?values.flatMap((v,i)=>permutations(values.filter((_,j)=>i!==j)).map(rest=>[v,...rest])):[[]];
    for(const pair of [['move','resize'],['move','rotate'],['resize','rotate']])for(const order of permutations(pair))for(const unequal of [false,true])await test('pair-'+order.join('-')+'-'+(unequal?'unequal':'equal'),{actions:order.map(kind=>[kind,{duration:unequal?{move:40,resize:70,rotate:100}[kind]:100}])});
    for(const order of permutations(['move','resize','rotate']))for(const unequal of [false,true])await test('triple-'+order.join('-')+'-'+(unequal?'unequal':'equal'),{actions:order.map(kind=>[kind,{duration:unequal?{move:40,resize:70,rotate:100}[kind]:100}])});
    for(const mode of ['delta','location'])for(const clockwise of [true,false])await test('changed-resize-rotate-'+mode+'-'+clockwise,{items:[{angle:30}],actions:[['resize',{}],['rotate',{degree:90,mode,clockwise}]]},x=>near(x.final.angle,mode==='delta'?120:90));
    for(const [resizeAnchor,rotateAnchor]of [['center','center'],['bottom right','top left'],['top left','bottom right'],['bottom','right']])await test('different-anchors-'+resizeAnchor+'/'+rotateAnchor,{actions:[['move',{}],['resize',{anchor:resizeAnchor}],['rotate',{anchor:rotateAnchor}]]});
    for(const shadow of [{on:true,offsetX:-10,offsetY:-20,blurRadius:6},{on:true,offsetX:10,offsetY:20,blurRadius:6}])await test('shadow-'+shadow.offsetX,{items:[{shadow}],actions:[['move',{duration:80}],['resize',{duration:140,anchor:'center'}],['rotate',{duration:200,offsetX:30,offsetY:-10}]]});
    await test('successor-move-after-triple',{actions:[['move',{duration:40}],['resize',{duration:70}],['rotate',{duration:100}],['move',{duration:60,x:100,y:0}]]});
    await test('successor-resize-after-triple',{actions:[['move',{duration:40}],['resize',{duration:70}],['rotate',{duration:100}],['resize',{duration:60,width:400,height:200}]]});
    await test('successor-rotate-after-triple',{actions:[['move',{duration:40}],['resize',{duration:70}],['rotate',{duration:100}],['rotate',{duration:60,degree:30}]]});
    await test('marker-after-third-before-event-flush',{actions:[['move',{duration:40}],['resize',{duration:70}],['rotate',{duration:100}],['marker','following-action']]},x=>x.trace.findIndex(t=>t.kind==='event')<x.trace.findIndex(t=>t.kind==='marker'));
    await test('resize-onRotate-degree-reentrant',{vars:{degree:90},hook:{event:'onRotate',variable:'degree',value:180},actions:[['resize',{}],['rotate',{degree:'$degree'}]]},x=>near(x.final.angle,180));
    await test('unequal-easing-selection',{actions:[['move',{duration:40,easing:'easeInQuad'}],['resize',{duration:70,easing:'easeOutBounce'}],['rotate',{duration:100,easing:'easeInCubic'}]]});
    // These assert the numeric/cache and sequencing observations independently
    // of a particular wall-clock callback timestamp.
    await test('strict-unequal-size-and-cache-ahead-of-paint',{actions:[['move',{duration:40}],['resize',{duration:70}],['rotate',{duration:100}]]},x=>{
      const starts=x.trace.filter(t=>t.kind==='animate-start'&&t.detail.properties.width!==undefined);
      const ev=x.trace.filter(t=>t.kind==='event');
      return near(x.final.resized.width,299.65306122448976,1e-9)&&near(x.final.resized.height,159.59183673469386,1e-9)
        &&near(starts[0].detail.properties.width,232.65306122448976,1e-9)
        &&near(starts[0].snapshot.width,200)&&near(starts[0].snapshot.querySize.width,232.65306122448976,1e-9)
        &&ev.map(t=>t.detail).join(',')==='onRotate,onMove,onRotate,onResize,onRotate,onResize'
        &&x.frames.some(f=>f.property==='width'&&f.now>200&&f.now<232.653);
    });
    for(const mode of ['delta','location'])await test('split-direction-switch-'+mode,{items:[{angle:30}],actions:[['resize',{duration:70}],['rotate',{duration:100,mode,clockwise:false}]]},x=>near(x.final.angle,mode==='delta'?66:-90));
    for(const anchor of ['top','right','bottom','left','center'])await test('missing-resizeOffset-axis-'+anchor,{actions:[['resize',{anchor:'top left'}],['rotate',{anchor,offsetX:anchor==='center'?30:0}]]},x=>x.final.moved?.left==='NaN'&&x.final.moved?.top==='NaN'&&near(x.final.x,100)&&near(x.final.y,100));
    for(const anchor of ['top left','top right','bottom left','bottom right'])await test('corner-resizeOffset-finite-'+anchor,{actions:[['resize',{anchor:'center'}],['rotate',{anchor}]]},x=>Number.isFinite(x.final.moved?.left)&&Number.isFinite(x.final.moved?.top));
    for(const angle of [0,30,90])for(const shadow of [{on:true,offsetX:-10,offsetY:-20,blurRadius:6},{on:true,offsetX:10,offsetY:20,blurRadius:6}])await test('finite-shadow-corner-'+angle+'-'+shadow.offsetX,{items:[{angle,shadow}],actions:[['move',{duration:80}],['resize',{duration:140,anchor:'center'}],['rotate',{duration:200,anchor:'top right'}]]},x=>Number.isFinite(x.final.moved?.left)&&Number.isFinite(x.final.moved?.top));
    for(let iteration=0;iteration<4;iteration++)await test('successor-move-overlap-repeat-'+iteration,{actions:[['move',{duration:40}],['resize',{duration:70}],['rotate',{duration:100}],['move',{duration:60,x:100,y:0}]]},x=>{
      const starts=x.trace.filter(t=>t.kind==='animate-start'),resizes=starts.filter(t=>t.detail.properties.width!==undefined),last=starts.findLast(t=>t.detail.targetKind==='element');
      const oldComplete=x.trace.find(t=>t.kind==='animate-complete-before'&&t.detail.animationId===resizes[1].detail.animationId);
      return near(x.final.moved.left,240)&&last.n<oldComplete.n&&near(last.detail.properties.left?.slice(2)*1,50);
    });
    await test('numeric-zero-coerces-empty-preserves-old-size',{actions:[['resize',{width:0,height:0}]]},x=>near(x.final.width,200)&&near(x.final.height,100)&&x.final.resized===undefined);
    await test('numeric-zero-one-axis-preserves-old-width',{actions:[['resize',{width:0,height:60}]]},x=>near(x.final.width,200)&&near(x.final.height,60)&&x.final.resized.width===200&&x.final.resized.height===60);
    await test('string-zero-css-vs-cache',{actions:[['resize',{width:'0',height:'0'}]]},x=>near(x.final.width,0)&&near(x.final.height,0)&&x.final.resized===undefined&&near(x.final.querySize.width,200)&&near(x.final.querySize.height,100));
    await test('string-zero-one-axis-still-cached',{actions:[['resize',{width:'0',height:'60'}]]},x=>near(x.final.width,0)&&near(x.final.height,60)&&x.final.resized.width===0&&x.final.resized.height===60);
    for(const type of ['table','textBox','inlineFrame','dynamicPanel'])await test('resize-eligibility-'+type,{items:[{type}],actions:[['resize',{}]]},x=>type==='table'?near(x.final.width,200)&&!x.trace.some(t=>t.kind==='event'&&t.detail==='onResize'):near(x.final.width,300));
    await test('hidden-changing-size',{items:[{hidden:true}],actions:[['move',{duration:40}],['resize',{duration:70}],['rotate',{duration:100}]]},x=>near(x.final.resized.width,299.65306122448976,1e-9));
    await test('cache-capture-width-expression-reentry',{vars:{w:300},hook:{event:'onRotate',variable:'w',value:400},actions:[['move',{duration:40}],['resize',{duration:70,width:'$w'}],['rotate',{duration:100}]]},x=>{
      const values=x.trace.filter(t=>t.kind==='evaluate'&&t.detail.expr?.value==='$w').map(t=>t.detail.result);
      return values.join(',')==='300,400'&&near(x.final.resized.width,399.65306122448976,1e-9);
    });
    await test('move-cached-expression-not-repeated',{vars:{x:40},hook:{event:'onRotate',variable:'x',value:400},actions:[['move',{duration:100,x:'$x'}],['resize',{duration:40}],['rotate',{duration:100}]]},x=>{
      const values=x.trace.filter(t=>t.kind==='evaluate'&&t.detail.expr?.value==='$x').map(t=>t.detail.result);
      return values.join(',')==='40'&&near(x.final.moved.left,140);
    });
    for(const instant of ['move','resize','rotate'])for(const order of [['move','resize','rotate'],['resize','rotate','move'],['rotate','move','resize']])await test('instant-first-type-'+instant+'-'+order.join('-'),{actions:order.map(kind=>[kind,{duration:kind===instant?0:100,easing:kind===instant?'none':'linear'}])});
    // Guard only pathological branches. Exact queue/actions/consumers run until
    // their eleventh planned call; the artificial exception prevents UI hangs.
    for(const [pending,other,incoming]of [['move','resize','rotate'],['rotate','resize','move'],['move','rotate','resize']]){
      H.reset();H.setBudget(10);const event={srcElement:'a'},configuration={pending,other,incoming,budget:10};let error;
      try{H.dispatch([H.action(pending,{duration:40}),H.action(pending,{duration:0,easing:'none'}),H.action(other,{duration:100}),H.action(incoming,{duration:100})],event);}catch(e){error=String(e.stack||e);}
      const trace=JSON.parse(JSON.stringify(H.trace())),state=JSON.parse(JSON.stringify(event.idToResizeMoveState,(key,value)=>key==='eventInfo'?'[same event reference]':value)),plans=trace.filter(t=>t.kind.startsWith('planned-'));
      const guarded=error?.includes('HARNESS_CONSUMER_BUDGET'),nativeThrow=error?.includes('TypeError');
      out.push({name:'bounded-pending-instant-'+pending+'-incoming-'+incoming,configuration,passed:(guarded&&plans.length===11)||nativeThrow,observed:{error,guarded,nativeThrow,trace,state,final:H.snap()},limits:'Artificial consumer budget only for this case; source loop itself is unmodified. Remaining timers are cleared by the next reset.'});
      H.setBudget(0);
    }
    H.reset();
    return out;
  });
} catch(error) {fatal=String(error.stack||error);}
const version=browser.version();await browser.close();
const report={schema:1,capturedAt:new Date().toISOString(),environment:{browser:version,node:process.version,mode:'actual headless Edge DOM + retained complete jQuery/UI + exact queues/actions/Move/Resize/Rotate/bounds/cache functions'},sources,slices,script:{path:'research/runtime-transform-browser-probe.mjs',sha256:sha(fs.readFileSync(import.meta.filename))},substitutions:['Generated model/style state and object-path resolver are controlled fixtures. No original authored page or GUI.','Expressions support supplied literal and variable tokens; full Axure expression interpreter is not loaded.','Synthetic events are logged and selected hooks can mutate fixture variables; full event/case dispatcher is not loaded.','Parent-fit, annotations, fixed-layout providers, containment containers and flyouts are logged/no-op sinks; no parent layout parity claim.','Real original numeric bounds and visibility caches are used; ordinary fixture widgets have no native parent hierarchy.','Real jQuery animate/timers are wrapped for transparent observations; callbacks delegate synchronously without changing supplied properties, easing or duration.','Reset forcibly clears timers only between completed/failed independent cases.'],summary:{total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length},requests,errors,fatal,results};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,sha256:sha(fs.readFileSync(output)),summary:report.summary,requests,errors,fatal,failures:results.filter(x=>!x.passed).map(x=>({name:x.name,error:x.error,final:x.observed?.final,queues:x.observed?.queues}))},null,2));
if(fatal||errors.length||requests.length||report.summary.failed)process.exitCode=1;
