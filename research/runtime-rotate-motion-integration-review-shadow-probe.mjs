// Exact retained bounds + visibility + circularMove composition. Explicit sinks below.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const prior=JSON.parse(fs.readFileSync('research/runtime-rotate-motion-evidence.json','utf8'));
const dir=path.dirname(prior.sources.find(x=>x.path.endsWith('/action.js')).path);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'), ranges=[];
const slice=(name,start,end)=>{const file=path.join(dir,name),source=prior.sources.find(x=>path.resolve(x.path)===path.resolve(file));assert.equal(sha(file),source.sha256);const text=fs.readFileSync(file,'utf8').split(/\r?\n/).slice(start-1,end).join('\n');ranges.push({file,start,end,sha256:crypto.createHash('sha256').update(text).digest('hex')});return text;};
const code=`
var css={left:100,top:100}, tween, samples=[], _visibility={}, _move={};
function $(target){return {animate:(to,options)=>{tween={target,to,options};}}}
function $jobj(){return {css:(key,value)=>{if(value===undefined)return key==='position'?'absolute':css[key]; if(typeof value==='string')css[key]+=(value.startsWith('-=')?-1:1)*Number(value.slice(2));else css[key]=value;}}}
function $ax(){var q=Object.create($ax.public.fn);q.getElementIds=()=>['a'];q.getParents=()=>[[]];return q;}
$ax.public={fn:{IsLayer:()=>false}};$ax.getTypeFromElementId=()=> 'vector';$ax.visibility=_visibility;
$ax.style={generateState:()=>'',computeFullStyle:()=>({location:{x:100,y:100},size:{width:200,height:100},rotation:0,outerShadow:shadow})};$ax.adaptive={};
$ax.move=_move;_move.PrepareForMove=()=>({});$ax.dynamicPanelManager={isPercentWidthPanel:()=>false};
var $axure={fn:$ax.public.fn},$obj=()=>({}),document={getElementById:()=>({getAttribute:()=>null})},_fixedLocation=()=>({valid:false});
${slice('math.js',2,149)}
${slice('math.js',217,223)}
${slice('axQuery.std.js',1299,1323)}
${slice('axQuery.std.js',1438,1575)}
${slice('axQuery.std.js',1644,1647)}
${slice('visibility.js',1347,1380)}
$ax.visibility.getResizedSize=()=>undefined;$ax.visibility.getRotatedAngle=()=>90;
${slice('move.js',255,335)}
var widget={};
${slice('doc.js',449,512)}
var center=$ax('#a').offsetBoundingRect().centerPoint,pivot={x:center.x+30,y:center.y-10};
_move.circularMove('a',90,pivot,{x:0,y:0},{x:0,y:0},undefined,{easing:'linear',duration:64},false,undefined,true);
function step(value){tween.options.step(value);tween.target.degree=value;var reader=Object.assign({elementId:'a'},widget);samples.push({degree:value,css:{...css},moved:{..._movedIds.a},center:$ax('#a').offsetBoundingRect().centerPoint,publicGeometry:['x','y','width','height'].map(k=>reader.getProp(k))});}
steps.forEach(step);
`;
const cases=[];
for(const offsets of [[-10,-20],[10,20],[0,0]])for(const steps of [[90],[0,45,90],[22.5,45,67.5,90]]){
 const c=vm.createContext({Math,Number,shadow:{on:true,offsetX:offsets[0],offsetY:offsets[1],blurRadius:6},steps});
 try{vm.runInContext(code,c);cases.push({offsets,steps,kind:'exact retained source functions in NodeVM',samples:JSON.parse(JSON.stringify(c.samples)),passed:Math.abs(c.css.left-120)<1e-8&&Math.abs(c.css.top-60)<1e-8});}catch(e){cases.push({offsets,steps,passed:false,error:e.stack});}
}
const output=process.argv[2]||'research/runtime-rotate-motion-integration-review-shadow-valid.json';assert(!fs.existsSync(output));
const report={schema:1,capturedAt:new Date().toISOString(),sources:prior.sources.filter(s=>['math.js','move.js','visibility.js','axQuery.std.js','doc.js'].some(n=>s.path.endsWith('/'+n))),ranges,probe:{path:import.meta.filename,sha256:sha(import.meta.filename)},kind:'exact-source NodeVM composition; no original DLL, GUI, browser, or product execution',substitutions:['CSS left/top is a numeric sink implementing the exact +=/-= calls.','jQuery animation scheduler is a controlled callback recorder; prescribed angle samples mimic step-before-property-write.','PrepareForMove is a no-op returning empty moveInfo (separate retained source review confirms no geometry cache writes).','Widget metadata/state-style lookup supplies fixed frame and shadow; no fixed positioning, nesting, resizing, layout or actual browser pixel measurement.','Each sample creates a fresh getProp reader; event-level expression-object caching lifetime is not asserted.'],checks:{total:cases.length,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length},cases};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,checks:report.checks,cases},null,2));
