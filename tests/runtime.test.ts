import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDemoDocument, createDocument, createPage, createWidget, findWidget, uid } from '../src/model/document';
import { createRuntime, evaluateConditions, executeInteraction, executePageEvent, executeWidgetEvent, getRuntimeWidget, resolveText } from '../src/runtime/engine';
import type { Action, Interaction } from '../src/model/types';

function interaction(actions: Omit<Action, 'id'>[], options: Partial<Interaction> = {}): Interaction {
  return { id: uid(), event: 'click', name: 'Test', enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(action => ({ id: uid(), ...action })), ...options };
}
function fixture() {
  const doc = createDocument(), button = createWidget('button'), input = createWidget('input'), panel = createWidget('panel'), repeater = createWidget('repeater');
  panel.states!.push({ id: uid(), name: 'Success', widgets: [] });
  input.text = 'Original';
  doc.pages[0].widgets = [button, input, panel, repeater];
  doc.pages.push(createPage('Details')); doc.variables = { Name: 'Alex', Count: '3', Empty: '' };
  return { doc, button, input, panel, repeater, state: createRuntime(doc) };
}
afterEach(() => vi.useRealTimers());

describe('runtime state and interpolation', () => {
  it('isolates runtime data from project data and rejects missing pages', () => {
    const { doc, repeater, state } = fixture();
    state.variables.Name = 'Mia'; state.repeaterRows[repeater.id][0].Name = 'Changed';
    expect(doc.variables.Name).toBe('Alex'); expect(repeater.repeater!.rows[0].Name).toBe('Item 1');
    expect(() => createRuntime(doc, 'missing')).toThrow('missing page');
    expect(createRuntime(doc, doc.pages[1].id).pageId).toBe(doc.pages[1].id);
  });

  it('supports bounded expressions and rejects arbitrary JavaScript access', () => {
    const { state } = fixture();
    expect(resolveText('Hi [[Name]], [[Item.Title]]!', state, { Title: 'welcome' })).toBe('Hi Alex, welcome!');
    expect(resolveText('[[Unknown]]', state)).toBe('');
    expect(()=>resolveText('[[constructor]]',state)).toThrow('Expression error');
    expect(()=>resolveText('[[globalThis.process.exit()]]',state)).toThrow('Expression error');
    expect(()=>resolveText('[[Item.constructor]]',state,{Name:'Row'})).toThrow('Expression error');
    expect(resolveText('[[Count + 1]]', state)).toBe('4');
    expect(resolveText('<img onerror="alert(1)">', state)).toBe('<img onerror="alert(1)">'); // Text rendering, never HTML evaluation.
  });

  it('runs sequential actions against updated variables and form text without mutating input', async () => {
    const { doc, input, state } = fixture();
    const result = await executeInteraction(doc, state, interaction([
      { type: 'setText', targetId: input.id, value: 'New name' },
      { type: 'setVariable', targetId: 'Name', value: `[[Widget.${input.id}.text]]` },
      { type: 'setText', targetId: input.id, value: 'Saved [[Name]]' },
    ]));
    expect(result.variables.Name).toBe('New name');
    expect(getRuntimeWidget(input, result).text).toBe('Saved New name');
    expect(state.variables.Name).toBe('Alex'); expect(state.widgetOverrides).toEqual({}); expect(input.text).toBe('Original');
  });

  it('reads a control initial value and row context in action values', async () => {
    const { doc, input, state } = fixture();
    const result = await executeInteraction(doc, state, interaction([{ type: 'setVariable', targetId: 'Result', value: `[[Widget.${input.id}.text]]: [[Item.Name]]` }]), { Name: 'First row' });
    expect(result.variables.Result).toBe('Original: First row');
  });

  it('does not re-interpret inserted form text as expressions and bounds expanding values', async () => {
    const { doc, input, state } = fixture(); state.widgetOverrides[input.id] = { text: '[[Name]]' };
    const result = await executeInteraction(doc, state, interaction([{ type: 'setVariable', targetId: 'Literal', value: `[[Widget.${input.id}.text]]` }]));
    expect(result.variables.Literal).toBe('[[Name]]');
    state.variables.Large = 'x'.repeat(60_000);
    await expect(executeInteraction(doc, state, interaction([{ type: 'setVariable', targetId: 'Large', value: '[[Large]][[Large]]' }]))).rejects.toThrow('Resolved text exceeds');
    expect(state.variables.Large).toHaveLength(60_000);
  });
});

