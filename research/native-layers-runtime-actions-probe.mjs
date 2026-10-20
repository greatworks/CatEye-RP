import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { layerHarness } from './native-layers-runtime-probe.mjs';
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const hash=v=>createHash('sha256').update(v).digest('hex');
const pins=JSON.parse(fs.readFileSync('research/native-layers-runtime-second-probes.json','utf8')).sources;
for(const pin of pins)assert.equal(hash(fs.readFileSync(pin.path)),pin.sha256);
const ranges=[];
function lines(file,first,last){const text=fs.readFileSync(path.join(root,file),'utf8').split(/\r?\n/).slice(first-1,last).join('\n');if(!ranges.some(r=>r.file===file&&r.first===first&&r.last===last))ranges.push({file,first,last,sha256:hash(text)});return text}
const group=`add('g',{left:100,top:100,width:200,height:100},{type:'layer',propagate:true},'base');add('a',{left:100,top:100,width:40,height:20},{type:'vectorShape'},'g');add('n',{left:140,top:120,width:100,height:60},{type:'layer',propagate:true},'g');add('b',{left:140,top:120,width:40,height:20},{type:'vectorShape'},'n');add('h',{left:200,top:160,width:40,height:20,visibility:'hidden',display:'none'},{type:'vectorShape'},'n');`;
const stateSetup=`
$ax.annotation={updateLinkLocations:id=>calls.push({kind:'annotation',id}),adjustIconLocation:()=>{}};
$ax.style.SetWidgetHover=(id,value)=>calls.push({kind:'hover',id,value});
$ax.style.SetWidgetMouseDown=(id,value)=>calls.push({kind:'down',id,value});
$ax.style.SetWidgetEnabled=(id,value)=>calls.push({kind:'enabled',id,value});
$ax.style.SetWidgetError=(id,value)=>calls.push({kind:'error',id,value});
var _event=$ax.event;_event.mouseOverIds=[];_event.mouseOverObjectId='';_event.mouseDownObjectId='';
$ax.splice=(a,i,n)=>a.splice(i,n);
${lines('repeater.js',2605,2653)}
${lines('events.js',1031,1061)}
${lines('events.js',1438,1456)}
${lines('axQuery.std.js',1087,1178)}
var priorAxure=$axure;$axure=function(s){return $ax(s)};Object.assign($axure,priorAxure);
A.prototype.enabled=$ax.public.fn.enabled;A.prototype.error=$ax.public.fn.error;
$ax.INPUT=id=>id+'_input';
var _selectedWidgets={},SELECTED='selected';
function _isWidgetDisabled(id){return !!objects[id].disabled}
function _widgetHasState(){return false}
$ax.style.IsWidgetSelected=id=>!!_selectedWidgets[id];
$ax.event.raiseSelectedEvents=(id,value)=>calls.push({kind:'selectedEvent',id,value});
$ax.getPathFromScriptId=id=>[id];$ax.getElementIdFromPath=p=>p.at(-1);
${lines('style.js',186,253)}
A.prototype.selected=function(value){$ax.style.SetWidgetSelected(this.id,value)};
`;
const queueSetup=`
$ax.splice=(a,i,n)=>a.splice(i,n);
Q.prototype.each=function(fn){this.xs.forEach((n,i)=>fn.call(n,i,n));return this};
var oldChildren=Q.prototype.children;Q.prototype.children=function(selector){var q=oldChildren.call(this);return selector==='svg.img'?new Q([]):q};
function $jobjAll(id){return $jobj(id)}
$ax.annotation={adjustIconLocation:()=>{}};
$ax.flyoutManager={updateFlyout:()=>{}};
$ax.dynamicPanelManager.updatePanelPercentWidth=()=>{};
$ax.dynamicPanelManager.updatePanelContentPercentWidth=()=>{};
$ax.dynamicPanelManager.setFitToContentCss=()=>{};
$ax.public.fn.GetFieldFromStyle=(q,p)=>num(q.css(p));
${lines('action.js',2,349)}
${lines('action.js',818,864)}
${lines('action.js',1061,1065)}
${lines('action.js',1082,1189)}
};
${lines('action.js',1192,1197)}
${lines('action.js',1225,1237)}
${lines('action.js',1240,1256)}
${lines('action.js',1286,1506)}
${lines('axQuery.std.js',570,826)}
A.prototype.resize=$ax.public.fn.resize;
var nativeResize=A.prototype.resize;A.prototype.resize=function(css,info,fire,moves,cb){calls.push({kind:'resize-consume',id:this.id,css:Object.assign({},css)});return nativeResize.call(this,css,info,fire,moves,cb)};
A.prototype.circularMoveAndRotate=function(degree,options,x,y,rotates,move,resizeOffset,resizeDeltaMove,complete){calls.push({kind:'orbit-sink',id:this.id,degree,x,y,rotates,move,resizeOffset,resizeDeltaMove});_fireAnimationFromQueue(this.id,queueTypes.rotate);_fireAnimationFromQueue(this.id,queueTypes.move);if(complete)complete()};
var nativeAddAnimations=_addAnimations;_addAnimations=function(jobs){calls.push({kind:'reservation',jobs:jobs.map(x=>({id:x.id,type:x.type}))});return nativeAddAnimations(jobs)};
function resizeLayer(width,height,anchor,stop){var event={srcElement:'g',idToResizeMoveState:{g:{}}};_addResize('g',event,{width:{value:String(width)},height:{value:String(height)},anchor:anchor},{easing:'none',duration:0,stop:stop||{instant:true}})}
function rotateLayer(degree,type,clockwise,anchor,stop){_addRotate('g',{}, {degree:{value:String(degree)},offsetX:{value:'0'},offsetY:{value:'0'},anchor:anchor||'center',rotateType:type||'delta',options:{clockwise:clockwise!==false}},{easing:'none',duration:0,stop:stop||{instant:true}})}
`;
const focusSetup=`
var _event=$ax.event;
$ax.getElementIdFromPath=p=>p.at(-1);
${lines('events.js',650,710)}
`;
export function runActionCases(){
 const results=[];function test(name,code,check){let observed;try{observed=layerHarness(code);check(observed);results.push({name,passed:true,observed})}catch(e){results.push({name,passed:false,observed,error:String(e.stack)})}}
 for(const propagate of [undefined,false,true])test(`propagate child barrier ${propagate}`,stateSetup+group+`objects.n.propagate=${String(propagate)};_propagateMouseOver('g',true);return currentState();`,r=>assert.deepEqual(r.calls.filter(x=>x.kind==='hover').map(x=>x.id),propagate?['a','n','b','h']:['a']));
 test('propagate includes hidden and limbo non-container leaves',stateSetup+group+`_limboIds.b=true;_propagateMouseDown('g',true);return currentState();`,r=>assert.deepEqual(r.calls.filter(x=>x.kind==='down').map(x=>x.id),['a','n','b','h']));
 test('propagate ancestor lookup crosses non-propagating parent with direct false',stateSetup+group+`objects.n.propagate=false;return [_parentHandlesStyles('a'),_parentHandlesStyles('b'),_parentHandlesStyles('g')];`,r=>assert.deepEqual(r,[{id:'g',direct:true},{id:'g',direct:false},false]));
 test('container hover entry paints children not its own style',stateSetup+group+`dynamicPanelMouseOver('g');dynamicPanelMouseOver('g');dynamicPanelMouseLeave('g');return {state:currentState(),over:_event.mouseOverIds};`,r=>{assert.deepEqual(r.state.calls.filter(x=>x.kind==='hover').map(x=>[x.id,x.value]),['a','n','b','h'].map(x=>[x,true]).concat(['a','n','b','h'].map(x=>[x,false])));assert.deepEqual(r.over,[])});
 test('container down routes to directly propagating ancestor',stateSetup+group+`dynamicPanelMouseDown('n');dynamicPanelMouseUp('n');return currentState();`,r=>assert.deepEqual(r.calls.filter(x=>x.kind==='down').map(x=>[x.id,x.value]),['a','n','b','h'].map(x=>[x,true]).concat(['a','n','b','h'].map(x=>[x,false]))));
 test('Enabled recurses independently of propagate and ignores limbo',stateSetup+group+`objects.n.propagate=false;_limboIds.b=true;$ax('#g').enabled(false);return currentState();`,r=>assert.deepEqual(r.calls.filter(x=>x.kind==='enabled').map(x=>x.id),['g','a','n','h']));
 test('Error recurses independently of propagate and ignores limbo',stateSetup+group+`objects.n.propagate=false;_limboIds.b=true;$ax('#g').error(true);return currentState();`,r=>assert.deepEqual(r.calls.filter(x=>x.kind==='error').map(x=>x.id),['g','a','n','h']));
 test('Selected traverses hidden and limbo despite propagate false, parent event last',stateSetup+group+`objects.n.propagate=false;_limboIds.b=true;$ax('#g').selected(true);return {state:currentState(),selected:_selectedWidgets};`,r=>assert.deepEqual(r.state.calls.filter(x=>x.kind==='selectedEvent').map(x=>x.id),['a','b','h','n','g']));
 test('Disabled child is skipped during Selected cascade',stateSetup+group+`objects.n.disabled=true;$ax('#g').selected(true);return {state:currentState(),selected:_selectedWidgets};`,r=>{assert.deepEqual(r.state.calls.filter(x=>x.kind==='selectedEvent').map(x=>x.id),['a','g']);assert.equal(r.selected.b,undefined)});
 for(const anchor of ['top left','center','bottom right'])test(`Layer resize actual leaf consumers ${anchor}`,queueSetup+group+`resizeLayer(300,160,${JSON.stringify(anchor)});var before=currentState();flush();return {before,after:currentState()};`,r=>{assert.deepEqual(r.after.resized.a,{width:60,height:32});assert.deepEqual(r.after.resized.h,{width:60,height:32});assert.deepEqual(r.before.calls.filter(x=>x.kind==='resize-consume').map(x=>x.id),['a','b','h']);assert.ok(r.before.calls.find(x=>x.kind==='event'&&x.id==='g'&&x.event==='onResize'));assert.equal(r.after.nodes.a.left,anchor==='top left'?100:anchor==='center'?50:0);assert.equal(r.after.nodes.h.top,anchor==='top left'?196:anchor==='center'?166:136)});
 test('Layer resize reserves nested Layer resize and leaf resize plus move',queueSetup+group+`resizeLayer(300,160,'top left');flush();return currentState();`,r=>assert.deepEqual(r.calls.find(x=>x.kind==='reservation').jobs,[{id:'g',type:4},{id:'a',type:4},{id:'a',type:1},{id:'n',type:4},{id:'b',type:4},{id:'b',type:1},{id:'h',type:4},{id:'h',type:1}]));
 test('Layer resize rounds requested delta before proportional scaling',queueSetup+group+`resizeLayer(200.49,100.49,'top left');flush();return currentState();`,r=>{assert.deepEqual(r.resized.a,{width:40,height:20});assert.deepEqual(r.resized.h,{width:40,height:20});assert.equal(r.nodes.h.left,200)});
 test('Layer resize half slice uses remaining duration denominator',queueSetup+group+`resizeLayer(300,160,'top left',{start:40,end:70,len:100});flush();return currentState();`,r=>{assert.deepEqual(r.resized.a,{width:50,height:26});assert.equal(r.nodes.h.top,178)});
 test('Empty Layer resize exits without queues or events',queueSetup+`add('g',{}, {type:'layer'},'base');resizeLayer(100,50,'top left');return currentState();`,r=>assert.equal(r.calls.length,0));
 for(const clockwise of [false,true])test(`Layer rotate action target and membership ${clockwise}`,queueSetup+group+`add('c',{left:250,top:100,width:20,height:20},{type:'checkbox'},'g');rotateLayer(90,'delta',${clockwise},'top right');return currentState();`,r=>{const orbits=r.calls.filter(x=>x.kind==='orbit-sink');assert.deepEqual(orbits.map(x=>x.id),['a','b','h','c']);assert.deepEqual(orbits.map(x=>x.rotates),[true,true,true,false]);assert.equal(orbits[0].degree,clockwise?90:-90);assert.equal(orbits[0].x,300);assert.equal(orbits[0].y,100);assert.deepEqual(r.calls.filter(x=>x.kind==='event'&&x.event==='onRotate').map(x=>x.id),['g','a','n','b','h','c'])});
 test('Layer rotate queues nested Layer rotate and leaf rotate plus move',queueSetup+group+`rotateLayer(90);return currentState();`,r=>assert.deepEqual(r.calls.find(x=>x.kind==='reservation').jobs,[{id:'g',type:5},{id:'a',type:5},{id:'a',type:1},{id:'n',type:5},{id:'b',type:5},{id:'b',type:1},{id:'h',type:5},{id:'h',type:1}]));
 test('Empty Layer rotate exits without event',queueSetup+`add('g',{}, {type:'layer'},'base');rotateLayer(90);return currentState();`,r=>assert.equal(r.calls.length,0));
 test('Layer rotation stores full target even partial slice, nested Layer angle unchanged',queueSetup+group+`$jobj('n').data('layerDegree',15);rotateLayer(90,'delta',true,'center',{start:40,end:70,len:100});return {state:currentState(),g:$jobj('g').data('layerDegree'),n:$jobj('n').data('layerDegree')};`,r=>{assert.equal(r.g,90);assert.equal(r.n,15);assert.equal(r.state.calls.find(x=>x.kind==='orbit-sink').degree,45)});
 test('Layer To uses its own accumulated degree, not child orientation',queueSetup+group+`rotateLayer(90);rotateLayer(30,'location');return {state:currentState(),degree:$jobj('g').data('layerDegree')};`,r=>{assert.equal(r.degree,30);assert.deepEqual(r.state.calls.filter(x=>x.kind==='orbit-sink'&&x.id==='a').map(x=>x.degree),[90,-60])});
 test('Layer combined Resize Rotate uses resize anchor, repeats root Rotate, and ignores clockwise false',queueSetup+group+`_addResize('g',{srcElement:'g',idToResizeMoveState:{g:{}}},{width:{value:'300'},height:{value:'160'},anchor:'top left'},{easing:'none',duration:0,stop:{instant:true},rotateStop:{instant:true}},undefined,{degree:{value:'90'},offsetX:{value:'0'},offsetY:{value:'0'},anchor:'bottom right',rotateType:'delta',options:{clockwise:false}});flush();return currentState();`,r=>{assert.equal(r.calls.filter(x=>x.kind==='event'&&x.id==='g'&&x.event==='onRotate').length,2);const orbit=r.calls.find(x=>x.kind==='orbit-sink');assert.equal(orbit.degree,90);assert.equal(orbit.x,100);assert.equal(orbit.y,100);assert.deepEqual(orbit.resizeOffset,{x:-50,y:-30});assert.deepEqual(orbit.resizeDeltaMove,{x:0,y:0});assert.deepEqual(r.resized.a,{width:60,height:32})});
 test('Layer public resize rejects checkbox size but still moves checkbox',queueSetup+group+`add('c',{left:200,top:160,width:40,height:20},{type:'checkbox'},'g');resizeLayer(300,160,'top left');flush();return currentState();`,r=>{assert.equal(r.resized.c,undefined);assert.equal(r.nodes.c.width,40);assert.equal(r.nodes.c.height,20);assert.equal(r.nodes.c.left,270);assert.equal(r.nodes.c.top,208)});
 test('First ordered Layer child is focus proxy even hidden and limbo',focusSetup+group+`objects.g.objs=[objects.h,objects.a];_limboIds.h=true;_event.layerRdoMapFocus(objects.g,'g');return {map:_layerRdoToFocusableWidget,parent:_widgetToFocusParent,id:_event.getFocusableWidgetOrChildId('g')};`,r=>{assert.equal(r.map.g,'h');assert.equal(r.parent.h,'g');assert.equal(r.id,'h')});
 test('Focus proxy follows first nested Layer recursively',focusSetup+group+`objects.g.objs=[objects.n,objects.a];objects.n.objs=[objects.b,objects.h];add('b_input',{},null);_event.layerRdoMapFocus(objects.g,'g');return {map:_layerRdoToFocusableWidget,parent:_widgetToFocusParent,id:_event.getFocusableWidgetOrChildId('g')};`,r=>{assert.deepEqual(r.map,{g:'b',n:'b'});assert.equal(r.id,'b_input')});
 test('Empty first Layer has no fallback focus to later siblings',focusSetup+group+`objects.g.objs=[objects.n,objects.a];objects.n.objs=[];_event.layerRdoMapFocus(objects.g,'g');return {map:_layerRdoToFocusableWidget,id:_event.getFocusableWidgetOrChildId('g')};`,r=>{assert.deepEqual(r.map,{});assert.equal(r.id,'g')});
 test('Own focus interaction suppresses proxy need, ancestor focus map otherwise requests proxy',focusSetup+group+`objects.g.objs=[objects.a];objects.g.interactionMap={onFocus:{}};_event.layerRdoMapFocus(objects.g,'g');var absent=_needsProxy(objects.a,'a','onFocus');objects.a.interactionMap={onFocus:{}};return {absent,own:_needsProxy(objects.a,'a','onFocus'),layer:_needsProxy(objects.g,'g','onFocus')};`,r=>assert.deepEqual(r,{absent:true,own:false,layer:false}));
 return results;
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 const results=runActionCases(),summary={total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length};
 const report={capturedAt:new Date().toISOString(),kind:'Exact retained JS NodeVM. Layer Resize producer, original queue and public leaf Resize/Move consumers; Rotate orbit is explicit argument sink; state painting is explicit sink.',sources:pins,ranges,dependencies:['research/native-layers-runtime-probe.mjs','research/runtime-transform-special-probe.mjs'].map(p=>({path:p,sha256:hash(fs.readFileSync(p))})),script:{path:'research/native-layers-runtime-actions-probe.mjs',sha256:hash(fs.readFileSync(import.meta.filename))},summary,results};
 const out=process.argv[2]||'research/native-layers-runtime-actions-probes.json';assert.ok(!fs.existsSync(out),'Preserve '+out);fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary,failures:results.filter(x=>!x.passed)},null,2));if(summary.failed)process.exitCode=1;
}
