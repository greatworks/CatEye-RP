// Research only: exact retained Axure functions plus its shipped jQuery in an
// isolated Edge DOM. Query size/style and downstream resize/move are named sinks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const native = 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const originals = [
  ['expr.js', 'resources/scripts/axure/expr.js', '530036aff9f8c349642d34555cdcbefc72a92511382279551bca08669ffe0ae6'],
  ['visibility.js', 'resources/scripts/axure/visibility.js', 'bbf8974eaa4ffa2b9800797725ada6805c47c532f47d9a5647dc205966ab8a53'],
  ['jquery', 'resources/scripts/jquery-3.7.1.min.js', '8b1788d702786569c261f39244ec0e4a96fa25e5c59a10e9adae04895f3e2d85'],
  ['page.css', 'resources/css/axure_rp_page.css', '595bfcd275dc80732aeecbb8365067ccecc4f0277df316ea47656816939ece4a'],
];
const text = {}, sources = originals.map(([name, relative, expected]) => {
  const file = path.join(native, relative), bytes = fs.readFileSync(file), sha256 = digest(bytes);
  assert.equal(sha256, expected); text[name] = bytes.toString('utf8'); return { name, path: file, sha256 };
});
const slice = (file, start, end) => text[file].split(/\r?\n/).slice(start - 1, end).join('\n');
const ranges = [
  ['expr.js', 316, 385, 'SetWidgetRichText exact body'],
  ['expr.js', 387, 443, 'registry and owner-only hidden clone'],
  ['expr.js', 469, 552, 'autofitWidget exact body'],
  ['visibility.js', 40, 53, 'SetVisible exact body'],
];
const bootstrap = `(() => {
  var config, objects = {}, events = [], measurements = [], running = false;
  var _exprFunctions = { ToString: value => String(value) }, _setAutoFitId;
  var HIDDEN_CLASS='ax_default_hidden', UNPLACED_CLASS='ax_default_unplaced', SELECTED_ClASS='selected';
  var $jobj = id => jQuery(document.getElementById(id)), $obj = id => objects[id];
  function $ax(selector) { return {
    size: () => ({width: config.width, height: config.height}),
    resize: (css, options) => events.push({kind:'resize-sink',css:structuredClone(css),options}),
  }; }
  $ax.expr={}; $ax.visibility={}; $ax.adaptive={currentViewId:''}; $ax.constants={LINK_TYPE:'hyperlink'};
  $ax.GetTextPanelId=id=>id+'_text';
  $ax.style={computeFullStyle:()=>config.effectiveStyle,generateState:()=>'',
    transformTextWithVerticalAlignment:(_id,fn)=>fn(),
    CacheOriginalText:id=>events.push({kind:'cache-sink',id}),SetWidgetSelected:()=>{throw Error('Unexpected selected side effect')}};
  $ax.move={MoveWidget:(id,dx,dy,options,...rest)=>events.push({kind:'move-sink',id,dx,dy,options,rest})};
  ${ranges.map(([file,start,end])=>slice(file,start,end)).join('\n')}
  function metrics(node) {
    if (!node) return null;
    const c=getComputedStyle(node),r=node.getBoundingClientRect(),range=document.createRange(); range.selectNodeContents(node);
    const glyphs=[...range.getClientRects()].map(v=>({x:v.x,y:v.y,width:v.width,height:v.height}));
    return {id:node.id,tag:node.tagName,text:node.textContent,clone:!!node.closest('#measure'),
      css:{display:c.display,boxSizing:c.boxSizing,width:c.width,height:c.height,font:c.font,fontSize:c.fontSize,fontFamily:c.fontFamily,lineHeight:c.lineHeight,whiteSpace:c.whiteSpace,
        padding:[c.paddingTop,c.paddingRight,c.paddingBottom,c.paddingLeft],border:[c.borderTopWidth,c.borderRightWidth,c.borderBottomWidth,c.borderLeftWidth],transform:c.transform},
      offsetWidth:node.offsetWidth,offsetHeight:node.offsetHeight,clientWidth:node.clientWidth,clientHeight:node.clientHeight,
      rect:{x:r.x,y:r.y,width:r.width,height:r.height},glyphs};
  }
  const originalWidth=jQuery.fn.width,originalHeight=jQuery.fn.height;
  for(const [axis,original] of [['width',originalWidth],['height',originalHeight]])jQuery.fn[axis]=function(...args){
    const value=original.apply(this,args);
    if(running&&args.length===0)measurements.push({axis,value:value===undefined?'undefined':value,elements:[...this].map(metrics)});
    return value;
  };
  function snapshot() {
    const owner=document.getElementById('w'),block=document.getElementById('w_text');
    return {owner:metrics(owner),block:metrics(block),paragraphs:[...owner.querySelectorAll('p')].map(p=>({metrics:metrics(p),directSpans:[...p.children].filter(n=>n.tagName==='SPAN').map(span=>({metrics:metrics(span),jqueryWidth:originalWidth.call($(span))}))})),html:owner.outerHTML};
  }
  window.measureProbe = fixture => {
    document.body.replaceChildren();events=[];measurements=[];_autoFitIds={};$ax.expr.autoFitIds=_autoFitIds;
    config={width:160.25,height:80.5,effectiveStyle:{paddingTop:0,paddingRight:0,paddingBottom:0,paddingLeft:0,horizontalAlignment:'left',verticalAlignment:'top'},...fixture};
    objects={w:{type:'buttonShape',autoFitWidth:config.autoFitWidth??true,autoFitHeight:config.autoFitHeight??true}};
    const parent=document.createElement('div');parent.id='ancestor';parent.style.cssText=config.parentStyle??'';
    const owner=document.createElement('div');owner.id='w';owner.style.cssText='position:absolute;left:40px;top:30px;width:'+config.width+'px;height:'+config.height+'px;'+(config.ownerStyle??'');
    const background=document.createElement('div');background.id='w_div';owner.append(background);
    const block=document.createElement('div');block.id='w_text';block.className='text';block.style.cssText='position:absolute;width:100%;box-sizing:border-box;white-space:nowrap;'+(config.textStyle??'');
    block.innerHTML=config.html??'<p><span>AV fi xyz</span></p>';owner.append(block);parent.append(owner);document.body.append(parent);
    if(config.extraCss){const style=document.createElement('style');style.textContent=config.extraCss;document.body.append(style)}
    const before=snapshot();running=true;
    let error;
    try{if(Object.hasOwn(config,'setText'))_exprFunctions.SetWidgetRichText(['w'],config.setText,config.plain??true);else autofitWidget('w')}
    catch(e){error={name:e.name,message:e.message}}
    running=false;
    return {before,measurements,events,registry:structuredClone(_autoFitIds),after:snapshot(),error,measureContainerChildren:document.getElementById('measure')?.children.length??0};
  };
})();`;

