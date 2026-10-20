import { describe, expect, it } from 'vitest';
import { cloneWidgets, createDocument, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import { createOfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import type { Interaction } from '../src/model/types';

describe('input types and control focus events', () => {
  it('keeps omitted input types unchanged and round-trips explicit text and password values', () => {
    const doc = createDocument(); const input = createWidget('input'); doc.pages[0].widgets = [input];
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(parseDocument(serializeDocument(doc)).pages[0].widgets[0]).not.toHaveProperty('inputType');
    for (const inputType of ['text', 'password'] as const) {
      input.inputType = inputType;
      expect(parseDocument(serializeDocument(doc)).pages[0].widgets[0].inputType).toBe(inputType);
    }
  });

  it('rejects unsupported input modes, non-input carriers and adaptive input type overrides', () => {
    const doc = createDocument(); doc.pages[0].widgets = [createWidget('input')];
    const malformed = (patch: object) => JSON.stringify({ ...doc, pages: [{ ...doc.pages[0], widgets: [{ ...doc.pages[0].widgets[0], ...patch }] }] });
    for (const inputType of ['checkbox', 'week', '', null, 1, {}, ['password']]) expect(() => parseDocument(malformed({ inputType }))).toThrow('inputType');
    for (const type of ['textarea', 'box', 'radio', 'select']) expect(() => parseDocument(malformed({ type, inputType: 'password' }))).toThrow('only supported on input');
    doc.pages[0].adaptiveViews = [{ id: uid(), name: 'Mobile', width: 390, overrides: { [doc.pages[0].widgets[0].id]: { inputType: 'password' } as never } }];
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('unknown field');
  });

  it('clones nested password inputs and remaps their focus and blur action targets', () => {
    const panel = createWidget('panel'), input = createWidget('input'); input.inputType = 'password';
    input.interactions = (['focus', 'blur'] as const).map(event => ({ id: uid(), name: event, event, enabled: true, conditions: [], conditionMode: 'all', actions: [{ id: uid(), type: 'setText', targetId: input.id, value: 'updated' }] }));
    panel.states![0].widgets = [input]; const copy = cloneWidgets([panel])[0], cloned = copy.states![0].widgets[0];
    expect(cloned.inputType).toBe('password'); expect(cloned.id).not.toBe(input.id);
    expect(cloned.interactions.map(i => [i.event, i.actions[0].targetId])).toEqual([['focus', cloned.id], ['blur', cloned.id]]);
    const doc = createDocument(); doc.pages[0].widgets = [panel, copy]; expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });

  it('focus actions see the literal password value and disabled controls do not dispatch', async () => {
    const doc = createDocument(); doc.caseSelection = 'never'; doc.variables = { Seen: '', Focus: '0' };
    const input = createWidget('input'); input.inputType = 'password';
    const focus: Interaction = { id: uid(), event: 'focus', name: 'Read password', enabled: true, conditions: [], conditionMode: 'all', actions: [
      { id: uid(), type: 'setVariable', targetId: 'Seen', value: `[[Widget.${input.id}.text]]` },
      { id: uid(), type: 'setVariable', targetId: 'Focus', value: '[[Focus + 1]]' },
    ] };
    input.interactions = [focus]; doc.pages[0].widgets = [input];
    const runtime = createOfflineRuntime(doc, doc.pages[0].id, evaluateExpression);
    await runtime.start(); runtime.input(input.id, 'secret[[Focus + 1]]'); await runtime.trigger(input.id, 'focus');
    expect(runtime.state().variables).toEqual({ Seen: 'secret[[Focus + 1]]', Focus: '1' }); runtime.dispose();
    input.disabled = true; const disabled = createOfflineRuntime(doc, doc.pages[0].id, evaluateExpression);
    await disabled.start(); await disabled.trigger(input.id, 'focus'); expect(disabled.state().variables.Focus).toBe('0'); disabled.dispose();
  });
});
