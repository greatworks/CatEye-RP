import { describe, expect, it, vi } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createWidget, uid } from '../src/model/document';
import type { Action, Interaction } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

const event = (actions: Omit<Action, 'id'>[], trigger: Interaction['event'] = 'click'): Interaction => ({ id: uid(), name: trigger, event: trigger, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(a => ({ ...a, id: uid() })) });
function fixture(portable: boolean, count = 3, limit?: number, page = 1) {
  const doc = createDocument(), list = createWidget('repeater'), child = createWidget('text'), outside = createWidget('text'), button = createWidget('button');
  doc.caseSelection = 'never'; doc.variables = { Trace: '' };
  list.repeater = { columns: ['Name'], rows: Array.from({ length: count }, (_, i) => ({ Name: String(i + 1) })), template: [child], itemHeight: 30, gap: 0, ...(limit === undefined ? {} : { pagination: { itemsPerPage: limit, startPage: page } }) };
  const log = (text: string): Omit<Action, 'id'> => ({ type: 'setVariable', targetId: 'Trace', value: `[[Trace]]${text}` });
  list.interactions = [event([log('I[[This.itemCount]]|')], 'itemLoad')];
  child.interactions = [event([log('L|')], 'load')];
  doc.pages[0].widgets = [list, outside, button];
  const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, evaluateExpression) : createOfflineRuntime(doc, undefined, evaluateExpression);
  const action = async (...actions: Omit<Action, 'id'>[]) => { button.interactions = [event(actions)]; await runtime.trigger(button.id, 'click'); };
  return { doc, list, child, outside, button, runtime, action, log };
}

