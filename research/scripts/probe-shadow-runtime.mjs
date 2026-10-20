// Research-only: exact retained Axure function slices in Node VM, with mocked DOM sinks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const filename = path.join(base, 'style.js'), bytes = fs.readFileSync(filename);
assert.equal(sha(bytes), 'f19830b3fe20d1460c64cada136b8f1aeb38ad7aa67d89dc6b034d0d4689f14c');
const lines = bytes.toString('utf8').split(/\r?\n/), slice = (a,b) => lines.slice(a-1,b).join('\n');
const ranges = [[349,592],[706,812],[1390,1494],[1763,1915],[2444,2532]];
const setup = `
var objects={},viewChain=[],_style={},_shapesWithSetRichText={},_idToAppliedStyles={},_selectedWidgets={},_disabledWidgets={},_errorWidgets={},_hintWidgets={};
var _event={mouseOverIds:[],mouseOverObjectId:'',mouseDownObjectId:''},_generateState=()=> 'normal';
var $=()=>{},$obj=id=>objects[id];
$.extend=(target,...sources)=>{for(var source of sources)if(source)for(var key of Object.keys(source))if(source[key]!==undefined)target[key]=source[key];return target};
$.isEmptyObject=o=>Object.keys(o).length===0;$.inArray=(x,list)=>list.indexOf(x);
var $ax={style:_style,getObjectFromElementId:id=>objects[id],adaptive:{currentViewId:'',getAdaptiveIdChain:()=>viewChain},document:{stylesheet:{defaultStyle:{},stylesById:{}}},visibility:{GetCurrentPanelDiagram:()=>null},deepCopy:o=>JSON.parse(JSON.stringify(o)),repeater:{applySuffixToElementId:(id,s)=>id+s},public:{fn:{}}};
function Node(name){this.name=name;this.attrs={};this.children=[];this.setAttribute=(k,v)=>this.attrs[k]=String(v);this.getAttribute=k=>this.attrs[k];this.appendChild=n=>this.children.push(n);this.querySelector=q=>this.children.flatMap(n=>[n,...n.descendants()]).find(n=>q[0]==='#'?n.attrs.id===q.slice(1):n.name===q);this.descendants=()=>this.children.flatMap(n=>[n,...n.descendants()]);this.getElementsByTagName=q=>this.descendants().filter(n=>n.name===q);}
var document={createElementNS:(ns,name)=>new Node(name)},svgns='http://www.w3.org/2000/svg',svgTag,svgId='svg_row_1',styleHtml='',transition='transition: all 0ms;',overridedStyle;
var queryStates={};function $jobj(id){var state=queryStates[id]??=( {css:{},width:100,height:40} );return{length:1,width:()=>state.width,height:()=>state.height,attr:(k,v)=>{if(k==='style'&&v==='')state.css={}},css:props=>Object.assign(state.css,props)}}
_style.elementHasAnyImageOverride=()=>true;
function shadow(on=true,x=3,y=-4,blur=6){return{on,offsetX:x,offsetY:y,blurRadius:blur,color:{r:17,g:34,b:51,a:.4}}}
function reset(){viewChain=[];_shapesWithSetRichText={};queryStates={};objects={w:{type:'shape',owner:{type:'page'},adaptiveStyles:{},style:{size:{width:100,height:40},borderWidth:0,stateStyles:{}}}};svgTag=new Node('svg');styleHtml='';overridedStyle={};}
function svg(style,inner=true){overridedStyle=style;styleHtml='';setOuterShadow();if(inner)setInnerShadow();return{css:styleHtml,nodes:svgTag.descendants().map(n=>({name:n.name,attrs:n.attrs}))}}
`;
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
vm.runInContext(setup+ranges.map(([a,b])=>slice(a,b)).join('\n'),context,{timeout:1000});
const results=[];
const probe=(name,code,check)=>{const observed=JSON.parse(vm.runInContext(`JSON.stringify((()=>{reset();${code}})())`,context,{timeout:1000}));check(observed);results.push({name,observed,pass:true})};
probe('text shadow uses raw signed fractional offsets and blur',`return _getCssShadow(shadow(true,-1.25,2.5,3.75));`,r=>assert.equal(r,'-1.25px 2.5px 3.75px rgba(17, 34, 51, 0.4)'));
probe('text shadow explicit off is none',`return _getCssShadow(shadow(false));`,r=>assert.equal(r,'none'));
probe('zero blur and zero offsets remain valid shadow',`return _getCssShadow(shadow(true,0,0,0));`,r=>assert.equal(r,'0px 0px 0px rgba(17, 34, 51, 0.4)'));
probe('text shadow targets paragraph and applyAll but not runs',`return _getCssStyleProperties({textShadow:shadow()});`,r=>{assert.equal(r.parProps.textShadow,r.allProps.textShadow);assert.deepEqual(r.runProps,{})});
probe('absent text shadow emits no declaration',`return _getCssStyleProperties({});`,r=>assert.deepEqual(r,{allProps:{},parProps:{},runProps:{}}));
probe('paragraph shadow on and off apply while span and anchor remain untouched',`var props=_getCssStyleProperties({textShadow:shadow(false)});return ['P','SPAN','A','INPUT'].map(name=>{var el={nodeName:name,style:{textShadow:'original'}};_applyCssProps(el,props,name==='INPUT');return el});`,r=>assert.deepEqual(r.map(n=>n.style.textShadow),['none','original','original','none']));
probe('base shadow inherited when state does not mention it',`objects.w.style.outerShadow=shadow();objects.w.style.stateStyles.selected={fontSize:20};return _computeFullStyle('w','selected','').outerShadow;`,r=>assert.equal(r.blurRadius,6));
probe('state shadow is whole-object replacement, not nested merge',`objects.w.style.outerShadow=shadow();objects.w.style.stateStyles.selected={outerShadow:{on:false}};return _computeFullStyle('w','selected','').outerShadow;`,r=>assert.deepEqual(r,{on:false}));
probe('hover and selected combine different shadow families',`objects.w.style.stateStyles={mouseOver:{outerShadow:shadow()},selected:{innerShadow:{...shadow(),spread:2}}};var a=_computeFullStyle('w','mouseOverSelected','');return{outer:a.outerShadow,inner:a.innerShadow};`,r=>{assert.equal(r.outer.on,true);assert.equal(r.inner.spread,2)});
probe('selected explicit off replaces active hover outer shadow',`objects.w.style.stateStyles={mouseOver:{outerShadow:shadow()},selected:{outerShadow:shadow(false)}};return _computeFullStyle('w','mouseOverSelected','').outerShadow;`,r=>assert.equal(r.on,false));
probe('adaptive shadow replaces authored shadow',`objects.w.style.outerShadow=shadow();viewChain=['mobile'];objects.w.adaptiveStyles.mobile={outerShadow:shadow(true,8,9,10)};return _computeFullStyle('w','normal','mobile').outerShadow;`,r=>assert.equal(r.offsetX,8));
probe('state replaces adaptive shadow',`viewChain=['mobile'];objects.w.adaptiveStyles.mobile={outerShadow:shadow()};objects.w.style.stateStyles.selected={outerShadow:shadow(false)};return _computeFullStyle('w','selected','mobile').outerShadow;`,r=>assert.equal(r.on,false));
probe('named state shadow local off wins atomically',`$ax.document.stylesheet.stylesById.named={outerShadow:shadow()};objects.w.style.stateStyles.selected={baseStyle:'named',outerShadow:{on:false}};return _computeFullStyle('w','selected','').outerShadow;`,r=>assert.deepEqual(r,{on:false}));
probe('SetRichText font exclusion retains adaptive text shadow',`viewChain=['mobile'];_shapesWithSetRichText.w=true;objects.w.adaptiveStyles.mobile={fontSize:90,textShadow:shadow()};return _computeAllOverrides('w',null,'normal','mobile');`,r=>{assert.equal(r.fontSize,undefined);assert.equal(r.textShadow.on,true)});
probe('SVG outer uses drop-shadow unhalved blur',`return svg({outerShadow:shadow()},false);`,r=>assert.match(r.css,/drop-shadow\(3px -4px 6px rgba/));
probe('SVG outer off emits selector without filter',`return svg({outerShadow:shadow(false)},false);`,r=>assert.equal(r.css,'#svg_row_1 { transition: all 0ms; } '));
probe('SVG inner primitive graph uses half blur plus border spread',`return svg({borderWidth:2,innerShadow:{...shadow(),spread:4}});`,r=>{assert.deepEqual(r.nodes.map(n=>n.name),['defs','filter','feOffset','feMorphology','feGaussianBlur','feComposite','feFlood','feComposite','feComposite']);assert.equal(r.nodes.find(n=>n.name==='feGaussianBlur').attrs.stdDeviation,'3');assert.equal(r.nodes.find(n=>n.name==='feMorphology').attrs.radius,'6');assert.match(r.css,/\.fill, #svg_row_1 \.background-image/)});
probe('SVG inner update mutates existing graph without duplicate filter',`svg({borderWidth:2,innerShadow:{...shadow(),spread:4}});return svg({borderWidth:'1',innerShadow:{...shadow(true,-9,11,8),spread:3}});`,r=>{assert.equal(r.nodes.filter(n=>n.name==='filter').length,1);assert.equal(r.nodes.find(n=>n.name==='feOffset').attrs.dx,'-9');assert.equal(r.nodes.find(n=>n.name==='feGaussianBlur').attrs.stdDeviation,'4');assert.equal(r.nodes.find(n=>n.name==='feMorphology').attrs.radius,'4')});
probe('SVG inner off preserves unused graph but removes active reference',`svg({borderWidth:0,innerShadow:{...shadow(),spread:0}});return svg({innerShadow:{on:false}});`,r=>{assert.equal(r.nodes.filter(n=>n.name==='filter').length,1);assert.doesNotMatch(r.css,/url\(/)});
probe('SVG inner zero blur spread and border preserved',`return svg({borderWidth:0,innerShadow:{...shadow(true,0,0,0),spread:0}});`,r=>{assert.equal(r.nodes.find(n=>n.name==='feMorphology').attrs.radius,'0');assert.equal(r.nodes.find(n=>n.name==='feGaussianBlur').attrs.stdDeviation,'0')});
probe('image outer CSS uses fixed zero spread regardless supplied spread',`objects.w.style.outerShadow={...shadow(),spread:99};_updateElementIdImageStyle('w','normal');return queryStates.w_img.css;`,r=>assert.equal(r['box-shadow'],'3px -4px 6px 0px rgba(17,34,51,0.4)'));
probe('image repaint clears old shadow when explicit off',`objects.w.style.outerShadow=shadow();_updateElementIdImageStyle('w','normal');objects.w.style.outerShadow=shadow(false);_updateElementIdImageStyle('w','normal');return queryStates.w_img.css;`,r=>assert.equal(r['box-shadow'],undefined));
probe('image repaint clears old shadow when property absent',`objects.w.style.outerShadow=shadow();_updateElementIdImageStyle('w','normal');delete objects.w.style.outerShadow;_updateElementIdImageStyle('w','normal');return queryStates.w_img.css;`,r=>assert.equal(r['box-shadow'],undefined));
probe('image inner shadow ignored by this runtime painter',`objects.w.style.innerShadow={...shadow(),spread:2};_updateElementIdImageStyle('w','normal');return queryStates.w_img.css;`,r=>assert.equal(r['box-shadow'],undefined));
const output={timestamp:new Date().toISOString(),kind:'exact-source NodeVM functions with mocked DOM/style sinks; no browser pixels or original GUI in this stage',source:{path:filename,sha256:sha(bytes)},extractionEvidence:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',ranges:ranges.map(([start,end])=>({start,end,sha256:sha(slice(start,end))})),results};
fs.writeFileSync('research/shadow-runtime-probes.json',JSON.stringify(output,null,2)+'\n');
console.log(`${results.length}/${results.length} original-function probes passed`);