describe('conditions and event dispatch', () => {
  it('supports all/any conditions, numeric comparisons, empty checks and variable RHS', () => {
    const { doc, input, state } = fixture();
    const test = interaction([], { conditions: [{ source: 'variable', key: 'Count', operator: 'greater', value: '2' }, { source: 'widgetText', key: input.id, operator: 'contains', value: 'rigi' }] });
    expect(evaluateConditions(doc, state, test)).toBe(true);
    test.conditions[0].value = '4'; expect(evaluateConditions(doc, state, test)).toBe(false);
    test.conditionMode = 'any'; expect(evaluateConditions(doc, state, test)).toBe(true);
    test.conditions = [{ source: 'variable', key: 'Empty', operator: 'isEmpty', value: '' }]; expect(evaluateConditions(doc, state, test)).toBe(true);
    test.conditions = [{ source: 'variable', key: 'Name', operator: 'equals', value: '[[Name]]' }]; expect(evaluateConditions(doc, state, test)).toBe(true);
    test.conditions = [{ source: 'variable', key: 'Empty', operator: 'less', value: '3' }]; expect(evaluateConditions(doc, state, test)).toBe(false);
    test.conditions = [{ source: 'variable', key: 'Name', operator: 'greater', value: '2' }]; expect(evaluateConditions(doc, state, test)).toBe(false);
    test.conditions = [{ source: 'widgetText', key: 'missing', operator: 'isEmpty', value: '' }]; expect(evaluateConditions(doc, state, test)).toBe(false);
  });

  it('ignores disabled cases, disabled widgets and unrelated event types', async () => {
    const { doc, button, state } = fixture();
    const disabled = interaction([{ type: 'setVariable', targetId: 'Name', value: 'Disabled' }], { enabled: false });
    expect(await executeInteraction(doc, state, disabled)).toBe(state);
    button.interactions = [disabled, interaction([{ type: 'setVariable', targetId: 'Name', value: 'Clicked' }])];
    expect(await executeWidgetEvent(doc, state, button, 'change')).toBe(state);
    button.disabled = true; expect(await executeWidgetEvent(doc, state, button, 'click')).toBe(state);
    button.disabled = false;
    const runtimeDisabled = { ...state, widgetOverrides: { [button.id]: { disabled: true } } };
    expect(await executeWidgetEvent(doc, runtimeDisabled, button, 'click')).toBe(runtimeDisabled);
    const clicked = await executeWidgetEvent(doc, state, button.id, 'click'); expect(clicked.variables.Name).toBe('Clicked');
  });

  it('dispatches page load cases in order', async () => {
    const { doc, state } = fixture();
    doc.pages[0].interactions = [
      interaction([{ type: 'setVariable', targetId: 'Name', value: 'Page' }], { event: 'load' }),
      interaction([{ type: 'setVariable', targetId: 'Name', value: '[[Name]] loaded' }], { event: 'load' }),
    ];
    expect((await executePageEvent(doc, state)).variables.Name).toBe('Page loaded');
  });
});

