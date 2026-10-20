import type { Component, Document, Widget } from './types';
import { cloneWidgets, collectWidgetIdentifiers, createWidget, findWidget, mapWidgets, parseDocument, remapWidgetIds, uid } from './document';
import { commitAdaptivePage, resolveAdaptivePage } from './adaptive-view-sets';
import { translateWidget } from './widget-structure';
import { fitLayerBounds } from './layer-geometry';

function assertPlainDefinition(widgets: Widget[]): void {
  mapWidgets(widgets, widget => {
    if (widget.componentInstance) throw new Error('Detach a linked component before nesting it inside a component definition');
    return widget;
  });
}

function clearLegacyLinks(widgets: Widget[]): Widget[] {
  return mapWidgets(widgets, widget => {
    const copy = { ...widget }; delete copy.componentId; delete copy.componentInstance; return copy;
  });
}

function assertDimensions(width: number, height: number): void {
  if (![width, height].every(n => Number.isFinite(n) && n >= 1 && n <= 100_000)) throw new Error('Component dimensions must be between 1 and 100000');
}

/** Create a reusable definition; the original canvas selection retains its own IDs. */
export function createComponent(widgets: Widget[], name = 'Component 1'): Component {
  if (!widgets.length) throw new Error('Select at least one widget to create a component');
  if (!name.trim() || name.length > 500) throw new Error('A component requires a name of at most 500 characters');
  assertPlainDefinition(widgets);
  const x = Math.min(...widgets.map(widget => widget.x)), y = Math.min(...widgets.map(widget => widget.y));
  const width = Math.max(...widgets.map(widget => widget.x + widget.width)) - x;
  const height = Math.max(...widgets.map(widget => widget.y + widget.height)) - y;
  assertDimensions(width, height);
  return { id: uid(), name, width, height, widgets: clearLegacyLinks(cloneWidgets(widgets, 0)).map(widget => translateWidget(widget, -x, -y)) };
}

function materialize(component: Component, previous: Record<string, string> = {}): { widgets: Widget[]; sourceIds: Record<string, string> } {
  assertPlainDefinition(component.widgets);
  const ids = new Map([...collectWidgetIdentifiers(component.widgets).keys()].map(source => [source, Object.hasOwn(previous, source) ? previous[source] : uid()]));
  return { widgets: remapWidgetIds(component.widgets, ids), sourceIds: Object.fromEntries(ids) };
}

/** Runtime and HTML export already understand panels, so a component needs no separate renderer. */
export function createComponentInstance(component: Component, x = 80, y = 80): Widget {
  assertDimensions(component.width, component.height);
  if (![x, y].every(n => Number.isFinite(n) && Math.abs(n) <= 100_000)) throw new Error('Invalid component instance position');
  const instance = createWidget('panel', x, y), contents = materialize(component);
  instance.name = component.name; instance.width = component.width; instance.height = component.height;
  instance.componentId = component.id; instance.componentInstance = { sourceIds: contents.sourceIds };
  instance.states![0].name = 'Component'; instance.states![0].widgets = contents.widgets;
  return instance;
}

function synchronizeInstance(instance: Widget, component: Component): Widget {
  if (instance.type !== 'panel' || instance.states?.length !== 1) throw new Error('A component instance must remain a single-state panel');
  const contents = materialize(component, instance.componentInstance!.sourceIds);
  return {
    ...instance, width: component.width, height: component.height,
    componentInstance: { sourceIds: contents.sourceIds },
    states: [{ ...instance.states[0], widgets: contents.widgets }],
  };
}

