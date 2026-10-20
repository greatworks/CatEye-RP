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
const ranges=[['style.js',349,592],['style.js',1157,1180],['style.js',1499,1628],['style.js',1763,1915],['style.js',2503,2532],['math.js',30,44]];
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
 querySelector(q){return this.querySelectorAll(q)[0]}getElementsByTagName(q){return this.querySelectorAll(q)}remove(){this.parent.children=this.parent.children.filter(n=>n!==this)}}
var document={createElementNS:(ns,tag)=>new Node(tag),getElementById:id=>svgTag.descendants().find(n=>n.id===id)},window={getComputedStyle:n=>({fill:currentFill,stroke:currentStroke})};
var svgns='http://www.w3.org/2000/svg',svgTag,svgId='svg',styleHtml='',transition='transition: all 0ms;',overridedStyle,viewBoxX=0,viewBoxY=0,currentFill='black',currentStroke='black';
function linear(){return{fillType:'linearGradient',startPoint:{x:0,y:.5},endPoint:{x:1,y:.5},stops:[{offset:0,color:0xFFFF0000},{offset:1,color:0x800000FF}]}}
function radial(){return{fillType:'radialGradient',center:{x:.5,y:.5},axis1:{x:1,y:.5},axis2:{x:.5,y:1},stops:linear().stops}}
function reset(){svgTag=new Node('svg');styleHtml='';currentFill=currentStroke='black';viewBoxX=viewBoxY=0;overridedStyle={size:{width:200,height:100}};viewChain=[];objects={w:{type:'shape',owner:{type:'page'},adaptiveStyles:{},style:{size:{width:200,height:100},stateStyles:{}}}};}
function existing(tag='linearGradient',offsets=[0,1],temp=false){var defs=new Node('defs'),g=new Node(tag);g.id='base';if(temp)g.classList.add('temp_fill');offsets.forEach(offset=>{var s=new Node('stop');s.setAttribute('offset',offset);g.appendChild(s)});defs.appendChild(g);svgTag.appendChild(defs);currentFill='url("#base")';return g}
function result(created){return{created,css:styleHtml,nodes:svgTag.descendants().map(n=>({tag:n.tagName,attrs:n.attrs}))}}
`;
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
vm.runInContext(setup+slices.map(s=>s.text).join('\n'),context,{timeout:1000});
const results=[];
const probe=(name,code,check)=>{const observed=JSON.parse(vm.runInContext(`JSON.stringify((()=>{reset();${code}})())`,context,{timeout:1000}));check(observed);results.push({name,observed,pass:true})};
const gradient=r=>r.nodes.find(n=>n.tag.endsWith('Gradient')).attrs;
probe('linear coordinates scale per dimension and add viewBox origin',`viewBoxX=-3;viewBoxY=4;var f=linear();f.startPoint={x:-.25,y:.25};f.endPoint={x:1.5,y:.75};return result(insertLinearGradient('g',f,'fill'))`,r=>assert.deepEqual(gradient(r),{id:'g',gradientUnits:'userSpaceOnUse',x1:'-53',y1:'29',x2:'297',y2:'79'}));
probe('stops retain original order including duplicates and invalid offsets',`var f=linear();f.stops=[{offset:1.1,color:0},{offset:.3,color:0xFF000000},{offset:.3,color:0xFFFFFFFF},{offset:-.1,color:0x00FFFFFF}];return result(insertLinearGradient('g',f,'fill'))`,r=>assert.deepEqual(r.nodes.filter(n=>n.tag==='stop').map(n=>n.attrs.offset),['1.1','0.3','0.3','-0.1']));
probe('stop color uses unsigned ARGB alpha independent of fill opacity',`var f=linear();f.opacity=.01;return result(insertLinearGradient('g',f,'fill'))`,r=>assert.deepEqual(r.nodes.filter(n=>n.tag==='stop').map(n=>n.attrs['stop-color']),['rgba(255, 0, 0, 1)','rgba(0, 0, 255, 0.5019607843137255)']));
probe('same-type default gradient preserves old offsets while changing colors and points',`existing();var f=linear();f.stops[0].offset=.4;f.stops[1].offset=.6;f.endPoint.x=.7;return result(insertLinearGradient('g',f,'fill'))`,r=>{assert.equal(r.created,false);assert.deepEqual(r.nodes.filter(n=>n.tag==='stop').map(n=>n.attrs.offset),['0','1']);assert.equal(gradient(r).x2,'140');assert.match(r.css,/stop-opacity:1/)});
probe('temporary gradient is removed before lookup so next same-count paint recreates offsets',`existing('linearGradient',[0,1],true);var f=linear();f.stops[0].offset=.4;return result(insertLinearGradient('g',f,'fill'))`,r=>{assert.equal(r.created,true);assert.deepEqual(r.nodes.filter(n=>n.tag==='stop').map(n=>n.attrs.offset),['0.4','1'])});
probe('different stop count preserves default but creates new temporary gradient',`existing('linearGradient',[0,.5,1]);return result(insertLinearGradient('g',linear(),'fill'))`,r=>{assert.equal(r.created,true);assert.equal(r.nodes.filter(n=>n.tag==='linearGradient').length,2)});
probe('different gradient type creates new temporary gradient',`existing('radialGradient');return result(insertLinearGradient('g',linear(),'fill'))`,r=>{assert.equal(r.created,true);assert.equal(r.nodes.filter(n=>n.tag.endsWith('Gradient')).length,2)});
probe('stroke and fill temporary cleanup scopes are independent',`existing('linearGradient',[0,1],true);currentStroke='black';return result(insertLinearGradient('stroke',linear(),'stroke'))`,r=>assert.equal(r.nodes.filter(n=>n.tag==='linearGradient').length,2));
probe('radial non-square dimensions determine radii and transform',`return result(insertRadialGradient('g',radial(),'fill'))`,r=>{assert.equal(gradient(r).r,'100');assert.equal(gradient(r).gradientTransform,'matrix(1 0 0 0.5 0 25)')});
probe('radial axis1 rotation uses physical dimension-scaled direction',`var f=radial();f.axis1={x:.5,y:1.5};f.axis2={x:.75,y:.5};return result(insertRadialGradient('g',f,'fill'))`,r=>assert.equal(gradient(r).gradientTransform,'matrix(0 1 -0.5 0 125 -50)'));
probe('radial viewBox center is rotation and scale pivot',`viewBoxX=-10;viewBoxY=7;return result(insertRadialGradient('g',radial(),'fill'))`,r=>{assert.equal(gradient(r).cx,'90');assert.equal(gradient(r).cy,'57');assert.equal(gradient(r).gradientTransform,'matrix(1 0 0 0.5 0 28.5)')});
probe('radial axis2 direction is discarded when length is identical',`var a=radial();a.axis2={x:.75,y:.5};insertRadialGradient('a',a,'fill');var first=svgTag.querySelector('radialGradient').attrs.gradientTransform;reset();a.axis2={x:.5,y:1};insertRadialGradient('b',a,'fill');return[first,svgTag.querySelector('radialGradient').attrs.gradientTransform]`,r=>assert.equal(r[0],r[1]));
probe('radial zero axis1 writes NaN transform',`var f=radial();f.axis1={...f.center};return result(insertRadialGradient('g',f,'fill'))`,r=>assert.match(gradient(r).gradientTransform,/NaN/));
probe('radial zero axis2 writes singular transform',`var f=radial();f.axis2={...f.center};return result(insertRadialGradient('g',f,'fill'))`,r=>assert.equal(gradient(r).gradientTransform,'matrix(1 0 0 0 0 50)'));
probe('same-count original radial preserves offsets and updates basis',`existing('radialGradient',[.2,.8]);var f=radial();return result(insertRadialGradient('g',f,'fill'))`,r=>{assert.equal(r.created,false);assert.deepEqual(r.nodes.filter(n=>n.tag==='stop').map(n=>n.attrs.offset),['0.2','0.8'])});
probe('zero length linear endpoints remain identical finite coordinates',`var f=linear();f.endPoint={...f.startPoint};return result(insertLinearGradient('g',f,'fill'))`,r=>assert.equal(gradient(r).x1,gradient(r).x2));
probe('solid explicitly replaces gradient fill atomically',`objects.w.style.fill=linear();objects.w.style.stateStyles.selected={fill:{fillType:'solid',color:255,opacity:0}};return _computeFullStyle('w','selected','').fill`,r=>assert.deepEqual(r,{fillType:'solid',color:255,opacity:0}));
probe('state absence retains authored gradient',`objects.w.style.fill=linear();objects.w.style.stateStyles.selected={fontSize:20};return _computeFullStyle('w','selected','').fill`,r=>assert.equal(r.fillType,'linearGradient'));
probe('active selected fill replaces hover fill without merging stops',`objects.w.style.stateStyles={mouseOver:{fill:linear()},selected:{fill:{fillType:'radialGradient'}}};return _computeFullStyle('w','mouseOverSelected','').fill`,r=>assert.deepEqual(r,{fillType:'radialGradient'}));
probe('adaptive fill replaces base and selected replaces adaptive',`objects.w.style.fill=linear();viewChain=['mobile'];objects.w.adaptiveStyles.mobile={fill:radial()};var normal=_computeFullStyle('w','normal','mobile').fill;objects.w.style.stateStyles.selected={fill:{fillType:'solid',color:0}};return[normal.fillType,_computeFullStyle('w','selected','mobile').fill.fillType]`,r=>assert.deepEqual(r,['radialGradient','solid']));
probe('absent fill produces an empty style rule',`setFill();return styleHtml`,r=>assert.equal(r,'#svg .fill {  } '));
probe('solid fill creates direct rgba CSS and no gradient nodes',`overridedStyle.fill={fillType:'solid',color:0x112233,opacity:.4};setFill();return result()`,r=>{assert.match(r.css,/rgba\(17, 34, 51, 0.4\)/);assert.deepEqual(r.nodes,[])});
const out={timestamp:new Date().toISOString(),kind:'Exact retained function slices in Node VM; mocked DOM/CSS sinks, not original GUI or SVG pixel measurement',extractionEvidence:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',sources:sources.map(({lines,...s})=>s),ranges:slices.map(({text,...s})=>({...s,sha256:hash(text)})),results};
fs.writeFileSync('research/gradient-runtime-probes.json',JSON.stringify(out,null,2)+'\n');console.log(`${results.length}/${results.length} original-function probes passed`);
