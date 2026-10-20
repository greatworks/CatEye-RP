import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { applyAdaptiveWidgetEdits, clearAdaptiveOverrides, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { cloneWidgets, createDocument, createWidget, defaultStyle, mergeWidgetStyle, parseDocument, parseWidgetStylePatch, resolveInteractionStyle, serializeDocument, uid } from '../src/model/document';
import type { GradientFill, WidgetStyle } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';

const effects = ['mouseOverStyle', 'mouseDownStyle', 'focusedStyle', 'selectedStyle', 'errorStyle', 'hintStyle', 'disabledStyle'] as const;
const linear = (): GradientFill => ({ type: 'linear', start: { x: -0.25, y: 0.1 }, end: { x: 1.2, y: 0.8 }, stops: [{ offset: 0, color: '#ff000080' }, { offset: 0.4, color: 'rgba(0, 255, 0, 0.4)' }, { offset: 0.4, color: 'blue' }, { offset: 1, color: 'transparent' }] });
const radial = (): GradientFill => ({ type: 'radial', center: { x: 0.4, y: 0.6 }, axis1: { x: 0.45, y: 1.55 }, axis2: { x: -0.08, y: 0.62 }, stops: [{ offset: 0, color: '#abcdef' }, { offset: 1, color: '#00000000' }] });
function fixture() { const doc = createDocument(), widget = createWidget('box'); doc.caseSelection = 'never'; doc.pages[0].widgets = [widget]; return { doc, widget }; }

describe('atomic gradient fill documents', () => {
  it('keeps legacy projects unchanged and does not synthesize a gradient', () => {
    const { doc } = fixture(); doc.styles = [{ id: uid(), name: 'Legacy', style: defaultStyle() }];
    const json = serializeDocument(doc); expect(serializeDocument(parseDocument(json))).toBe(json);
    expect(defaultStyle()).not.toHaveProperty('fillGradient');
  });

  it('round-trips normalized points, duplicate stops and alpha in every saved style carrier', () => {
    const { doc, widget } = fixture(); widget.type = 'input'; widget.style.fillGradient = linear();
    for (const effect of effects) widget[effect] = { fillGradient: radial() };
    widget.interactions = [{ id: uid(), event: 'click', name: 'Paint', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: widget.id, style: { fillGradient: linear() } }] }];
    doc.styles = [{ id: uid(), name: 'Gradient', style: { ...defaultStyle(), fillGradient: radial() } }];
    doc.pages[0] = createAdaptiveView(doc.pages[0]); doc.pages[0].adaptiveViews[0].overrides[widget.id] = { style: { fillGradient: radial() } };
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(parseWidgetStylePatch({ fillGradient: linear() })).toEqual({ fillGradient: linear() });
    expect(parseWidgetStylePatch({ fillGradient: linear() }).fillGradient!.stops.map(stop => stop.offset)).toEqual([0, 0.4, 0.4, 1]);
  });

  it('rejects incomplete, unbounded or executable gradient values', () => {
    const good = linear();
    const invalid = [null, false, [], 'linear-gradient(red,blue)', {}, { ...good, type: 'conic' }, { ...good, unexpected: true }, { ...good, start: { x: 0 } }, { ...good, start: { x: 0, y: 0, z: 0 } }, { ...good, start: { x: 1001, y: 0 } }, { ...good, end: { x: 0, y: Infinity } }, { ...good, end: { x: '0', y: 1 } }, { ...good, stops: [] }, { ...good, stops: [{ offset: 0, color: 'red' }] }, { ...good, stops: Array.from({ length: 101 }, () => ({ offset: 0, color: 'red' })) }, { ...radial(), axis2: undefined }, { ...radial(), start: { x: 0, y: 0 } }];
    for (const value of invalid) expect(() => parseWidgetStylePatch({ fillGradient: value }), JSON.stringify(value)).toThrow('fillGradient');
    for (const color of ['url(https://example.com)', 'red;display:none', 'var(--external)', 'inherit', 'notacolor', '#12345', 'rgb(1)']) expect(() => parseWidgetStylePatch({ fillGradient: { ...good, stops: [{ offset: 0, color }, { offset: 1, color: '#000' }] } }), color).toThrow('color');
    for (const offset of [-0.001, 1.001, NaN, '0', null]) expect(() => parseWidgetStylePatch({ fillGradient: { ...good, stops: [{ offset, color: 'red' }, { offset: 1, color: 'blue' }] } })).toThrow('offset');
    expect(() => parseWidgetStylePatch({ fillGradient: { ...good, stops: [{ offset: 0.6, color: 'red' }, { offset: 0.5, color: 'blue' }] } })).toThrow('nondecreasing');
    expect(() => parseWidgetStylePatch({ fillGradient: { ...good, stops: [{ offset: 0, color: 'red', opacity: 1 }, { offset: 1, color: 'blue' }] } })).toThrow('opacity');
  });

  it('validates effects, actions, views and presets at the same boundary', () => {
    for (const carrier of ['effect', 'action', 'view', 'preset']) {
      const { doc, widget } = fixture(); const invalid = { fillGradient: { ...linear(), stops: [{ offset: 0, color: 'notacolor' }, { offset: 1, color: 'blue' }] } };
      if (carrier === 'effect') widget.selectedStyle = invalid;
      if (carrier === 'action') widget.interactions = [{ id: uid(), event: 'click', name: 'Bad', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', style: invalid }] }];
      if (carrier === 'view') { doc.pages[0] = createAdaptiveView(doc.pages[0]); doc.pages[0].adaptiveViews[0].overrides[widget.id] = { style: invalid }; }
      if (carrier === 'preset') doc.styles = [{ id: uid(), name: 'Bad', style: { ...defaultStyle(), ...invalid } }];
      expect(() => parseDocument(JSON.stringify(doc)), carrier).toThrow('fillGradient.stops[0].color');
    }
  });

  it('replaces complete gradients and lets solid paint clear one without altering unrelated styles', () => {
    const base: WidgetStyle = { ...defaultStyle(), fillGradient: linear() }, before = structuredClone(base);
    expect(mergeWidgetStyle(base, { color: 'red' }).fillGradient).toEqual(linear());
    expect(mergeWidgetStyle(base, { fill: base.fill })).not.toHaveProperty('fillGradient');
    expect(mergeWidgetStyle(base, { fillGradient: radial() }).fillGradient).toEqual(radial());
    expect(mergeWidgetStyle(base, { fill: 'black', fillGradient: linear() })).toMatchObject({ fill: 'black', fillGradient: linear() });
    expect(mergeWidgetStyle(base, { fill: 'transparent' })).toMatchObject({ fill: 'transparent', color: base.color });
    expect(base).toEqual(before);
  });

  it('clears and restores the whole fill through ordered transient layers', () => {
    const { widget } = fixture(); widget.style.fillGradient = linear(); widget.mouseOverStyle = { fill: widget.style.fill }; widget.selectedStyle = { fillGradient: radial() }; widget.errorStyle = { fill: 'transparent' };
    const before = structuredClone(widget.style);
    expect(resolveInteractionStyle(widget, { mouseOver: true })).not.toHaveProperty('fillGradient');
    widget.selected = true; expect(resolveInteractionStyle(widget, { mouseOver: true }).fillGradient).toEqual(radial());
    widget.error = true; expect(resolveInteractionStyle(widget, { mouseOver: true })).not.toHaveProperty('fillGradient');
    widget.error = false; widget.selected = false; expect(resolveInteractionStyle(widget).fillGradient).toEqual(linear());
    expect(widget.style).toEqual(before);
  });

  it('compares gradient values independent of object key order in adaptive views', () => {
    const { doc, widget } = fixture(); widget.style.fillGradient = linear();
    let page = createAdaptiveView(doc.pages[0]); const id = page.adaptiveViews[0].id;
    const visible = structuredClone(resolveAdaptiveWidgets(page, id)), paint = visible[0].style.fillGradient!;
    if (paint.type !== 'linear') throw Error('Expected linear fixture');
    visible[0].style.fillGradient = { stops: paint.stops.map(stop => ({ color: stop.color, offset: stop.offset })), end: { y: paint.end.y, x: paint.end.x }, start: { y: paint.start.y, x: paint.start.x }, type: 'linear' };
    page = applyAdaptiveWidgetEdits(page, id, visible); expect(page.adaptiveViews[0].overrides).toEqual({});
    visible[0].style.fillGradient = radial(); page = applyAdaptiveWidgetEdits(page, id, visible);
    expect(page.adaptiveViews[0].overrides[widget.id].style).toEqual({ fillGradient: radial() });
    expect(page.widgets[0].style.fillGradient).toEqual(linear());
    expect(resolveAdaptiveWidgets(page, id)[0].style.fillGradient).toEqual(radial());
  });

  it('persists an identical-color solid reset and preserves a gradient alongside a fallback change', () => {
    const { doc, widget } = fixture(); widget.style.fillGradient = linear();
    let page = createAdaptiveView(doc.pages[0]); const id = page.adaptiveViews[0].id;
    let visible = structuredClone(resolveAdaptiveWidgets(page, id)); delete visible[0].style.fillGradient;
    page = applyAdaptiveWidgetEdits(page, id, visible);
    expect(page.adaptiveViews[0].overrides[widget.id].style).toEqual({ fill: widget.style.fill });
    expect(resolveAdaptiveWidgets(page, id)[0].style).not.toHaveProperty('fillGradient');
    page = applyAdaptiveWidgetEdits(page, id, structuredClone(resolveAdaptiveWidgets(page, id)));
    doc.pages[0] = page; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    page = clearAdaptiveOverrides(page, id); visible = structuredClone(resolveAdaptiveWidgets(page, id)); visible[0].style.fill = '#abcdef';
    page = applyAdaptiveWidgetEdits(page, id, visible);
    expect(page.adaptiveViews[0].overrides[widget.id].style).toEqual({ fill: '#abcdef', fillGradient: linear() });
    expect(resolveAdaptiveWidgets(page, id)[0].style.fillGradient).toEqual(linear());
    expect(resolveAdaptiveWidgets(clearAdaptiveOverrides(page, id), id)[0].style).toEqual(widget.style);
  });

  it('deep-copies stop arrays and points across copies and component instances', () => {
    const { doc, widget } = fixture(); widget.style.fillGradient = radial(); widget.selectedStyle = { fillGradient: linear() };
    const [copy] = cloneWidgets([widget]); copy.style.fillGradient!.stops[0].color = 'orange'; copy.selectedStyle!.fillGradient!.stops[0].offset = 0.1;
    expect(widget.style.fillGradient).toEqual(radial()); expect(widget.selectedStyle.fillGradient).toEqual(linear());
    const component = createComponent([widget], 'Gradient card'); doc.components = [component];
    const a = createComponentInstance(component), b = createComponentInstance(component); doc.pages[0].widgets = [a, b];
    a.states![0].widgets[0].style.fillGradient!.stops[0].color = '#ff0000';
    const next = applyComponentInstanceChanges(doc, a.id);
    expect(next.pages[0].widgets[1].states![0].widgets[0].style.fillGradient!.stops[0].color).toBe('#ff0000');
    expect(doc.pages[0].widgets[1].states![0].widgets[0].style.fillGradient).toEqual(radial());
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });
});

for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} gradient runtime state`, () => {
  it('uses solid/action/state fill atomically without mutating design or geometry', async () => {
    const { doc, widget } = fixture(); widget.style.fillGradient = linear(); widget.selectedStyle = { fillGradient: radial() };
    const before = serializeDocument(doc);
    const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc) : createOfflineRuntime(doc);
    const paint = async (style: Partial<WidgetStyle>) => runtime.execute({ id: uid(), event: 'click', name: 'Paint', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: widget.id, style }] });
    try {
      await paint({ fill: widget.style.fill }); expect(runtime.widget(widget).style).not.toHaveProperty('fillGradient');
      await runtime.select(widget.id, true); expect(runtime.widget(widget).style.fillGradient).toEqual(radial());
      await runtime.select(widget.id, false); expect(runtime.widget(widget).style).not.toHaveProperty('fillGradient');
      await paint({ fillGradient: linear() }); await paint({ color: '#ff00ff' });
      expect(runtime.widget(widget).style.fillGradient).toEqual(linear()); expect(runtime.widget(widget).style.color).toBe('#ff00ff');
      expect(runtime.renderSize(widget)).toEqual({ width: widget.width, height: widget.height });
      expect(serializeDocument(doc)).toBe(before);
    } finally { runtime.dispose(); }
  });
});
