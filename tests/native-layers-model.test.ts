import { describe, expect, it } from 'vitest';
import { cloneWidgets, collectWidgetIdentifiers, createDocument, createLayer, createWidget, deleteWidgetTree, findWidget, groupIntoLayer, parseDocument, serializeDocument, uid, ungroupLayers, updateWidgetTree } from '../src/model/document';
import { applyAdaptiveWidgetEdits, createAdaptiveView, deleteAdaptiveWidgets, isAdaptiveWidgetPlaced, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { createComponent, createComponentInstance, applyComponentInstanceChanges, updateComponent } from '../src/model/components';
import { layerAuthoringBounds, fitLayerTree } from '../src/model/layer-geometry';
import { translateWidget } from '../src/model/widget-structure';
import type { Document, Widget } from '../src/model/types';

function project(...widgets: Widget[]): Document {
  const document = createDocument(); document.pages[0].widgets = widgets; return document;
}
function leaf(id: string, x: number, y: number, width = 20, height = 10): Widget {
  return { ...createWidget('box', x, y), id, width, height };
}

describe('native Layer structural model', () => {
  it('keeps ordered, nested identities, events, propagation and independent group degree on round trip', () => {
    const a = leaf('a', 100, 80), b = leaf('b', 140, 100), inner = createLayer([a, b], 'Inner');
    inner.rotation = 35; inner.layer!.propagate = true;
    const outer = createLayer([inner, leaf('c', 70, 160)], 'Outer');
    outer.interactions = [{ id: uid(), name: 'Move child', enabled: true, event: 'click', conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'move', targetId: b.id, x: 10, y: 20 }] }];
    const document = project(outer);
    expect(parseDocument(serializeDocument(document))).toEqual(document);
    expect(findWidget(document.pages[0], 'b')).toBe(outer.layer!.widgets[0].layer!.widgets[1]);
    expect([...collectWidgetIdentifiers([outer]).values()].filter(kind => kind === 'widget')).toHaveLength(5);
  });

  it('rejects duplicate ownership, foreign contents, wrong roles and unbounded nesting', () => {
    const group = createLayer([leaf('a', 10, 20)]), good = project(group);
    const parse = (mutate: (doc: any) => void) => { const doc = structuredClone(good); mutate(doc); return () => parseDocument(JSON.stringify(doc)); };
    expect(parse(doc => doc.pages[0].widgets.push(doc.pages[0].widgets[0].layer.widgets[0]))).toThrow('duplicate identifier');
    expect(parse(doc => doc.pages[0].widgets[0].layer.unknown = 1)).toThrow('unknown field');
    expect(parse(doc => doc.pages[0].widgets[0].layer.propagate = 1)).toThrow('boolean');
    expect(parse(doc => doc.pages[0].widgets[0].states = [])).toThrow('layer contents');
    expect(parse(doc => doc.pages[0].widgets[0].layer.widgets[0].layer = { widgets: [] })).toThrow('only on layer');
    expect(parse(doc => { doc.pages[0].adaptiveViews = [{ id: 'view', name: 'View', width: 400, overrides: { [group.id]: { x: 10 } } }]; })).toThrow('derived from member');
    expect(() => parseDocument(JSON.stringify(project(createLayer([createWidget('tableCell')]))))).toThrow('must belong to a table');
    let nested = createWidget('layer');
    for (let i = 0; i < 14; i++) nested = createLayer([nested]);
    expect(() => parseDocument(JSON.stringify(project(nested)))).toThrow('nesting');
    expect(parseDocument(serializeDocument(project(createWidget('layer')))).pages[0].widgets[0]).toMatchObject({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('clones every group/member/reference once and offsets through layers, stopping at a panel or item origin', () => {
    const panel = createWidget('panel', 240, 80), panelChild = leaf('panelChild', 5, 6);
    panel.states![0].widgets = [createLayer([panelChild])];
    const inner = createLayer([leaf('a', 100, 50), panel]), outer = createLayer([inner]);
    const target = inner.layer!.widgets[0];
    outer.interactions = [{ id: uid(), name: 'Target', enabled: true, event: 'click', conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'hide', targetId: target.id }] }];
    const [copy] = cloneWidgets([outer], 20), nested = copy.layer!.widgets[0], copiedPanel = nested.layer!.widgets[1];
    expect(nested.layer!.widgets[0]).toMatchObject({ x: 120, y: 70 });
    expect(copiedPanel).toMatchObject({ x: 260, y: 100 });
    expect(copiedPanel.states![0].widgets[0].layer!.widgets[0]).toMatchObject({ x: 5, y: 6 });
    expect(copy.interactions[0].actions[0].targetId).toBe(nested.layer!.widgets[0].id);
    const old = collectWidgetIdentifiers([outer]), next = collectWidgetIdentifiers([copy]);
    expect(next.size).toBe(old.size); expect([...next.keys()].some(id => old.has(id))).toBe(false);
    expect(parseDocument(serializeDocument(project(copy))).pages[0].widgets).toEqual([copy]);
  });

  it('groups and ungroups without rebasing coordinates or disturbing unrelated stacking', () => {
    const a = leaf('a', 100, 50), middle = leaf('middle', 15, 20), b = leaf('b', 160, 60), top = leaf('top', 5, 6);
    const grouped = groupIntoLayer([a, middle, b, top], ['a', 'b']);
    expect(grouped.widgets.map(widget => widget.id)).toEqual(['middle', grouped.layer!.id, 'top']);
    expect(grouped.layer!.layer!.widgets).toEqual([a, b]);
    const result = ungroupLayers(grouped.widgets, [grouped.layer!.id]);
    expect(result.widgets).toEqual([middle, a, b, top]); expect(result.selected).toEqual(['a', 'b']);
    const single = [a, { ...b, locked: true }];
    expect(groupIntoLayer(single, ['a', 'b']).widgets).toBe(single);
    const empty = createLayer([]);
    expect(ungroupLayers([empty], [empty.id])).toEqual({ widgets: [], selected: [] });
    expect(ungroupLayers(single, ['missing']).widgets).toBe(single);
  });
});

describe('native authoring Layer bounds', () => {
  it('unions rotated leaf rectangles including hidden/unplaced children and excludes shadows and nested degrees', () => {
    const a = { ...leaf('a', -100, -80, 40, 20), hidden: true, placed: false, rotation: 90 };
    a.style.outerShadow = { on: true, color: '#ff0000', blurRadius: 40, offsetX: 30, offsetY: 30 };
    const nested = createLayer([a]); nested.rotation = 45;
    const bounds = layerAuthoringBounds([nested]);
    expect(bounds.x).toBeCloseTo(-90); expect(bounds.y).toBeCloseTo(-90);
    expect(bounds.width).toBeCloseTo(20); expect(bounds.height).toBeCloseTo(40);
    expect(layerAuthoringBounds([createWidget('layer')])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('refits every containing layer when a child moves or is deleted without mutating the input', () => {
    const group = createLayer([createLayer([leaf('a', 100, 80), leaf('b', 140, 100)])]);
    const changed = updateWidgetTree([group], 'b', { x: 200 });
    expect(changed[0]).toMatchObject({ x: 100, y: 80, width: 120, height: 30 });
    expect(changed[0].layer!.widgets[0]).toMatchObject({ width: 120 });
    expect(group.width).toBe(60);
    const deleted = deleteWidgetTree(changed, ['b']);
    expect(deleted[0]).toMatchObject({ width: 20, height: 10 });
    expect(fitLayerTree(deleted)).toBe(deleted);
  });

  it('keeps per-view member positions and placement independent while deriving the effective frame', () => {
    let page = createAdaptiveView(project(createLayer([leaf('a', 100, 80), leaf('b', 140, 100)])).pages[0], 'Narrow', 400);
    const view = page.adaptiveViews[0], group = page.widgets[0];
    const moved = translateWidget(group, 30, -20);
    page = applyAdaptiveWidgetEdits(page, view.id, [moved]);
    expect(page.widgets[0]).toMatchObject({ x: 100, y: 80 });
    expect(resolveAdaptiveWidgets(page, view.id)[0]).toMatchObject({ x: 130, y: 60 });
    expect(page.adaptiveViews[0].overrides[group.id]).toBeUndefined();
    expect(page.adaptiveViews[0].overrides.a).toMatchObject({ x: 130, y: 60 });
    const hidden = { ...group, placed: false };
    expect(isAdaptiveWidgetPlaced([hidden], 'a')).toBe(false);
    const deleted = deleteAdaptiveWidgets(page, null, [group.id], true);
    expect(deleted.widgets).toEqual([]); expect(deleted.adaptiveViews[0].overrides).toEqual({});
  });

  it('creates a shared group from an adaptive selection without hiding existing base members', () => {
    let page = createAdaptiveView(project(leaf('a', 100, 80), leaf('b', 140, 100)).pages[0], 'Narrow', 400);
    const view = page.adaptiveViews[0]; view.overrides.a = { x: 20 };
    const result = groupIntoLayer(resolveAdaptiveWidgets(page, view.id), ['a','b']);
    page = applyAdaptiveWidgetEdits(page, view.id, result.widgets, { placementAllViews: true });
    expect(page.widgets[0].placed).not.toBe(false);
    expect(page.widgets[0].layer!.widgets[0].x).toBe(100);
    expect(resolveAdaptiveWidgets(page, view.id)[0].layer!.widgets[0].x).toBe(20);
    expect(isAdaptiveWidgetPlaced(page.widgets, 'a')).toBe(true);
    const document = project(); document.pages = [page];
    expect(parseDocument(serializeDocument(document))).toEqual(document);
  });

  it('normalizes component coordinates through groups and updates nested linked instances', () => {
    const child = leaf('a', 100, 80), group = createLayer([child]), component = createComponent([group], 'Grouped');
    expect(component.widgets[0]).toMatchObject({ x: 0, y: 0 });
    expect(component.widgets[0].layer!.widgets[0]).toMatchObject({ x: 0, y: 0 });
    const first = createComponentInstance(component, 20, 30), second = createComponentInstance(component, 200, 30);
    const doc = project(createLayer([first, second])); doc.components = [component];
    const edited = findWidget(doc.pages[0], first.id)!;
    edited.states![0].widgets[0].layer!.widgets[0].text = 'Updated';
    const next = applyComponentInstanceChanges(doc, first.id);
    expect(findWidget(next.pages[0], second.id)!.states![0].widgets[0].layer!.widgets[0].text).toBe('Updated');
    expect(parseDocument(serializeDocument(next))).toEqual(next);
    const resized = updateComponent(next, { ...next.components[0], width: 400, height: 100 });
    expect(resized.pages[0].widgets[0]).toMatchObject({ x: 20, y: 30, width: 580, height: 100 });
    expect(parseDocument(serializeDocument(resized))).toEqual(resized);
  });
});
