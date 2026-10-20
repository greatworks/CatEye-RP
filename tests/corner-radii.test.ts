import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDocument, createWidget, defaultStyle, mergeWidgetStyle, parseDocument, serializeDocument, uid } from '../src/model/document';
import { applyAdaptiveWidgetEdits, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { createComponent, createComponentInstance, updateComponent } from '../src/model/components';
import { widgetStyle } from '../src/components/WidgetView';
import { Inspector, validateUpdateRowSpec } from '../src/components/Inspector';
import type { WidgetStyle } from '../src/model/types';

describe('optional per-corner radii', () => {
  it('leaves old defaults and documents unchanged and retains the common-radius fallback', () => {
    const doc = createDocument(), box = createWidget('box'); box.style.radius = 14; doc.pages[0].widgets = [box];
    expect(Object.hasOwn(defaultStyle(), 'cornerRadii')).toBe(false);
    expect(serializeDocument(doc)).not.toContain('cornerRadii');
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(widgetStyle(box).borderRadius).toBe(14);
  });

  it('renders TL/TR/BR/BL in CSS order and keeps ellipse rendering circular', () => {
    const widget = createWidget('box'); widget.style.radius = 5; widget.style.cornerRadii = [1, 2, 3, 4];
    expect(widgetStyle(widget).borderRadius).toBe('1px 2px 3px 4px');
    const ellipse = { ...widget, type: 'ellipse' as const };
    expect(widgetStyle(ellipse).borderRadius).toBe('50%');
  });

  it('round-trips four finite radii on widgets, shared styles, setStyle actions and adaptive overrides', () => {
    let doc = createDocument(); const widget = createWidget('box'); widget.style.cornerRadii = [0, 0.5, 12, 1000];
    doc.pages[0].widgets = [widget]; doc.styles = [{ id: uid(), name: 'Four corners', style: structuredClone(widget.style) }];
    widget.interactions = [{ id: uid(), name: 'Corners', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: widget.id, style: { cornerRadii: [4, 8, 12, 16] } }] }];
    doc = { ...doc, pages: [createAdaptiveView(doc.pages[0], 'Mobile', 390)] };
    doc.pages[0].adaptiveViews[0].overrides[widget.id] = { style: { cornerRadii: [2, 4, 6, 8] } };
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('rejects malformed lengths, types, bounds and nonfinite inputs at every style trust boundary', () => {
    const doc = createDocument(); doc.pages[0].widgets = [createWidget('box')];
    for (const invalid of [null, {}, [], [1], [1, 2, 3], [1, 2, 3, 4, 5], [0, 0, 0, -1], [0, 1001, 0, 0], [0, '1', 0, 0], [0, Number.NaN, 0, 0], [0, Number.POSITIVE_INFINITY, 0, 0]]) {
      const raw = JSON.parse(JSON.stringify(doc)); raw.pages[0].widgets[0].style.cornerRadii = invalid;
      expect(() => parseDocument(JSON.stringify(raw)), JSON.stringify(invalid)).toThrow(/cornerRadii/);
    }
    const raw = JSON.parse(JSON.stringify(doc)); raw.pages[0].adaptiveViews = [{ id: uid(), name: 'Mobile', width: 390, overrides: { [doc.pages[0].widgets[0].id]: { style: { cornerRadii: [0, 2] } } } }];
    expect(() => parseDocument(JSON.stringify(raw))).toThrow('exactly four');
  });

  it('clears inherited per-corner radii only for an explicit common-radius patch', () => {
    const base: WidgetStyle = { ...defaultStyle(), radius: 7, cornerRadii: [1, 2, 3, 4] };
    expect(mergeWidgetStyle(base, { color: '#ff0000' }).cornerRadii).toEqual([1, 2, 3, 4]);
    const uniform = mergeWidgetStyle(base, { radius: 7 });
    expect(uniform.cornerRadii).toBeUndefined(); expect(Object.hasOwn(uniform, 'cornerRadii')).toBe(false);
    expect(mergeWidgetStyle(base, { radius: 8, cornerRadii: [3, 4, 5, 6] }).cornerRadii).toEqual([3, 4, 5, 6]);
    expect(mergeWidgetStyle(base, { cornerRadii: undefined }).cornerRadii).toBeUndefined();
    expect(base.cornerRadii).toEqual([1, 2, 3, 4]);
  });

  it('compares adaptive tuples by value and persists a local reset to uniform radius', () => {
    const doc = createDocument(), box = createWidget('box'); box.style.cornerRadii = [5, 10, 15, 20]; doc.pages[0].widgets = [box];
    let page = createAdaptiveView(doc.pages[0]); const viewId = page.adaptiveViews[0].id;
    page = applyAdaptiveWidgetEdits(page, viewId, structuredClone(resolveAdaptiveWidgets(page, viewId)));
    expect(page.adaptiveViews[0].overrides).toEqual({});
    const local = resolveAdaptiveWidgets(page, viewId); local[0] = { ...local[0], style: mergeWidgetStyle(local[0].style, { radius: 0 }) };
    page = applyAdaptiveWidgetEdits(page, viewId, local);
    expect(page.adaptiveViews[0].overrides[box.id]).toEqual({ style: { radius: 0 } });
    const restored = parseDocument(serializeDocument({ ...doc, pages: [page] })).pages[0];
    expect(resolveAdaptiveWidgets(restored, viewId)[0].style.cornerRadii).toBeUndefined();
    expect(restored.widgets[0].style.cornerRadii).toEqual([5, 10, 15, 20]);
    const changed = resolveAdaptiveWidgets(restored, viewId); changed[0].style.cornerRadii = [2, 4, 6, 8];
    const updated = applyAdaptiveWidgetEdits(restored, viewId, changed);
    expect(resolveAdaptiveWidgets(updated, viewId)[0].style.cornerRadii).toEqual([2, 4, 6, 8]);
  });

  it('propagates component corner edits and keeps independent instance styles intact', () => {
    const doc = createDocument(), box = createWidget('box'); box.style.cornerRadii = [1, 2, 3, 4];
    const component = createComponent([box]), instance = createComponentInstance(component); instance.style.cornerRadii = [10, 0, 0, 10];
    doc.components = [component]; doc.pages[0].widgets = [instance];
    const next = updateComponent(doc, { ...component, widgets: component.widgets.map(widget => ({ ...widget, style: { ...widget.style, cornerRadii: [20, 30, 40, 50] } })) });
    expect(next.pages[0].widgets[0].style.cornerRadii).toEqual([10, 0, 0, 10]);
    expect(next.pages[0].widgets[0].states![0].widgets[0].style.cornerRadii).toEqual([20, 30, 40, 50]);
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });

  it('renders all four accessible corner fields with bounds in the inspector', () => {
    const doc = createDocument(), widget = createWidget('box'); widget.style.cornerRadii = [1, 2, 3, 4];
    const markup = renderToStaticMarkup(createElement(Inspector, { document: doc, page: doc.pages[0], widget, onWidgetChange: () => {}, onPageChange: () => {} }));
    expect(markup).toContain('aria-label="Independent corner radii"');
    for (const label of ['Top left', 'Top right', 'Bottom right', 'Bottom left']) expect(markup).toContain(`aria-label="${label}"`);
    expect(markup.match(/max="1000"/g)).toHaveLength(4);
  });
});

describe('row-update authoring schema', () => {
  it('round-trips the new itemLoad and updateRow enum entries without enabling unsupported targets implicitly', () => {
    const doc = createDocument(), repeater = createWidget('repeater');
    repeater.interactions = [{ id: uid(), event: 'itemLoad', name: 'Bind item', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'updateRow', targetId: repeater.id, value: JSON.stringify({ row: 'this', values: { Name: '[[Item.Name]]' } }) }] }];
    doc.pages[0].widgets = [repeater]; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('accepts current/all/index/matching updates with expressions, quotes and preserved unspecified columns', () => {
    const columns = ['Name', 'Status'];
    for (const row of ['this', 'all', 0, 3]) expect(validateUpdateRowSpec({ row, values: { Name: '[[Name]] "quoted"' } }, columns)).toBeNull();
    expect(validateUpdateRowSpec({ where: { column: 'Status', operator: 'equals', value: 'Open' }, values: { Name: 'New' } }, columns)).toBeNull();
    expect(validateUpdateRowSpec({ row: 'this', values: {} }, columns)).toBeNull();
  });

  it('rejects ambiguous selectors, unknown fields/columns, invalid row indices and prototype keys', () => {
    const columns = ['Name'];
    for (const data of [null, { values: {} }, { row: 'this', where: {}, values: {} }, { row: 'all', values: {}, extra: true }, { row: -1, values: {} }, { row: 1.5, values: {} }, { row: '0', values: {} }, { row: 'this', values: { Unknown: 'bad' } }, { row: 'this', values: { Name: 1 } }, { where: { column: 'Missing', operator: 'equals', value: '' }, values: {} }, JSON.parse('{"row":"all","values":{"__proto__":"x"}}')]) {
      expect(validateUpdateRowSpec(data, columns)).not.toBeNull();
    }
  });
});
