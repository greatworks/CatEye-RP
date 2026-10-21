// Exact retained JS, ordinary inline SVG fixtures. Original DLL/GUI is not executed.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {chromium} from '@playwright/test';
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=['resources/scripts/axure/style.js','resources/scripts/jquery-3.7.1.min.js','resources/css/axure_rp_page.css','resources/scripts/axure/doc.js'];
assert.equal(sha(root+files[0]),'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c');
const lines=fs.readFileSync(root+files[0],'utf8').split(/\r?\n/),ranges=[[810,812],[875,928],[964,980],[991,1645],[1647,1714],[1764,1915],[1986,2021],[2377,2417],[2503,2532]];
const slices=ranges.map(([start,end])=>({file:files[0],start,end,text:lines.slice(start-1,end).join('\n')}));
slices.push({file:files[3],start:601,end:611,text:fs.readFileSync(root+files[3],'utf8').split(/\r?\n/).slice(600,611).join('\n')});
const boot=String.raw`
var objects={},_idToAppliedStyles={},_shapesWithSetRichText={},_adaptiveStyledWidgets={},$=jQuery;
var $obj=id=>objects[id],$jobj=id=>id?jQuery('#'+id):jQuery();
var NORMAL='normal',MOUSE_OVER='mouseOver',MOUSE_DOWN='mouseDown',FOCUSED='focused',SELECTED='selected',ERROR='error',HINT='hint',DISABLED='disabled';
var has=(s,x)=>s.split('+').includes(x),_stateHasMouseOver=s=>has(s,MOUSE_OVER),_stateHasMouseDown=s=>has(s,MOUSE_DOWN),_stateHasFocused=s=>has(s,FOCUSED),_stateHasSelected=s=>has(s,SELECTED),_stateHasError=s=>has(s,ERROR),_stateHasHint=s=>has(s,HINT),_stateHasDisabled=s=>has(s,DISABLED);
var viewChains={'':[],a:['a'],b:['a','b']},currentState='normal',classCalls=[];
var $ax={style:{isLastAppliedStyle:()=>false},document:{stylesheet:{defaultStyle:{},stylesById:{}}},adaptive:{currentViewId:'',getAdaptiveIdChain:v=>viewChains[v]},visibility:{GetCurrentPanelDiagram:()=>null},public:{fn:{IsCheckBox:t=>t==='checkbox',IsRadioButton:t=>t==='radioButton',IsImageBox:t=>t==='imageBox'}},GetTextPanelId:()=>null,getObjectFromElementId:id=>objects[id],repeater:{applySuffixToElementId:(id,s)=>id+s,getScriptIdFromElementId:id=>id},placeholderManager:{refreshPlaceholder:()=>{}},GetButtonShape:id=>$jobj(id)};
var _updateStateClasses=(ids,state)=>classCalls.push({ids,state}),_updateCornersForBorders=()=>{},_clearWidgetAppliedCorners=()=>{},_enableStateTransitions=()=>false,_generateState=()=>currentState,_clearWidgetAppliedStyles;
`+slices.map(s=>s.text).join('\n')+String.raw`
var paint=(color,opacity=1)=>({fillType:'solid',color,opacity});
window.runCase=({type,initialWidth})=>{
 document.body.innerHTML='<div id="u" class="selected"><label><svg id="u_img" width="14" height="14" viewBox="0 0 14 14"><path id="fill" class="fill" d="M0 0 H14 V14 H0 Z" fill="#f1f2f3" stroke="none"/><path id="outline" class="stroke" d="M.5 .5 H13.5 V13.5 H.5 Z" fill="none" stroke="#112233" stroke-width="'+initialWidth+'"/><path id="mark" class="stroke btn_check" d="'+(type==='checkbox'?'M3 7 L6 10 L11 3':'M3.5 7 A3.5 3.5 0 1 0 10.5 7 A3.5 3.5 0 1 0 3.5 7 Z')+'" '+(type==='checkbox'?'fill="none" stroke="#112233" stroke-width="3"':'fill="#112233" stroke="none"')+'/></svg></label><input id="u_input" checked type="'+(type==='checkbox'?'checkbox':'radio')+'"></div>';
 _idToAppliedStyles={};classCalls=[];$ax.adaptive.currentViewId='';
 const svg=document.getElementById('u_img'),fill=document.getElementById('fill'),outline=document.getElementById('outline'),mark=document.getElementById('mark'),pristine=svg.outerHTML;let styleNode;
 objects.u={type,friendlyType:type==='checkbox'?'Checkbox':'Radio Button',buttonSize:14,owner:{type:'Axure:Page'},style:{size:{width:100,height:24},buttonSize:14,fill:paint(0xff112244),borderFill:paint(0xff223355),borderWidth:0,linePattern:'solid',stateStyles:{}},adaptiveStyles:{}};
 const o=objects.u,observations=[];
 $ax.document.stylesheet={defaultStyle:{fill:paint(0xffeeeeee),borderWidth:1},stylesById:{normalNamed:{fill:paint(0xff111111),borderWidth:2},stateNamed:{fill:paint(0xff445566),borderWidth:4},viewNamed:{borderWidth:7}}};
 const full=(state=currentState)=>_computeFullStyle('u',state,$ax.adaptive.currentViewId);
 const read=p=>{const c=getComputedStyle(p);return {attrs:Object.fromEntries([...p.attributes].map(a=>[a.name,a.value])),fill:c.fill,stroke:c.stroke,width:c.strokeWidth};};
 const snap=name=>{const st=svg.querySelector('style');if(!styleNode&&st)styleNode=st;observations.push({name,full:full(),sameSvg:document.getElementById('u_img')===svg,sameOutline:document.getElementById('outline')===outline,sameMark:document.getElementById('mark')===mark,sameStyle:!st||st===styleNode,viewBox:svg.getAttribute('viewBox'),transform:svg.style.transform,svgWidth:svg.getAttribute('width'),svgHeight:svg.getAttribute('height'),fill:read(fill),outline:read(outline),mark:read(mark),css:st?.textContent??'',applied:JSON.parse(JSON.stringify(_idToAppliedStyles))});};
 const apply=(name,state)=>{currentState=state;_applyImageAndTextJson('u',state,true);snap(name);};
 snap('initial');o.style.baseStyle='normalNamed';
 o.style.stateStyles={selected:{borderWidth:3,buttonSize:28},disabled:{fill:null,borderFill:null,borderWidth:0,buttonSize:13}};
 apply('selected-sparse','selected');apply('disabled-null-zero','disabled');apply('normal-zero','normal');
 o.style.stateStyles.selected={baseStyle:'stateNamed',borderFill:paint(0xffaa3344)};apply('selected-named','selected');
 o.adaptiveStyles={a:{fill:paint(0xff776655),stateStyles:{selected:{borderWidth:5}}},b:{baseStyle:'viewNamed',buttonSize:28}};
 $ax.adaptive.currentViewId='b';apply('adaptive-inherit-ancestor-state','selected');
 o.adaptiveStyles.b.stateStyles={};apply('adaptive-empty-state-map-blocks-ancestor','selected');
 o.adaptiveStyles.b.stateStyles=null;apply('adaptive-null-map-permits-ancestor','selected');
 o.adaptiveStyles.b.stateStyles={selected:{fill:null,borderWidth:0}};apply('adaptive-explicit-null-zero','selected');
 o.adaptiveStyles.b.stateStyles={mouseOver:{borderWidth:2},mouseDown:{borderWidth:3},focused:{borderWidth:4},selected:{borderWidth:5},error:{borderWidth:6},hint:{borderWidth:7},disabled:{borderWidth:8}};
 apply('state-priority','mouseOver+mouseDown+focused+selected+error+hint+disabled');
 $ax.adaptive.currentViewId='';currentState='normal';
 $ax.style.applyWidgetStyle('u','first',{borderWidth:6,borderFill:paint(0xff123456)},null,false);snap('action-first');
 $ax.style.applyWidgetStyle('u','second',{fill:paint(0xffabcdef)},null,false);snap('action-sparse-accumulates');
 $ax.style.applyWidgetStyle('u','third',{fill:null},null,true);snap('action-clear-still-same-asset');
 _clearWidgetAppliedStyles('u');snap('clear-record-no-paint');
 _applyImageAndTextJson('u','normal',true);snap('normal-after-clear-zero');
 o.adaptiveStyles.b={size:{width:200,height:48},buttonSize:28,borderWidth:0};$ax.adaptive.currentViewId='b';
 $ax.style.setAdaptiveStyle('u',o.adaptiveStyles.b,'normal');snap('adaptive-size-scales-same-svg');
 const imageIds={img:$ax.GetImageIdFromShape('u')??null,object:$ax.GetSvgIdFromShape('u')??null};
 _applyImage('u','fixture-not-fetched.svg','normal');snap('image-route-finds-no-inline-svg');
 const beforeReplacement=outline.getAttribute('stroke-width');svg.outerHTML=pristine;
 const replacement={differentSvg:document.getElementById('u_img')!==svg,beforeReplacement,afterWidth:document.getElementById('outline').getAttribute('stroke-width'),newStyleCount:document.getElementById('u_img').querySelectorAll('style').length};
 o.style.stateStyles.selected={fill:{opacity:.25}};$ax.adaptive.currentViewId='';
 return {observations,imageIds,replacement,shallowFill:full('selected').fill};
};
`;
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.route('**/*',route=>route.abort());
 await page.setContent('<!doctype html><html><body></body></html>');await page.addStyleTag({content:fs.readFileSync(root+files[2],'utf8')});await page.addScriptTag({content:fs.readFileSync(root+files[1],'utf8')});await page.addScriptTag({content:boot});
 for(const type of ['checkbox','radioButton'])for(const initialWidth of [0,1,3]){
  const input={type,initialWidth},actual=await page.evaluate(input=>runCase(input),input);results.push({input,actual,passed:false});
  const p=name=>actual.observations.find(x=>x.name===name),initial=p('initial');
  for(const s of actual.observations){assert(s.sameSvg&&s.sameOutline&&s.sameMark&&s.sameStyle,s.name);assert.equal(s.viewBox,initial.viewBox);assert.equal(s.svgWidth,'14');assert.equal(s.svgHeight,'14');assert.equal(s.outline.attrs.d,initial.outline.attrs.d);assert.equal(s.mark.attrs.d,initial.mark.attrs.d);}
  assert.equal(p('selected-sparse').fill.fill,'rgb(17, 34, 68)');assert.equal(p('selected-sparse').outline.width,'3px');
  assert.equal(p('disabled-null-zero').outline.width,'3px');assert.equal(p('disabled-null-zero').fill.fill,'rgb(241, 242, 243)');assert.equal(p('disabled-null-zero').mark.fill,initial.mark.fill);assert.equal(p('normal-zero').outline.width,'3px');
  assert.equal(p('selected-named').full.borderWidth,4);assert.equal(p('selected-named').fill.fill,'rgb(68, 85, 102)');
  assert.equal(p('adaptive-inherit-ancestor-state').full.borderWidth,5);assert.equal(p('adaptive-empty-state-map-blocks-ancestor').full.borderWidth,7);assert.equal(p('adaptive-null-map-permits-ancestor').full.borderWidth,5);assert.equal(p('adaptive-explicit-null-zero').outline.width,'5px');assert.equal(p('state-priority').outline.width,'8px');
  assert.equal(p('action-sparse-accumulates').applied.u.style.borderWidth,6);assert.equal(p('action-clear-still-same-asset').outline.width,'6px');assert.equal(p('action-clear-still-same-asset').fill.fill,'rgb(241, 242, 243)');assert.equal(p('normal-after-clear-zero').outline.width,'6px');assert.equal(p('adaptive-size-scales-same-svg').transform,'scale(2)');
  assert.deepEqual(actual.imageIds,{img:null,object:null});assert.deepEqual(actual.replacement,{differentSvg:true,beforeReplacement:'6',afterWidth:String(initialWidth),newStyleCount:0});assert.deepEqual(actual.shallowFill,{opacity:.25});
  if(type==='checkbox')for(const s of actual.observations.slice(1))assert.equal(s.mark.width,'3px',s.name);
  results.at(-1).passed=true;
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync('research/selection-state-assets-probes.json',JSON.stringify({method:'Exact retained JS resolver, action painter, adaptive painter and SVG painter in Edge. Constructed inline SVG; declared state-token predicates, text/transitions/corners/classes/placeholder sinks. No event eligibility, original generator, DLL or GUI executed.',sources:[...files.map(f=>root+f),import.meta.filename].map(path=>({path,sha256:sha(path)})),slices:slices.map(({text,...s})=>({...s,sha256:createHash('sha256').update(text).digest('hex')})),summary:{sequences:results.length,observations:results.reduce((n,r)=>n+r.actual.observations.length,0),passed:results.filter(r=>r.passed).length,failed:0},errors,results},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({passed:results.length,observations:results.reduce((n,r)=>n+r.actual.observations.length,0)}));
}catch(error){let n=1;while(fs.existsSync('research/selection-state-assets-failure-'+n+'.json'))n++;fs.writeFileSync('research/selection-state-assets-failure-'+n+'.json',JSON.stringify({message:error.stack,scriptSha256:sha(import.meta.filename),errors,results},null,2)+'\n',{flag:'wx'});throw error;}finally{await browser.close();}
