import { afterEach, describe, expect, it, vi } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../src/model/document';
import type { Action, Document, EventType, Interaction, Widget } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime, type RowContext } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

const live: OfflineRuntime[] = [];
afterEach(() => { for (const runtime of live.splice(0)) runtime.dispose(); vi.useRealTimers(); });
const event = (name: EventType, ...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), event: name, name, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) });
const log = (text: string): Omit<Action, 'id'> => ({ type: 'setVariable', targetId: 'Log', value: `[[Log]]${text}` });
function runtimeFor(doc: Document, portable: boolean): OfflineRuntime {
  const runtime: OfflineRuntime = portable
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, new Script(`(${evaluateExpression.toString()})`).runInNewContext())
    : createOfflineRuntime(doc, undefined, evaluateExpression);
  live.push(runtime); return runtime;
}
function documentWith(...widgets: Widget[]) { const doc = createDocument(); doc.caseSelection = 'never'; doc.variables.Log = ''; doc.pages[0].widgets = widgets; return doc; }
const key = (id: string, context: RowContext = []) => JSON.stringify([id, context]);
type ActiveControl = { id: string; context: RowContext };
// Model the host's native DOM focus notifications, not the query's extra
// triggerHandler round. DOM .focus() itself does nothing on an already active
// or blocked input. The runtime must supply the original query's extra rounds.
function hostFor(runtime: OfflineRuntime) {
  let active: ActiveControl | undefined;
  const blocked = new Set<string>(), selections: ActiveControl[] = [], focusCalls: ActiveControl[] = [], flushLogs: string[] = [];
  runtime.bindControls({
    flush: () => { flushLogs.push(runtime.state().variables.Log); },
    focus: (id, context) => {
      focusCalls.push({ id, context: structuredClone(context) });
      if (blocked.has(key(id, context)) || active && key(active.id, active.context) === key(id, context)) return;
      const previous = active; active = undefined;
      if (previous) void runtime.focus(previous.id, false, previous.context);
      active = { id, context: structuredClone(context) }; void runtime.focus(id, true, context);
    },
    selectText: (id, context) => { selections.push({ id, context: structuredClone(context) }); },
  });
  return { blocked, selections, focusCalls, flushLogs, active: () => active,
    async focusInitially(id: string, context: RowContext = []) { active = { id, context }; await runtime.focus(id, true, context); },
  };
}
function repeaterWith(...template: Widget[]) {
  const repeater = createWidget('repeater'); repeater.repeater!.columns = ['Name']; repeater.repeater!.rows = [{ Name: 'A' }, { Name: 'B' }]; repeater.repeater!.template = template; return repeater;
}

