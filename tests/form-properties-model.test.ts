import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Inspector } from '../src/components/Inspector';
import { applyAdaptiveWidgetEdits, createAdaptiveView } from '../src/model/adaptive';
import { applyComponentInstanceChanges, createComponent, createComponentInstance } from '../src/model/components';
import { cloneWidgets, createDocument, createPage, createWidget, deleteWidgetTree, parseDocument, serializeDocument, uid } from '../src/model/document';
import type { Action, Document, Interaction, Widget, WidgetType } from '../src/model/types';

const widgetTypes: WidgetType[] = ['box', 'ellipse', 'path', 'text', 'button', 'image', 'placeholder', 'line', 'input', 'textarea', 'checkbox', 'radio', 'select', 'hotspot', 'panel', 'repeater'];
function fixture(...widgets: Widget[]) { const doc = createDocument(); doc.pages[0].widgets = widgets; return doc; }
function focus(targetId?: string, selectText?: boolean): Interaction {
  return { id: uid(), name: 'Focus field', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setFocus', ...(targetId !== undefined ? { targetId } : {}), ...(selectText !== undefined ? { selectText } : {}) }] };
}
const parse = (doc: Document) => parseDocument(JSON.stringify(doc));

describe('form properties schema and authoring references', () => {
  it('keeps old and newly created widgets free of optional defaults', () => {
    for (const type of widgetTypes) {
      const doc = fixture(createWidget(type)); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
      for (const field of ['readOnly', 'maxLength', 'submitButtonId']) expect(doc.pages[0].widgets[0]).not.toHaveProperty(field);
    }
  });

  it.each(['input', 'textarea'] as const)('round-trips %s read-only states and submit links without changing stored text', type => {
    const control = createWidget(type), target = createWidget('button'); control.text = 'Existing text\nSecond line'; control.submitButtonId = target.id;
    for (const readOnly of [false, true]) {
      control.readOnly = readOnly; const doc = fixture(control, target); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    }
  });

  it('retains zero and Int32 maximum lengths exactly, without truncating text or changing password type', () => {
    const control = createWidget('input'); control.inputType = 'password'; control.text = 'Text longer than its user-input limit';
    for (const maxLength of [0, 1, 2147483647]) {
      control.maxLength = maxLength; const doc = fixture(control); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    }
  });

  it.each(['readOnly', 'submitButtonId'] as const)('rejects %s on non-text-form types, even when its value would otherwise be valid', field => {
    for (const type of widgetTypes.filter(type => type !== 'input' && type !== 'textarea')) {
      const doc = fixture({ ...createWidget(type), [field]: field === 'readOnly' ? false : 'missing-button' });
      expect(() => parse(doc), `${type}.${field}`).toThrow(`${field} is only supported on input and textarea widgets`);
    }
  });

  it('rejects maximum length on every non-input type and rejects invalid lengths without coercion', () => {
    for (const type of widgetTypes.filter(type => type !== 'input')) expect(() => parse(fixture({ ...createWidget(type), maxLength: 0 }))).toThrow('maxLength is only supported on input widgets');
    for (const maxLength of [-1, 0.1, 2147483648, Number.MAX_SAFE_INTEGER, Infinity, NaN, null, '10', true, {}, []]) {
      expect(() => parse(fixture({ ...createWidget('input'), maxLength } as Widget))).toThrow('maxLength');
    }
  });

  it('strictly validates booleans and bounded identifiers, including dangerous keys', () => {
    for (const readOnly of [null, 'false', 0, [], {}]) expect(() => parse(fixture({ ...createWidget('textarea'), readOnly } as Widget))).toThrow('readOnly');
    for (const submitButtonId of [null, 1, false, '', ' ', '\u0000', 'x'.repeat(257), '__proto__', 'constructor', 'prototype', {}, []]) {
      expect(() => parse(fixture({ ...createWidget('input'), submitButtonId } as Widget))).toThrow('submitButtonId');
    }
    expect(() => parse(fixture({ ...createWidget('input'), readonly: true } as Widget))).toThrow('unknown field readonly');
  });

  it('allows missing or out-of-page submit references like action targets, including after target deletion', () => {
    const input = createWidget('input'), button = createWidget('button'), doc = fixture(input, button); input.submitButtonId = button.id;
    doc.pages[0].widgets = deleteWidgetTree(doc.pages[0].widgets, [button.id]);
    expect(parseDocument(serializeDocument(doc)).pages[0].widgets[0].submitButtonId).toBe(button.id);
    const other = createPage('Other page'); other.widgets = [button]; doc.pages.push(other); expect(parse(doc)).toEqual(doc);
    input.submitButtonId = 'missing-target'; expect(parse(doc)).toEqual(doc);
  });

  it('round-trips setFocus with absent, true and false Select text, including draft/dangling targets', () => {
    const widget = createWidget('button'); widget.interactions = [focus(), focus('missing-target', false), focus(widget.id, true)];
    const doc = fixture(widget); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(parse(doc).pages[0].widgets[0].interactions[0].actions[0]).not.toHaveProperty('selectText');
  });

  it('allows Select text only on setFocus and requires an actual boolean', () => {
    for (const selectText of [null, 'true', 0, {}, []]) {
      const widget = createWidget('button'); widget.interactions = [focus()]; Object.assign(widget.interactions[0].actions[0], { selectText });
      expect(() => parse(fixture(widget))).toThrow('selectText');
    }
    for (const type of ['setText', 'show', 'setError', 'wait', 'openPage'] as const) {
      const widget = createWidget('button'); widget.interactions = [focus(widget.id, false)]; Object.assign(widget.interactions[0].actions[0], { type, value: 'true' });
      expect(() => parse(fixture(widget))).toThrow('selectText is only supported on setFocus actions');
    }
  });

  it('remaps internal submit/focus targets through nested states and repeater templates, while retaining external targets', () => {
    const panel = createWidget('panel'), repeater = createWidget('repeater'), input = createWidget('input'), area = createWidget('textarea'), button = createWidget('button');
    input.submitButtonId = button.id; input.readOnly = true; input.maxLength = 9; button.interactions = [focus(input.id, true)];
    area.submitButtonId = 'external-target'; area.interactions = [focus(button.id, false)];
    repeater.repeater!.template = [area]; panel.states![0].widgets = [input, button, repeater];
    const [copy] = cloneWidgets([panel]), [nextInput, nextButton, nextRepeater] = copy.states![0].widgets, nextArea = nextRepeater.repeater!.template[0];
    expect(nextInput.id).not.toBe(input.id); expect(nextInput.submitButtonId).toBe(nextButton.id); expect(nextButton.interactions[0].actions[0]).toMatchObject({ targetId: nextInput.id, selectText: true });
    expect(nextArea.submitButtonId).toBe('external-target'); expect(nextArea.interactions[0].actions[0]).toMatchObject({ targetId: nextButton.id, selectText: false });
    expect(nextInput).toMatchObject({ readOnly: true, maxLength: 9 }); expect(input.submitButtonId).toBe(button.id);
    const doc = fixture(panel, copy); expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('cloning an input alone preserves its external submit reference instead of inventing a new target', () => {
    const input = createWidget('input'); input.submitButtonId = 'external-button'; const [copy] = cloneWidgets([input]);
    expect(copy.submitButtonId).toBe(input.submitButtonId); expect(copy.id).not.toBe(input.id);
  });

  it('remaps component submit and focus references separately for each copy, then propagates changes and removals', () => {
    const input = createWidget('input'), button = createWidget('button'); input.submitButtonId = button.id; button.interactions = [focus(input.id, true)];
    const component = createComponent([input, button]), a = createComponentInstance(component), b = createComponentInstance(component, 500, 100), doc = fixture(a, b); doc.components = [component];
    const [definitionInput, definitionButton] = component.widgets;
    expect(definitionInput.submitButtonId).toBe(definitionButton.id);
    for (const instance of [a, b]) {
      const [localInput, localButton] = instance.states![0].widgets;
      expect(localInput.submitButtonId).toBe(localButton.id); expect(localButton.interactions[0].actions[0].targetId).toBe(localInput.id);
      expect(localButton.id).not.toBe(definitionButton.id);
    }
    const edited = a.states![0].widgets[0]; edited.readOnly = true; edited.maxLength = 0; delete edited.submitButtonId;
    const next = applyComponentInstanceChanges(doc, a.id), nextInput = next.pages[0].widgets[1].states![0].widgets[0];
    expect(nextInput).toMatchObject({ readOnly: true, maxLength: 0 }); expect(nextInput).not.toHaveProperty('submitButtonId');
    expect(next.pages[0].widgets[1].states![0].widgets[1].interactions[0].actions[0].targetId).toBe(nextInput.id);
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });

  it('can publish a deleted component submit target without making the project unsavable', () => {
    const input = createWidget('input'), button = createWidget('button'); input.submitButtonId = button.id;
    const component = createComponent([input, button]), a = createComponentInstance(component), b = createComponentInstance(component), doc = fixture(a, b); doc.components = [component];
    a.states![0].widgets = deleteWidgetTree(a.states![0].widgets, [a.states![0].widgets[1].id]);
    const next = applyComponentInstanceChanges(doc, a.id); expect(next.pages[0].widgets[1].states![0].widgets).toHaveLength(1);
    expect(parseDocument(serializeDocument(next))).toEqual(next);
  });

  it('shares form properties across adaptive views without changing base geometry', () => {
    const input = createWidget('input'); let page = createAdaptiveView(fixture(input).pages[0]); const visible = structuredClone(page.widgets);
    Object.assign(visible[0], { readOnly: true, maxLength: 12, submitButtonId: 'button-target' }); visible[0].x += 50;
    page = applyAdaptiveWidgetEdits(page, page.adaptiveViews[0].id, visible);
    expect(page.widgets[0]).toMatchObject({ x: input.x, readOnly: true, maxLength: 12, submitButtonId: 'button-target' }); expect(page.adaptiveViews[0].overrides[input.id]).toEqual({ x: input.x + 50 });
  });

  it('renders only supported form controls and same-page ordinary submit choices in the Inspector', () => {
    const input = createWidget('input'), area = createWidget('textarea'), button = createWidget('button'), panel = createWidget('panel'), repeater = createWidget('repeater'), nested = createWidget('checkbox');
    panel.states![0].widgets = [nested]; const doc = fixture(input, area, button, panel, repeater), other = createPage(); other.widgets = [createWidget('button')]; doc.pages.push(other);
    const render = (widget: Widget) => renderToStaticMarkup(createElement(Inspector, { document: doc, page: doc.pages[0], widget, onWidgetChange() {}, onPageChange() {} }));
    const inputHtml = render(input), areaHtml = render(area), buttonHtml = render(button);
    expect(inputHtml).toContain('aria-label="Maximum length"'); expect(inputHtml).toContain('placeholder="Unlimited"');
    for (const html of [inputHtml, areaHtml]) {
      expect(html).toContain('aria-label="Read only"'); expect(html).toContain('aria-label="Submit button"');
      const select = html.match(/<select aria-label="Submit button"[\s\S]*?<\/select>/)![0];
      for (const id of [input.id, area.id, button.id, nested.id]) expect(select).toContain(`value="${id}"`);
      for (const id of [panel.id, repeater.id, other.widgets[0].id]) expect(select).not.toContain(`value="${id}"`);
    }
    expect(areaHtml).not.toContain('aria-label="Maximum length"'); expect(areaHtml).not.toContain('aria-label="Input type"');
    for (const label of ['Read only', 'Submit button', 'Maximum length']) expect(buttonHtml).not.toContain(`aria-label="${label}"`);
  });
});
