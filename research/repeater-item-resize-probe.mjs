// Research-only original-function probes. Does not initialize a vendor app/module.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const prior=JSON.parse(fs.readFileSync(new URL('./repeater-empty-evidence.json',import.meta.url),'utf8'));
const root=process.argv[2]??path.dirname(prior.files[0].path);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const source=new Map(), files=['repeater.js','doc.js'].map(name=>{
 const pin=prior.files.find(x=>x.name===name),p=path.join(root,name),bytes=fs.readFileSync(p);
 assert.equal(sha(bytes),pin.sha256,name);source.set(name,bytes.toString('utf8').split(/\r?\n/));
 return {name,path:p,bytes:bytes.length,sha256:pin.sha256};
});
const slice=(file,first,last)=>source.get(file).slice(first-1,last).join('\n');
const spans=[
 ['repeater.js',155,172,'initial-envelope'],['repeater.js',232,240,'initial-padding-and-border-origin'],['repeater.js',287,297,'initial-fixed-count-wrap'],
 ['repeater.js',225,245,'refresh-reset-before-load'],['repeater.js',329,375,'loaded-event-order'],['repeater.js',594,669,'Item-display-counts'],
 ['repeater.js',1080,1289,'reset-size-push-and-event'],['repeater.js',1483,1490,'row-element-id'],['repeater.js',1503,1519,'item-id-parser'],
 ['doc.js',328,543,'Item-and-This-providers'],
];
const excerpts=spans.map(([file,startLine,endLine,purpose])=>({file,startLine,endLine,purpose,text:slice(file,startLine,endLine)}));
const base=`
 var _repeaterManager={},css={},trace=[],resized={},moved={},repeaterIdToItemIds={},repeaterInfoCache={},repeaterToActiveDataSet={},repeaterToCurrentDataSet={},repeaterToPageInfo={};
 var eventHook=null,_getParentElement=id=>id,obj={id:'r',type:'repeater',repeaterPropMap:{}};
 var $obj=id=>obj;
 var $jobj=id=>({length:css[id]?1:0,css:function(k,v){if(typeof k==='object'){Object.assign(css[id],k);return;}if(v===undefined)return css[id]?.[k]??0;css[id][k]=v;},attr:()=>id,data:()=>undefined});
 function $ax(selector){var id=selector.slice(1);return {offsetBoundingRect:()=>({left:css[id]?.left??0,top:css[id]?.top??0,width:css[id]?.width,height:css[id]?.height})};}
 Object.assign($ax,{repeater:_repeaterManager,getNumFromPx:v=>Number.parseFloat(v)||0,adaptive:{currentViewId:''},
  public:{fn:{IsRepeater:t=>t==='repeater',IsLayer:()=>false,IsDynamicPanel:()=>false}},getParentRepeaterFromScriptId:()=> 'r',
  visibility:{setResizedSize:(id,width,height)=>resized[id]={width,height},setMovedLocation:(id,x,y)=>moved[id]={x,y}},
  dynamicPanelManager:{fitParentPanel:id=>trace.push({kind:'fit',id,root:{width:css.r.width,height:css.r.height}})},
  event:{raiseSyntheticEvent:(id,event)=>{
    var thiswidget=_getWidgetInfo(id),item=_getItemInfo(id);
    var snap={kind:'event',id,event,layout:snapshot(),thisSize:{width:thiswidget.width(),height:thiswidget.height()},item:{valid:item.valid,index:item.index,first:item.isfirst,last:item.islast,even:item.iseven,odd:item.isodd,marked:item.ismarked,visible:item.isvisible}};
    trace.push(snap);if(eventHook)eventHook(id,event);
  }}});
 _repeaterManager.isEditItem=(r,id)=>Number(id)===3;
 var _getAdaptiveProp=(props,key)=>props[key];
 function snapshot(){return {root:[css.r.width,css.r.height],rows:(repeaterIdToItemIds.r??[]).map(id=>{var box=css['r-'+id];return [id,box.left,box.top,box.width,box.height];})};}
`;
const code=[base,slice('repeater.js',594,669),slice('repeater.js',1080,1289),slice('repeater.js',1483,1490),slice('repeater.js',1503,1519),slice('doc.js',328,543),`
 function initialize(f){
  var repeaterId='r',orderedIds=f.ids??[1,2,3,4,5],start=f.bounds?.[0]??0,end=f.bounds?.[1]??orderedIds.length;
  var vertical=f.vertical??true,wrap=f.wrap??-1,offset={width:f.width??100,height:f.height??20};
  var viewId='',propMap=obj.repeaterPropMap={horizontalSpacing:f.gapX??8,verticalSpacing:f.gapY??4,paddingLeft:3,paddingTop:5,paddingRight:7,paddingBottom:11};
  css={r:{width:0,height:0,'border-left-width':f.border?.[0]??0,'border-top-width':f.border?.[1]??0,'border-right-width':f.border?.[2]??0,'border-bottom-width':f.border?.[3]??0,'box-sizing':f.boxSizing??'content-box'}};
  var repeaterObj=$jobj(repeaterId),pos;
  repeaterToActiveDataSet.r=orderedIds.map(index=>({index}));repeaterToCurrentDataSet.r=[...repeaterToActiveDataSet.r];repeaterToPageInfo.r=f.page??{noLimit:true};
  repeaterIdToItemIds.r=orderedIds.slice(start,end);
  ${slice('repeater.js',155,172)}
  ${slice('repeater.js',232,240)}
  for(pos=start;pos<end;pos++){
    css['r-'+orderedIds[pos]]={left,top,width:offset.width,height:offset.height};
    ${slice('repeater.js',287,297)}
  }
  repeaterObj.css(repeaterSize);resetItemSizes('r',offset,[start,end],orderedIds,vertical,wrap);
  trace=[];resized={};moved={};eventHook=null;
 }
`].join('\n');
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});vm.runInContext(code,context,{timeout:1000});
const run=body=>JSON.parse(vm.runInContext(`JSON.stringify((function(){${body}})())`,context,{timeout:1000}));
const outcomes=[];
function check(name,fixture,actions,expected){
 const actual=run(`initialize(${JSON.stringify(fixture)});${actions};return {layout:snapshot(),events:trace.filter(x=>x.kind==='event')};`);
 assert.deepEqual(actual.layout,expected.layout,name);assert.equal(actual.events.length,expected.events,name);
 outcomes.push({name,fixture,actions,expected,actual,pass:true});return actual;
}
const layout=(root,rows)=>({root,rows});
const set=(id,w,h)=>`_repeaterManager.setItemSize('r',${id},${w},${h})`;
// Literal expected matrices, independently calculated from simple geometry.
check('vertical-nowrap-grow-primary',{ids:[1,2,3]},set(1,100,35),{layout:layout([110,99],[[1,3,5,100,35],[2,3,44,100,20],[3,3,68,100,20]]),events:1});
check('vertical-nowrap-grow-secondary',{ids:[1,2,3]},set(2,150,20),{layout:layout([160,84],[[1,3,5,100,20],[2,3,29,150,20],[3,3,53,100,20]]),events:1});
check('vertical-nowrap-secondary-shrink-not-largest',{ids:[1,2,3]},set(2,60,20),{layout:layout([110,84],[[1,3,5,100,20],[2,3,29,60,20],[3,3,53,100,20]]),events:1});
check('vertical-nowrap-largest-shrink-to-other-max',{ids:[1,2,3]},set(2,150,20)+';'+set(2,60,20),{layout:layout([110,84],[[1,3,5,100,20],[2,3,29,60,20],[3,3,53,100,20]]),events:2});
check('vertical-nowrap-zero-item-keeps-gap',{ids:[1,2,3]},set(1,0,0),{layout:layout([110,64],[[1,3,5,0,0],[2,3,9,100,20],[3,3,33,100,20]]),events:1});
check('horizontal-nowrap-grow-primary',{ids:[1,2,3],vertical:false},set(1,130,20),{layout:layout([356,36],[[1,3,5,130,20],[2,141,5,100,20],[3,249,5,100,20]]),events:1});
check('horizontal-nowrap-grow-secondary',{ids:[1,2,3],vertical:false},set(2,100,45),{layout:layout([326,61],[[1,3,5,100,20],[2,111,5,100,45],[3,219,5,100,20]]),events:1});
check('horizontal-nowrap-zero-primary-keeps-gap',{ids:[1,2,3],vertical:false},set(2,0,20),{layout:layout([226,36],[[1,3,5,100,20],[2,111,5,0,20],[3,119,5,100,20]]),events:1});
check('wrap-count-two-vertical-initial',{wrap:2},'',{layout:layout([326,60],[[1,3,5,100,20],[2,3,29,100,20],[3,111,5,100,20],[4,111,29,100,20],[5,219,5,100,20]]),events:0});
check('wrap-count-two-horizontal-initial',{wrap:2,vertical:false},'',{layout:layout([218,84],[[1,3,5,100,20],[2,111,5,100,20],[3,3,29,100,20],[4,111,29,100,20],[5,3,53,100,20]]),events:0});
check('vertical-wrap-primary-growth-pushes-only-same-column',{wrap:2},set(1,100,35),{layout:layout([326,75],[[1,3,5,100,35],[2,3,44,100,20],[3,111,5,100,20],[4,111,29,100,20],[5,219,5,100,20]]),events:1});
check('vertical-wrap-primary-shrink-other-column-holds-envelope',{wrap:2},set(1,100,10),{layout:layout([326,60],[[1,3,5,100,10],[2,3,19,100,20],[3,111,5,100,20],[4,111,29,100,20],[5,219,5,100,20]]),events:1});
check('vertical-wrap-partial-column-grows-below-then-above-max',{wrap:2},set(5,100,35)+';'+set(5,100,50),{layout:layout([326,66],[[1,3,5,100,20],[2,3,29,100,20],[3,111,5,100,20],[4,111,29,100,20],[5,219,5,100,50]]),events:2});
check('vertical-wrap-secondary-moves-whole-later-columns',{wrap:2},set(1,150,20),{layout:layout([376,60],[[1,3,5,150,20],[2,3,29,100,20],[3,161,5,100,20],[4,161,29,100,20],[5,269,5,100,20]]),events:1});
check('vertical-wrap-secondary-nonmax-update-still-setItemSize-event',{wrap:2},set(1,150,20)+';'+set(2,120,20),{layout:layout([376,60],[[1,3,5,150,20],[2,3,29,120,20],[3,161,5,100,20],[4,161,29,100,20],[5,269,5,100,20]]),events:2});
check('vertical-wrap-shrink-column-restores-other-column-offsets',{wrap:2},set(1,150,20)+';'+set(1,90,20),{layout:layout([326,60],[[1,3,5,90,20],[2,3,29,100,20],[3,111,5,100,20],[4,111,29,100,20],[5,219,5,100,20]]),events:2});
check('horizontal-wrap-primary-growth-pushes-only-same-row',{wrap:2,vertical:false},set(1,130,20),{layout:layout([248,84],[[1,3,5,130,20],[2,141,5,100,20],[3,3,29,100,20],[4,111,29,100,20],[5,3,53,100,20]]),events:1});
check('horizontal-wrap-secondary-moves-whole-later-rows',{wrap:2,vertical:false},set(1,100,35),{layout:layout([218,99],[[1,3,5,100,35],[2,111,5,100,20],[3,3,44,100,20],[4,111,44,100,20],[5,3,68,100,20]]),events:1});
check('horizontal-wrap-primary-shrink-other-row-holds-envelope',{wrap:2,vertical:false},set(1,40,20),{layout:layout([218,84],[[1,3,5,40,20],[2,51,5,100,20],[3,3,29,100,20],[4,111,29,100,20],[5,3,53,100,20]]),events:1});
check('wrap-one-is-fixed-count-no-pixel-reflow',{wrap:1},set(1,500,60),{layout:layout([942,76],[[1,3,5,500,60],[2,511,5,100,20],[3,619,5,100,20],[4,727,5,100,20],[5,835,5,100,20]]),events:1});
check('wrap-above-count-single-group-primary-envelope',{ids:[1,2,3],wrap:10},set(2,100,40),{layout:layout([110,104],[[1,3,5,100,20],[2,3,29,100,40],[3,3,73,100,20]]),events:1});
check('zero-size-single-item-retains-only-padding',{ids:[1]},set(1,0,0),{layout:layout([10,16],[[1,3,5,0,0]]),events:1});
check('same-size-after-change-does-not-fire-again',{ids:[1]},set(1,120,30)+';'+set(1,120,30),{layout:layout([130,46],[[1,3,5,120,30]]),events:1});
check('negative-dimensions-are-not-clamped-by-native-function',{ids:[1]},set(1,-5,-7),{layout:layout([5,9],[[1,3,5,-5,-7]]),events:1});
const eventCase=check('paged-reordered-ids-event-context-and-two-axis-state',{ids:[9,3,6,1],bounds:[2,4],page:{noLimit:false,itemsPerPage:2,currPage:2}},set(6,120,30),{layout:layout([130,70],[[6,3,5,120,30],[1,3,39,100,20]]),events:1});
assert.deepEqual(eventCase.events[0].thisSize,{width:120,height:30});
assert.deepEqual(eventCase.events[0].item,{valid:true,index:1,first:true,last:false,even:false,odd:true,marked:false,visible:true});
check('filtered-order-and-marked-row-metadata',{ids:[3,9,1]},set(3,100,35),{layout:layout([110,99],[[3,3,5,100,35],[9,3,44,100,20],[1,3,68,100,20]]),events:1});
function extra(name,body,expected){const actual=run(body);assert.deepEqual(actual,expected,name);outcomes.push({name,actual,pass:true});}
extra('refresh-reset-forgets-variable-sizes-and-uses-new-visible-order',`
 initialize({ids:[1,2,3]});${set(1,150,35)};initialize({ids:[3,1]});return {layout:snapshot(),map:repeaterSizes.r.sizes,events:trace};
`,{layout:layout([110,60],[[3,3,5,100,20],[1,3,29,100,20]]),map:[{itemId:3,width:100,height:20},{itemId:1,width:100,height:20}],events:[]});
extra('reset-can-read-current-DOM-sizes-when-offset-missing',`
 initialize({ids:[1,2]});css['r-1'].width=130;css['r-2'].height=27;resetItemSizes('r',undefined,[0,2],[1,2],true,-1);return repeaterSizes.r.sizes;
`,[{itemId:1,width:130,height:20},{itemId:2,width:100,height:27}]);
extra('direct-push-wrapped-nonmax-change-skips-event',`
 initialize({wrap:2});${set(1,150,20)};trace=[];_repeaterManager.pushItems('r',2,20,false,false);return {row:repeaterSizes.r.sizesMap[2],events:trace.filter(x=>x.kind==='event').length};
`,{row:{itemId:2,width:120,height:20},events:0});
extra('direct-push-effective-change-fires-after-position-update',`
 initialize({ids:[1,2]});_repeaterManager.pushItems('r',1,7,true,false);return {layout:snapshot(),events:trace.filter(x=>x.kind==='event').map(x=>x.layout)};
`,{layout:layout([110,67],[[1,3,5,100,27],[2,3,36,100,20]]),events:[layout([110,67],[[1,3,5,100,27],[2,3,36,100,20]])]});
extra('direct-push-nowrap-nonmax-change-still-fires',`
 initialize({ids:[1,2]});_repeaterManager.pushItems('r',1,-40,false,false);return {layout:snapshot(),events:trace.filter(x=>x.kind==='event').length};
`,{layout:layout([110,60],[[1,3,5,60,20],[2,3,29,100,20]]),events:1});
extra('parent-fit-is-before-event-and-nested-resize-events-are-synchronous',`
 initialize({ids:[1,2]});var once=false;eventHook=()=>{if(!once){once=true;${set(1,130,40)}}};${set(1,120,30)};
 return {events:trace.filter(x=>x.kind==='event').map(x=>x.thisSize),order:trace.map(x=>x.kind),final:snapshot()};
`,{events:[{width:120,height:30},{width:130,height:40}],order:['fit','fit','event','fit','fit','event'],final:layout([140,80],[[1,3,5,130,40],[2,3,49,100,20]])});
extra('non-rendered-row-has-no-size-entry',`
 initialize({ids:[9,3,6,1],bounds:[2,4]});try{${set(3,100,30)};return false;}catch{return true;}
`,true);
extra('nonzero-border-literal-formula-adds-primary-border-each-root-update',`
 initialize({ids:[1],border:[2,3,5,7]});${set(1,120,30)};return {layout:snapshot(),fits:trace.filter(x=>x.kind==='fit').map(x=>x.root)};
`,{layout:layout([140,56],[[1,3,5,120,30]]),fits:[{width:140,height:36},{width:140,height:56}]});
extra('border-box-initial-origin-subtracts-top-left-border',`
 initialize({ids:[1,2],border:[2,3,5,7],boxSizing:'border-box'});return snapshot();
`,layout([110,60],[[1,1,2,100,20],[2,1,26,100,20]]));
extra('empty-no-wrap-vertical-envelope-is-not-zero',`initialize({ids:[]});return snapshot();`,layout([110,12],[]));
extra('empty-no-wrap-horizontal-envelope-is-not-zero',`initialize({ids:[],vertical:false});return snapshot();`,layout([2,36],[]));
extra('empty-wrapped-envelope-subtracts-both-gaps',`initialize({ids:[],wrap:2});return snapshot();`,layout([2,12],[]));
check('vertical-wrap-largest-primary-shrinks-below-competing-column',{wrap:2},set(1,100,80)+';'+set(3,100,45)+';'+set(1,100,10),{layout:layout([326,85],[[1,3,5,100,10],[2,3,19,100,20],[3,111,5,100,45],[4,111,54,100,20],[5,219,5,100,20]]),events:3});
// Independent full recomputation, rather than reproducing native delta/push branches.
function recompute(f,sizes){
 const ids=f.ids,n=f.wrap===-1?ids.length:f.wrap,groups=[];
 for(let i=0;i<ids.length;i+=n)groups.push(ids.slice(i,i+n));
 const mainGap=f.vertical?f.gapY:f.gapX,crossGap=f.vertical?f.gapX:f.gapY;
 const main=id=>sizes[id][f.vertical?1:0],cross=id=>sizes[id][f.vertical?0:1];
 let crossPosition=0,maxMain=0;const rows=[];
 for(const group of groups){let mainPosition=0,maxCross=0;
  for(const id of group){rows.push([id,3+(f.vertical?crossPosition:mainPosition),5+(f.vertical?mainPosition:crossPosition),...sizes[id]]);mainPosition+=main(id)+mainGap;maxCross=Math.max(maxCross,cross(id));}
  maxMain=Math.max(maxMain,mainPosition-mainGap);crossPosition+=maxCross+crossGap;
 }
 const crossExtent=crossPosition-crossGap;return layout(f.vertical?[10+crossExtent,16+maxMain]:[10+maxMain,16+crossExtent],rows);
}
let seed=0x4150cafe;const random=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};
const differential=[];
for(let caseIndex=0;caseIndex<80;caseIndex++){
 const fixture={ids:Array.from({length:1+random(9)},(_,i)=>i+1),vertical:caseIndex%2===0,wrap:[-1,1,2,3,12][caseIndex%5],gapX:random(13),gapY:random(9)};
 const sizes=Object.fromEntries(fixture.ids.map(id=>[id,[100,20]]));run(`initialize(${JSON.stringify(fixture)});return true;`);
 const operations=[];
 for(let i=0;i<16;i++){
  const id=fixture.ids[random(fixture.ids.length)],w=random(161),h=random(61);sizes[id]=[w,h];
  const actual=run(`${set(id,w,h)};return snapshot();`),expected=recompute(fixture,sizes);
  assert.deepEqual(actual,expected,`recomputation ${caseIndex}/${i}`);operations.push({id,width:w,height:h});
 }
 differential.push({fixture,operations,final:recompute(fixture,sizes)});
}
outcomes.push({name:'independent-full-recomputation-matches-80-fixtures-1280-resizes',pass:true,seed:'0x4150cafe',cases:differential.length,operations:differential.length*16,domain:'nonempty, nonnegative width/height/gaps, zero borders, fixed count wrap, uniform initial offset matches DOM box',matrices:differential});
const evidence={version:1,target:'Axure RP 11.0.0.4150',files,excerpts,probe:{count:outcomes.length,outcomes,limitations:[
 'CSS storage is a numeric mock. Initial envelope/origin/wrap increments and runtime size functions are exact pinned excerpts, but actual DOM cloning/jQuery box-model conversion is not executed.',
 'Item/This source functions execute; This geometry delegates to an explicit CSS rectangle mock, not browser layout.',
 'Negative dimensions and nonzero borders document raw function results only; CSS used values, parent-fit callbacks and legal UI authored ranges require separate evidence.',
 'Callbacks synchronously record or initiate one configured resize. Full case conditions/menus/Wait execution is outside this layout probe.'
]}};
const output=JSON.stringify(evidence,null,2)+'\n';fs.writeFileSync(new URL('./repeater-item-resize-evidence.json',import.meta.url),output);
console.log(JSON.stringify({pass:true,probes:outcomes.length,files:files.length,excerpts:excerpts.length,sha256:sha(output)}));
