import type { AdaptiveView, Page } from './types';

/** Independent implementation of the retained size-selection behavior. Keep in
 * sync with createOfflineRuntime's self-contained selector (portable HTML cannot
 * close over this module). Source cases cross-test both implementations. */
export function chooseAdaptiveView(page: Page, width: number, height = 0): AdaptiveView | undefined {
  if (typeof width !== 'number' || !Number.isFinite(width) || width < 0) throw new Error('Adaptive viewport width must be a finite nonnegative number');
  if (typeof height !== 'number' || !Number.isFinite(height) || height < 0) throw new Error('Adaptive viewport height must be a finite nonnegative number');
  if (page.adaptiveSelection !== 'native-size') {
    return page.adaptiveViews.reduce<AdaptiveView | undefined>((best, view) => view.width >= width && (!best || view.width < best.width) ? view : best, undefined);
  }
  type Candidate = { width: number; height: number; view?: AdaptiveView };
  const base: Candidate = { width: page.adaptiveBaseSize?.width ?? 0, height: page.adaptiveBaseSize?.height ?? 0 };
  let lower: Candidate | undefined = base.width <= width ? base : undefined, upper = base;
  for (const view of page.adaptiveViews) {
    const next: Candidate = { width: view.width, height: view.height ?? 0, view };
    if (next.width <= width && (!lower || next.width > lower.width || next.width === lower.width &&
      (lower.height <= height ? next.height > lower.height && next.height <= height : next.height < lower.height))) lower = next;
    // The original upper fallback treats zero as a finite sentinel. In the
    // lower/fit branch zero remains a real dimension, including Base 0 x 0.
    const nextWidth = next.width || 1000000, upperWidth = upper.width || 1000000;
    if (width <= nextWidth && (nextWidth < upperWidth || nextWidth === upperWidth && (next.height || 1000000) < (upper.height || 1000000))) upper = next;
  }
  return (lower ?? upper).view;
}

/** Base's direct child through the requested leaf; Base itself is not a view.
 * Invalid references/cycles fail rather than silently dropping declarations. */
export function adaptiveViewChain(page: Page, viewId?: string | null): AdaptiveView[] {
  if (!viewId) return [];
  const byId = new Map(page.adaptiveViews.map(view => [view.id, view])), seen = new Set<string>(), result: AdaptiveView[] = [];
  let id: string | undefined = viewId;
  while (id) {
    if (seen.has(id)) throw new Error(`Adaptive view inheritance cycle: ${id}`);
    const view = byId.get(id);
    if (!view) throw new Error(`Adaptive view does not exist: ${id}`);
    seen.add(id); result.push(view); id = view.baseViewId;
  }
  return result.reverse();
}
