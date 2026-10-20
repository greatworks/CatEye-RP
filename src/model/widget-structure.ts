import type { Widget } from './types';

export interface WidgetChildCollection {
  kind: 'layer' | 'panelState' | 'repeater' | 'table' | 'menu' | 'tree' | 'treeNode';
  widgets: Widget[];
  stateId?: string;
}

/** Structural ownership only. In particular, a Layer edge does not add its
 * owner's location to a child's coordinates. Repeater row scopes are separate
 * from both this structure and the renderer's DOM parent. */
export function widgetChildCollections(widget: Widget): WidgetChildCollection[] {
  return [
    ...(widget.layer ? [{ kind: 'layer' as const, widgets: widget.layer.widgets }] : []),
    ...(widget.states ?? []).map(state => ({ kind: 'panelState' as const, stateId: state.id, widgets: state.widgets })),
    ...(widget.repeater ? [{ kind: 'repeater' as const, widgets: widget.repeater.template }] : []),
    ...(widget.table ? [{ kind: 'table' as const, widgets: widget.table.cells }] : []),
    ...(widget.menu ? [{ kind: 'menu' as const, widgets: [widget.menu.table, ...widget.menu.submenus] }] : []),
    ...(widget.tree ? [{ kind: 'tree' as const, widgets: widget.tree.nodes }] : []),
    ...(widget.treeNode ? [{ kind: 'treeNode' as const, widgets: [widget.treeNode.label, ...widget.treeNode.children] }] : []),
  ];
}

/** Map each direct collection without changing its field or ownership kind. */
export function mapWidgetChildren(widget: Widget, map: (widgets: Widget[]) => Widget[]): Widget {
  const result = { ...widget };
  if (widget.layer) result.layer = { ...widget.layer, widgets: map(widget.layer.widgets) };
  if (widget.states) result.states = widget.states.map(state => ({ ...state, widgets: map(state.widgets) }));
  if (widget.repeater) result.repeater = { ...widget.repeater, template: map(widget.repeater.template) };
  if (widget.table) result.table = { ...widget.table, cells: map(widget.table.cells) };
  if (widget.menu) result.menu = { ...widget.menu, table: map([widget.menu.table])[0], submenus: map(widget.menu.submenus) };
  if (widget.tree) result.tree = { ...widget.tree, nodes: map(widget.tree.nodes) };
  if (widget.treeNode) result.treeNode = { ...widget.treeNode, label: map([widget.treeNode.label])[0], children: map(widget.treeNode.children) };
  return result;
}

/** Move a coordinate-scope member. A Layer shares that scope with its direct
 * children; other containers carry their local contents without rewriting them. */
export function translateWidget(widget: Widget, dx: number, dy: number): Widget {
  if (dx === 0 && dy === 0) return widget;
  return { ...widget, x: widget.x + dx, y: widget.y + dy,
    ...(widget.layer ? { layer: { ...widget.layer, widgets: widget.layer.widgets.map(child => translateWidget(child, dx, dy)) } } : {}) };
}

export function widgetOwnershipPath(widgets: Widget[], id: string): Widget[] | undefined {
  for (const widget of widgets) {
    if (widget.id === id) return [widget];
    for (const children of widgetChildCollections(widget)) {
      const found = widgetOwnershipPath(children.widgets, id);
      if (found) return [widget, ...found];
    }
  }
  return undefined;
}
