import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {createLineStyleRenderer} from '../src/model/line-style.ts';
import {createGradientRenderer} from '../src/model/gradient.ts';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=['src/model/line-style.ts','src/model/gradient.ts','src/components/WidgetView.tsx','src/runtime/export-runtime.ts','tests/native-corners-renderer.test.ts'];
const sourceHashes=files.map(path=>({path,sha256:hash(path)}));
const mask=n=>[1,2,4,8].map(bit=>Boolean(n&bit));
const base={fill:'#ffffff',stroke:'#000000',color:'#000000',radius:20,strokeWidth:10};
const savedPath={fillRule:'nonzero',commands:[{op:'M',x:0,y:.9},{op:'C',x1:0,y1:.396,x2:.198,y2:0,x:.45,y:0},{op:'L',x:1,y:0},{op:'L',x:1,y:1},{op:'L',x:0,y:1},{op:'L',x:0,y:.9},{op:'Z'}]};
const results=[];
for(const portable of [false,true]){
 const lines=portable?new Script(`(${createLineStyleRenderer.toString()})()`).runInNewContext():createLineStyleRenderer();
 const gradients=createGradientRenderer(lines);
 for(const radius of [90,20]){
  const input={type:'box',width:200,height:100,vectorPath:structuredClone(savedPath),style:{...base,radius,cornerVisibility:mask(1)}};
  const actual={supports:lines.supportsCorners(input),geometry:lines.vectorRectangle(input)??null};
  results.push({id:'NC-REVIEW-01',portable,input,expected:{supports:true,radii:[radius,0,0,0]},actual,pass:actual.supports&&JSON.stringify(actual.geometry?.radii)===JSON.stringify([radius,0,0,0])});
 }
 let mismatches=0;
 for(let c=0;c<16;c++)for(let b=0;b<16;b++){
  const style={...base,cornerVisibility:mask(c),borderVisibility:mask(b)},expected=mask(c).map((v,i)=>v&&mask(b)[(i+3)%4]===mask(b)[i]?20:0);
  if(JSON.stringify(lines.cssRadii(style))!==JSON.stringify(expected))mismatches++;
 }
 results.push({id:'CSS-corner-mask-equality-matrix',portable,cases:256,mismatches,pass:mismatches===0});
 const style={...base,cornerVisibility:mask(0),strokeGradient:{type:'linear',start:{x:0,y:0},end:{x:1,y:0},stops:[{offset:0,color:'#0000ff'},{offset:1,color:'#ff0000'}]}};
 const svg=decodeURIComponent(gradients.border(style,200,100));
 results.push({id:'all-false-mask-retains-gradient-square-border',portable,actual:svg,pass:svg.includes('linearGradient')&&!/\bA \d/.test(svg)});
}
const report={capturedAt:new Date().toISOString(),kind:'Independent current product module/serialized-helper execution; not original Axure observation or browser UI verification.',sourceHashes,probe:{path:'research/native-corners-render-review-probe.mjs',sha256:hash('research/native-corners-render-review-probe.mjs')},evidence:[{path:'research/native-corners-runtime-probes.json',sha256:hash('research/native-corners-runtime-probes.json')},{path:'research/native-corners-static-probes.json',sha256:hash('research/native-corners-static-probes.json')}],results,summary:{passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length},boundaries:['The native width0 and linePattern:none dynamic SVG gates skip reconstruction; current product projects newly authored geometry on every render.','No browser, package or original GUI was run in this review.','Initial managed fill clamp and later JavaScript fill clamp can differ for oversized masks, as separately recorded.']};
report.priorFailure={path:'research/native-corners-render-review-observed-failure.json',sha256:hash('research/native-corners-render-review-observed-failure.json'),sourceHashCaptured:false};
report.review={path:'research/native-corners-render-review.md',sha256:hash('research/native-corners-render-review.md')};
fs.writeFileSync('research/native-corners-render-review.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
