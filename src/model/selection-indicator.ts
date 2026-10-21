import type { Widget } from './types';
import type { SelectionDisplayRect } from '../runtime/selection-text-layout';

/** Bounded ordinary SelectionButton geometry, independently rendered as SVG.
 * TIdc/C5vD BoxModel0: full fill, half-stroke-inset outline. The b×b overflow-
 * visible SVG viewport is a product choice, not the native asset's crop box.
 * Complex paint/corners/shadows and transformed controls retain legacy display.
 */
export function createSelectionIndicatorRenderer() {
  const opaque = (value: string) => /^(?:#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{6}ff|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|black|white)$/i.test(value);
  const supports = (widget: Widget) => {
    const s = widget.style, b = s.selectionButtonSize;
    return (widget.type === 'checkbox' || widget.type === 'radio') && widget.rotation === 0 && typeof b === 'number'
      && Number.isFinite(b) && b > s.strokeWidth && s.strokeWidth >= 0 && s.radius === 0
      && (!s.linePattern || s.linePattern === 'solid') && !s.fillGradient && !s.strokeGradient
      && !s.outerShadow?.on && !s.innerShadow?.on && opaque(s.fill) && opaque(s.stroke)
      && (!s.borderVisibility || s.borderVisibility.every(Boolean))
      && (!s.borderWidths || s.borderWidths.every(value => value === s.strokeWidth))
      && (!s.cornerRadii || s.cornerRadii.every(value => value === 0));
  };
  const geometry = (widget: Widget) => {
    if (!supports(widget)) return;
    const b = widget.style.selectionButtonSize!, half = widget.style.strokeWidth / 2, u = b / 14;
    const ellipse = (inset: number, size: number) => {
      const p = (x: number, y: number) => `${inset+x*size} ${inset+y*size}`, low = 1-.78;
      return `M ${p(.5,0)} C ${p(.78,0)} ${p(1,low)} ${p(1,.5)} C ${p(1,.78)} ${p(.78,1)} ${p(.5,1)} C ${p(low,1)} ${p(0,.78)} ${p(0,.5)} C ${p(0,low)} ${p(low,0)} ${p(.5,0)} Z`;
    };
    return { size: b, inset: half, outlineSize: b - 2 * half,
      fillPath: widget.type === 'radio' ? ellipse(0,b) : `M 0 0 L ${b} 0 L ${b} ${b} L 0 ${b} Z`,
      outlinePath: widget.type === 'radio' ? ellipse(half,b-2*half) : `M ${half} ${half} L ${b-half} ${half} L ${b-half} ${b-half} L ${half} ${b-half} Z`,
      dotPath: ellipse(b/4,b/2),
      checkPoints: `${3*u},${b/2} ${b/2-u},${b-4*u} ${b-3*u},${3*u}`,
      checkWidth: 3 * b / 14, dotRadius: b / 4 };
  };
  const paint = (svg: SVGSVGElement, source: Widget, current: Widget, rect: SelectionDisplayRect) => {
    const g = geometry(source); if (!g) throw Error('Unsupported selection indicator paint');
    const document = svg.ownerDocument, ns = 'http://www.w3.org/2000/svg';
    const b = g.size, color = current.style.stroke;
    svg.setAttribute('viewBox', `0 0 ${b} ${b}`); svg.setAttribute('width', String(b)); svg.setAttribute('height', String(b));
    Object.assign(svg.style, { position: 'absolute', left: `${rect.x}px`, top: `${rect.y}px`,
      width: `${b}px`, height: `${b}px`, overflow: 'visible', pointerEvents: 'none' });
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
    set(fill, { fill: current.style.fill, stroke: 'none' });
    const outline = obtain('outline', 'path');
    set(outline, { d: g.outlinePath });
    set(outline, { fill: 'none', stroke: color, 'stroke-width': current.style.strokeWidth,
      'stroke-linecap': 'butt', 'stroke-linejoin': 'miter' });
    const mark = obtain('mark', source.type === 'radio' ? 'path' : 'polyline');
    // Initial Radio.SIll calls only the fill sink. Runtime _applySvg's later
    // generic stroke override is a separate, not yet fully integrated branch.
    if (source.type === 'radio') set(mark, { d: g.dotPath, fill: color, stroke: 'none' });
    else set(mark, { points: g.checkPoints, fill: 'none', stroke: color, 'stroke-width': g.checkWidth,
      'stroke-linecap': 'butt', 'stroke-linejoin': 'miter' });
    mark.style.display = current.selected ?? current.checked ? 'inline' : 'none';
  };
  return { supports, geometry, paint };
}
