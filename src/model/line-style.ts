import type { ArrowStyle, VectorCommand, Widget, WidgetStyle } from './types';

/** Independent, portable geometry. No DOM or module-value dependencies. */
export function createLineStyleRenderer() {
  type Point={x:number;y:number};
  type Segment={a:Point;b:Point;c?:Point;d?:Point};
  type Contour={start:Point;segments:Segment[];closed:boolean};
  const patterns:Record<string,number[]>={'solid':[],'long-dash':[17,8],'medium-dash':[9,4],'short-dash':[3,1],'dash-dot':[9,4,2,4],'dash-dot-dot':[9,4,2,4,2,4],'long-dash-short-dash':[17,4,5,4],'dot':[1,1],'none':[0]};
  const supportsPattern=(type:string)=>!['inlineFrame','hotspot'].includes(type);
  const supportsSides=(widget:Pick<Widget,'type'|'vectorPath'> & Partial<Pick<Widget,'width'|'height'|'style'>>)=>widget.vectorPath?widget.type==='box'&&Boolean(widget.style?.cornerVisibility&&rectangleFamily(widget.vectorPath)||rectangleRadii(widget.vectorPath,widget.width??1,widget.height??1)):!['line','ellipse','image','inlineFrame','hotspot'].includes(widget.type);
  const contours=(commands:readonly VectorCommand[],width:number,height:number):Contour[]=>{
    const result:Contour[]=[];let current:Contour|undefined,p:Point={x:0,y:0};
    for(const command of commands){
      if(command.op==='M'){p={x:command.x*width,y:command.y*height};current={start:p,segments:[],closed:false};result.push(current);}
      else if(command.op==='Z'){if(current){current.closed=true;if(p.x!==current.start.x||p.y!==current.start.y)current.segments.push({a:p,b:current.start});p=current.start;}}
      else if(current){const b={x:command.x*width,y:command.y*height};current.segments.push(command.op==='C'?{a:p,b,c:{x:command.x1*width,y:command.y1*height},d:{x:command.x2*width,y:command.y2*height}}:{a:p,b});p=b;}
    }return result;
  };
  const supportsEnds=(widget:Pick<Widget,'type'|'vectorPath'>)=>widget.type==='line'||Boolean(widget.vectorPath&&contours(widget.vectorPath.commands,1,1).some(c=>!c.closed&&c.segments.length));
  const rectangleSegments=(width:number,height:number,r:number[])=>{
    const p=(x:number,y:number)=>({x,y});
    const starts=[p(0,r[0]),p(width-r[1],0),p(width,height-r[2]),p(r[3],height)],ends=[p(r[0],0),p(width,r[1]),p(width-r[2],height),p(0,height-r[3])];
    const handles=[[p(0,.44*r[0]),p(.44*r[0],0)],[p(width-.44*r[1],0),p(width,.44*r[1])],[p(width,height-.44*r[2]),p(width-.44*r[2],height)],[p(.44*r[3],height),p(0,height-.44*r[3])]];
    const result:Segment[]=[];for(let i=0;i<4;i++){if(r[i]>0)result.push({a:starts[i],b:ends[i],c:handles[i][0],d:handles[i][1]});const next=starts[(i+1)%4];if(ends[i].x!==next.x||ends[i].y!==next.y)result.push({a:ends[i],b:next});}return result;
  };
  /** Geometry validation, not a persistent native identity flag. Editing any
   * anchor/handle outside the exact clockwise rectangle family disables it. */
  const rectangleRadii=(path:NonNullable<Widget['vectorPath']>,width:number,height:number,allowLarge=false):number[]|undefined=>{
    if(width<=0||height<=0)return undefined;const cs=contours(path.commands,width,height);if(cs.length!==1||!cs[0].closed||cs[0].segments.length<4||cs[0].segments.length>8)return undefined;
    const ss=cs[0].segments,points=ss.map(s=>s.a),epsilon=1e-7,eq=(a:number,b:number)=>Math.abs(a-b)<=epsilon;
    if(points.some(p=>p.x<0||p.y<0||p.x>width||p.y>height))return undefined;
    const top=points.filter(p=>eq(p.y,0)).map(p=>p.x),right=points.filter(p=>eq(p.x,width)).map(p=>p.y),bottom=points.filter(p=>eq(p.y,height)).map(p=>p.x),left=points.filter(p=>eq(p.x,0)).map(p=>p.y);if([top,right,bottom,left].some(a=>!a.length))return undefined;
    const r=[Math.min(...top),width-Math.max(...top),height-Math.max(...right),Math.min(...bottom)];if(r.some(n=>n<0||n>Math.min(width,height)/(allowLarge?1:2))||r[0]+r[1]>width+epsilon||r[2]+r[3]>width+epsilon||r[0]+r[3]>height+epsilon||r[1]+r[2]>height+epsilon||!eq(r[0],Math.min(...left))||!eq(r[1],Math.min(...right))||!eq(r[2],width-Math.max(...bottom))||!eq(r[3],height-Math.max(...left)))return undefined;
    const samePoint=(a:Point|undefined,b:Point|undefined)=>!a||!b?a===b:eq(a.x,b.x)&&eq(a.y,b.y);
    let expected=rectangleSegments(width,height,r);
    // Normalized pill ratios can create an epsilon-length expected straight
    // edge where the saved path joins two curves at one anchor. Only reconcile
    // a segment-count mismatch; keep the existing point/handle tolerance and
    // do not change the actual saved path or the dynamic rectangle painter.
    if(allowLarge&&expected.length!==ss.length)expected=expected.filter(s=>s.c||s.d||!samePoint(s.a,s.b));
    if(expected.length!==ss.length)return undefined;
    for(let shift=0;shift<ss.length;shift++)if(expected.every((s,i)=>{const a=ss[(i+shift)%ss.length];return samePoint(s.a,a.a)&&samePoint(s.b,a.b)&&samePoint(s.c,a.c)&&samePoint(s.d,a.d);}))return r;
    return undefined;
  };
  /** Validate the saved normalized rectangle family, independently of the
   * current size. Resizing a parameterized rectangle must not turn its saved
   * circular corners into an unrecognized ellipse. Arbitrary handle edits
   * still disable reconstruction. This is not a native identity assertion. */
  const rectangleFamily=(path:NonNullable<Widget['vectorPath']>)=>{
    const cs=contours(path.commands,1,1);if(cs.length!==1||!cs[0].closed)return false;
    const ss=cs[0].segments;if(ss.length<4||ss.length>8)return false;
    const eq=(a:number,b:number)=>Math.abs(a-b)<=1e-7,points=ss.map(s=>s.a);
    if(points.some(p=>p.x<0||p.y<0||p.x>1||p.y>1))return false;
    const top=points.filter(p=>eq(p.y,0)).map(p=>p.x),right=points.filter(p=>eq(p.x,1)).map(p=>p.y),bottom=points.filter(p=>eq(p.y,1)).map(p=>p.x),left=points.filter(p=>eq(p.x,0)).map(p=>p.y);
    if([top,right,bottom,left].some(a=>!a.length))return false;
    const rx=[Math.min(...top),1-Math.max(...top),1-Math.max(...bottom),Math.min(...bottom)],ry=[Math.min(...left),Math.min(...right),1-Math.max(...right),1-Math.max(...left)];
    if(rx.some((r,i)=>(r===0)!==(ry[i]===0)))return false;
    const ratios=rx.map((r,i)=>r?ry[i]/r:0).filter(Boolean);if(ratios.some(n=>!eq(n,ratios[0])))return false;
    // Scale Y once to recover the original circular family; this also checks
    // every anchor, .44 cubic handle, contour order and pairwise radius bound.
    return Boolean(rectangleRadii(path,1,ratios.length?1/ratios[0]:1,true));
  };
  const supportsCorners=(widget:Pick<Widget,'type'|'vectorPath'|'style'|'width'|'height'>)=>widget.vectorPath
    ?widget.type==='box'&&Boolean(widget.style.cornerVisibility)&&rectangleFamily(widget.vectorPath)
    :!['line','ellipse','image','inlineFrame','hotspot','table'].includes(widget.type);
  /** The retained HTML branch disables corners with classes; browser CSS
   * performs its own radius scaling. It does not use the SVG stroke clamp. */
  const cssRadii=(style:WidgetStyle)=>{
    const corners=style.cornerVisibility??[true,true,true,true],borders=style.borderVisibility??[true,true,true,true],r=style.cornerRadii??[style.radius,style.radius,style.radius,style.radius];
    return r.map((value,i)=>corners[i]&&borders[(i+3)%4]===borders[i]?value:0);
  };
  const rectangle=(style:WidgetStyle,width:number,height:number)=>{
    width=Math.round(width);height=Math.round(height);
    const visible=style.borderVisibility??[true,true,true,true],corners=style.cornerVisibility??[true,true,true,true],r=(style.cornerRadii??[style.radius,style.radius,style.radius,style.radius]).map((v,i)=>corners[i]?v:0);
    const half=style.strokeWidth/2,x=[visible[3]?half:0,width-(visible[1]?half:0)],y=[visible[0]?half:0,height-(visible[2]?half:0)];
    const on=r.map((v,i)=>v>0&&visible[(i+3)%4]&&visible[i]),ceiling=Math.min(on[0]&&on[3]||on[1]&&on[2]?height/2:height,on[0]&&on[1]||on[3]&&on[2]?width/2:width);
    const strokeR=r.map((v,i)=>on[i]?Math.min(v,ceiling):0),fillR=r.map((v,i)=>visible[(i+3)%4]===visible[i]?Math.min(v,ceiling):0);
    const p=(a:number,b:number)=>point(a,b),start=[p(strokeR[0]||x[0],y[0]),p(x[1],strokeR[1]||y[0]),p(strokeR[2]?width-strokeR[2]:x[1],y[1]),p(x[0],strokeR[3]?height-strokeR[3]:y[1])];
    const end=[p(strokeR[1]?width-strokeR[1]:x[1],y[0]),p(x[1],strokeR[2]?height-strokeR[2]:y[1]),p(strokeR[3]||x[0],y[1]),p(x[0],strokeR[0]||y[0])];
    const arcs=strokeR.map(a=>(a-half)*.44+half),controls=[[p(width-arcs[1],y[0]),p(x[1],arcs[1])],[p(x[1],height-arcs[2]),p(width-arcs[2],y[1])],[p(arcs[3],y[1]),p(x[0],height-arcs[3])],[p(x[0],arcs[0]),p(arcs[0],y[0])]];
    let d='';const firstMissing=visible.indexOf(false),first=firstMissing<0?0:(firstMissing+1)%4;
    for(let n=0;n<4;n++){const i=(first+n)%4;if(!visible[i])continue;const next=(i+1)%4;if(!n||!visible[(i+3)%4])d+=`M ${fmt(start[i])} `;d+=`L ${fmt(end[i])} `;if(strokeR[next])d+=`C ${fmt(controls[i][0])} ${fmt(controls[i][1])} ${fmt(start[next])} `;}
    if(visible.every(Boolean))d+='Z';return{strokeD:d.trim(),fillD:segmentData(rectangleSegments(width,height,fillR))+' Z',radii:fillR};
  };
  const pattern=(style:Pick<WidgetStyle,'linePattern'|'strokeWidth'>)=>({dashArray:(patterns[style.linePattern??'solid']??[]).map(n=>n*style.strokeWidth).join(','),hidden:style.linePattern==='none',css:style.linePattern==='none'?'none':['dot','dash-dot','dash-dot-dot'].includes(style.linePattern??'')?'dotted':!style.linePattern||style.linePattern==='solid'?'solid':'dashed'});
  const paintedBorder=(style:WidgetStyle,type:string)=>supportsPattern(type)&&type!=='image'&&((style.linePattern??'solid')!=='solid'||Boolean(style.borderVisibility?.some(v=>!v)));
  const point=(x:number,y:number):Point=>({x,y}),fmt=(p:Point)=>`${p.x} ${p.y}`;
  const polygon=(points:Point[])=>points.length?`M ${points.map(fmt).join(' L ')} Z`:'';
  const circle=(r:number)=>r>0?`M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`:'';
  const arrowDimensions=(style:ArrowStyle,width:number)=>{
    const composite:Partial<Record<ArrowStyle,[ArrowStyle,ArrowStyle]>>={'double-reverse-crow':['reverse-crow','reverse-crow'],'double-filled-triangle':['filled-triangle','filled-triangle'],'double-hollow-triangle':['hollow-triangle','hollow-triangle'],'double-cross-bar':['cross-bar','cross-bar'],'t-bar':['cross-bar','none'],'crow-hollow-circle':['crow','hollow-circle'],'cross-bar-hollow-circle':['cross-bar','hollow-circle'],'crow-cross-bar':['crow','cross-bar'],'t-bar-reverse-crow':['cross-bar','reverse-crow']};
    const [first,second]=composite[style]??[style,'none'];
    const offset=['diamond','hollow-diamond'].includes(style)?.8*width:['cross-bar','double-cross-bar','slanted-bar','cross-bar-hollow-circle'].includes(style)?width+5:['t-bar','t-bar-reverse-crow'].includes(style)?Math.floor((width+1)*.5):['filled-circle','hollow-circle'].includes(style)?.5*width+2.5:['filled-square','hollow-square'].includes(style)?.5*width+2:['large-hollow-diamond','large-filled-diamond'].includes(style)?8+2.6*width:0;
    const secondOffset=style==='double-reverse-crow'?5+.7*width:['double-filled-triangle','double-hollow-triangle'].includes(style)?3+2*width:style==='double-cross-bar'?10+2*width:['crow-hollow-circle','cross-bar-hollow-circle'].includes(style)?7+1.8*width:style==='crow-cross-bar'?width+5:style==='t-bar-reverse-crow'?width:0;
    const cut=Math.ceil(['reverse-crow','skinny-triangle','double-reverse-crow'].includes(style)?.7*width:['filled-triangle','hollow-triangle','hollow-circle','hollow-square'].includes(style)?width+4:['diamond','double-filled-triangle','filled-circle','filled-square'].includes(style)?width:style==='half-reverse-crow'?.3*width:style==='double-hollow-triangle'?10+width:style==='hollow-diamond'?5+width:['crow-hollow-circle','cross-bar-hollow-circle'].includes(style)?10+1.8*width:['large-hollow-triangle','large-filled-triangle','large-filled-diamond'].includes(style)?9+1.5*width:style==='large-hollow-diamond'?16+4.6*width:0);
    return{first,second,offset,secondOffset,cut};
  };
  /** Formula-based outlines, in endpoint-local coordinates (tip points +X).
   * The open crow families retain their native center curves and flat caps;
   * browser stroke tessellation is not claimed to equal Axure's offset solver. */
  const arrow=(style:ArrowStyle,width:number):{d:string;strokeD?:string;strokeWidth?:number}=>{
    const w=width,p=point;
    const triangle=(large=false)=>{const x=-(large?8+Math.ceil(2.6*w):4+Math.ceil(1.5*w)),r=large?5.5+2*w:5+1.3*w;return polygon([p(x,r),p(0,0),p(x,-r)]);};
    const diamond=(large=false)=>large?polygon([p(0,5.5+2*w),p(8+2.6*w,0),p(0,-5.5-2*w),p(-8-2.6*w,0)]):polygon([p(-3-.1*w,3+.7*w),p(.8*w,0),p(-3-.1*w,-3-.7*w),p(-6-.9*w,0)]);
    if(style==='none')return{d:''};
    if(style==='filled-triangle'||style==='large-filled-triangle')return{d:triangle(style.startsWith('large'))};
    if(style==='hollow-triangle'){let d=triangle();if(1.1*w<4)d+=` ${polygon([p(-4-Math.ceil(.5*w),5-1.1*w),p(-4-Math.ceil(.5*w),-5+1.1*w),p(-1.5*w,0)])}`;return{d};}
    if(style==='large-hollow-triangle')return{d:`${triangle(true)} ${polygon([p(-8-Math.ceil(1.6*w),5.5+.2*w),p(-8-Math.ceil(1.6*w),-5.5-.2*w),p(-.5-1.3*w,0)])}`};
    if(style==='skinny-triangle')return{d:polygon([p(-4-2.7*w,4+2*w),p(0,0),p(-4-2.7*w,-4-2*w),p(-3-1.4*w,0)])};
    if(style==='diamond'||style==='large-filled-diamond')return{d:diamond(style.startsWith('large'))};
    if(style==='hollow-diamond')return{d:diamond()+(w<4.5?` ${polygon([p(-3-.1*w,-3+.7*w),p(-.6*w,0),p(-3-.1*w,3-.7*w),p(-6+.5*w,0)])}`:'')};
    if(style==='large-hollow-diamond')return{d:`${diamond(true)} ${polygon([p(0,-5.5-.7*w),p(8+1.1*w,0),p(0,5.5+.7*w),p(-8-1.1*w,0)])}`};
    if(style==='filled-circle'||style==='hollow-circle')return{d:circle(2.5+w/2)+(style==='hollow-circle'&&2.5-w/2>.0001?` ${circle(2.5-w/2)}`:'')};
    if(style==='filled-square'||style==='hollow-square'){const r=2+w/2,h=2-w/2;return{d:polygon([p(-r,-r),p(-r,r),p(r,r),p(r,-r)])+(style==='hollow-square'&&h>.0001?` ${polygon([p(-h,-h),p(h,-h),p(h,h),p(-h,h)])}`:'')};}
    if(style==='cross-bar'){const a=-Math.floor(w/2),b=-Math.floor(-w/2),r=Math.abs(w%2)<.00001||Math.abs(w%2-2)<.00001?5:5.5;return{d:polygon([p(a,-r),p(a,r),p(b,r),p(b,-r)])};}
    if(style==='slanted-bar'){const r=Math.abs(w%2)<.00001||Math.abs(w%2-2)<.00001?5:5.5;return{d:polygon([p(5-.7*w,r),p(5+.7*w,r),p(-5+.7*w,-r),p(-5-.7*w,-r)])};}
    if(style==='crow')return{d:'',strokeD:`M ${-.3*w} -5 L ${-5-.3*w} 0 L ${-.3*w} 5`,strokeWidth:w};
    if(style==='reverse-crow')return{d:'',strokeD:`M ${-5-.7*w} -5 L ${-.7*w} 0 L ${-5-.7*w} 5`,strokeWidth:w};
    if(style==='curved-reverse-crow')return{d:'',strokeD:`M ${-5-.7*w} -5 C ${-5-.7*w} -5 ${-3-.7*w} 0 ${-.7*w} 0 C ${-3-.7*w} 0 ${-5-.7*w} 5 ${-5-.7*w} 5`,strokeWidth:w};
    if(style==='half-reverse-crow'){const a=p(-.35*w,.15*w),b=p(-5-.7*w,-5),length=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/length*w/2,ny=(b.x-a.x)/length*w/2;return{d:polygon([p(a.x+nx,a.y+ny),p(b.x+nx,b.y+ny),p(b.x-nx,b.y-ny),p(a.x-nx,a.y-ny),p(0,w/2)])};}
    return{d:''};
  };
  const mix=(a:Point,b:Point,t:number)=>point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
  const at=(s:Segment,t:number):Point=>s.c&&s.d?mix(mix(mix(s.a,s.c,t),mix(s.c,s.d,t),t),mix(mix(s.c,s.d,t),mix(s.d,s.b,t),t),t):mix(s.a,s.b,t);
  const tangent=(s:Segment,t:number)=>s.c&&s.d?point(3*(1-t)**2*(s.c.x-s.a.x)+6*(1-t)*t*(s.d.x-s.c.x)+3*t*t*(s.b.x-s.d.x),3*(1-t)**2*(s.c.y-s.a.y)+6*(1-t)*t*(s.d.y-s.c.y)+3*t*t*(s.b.y-s.d.y)):point(s.b.x-s.a.x,s.b.y-s.a.y);
  const length=(s:Segment)=>{if(!s.c||!s.d)return Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y);let total=0,old=s.a;for(let n=1;n<=128;n++){const next=at(s,n/128);total+=Math.hypot(next.x-old.x,next.y-old.y);old=next;}return total;};
  const split=(s:Segment,t:number):[Segment,Segment]=>{if(!s.c||!s.d){const p=at(s,t);return[{a:s.a,b:p},{a:p,b:s.b}];}const a=mix(s.a,s.c,t),b=mix(s.c,s.d,t),c=mix(s.d,s.b,t),d=mix(a,b,t),e=mix(b,c,t),f=mix(d,e,t);return[{a:s.a,c:a,d,b:f},{a:f,c:e,d:c,b:s.b}];};
  // Native x5E5/o5E1 use distance/segment.Length as the cubic parameter,
  // not a per-segment arc-length inverse. Preserve that observed quirk.
  const locate=(segments:Segment[],distance:number,fromEnd=false)=>{let remaining=distance;const indices=segments.map((_,i)=>i);if(fromEnd)indices.reverse();for(const index of indices){const s=segments[index],n=length(s);if(n>=remaining&&n>0){const t=fromEnd?1-remaining/n:remaining/n;return{index,t,point:at(s,t),tangent:tangent(s,t)};}remaining-=n;}return undefined;};
  const segmentData=(segments:Segment[])=>segments.length?`M ${fmt(segments[0].a)} `+segments.map(s=>s.c&&s.d?`C ${fmt(s.c)} ${fmt(s.d)} ${fmt(s.b)}`:`L ${fmt(s.b)}`).join(' '):'';
  const geometry=(widget:Pick<Widget,'type'|'vectorPath'|'style'|'width'|'height'>)=>{
    const cs=widget.type==='line'?[{start:point(0,widget.height/2),segments:[{a:point(0,widget.height/2),b:point(widget.width,widget.height/2)}],closed:false}]:contours(widget.vectorPath?.commands??[],widget.width,widget.height);
    const ends=widget.style.lineEnds??{start:'none',end:'none'},width=widget.style.strokeWidth,arrows:{d:string;strokeD?:string;strokeWidth?:number;transform:string;inverseTransform:string;end:'start'|'end'}[]=[];const shaft:string[]=[];
    for(const c of cs){if(!c.segments.length)continue;if(c.closed){shaft.push(segmentData(c.segments)+' Z');continue;}let segments=c.segments;
      for(const end of ['start','end'] as const){const style=ends[end],dim=arrowDimensions(style,width);if(style==='none')continue;for(const [kind,distance]of [[dim.first,dim.offset],[dim.second,dim.secondOffset]] as const){if(kind==='none')continue;const where=locate(segments,distance,end==='end');if(!where)continue;const sign=end==='start'?-1:1,angle=Math.atan2(where.tangent.y*sign,where.tangent.x*sign)*180/Math.PI;if(!Number.isFinite(angle))continue;arrows.push({...arrow(kind,width),transform:`translate(${where.point.x} ${where.point.y}) rotate(${angle})`,inverseTransform:`rotate(${-angle}) translate(${-where.point.x} ${-where.point.y})`,end});}
        if(style==='crow-hollow-circle'||style==='cross-bar-hollow-circle'){
          const where=locate(segments,5+1.8*width,end==='end');
          if(where)shaft.push(segmentData(end==='start'?[...segments.slice(0,where.index),split(segments[where.index],where.t)[0]]:[split(segments[where.index],where.t)[1],...segments.slice(where.index+1)]));
        }
        if(dim.cut>0){const where=locate(segments,dim.cut,end==='end');if(!where){segments=[];continue;}
          // Native Q5Rp/O5Rd remove only the first/last segment when the
          // located cut falls in a later segment; they do not trim that one.
          segments=end==='start'?where.index!==0?segments.slice(1):[split(segments[0],where.t)[1],...segments.slice(1)]:where.index!==segments.length-1?segments.slice(0,-1):[...segments.slice(0,-1),split(segments[where.index],where.t)[0]];
        }
      }shaft.push(segmentData(segments));
    }return{strokeD:shaft.filter(Boolean).join(' '),arrows,pattern:pattern(widget.style)};
  };
  // Recognizing a rectangle permits side editing; it does not authorize
  // replacing an existing path with the unrelated default style.radius.
  const vectorRectangle=(widget:Pick<Widget,'type'|'vectorPath'|'style'|'width'|'height'>)=>{
    if(widget.type!=='box'||!widget.vectorPath)return undefined;
    if(widget.style.cornerVisibility&&rectangleFamily(widget.vectorPath))return rectangle(widget.style,widget.width,widget.height);
    if(!widget.style.borderVisibility?.some(v=>!v))return undefined;
    const radii=rectangleRadii(widget.vectorPath,widget.width,widget.height);
    return radii?rectangle({...widget.style,cornerRadii:radii as [number,number,number,number]},widget.width,widget.height):undefined;
  };
  return{supportsPattern,supportsSides,supportsEnds,supportsCorners,cssRadii,pattern,arrow,arrowDimensions,geometry,rectangleRadii,rectangle,vectorRectangle,paintedBorder};
}
export type LineStyleRenderer=ReturnType<typeof createLineStyleRenderer>;