describe('action execution', () => {
  it('changes visibility, size, position, appearance and enabled state cumulatively', async () => {
    const { doc, input, state } = fixture();
    const result = await executeInteraction(doc, state, interaction([
      { type: 'hide', targetId: input.id }, { type: 'toggle', targetId: input.id },
      { type: 'move', targetId: input.id, x: 42, y: 68 }, { type: 'resize', targetId: input.id, x: 360, y: 50 },
      { type: 'setStyle', targetId: input.id, style: { fill: '#ff0000' } }, { type: 'setStyle', targetId: input.id, style: { radius: 8 } },
      { type: 'disable', targetId: input.id },
    ]));
    const final = getRuntimeWidget(input, result);
    expect(final).toMatchObject({ hidden: false, disabled: true, x: 42, y: 68, width: 360, height: 50 });
    expect(final.style).toMatchObject({ fill: '#ff0000', radius: 8, fontSize: input.style.fontSize });
    const enabled = await executeInteraction(doc, result, interaction([{ type: 'enable', targetId: input.id }]));
    expect(getRuntimeWidget(input, enabled).disabled).toBe(false);
  });

  it('bounds invalid geometry and safely ignores deleted targets and external navigation', async () => {
    const { doc, input, state } = fixture();
    const result = await executeInteraction(doc, state, interaction([
      { type: 'move', targetId: input.id, x: Number.NaN, y: 2_000_000 },
      { type: 'resize', targetId: input.id, x: -5, y: Number.POSITIVE_INFINITY },
      { type: 'setText', targetId: 'deleted', value: 'ignored' },
      { type: 'openPage', targetId: 'javascript:alert(1)' },
      { type: 'setVariable', targetId: '__proto__', value: 'bad' },
    ]));
    expect(getRuntimeWidget(input, result)).toMatchObject({ x: input.x, y: 100_000, width: 1, height: input.height });
    expect(result.pageId).toBe(state.pageId); expect(result.pendingNavigation).toBeUndefined();
    expect(Object.hasOwn(result.variables, '__proto__')).toBe(false);
  });

  it('navigates only to document pages and retains variables', async () => {
    const { doc, state } = fixture();
    const next = await executeInteraction(doc, state, interaction([{ type: 'openPage', targetId: doc.pages[1].id }]));
    expect(next.pageId).toBe(doc.pages[1].id); expect(next.pendingNavigation).toBe(doc.pages[1].id); expect(next.variables.Name).toBe('Alex');
  });

  it('sets panel states by name/id and wraps next/previous state', async () => {
    const { doc, panel, state } = fixture(); const first = panel.activeStateId, second = panel.states![1].id;
    let next = await executeInteraction(doc, state, interaction([{ type: 'nextState', targetId: panel.id }]));
    expect(getRuntimeWidget(panel, next).activeStateId).toBe(second);
    next = await executeInteraction(doc, next, interaction([{ type: 'nextState', targetId: panel.id }]));
    expect(getRuntimeWidget(panel, next).activeStateId).toBe(first);
    next = await executeInteraction(doc, next, interaction([{ type: 'previousState', targetId: panel.id }]));
    expect(getRuntimeWidget(panel, next).activeStateId).toBe(second);
    next = await executeInteraction(doc, next, interaction([{ type: 'setState', targetId: panel.id, value: 'State 1' }]));
    expect(getRuntimeWidget(panel, next).activeStateId).toBe(first);
    next = await executeInteraction(doc, next, interaction([{ type: 'setState', targetId: panel.id, value: second }]));
    expect(getRuntimeWidget(panel, next).activeStateId).toBe(second);
    next = await executeInteraction(doc, next, interaction([{ type: 'setState', targetId: panel.id, value: 'Missing' }]));
    expect(getRuntimeWidget(panel, next).activeStateId).toBe(second);
  });

  it('waits before subsequent actions and leaves the original state unchanged during execution', async () => {
    vi.useFakeTimers();
    const { doc, state } = fixture(); let completed = false;
    const promise = executeInteraction(doc, state, interaction([
      { type: 'setVariable', targetId: 'Name', value: 'Before' },
      { type: 'wait', duration: 100 }, { type: 'setVariable', targetId: 'Name', value: '[[Name]] after' },
    ])).then(result => { completed = true; return result; });
    await vi.advanceTimersByTimeAsync(99); expect(completed).toBe(false); expect(state.variables.Name).toBe('Alex');
    await vi.advanceTimersByTimeAsync(1); expect((await promise).variables.Name).toBe('Before after');
  });
});

