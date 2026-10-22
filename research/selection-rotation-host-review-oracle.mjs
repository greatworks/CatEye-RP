// Independent source composition. Imports retained-CIL interpreters only.
import {beginRotation,rotationInput,rotationFiles} from './selection-rotation-input-replay.mjs';
import {replay,sourceFiles} from './selection-rotation-controller-replay.mjs';
const clean=value=>JSON.parse(JSON.stringify(value,(key,v)=>key==='__struct'||key==='trace'?undefined:v));
export const sources=[...new Set([...rotationFiles,...sourceFiles,'research/selection-rotation-input-replay.mjs','research/selection-rotation-controller-replay.mjs'])];
const union=rects=>{const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y));return {x,y,width:Math.max(...rects.map(r=>r.x+r.width))-x,height:Math.max(...rects.map(r=>r.y+r.height))-y};};
export function sourceSession(input){
 const bounds=union(input.targets.map(w=>w.rect));
 const captured=beginRotation({rect:bounds,targets:input.targets,handle:input.handle,keys:131072,down:input.down,zoom:input.zoom??1,count:input.targets.length});
 if(captured.mode!==2)throw Error('Expected native multi-selection mode 2');
 const down=clean(captured.down),start=clean(captured.logicalStart),frames=[],requests=[];
 let current=input.targets.map(w=>({...w,rect:{...w.rect}}));
 for(const request of input.requests){
  const currentBounds=union(current.map(w=>w.rect)),keys=(request.modifiers.shift?65536:0)|(request.modifiers.control?131072:0)|(request.modifiers.alt?262144:0);
  const projected=rotationInput({rect:bounds,currentBounds,handle:input.handle,freedom:((input.handle&5?1:0)|(input.handle&10?2:0)),
   count:input.targets.length,start,point:request.point,keys,shift:request.modifiers.shift,alt:request.modifiers.alt,
   gridEnabled:input.grid!==false,grid:{width:8,height:8},zoom:input.zoom??1});
  requests.push({delta:projected.delta,keys,point:projected.rawPoint});
  const controller=replay({bounds,down,widgets:input.targets,frames:requests}).at(-1);
  if(controller.error)throw Error(controller.error);
  current=controller.after;
  frames.push({request,currentBounds,input:clean(projected),controller});
 }
 return {captured:clean(captured),frames,after:current};
}