const fixtures = [
  {name:'inline-normal-fractional-font',ownerStyle:'font-size:13.3px;letter-spacing:.15px'},
  {name:'inline-border-padding',html:'<p><span style="padding:2.25px 3.75px;border:1px solid">AV fi xyz</span></p>'},
  {name:'inline-explicit-width',html:'<p><span style="width:123.375px">AV fi xyz</span></p>'},
  {name:'two-inline-spans',html:'<p><span>AV fi</span><span style="font-size:21.3px"> wide xyz</span></p>'},
  {name:'inline-block-fractional-contentbox',html:'<p><span style="display:inline-block;width:31.375px;height:12.625px;padding:2.25px 3.75px;border:1px solid">A</span><span style="display:inline-block;width:17.125px;height:8.5px">B</span></p>'},
  {name:'inline-block-fractional-borderbox',html:'<p><span style="display:inline-block;box-sizing:border-box;width:31.375px;height:20.625px;padding:2.25px 3.75px;border:1px solid">A</span></p>'},
  {name:'text-content-box-fixed',textStyle:'box-sizing:content-box;height:21.375px;padding:2.25px 3.75px;border:1px solid',effectiveStyle:{paddingTop:2.25,paddingBottom:2.25,paddingLeft:3.75,paddingRight:3.75}},
  {name:'text-border-box-fixed',textStyle:'height:50.5px;padding:2.25px 3.75px;border:1px solid',effectiveStyle:{paddingTop:2.25,paddingBottom:2.25,paddingLeft:3.75,paddingRight:3.75}},
  {name:'text-auto-height-padding-border',textStyle:'padding:2.25px 3.75px;border:1px solid',effectiveStyle:{paddingTop:2.25,paddingBottom:2.25,paddingLeft:3.75,paddingRight:3.75}},
  {name:'three-paragraphs-normal',html:'<p><span>First</span></p><p><span style="font-size:24px">Second</span></p><p><span>Third</span></p>'},
  {name:'paragraph-fractional-lineheight',html:'<p style="line-height:20.375px"><span>First</span></p><p style="line-height:31.125px"><span>Second</span></p>'},
  {name:'br-outer-span',html:'<p><span><span>long first</span><br><span>short</span></span></p>'},
  {name:'three-br-in-one-outer-span',html:'<p><span><span>first</span><br><br><span>last</span><br></span></p>'},
  {name:'soft-lf-nowrap',html:'<p><span>first\nlast</span></p>'},
  {name:'two-paragraph-same-lines',html:'<p><span>long first</span></p><p><span>short</span></p>'},
  {name:'br-two-direct-spans',html:'<p><span>long first<br>tiny</span><span>right</span></p>'},
  {name:'empty-text-layer',html:''},
  {name:'empty-p-span',html:'<p><span></span></p>'},
  {name:'single-br',html:'<p><span><br></span></p>'},
  {name:'nbsp-span',html:'<p><span>&nbsp;</span></p>'},
  {name:'p-text-without-span',html:'<p>Direct text</p>'},
  {name:'no-paragraph-span',html:'<span>Direct span without p</span>'},
  {name:'link-only-anchor-wrapper',html:'<p><a><span>Linked caption</span></a></p>'},
  {name:'link-nested-in-direct-span',html:'<p><span><a><span>Linked caption</span></a></span></p>'},
  {name:'mixed-anchor-and-direct-span',html:'<p><span>Prefix </span><a><span>Linked caption</span></a><span> suffix</span></p>'},
  {name:'hidden-owner-inline-display',ownerStyle:'display:none;font-size:20px'},
  {name:'hidden-parent-inherited-font',parentStyle:'display:none;font:30px Georgia'},
  {name:'visible-parent-inherited-font',parentStyle:'font:30px Georgia'},
  {name:'hidden-parent-explicit-owner-font',parentStyle:'display:none;font:30px Georgia',ownerStyle:'font:30px Georgia'},
  {name:'hidden-parent-dependent-selector',parentStyle:'display:none',extraCss:'#ancestor #w_text{font-size:40px}'},
  {name:'hidden-parent-class-only',parentStyle:'font:30px Georgia',extraCss:'#ancestor{display:none}'},
  {name:'visibility-hidden-owner',ownerStyle:'visibility:hidden'},
  {name:'owner-rotation',ownerStyle:'transform:rotate(37deg)'},
  {name:'span-rotation',html:'<p><span style="display:inline-block;width:31.375px;height:12.625px;transform:rotate(37deg)">A</span></p>'},
  {name:'width-only',autoFitHeight:false},
  {name:'height-only',autoFitWidth:false},
  {name:'neither-axis',autoFitWidth:false,autoFitHeight:false},
  {name:'padding-only-no-span',html:'<p>Text</p>',effectiveStyle:{paddingLeft:3.25,paddingRight:5.75,paddingTop:2.5,paddingBottom:1.25}},
  {name:'setter-plain-br',setText:'long first\nshort'},
  {name:'setter-plain-leading-trailing-br',setText:'\nlong first\n\nshort\n'},
  {name:'setter-plain-empty',setText:''},
  {name:'setter-plain-empty-padding',setText:'',textStyle:'padding:2.25px 3.75px;border:1px solid',effectiveStyle:{paddingTop:2.25,paddingBottom:2.25,paddingLeft:3.75,paddingRight:3.75}},
  {name:'setter-plain-tail-lf',setText:'A\n'},
  {name:'setter-plain-two-tail-lfs',setText:'A\n\n'},
  {name:'setter-plain-only-lf',setText:'\n'},
  {name:'setter-plain-only-crlf',setText:'\r\n'},
  {name:'setter-plain-crlf',setText:'A\r\nB'},
  {name:'setter-plain-bare-cr',setText:'A\rB'},
  {name:'setter-plain-only-cr',setText:'\r'},
  {name:'setter-plain-line-separator',setText:'A\u2028B'},
  {name:'setter-plain-paragraph-separator',setText:'A\u2029B'},
  {name:'setter-plain-leading-double-spaces',setText:'  A  B  '},
  {name:'setter-plain-single-space-control',setText:'A B'},
  {name:'setter-plain-nbsp-control',setText:'\u00a0\u00a0A\u00a0\u00a0B\u00a0\u00a0'},
  {name:'setter-plain-html-literal',setText:'<b>&</b>\n<em>'},
  {name:'setter-plain-first-paragraph-style',html:'<p style="line-height:21px;text-align:right"><span id="keep" style="font-size:17px">Old</span></p><p style="line-height:40px"><span>Second</span></p>',setText:'A\nB'},
  {name:'setter-plain-sole-link-span',html:'<p><a><span>Old linked</span></a></p>',setText:'Replacement'},
  {name:'setter-plain-multiple-link-spans',html:'<p><a><span>Old</span><span> linked</span></a></p>',setText:'Replacement'},
  {name:'setter-rich-paragraphs',setText:'<p><span>long first</span></p><p><span>short</span></p>',plain:false},
  {name:'fixed-old-width-wrapping-both',width:60.5,textStyle:'white-space:normal;word-wrap:break-word',html:'<p><span>words need a few lines</span></p>'},
  {name:'text-contentbox-scrollbars',textStyle:'box-sizing:content-box;width:80.375px;height:30.125px;overflow:scroll;padding:2.25px 3.75px;border:1px solid',html:'<p><span>Long text needs horizontal scrolling</span></p>',effectiveStyle:{paddingTop:2.25,paddingBottom:2.25,paddingLeft:3.75,paddingRight:3.75}},
  {name:'text-borderbox-scrollbars',textStyle:'box-sizing:border-box;width:80.375px;height:30.125px;overflow:scroll;padding:2.25px 3.75px;border:1px solid',html:'<p><span>Long text needs horizontal scrolling</span></p>',effectiveStyle:{paddingTop:2.25,paddingBottom:2.25,paddingLeft:3.75,paddingRight:3.75}},
  {name:'inline-explicit-zero-width',html:'<p><span style="width:0px">AV fi xyz</span></p>'},
  {name:'exact-zero-delta-registration',width:48.5,height:20.375,html:'<p style="line-height:20.375px"><span style="display:inline-block;width:48.5px;height:10px">X</span></p>'},
];

