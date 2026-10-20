import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cloneWidgets, createDocument, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import { applyAdaptiveWidgetEdits, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { createComponent, createComponentInstance, updateComponent } from '../src/model/components';
import { WidgetContent } from '../src/components/WidgetView';
import type { Document, WidgetStyle } from '../src/model/types';

const layout: Partial<WidgetStyle> = { textPadding: [0, 2.5, 9, 1000], verticalAlign: 'bottom', lineHeight: 'normal' };
const fixture = () => { const doc = createDocument(); doc.pages[0].widgets = [createWidget('text')]; return doc; };
type StyleLocation = 'widget' | 'shared' | 'adaptive' | 'action';
function withStyle(doc: Document, location: StyleLocation, patch: Record<string, unknown>): void {
  const widget = doc.pages[0].widgets[0];
  if (location === 'widget') Object.assign(widget.style, patch);
  if (location === 'shared') doc.styles = [{ id: uid(), name: 'Layout', style: { ...widget.style, ...patch } }];
  if (location === 'adaptive') doc.pages[0] = createAdaptiveView(doc.pages[0]);
  if (location === 'adaptive') doc.pages[0].adaptiveViews[0].overrides[widget.id] = { style: patch };
  if (location === 'action') widget.interactions = [{ id: uid(), event: 'click', name: 'Layout', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: widget.id, style: patch }] }];
}

describe('optional text layout', () => {
  it('leaves old documents unchanged and keeps the default text layout', () => {
    const doc = fixture(); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    const markup = renderToStaticMarkup(createElement(WidgetContent, { widget: doc.pages[0].widgets[0] }));
    // Explicit none keeps an unrelated parent widget's text shadow out of legacy text.
    expect(markup).toBe('<span class="widget-text" style="text-shadow:none">Text</span>');
    for (const field of ['textPadding', 'verticalAlign', 'lineHeight']) expect(serializeDocument(doc)).not.toContain(field);
  });

  it('round-trips every style carrier and clones independent tuples', () => {
    const doc = fixture();
    for (const location of ['widget', 'shared', 'adaptive', 'action'] as const) withStyle(doc, location, layout);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    const [copy] = cloneWidgets(doc.pages[0].widgets); expect(copy.style).toEqual(doc.pages[0].widgets[0].style);
    copy.style.textPadding![0] = 44; expect(doc.pages[0].widgets[0].style.textPadding![0]).toBe(0);
    expect(copy.interactions[0].actions[0].targetId).toBe(copy.id);
  });

  it.each(['widget', 'shared', 'adaptive', 'action'] as const)('rejects malformed values in %s styles', location => {
    for (const [field, values] of Object.entries({ textPadding: [null, {}, [], [1, 2, 3], [1, 2, 3, 4, 5], [0, -1, 0, 0], [0, 1001, 0, 0], [0, '2', 0, 0], [0, NaN, 0, 0], [0, Infinity, 0, 0]], verticalAlign: [null, 0, 'center', 'top;position:fixed'], lineHeight: [null, '1.5', 0, 0.09, 10.01, Infinity, 'normal;display:none'] })) {
      for (const value of values) { const doc = fixture(); withStyle(doc, location, { [field]: value }); expect(() => parseDocument(JSON.stringify(doc)), `${field}: ${JSON.stringify(value)}`).toThrow(field); }
    }
  });

  it('accepts line-height limits and applies line-height only to text content', () => {
    for (const lineHeight of ['normal', 0.1, 1.35, 10] as const) { const doc = fixture(); doc.pages[0].widgets[0].style.lineHeight = lineHeight; expect(parseDocument(serializeDocument(doc))).toEqual(doc); }
    for (const type of ['input', 'textarea', 'select'] as const) {
      const control = createWidget(type); Object.assign(control.style, layout);
      const markup = renderToStaticMarkup(createElement(WidgetContent, { widget: control }));
      expect(markup).toContain('padding:0px 2.5px 9px 1000px'); expect(markup).not.toContain('align-items:'); expect(markup).not.toContain('line-height:');
    }
  });

  it('keeps adaptive edits local, compares tuples by value and persists reset defaults', () => {
    const doc = fixture(); Object.assign(doc.pages[0].widgets[0].style, layout);
    let page = createAdaptiveView(doc.pages[0]); const viewId = page.adaptiveViews[0].id;
    page = applyAdaptiveWidgetEdits(page, viewId, structuredClone(resolveAdaptiveWidgets(page, viewId))); expect(page.adaptiveViews[0].overrides).toEqual({});
    const visible = structuredClone(resolveAdaptiveWidgets(page, viewId)); visible[0].style.textPadding = undefined; visible[0].style.verticalAlign = undefined; visible[0].style.lineHeight = undefined;
    page = applyAdaptiveWidgetEdits(page, viewId, visible);
    const restored = parseDocument(serializeDocument({ ...doc, pages: [page] })).pages[0];
    expect(restored.widgets[0].style).toMatchObject(layout);
    expect(resolveAdaptiveWidgets(restored, viewId)[0].style).toMatchObject({ textPadding: [5, 5, 5, 5], verticalAlign: 'top', lineHeight: 1.35 });
    const local = structuredClone(resolveAdaptiveWidgets(restored, viewId)); Object.assign(local[0].style, { textPadding: [1, 2, 3, 4], verticalAlign: 'middle', lineHeight: 2 });
    const next = applyAdaptiveWidgetEdits(restored, viewId, local);
    expect(next.widgets[0].style).toMatchObject(layout);
    expect(next.adaptiveViews[0].overrides[local[0].id]).toEqual({
      style: { verticalAlign: 'middle', lineHeight: 2 },
      textPaddingSides: { top: 1, right: 2, bottom: 3, left: 4 },
    });
    const reopened = parseDocument(serializeDocument({ ...doc, pages: [next] })).pages[0];
    expect(resolveAdaptiveWidgets(reopened, viewId)[0].style).toMatchObject({ textPadding: [1, 2, 3, 4], verticalAlign: 'middle', lineHeight: 2 });
    expect(reopened.widgets[0].style).toMatchObject(layout);
  });

  it('propagates component text layout changes without applying them to the wrapper', () => {
    const doc = fixture(), component = createComponent(doc.pages[0].widgets), instance = createComponentInstance(component);
    doc.components = [component]; doc.pages[0].widgets = [instance];
    const next = updateComponent(doc, { ...component, widgets: component.widgets.map(widget => ({ ...widget, style: { ...widget.style, ...layout } })) });
    expect(next.pages[0].widgets[0].style.textPadding).toBeUndefined(); expect(next.pages[0].widgets[0].states![0].widgets[0].style).toMatchObject(layout);
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });
});
