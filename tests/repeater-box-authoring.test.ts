import { describe, expect, it } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cloneWidgets, createDocument, createWidget, defaultStyle, mergeWidgetStyle, parseDocument, parseWidgetStylePatch, resolveSelectedStyle, serializeDocument, uid } from '../src/model/document';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { BorderWidthEditor, Inspector, RepeaterLayoutEditor } from '../src/components/Inspector';
import type { Widget, WidgetStyle } from '../src/model/types';

function fixture() { const doc = createDocument(), repeater = createWidget('repeater'); doc.pages[0].widgets = [repeater]; return { doc, repeater }; }
function legacy() {
  const repeater = createWidget('repeater'); repeater.width = 280; repeater.height = 180; repeater.style = defaultStyle();
  repeater.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }, { Name: 'C' }], template: repeater.repeater!.template, itemHeight: 48, gap: 8 };
  return repeater;
}

describe('repeater container and per-side border schema', () => {
  it('creates vertical zero-gap fitted repeaters from the current template right/bottom bounds', () => {
    const { doc, repeater } = fixture(), data = repeater.repeater!, template = data.template[0];
    expect([template.x + template.width, template.y + template.height]).toEqual([264, 41]);
    expect(data).toMatchObject({ layout: 'vertical', itemWidth: 264, itemHeight: 41, gap: 0, fitToContent: true });
    expect([repeater.width, repeater.height]).toEqual([264, 123]); expect(repeater.style).toMatchObject({ fill: 'transparent', strokeWidth: 0 });
    expect(data.rows).toHaveLength(3); expect(data).not.toHaveProperty('padding'); expect(repeater.style).not.toHaveProperty('borderWidths');
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('leaves explicit old document fields, dimensions and style unchanged on load/save', () => {
    const doc = createDocument(); doc.pages[0].widgets = [legacy()];
    const parsed = parseDocument(serializeDocument(doc)), repeater = parsed.pages[0].widgets[0];
    expect(parsed).toEqual(doc); expect(repeater.repeater).not.toHaveProperty('layout'); expect(repeater.repeater).not.toHaveProperty('padding');
    expect(repeater.style).not.toHaveProperty('borderWidths'); expect(repeater.style.strokeWidth).toBe(1); expect([repeater.width, repeater.height]).toEqual([280, 180]);
  });

  it('round-trips all four sides with zero, fractional and maximum values through style, selectedStyle, action and adaptive carriers', () => {
    const { doc, repeater } = fixture(); repeater.repeater!.padding = [0, 1000, 0.5, 17]; repeater.style.borderWidths = [0, 100, 0.5, 8];
    repeater.selectedStyle = { borderWidths: [5, 4, 3, 2], strokeWidth: 1 };
    repeater.interactions = [{ id: uid(), event: 'click', name: 'Borders', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: repeater.id, style: { borderWidths: [1, 2, 3, 4] } }] }];
    doc.pages[0].adaptiveViews = [{ id: uid(), name: 'Small', width: 400, overrides: { [repeater.id]: { style: { borderWidths: [9, 8, 7, 6] } } } }];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(parseWidgetStylePatch({ borderWidths: [0, 100, 0.5, 8] })).toEqual({ borderWidths: [0, 100, 0.5, 8] });
  });

  it.each(['padding', 'borderWidths'] as const)('rejects malformed %s tuples, coercions and values outside its bounds', field => {
    const maximum = field === 'padding' ? 1000 : 100;
    for (const value of [null, {}, 0, '1 2 3 4', [], [1], [1, 2, 3], [1, 2, 3, 4, 5], [-1, 0, 0, 0], [0, maximum + 0.01, 0, 0], [NaN, 0, 0, 0], [Infinity, 0, 0, 0], [0, '2', 0, 0], [0, false, 0, 0], [0, null, 0, 0]]) {
      const { doc, repeater } = fixture(); Object.assign(field === 'padding' ? repeater.repeater! : repeater.style, { [field]: value });
      expect(() => parseDocument(JSON.stringify(doc)), `${field} ${JSON.stringify(value)}`).toThrow(field);
    }
  });

  it('also rejects malformed border widths in partial-style trust boundaries', () => {
    for (const carrier of ['selected', 'adaptive', 'action'] as const) {
      const { doc, repeater } = fixture(), invalid = { borderWidths: [0, 1, 2] } as unknown as Partial<WidgetStyle>;
      if (carrier === 'selected') repeater.selectedStyle = invalid;
      if (carrier === 'adaptive') doc.pages[0].adaptiveViews = [{ id: uid(), name: 'Small', width: 400, overrides: { [repeater.id]: { style: invalid } } }];
      if (carrier === 'action') repeater.interactions = [{ id: uid(), event: 'click', name: 'Bad border', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: repeater.id, style: invalid }] }];
      expect(() => parseDocument(JSON.stringify(doc))).toThrow('borderWidths');
    }
    expect(() => parseWidgetStylePatch({ borderWidths: [101, 0, 0, 0] })).toThrow('borderWidths');
  });

  it('deep-clones tuples and propagates component changes without sharing mutable arrays', () => {
    const { doc, repeater } = fixture(); repeater.repeater!.padding = [1, 2, 3, 4]; repeater.style.borderWidths = [4, 3, 2, 1];
    const [copy] = cloneWidgets([repeater]); copy.repeater!.padding![0] = 50; copy.style.borderWidths![1] = 40;
    expect(repeater.repeater!.padding).toEqual([1, 2, 3, 4]); expect(repeater.style.borderWidths).toEqual([4, 3, 2, 1]);
    const component = createComponent([repeater]), a = createComponentInstance(component), b = createComponentInstance(component); doc.components = [component]; doc.pages[0].widgets = [a, b];
    a.states![0].widgets[0].repeater!.padding![2] = 25; a.states![0].widgets[0].style.borderWidths![3] = 9;
    const next = applyComponentInstanceChanges(doc, a.id); expect(next.components[0].widgets[0].repeater!.padding).toEqual([1, 2, 25, 4]);
    expect(next.pages[0].widgets[1].states![0].widgets[0].style.borderWidths).toEqual([4, 3, 2, 9]);
    expect(b.states![0].widgets[0].style.borderWidths).toEqual([4, 3, 2, 1]); expect(parseDocument(serializeDocument(next))).toEqual(next);
  });
});

