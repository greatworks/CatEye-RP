import { describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createWidget, uid } from '../src/model/document';
import type { Action, Interaction } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

function interaction(actions: Omit<Action, 'id'>[]): Interaction {
  return { id: uid(), name: 'Row action', event: 'click', enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(a => ({ ...a, id: uid() })) };
}

function fixture(serialized = false) {
  const doc = createDocument(), repeater = createWidget('repeater');
  const input = createWidget('input'), check = createWidget('checkbox'), panel = createWidget('panel'), button = createWidget('button');
  const output = createWidget('text'), external = createWidget('button');
  input.text = '[[Item.Name]]'; output.text = 'unchanged'; check.checked = false;
  panel.states!.push({ id: uid(), name: 'Second', widgets: [] });
  repeater.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }, { Name: 'B' }], template: [input, check, panel, button], itemHeight: 80, gap: 0 };
  doc.pages[0].widgets = [repeater, external, output];
  const runtime: OfflineRuntime = serialized
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, evaluateExpression)
    : createOfflineRuntime(doc, undefined, evaluateExpression);
  const act = async (actions: Omit<Action, 'id'>[]) => { external.interactions = [interaction(actions)]; await runtime.trigger(external.id, 'click'); };
  return { doc, runtime, repeater, input, check, panel, button, output, act };
}

