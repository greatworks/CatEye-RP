import { describe, expect, it } from 'vitest';
import { applyAdaptiveWidgetEdits, createAdaptiveView } from '../src/model/adaptive';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { cloneWidgets, createDocument, createWidget, DOCUMENT_LIMITS, parseDocument, resolveInteractionStyle, resolveSelectedStyle, serializeDocument, uid } from '../src/model/document';
import type { Interaction, Widget, WidgetType } from '../src/model/types';

const types: WidgetType[] = ['box', 'ellipse', 'path', 'text', 'button', 'image', 'placeholder', 'line', 'input', 'textarea', 'checkbox', 'radio', 'select', 'hotspot', 'panel', 'repeater'];
function documentWith(widget: Widget) { const doc = createDocument(); doc.pages[0].widgets = [widget]; return doc; }
const interaction = (targetId: string, value: string): Interaction => ({ id: uid(), event: 'errorSet', name: 'Error handler', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setError', targetId, value }] });

describe('error and hint document boundary', () => {
  it('does not add fields or default styles to old documents or new widgets', () => {
    for (const type of types) {
      const widget = createWidget(type), doc = documentWith(widget), parsed = parseDocument(serializeDocument(doc));
      expect(parsed).toEqual(doc);
      for (const field of ['error', 'errorStyle', 'hintText', 'hintHideOn', 'hintStyle']) expect(parsed.pages[0].widgets[0]).not.toHaveProperty(field);
    }
  });

  it('round-trips optional true/false errors and partial error styles for every widget type', () => {
    for (const type of types) for (const error of [false, true]) {
      const widget = createWidget(type); widget.error = error; widget.errorStyle = { stroke: '#d00000', strokeWidth: 3, textPadding: [1, 2, 3, 4], opacity: 0.7 };
      widget.interactions = [interaction(widget.id, 'toggle'), { ...interaction(widget.id, 'false'), event: 'errorRemoved' }];
      const doc = documentWith(widget); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    }
  });

  it.each(['input', 'textarea'] as const)('preserves literal hints, explicit hiding modes, and partial hint styles on %s', type => {
    const widget = createWidget(type); widget.hintText = '<img src=x onerror=alert(1)> [[NotAnExpression]]\nNext line'; widget.hintStyle = { color: '#778899', fontSize: 18, textAlign: 'left' };
    for (const hintHideOn of [undefined, 'typing', 'focus'] as const) {
      if (hintHideOn === undefined) delete widget.hintHideOn; else widget.hintHideOn = hintHideOn;
      const doc = documentWith(widget); expect(parseDocument(serializeDocument(doc))).toEqual(doc); expect(widget.text).toBe('');
      expect(cloneWidgets([widget])[0].hintText).toBe(widget.hintText);
    }
    widget.hintText = ''; widget.hintStyle = {}; expect(parseDocument(serializeDocument(documentWith(widget))).pages[0].widgets[0].hintText).toBe('');
  });

  it.each(['hintText', 'hintHideOn', 'hintStyle'] as const)('rejects %s on every non-text-form widget, including otherwise empty values', field => {
    for (const type of types.filter(type => type !== 'input' && type !== 'textarea')) {
      const patch = field === 'hintText' ? '' : field === 'hintHideOn' ? 'typing' : {};
      const widget = { ...createWidget(type), [field]: patch };
      expect(() => parseDocument(JSON.stringify(documentWith(widget))), `${type}.${field}`).toThrow(`${field} is only supported on input and textarea`);
    }
  });

  it('strictly validates error booleans, hint strings and hiding modes with bounded text', () => {
    for (const error of [null, 'false', 0, [], {}]) expect(() => parseDocument(JSON.stringify(documentWith({ ...createWidget('input'), error } as Widget)))).toThrow('error');
    for (const hintText of [null, 1, false, {}, [], 'x'.repeat(DOCUMENT_LIMITS.text + 1)]) expect(() => parseDocument(JSON.stringify(documentWith({ ...createWidget('input'), hintText } as Widget)))).toThrow('hintText');
    for (const hintHideOn of [null, true, 'blur', 'Focus', '', 1]) expect(() => parseDocument(JSON.stringify(documentWith({ ...createWidget('textarea'), hintHideOn } as Widget)))).toThrow('hintHideOn');
    const widget = createWidget('input'); widget.hintText = 'x'.repeat(DOCUMENT_LIMITS.text); expect(parseDocument(serializeDocument(documentWith(widget))).pages[0].widgets[0].hintText).toHaveLength(DOCUMENT_LIMITS.text);
  });

  it.each(['errorStyle', 'hintStyle'] as const)('uses the strict partial-style validator for %s', field => {
    for (const patch of [null, [], { fill: 'url(javascript:alert(1))' }, { fontFamily: 'Arial;display:none' }, { radius: -1 }, { borderWidths: [1, 2, 3] }, { opacity: 2 }, { verticalAlign: 'center' }, { lineHeight: 0 }, { unknown: true }, JSON.parse('{"__proto__":{}}')]) {
      expect(() => parseDocument(JSON.stringify(documentWith({ ...createWidget('input'), [field]: patch } as Widget)))).toThrow(field);
    }
  });

  it('accepts complete setError expressions and ordinary, panel and repeater targets', () => {
    for (const type of ['box', 'panel', 'repeater'] as const) for (const value of ['true', 'false', 'toggle', '[[true]]', '[[ Name == "" ]]', '[[Item.Flag]]']) {
      const widget = createWidget(type); widget.interactions = [interaction(widget.id, value)];
      const doc = documentWith(widget); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    }
  });

  it('rejects malformed setError values and the nonexistent errorChange event', () => {
    for (const value of [undefined, null, true, 0, '', 'TRUE', 'False', '[[]]', '[[ ]]', '[[[x]]]', 'prefix [[x]]', '[[x]] suffix', '[[x]][[y]]']) {
      const widget = createWidget('button'); widget.interactions = [interaction(widget.id, 'true')]; Object.assign(widget.interactions[0].actions[0], { value });
      expect(() => parseDocument(JSON.stringify(documentWith(widget)))).toThrow('expected one of true, false, toggle');
    }
    const widget = createWidget('box'); widget.interactions = [interaction(widget.id, 'true')]; Object.assign(widget.interactions[0], { event: 'errorChange' });
    expect(() => parseDocument(JSON.stringify(documentWith(widget)))).toThrow('event');
  });

  it('clones state patches independently and remaps only real expression tokens in setError', () => {
    const widget = createWidget('input'); widget.error = true; widget.hintText = `[[Widget.${widget.id}.text]]`;
    widget.errorStyle = { borderWidths: [1, 2, 3, 4] }; widget.hintStyle = { textPadding: [4, 3, 2, 1] };
    widget.interactions = [interaction(widget.id, `[[Widget.${widget.id}.text == "Widget.${widget.id}.text"]]`)];
    const [clone] = cloneWidgets([widget]); expect(clone.interactions[0].actions[0].targetId).toBe(clone.id);
    expect(clone.interactions[0].actions[0].value).toBe(`[[Widget.${clone.id}.text == "Widget.${widget.id}.text"]]`);
    expect(clone.hintText).toBe(widget.hintText); clone.errorStyle!.borderWidths![0] = 9; clone.hintStyle!.textPadding![0] = 8;
    expect(widget.errorStyle.borderWidths![0]).toBe(1); expect(widget.hintStyle.textPadding![0]).toBe(4);
  });

  it('shares hint text and error flags while keeping adaptive effect paint local', () => {
    const widget = createWidget('input'); let page = createAdaptiveView(documentWith(widget).pages[0]); const visible = structuredClone(page.widgets);
    Object.assign(visible[0], { error: true, errorStyle: { fill: '#ff0000' }, hintText: 'Literal hint', hintHideOn: 'focus', hintStyle: { color: '#777777' } }); visible[0].x = 240;
    page = applyAdaptiveWidgetEdits(page, page.adaptiveViews[0].id, visible);
    expect(page.widgets[0]).toMatchObject({ error: true, hintText: 'Literal hint', hintHideOn: 'focus' });
    expect(page.widgets[0].errorStyle).toBeUndefined(); expect(page.widgets[0].hintStyle).toBeUndefined();
    expect(page.adaptiveViews[0].overrides[widget.id]).toEqual({ x: 240, stateStyles: { error: { fill: '#ff0000' }, hint: { color: '#777777' } } });
  });

  it('propagates changed and removed hint configuration through linked components', () => {
    const input = createWidget('input'); input.hintText = 'Before'; input.hintHideOn = 'focus'; input.hintStyle = { color: '#777777' };
    const component = createComponent([input]), a = createComponentInstance(component), b = createComponentInstance(component, 450, 250), doc = createDocument();
    doc.components = [component]; doc.pages[0].widgets = [a, b]; const edited = a.states![0].widgets[0];
    delete edited.hintText; delete edited.hintStyle; delete edited.hintHideOn; edited.error = true; edited.errorStyle = { stroke: '#ff0000' };
    const next = applyComponentInstanceChanges(doc, a.id), sibling = next.pages[0].widgets[1].states![0].widgets[0];
    expect(sibling).toMatchObject({ error: true, errorStyle: { stroke: '#ff0000' } });
    for (const field of ['hintText', 'hintHideOn', 'hintStyle']) expect(sibling).not.toHaveProperty(field);
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });
});

describe('error and hint composition', () => {
  it('overlays selected, error, hint and disabled by property while preserving focus suppression', () => {
    for (let bits = 0; bits < 64; bits++) {
      const widget = createWidget('input'); widget.hintText = 'Hint'; widget.selected = !!(bits & 4); widget.error = !!(bits & 8); widget.disabled = !!(bits & 32);
      widget.style.fill = '#111111'; widget.mouseOverStyle = { fill: '#220000', stroke: '#aa0000' }; widget.focusedStyle = { fill: '#003300', fontSize: 20 };
      widget.selectedStyle = { fill: '#000044', fontWeight: 700 }; widget.errorStyle = { fill: '#550000', color: '#ff0000' }; widget.hintStyle = { fill: '#006600', textAlign: 'right' }; widget.disabledStyle = { fill: '#777777', opacity: 0.4 };
      const state = { mouseOver: !!(bits & 1), focused: !!(bits & 2), hint: !!(bits & 16) }, before = structuredClone(widget), resolved = resolveInteractionStyle(widget, state);
      expect(resolved.fill).toBe(widget.disabled ? '#777777' : state.hint ? '#006600' : widget.error ? '#550000' : widget.selected ? '#000044' : state.focused ? '#003300' : state.mouseOver ? '#220000' : '#111111');
      expect(resolved.stroke).toBe(!widget.disabled && !state.focused && state.mouseOver ? '#aa0000' : widget.style.stroke);
      expect(resolved.fontSize).toBe(!widget.disabled && state.focused ? 20 : widget.style.fontSize);
      expect(resolved.color).toBe(state.hint ? '#999999' : widget.error ? '#ff0000' : widget.style.color); expect(resolved.textAlign).toBe(state.hint ? 'right' : widget.style.textAlign);
      expect(resolved.fontWeight).toBe(widget.selected ? 700 : widget.style.fontWeight); expect(widget).toEqual(before);
    }
  });

  it('derives only empty-form hints for static composition and preserves the actual text', () => {
    for (const type of ['input', 'textarea'] as const) {
      const widget = createWidget(type); widget.hintText = 'Hint'; widget.error = true; widget.errorStyle = { color: '#ff0000' }; widget.hintStyle = { color: '#777777' };
      expect(resolveSelectedStyle(widget).color).toBe('#777777'); expect(widget.text).toBe('');
      widget.text = ' '; expect(resolveSelectedStyle(widget).color).toBe('#ff0000');
      widget.text = 'entered'; expect(resolveSelectedStyle(widget).color).toBe('#ff0000');
      widget.text = ''; widget.hintText = ''; expect(resolveInteractionStyle(widget, { hint: true }).color).toBe('#ff0000');
    }
  });

  it('uses the verified Default library hint gray, inherits the base font and allows explicit color overrides', () => {
    const widget = createWidget('input'); widget.hintText = 'Hint'; widget.style.color = '#123456'; widget.style.fontFamily = 'Georgia'; widget.style.fontSize = 23;
    expect(resolveSelectedStyle(widget)).toEqual({ ...widget.style, color: '#999999' });
    expect(widget).not.toHaveProperty('hintStyle'); widget.hintStyle = {}; expect(resolveSelectedStyle(widget)).toEqual({ ...widget.style, color: '#999999' });
    widget.hintStyle.color = '#654321'; expect(resolveSelectedStyle(widget)).toEqual({ ...widget.style, color: '#654321' });
    expect(widget.style.color).toBe('#123456');
  });

  it('applies common radius and border resets at error/hint layers without mutating lower patches', () => {
    const widget = createWidget('input'); widget.hintText = 'Hint'; widget.error = true;
    widget.style.cornerRadii = [1, 2, 3, 4]; widget.style.borderWidths = [4, 3, 2, 1]; widget.errorStyle = { radius: 3, strokeWidth: 5 };
    expect(resolveInteractionStyle(widget)).not.toHaveProperty('cornerRadii'); expect(resolveInteractionStyle(widget)).not.toHaveProperty('borderWidths');
    widget.hintStyle = { cornerRadii: [2, 4, 6, 8], borderWidths: [8, 6, 4, 2] };
    expect(resolveSelectedStyle(widget).cornerRadii).toEqual([2, 4, 6, 8]); expect(resolveSelectedStyle(widget).borderWidths).toEqual([8, 6, 4, 2]);
    expect(widget.style.cornerRadii).toEqual([1, 2, 3, 4]);
  });
});
