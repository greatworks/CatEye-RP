import { describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createWidget, uid } from '../src/model/document';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import type { Action, EventType, Interaction } from '../src/model/types';

const interaction = (actions: Omit<Action, 'id'>[], event: EventType = 'click'): Interaction => ({ id: uid(), event, name: event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) });
function fixture(serialized = false) {
  const doc = createDocument(), list = createWidget('repeater'), child = createWidget('input'), button = createWidget('button');
  doc.variables.Trace = '';
  const log = (template: string): Omit<Action, 'id'> => ({ type: 'setVariable', targetId: 'Trace', value: template });
  doc.pages[0].interactions = [interaction([log('P|')], 'load')];
  list.repeater = { columns: ['Name', 'Count', 'Note'], rows: [{ Name: 'A', Count: '1', Note: 'one' }, { Name: 'B', Count: '2', Note: 'two' }], template: [child], itemHeight: 50, gap: 0 };
  list.interactions = [interaction([log('[[Trace]]R|')], 'load'), interaction([log('[[Trace]]I[[Item.index]]:[[Item.Name]]|'), { type: 'setText', targetId: child.id, value: '[[Item.Note]]' }], 'itemLoad')];
  child.interactions = [interaction([log('[[Trace]]L[[Item.index]]|')], 'load')];
  doc.pages[0].widgets = [list, button];
  const runtime: OfflineRuntime = serialized ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, evaluateExpression) : createOfflineRuntime(doc, undefined, evaluateExpression);
  const act = async (...actions: Omit<Action, 'id'>[]) => { button.interactions = [interaction(actions)]; await runtime.trigger(button.id, 'click'); };
  return { doc, list, child, button, runtime, act };
}

