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
const ranges=[['style.js',349,592],['style.js',810,812],['style.js',1157,1494],['style.js',1499,1628],['style.js',1763,1915],['style.js',2503,2532],['math.js',30,44]];
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
function reset(){originalBorderWidth=1;currentBorderWidth=1;obj={friendlyType:'Shape',type:'shape'};svgTag=new Node('svg');styleHtml='';currentFill=currentStroke='black';viewBoxX=viewBoxY=0;overridedStyle={size:{width:200,height:100}};viewChain=[];objects={w:{type:'shape',owner:{type:'page'},adaptiveStyles:{},style:{size:{width:200,height:100},stateStyles:{}}}};}
function existing(tag='linearGradient',offsets=[0,1],temp=false,prop='stroke'){var defs=new Node('defs'),g=new Node(tag);g.id='base';if(temp)g.classList.add('temp_'+prop);offsets.forEach(offset=>{var s=new Node('stop');s.setAttribute('offset',offset);g.appendChild(s)});defs.appendChild(g);svgTag.appendChild(defs);if(prop==='stroke')currentStroke='url("#base")';else currentFill='url("#base")';return g}
function paths(clipped=false){var stroke=new Node('path'),fill=new Node('path'),arrow=new Node('path');stroke.classList.add('stroke');fill.classList.add('fill');arrow.classList.add('arrowhead');stroke.setAttribute('d','M 0 0 L 200 0'+(clipped?' Z':''));stroke.setAttribute('stroke-width',1);if(clipped)stroke.setAttribute('mask','url(#mask)');arrow.setAttribute('d','M 190 -5 L 200 0 L 190 5 Z');arrow.setAttribute('stroke-width',0);svgTag.appendChild(stroke);svgTag.appendChild(fill);svgTag.appendChild(arrow);return{stroke,fill,arrow}}
function rect(sides='top right bottom left',radius=0){obj.friendlyType='Rectangle';overridedStyle.borderWidth=10;overridedStyle.borderVisibility=sides;overridedStyle.cornerVisibility='top right bottom left';overridedStyle.cornerRadius=radius;return paths()}
function result(created){return{created,css:styleHtml,nodes:svgTag.descendants().map(n=>({tag:n.tagName,attrs:n.attrs}))}}
`;
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
vm.runInContext(setup+slices.map(s=>s.text).join('\n'),context,{timeout:1000});
const results=[];
const probe=(name,code,check)=>{const observed=JSON.parse(vm.runInContext(`JSON.stringify((()=>{reset();${code}})())`,context,{timeout:1000}));check(observed);results.push({name,observed,pass:true})};
const stroke=r=>r.nodes.find(n=>n.tag==='path'&&n.attrs['stroke-width']);
probe('dash entries are width multipliers rather than CSS lengths',`paths();overridedStyle.borderWidth=2.5;overridedStyle.linePatternArray=[3,1,.5,1];setBorder();return result()`,r=>assert.match(r.css,/stroke-dasharray:7.5,2.5,1.25,2.5;/));
probe('SVG dashed label alone does not synthesize a dash sequence',`paths();overridedStyle.borderWidth=4;overridedStyle.linePattern='dashed';setBorder();return result()`,r=>assert.doesNotMatch(r.css,/dasharray/));
probe('zero width bypasses dash assignment and keeps prior path width attribute',`paths();overridedStyle.borderWidth=0;overridedStyle.linePatternArray=[3,1];setBorder();return result()`,r=>{assert.equal(stroke(r).attrs['stroke-width'],'1');assert.doesNotMatch(r.css,/stroke-width|dasharray/)});
probe('absent width bypasses dash assignment',`paths();overridedStyle.linePatternArray=[3,1];setBorder();return result()`,r=>assert.doesNotMatch(r.css,/dasharray/));
probe('empty dash list emits an empty declaration, not a guessed solid preset',`paths();overridedStyle.borderWidth=4;overridedStyle.linePatternArray=[];setBorder();return result()`,r=>assert.match(r.css,/stroke-dasharray:;/));
probe('odd list and explicit zero entries remain unnormalized',`paths();overridedStyle.borderWidth=4;overridedStyle.linePatternArray=[0,1,2];setBorder();return result()`,r=>assert.match(r.css,/stroke-dasharray:0,4,8;/));
probe('none overrides stroke width and dash while arrowhead output only clears fill',`paths();overridedStyle.borderWidth=4;overridedStyle.linePattern='none';overridedStyle.borderFill=linear();setBorder();return result()`,r=>{assert.match(r.css,/stroke-width: 0; stroke-dasharray: 0;/);assert.match(r.css,/\.arrowhead \{ fill: none/);assert.equal(stroke(r).attrs['stroke-width'],'1');assert.doesNotMatch(r.css,/\.arrowhead \{[^}]*stroke-width/)});
probe('open path arrowhead stroke width is current minus original baseline',`paths();originalBorderWidth=3;overridedStyle.borderWidth=8;setBorder();return result()`,r=>assert.match(r.css,/\.arrowhead \{ stroke-width: 5;/));
probe('shrinking width produces a negative arrowhead CSS delta without clamp',`paths();originalBorderWidth=8;overridedStyle.borderWidth=3;setBorder();return result()`,r=>assert.match(r.css,/\.arrowhead \{ stroke-width: -5;/));
probe('closed masked path doubles painted width but dash units use requested width',`paths(true);overridedStyle.borderWidth=4;overridedStyle.linePatternArray=[3,1];setBorder();return result()`,r=>{assert.equal(stroke(r).attrs['stroke-width'],'8');assert.match(r.css,/dasharray:12,4/);assert.doesNotMatch(r.css,/\.arrowhead \{[^}]*stroke-width/)});
probe('cap join and arrowhead geometry are not rewritten by SVG state painter',`var p=paths();p.stroke.setAttribute('stroke-linecap','round');p.stroke.setAttribute('stroke-linejoin','bevel');overridedStyle.borderWidth=6;overridedStyle.lineCap='square';overridedStyle.lineJoin='miter';setBorder();return result()`,r=>{assert.equal(stroke(r).attrs['stroke-linecap'],'round');assert.equal(stroke(r).attrs['stroke-linejoin'],'bevel');assert.equal(r.nodes.find(n=>n.attrs.d?.startsWith('M 190')).attrs.d,'M 190 -5 L 200 0 L 190 5 Z');assert.doesNotMatch(r.css,/linecap|linejoin/)});
probe('gradient dashed stroke and outer shadow coexist on SVG and arrowhead',`paths();overridedStyle.borderWidth=4;overridedStyle.linePatternArray=[3,1];overridedStyle.borderFill=linear();overridedStyle.outerShadow={on:true,offsetX:2,offsetY:3,blurRadius:4,color:0x80000000};setBorder();setOuterShadow();return result()`,r=>{assert.match(r.css,/stroke: url/);assert.match(r.css,/dasharray:12,4/);assert.match(r.css,/#svg \{ filter: drop-shadow\(2px 3px 4px/)});
probe('inner shadow targets fill only and does not replace the arrowhead or stroke paint',`paths();overridedStyle.borderWidth=4;overridedStyle.borderFill=linear();overridedStyle.innerShadow={on:true,offsetX:1,offsetY:2,blurRadius:4,spread:0,color:0x80000000};setBorder();setInnerShadow();return result()`,r=>{assert.match(r.css,/#svg \.fill, #svg \.background-image \{ filter:/);assert.equal(r.nodes.filter(n=>n.tag==='linearGradient').length,1);assert.equal(r.nodes.filter(n=>n.tag==='filter').length,1)});
for(let bits=0;bits<16;bits++){
  const names=['top','right','bottom','left'],sides=names.filter((_,i)=>bits&(1<<i));
  probe(`rectangle visible sides ${sides.join('+')||'none'}`,`var p=rect(${JSON.stringify(sides.join(' '))},0);setBorder();return{stroke:p.stroke.attrs,fill:p.fill.attrs,css:styleHtml}`,r=>{
    assert.equal((r.stroke.d.match(/\bL\b/g)||[]).length,sides.length);assert.equal(/\bZ\b/.test(r.stroke.d),bits===15);assert.match(r.fill.d,/Z$/);assert.equal((r.fill.d.match(/\bL\b/g)||[]).length,4);assert.equal(r.stroke.mask,'');assert.equal(r.fill.mask,'');
  });
}
probe('top-only stroke square joins with hidden sides while opposite fill corners remain rounded',`var p=rect('top',20);setBorder();return{stroke:p.stroke.attrs.d,fill:p.fill.attrs.d}`,r=>{assert.equal(r.stroke,'M 0 5 L 200 5');assert.equal((r.fill.match(/\bC\b/g)||[]).length,2);assert.match(r.fill,/L 200 80 C 200 91.2 191.2 100 180 100/)});
probe('all sides with radius rounds inward stroke and keeps independent full-size fill',`var p=rect(undefined,20);setBorder();return{stroke:p.stroke.attrs.d,fill:p.fill.attrs.d}`,r=>{assert.match(r.stroke,/M 20 5 L 180 5 C 188.4 5 195 11.6 195 20/);assert.match(r.fill,/M 20 0 L 180 0 C 191.2 0 200 8.8 200 20/)});
probe('hidden all sides keeps complete rounded fill',`var p=rect('',20);setBorder();return{stroke:p.stroke.attrs.d,fill:p.fill.attrs.d}`,r=>{assert.equal(r.stroke,'');assert.equal((r.fill.match(/\bC\b/g)||[]).length,4)});
probe('rectangle path dimensions round to integers before corner and side calculations',`var p=rect(undefined,0);overridedStyle.size={width:100.4,height:50.6};setBorder();return{stroke:p.stroke.attrs.d,fill:p.fill.attrs.d}`,r=>{assert.equal(r.stroke,'M 5 5 L 95 5 L 95 46 L 5 46 L 5 5 Z');assert.equal(r.fill,'M 0 0 L 100 0 L 100 51 L 0 51 L 0 0 Z')});
probe('changing side visibility rewrites full paths and removes old corners',`var p=rect(undefined,20);setBorder();var first=p.stroke.attrs.d;overridedStyle.borderVisibility='top';styleHtml='';setBorder();return{first,second:p.stroke.attrs.d}`,r=>{assert.match(r.first,/C/);assert.equal(r.second,'M 0 5 L 200 5')});
probe('selected dash list overrides hover list atomically and does not affect border color',`objects.w.style.borderFill=linear();objects.w.style.stateStyles={mouseOver:{linePatternArray:[3,1]},selected:{linePatternArray:[1,2,3,4]}};return _computeFullStyle('w','mouseOverSelected','')`,r=>{assert.deepEqual(r.linePatternArray,[1,2,3,4]);assert.equal(r.borderFill.fillType,'linearGradient')});
const imageSlice={file:'style.js',start:750,end:751,text:sources[0].lines.slice(749,751).join('\n')};slices.push(imageSlice);
vm.runInContext(`function imagePattern(style,hasBorderWidth=true){var borderQueryCss={};${imageSlice.text};return borderQueryCss}`,context);
probe('image pattern passes CSS keyword verbatim instead of SVG dash array',`return['solid','dashed','dotted','double','none'].map(linePattern=>imagePattern({linePattern,linePatternArray:[7,3]}))`,r=>assert.deepEqual(r.map(x=>x['border-style']),['solid','dashed','dotted','double','none']));
probe('image absent or zero-width gate leaves border style unchanged',`return[imagePattern({}),imagePattern({linePattern:'dashed'},false)]`,r=>assert.deepEqual(r,[{},{}]));
const out={timestamp:new Date().toISOString(),kind:'Exact retained original function slices in Node VM with mocked DOM/CSS sinks; not vendor GUI or browser pixel evidence',extractionEvidence:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',sources:sources.map(({lines,...s})=>s),ranges:slices.map(({text,...s})=>({...s,sha256:hash(text)})),results};
fs.writeFileSync('research/line-style-runtime-probes.json',JSON.stringify(out,null,2)+'\n');console.log(`${results.length}/${results.length} original-function probes passed`);
