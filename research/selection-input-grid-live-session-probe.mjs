// Original recorded input CIL + original recorded controller/layout CIL.
// Constant text measurement is explicit; this is not native font/GUI execution.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gridInput,files as inputFiles} from './selection-input-grid-replay.mjs';
import {multiple,sourceFiles as controllerFiles} from './selection-pointer-modifiers-session.mjs';
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const withoutTrace=r=>JSON.parse(JSON.stringify(r,(k,v)=>k==='trace'||k==='__struct'?undefined:v));
const originalBounds={x:100,y:100,width:530,height:20},start={x:630,y:120};
const service={widthFit:false,heightFit:false,handle:12,rects:[{x:100,y:100,width:240,height:20},{x:450,y:100,width:180,height:20}],selectionRect:originalBounds,panel:{x:14,y:0,width:226,height:20},buttonSize:14,measurements:[{width:226,height:20}],keyMasks:[65536,65536]};
const union=frames=>{const left=Math.min(...frames.map(w=>w.rect.x)),top=Math.min(...frames.map(w=>w.rect.y));return {x:left,y:top,width:Math.max(...frames.map(w=>w.rect.x+w.rect.width))-left,height:Math.max(...frames.map(w=>w.rect.y+w.rect.height))-top};};
try{
 const first=gridInput({currentBounds:originalBounds,start,point:{x:736,y:124},handle:12,shift:true,zoom:1});
 const firstSession=multiple({...service,deltas:[first.delta]});assert.equal(firstSession[0].error,null);
 const liveBounds=union(firstSession[0].after);
 const input2={currentBounds:liveBounds,start,point:{x:752,y:125},handle:12,shift:true,zoom:1};
 const live=gridInput(input2),stale=gridInput({...input2,currentBounds:originalBounds});
 const liveSession=multiple({...service,deltas:[first.delta,live.delta]}),staleSession=multiple({...service,deltas:[first.delta,stale.delta]});
 assert.equal(liveSession[1].error,null);assert.equal(staleSession[1].error,null);assert.notDeepEqual(liveSession[1].after,staleSession[1].after);
 assert.deepEqual(first.delta,{x:106,y:4});assert.deepEqual(liveBounds,{x:100,y:100,width:636,height:20});
 const report={kind:'source input/controller composition with explicit constant text measurement',originalDllExecuted:false,originalGuiCompared:false,summary:{passed:1,failed:0},service,first:withoutTrace(first),firstOwners:firstSession[0].after,liveBounds,secondInput:input2,secondLive:withoutTrace(live),secondStale:withoutTrace(stale),liveOwners:liveSession[1].after,staleOwners:staleSession[1].after,orderedEvents:liveSession.map(f=>f.events),sources:[...new Set([...inputFiles,...controllerFiles,'research/selection-input-grid-live-session-probe.mjs','research/selection-input-grid-replay.mjs'])].map(file=>({file,sha256:sha(file)}))};
 fs.writeFileSync('research/selection-input-grid-live-session-probes.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({first:report.first,liveBounds,secondLive:report.secondLive,secondStale:report.secondStale,liveOwners:report.liveOwners,staleOwners:report.staleOwners}));
}catch(e){console.error(String(e.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<retained-cil>'));process.exitCode=1;}
