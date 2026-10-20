import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { applyAdaptiveWidgetEdits, clearAdaptiveOverrides, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { cloneWidgets, createDocument, createWidget, defaultStyle, mergeWidgetStyle, parseDocument, parseRichText, parseWidgetStylePatch, resolveInteractionStyle, serializeDocument, uid } from '../src/model/document';
import { ARROW_STYLES, LINE_PATTERNS, type GradientFill, type WidgetStyle } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';

const gradient = (): GradientFill => ({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 1, y: 1 }, stops: [{ offset: 0, color: '#2255cc80' }, { offset: 1, color: '#dd3377' }] });
const lines = (): Partial<WidgetStyle> => ({ linePattern: 'long-dash-short-dash', lineEnds: { start: 'hollow-circle', end: 'filled-triangle' }, borderVisibility: [true, false, true, false] });
function fixture() { const doc = createDocument(), widget = createWidget('line'); doc.caseSelection = 'never'; doc.pages[0].widgets = [widget]; return { doc, widget }; }

describe('line style document and inheritance behavior', () => {
  it('retains old project bytes and does not inject new defaults', () => {
    const { doc, widget } = fixture(); widget.style.strokeGradient = gradient();
    const before = serializeDocument(doc); expect(serializeDocument(parseDocument(before))).toBe(before);
    for (const field of ['linePattern', 'lineEnds', 'borderVisibility']) expect(defaultStyle()).not.toHaveProperty(field);
  });

  it('preserves every supported pattern, endpoint pair and side combination through save and reopen', () => {
    const { doc } = fixture();
    doc.pages[0].widgets = ARROW_STYLES.map((end, index) => {
      const w = createWidget('line'); w.style = { ...w.style, linePattern: LINE_PATTERNS[index % LINE_PATTERNS.length], lineEnds: { start: ARROW_STYLES[ARROW_STYLES.length - index - 1], end }, borderVisibility: [Boolean(index & 1), Boolean(index & 2), Boolean(index & 4), Boolean(index & 8)], strokeGradient: gradient() }; return w;
    });
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(new Set(doc.pages[0].widgets.map(w => w.style.linePattern)).size).toBe(LINE_PATTERNS.length);
    expect(new Set(doc.pages[0].widgets.map(w => w.style.borderVisibility!.join(','))).size).toBe(16);
  });

  it('keeps complete line values in effects, actions, presets, adaptive overrides and components', () => {
    const { doc, widget } = fixture(); widget.type = 'input'; Object.assign(widget.style, lines());
    for (const field of ['selectedStyle', 'mouseOverStyle', 'mouseDownStyle', 'focusedStyle', 'disabledStyle', 'errorStyle', 'hintStyle'] as const) widget[field] = lines();
    widget.interactions = [{ id: uid(), event: 'click', name: 'Line state', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: widget.id, style: lines() }] }];
    doc.styles = [{ id: uid(), name: 'Line preset', style: { ...defaultStyle(), ...lines() } }];
    doc.components = [createComponent([widget], 'Endpoint pair')];
    doc.pages[0] = createAdaptiveView(doc.pages[0]); doc.pages[0].adaptiveViews[0].overrides[widget.id] = { style: lines() };
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('rejects unknown or executable pattern values without CSS passthrough', () => {
    for (const value of [null, false, 1, [], {}, 'dashed', 'longDash', 'SOLID', 'url(https://example.com)', 'solid;display:none', 'indeterminate'])
      expect(() => parseWidgetStylePatch({ linePattern: value })).toThrow('linePattern');
  });

  it('requires both concrete endpoints and rejects partial, unknown or prototype-bearing pairs', () => {
    for (const value of [null, [], false, {}, { start: 'none' }, { end: 'none' }, { start: 1, end: 3 }, { start: 'none', end: 'indeterminate' }, { start: 'none', end: 'unknown' }, { start: 'none', end: 'filled-triangle', width: 8 }, JSON.parse('{"start":"none","end":"none","__proto__":{}}')])
      expect(() => parseWidgetStylePatch({ lineEnds: value })).toThrow('lineEnds');
  });

  it('requires four actual booleans for visibility, retaining false without coercion', () => {
    for (const value of [null, false, [], [true], [true, true, true], [true, true, true, true, false], [1, 0, 1, 0], ['true', true, true, true], { top: true, right: true, bottom: false, left: false }])
      expect(() => parseWidgetStylePatch({ borderVisibility: value })).toThrow('borderVisibility');
    expect(parseWidgetStylePatch({ borderVisibility: [false, false, false, false] })).toEqual({ borderVisibility: [false, false, false, false] });
  });

  it('enforces atomic validation in saved partial carriers as well as the author boundary', () => {
    for (const carrier of ['effect', 'action', 'view', 'preset']) {
      const { doc, widget } = fixture(), invalid = { lineEnds: { start: 'none' } };
      const raw = JSON.parse(JSON.stringify(doc)); const w = raw.pages[0].widgets[0];
      if (carrier === 'effect') w.selectedStyle = invalid;
      if (carrier === 'action') w.interactions = [{ id: uid(), event: 'click', name: 'Bad pair', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', style: invalid }] }];
      if (carrier === 'view') raw.pages[0].adaptiveViews = [{ id: uid(), name: 'Small', width: 400, overrides: { [widget.id]: { style: invalid } } }];
      if (carrier === 'preset') raw.styles = [{ id: uid(), name: 'Bad pair', style: { ...defaultStyle(), ...invalid } }];
      expect(() => parseDocument(JSON.stringify(raw)), carrier).toThrow('lineEnds.end');
    }
  });

  it('keeps line properties outside rich text runs and hyperlink typography', () => {
    for (const style of [lines(), { linePattern: 'none' }, { borderVisibility: [false, false, false, false] }])
      expect(() => parseRichText({ paragraphs: [{ runs: [{ text: 'Caption', style }] }] })).toThrow();
  });

  it('changes patterns and visibility independently of authored width, paint, radius and fill', () => {
    const base: WidgetStyle = { ...defaultStyle(), ...lines(), fillGradient: gradient(), strokeGradient: gradient(), borderWidths: [3, 5, 7, 9], cornerRadii: [10, 20, 30, 40] }, before = structuredClone(base);
    const hidden = mergeWidgetStyle(base, { linePattern: 'none', borderVisibility: [false, false, false, false] });
    expect(hidden).toEqual({ ...base, linePattern: 'none', borderVisibility: [false, false, false, false] });
    const width = mergeWidgetStyle(hidden, { strokeWidth: 12 });
    expect(width.linePattern).toBe('none'); expect(width.lineEnds).toEqual(base.lineEnds); expect(width.strokeGradient).toEqual(gradient()); expect(width).not.toHaveProperty('borderWidths');
    const solid = mergeWidgetStyle(base, { stroke: '#112233' }); expect(solid).not.toHaveProperty('strokeGradient'); expect(solid.linePattern).toBe(base.linePattern); expect(solid.borderVisibility).toEqual(base.borderVisibility); expect(solid.fillGradient).toEqual(base.fillGradient);
    expect(base).toEqual(before);
  });

  it('overlays endpoint pairs atomically and restores independent style channels after transient states', () => {
    const { widget } = fixture(); Object.assign(widget.style, lines(), { strokeGradient: gradient() }); const before = structuredClone(widget.style);
    widget.mouseOverStyle = { linePattern: 'dot', lineEnds: { start: 'cross-bar', end: 'none' } };
    widget.selectedStyle = { lineEnds: { start: 'none', end: 'crow' } }; widget.errorStyle = { borderVisibility: [false, true, false, true] }; widget.disabledStyle = { linePattern: 'none' };
    widget.selected = widget.error = widget.disabled = true;
    const resolved = resolveInteractionStyle(widget, { mouseOver: true });
    expect(resolved).toMatchObject({ linePattern: 'none', lineEnds: { start: 'none', end: 'crow' }, borderVisibility: [false, true, false, true], strokeGradient: gradient() });
    widget.selected = widget.error = widget.disabled = false; expect(resolveInteractionStyle(widget)).toEqual(before); expect(widget.style).toEqual(before);
  });

  it('compares adaptive line values rather than references and persists explicit default resets', () => {
    const { doc, widget } = fixture(); Object.assign(widget.style, lines());
    let page = createAdaptiveView(doc.pages[0]); const view = page.adaptiveViews[0].id;
    let visible = structuredClone(resolveAdaptiveWidgets(page, view)); visible[0].style.lineEnds = { end: 'filled-triangle', start: 'hollow-circle' };
    page = applyAdaptiveWidgetEdits(page, view, visible); expect(page.adaptiveViews[0].overrides).toEqual({});
    delete visible[0].style.linePattern; delete visible[0].style.lineEnds; delete visible[0].style.borderVisibility;
    page = applyAdaptiveWidgetEdits(page, view, visible);
    expect(page.adaptiveViews[0].overrides[widget.id].style).toEqual({ linePattern: 'solid', lineEnds: { start: 'none', end: 'none' }, borderVisibility: [true, true, true, true] });
    doc.pages[0] = page; const restored = parseDocument(serializeDocument(doc));
    expect(resolveAdaptiveWidgets(restored.pages[0], view)[0].style).toMatchObject({ linePattern: 'solid', lineEnds: { start: 'none', end: 'none' }, borderVisibility: [true, true, true, true] });
    page = clearAdaptiveOverrides(page, view); expect(resolveAdaptiveWidgets(page, view)[0].style).toEqual(widget.style);
    visible = structuredClone(resolveAdaptiveWidgets(page, view)); visible[0].style.lineEnds!.start = 'none';
    page = applyAdaptiveWidgetEdits(page, view, visible); expect(page.adaptiveViews[0].overrides[widget.id].style).toEqual({ lineEnds: { start: 'none', end: 'filled-triangle' } });
  });

  it('deep-copies endpoint pairs and side arrays in duplicates and linked component updates', () => {
    const { doc, widget } = fixture(); Object.assign(widget.style, lines()); widget.selectedStyle = lines();
    const [copy] = cloneWidgets([widget]); copy.style.lineEnds!.start = 'none'; copy.style.borderVisibility![1] = true; copy.selectedStyle!.lineEnds!.end = 'none';
    expect(widget.style.lineEnds!.start).toBe('hollow-circle'); expect(widget.style.borderVisibility![1]).toBe(false); expect(widget.selectedStyle.lineEnds!.end).toBe('filled-triangle');
    const component = createComponent([widget], 'Line component'), first = createComponentInstance(component), second = createComponentInstance(component); doc.components = [component]; doc.pages[0].widgets = [first, second];
    first.states![0].widgets[0].style.lineEnds!.end = 'crow'; const next = applyComponentInstanceChanges(doc, first.id);
    expect(next.pages[0].widgets[1].states![0].widgets[0].style.lineEnds!.end).toBe('crow'); expect(second.states![0].widgets[0].style.lineEnds!.end).toBe('filled-triangle'); expect(parseDocument(serializeDocument(next))).toEqual(next);
  });
});

for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} line style runtime state`, () => {
  it('applies independent line channels, selection and whole endpoint resets without changing the saved design', async () => {
    const { doc, widget } = fixture(); Object.assign(widget.style, lines(), { strokeGradient: gradient() }); widget.selectedStyle = { lineEnds: { start: 'none', end: 'crow' } }; const before = serializeDocument(doc);
    const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc) : createOfflineRuntime(doc);
    const change = (style: Partial<WidgetStyle>) => runtime.execute({ id: uid(), event: 'click', name: 'Change line', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: widget.id, style }] });
    try {
      await change({ linePattern: 'none' }); expect(runtime.widget(widget).style).toMatchObject({ linePattern: 'none', strokeGradient: gradient(), lineEnds: lines().lineEnds, strokeWidth: widget.style.strokeWidth });
      await runtime.select(widget.id, true); expect(runtime.widget(widget).style.lineEnds).toEqual({ start: 'none', end: 'crow' });
      await runtime.select(widget.id, false); expect(runtime.widget(widget).style.lineEnds).toEqual(lines().lineEnds);
      await change({ linePattern: 'solid', lineEnds: { start: 'none', end: 'none' }, borderVisibility: [true, true, true, true] });
      expect(runtime.widget(widget).style).toMatchObject({ linePattern: 'solid', lineEnds: { start: 'none', end: 'none' }, borderVisibility: [true, true, true, true], strokeGradient: gradient() });
      expect(serializeDocument(doc)).toBe(before);
    } finally { runtime.dispose(); }
  });
});