describe('stable repeater instance state', () => {
  it('cannot alias a document widget whose ID resembles an internal row instance key', () => {
    const { doc, repeater, input, output } = fixture();
    output.id = JSON.stringify([[repeater.id, 'row-1'], input.id]);
    const runtime = createOfflineRuntime(doc), row = runtime.rows(repeater)[0];
    runtime.input(input.id, 'row edit', undefined, row.context);
    expect(runtime.widget(output).text).toBe('unchanged');
    expect(runtime.widget(input, row.context).text).toBe('row edit');
  });
  it('reads the displayed initial row binding without reinterpreting stored input, and rejects cycles', async () => {
    const { runtime, repeater, input, button, output } = fixture();
    await runtime.start();
    const [a, b] = runtime.rows(repeater);
    button.interactions = [interaction([{ type: 'setText', targetId: output.id, value: `[[Widget.${input.id}.text]]` }])];
    await runtime.trigger(button.id, 'click', a.data, a.context);
    expect(runtime.widget(output).text).toBe('A');
    await runtime.trigger(button.id, 'click', b.data, b.context);
    expect(runtime.widget(output).text).toBe('B');
    runtime.input(input.id, '[[Item.Name]]', undefined, a.context);
    await runtime.trigger(button.id, 'click', a.data, a.context);
    expect(runtime.widget(output).text).toBe('[[Item.Name]]');
    input.text = `[[Widget.${input.id}.text]]`;
    await expect(runtime.trigger(button.id, 'click', b.data, b.context)).rejects.toThrow(/Circular/);
  });
  for (const serialized of [false, true]) it(`${serialized ? 'serialized' : 'module'}: isolates input, checkbox, panel state, conditions and widget reads`, async () => {
    const { runtime, repeater, input, check, panel, button, output } = fixture(serialized);
    await runtime.start();
    const [a, b] = runtime.rows(repeater);
    runtime.input(input.id, 'A edited', undefined, a.context);
    runtime.input(check.id, '', true, a.context);
    button.interactions = [interaction([{ type: 'nextState', targetId: panel.id }, { type: 'setText', targetId: output.id, value: `[[Widget.${input.id}.text]]` }])];
    button.interactions[0].conditions = [{ source: 'widgetText', key: input.id, operator: 'equals', value: 'A edited' }];
    await runtime.trigger(button.id, 'click', a.data, a.context);
    expect(runtime.widget(input, a.context).text).toBe('A edited');
    expect(runtime.widget(input, b.context).text).toBe('[[Item.Name]]');
    expect(runtime.widget(check, a.context).checked).toBe(true);
    expect(runtime.widget(check, b.context).checked).toBe(false);
    expect(runtime.widget(panel, a.context).activeStateId).toBe(panel.states![1].id);
    expect(runtime.widget(panel, b.context).activeStateId).toBe(panel.states![0].id);
    expect(runtime.widget(output).text).toBe('A edited');
    await runtime.trigger(button.id, 'click', b.data, b.context);
    expect(runtime.widget(panel, b.context).activeStateId).toBe(panel.states![0].id);
    expect(runtime.hasOverride(input.id, 'text', a.context)).toBe(true);
    expect(runtime.hasOverride(input.id, 'text', b.context)).toBe(false);
  });

  it('keeps duplicate data identities distinct but resets temporary row state on refresh', async () => {
    const { runtime, repeater, input, act } = fixture();
    await runtime.start();
    const [a, firstB, secondB] = runtime.rows(repeater);
    runtime.input(input.id, 'second duplicate', undefined, secondB.context);
    await act([{ type: 'sortRows', targetId: repeater.id, value: 'Name:desc' }]);
    expect(runtime.rows(repeater).map(r => r.id)).toEqual([firstB.id, secondB.id, a.id]);
    expect(runtime.hasOverride(input.id, 'text', secondB.context)).toBe(false);
    await act([{ type: 'filterRows', targetId: repeater.id, value: '{"column":"Name","operator":"equals","value":"A"}' }]);
    expect(runtime.rows(repeater).map(r => r.id)).toEqual([a.id]);
    await act([{ type: 'filterRows', targetId: repeater.id, value: '' }]);
    expect(runtime.widget(input, secondB.context).text).toBe(input.text);
    await act([{ type: 'deleteRow', targetId: repeater.id, value: '1' }, { type: 'addRow', targetId: repeater.id, value: '{"Name":"B"}' }]);
    const next = runtime.rows(repeater);
    expect(next[0].id).toBe(firstB.id); expect(next[1].id).not.toBe(secondB.id);
    expect(runtime.hasOverride(input.id, 'text', next[1].context)).toBe(false);
    expect(Object.values(runtime.state().widgetOverrides)).toHaveLength(0);
    // Events queued from a removed row cannot recreate its state.
    runtime.input(input.id, 'stale', undefined, secondB.context);
    expect(Object.values(runtime.state().widgetOverrides)).toHaveLength(0);
  });

  it('scopes nested repeater datasets and target actions to the shared parent row', async () => {
    const { doc, repeater, input, button } = fixture();
    const nested = createWidget('repeater'), childInput = createWidget('input'), childButton = createWidget('button');
    nested.repeater!.rows = [{ Name: 'child' }]; nested.repeater!.template = [childInput, childButton];
    repeater.repeater!.template.push(nested);
    button.interactions = [interaction([{ type: 'addRow', targetId: nested.id, value: '{"Name":"added"}' }])];
    childButton.interactions = [interaction([{ type: 'setText', targetId: input.id, value: 'from child' }])];
    const runtime = createOfflineRuntime(doc); await runtime.start();
    const [a, b] = runtime.rows(repeater);
    await runtime.trigger(button.id, 'click', a.data, a.context);
    button.interactions = [interaction([{ type: 'setText', targetId: childInput.id, value: 'parent edit' }])];
    await runtime.trigger(button.id, 'click', a.data, a.context);
    const childrenA = runtime.rows(nested, a.context), childrenB = runtime.rows(nested, b.context);
    expect(childrenA).toHaveLength(2); expect(childrenB).toHaveLength(1);
    expect(childrenA.map(r => runtime.widget(childInput, r.context).text)).toEqual(['parent edit', 'parent edit']);
    expect(runtime.widget(childInput, childrenB[0].context).text).toBe(childInput.text);
    await runtime.trigger(childButton.id, 'click', childrenA[0].data, childrenA[0].context);
    expect(runtime.widget(input, a.context).text).toBe('from child');
    expect(runtime.hasOverride(input.id, 'text', b.context)).toBe(false);
  });

  it('applies an external action to all existing row instances without changing the template', async () => {
    const { runtime, repeater, input, act } = fixture();
    await runtime.start();
    await act([{ type: 'setText', targetId: input.id, value: 'all current rows' }]);
    expect(runtime.rows(repeater).map(row => runtime.widget(input, row.context).text)).toEqual(Array(3).fill('all current rows'));
    await act([{ type: 'addRow', targetId: repeater.id, value: '{"Name":"new"}' }]);
    expect(runtime.hasOverride(input.id, 'text', runtime.rows(repeater)[3].context)).toBe(false);
    expect(input.text).toBe('[[Item.Name]]');
  });

  it('rolls back IDs, row state and source order together when an action fails', async () => {
    const { runtime, repeater, input, act } = fixture();
    await runtime.start();
    const second = runtime.rows(repeater)[1]; runtime.input(input.id, 'kept', undefined, second.context);
    const before = structuredClone(runtime.state());
    await expect(act([{ type: 'deleteRow', targetId: repeater.id, value: '1' }, { type: 'addRow', targetId: repeater.id, value: '{"Invalid":"column"}' }])).rejects.toThrow();
    expect(runtime.state()).toEqual(before);
    expect(runtime.widget(input, runtime.rows(repeater)[1].context).text).toBe('kept');
    await act([{ type: 'sortRows', targetId: repeater.id, value: 'Name:desc' }, { type: 'deleteRow', targetId: repeater.id, value: '0' }]);
    expect(runtime.rows(repeater).some(row => row.id === second.id)).toBe(false);
  });

  it('deleting a parent clears its nested datasets and restarting creates fresh state', async () => {
    const { doc, repeater, input } = fixture();
    const nested = createWidget('repeater'); repeater.repeater!.template.push(nested);
    const remove = createWidget('button'); doc.pages[0].widgets.push(remove);
    remove.interactions = [interaction([{ type: 'deleteRow', targetId: repeater.id, value: '0' }])];
    const runtime = createOfflineRuntime(doc); await runtime.start();
    const [a, b] = runtime.rows(repeater);
    runtime.rows(nested, a.context); runtime.rows(nested, b.context);
    runtime.input(input.id, 'changed', undefined, a.context);
    await runtime.trigger(remove.id, 'click');
    expect(Object.keys(runtime.state().sourceRows)).toHaveLength(3);
    expect(Object.values(runtime.state().scopes).some(scope => scope.some(row => row.rowId === a.id))).toBe(false);
    const fresh = createOfflineRuntime(doc);
    expect(fresh.rows(repeater)).toHaveLength(3);
    expect(Object.values(fresh.state().widgetOverrides)).toHaveLength(0);
  });
});
