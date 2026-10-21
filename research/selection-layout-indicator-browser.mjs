// Controlled DOM execution of exact retained SVG consumer and shipped base CSS.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/';
const files=['resources/scripts/jquery-3.7.1.min.js','resources/scripts/axure/style.js','resources/css/axure_rp_page.css'];
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const source=fs.readFileSync(root+files[1],'utf8').split(/\r?\n/);
const ranges=[[991,1645],[810,812],[2503,2532]];
const slices=ranges.map(([start,end])=>({start,end,text:source.slice(start-1,end).join('\n')}));
const boot=`
var objects={},_idToAppliedStyles={},$obj=id=>objects[id],$jobj=id=>jQuery('#'+id),$=jQuery;
var $ax={style:{},adaptive:{currentViewId:''},public:{fn:{IsCheckBox:t=>t==='checkbox',IsRadioButton:t=>t==='radioButton'}}};
var _computeFullStyle=(id,state,view)=>({borderWidth:1});
${slices.map(x=>x.text).join('\n')}
window.runIndicator=input=>{
 document.body.replaceChildren();
 var owner=document.createElement('div');owner.id='u';owner.className=input.selected?'selected':'';
 owner.style.cssText='position:absolute;left:20px;top:20px;width:100px;height:24px;display:flex;';
 var label=document.createElement('label');label.htmlFor='u_input';label.style.cssText='position:absolute;left:0;width:100%;height:100%;';
 var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='u_img';svg.setAttribute('width','14');svg.setAttribute('height','14');svg.setAttribute('viewBox','0 0 14 14');svg.style.cssText='position:absolute;left:0;top:2px;';
 function path(d,cls,fill,stroke,width){var p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',d);p.setAttribute('class',cls);p.setAttribute('fill',fill);p.setAttribute('stroke',stroke);p.setAttribute('stroke-width',width);svg.append(p);return p;}
 var fill=path('M0 0 H14 V14 H0 Z','fill','#fff','none',0);
 var border=path('M.5 .5 H13.5 V13.5 H.5 Z','stroke','none','#000',1);
 var check=input.type==='checkbox'?path('M3 7 L6 10 L11 3','stroke btn_check','none','#000',3):path('M3.5 7 A3.5 3.5 0 1 0 10.5 7 A3.5 3.5 0 1 0 3.5 7 Z','stroke btn_check','#000','none',0);
 var text=document.createElement('div');text.className='text';text.style.cssText='position:absolute;left:18px;top:0;width:220px;white-space:nowrap;font:16px/20px monospace;';text.textContent='Long explicit label beyond owner';
 label.append(svg,text);var control=document.createElement('input');control.id='u_input';control.type=input.type==='checkbox'?'checkbox':'radio';control.checked=input.selected;control.disabled=input.disabled;
 control.style.cssText='border-width:0px;position:absolute;left:0;top:0;width:0;height:0;opacity:0;';
 owner.append(label,control);document.body.append(owner);
 objects.u={type:input.type,friendlyType:input.type==='checkbox'?'Checkbox':'Radio Button',buttonSize:input.baseSize};
 var before={d:check.getAttribute('d'),svgRect:svg.getBoundingClientRect().toJSON()};
 _applySvg('u','normal',{size:{width:100,height:24},buttonSize:input.overrideSize,borderWidth:input.borderWidth,
   borderFill:{fillType:'solid',color:input.borderColor},fill:{fillType:'solid',color:0xffffffff},linePattern:input.linePattern});
 var css=getComputedStyle(check),inputCss=getComputedStyle(control);
 return {before,after:{d:check.getAttribute('d'),svgRect:svg.getBoundingClientRect().toJSON()},check:{display:css.display,stroke:css.stroke,fill:css.fill,strokeWidth:css.strokeWidth},
   control:{width:inputCss.width,height:inputCss.height,opacity:inputCss.opacity,disabled:control.disabled},ownerOverflow:getComputedStyle(owner).overflow,labelDisplay:getComputedStyle(label).display,css:svg.querySelector('style').textContent};
};
`;
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:600,height:300}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<!doctype html><html><head></head><body></body></html>');
 await page.addStyleTag({content:fs.readFileSync(root+files[2],'utf8')});
 await page.addScriptTag({content:fs.readFileSync(root+files[0],'utf8')});
 await page.addScriptTag({content:boot});
 for(const type of ['checkbox','radioButton'])for(const selected of [false,true])for(const disabled of [false,true]){
  const input={type,selected,disabled,baseSize:14,overrideSize:28,borderWidth:2,borderColor:0xff123456,linePattern:'solid'};
  const actual=await page.evaluate(input=>runIndicator(input),input);
  assert.equal(actual.check.display,selected?'block':'none');
  assert.equal(actual.check.stroke,'rgb(18, 52, 86)');
  assert.equal(actual.check.strokeWidth,type==='checkbox'?'3px':'2px');
  if(type==='radioButton')assert.equal(actual.check.fill,'rgb(18, 52, 86)');
  assert.deepEqual(actual.before,actual.after);
  assert.equal(actual.ownerOverflow,'visible');
  assert.equal(actual.control.width,'0px');assert.equal(actual.control.height,'0px');assert.equal(actual.control.opacity,'0');
  results.push({input,actual,passed:true});
 }
 for(const [baseSize,overrideSize]of [[12,18],[18,12],[undefined,28]]){
  const input={type:'checkbox',selected:true,disabled:false,baseSize,overrideSize,borderWidth:1,borderColor:0xff000000,linePattern:'solid'};
  const actual=await page.evaluate(input=>runIndicator(input),input);
  if(baseSize===undefined)assert.match(actual.css,/stroke-width: NaN/);else assert.match(actual.css,new RegExp('stroke-width: '+String(3*baseSize/14).replaceAll('.','\\.')));
  results.push({input,actual,passed:true});
 }
 assert.deepEqual(errors,[]);
}catch(error){
 let n=1;while(fs.existsSync(`research/selection-layout-indicator-browser-failure-${n}.json`))n++;
 fs.writeFileSync(`research/selection-layout-indicator-browser-failure-${n}.json`,JSON.stringify({message:error.stack,results,errors,sourceHash:sha(import.meta.filename)},null,2)+'\n');
 throw error;
}finally{await browser.close();}
fs.writeFileSync('research/selection-layout-indicator-browser-probes.json',JSON.stringify({
 method:'Headless Edge executing exact retained _applySvg/color functions, retained jQuery and base CSS; constructed bounded DOM/graphic paths. Not vendor GUI or an Axure-generated project.',
 sources:[...files.map(f=>root+f),import.meta.filename,'research/selection-layout-indicator-glyph-probes.json','research/selection-layout-indicator-css-probes.json'].map(path=>({path,sha256:sha(path)})),
 slices:slices.map(({text,...x})=>({...x,sha256:createHash('sha256').update(text).digest('hex')})),
 summary:{total:results.length,passed:results.length,failed:0},errors,
 sinks:['Widget/type/current normal border lookup supplied. Caller state resolution and selected class assignment not executed.','SVG glyph path is independently built from CIL-proven geometry; outer border fixture is controlled, not generated original asset.','Font and measured text rectangle are fixture values. Overflow visible confirms this bounded generated-like structure and shipped CSS only.','Disabled input attribute is supplied; no claim all original disabled-state CSS/classes/assets reproduced.','No image-pattern, gradient, inner-shadow or compound consumers in this matrix.'],results
},null,2)+'\n');
console.log({passed:results.length});