describe('uniform stroke and independent border merge semantics', () => {
  const base = (): WidgetStyle => ({ ...defaultStyle(), strokeWidth: 2, borderWidths: [1, 3, 5, 7], cornerRadii: [2, 4, 6, 8] });
  it('clears inherited sides when the common stroke is explicitly supplied, even with the same value', () => {
    const original = base(); expect(mergeWidgetStyle(original, { strokeWidth: 2 })).not.toHaveProperty('borderWidths');
    expect(mergeWidgetStyle(original, { strokeWidth: 0 })).toMatchObject({ strokeWidth: 0, cornerRadii: [2, 4, 6, 8] });
    expect(mergeWidgetStyle(original, { fill: '#ffffff' }).borderWidths).toEqual([1, 3, 5, 7]); expect(original.borderWidths).toEqual([1, 3, 5, 7]);
  });
  it('retains explicitly supplied sides and honors explicit undefined across nested UI merges', () => {
    expect(mergeWidgetStyle(base(), { strokeWidth: 8, borderWidths: [2, 4, 6, 8] })).toMatchObject({ strokeWidth: 8, borderWidths: [2, 4, 6, 8] });
    const cleared = mergeWidgetStyle(base(), { strokeWidth: 2 }); cleared.borderWidths = undefined;
    expect(mergeWidgetStyle(base(), cleared).borderWidths).toBeUndefined();
    const { doc, repeater } = fixture(); repeater.style = mergeWidgetStyle(base(), cleared);
    expect(parseDocument(serializeDocument(doc)).pages[0].widgets[0].style).not.toHaveProperty('borderWidths');
  });
  it('applies the same precedence to selected styles and restores the untouched base on deselection', () => {
    const widget = createWidget('box'); widget.style = base(); widget.selected = true; widget.selectedStyle = { strokeWidth: 9 };
    expect(resolveSelectedStyle(widget)).not.toHaveProperty('borderWidths'); expect(resolveSelectedStyle(widget).strokeWidth).toBe(9);
    widget.selectedStyle = { strokeWidth: 9, borderWidths: [4, 4, 2, 2] }; expect(resolveSelectedStyle(widget).borderWidths).toEqual([4, 4, 2, 2]);
    widget.selected = false; expect(resolveSelectedStyle(widget)).toBe(widget.style); expect(widget.style.borderWidths).toEqual([1, 3, 5, 7]);
  });
});

