import { afterEach, describe, expect, it, vi } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createPage, createWidget, uid } from '../src/model/document';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import type { Action, EventType, Interaction } from '../src/model/types';

const interaction = (actions: Omit<Action, 'id'>[], event: EventType = 'click'): Interaction => ({ id: uid(), event, name: event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(a => ({ ...a, id: uid() })) });
const variable = (name: string, value: string): Omit<Action, 'id'> => ({ type: 'setVariable', targetId: name, value });
afterEach(() => vi.useRealTimers());

for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} Wait scheduling`, () => {
  function fixture() {
    vi.useFakeTimers();
    const doc = createDocument(), delayed = createWidget('button'), fast = createWidget('button');
    doc.variables.Trace = ''; doc.pages[0].widgets = [delayed, fast];
    const make = (): OfflineRuntime => portable
      ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, evaluateExpression)
      : createOfflineRuntime(doc, undefined, evaluateExpression);
    return { doc, delayed, fast, make };
  }

  it('commits the prefix, releases other events, and reads variables again after waiting', async () => {
    const { doc, delayed, fast, make } = fixture(); doc.variables.Value = 'initial';
    delayed.interactions = [interaction([variable('Trace', 'prefix|'), { type: 'wait', duration: 100 }, variable('Trace', '[[Trace]][[Value]]|')])];
    fast.interactions = [interaction([variable('Value', 'live'), variable('Trace', '[[Trace]]fast|')])];
    const runtime = make(); let completed = false;
    const pending = runtime.trigger(delayed.id, 'click').then(() => { completed = true; });
    await runtime.trigger(fast.id, 'click');
    expect(runtime.state().variables.Trace).toBe('prefix|fast|'); expect(completed).toBe(false);
    await vi.advanceTimersByTimeAsync(100); await pending;
    expect(runtime.state().variables.Trace).toBe('prefix|fast|live|');
    runtime.dispose();
  });

  it('evaluates a later independent case after the first prefix without awaiting its continuation', async () => {
    const { delayed, make } = fixture();
    const second = interaction([variable('Trace', '[[Trace]]second|'), variable('Value', 'second')]);
    second.conditions = [{ source: 'variable', key: 'Value', operator: 'equals', value: 'prefix' }];
    delayed.interactions = [interaction([variable('Value', 'prefix'), { type: 'wait', duration: 100 }, variable('Trace', '[[Trace]][[Value]]-tail|')]), second];
    const runtime = make(), pending = runtime.trigger(delayed.id, 'click');
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.state().variables.Trace).toBe('second|');
    await vi.advanceTimersByTimeAsync(100); await pending;
    expect(runtime.state().variables.Trace).toBe('second|second-tail|');
    runtime.dispose();
  });

  it('makes a zero-duration wait yield to the event loop', async () => {
    const { delayed, fast, make } = fixture();
    delayed.interactions = [interaction([variable('Trace', 'prefix|'), { type: 'wait', duration: 0 }, variable('Trace', '[[Trace]]tail|')])];
    fast.interactions = [interaction([variable('Trace', '[[Trace]]fast|')])];
    const runtime = make(), pending = runtime.trigger(delayed.id, 'click');
    await runtime.trigger(fast.id, 'click');
    expect(runtime.state().variables.Trace).toBe('prefix|fast|');
    await vi.runOnlyPendingTimersAsync(); await pending;
    expect(runtime.state().variables.Trace).toBe('prefix|fast|tail|');
    runtime.dispose();
  });

  it('does not block page, child, or later item initialization and releases the refresh guard', async () => {
    const { doc, make } = fixture(), repeater = createWidget('repeater'), child = createWidget('text');
    repeater.repeater = { columns: ['Name', 'Done'], rows: [{ Name: 'A', Done: '' }, { Name: 'B', Done: '' }], template: [child], itemHeight: 40, gap: 0 };
    doc.pages[0].widgets.push(repeater);
    doc.pages[0].interactions = [interaction([variable('Trace', 'P|'), { type: 'wait', duration: 200 }, variable('Trace', '[[Trace]]PT|')], 'load')];
    const each = interaction([variable('Trace', '[[Trace]]I[[Item.Name]]|'), { type: 'wait', duration: 100 }, { type: 'updateRow', targetId: repeater.id, value: '{"row":"this","values":{"Done":"yes"}}' }], 'itemLoad');
    each.conditions = [{ source: 'variable', key: 'Ready', operator: 'notEquals', value: 'yes' }];
    repeater.interactions = [each];
    child.interactions = [interaction([variable('Trace', '[[Trace]]L[[Item.Name]]|')], 'load')];
    const runtime = make(), pending = runtime.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.state().variables.Trace).toBe('P|IA|LA|IB|LB|');
    // Stop future Item loaded handlers, while already scheduled continuations still run.
    runtime.state().variables.Ready = 'yes';
    await vi.advanceTimersByTimeAsync(100);
    expect(runtime.rows(repeater).map(row => row.data.Done)).toEqual(['yes', 'yes']);
    await vi.advanceTimersByTimeAsync(100); await pending;
    expect(runtime.state().variables.Trace.endsWith('PT|')).toBe(true);
    runtime.dispose();
  });

  it('retains event Item display metadata but reads live row data and widget values in the continuation', async () => {
    const { doc, fast, make } = fixture(), repeater = createWidget('repeater'), cell = createWidget('button'), input = createWidget('input');
    repeater.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }], template: [cell], itemHeight: 40, gap: 0 };
    doc.pages[0].widgets.push(repeater, input);
    cell.interactions = [interaction([{ type: 'wait', duration: 100 }, variable('Trace', `[[Item.Name]]|[[Item.index]]|[[Widget.${input.id}.text]]`)])];
    fast.interactions = [interaction([{ type: 'updateRow', targetId: repeater.id, value: '{"row":0,"values":{"Name":"C"}}' }, { type: 'sortRows', targetId: repeater.id, value: 'Name:asc' }])];
    const runtime = make(); await runtime.start();
    const row = runtime.rows(repeater)[0], pending = runtime.trigger(cell.id, 'click', row.data, row.context);
    await runtime.trigger(fast.id, 'click'); runtime.input(input.id, 'new input');
    expect(runtime.rows(repeater).map(row => row.data.Name)).toEqual(['B', 'C']);
    await vi.advanceTimersByTimeAsync(100); await pending;
    expect(runtime.state().variables.Trace).toBe('C|1|new input');
    runtime.dispose();
  });

  it('flushes prefix data changes before waiting, then refreshes changes made by the continuation', async () => {
    const { doc, delayed, make } = fixture(), repeater = createWidget('repeater'), child = createWidget('text');
    repeater.repeater = { columns: ['Name'], rows: [{ Name: 'before' }], template: [child], itemHeight: 40, gap: 0 };
    repeater.interactions = [interaction([{ type: 'setText', targetId: child.id, value: '[[Item.Name]]' }], 'itemLoad')];
    doc.pages[0].widgets.push(repeater);
    delayed.interactions = [interaction([{ type: 'updateRow', targetId: repeater.id, value: '{"row":0,"values":{"Name":"prefix"}}' }, { type: 'wait', duration: 100 }, { type: 'updateRow', targetId: repeater.id, value: '{"row":0,"values":{"Name":"tail"}}' }])];
    const runtime = make(); await runtime.start(); const pending = runtime.trigger(delayed.id, 'click');
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.widget(child, runtime.rows(repeater)[0].context).text).toBe('prefix');
    await vi.advanceTimersByTimeAsync(100); await pending;
    expect(runtime.widget(child, runtime.rows(repeater)[0].context).text).toBe('tail');
    runtime.dispose();
  });

  it('rolls back only a failing continuation, retaining the prefix and another committed event', async () => {
    const { delayed, fast, make } = fixture();
    delayed.interactions = [interaction([variable('Prefix', 'committed'), { type: 'wait', duration: 100 }, variable('Tail', 'temporary'), variable('Failure', '[[1 / 0]]')])];
    fast.interactions = [interaction([variable('Other', 'committed'), variable('Tail', 'outside')])];
    const runtime = make(), rejected = expect(runtime.trigger(delayed.id, 'click')).rejects.toThrow(/division by zero/);
    await runtime.trigger(fast.id, 'click');
    await vi.advanceTimersByTimeAsync(100); await rejected;
    expect(runtime.state().variables).toMatchObject({ Prefix: 'committed', Other: 'committed', Tail: 'outside' });
    expect(runtime.state().variables.Failure).toBeUndefined();
    await runtime.trigger(fast.id, 'click'); runtime.dispose();
  });

  it('cancels an old page generation even after navigating away and back before its timer expires', async () => {
    const { doc, delayed, make } = fixture(); const other = createPage('Other'); doc.pages.push(other);
    delayed.interactions = [interaction([{ type: 'wait', duration: 100 }, variable('Trace', 'stale')])];
    const runtime = make(), pending = runtime.trigger(delayed.id, 'click');
    await runtime.navigate(other.id); await runtime.navigate(doc.pages[0].id); await pending;
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(runtime.state().variables.Trace).toBe('');
    runtime.dispose();
  });

  it('retains another pending event when navigation is rolled back by a synchronous error', async () => {
    const { doc, delayed, fast, make } = fixture(), other = createPage('Other'); doc.pages.push(other);
    delayed.interactions = [interaction([{ type: 'wait', duration: 100 }, variable('Trace', 'still active')])];
    fast.interactions = [interaction([{ type: 'openPage', targetId: other.id }, variable('Bad', '[[1 / 0]]')])];
    const runtime = make(), pending = runtime.trigger(delayed.id, 'click');
    await expect(runtime.trigger(fast.id, 'click')).rejects.toThrow(/division by zero/);
    expect(runtime.state().pageId).toBe(doc.pages[0].id);
    expect(runtime.state().pendingNavigation).toBeUndefined();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(100); await pending;
    expect(runtime.state().variables.Trace).toBe('still active');
    runtime.dispose();
  });

  it('continues synchronous actions after navigation and cancels tails at simulated page unload', async () => {
    const { doc, delayed, make } = fixture(), other = createPage('Other'); doc.pages.push(other);
    delayed.interactions = [interaction([{ type: 'openPage', targetId: other.id }, variable('Trace', 'sync-after-navigation'), { type: 'wait', duration: 0 }, variable('Trace', 'stale-tail')])];
    const runtime = make(); await runtime.trigger(delayed.id, 'click');
    expect(runtime.state().pageId).toBe(other.id);
    expect(runtime.state().variables.Trace).toBe('sync-after-navigation');
    expect(vi.getTimerCount()).toBe(0); runtime.dispose();
  });
});
