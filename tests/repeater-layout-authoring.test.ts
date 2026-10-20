import { describe, expect, it } from 'vitest';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cloneWidgets, createDocument, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { applyAdaptiveWidgetEdits, createAdaptiveView } from '../src/model/adaptive';
import { getResizeItemTargets, RepeaterLayoutEditor } from '../src/components/Inspector';
import { getStaticRepeaterLayout, widgetStyle, WidgetContent } from '../src/components/WidgetView';
import type { Action, Interaction, RepeaterData, Widget } from '../src/model/types';

const interaction = (event: Interaction['event'], actions: Omit<Action, 'id'>[] = []): Interaction => ({ id: uid(), event, name: event, enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: uid() })) });
function fixture() {
  const doc = createDocument(), repeater = createWidget('repeater');
  // This fixture represents a saved legacy object, not the current new-widget defaults.
  const template = repeater.repeater!.template;
  repeater.width = 280; repeater.height = 180;
  repeater.repeater = { columns: ['Name'], rows: [{ Name: 'Item 1' }, { Name: 'Item 2' }, { Name: 'Item 3' }], template, itemHeight: 48, gap: 8 };
  doc.pages[0].widgets = [repeater];
  return { doc, repeater };
}
const layout: Partial<RepeaterData> = { layout: 'horizontal', itemWidth: 120.5, itemHeight: 0, wrap: 3, horizontalGap: 0, verticalGap: 4.5, fitToContent: true };

