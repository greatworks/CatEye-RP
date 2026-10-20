// Native corner behavior: exact retained slices with mocked DOM/CSS sinks. No vendor DLL execution.
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
const ranges=[['style.js',349,592],['style.js',810,812],['style.js',928,962],['style.js',1157,1494],['style.js',1499,1628],['style.js',1763,1915],['style.js',2503,2532],['math.js',30,44]];
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
vm.runInContext(`var divClasses=new Set,divExists=true;
var $jobj=id=>({length:divExists?1:0,removeClass:c=>divClasses.delete(c),addClass:c=>divClasses.add(c)});
function cornerResult(input) {
  reset(); divClasses=new Set;divExists=input.divExists!==false;
  var p=rect(input.borderVisibility,input.radius);
  overridedStyle.size={width:input.width,height:input.height};
  overridedStyle.borderWidth=input.borderWidth;
  overridedStyle.cornerVisibility=input.cornerVisibility;
  if(input.friendlyType)obj.friendlyType=input.friendlyType;
  if(input.linePattern)overridedStyle.linePattern=input.linePattern;
  setBorder();
  _updateCornersForBorders('w',overridedStyle);
  return {strokeD:p.stroke.attrs.d,fillD:p.fill.attrs.d??null,strokeAttrs:p.stroke.attrs,fillAttrs:p.fill.attrs,classes:[...divClasses].sort(),css:styleHtml};
}`,context,{timeout:1000});
const results=[];
const cornerNames=['left','top','right','bottom'];
const borderNames=['top','right','bottom','left'];
const cornerClasses=['nocrntl','nocrntr','nocrnbr','nocrnbl'];
const sides=[[3,0],[0,1],[1,2],[2,3]];
function makeInput(cornerMask,borderMask,radius=20,width=200,height=100,borderWidth=10){
  return {cornerMask,borderMask,width,height,radius,borderWidth,
    cornerVisibility:cornerNames.filter((_,i)=>cornerMask&(1<<i)).join(' '),
    borderVisibility:borderNames.filter((_,i)=>borderMask&(1<<i)).join(' ')};
}
function execute(name,input,check){
  const observed=JSON.parse(vm.runInContext(`JSON.stringify(cornerResult(${JSON.stringify(input)}))`,context,{timeout:1000}));
  check?.(observed);results.push({name,input,observed,pass:true});return observed;
}
function checkMask(input,r){
  const c=cornerNames.map((_,i)=>Boolean(input.cornerMask&(1<<i))),b=borderNames.map((_,i)=>Boolean(input.borderMask&(1<<i)));
  const stroked=sides.map(([a,z],i)=>input.radius>0&&c[i]&&b[a]&&b[z]);
  const filled=sides.map(([a,z],i)=>input.radius>0&&c[i]&&b[a]===b[z]);
  assert.equal((r.strokeD.match(/\bC\b/g)||[]).length,stroked.filter(Boolean).length);
  assert.equal((r.fillD.match(/\bC\b/g)||[]).length,filled.filter(Boolean).length);
  assert.equal(/\bZ\b/.test(r.strokeD),input.borderMask===15);
  assert.match(r.fillD,/Z$/);
  assert.deepEqual(r.classes,input.radius>0?cornerClasses.filter((_,i)=>!filled[i]).sort():[]);
}
for(let cornerMask=0;cornerMask<16;cornerMask++)for(let borderMask=0;borderMask<16;borderMask++){
  const input=makeInput(cornerMask,borderMask);
  execute(`mask-${cornerMask}-border-${borderMask}`,input,r=>checkMask(input,r));
}
for(const [name,cornerMask,borderMask,radius,width,height] of [
  ['large-single-TL',1,15,90,200,100],['large-diagonal',5,15,90,200,100],
  ['large-same-column',9,15,90,200,100],['large-same-row',3,15,90,100,200],
  ['large-all',15,15,90,200,100],['large-all-borders-hidden',15,0,90,200,100],
  ['large-top-only',15,1,90,200,100],['large-left-only',15,8,90,200,100],
  ['above-full-axis',1,15,999,200,100],['radius-below-stroke-half',15,15,1,200,100],
  ['rounded-fractional-size',1,15,90,100.4,50.6],['zero-radius',15,15,0,200,100],
  ['negative-radius-input',15,15,-3,200,100],['explicit-no-corners',0,15,20,200,100]
]){
  const input=makeInput(cornerMask,borderMask,radius,width,height);
  execute(name,input,r=>checkMask(input,r));
}
execute('zero-width-skips-SVG-rebuild',makeInput(1,15,20,200,100,0),r=>{assert.equal(r.strokeD,'M 0 0 L 200 0');assert.equal(r.fillD,null);assert.deepEqual(r.classes,['nocrnbl','nocrnbr','nocrntr'])});
execute('none-line-pattern-skips-SVG-rebuild',{...makeInput(1,15),linePattern:'none'},r=>{assert.equal(r.strokeD,'M 0 0 L 200 0');assert.equal(r.fillD,null);assert.match(r.css,/stroke-width: 0/)});
execute('nonrectangle-does-not-reconstruct',{...makeInput(1,15),friendlyType:'Custom Shape'},r=>{assert.equal(r.strokeD,'M 0 0 L 200 0');assert.equal(r.fillD,null)});
execute('missing-div-skips-class-update',{...makeInput(1,15),divExists:false},r=>assert.deepEqual(r.classes,[]));
function codeProbe(name,code,check){const observed=JSON.parse(vm.runInContext(`JSON.stringify((()=>{reset();${code}})())`,context,{timeout:1000}));check(observed);results.push({name,observed,pass:true})}
codeProbe('radius-zero-clears-old-disable-classes',`divExists=true;divClasses=new Set(['nocrntl','nocrntr','nocrnbr','nocrnbl']);_updateCornersForBorders('w',{cornerRadius:0});return [...divClasses]`,r=>assert.deepEqual(r,[]));
codeProbe('missing-corner-key-is-not-default-all',`try{var p=rect(undefined,20);delete overridedStyle.cornerVisibility;setBorder();return {error:null}}catch(e){return {error:e.name}}`,r=>assert.equal(r.error,'TypeError'));
codeProbe('missing-border-key-is-not-default-all',`try{var p=rect(undefined,20);delete overridedStyle.borderVisibility;setBorder();return {error:null}}catch(e){return {error:e.name}}`,r=>assert.equal(r.error,'TypeError'));
codeProbe('corner-selected-mask-and-hover-radius-are-independent',`objects.w.style.cornerRadius=5;objects.w.style.cornerVisibility='left top right bottom';objects.w.style.stateStyles={mouseOver:{cornerRadius:30},selected:{cornerVisibility:'left'}};return _computeFullStyle('w','mouseOverSelected','')`,r=>{assert.equal(r.cornerRadius,30);assert.equal(r.cornerVisibility,'left')});
codeProbe('explicit-empty-state-mask-preserved',`objects.w.style.cornerRadius=5;objects.w.style.cornerVisibility='left top right bottom';objects.w.style.stateStyles={selected:{cornerVisibility:''}};return _computeFullStyle('w','selected','')`,r=>{assert.equal(r.cornerRadius,5);assert.equal(r.cornerVisibility,'')});
codeProbe('state-radius-zero-preserved-with-independent-mask',`objects.w.style.cornerRadius=5;objects.w.style.cornerVisibility='left';objects.w.style.stateStyles={selected:{cornerRadius:0}};return _computeFullStyle('w','selected','')`,r=>{assert.equal(r.cornerRadius,0);assert.equal(r.cornerVisibility,'left')});
codeProbe('successive-mask-clears-stale-corner-classes',`divExists=true;divClasses=new Set;_updateCornersForBorders('w',{cornerRadius:20,borderVisibility:'top right bottom left',cornerVisibility:'left'});var first=[...divClasses].sort();_updateCornersForBorders('w',{cornerRadius:20,borderVisibility:'top right bottom left',cornerVisibility:'top right bottom left'});return{first,second:[...divClasses]}`,r=>{assert.equal(r.first.length,3);assert.deepEqual(r.second,[])});
const cssPath=path.join(base,'../../css/axure_rp_page.css');
const output={timestamp:new Date().toISOString(),kind:'Exact retained original JS slices executed in Node VM; mocked object lookup and DOM/CSS sinks. Not original GUI, native DLL execution, or browser pixels.',extractionEvidence:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',sources:[...sources.map(({lines,...s})=>s),{file:'axure_rp_page.css',path:cssPath,sha256:hash(fs.readFileSync(cssPath))}],ranges:slices.map(({text,...s})=>({...s,sha256:hash(text)})),matrix:{cornerOrder:['topLeft','topRight','bottomRight','bottomLeft'],cornerBits:[1,2,4,8],borderOrder:['top','right','bottom','left'],borderBitsInThisHarness:[1,2,4,8],nativePositionBorderBits:[2,4,8,1],standardCaseCount:256},results};
fs.writeFileSync('research/native-corners-runtime-probes.json',JSON.stringify(output,null,2)+'\n');
console.log(`${results.length}/${results.length} original-function corner probes passed`);


