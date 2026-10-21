import { describe, expect, it } from 'vitest';
import {
  cloneWidgets, createDocument, createLayer, createPage, createWidget, findWidget,
  mapWidgets, mergeWidgetStyle, parseAuthorStylePatch, parseDocument, parseWidgetStylePatch, serializeDocument,
} from '../src/model/document';
import { applyAdaptiveWidgetEdits, clearAdaptiveOverrides, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { commitAdaptivePage, resolveAdaptivePage } from '../src/model/adaptive-view-sets';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import type { Document, Page, Widget } from '../src/model/types';

const layouts = Array.from({ length: 8 }, (_, bits) => ({
  autoFitWidth: !!(bits & 1), autoFitHeight: !!(bits & 2), alignRight: !!(bits & 4),
}));
const roundTrip = (doc: Document) => parseDocument(serializeDocument(doc));
function fixture(type: 'checkbox' | 'radio' = 'checkbox', rotation = 0) {
  const doc = createDocument(), leaf = createWidget(type, 80, 60);
  leaf.id = 'selection-leaf';
  leaf.rotation = rotation;
  leaf.selectionText = { ...layouts[7] };
  leaf.style.selectionButtonSize = 14;
  const inner = createLayer([leaf], 'Inner'), outer = createLayer([inner], 'Outer');
  const unrelated = createWidget('radio', 420, 100);
  unrelated.id = 'untouched-radio';
  doc.pages[0].widgets = [outer, unrelated];
  const page = doc.pages[0];
  page.adaptiveViews = [
    { id: 'parent', name: 'Parent', width: 800, overrides: { [leaf.id]: { x: 90, style: { selectionButtonSize: 16, fill: '#123456' } } } },
    { id: 'child', name: 'Child', width: 400, baseViewId: 'parent', overrides: { [leaf.id]: { width: 150, style: { selectionButtonSize: 18, stroke: '#654321' } } } },
    { id: 'sibling', name: 'Sibling', width: 600, overrides: { [leaf.id]: { y: 70, style: { selectionButtonSize: 13, opacity: .5 } } } },
  ];
  page.adaptiveOverrides = { inactive: { [leaf.id]: { hidden: true, style: { selectionButtonSize: 12, radius: 7 } } } };
  // createLayer owns a deep copy of its members; tests must mutate the admitted
  // nested widget, not the caller's original object.
  return { doc, page, leaf: findWidget(page, leaf.id)!, outer };
}
function effective(page: Page, view: string | null = 'child') {
  return findWidget({ ...page, widgets: resolveAdaptiveWidgets(page, view) }, 'selection-leaf')!;
}
function edit(page: Page, change: (widget: Widget) => Widget, view: string | null = 'child', allViews = false) {
  return applyAdaptiveWidgetEdits(page, view, mapWidgets(structuredClone(resolveAdaptiveWidgets(page, view)),
    widget => widget.id === 'selection-leaf' ? change(widget) : widget), { allViews });
}

describe('selection layout saved carriers', () => {
  it('keeps legacy omission byte stable without guessing fit flags or a universal P94 default', () => {
    const doc = createDocument();
    doc.pages[0].widgets = [createWidget('checkbox'), createWidget('radio')];
    const before = serializeDocument(doc), read = parseDocument(before);
    expect(before).not.toMatch(/selectionText|selectionButtonSize/);
    expect(serializeDocument(read)).toBe(before);
    expect(parseAuthorStylePatch({})).toEqual({});
    expect(mergeWidgetStyle(read.pages[0].widgets[0].style, { color: '#123456' })).not.toHaveProperty('selectionButtonSize');
  });

  for (const type of ['checkbox', 'radio'] as const) it.each(layouts)(`${type} preserves $autoFitWidth/$autoFitHeight/$alignRight without geometry or text changes`, selectionText => {
    const { doc, leaf } = fixture(type, 37);
    leaf.selectionText = { ...selectionText };
    leaf.text = 'A\nB';
    leaf.richText = { paragraphs: [{ runs: [{ text: 'A\nB', style: { fontSize: 21, color: '#123456' } }] }] };
    const before = structuredClone(doc);
    expect(roundTrip(doc)).toEqual(before);
    expect(doc).toEqual(before);
  });

  it('rejects incomplete, extra, unsafe and nonboolean selectionText fields', () => {
    const invalid = [null, false, [], '', {}, { autoFitWidth: true, autoFitHeight: false },
      { ...layouts[0], autoFitWidth: 1 }, { ...layouts[0], autoFitHeight: 'false' },
      { ...layouts[0], alignRight: null }, { ...layouts[0], unknown: true },
      JSON.parse('{"autoFitWidth":true,"autoFitHeight":false,"alignRight":false,"__proto__":{}}')];
    for (const selectionText of invalid) {
      const { doc, leaf } = fixture();
      Object.assign(leaf, { selectionText });
      expect(() => parseDocument(JSON.stringify(doc))).toThrow(/selectionText|unsafe/i);
    }
  });

  it('allows the shared carrier only on checkbox/radio, including nested widget validation', () => {
    for (const type of ['box', 'ellipse', 'path', 'text', 'button', 'input', 'select', 'textarea', 'panel', 'layer', 'repeater', 'table', 'menu', 'tree', 'image', 'line', 'hotspot', 'inlineFrame'] as const) {
      const doc = createDocument(), widget = createWidget(type);
      Object.assign(widget, { selectionText: layouts[0] });
      doc.pages[0].widgets = [widget];
      expect(() => parseDocument(JSON.stringify(doc)), type).toThrow('selectionText');
    }
    const doc = createDocument(), table = createWidget('table');
    Object.assign(table.table!.cells[0], { selectionText: layouts[0] });
    doc.pages[0].widgets = [table];
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('selectionText');
  });

  it('rejects shared flags inside normal/state/action/adaptive/rich style carriers', () => {
    for (const carrier of ['normal', 'selected', 'action', 'adaptive', 'adaptiveStyle', 'named', 'run'] as const) {
      const { doc, leaf } = fixture();
      const wrong = { selectionText: layouts[0] };
      if (carrier === 'normal') Object.assign(leaf.style, wrong);
      if (carrier === 'selected') Object.assign(leaf, { selectedStyle: wrong });
      if (carrier === 'action') leaf.interactions = [{ id: 'case', event: 'click', name: 'Style', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: 'action', type: 'setStyle', targetId: leaf.id, style: wrong as never }] }];
      if (carrier === 'adaptive') Object.assign(doc.pages[0].adaptiveViews[1].overrides[leaf.id], wrong);
      if (carrier === 'adaptiveStyle') Object.assign(doc.pages[0].adaptiveViews[1].overrides[leaf.id].style!, wrong);
      if (carrier === 'named') doc.styles = [{ id: 'style', name: 'Wrong carrier', style: wrong as never }];
      if (carrier === 'run') leaf.richText = { paragraphs: [{ runs: [{ text: leaf.text, style: wrong as never }] }] };
      expect(() => parseDocument(JSON.stringify(doc)), carrier).toThrow('selectionText');
    }
  });

  it.each([0, .25, 12, 13, 14, 16, 18, 100000])('preserves P94=%s in normal, named and adaptive styles (product finite range, not a native range claim)', size => {
    const { doc, leaf, page } = fixture();
    leaf.style.selectionButtonSize = size;
    page.adaptiveViews[1].overrides[leaf.id].style!.selectionButtonSize = size;
    doc.styles = [{ id: 'selection-style', name: 'Indicator', style: { ...leaf.style } }];
    expect(parseAuthorStylePatch({ selectionButtonSize: size })).toEqual({ selectionButtonSize: size });
    expect(roundTrip(doc)).toEqual(doc);
    expect(effective(page).style.selectionButtonSize).toBe(size);
  });

  it.each([-1, 100000.01, NaN, Infinity, -Infinity, null, true, '14', [], {}].map(value => ({ value })))('rejects invalid P94 $value without coercion', ({ value }) => {
    expect(() => parseAuthorStylePatch({ selectionButtonSize: value })).toThrow('selectionButtonSize');
    const { doc, leaf } = fixture();
    Object.assign(leaf.style, { selectionButtonSize: value });
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('selectionButtonSize');
  });

  it('preserves P94 in independent state maps without moving shared flags into them', () => {
    const { doc, leaf, page } = fixture();
    for (const field of ['selectedStyle', 'mouseOverStyle', 'mouseDownStyle', 'focusedStyle', 'disabledStyle', 'errorStyle'] as const) leaf[field] = { selectionButtonSize: 18 };
    page.adaptiveViews[0].overrides[leaf.id].stateStyles = { selected: { selectionButtonSize: 22 }, mouseOver: { selectionButtonSize: 24 } };
    page.adaptiveViews[1].overrides[leaf.id].stateStyles = { selected: { selectionButtonSize: 0 } };
    const input = createWidget('input');
    input.hintStyle = { selectionButtonSize: 20 };
    doc.pages[0].widgets.push(input);
    expect(roundTrip(doc)).toEqual(doc);
    expect(effective(page).style.selectionButtonSize).toBe(18);
    expect(effective(page).selectedStyle).toEqual({ selectionButtonSize: 0 });
    expect(effective(page).mouseOverStyle).toBeUndefined();
    expect(effective(page, 'parent').selectedStyle).toEqual({ selectionButtonSize: 22 });
    expect(effective(page).selectionText).toEqual(layouts[7]);
  });

  it.each([0, 18.25, 100000])('preserves SetStyle P94=%s as action data through parsing and target remapping, without applying it to the saved widget', size => {
    const { doc, leaf } = fixture();
    const saved = structuredClone(leaf);
    leaf.interactions = [{ id: 'case', name: 'Style', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: 'action', type: 'setStyle', targetId: leaf.id, style: { selectionButtonSize: size } }] }];
    const before = structuredClone(doc);
    expect(parseWidgetStylePatch({ selectionButtonSize: size })).toEqual({ selectionButtonSize: size });
    expect(roundTrip(doc)).toEqual(before);
    const [copy] = cloneWidgets([leaf]);
    expect(copy.interactions[0].actions[0]).toMatchObject({ type: 'setStyle', targetId: copy.id, style: { selectionButtonSize: size } });
    expect(copy.interactions[0].actions[0].id).not.toBe('action');
    expect({ ...leaf, interactions: saved.interactions }).toEqual(saved);
    expect(doc).toEqual(before);
  });

  it('keeps finite scalar validation on public patches and SetStyle actions', () => {
    for (const value of [-1, 100000.01, NaN, Infinity, null, true, '18', [], {}]) {
      expect(() => parseWidgetStylePatch({ selectionButtonSize: value })).toThrow('selectionButtonSize');
      const { doc, leaf } = fixture();
      leaf.interactions = [{ id: 'case', name: 'Style', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: 'action', type: 'setStyle', targetId: leaf.id, style: { selectionButtonSize: value } as never }] }];
      expect(() => parseDocument(JSON.stringify(doc))).toThrow('selectionButtonSize');
    }
  });

  it('keeps P94 out of rich runs and hyperlink text effects', () => {
    for (const carrier of ['run', 'link'] as const) {
      const { doc, leaf } = fixture();
      leaf.richText = { paragraphs: [{ runs: [{ text: leaf.text }] }] };
      if (carrier === 'run') leaf.richText.paragraphs[0].runs[0].style = { selectionButtonSize: 18 } as never;
      else {
        leaf.richText.paragraphs[0].runs[0].linkId = 'selection-link';
        leaf.richText.links = [{ id: 'selection-link', name: 'Link', interactions: [], mouseOverStyle: { selectionButtonSize: 18 } as never }];
      }
      expect(() => parseDocument(JSON.stringify(doc)), carrier).toThrow('selectionButtonSize');
    }
  });

  it('deep-clones and propagates component content without changing source flags, other placements or unrelated widgets', () => {
    const { outer, leaf } = fixture(), [copy] = cloneWidgets([outer]);
    const copiedLeaf = copy.layer!.widgets[0].layer!.widgets[0];
    expect(copiedLeaf.selectionText).toEqual(leaf.selectionText);
    expect(copiedLeaf.style.selectionButtonSize).toBe(14);
    copiedLeaf.selectionText!.autoFitWidth = false;
    copiedLeaf.style.selectionButtonSize = 0;
    expect(leaf.selectionText!.autoFitWidth).toBe(true);
    expect(leaf.style.selectionButtonSize).toBe(14);
    const component = createComponent([outer]), a = createComponentInstance(component, 10, 20), b = createComponentInstance(component, 500, 600), doc = createDocument();
    doc.components = [component];
    doc.pages[0].widgets = [a, b, createWidget('checkbox')];
    const before = structuredClone(doc);
    const editedLeaf = a.states![0].widgets[0].layer!.widgets[0].layer!.widgets[0];
    editedLeaf.selectionText = { ...layouts[0] };
    editedLeaf.style.selectionButtonSize = 18;
    const next = applyComponentInstanceChanges(doc, a.id);
    expect(next.components[0].widgets[0].layer!.widgets[0].layer!.widgets[0]).toMatchObject({ selectionText: layouts[0], style: { selectionButtonSize: 18 } });
    expect(next.pages[0].widgets[1].states![0].widgets[0].layer!.widgets[0].layer!.widgets[0]).toMatchObject({ selectionText: layouts[0], style: { selectionButtonSize: 18 } });
    expect(next.pages[0].widgets[1]).toMatchObject({ x: 500, y: 600 });
    expect(next.pages[0].widgets[2]).toEqual(before.pages[0].widgets[2]);
    expect(roundTrip(next)).toEqual(next);
  });
});

