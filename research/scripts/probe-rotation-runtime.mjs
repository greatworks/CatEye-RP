// Executes only pinned original JavaScript slices. DOM/CSS/animation are explicit sinks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const base='C:/Users/Administrator/AppData/Local/Temp/rea-extracted-bd88e221-f5ba-43d0-9c75-0403885109dc/Axure RP 11/DefaultSettings/Prototype_Files/resources/scripts/axure';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const expected={ 'math.js':'f56ab4a6c3f6e91aaba9bebf2e81485965fc82bca63af0c606593d580c1de883','move.js':'c823954b5ed5862d56176b8984837e8f26588540ee4768d4483d68a399b95644','axQuery.std.js':'0427b0387fdb1c5ef29b77f830a61422bb136a502002c7e9326cd4561e4830cd' };
const sources=Object.entries(expected).map(([file,sha256])=>{const full=path.join(base,file),bytes=fs.readFileSync(full);assert.equal(hash(bytes),sha256);return{path:full,file,sha256,lines:bytes.toString().split(/\r?\n/)}});
const ranges=[['math.js',2,87],['math.js',103,149],['math.js',217,240],['move.js',338,440],['move.js',442,491]];
const slices=ranges.map(([file,start,end])=>({file,start,end,text:sources.find(x=>x.file===file).lines.slice(start-1,end).join('\n')}));
const setup=`
var _move={},nodes={},events=[],computedReads=0;
var $ax={public:{fn:{}},move:_move,action:{queueTypes:{rotate:'rotate'},fireAnimationFromQueue:(id,type)=>events.push(['queue',id,type])},visibility:{setRotatedAngle:(id,d)=>events.push(['visibility',id,d])},annotation:{adjustIconLocation:id=>events.push(['annotation',id])},getNumFromPx:parseFloat};
var $axure={fn:$ax.public.fn};
var window={getComputedStyle:element=>{computedReads++;return{getPropertyValue:()=>element.computed||'none'}}};
var document={getElementById:id=>nodes[id]};
var $obj=id=>({type:nodes[id]?.type||'shape'});
var $jobj=id=>{var n=nodes[id];return{0:n,css:arg=>{if(typeof arg==='string')return n.css[arg];Object.assign(n.style,arg);events.push(['css',id,arg]);return this},parent:()=>[{id:'parent'}],data:key=>n[key]}};
var $=o=>({animate:(target,options)=>{events.push(['animate',target,options.duration,options.easing]);for(var value of [target.degree/2,target.degree]){options.step(value);o.degree=value}options.complete()}});
$ax.public.fn.compoundIdFromComponent=id=>id;$ax.public.fn.IsLayer=type=>type==='layer';
function reset(){nodes={w:{style:{},computed:'none',css:{left:'10px',top:'20px',width:'100px',height:'60px'}}};events=[];computedReads=0;}
`;
const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false}});
vm.runInContext(setup+slices.map(x=>x.text).join('\n'),context,{timeout:1000});
const results=[];
function near(a,b){assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`)}
function point(a,b){near(a.x,b.x);near(a.y,b.y)}
function probe(name,code,check){const observed=JSON.parse(vm.runInContext(`JSON.stringify((()=>{reset();${code}})())`,context,{timeout:1000}));check(observed);results.push({name,observed,pass:true})}
for(const [angle,expectedPoint] of [[90,{x:10,y:25}],[-90,{x:10,y:15}],[180,{x:5,y:20}],[450,{x:10,y:25}],[0,{x:15,y:20}]]) probe(`point rotation ${angle} degrees around explicit center`, `return $axure.fn.getPointAfterRotate(${angle},{x:15,y:20},{x:10,y:20})`,r=>point(r,expectedPoint));
probe('rotation preserves center',`return $axure.fn.getPointAfterRotate(89.13596303062127,{x:60,y:50},{x:60,y:50})`,r=>point(r,{x:60,y:50}));
probe('90 degree AABB keeps center but changes layout origin',`return $axure.fn.getBoundingRectForRotate({left:10,top:20,right:110,bottom:80,centerPoint:{x:60,y:50}},90)`,r=>{near(r.left,30);near(r.top,0);near(r.width,60);near(r.height,100)});
probe('native fractional angle bounds',`return $axure.fn.getBoundingSizeForRotate(100,60,89.13596303062127)`,r=>{let a=89.13596303062127*Math.PI/180;near(r.width,100*Math.cos(a)+60*Math.sin(a));near(r.height,100*Math.sin(a)+60*Math.cos(a))});
probe('matrix product applies right matrix first',`var a=$axure.fn.rotationMatrix(90),b={m11:2,m12:0,m21:0,m22:3,tx:10,ty:20};return $axure.fn.matrixMultiply($axure.fn.matrixMultiplyMatrix(a,b),{x:4,y:5})`,r=>point(r,{x:-35,y:18}));
probe('inverse roundtrip includes translation',`var a={m11:2,m12:-1,m21:1,m22:3,tx:11,ty:-7},p={x:4,y:5};return $axure.fn.matrixMultiply($axure.fn.matrixInverse(a),$axure.fn.matrixMultiply(a,p))`,r=>point(r,{x:4,y:5}));
probe('CSS matrix parameter order is a b c d tx ty',`return $axure.fn.matrixString(2,3,4,5,6,7)`,r=>assert.equal(r,'Matrix(2,3,4,5, 6, 7)'));
probe('inline signed integer angle preserved without modulo',`nodes.w.style.transform='rotate(-450deg)';return{angle:_move.getRotationDegreeFromElement(nodes.w),computedReads}`,r=>{assert.equal(r.angle,-450);assert.equal(r.computedReads,0)});
probe('fractional inline angle falls back to computed matrix',`nodes.w.style.transform='rotate(-0.5deg)';nodes.w.computed='matrix(0.9999619230641713,-0.008726535498373935,0.008726535498373935,0.9999619230641713,0,0)';return{angle:_move.getRotationDegreeFromElement(nodes.w),computedReads}`,r=>{near(r.angle,359.5);assert.equal(r.computedReads,1)});
probe('reflected x scale is interpreted as 180 degrees',`nodes.w.computed='matrix(-2,0,0,3,7,8)';return _move.getRotationDegreeFromElement(nodes.w)`,r=>near(r,180));
probe('nonuniform scale does not change atan2 direction',`nodes.w.computed='matrix(0,2,-3,0,7,8)';return _move.getRotationDegreeFromElement(nodes.w)`,r=>near(r,90));
probe('none returns zero and missing node returns NaN',`return{none:_move.getRotationDegreeFromElement(nodes.w),missing:Number.isNaN(_move.getRotationDegreeFromElement(null))}`,r=>assert.deepEqual(r,{none:0,missing:true}));
probe('relative rotate overwrites existing scale and translation',`nodes.w.computed='matrix(2,0,0,3,7,8)';_move.rotate('w',30,'none',0,false,true,()=>events.push(['complete']));return{transform:nodes.w.style.transform,origin:nodes.w.style.transformOrigin??null,events}`,r=>{assert.equal(r.transform,'rotate(30deg)');assert.equal(r.origin,null);assert.deepEqual(r.events.map(x=>x[0]),['visibility','css','queue','complete','annotation'])});
probe('absolute rotate uses current degree',`nodes.w.style.transform='rotate(20deg)';_move.rotate('w',70,'none',0,true,false);return{transform:nodes.w.style.transform,events}`,r=>{assert.equal(r.transform,'rotate(70deg)');assert.equal(r.events[0][2],70)});
probe('zero delta fires queue but does not completion callback',`nodes.w.style.transform='rotate(20deg)';_move.rotate('w',20,'none',0,true,true,()=>events.push(['complete']));return events`,r=>assert.deepEqual(r,[['queue','w','rotate']]));
probe('layer getter reads layerDegree data without element transform',`nodes.w.type='layer';nodes.w.layerDegree=45;nodes.w.style.transform='rotate(90deg)';return _move.getRotationDegree('w')`,r=>assert.equal(r,45));
// A single final animation step isolates original compound matrix calculation, not animation scheduling.
probe('compound rotation left multiplies scale and rotates translated center',`$=o=>({animate:(target,options)=>{options.step(target.degree);options.complete()}});nodes.w.computed='matrix(2,0,0,3,7,8)';_move.compoundRotateAround('w',90,{x:60,y:50},{x:0,y:0},{x:0,y:0},null,'none',0,false);return{matrix:nodes.w.style.transform,css:nodes.w.css}`,r=>{let a=r.matrix.slice(7,-1).split(',').map(Number);[0,2,-3,0,-8,7].forEach((v,i)=>near(a[i],v));assert.equal(r.css.width,'100px')});
probe('compound rotation around external origin also moves center',`nodes.w.computed='matrix(1,0,0,1,0,0)';_move.compoundRotateAround('w',90,{x:0,y:0},{x:5,y:6},{x:0,y:0},null,'none',0,false);return nodes.w.style.transform`,r=>{let a=r.slice(7,-1).split(',').map(Number);[0,1,-1,0,-105,16].forEach((v,i)=>near(a[i],v))});
const boxSlice={file:'axQuery.std.js',start:1554,end:1570,text:sources[2].lines.slice(1553,1570).join('\n')};slices.push(boxSlice);
vm.runInContext(`function _populateBoundingRect(b){b.right=b.left+b.width;b.bottom=b.top+b.height;b.centerPoint={x:b.left+b.width/2,y:b.top+b.height/2};return b}
function box(options){var elementId='w',ignoreRotation=options.ignore,rotation,element={getAttribute:()=>options.attribute},state,style,boundingRect={left:10,top:20,width:100,height:60};$ax.visibility.getRotatedAngle=()=>options.override;$ax.style={generateState:()=>'',computeFullStyle:()=>({rotation:options.style})};$ax.adaptive={currentViewId:''};${boxSlice.text};return boundingRect}`,context);
probe('bounding rect action override takes precedence over generated and style angles',`return box({override:90,attribute:'180',style:45})`,r=>{near(r.left,30);near(r.top,0);near(r.width,60);near(r.height,100)});
probe('zero action override is falsy so original branch falls back to data angle',`return box({override:0,attribute:'180',style:45})`,r=>{near(r.left,10);near(r.top,20);near(r.width,100);near(r.height,60)});
probe('data rotation string zero is truthy and suppresses style fallback',`return box({attribute:'0',style:90})`,r=>assert.deepEqual(r,{left:10,top:20,width:100,height:60}));
probe('style rotation used when no action or data angle',`return box({style:90})`,r=>{near(r.left,30);near(r.top,0);near(r.width,60);near(r.height,100)});
probe('ignoreRotation leaves original layout rectangle',`return box({ignore:true,override:90,attribute:'180',style:45})`,r=>assert.deepEqual(r,{left:10,top:20,width:100,height:60}));
const out={timestamp:new Date().toISOString(),kind:'Exact retained JavaScript slices in NodeVM; mocked DOM/CSS/animation sinks, no original GUI or browser pixels',extractionEvidence:'ev_ceacbf6838c7910ac5abb083528eae30fd831b34f6a9fdd3a4dd37c2891555b7',sources:sources.map(({lines,...s})=>s),ranges:slices.map(({text,...s})=>({...s,sha256:hash(text)})),results};
fs.writeFileSync('research/rotation-runtime-probes.json',JSON.stringify(out,null,2)+'\n');console.log(`${results.length}/${results.length} original function probes passed`);
