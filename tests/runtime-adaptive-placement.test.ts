import { Script } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument, createWidget, uid } from '../src/model/document';
import type { Action, Document, EventType, Interaction, Widget } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import { getRuntimeWidget } from '../src/runtime/engine';

const sessions: OfflineRuntime[] = [];
afterEach(() => sessions.splice(0).forEach(s => s.dispose()));
const event = (type: EventType, ...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: type, event: type, enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(a => ({ ...a, id: uid() })) });
const act = (...actions: Omit<Action, 'id'>[]) => event('click', ...actions);
function fixture() {
  const doc = createDocument(), page = doc.pages[0], target = createWidget('box');
  doc.caseSelection = 'never'; page.widgets = [target]; page.width = 1200;
  page.adaptiveSelection = 'native-size'; page.adaptiveBaseSize = { width: 1200, height: 0 };
  page.adaptiveViews = [{ id: 'tablet', name: 'Tablet', width: 768, overrides: { [target.id]: { placed: false } } }, { id: 'phone', name: 'Phone', width: 390, baseViewId: 'tablet', overrides: { [target.id]: { placed: true } } }];
  return { doc, page, target };
}
function panel(child: Widget) { const w = createWidget('panel'); w.states = [{ id: uid(), name: 'State', widgets: [child] }]; w.activeStateId = w.states[0].id; return w; }
function list(child: Widget) { const w = createWidget('repeater'); w.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }], template: [child], itemHeight: 40, gap: 0 }; return w; }
function make(doc: Document, portable: boolean) {
  const factory: typeof createOfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout }) : createOfflineRuntime;
  const runtime = factory(doc, undefined, evaluateExpression, undefined, { width: 1200 }); sessions.push(runtime); return runtime;
}
for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} adaptive placement`, () => {
  it('inherits placement independently of Hidden and restores defaults silently', async () => {
    const { doc, page, target } = fixture(); target.hidden = true;
    target.interactions = [event('show', { type: 'setVariable', targetId: 'Shown', value: 'yes' }), event('hide', { type: 'setVariable', targetId: 'Hidden', value: 'yes' })];
    const runtime = make(doc, portable); await runtime.start();
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'tablet' }); expect(runtime.widget(target)).toMatchObject({ placed: false, hidden: true });
    await runtime.execute(act({ type: 'show', targetId: target.id }, { type: 'setVariable', targetId: 'After', value: 'yes' }));
    expect(runtime.widget(target).hidden).toBe(true); expect(runtime.state().variables).toMatchObject({ After: 'yes' });
    expect(runtime.state().variables.Shown).toBeUndefined(); expect(runtime.state().variables.Hidden).toBeUndefined();
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'phone' }); expect(runtime.widget(target).placed).toBe(true);
    await runtime.execute(act({ type: 'show', targetId: target.id })); expect(runtime.widget(target).hidden).toBe(false);
    await runtime.setAdaptiveView({ kind: 'base' }); expect(runtime.widget(target).placed).not.toBe(false); expect(runtime.widget(target).hidden).toBe(true);
    expect(page.widgets[0]).toBe(target);
  });
  it('skips all ordinary target mutations and value evaluation on an own-unplaced target', async () => {
    const { doc, target } = fixture(); target.placed = false; const runtime = make(doc, portable); await runtime.start();
    await runtime.execute(act({ type: 'setText', targetId: target.id, value: 'Changed' }, { type: 'move', targetId: target.id, x: 99 }, { type: 'setSelected', targetId: target.id, value: 'notboolean' }, { type: 'setStyle', targetId: target.id, style: { fill: '#ff0000' } }));
    expect(runtime.state().widgetOverrides[target.id]).toBeUndefined(); expect(runtime.widget(target).text).toBe(target.text);
  });
  it('still targets ordinary children below an unplaced panel, but blocks focus and Loaded traversal', async () => {
    const { doc, page, target } = fixture(), input = createWidget('input'), holder = panel(input); holder.placed = false;
    input.interactions = [event('load', { type: 'setVariable', targetId: 'Loaded', value: 'yes' }), event('focus', { type: 'setVariable', targetId: 'Focused', value: 'yes' })];
    page.widgets = [holder, target]; const runtime = make(doc, portable), focus = vi.fn(); runtime.bindControls({ flush() {}, focus, selectText() {} }); await runtime.start();
    await runtime.execute(act({ type: 'setText', targetId: input.id, value: 'Preserved child' }, { type: 'setFocus', targetId: input.id }));
    expect(runtime.controlValue(input.id)).toBe('Preserved child'); expect(runtime.state().variables.Loaded).toBeUndefined(); expect(runtime.state().variables.Focused).toBeUndefined(); expect(focus).not.toHaveBeenCalled();
  });
  it('initializes hidden placed objects but does not load own-unplaced objects', async () => {
    const { doc, page, target } = fixture(), hidden = createWidget('box'); target.placed = false; hidden.hidden = true;
    target.interactions = [event('load', { type: 'setVariable', targetId: 'Away', value: 'yes' })]; hidden.interactions = [event('load', { type: 'setVariable', targetId: 'Hidden', value: 'yes' })];
    page.widgets.push(hidden); const runtime = make(doc, portable); await runtime.start(); expect(runtime.state().variables).toMatchObject({ Hidden: 'yes' }); expect(runtime.state().variables.Away).toBeUndefined();
  });
  it('excludes unplaced geometry from panel fit and snapshot fit without changing the saved rectangle', async () => {
    const { doc, page, target } = fixture(); target.x = 500; target.width = 100; target.placed = false;
    const live = createWidget('box', 10, 5); live.width = 20; live.height = 30; const holder = panel(target); holder.states![0].widgets.push(live); holder.fitToContent = true; page.widgets = [holder];
    const runtime = make(doc, portable); await runtime.start(); expect(runtime.widget(holder)).toMatchObject({ width: 30, height: 35 }); expect(getRuntimeWidget(holder, runtime.state())).toMatchObject({ width: 30, height: 35 }); expect(target.width).toBe(100);
  });
  it('keeps row identity/content while the repeater is unplaced, then rebuilds when placed again', async () => {
    const { doc, page } = fixture(), input = createWidget('input'), repeater = list(input); page.widgets = [repeater];
    page.adaptiveViews![0].overrides = { [repeater.id]: { placed: false } }; page.adaptiveViews![1].overrides = { [repeater.id]: { placed: true } };
    doc.variables.Loads = '0'; repeater.interactions = [event('itemLoad', { type: 'setVariable', targetId: 'Loads', value: '[[Loads + 1]]' })];
    const runtime = make(doc, portable); await runtime.start(); const rows = runtime.rows(repeater), context = rows[0].context; runtime.input(input.id, 'Typed', undefined, context);
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'tablet' }); expect(runtime.state().variables.Loads).toBe('2'); expect(runtime.controlValue(input.id, context)).toBe('Typed'); expect(runtime.rows(repeater)[0].revision).toBe(rows[0].revision);
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'phone' }); expect(runtime.state().variables.Loads).toBe('4'); expect(runtime.rows(repeater).map(row => row.id)).toEqual(rows.map(row => row.id)); expect(runtime.controlValue(input.id, context)).toBe(input.text);
  });
  it('filters own-unplaced row targets but permits a different placed sibling in each row', async () => {
    const { doc, page, target } = fixture(), live = createWidget('text'), repeater = list(target); target.placed = false; repeater.repeater!.template.push(live); page.widgets = [repeater];
    const runtime = make(doc, portable); await runtime.start(); await runtime.execute(act({ type: 'setText', targetId: target.id, value: 'No' }, { type: 'setText', targetId: live.id, value: '[[TargetItem.Name]]' }));
    for (const row of runtime.rows(repeater)) { expect(runtime.widget(target, row.context).text).toBe(target.text); expect(runtime.widget(live, row.context).text).toBe(row.data.Name); }
  });
  it('preserves selected unplaced peers when selecting another group member', async () => {
    const { doc, page, target } = fixture(), peer = createWidget('box'); target.placed = false; target.selected = true; target.selectionGroup = peer.selectionGroup = 'group'; page.widgets.push(peer);
    const runtime = make(doc, portable); await runtime.start(); await runtime.execute(act({ type: 'setSelected', targetId: peer.id, value: 'true' })); expect(runtime.widget(target).selected).toBe(true); expect(runtime.widget(peer).selected).toBe(true);
  });
  it('does not confuse selected-style limbo filtering with native radio checked exclusivity', async () => {
    const { doc, page } = fixture(), away = createWidget('radio'), live = createWidget('radio'); away.placed = false; away.checked = true; away.radioGroup = live.radioGroup = 'native-group'; page.widgets = [away, live];
    const runtime = make(doc, portable); await runtime.start(); await runtime.check(live.id, true); expect(runtime.widget(away).checked).toBe(false); expect(runtime.widget(live).checked).toBe(true);
  });
  it('retains direct synthetic event dispatch while the authored target action path excludes limbo', async () => {
    const { doc, target } = fixture(); target.placed = false; target.interactions = [event('click', { type: 'setVariable', targetId: 'Synthetic', value: 'yes' })];
    const runtime = make(doc, portable); await runtime.start(); await runtime.trigger(target.id, 'click'); expect(runtime.state().variables.Synthetic).toBe('yes');
  });
  it('exposes root table/menu/tree placement declarations rather than dropping them with shared styling', async () => {
    const { doc, page } = fixture(); page.widgets = ['table', 'menu', 'tree'].map(type => createWidget(type as Widget['type']));
    page.adaptiveViews![0].overrides = Object.fromEntries(page.widgets.map(w => [w.id, { placed: false }]));
    const runtime = make(doc, portable); await runtime.start(); await runtime.setAdaptiveView({ kind: 'view', viewId: 'tablet' }); for (const w of page.widgets) expect(runtime.widget(w).placed).toBe(false);
  });
  it('rolls a failed view transition back to placement, row revisions and runtime input content', async () => {
    const { doc, page, target } = fixture(), input = createWidget('input'), repeater = list(input);
    page.widgets.push(repeater); page.adaptiveViews![0].overrides[repeater.id] = { placed: false };
    const bad = event('adaptiveViewChange', { type: 'setSelected', targetId: input.id, value: 'invalid' }); page.interactions = [bad];
    const runtime = make(doc, portable); await runtime.start(); const row = runtime.rows(repeater)[0]; runtime.input(input.id, 'Saved runtime value', undefined, row.context);
    await expect(runtime.setAdaptiveView({ kind: 'view', viewId: 'tablet' })).rejects.toThrow(/selected/i);
    expect(runtime.adaptiveViewId()).toBeUndefined(); expect(runtime.widget(target).placed).not.toBe(false); expect(runtime.widget(repeater).placed).not.toBe(false);
    expect(runtime.controlValue(input.id, row.context)).toBe('Saved runtime value'); expect(runtime.rows(repeater)[0].revision).toBe(row.revision);
  });
  it('defers descendant repeater refresh and pageInfo reset while its panel is unplaced', async () => {
    const { doc, page } = fixture(), child = createWidget('input'), repeater = list(child), holder = panel(repeater);
    repeater.repeater!.pagination = { itemsPerPage: 1, startPage: 1 }; page.widgets = [holder];
    page.adaptiveViews![0].overrides = { [holder.id]: { placed: false } }; page.adaptiveViews![1].overrides = { [holder.id]: { placed: true } };
    const runtime = make(doc, portable); await runtime.start(); await runtime.execute(act({ type: 'setRepeaterPage', targetId: repeater.id, value: '2' }));
    const row = runtime.rows(repeater)[0]; runtime.input(child.id, 'Page two', undefined, row.context);
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'tablet' }); expect(runtime.repeaterInfo(repeater).pageIndex).toBe(2); expect(runtime.controlValue(child.id, row.context)).toBe('Page two');
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'phone' }); expect(runtime.repeaterInfo(repeater).pageIndex).toBe(1);
  });
  it('loads a repeater that begins unplaced only on first placement and keeps nested identities while away', async () => {
    const { doc, page } = fixture(), input = createWidget('input'), inner = list(input), outer = list(inner); outer.placed = false; page.widgets = [outer];
    doc.variables.Loads = '0'; inner.interactions = [event('itemLoad', { type: 'setVariable', targetId: 'Loads', value: '[[Loads + 1]]' })];
    page.adaptiveViews![0].overrides = { [outer.id]: { placed: false } }; page.adaptiveViews![1].overrides = { [outer.id]: { placed: true } };
    const runtime = make(doc, portable); await runtime.start(); expect(runtime.state().variables.Loads).toBe('0');
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'phone' }); expect(runtime.state().variables.Loads).toBe('4');
    const parentRow = runtime.rows(outer)[0], row = runtime.rows(inner, parentRow.context)[0]; runtime.input(input.id, 'Nested runtime', undefined, row.context);
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'tablet' }); expect(runtime.state().variables.Loads).toBe('4'); expect(runtime.controlValue(input.id, row.context)).toBe('Nested runtime');
    expect(runtime.rows(inner, parentRow.context)[0].id).toBe(row.id); expect(runtime.rows(inner, parentRow.context)[0].revision).toBe(row.revision);
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'phone' }); expect(runtime.state().variables.Loads).toBe('8'); expect(runtime.rows(inner, parentRow.context)[0].id).toBe(row.id);
  });
  it('keeps hidden placed targets mutable while skipping own-unplaced frame navigation', async () => {
    const { doc, page, target } = fixture(), frame = createWidget('inlineFrame'); frame.placed = false; target.hidden = true; page.widgets.push(frame);
    const runtime = make(doc, portable); await runtime.start();
    await runtime.execute(act({ type: 'setText', targetId: target.id, value: 'Hidden remains mutable' }, { type: 'openLinkInFrame', frameScope: 'widget', targetId: frame.id, frameTarget: { kind: 'page', pageId: page.id } }));
    expect(runtime.widget(target).text).toBe('Hidden remains mutable'); expect(runtime.frame(frame.id)?.target).toBeUndefined();
    page.adaptiveViews![1].overrides[frame.id] = { placed: true }; await runtime.setAdaptiveView({ kind: 'view', viewId: 'phone' });
    await runtime.execute(act({ type: 'openLinkInFrame', frameScope: 'widget', targetId: frame.id, frameTarget: { kind: 'page', pageId: page.id } }));
    const navigation = runtime.frame(frame.id); await runtime.setAdaptiveView({ kind: 'base' }); expect(runtime.frame(frame.id)).toEqual(navigation);
  });
});