describe('repeater layout document carriers', () => {
  it('does not add opt-in fields to explicitly saved legacy objects', () => {
    const { doc, repeater } = fixture();
    expect(repeater.repeater).toMatchObject({ itemHeight: 48, gap: 8 });
    expect(Object.keys(repeater.repeater!).sort()).toEqual(['columns', 'gap', 'itemHeight', 'rows', 'template']);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('round-trips explicit layout, zero sizes, fractional spacing and all upper bounds without normalization', () => {
    const { doc, repeater } = fixture(); Object.assign(repeater.repeater!, layout);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    Object.assign(repeater.repeater!, { layout: 'vertical', itemWidth: 10000, itemHeight: 10000, wrap: 10000, horizontalGap: 10000, verticalGap: 10000, fitToContent: false });
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    Object.assign(repeater.repeater!, { itemWidth: 0, itemHeight: 0.5, wrap: 1 }); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it.each(['itemWidth', 'itemHeight', 'horizontalGap', 'verticalGap'] as const)('rejects invalid %s values without coercion', field => {
    for (const value of [-1, 10000.1, NaN, Infinity, '0', null, false, {}, []]) {
      const { doc, repeater } = fixture(); Object.assign(repeater.repeater!, { [field]: value });
      expect(() => parseDocument(JSON.stringify(doc)), `${field}: ${String(value)}`).toThrow(field);
    }
  });

  it('rejects noninteger wrap, unknown direction, wrong fit type, extra and dangerous keys', () => {
    for (const [field, values] of [['wrap', [0, -1, 1.5, 10001, '2', null]], ['layout', ['', 'legacy', 'Vertical', true, null]], ['fitToContent', [0, 'false', null]]] as const) {
      for (const value of values) { const { doc, repeater } = fixture(); Object.assign(repeater.repeater!, { [field]: value }); expect(() => parseDocument(JSON.stringify(doc))).toThrow(field); }
    }
    for (const field of ['beforeItemLoad', 'columnCount', '__proto__', 'constructor']) {
      const { doc, repeater } = fixture(); Object.defineProperty(repeater.repeater!, field, { value: true, enumerable: true }); expect(() => parseDocument(JSON.stringify(doc))).toThrow(/unknown field|unsafe key/);
    }
  });

  it('allows itemResize only on repeaters, including nested and component definitions', () => {
    const { doc, repeater } = fixture(); repeater.interactions = [interaction('itemResize')];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    const pageCopy = structuredClone(doc); pageCopy.pages[0].interactions = [interaction('itemResize')]; expect(() => parseDocument(JSON.stringify(pageCopy))).toThrow('only on a repeater');
    for (const type of ['button', 'panel', 'text'] as const) {
      const invalid = createWidget(type); invalid.interactions = [interaction('itemResize')]; repeater.repeater!.template = [invalid];
      expect(() => parseDocument(JSON.stringify(doc))).toThrow('only on a repeater');
    }
    repeater.repeater!.template = []; const component = createComponent([repeater]); doc.components = [component];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    component.widgets[0].type = 'box'; expect(() => parseDocument(JSON.stringify(doc))).toThrow('only on a repeater');
  });

  it('preserves resizeItem optional dimensions, zero and negative inputs, rejecting invalid numeric types', () => {
    const { doc, repeater } = fixture(); repeater.interactions = [interaction('itemLoad', [
      { type: 'resizeItem', targetId: repeater.id }, { type: 'resizeItem', targetId: repeater.id, x: 0 },
      { type: 'resizeItem', targetId: repeater.id, y: -5.5 }, { type: 'resizeItem', targetId: repeater.id, x: -100000, y: 100000 },
    ])];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    for (const value of [NaN, Infinity, '0', null, -100001, 100001]) {
      Object.assign(repeater.interactions[0].actions[0], { x: value }); expect(() => parseDocument(JSON.stringify(doc))).toThrow('.x');
    }
  });

  it('requires an existing resizeItem target to be a repeater without rejecting unmatched source or deleted targets', () => {
    const { doc, repeater } = fixture(), button = createWidget('button'); doc.pages[0].widgets.push(button);
    button.interactions = [interaction('click', [{ type: 'resizeItem', targetId: repeater.id, x: 20 }])];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc); // Runtime decides whether the event has an item context.
    for (const type of ['button', 'panel', 'input'] as const) {
      const target = createWidget(type); doc.pages[0].widgets.push(target); button.interactions[0].actions[0].targetId = target.id;
      expect(() => parseDocument(JSON.stringify(doc))).toThrow('repeater target');
    }
    button.interactions[0].actions[0].targetId = 'deleted-repeater'; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    delete button.interactions[0].actions[0].targetId; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('remaps nested resizeItem targets and carries layout through component publication independently', () => {
    const { doc, repeater } = fixture(); Object.assign(repeater.repeater!, layout);
    const child = repeater.repeater!.template[0]; child.interactions = [interaction('click', [{ type: 'resizeItem', targetId: repeater.id, x: 0, y: -10 }])];
    repeater.interactions = [interaction('itemResize', [{ type: 'resizeItem', targetId: repeater.id, y: 55 }])];
    const [copy] = cloneWidgets([repeater]); expect(copy.repeater!.template[0].interactions[0].actions[0].targetId).toBe(copy.id);
    expect(copy.interactions[0].actions[0].targetId).toBe(copy.id); copy.repeater!.wrap = 9; expect(repeater.repeater!.wrap).toBe(3);
    const component = createComponent([repeater]), a = createComponentInstance(component), b = createComponentInstance(component, 500, 50);
    doc.components = [component]; doc.pages[0].widgets = [a, b]; a.states![0].widgets[0].repeater!.wrap = 4;
    const next = applyComponentInstanceChanges(doc, a.id); expect(next.components[0].widgets[0].repeater!.wrap).toBe(4);
    for (const instance of next.pages[0].widgets) {
      const row = instance.states![0].widgets[0]; expect(row.repeater!.wrap).toBe(4); expect(row.repeater!.template[0].interactions[0].actions[0]).toMatchObject({ type: 'resizeItem', targetId: row.id, x: 0, y: -10 });
      expect(row.interactions[0]).toMatchObject({ event: 'itemResize', actions: [{ targetId: row.id }] });
    }
    expect(b.states![0].widgets[0].repeater!.wrap).toBe(3); expect(parseDocument(serializeDocument(next))).toEqual(next);
  });

  it('keeps repeater layout shared in adaptive edits without introducing unsupported structural overrides', () => {
    const { doc, repeater } = fixture(); let page = createAdaptiveView(doc.pages[0]);
    const edited = structuredClone(page.widgets); Object.assign(edited[0].repeater!, layout);
    page = applyAdaptiveWidgetEdits(page, page.adaptiveViews[0].id, edited); expect(page.widgets[0].repeater).toMatchObject(layout); expect(page.adaptiveViews[0].overrides).toEqual({});
    expect(repeater.repeater).not.toHaveProperty('layout');
    page.adaptiveViews[0].overrides[repeater.id] = { repeater: layout } as never; doc.pages[0] = page;
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('unknown field repeater');
  });
});

function control(tree: ReactNode, field: string, value: string): ReactElement<Record<string, unknown>> {
  const visit = (node: ReactNode): ReactElement<Record<string, unknown>> | undefined => {
    if (Array.isArray(node)) { for (const child of node) { const result = visit(child); if (result) return result; } }
    if (!isValidElement<Record<string, unknown>>(node)) return;
    if (node.props[field] === value) return node;
    return visit(node.props.children as ReactNode);
  };
  const found = visit(tree); if (!found) throw new Error(`Control not found: ${field}=${value}`); return found;
}

describe('repeater layout authoring controls', () => {
  it('limits resize targets to self/enclosing repeater scopes across panels, states and nested repeaters', () => {
    const { doc, repeater } = fixture(), panel = createWidget('panel'), inner = createWidget('repeater'), outside = createWidget('button');
    panel.states![0].widgets = [inner]; repeater.repeater!.template = [panel]; doc.pages[0].widgets.push(outside);
    expect(getResizeItemTargets(doc.pages[0], repeater)).toEqual([repeater]);
    expect(getResizeItemTargets(doc.pages[0], panel)).toEqual([repeater]);
    expect(getResizeItemTargets(doc.pages[0], inner.repeater!.template[0])).toEqual([repeater, inner]);
    expect(getResizeItemTargets(doc.pages[0], inner)).toEqual([repeater, inner]);
    expect(getResizeItemTargets(doc.pages[0], outside)).toEqual([]); expect(getResizeItemTargets(doc.pages[0])).toEqual([]);
  });

  it('offers explicit legacy opt-in and exposes inherited width/gaps without saving defaults', () => {
    const { repeater } = fixture(), initial = structuredClone(repeater);
    let tree = RepeaterLayoutEditor({ widget: repeater, onChange: patch => Object.assign(repeater, patch) });
    expect(renderToStaticMarkup(tree)).toContain('Legacy (stored outer size)'); expect(repeater).toEqual(initial);
    (control(tree, 'aria-label', 'Repeater layout').props.onChange as (event: unknown) => void)({ target: { value: 'horizontal' } });
    expect(repeater.repeater).toEqual({ ...initial.repeater, layout: 'horizontal' });
    tree = RepeaterLayoutEditor({ widget: repeater, onChange: patch => Object.assign(repeater, patch) });
    expect(control(tree, 'label', 'Item width').props.value).toBe(repeater.width);
    expect(control(tree, 'label', 'Horizontal gap').props.value).toBe(repeater.repeater!.gap);
    expect(control(tree, 'label', 'Vertical gap').props.value).toBe(repeater.repeater!.gap);
    expect(repeater.repeater).not.toHaveProperty('itemWidth'); expect(repeater.repeater).not.toHaveProperty('horizontalGap');
    expect(renderToStaticMarkup(tree)).toContain('Wrap after a fixed number of items');
  });

  it('authors wrap and fit, removes optional fields on reset and restores a legacy roundtrip', () => {
    const { doc, repeater } = fixture(), original = structuredClone(repeater.repeater!); repeater.repeater!.layout = 'vertical';
    const change = (field: string, value: string, payload: unknown) => {
      const tree = RepeaterLayoutEditor({ widget: repeater, onChange: patch => Object.assign(repeater, patch) });
      (control(tree, field, value).props.onChange as (event: unknown) => void)(payload);
    };
    change('aria-label', 'Wrap repeater items', { target: { checked: true } }); expect(repeater.repeater!.wrap).toBe(2);
    change('label', 'Items before wrap', 3.5); expect(repeater.repeater!.wrap).toBe(3);
    change('aria-label', 'Fit repeater items to content', { target: { checked: true } });
    change('label', 'Item width', 0); change('label', 'Horizontal gap', 5); change('label', 'Vertical gap', 0);
    expect(repeater.repeater).toMatchObject({ layout: 'vertical', wrap: 3, fitToContent: true, itemWidth: 0, horizontalGap: 5, verticalGap: 0 });
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    change('aria-label', 'Wrap repeater items', { target: { checked: false } }); expect(repeater.repeater).not.toHaveProperty('wrap');
    change('aria-label', 'Repeater layout', { target: { value: 'legacy' } }); expect(repeater.repeater).toEqual(original);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
});

describe('initial static repeater layout', () => {
  function arranged() {
    const { repeater } = fixture(); Object.assign(repeater.repeater!, { layout: 'vertical', itemWidth: 100, itemHeight: 20, horizontalGap: 10, verticalGap: 5, wrap: 2 });
    repeater.repeater!.rows = ['A', 'B', 'C', 'D', 'E'].map(Name => ({ Name }));
    return repeater;
  }

  it.each([
    { direction: 'vertical' as const, width: 320, height: 45, positions: [[0, 0], [0, 25], [110, 0], [110, 25], [220, 0]] },
    { direction: 'horizontal' as const, width: 210, height: 70, positions: [[0, 0], [110, 0], [0, 25], [110, 25], [0, 50]] },
  ])('positions $direction groups with axis-specific gaps and uniform authoring bounds', ({ direction, width, height, positions }) => {
    const repeater = arranged(); repeater.repeater!.layout = direction;
    const result = getStaticRepeaterLayout(repeater)!;
    expect(result).toMatchObject({ width, height }); expect(result.rows.map(row => [row.x, row.y])).toEqual(positions);
    expect(result.rows.every(row => row.width === 100 && row.height === 20)).toBe(true);
    expect(widgetStyle(repeater)).toMatchObject({ width, height });
    expect(widgetStyle(repeater, true)).toMatchObject({ width: repeater.width, height: repeater.height });
    const markup = renderToStaticMarkup(createElement(WidgetContent, { widget: repeater }));
    expect(markup).toContain('position:absolute;left:110px;'); expect(markup).toContain('width:100px;height:20px;margin-bottom:0;border:0;box-sizing:border-box');
  });

  it('uses exactly the initial visible pagination rows and preserves fractional-index errors', () => {
    const repeater = arranged(); repeater.repeater!.pagination = { itemsPerPage: 2, startPage: 2 };
    expect(getStaticRepeaterLayout(repeater)).toMatchObject({ width: 100, height: 45 }); expect(getStaticRepeaterLayout(repeater)!.rows.map(row => row.data.Name)).toEqual(['C', 'D']);
    repeater.repeater!.pagination = { itemsPerPage: 2.5, startPage: 1 };
    expect(getStaticRepeaterLayout(repeater)!.rows.map(row => row.data.Name)).toEqual(['A', 'B', 'C']);
    expect(getStaticRepeaterLayout(repeater)).toMatchObject({ width: 210, height: 45 });
    repeater.repeater!.pagination = { itemsPerPage: 3, startPage: 1.5 };
    expect(getStaticRepeaterLayout(repeater)!.error).toContain('whole row index (1.5)');
    expect(widgetStyle(repeater)).toMatchObject({ width: repeater.width, height: repeater.height });
    expect(renderToStaticMarkup(createElement(WidgetContent, { widget: repeater }))).toContain('role="alert"');
  });

  it('preserves inherited dimensions and legacy styling when no opt-in fields exist', () => {
    const { repeater } = fixture(), old = structuredClone(repeater);
    expect(getStaticRepeaterLayout(repeater)).toBeUndefined(); expect(widgetStyle(repeater)).toMatchObject({ width: 280, height: 180 });
    expect(renderToStaticMarkup(createElement(WidgetContent, { widget: repeater }))).toContain('height:48px;margin-bottom:8px');
    repeater.repeater!.layout = 'horizontal';
    expect(getStaticRepeaterLayout(repeater)).toMatchObject({ width: 856, height: 48 });
    expect(getStaticRepeaterLayout(repeater)!.rows.map(row => row.x)).toEqual([0, 288, 576]);
    delete repeater.repeater!.layout; expect(repeater).toEqual(old);
  });

  it('handles zero dimensions and empty wrap bounds without executing fit or events', () => {
    const repeater = arranged(); Object.assign(repeater.repeater!, { itemWidth: 0, itemHeight: 0, fitToContent: true });
    repeater.interactions = [interaction('itemLoad', [{ type: 'resizeItem', targetId: repeater.id, x: 999, y: 999 }])];
    const initial = structuredClone(repeater);
    expect(getStaticRepeaterLayout(repeater)).toMatchObject({ width: 20, height: 5 }); expect(repeater).toEqual(initial);
    repeater.repeater!.rows = []; expect(getStaticRepeaterLayout(repeater)).toMatchObject({ width: 0, height: 0, rows: [] });
    delete repeater.repeater!.wrap; repeater.repeater!.itemWidth = 100; repeater.repeater!.itemHeight = 20;
    expect(getStaticRepeaterLayout(repeater)).toMatchObject({ width: 100, height: 0 });
    repeater.repeater!.layout = 'horizontal'; expect(getStaticRepeaterLayout(repeater)).toMatchObject({ width: 0, height: 20 });
  });
});
