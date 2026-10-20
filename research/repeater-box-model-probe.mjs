// Research-only: real Edge DOM + distribution jQuery + pinned narrow native functions.
// This does not load the full Axure runtime/app or publish vendor code with the product.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const prior = JSON.parse(fs.readFileSync(new URL('./repeater-item-resize-evidence.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const flags = new Map(args.filter(arg=>arg.startsWith('--')).map(arg=>{const [key,...value]=arg.slice(2).split('=');return [key,value.join('=')||'true'];}));
const root = args.find(arg=>!arg.startsWith('--')) ?? path.dirname(prior.files[0].path);
const dpr=Number(flags.get('dpr')??1),scaleMode=flags.get('scale-mode')??'emulated';
assert.ok(Number.isFinite(dpr)&&dpr>0&&dpr<=4,'DPR must be >0 and <=4');
assert.ok(['emulated','host'].includes(scaleMode),'scale-mode must be emulated or host');
const scaleStudy=flags.has('dpr')||flags.has('scale-mode');
const resources = path.resolve(root, '../..');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const pins = [
  ['repeater.js', path.join(root, 'repeater.js'), 'd4c44f2392e126263bdfec6e8c0392f4e186f30e26da9aeeecf8bab2e0b91b2b'],
  ['jquery-3.7.1.min.js', path.join(resources, 'scripts/jquery-3.7.1.min.js'), '8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85'],
  ['axure_rp_page.css', path.join(resources, 'css/axure_rp_page.css'), '595bfcd275dc80732aeecbb8365067ccecc4f0277df316ea47656816939ece4a'],
  ['default.css', path.join(resources, 'css/default.css'), 'c386bd6c672653bd7dc596ef3f0349d272b8451e47c5a5cd295f60e3d31677de'],
  ['reset.css', path.join(resources, 'css/reset.css'), '579b70dd71cfaca21c03a770a89fb182413a3228bdff0febcb0513f112b2cb59'],
];
const texts = new Map();
const files = pins.map(([name, file, pin]) => {
  const bytes = fs.readFileSync(file); assert.equal(sha(bytes), pin, name);
  texts.set(name, bytes.toString('utf8')); return { name, path: file, bytes: bytes.length, sha256: pin };
});
const lines = texts.get('repeater.js').split(/\r?\n/);
const slice = (first, last) => lines.slice(first - 1, last).join('\n');
const spans = [
  [155,172,'initial-envelope-and-raw-cache'], [225,245,'refresh-and-border-origin'],
  [270,300,'absolute-row-css-and-final-root-size'], [1080,1289,'size-cache-push-and-root-update'],
  [1483,1490,'row-element-id'],
];
const excerpts = spans.map(([startLine, endLine, purpose]) => ({ file: 'repeater.js', startLine, endLine, purpose, text: slice(startLine,endLine) }));
const browser = await chromium.launch({ channel: 'msedge', headless: true, ...(scaleMode==='host'?{args:[`--force-device-scale-factor=${dpr}`]}:{}) });
const context = await browser.newContext(scaleMode==='host'?{viewport:null}:{ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: dpr });
let blockedRequests = 0;
await context.route('**/*', route => { blockedRequests++; return route.abort(); });
const page = await context.newPage();
const errors = []; page.on('pageerror', error => errors.push(String(error)));
await page.setContent('<!doctype html><html><head></head><body></body></html>');
await page.addStyleTag({ content: texts.get('reset.css') + '\n' + texts.get('axure_rp_page.css') });
await page.addScriptTag({ content: texts.get('jquery-3.7.1.min.js') });
const code = `(() => {
 var _repeaterManager={},repeaterIdToItemIds={},trace=[],resized={},moved={},obj={repeaterPropMap:{}},rawEnvelope;
 var $jobj=id=>jQuery(document.getElementById(id)), $obj=id=>obj;
 var $ax={getNumFromPx:v=>parseFloat(v),adaptive:{currentViewId:''},
  visibility:{setResizedSize:(id,width,height)=>resized[id]={width,height},setMovedLocation:(id,x,y)=>moved[id]={x,y}},
  dynamicPanelManager:{fitParentPanel:id=>trace.push({kind:'fit',id,root:snapshot().root})},
  event:{raiseSyntheticEvent:(id,event)=>trace.push({kind:'event',id,event,root:snapshot().root})}};
 var _getAdaptiveProp=(map,key)=>map[key];
 ${slice(1080,1289)}
 ${slice(1483,1490)}
 function rect(el) {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}
 function measure(el) {
   const jq=jQuery(el),cs=getComputedStyle(el);
   return {inline:[el.style.width,el.style.height],computed:[cs.width,cs.height],jqueryCss:[jq.css('width'),jq.css('height')],
    jqueryContent:[jq.width(),jq.height()],jqueryOuter:[jq.outerWidth(),jq.outerHeight()],offset:[el.offsetWidth,el.offsetHeight],
    client:[el.clientWidth,el.clientHeight],rect:rect(el),boxSizing:cs.boxSizing,padding:[cs.paddingTop,cs.paddingRight,cs.paddingBottom,cs.paddingLeft],
    border:[cs.borderTopWidth,cs.borderRightWidth,cs.borderBottomWidth,cs.borderLeftWidth],
    computedXY:[cs.left,cs.top],inlineXY:[el.style.left,el.style.top]};
 }
 function snapshot(){
  const root=document.getElementById('r'),rr=rect(root);
  return {root:measure(root),rawEnvelope,cache:JSON.parse(JSON.stringify(resized)),rows:(repeaterIdToItemIds.r??[]).map(id=>{
   const e=document.getElementById('r-'+id),r=rect(e); return {id,cssXY:[parseFloat(e.style.left),parseFloat(e.style.top)],outerRelative:[r.x-rr.x,r.y-rr.y],...measure(e)};
  })};
 }
 function initialize(f, preserveRoot=false) {
  if(!preserveRoot)document.body.innerHTML='<div id="r"></div>';
  else document.getElementById('r').replaceChildren();
  const border=f.border??[3,5,7,2],physicalPadding=f.physicalPadding??[0,0,0,0],padding=f.padding??[5,7,11,3];
  const element=document.getElementById('r');
  if(!preserveRoot) {
   Object.assign(element.style,{position:'absolute',left:'40px',top:'40px',margin:'0',borderStyle:f.borderStyle??'solid',borderColor:'black',
    borderWidth:border.map(v=>v+'px').join(' '),padding:physicalPadding.map(v=>v+'px').join(' ')});
   if(f.boxSizing)element.style.boxSizing=f.boxSizing;
  }
  var repeaterId='r',orderedIds=f.ids??[1,2,3,4,5],start=0,end=orderedIds.length,vertical=f.vertical??true,wrap=f.wrap??-1;
  var offset={width:f.width??100,height:f.height??20},viewId='',propMap=obj.repeaterPropMap={horizontalSpacing:f.gapX??8,verticalSpacing:f.gapY??4,
   paddingTop:padding[0],paddingRight:padding[1],paddingBottom:padding[2],paddingLeft:padding[3]};
  var repeaterObj=$jobj(repeaterId);trace=[];resized={};moved={};repeaterIdToItemIds.r=orderedIds;
  ${slice(155,172)}
  rawEnvelope={...repeaterSize};
  ${slice(232,240)}
  for(var pos=start;pos<end;pos++) {
   var itemId=orderedIds[pos],copy=jQuery('<div>').attr('id','r-'+itemId);
   copy.css({position:'absolute',top:top+'px',left:left+'px',width:offset.width+'px',height:offset.height+'px'});
   repeaterObj.append(copy);$ax.visibility.setResizedSize('r-'+itemId,offset.width,offset.height);$ax.visibility.setMovedLocation('r-'+itemId,left,top);
   ${slice(287,297)}
  }
  repeaterObj.css(repeaterSize);resetItemSizes('r',offset,[start,end],orderedIds,vertical,wrap);
  return snapshot();
 }
 window.__rpBoxResearch={initialize,snapshot,refresh:f=>initialize(f,true),resize:(id,w,h)=>{const changed=_repeaterManager.setItemSize('r',id,w,h);return {changed,snapshot:snapshot(),trace:JSON.parse(JSON.stringify(trace))};},
  cssControl:(method,w,h)=>{const el=document.getElementById('r'); if(method==='jquery')jQuery(el).css({width:w,height:h});else {el.style.width=w+'px';el.style.height=h+'px';}return snapshot();},
  clearTrace:()=>trace=[]};
})();`;
await page.addScriptTag({ content: code });
const outcomes = [];
const init = f => page.evaluate(f => window.__rpBoxResearch.initialize(f), f);
const refresh = f => page.evaluate(f => window.__rpBoxResearch.refresh(f), f);
const resize = (id,w,h) => page.evaluate(a => window.__rpBoxResearch.resize(...a), [id,w,h]);
const summarize = s => ({css:s.root.jqueryCss.map(parseFloat),inline:s.root.inline.map(parseFloat),outer:[s.root.rect.width,s.root.rect.height],
 content:s.root.jqueryContent,rowXY:s.rows.map(r=>r.outerRelative),rowCssXY:s.rows.map(r=>r.cssXY),cache:s.cache.r,raw:s.rawEnvelope});
