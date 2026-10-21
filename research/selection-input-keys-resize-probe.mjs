// Replays the frozen complete CbNX/Selection Size/OI8Z path in already-selected resize mode.
// Does not choose press mode or run native snapping; deltas here are post-snap fixtures.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {session,multiple,sourceFiles} from './selection-pointer-modifiers-session.mjs';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const cases=[];
try{
 const common={widthFit:true,heightFit:false,buttonSize:14,panel:{x:14,y:0,width:226,height:20},measurements:[{width:80,height:20}],deltas:[{x:106,y:3},{x:106,y:3},{x:0,y:0}]};
 const normalize=frames=>frames.map(f=>({...f,events:f.events.filter(e=>e.name!=='platform.keys.read')}));
 for(const count of [1,2])for(const handle of count===1?[1,4]:[1,2,3,4,6,8,9,12])for(const mask of [0,65536,131072,262144,196608,327680,393216,458752]){
  const input={...common,handle,keyMasks:[mask,0,mask],...(count===1?{rect:{x:100,y:100,width:240,height:20}}:{rects:[{x:100,y:100,width:240,height:20},{x:450,y:100,width:180,height:20}],selectionRect:{x:100,y:100,width:530,height:20}})};
  const run=count===1?session:multiple,actual=run(input),control=run({...input,keyMasks:input.keyMasks.map(k=>k&65536)});
  assert(actual.every(f=>!f.error));assert(control.every(f=>!f.error));assert.deepEqual(normalize(actual),normalize(control));
  cases.push({count,handle,mask,input,actual,control,passed:true});
 }
 const report={kind:'retained CIL complete existing resize-mode branch differential: full modifiers versus Shift-only at equal post-snap deltas',summary:{total:cases.length,passed:cases.length,failed:0,frames:cases.reduce((n,c)=>n+c.actual.length,0),controlFrames:cases.reduce((n,c)=>n+c.control.length,0)},
  boundaries:['No CbNh press mode selection; multi Ctrl-only press may select rotation and is not admitted by this probe','Post-snap deltas are supplied, not original screen input','All inherited selection/provider/graphics/font measurement facades are retained unchanged','Only platform.keys.read trace entries are removed before full owner/panel/fit/request/effect comparison'],
  sources:[...new Set([...sourceFiles,'research/selection-pointer-modifiers-session.mjs',import.meta.filename])].map(path=>({path,sha256:sha(path)})),cases};
 fs.writeFileSync('research/selection-input-keys-resize-probes.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
}catch(e){const failure={kind:'bounded CIL differential failed',completed:cases.length,error:String(e.stack).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<retained-cil>'),scriptSha256:sha(import.meta.filename)};fs.writeFileSync('research/selection-input-keys-resize-failure.json',JSON.stringify(failure,null,2)+'\n');console.error(failure.error);process.exitCode=1;}
