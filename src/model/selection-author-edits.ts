import type { AdaptiveWidgetOverride, Page, Widget } from './types';
import type { SelectionLayoutEffect, SelectionLayoutResult } from './selection-layout';
import { fitLayerTree } from './layer-geometry';
import { widgetChildCollections } from './widget-structure';

type PersistentEffect =
  | { name: 'fit.flag'; axis: 'width' | 'height'; value: boolean }
  | { name: 'alignRight.flag'; value: boolean }
  | { name: 'style.Size'; width: number; height: number; allViews: boolean }
  | { name: 'style.Location'; x: number; y: number; allViews: boolean };

function number(value: unknown, field: string, min: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > 100_000)
    throw new Error(`${field} must be between ${min} and 100000`);
  return value;
}
function boolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} must be Boolean`);
  return value;
}
function persistentEffect(effect: SelectionLayoutEffect): PersistentEffect | undefined {
  switch (effect.name) {
    case 'fit.flag':
      if (effect.axis !== 'width' && effect.axis !== 'height') throw new Error('fit.flag axis must be width or height');
      return { name: effect.name, axis: effect.axis, value: boolean(effect.value, 'fit.flag value') };
    case 'alignRight.flag':
      return { name: effect.name, value: boolean(effect.value, 'alignRight.flag value') };
    case 'style.Size':
      return { name: effect.name, width: number(effect.width, 'Size.width', 1), height: number(effect.height, 'Size.height', 1),
        allViews: boolean(effect.allViews, 'Size.allViews') };
    case 'style.Location':
      return { name: effect.name, x: number(effect.x, 'Location.x', -100_000), y: number(effect.y, 'Location.y', -100_000),
        allViews: boolean(effect.allViews, 'Location.allViews') };
    // Requests, measurements, panel/cache/guard changes and notifications are
    // diagnostic effects, not persistent widget fields or application events.
    default: return undefined;
  }
}
function visit(widgets: Widget[], callback: (widget: Widget) => void): void {
  for (const widget of widgets) {
    callback(widget);
    for (const children of widgetChildCollections(widget)) visit(children.widgets, callback);
  }
}
function target(page: Page, id: string): Widget {
  const matches: Widget[] = [];
  visit(page.widgets, widget => { if (widget.id === id) matches.push(widget); });
  if (matches.length !== 1) throw new Error('Selection widget must exist exactly once on the page');
  const widget = matches[0];
  if (widget.type !== 'checkbox' && widget.type !== 'radio') throw new Error('Selection author effects require a checkbox or radio');
  if (!widget.selectionText) throw new Error('Selection author effects require an explicit selectionText declaration');
  return widget;
}

/**
 * Replay a successful author-layout transaction onto an effective Page from
 * resolveAdaptivePage. The caller binds measurement to its immutable command
 * baseline, commits the returned page with commitAdaptivePage, and owns undo.
 *
 * Do not diff result.state.ownerRect. An external Size may write all views
 * before its internal layout writes current-only Size/Location. Their order
 * and complete property pairs are observable in later adaptive inheritance.
 * Fit and AlignRight flags are shared content; all other layout state is
 * transient. No native notification, measurement or ancestor-fit service runs
 * here. Only the product's derived Layer frame cache is refreshed.
 */
export function applySelectionAuthorEffects(
  page: Page, viewId: string | null | undefined, widgetId: string, result: SelectionLayoutResult,
): Page {
  if (!result.ok) throw new Error(`Selection layout failed: ${result.reason}`);
  if (page.adaptiveViewSetId && page.adaptiveSelection !== 'native-size')
    throw new Error('Resolve the shared adaptive page before applying selection author effects');
  if (viewId && !page.adaptiveViews.some(view => view.id === viewId)) throw new Error('Adaptive view does not exist');
  target(page, widgetId);
  // Validate every persistent write, including later ones, before preparing a
  // candidate. A native partial-write trace on failure is never committable.
  const effects = result.effects.map(persistentEffect).filter((effect): effect is PersistentEffect => effect !== undefined);
  if (!effects.length) return page;
  const next = structuredClone(page), widget = target(next, widgetId);
  const view = viewId ? next.adaptiveViews.find(view => view.id === viewId)! : undefined;
  let changed = false, baseGeometryChanged = false;
  function assignGeometry(patch: AdaptiveWidgetOverride | Widget, values: Partial<Pick<Widget, 'x' | 'y' | 'width' | 'height'>>) {
    let assigned = false;
    for (const key of Object.keys(values) as (keyof typeof values)[]) {
      if (!Object.hasOwn(patch, key) || patch[key] !== values[key]) {
        patch[key] = values[key]!;
        assigned = true;
      }
    }
    changed ||= assigned;
    return assigned;
  }
  for (const effect of effects) {
    if (effect.name === 'fit.flag' || effect.name === 'alignRight.flag') {
      const field = effect.name === 'alignRight.flag' ? 'alignRight'
        : effect.axis === 'width' ? 'autoFitWidth' : 'autoFitHeight';
      if (widget.selectionText![field] !== effect.value) {
        widget.selectionText![field] = effect.value;
        changed = true;
      }
      continue;
    }
    const pair = effect.name === 'style.Size'
      ? { width: effect.width, height: effect.height }
      : { x: effect.x, y: effect.y };
    if (effect.allViews || !view) baseGeometryChanged = assignGeometry(widget, pair) || baseGeometryChanged;
    else {
      const patch = view.overrides[widgetId] ?? (view.overrides[widgetId] = {});
      assignGeometry(patch, pair);
    }
    if (effect.allViews) {
      // Include inactive set maps, not just currently projected definitions.
      // Preserve unrelated declarations and existing empty entries.
      for (const map of [...next.adaptiveViews.map(item => item.overrides), ...Object.values(next.adaptiveOverrides ?? {})]) {
        const patch = map[widgetId];
        if (!patch) continue;
        for (const key of Object.keys(pair) as (keyof typeof pair)[]) {
          if (Object.hasOwn(patch, key)) { delete patch[key]; changed = true; }
        }
      }
    }
  }
  if (!changed) return page;
  if (baseGeometryChanged) {
    next.widgets = fitLayerTree(next.widgets);
    visit(next.widgets, owner => {
      if (!owner.layer) return;
      number(owner.x, 'Layer.x', -100_000); number(owner.y, 'Layer.y', -100_000);
      number(owner.width, 'Layer.width', 0); number(owner.height, 'Layer.height', 0);
    });
  }
  return next;
}
