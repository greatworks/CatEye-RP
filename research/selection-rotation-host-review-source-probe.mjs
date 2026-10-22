// New constructor-derived source matrix, independent of product algorithms.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {constructorFreedom} from './selection-rotation-host-review-constructor.mjs';
import {sourceSession,sources as oracleSources} from './selection-rotation-host-review-oracle.mjs';
const sha=path=>createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const results=[];
for(const handle of [1,2,3,4,6,8,9,12])for(const grid of [false,true])for(const offset of [0,1.5])for(const locked of [false,true]){
 const targets=[{id:'check',rect:{x:100,y:100,width:240,height:20},autoFitWidth:true,locked},
  {id:'radio',rect:{x:450,y:100,width:180,height:20},autoFitHeight:true}];
 const logical={x:handle&1?100:handle&4?630:364.5,y:handle&2?100:handle&8?120:109.5};
 const mods=keys=>({shift:!!(keys&65536),control:!!(keys&131072),alt:!!(keys&262144)});
 const input={targets,handle,grid,down:{x:logical.x+offset,y:logical.y+offset},freedom:constructorFreedom(handle),
  requests:[{point:{x:logical.x-265,y:logical.y+255},modifiers:mods(131072)},
   {point:{x:logical.x+31,y:logical.y+57},modifiers:mods(196608)},
   {point:{x:logical.x+31,y:logical.y+57},modifiers:mods(393216)},
   {point:logical,modifiers:mods(0)}]};
 assert.equal(input.freedom,(handle&5?1:0)|(handle&10?2:0));
 const observed=sourceSession(input);
 results.push({name:`constructor h${handle} grid${grid} offset${offset} locked${locked}`,input,observed});
}
const files=[...new Set([...oracleSources,'research/selection-rotation-host-review-oracle.mjs',
 'research/selection-rotation-host-review-constructor.mjs','research/selection-rotation-host-review-freedom-cil.json',
 'research/layer-resize-controller-planner-axis-cil.json','research/selection-rotation-host-review-source-probe.mjs'])];
const report={kind:'Constructor-derived original CIL input/controller composition; no product imports',
 originalDllExecuted:false,originalGuiCompared:false,summary:{sessions:results.length,frames:results.length*4},
 distinction:'Frozen 256 input/32 composed fixtures used explicit freedom=3 facade; these cases execute obNM constructor -> MSON -> VI8y -> TI8l for each actual handle.',
 sinks:['Base UI constructor omitted; its lack of field assignment is separately bounded by token xrefs',
  'Ordinary selection union, graphics uniform zoom, history/provider transactions and property primitives remain explicit replay services'],
 sources:files.map(path=>({path,sha256:sha(path)})),results};
fs.writeFileSync('research/selection-rotation-host-review-source-probes.json',JSON.stringify(report,null,2)+'\n');
console.log(report.summary);
