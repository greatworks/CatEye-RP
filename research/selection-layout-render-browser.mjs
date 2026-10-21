// Isolated Edge + retained jQuery / exact setter / autofit / resize consumers.
// The fixture DOM follows the separately replayed SelectionButton writer.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/';
const inputs=['resources/scripts/jquery-3.7.1.min.js','resources/scripts/axure/expr.js','resources/scripts/axure/axQuery.std.js','resources/scripts/axure/visibility.js','resources/css/axure_rp_page.css'];
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const src=Object.fromEntries(inputs.map(p=>[p.split('/').at(-1),fs.readFileSync(root+p,'utf8')]));
const slice=(name,a,b)=>src[name].split(/\r?\n/).slice(a-1,b).join('\n');
const between=(s,a,b)=>{const x=s.indexOf(a),y=s.indexOf(b,x+a.length);assert(x>=0&&y>x);return s.slice(x,y);};
const ranges=[
 {file:'expr.js',start:316,end:385},{file:'expr.js',start:469,end:552},
 {file:'visibility.js',start:40,end:53},
];
const boot=`(()=>{
 const events=[],objects={},queries={};
 const $jobj=id=>jQuery(document.getElementById(id)),$obj=id=>objects[id];
 const $ax=selector=>queries[selector.slice(1)];
 const HIDDEN_CLASS='ax_default_hidden',UNPLACED_CLASS='ax_default_unplaced',SELECTED_ClASS='selected';
 $ax.public={fn:{}};$ax.expr={};$ax.visibility={};$ax.adaptive={currentViewId:''};
 $ax.constants={LINK_TYPE:'hyperlink'};
 for(const k of ['BUTTON','DYNAMIC_PANEL','IMAGE_BOX','IMAGE_MAP_REGION','INLINE_FRAME','LAYER','LIST_BOX','COMBO_BOX','VECTOR_SHAPE','TEXT_AREA','TEXT_BOX','SNAPSHOT'])$ax.constants[k+'_TYPE']=k;
 $ax.style={generateState:()=>'',computeFullStyle:()=>effectiveStyle,
 transformTextWithVerticalAlignment:(_id,fn)=>fn(),CacheOriginalText:()=>{}};
 $ax.GetTextPanelId=id=>id+'_text';
 $ax.visibility.setResizingRect=(...args)=>events.push({kind:'setResizingRect',args});
 $ax.action={queueTypes:{resize:'resize',move:'move'},fireAnimationFromQueue:(id,type)=>events.push({kind:'release',id,type})};
 $ax.move={MoveWidget:(id,dx,dy,options,...rest)=>events.push({kind:'MoveWidget',id,dx,dy,options,rest})};
 var effectiveStyle, _exprFunctions={ToString:v=>String(v)};
 var _displayWidgetIfNeeded=id=>({jObject:$jobj(id),trap:null});
 var _setAutoFitId=(id,css)=>events.push({kind:'candidate',id,css});
 ${between(src['axQuery.std.js'],'    var RESIZABLE_TYPES =','    $ax.public.fn.IsSelectionButton')}
 ${between(src['axQuery.std.js'],'    $ax.public.fn.IsResizable =','    var RESIZABLE_TYPES')}
 ${between(src['axQuery.std.js'],'    $ax.public.fn.resize =','    $ax.public.fn.')}
 ${ranges.map(r=>slice(r.file,r.start,r.end)).join('\n')}
 window.runSelectionFixture=input=>{
  document.body.replaceChildren();events.length=0;
  const owner=document.createElement('div');owner.id='u';owner.style.cssText='position:absolute;left:40px;top:30px;width:100px;height:20px;';
  const label=document.createElement('label');label.id='u_input_label';label.htmlFor='u_input';label.style.cssText='position:absolute;left:0;width:100%;height:100%;';
  const text=document.createElement('div');text.id='u_text';text.className='text';
  text.style.cssText='position:absolute;left:13px;top:0;white-space:nowrap;font:16px/20px monospace;';
  const p=document.createElement('p'),span=document.createElement('span');span.id='u_span';span.textContent='Initial';
  if(input.linked){const a=document.createElement('a');a.href='#';a.append(span);p.append(a);}else p.append(span);
  text.append(p);label.append(text);owner.append(label);
  const control=document.createElement('input');control.id='u_input';control.type=input.type==='radioButton'?'radio':'checkbox';owner.append(control);document.body.append(owner);
  objects.u={type:input.type,autoFitWidth:input.fitW,autoFitHeight:input.fitH};
  effectiveStyle={paddingLeft:5,paddingRight:7,paddingTop:2,paddingBottom:3,horizontalAlignment:input.align??'left',verticalAlignment:input.vAlign??'top'};
  queries.u={getElementIds:()=>['u'],size:()=>({width:100,height:20}),offsetBoundingRect:()=>({left:40,top:30,width:100,height:20})};
  queries.u.resize=(...args)=>$ax.public.fn.resize.apply(queries.u,args);
  _exprFunctions.SetWidgetRichText(['u'],input.value,true);
  return {events:structuredClone(events),owner:{width:owner.style.width,height:owner.style.height},textHTML:text.innerHTML,
   directTextCount:$(owner).children('#u_text').length,jqueryHeight:$(owner).children('#u_text').height(),
   jqueryNestedHeight:$(owner).find('#u_text').height(),display:text.style.display,
   paragraphs:[...text.querySelectorAll('p')].map(p=>({directSpans:[...p.children].filter(x=>x.tagName==='SPAN').map(x=>$(x).width())})),
   liveFont:getComputedStyle(text).font};
 };
})();`;
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
const clean=(_k,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v;
try{
 const page=await browser.newPage();await page.route('**/*',route=>route.abort());
 await page.setContent('<!doctype html><html><head></head><body></body></html>');
 await page.addStyleTag({content:src['axure_rp_page.css']});
 await page.addScriptTag({content:src['jquery-3.7.1.min.js']});
 await page.addScriptTag({content:boot});
 for(const type of ['checkbox','radioButton'])for(const fitW of [false,true])for(const fitH of [false,true])for(const value of ['A longer label','']){
  const input={type,fitW,fitH,value,align:'right',vAlign:'bottom'};
  const actual=await page.evaluate(input=>window.runSelectionFixture(input),input);
  assert.deepEqual(actual.owner,{width:'100px',height:'20px'});
  assert.equal(actual.directTextCount,0);assert.equal(actual.jqueryHeight,undefined);
  const candidate=actual.events.find(e=>e.kind==='candidate');
  if(fitH)assert(Number.isNaN(candidate.css.height));
  if(!fitW&&!fitH)assert.equal(candidate,undefined);
  if(fitW){const width=Math.max(0,...actual.paragraphs.map(p=>p.directSpans.reduce((a,b)=>a+b,0)))+12;assert.equal(candidate.css.width,width);}
  results.push({input,actual,passed:true});
 }
 for(const linked of [false,true])for(const value of ['One','One\nTwo','One\n\nTwo']){
  const input={type:'checkbox',fitW:true,fitH:false,value,linked};
  const actual=await page.evaluate(input=>window.runSelectionFixture(input),input);
  const expected=linked&&value==='One'?12:Math.max(0,...actual.paragraphs.map(p=>p.directSpans.reduce((a,b)=>a+b,0)))+12;
  assert.equal(actual.events.find(e=>e.kind==='candidate').css.width,expected);
  results.push({input,actual,passed:true});
 }
 fs.writeFileSync('research/selection-layout-render-browser-probes.json',JSON.stringify({
  method:'Actual controlled Edge DOM with retained jQuery and exact original JS function slices; not original Axure application/generated-page pixels.',
  browser:browser.version(),sources:[...inputs.map(p=>({path:root+p,sha256:sha(root+p)})),{path:'research/selection-layout-render-browser.mjs',sha256:sha('research/selection-layout-render-browser.mjs')},
   {path:'research/selection-layout-render-dom-probes.json',sha256:sha('research/selection-layout-render-dom-probes.json')}],
  ranges,summary:{total:results.length,passed:results.length,failed:0},
  sinks:['DOM structure is independently replayed; actual generated project CSS/SVG and original rich-font metrics unavailable.',
   'Fixture monospace 16px/20px and text left13 are controlled inputs, not recovered native defaults.',
   'GetTextPanelId/style providers/owner-size/visibility display helper are explicit facades.',
   'query.resize is original consumer and selection early-return executes; movement is a recording sink (no live MoveWidget geometry).',
   'No hidden ancestor clone/rotation/custom master/adaptive state included.',
   'Nonfinite candidate values encoded as NaN string; product must not silently store invalid geometry.'],results
 },clean,2)+'\n');
 console.log(JSON.stringify({total:results.length,passed:results.length,browser:browser.version()}));
}catch(error){
 let n=1;while(fs.existsSync(`research/selection-layout-render-browser-failure-${n}.json`))n++;
 fs.writeFileSync(`research/selection-layout-render-browser-failure-${n}.json`,JSON.stringify({error:error.stack,passed:results.length,results},clean,2)+'\n');throw error;
}finally{await browser.close();}
