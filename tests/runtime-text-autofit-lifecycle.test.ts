import { Script } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../src/model/document';
import { createOfflineRuntime, type OfflineRuntime, type RowContext, type ShapeTextMeasurement } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import type { Action, Document, EventType, Interaction, Widget } from '../src/model/types';

// These are core scheduling/identity tests. Candidate dimensions come from an
// explicit fake host, not a font estimator or a browser measurement oracle.
const sessions: OfflineRuntime[] = [];
afterEach(() => { for (const runtime of sessions.splice(0)) runtime.dispose(); });
const event = (type: EventType, ...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: type, event: type, enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(a => ({ ...a, id: uid() })) });
const setText = (widget: Widget, value = 'Changed'): Omit<Action, 'id'> => ({ type: 'setText', targetId: widget.id, value });
const contextKey = (context: RowContext = []) => JSON.stringify(context);
function shape() {
  const widget = createWidget('box', 10, 20);
  Object.assign(widget, { width: 80.25, height: 40.5, text: 'Initial', shapeText: { autoFitWidth: true, autoFitHeight: true } });
  Object.assign(widget.style, { textPadding: [0, 0, 0, 0], verticalAlign: 'top', textAlign: 'left' });
  return widget;
}
function fixture(nested = false) {
  const doc = createDocument(), target = shape(), list = createWidget('repeater'), button = createWidget('button');
  button.interactions = [event('click', setText(target, '[[Item.Name]]'))];
  list.repeater = { columns: ['Name'], rows: [{ Name: 'Same' }, { Name: 'Same' }], template: [target, button], itemHeight: 70, gap: 0 };
  let outer: Widget | undefined;
  if (nested) {
    outer = createWidget('repeater');
    outer.repeater = { columns: ['Name'], rows: [{ Name: 'Parent A' }, { Name: 'Parent B' }], template: [list], itemHeight: 180, gap: 0 };
  }
  doc.pages[0].widgets = [outer ?? list]; doc.caseSelection = 'never';
  return { doc, target, list, button, outer };
}
function make(doc: Document, portable: boolean) {
  const runtime: OfflineRuntime = portable
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, evaluateExpression)
    : createOfflineRuntime(doc, undefined, evaluateExpression);
  sessions.push(runtime); return runtime;
}
function fakeHost(runtime: OfflineRuntime, widgets: Widget[]) {
  const calls: { id: string; context: RowContext; widget: Widget; loads: string | undefined }[] = [];
  const byId = new Map(widgets.map(w => [w.id, w]));
  const adapter = {
    effective: (widget: Widget, context: RowContext): Widget => runtime.widget(widget, context),
    candidate: (_widget: Widget, _context: RowContext) => ({ width: 120.75, height: 50.25 }),
    failure: undefined as ((widget: Widget, context: RowContext) => void) | undefined,
  };
  runtime.bindControls({ flush: () => {}, focus: () => {}, selectText: () => {},
    measureShapeText: (id, context): ShapeTextMeasurement => {
      const original = byId.get(id); expect(original, 'host received an unexpected target').toBeDefined();
      const current = adapter.effective(original!, context);
      calls.push({ id, context: structuredClone(context), widget: structuredClone(current), loads: runtime.state().variables.Loads });
      adapter.failure?.(current, context);
      return { ...adapter.candidate(current, context), rect: { x: current.x, y: current.y, width: current.width, height: current.height }, textAlign: current.style.textAlign, verticalAlign: current.style.verticalAlign ?? 'top' };
    },
  });
  return { calls, adapter };
}

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} AutoFit lifecycle (fake DOM host)`, () => {
  it('isolates identical row values by full instance context and remeasures only the registered row', async () => {
    const { doc, target, list, button } = fixture(), saved = serializeDocument(doc), runtime = make(doc, portable), { calls, adapter } = fakeHost(runtime, [target]);
    await runtime.start(); const [a, b] = runtime.rows(list);
    await runtime.trigger(button.id, 'click', b.data, b.context);
    expect(calls.map(c => c.context)).toEqual([b.context]);
    expect(runtime.nativeTextSet(target.id, a.context)).toBe(false); expect(runtime.nativeTextSet(target.id, b.context)).toBe(true);
    expect(runtime.nativeTextSet(target.id)).toBe(false);
    expect(runtime.widget(target, a.context)).toMatchObject({ text: 'Initial', width: 80.25, height: 40.5 });
    expect(runtime.widget(target, b.context)).toMatchObject({ text: 'Same', width: 120.75, height: 50.25 });
    expect(Object.values(runtime.state().scopes)).toContainEqual(b.context);
    calls.length = 0; adapter.candidate = () => ({ width: 91.5, height: 61.25 }); await runtime.updateAutoFitted(false);
    expect(calls.map(c => c.context)).toEqual([b.context]); expect(runtime.widget(target, b.context).width).toBe(91.5);
    expect(runtime.widget(target, a.context).width).toBe(80.25); expect(serializeDocument(doc)).toBe(saved);
  });

  it('registers each visible row for an external SetText instead of measuring the template or reusing the first row', async () => {
    const { doc, target, list } = fixture(), runtime = make(doc, portable), { calls, adapter } = fakeHost(runtime, [target]);
    await runtime.start(); const rows = runtime.rows(list);
    adapter.candidate = (_w, context) => ({ width: context.at(-1)!.rowId === rows[0].id ? 101.25 : 202.5, height: 33.75 });
    await runtime.execute(event('click', setText(target, 'All')));
    expect(calls.map(c => c.context)).toEqual(rows.map(r => r.context));
    expect(rows.map(row => runtime.widget(target, row.context).width)).toEqual([101.25, 202.5]);
    calls.length = 0; await runtime.updateAutoFitted(false);
    expect(calls.map(c => c.context)).toEqual(rows.map(r => r.context)); expect(target.text).toBe('Initial');
  });

  it.each(['sortRows', 'filterRows'] as const)('clears even zero-delta registrations and setter markers when %s rebuilds rows', async type => {
    const { doc, target, list } = fixture(), runtime = make(doc, portable), { calls, adapter } = fakeHost(runtime, [target]);
    await runtime.start(); const beforeRows = runtime.rows(list);
    adapter.candidate = w => ({ width: w.width, height: w.height });
    await runtime.execute(event('click', setText(target, target.text)));
    for (const row of beforeRows) { expect(runtime.nativeTextSet(target.id, row.context)).toBe(true); expect(runtime.hasOverride(target.id, 'width', row.context)).toBe(false); }
    calls.length = 0;
    await runtime.execute(event('click', { type, targetId: list.id, value: type === 'sortRows' ? 'Name:desc' : '{"column":"Name","operator":"equals","value":"Same"}' }));
    expect(runtime.rows(list).map(row => row.id)).toEqual(beforeRows.map(row => row.id));
    expect(runtime.rows(list)[0].revision).toBeGreaterThan(beforeRows[0].revision);
    for (const row of beforeRows) expect(runtime.nativeTextSet(target.id, row.context)).toBe(false);
    await runtime.updateAutoFitted(false); expect(calls).toEqual([]);
  });

  it('deleting a registered row prevents stale callbacks from measuring it or resizing its survivor', async () => {
    const { doc, target, list, button } = fixture(), runtime = make(doc, portable), { calls } = fakeHost(runtime, [target]);
    await runtime.start(); const [removed, survivor] = runtime.rows(list);
    await runtime.trigger(button.id, 'click', removed.data, removed.context);
    await runtime.execute(event('click', { type: 'deleteRow', targetId: list.id, value: '0' }));
    expect(runtime.rows(list).map(row => row.id)).toEqual([survivor.id]);
    expect(runtime.nativeTextSet(target.id, removed.context)).toBe(false);
    expect(Object.values(runtime.state().scopes).some(context => context.some(row => row.rowId === removed.id))).toBe(false);
    calls.length = 0; await runtime.trigger(button.id, 'click', removed.data, removed.context); await runtime.updateAutoFitted(false);
    expect(calls).toEqual([]); expect(runtime.widget(target, survivor.context)).toMatchObject({ width: target.width, text: target.text });
    await runtime.trigger(button.id, 'click', survivor.data, survivor.context);
    expect(calls.map(c => c.context)).toEqual([survivor.context]);
  });

  it('keeps all nested parent/child row identities and drops descendant registrations on parent removal', async () => {
    const { doc, target, list, button, outer } = fixture(true), runtime = make(doc, portable), { calls } = fakeHost(runtime, [target]);
    await runtime.start(); const parents = runtime.rows(outer!), groups = parents.map(parent => runtime.rows(list, parent.context)), children = groups.flat();
    await runtime.trigger(button.id, 'click', groups[1][0].data, groups[1][0].context);
    expect(calls[0].context).toEqual(groups[1][0].context); expect(calls[0].context).toHaveLength(2);
    expect(runtime.nativeTextSet(target.id, groups[0][0].context)).toBe(false);
    calls.length = 0; await runtime.execute(event('click', setText(target, 'Every child')));
    expect(calls.map(c => contextKey(c.context))).toEqual(children.map(c => contextKey(c.context)));
    expect(new Set(calls.map(c => contextKey(c.context))).size).toBe(4);
    calls.length = 0; await runtime.execute(event('click', { type: 'deleteRow', targetId: outer!.id, value: '0' }));
    await runtime.updateAutoFitted(false); expect(calls).toEqual([]);
    for (const child of children) expect(runtime.nativeTextSet(target.id, child.context)).toBe(false);
    expect(Object.values(runtime.state().scopes).some(scope => scope.some(row => row.rowId === parents[0].id))).toBe(false);
  });

  it('clears registrations on page navigation and does not transfer them to new row identities when returning', async () => {
    const { doc, target, list, button } = fixture(), otherPage = createPage('Other'); doc.pages.push(otherPage);
    const saved = serializeDocument(doc), runtime = make(doc, portable), { calls } = fakeHost(runtime, [target]);
    await runtime.start(); const originalRows = runtime.rows(list);
    await runtime.trigger(button.id, 'click', originalRows[0].data, originalRows[0].context);
    calls.length = 0; await runtime.navigate(otherPage.id); await runtime.updateAutoFitted(false);
    expect(calls).toEqual([]); expect(runtime.nativeTextSet(target.id, originalRows[0].context)).toBe(false);
    await runtime.navigate(doc.pages[0].id); const fresh = runtime.rows(list);
    expect(fresh[0].id).not.toBe(originalRows[0].id); await runtime.updateAutoFitted(false); expect(calls).toEqual([]);
    expect(fresh.every(row => !runtime.nativeTextSet(target.id, row.context))).toBe(true); expect(serializeDocument(doc)).toBe(saved);
  });

  it('remeasures current host styles while retaining the two-axis resize cache until an explicit adaptive transition', async () => {
    const doc = createDocument(), target = shape(), untouched = shape(); doc.pages[0].widgets = [target, untouched]; doc.caseSelection = 'never';
    target.shapeText = { autoFitWidth: false, autoFitHeight: true };
    const saved = serializeDocument(doc), runtime = make(doc, portable), { calls, adapter } = fakeHost(runtime, [target]);
    let view: Widget = target;
    adapter.effective = (_w, context) => runtime.widget(view, context);
    adapter.candidate = () => ({ width: 999, height: 50.25 });
    await runtime.execute(event('click', setText(target, 'Adaptive content')));
    view = { ...target, x: 45.5, y: 70.25, width: 61.125, height: 20.5, style: { ...target.style, fontSize: 28, textPadding: [4, 8, 12, 16], verticalAlign: 'bottom' } };
    adapter.candidate = () => ({ width: 777, height: 90.75 }); calls.length = 0;
    await runtime.updateAutoFitted(false);
    // Native query.resize caches both axes, even for height-only AutoFit.
    // expr.js updateAutoFitted:400–404 only remeasures. Actual view switching
    // separately clears geometry in adaptive.js:69–87,137/145 before calling it.
    expect(calls).toHaveLength(1); expect(calls[0].widget).toMatchObject({ x: 45.5, y: 70.25, width: 80.25, height: 50.25, style: { fontSize: 28, textPadding: [4, 8, 12, 16], verticalAlign: 'bottom' } });
    expect(runtime.widget(view)).toMatchObject({ x: 45.5, y: 29.75, width: 80.25, height: 90.75 });
    expect(runtime.hasOverride(target.id, 'width')).toBe(true); expect(runtime.widget(untouched)).toMatchObject({ width: 80.25, height: 40.5 });
    calls.length = 0; await runtime.updateAutoFitted(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].widget).toMatchObject({ x: 45.5, y: 70.25, width: 61.125, height: 20.5, text: 'Adaptive content', style: { fontSize: 28, textPadding: [4, 8, 12, 16] } });
    expect(runtime.widget(view)).toMatchObject({ x: 45.5, y: 0, width: 61.125, height: 90.75 });
    expect(runtime.nativeTextSet(target.id)).toBe(true);
    expect(serializeDocument(doc)).toBe(saved);
  });

  it('resets supported shape movement/size/rotation on view transition but keeps its text, registration and other state', async () => {
    const doc = createDocument(), target = shape(), legacy = createWidget('input'); target.rotation = 25;
    target.richText = { paragraphs: [{ runs: [{ text: target.text, style: { fontStyle: 'italic' } }] }] };
    doc.pages[0].widgets = [target, legacy]; doc.caseSelection = 'never';
    const saved = serializeDocument(doc), runtime = make(doc, portable), { calls } = fakeHost(runtime, [target]);
    await runtime.execute(event('click', setText(target, 'Kept content'),
      { type: 'move', targetId: target.id, x: 400.5, y: 600.25 },
      { type: 'resize', targetId: target.id, x: 500.75, y: 110.25 },
      { type: 'setSelected', targetId: target.id, value: 'true' },
      { type: 'setStyle', targetId: target.id, style: { color: '#123456' } },
      { type: 'move', targetId: legacy.id, x: 900, y: 950 }));
    // Restored runtime snapshots can contain a rotation override, although this
    // product has no authored Rotate action yet. Test that cache explicitly.
    runtime.state().widgetOverrides[target.id].rotation = 123;
    expect(runtime.widget(target)).toMatchObject({ x: 400.5, y: 600.25, width: 500.75, height: 110.25, rotation: 123 });
    calls.length = 0; await runtime.updateAutoFitted(true);
    expect(calls).toHaveLength(1); expect(calls[0].widget).toMatchObject({ x: 10, y: 20, width: 80.25, height: 40.5, rotation: 25, text: 'Kept content', selected: true, style: { color: '#123456' } });
    expect(runtime.widget(target)).toMatchObject({ x: 10, y: 20, width: 120.75, height: 50.25, rotation: 25, richText: { paragraphs: [{ runs: [{ text: 'Kept content', style: { fontStyle: 'italic' } }] }] } });
    expect(runtime.widget(legacy)).toMatchObject({ x: 900, y: 950 }); // Reset scope is the supported shape subset.
    expect(runtime.nativeTextSet(target.id)).toBe(true); expect(serializeDocument(doc)).toBe(saved);
  });

  it('distinguishes registered-only remeasurement from an explicit repeater refresh with new ItemLoaded setters', async () => {
    const { doc, target, list } = fixture(); doc.variables.Loads = '0';
    list.interactions = [event('itemLoad', { type: 'setVariable', targetId: 'Loads', value: '[[Loads + 1]]' }, setText(target, '[[Item.Name]]'))];
    const saved = serializeDocument(doc), runtime = make(doc, portable), { calls } = fakeHost(runtime, [target]);
    await runtime.start(); expect(runtime.state().variables.Loads).toBe('2'); const before = runtime.rows(list);
    calls.length = 0; await runtime.updateAutoFitted(false);
    expect(runtime.state().variables.Loads).toBe('2'); expect(calls.map(c => c.context)).toEqual(before.map(row => row.context));
    calls.length = 0; await runtime.updateAutoFitted(true);
    expect(runtime.state().variables.Loads).toBe('4'); expect(runtime.rows(list)[0].revision).toBeGreaterThan(before[0].revision);
    // Each refreshed row's setter measures immediately. A subsequent registry
    // pass may measure it again; it must not measure either stale instance first.
    expect(calls.length).toBeGreaterThanOrEqual(2); expect(calls.every(c => Number(c.loads) > 2)).toBe(true);
    expect(new Set(calls.map(c => contextKey(c.context)))).toEqual(new Set(runtime.rows(list).map(row => contextKey(row.context))));
    expect(runtime.rows(list).every(row => runtime.nativeTextSet(target.id, row.context))).toBe(true); expect(serializeDocument(doc)).toBe(saved);
  });

  it('rolls back a failed new row registration without losing a previously committed row registration', async () => {
    const { doc, target, list, button } = fixture(), runtime = make(doc, portable), { calls } = fakeHost(runtime, [target]);
    await runtime.start(); const [a, b] = runtime.rows(list);
    await runtime.trigger(button.id, 'click', a.data, a.context); const before = structuredClone(runtime.state());
    button.interactions = [event('click', setText(target, 'Failing row'), { type: 'setSelected', targetId: target.id, value: 'invalid' })];
    await expect(runtime.trigger(button.id, 'click', b.data, b.context)).rejects.toThrow();
    expect(runtime.state()).toEqual(before); expect(runtime.nativeTextSet(target.id, a.context)).toBe(true); expect(runtime.nativeTextSet(target.id, b.context)).toBe(false);
    calls.length = 0; await runtime.updateAutoFitted(false); expect(calls.map(c => c.context)).toEqual([a.context]);
  });

  it('rolls back all partial geometry if a registered adaptive remeasurement fails, then remains usable', async () => {
    const { doc, target, list } = fixture(), runtime = make(doc, portable), { calls, adapter } = fakeHost(runtime, [target]);
    await runtime.start(); const [a, b] = runtime.rows(list); await runtime.execute(event('click', setText(target)));
    const before = structuredClone(runtime.state()); adapter.candidate = () => ({ width: 333.25, height: 55.75 });
    adapter.failure = (_w, context) => { if (contextKey(context) === contextKey(b.context)) throw new Error('Second row measurement failed'); };
    await expect(runtime.updateAutoFitted(false)).rejects.toThrow('Second row measurement failed');
    expect(runtime.state()).toEqual(before); expect(runtime.nativeTextSet(target.id, a.context)).toBe(true); expect(runtime.nativeTextSet(target.id, b.context)).toBe(true);
    adapter.failure = undefined; calls.length = 0; await runtime.updateAutoFitted(false);
    expect(calls.map(c => c.context)).toEqual([a.context, b.context]); expect(runtime.rows(list).map(row => runtime.widget(target, row.context).width)).toEqual([333.25, 333.25]);
  });

  it('bounds Resize → SetText reentry, rolls back its private state, and permits a later valid setter', async () => {
    const doc = createDocument(), target = shape(); doc.pages[0].widgets = [target]; doc.caseSelection = 'never';
    target.interactions = [event('resize', setText(target, 'Recursive'))];
    const saved = serializeDocument(doc), runtime = make(doc, portable), { calls, adapter } = fakeHost(runtime, [target]);
    const before = structuredClone(runtime.state()); adapter.candidate = w => ({ width: w.width + 1, height: w.height });
    await expect(runtime.execute(event('click', setText(target)))).rejects.toThrow(/cycle|limit/i);
    expect(calls.length).toBeLessThan(200); expect(runtime.state()).toEqual(before); expect(runtime.nativeTextSet(target.id)).toBe(false);
    const count = calls.length; await runtime.updateAutoFitted(false); expect(calls).toHaveLength(count); expect(serializeDocument(doc)).toBe(saved);
    target.interactions = []; await runtime.execute(event('click', setText(target, 'Recovered')));
    expect(runtime.widget(target)).toMatchObject({ text: 'Recovered', width: 81.25, height: 40.5 }); expect(runtime.nativeTextSet(target.id)).toBe(true);
  });

  it('clears temporary setter/registration state at disposal without running the host again', async () => {
    const { doc, target, list, button } = fixture(), runtime = make(doc, portable), { calls } = fakeHost(runtime, [target]);
    await runtime.start(); const row = runtime.rows(list)[0]; await runtime.trigger(button.id, 'click', row.data, row.context);
    runtime.dispose(); expect(runtime.nativeTextSet(target.id, row.context)).toBe(false);
    const count = calls.length; await runtime.updateAutoFitted(false); expect(calls).toHaveLength(count);
  });
});
