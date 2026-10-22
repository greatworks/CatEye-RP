import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {rotationInput} from './selection-rotation-input-replay.mjs';
import {replay} from './selection-rotation-controller-replay.mjs';

// Source interpreters only: this fixture generator never imports product code.
const bounds={x:100,y:300,width:530,height:20},start={x:630,y:309.5};
const widgets=[{id:'orbit-0',rect:{x:100,y:300,width:240,height:20},autoFitWidth:true},
  {id:'orbit-1',rect:{x:450,y:300,width:180,height:20},autoFitWidth:true}];
const specifications=[
  {name:'free-angle',moves:[{point:{x:600,y:342},keys:0}]},
  {name:'shift-angle',moves:[{point:{x:600,y:342},keys:65536}]},
  {name:'actual-down-offset',down:{x:632,y:311.5},moves:[{point:{x:600,y:342},keys:0}]},
  {name:'grid',grid:true,moves:[{point:{x:603,y:342},keys:131072}]},
  {name:'grid-alt',grid:true,moves:[{point:{x:603,y:342},keys:393216}]},
  {name:'grid-live-bounds',grid:true,moves:[{point:{x:603,y:342},keys:131072},{point:{x:520,y:324},keys:131072}]},
  {name:'negative-quarter',moves:[{point:{x:364.5,y:45},keys:0}]},
  {name:'locked-pivot',locked:true,moves:[{point:{x:365.5,y:575},keys:0}]},
  {name:'out-and-back',moves:[{point:{x:365.5,y:575},keys:0},{point:start,keys:0}]},
];
const union=values=>({x:Math.min(...values.map(v=>v.x)),y:Math.min(...values.map(v=>v.y)),
  width:Math.max(...values.map(v=>v.x+v.width))-Math.min(...values.map(v=>v.x)),
  height:Math.max(...values.map(v=>v.y+v.height))-Math.min(...values.map(v=>v.y))});
const cases=specifications.map(spec=>{
  const down=spec.down??start,targets=widgets.map((w,i)=>({...w,locked:!!spec.locked&&i===1}));
  let currentBounds=bounds;const frames=[],observations=[];
  for(const move of spec.moves){
    const input=rotationInput({rect:bounds,currentBounds,handle:4,keys:move.keys,alt:!!(move.keys&262144),
      gridEnabled:!!spec.grid,count:2,start,point:move.point,zoom:1});
    frames.push({delta:input.delta,keys:move.keys,point:move.point});
    const native=replay({bounds,down,widgets:targets,frames}).at(-1);
    if(native.error)throw Error(native.error);
    observations.push({input:{delta:input.delta,correction:input.correction,currentBounds},after:native.after,
      angle:native.events.find(e=>e.name==='angle.snap').answer});
    currentBounds=union(native.after.map(w=>w.rect));
  }
  return {...spec,down,start,bounds,widgets:targets,observations,expected:observations.at(-1).after};
});
const sourcePaths=['research/selection-rotation-browser-fixtures.mjs','research/selection-rotation-input-replay.mjs',
  'research/selection-rotation-controller-replay.mjs'];
const result={kind:'Retained original CIL input to controller composition; no product imports or original DLL execution',
  sources:sourcePaths.map(path=>({path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex')})),cases};
fs.writeFileSync('research/selection-rotation-browser-fixtures.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(cases.map(({name,expected,observations})=>({name,angles:observations.map(o=>o.angle),rects:expected.map(w=>w.rect)})));
