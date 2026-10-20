import type {VectorPath} from './types';
import type {VectorPoint} from './vector-editing';

interface Anchor {point:VectorPoint;lower?:VectorPoint;higher?:VectorPoint;active:boolean}
export interface MeasurementCurve {from:VectorPoint;to:VectorPoint;c1?:VectorPoint;c2?:VectorPoint;active:boolean}
const distance=(a:VectorPoint,b:VectorPoint)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

/** Temporary native measurement topology, never a rewrite of saved commands.
 * M/L/C/Z supplies active outgoing edges and explicit cubic handles. Open first
 * incoming / last outgoing inactive handles are absent in this document model.
 * ReIndex's .001 test is in the supplied measurement coordinate frame. */
export function vectorMeasurementContours(path:VectorPath,transform:(point:VectorPoint)=>VectorPoint):{contours:MeasurementCurve[][];first:VectorPoint}{
  const raw:Anchor[][]=[];
  for(const command of path.commands){
    if(command.op==='M'){raw.push([{point:transform(command),active:false}]);continue;}
    const contour=raw[raw.length-1],previous=contour[contour.length-1];
    previous.active=true;
    if(command.op==='Z')continue;
    const next:Anchor={point:transform(command),active:false};
    if(command.op==='C'){previous.higher=transform({x:command.x1,y:command.y1});next.lower=transform({x:command.x2,y:command.y2});}
    contour.push(next);
  }
  const contours=raw.map(anchors=>anchors.map((b,i):MeasurementCurve=>{
    // Native construction visits Last -> First before adjacent anchor pairs.
    const a=anchors[(i+anchors.length-1)%anchors.length];
    return{from:a.point,to:b.point,active:a.active,...(a.higher||b.lower?{c1:a.higher??a.point,c2:b.lower??b.point}:{})};
  }).filter(c=>!(distance(c.from,c.to)<.001&&(!c.c1||distance(c.from,c.c1)<.001&&distance(c.to,c.c2!)<.001))))
    .filter(curves=>curves.length>0&&(curves.length!==1||distance(curves[0].from,curves[0].to)<1));
  return{contours,first:raw[0][0].point};
}
