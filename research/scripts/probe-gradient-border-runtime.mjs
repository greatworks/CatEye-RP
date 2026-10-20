// Exact retained Axure functions, executed only in NodeVM with small DOM sinks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base=process.argv[2]??'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const sources=['style.js','math.js'].map(file=>{const bytes=fs.readFileSync(path.join(base,file));return{file,path:path.join(base,file),sha256:hash(bytes),lines:bytes.toString().split(/\r?\n/)}});
assert.equal(sources[0].sha256,'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c');
assert.equal(sources[1].sha256,'f56ab4a6c3f6e91aaba9bebf2e81485965fc82bca63af0c606593d580c1de883');
const ranges=[['style.js',349,592],['style.js',810,812],['style.js',1157,1388],['style.js',1499,1628],['style.js',1763,1915],['style.js',2503,2532],['math.js',30,44]];
const slices=ranges.map(([file,start,end])=>({file,start,end,text:sources.find(s=>s.file===file).lines.slice(start-1,end).join('\n')}));
const setup=`
var objects={},viewChain=[],_style={},_shapesWithSetRichText={},_idToAppliedStyles={},_selectedWidgets={},_disabledWidgets={},_errorWidgets={},_hintWidgets={};
var _event={mouseOverIds:[],mouseOverObjectId:'',mouseDownObjectId:''},_generateState=()=> 'normal';
var $=()=>{},$obj=id=>objects[id]; $.extend=(target,...sources)=>{for(var source of sources)if(source)for(var key of Object.keys(source))if(source[key]!==undefined)target[key]=source[key];return target};
$.isEmptyObject=o=>Object.keys(o).length===0;$.inArray=(x,list)=>list.indexOf(x);
var $ax={style:_style,getObjectFromElementId:id=>objects[id],adaptive:{currentViewId:'',getAdaptiveIdChain:()=>viewChain},document:{stylesheet:{defaultStyle:{},stylesById:{}}},visibility:{GetCurrentPanelDiagram:()=>null},deepCopy:o=>JSON.parse(JSON.stringify(o)),repeater:{applySuffixToElementId:(id,s)=>id+s},public:{fn:{}}};
class Node {constructor(tag){this.tagName=tag;this.attrs={};this.children=[];this.classes=new Set;this.classList={add:x=>this.classes.add(x)}}
 get id(){return this.attrs.id}set id(v){this.attrs.id=v}setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]}
 appendChild(n){n.parent=this;this.children.push(n)}descendants(){return this.children.flatMap(n=>[n,...n.descendants()])}
 querySelectorAll(q){return this.descendants().filter(n=>q.startsWith('.')?n.classes.has(q.slice(1)):q.startsWith('#')?n.id===q.slice(1):n.tagName===q)}
 querySelector(q){return this.querySelectorAll(q)[0]}getElementsByTagName(q){return this.querySelectorAll(q)}getElementsByClassName(q){return this.querySelectorAll('.'+q)}remove(){this.parent.children=this.parent.children.filter(n=>n!==this)}}
var document={createElementNS:(ns,tag)=>new Node(tag),getElementById:id=>svgTag.descendants().find(n=>n.id===id)},window={getComputedStyle:n=>({fill:currentFill,stroke:currentStroke})};
var obj={friendlyType:'Shape',type:'shape'},originalBorderWidth=1,currentBorderWidth=1;$ax.public.fn.IsCheckBox=t=>t==='checkbox';$ax.public.fn.IsRadioButton=t=>t==='radio';
var svgns='http://www.w3.org/2000/svg',svgTag,svgId='svg',styleHtml='',transition='transition: all 0ms;',overridedStyle,viewBoxX=0,viewBoxY=0,currentFill='black',currentStroke='black';
function linear(){return{fillType:'linearGradient',startPoint:{x:0,y:.5},endPoint:{x:1,y:.5},stops:[{offset:0,color:0xFFFF0000},{offset:1,color:0x800000FF}]}}
function radial(){return{fillType:'radialGradient',center:{x:.5,y:.5},axis1:{x:1,y:.5},axis2:{x:.5,y:1},stops:linear().stops}}
function reset(){obj={friendlyType:'Shape',type:'shape'};svgTag=new Node('svg');styleHtml='';currentFill=currentStroke='black';viewBoxX=viewBoxY=0;overridedStyle={size:{width:200,height:100}};viewChain=[];objects={w:{type:'shape',owner:{type:'page'},adaptiveStyles:{},style:{size:{width:200,height:100},stateStyles:{}}}};}
function existing(tag='linearGradient',offsets=[0,1],temp=false,prop='stroke'){var defs=new Node('defs'),g=new Node(tag);g.id='base';if(temp)g.classList.add('temp_'+prop);offsets.forEach(offset=>{var s=new Node('stop');s.setAttribute('offset',offset);g.appendChild(s)});defs.appendChild(g);svgTag.appendChild(defs);if(prop==='stroke')currentStroke='url("#base")';else currentFill='url("#base")';return g}
function result(created){return{created,css:styleHtml,nodes:svgTag.descendants().map(n=>({tag:n.tagName,attrs:n.attrs}))}}
`;
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
vm.runInContext(setup+slices.map(s=>s.text).join('\n'),context,{timeout:1000});
const results=[];
const probe=(name,code,check)=>{const observed=JSON.parse(vm.runInContext(`JSON.stringify((()=>{reset();${code}})())`,context,{timeout:1000}));check(observed);results.push({name,observed,pass:true})};
probe('linear stroke emits independent stroke and arrowhead paint',`overridedStyle.borderFill=linear();setBorder();return result()`,r=>{assert.match(r.css,/\.stroke \{ stroke: url/);assert.match(r.css,/\.arrowhead \{ stroke: url.*fill: url/);assert.equal(r.nodes.filter(n=>n.tag==='linearGradient').length,1)});
probe('radial stroke uses identical physical axis matrix as fill',`overridedStyle.borderFill=radial();setBorder();return result()`,r=>assert.equal(r.nodes.find(n=>n.tag==='radialGradient').attrs.gradientTransform,'matrix(1 0 0 0.5 0 25)'));
probe('solid border atomically replaces gradient and uses alpha',`overridedStyle.borderFill={fillType:'solid',color:0x123456,opacity:.3};setBorder();return result()`,r=>{assert.match(r.css,/stroke:rgba\(18, 52, 86, 0.3\)/);assert.equal(r.nodes.length,0)});
probe('default stroke preserves original offsets while replacing colors',`existing();overridedStyle.borderFill=linear();overridedStyle.borderFill.stops[0].offset=.3;setBorder();return result()`,r=>{assert.deepEqual(r.nodes.filter(n=>n.tag==='stop').map(n=>n.attrs.offset),['0','1']);assert.match(r.css,/stop-color:rgba\(255, 0, 0, 1\)/)});
probe('temporary stroke updates offsets rather than retaining previous temporary offsets',`existing('linearGradient',[0,1],true);overridedStyle.borderFill=linear();overridedStyle.borderFill.stops[0].offset=.3;setBorder();return result()`,r=>assert.deepEqual(r.nodes.filter(n=>n.tag==='stop').map(n=>n.attrs.offset),['0.3','1']));
probe('fill and stroke temporary definitions both survive their independent paints',`existing('linearGradient',[0,1],true,'fill');overridedStyle.borderFill=radial();setBorder();return result()`,r=>assert.equal(r.nodes.filter(n=>n.tag.endsWith('Gradient')).length,2));
probe('default stroke reuse assigns arrowhead fill and stroke from current stroke',`existing();var arrow=new Node('path');arrow.classList.add('arrowhead');svgTag.appendChild(arrow);overridedStyle.borderFill=linear();setBorder();return arrow.attrs`,r=>assert.deepEqual(r,{fill:'url("#base")',stroke:'url("#base")'}));
probe('line pattern none suppresses stroke even when gradient exists',`overridedStyle.borderFill=linear();overridedStyle.linePattern='none';setBorder();return result()`,r=>{assert.match(r.css,/stroke-width: 0; stroke-dasharray: 0/);assert.match(r.css,/\.arrowhead \{ fill: none/)});
probe('ordinary open path receives exact border width, line style scales dash units',`var p=new Node('path');p.classList.add('stroke');p.setAttribute('d','M 0 0 L 100 0');p.setAttribute('stroke-width',1);svgTag.appendChild(p);overridedStyle.borderWidth=5;overridedStyle.linePatternArray=[2,3];setBorder();return result()`,r=>{assert.equal(r.nodes.find(n=>n.tag==='path').attrs['stroke-width'],'5');assert.match(r.css,/stroke-dasharray:10,15/)});
probe('closed and masked native path doubles width for clipped inside border',`var p=new Node('path');p.classList.add('stroke');p.setAttribute('d','M 0 0 L 100 0 Z');p.setAttribute('mask','url(#m)');p.setAttribute('stroke-width',1);svgTag.appendChild(p);overridedStyle.borderWidth=5;setBorder();return result()`,r=>assert.equal(r.nodes.find(n=>n.tag==='path').attrs['stroke-width'],'10'));
probe('line SVG allows visible overflow',`obj.friendlyType='Horizontal Line';setBorder();return result()`,r=>assert.match(r.css,/#svg \{ overflow:visible/));
probe('checkbox check stroke width is independent of gradient border width',`obj.type='checkbox';obj.buttonSize=28;overridedStyle.borderFill=linear();setBorder();return result()`,r=>assert.match(r.css,/stroke.btn_check \{ stroke-width: 6/));
probe('radio gradient does not assign check fill while solid does',`obj.type='radio';overridedStyle.borderFill=linear();setBorder();var first=styleHtml;styleHtml='';overridedStyle.borderFill={fillType:'solid',color:255};setBorder();return[first,styleHtml]`,r=>{assert.doesNotMatch(r[0],/stroke.btn_check/);assert.match(r[1],/stroke.btn_check \{ fill:/)});
probe('selected border replaces hover border as one object',`objects.w.style.stateStyles={mouseOver:{borderFill:linear()},selected:{borderFill:{fillType:'radialGradient'}}};return _computeFullStyle('w','mouseOverSelected','').borderFill`,r=>assert.deepEqual(r,{fillType:'radialGradient'}));
probe('adaptive border retains absent state and is replaced by solid state',`objects.w.style.borderFill=linear();viewChain=['mobile'];objects.w.adaptiveStyles.mobile={borderFill:radial()};var first=_computeFullStyle('w','normal','mobile').borderFill;objects.w.style.stateStyles.selected={borderFill:{fillType:'solid',color:0}};return[first.fillType,_computeFullStyle('w','selected','mobile').borderFill.fillType]`,r=>assert.deepEqual(r,['radialGradient','solid']));
const imageSlice={file:'style.js',start:753,end:768,text:sources[0].lines.slice(752,768).join('\n')};slices.push(imageSlice);
vm.runInContext(`function imageBorder(style,hasBorderWidth=true){var borderQueryCss={};${imageSlice.text};return borderQueryCss}`,context);
probe('image linear uses first color with native ARGB alpha, ignoring fill opacity',`return imageBorder({borderFill:{fillType:'linearGradient',opacity:.9,colors:[{color:0x80123456},{color:0xFFFFFFFF}]}})`,r=>assert.equal(r['border-color'],'rgba(18,52,86,0.5019607843137255)'));
probe('image radial is transparent black, not opaque black',`return imageBorder({borderFill:radial()})`,r=>assert.equal(r['border-color'],'rgba(0,0,0,0)'));
probe('image empty linear colors throws instead of supplying fallback color',`try{imageBorder({borderFill:{fillType:'linearGradient',colors:[]}});return'no error'}catch(error){return error.name}`,r=>assert.equal(r,'TypeError'));
probe('image zero-width gate does not evaluate empty colors',`return imageBorder({borderFill:{fillType:'linearGradient',colors:[]}},false)`,r=>assert.deepEqual(r,{}));
const out={timestamp:new Date().toISOString(),kind:'Exact retained function slices in Node VM; mocked DOM/CSS sinks, not original GUI or browser pixel measurement',extractionEvidence:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',sources:sources.map(({lines,...s})=>s),ranges:slices.map(({text,...s})=>({...s,sha256:hash(text)})),results};
fs.writeFileSync('research/gradient-border-runtime-probes.json',JSON.stringify(out,null,2)+'\n');console.log(`${results.length}/${results.length} original-function probes passed`);
