import type { Widget } from './types';
import { mapWidgetChildren, translateWidget } from './widget-structure';
import { getAuthorResizeBounds } from './author-resize-solver';

export interface LayerBounds { x: number; y: number; width: number; height: number }

/** Native authoring bounds, not runtime childrenBoundingRect. Layer.KIs9 walks
 * through nested Layers; ordinary members supply their rotated owner rectangle.
 * Hidden/unplaced members count; shadows and borders do not. X5pe unions from
 * the first member, so an entirely negative group does not expand to the origin.
 * Bounds share the source sizing primitive, including its angle shortcuts.
 * See research/native-layers-format-{rect-union,enclosing-lambda,leaf-iterator}-cil.json
 * and research/layer-resize-numeric-evidence.md. */
export function layerAuthoringBounds(widgets: Widget[]): LayerBounds {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  const visit = (items: Widget[]) => {
    for (const widget of items) {
      if (widget.type === 'layer' && widget.layer) { visit(widget.layer.widgets); continue; }
      const {x,y,width,height} = getAuthorResizeBounds(widget, widget.rotation);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + width); bottom = Math.max(bottom, y + height);
    }
  };
  visit(widgets);
  return left === Infinity ? { x: 0, y: 0, width: 0, height: 0 } : { x: left, y: top, width: right - left, height: bottom - top };
}

export function fitLayerBounds(widget: Widget): Widget {
  if (widget.type !== 'layer' || !widget.layer) return widget;
  const bounds = layerAuthoringBounds(widget.layer.widgets);
  return (Object.keys(bounds) as (keyof LayerBounds)[]).every(key => Math.abs(widget[key] - bounds[key]) < 1e-9)
    ? widget : { ...widget, ...bounds };
}

/** Update caches after a member edit or adaptive projection without treating a
 * group's cached frame as a transform. Preserve references when nothing changed. */
export function fitLayerTree(widgets: Widget[]): Widget[] {
  let changed = false;
  const result = widgets.map(widget => {
    let childrenChanged = false;
    const copy = mapWidgetChildren(widget, children => {
      const next = fitLayerTree(children);
      childrenChanged ||= next !== children;
      return next;
    });
    const next = fitLayerBounds(childrenChanged ? copy : widget);
    changed ||= next !== widget;
    return next;
  });
  return changed ? result : widgets;
}

/** Authoring placement of the whole group. Never rebase panel/repeater contents. */
export function moveLayer(widget: Widget, x: number, y: number): Widget {
  const current = fitLayerBounds(widget);
  return translateWidget(current, x - current.x, y - current.y);
}