const browser = await chromium.launch({channel:'msedge',headless:true});
const context = await browser.newContext({viewport:{width:1200,height:850},deviceScaleFactor:1});
const blockedRequests=[],pageErrors=[],results=[];
await context.route('**/*',route=>{blockedRequests.push(route.request().url());return route.abort()});
const page=await context.newPage();page.on('pageerror',error=>pageErrors.push(error.message));
try {
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addStyleTag({content:text['page.css']+'\nbody{margin:0;font:13px Arial,sans-serif}'});
  await page.addScriptTag({content:text.jquery}); await page.addScriptTag({content:bootstrap});
  await page.evaluate(()=>document.fonts.ready);
  const environment={browserVersion:browser.version(),...(await page.evaluate(()=>({userAgent:navigator.userAgent,devicePixelRatio:devicePixelRatio,bodyFont:getComputedStyle(document.body).font,jquerySupport:Object.fromEntries(['boxSizingReliable','scrollboxSize','reliableTrDimensions','pixelBoxStyles'].map(k=>[k,jQuery.support[k]()]))}))),jquery:'3.7.1'};
  for(const fixture of fixtures){const observed=await page.evaluate(fixture=>window.measureProbe(fixture),fixture);assert.equal(observed.error,undefined,fixture.name);results.push({name:fixture.name,fixture,observed});}
  const byName=name=>results.find(result=>result.name===name).observed;
  const checks=[];const check=(name,fn)=>{fn();checks.push({name,passed:true})};
  check('inline spans use integer offset fallback',()=>{const r=byName('inline-normal-fractional-font');assert.equal(r.measurements.find(m=>m.axis==='width').value,r.before.paragraphs[0].directSpans[0].metrics.offsetWidth)});
  check('inline-block content dimensions retain fractions',()=>assert.equal(byName('inline-block-fractional-contentbox').registry.w.width,48.5));
  check('inline-block border-box subtracts padding and borders',()=>assert.equal(byName('inline-block-fractional-borderbox').registry.w.width,21.875));
  check('text content-box height then effective padding',()=>assert.equal(byName('text-content-box-fixed').registry.w.height,25.875));
  check('text border-box excludes border and padding before adding effective padding',()=>assert.equal(byName('text-border-box-fixed').registry.w.height,48.5));
  check('nested link spans are excluded unless inside direct span',()=>{assert.equal(byName('link-only-anchor-wrapper').registry.w.width,0);assert.ok(byName('link-nested-in-direct-span').registry.w.width>0)});
  check('rotation does not change CSS measurements',()=>{const a=byName('owner-rotation'),b=byName('width-only');assert.equal(a.registry.w.width,b.registry.w.width);assert.equal(a.registry.w.width,a.before.paragraphs[0].directSpans[0].metrics.offsetWidth)});
  check('hidden owner clones are removed',()=>{const r=byName('hidden-owner-inline-display');assert.ok(r.measurements.every(m=>m.elements.every(e=>e.clone)));assert.equal(r.measureContainerChildren,0);assert.equal(r.after.owner.css.display,'none')});
  check('ancestor-only font inheritance is lost by owner-only clone',()=>assert.ok(byName('hidden-parent-inherited-font').registry.w.width<byName('visible-parent-inherited-font').registry.w.width));
  check('neither flag does not measure or register',()=>{const r=byName('neither-axis');assert.deepEqual(r.measurements,[]);assert.deepEqual(r.registry,{})});
  check('no-op still registers',()=>{const r=byName('exact-zero-delta-registration');assert.deepEqual(r.registry.w,{width:48.5,height:20.375});assert.equal(r.events.length,0)});
  check('plain setter sole linked span retains anchor but measures zero width',()=>{const r=byName('setter-plain-sole-link-span');assert.equal(r.registry.w.width,0);assert.match(r.after.html,/<a><span>Replacement<\/span><\/a>/)});
  check('plain multiline setter creates one p and direct outer span',()=>{const r=byName('setter-plain-br');assert.equal(r.after.paragraphs.length,1);assert.equal(r.after.paragraphs[0].directSpans.length,1);assert.match(r.after.html,/<span><span>long first<\/span><br><span>short<\/span><\/span>/)});
  check('plain CRLF and LF split; bare CR remains in text',()=>{assert.equal(byName('setter-plain-crlf').after.block.text,'AB');assert.match(byName('setter-plain-crlf').after.html,/<br>/);assert.equal(byName('setter-plain-bare-cr').after.block.text,'A\rB');assert.ok(!byName('setter-plain-bare-cr').after.html.includes('<br>'))});
  check('plain separator characters are retained without BR rewriting',()=>{for(const [name,value]of[['setter-plain-line-separator','A\u2028B'],['setter-plain-paragraph-separator','A\u2029B']]){assert.equal(byName(name).after.block.text,value);assert.ok(!byName(name).after.html.includes('<br>'))}});
  check('ordinary spaces are not rewritten to NBSP',()=>{assert.equal(byName('setter-plain-leading-double-spaces').after.block.text,'  A  B  ');assert.deepEqual(byName('setter-plain-leading-double-spaces').registry.w,byName('setter-plain-single-space-control').registry.w)});
  check('trailing BR has no extra terminal strut',()=>{assert.equal(byName('setter-plain-tail-lf').registry.w.height,15);assert.equal(byName('setter-plain-two-tail-lfs').registry.w.height,30)});
  check('first paragraph and first span style/id survive replacement',()=>{const r=byName('setter-plain-first-paragraph-style');assert.equal(r.after.paragraphs.length,1);assert.equal(r.after.paragraphs[0].metrics.css.lineHeight,'21px');assert.equal(r.after.paragraphs[0].directSpans[0].metrics.id,'keep');assert.equal(r.after.paragraphs[0].directSpans[0].metrics.css.fontSize,'17px');assert.equal(r.registry.w.height,44)});
  check('plain setter treats HTML-like input as text',()=>{const r=byName('setter-plain-html-literal');assert.equal(r.after.block.text,'<b>&</b><em>');assert.match(r.after.html,/&lt;b&gt;&amp;&lt;\/b&gt;/);assert.ok(!r.after.html.includes('<em>'))});
  check('empty hidden text retains effective padding only',()=>{const r=byName('setter-plain-empty-padding');assert.deepEqual(r.registry.w,{width:7.5,height:4.5});assert.equal(r.measurements[0].value,0);assert.equal(r.after.block.css.display,'none')});
  check('height measured before width',()=>{for(const {observed} of results){const list=observed.measurements.map(m=>m.axis);if(list.includes('height'))assert.equal(list[0],'height')}});
  assert.deepEqual(pageErrors,[]);assert.deepEqual(blockedRequests,[]);
  const out={schema:'runtime-text-autofit-measure-v1',capturedAt:new Date().toISOString(),kind:'Exact retained JavaScript slices and retained jQuery executed in real isolated headless Edge DOM; injected object/style/query/resize/move/cache sinks. Not a full generated page or native GUI pixel comparison.',environment,extractionEvidenceId:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',distributionSha256:'f9f374412306629dadb78cbd5db643353df83fb7c2d7a7e987687865b876dfe0',sources,ranges:ranges.map(([file,startLine,endLine,purpose])=>({file,startLine,endLine,purpose,sha256:digest(slice(file,startLine,endLine))})),dependencies:['research/runtime-text-autofit-plan.md','research/runtime-text-autofit-bridge-evidence.md','research/runtime-text-autofit-measure-probe.mjs'].map(file=>({path:file,sha256:digest(fs.readFileSync(path.join(root,file)))})),stubs:['$obj supplies fixture metadata','query.size supplies old requested owner dimensions; not original size/cache provider','computeFullStyle supplies fixture padding/alignment','query.resize and MoveWidget record calls only; do not execute original downstream geometry/events','transformTextWithVerticalAlignment invokes callback directly; original text-style cache omitted','ToString is String for the only string inputs used','CacheOriginalText records only'],fixtureStyle:'Shipped axure_rp_page.css plus independently constructed owner/text CSS and Arial 13px body. Synthetic structures are not claimed compiler output.',checks,results,pageErrors,blockedRequests};
  fs.writeFileSync(path.join(root,'research/runtime-text-autofit-measure-probe.json'),JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify({cases:results.length,checks:checks.length,environment,values:results.map(r=>({name:r.name,result:r.observed.registry.w,reads:r.observed.measurements.map(m=>({axis:m.axis,value:m.value,clone:m.elements[0]?.clone})),events:r.observed.events}))},null,2));
} finally {await context.close();await browser.close()}
