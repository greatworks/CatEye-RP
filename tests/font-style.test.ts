import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Inspector } from '../src/components/Inspector';
import { WidgetContent, widgetStyle } from '../src/components/WidgetView';
import { applyAdaptiveWidgetEdits, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { cloneWidgets, createDocument, createWidget, defaultStyle, mergeWidgetStyle, parseDocument, parseWidgetStylePatch, resolveInteractionStyle, serializeDocument, uid } from '../src/model/document';
import type { InteractionStyleState, Widget, WidgetStyle } from '../src/model/types';

const effects = ['mouseOverStyle', 'mouseDownStyle', 'focusedStyle', 'selectedStyle', 'errorStyle', 'hintStyle', 'disabledStyle'] as const;
function fixture() { const doc = createDocument(), field = createWidget('input'); doc.pages[0].widgets = [field]; return { doc, field }; }

describe('optional upright and italic typography', () => {
  it('leaves old base/effect/preset/action/adaptive data unchanged without injecting defaults', () => {
    const { doc, field } = fixture(); for (const effect of effects) field[effect] = { fontWeight: 700 };
    doc.styles = [{ id: uid(), name: 'Old style', style: defaultStyle() }];
    field.interactions = [{ id: uid(), name: 'Old action', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: field.id, style: { fontWeight: 500 } }] }];
    doc.pages[0] = createAdaptiveView(doc.pages[0]); doc.pages[0].adaptiveViews[0].overrides[field.id] = { style: { fontSize: 22 } };
    const before = serializeDocument(doc); expect(parseDocument(before)).toEqual(doc); expect(serializeDocument(parseDocument(before))).toBe(before); expect(before).not.toContain('fontStyle'); expect(defaultStyle()).not.toHaveProperty('fontStyle');
  });

  it.each(['normal', 'italic'] as const)('round-trips explicit %s through every style carrier without changing font weight', fontStyle => {
    const { doc, field } = fixture(); field.style = { ...field.style, fontStyle, fontWeight: 700 };
    for (const effect of effects) field[effect] = { fontStyle };
    doc.styles = [{ id: uid(), name: 'Font preset', style: { ...defaultStyle(), fontStyle } }];
    field.interactions = [{ id: uid(), name: 'Typography', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', targetId: field.id, style: { fontStyle } }] }];
    doc.pages[0] = createAdaptiveView(doc.pages[0]); doc.pages[0].adaptiveViews[0].overrides[field.id] = { style: { fontStyle } };
    expect(parseDocument(serializeDocument(doc))).toEqual(doc); expect(parseWidgetStylePatch({ fontStyle })).toEqual({ fontStyle });
    expect(field.style.fontWeight).toBe(700);
  });

  it('rejects unsupported CSS values, native enum numbers and non-string font styles at every carrier', () => {
    for (const fontStyle of ['oblique', 'Italic', '', 'inherit', 'unset', 'italic; color:red', 0, 1, null, false, {}, []]) {
      const { doc, field } = fixture(); Object.assign(field.style, { fontStyle }); expect(() => parseDocument(JSON.stringify(doc)), String(fontStyle)).toThrow('fontStyle');
      expect(() => parseWidgetStylePatch({ fontStyle })).toThrow('fontStyle');
    }
    for (const carrier of ['effect', 'action', 'adaptive', 'preset']) {
      const { doc, field } = fixture(), patch = { fontStyle: 'oblique' } as unknown as Partial<WidgetStyle>;
      if (carrier === 'effect') field.selectedStyle = patch;
      if (carrier === 'action') field.interactions = [{ id: uid(), name: 'Invalid', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setStyle', style: patch }] }];
      if (carrier === 'adaptive') { doc.pages[0] = createAdaptiveView(doc.pages[0]); doc.pages[0].adaptiveViews[0].overrides[field.id] = { style: patch }; }
      if (carrier === 'preset') doc.styles = [{ id: uid(), name: 'Invalid', style: { ...defaultStyle(), ...patch } }];
      expect(() => parseDocument(JSON.stringify(doc)), carrier).toThrow('fontStyle');
    }
  });

  it('composes italic and explicit normal by property without coupling weight or replacing unrelated styles', () => {
    const { field } = fixture(); field.style.fontStyle = 'italic'; field.style.fontWeight = 700;
    field.mouseOverStyle = { fontStyle: 'normal' }; field.mouseDownStyle = { fontStyle: 'italic' }; field.focusedStyle = { fontStyle: 'normal' };
    field.selectedStyle = { fontStyle: 'italic' }; field.errorStyle = { fontStyle: 'normal' }; field.hintStyle = { fontStyle: 'italic' }; field.hintText = 'Hint'; field.disabledStyle = { fontStyle: 'normal' };
    const states: [Partial<Widget>, InteractionStyleState, 'normal' | 'italic'][] = [
      [{}, {}, 'italic'], [{}, { mouseOver: true }, 'normal'], [{}, { mouseOver: true, mouseDown: true }, 'italic'], [{}, { mouseOver: true, mouseDown: true, focused: true }, 'normal'],
      [{ selected: true }, { focused: true }, 'italic'], [{ selected: true, error: true }, {}, 'normal'], [{ selected: true, error: true }, { hint: true }, 'italic'], [{ selected: true, error: true, disabled: true }, { hint: true }, 'normal'],
    ];
    for (const [patch, state, fontStyle] of states) expect(resolveInteractionStyle({ ...field, ...patch }, state)).toMatchObject({ fontStyle, fontWeight: 700, fontFamily: field.style.fontFamily });
    expect(mergeWidgetStyle(field.style, { fontStyle: 'normal' })).toMatchObject({ fontStyle: 'normal', fontWeight: 700 });
  });

  it('stores an adaptive normal reset over base italic and omits semantic no-op default overrides', () => {
    const { doc, field } = fixture(); field.style.fontStyle = 'italic'; let page = createAdaptiveView(doc.pages[0]), viewId = page.adaptiveViews[0].id;
    const visible = resolveAdaptiveWidgets(page, viewId).map(widget => ({ ...widget, style: { ...widget.style, fontStyle: undefined } }));
    page = applyAdaptiveWidgetEdits(page, viewId, visible);
    expect(page.widgets[0].style.fontStyle).toBe('italic'); expect(page.adaptiveViews[0].overrides[field.id]).toEqual({ style: { fontStyle: 'normal' } }); expect(resolveAdaptiveWidgets(page, viewId)[0].style.fontStyle).toBe('normal');
    doc.pages[0] = page; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    const unchanged = createAdaptiveView(fixture().doc.pages[0]), normal = structuredClone(unchanged.widgets); normal[0].style.fontStyle = 'normal';
    expect(applyAdaptiveWidgetEdits(unchanged, unchanged.adaptiveViews[0].id, normal).adaptiveViews[0].overrides).toEqual({});
  });

  it('clones independent font style patches and propagates component changes with no unrelated mutation', () => {
    const { field } = fixture(); field.style.fontStyle = 'italic'; field.selectedStyle = { fontStyle: 'normal' };
    const [copy] = cloneWidgets([field]); copy.style.fontStyle = 'normal'; copy.selectedStyle!.fontStyle = 'italic'; expect(field.style.fontStyle).toBe('italic'); expect(field.selectedStyle.fontStyle).toBe('normal');
    const component = createComponent([field]), a = createComponentInstance(component), b = createComponentInstance(component), doc = createDocument(); doc.components = [component]; doc.pages[0].widgets = [a, b, createWidget('text')];
    const unrelated = structuredClone(doc.pages[0].widgets[2]); a.states![0].widgets[0].style.fontStyle = 'normal';
    const next = applyComponentInstanceChanges(doc, a.id); expect(next.components[0].widgets[0].style.fontStyle).toBe('normal'); expect(next.pages[0].widgets[1].states![0].widgets[0].style.fontStyle).toBe('normal'); expect(next.pages[0].widgets[2]).toEqual(unrelated);
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });

  it('writes an explicit normal renderer style for legacy children of an italic container', () => {
    const panel = createWidget('panel'); panel.style.fontStyle = 'italic'; const child = createWidget('text'); child.text = 'Upright child'; panel.states![0].widgets = [child];
    expect(widgetStyle(panel).fontStyle).toBe('italic'); expect(widgetStyle(child).fontStyle).toBe('normal');
    expect(renderToStaticMarkup(createElement(WidgetContent, { widget: panel }))).toContain('font-style:normal');
    expect(child.style).not.toHaveProperty('fontStyle');
  });

  it('makes a separate font-style control available without changing the font-weight choices', () => {
    const { doc, field } = fixture(); const html = renderToStaticMarkup(createElement(Inspector, { widget: field, page: doc.pages[0], document: doc, onWidgetChange() {}, onPageChange() {} }));
    expect(html).toContain('aria-label="Font style"'); expect(html).toContain('value="italic"'); expect(html).toContain('Default (normal)'); expect(html).toContain('aria-label="Font weight"');
  });
});
