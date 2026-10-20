import type { GradientFill, WidgetStyle } from './types';
import type { LineStyleRenderer } from './line-style';

/** Independent renderer; the factory has no module-value dependencies so the
 * same implementation can run inside a portable prototype and nested frames. */
export function createGradientRenderer(lines?: LineStyleRenderer) {
  const id = (instance: string) => `rea-gradient-${Array.from(instance, char => char.codePointAt(0)!.toString(16)).join('-')}`;
  const svg = (gradient: GradientFill, width: number, height: number, identifier: string) => {
    const attrs: Record<string, string> = { id: identifier, gradientUnits: 'userSpaceOnUse' };
    if (gradient.type === 'linear') {
      Object.assign(attrs, { x1: String(gradient.start.x * width), y1: String(gradient.start.y * height), x2: String(gradient.end.x * width), y2: String(gradient.end.y * height) });
      return { tag: 'linearGradient', attrs, stops: gradient.stops, empty: false };
    }
    const cx = gradient.center.x * width, cy = gradient.center.y * height;
    const dx = gradient.axis1.x * width - cx, dy = gradient.axis1.y * height - cy;
    const a = Math.hypot(dx, dy), b = Math.hypot(gradient.axis2.x * width - cx, gradient.axis2.y * height - cy);
    const radius = Math.max(a, b), sx = a < b ? a / b : 1, sy = a < b ? 1 : b / a;
    const cos = dx / a, sin = dy / a;
    const m11 = cos * sx, m12 = -sin * sy, m21 = sin * sx, m22 = cos * sy;
    // A zero axis has no well-defined ellipse. Preserve its saved geometry,
    // but paint no fill rather than emitting an invalid NaN SVG transform.
    const degenerate = !a || !b || !Number.isFinite(radius);
    Object.assign(attrs, { cx: String(cx), cy: String(cy), r: String(degenerate ? 0 : radius),
      gradientTransform: degenerate ? 'matrix(1 0 0 1 0 0)' : `matrix(${m11} ${m21} ${m12} ${m22} ${cx - m11 * cx - m12 * cy} ${cy - m21 * cx - m22 * cy})` });
    return { tag: 'radialGradient', attrs, stops: gradient.stops, empty: degenerate };
  };
  /** A transformed shape must sample the same widget-space paint as its shaft.
   * SVG composes group * gradientTransform, so prepend the inverse group before
   * the gradient's own radial basis (not after it). Keep the baseline immutable. */
  const inTransformedSpace=(paint:ReturnType<typeof svg>,inverseTransform:string,identifier:string)=>({
    ...paint,attrs:{...paint.attrs,id:identifier,gradientTransform:`${inverseTransform}${paint.attrs.gradientTransform?' '+paint.attrs.gradientTransform:''}`},
  });
  const escape = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]!));
  const needsComputedColor = (style: Pick<WidgetStyle, 'fillGradient' | 'strokeGradient' | 'color'> & Partial<Pick<WidgetStyle,'stroke'|'linePattern'|'borderVisibility'>>) => /^(currentcolor|inherit|unset)$/i.test(style.color.trim()) && ([style.fillGradient,style.strokeGradient].some(gradient => gradient?.stops.some(stop => /^currentcolor$/i.test(stop.color.trim())))||Boolean(lines&&(style.linePattern&&style.linePattern!=='solid'||style.borderVisibility?.some(v=>!v))&&/^currentcolor$/i.test(style.stroke?.trim()??'')));
  const background = (style: Pick<WidgetStyle, 'fillGradient' | 'color'>, width: number, height: number, computedColor?: string) => {
    if (!style.fillGradient) return 'none';
    const paint = svg(style.fillGradient, width, height, 'g');
    if (paint.empty) return 'none';
    const attributes = Object.entries(paint.attrs).map(([name, value]) => `${name}="${escape(value)}"`).join(' ');
    const stops = paint.stops.map(stop => `<stop offset="${stop.offset}" stop-color="${escape(/^currentcolor$/i.test(stop.color.trim()) ? computedColor ?? style.color : stop.color)}"/>`).join('');
    const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(0, width)}" height="${Math.max(0, height)}" viewBox="0 0 ${Math.max(0, width)} ${Math.max(0, height)}"><defs><${paint.tag} ${attributes}>${stops}</${paint.tag}></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(source)}")`;
  };
  /** Original runtime reuses only the initial default SVG definition. Once it
   * creates a temporary definition, every later paint recreates its stops. */
  const paintSession = (original?: GradientFill) => {
    let defaults = Boolean(original);
    return (next?: GradientFill): GradientFill | undefined => {
      if (!next) { defaults = false; return undefined; }
      if (defaults && original && next.type === original.type && next.stops.length === original.stops.length)
        return { ...next, stops: next.stops.map((stop, index) => ({ ...stop, offset: original.stops[index].offset })) };
      defaults = false;
      return next;
    };
  };
  const supports = (type: string) => !['inlineFrame', 'image', 'line', 'hotspot'].includes(type);
  const supportsStroke = (type: string) => !['inlineFrame','hotspot'].includes(type);
  const strokeMode = (type: string) => !supportsStroke(type) ? 'none' : type === 'image' ? 'imageFallback' : 'gradient';
  const strokeColor = (style: Pick<WidgetStyle,'stroke'|'strokeGradient'>, type: string) => !style.strokeGradient || !supportsStroke(type) ? style.stroke : type === 'image' ? style.strokeGradient.type === 'linear' ? style.strokeGradient.stops[0].color : 'transparent' : 'transparent';
  /** A continuous border silhouette avoids border-image's independently stretched
   * nine slices. Real CSS borders retain the layout and hit-testing geometry. */
  const borderGeometry = (style: Pick<WidgetStyle,'strokeWidth'|'borderWidths'|'radius'|'cornerRadii'|'cornerVisibility'|'borderVisibility'>, width: number, height: number, ellipse = false) => {
    const [top,right,bottom,left] = style.borderWidths ?? [style.strokeWidth,style.strokeWidth,style.strokeWidth,style.strokeWidth];
    const radii=ellipse ? [Math.min(width,height)/2,Math.min(width,height)/2,Math.min(width,height)/2,Math.min(width,height)/2] : (style.cornerRadii ?? [style.radius,style.radius,style.radius,style.radius]).map((r,i)=>style.cornerVisibility?.[i]===false?0:r);
    const factors=[1,width/(radii[0]+radii[1]||1),width/(radii[3]+radii[2]||1),height/(radii[0]+radii[3]||1),height/(radii[1]+radii[2]||1)];
    const scale=Math.min(...factors),outer=radii.map(radius=>[radius*scale,radius*scale]);
    if(ellipse)for(const corner of outer){corner[0]=width/2;corner[1]=height/2}
    const round=(x:number,y:number,w:number,h:number,r:number[][])=>{
      const [tl,tr,br,bl]=r,arc=(radius:number[],endX:number,endY:number)=>radius[0]&&radius[1]?`A ${radius[0]} ${radius[1]} 0 0 1 ${endX} ${endY}`:`L ${endX} ${endY}`;
      return `M ${x+tl[0]} ${y} L ${x+w-tr[0]} ${y} ${arc(tr,x+w,y+tr[1])} L ${x+w} ${y+h-br[1]} ${arc(br,x+w-br[0],y+h)} L ${x+bl[0]} ${y+h} ${arc(bl,x,y+h-bl[1])} L ${x} ${y+tl[1]} ${arc(tl,x+tl[0],y)} Z`;
    };
    const outside=round(0,0,width,height,outer),insideWidth=width-left-right,insideHeight=height-top-bottom;
    if(insideWidth<=0||insideHeight<=0)return {outside,inside:'',left,top,width:0,height:0};
    const inner=outer.map(([x,y],index)=>[Math.max(0,x-(index===0||index===3?left:right)),Math.max(0,y-(index<2?top:bottom))]);
    return {outside,inside:round(left,top,insideWidth,insideHeight,inner),left,top,width:insideWidth,height:insideHeight};
  };
  const borderPath = (style: Pick<WidgetStyle,'strokeWidth'|'borderWidths'|'radius'|'cornerRadii'|'cornerVisibility'>, width:number,height:number,ellipse=false)=>{const paths=borderGeometry(style,width,height,ellipse);return `${paths.outside} ${paths.inside}`};
  const border = (style: WidgetStyle, width:number,height:number,ellipse=false,computedColor?:string) => {
    if(width<=0||height<=0||style.linePattern==='none')return 'none';
    const paint=style.strokeGradient?svg(style.strokeGradient,width,height,'s'):undefined;if(paint?.empty)return 'none';
    const attributes=paint?Object.entries(paint.attrs).map(([name,value])=>`${name}="${escape(value)}"`).join(' '):'';
    const stops=paint?.stops.map(stop=>`<stop offset="${stop.offset}" stop-color="${escape(/^currentcolor$/i.test(stop.color.trim())?computedColor??style.color:stop.color)}"/>`).join('')??'';
    const adjusted=lines&&!ellipse&&style.borderVisibility?.some(v=>!v)?{...style,cornerRadii:lines.rectangle(style,width,height).radii as [number,number,number,number]}:style;
    const paths=borderGeometry(adjusted,width,height,ellipse);
    // Asymmetric widths can make an inner corner exceed the padding box.
    // Its excess must be clipped, never subtracted from another border side.
    const mask=paths.inside?`<clipPath id="i"><rect x="${paths.left}" y="${paths.top}" width="${paths.width}" height="${paths.height}"/></clipPath><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><path d="${paths.inside}" fill="black" fill-rule="evenodd" clip-path="url(#i)"/></mask>`:'';
    const color=paint?'url(#s)':escape(/^currentcolor$/i.test(style.stroke.trim())?computedColor??style.color:style.stroke),pattern=lines?.pattern(style);
    let extraDefs='',body=`<path d="${paths.outside}" fill="${color}"${paths.inside?' mask="url(#m)"':''}/>`;
    if(lines&&((style.linePattern??'solid')!=='solid'||style.borderVisibility?.some(v=>!v))){
      const widths=style.borderWidths??Array(4).fill(style.strokeWidth),thickness=Math.max(...widths),visible=ellipse?[true,true,true,true]:style.borderVisibility??[true,true,true,true];
      const path=ellipse?`M ${width/2} ${thickness/2} A ${Math.max(0,(width-thickness)/2)} ${Math.max(0,(height-thickness)/2)} 0 1 1 ${width/2} ${height-thickness/2} A ${Math.max(0,(width-thickness)/2)} ${Math.max(0,(height-thickness)/2)} 0 1 1 ${width/2} ${thickness/2} Z`:lines.rectangle({...style,strokeWidth:thickness,borderVisibility:visible as [boolean,boolean,boolean,boolean]},width,height).strokeD;
      body=`<path d="${path}" fill="none" stroke="${color}" stroke-width="${thickness}" stroke-dasharray="${pattern?.dashArray??''}" stroke-linecap="butt" stroke-linejoin="miter"/>`;
      // A widest-side stroke can spill into a hidden narrow neighbor. Paint
      // unequal sides independently and clip each to its own border region.
      if(widths.some(n=>n!==thickness)){
        const [top,right,bottom,left]=widths.map((n,i)=>visible[i]?n:0),sx=left+right>width?width/(left+right):1,sy=top+bottom>height?height/(top+bottom):1;
        const ix=left*sx,iy=top*sy,ex=width-right*sx,ey=height-bottom*sy;
        const regions=[`M 0 0 L ${width} 0 L ${ex} ${iy} L ${ix} ${iy} Z`,`M ${width} 0 L ${width} ${height} L ${ex} ${ey} L ${ex} ${iy} Z`,`M ${width} ${height} L 0 ${height} L ${ix} ${ey} L ${ex} ${ey} Z`,`M 0 ${height} L 0 0 L ${ix} ${iy} L ${ix} ${ey} Z`];
        extraDefs=`<clipPath id="o"><path d="${paths.outside}"/></clipPath>`+regions.map((d,i)=>`<clipPath id="side${i}"><path d="${d}"/></clipPath>`).join('');
        body=widths.map((thick,i)=>{
          if(!visible[i]||!thick)return '';
          const d=ellipse?`M ${width/2} ${thick/2} A ${Math.max(0,(width-thick)/2)} ${Math.max(0,(height-thick)/2)} 0 1 1 ${width/2} ${height-thick/2} A ${Math.max(0,(width-thick)/2)} ${Math.max(0,(height-thick)/2)} 0 1 1 ${width/2} ${thick/2} Z`:lines.rectangle({...adjusted,strokeWidth:thick,borderVisibility:[true,true,true,true]},width,height).strokeD;
          return `<g clip-path="url(#side${i})"><path d="${d}" fill="none" stroke="${color}" stroke-width="${thick}" stroke-dasharray="${lines.pattern({...style,strokeWidth:thick}).dashArray}" stroke-linecap="butt" stroke-linejoin="miter"/></g>`;
        }).join('');
        body=`<g clip-path="url(#o)"${paths.inside?' mask="url(#m)"':''}>${body}</g>`;
      }
    }
    const source=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${paint?`<${paint.tag} ${attributes}>${stops}</${paint.tag}>`:''}${mask}${extraDefs}</defs>${body}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(source)}")`;
  };
  const backgrounds=(style:WidgetStyle,type:string,width:number,height:number,computedColor?:string)=>{
    const layers:string[]=[];
    if(strokeMode(type)==='gradient'&&type!=='line'&&(style.strokeGradient||lines?.paintedBorder(style,type)))layers.push(border(style,width,height,type==='ellipse',computedColor));
    if(supports(type)&&style.fillGradient)layers.push(background(style,width,height,computedColor));
    return layers.filter(layer=>layer!=='none').join(', ')||'none';
  };
  return { svg, inTransformedSpace, id, background, backgrounds, border, borderPath, paintSession, supports, supportsStroke, strokeMode, strokeColor, needsComputedColor };
}
export type GradientRenderer = ReturnType<typeof createGradientRenderer>;
