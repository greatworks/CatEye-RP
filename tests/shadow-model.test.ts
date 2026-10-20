import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { applyAdaptiveWidgetEdits, clearAdaptiveOverrides, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { cloneWidgets, createDocument, createWidget, defaultStyle, mergeWidgetStyle, parseDocument, parseWidgetStylePatch, resolveInteractionStyle, serializeDocument, uid } from '../src/model/document';
import type { ShadowStyle, WidgetStyle } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';

const fields = ['outerShadow', 'innerShadow', 'textShadow'] as const;
const effects = ['mouseOverStyle', 'mouseDownStyle', 'focusedStyle', 'selectedStyle', 'errorStyle', 'hintStyle', 'disabledStyle'] as const;
const shadow = (on = true): ShadowStyle => ({ on, offsetX: -4.5, offsetY: 6.25, blurRadius: 8, color: 'rgba(12,34,56,0.35)' });
const paints = (): Pick<WidgetStyle, typeof fields[number]> => ({ outerShadow: shadow(), innerShadow: { ...shadow(), spread: 2 }, textShadow: { ...shadow(), offsetY: -2 } });
function fixture() { const doc = createDocument(), widget = createWidget('box'); doc.caseSelection = 'never'; doc.pages[0].widgets = [widget]; return { doc, widget }; }

describe('atomic structured shadows', () => {
  it('preserves legacy documents without synthesizing optional shadows', () => {
    const { doc } = fixture(); doc.styles = [{ id: uid(), name: 'Legacy', style: defaultStyle() }];
    const json = serializeDocument(doc); expect(serializeDocument(parseDocument(json))).toBe(json);
    for (const field of fields) expect(defaultStyle()).not.toHaveProperty(field);
  });

  it('round-trips base, all effects, action, adaptive and named preset carriers including explicit off', () => {
    const { doc, widget } = fixture(); widget.type = 'input'; Object.assign(widget.style, paints());
    for (const effect of effects) widget[effect] = paints();
    widget.disabledStyle!.outerShadow!.on = false;
    widget.interactions = [{ id: uid(), event: 'click', name: 'Paint', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: widget.id, style: paints() }] }];
    doc.styles = [{ id: uid(), name: 'Shadows', style: { ...defaultStyle(), ...paints() } }];
    doc.pages[0] = createAdaptiveView(doc.pages[0]); doc.pages[0].adaptiveViews[0].overrides[widget.id] = { style: paints() };
    expect(parseDocument(serializeDocument(doc))).toEqual(doc); expect(parseWidgetStylePatch(paints())).toEqual(paints());
  });

  it.each(fields)('rejects malformed or executable values for %s even when switched off', field => {
    const base = paints()[field]!;
    const invalid = [null, false, [], '0 0 4px red', { on: false }, { ...base, on: 1 }, { ...base, offsetX: 1001 }, { ...base, offsetY: -1001 }, { ...base, blurRadius: -1 }, { ...base, color: 'url(https://example.com)' }, { ...base, color: 'red;display:none' }, { ...base, extra: true }, { ...base, on: false, blurRadius: Infinity }];
    for (const value of invalid) expect(() => parseWidgetStylePatch({ [field]: value }), JSON.stringify(value)).toThrow(field);
    if (field === 'innerShadow') for (const spread of [-1, 1001, '2', null]) expect(() => parseWidgetStylePatch({ [field]: { ...base, spread } })).toThrow('spread');
    else expect(() => parseWidgetStylePatch({ [field]: { ...base, spread: 1 } })).toThrow('spread');
  });

  it('validates every shadow carrier instead of silently discarding invalid state/action/view data', () => {
    for (const carrier of ['effect', 'action', 'view', 'preset']) {
      const { doc, widget } = fixture(), invalid = { outerShadow: { ...shadow(), color: 'var(--external)' } };
      if (carrier === 'effect') widget.selectedStyle = invalid;
      if (carrier === 'action') widget.interactions = [{ id: uid(), event: 'click', name: 'Bad', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', style: invalid }] }];
      if (carrier === 'view') { doc.pages[0] = createAdaptiveView(doc.pages[0]); doc.pages[0].adaptiveViews[0].overrides[widget.id] = { style: invalid }; }
      if (carrier === 'preset') doc.styles = [{ id: uid(), name: 'Bad', style: { ...defaultStyle(), ...invalid } }];
      expect(() => parseDocument(JSON.stringify(doc)), carrier).toThrow('outerShadow.color');
    }
  });

  it('replaces one entire shadow while other shadows and ordinary appearance remain independent', () => {
    const { widget } = fixture(); Object.assign(widget.style, paints()); widget.mouseOverStyle = { outerShadow: { ...shadow(false), offsetX: 23 } };
    const base = structuredClone(widget.style), merged = mergeWidgetStyle(base, widget.mouseOverStyle);
    expect(merged.outerShadow).toEqual(widget.mouseOverStyle.outerShadow); expect(merged.innerShadow).toEqual(base.innerShadow); expect(merged.textShadow).toEqual(base.textShadow);
    expect(resolveInteractionStyle(widget, { mouseOver: true })).toEqual(merged);
    widget.selected = true; widget.selectedStyle = { outerShadow: { ...shadow(), blurRadius: 0 } };
    expect(resolveInteractionStyle(widget, { mouseOver: true }).outerShadow).toEqual(widget.selectedStyle.outerShadow);
    widget.error = true; widget.errorStyle = { textShadow: shadow(false) };
    expect(resolveInteractionStyle(widget, { mouseOver: true }).textShadow?.on).toBe(false); expect(widget.style).toEqual(base);
  });

  it('compares shadow values rather than references in adaptive views and keeps an explicit off reset', () => {
    const { doc, widget } = fixture(); Object.assign(widget.style, paints());
    let page = createAdaptiveView(doc.pages[0]); const id = page.adaptiveViews[0].id;
    page = applyAdaptiveWidgetEdits(page, id, structuredClone(page.widgets)); expect(page.adaptiveViews[0].overrides).toEqual({});
    const visible = structuredClone(resolveAdaptiveWidgets(page, id)); delete visible[0].style.outerShadow; delete visible[0].style.innerShadow;
    visible[0].style.textShadow!.blurRadius = 3;
    page = applyAdaptiveWidgetEdits(page, id, visible);
    expect(page.widgets[0].style).toEqual(widget.style);
    expect(page.adaptiveViews[0].overrides[widget.id].style).toEqual({ outerShadow: { ...shadow(), on: false }, innerShadow: { ...shadow(), spread: 2, on: false }, textShadow: { ...paints().textShadow, blurRadius: 3 } });
    const shown = resolveAdaptiveWidgets(page, id)[0]; expect(shown.style.outerShadow?.on).toBe(false);
    page = applyAdaptiveWidgetEdits(page, id, structuredClone(resolveAdaptiveWidgets(page, id)));
    expect(resolveAdaptiveWidgets(page, id)[0].style).toEqual(shown.style);
    doc.pages[0] = page; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(resolveAdaptiveWidgets(clearAdaptiveOverrides(page, id), id)[0].style).toEqual(widget.style);
  });

  it('deep-copies shadows for widget clones and live component instances', () => {
    const { doc, widget } = fixture(); Object.assign(widget.style, paints()); widget.selectedStyle = paints();
    const [copy] = cloneWidgets([widget]); copy.style.outerShadow!.offsetX = 50; copy.selectedStyle!.innerShadow!.spread = 40;
    expect(widget.style.outerShadow!.offsetX).toBe(-4.5); expect(widget.selectedStyle!.innerShadow!.spread).toBe(2);
    const component = createComponent([widget], 'Shadow card'); doc.components = [component];
    const a = createComponentInstance(component), b = createComponentInstance(component); doc.pages[0].widgets = [a, b];
    a.states![0].widgets[0].style.textShadow!.color = '#ff0000';
    const next = applyComponentInstanceChanges(doc, a.id);
    expect(next.pages[0].widgets[1].states![0].widgets[0].style.textShadow!.color).toBe('#ff0000');
    expect(doc.pages[0].widgets[1].states![0].widgets[0].style.textShadow!.color).toBe(shadow().color);
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });
});

for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} shadow runtime state`, () => {
  it('restores layered paint and keeps design/geometry unchanged across actions and selection', async () => {
    const { doc, widget } = fixture(); Object.assign(widget.style, paints()); widget.selectedStyle = { outerShadow: shadow(false) };
    const before = serializeDocument(doc);
    const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc) : createOfflineRuntime(doc);
    try {
      const actionShadow = { ...shadow(), offsetX: 77, offsetY: -22 };
      await runtime.execute({ id: uid(), event: 'click', name: 'Change shadow', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: widget.id, style: { outerShadow: actionShadow } }] });
      expect(runtime.widget(widget).style.outerShadow).toEqual(actionShadow); expect(runtime.widget(widget).style.innerShadow).toEqual(widget.style.innerShadow);
      expect(runtime.renderSize(widget)).toEqual({ width: widget.width, height: widget.height });
      await runtime.select(widget.id, true); expect(runtime.widget(widget).style.outerShadow!.on).toBe(false);
      await runtime.select(widget.id, false); expect(runtime.widget(widget).style.outerShadow).toEqual(actionShadow);
      expect(serializeDocument(doc)).toBe(before);
    } finally { runtime.dispose(); }
  });
});
