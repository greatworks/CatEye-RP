// Execute retained original JavaScript slices against a declared SVG fixture.
// No product implementation imports, native target launch, or DLL execution.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const root='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/';
const files=['resources/scripts/jquery-3.7.1.min.js','resources/scripts/axure/style.js','resources/css/axure_rp_page.css'];
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha(root+files[1]),'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c');
const lines=fs.readFileSync(root+files[1],'utf8').split(/\r?\n/);
const slices=[[991,1645],[810,812],[2503,2532]].map(([start,end])=>({start,end,text:lines.slice(start-1,end).join('\n')}));
const boot=`
var objects={},normal={},_idToAppliedStyles={},$obj=id=>objects[id],$jobj=id=>jQuery('#'+id),$=jQuery;
var $ax={style:{},adaptive:{currentViewId:''},public:{fn:{IsCheckBox:t=>t==='checkbox',IsRadioButton:t=>t==='radioButton'}}};
var _computeFullStyle=(id,state,view)=>normal;
${slices.map(s=>s.text).join('\n')}
window.runSequence=input=>{
 document.body.replaceChildren();
 const ns='http://www.w3.org/2000/svg',owner=document.createElement('div');owner.id='u';
 owner.className=input.selected?'selected':'';
 const label=document.createElement('label');label.htmlFor='u_input';
 const svg=document.createElementNS(ns,'svg');svg.id='u_img';svg.setAttribute('viewBox','0 0 14 14');
 svg.setAttribute('width',14);svg.setAttribute('height',14);
 const create=(id,d,cl,attrs)=>{const p=document.createElementNS(ns,'path');p.id=id;p.setAttribute('d',d);p.setAttribute('class',cl);for(const[k,v]of Object.entries(attrs))p.setAttribute(k,v);svg.append(p);return p;};
 const fill=create('fill','M0 0 H14 V14 H0 Z','fill',{fill:'rgb(241, 242, 243)',stroke:'none'});
 const outline=create('outline','M.5 .5 H13.5 V13.5 H.5 Z','stroke',{fill:'none',stroke:'rgb(17, 34, 51)','stroke-width':input.initialWidth});
 const mark=create('mark',input.type==='checkbox'?'M3 7 L6 10 L11 3':'M3.5 7 A3.5 3.5 0 1 0 10.5 7 A3.5 3.5 0 1 0 3.5 7 Z','stroke btn_check',input.type==='checkbox'?{fill:'none',stroke:'rgb(17, 34, 51)','stroke-width':3}:{fill:'rgb(17, 34, 51)',stroke:'none'});
 const control=document.createElement('input');control.id='u_input';control.type=input.type==='checkbox'?'checkbox':'radio';control.disabled=input.disabled;control.checked=input.selected;
 label.append(svg);owner.append(label,control);document.body.append(owner);
 objects.u={type:input.type,friendlyType:input.type==='checkbox'?'Checkbox':'Radio Button',buttonSize:14};normal={borderWidth:input.initialWidth};
 const read=p=>{const c=getComputedStyle(p);return{attributes:Object.fromEntries([...p.attributes].map(a=>[a.name,a.value])),computed:{fill:c.fill,stroke:c.stroke,strokeWidth:c.strokeWidth,display:c.display}};};
 const result=[{name:'initial',fill:read(fill),outline:read(outline),mark:read(mark),css:''}];
 for(const step of input.steps){
  _applySvg('u',step.event,{size:{width:100,height:24},buttonSize:28,...step.style});
  result.push({name:step.name,fill:read(fill),outline:read(outline),mark:read(mark),css:svg.querySelector('style').textContent});
 }
 return result;
};
window.colorCarriers=input=>({fill:_getColorFromFill(input),argb:_getColorFromArgbColorProp(input.color)});
`;
const paint=(color,opacity)=>({fillType:'solid',color,...(opacity===undefined?{}:{opacity})});
const steps=[
 {name:'opaque-width-2',event:'normal',style:{fill:paint(0xff123456,1),borderFill:paint(0xff345678,1),borderWidth:2,linePattern:'solid'}},
 {name:'alpha-width-3',event:'selected',style:{fill:paint(0xff123456,.35),borderFill:paint(0xff345678,.5),borderWidth:3,linePattern:'solid'}},
 {name:'zero-width',event:'disabled',style:{fill:paint(0xff123456,.35),borderFill:paint(0xff345678,.5),borderWidth:0,linePattern:'solid'}},
 {name:'pattern-none',event:'disabled',style:{fill:paint(0xff123456,.35),borderFill:paint(0xff345678,.5),borderWidth:2,linePattern:'none'}},
 {name:'transparent-nonnull',event:'selected',style:{fill:paint(0xff123456,0),borderFill:paint(0xff345678,0),borderWidth:2,linePattern:'solid'}},
 {name:'absent-fill-and-border',event:'normal',style:{borderWidth:1,linePattern:'solid'}},
 {name:'null-fill-and-border',event:'normal',style:{fill:null,borderFill:null,borderWidth:0,linePattern:'solid'}},
 {name:'restore',event:'normal',style:{fill:paint(0xff123456,1),borderFill:paint(0xff345678,1),borderWidth:2,linePattern:'solid'}},
];
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[],colors=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:600,height:300}});page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent('<!doctype html><html><head></head><body></body></html>');
 await page.addStyleTag({content:fs.readFileSync(root+files[2],'utf8')});
 await page.addScriptTag({content:fs.readFileSync(root+files[0],'utf8')});await page.addScriptTag({content:boot});
 for(const type of ['checkbox','radioButton'])for(const initialWidth of [0,1,3])for(const selected of [false,true])for(const disabled of [false,true]){
  const input={type,initialWidth,selected,disabled,steps},actual=await page.evaluate(input=>runSequence(input),input);
  const pick=name=>actual.find(a=>a.name===name), initial=pick('initial');
  for(const state of actual){
   for(const node of ['fill','outline','mark']){const removeWidth=({['stroke-width']:_,...attributes})=>attributes;assert.deepEqual(removeWidth(state[node].attributes),removeWidth(initial[node].attributes));}
   assert.equal(state.mark.computed.display,selected?'inline':'none');
  }
  assert.equal(pick('alpha-width-3').fill.computed.fill,'rgba(18, 52, 86, 0.35)');
  assert.equal(pick('alpha-width-3').mark.computed.stroke,'rgba(52, 86, 120, 0.5)');
  assert.equal(pick('zero-width').outline.computed.strokeWidth,'3px');
  assert.equal(pick('zero-width').mark.computed.strokeWidth,'3px');
  assert.equal(pick('pattern-none').outline.computed.strokeWidth,'0px');
  assert.equal(pick('pattern-none').mark.computed.strokeWidth,type==='checkbox'?'3px':'0px');
  assert.equal(pick('transparent-nonnull').fill.computed.fill,'rgba(18, 52, 86, 0)');
  assert.equal(pick('transparent-nonnull').mark.computed.stroke,'rgba(52, 86, 120, 0)');
  if(type==='radioButton'){
   assert.equal(initial.mark.computed.stroke,'none');
   assert.equal(pick('alpha-width-3').mark.computed.fill,'rgba(52, 86, 120, 0.5)');
   assert.equal(pick('absent-fill-and-border').mark.computed.stroke,'none');
  }
  for(const name of ['absent-fill-and-border','null-fill-and-border']){
   assert.equal(pick(name).fill.computed.fill,initial.fill.computed.fill);
   assert.equal(pick(name).mark.computed.fill,initial.mark.computed.fill);
  }
  assert.deepEqual(pick('restore').mark,pick('opaque-width-2').mark);
  results.push({input,actual,passed:true});
 }
 for(const color of [0x00123456,0x80123456,0xff123456])for(const opacity of [undefined,0,.5,1]){
  const input=paint(color,opacity),actual=await page.evaluate(input=>colorCarriers(input),input);
  assert.equal(actual.fill,`rgba(18, 52, 86, ${opacity??1})`);
  assert.equal(actual.argb,`rgba(18, 52, 86, ${Math.floor(color/16777216)/255})`);
  colors.push({input,actual,passed:true});
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync('research/selection-paint-runtime-probes-second.json',JSON.stringify({target:'Axure RP 11.0.0.4150',method:'Exact original style.js slices in Edge; constructed initial SVG. State resolver, native graphics and original GUI not executed.',sources:[...files.map(f=>root+f),import.meta.filename].map(path=>({path,sha256:sha(path)})),slices:slices.map(({text,...s})=>({...s,sha256:createHash('sha256').update(text).digest('hex')})),summary:{sequences:results.length,svgObservations:results.length*9,colorCarriers:colors.length,passed:results.length+colors.length,failed:0},errors,results,colors},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({sequences:results.length,observations:results.length*9,colors:colors.length}));
}catch(error){fs.writeFileSync('research/selection-paint-runtime-failure-2.json',JSON.stringify({message:error.stack,scriptSha256:sha(import.meta.filename),results,colors,errors},null,2)+'\n',{flag:'wx'});throw error;}finally{await browser.close();}