// Research/form-properties-evidence.md distinguishes observed native ordering
// from this player's explicit safe checkable-submit compatibility contract.
for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} form properties runtime`, () => {
  it('rejects user edits to readonly controls while SetText bypasses readonly and maxLength', async () => {
    const field = createWidget('input'), area = createWidget('textarea');
    field.readOnly = area.readOnly = true; field.maxLength = 3; field.text = area.text = 'old';
    for (const w of [field, area]) w.interactions = [event('change', log(`${w.type};`))];
    const doc = documentWith(field, area), saved = serializeDocument(doc), runtime = runtimeFor(doc, portable);
    expect(runtime.input(field.id, 'user')).toBe(false); expect(runtime.input(area.id, 'user')).toBe(false);
    expect(runtime.widget(field).text).toBe('old'); expect(runtime.widget(area).text).toBe('old');
    await runtime.execute(event('click', { type: 'setText', targetId: field.id, value: 'longer than three' }, { type: 'setText', targetId: area.id, value: 'Line one\n第二行' }));
    expect(runtime.widget(field).text).toBe('longer than three'); expect(runtime.widget(area).text).toBe('Line one\n第二行');
    expect(runtime.state().variables.Log).toBe('input;textarea;'); expect(serializeDocument(doc)).toBe(saved);
  });

  it('runs target Focus, old Blur, target Focus, selection and following action synchronously', async () => {
    const old = createWidget('input'), target = createWidget('input'); old.interactions = [event('blur', log('blur;'))]; target.interactions = [event('focus', log('focus;'))];
    const doc = documentWith(old, target), runtime = runtimeFor(doc, portable), host = hostFor(runtime); await host.focusInitially(old.id);
    await runtime.execute(event('click', { type: 'setFocus', targetId: target.id, selectText: true }, log('after;')));
    expect(runtime.state().variables.Log).toBe('focus;blur;focus;after;'); expect(host.active()?.id).toBe(target.id);
    expect(host.selections).toEqual([{ id: target.id, context: [] }]); expect(host.flushLogs.at(-1)).toBe('focus;blur;focus;');
  });

  it('keeps both focus rounds for an already focused input and does not select by default', async () => {
    const target = createWidget('input'); target.interactions = [event('focus', log('F;'))];
    const runtime = runtimeFor(documentWith(target), portable), host = hostFor(runtime); await host.focusInitially(target.id);
    await runtime.execute(event('click', { type: 'setVariable', targetId: 'Log', value: '' }, { type: 'setFocus', targetId: target.id }));
    expect(runtime.state().variables.Log).toBe('F;F;'); expect(host.focusCalls).toHaveLength(1); expect(host.selections).toEqual([]);
  });

  it('focuses and selects readonly text while disabled and hidden targets keep actual focus', async () => {
    const old = createWidget('input'), readonly = createWidget('input'), disabled = createWidget('input'), hidden = createWidget('textarea');
    readonly.readOnly = true; disabled.disabled = true; hidden.hidden = true;
    for (const [w, label] of [[readonly, 'R'], [disabled, 'D'], [hidden, 'H']] as const) w.interactions = [event('focus', log(label))];
    const runtime = runtimeFor(documentWith(old, readonly, disabled, hidden), portable), host = hostFor(runtime); await host.focusInitially(old.id);
    await runtime.execute(event('click', { type: 'setFocus', targetId: readonly.id, selectText: true }));
    expect(host.active()?.id).toBe(readonly.id); expect(runtime.state().variables.Log).toBe('RR');
    for (const w of [disabled, hidden]) {
      host.blocked.add(key(w.id)); await runtime.execute(event('click', { type: 'setFocus', targetId: w.id, selectText: true }));
      expect(host.active()?.id).toBe(readonly.id);
    }
    expect(runtime.state().variables.Log).toBe('RR'); expect(host.selections.map(item => item.id)).toEqual([readonly.id, disabled.id, hidden.id]);
  });

  it('retains an active typing hint but hides a focus-mode hint before optional selection', async () => {
    const typing = createWidget('input'), focus = createWidget('textarea');
    typing.text = focus.text = ''; typing.hintText = focus.hintText = 'Hint'; focus.hintHideOn = 'focus';
    const runtime = runtimeFor(documentWith(typing, focus), portable), host = hostFor(runtime);
    await runtime.execute(event('click', { type: 'setFocus', targetId: typing.id, selectText: true }));
    expect(runtime.hint(typing.id)).toBe('Hint'); expect(host.selections).toEqual([]);
    await runtime.execute(event('click', { type: 'setFocus', targetId: focus.id, selectText: true }));
    expect(runtime.hint(focus.id)).toBeUndefined(); expect(host.selections.map(item => item.id)).toEqual([focus.id]);
  });

  it('blocks Focus and both Submit directions through a disabled ancestor, then restores them when enabled', async () => {
    const panel = createWidget('panel'), nested = createWidget('panel'), field = createWidget('input'), inside = createWidget('box');
    const outsideSource = createWidget('textarea'), outsideTarget = createWidget('box');
    panel.disabled = true; panel.states![0].widgets = [nested]; nested.states![0].widgets = [field, inside];
    field.interactions = [event('focus', log('F;'))]; field.submitButtonId = outsideTarget.id;
    outsideSource.submitButtonId = inside.id;
    inside.interactions = [event('click', log('inside;'))]; outsideTarget.interactions = [event('click', log('outside;'))];
    const runtime = runtimeFor(documentWith(panel, outsideSource, outsideTarget), portable), host = hostFor(runtime);
    await host.focusInitially(outsideSource.id); host.blocked.add(key(field.id));
    await runtime.execute(event('click', { type: 'setFocus', targetId: field.id }));
    await runtime.submit(field.id); await runtime.submit(outsideSource.id);
    expect(runtime.state().variables.Log).toBe(''); expect(host.active()?.id).toBe(outsideSource.id);
    await runtime.execute(event('click', { type: 'enable', targetId: panel.id })); host.blocked.delete(key(field.id));
    await runtime.execute(event('click', { type: 'setFocus', targetId: field.id }));
    await runtime.submit(field.id); await runtime.submit(outsideSource.id);
    expect(runtime.state().variables.Log).toBe('F;F;outside;inside;'); expect(host.active()?.id).toBe(field.id);
  });

  it('chooses only the first visible row outside the repeater and the source row within it', async () => {
    const field = createWidget('input'); field.interactions = [event('focus', log('[[Item.Name]];'))]; const repeater = repeaterWith(field);
    const runtime = runtimeFor(documentWith(repeater), portable), host = hostFor(runtime); await runtime.start(); const rows = runtime.rows(repeater);
    await runtime.execute(event('click', { type: 'setFocus', targetId: field.id }));
    expect(host.focusCalls).toHaveLength(1); expect(host.active()?.context).toEqual(rows[0].context); expect(runtime.state().variables.Log).toBe('A;A;');
    await runtime.execute(event('click', { type: 'setFocus', targetId: field.id }), rows[1].data, rows[1].context);
    expect(host.focusCalls).toHaveLength(2); expect(host.active()?.context).toEqual(rows[1].context); expect(runtime.state().variables.Log).toBe('A;A;B;B;');
  });

  it('continues without host operations when a repeater target has no visible row', async () => {
    const field = createWidget('input'), repeater = repeaterWith(field); repeater.repeater!.rows = [];
    const runtime = runtimeFor(documentWith(repeater), portable), host = hostFor(runtime); await runtime.start();
    await runtime.execute(event('click', { type: 'setFocus', targetId: field.id, selectText: true }, log('after')));
    expect(runtime.state().variables.Log).toBe('after'); expect(host.focusCalls).toEqual([]); expect(host.selections).toEqual([]);
  });

  it('does not block the next action on a Wait inside either Focus callback', async () => {
    vi.useFakeTimers(); const field = createWidget('input'); field.interactions = [event('focus', log('F;'), { type: 'wait', duration: 5 }, log('tail;'))];
    const runtime = runtimeFor(documentWith(field), portable); hostFor(runtime);
    const done = runtime.execute(event('click', { type: 'setFocus', targetId: field.id }, log('after;')));
    await vi.advanceTimersByTimeAsync(0); expect(runtime.state().variables.Log).toBe('F;F;after;');
    await vi.advanceTimersByTimeAsync(5); await done; expect(runtime.state().variables.Log).toBe('F;F;after;tail;tail;');
  });

  it('bounds a reentrant focus cycle and rolls back the failed action segment', async () => {
    const field = createWidget('input'); field.focusedStyle = { fill: '#ff0000' }; field.interactions = [event('focus', { type: 'setFocus', targetId: field.id })];
    const runtime = runtimeFor(documentWith(field), portable), host = hostFor(runtime), before = structuredClone(runtime.state());
    await expect(runtime.execute(event('click', log('temporary'), { type: 'setFocus', targetId: field.id }))).rejects.toThrow('Focus event cycle limit');
    expect(runtime.state()).toEqual(before); expect(runtime.widget(field).style.fill).toBe(field.style.fill); expect(host.focusCalls).toEqual([]);
    field.interactions = [event('focus', log('ok;'))]; await runtime.execute(event('click', { type: 'setFocus', targetId: field.id }));
    expect(runtime.state().variables.Log).toBe('ok;ok;');
  });

  it('propagates a native focus callback failure through the action transaction', async () => {
    const field = createWidget('input'); field.interactions = [event('focus', log('F;'))];
    const runtime = runtimeFor(documentWith(field), portable), before = structuredClone(runtime.state());
    runtime.bindControls({ flush() {}, selectText() {}, focus(id, context) {
      field.interactions = [event('focus', { type: 'setVariable', targetId: 'Log', value: '[[1 / 0]]' })]; void runtime.focus(id, true, context);
    } });
    await expect(runtime.execute(event('click', log('before;'), { type: 'setFocus', targetId: field.id }, log('after;')))).rejects.toThrow('division by zero');
    expect(runtime.state()).toEqual(before);
  });

  it('stops the remaining focus/select operations when the first callback navigates', async () => {
    const field = createWidget('input'), destination = createPage('Destination'); destination.interactions = [event('load', log('loaded;'))];
    field.interactions = [event('focus', log('F;'), { type: 'openPage', targetId: destination.id })];
    const doc = documentWith(field); doc.pages.push(destination); const runtime = runtimeFor(doc, portable), host = hostFor(runtime);
    await runtime.execute(event('click', { type: 'setFocus', targetId: field.id, selectText: true }, log('after;')));
    expect(runtime.state().pageId).toBe(destination.id); expect(runtime.state().variables.Log).toBe('F;after;loaded;'); expect(host.focusCalls).toEqual([]); expect(host.selections).toEqual([]);
  });

  it('submits a readonly source to a normal target without moving focus', async () => {
    const source = createWidget('input'), target = createWidget('box'); source.readOnly = true; source.submitButtonId = target.id; target.interactions = [event('click', log('submit;'))];
    const doc = documentWith(source, target), saved = serializeDocument(doc), runtime = runtimeFor(doc, portable), host = hostFor(runtime); await host.focusInitially(source.id);
    await runtime.submit(source.id); await runtime.submit(source.id);
    expect(runtime.state().variables.Log).toBe('submit;submit;'); expect(host.active()?.id).toBe(source.id); expect(host.focusCalls).toEqual([]); expect(serializeDocument(doc)).toBe(saved);
  });

  it('submits within one row and never broadcasts to an unrelated repeater', async () => {
    const source = createWidget('input'), target = createWidget('box'), outside = createWidget('input'), other = createWidget('box');
    target.interactions = [event('click', log('[[Item.Name]];'))]; other.interactions = [event('click', log('other;'))]; source.submitButtonId = target.id; outside.submitButtonId = target.id;
    const repeater = repeaterWith(source, target), unrelated = repeaterWith(other), doc = documentWith(outside, repeater, unrelated), runtime = runtimeFor(doc, portable); await runtime.start(); const rows = runtime.rows(repeater);
    await runtime.submit(source.id, rows[1].context); expect(runtime.state().variables.Log).toBe('B;');
    await runtime.submit(outside.id); expect(runtime.state().variables.Log).toBe('B;');
    source.submitButtonId = other.id; await runtime.submit(source.id, rows[0].context); expect(runtime.state().variables.Log).toBe('B;');
  });

  it('suppresses a normal submit target when disabled, hidden or on another page', async () => {
    const source = createWidget('textarea'), target = createWidget('box'); source.submitButtonId = target.id; target.interactions = [event('click', log('bad;'))];
    const doc = documentWith(source, target), destination = createPage('Other'); doc.pages.push(destination); const other = createWidget('box'); other.interactions = [event('click', log('other;'))]; destination.widgets = [other];
    const runtime = runtimeFor(doc, portable);
    await runtime.execute(event('click', { type: 'disable', targetId: target.id })); await runtime.submit(source.id);
    await runtime.execute(event('click', { type: 'enable', targetId: target.id }, { type: 'hide', targetId: target.id })); await runtime.submit(source.id);
    source.submitButtonId = other.id; await runtime.submit(source.id); expect(runtime.state().variables.Log).toBe('');
  });

  it('uses checked-before-Click then selection callbacks under the safe submit compatibility contract', async () => {
    const source = createWidget('input'), target = createWidget('checkbox'); source.submitButtonId = target.id; target.checked = false;
    target.interactions = [event('click', log('click;')), event('selectedChange', log('selectedChange;')), event('select', log('select;')), event('change', log('change;'))];
    const runtime = runtimeFor(documentWith(source, target), portable); let checkedAtClick: boolean | undefined;
    runtime.subscribe(() => { if (runtime.state().variables.Log === 'click;' && checkedAtClick === undefined) checkedAtClick = runtime.widget(target).checked; });
    await runtime.submit(source.id); expect(checkedAtClick).toBe(true); expect(runtime.widget(target)).toMatchObject({ checked: true, selected: true });
    expect(runtime.state().variables.Log).toBe('click;selectedChange;select;change;');
  });

  it('inverts the post-Click selection getter rather than copying its checked value', async () => {
    const source = createWidget('input'), target = createWidget('checkbox'); source.submitButtonId = target.id; target.checked = false;
    target.interactions = [event('click', log('click;'), { type: 'setSelected', targetId: target.id, value: 'false' }), event('selectedChange', log('selectedChange;')), event('select', log('select;')), event('change', log('change;'))];
    const runtime = runtimeFor(documentWith(source, target), portable); await runtime.submit(source.id);
    expect(runtime.widget(target)).toMatchObject({ checked: false, selected: true }); expect(runtime.state().variables.Log).toBe('click;selectedChange;select;');
  });
});