function control(tree: ReactNode, field: string, value: string): ReactElement<Record<string, unknown>> {
  const visit = (node: ReactNode): ReactElement<Record<string, unknown>> | undefined => {
    if (Array.isArray(node)) { for (const child of node) { const found = visit(child); if (found) return found; } }
    if (!isValidElement<Record<string, unknown>>(node)) return;
    if (node.props[field] === value) return node;
    return visit(node.props.children as ReactNode);
  };
  const result = visit(tree); if (!result) throw new Error(`Missing control ${value}`); return result;
}

describe('box authoring controls', () => {
  it('shows independent sides and emits common-stroke resets including a same-value commit', () => {
    let style: WidgetStyle = { ...defaultStyle(), strokeWidth: 3 };
    const render = () => BorderWidthEditor({ style, onChange: patch => { style = mergeWidgetStyle(style, patch); } });
    const change = (field: string, name: string, value: unknown) => (control(render(), field, name).props.onChange as (value: unknown) => void)(value);
    change('aria-label', 'Independent border widths', { target: { checked: true } }); expect(style.borderWidths).toEqual([3, 3, 3, 3]);
    change('label', 'Border top', 0); change('label', 'Border right', 12); expect(style.borderWidths).toEqual([0, 12, 3, 3]);
    expect(control(render(), 'label', 'Stroke').props.commitUnchanged).toBe(true);
    expect(renderToStaticMarkup(render())).toContain('aria-label="Border right"');
    change('label', 'Stroke', 3); expect(style).not.toHaveProperty('borderWidths');
    change('aria-label', 'Independent border widths', { target: { checked: true } });
    change('aria-label', 'Independent border widths', { target: { checked: false } }); expect(style.borderWidths).toBeUndefined(); expect(style.strokeWidth).toBe(3);
  });

  it('opts padding-only legacy data into layout controls and clears padding or all layout fields', () => {
    const widget = legacy(); widget.repeater!.padding = [1, 2, 3, 4];
    const render = () => RepeaterLayoutEditor({ widget, onChange: patch => Object.assign(widget, patch) });
    expect(control(render(), 'aria-label', 'Repeater layout').props.value).toBe('vertical');
    expect(renderToStaticMarkup(render())).toContain('aria-label="Repeater padding left"');
    (control(render(), 'label', 'Repeater padding left').props.onChange as (value: number) => void)(15); expect(widget.repeater!.padding).toEqual([1, 2, 3, 15]);
    (control(render(), 'children', 'Clear repeater padding').props.onClick as () => void)(); expect(widget.repeater).not.toHaveProperty('padding');
    widget.repeater!.padding = [0, 0, 0, 0]; widget.repeater!.layout = 'horizontal';
    (control(render(), 'aria-label', 'Repeater layout').props.onChange as (value: unknown) => void)({ target: { value: 'legacy' } });
    expect(widget.repeater).not.toHaveProperty('padding'); expect(widget.repeater).not.toHaveProperty('layout'); expect(widget.repeater!.gap).toBe(8);
  });

  it('renders the actual Inspector border and repeater padding controls without adding omitted fields', () => {
    const { doc, repeater } = fixture(), before = structuredClone(repeater); repeater.style.borderWidths = [1, 2, 3, 4];
    const markup = renderToStaticMarkup(createElement(Inspector, { document: doc, page: doc.pages[0], widget: repeater, onWidgetChange: () => {}, onPageChange: () => {} }));
    expect(markup).toContain('aria-label="Independent border widths"'); expect(markup).toContain('aria-label="Border bottom"'); expect(markup).toContain('aria-label="Repeater padding top"');
    expect(repeater.repeater).toEqual(before.repeater); expect(repeater.repeater).not.toHaveProperty('padding');
  });
});
