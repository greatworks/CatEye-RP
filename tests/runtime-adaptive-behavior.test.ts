import { Script } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument, createPage, createWidget, uid } from '../src/model/document';
import type { Action, Document, EventType, Interaction } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime, type RuntimeViewport } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import { resolveAdaptivePage } from '../src/model/adaptive-view-sets';
import { resolveAdaptiveOverride } from '../src/model/adaptive';

type Target = { kind: 'auto' } | { kind: 'base' } | { kind: 'view'; viewId: string };
type BehaviorRuntime = OfflineRuntime & { setAdaptiveView(target: Target): Promise<void>; adaptiveSelectionMode(): 'auto' | 'forced' };
const sessions: OfflineRuntime[] = [];
afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); vi.useRealTimers(); });
const action = (value: Record<string, unknown>): Action => ({ id: uid(), ...value } as Action);
const log = (text: string) => action({ type: 'setVariable', targetId: 'Log', value: `[[Log]]${text}` });
const switchTo = (target: Target) => action({ type: 'setAdaptiveView', adaptiveView: target });
const interaction = (event: string, ...actions: Action[]): Interaction => ({ id: uid(), name: event, event: event as EventType, enabled: true, conditionMode: 'all', conditions: [], actions });
function fixture() {
  const doc = createDocument(), page = doc.pages[0], shape = createWidget('box', 12, 34);
  doc.caseSelection = 'never'; doc.variables = { Log: '', Bad: 'invalid', Armed: 'no' };
  page.widgets = [shape]; page.width = 1200; page.height = 900;
  page.adaptiveSelection = 'native-size'; page.adaptiveBaseSize = { width: 0, height: 0 };
  page.adaptiveViews = [
    { id: 'tablet', name: 'Tablet', width: 768, height: 0, baseViewId: 'phone', overrides: { [shape.id]: { width: 333 } } },
    { id: 'phone', name: 'Phone', width: 390, height: 0, overrides: { [shape.id]: { width: 222, style: { fill: '#123456' } } } },
  ];
  return { doc, page, shape };
}
function make(doc: Document, portable: boolean, policy?: RuntimeViewport): BehaviorRuntime {
  const factory: typeof createOfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout }) : createOfflineRuntime;
  const runtime = factory(doc, undefined, evaluateExpression, undefined, policy) as BehaviorRuntime;
  sessions.push(runtime); return runtime;
}
function sharedFixture() {
  const { doc, page, shape } = fixture(), destination = createPage('Other page'), other = createWidget('box');
  destination.widgets = [other]; destination.adaptiveViews = [];
  const views = page.adaptiveViews.map(({ overrides: _overrides, ...view }) => view);
  Object.assign(doc, { adaptiveViewSets: [{ id: 'shared', name: 'Shared', baseSize: { width: 0, height: 0 }, views }] });
  Object.assign(page, { adaptiveViewSetId: 'shared', adaptiveOverrides: { phone: { [shape.id]: { width: 222, hidden: true } }, tablet: { [shape.id]: { hidden: false, style: { color: '#123456' } } } } });
  Object.assign(destination, { adaptiveViewSetId: 'shared', adaptiveOverrides: { phone: { [other.id]: { width: 444 } }, tablet: { [other.id]: { height: 99 } } } });
  page.adaptiveViews = []; doc.pages.push(destination);
  return { doc, page, shape, destination, other };
}

