import type { WidgetStyle } from './types';

/** Original implementation. Kept closed over no module values so offline
 * players can serialize this factory without executable document markup. */
export function createShadowRenderer() {
  const cssShadow = (shadow: WidgetStyle['textShadow']) => shadow?.on
    ? `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blurRadius}px ${shadow.color}` : 'none';
  const css = (style: Pick<WidgetStyle, 'outerShadow' | 'innerShadow' | 'textShadow'>, mode: 'box' | 'vector' | 'image' | 'panel' | 'line' | 'none' = 'box') => {
    const outer = style.outerShadow, inner = style.innerShadow;
    const boxes: string[] = [];
    if ((mode === 'box' || mode === 'image' || mode === 'panel') && outer?.on) boxes.push(`${outer.offsetX}px ${outer.offsetY}px ${outer.blurRadius}px 0px ${outer.color}`);
    if (mode === 'box' && inner?.on) boxes.push(`inset ${inner.offsetX}px ${inner.offsetY}px ${inner.blurRadius}px ${inner.spread}px ${inner.color}`);
    return { boxShadow: boxes.join(', ') || 'none', textShadow: mode === 'none' || mode === 'image' || mode === 'panel' || mode === 'line' ? 'none' : cssShadow(style.textShadow),
      filter: (mode === 'vector' || mode === 'line') && outer?.on ? `drop-shadow(${cssShadow(outer)})` : 'none' };
  };
  const mode = (type: string, vector = false): 'box' | 'vector' | 'image' | 'panel' | 'line' | 'none' =>
    type === 'inlineFrame' || type === 'hotspot' ? 'none' : vector ? 'vector' : type === 'panel' ? 'panel' : type === 'image' ? 'image' : type === 'line' ? 'line' : 'box';
  const filterId = (instance: string) => `rea-shadow-${Array.from(instance, char => char.codePointAt(0)!.toString(16)).join('-')}`;
  const inner = (style: Pick<WidgetStyle, 'innerShadow' | 'strokeWidth'>): { tag: string; attrs: Record<string, string> }[] => {
    const shadow = style.innerShadow; if (!shadow?.on) return [];
    return [
      { tag: 'feOffset', attrs: { dx: String(shadow.offsetX), dy: String(shadow.offsetY), in: 'SourceGraphic', result: 'offset' } },
      { tag: 'feMorphology', attrs: { radius: String(style.strokeWidth + shadow.spread), operator: 'erode', in: 'offset', result: 'morphology' } },
      { tag: 'feGaussianBlur', attrs: { stdDeviation: String(shadow.blurRadius / 2), in: 'morphology', result: 'blur' } },
      { tag: 'feComposite', attrs: { in2: 'blur', operator: 'out', in: 'SourceGraphic', result: 'inverse' } },
      { tag: 'feFlood', attrs: { 'flood-color': shadow.color, in: 'inverse', result: 'color' } },
      { tag: 'feComposite', attrs: { in2: 'inverse', operator: 'in', in: 'color', result: 'shadow' } },
      { tag: 'feComposite', attrs: { in2: 'SourceGraphic', operator: 'over', in: 'shadow' } },
    ];
  };
  return { css, mode, filterId, inner };
}
export type ShadowRenderer = ReturnType<typeof createShadowRenderer>;
