import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {candidate,correction,gridInput,hotzone,files} from './selection-input-grid-replay.mjs';
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const clean=v=>JSON.parse(JSON.stringify(v, (k,v)=>k==='__struct'||k==='trace'?undefined:v));
const results=[],coverage=new Map();
function check(name,input,actual,expected){for(const x of actual.trace??[]) {const s=coverage.get(x.token)??new Set();s.add(x.offset);coverage.set(x.token,s);}const value=clean(actual);try{compare(value,expected);results.push({name,input,actual:value,expected,passed:true});}catch(e){results.push({name,input,actual:value,expected,passed:false,error:e.message});}}
function compare(a,b){if(typeof b==='number'){assert.ok(Math.abs(a-b)<=1e-8,`${a} != ${b}`);return;}if(b&&typeof b==='object'){for(const key of Object.keys(b))compare(a?.[key],b[key]);return;}assert.equal(a,b);}
const empty={x:-100000,y:-100000,width:200000,height:200000};
function formulaCandidate({currentBounds:r,point:p,handle:h,freedom=3,shift=false}){
 let x=p.x,y=p.y;const right=r.x+r.width,bottom=r.y+r.height,ratio=r.height/r.width;
 if(shift&&[3,6,9,12].includes(h)){
  const w=h&1?right-x:x-r.x, height=h&2?bottom-y:y-r.y;
  if(w*ratio>height)y=h&2?bottom-w*ratio:r.y+w*ratio;
  else if(height>w*ratio)x=h&1?right-height/ratio:r.x+height/ratio;
 }
 const left=h&1?Math.min(x,right):r.x,top=h&2?Math.min(y,bottom):r.y;
 const width=h&1?Math.max(0,right-x):h&4?Math.max(0,x-r.x):r.width;
 const height=h&2?Math.max(0,bottom-y):h&8?Math.max(0,y-r.y):r.height;
 if(width===0&&height===0||width===0&&!(freedom&2)||height===0&&!(freedom&1))return {...empty};
 return {x:left,y:top,width,height};
}
function opposite(h){return (h&1?4:0)|(h&4?1:0)|(h&2?8:0)|(h&8?2:0);}
const round=v=>Math.sign(v)*Math.floor(Math.abs(v)+.5);
function formulaCorrection({rect:r,handle=4,anchor=opposite(handle),grid={width:8,height:8},zoom=1,toleranceDevice=5,shift=false,xEnabled=true,yEnabled=true,gridEnabled=true}){
 if(!gridEnabled)return {x:0,y:0};
 const snap=(v,s)=>round(v/s)*s-v;
 const right=snap(r.x+r.width,grid.width),left=snap(r.x,grid.width),bottom=snap(r.y+r.height,grid.height),top=snap(r.y,grid.height);
 let x=((anchor&1)||Math.abs(right)<=Math.abs(left))&&!(anchor&4)?right:left;
 let y=((anchor&2)||Math.abs(bottom)<=Math.abs(top))&&!(anchor&8)?bottom:top;
 const xhit=xEnabled&&Math.abs(x)<=toleranceDevice/zoom,yhit=yEnabled&&Math.abs(y)<=toleranceDevice/zoom;
 if(!xhit)x=0;if(!yhit)y=0;
 if(shift&&[3,6,9,12].includes(anchor)){
  const ratio=r.height/r.width,sign=anchor===3||anchor===12?1:-1;
  if(!yhit||xhit&&Math.abs(x*ratio)<Math.abs(y)){const value=sign*x*ratio;if(!(Math.abs(value-y)<1e-5))y=value;}
  else {const value=sign*y/ratio;if(!(Math.abs(value-x)<1e-5))x=value;}
 }
 return {x,y};
}
const handles=[1,2,3,4,6,8,9,12],base={x:100,y:100,width:240,height:40};
for(const currentBounds of [base,{x:-35.25,y:-21.5,width:77.5,height:31.25}])for(const handle of handles)for(const freedom of [0,1,2,3])for(const shift of [false,true])for(const rel of [[-20,-20],[0,0],[.3,.7],[1,1],[1.2,1.2],[1.2,.5],[.5,1.2]]){
 const input={currentBounds,handle,freedom,shift,point:{x:currentBounds.x+rel[0]*currentBounds.width,y:currentBounds.y+rel[1]*currentBounds.height}};
 check(`candidate ${results.length}`,input,candidate(input),{rect:formulaCandidate(input),liveReads:1});
}
for(const grid of [{width:8,height:8},{width:7,height:11},{width:20,height:20}])for(const zoom of [.5,1,2,4])for(const handle of handles)for(const shift of [false,true])for(const rect of [base,{x:-12,y:-4,width:24,height:8},{x:3.25,y:9.75,width:25.5,height:15.5},empty]){
 const input={rect,grid,zoom,handle,shift};check(`grid ${results.length}`,input,correction(input),{correction:formulaCorrection(input)});
}
for(const sign of [-1,1])for(const gap of [2.499999,2.5,2.500001]){
 const input={rect:{x:sign*(40+gap),y:0,width:20,height:20},grid:{width:20,height:20},anchor:4,zoom:2};
 check(`threshold ${sign}/${gap}`,input,correction(input),{correction:formulaCorrection(input)});
}
for(const zoom of [.5,1,2,4])for(const currentBounds of [base,{x:-35.25,y:-21.5,width:77.5,height:31.25}])for(const handle of handles){
 const input={currentBounds,handle,zoom};const start={x:handle&1?currentBounds.x:handle&4?currentBounds.x+currentBounds.width:currentBounds.x+(currentBounds.width-1)/2,y:handle&2?currentBounds.y:handle&8?currentBounds.y+currentBounds.height:currentBounds.y+(currentBounds.height-1)/2};
 check(`logical hotzone ${results.length}`,input,hotzone(input),{start});
}
for(const zoom of [.5,1,2,4])for(const alt of [false,true])for(const gridEnabled of [false,true]){
 const input={currentBounds:base,handle:4,start:{x:340,y:119.5},point:{x:340+21/zoom,y:119.5},zoom,alt,gridEnabled};
 const active=gridEnabled&&!alt,r=active?formulaCandidate(input):null,c=active?formulaCorrection({...input,rect:r}):{x:0,y:0};
 check(`entry zoom${zoom}/alt${alt}/grid${gridEnabled}`,input,gridInput(input),{candidate:r,correction:c,delta:{x:21/zoom+c.x,y:c.y},liveReads:active?1:0});
}
// The same queued absolute point sees the updated/live selection aspect ratio.
for(const currentBounds of [base,{...base,width:282,height:20}]){
 const input={currentBounds,handle:12,shift:true,start:{x:340,y:140},point:{x:400,y:151},zoom:1};const r=formulaCandidate(input),c=formulaCorrection({...input,rect:r});
 check(`live frame ${currentBounds.width}x${currentBounds.height}`,input,gridInput(input),{candidate:r,correction:c,delta:{x:60+c.x,y:11+c.y}});
}
const sources=[...new Set([...files,'research/selection-input-grid-replay.mjs','research/selection-input-grid-probe.mjs','research/selection-input-grid-empty-cil.json','research/selection-input-grid-size-constants-cil.json','research/gradient-angle-static-flow.mjs','research/gradient-angle-flow-init-cil.json'])].map(file=>({file,sha256:sha(file)}));
const report={kind:'retained-CIL replay versus independent source-derived formulas',originalDllExecuted:false,originalGuiCompared:false,createdAt:new Date().toISOString(),summary:{total:results.length,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length},facades:['current selection BoundingRect supplied after author layout/cache invalidation','uniform graphics Device2→World0 size/zoom','unrotated frame position and constructor primitives','active jF4A path, platform Alt key service independently proven by sibling evidence','guides and object snapping explicitly disabled','visual guide lists/UI drawing discarded'],methods:[...coverage].map(([token,offsets])=>({token,visitedOffsets:[...offsets].sort((a,b)=>a-b)})),sources,results};
fs.writeFileSync('research/selection-input-grid-probes.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
for(const r of results.filter(x=>!x.passed).slice(0,10))console.log(JSON.stringify(r));
if(report.summary.failed)process.exitCode=1;
