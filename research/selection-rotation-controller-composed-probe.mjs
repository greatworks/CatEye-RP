// Source input -> source controller -> explicit current-owner union feedback.
// The union, provider/history/graphics services remain documented facades.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {beginRotation,rotationInput,rotationFiles} from './selection-rotation-input-replay.mjs';
import {replay,sourceFiles as controllerFiles} from './selection-rotation-controller-replay.mjs';
import {api as properties,sourceFiles as propertyFiles} from './selection-author-properties-replay.mjs';
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const clean=value=>JSON.parse(JSON.stringify(value,(k,v)=>['__struct','trace'].includes(k)?undefined:v));
const union=owners=>{const rs=owners.map(w=>w.rect);const x=Math.min(...rs.map(r=>r.x)),y=Math.min(...rs.map(r=>r.y));return{x,y,width:Math.max(...rs.map(r=>r.x+r.width))-x,height:Math.max(...rs.map(r=>r.y+r.height))-y};};
const results=[];
const targets=[{id:'check',rect:{x:100,y:100,width:240,height:20},autoFitWidth:true},{id:'radio',rect:{x:450,y:100,width:180,height:20},autoFitHeight:true}];
const bounds=union(targets);
const logical=(r,h)=>({x:h&1?r.x:h&4?r.x+r.width:r.x+(r.width-1)/2,y:h&2?r.y:h&8?r.y+r.height:r.y+(r.height-1)/2});
for(const handle of [1,2,3,4,6,8,9,12])for(const gridEnabled of [false,true])for(const physicalOffset of [0,1.5]){
 const start=logical(bounds,handle),down={x:start.x+physicalOffset,y:start.y+physicalOffset};
 const captureInput={rect:bounds,targets,handle,keys:131072,down,zoom:1,count:2};
 const captured=clean(beginRotation(captureInput)),frames=[],downstream=[];let currentBounds=bounds,error=null;
 const requests=[{point:{x:start.x-265,y:start.y+255},keys:131072},{point:{x:start.x+31,y:start.y+57},keys:196608},{point:{x:start.x+31,y:start.y+57},keys:393216},{point:start,keys:131072}];
 try{
  assert.equal(captured.mode,2);assert.deepEqual(captured.down,down);assert.deepEqual(captured.logicalStart,start);
  for(const request of requests){
   const input={rect:bounds,currentBounds,handle,keys:request.keys,shift:!!(request.keys&65536),alt:!!(request.keys&262144),gridEnabled,count:2,start,point:request.point,zoom:1};
   const projected=clean(rotationInput(input));downstream.push({delta:projected.delta,keys:request.keys,point:request.point});
   const observed=replay({bounds:captured.initialBounds,down:captured.down,widgets:targets,frames:downstream}).at(-1);
   assert.equal(observed.error,null);assert(observed.after.every(w=>w.angle===0));
   assert.equal(projected.liveReads,gridEnabled&&!(request.keys&262144)?1:0);
   assert(observed.events.filter(e=>e.name==='Location.request').every(e=>e.allViews===false&&e.notify===true));
   frames.push({input,projected,observed});currentBounds=union(observed.after);
  }
 }catch(e){error=e.message;}
 results.push({name:`composed h${handle} grid${gridEnabled} offset${physicalOffset}`,captureInput,captured,frames,passed:!error,error});
}
// Read the exact original notification gate separately. The provider dispatch is
// not silently replaced by this call in the controller replay.
for(const widthFit of [false,true])for(const heightFit of [false,true])for(const editingText of [false,true]){
 const input={entry:'selectionStyleChanged',keys:[101],notify:true,widthFit,heightFit,editingText},actual=properties.transaction(input);let error=null;
 try{assert.equal(actual.error,null);assert.deepEqual(actual.events,[{name:'style.changed.base'}]);assert.equal(actual.measures,0);}catch(e){error=e.message;}
 results.push({name:`location-notification fit ${widthFit}/${heightFit} editing ${editingText}`,input,actual,passed:!error,error});
}
const files=[...new Set([...rotationFiles,...controllerFiles,...propertyFiles,'research/selection-rotation-input-replay.mjs','research/selection-rotation-controller-replay.mjs','research/selection-author-properties-replay.mjs','research/selection-rotation-controller-composed-probe.mjs'])];
const report={kind:'Retained CIL input/controller composition with explicit union/history/provider services; separate exact [101] MIue replay',summary:{total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,composedFrames:results.reduce((n,r)=>n+(r.frames?.length??0),0)},sources:files.map(path=>({path,sha256:sha(path)})),results};
fs.writeFileSync('research/selection-rotation-controller-composed-probes.json',JSON.stringify(report,null,2)+'\n');
console.log(report.summary);for(const r of results.filter(r=>!r.passed))console.log(r.name,r.error);if(report.summary.failed)process.exitCode=1;