describe('selection layout independent adaptive properties', () => {
  it('writes shared flags from a child view while P94 stays local and ancestor/sibling/inactive declarations remain exact', () => {
    const { doc, page, leaf } = fixture(), before = structuredClone(page);
    const changed = edit(page, widget => ({ ...widget, selectionText: { ...layouts[0] }, style: { ...widget.style, selectionButtonSize: 0 } }));
    expect(findWidget(changed, leaf.id)).toEqual({ ...leaf, selectionText: layouts[0] });
    expect(changed.adaptiveViews[1].overrides[leaf.id]).toEqual({ ...before.adaptiveViews[1].overrides[leaf.id], style: { ...before.adaptiveViews[1].overrides[leaf.id].style, selectionButtonSize: 0 } });
    expect(changed.adaptiveViews[0]).toEqual(before.adaptiveViews[0]);
    expect(changed.adaptiveViews[2]).toEqual(before.adaptiveViews[2]);
    expect(changed.adaptiveOverrides).toEqual(before.adaptiveOverrides);
    for (const view of [null, 'parent', 'child', 'sibling']) expect(effective(changed, view).selectionText).toEqual(layouts[0]);
    expect(effective(changed).style.selectionButtonSize).toBe(0);
    doc.pages[0] = changed;
    expect(roundTrip(doc)).toEqual(doc);
    expect(page).toEqual(before);
  });

  it('removes a shared carrier explicitly without materializing defaults or changing any style/geometry declaration', () => {
    const { doc, page } = fixture();
    const changed = edit(page, widget => { const next = { ...widget }; delete next.selectionText; return next; });
    expect(effective(changed)).not.toHaveProperty('selectionText');
    expect(changed.adaptiveViews).toEqual(page.adaptiveViews);
    expect(changed.adaptiveOverrides).toEqual(page.adaptiveOverrides);
    doc.pages[0] = changed;
    expect(roundTrip(doc)).toEqual(doc);
  });

  it('retains explicit equal P94 declarations through unrelated current-view edits', () => {
    const { page, leaf } = fixture();
    page.adaptiveViews[0].overrides[leaf.id].style!.selectionButtonSize = 18;
    const changed = edit(page, widget => ({ ...widget, style: { ...widget.style, color: '#abcdef' } }));
    expect(changed.adaptiveViews[1].overrides[leaf.id].style).toEqual({ selectionButtonSize: 18, stroke: '#654321', color: '#abcdef' });
    expect(changed.widgets).toEqual(page.widgets);
  });

  it('promotes only changed P94 across all views, leaving flags, geometry, state maps and other styles intact', () => {
    const { doc, page, leaf } = fixture();
    page.adaptiveViews[0].overrides[leaf.id].stateStyles = { selected: { color: '#abcdef' } };
    const before = structuredClone(page), changed = edit(page, widget => ({ ...widget, style: { ...widget.style, selectionButtonSize: 0 } }), 'child', true);
    expect(findWidget(changed, leaf.id)).toEqual({ ...leaf, style: { ...leaf.style, selectionButtonSize: 0 } });
    const maps = [...changed.adaptiveViews.map(view => view.overrides), changed.adaptiveOverrides!.inactive];
    const oldMaps = [...before.adaptiveViews.map(view => view.overrides), before.adaptiveOverrides!.inactive];
    maps.forEach((map, index) => {
      const expected = structuredClone(oldMaps[index][leaf.id]);
      delete expected.style!.selectionButtonSize;
      expect(map[leaf.id]).toEqual(expected);
    });
    expect(changed.widgets[1]).toEqual(before.widgets[1]);
    doc.pages[0] = changed;
    expect(roundTrip(doc)).toEqual(doc);
    expect(page).toEqual(before);
  });

  it('same effective P94 is an all-views no-op, while shared flags can still change without clearing local sizes', () => {
    const { page } = fixture();
    expect(edit(page, widget => ({ ...widget, style: { ...widget.style, selectionButtonSize: 18 } }), 'child', true)).toBe(page);
    const changed = edit(page, widget => ({ ...widget, selectionText: { ...layouts[0] } }), 'child', true);
    expect(effective(changed).selectionText).toEqual(layouts[0]);
    expect(changed.adaptiveViews).toEqual(page.adaptiveViews);
    expect(changed.adaptiveOverrides).toEqual(page.adaptiveOverrides);
  });

  it('Base P94 edits leave explicit local values untouched; clearing an override restores inheritance, not a guessed default', () => {
    const { page, leaf } = fixture();
    const changed = edit(page, widget => ({ ...widget, style: { ...widget.style, selectionButtonSize: 25 } }), null);
    expect(findWidget(changed, leaf.id)!.style.selectionButtonSize).toBe(25);
    expect(changed.adaptiveViews).toEqual(page.adaptiveViews);
    expect(changed.adaptiveOverrides).toEqual(page.adaptiveOverrides);
    const cleared = clearAdaptiveOverrides(changed, 'child', [leaf.id]);
    expect(effective(cleared).style.selectionButtonSize).toBe(16);
    expect(effective(cleared).selectionText).toEqual(leaf.selectionText);
  });

  it('commits shared-set projected P94 back to one page and preserves other pages, definitions and inactive unrelated fields', () => {
    const { doc, page, leaf } = fixture();
    doc.adaptiveViewSets = [{ id: 'selection-set', name: 'Selection set', baseSize: { width: 1200, height: 0 }, views: page.adaptiveViews.map(({ overrides: _overrides, ...definition }) => definition) }];
    page.adaptiveViewSetId = 'selection-set';
    page.adaptiveOverrides = { ...page.adaptiveOverrides, ...Object.fromEntries(page.adaptiveViews.map(view => [view.id, view.overrides])) };
    page.adaptiveViews = [];
    delete page.adaptiveSelection; delete page.adaptiveBaseSize;
    const other = createPage('Untouched');
    other.adaptiveViewSetId = 'selection-set';
    delete other.adaptiveSelection; delete other.adaptiveBaseSize;
    doc.pages.push(other);
    const before = structuredClone(doc);
    const committed = commitAdaptivePage(doc, edit(resolveAdaptivePage(doc, page), widget => ({ ...widget, style: { ...widget.style, selectionButtonSize: 20 } }), 'child', true));
    expect(committed.adaptiveViewSets).toEqual(before.adaptiveViewSets);
    expect(committed.pages[1]).toEqual(before.pages[1]);
    expect(findWidget(committed.pages[0], leaf.id)!.style.selectionButtonSize).toBe(20);
    for (const map of Object.values(committed.pages[0].adaptiveOverrides!)) expect(map[leaf.id]?.style).not.toHaveProperty('selectionButtonSize');
    expect(roundTrip(committed)).toEqual(committed);
    expect(doc).toEqual(before);
  });
});
