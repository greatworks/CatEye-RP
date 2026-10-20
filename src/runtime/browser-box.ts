export type BorderWidths = [number, number, number, number];
export type BoxPosition = { x: number; y: number };
export type BoxMetrics = { width: number; height: number; borders: BorderWidths; position?: BoxPosition };

/** Self-contained so the offline HTML can serialize this factory verbatim. */
export function createBrowserBoxReader(): (width: number, height: number, borders: BorderWidths, position?: BoxPosition) => BoxMetrics {
  const cache = new Map<string, BoxMetrics>();
  const copy = (value: BoxMetrics): BoxMetrics => ({ width: value.width, height: value.height, borders: [...value.borders], ...(value.position ? { position: { ...value.position } } : {}) });
  return (width, height, borders, position) => {
    const fallback = (): BoxMetrics => ({ width: Math.max(borders[1] + borders[3], Math.max(0, width)), height: Math.max(borders[0] + borders[2], Math.max(0, height)), borders: [...borders], ...(position ? { position: { ...position } } : {}) });
    if (typeof document === 'undefined' || !document.body || typeof getComputedStyle !== 'function') return fallback();
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const key = JSON.stringify([dpr, width, height, ...borders, ...(position ? [position.x, position.y] : [])]);
    const cached = cache.get(key); if (cached) return copy(cached);
    const element = document.createElement('div');
    Object.assign(element.style, {
      all: 'initial', position: 'fixed', visibility: 'hidden', pointerEvents: 'none', left: `${position?.x ?? -100000}px`, top: `${position?.y ?? -100000}px`,
      borderStyle: 'solid', borderWidth: borders.map(value => `${value}px`).join(' '), boxSizing: 'border-box', padding: '0px',
      width: `${Math.max(0, width)}px`, height: `${Math.max(0, height)}px`,
    });
    document.body.appendChild(element);
    let result: BoxMetrics;
    try {
      const style = getComputedStyle(element);
      result = { width: Number.parseFloat(style.width), height: Number.parseFloat(style.height), borders: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(value => Number.parseFloat(value)) as BorderWidths };
      if (position) result.position = { x: Number.parseFloat(style.left), y: Number.parseFloat(style.top) };
    } finally { element.remove(); }
    // Non-layout environments can expose the DOM API without computing pixel values.
    if (![result.width, result.height, ...result.borders, ...(result.position ? [result.position.x, result.position.y] : [])].every(Number.isFinite)) return fallback();
    if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
    cache.set(key, result); return copy(result);
  };
}

export const browserBoxReader = createBrowserBoxReader();
