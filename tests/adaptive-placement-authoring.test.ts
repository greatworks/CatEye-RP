import { describe, expect, it } from 'vitest';
import * as adaptive from '../src/model/adaptive';
import { cloneWidgets, createDocument, createPage, createWidget, findWidget, parseDocument, serializeDocument, updateWidgetTree } from '../src/model/document';
import { createComponent, createComponentInstance } from '../src/model/components';
import { commitAdaptivePage, resolveAdaptivePage } from '../src/model/adaptive-view-sets';
import type { Page } from '../src/model/types';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WidgetContent } from '../src/components/WidgetView';

function fixture() {
  const doc = createDocument(), page = createPage('Placement'), box = createWidget('box');
  page.widgets = [box];
  page.adaptiveViews = [{ id: 'parent-view', name: 'Parent', width: 900, overrides: {} },
    { id: 'child-view', name: 'Child', width: 390, baseViewId: 'parent-view', overrides: {} },
    { id: 'sibling-view', name: 'Sibling', width: 700, overrides: {} }];
  doc.pages = [page]; return { doc, page, box };
}
const setPlacement = (...args: Parameters<typeof adaptive.setAdaptivePlacement>) => adaptive.setAdaptivePlacement(...args);
const remove = (...args: Parameters<typeof adaptive.deleteAdaptiveWidgets>) => adaptive.deleteAdaptiveWidgets(...args);
const effective = (page: Page, view: string | null, id: string) => findWidget({ widgets: adaptive.resolveAdaptiveWidgets(page, view) }, id)!;

describe('placement schema and shared identities', () => {
  it('retains old omission and strict explicit booleans without conflating visibility', () => {
    const { doc, page, box } = fixture();
    expect(parseDocument(serializeDocument(doc)).pages[0].widgets[0]).not.toHaveProperty('placed');
    box.placed = false; page.adaptiveViews[1].overrides[box.id] = { placed: true, hidden: true };
    const parsed = parseDocument(serializeDocument(doc));
    expect(parsed.pages[0].widgets[0]).toMatchObject({ placed: false, hidden: false });
    expect(parsed.pages[0].adaptiveViews[1].overrides[box.id]).toEqual({ placed: true, hidden: true });
    for (const value of [null, 0, 'false', {}]) {
      const bad = structuredClone(doc); Object.assign(bad.pages[0].widgets[0], { placed: value });
      expect(() => parseDocument(JSON.stringify(bad))).toThrow(/placed/);
      const badView = structuredClone(doc); Object.assign(badView.pages[0].adaptiveViews[1].overrides[box.id], { placed: value });
      expect(() => parseDocument(JSON.stringify(badView))).toThrow(/placed/);
    }
  });
  it('permits shared composite roots but rejects local placement on contained cells and labels', () => {
    for (const type of ['table', 'menu', 'tree'] as const) {
      const { doc, page } = fixture(), root = createWidget(type); page.widgets = [root];
      page.adaptiveViews[0].overrides[root.id] = { placed: false };
      expect(parseDocument(serializeDocument(doc)).pages[0].adaptiveViews[0].overrides[root.id]).toEqual({ placed: false });
      const id = type === 'table' ? root.table!.cells[0].id : type === 'menu' ? root.menu!.table.table!.cells[0].id : root.tree!.nodes[0].treeNode!.label.id;
      page.adaptiveViews[0].overrides[id] = { placed: false };
      expect(() => parseDocument(serializeDocument(doc))).toThrow(/shared/);
      expect(() => setPlacement(page, 'parent-view', [id], false)).toThrow(/shared/);
    }
  });
  it('preserves placement on clone/component materialization and remaps action references', () => {
    const source = createWidget('box'); source.placed = false;
    source.interactions = [{ id: 'case', event: 'click', enabled: true, name: 'Self', conditions: [], conditionMode: 'all', actions: [{ id: 'action', type: 'show', targetId: source.id }] }];
    const copied = cloneWidgets([source])[0];
    expect(copied.placed).toBe(false); expect(copied.interactions[0].actions[0].targetId).toBe(copied.id);
    const component = createComponent([source]), instance = createComponentInstance(component);
    expect(instance.states![0].widgets[0].placed).toBe(false);
    expect(instance.states![0].widgets[0].interactions[0].actions[0].targetId).toBe(instance.states![0].widgets[0].id);
  });
});

