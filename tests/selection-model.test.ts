import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cloneWidgets, createDocument, createWidget, parseDocument, parseWidgetStylePatch, resolveSelectedStyle, serializeDocument, uid } from '../src/model/document';
import { applyAdaptiveWidgetEdits, createAdaptiveView } from '../src/model/adaptive';
import { WidgetContent, widgetStyle } from '../src/components/WidgetView';
import { Inspector } from '../src/components/Inspector';
import type { Widget } from '../src/model/types';

function withWidget(widget: Widget) { const doc = createDocument(); doc.pages[0].widgets = [widget]; return doc; }
describe('selection authoring model', () => {
  it('preserves absent fields and existing checked documents without migration', () => {
    for (const type of ['box', 'checkbox', 'radio'] as const) {
      const doc = withWidget(createWidget(type)); if (type !== 'box') doc.pages[0].widgets[0].checked = true;
      expect(parseDocument(serializeDocument(doc))).toEqual(doc);
      for (const field of ['selected', 'selectionGroup', 'radioGroup', 'selectedStyle']) expect(doc.pages[0].widgets[0]).not.toHaveProperty(field);
    }
  });

  it('round-trips selected styles, distinct group names and all selection events/actions', () => {
    const widget = createWidget('box'); widget.selected = true; widget.selectionGroup = '导航 tabs';
    widget.selectedStyle = { fill: '#335577', stroke: '#ff0000', color: '#ffffff', textPadding: [1, 2, 3, 4], verticalAlign: 'middle', lineHeight: 'normal', cornerRadii: [1, 2, 3, 4] };
    widget.interactions = (['selectedChange', 'select', 'unselect'] as const).map((event, index) => ({ id: uid(), event, name: event, enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setSelected', targetId: widget.id, value: ['true', 'false', 'toggle'][index] }] }));
    const doc = withWidget(widget), radio = createWidget('radio'); radio.checked = true; radio.radioGroup = widget.selectionGroup; radio.selectedStyle = { color: '#ff0000' }; doc.pages[0].widgets.push(radio);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('rejects invalid state and crossed group namespaces', () => {
    const validate = (patch: Record<string, unknown>, type: Widget['type'] = 'box') => parseDocument(JSON.stringify(withWidget({ ...createWidget(type), ...patch })));
    for (const selected of ['true', 1, null, {}]) expect(() => validate({ selected })).toThrow('selected');
    for (const selectionGroup of ['', '  ', null, 7, 'x'.repeat(257), 'bad\nname', 'constructor']) expect(() => validate({ selectionGroup })).toThrow('selectionGroup');
    for (const type of ['checkbox', 'radio'] as const) {
      expect(() => validate({ selected: true }, type)).toThrow('use checked');
      expect(() => validate({ selectionGroup: 'group' }, type)).toThrow('non-checkable');
    }
    for (const type of ['box', 'checkbox', 'input'] as const) expect(() => validate({ radioGroup: 'radios' }, type)).toThrow('only supported on radio');
    expect(() => validate({ radioGroup: '' }, 'radio')).toThrow('radioGroup');
  });

  it('validates selected style through the same strict partial-style boundary', () => {
    const invalid = [null, [], { fill: 'url(https://example.com/x)' }, { textAlign: 'up' }, { radius: -1 }, { textPadding: [1, 2] }, { lineHeight: '2' }, { unknown: 1 }, JSON.parse('{"__proto__":{}}')];
    for (const selectedStyle of invalid) expect(() => parseDocument(JSON.stringify(withWidget({ ...createWidget('box'), selectedStyle } as Widget)))).toThrow();
    expect(parseWidgetStylePatch({ textPadding: [0, 2, 4, 6], verticalAlign: 'bottom', lineHeight: 1.25 })).toEqual({ textPadding: [0, 2, 4, 6], verticalAlign: 'bottom', lineHeight: 1.25 });
    expect(() => parseWidgetStylePatch({ fontSize: 1000 })).toThrow('fontSize');
  });

  it('rejects non-string selection values and incomplete or multiple expressions', () => {
    const widget = createWidget('button'); widget.interactions = [{ id: uid(), event: 'click', name: 'Select', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setSelected', targetId: widget.id }] }];
    for (const value of [undefined, null, true, '', 'TRUE', 'FALSE', '[[]]', '[[ ]]', 'prefix [[Flag]]', '[[Flag]] suffix', '[[A]][[B]]', '[[[Flag]]]', 'selected']) {
      const doc = withWidget(structuredClone(widget)); Object.assign(doc.pages[0].widgets[0].interactions[0].actions[0], { value });
      expect(() => parseDocument(JSON.stringify(doc))).toThrow('expected one of true, false, toggle');
    }
  });

  it('accepts one nonempty complete authored selection expression and preserves it on clone/save', () => {
    const widget = createWidget('button');
    for (const value of ['[[Flag]]', '[[Item.isMarked]]', '[[ 1 > 0 ]]', "[['true']]"]) {
      widget.interactions = [{ id: uid(), event: 'click', name: 'Select expression', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setSelected', targetId: widget.id, value }] }];
      const doc = withWidget(widget); expect(parseDocument(serializeDocument(doc))).toEqual(doc); expect(cloneWidgets([widget])[0].interactions[0].actions[0].value).toBe(value);
    }
  });

  it('clones selected style without aliases and remaps internal selection action targets', () => {
    const panel = createWidget('panel'), child = createWidget('box'); child.selected = true; child.selectionGroup = 'tabs'; child.selectedStyle = { textPadding: [1, 2, 3, 4] };
    child.interactions = [{ id: uid(), event: 'select', name: 'Self toggle', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setSelected', targetId: child.id, value: 'toggle' }] }];
    panel.states![0].widgets = [child]; const [copy] = cloneWidgets([panel]), clone = copy.states![0].widgets[0];
    expect(clone.selectionGroup).toBe('tabs'); expect(clone.selected).toBe(true); expect(clone.interactions[0].actions[0].targetId).toBe(clone.id);
    clone.selectedStyle!.textPadding![0] = 99; expect(child.selectedStyle.textPadding![0]).toBe(1);
  });

  it('shares selection flags and group while keeping adaptive selected paint local', () => {
    const widget = createWidget('box'); let page = createAdaptiveView(withWidget(widget).pages[0]); const visible = structuredClone(page.widgets);
    Object.assign(visible[0], { selected: true, selectionGroup: 'tabs', selectedStyle: { fill: '#123456' } }); visible[0].x = 200;
    page = applyAdaptiveWidgetEdits(page, page.adaptiveViews[0].id, visible);
    expect(page.widgets[0]).toMatchObject({ selected: true, selectionGroup: 'tabs' }); expect(page.widgets[0].selectedStyle).toBeUndefined();
    expect(page.adaptiveViews[0].overrides[widget.id]).toEqual({ x: 200, stateStyles: { selected: { fill: '#123456' } } });
  });

  it('renders initial selection statically and respects resolved runtime styles without a second overlay', () => {
    const widget = createWidget('text'); widget.selected = true; widget.selectedStyle = { fill: '#123456', color: '#ff0000', textPadding: [1, 2, 3, 4], lineHeight: 2 };
    expect(widgetStyle(widget).backgroundColor).toBe('#123456'); expect(widget.style.fill).toBe('transparent');
    expect(renderToStaticMarkup(createElement(WidgetContent, { widget }))).toContain('padding:1px 2px 3px 4px');
    const resolved = { ...widget, style: { ...widget.style, fill: '#abcdef', textPadding: [9, 8, 7, 6] as [number, number, number, number] } };
    expect(widgetStyle(resolved, true).backgroundColor).toBe('#abcdef');
    expect(renderToStaticMarkup(createElement(WidgetContent, { widget: resolved, resolved: true }))).toContain('padding:9px 8px 7px 6px');
    const radio = createWidget('radio'); radio.selectedStyle = { color: '#ff0000' }; expect(resolveSelectedStyle(radio).color).not.toBe('#ff0000'); radio.checked = true; expect(resolveSelectedStyle(radio).color).toBe('#ff0000');
  });

  it('offers separate selection group controls and fill/text/border overrides', () => {
    const render = (widget: Widget) => renderToStaticMarkup(createElement(Inspector, { document: withWidget(widget), page: withWidget(widget).pages[0], widget, onWidgetChange: () => {}, onPageChange: () => {} }));
    const box = createWidget('box'); box.selectedStyle = {}; const markup = render(box);
    for (const name of ['Selected by default', 'Selection group', 'Custom selected style', 'Selected fill', 'Selected text color', 'Selected border']) expect(markup).toContain(`aria-label="${name}"`);
    const radio = render(createWidget('radio')); expect(radio).toContain('aria-label="Radio group"'); expect(radio).not.toContain('aria-label="Selection group"'); expect(radio).toContain('aria-label="Checked by default"');
    expect(render(createWidget('checkbox'))).not.toContain('aria-label="Radio group"');
  });

  it('rejects unsupported setSelected container targets, including page and nested cases', () => {
    for (const type of ['panel', 'repeater'] as const) {
      const target = createWidget(type), button = createWidget('button'), doc = withWidget(target);
      const interaction = { id: uid(), event: 'click' as const, name: 'Select container', enabled: true, conditions: [], conditionMode: 'all' as const, actions: [{ id: uid(), type: 'setSelected' as const, targetId: target.id, value: 'true' }] };
      doc.pages[0].interactions = [interaction]; expect(() => parseDocument(JSON.stringify(doc))).toThrow('does not support panel or repeater');
      doc.pages[0].interactions = []; button.interactions = [interaction]; const wrapper = createWidget('panel'); wrapper.states![0].widgets = [button]; doc.pages[0].widgets.push(wrapper);
      expect(() => parseDocument(JSON.stringify(doc))).toThrow('does not support panel or repeater');
    }
  });

  it('round-trips panel fit without changing static canvas dimensions or allowing non-panels', () => {
    const panel = createWidget('panel'); panel.fitToContent = true; panel.width = 100; panel.height = 50;
    panel.states![0].widgets = [createWidget('text', 150, 200)]; const doc = withWidget(panel);
    expect(parseDocument(serializeDocument(doc))).toEqual(doc); expect(cloneWidgets([panel])[0].fitToContent).toBe(true);
    expect(widgetStyle(panel)).toMatchObject({ width: 100, height: 50 });
    const markup = renderToStaticMarkup(createElement(Inspector, { document: doc, page: doc.pages[0], widget: panel, onWidgetChange: () => {}, onPageChange: () => {} }));
    expect(markup).toContain('aria-label="Fit to content"'); expect(markup).toContain('editor keeps the stored canvas size');
    for (const type of ['box', 'repeater', 'radio'] as const) expect(() => parseDocument(JSON.stringify(withWidget({ ...createWidget(type), fitToContent: true })))).toThrow('only supported on panel');
    for (const fitToContent of ['true', null, 1]) expect(() => parseDocument(JSON.stringify(withWidget({ ...panel, fitToContent } as unknown as Widget)))).toThrow('fitToContent');
  });
});
