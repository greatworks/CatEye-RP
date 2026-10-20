import { describe, expect, it } from 'vitest';
import { applyAdaptiveWidgetEdits, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { cloneWidgets, createDocument, createWidget, parseDocument, resolveInteractionStyle, resolveSelectedStyle, serializeDocument } from '../src/model/document';
import type { Widget, WidgetStyle } from '../src/model/types';

const fields = ['mouseOverStyle', 'mouseDownStyle', 'focusedStyle', 'selectedStyle', 'disabledStyle'] as const;
function documentWith(widget: Widget) { const doc = createDocument(); doc.pages[0].widgets = [widget]; return doc; }
function styledWidget(): Widget {
  const widget = createWidget('box');
  widget.style.fill = '#111111'; widget.style.stroke = '#222222'; widget.style.color = '#333333';
  widget.mouseOverStyle = { fill: '#aa0000', stroke: '#00aabb' };
  widget.mouseDownStyle = { fill: '#00aa00', fontSize: 21 };
  widget.focusedStyle = { fill: '#aaaa00', color: '#bb00aa' };
  widget.selectedStyle = { fill: '#0000aa', fontWeight: 700 };
  widget.disabledStyle = { fill: '#999999', opacity: 0.4 };
  return widget;
}

describe('interaction style schema and shared content', () => {
  it('preserves absent state styles in old documents and new widget defaults', () => {
    for (const type of ['box', 'input', 'checkbox', 'panel', 'repeater'] as const) {
      const widget = createWidget(type), doc = documentWith(widget);
      expect(parseDocument(serializeDocument(doc))).toEqual(doc);
      for (const field of fields) expect(widget).not.toHaveProperty(field);
    }
  });

  it.each(fields)('round-trips all supported partial properties and an empty %s', field => {
    const patch: Partial<WidgetStyle> = { fill: 'transparent', stroke: '#123456', strokeWidth: 0, borderWidths: [1, 2, 3, 4], radius: 0, cornerRadii: [4, 3, 2, 1], color: '#abcdef', fontSize: 27, fontFamily: 'Arial', fontWeight: 700, textAlign: 'left', opacity: 0, textPadding: [0, 2, 3, 4], verticalAlign: 'bottom', lineHeight: 'normal' };
    const widget = createWidget('input'); widget[field] = patch;
    const doc = documentWith(widget); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    widget[field] = {}; expect(parseDocument(serializeDocument(doc)).pages[0].widgets[0][field]).toEqual({});
  });

  it.each(fields)('strictly rejects malformed and unsafe %s patches', field => {
    const invalid: unknown[] = [null, [], 'red', 1, { fill: 'url(https://example.com/image)' }, { stroke: 'expression(alert(1))' }, { fontFamily: 'Arial;display:none' }, { opacity: -0.1 }, { fontSize: 513 }, { radius: -1 }, { strokeWidth: 101 }, { borderWidths: [0, 1, 2] }, { borderWidths: [0, 1, 2, 101] }, { cornerRadii: [0, 1, 2, null] }, { textPadding: [0, 1, 2, 1001] }, { verticalAlign: 'center' }, { lineHeight: '1.2' }, { textAlign: 'justify' }, { hidden: true }, JSON.parse('{"__proto__":{}}'), JSON.parse('{"constructor":{}}')];
    for (const patch of invalid) {
      const doc = documentWith({ ...createWidget('box'), [field]: patch } as Widget);
      expect(() => parseDocument(JSON.stringify(doc)), `${field}: ${JSON.stringify(patch)}`).toThrow(field);
    }
  });

  it('validates nested panel and repeater content rather than dropping style patches', () => {
    const panel = createWidget('panel'), repeater = createWidget('repeater');
    panel.states![0].widgets = [repeater]; repeater.repeater!.template = [styledWidget()];
    const doc = documentWith(panel); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    repeater.repeater!.template[0].disabledStyle = { opacity: 2 };
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('disabledStyle.opacity');
  });

  it('deep-clones every state style without aliasing independent tuples', () => {
    const widget = styledWidget();
    for (const field of fields) widget[field] = { textPadding: [1, 2, 3, 4], borderWidths: [4, 3, 2, 1] };
    const [copy] = cloneWidgets([widget]); expect(copy.id).not.toBe(widget.id);
    for (const field of fields) {
      expect(copy[field]).toEqual(widget[field]);
      copy[field]!.textPadding![0] = 10; copy[field]!.borderWidths![0] = 20;
      expect(widget[field]!.textPadding![0]).toBe(1); expect(widget[field]!.borderWidths![0]).toBe(4);
    }
  });

  it('keeps adaptive effect edits local alongside ordinary local style edits', () => {
    const widget = createWidget('box'); let page = createAdaptiveView(documentWith(widget).pages[0]);
    const viewId = page.adaptiveViews[0].id, visible = structuredClone(page.widgets);
    for (const field of fields) visible[0][field] = { fill: '#abcdef' };
    visible[0].x = 340; visible[0].style.color = '#123456';
    page = applyAdaptiveWidgetEdits(page, viewId, visible);
    for (const field of fields) { expect(page.widgets[0][field]).toBeUndefined(); expect(resolveAdaptiveWidgets(page, viewId)[0][field]).toEqual({ fill: '#abcdef' }); }
    expect(page.adaptiveViews[0].overrides[widget.id]).toEqual({ x: 340, style: { color: '#123456' }, stateStyles: Object.fromEntries(fields.map(field => [field.replace(/Style$/, ''), { fill: '#abcdef' }])) });
    expect(page.widgets[0].x).toBe(100); expect(page.widgets[0].style.color).toBe(widget.style.color);
  });

  it('publishes changed and removed styles to linked copies without touching unrelated widgets', () => {
    const source = styledWidget(), component = createComponent([source], 'Stateful'), a = createComponentInstance(component), b = createComponentInstance(component, 500, 300), unrelated = styledWidget();
    const doc = createDocument(); doc.components = [component]; doc.pages[0].widgets = [a, b, unrelated];
    const child = a.states![0].widgets[0]; child.focusedStyle = { color: '#123456', borderWidths: [1, 2, 3, 4] }; delete child.mouseOverStyle;
    const updated = applyComponentInstanceChanges(doc, a.id), other = updated.pages[0].widgets[1].states![0].widgets[0];
    expect(other.id).toBe(b.states![0].widgets[0].id); expect(other.focusedStyle).toEqual(child.focusedStyle); expect(other).not.toHaveProperty('mouseOverStyle');
    expect(updated.pages[0].widgets[2]).toBe(unrelated); expect(unrelated.mouseOverStyle).toBeDefined();
    expect(parseDocument(serializeDocument(updated))).toEqual(updated);
  });
});

describe('interaction style composition', () => {
  it('matches all 32 ordinary state combinations by property, with focus and disabled suppression', () => {
    for (let bits = 0; bits < 32; bits++) {
      const widget = styledWidget(); widget.selected = !!(bits & 8); widget.disabled = !!(bits & 16);
      const state = { mouseOver: !!(bits & 1), mouseDown: !!(bits & 2), focused: !!(bits & 4) };
      const before = structuredClone(widget), style = resolveInteractionStyle(widget, state);
      const pointerAllowed = !widget.disabled && !state.focused;
      expect(style.fill, `combination ${bits}`).toBe(widget.disabled ? '#999999' : widget.selected ? '#0000aa' : state.focused ? '#aaaa00' : state.mouseDown ? '#00aa00' : state.mouseOver ? '#aa0000' : '#111111');
      expect(style.stroke).toBe(pointerAllowed && state.mouseOver ? '#00aabb' : '#222222');
      expect(style.fontSize).toBe(pointerAllowed && state.mouseDown ? 21 : widget.style.fontSize);
      expect(style.color).toBe(!widget.disabled && state.focused ? '#bb00aa' : '#333333');
      expect(style.fontWeight).toBe(widget.selected ? 700 : widget.style.fontWeight);
      expect(style.opacity).toBe(widget.disabled ? 0.4 : 1);
      expect(style.fontFamily).toBe(widget.style.fontFamily); expect(widget).toEqual(before);
    }
  });

  it('retains hover/down for DOM focus with absent or empty focused style', () => {
    for (const focusedStyle of [undefined, {}]) {
      const widget = styledWidget(); widget.focusedStyle = focusedStyle;
      const style = resolveInteractionStyle(widget, { mouseOver: true, mouseDown: true, focused: true });
      expect(style.fill).toBe('#00aa00'); expect(style.stroke).toBe('#00aabb'); expect(style.fontSize).toBe(21);
    }
    const widget = styledWidget(); widget.focusedStyle = { opacity: 1 };
    expect(resolveInteractionStyle(widget, { mouseOver: true, mouseDown: true, focused: true })).toEqual(widget.style);
  });

  it('does not synthesize a disabled opacity and retains selection below an empty disabled effect', () => {
    const widget = styledWidget(); widget.disabled = widget.selected = true; widget.disabledStyle = {};
    expect(resolveInteractionStyle(widget, { focused: true, mouseDown: true, mouseOver: true })).toEqual({ ...widget.style, ...widget.selectedStyle });
    expect(resolveSelectedStyle(widget).opacity).toBe(1);
  });

  it('preserves checkable runtime style selection independently from checked', () => {
    for (const type of ['checkbox', 'radio'] as const) {
      const widget = { ...styledWidget(), type, checked: true };
      expect(resolveInteractionStyle(widget).fill).toBe('#0000aa');
      expect(resolveInteractionStyle({ ...widget, selected: false }).fill).toBe('#111111');
      expect(resolveInteractionStyle({ ...widget, checked: false, selected: true }).fill).toBe('#0000aa');
    }
  });

  it('replaces inherited corner and border tuples at the layer that sets common values', () => {
    const widget = styledWidget(); widget.style.cornerRadii = [1, 2, 3, 4]; widget.style.borderWidths = [4, 3, 2, 1];
    widget.mouseOverStyle = { radius: 8, strokeWidth: 2 }; widget.mouseDownStyle = { radius: 9, cornerRadii: [9, 8, 7, 6], strokeWidth: 3, borderWidths: [1, 3, 5, 7] };
    const hover = resolveInteractionStyle(widget, { mouseOver: true }); expect(hover).not.toHaveProperty('cornerRadii'); expect(hover).not.toHaveProperty('borderWidths');
    const down = resolveInteractionStyle(widget, { mouseOver: true, mouseDown: true }); expect(down.cornerRadii).toEqual([9, 8, 7, 6]); expect(down.borderWidths).toEqual([1, 3, 5, 7]);
    widget.selected = true; widget.selectedStyle = { radius: 0, strokeWidth: 0 };
    const selected = resolveInteractionStyle(widget, { mouseOver: true, mouseDown: true }); expect(selected).not.toHaveProperty('cornerRadii'); expect(selected).not.toHaveProperty('borderWidths');
    widget.disabled = true; widget.disabledStyle = { cornerRadii: [2, 4, 6, 8], borderWidths: [8, 6, 4, 2] };
    expect(resolveInteractionStyle(widget).cornerRadii).toEqual([2, 4, 6, 8]); expect(resolveInteractionStyle(widget).borderWidths).toEqual([8, 6, 4, 2]);
    expect(widget.style.cornerRadii).toEqual([1, 2, 3, 4]); expect(widget.style.borderWidths).toEqual([4, 3, 2, 1]);
  });
});