for (const portable of [false, true]) describe(portable ? 'serialized adaptive behavior' : 'module adaptive behavior', () => {
  it('projects shared metadata with per-page declarations before Loaded, without mutating saved data', async () => {
    const { doc, page, shape, destination, other } = sharedFixture();
    shape.interactions = [interaction('load', action({ type: 'setVariable', targetId: 'First', value: '[[This.width]]' }))];
    other.interactions = [interaction('load', action({ type: 'setVariable', targetId: 'Other', value: '[[This.width]]' }))];
    const saved = JSON.stringify(doc), runtime = make(doc, portable, { width: 800 });
    await runtime.start(); expect(runtime.adaptiveViewId()).toBe('tablet'); expect(runtime.state().variables.First).toBe('222');
    expect(runtime.adaptiveWidgetOverride(shape.id)).toEqual(resolveAdaptiveOverride(resolveAdaptivePage(doc, page), 'tablet', shape.id));
    expect(runtime.widget(shape)).toMatchObject({ width: 222, hidden: false, style: { color: '#123456' } });
    await runtime.navigate(destination.id); expect(runtime.state().variables.Other).toBe('444');
    expect(runtime.widget(other)).toMatchObject({ width: 444, height: 99 }); expect(JSON.stringify(doc)).toBe(saved);
  });
  it('keeps omitted viewport callers manual until an explicit view control opts in', async () => {
    const { doc, shape } = sharedFixture(), runtime = make(doc, portable);
    expect(runtime.adaptiveViewId()).toBeUndefined(); expect(runtime.widget(shape).width).toBe(shape.width);
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'phone' }); expect(runtime.widget(shape).width).toBe(222);
  });
  it('forces the same view without reset, retains latest physical dimensions, and Auto selects them', async () => {
    const { doc, page, shape } = fixture(); page.interactions = [interaction('adaptiveViewChange', log('A'))];
    const runtime = make(doc, portable, { width: 390 }); await runtime.start();
    await runtime.execute(interaction('click', action({ type: 'move', targetId: shape.id, x: 999 })));
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'phone' }); expect(runtime.adaptiveSelectionMode()).toBe('forced');
    await runtime.setViewport({ width: 900 }); expect(runtime.adaptiveViewId()).toBe('phone'); expect(runtime.widget(shape).x).toBe(999); expect(runtime.state().variables.Log).toBe('A');
    await runtime.setAdaptiveView({ kind: 'auto' }); expect(runtime.adaptiveSelectionMode()).toBe('auto'); expect(runtime.adaptiveViewId()).toBe('tablet'); expect(runtime.widget(shape).x).toBe(shape.x); expect(runtime.state().variables.Log).toBe('AA');
    await runtime.setAdaptiveView({ kind: 'base' }); expect(runtime.adaptiveViewId()).toBeUndefined(); await runtime.setViewport({ width: 390 }); expect(runtime.adaptiveViewId()).toBeUndefined();
    expect(runtime.state().variables.Log).toBe('AAA');
  });
  it('copies and validates control values before enqueue and does not consume malformed controls', async () => {
    const { doc } = fixture(), runtime = make(doc, portable, { width: 100 });
    const target: Target = { kind: 'view', viewId: 'phone' }, pending = runtime.setAdaptiveView(target); target.viewId = 'tablet'; await pending;
    expect(runtime.adaptiveViewId()).toBe('phone');
    for (const bad of [null, {}, { kind: 'unknown' }, { kind: 'view' }, { kind: 'view', viewId: '__proto__' }, { kind: 'view', viewId: 'x\n' }, { kind: 'view', viewId: 'x'.repeat(257) }, { kind: 'base', viewId: 'phone' }]) expect(() => runtime.setAdaptiveView(bad as Target)).toThrow(/adaptive|view|target/i);
    expect(runtime.adaptiveViewId()).toBe('phone'); expect(runtime.adaptiveSelectionMode()).toBe('forced');
  });
  it('preserves unknown force identity with an empty chain; same unknown is a no-op but different unknown fires', async () => {
    const { doc, page, shape } = fixture(); page.interactions = [interaction('adaptiveViewChange', log('A'))];
    const runtime = make(doc, portable, { width: 390 }); await runtime.start();
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'deleted-A' }); expect(runtime.adaptiveViewId()).toBe('deleted-A');
    expect(runtime.widget(shape).width).toBe(shape.width); expect(runtime.adaptiveWidgetOverride(shape.id)).toBeUndefined();
    await runtime.execute(interaction('click', action({ type: 'move', targetId: shape.id, x: 999 })));
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'deleted-A' }); expect(runtime.widget(shape).x).toBe(999); expect(runtime.state().variables.Log).toBe('AA');
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'deleted-B' }); expect(runtime.widget(shape).x).toBe(shape.x); expect(runtime.state().variables.Log).toBe('AAA');
    await runtime.setAdaptiveView({ kind: 'auto' }); expect(runtime.adaptiveViewId()).toBe('phone'); expect(runtime.adaptiveSelectionMode()).toBe('auto');
    await runtime.setAdaptiveView({ kind: 'base' }); expect(runtime.adaptiveViewId()).toBeUndefined(); expect(runtime.state().variables.Log).toBe('AAAAA');
  });
  it('a final unknown Loaded force still emits the initial named event and rolls back its ID on failure', async () => {
    const { doc, page, shape } = fixture(); page.interactions = [interaction('load', switchTo({ kind: 'view', viewId: 'deleted' })), interaction('adaptiveViewChange', log('A'))];
    const runtime = make(doc, portable, { width: 100 }); await runtime.start(); expect(runtime.adaptiveViewId()).toBe('deleted'); expect(runtime.state().variables.Log).toBe('A');
    page.interactions.push(interaction('adaptiveViewChange', action({ type: 'setSelected', targetId: shape.id, value: '[[Bad]]' })));
    await expect(runtime.setAdaptiveView({ kind: 'view', viewId: 'another-deleted' })).rejects.toThrow(/selected/i);
    expect(runtime.adaptiveViewId()).toBe('deleted'); expect(runtime.adaptiveSelectionMode()).toBe('forced'); expect(runtime.state().variables.Log).toBe('A');
  });
  it('terminates only the current action list, not the later independent IF group', async () => {
    const { doc, page, shape } = fixture(); page.interactions = [interaction('adaptiveViewChange', log('A')), interaction('adaptiveViewChange', log('B'))];
    shape.interactions = [interaction('click', log('X'), switchTo({ kind: 'view', viewId: 'phone' }), log('NEVER')), { ...interaction('click', log('ELSE')), isNewIfGroup: false }, interaction('click', log('Y'))];
    const runtime = make(doc, portable, { width: 100 }); await runtime.start(); await runtime.trigger(shape.id, 'click');
    expect(runtime.state().variables.Log).toBe('XABY');
    await runtime.trigger(shape.id, 'click'); expect(runtime.state().variables.Log).toBe('XABYXY');
  });
  it('defers initial adaptive dispatch and rows until all synchronous hidden/inactive Loaded prefixes', async () => {
    const { doc, page, shape } = fixture(), panel = createWidget('panel'), hidden = createWidget('box'), list = createWidget('repeater');
    hidden.hidden = true; hidden.interactions = [interaction('load', log('H'))]; panel.states!.push({ id: uid(), name: 'Inactive', widgets: [hidden] });
    list.repeater!.rows = [{ Name: 'one' }]; list.repeater!.template = []; list.interactions = [interaction('itemLoad', log('R'))];
    shape.interactions = [interaction('load', log('W'))]; page.widgets.push(panel, list);
    page.interactions = [interaction('load', log('L'), switchTo({ kind: 'view', viewId: 'phone' }), log('NEVER')), interaction('adaptiveViewChange', log('A'))];
    const runtime = make(doc, portable, { width: 100 }); await runtime.start();
    expect(runtime.state().variables.Log).toBe('LWHAR');
  });
  it('initial Base has no adaptive event, and initial named event can switch again before first rows', async () => {
    const { doc, page } = fixture(), list = createWidget('repeater'); list.repeater!.rows = [{ Name: 'one' }]; list.repeater!.template = [];
    list.interactions = [interaction('itemLoad', log('R'))]; page.widgets.push(list);
    page.interactions = [interaction('load', log('L')), { ...interaction('adaptiveViewChange', log('A'), action({ type: 'setVariable', targetId: 'Armed', value: 'yes' }), switchTo({ kind: 'view', viewId: 'tablet' })), conditions: [{ source: 'variable', key: 'Armed', operator: 'equals', value: 'no' }] }, { ...interaction('adaptiveViewChange', log('B')), isNewIfGroup: false }];
    const base = make(doc, portable, { width: 100 }); await base.start(); expect(base.state().variables.Log).toBe('LR');
    const named = make(doc, portable, { width: 390 }); await named.start(); expect(named.state().variables.Log).toBe('LABR'); expect(named.adaptiveViewId()).toBe('tablet');
  });
  it('a Loaded switch back to Base suppresses the initial event', async () => {
    const { doc, page } = fixture(); page.interactions = [interaction('load', switchTo({ kind: 'base' })), interaction('adaptiveViewChange', log('A'))];
    const runtime = make(doc, portable, { width: 390 }); await runtime.start(); expect(runtime.state().variables.Log).toBe(''); expect(runtime.adaptiveSelectionMode()).toBe('forced');
  });
  it('Wait before a switch releases later groups and Wait after it is never scheduled', async () => {
    vi.useFakeTimers(); const { doc, page, shape } = fixture(); page.interactions = [interaction('adaptiveViewChange', log('A'))];
    shape.interactions = [interaction('click', log('X'), action({ type: 'wait', duration: 5 }), switchTo({ kind: 'view', viewId: 'phone' }), action({ type: 'wait', duration: 5 }), log('NEVER')), interaction('click', log('Y'))];
    const runtime = make(doc, portable, { width: 100 }); await runtime.start(); const pending = runtime.trigger(shape.id, 'click');
    await vi.advanceTimersByTimeAsync(0); expect(runtime.state().variables.Log).toBe('XY');
    await vi.advanceTimersByTimeAsync(5); await pending; expect(runtime.state().variables.Log).toBe('XYA'); expect(vi.getTimerCount()).toBe(0);
  });
  it('a Loaded Wait does not hold initial barriers and its later switch emits an ordinary event', async () => {
    vi.useFakeTimers(); const { doc, page } = fixture(); page.interactions = [interaction('load', log('L'), action({ type: 'wait', duration: 5 }), switchTo({ kind: 'view', viewId: 'phone' })), interaction('adaptiveViewChange', log('A'))];
    const runtime = make(doc, portable, { width: 100 }), pending = runtime.start(); await vi.advanceTimersByTimeAsync(0);
    expect(runtime.state().variables.Log).toBe('L'); await vi.advanceTimersByTimeAsync(5); await pending; expect(runtime.state().variables.Log).toBe('LA');
  });
  it('post-load switches refresh rows before adaptive handlers and preserve ordinary Waits', async () => {
    vi.useFakeTimers(); const { doc, page, shape } = fixture(), list = createWidget('repeater'); list.repeater!.rows = [{ Name: 'one' }]; list.repeater!.template = [];
    list.interactions = [interaction('itemLoad', log('R'))]; page.widgets.push(list); page.interactions = [interaction('adaptiveViewChange', log('A'))];
    const runtime = make(doc, portable, { width: 100 }); await runtime.start();
    const pending = runtime.execute(interaction('click', action({ type: 'wait', duration: 5 }), action({ type: 'setText', targetId: shape.id, value: 'after' })));
    await vi.advanceTimersByTimeAsync(0); await runtime.setAdaptiveView({ kind: 'view', viewId: 'phone' }); expect(runtime.state().variables.Log).toBe('RRA');
    await vi.advanceTimersByTimeAsync(5); await pending; expect(runtime.widget(shape).text).toBe('after');
  });
  it('uses normal adaptive case menus and selecting a switch case does not run its successor', async () => {
    const { doc, page } = fixture(); doc.caseSelection = 'auto'; page.interactions = [interaction('adaptiveViewChange', log('A'), switchTo({ kind: 'base' }), log('NEVER')), interaction('adaptiveViewChange', log('B'))];
    const runtime = make(doc, portable, { width: 390 }); await runtime.start(); const menu = runtime.state().caseMenus![0];
    expect(menu.event).toBe('adaptiveViewChange'); expect(runtime.state().variables.Log).toBe('');
    await runtime.selectCase(menu.id, menu.options[0].id); expect(runtime.state().variables.Log).toBe('A'); expect(runtime.adaptiveViewId()).toBeUndefined();
    expect(runtime.state().caseMenus).toHaveLength(1); runtime.cancelCaseMenus();
  });
  it('resets page-local force before destination Loaded while retaining physical size', async () => {
    const { doc, page, shape, destination, other } = sharedFixture();
    page.interactions = [interaction('adaptiveViewChange', log('A'))]; destination.interactions = [interaction('adaptiveViewChange', log('D'))];
    other.interactions = [interaction('load', action({ type: 'setVariable', targetId: 'Width', value: '[[This.width]]' }))];
    const runtime = make(doc, portable, { width: 800 }); await runtime.start(); await runtime.setAdaptiveView({ kind: 'base' }); await runtime.navigate(destination.id);
    expect(runtime.adaptiveSelectionMode()).toBe('auto'); expect(runtime.adaptiveViewId()).toBe('tablet'); expect(runtime.state().variables.Width).toBe('444'); expect(runtime.state().variables.Log).toBe('AAD');
    expect(runtime.widget(shape).text).toBe(shape.text);
  });
  it('navigation during initial adaptive event does not start source rows or rerun source Loaded', async () => {
    const { doc, page } = fixture(), list = createWidget('repeater'), destination = createPage('Destination');
    list.repeater!.rows = [{ Name: 'one' }]; list.repeater!.template = []; list.interactions = [interaction('itemLoad', log('WRONG'))]; page.widgets.push(list);
    page.interactions = [interaction('load', log('L')), interaction('adaptiveViewChange', action({ type: 'openPage', targetId: destination.id }))]; destination.interactions = [interaction('load', log('D'))]; doc.pages.push(destination);
    const runtime = make(doc, portable, { width: 390 }); await runtime.start(); expect(runtime.state().pageId).toBe(destination.id); expect(runtime.state().variables.Log).toBe('LD');
  });
  it('rolls back forced mode, view, new Wait/menu and navigation lifecycle while preserving an old Wait', async () => {
    vi.useFakeTimers(); const { doc, page, shape } = fixture(), destination = createPage('Rejected'); doc.pages.push(destination);
    page.interactions = [interaction('load', log('L')), interaction('adaptiveViewChange', action({ type: 'wait', duration: 10 }), log('NEW')), interaction('adaptiveViewChange', action({ type: 'openPage', targetId: destination.id }))];
    destination.interactions = [interaction('load', action({ type: 'setSelected', targetId: shape.id, value: '[[Bad]]' }))];
    // The failing target must belong to the destination for standard target gating.
    const rejected = createWidget('box'); destination.widgets = [rejected]; destination.interactions[0].actions[0].targetId = rejected.id;
    const runtime = make(doc, portable, { width: 100 }); await runtime.start();
    const old = runtime.execute(interaction('click', action({ type: 'wait', duration: 20 }), log('OLD'))); await vi.advanceTimersByTimeAsync(0);
    await expect(runtime.setAdaptiveView({ kind: 'view', viewId: 'phone' })).rejects.toThrow(/selected/i);
    expect(runtime.adaptiveSelectionMode()).toBe('auto'); expect(runtime.adaptiveViewId()).toBeUndefined(); expect(runtime.state().pageId).toBe(page.id);
    await runtime.execute(interaction('click', log('X'))); expect(runtime.state().variables.Log).toBe('LX');
    await vi.advanceTimersByTimeAsync(20); await old; expect(runtime.state().variables.Log).toBe('LXOLD'); expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds recursive synchronous view handlers and atomically restores the prior mode and declaration', async () => {
    const { doc, page } = fixture();
    // Toggle via a variable, since ordinary SetText intentionally survives view changes.
    page.interactions = [{ ...interaction('adaptiveViewChange', action({ type: 'setVariable', targetId: 'Armed', value: 'yes' }), switchTo({ kind: 'base' })), conditions: [{ source: 'variable', key: 'Armed', operator: 'equals', value: 'no' }] }, { ...interaction('adaptiveViewChange', action({ type: 'setVariable', targetId: 'Armed', value: 'no' }), switchTo({ kind: 'view', viewId: 'phone' })), isNewIfGroup: false }];
    const runtime = make(doc, portable, { width: 100 }); await runtime.start();
    await expect(runtime.setAdaptiveView({ kind: 'view', viewId: 'phone' })).rejects.toThrow(/adaptive.*(?:cycle|limit)|(?:cycle|limit).*adaptive/i);
    expect(runtime.adaptiveViewId()).toBeUndefined(); expect(runtime.adaptiveSelectionMode()).toBe('auto'); expect(runtime.state().variables.Armed).toBe('no');
  });
  it('preserves an old case menu across rejected navigation and removes newly-created destination menus', async () => {
    const { doc, page, shape } = fixture(), destination = createPage('Bad'), button = createWidget('button'), bad = createWidget('box');
    doc.caseSelection = 'auto'; doc.pages.push(destination); destination.widgets = [bad, button];
    shape.interactions = [interaction('click', log('OLD')), interaction('click', log('UNUSED'))];
    button.interactions = [interaction('load', log('NEW1')), interaction('load', log('NEW2'))];
    bad.interactions = [interaction('load', action({ type: 'setSelected', targetId: bad.id, value: '[[Bad]]' }))];
    destination.widgets = [button, bad];
    page.interactions = [interaction('adaptiveViewChange', action({ type: 'openPage', targetId: destination.id }))];
    const runtime = make(doc, portable, { width: 100 }); await runtime.start(); await runtime.trigger(shape.id, 'click'); const old = structuredClone(runtime.state().caseMenus![0]);
    await expect(runtime.setAdaptiveView({ kind: 'view', viewId: 'phone' })).rejects.toThrow(/selected/i);
    expect(runtime.state().caseMenus).toEqual([old]); expect(runtime.adaptiveSelectionMode()).toBe('auto');
    await runtime.selectCase(old.id, old.options[0].id); expect(runtime.state().variables.Log).toBe('OLD'); expect(runtime.state().caseMenus).toBeUndefined();
  });
  it('a delayed adaptive handler error rolls back only its segment, retaining the committed forced view and other events', async () => {
    vi.useFakeTimers(); const { doc, page, shape } = fixture();
    page.interactions = [interaction('adaptiveViewChange', log('PREFIX'), action({ type: 'wait', duration: 5 }), log('ROLLBACK'), action({ type: 'setSelected', targetId: shape.id, value: '[[Bad]]' }))];
    const runtime = make(doc, portable, { width: 100 }); await runtime.start();
    const rejected = expect(runtime.setAdaptiveView({ kind: 'view', viewId: 'phone' })).rejects.toThrow(/selected/i);
    await vi.advanceTimersByTimeAsync(0); await runtime.execute(interaction('click', log('OTHER')));
    await vi.advanceTimersByTimeAsync(5); await rejected;
    expect(runtime.adaptiveViewId()).toBe('phone'); expect(runtime.adaptiveSelectionMode()).toBe('forced'); expect(runtime.state().variables.Log).toBe('PREFIXOTHER');
  });
  it('does not mark the initial adaptive barrier complete when that dispatch fails', async () => {
    const { doc, page, shape } = fixture();
    page.interactions = [interaction('adaptiveViewChange', log('A'), action({ type: 'setSelected', targetId: shape.id, value: '[[Bad]]' }))];
    const runtime = make(doc, portable, { width: 390 }); await expect(runtime.start()).rejects.toThrow(/selected/i);
    expect(runtime.state().variables.Log).toBe(''); await runtime.execute(interaction('click', action({ type: 'setVariable', targetId: 'Bad', value: 'true' })));
    await runtime.start(); expect(runtime.state().variables.Log).toBe('A'); expect(runtime.widget(shape).selected).toBe(true);
  });
});
