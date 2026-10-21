import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {session,multiple,sourceFiles} from './selection-pointer-modifiers-session.mjs';
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const cases=[];
try {
 const common={heightFit:false,panel:{x:14,y:0,width:226,height:20},buttonSize:14,measurements:[{width:80,height:20}]};
 for(const widthFit of [false,true])for(const handle of [1,4])for(const mask of [0,65536,131072,262144,196608,327680,393216,458752]) {
  const input={...common,widthFit,handle,rect:{x:100,y:100,width:240,height:20},keyMasks:[mask,0,mask],deltas:[{x:106,y:3},{x:106,y:3},{x:0,y:0}]};
  const actual=session(input);cases.push({name:'single-key-matrix',input,actual});
 }
 for(const widthFit of [false,true])for(const handle of [1,2,3,4,6,8,9,12]){
  const input={...common,widthFit,handle,rects:[{x:100,y:100,width:240,height:20},{x:450,y:100,width:180,height:20}],selectionRect:{x:100,y:100,width:530,height:20},keyMasks:[0,65536,0],deltas:[{x:106,y:3},{x:106,y:3},{x:106,y:3}]};
  const actual=multiple(input);cases.push({name:'multi-press-release-same-delta',input,actual});
 }
 for(const locked of [[false,true],[true,false],[true,true]])for(const handle of [4,8]){
  const input={...common,widthFit:true,handle,locked,rects:[{x:100,y:100,width:240,height:20},{x:450,y:100,width:180,height:20}],selectionRect:{x:100,y:100,width:530,height:20},keyMasks:[0,65536,0],deltas:[{x:106,y:3},{x:106,y:3},{x:106,y:3}]};
  const actual=multiple(input);cases.push({name:'multi-locked-key-change',input,actual});
 }
 // Parent's independent concrete browser expectation; dy=0 matters.
 const input={...common,widthFit:false,handle:4,rects:[{x:100,y:100,width:240,height:20},{x:450,y:100,width:180,height:20}],selectionRect:{x:100,y:100,width:530,height:20},keyMasks:[65536],deltas:[{x:106,y:0}]};
 cases.push({name:'shared-530x20-right-shift-106',input,actual:multiple(input)});
 for(const c of cases) {
  try {
   for(const [i,frame]of c.actual.entries()){
    assert.equal(frame.error,null);assert.equal(frame.events.filter(e=>e.name==='platform.keys.read').length,1);
    assert.equal(frame.events.find(e=>e.name==='platform.keys.read').mask,c.input.keyMasks[i]);
    if(i)assert.deepEqual(frame.before,c.actual[i-1].after);
    const requests=frame.events.filter(e=>e.name=== (c.input.rects?'INw2.result':'obN4.result'));
    if(!c.input.rects)for(const e of requests)assert.equal(e.request.aspect,false);
    if(c.input.rects)for(const e of requests)assert.equal(e.request.aspect,!!(c.input.keyMasks[i]&65536)&&!c.input.locked?.every(Boolean));
    if(c.input.rects)for(const [n,w]of frame.after.entries()){
     if(c.input.locked?.[n])assert.deepEqual(w,frame.before[n]);
     else if([2,8].includes(c.input.handle))assert.equal(w.fit,c.input.widthFit);
    }
   }
   if(c.name==='shared-530x20-right-shift-106')assert.deepEqual(c.actual[0].after.map(x=>x.rect),[{x:100,y:98,width:288,height:20},{x:520,y:98,width:216,height:20}]);
   c.passed=true;
  }catch(e){c.passed=false;c.assertion=e.message;}
 }
} catch(e){cases.push({passed:false,error:String(e.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<retained-cil>')});}
const report={kind:'Retained CIL hInw + original key tests + continuous CbNX/Size/OI8Z instructions; platform key-state and graphics services are explicit facades',
 summary:{total:cases.length,passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length,frames:cases.reduce((n,c)=>n+(c.actual?.length??0),0)},
 sources:[...new Set([...sourceFiles,'research/selection-pointer-modifiers-session.mjs','research/selection-pointer-modifiers-probe.mjs','research/selection-pointer-modifiers-key-enum.json'])].map(path=>({path,sha256:sha(path)})),cases};
fs.writeFileSync('research/selection-pointer-modifiers-probes.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,failures:cases.filter(c=>!c.passed).map(c=>({name:c.name,error:c.error??c.assertion,frameErrors:c.actual?.filter(f=>f.error).map(f=>f.error)}))}));
if(report.summary.failed)process.exitCode=1;