describe('repeater data', () => {
  it('sorts numerically, filters without losing data, adds rows and deletes visible rows', async () => {
    const { doc, repeater } = fixture();
    repeater.repeater!.columns = ['Name', 'Count']; repeater.repeater!.rows = [{ Name: 'A', Count: '10' }, { Name: 'B', Count: '2' }, { Name: 'C', Count: '1' }];
    let state = createRuntime(doc);
    state = await executeInteraction(doc, state, interaction([{ type: 'sortRows', targetId: repeater.id, value: 'Count:asc' }]));
    expect(state.repeaterRows[repeater.id].map(row => row.Name)).toEqual(['C', 'B', 'A']);
    state = await executeInteraction(doc, state, interaction([{ type: 'filterRows', targetId: repeater.id, value: JSON.stringify({ column: 'Count', operator: 'greater', value: '1' }) }]));
    expect(state.repeaterRows[repeater.id].map(row => row.Name)).toEqual(['B', 'A']);
    state = await executeInteraction(doc, state, interaction([{ type: 'deleteRow', targetId: repeater.id, value: '0' }, { type: 'addRow', targetId: repeater.id, value: '{"Name":"D","Count":"3"}' }]));
    expect(state.repeaterRows[repeater.id].map(row => row.Name)).toEqual(['D', 'A']);
    state = await executeInteraction(doc, state, interaction([{ type: 'filterRows', targetId: repeater.id, value: '' }]));
    expect(state.repeaterRows[repeater.id].map(row => row.Name)).toEqual(['C', 'D', 'A']);
    expect(repeater.repeater!.rows.map(row => row.Name)).toEqual(['A', 'B', 'C']);
  });

  it('validates row/filter/sort inputs and keeps a failed action transaction isolated', async () => {
    const { doc, repeater, state } = fixture();
    for (const [type, value] of [['addRow', '[]'], ['addRow', '{"Unknown":"x"}'], ['addRow', '{"Name":42}'], ['addRow', '{"__proto__":"x"}'], ['sortRows', 'Name:sideways'], ['filterRows', '{"column":"Missing","operator":"contains","value":"a"}'], ['deleteRow', '-1']] as const) {
      await expect(executeInteraction(doc, state, interaction([{ type, targetId: repeater.id, value }]))).rejects.toThrow();
    }
    await expect(executeInteraction(doc, state, interaction([{ type: 'setVariable', targetId: 'Name', value: 'Modified' }, { type: 'addRow', targetId: repeater.id, value: 'bad json' }]))).rejects.toThrow();
    expect(state.variables.Name).toBe('Alex'); expect(state.repeaterRows[repeater.id]).toHaveLength(3);
  });

  it('clears sorting to insertion order, ignores out-of-range deletion and deletes all data', async () => {
    const { doc, repeater, state } = fixture();
    let next = await executeInteraction(doc, state, interaction([{ type: 'sortRows', targetId: repeater.id, value: 'Name:desc' }, { type: 'sortRows', targetId: repeater.id, value: '' }, { type: 'deleteRow', targetId: repeater.id, value: '100' }]));
    expect(next.repeaterRows[repeater.id].map(row => row.Name)).toEqual(['Item 1', 'Item 2', 'Item 3']);
    next = await executeInteraction(doc, next, interaction([{ type: 'deleteRow', targetId: repeater.id, value: 'all' }]));
    expect(next.repeaterRows[repeater.id]).toEqual([]);
  });
});

describe('demo integration', () => {
  it('follows dashboard to form, blocks empty submission, then displays the typed project name', async () => {
    const doc = createDemoDocument(), dashboard = doc.pages[0], details = doc.pages[1];
    const newProject = dashboard.widgets.find(w => w.name === 'New project')!;
    let state = await executeWidgetEvent(doc, createRuntime(doc), newProject, 'click'); expect(state.pageId).toBe(details.id);
    const save = details.widgets.find(w => w.name === 'Save project')!, input = details.widgets.find(w => w.name === 'Project name input')!, feedback = details.widgets.find(w => w.name === 'Form feedback')!;
    state = await executeWidgetEvent(doc, state, save, 'click'); expect(getRuntimeWidget(feedback, state).hidden).toBe(true);
    state = { ...state, widgetOverrides: { ...state.widgetOverrides, [input.id]: { text: 'New dashboard' } } };
    state = await executeWidgetEvent(doc, state, save, 'click');
    expect(getRuntimeWidget(feedback, state).hidden).toBe(false);
    expect(getRuntimeWidget(feedback, state).text).toContain('New dashboard'); expect(state.variables.LastProject).toBe('New dashboard');
    const panel = dashboard.widgets.find(w => w.type === 'panel')!;
    const nextButton = panel.states![0].widgets.find(w => w.name === 'Panel next')!;
    state = await executeWidgetEvent(doc, state, findWidget(dashboard, nextButton.id)!, 'click');
    expect(getRuntimeWidget(panel, state).activeStateId).toBe(panel.states![1].id);
  });
});
