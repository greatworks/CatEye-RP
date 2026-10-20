import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { harness as retainedMotionHarness } from './runtime-transform-special-probe.mjs';

const root = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const hash = v => createHash('sha256').update(v).digest('hex');
const previous = JSON.parse(fs.readFileSync('research/runtime-rotate-motion-evidence.json', 'utf8'));
const names = ['action.js','axQuery.js','axQuery.std.js','move.js','math.js','visibility.js','repeater.js','style.js','events.js','doc.js','adaptive.js'];
const sources = names.map(name => {
  const file = path.join(root,name), bytes = fs.readFileSync(file), sha256 = hash(bytes);
  const old = previous.sources.find(x => path.resolve(x.path) === path.resolve(file));
  if (old) assert.equal(sha256,old.sha256,name);
  return {path:file,sha256,bytes:bytes.length};
});
assert.equal(hash(fs.readFileSync('research/runtime-transform-special-probe.mjs')), '11870fe01e55a5b0ef4e47b883705c88130b84ed5f9b22c7dbfcc1c593e086e8');
const ranges = [];
function lines(name,first,last) {
  const source = fs.readFileSync(path.join(root,name),'utf8').split(/\r?\n/).slice(first-1,last).join('\n');
  if (!ranges.some(x=>x.file===name&&x.first===first&&x.last===last)) ranges.push({file:name,first,last,sha256:hash(source)});
  return source;
}
const setup = `
// In-memory DOM/style/query facade. Original geometry, traversal and move consumers below remain unchanged.
var baseAdd=add;
add=function(id,css,obj,parent,kind){
  var n=baseAdd(id,css,obj,parent,kind);n.declaredParent=parent;n.attrs={};n.dataValues={};
  n.author={location:{x:num(n.style.left),y:num(n.style.top)},size:{width:num(n.style.width),height:num(n.style.height)},rotation:obj&&obj.rotation||0,outerShadow:obj&&obj.outerShadow||{on:false}};
  n.style.visibility=css&&css.visibility||'inherit';
  n.getAttribute=function(k){return this.attrs[k]??null};
  if(obj){objects[id].scriptIds=[id];objects[id].id=id}
  return n;
};
add('body',{});nodes.base.declaredParent='body';nodes.base.attrs={};nodes.base.getAttribute=function(){return null};
var oldDollar=$,anonymous=0;
window.document=document;
$=function(x){if(typeof x==='string'&&x.startsWith('<div')){var n=add('temp'+(++anonymous),{},null);n.id='';return new Q([n])}if(x==='body')return new Q([nodes.body]);return oldDollar(x)};
Object.assign($,oldDollar);$.inArray=(x,a)=>a.indexOf(x);
Q.prototype.attr=function(k,v){if(v===undefined)return this[0]?(k==='id'?this[0].id:this[0].attrs&&this[0].attrs[k]):undefined;this.xs.forEach(n=>{if(k==='id'){if(n.id)delete nodes[n.id];n.id=v;if(v)nodes[v]=n}else(n.attrs??={})[k]=v});return this};
Q.prototype.data=function(k,v){if(v===undefined)return this[0]?.dataValues?.[k];this.xs.forEach(n=>(n.dataValues??={})[k]=v);return this};
Q.prototype.first=function(){return new Q(this.xs.slice(0,1))};
Q.prototype.add=function(q){return new Q([...this.xs,...$(q).xs])};
Q.prototype.is=function(s){return this[0]?.tagName?.toLowerCase()===s};
Q.prototype.filter=function(s){return new Q(this.xs.filter(n=>s[0]==='.'?(n.classes||[]).includes(s.slice(1)):false))};
Q.prototype.parent=function(){return new Q(this.xs.map(n=>nodes[n.parent]))};
Q.prototype.append=function(q){for(var n of [...$(q).xs]){if(n.parent&&nodes[n.parent])nodes[n.parent].children=nodes[n.parent].children.filter(x=>x!==n);n.parent=this[0].id;this[0].children.push(n)}return this};
Q.prototype.remove=function(){this.xs.forEach(n=>{if(n.parent&&nodes[n.parent])nodes[n.parent].children=nodes[n.parent].children.filter(x=>x!==n);if(n.id)delete nodes[n.id]});return this};
Q.prototype.width=function(v){return v===undefined?num(this.css('width')):this.css('width',v)};
Q.prototype.height=function(v){return v===undefined?num(this.css('height')):this.css('height',v)};
Q.prototype.prop=function(k,v){if(v===undefined)return this[0]?.[k];this.xs.forEach(n=>n[k]=v);return this};
Q.prototype.removeClass=function(){return this};Q.prototype.not=function(){return this};Q.prototype.find=function(){return new Q([])};
A.prototype.getParents=function(deep,filters){var ids=[],n=nodes[this.id],wanted=Array.isArray(filters)?filters:[filters];while(n&&n.declaredParent){n=nodes[n.declaredParent];if(!n)break;if(wanted.includes('*')||wanted.includes(n.kind))ids.push(n.id)}return deep?[ids]:[ids[0]]};
${lines('axQuery.std.js',4,93)}
var _visibility=$ax.visibility,CONTAINER_SUFFIX='_container',CONTAINER_INNER='_container_inner',containerCount={};
var HIDDEN_CLASS='ax_default_hidden',UNPLACED_CLASS='ax_default_unplaced',SELECTED_ClASS='selected';
var _limboIds=_visibility.limboIds={};
$ax.repeater.applySuffixToElementId=(id,suffix)=>id+suffix;
$ax.repeater.getScriptIdFromElementId=id=>String(id).split('-')[0];
$ax.visibility.isScriptIdLimbo=id=>!!_limboIds[id];
$ax.visibility.isElementIdLimboOrInLimboContainer=id=>!!_limboIds[id];
$ax.style={generateState:()=>'',computeFullStyle:id=>nodes[id].author,SetWidgetSelected:(id,value)=>calls.push({kind:'selected',id,value})};
$ax.event.addSuppressedEvent=()=>{};$ax.event.blockEvent=()=>()=>{};
var _getCurrFocus=()=>'',_setCurrFocus=()=>{},_trapScrollLoc=()=>()=>{};
${lines('visibility.js',15,23)}
${lines('visibility.js',40,53)}
${lines('visibility.js',1123,1149)}
${lines('axQuery.js',304,406)}
A.prototype.getChildren=$ax.public.fn.getChildren;
${lines('axQuery.std.js',1299,1353)}
${lines('axQuery.std.js',1368,1371)}
var _fixedLocation=()=>({valid:false});
${lines('axQuery.std.js',1412,1435)}
${lines('axQuery.std.js',1438,1575)}
${lines('axQuery.std.js',1628,1647)}
for(var key of ['offsetBoundingRect','offsetBoundingRectToComponent','childrenBoundingRect','size','offsetLocation'])A.prototype[key]=$ax.public.fn[key];
${lines('visibility.js',1347,1414)}
${lines('visibility.js',822,1013)}
$ax.visibility.getRotatedAngle=id=>_rotatedIds[id];
$ax.visibility.setRotatedAngle=(id,v)=>_rotatedIds[id]=v;
${lines('repeater.js',1896,1930)}
${lines('action.js',1654,1732)}
$ax.deepCopy=x=>JSON.parse(JSON.stringify(x));$ax.eventCopy=x=>Object.assign({},x);
function currentState(){return {nodes:snapshot(),moved:JSON.parse(JSON.stringify(_movedIds)),resized:JSON.parse(JSON.stringify(_resizedIds)),resizing:JSON.parse(JSON.stringify(_resizingIds)),calls:calls,containerCount:containerCount,moveInfo:$ax.move.GetWidgetMoveInfo()}}
`;
export function layerHarness(code) { return retainedMotionHarness()(setup+code); }
const group=`add('g',{left:100,top:100,width:120,height:60},{type:'layer'},'base');add('a',{left:100,top:100,width:20,height:20},{type:'vectorShape'},'g');add('n',{left:140,top:100,width:80,height:60},{type:'layer'},'g');add('b',{left:140,top:100,width:40,height:30},{type:'vectorShape'},'n');add('h',{left:200,top:140,width:20,height:20,visibility:'hidden',display:'none'},{type:'vectorShape'},'n');`;
export function runLayerCases() {
  const results=[];
  function test(name,code,check){let observed;try{observed=layerHarness(code);check(observed);results.push({name,passed:true,observed})}catch(e){results.push({name,passed:false,observed,error:String(e.stack)})}}
  for(const includeLayers of [false,true])for(const includeHidden of [false,true]) test(`deep-members-${includeLayers}-${includeHidden}`,group+`return $ax.public.fn.getLayerChildrenDeep('g',${includeLayers},${includeHidden});`,r=>assert.deepEqual(r,['a',...(includeLayers?['n']:[]),'b',...(includeHidden?['h']:[])]));
  test('deep stops at panel and repeater',group+`add('p',{}, {type:'dynamicPanel'},'g');add('pc',{}, {type:'vectorShape'},'p');add('r',{}, {type:'repeater'},'g');add('rc',{}, {type:'vectorShape'},'r');return $ax.public.fn.getLayerChildrenDeep('g',true,true);`,r=>assert.deepEqual(r,['a','n','b','h','p','r']));
  test('hidden nested layer excludes entire branch by default',group+`nodes.n.style.visibility='hidden';return [$ax.public.fn.getLayerChildrenDeep('g',true),$ax.public.fn.getLayerChildrenDeep('g',true,true)];`,r=>assert.deepEqual(r,[['a'],['a','n','b','h']]));
  test('default getChildren keeps limbo; explicit ignore removes it',group+`_limboIds.a=true;return [$ax('#g').getChildren()[0].children,$ax('#g').getChildren(false,true)[0].children,$ax.public.fn.getLayerChildrenDeep('g',true,true)];`,r=>assert.deepEqual(r,[['a','n'],['n'],['a','n','b','h']]));
  test('annotations omitted and basic links flattened in original query',`add('g',{}, {type:'layer'},'base');add('g_ann',{},null,'g');var l=add('link',{},null,'g');l.tagName='A';l.classes=['basiclink'];add('a',{}, {type:'vectorShape'},'link');return $ax('#g').getChildren()[0].children;`,r=>assert.deepEqual(r,['a']));
  test('root layer stops at non-layer ancestor',group+`add('p',{}, {type:'dynamicPanel'},'n');add('s',{},null,'p','state');add('k',{}, {type:'layer'},'s');add('z',{}, {type:'vectorShape'},'k');return ['a','b','p','z','g'].map(id=>$ax.move.getRootLayer(id));`,r=>assert.deepEqual(r,['g','g','g','k','g']));
  test('layer coordinates do not add enclosing layer location',group+`nodes.g.author.location={x:700,y:800};return $ax('#b').offsetLocation();`,r=>assert.deepEqual(r,{x:140,y:100,left:140,top:100}));
  test('move cache includes hidden descendants but stops at panel content',group+`add('p',{left:180,top:160,width:30,height:30},{type:'dynamicPanel'},'g');add('pc',{left:10,top:10,width:5,height:5},{type:'vectorShape'},'p');_visibility.moveMovedLocation('g',10,15);return currentState();`,r=>{assert.deepEqual(r.moved.h,{left:210,top:155});assert.deepEqual(r.moved.p,{left:190,top:175});assert.equal(r.moved.pc,undefined)});
  test('layer push/pop temporary coordinate rebasing preserves children',group+`_visibility.pushContainer('g',false);var during={g:[$jobj('g_container').css('left'),$jobj('g_container').css('top')],a:[$jobj('a').css('left'),$jobj('a').css('top')],n:[$jobj('n_container').css('left'),$jobj('n_container').css('top')],b:[$jobj('b').css('left'),$jobj('b').css('top')]};_visibility.popContainer('g',false);return {during,after:currentState()};`,r=>{assert.deepEqual(r.during,{g:['100','100'],a:['0','0'],n:['40','0'],b:['0','0']});assert.equal(r.after.nodes.a.left,100);assert.equal(r.after.nodes.b.left,140);assert.equal(r.after.nodes.h.top,140);assert.equal(r.after.nodes.g_container,undefined)});
  test('layer temporary container is reference counted',group+`_visibility.pushContainer('g',false);_visibility.pushContainer('g',false);_visibility.popContainer('g',false);var middle={count:containerCount.g,exists:!!nodes.g_container,a:nodes.a.style.left};_visibility.popContainer('g',false);return {middle,after:currentState()};`,r=>{assert.deepEqual(r.middle,{count:1,exists:true,a:0});assert.equal(r.after.nodes.a.left,100)});
  for(const to of [false,true])test(`layer MoveWidget ${to?'To':'By'} actual CSS and cache`,group+`$ax.move.MoveWidget('g',${to?130:30},${to?120:20},{easing:'none'},${to},()=>calls.push({kind:'complete'}),false);return currentState();`,r=>{assert.equal(r.nodes.a.left,130);assert.equal(r.nodes.b.left,170);assert.equal(r.nodes.h.top,160);assert.deepEqual(r.moved.h,{left:230,top:160});assert.deepEqual(r.calls.filter(c=>c.kind==='event').map(c=>c.id),['g','a','n','b']);assert.equal(r.moveInfo.h,undefined);if(to)assert.equal(r.moveInfo.b.x,-10)});
  test('layer skipOnMove suppresses member moveInfo and all Move events',group+`$ax.move.MoveWidget('g',5,0,{easing:'none'},false,undefined,false,undefined,true);return currentState();`,r=>{assert.equal(r.nodes.a.left,105);assert.deepEqual(r.calls.filter(c=>c.kind==='event'),[]);assert.deepEqual(Object.keys(r.moveInfo),['g'])});
  test('layer zero Move through public moveBy only emits root event',group+`$ax.public.fn.moveBy.call($ax('#g'),0,0,{easing:'none'});return currentState();`,r=>assert.deepEqual(r.calls.filter(c=>c.kind==='event').map(c=>c.id),['g']));
  test('children bounds excludes hidden limbo fixed-panel and empty layer',group+`_limboIds.a=true;objects.b.fixedHorizontal='left';objects.b.type='dynamicPanel';add('e',{left:30,top:40,width:0,height:0},{type:'layer'},'g');return $ax('#g').childrenBoundingRect();`,r=>{assert.equal(r.x,140);assert.equal(r.y,100);assert.equal(r.width,80);assert.equal(r.height,60)});
  test('empty child list has zero bounds',`add('g',{}, {type:'layer'},'base');return $ax('#g').childrenBoundingRect();`,r=>assert.deepEqual(r.size,{width:0,height:0}));
  test('all excluded child list retains native sentinel negative dimensions',`add('g',{}, {type:'layer'},'base');add('a',{visibility:'hidden'}, {type:'vectorShape'},'g');return $ax('#g').childrenBoundingRect();`,r=>{assert.equal(r.x,99999);assert.equal(r.y,99999);assert.equal(r.width,-99999);assert.equal(r.height,-99999)});
  test('negative children extend union to origin due zero right/bottom seed',`add('g',{}, {type:'layer'},'base');add('a',{left:-40,top:-30,width:10,height:5},{type:'vectorShape'},'g');return $ax('#g').childrenBoundingRect();`,r=>assert.deepEqual(r.size,{width:40,height:30}));
  test('layer bounds cache update raises Resize before Move',`add('g',{left:0,top:0,width:10,height:10},{type:'layer'},'base');add('a',{left:100,top:80,width:20,height:30},{type:'vectorShape'},'g');var changed=_updateLayerRectCache('g'),again=_updateLayerRectCache('g');return {changed,again,state:currentState()};`,r=>{assert.equal(r.changed,true);assert.equal(r.again,false);assert.deepEqual(r.state.resized.g,{width:20,height:30});assert.deepEqual(r.state.moved.g,{left:100,top:80});assert.deepEqual(r.state.calls.filter(c=>c.kind==='event').map(c=>c.event),['onResize','onMove']);assert.equal(r.state.resizing.g.width,10)});
  test('bounds includes original rotated shadow geometry',`add('g',{}, {type:'layer'},'base');add('a',{left:100,top:100,width:200,height:100},{type:'vectorShape',rotation:90,outerShadow:{on:true,offsetX:10,offsetY:20,blurRadius:6}},'g');return $ax('#g').childrenBoundingRect();`,r=>{assert.ok(Math.abs(r.width-126)<1e-9);assert.ok(Math.abs(r.height-216)<1e-9);assert.ok(Math.abs(r.centerPoint.x-208)<1e-9);assert.ok(Math.abs(r.centerPoint.y-163)<1e-9)});
  const rect=`var r=_populateBoundingRect({left:100,top:100,width:200,height:100});add('a',{left:140,top:120,width:40,height:20},{type:TYPE},'base');var delta={x:0,y:0};`;
  for(const anchor of ['top left','top','top right','left','center','right','bottom left','bottom','bottom right']) {
    test(`resizable child scale anchor ${anchor}`,rect.replace('TYPE',"'vectorShape'")+`var css=_getCssForResizingLayerChild('a',${JSON.stringify(anchor)},r,.5,.6,delta);return {css,delta};`,r=>{assert.deepEqual(r.css,{width:60,height:32});assert.equal(r.delta.x,anchor.includes('left')?20:anchor.includes('right')?-80:-30);assert.equal(r.delta.y,anchor.includes('top')?12:anchor.includes('bottom')?-48:-18)});
    test(`nonresizable child displacement anchor ${anchor}`,rect.replace('TYPE',"'checkbox'")+`var css=_getCssForResizingLayerChild('a',${JSON.stringify(anchor)},r,.5,.6,delta);return {css,delta,resizable:$ax.public.fn.IsResizable('checkbox')};`,r=>{assert.equal(r.resizable,false);assert.deepEqual(r.css,{width:60,height:32});assert.equal(r.delta.x,anchor.includes('left')?40:anchor.includes('right')?-80:-30);assert.equal(r.delta.y,anchor.includes('top')?24:anchor.includes('bottom')?-48:-18)});
  }
  test('fixed child scales size without displacement',rect.replace('TYPE',"'dynamicPanel'")+`nodes.a.style.position='fixed';return {css:_getCssForResizingLayerChild('a','top left',r,.5,.6,delta),delta};`,r=>{assert.deepEqual(r.css,{width:60,height:32});assert.deepEqual(r.delta,{x:0,y:0})});
  test('percent-width child only scales height and vertical displacement',rect.replace('TYPE',"'dynamicPanel'")+`$ax.dynamicPanelManager.isPercentWidthPanel=()=>true;return {css:_getCssForResizingLayerChild('a','top left',r,.5,.6,delta),delta};`,r=>{assert.deepEqual(r.css,{height:32});assert.deepEqual(r.delta,{x:0,y:12})});
  return results;
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
  const results=runLayerCases(),summary={total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length};
  const report={capturedAt:new Date().toISOString(),kind:'exact retained source in NodeVM; in-memory DOM/query/geometry facades, no vendor GUI or browser',sources,ranges,dependency:{path:'research/runtime-transform-special-probe.mjs',sha256:hash(fs.readFileSync('research/runtime-transform-special-probe.mjs'))},script:{path:'research/native-layers-runtime-probe.mjs',sha256:hash(fs.readFileSync(import.meta.filename))},summary,results,limits:['Temporary DOM operations use an in-memory implementation, not real browser layout.','Style resolution and fixed-position reader are controlled facades.','Move events and fit/queue release are logged sinks; not complete reentrant queue lifecycle.','Resize helper output is computed by source; this initial run does not execute full public resize or action planner.']};
  const out=process.argv[2]||'research/native-layers-runtime-probes.json';assert.ok(!fs.existsSync(out),'Preserve '+out);fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({summary,failures:results.filter(x=>!x.passed)},null,2));if(summary.failed)process.exitCode=1;
}