function test(name, fixture, actual, expected) {
 assert.deepEqual(actual, expected, name);outcomes.push({name,fixture,expected,actual,pass:true});
}
const border=[3,5,7,2]; // top,right,bottom,left; Bx=7, By=10.
try {
 if(scaleStudy) {
  const {runDprProbes}=await import('./repeater-box-model-dpr-probes.mjs');
  outcomes.push(...await runDprProbes({page,init,refresh,resize,dpr,scaleMode}));
 } else {
 const ordinary=await init({ids:[1]});
 test('distribution-resource-css-alone-does-not-select-border-box',{css:['reset.css','axure_rp_page.css']},ordinary.root.boxSizing,'content-box');
 for(const boxSizing of ['content-box','border-box'])for(const vertical of [true,false])for(const wrap of [-1,2]){
  const fixture={boxSizing,vertical,wrap,border},first=await init(fixture),s=summarize(first);
  const raw=vertical?(wrap===-1?[110,132]:[326,60]):(wrap===-1?[542,36]:[218,84]);
  const plus=boxSizing==='content-box'?[7,10]:[0,0];
  const origins=boxSizing==='content-box'?[5,8]:[3,5];
  test(boxSizing+'-'+(vertical?'vertical':'horizontal')+'-'+wrap+'-initial',fixture,
   {raw:s.raw,css:s.css,outer:s.outer,first:s.rowXY[0],firstCss:s.rowCssXY[0]},
   {raw:{width:raw[0],height:raw[1]},css:raw,outer:raw.map((v,i)=>v+plus[i]),first:origins,firstCss:boxSizing==='content-box'?[3,5]:[1,2]});
  // Native root updates add the primary-direction border sum on *either* axis.
  // Row1 raises the envelope on each axis, then reversing shrinks to baseline geometry;
  // stored root gets four border additions, which refresh removes.
  const amount=vertical?10:7;
  const steps=[];
  steps.push(await resize(1,130,20));steps.push(await resize(1,130,35));
  steps.push(await resize(1,100,35));steps.push(await resize(1,100,20));
  const final=summarize(steps.at(-1).snapshot);
  const expectedCss=[raw[0]+2*amount,raw[1]+2*amount];
  test(boxSizing+'-'+(vertical?'vertical':'horizontal')+'-'+wrap+'-xy-grow-shrink-drift',fixture,
   {css:final.css,outer:final.outer,rows:final.rowXY,events:steps.at(-1).trace.filter(e=>e.kind==='event').length},
   {css:expectedCss,outer:expectedCss.map((v,i)=>v+plus[i]),rows:s.rowXY,events:4});
  const noOp=await resize(1,100,20);
  assert.equal(noOp.changed,false);assert.equal(noOp.trace.filter(e=>e.kind==='event').length,4);
  const refreshed=summarize(await refresh(fixture));assert.deepEqual(refreshed,s,fixture.boxSizing+' refresh');
  outcomes.push({name:boxSizing+'-'+(vertical?'vertical':'horizontal')+'-'+wrap+'-no-op-and-refresh-reset',fixture,pass:true,
   initial:first,steps,afterSameSize:noOp,afterRefresh:refreshed});
 }
 for(const boxSizing of ['content-box','border-box']) {
  const fixture={ids:[1],boxSizing,border,physicalPadding:[13,17,19,23]},snap=await init(fixture),s=summarize(snap);
  test(boxSizing+'-css-padding-is-independent-of-layout-padding',fixture,
   {css:s.css,outer:s.outer,content:s.content,origin:s.rowXY[0]},boxSizing==='content-box'
    ?{css:[110,36],outer:[157,78],content:[110,36],origin:[5,8]}
    :{css:[110,42],outer:[110,42],content:[63,0],origin:[3,5]});
 }
 for(const boxSizing of ['content-box','border-box'])for(const vertical of [true,false])for(const wrap of [-1,2]) {
  const fixture={ids:[],boxSizing,vertical,wrap,border,padding:[1,1,1,1],gapX:8,gapY:4},snap=await init(fixture),s=summarize(snap);
  const raw=vertical?(wrap===-1?[102,-2]:[-6,-2]):(wrap===-1?[-6,22]:[-6,-2]);
  const inline=raw.map(v=>Math.max(0,v));
  const css=boxSizing==='content-box'?inline:[Math.max(inline[0],7),Math.max(inline[1],10)];
  const outer=boxSizing==='content-box'?[inline[0]+7,inline[1]+10]:css;
  test(boxSizing+'-'+(vertical?'vertical':'horizontal')+'-'+wrap+'-empty-negative-set',fixture,
   {raw:s.raw,inline:s.inline,css:s.css,outer:s.outer,cache:s.cache,rows:snap.rows.length},
   {raw:{width:raw[0],height:raw[1]},inline,css,outer,cache:{width:raw[0],height:raw[1]},rows:0});
 }
 for(const boxSizing of ['content-box','border-box']) {
  const fixture={ids:[],boxSizing,wrap:2,border,padding:[1,1,1,1],gapX:8,gapY:4,physicalPadding:[13,17,19,23]};
  const s=summarize(await init(fixture));
  test(boxSizing+'-empty-negative-with-physical-css-padding',fixture,{inline:s.inline,css:s.css,outer:s.outer},
    {inline:[0,0],css:boxSizing==='content-box'?[0,0]:[47,42],outer:[47,42]});
 }
 for(const boxSizing of ['content-box','border-box']) {
  const fixture={ids:[1],boxSizing,border};await init(fixture);
  const direct=await page.evaluate(()=>window.__rpBoxResearch.cssControl('direct',-6,-2));
  const jquery=await page.evaluate(()=>window.__rpBoxResearch.cssControl('jquery',-6,-2));
  test(boxSizing+'-negative-native-style-rejected-but-jquery-clamps',fixture,
   {direct:direct.root.inline,jquery:jquery.root.inline},{direct:['110px','36px'],jquery:['0px','0px']});
 }
 // Zero nonempty dimensions: native sizes remain 0 but the root has a border minimum.
 for(const boxSizing of ['content-box','border-box']) {
  const fixture={ids:[1],boxSizing,border,padding:[0,0,0,0]};await init(fixture);
  const zero=await resize(1,0,0),s=summarize(zero.snapshot);
  test(boxSizing+'-zero-item-minimum-and-two-update-border-addition',fixture,
   {css:s.css,outer:s.outer,row:zero.snapshot.rows[0].jqueryContent},
   {css:[10,10],outer:boxSizing==='content-box'?[17,20]:[10,10],row:[0,0]});
 }
 for(const boxSizing of ['content-box','border-box'])for(const vertical of [true,false]) {
  const fixture={ids:[1,2,3],boxSizing,vertical,wrap:2,border,padding:[1,1,1,1],gapX:8,gapY:4};
  const original=summarize(await init(fixture));await resize(1,130,35);
  const empty=await refresh({...fixture,ids:[]}),emptySummary=summarize(empty);
  const restore=summarize(await refresh({...fixture,ids:[3,1,2]}));
  assert.deepEqual({...restore,cache:undefined},{...original,cache:undefined});
  test(boxSizing+'-'+(vertical?'vertical':'horizontal')+'-nonempty-empty-reordered-refresh-same-root',fixture,
   {emptyRaw:empty.rawEnvelope,emptyInline:emptySummary.inline,emptyOuter:emptySummary.outer,restoreOuter:restore.outer,restoredIds:(await page.evaluate(()=>window.__rpBoxResearch.snapshot())).rows.map(r=>r.id)},
   {emptyRaw:{width:-6,height:-2},emptyInline:[0,0],emptyOuter:[7,10],restoreOuter:original.outer,restoredIds:[3,1,2]});
 }
 for(const vertical of [true,false]) {
  const fixture={ids:[1],boxSizing:'border-box',border,padding:[0,0,0,0],width:0,height:0,vertical};
  const initial=await init(fixture),grown=await resize(1,10,10),amount=vertical?10:7;
  test((vertical?'vertical':'horizontal')+'-zero-template-grows-from-used-css-minimum',fixture,
   {initialInline:initial.root.inline,initialCss:initial.root.jqueryCss,grown:summarize(grown.snapshot).css,cache:grown.snapshot.cache.r},
   {initialInline:['0px','0px'],initialCss:['7px','10px'],grown:[17+amount,20+amount],cache:{width:17+amount,height:20+amount}});
 }
 for(const vertical of [true,false])for(const wrap of [-1,2]) {
  const fixture={ids:[],boxSizing:'border-box',border,padding:[15,17,19,23],gapX:8,gapY:4,vertical,wrap};
  const s=summarize(await init(fixture)),expected=vertical?(wrap===-1?[140,30]:[32,30]):(wrap===-1?[32,54]:[32,30]);
  test('border-box-'+(vertical?'vertical':'horizontal')+'-'+wrap+'-empty-padding-exceeds-gap',fixture,
   {css:s.css,outer:s.outer,cache:s.cache},{css:expected,outer:expected,cache:{width:expected[0],height:expected[1]}});
 }
 // Product-contract oracle: full ideal recomputation plus the observed border drift.
 // This does not reproduce native _pushItems branches. Real DOM remains the observed side.
 function ideal(f,sizes) {
  const count=f.wrap===-1?f.ids.length:f.wrap,groups=[];
  for(let i=0;i<f.ids.length;i+=count)groups.push(f.ids.slice(i,i+count));
  let cross=0,mainMax=0;const rows=[];
  for(const group of groups){let main=0,crossMax=0;
   for(const id of group){const [w,h]=sizes[id];rows.push([id,f.padding[3]+(f.vertical?cross:main),f.padding[0]+(f.vertical?main:cross)]);
    main+=(f.vertical?h:w)+(f.vertical?f.gapY:f.gapX);crossMax=Math.max(crossMax,f.vertical?w:h);}
   mainMax=Math.max(mainMax,main-(f.vertical?f.gapY:f.gapX));cross+=crossMax+(f.vertical?f.gapX:f.gapY);
  }
  cross-=f.vertical?f.gapX:f.gapY;
  return {box:[f.padding[1]+f.padding[3]+(f.vertical?cross:mainMax),f.padding[0]+f.padding[2]+(f.vertical?mainMax:cross)],rows};
 }
 let seed=0x4150b0ce;const rand=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};
 const matrices=[];
 for(let caseIndex=0;caseIndex<24;caseIndex++) {
  const f={boxSizing:'border-box',ids:Array.from({length:1+rand(7)},(_,i)=>i+1),vertical:caseIndex%2===0,wrap:[-1,1,2,4][Math.floor(caseIndex/2)%4],
   border:Array.from({length:4},()=>rand(12)),padding:Array.from({length:4},()=>rand(13)),gapX:rand(9),gapY:rand(9),width:rand(11),height:rand(11)};
  const sizes=Object.fromEntries(f.ids.map(id=>[id,[f.width,f.height]]));let old=ideal(f,sizes);
  const b=[f.border[1]+f.border[3],f.border[0]+f.border[2]],primary=b[f.vertical?1:0];
  let css=old.box.map((v,i)=>Math.max(b[i],v)),cache={width:old.box[0],height:old.box[1]},inline=old.box.map(v=>Math.max(0,v));
  await init(f);const operations=[];
  for(let op=0;op<12;op++) {
   const id=f.ids[rand(f.ids.length)],w=rand(81),h=rand(41);sizes[id]=[w,h];const next=ideal(f,sizes),delta=next.box.map((v,i)=>v-old.box[i]);
   for(let axis=0;axis<2;axis++)if(delta[axis]!==0){inline[axis]=Math.max(0,css[axis]+delta[axis]+primary);css[axis]=Math.max(b[axis],inline[axis]);cache={width:css[0],height:css[1]};}
   const observed=(await resize(id,w,h)).snapshot,s=summarize(observed);
   assert.deepEqual({css:s.css,inline:s.inline,outer:s.outer,cache:s.cache,xy:observed.rows.map(r=>[r.id,...r.outerRelative])},
    {css:[...css],inline:[...inline],outer:[...css],cache,xy:next.rows},'real DOM border oracle '+caseIndex+'/'+op);
   operations.push({id,width:w,height:h,ideal:next.box,delta,css:[...css],cache:{...cache}});old=next;
  }
  matrices.push({fixture:f,operations});
 }
 outcomes.push({name:'real-border-box-matches-independent-ideal-plus-border-drift-contract',pass:true,seed:'0x4150b0ce',fixtures:24,resizes:288,
  domain:'nonempty; zero/positive dimensions; asymmetric nonnegative borders and layout padding; zero physical CSS padding; both directions and fixed-count wrap',matrices});
 }
 assert.deepEqual(errors,[]);assert.equal(blockedRequests,0);
 const metadata=await page.evaluate(()=>({userAgent:navigator.userAgent,jquery:jQuery.fn.jquery,compatMode:document.compatMode,devicePixelRatio:devicePixelRatio}));
 const result={version:scaleStudy?2:1,target:'Axure RP 11.0.0.4150',files,excerpts,environment:{browser:await browser.version(),channel:'msedge',headless:true,...metadata,...(scaleStudy?{requestedDpr:dpr,scaleMode}:{}),blockedRequests,pageErrors:errors},
  probe:{count:outcomes.length,outcomes,limitations:[
   'Actual Edge DOM, actual shipped jQuery and exact extracted layout functions are executed. DOM rows are created by a minimal handwritten equivalent of native absolute-row construction; the full prototype application is not loaded.',
   'Box-sizing, border and CSS-padding are explicit probe fixture inputs, not a claim about the unresolved obfuscated generator literals. Repeater layout padding and physical CSS padding are deliberately separate.',
   'Parent fit and event dispatch are recording sinks; no fonts, transforms, adaptive switching, scrollbars, nested repeaters or animation are modeled.',
   'The default.css resource belongs to the viewer and is pinned for static reference but not applied. reset.css and axure_rp_page.css are applied.',
  ]}};
 const output=JSON.stringify(result,null,2)+'\n';
 // Keep the original DPR1 evidence immutable; a baseline rerun gets its own file.
 const outputName=scaleStudy?`repeater-box-model-dpr-${String(dpr).replace('.','p')}-${scaleMode}.json`:'repeater-box-model-evidence-recheck.json';
 fs.writeFileSync(new URL('./'+outputName,import.meta.url),output);
 console.log(JSON.stringify({pass:true,probes:outcomes.length,browser:result.environment,output:outputName,sha256:sha(output)}));
} finally {await context.close();await browser.close();}