describe('repeater lifecycle and data updates', () => {
  for (const serialized of [false, true]) it(`${serialized ? 'portable' : 'module'}: loads in native order and batches data refresh at event end`, async () => {
    const { runtime, list, child, act } = fixture(serialized);
    await runtime.start();
    expect(runtime.state().variables.Trace).toBe('P|R|I1:A|L1|I2:B|L2|');
    const first = runtime.rows(list)[0]; runtime.input(child.id, 'temporary', undefined, first.context);
    await act({ type: 'setVariable', targetId: 'Trace', value: '' }, { type: 'sortRows', targetId: list.id, value: 'Name:desc' }, { type: 'updateRow', targetId: list.id, value: '{"row":0,"values":{"Note":"saved"}}' });
    expect(runtime.state().variables.Trace).toBe('I1:B|L1|I2:A|L2|');
    expect(runtime.rows(list).map(row => runtime.widget(child, row.context).text)).toEqual(['saved', 'one']);
    expect(runtime.text('[[Item.index]]/[[Item.isLast]]/[[Item.isEven]]', undefined, runtime.rows(list)[1].context)).toBe('2/true/true');
  });

  it('updates This after sorting, preserves other columns, and treats quoted data as literal text', async () => {
    const { runtime, list, child, act } = fixture(); await runtime.start();
    await act({ type: 'sortRows', targetId: list.id, value: 'Name:desc' });
    const current = runtime.rows(list)[1], literal = '"Quoted"\n[[Name]]';
    runtime.input(child.id, literal, undefined, current.context);
    child.interactions.push(interaction([{ type: 'updateRow', targetId: list.id, value: JSON.stringify({ row: 'this', values: { Note: `[[Widget.${child.id}.text]]` } }) }]));
    await runtime.trigger(child.id, 'click', current.data, current.context);
    // A single-line native input strips line breaks; quoted expression syntax
    // remains literal and the row update reads that actual control value.
    const nativeValue = literal.replace(/[\r\n]/g, '');
    expect(runtime.rows(list).map(row => row.data)).toEqual([{ Name: 'B', Count: '2', Note: 'two' }, { Name: 'A', Count: '1', Note: nativeValue }]);
    expect(runtime.widget(child, current.context).text).toBe(nativeValue);
  });

  it('matches hidden source rows and computes each target and column against current target values', async () => {
    const { runtime, list, act } = fixture(); await runtime.start();
    await act({ type: 'filterRows', targetId: list.id, value: '{"column":"Name","operator":"equals","value":"B"}' });
    await act({ type: 'updateRow', targetId: list.id, value: '{"where":{"column":"Name","operator":"equals","value":"A"},"values":{"Count":"[[TargetItem.Count + 10]]","Note":"[[TargetItem.Count]]"}}' });
    expect(runtime.rows(list).map(row => row.data.Name)).toEqual(['B']);
    await act({ type: 'updateRow', targetId: list.id, value: '{"row":"all","values":{"Count":"[[Item.Count + 1]]"}}' }, { type: 'filterRows', targetId: list.id, value: '' });
    expect(runtime.rows(list).map(row => row.data)).toEqual([{ Name: 'A', Count: '12', Note: '11' }, { Name: 'B', Count: '3', Note: 'two' }]);
  });

  it('suppresses recursive mutations of the repeater during its synchronous item load', async () => {
    const { runtime, list } = fixture();
    list.interactions.push(interaction([{ type: 'addRow', targetId: list.id, value: '{"Name":"bad"}' }, { type: 'updateRow', targetId: list.id, value: '{"row":"this","values":{"Name":"bad"}}' }, { type: 'deleteRow', targetId: list.id, value: 'all' }], 'itemLoad'));
    await runtime.start();
    expect(runtime.rows(list).map(row => row.data.Name)).toEqual(['A', 'B']);
  });

  it('rejects malformed updates and rolls back earlier changes in a failing case', async () => {
    const { runtime, list, act } = fixture(); await runtime.start();
    for (const value of ['[]', '{"row":-1,"values":{"Note":"x"}}', '{"row":"this","values":{"Note":"x"}}', '{"row":"all","where":{},"values":{"Note":"x"}}', '{"row":"all","values":{"Unknown":"x"}}', '{"row":"all","values":{"Note":2}}']) await expect(act({ type: 'updateRow', targetId: list.id, value })).rejects.toThrow();
    const before = structuredClone(runtime.state());
    await expect(act({ type: 'updateRow', targetId: list.id, value: '{"row":"all","values":{"Note":"changed","Count":"[[1 / (2 - TargetItem.Count)]]"}}' })).rejects.toThrow(/division by zero/);
    expect(runtime.state()).toEqual(before);
    await act({ type: 'updateRow', targetId: list.id, value: '{"row":"all","values":{}}' });
    expect(runtime.state()).toEqual(before);
  });

  it('parses new row structure before substituting cell values', async () => {
    const { runtime, list, child, act } = fixture(); await runtime.start();
    runtime.state().variables.Value = 'A "quote"\n[[Item.Name]]';
    await act({ type: 'addRow', targetId: list.id, value: '{"Name":"new","Note":"[[Value]]"}' });
    const last = runtime.rows(list).at(-1)!;
    expect(last.data.Note).toBe('A "quote"\n[[Item.Name]]');
    expect(runtime.widget(child, last.context).text).toBe(last.data.Note.replace(/[\r\n]/g, ''));
  });

  it('initializes hidden repeaters and all panel states once, without waiting for them to be displayed', async () => {
    const { doc, runtime, list } = fixture(); list.hidden = true;
    // Recreate because document indexing is fixed at session creation.
    const panel = createWidget('panel'), unseen = createWidget('repeater');
    unseen.repeater!.rows = [{ Name: 'hidden' }];
    unseen.interactions = [interaction([{ type: 'setVariable', targetId: 'Hidden', value: 'loaded' }], 'itemLoad')];
    panel.states!.push({ id: uid(), name: 'Not active', widgets: [unseen] }); doc.pages[0].widgets.push(panel);
    const session = createOfflineRuntime(doc, undefined, evaluateExpression); await session.start();
    expect(session.state().variables.Trace).toBe('P|R|I1:A|L1|I2:B|L2|');
    expect(session.state().variables.Hidden).toBe('loaded');
    runtime.dispose(); session.dispose();
  });
});
