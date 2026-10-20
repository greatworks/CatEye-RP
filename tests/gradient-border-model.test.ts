import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { applyAdaptiveWidgetEdits, clearAdaptiveOverrides, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { cloneWidgets, createDocument, createWidget, defaultStyle, mergeWidgetStyle, parseDocument, parseRichText, parseWidgetStylePatch, resolveInteractionStyle, serializeDocument, uid } from '../src/model/document';
import type { GradientFill, WidgetStyle } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';

const linear = (): GradientFill => ({ type: 'linear', start: { x: -.25, y: .1 }, end: { x: 1.3, y: .8 }, stops: [{ offset: 0, color: '#ff000080' }, { offset: .5, color: 'red' }, { offset: .5, color: 'blue' }, { offset: 1, color: 'transparent' }] });
const radial = (): GradientFill => ({ type: 'radial', center: { x: .4, y: .6 }, axis1: { x: .7, y: 1.4 }, axis2: { x: -.3, y: .9 }, stops: [{ offset: 0, color: 'currentColor' }, { offset: 1, color: '#12345600' }] });
function fixture() { const doc = createDocument(), widget = createWidget('box'); doc.caseSelection = 'never'; doc.pages[0].widgets = [widget]; return { doc, widget }; }

describe('independent gradient border documents', () => {
  it('preserves existing solid/fill-gradient project bytes without adding border fields', () => {
    const { doc, widget } = fixture(); widget.style.fillGradient = linear();
    const json = serializeDocument(doc); expect(serializeDocument(parseDocument(json))).toBe(json);
    expect(defaultStyle()).not.toHaveProperty('strokeGradient');
  });

  it('round-trips simultaneous paints through every full and partial style carrier', () => {
    const { doc, widget } = fixture(); widget.type = 'input'; widget.style.fillGradient = linear(); widget.style.strokeGradient = radial();
    for (const effect of ['mouseOverStyle', 'mouseDownStyle', 'focusedStyle', 'selectedStyle', 'errorStyle', 'hintStyle', 'disabledStyle'] as const) widget[effect] = { fillGradient: radial(), strokeGradient: linear() };
    widget.interactions = [{ id: uid(), event: 'click', name: 'Paint both', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: widget.id, style: { fillGradient: linear(), strokeGradient: radial() } }] }];
    doc.styles = [{ id: uid(), name: 'Both paints', style: { ...defaultStyle(), fillGradient: radial(), strokeGradient: linear() } }];
    doc.pages[0] = createAdaptiveView(doc.pages[0]); doc.pages[0].adaptiveViews[0].overrides[widget.id] = { style: { strokeGradient: linear() } };
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(parseWidgetStylePatch({ strokeGradient: linear() }).strokeGradient!.stops.map(stop => stop.offset)).toEqual([0, .5, .5, 1]);
  });

  it('rejects invalid border geometry and executable colors through the shared paint boundary', () => {
    const good = linear();
    for (const bad of [null, false, [], {}, { ...good, type: 'conic' }, { ...good, start: { x: 0 } }, { ...good, end: { x: Infinity, y: 0 } }, { ...good, end: { x: 1001, y: 0 } }, { ...good, unknown: true }, { ...radial(), axis2: undefined }, { ...good, stops: [] }, { ...good, stops: [{ offset: 0, color: 'red' }] }, { ...good, stops: Array.from({ length: 101 }, () => ({ offset: 0, color: 'red' })) }])
      expect(() => parseWidgetStylePatch({ strokeGradient: bad })).toThrow('strokeGradient');
    for (const color of ['url(https://example.com)', 'red;display:none', 'var(--external)', 'inherit', 'notacolor', '#12345'])
      expect(() => parseWidgetStylePatch({ strokeGradient: { ...good, stops: [{ offset: 0, color }, { offset: 1, color: 'blue' }] } })).toThrow('strokeGradient.stops[0].color');
    expect(() => parseWidgetStylePatch({ strokeGradient: { ...good, stops: [{ offset: .7, color: 'red' }, { offset: .6, color: 'blue' }] } })).toThrow('nondecreasing');
    expect(() => parseWidgetStylePatch({ strokeGradient: { ...good, stops: [{ offset: 0, color: 'red', opacity: 1 }, { offset: 1, color: 'blue' }] } })).toThrow('opacity');
  });

  it('rejects invalid borders in saved effects, actions, adaptive overrides and presets', () => {
    for (const carrier of ['effect', 'action', 'view', 'preset']) {
      const { doc, widget } = fixture(); const invalid = { strokeGradient: { ...linear(), stops: [{ offset: 0, color: 'notacolor' }, { offset: 1, color: 'blue' }] } };
      if (carrier === 'effect') widget.selectedStyle = invalid;
      if (carrier === 'action') widget.interactions = [{ id: uid(), event: 'click', name: 'Bad', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', style: invalid }] }];
      if (carrier === 'view') { doc.pages[0] = createAdaptiveView(doc.pages[0]); doc.pages[0].adaptiveViews[0].overrides[widget.id] = { style: invalid }; }
      if (carrier === 'preset') doc.styles = [{ id: uid(), name: 'Bad', style: { ...defaultStyle(), ...invalid } }];
      expect(() => parseDocument(JSON.stringify(doc)), carrier).toThrow('strokeGradient.stops[0].color');
    }
  });

  it('keeps border paint outside text-run and hyperlink typography', () => {
    expect(() => parseRichText({ paragraphs: [{ runs: [{ text: 'Text', style: { strokeGradient: linear() } }] }] })).toThrow('strokeGradient');
  });

  it('clears only the explicitly supplied paint and preserves independent geometry', () => {
    const base: WidgetStyle = { ...defaultStyle(), fillGradient: linear(), strokeGradient: radial(), borderWidths: [1, 2, 3, 4], cornerRadii: [5, 6, 7, 8] }, before = structuredClone(base);
    const solidBorder = mergeWidgetStyle(base, { stroke: base.stroke }); expect(solidBorder).not.toHaveProperty('strokeGradient'); expect(solidBorder.fillGradient).toEqual(linear()); expect(solidBorder.borderWidths).toEqual(base.borderWidths);
    const solidFill = mergeWidgetStyle(base, { fill: base.fill }); expect(solidFill).not.toHaveProperty('fillGradient'); expect(solidFill.strokeGradient).toEqual(radial());
    const geometry = mergeWidgetStyle(base, { strokeWidth: 7, radius: 4, opacity: .5 }); expect(geometry.strokeGradient).toEqual(radial()); expect(geometry.fillGradient).toEqual(linear()); expect(geometry).not.toHaveProperty('borderWidths');
    expect(mergeWidgetStyle(base, { stroke: '#abcdef', strokeGradient: linear() })).toMatchObject({ stroke: '#abcdef', strokeGradient: linear(), fillGradient: linear() }); expect(base).toEqual(before);
  });

  it('resolves independent fill and border replacements through transient style layers', () => {
    const { widget } = fixture(); widget.style.fillGradient = linear(); widget.style.strokeGradient = radial(); const before = structuredClone(widget.style);
    widget.mouseOverStyle = { stroke: widget.style.stroke }; widget.selectedStyle = { strokeGradient: linear(), fill: 'transparent' }; widget.errorStyle = { stroke: 'transparent' }; widget.disabledStyle = { strokeGradient: radial() };
    expect(resolveInteractionStyle(widget, { mouseOver: true })).toMatchObject({ fillGradient: linear() }); expect(resolveInteractionStyle(widget, { mouseOver: true })).not.toHaveProperty('strokeGradient');
    widget.selected = true; expect(resolveInteractionStyle(widget, { mouseOver: true }).strokeGradient).toEqual(linear()); expect(resolveInteractionStyle(widget, { mouseOver: true })).not.toHaveProperty('fillGradient');
    widget.error = true; expect(resolveInteractionStyle(widget, { mouseOver: true })).not.toHaveProperty('strokeGradient'); widget.disabled = true; expect(resolveInteractionStyle(widget).strokeGradient).toEqual(radial());
    widget.selected = widget.error = widget.disabled = false; expect(resolveInteractionStyle(widget)).toEqual(before); expect(widget.style).toEqual(before);
  });

  it('compares border geometry by values and persists equal-color adaptive solid resets', () => {
    const { doc, widget } = fixture(); widget.style.fillGradient = radial(); widget.style.strokeGradient = linear();
    let page = createAdaptiveView(doc.pages[0]); const id = page.adaptiveViews[0].id; let visible = structuredClone(resolveAdaptiveWidgets(page, id));
    const p = visible[0].style.strokeGradient!; if (p.type !== 'linear') throw Error('Expected linear fixture');
    visible[0].style.strokeGradient = { stops: p.stops.map(stop => ({ color: stop.color, offset: stop.offset })), end: { y: p.end.y, x: p.end.x }, start: { y: p.start.y, x: p.start.x }, type: 'linear' };
    page = applyAdaptiveWidgetEdits(page, id, visible); expect(page.adaptiveViews[0].overrides).toEqual({});
    delete visible[0].style.strokeGradient; page = applyAdaptiveWidgetEdits(page, id, visible); expect(page.adaptiveViews[0].overrides[widget.id].style).toEqual({ stroke: widget.style.stroke });
    expect(resolveAdaptiveWidgets(page, id)[0].style).not.toHaveProperty('strokeGradient'); expect(resolveAdaptiveWidgets(page, id)[0].style.fillGradient).toEqual(radial());
    doc.pages[0] = page; expect(parseDocument(serializeDocument(doc))).toEqual(doc); page = clearAdaptiveOverrides(page, id); expect(resolveAdaptiveWidgets(page, id)[0].style).toEqual(widget.style);
    visible = structuredClone(resolveAdaptiveWidgets(page, id)); visible[0].style.stroke = '#123abc'; page = applyAdaptiveWidgetEdits(page, id, visible); expect(page.adaptiveViews[0].overrides[widget.id].style).toEqual({ stroke: '#123abc', strokeGradient: linear() });
  });

  it('deep-copies both paint definitions in duplicate widgets and linked component updates', () => {
    const { doc, widget } = fixture(); widget.style.fillGradient = linear(); widget.style.strokeGradient = radial(); widget.selectedStyle = { strokeGradient: linear() };
    const [copy] = cloneWidgets([widget]); copy.style.strokeGradient!.stops[0].color = 'orange'; copy.selectedStyle!.strokeGradient!.stops[0].offset = .1; expect(widget.style.strokeGradient).toEqual(radial()); expect(widget.selectedStyle.strokeGradient).toEqual(linear());
    const component = createComponent([widget], 'Gradient border card'); doc.components = [component]; const a = createComponentInstance(component), b = createComponentInstance(component); doc.pages[0].widgets = [a, b];
    a.states![0].widgets[0].style.strokeGradient!.stops[0].color = 'red'; const next = applyComponentInstanceChanges(doc, a.id); expect(next.pages[0].widgets[1].states![0].widgets[0].style.strokeGradient!.stops[0].color).toBe('red'); expect(next.pages[0].widgets[1].states![0].widgets[0].style.fillGradient).toEqual(linear()); expect(doc.pages[0].widgets[1].states![0].widgets[0].style.strokeGradient).toEqual(radial()); expect(parseDocument(serializeDocument(next))).toEqual(next);
  });
});

for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} independent paint runtime state`, () => {
  it('keeps border and fill actions independent across selected state without changing the design', async () => {
    const { doc, widget } = fixture(); widget.style.fillGradient = linear(); widget.style.strokeGradient = radial(); widget.selectedStyle = { strokeGradient: linear() }; const before = serializeDocument(doc);
    const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc) : createOfflineRuntime(doc);
    const paint = (style: Partial<WidgetStyle>) => runtime.execute({ id: uid(), event: 'click', name: 'Paint', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: widget.id, style }] });
    try {
      await paint({ stroke: widget.style.stroke }); expect(runtime.widget(widget).style).not.toHaveProperty('strokeGradient'); expect(runtime.widget(widget).style.fillGradient).toEqual(linear());
      await runtime.select(widget.id, true); expect(runtime.widget(widget).style.strokeGradient).toEqual(linear()); await runtime.select(widget.id, false); expect(runtime.widget(widget).style).not.toHaveProperty('strokeGradient');
      await paint({ strokeGradient: radial() }); await paint({ fill: 'transparent', strokeWidth: 8 }); expect(runtime.widget(widget).style.strokeGradient).toEqual(radial()); expect(runtime.widget(widget).style).not.toHaveProperty('fillGradient');
      expect(runtime.renderSize(widget)).toEqual({ width: widget.width, height: widget.height }); expect(serializeDocument(doc)).toBe(before);
    } finally { runtime.dispose(); }
  });
});
