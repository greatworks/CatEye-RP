import { afterEach, describe, expect, it, vi } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createPage, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import type { Action, Document, Interaction } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import { createRuntime, executeWidgetEvent } from '../src/runtime/engine';

const set = (value: string): Omit<Action, 'id'> => ({ type: 'setVariable', targetId: 'Trace', value });
const branch = (name: string, actions: Omit<Action, 'id'>[] = [set(name)], extra: Partial<Interaction> = {}): Interaction => ({
  id: uid(), name, event: 'click', enabled: true, isNewIfGroup: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })), ...extra,
});
const condition = { source: 'variable', key: 'Choice', operator: 'equals', value: 'yes' } as const;
afterEach(() => vi.useRealTimers());

describe('case selection document policy', () => {
  it.each(['auto', 'always', 'never'] as const)('roundtrips %s and defaults new documents to auto', policy => {
    const doc = createDocument(); expect(doc.caseSelection).toBe('auto'); doc.caseSelection = policy;
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  });
  it('does not add a setting to legacy documents', () => {
    const doc = createDocument(); delete doc.caseSelection;
    expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    expect(parseDocument(serializeDocument(doc))).not.toHaveProperty('caseSelection');
  });
  it.each([null, 0, true, {}, [], 'sometimes'])('rejects invalid policy %j', policy => {
    const doc = { ...createDocument(), caseSelection: policy };
    expect(() => parseDocument(JSON.stringify(doc))).toThrow(/caseSelection/);
  });
});

