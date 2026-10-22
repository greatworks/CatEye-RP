import type { Widget } from './types';
import type { SelectionDisplayRect } from '../runtime/selection-text-layout';

/** Snapshot of the runtime SVG cascade. Event ordering and persistent stroke
 * attributes belong to the runtime; rendering this value has no side effects. */
export interface SelectionIndicatorPaint {
  assetSize: number;
  assetStrokeWidth: number;
  fill: string;
  stroke: string;
  outlineWidth: number;
  markFill: string;
  markStroke: string;
  markWidth?: number;
  svgScaleX?: number;
  svgScaleY?: number;
  svgTransformOrigin?: 'top left';
}

/** Bounded ordinary SelectionButton geometry, independently rendered as SVG.
 * TIdc/C5vD BoxModel0: full fill, half-stroke-inset outline. Source declarations
 * determine the CSS crop independently of captured paths and runtime paint.
 * Complex paint/corners/shadows and transformed controls retain legacy display.
 */
export function createSelectionIndicatorRenderer() {
  // A non-null transparent solid remains a color; only a missing native fill
  // chooses the theme. Keep this bounded parser inside the portable factory.
  const solid = (value: string) => {
    const text = value.trim();
    if (/^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|black|white|transparent)$/i.test(text)) return true;
    const match = /^(rgb|rgba)\(([^()]*)\)$/i.exec(text);
    if (!match) return false;
    const parts = match[2].split(',').map(part => part.trim());
    if (parts.length !== (match[1].toLowerCase() === 'rgba' ? 4 : 3)) return false;
    return parts.every((part, index) => /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(part)
      && Number(part) >= 0 && Number(part) <= (index === 3 ? 1 : 255));
  };
  const viewport = (widget: Widget) => {
    const b = widget.style.selectionButtonSize, width = widget.style.strokeWidth;
    if (typeof b !== 'number' || !Number.isFinite(b) || b < 0 || !Number.isFinite(width) || width < 0) return;
    const size = b + (width > 1 ? width + 1 : 1);
    if (!Number.isFinite(size)) return;
    return { size, offset: width > 1 ? width / 2 : 0 };
  };
  const supports = (widget: Widget, paint?: SelectionIndicatorPaint) => {
    const s = widget.style, b = paint?.assetSize ?? s.selectionButtonSize;
    const width = paint?.assetStrokeWidth ?? s.strokeWidth;
    if (paint && (![paint.assetSize, paint.assetStrokeWidth, paint.outlineWidth, paint.markWidth ?? 0].every(value => Number.isFinite(value) && value >= 0)
      || ![paint.fill, paint.stroke, paint.markFill, paint.markStroke].every(value => value === 'none' || solid(value)))) return false;
    if (paint && ((paint.svgScaleX === undefined) !== (paint.svgScaleY === undefined)
      || paint.svgScaleX !== undefined && (!Number.isFinite(paint.svgScaleX) || !Number.isFinite(paint.svgScaleY))
      || paint.svgTransformOrigin !== undefined && paint.svgTransformOrigin !== 'top left')) return false;
    return (widget.type === 'checkbox' || widget.type === 'radio') && !!viewport(widget) && widget.rotation === 0 && typeof b === 'number'
      && Number.isFinite(b) && b > width && width >= 0 && s.radius === 0
      && (!s.linePattern || s.linePattern === 'solid' || !!paint && s.linePattern === 'none') && !s.fillGradient && !s.strokeGradient
      && !s.outerShadow?.on && !s.innerShadow?.on && solid(s.fill) && solid(s.stroke)
      && (!s.borderVisibility || s.borderVisibility.every(Boolean))
      && (!s.borderWidths || s.borderWidths.every(value => value === s.strokeWidth))
      && (!s.cornerRadii || s.cornerRadii.every(value => value === 0));
  };
  const geometry = (widget: Widget, paint?: SelectionIndicatorPaint) => {
    if (!supports(widget, paint)) return;
    const b = paint?.assetSize ?? widget.style.selectionButtonSize!, half = (paint?.assetStrokeWidth ?? widget.style.strokeWidth) / 2, u = b / 14;
    const ellipse = (inset: number, size: number) => {
      const p = (x: number, y: number) => `${inset+x*size} ${inset+y*size}`, low = 1-.78;
      return `M ${p(.5,0)} C ${p(.78,0)} ${p(1,low)} ${p(1,.5)} C ${p(1,.78)} ${p(.78,1)} ${p(.5,1)} C ${p(low,1)} ${p(0,.78)} ${p(0,.5)} C ${p(0,low)} ${p(low,0)} ${p(.5,0)} Z`;
    };
    // r57L's radio mark starts at bottom-mid and returns there with four
    // cubics, without ClosePath. Preserve that subpath when runtime adds stroke.
    const center = b / 2, radius = b / 4, control = radius * .56, high = b - radius;
    const dotPath = `M ${center} ${high} C ${center-control} ${high} ${radius} ${center+control} ${radius} ${center}`
      + ` C ${radius} ${center-control} ${center-control} ${radius} ${center} ${radius}`
      + ` C ${center+control} ${radius} ${high} ${center-control} ${high} ${center}`
      + ` C ${high} ${center+control} ${center+control} ${high} ${center} ${high}`;
    return { size: b, inset: half, outlineSize: b - 2 * half,
      fillPath: widget.type === 'radio' ? ellipse(0,b) : `M 0 0 L ${b} 0 L ${b} ${b} L 0 ${b} Z`,
      outlinePath: widget.type === 'radio' ? ellipse(half,b-2*half) : `M ${half} ${half} L ${b-half} ${half} L ${b-half} ${b-half} L ${half} ${b-half} Z`,
      dotPath,
      checkPoints: `${3*u},${b/2} ${b/2-u},${b-4*u} ${b-3*u},${3*u}`,
      checkWidth: u * 3, dotRadius: b / 4 };
  };
  const paint = (svg: SVGSVGElement, source: Widget, current: Widget, rect: SelectionDisplayRect, snapshot?: SelectionIndicatorPaint) => {
    const g = geometry(source, snapshot); if (!g) throw Error('Unsupported selection indicator paint');
    const document = svg.ownerDocument, ns = 'http://www.w3.org/2000/svg';
    const color = current.style.stroke;
    // aNP5/UJ0a expand the declaration's logical square. The inline rewrite
    // drops source dimensions and does not invent a viewBox. Path coordinates
    // are independent: the drawing and wrapper translations cancel.
    const { size, offset } = viewport(source)!;
    for (const name of ['viewBox', 'width', 'height']) svg.removeAttribute(name);
    Object.assign(svg.style, { position: 'absolute', left: `${rect.x - offset}px`, top: `${rect.y - offset}px`,
      width: `${size}px`, height: `${size}px`, overflow: 'hidden', pointerEvents: 'none',
      // Only the runtime advances adaptive matrices. Repeated React/font paints
      // project this snapshot, and a fresh/authoring asset clears old transforms.
      transform: snapshot?.svgScaleX === undefined ? '' : `scale(${snapshot.svgScaleX}, ${snapshot.svgScaleY})`,
      transformOrigin: snapshot?.svgTransformOrigin ?? '' });
    const set = (node: Element, attrs: Record<string, string | number>) => {
      for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
    };
    // Stable children preserve DOM identity across pointer/focus/state updates.
    const obtain = (name: string, tag: 'rect' | 'path' | 'circle' | 'polyline') => {
      let node = svg.querySelector<SVGElement>(`[data-selection-${name}]`);
      if (!node || node.tagName !== tag) {
        node?.remove(); node = document.createElementNS(ns, tag); node.setAttribute(`data-selection-${name}`, ''); svg.append(node);
      }
      return node;
    };
    const fill = obtain('fill', 'path');
    set(fill, { d: g.fillPath });
    set(fill, { fill: snapshot?.fill ?? current.style.fill, stroke: 'none' });
    const outline = obtain('outline', 'path');
    set(outline, { d: g.outlinePath });
    set(outline, { fill: 'none', stroke: snapshot?.stroke ?? color, 'stroke-width': snapshot?.outlineWidth ?? current.style.strokeWidth,
      'stroke-linecap': 'butt', 'stroke-linejoin': 'miter' });
    const mark = obtain('mark', source.type === 'radio' ? 'path' : 'polyline');
    // Initial Radio.SIll is fill-only; a runtime cascade can later add stroke.
    if (source.type === 'radio') {
      set(mark, { d: g.dotPath, fill: snapshot?.markFill ?? color, stroke: snapshot?.markStroke ?? 'none' });
      if (snapshot?.markWidth !== undefined) set(mark, { 'stroke-width': snapshot.markWidth });
      else mark.removeAttribute('stroke-width');
    }
    else set(mark, { points: g.checkPoints, fill: snapshot?.markFill ?? 'none', stroke: snapshot?.markStroke ?? color, 'stroke-width': snapshot?.markWidth ?? g.checkWidth,
      'stroke-linecap': 'butt', 'stroke-linejoin': 'miter' });
    mark.style.display = current.selected ?? current.checked ? 'inline' : 'none';
  };
  return { supports, geometry, paint };
}
