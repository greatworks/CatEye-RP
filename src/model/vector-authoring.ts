import {createLineStyleRenderer} from './line-style';
import type {VectorCommand,VectorPath,Widget} from './types';

const lines=createLineStyleRenderer();
type EditWidget=Pick<Widget,'type'|'vectorPath'|'style'|'width'|'height'>;

/** A parameterized display must never expose a different saved path for editing. */
export function vectorEditPathUnsupportedReason(widget:EditWidget):'partial-border'|'independent-corners'|undefined {
  if(!lines.vectorRectangle(widget))return undefined;
  if(widget.style.borderVisibility?.some(on=>!on))return 'partial-border';
  if(widget.style.cornerRadii)return 'independent-corners';
  return undefined;
}

/** Resolve the path shown by direct point editing without changing the widget. */
export function resolveVectorEditPath(widget:EditWidget):VectorPath|undefined {
  const path=widget.vectorPath,{style,width,height}=widget;
  // Parameter identity and the saved clockwise rectangle family must both be
  // established. Partial-border native points have a separate construction
  // route; retain their saved outline until that route is independently closed.
  if(!path||widget.type!=='box'||!style.cornerVisibility||style.cornerRadii||style.borderVisibility?.some(v=>!v)||!lines.supportsCorners(widget)||![width,height].every(v=>Number.isFinite(v)&&v>0))return path;
  const visible=style.cornerVisibility;
  const ceiling=Math.min(visible[0]&&visible[3]||visible[1]&&visible[2]?height/2:height,visible[0]&&visible[1]||visible[2]&&visible[3]?width/2:width);
  const radius=Math.min(style.radius,ceiling),r=visible.map(on=>on?radius:0);
  type Point={x:number;y:number};type Anchor={point:Point;lower?:Point;higher?:Point};
  const p=(x:number,y:number):Point=>({x:x/width,y:y/height});
  const starts=[p(0,r[0]),p(width-r[1],0),p(width,height-r[2]),p(r[3],height)];
  const ends=[p(r[0],0),p(width,r[1]),p(width-r[2],height),p(0,height-r[3])];
  const handles=[[p(0,.44*r[0]),p(.44*r[0],0)],[p(width-.44*r[1],0),p(width,.44*r[1])],[p(width,height-.44*r[2]),p(width-.44*r[2],height)],[p(.44*r[3],height),p(0,height-.44*r[3])]];
  const anchors:Anchor[]=starts.flatMap((point,i)=>[{point,higher:r[i]>0?handles[i][0]:undefined},{point:ends[i],lower:r[i]>0?handles[i][1]:undefined}]);
  // Native source controls coalesce coincident side endpoints, including the
  // closing seam. Preserve the incoming handle of the first and outgoing
  // handle of the second point; do not serialize zero-length pill side edges.
  const equal=(a:Point,b:Point)=>Math.abs(a.x-b.x)<.00001&&Math.abs(a.y-b.y)<.00001;
  const joins=(a:Anchor,b:Anchor)=>equal(a.point,b.point)&&(!a.higher||equal(a.higher,a.point))&&(!b.lower||equal(b.lower,b.point));
  const merge=(a:Anchor,b:Anchor):Anchor=>({point:b.point,lower:a.lower,higher:b.higher});
  const coalesce=(start:number):void=>{
    if(start===0&&joins(anchors[anchors.length-1],anchors[0])){const last=anchors.pop()!;anchors[0]=merge(last,anchors[0]);}
    // Retain the source builder's restart rule: its comparison value resets
    // to the first point even when it resumes later in the list. Consequently
    // some oversized single-corner outlines retain a zero-length segment.
    let previous=anchors[0];
    for(let i=start+1;i<anchors.length;i++){
      const current=anchors[i];
      if(joins(previous,current)){anchors.splice(i,1);anchors[i-1]=merge(previous,current);coalesce(i-1);return;}
      previous=current;
    }
  };
  coalesce(0);
  const commands:VectorCommand[]=[{op:'M',...anchors[0].point}];
  for(let i=0;i<anchors.length;i++){const a=anchors[i],b=anchors[(i+1)%anchors.length];
    if(!a.higher&&!b.lower)commands.push({op:'L',...b.point});
    else {const h1=a.higher??a.point,h2=b.lower??b.point;commands.push({op:'C',x1:h1.x,y1:h1.y,x2:h2.x,y2:h2.y,...b.point});}
  }
  commands.push({op:'Z'});return{fillRule:path.fillRule,commands};
}