for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} empty repeater lifecycle`, () => {
  // Expectations come from the SHA-pinned native count/bounds/load-loop probe.
  for (const [count, limit, page, requests] of [[0, undefined, 1, 0], [3, undefined, 1, 1], [3, 2, 1, 1], [2, 2, 1, 0], [5, 2, 3, 0], [5, 2, 2, 1]] as const) {
    it(`clearing ${count} rows, limit ${limit ?? 'all'}, page ${page} requests ${requests} empty load`, async () => {
      const { runtime, list, action } = fixture(portable, count, limit, page);
      await runtime.start();
      await action({ type: 'setVariable', targetId: 'Trace', value: '' }, { type: 'deleteRow', targetId: list.id, value: 'all' });
      expect(runtime.state().variables.Trace).toBe('I0|L|'.repeat(requests));
      expect(runtime.rows(list)).toEqual([]);
      expect(runtime.state().sourceRowIds[list.id]).toEqual([]);
      expect(runtime.state().widgetOverrides).toEqual({});
      await action({ type: 'setVariable', targetId: 'Trace', value: '' }, { type: 'removeFilter', targetId: list.id, value: '{"all":true}' });
      expect(runtime.state().variables.Trace).toBe('');
      runtime.dispose();
    });
  }

  it('does not synthesize a row for initially empty data', async () => {
    const { runtime, list } = fixture(portable, 0); await runtime.start();
    expect(runtime.state().variables.Trace).toBe('');
    expect(runtime.rows(list)).toEqual([]);
    expect(runtime.repeaterInfo(list)).toEqual({ dataCount: 0, itemCount: 0, visibleItemCount: 0, pageCount: 1, pageIndex: 1 });
    runtime.dispose();
  });

  for (const named of [false, true]) it(`${named ? 'named' : 'legacy'} filtering to empty retains data and requests one load`, async () => {
    const { runtime, list, child, action } = fixture(portable);
    await runtime.start();
    await action({ type: 'setVariable', targetId: 'Trace', value: '' }, named
      ? { type: 'addFilter', targetId: list.id, value: JSON.stringify({ name: 'none', expression: '[[false]]', mode: 'all', removeOthers: false }) }
      : { type: 'filterRows', targetId: list.id, value: '{"column":"Name","operator":"equals","value":"missing"}' });
    expect(runtime.state().variables.Trace).toBe('I0|L|');
    expect(runtime.repeaterInfo(list)).toEqual({ dataCount: 3, itemCount: 0, visibleItemCount: 0, pageCount: 1, pageIndex: 1 });
    expect(runtime.state().sourceRowIds[list.id]).toHaveLength(3);
    await action({ type: 'setText', targetId: child.id, value: 'must not create a hidden instance' });
    expect(runtime.state().widgetOverrides).toEqual({});
    await action({ type: 'setVariable', targetId: 'Trace', value: '' }, { type: 'removeFilter', targetId: list.id, value: '{"all":true}' });
    expect(runtime.state().variables.Trace).toBe('I3|L|'.repeat(3));
    expect(runtime.rows(list)).toHaveLength(3);
    runtime.dispose();
  });

  it('uses initially committed data when Loaded filters all rows before the first item load', async () => {
    const { runtime, list } = fixture(portable);
    list.interactions.unshift(event([{ type: 'addFilter', targetId: list.id, value: '{"name":"none","expression":"[[false]]","mode":"all","removeOthers":false}' }], 'load'));
    await runtime.start();
    expect(runtime.state().variables.Trace).toBe('I0|L|');
    expect(runtime.rows(list)).toEqual([]);
    runtime.dispose();
  });

  it('does not add an empty callback when the same action segment restores a real row', async () => {
    const { runtime, list, action } = fixture(portable); await runtime.start();
    await action({ type: 'setVariable', targetId: 'Trace', value: '' }, { type: 'deleteRow', targetId: list.id, value: 'all' }, { type: 'addRow', targetId: list.id, value: '{"Name":"restored"}' });
    expect(runtime.state().variables.Trace).toBe('I1|L|');
    expect(runtime.rows(list).map(row => row.data.Name)).toEqual(['restored']);
    runtime.dispose();
  });

  it('keeps invalid source, absent target and ordinary target distinct in string expressions', async () => {
    const { runtime, list, outside, action } = fixture(portable); await runtime.start();
    list.interactions = [event([
      { type: 'setVariable', targetId: 'Snapshot', value: '[[This.dataCount]]/[[Item.valid]]/[[Item.index]]/[[Item.Name]]/[[TargetItem.Name]]/[[This.Repeater.itemCount]]' },
      { type: 'setText', targetId: outside.id, value: '[[Item.valid]]/[[Item.index]]/[[if(Item.index,"bad","absent")]]/[[Item.Name]]/[[TargetItem.valid]]/[[TargetItem.Repeater.itemCount]]' },
    ], 'itemLoad')];
    await action({ type: 'deleteRow', targetId: list.id, value: 'all' });
    expect(runtime.state().variables.Snapshot).toBe('0/[[Item.valid]]/[[Item.index]]/[[Item.Name]]/[[TargetItem.Name]]/0');
    expect(runtime.widget(outside).text).toBe('false/undefined/absent/[[Item.Name]]/false/[[TargetItem.Repeater.itemCount]]');
    runtime.dispose();
  });

  it('loads template children and every panel state without producing row instances', async () => {
    const { doc, runtime: discarded, list, child, outside, button, log } = fixture(portable); discarded.dispose();
    const panel = createWidget('panel'), one = createWidget('text'), two = createWidget('text'), nested = createWidget('repeater');
    panel.states = [{ id: uid(), name: 'one', widgets: [one] }, { id: uid(), name: 'two', widgets: [two] }]; panel.activeStateId = panel.states[0].id;
    one.interactions = [event([log('one|')], 'load')]; two.interactions = [event([log('two|')], 'load')];
    child.interactions = [event([{ type: 'setText', targetId: child.id, value: 'no instance' }, { type: 'setText', targetId: outside.id, value: 'empty children ran' }], 'load')];
    list.repeater!.template.push(panel, nested);
    const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, evaluateExpression) : createOfflineRuntime(doc, undefined, evaluateExpression);
    await runtime.start();
    button.interactions = [event([{ type: 'setVariable', targetId: 'Trace', value: '' }, { type: 'deleteRow', targetId: list.id, value: 'all' }])];
    await runtime.trigger(button.id, 'click');
    expect(runtime.state().variables.Trace).toBe('I0|one|two|');
    expect(runtime.widget(outside).text).toBe('empty children ran');
    expect(Object.keys(runtime.state().sourceRows)).toEqual([list.id]);
    expect(Object.keys(runtime.state().widgetOverrides)).toEqual([outside.id]);
    runtime.dispose();
  });

  it('ignores synchronous self mutations, allows Wait recovery and keeps the waiting Item invalid', async () => {
    const { runtime, list, action } = fixture(portable); await runtime.start();
    list.interactions = [event([
      { type: 'addRow', targetId: list.id, value: '{"Name":"ignored"}' },
      { type: 'markRows', targetId: list.id, value: '{"row":"all"}' },
      { type: 'wait', duration: 0 },
      { type: 'addRow', targetId: list.id, value: '{"Name":"restored"}' },
      { type: 'setVariable', targetId: 'After', value: '[[Item.index]]/[[This.dataCount]]' },
    ], 'itemLoad')];
    list.interactions[0].conditions = [{ source: 'variable', key: 'Recover', operator: 'equals', value: 'yes' }];
    list.interactions[0].actions.splice(2, 0, { id: uid(), type: 'setVariable', targetId: 'Recover', value: 'no' });
    await action({ type: 'setVariable', targetId: 'Recover', value: 'yes' }, { type: 'deleteRow', targetId: list.id, value: 'all' });
    expect(runtime.rows(list).map(row => row.data.Name)).toEqual(['restored']);
    expect(runtime.state().variables.After).toBe('[[Item.index]]/1');
    expect(runtime.state().markedRowIds[list.id]).toEqual([]);
    runtime.dispose();
  });

  it('enumerates only visible target rows and binds TargetItem separately for each target', async () => {
    const { runtime, list, child, action } = fixture(portable, 3, 2); await runtime.start();
    const hidden = runtime.state().sourceRowIds[list.id][2], hiddenContext = [{ repeaterId: list.id, rowId: hidden }];
    await action({ type: 'setText', targetId: child.id, value: '[[TargetItem.Name]]/[[Item.Name]]' });
    expect(runtime.rows(list).map(row => runtime.widget(child, row.context).text)).toEqual(['1/1', '2/2']);
    expect(runtime.hasOverride(child.id, 'text', hiddenContext)).toBe(false);
    runtime.dispose();
  });

  it('uses the committed target instances until a queued filter refresh rebuilds them', async () => {
    const { runtime, list, child, action } = fixture(portable); await runtime.start();
    child.interactions = [event([{ type: 'setVariable', targetId: 'Selected', value: '[[Selected + 1]]' }], 'select')];
    await action({ type: 'setVariable', targetId: 'Selected', value: '0' }, { type: 'filterRows', targetId: list.id, value: '{"column":"Name","operator":"equals","value":"missing"}' }, { type: 'setSelected', targetId: child.id, value: 'true' });
    expect(runtime.state().variables.Selected).toBe('3');
    expect(runtime.rows(list)).toEqual([]);
    expect(Object.keys(runtime.state().widgetOverrides)).toEqual([]);
    runtime.dispose();
  });

  it('allows empty events to target real rows in another repeater without inventing source rows', async () => {
    const { doc, runtime: discarded, list, button } = fixture(portable); discarded.dispose();
    const other = createWidget('repeater'), label = createWidget('text');
    other.repeater = { columns: ['Name'], rows: [{ Name: 'X' }, { Name: 'Y' }, { Name: 'Z' }], template: [label], itemHeight: 30, gap: 0, pagination: { itemsPerPage: 2, startPage: 1 } };
    doc.pages[0].widgets.push(other);
    const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, evaluateExpression) : createOfflineRuntime(doc, undefined, evaluateExpression);
    await runtime.start();
    list.interactions = [event([{ type: 'setText', targetId: label.id, value: '[[Item.valid]]/[[Item.Name]]/[[TargetItem.index]]/[[This.itemCount]]' }], 'itemLoad')];
    button.interactions = [event([{ type: 'deleteRow', targetId: list.id, value: 'all' }])]; await runtime.trigger(button.id, 'click');
    expect(runtime.rows(other).map(row => runtime.widget(label, row.context).text)).toEqual(['true/X/1/0', 'true/Y/2/0']);
    expect(runtime.rows(list)).toEqual([]);
    expect(runtime.state().sourceRows[other.id]).toHaveLength(3);
    runtime.dispose();
  });

  it('keeps the empty frame invalid if another event adds rows during its Wait', async () => {
    vi.useFakeTimers();
    const { runtime, list, button, action } = fixture(portable);
    try {
      await runtime.start();
      list.interactions = [event([{ type: 'wait', duration: 50 }, { type: 'setVariable', targetId: 'Delayed', value: '[[Item.valid]]/[[This.dataCount]]' }], 'itemLoad')];
      const pending = action({ type: 'deleteRow', targetId: list.id, value: 'all' }); await Promise.resolve(); await Promise.resolve();
      expect(vi.getTimerCount()).toBe(1);
      list.interactions = [];
      button.interactions = [event([{ type: 'addRow', targetId: list.id, value: '{"Name":"new"}' }])]; await runtime.trigger(button.id, 'click');
      await vi.advanceTimersByTimeAsync(50); await pending;
      expect(runtime.state().variables.Delayed).toBe('[[Item.valid]]/1');
      expect(runtime.rows(list)).toHaveLength(1);
    } finally { runtime.dispose(); vi.useRealTimers(); }
  });

  it('cancels pending empty-template waits on page navigation', async () => {
    vi.useFakeTimers();
    const { doc, runtime, list, child, action } = fixture(portable);
    try {
      await runtime.start();
      child.interactions = [event([{ type: 'wait', duration: 60000 }, { type: 'setVariable', targetId: 'Stale', value: 'must not run' }], 'load')];
      const second = { ...structuredClone(doc.pages[0]), id: uid(), name: 'Second', widgets: [], interactions: [] }; doc.pages.push(second);
      const pending = action({ type: 'deleteRow', targetId: list.id, value: 'all' }); await Promise.resolve(); await Promise.resolve();
      expect(vi.getTimerCount()).toBe(1);
      await runtime.navigate(second.id); await pending;
      expect(runtime.state().variables.Stale).toBeUndefined(); expect(vi.getTimerCount()).toBe(0);
    } finally { runtime.dispose(); vi.useRealTimers(); }
  });

  it('retains invalid Item binding when an empty load is selected later from a Case menu', async () => {
    const { doc, runtime, list, action } = fixture(portable); await runtime.start();
    list.interactions = [event([{ type: 'setVariable', targetId: 'Chosen', value: '[[Item.index]]/[[This.dataCount]]' }], 'itemLoad')];
    list.interactions[0].id = 'empty-choice';
    doc.caseSelection = 'always';
    // execute bypasses the button menu; the generated Item loaded menu remains.
    await runtime.execute(event([{ type: 'deleteRow', targetId: list.id, value: 'all' }]));
    const menu = runtime.state().caseMenus!.find(menu => menu.sourceId === list.id)!;
    expect(menu.event).toBe('itemLoad');
    doc.caseSelection = 'never'; list.interactions = [];
    await action({ type: 'addRow', targetId: list.id, value: '{"Name":"new"}' });
    await runtime.selectCase(menu.id, 'empty-choice');
    expect(runtime.state().variables.Chosen).toBe('[[Item.index]]/1');
    runtime.dispose();
  });

  it('exposes the owning repeater from a template Loaded event even without row DOM', async () => {
    const { runtime, list, child, action } = fixture(portable, 3, 2); await runtime.start();
    child.interactions = [event([{ type: 'setVariable', targetId: 'Owner', value: '[[This.Repeater.dataCount]]/[[This.Repeater.itemCount]]/[[This.Repeater.visibleItemCount]]/[[This.Repeater.pageCount]]/[[This.Repeater.pageIndex]]' }], 'load')];
    await action({ type: 'addFilter', targetId: list.id, value: '{"name":"none","expression":"[[false]]","mode":"all","removeOthers":false}' });
    expect(runtime.state().variables.Owner).toBe('3/0/0/0/1');
    expect(Object.keys(runtime.state().sourceRows)).toEqual([list.id]);
    runtime.dispose();
  });

  it('evaluates recovered row cells against the repeater container before adding the row', async () => {
    const { runtime, list, action } = fixture(portable); await runtime.start();
    list.interactions = [event([{ type: 'setVariable', targetId: 'Recover', value: 'no' }, { type: 'wait', duration: 0 }, { type: 'addRow', targetId: list.id, value: '{"Name":"[[Item.valid]]/[[Item.Name]]/[[TargetItem.Name]]/[[This.dataCount]]"}' }], 'itemLoad')];
    list.interactions[0].conditions = [{ source: 'variable', key: 'Recover', operator: 'equals', value: 'yes' }];
    await action({ type: 'setVariable', targetId: 'Recover', value: 'yes' }, { type: 'deleteRow', targetId: list.id, value: 'all' });
    expect(runtime.rows(list).map(row => row.data.Name)).toEqual(['false/[[Item.Name]]/[[TargetItem.Name]]/0']);
    runtime.dispose();
  });
});