describe('placement authoring commands', () => {
  it('unplaces the current inherited branch without deleting content, references or sibling placement', () => {
    const { page, box } = fixture(), next = setPlacement(page, 'parent-view', [box.id], false);
    expect(next.widgets).toEqual(page.widgets); expect(next.widgets[0].id).toBe(box.id);
    expect(effective(next, 'parent-view', box.id).placed).toBe(false);
    expect(effective(next, 'child-view', box.id).placed).toBe(false);
    expect(effective(next, 'sibling-view', box.id).placed).toBeUndefined();
    const restored = setPlacement(next, 'child-view', [box.id], true);
    expect(effective(restored, 'child-view', box.id).placed).toBe(true);
    expect(effective(restored, 'parent-view', box.id).placed).toBe(false);
    expect(setPlacement(restored, 'child-view', [box.id], true)).toBe(restored);
  });
  it('retains explicit equal placement through text/style edits and parent changes', () => {
    const { page, box } = fixture();
    const explicit = setPlacement(page, 'child-view', [box.id], true);
    const edited = adaptive.applyAdaptiveWidgetEdits(explicit, 'child-view', updateWidgetTree(adaptive.resolveAdaptiveWidgets(explicit, 'child-view'), box.id, { text: 'Shared edit' }));
    expect(edited.adaptiveViews[1].overrides[box.id]).toEqual({ placed: true });
    const changed = setPlacement(edited, 'parent-view', [box.id], false);
    expect(effective(changed, 'child-view', box.id)).toMatchObject({ text: 'Shared edit', placed: true });
    expect(changed.widgets[0]).not.toHaveProperty('placed');
  });
  it('all-views edits clear only placement, including inactive maps, while preserving empty state barriers', () => {
    const { page, box } = fixture();
    page.adaptiveViews[0].overrides[box.id] = { placed: false, x: 18, stateStyles: {} };
    page.adaptiveOverrides = { inactive: { [box.id]: { placed: true, style: { fill: '#123456' } } } };
    const next = setPlacement(page, 'child-view', [box.id], false, true);
    expect(next.widgets[0].placed).toBe(false);
    expect(next.adaptiveViews[0].overrides[box.id]).toEqual({ x: 18, stateStyles: {} });
    expect(next.adaptiveOverrides!.inactive[box.id]).toEqual({ style: { fill: '#123456' } });
    expect(setPlacement(next, null, [box.id], false, true)).toBe(next);
  });
  it('child Delete unplaces; Base or explicit all-views Delete removes subtrees and prunes declarations', () => {
    const { page } = fixture(), panel = createWidget('panel'), child = createWidget('box'); panel.states![0].widgets = [child]; page.widgets = [panel];
    page.adaptiveViews[0].overrides[child.id] = { x: 7 }; page.adaptiveOverrides = { inactive: { [child.id]: { placed: true } } };
    const kept = remove(page, 'child-view', [panel.id]);
    expect(findWidget(kept, child.id)).toBeDefined(); expect(effective(kept, 'child-view', panel.id).placed).toBe(false);
    for (const removed of [remove(kept, null, [panel.id]), remove(kept, 'child-view', [panel.id], true)]) {
      expect(removed.widgets).toEqual([]); expect(removed.adaptiveViews[0].overrides).toEqual({}); expect(removed.adaptiveOverrides!.inactive).toEqual({});
    }
  });
  it('normal panel/repeater children are independently placeable', () => {
    const { page } = fixture(), panel = createWidget('panel'), repeater = createWidget('repeater'); panel.states![0].widgets = [repeater]; page.widgets = [panel];
    const child = repeater.repeater!.template[0], next = setPlacement(page, 'child-view', [child.id], false);
    expect(effective(next, 'child-view', child.id).placed).toBe(false);
    expect(effective(next, 'child-view', panel.id).placed).toBeUndefined(); expect(effective(next, 'child-view', repeater.id).placed).toBeUndefined();
    expect(adaptive.isAdaptiveWidgetPlaced(adaptive.resolveAdaptiveWidgets(next, 'child-view'), child.id)).toBe(false);
    const unplacedParent = setPlacement(page, 'parent-view', [panel.id], false);
    expect(adaptive.isAdaptiveWidgetPlaced(adaptive.resolveAdaptiveWidgets(unplacedParent, 'child-view'), child.id)).toBe(false);
    expect(findWidget(unplacedParent, child.id)).not.toHaveProperty('placed');
  });
  it('author insertion marks only new subtree roots Base-unplaced/current-placed', () => {
    const { page } = fixture(), panel = createWidget('panel'), cellTable = createWidget('table'); panel.states![0].widgets = [cellTable];
    const next = adaptive.applyAdaptiveWidgetEdits(page, 'child-view', [...adaptive.resolveAdaptiveWidgets(page, 'child-view'), panel], { placementAllViews: false });
    expect(next.widgets.at(-1)!.placed).toBe(false); expect(next.adaptiveViews[1].overrides[panel.id]).toEqual({ placed: true });
    expect(next.adaptiveViews[1].overrides[cellTable.id]).toBeUndefined();
    expect(next.widgets.at(-1)!.states![0].widgets[0]).not.toHaveProperty('placed');
    expect(effective(next, 'child-view', panel.id).placed).toBe(true); expect(effective(next, 'parent-view', panel.id).placed).toBe(false);
    const all = adaptive.applyAdaptiveWidgetEdits(page, 'child-view', [...page.widgets, panel], { placementAllViews: true });
    expect(all.widgets.at(-1)!).not.toHaveProperty('placed'); expect(all.adaptiveViews[1].overrides[panel.id]).toBeUndefined();
  });
  it('shared-set commits preserve placement and inactive maps without changing the set definition', () => {
    const { doc, page, box } = fixture();
    doc.adaptiveViewSets = [{ id: 'set', name: 'Views', baseSize: { width: 0, height: 0 }, views: page.adaptiveViews.map(({ overrides, ...view }) => view) }];
    page.adaptiveViewSetId = 'set'; page.adaptiveViews = []; page.adaptiveOverrides = { inactive: { [box.id]: { placed: false } } };
    const changed = setPlacement(resolveAdaptivePage(doc, page), 'child-view', [box.id], false);
    const result = commitAdaptivePage(doc, changed), parsed = parseDocument(serializeDocument(result));
    expect(result.adaptiveViewSets).toEqual(doc.adaptiveViewSets); expect(parsed.pages[0].adaptiveViews).toEqual([]);
    expect(parsed.pages[0].adaptiveOverrides!['child-view'][box.id]).toEqual({ placed: false });
    expect(parsed.pages[0].adaptiveOverrides!.inactive[box.id]).toEqual({ placed: false });
  });
  it('keeps root composite placement local during shared cell/label edits', () => {
    for (const type of ['table', 'menu', 'tree'] as const) {
      const { page } = fixture(), root = createWidget(type); page.widgets = [root];
      const next = setPlacement(page, 'child-view', [root.id], false);
      expect(effective(next, 'child-view', root.id).placed).toBe(false);
      const edited = adaptive.applyAdaptiveWidgetEdits(next, 'child-view', adaptive.resolveAdaptiveWidgets(next, 'child-view').map(widget => ({ ...widget, name: 'Shared name' })));
      expect(edited.widgets[0]).toMatchObject({ name: 'Shared name' }); expect(edited.widgets[0]).not.toHaveProperty('placed');
      expect(edited.adaptiveViews[1].overrides[root.id]).toEqual({ placed: false });
    }
  });
  it('insertion into an existing panel or repeater creates a locally placed child without touching the owner', () => {
    for (const type of ['panel', 'repeater'] as const) {
      const { page } = fixture(), root = createWidget(type), child = createWidget('text'); page.widgets = [root];
      const visible = adaptive.resolveAdaptiveWidgets(page, 'child-view');
      const inserted = updateWidgetTree(visible, root.id, w => type === 'panel' ? { states: [{ ...w.states![0], widgets: [child] }] } : { repeater: { ...w.repeater!, template: [child] } });
      const next = adaptive.applyAdaptiveWidgetEdits(page, 'child-view', inserted, { placementAllViews: false });
      expect(next.widgets[0]).not.toHaveProperty('placed'); expect(findWidget(next, child.id)!.placed).toBe(false);
      expect(next.adaptiveViews[1].overrides[child.id]).toEqual({ placed: true });
    }
  });
  it('static nested rendering omits unplaced text while retaining hidden authoring previews', () => {
    for (const type of ['panel', 'repeater'] as const) {
      const root = createWidget(type), absent = createWidget('text'), hidden = createWidget('text');
      absent.text = 'UNPLACED SHOULD NOT RENDER'; absent.placed = false; hidden.text = 'HIDDEN AUTHOR PREVIEW'; hidden.hidden = true;
      if (root.states) root.states[0].widgets = [absent, hidden]; else root.repeater!.template = [absent, hidden];
      const html = renderToStaticMarkup(createElement(WidgetContent, { widget: root }));
      expect(html).not.toContain(absent.text); expect(html).toContain(hidden.text);
      expect(findWidget({ widgets: [root] }, absent.id)).toBeDefined();
    }
  });
});