/** Preserve unaffected objects, including whole pages, for editor undo and memoized views. */
function transformInstances(widgets: Widget[], change: (instance: Widget) => Widget): Widget[] {
  let changed = false;
  const next = widgets.map(widget => {
    let result = widget;
    if (widget.componentInstance) result = change(widget);
    else {
      if (widget.layer) {
        const widgets = transformInstances(widget.layer.widgets, change);
        if (widgets !== widget.layer.widgets) result = { ...result, layer: { ...widget.layer, widgets } };
      }
      if (widget.states) {
        const states = widget.states.map(state => {
          const children = transformInstances(state.widgets, change);
          return children === state.widgets ? state : { ...state, widgets: children };
        });
        if (states.some((state, index) => state !== widget.states![index])) result = { ...result, states };
      }
      if (widget.repeater) {
        const template = transformInstances(widget.repeater.template, change);
        if (template !== widget.repeater.template) result = { ...result, repeater: { ...widget.repeater, template } };
      }
      if (widget.table) {
        const cells = transformInstances(widget.table.cells, change);
        if (cells !== widget.table.cells) result = { ...result, table: { ...widget.table, cells } };
      }
      if (widget.menu) {
        const children = transformInstances([widget.menu.table, ...widget.menu.submenus], change);
        if (children.some((child, index) => child !== [widget.menu!.table, ...widget.menu!.submenus][index])) result = { ...result, menu: { ...widget.menu, table: children[0], submenus: children.slice(1) } };
      }
      if (widget.tree) {
        const nodes = transformInstances(widget.tree.nodes, change);
        if (nodes !== widget.tree.nodes) result = { ...result, tree: { ...widget.tree, nodes } };
      }
      if (widget.treeNode) {
        const contents = [widget.treeNode.label, ...widget.treeNode.children], next = transformInstances(contents, change);
        if (next !== contents) result = { ...result, treeNode: { ...widget.treeNode, label: next[0], children: next.slice(1) } };
      }
    }
    result = fitLayerBounds(result);
    changed ||= result !== widget;
    return result;
  });
  return changed ? next : widgets;
}

/** Rebuild linked contents; the instance panel's local position/rotation/style are retained. */
export function syncComponentInstances(doc: Document, componentId?: string): Document {
  const components = new Map(doc.components.map(component => [component.id, component]));
  if (componentId && !components.has(componentId)) throw new Error('Component definition does not exist');
  let changed = false;
  const pages = doc.pages.map(page => {
    const widgets = transformInstances(page.widgets, instance => {
      if (componentId && instance.componentId !== componentId) return instance;
      const component = components.get(instance.componentId!);
      if (!component) throw new Error('Component instance references a missing definition');
      return synchronizeInstance(instance, component);
    });
    if (widgets === page.widgets) return page;
    changed = true; return { ...page, widgets };
  });
  let result = changed ? { ...doc, pages } : doc;
  // Removing definition children also removes their local declarations in every
  // instance page, including inactive view maps retained after set assignment.
  if (changed) for (const page of pages) {
    if (page.widgets !== doc.pages.find(previous => previous.id === page.id)!.widgets) result = commitAdaptivePage(result, resolveAdaptivePage(result, page));
  }
  // Validate before returning a transaction, while preserving the object identities above.
  parseDocument(JSON.stringify(result));
  return result;
}

export function updateComponent(doc: Document, component: Component): Document {
  if (!doc.components.some(item => item.id === component.id)) throw new Error('Cannot update a missing component definition');
  assertPlainDefinition(component.widgets);
  assertDimensions(component.width, component.height);
  return syncComponentInstances({ ...doc, components: doc.components.map(item => item.id === component.id ? structuredClone(component) : item) }, component.id);
}

/** Publish the selected instance's content to its definition and every linked instance. */
export function applyComponentInstanceChanges(doc: Document, instanceId: string): Document {
  let instance: Widget | undefined;
  for (const page of doc.pages) { instance = findWidget(page, instanceId); if (instance) break; }
  if (!instance?.componentInstance || instance.type !== 'panel' || instance.states?.length !== 1) throw new Error('Select a linked component instance to update its definition');
  const component = doc.components.find(item => item.id === instance!.componentId);
  if (!component) throw new Error('Component definition does not exist');
  const children = instance.states[0].widgets;
  assertPlainDefinition(children); assertDimensions(instance.width, instance.height);
  const inverse = new Map(Object.entries(instance.componentInstance.sourceIds).map(([source, local]) => [local, source]));
  const localToSource = new Map([...collectWidgetIdentifiers(children).keys()].map(local => [local, inverse.get(local) ?? uid()]));
  const definition: Component = {
    ...component, width: instance.width, height: instance.height,
    widgets: clearLegacyLinks(remapWidgetIds(children, localToSource)),
  };
  // New controls keep the same local IDs in the publishing instance; siblings receive fresh local IDs.
  const sourceIds = Object.fromEntries([...localToSource].map(([local, source]) => [source, local]));
  const pages = doc.pages.map(page => {
    const widgets = transformInstances(page.widgets, current => current.id === instanceId ? { ...current, componentInstance: { sourceIds } } : current);
    return widgets === page.widgets ? page : { ...page, widgets };
  });
  return updateComponent({ ...doc, pages }, definition);
}

/** Detaching keeps the panel and all contents/IDs; future definition updates stop affecting it. */
export function detachComponentInstance(instance: Widget): Widget {
  const result = structuredClone(instance);
  delete result.componentId; delete result.componentInstance;
  return result;
}