for (const portable of [false, true]) describe(`${portable ? 'serialized VM' : 'module'} case selection`, () => {
  const make = (doc: Document): OfflineRuntime => portable
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, evaluateExpression)
    : createOfflineRuntime(doc, undefined, evaluateExpression);
  const fixture = () => {
    const doc = createDocument(), button = createWidget('button'); doc.pages[0].widgets = [button]; doc.variables = { Trace: '', Choice: 'no' };
    button.interactions = [branch('First'), branch('Second', undefined, { isNewIfGroup: false }), branch('Disabled', undefined, { enabled: false })];
    return { doc, button };
  };
  it('defers all actions and selects exactly one unconditional case, independent of IF boundaries', async () => {
    const { doc, button } = fixture(), runtime = make(doc);
    await runtime.trigger(button.id, 'click', undefined, [], { x: 31, y: 47 });
    expect(runtime.state().variables.Trace).toBe('');
    const menu = runtime.state().caseMenus![0];
    expect(menu).toMatchObject({ sourceId: button.id, mode: 'cases', anchor: { x: 31, y: 47 } });
    expect(menu.options.map(option => option.name)).toEqual(['First', 'Second']);
    await runtime.selectCase(menu.id, menu.options[1].id);
    expect(runtime.state().variables.Trace).toBe('Second'); expect(runtime.state().caseMenus).toBeUndefined(); runtime.dispose();
  });
  it.each(['never', undefined] as const)('keeps direct chain execution for %s policy', async policy => {
    const { doc, button } = fixture(); doc.caseSelection = policy; const runtime = make(doc);
    await runtime.trigger(button.id, 'click'); expect(runtime.state().variables.Trace).toBe('First'); expect(runtime.state().caseMenus).toBeUndefined(); runtime.dispose();
  });
  it('does not count disabled cases towards the auto threshold, but counts enabled empty cases', async () => {
    const { doc, button } = fixture(); button.interactions[1].enabled = false; const runtime = make(doc);
    await runtime.trigger(button.id, 'click'); expect(runtime.state().variables.Trace).toBe('First'); expect(runtime.state().caseMenus).toBeUndefined();
    button.interactions[1].enabled = true; button.interactions[1].actions = [];
    await runtime.trigger(button.id, 'click'); const menu = runtime.state().caseMenus![0]; expect(menu.options).toHaveLength(2);
    await runtime.selectCase(menu.id, menu.options[1].id); expect(runtime.state().variables.Trace).toBe('First'); runtime.dispose();
  });
  it('suppresses auto menus when even a disabled case has conditions', async () => {
    const { doc, button } = fixture(); button.interactions[2].conditions = [condition]; const runtime = make(doc);
    await runtime.trigger(button.id, 'click'); expect(runtime.state().variables.Trace).toBe('First'); expect(runtime.state().caseMenus).toBeUndefined(); runtime.dispose();
  });
  it('always displays a single enabled case without automatically running it', async () => {
    const { doc, button } = fixture(); doc.caseSelection = 'always'; button.interactions = [branch('Only')]; const runtime = make(doc);
    await runtime.trigger(button.id, 'click'); expect(runtime.state().variables.Trace).toBe('');
    const menu = runtime.state().caseMenus![0]; expect(menu.options).toHaveLength(1);
    await runtime.selectCase(menu.id, menu.options[0].id); expect(runtime.state().variables.Trace).toBe('Only'); runtime.dispose();
  });
  it.each([false, true])('keeps Always event menus when all cases are disabled (conditional=%s)', async conditional => {
    const { doc, button } = fixture(); doc.caseSelection = 'always'; button.interactions = [branch('Disabled', undefined, { enabled: false, conditions: conditional ? [condition] : [] })];
    const runtime = make(doc); await runtime.trigger(button.id, 'click'); const menu = runtime.state().caseMenus![0];
    expect(menu.options).toHaveLength(conditional ? 1 : 0); expect(runtime.state().variables.Trace).toBe('');
    if (conditional) await runtime.selectCase(menu.id, 'event'); else runtime.cancelCaseMenus(menu.id);
    expect(runtime.state().variables.Trace).toBe(''); expect(runtime.state().caseMenus).toBeUndefined(); runtime.dispose();
  });
  it('offers one conditional event entry and evaluates the entire event against current state at selection time', async () => {
    const { doc, button } = fixture(); doc.caseSelection = 'always';
    button.interactions = [branch('Yes', undefined, { conditions: [condition] }), branch('No', undefined, { isNewIfGroup: false }), branch('Suffix', [set('[[Trace]]|next')])];
    const runtime = make(doc); await runtime.trigger(button.id, 'click'); const menu = runtime.state().caseMenus![0];
    expect(menu.mode).toBe('event'); expect(menu.options).toEqual([{ id: 'event', name: 'Run event' }]); expect(runtime.state().variables.Trace).toBe('');
    await runtime.execute(branch('Change', [{ type: 'setVariable', targetId: 'Choice', value: 'yes' }]));
    await runtime.selectCase(menu.id, 'event'); expect(runtime.state().variables.Trace).toBe('Yes|next'); expect(runtime.state().caseMenus).toBeUndefined(); runtime.dispose();
  });
  it('replaces a source menu across event types while independent sources coexist; old tokens cannot execute', async () => {
    const { doc, button } = fixture(), other = createWidget('button'); other.interactions = [branch('Other1'), branch('Other2')]; doc.pages[0].widgets.push(other);
    button.interactions.push(branch('Enter1', undefined, { event: 'mouseEnter' }), branch('Enter2', undefined, { event: 'mouseEnter' }));
    const runtime = make(doc); await runtime.trigger(button.id, 'click'); const old = runtime.state().caseMenus![0];
    await runtime.trigger(other.id, 'click'); await runtime.trigger(button.id, 'mouseEnter');
    expect(runtime.state().caseMenus).toHaveLength(2); expect(runtime.state().caseMenus!.map(menu => menu.event)).toEqual(['click', 'mouseEnter']);
    await runtime.selectCase(old.id, old.options[0].id); expect(runtime.state().variables.Trace).toBe('');
    const current = runtime.state().caseMenus![1]; runtime.cancelCaseMenus(current.id); expect(runtime.state().caseMenus).toHaveLength(1);
    runtime.cancelCaseMenus(); expect(runtime.state().caseMenus).toBeUndefined(); runtime.dispose();
  });
  it('rejects invalid options without dismissing a valid menu, and canceled/repeated choices do nothing', async () => {
    const { doc, button } = fixture(); button.interactions[0].actions = [{ id: uid(), ...set('[[Trace]]A') }];
    const runtime = make(doc); await runtime.trigger(button.id, 'click'); const menu = runtime.state().caseMenus![0];
    await runtime.selectCase(menu.id, 'unknown'); expect(runtime.state().caseMenus).toHaveLength(1);
    await Promise.all([runtime.selectCase(menu.id, menu.options[0].id), runtime.selectCase(menu.id, menu.options[0].id)]);
    expect(runtime.state().variables.Trace).toBe('A');
    await runtime.trigger(button.id, 'click'); const canceled = runtime.state().caseMenus![0]; runtime.cancelCaseMenus(canceled.id);
    await runtime.selectCase(canceled.id, canceled.options[1].id); expect(runtime.state().variables.Trace).toBe('A'); runtime.dispose();
  });
  it('bypasses choice for initialization Page Loaded but not widget Loaded or explicit page event dispatch', async () => {
    const { doc, button } = fixture(); doc.caseSelection = 'always';
    doc.pages[0].interactions = [branch('Page', undefined, { event: 'load' })]; button.interactions = [branch('Widget', undefined, { event: 'load' })];
    const runtime = make(doc); await runtime.start(); expect(runtime.state().variables.Trace).toBe('Page'); expect(runtime.state().caseMenus).toHaveLength(1);
    const menu = runtime.state().caseMenus![0]; expect(menu.sourceId).toBe(button.id); await runtime.selectCase(menu.id, menu.options[0].id); expect(runtime.state().variables.Trace).toBe('Widget');
    await runtime.triggerPage('load'); expect(runtime.state().caseMenus![0].sourceId).toBe(doc.pages[0].id); runtime.dispose();
  });
  it('keeps Item Loaded menus separate for every row and selects actions in that source row', async () => {
    const doc = createDocument(), repeater = createWidget('repeater'), child = createWidget('text'); doc.pages[0].widgets = [repeater];
    repeater.repeater!.columns = ['Name']; repeater.repeater!.rows = [{ Name: 'A' }, { Name: 'B' }]; repeater.repeater!.template = [child];
    repeater.interactions = ['One', 'Two'].map(name => branch(name, [{ type: 'setText', targetId: child.id, value: `[[Item.Name]] ${name}` }], { event: 'itemLoad' }));
    const runtime = make(doc); await runtime.start(); const menus = runtime.state().caseMenus!; expect(menus).toHaveLength(2);
    await runtime.selectCase(menus[1].id, menus[1].options[1].id);
    const rows = runtime.rows(repeater); expect(runtime.widget(child, rows[1].context).text).toBe('B Two'); expect(runtime.widget(child, rows[0].context).text).toBe(child.text);
    expect(runtime.state().caseMenus).toHaveLength(1); runtime.dispose();
  });
  it('removes menus for deleted source rows before they can act on a replacement row', async () => {
    const doc = createDocument(), repeater = createWidget('repeater'), child = createWidget('button'); doc.pages[0].widgets = [repeater]; repeater.repeater!.template = [child];
    child.interactions = [branch('First'), branch('Second')]; const runtime = make(doc); await runtime.start();
    const row = runtime.rows(repeater)[0]; await runtime.trigger(child.id, 'click', row.data, row.context); const menu = runtime.state().caseMenus![0];
    await runtime.execute(branch('Delete', [{ type: 'deleteRow', targetId: repeater.id, value: '0' }])); expect(runtime.state().caseMenus).toBeUndefined();
    await runtime.selectCase(menu.id, menu.options[0].id); expect(runtime.state().variables.Trace).toBeUndefined(); runtime.dispose();
  });
  it.each([false, true])('retains source Item display information while reading live columns after a sort (conditional=%s)', async conditional => {
    const doc = createDocument(), repeater = createWidget('repeater'), child = createWidget('button'); doc.caseSelection = 'always'; doc.variables.One = '1'; doc.pages[0].widgets = [repeater];
    repeater.repeater!.columns = ['Name']; repeater.repeater!.rows = [{ Name: 'A' }, { Name: 'B' }]; repeater.repeater!.template = [child];
    child.interactions = [branch('Original index', [set('[[Item.Name]]:[[Item.index]]')], { conditions: conditional ? [{ source: 'variable', key: 'One', operator: 'equals', value: '[[Item.index]]' }] : [] }), branch('Fallback', [set('wrong')], { isNewIfGroup: false })];
    const runtime = make(doc); await runtime.start(); const row = runtime.rows(repeater)[0]; await runtime.trigger(child.id, 'click', row.data, row.context); const menu = runtime.state().caseMenus![0];
    await runtime.execute(branch('Sort and update', [{ type: 'sortRows', targetId: repeater.id, value: 'Name:desc' }, { type: 'updateRow', targetId: repeater.id, value: JSON.stringify({ where: { column: 'Name', operator: 'equals', value: 'A' }, values: { Name: 'Updated' } }) }]));
    await runtime.selectCase(menu.id, menu.options[0].id); expect(runtime.state().variables.Trace).toBe('Updated:1'); runtime.dispose();
  });
  it('runs selected Wait tails without holding the event queue, and clears stale choices on navigation/disposal', async () => {
    vi.useFakeTimers(); const { doc, button } = fixture(); doc.pages.push(createPage('Destination'));
    button.interactions[0].actions = [{ id: uid(), ...set('prefix') }, { id: uid(), type: 'wait', duration: 100 }, { id: uid(), ...set('[[Trace]]|tail') }];
    const runtime = make(doc); await runtime.trigger(button.id, 'click'); const menu = runtime.state().caseMenus![0]; const pending = runtime.selectCase(menu.id, menu.options[0].id);
    await runtime.execute(branch('Other', [set('[[Trace]]|other')])); expect(runtime.state().variables.Trace).toBe('prefix|other'); expect(runtime.state().caseMenus).toBeUndefined();
    await vi.advanceTimersByTimeAsync(100); await pending; expect(runtime.state().variables.Trace).toBe('prefix|other|tail');
    await runtime.trigger(button.id, 'click'); const stale = runtime.state().caseMenus![0]; await runtime.navigate(doc.pages[1].id);
    await runtime.selectCase(stale.id, stale.options[0].id); expect(runtime.state().caseMenus).toBeUndefined(); expect(runtime.state().variables.Trace).toBe('prefix|other|tail');
    await runtime.navigate(doc.pages[0].id); await runtime.trigger(button.id, 'click'); const disposed = runtime.state().caseMenus![0]; runtime.dispose();
    await runtime.selectCase(disposed.id, disposed.options[0].id); expect(runtime.state().caseMenus).toBeUndefined(); expect(vi.getTimerCount()).toBe(0);
  });
});

it('noninteractive snapshot helpers execute directly rather than returning unusable session tokens', async () => {
  const doc = createDocument(), button = createWidget('button'); doc.caseSelection = 'always'; doc.pages[0].widgets = [button]; button.interactions = [branch('First')];
  const result = await executeWidgetEvent(doc, createRuntime(doc), button.id, 'click'); expect(result.variables.Trace).toBe('First'); expect(result.caseMenus).toBeUndefined();
});
