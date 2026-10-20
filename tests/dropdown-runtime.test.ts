import { afterEach, describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../src/model/document';
import type { Action, Document, Interaction, Widget } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

const sessions: OfflineRuntime[] = [];
afterEach(() => { for (const session of sessions.splice(0)) session.dispose(); });
const action = (...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: 'Run', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(a => ({ ...a, id: uid() })) });
const select = (options = ['A', 'A', '', ' ', 'B'], indices: number[] = [0], multiple = false): Widget => ({ ...createWidget('select'), options, selectedIndices: indices, multiple });
function fixture(...widgets: Widget[]) { const doc = createDocument(); doc.caseSelection = 'never'; doc.pages[0].widgets = widgets; doc.variables = { Count: '0', Log: '', Choice: 'B' }; return doc; }
function log(w: Widget) { w.interactions = [{ ...action({ type: 'setVariable', targetId: 'Count', value: '[[number(Count)+1]]' }, { type: 'setVariable', targetId: 'Log', value: `[[Log]][[Widget.${w.id}.text]];` }), event: 'change' }]; }
function session(doc: Document, portable: boolean) {
  const api: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, new Script(`(${evaluateExpression.toString()})`).runInNewContext()) : createOfflineRuntime(doc, undefined, evaluateExpression);
  sessions.push(api); return api;
}
const set = (w: Widget, value: string) => action({ type: 'setSelectedOption', targetId: w.id, value });
// Original Axure 11.0.0.4150 functions + shipped jQuery were probed separately;
// see research/dropdown-evidence.json. Both runtime forms execute this matrix.
for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} option selection`, () => {
  it.each([[[], [], ''], [['A'], [], ''], [['A', 'A'], [1], 'A'], [['', ' '], [1], ' '], [['A', 'B'], [0, 1], 'A,B']] as [string[], number[], string][])('preserves explicit indices for %j / %j', (options, indices, value) => {
    const w = select(options, indices, indices.length > 1), doc = fixture(w), saved = serializeDocument(doc), api = session(doc, portable);
    expect(api.selectedOptions(w.id)).toEqual(indices); expect(api.controlValue(w.id)).toBe(value); expect(api.text(`[[Widget.${w.id}.text]]`)).toBe(value);
    expect(serializeDocument(doc)).toBe(saved); const copy = api.selectedOptions(w.id); copy.push(100); expect(api.selectedOptions(w.id)).toEqual(indices);
  });
  it('resolves legacy text once consistently for display, expressions and conditions', async () => {
    const w = select(); delete w.selectedIndices; w.text = '[[Choice]]'; const api = session(fixture(w), portable);
    expect(api.controlValue(w.id)).toBe('B'); expect(api.selectedOptions(w.id)).toEqual([4]);
    await api.execute(action({ type: 'setVariable', targetId: 'Choice', value: 'A' }));
    expect(api.controlValue(w.id)).toBe('B');
    expect(api.matches({ ...action(), conditions: [{ source: 'widgetText', key: w.id, operator: 'equals', value: 'B' }] })).toBe(true);
    expect(api.matches({ ...action(), conditions: [{ source: 'selectedOption', key: w.id, operator: 'equals', value: 'B' }] })).toBe(true);
  });
  it('keeps unmatched legacy text unselected and detects circular legacy expressions', () => {
    const w = select(); delete w.selectedIndices; w.text = 'missing'; const api = session(fixture(w), portable); expect(api.selectedOptions(w.id)).toEqual([]); expect(api.controlValue(w.id)).toBe('');
    const cyclic = select(); delete cyclic.selectedIndices; cyclic.text = `[[Widget.${cyclic.id}.text]]`; expect(() => session(fixture(cyclic), portable).controlValue(cyclic.id)).toThrow('Circular');
  });
  it('dispatches user change between duplicate values and distinguishes input notifications', async () => {
    const w = select(); log(w); const api = session(fixture(w), portable);
    await api.chooseOptions(w.id, [1]); expect(api.selectedOptions(w.id)).toEqual([1]); expect(api.state().variables).toMatchObject({ Count: '1', Log: 'A;' });
    await api.chooseOptions(w.id, [1]); expect(api.state().variables.Count).toBe('2');
    expect(api.input(w.id, 'B')).toBe(true); expect(api.selectedOptions(w.id)).toEqual([4]); expect(api.state().variables.Count).toBe('2');
  });
  it('same-value setter preserves a later duplicate; a different value selects the first match', async () => {
    const w = select(undefined, [1]); log(w); const api = session(fixture(w), portable);
    await api.execute(set(w, 'A')); expect(api.selectedOptions(w.id)).toEqual([1]); expect(api.state().variables.Count).toBe('0');
    await api.execute(set(w, 'B')); await api.execute(set(w, 'A')); expect(api.selectedOptions(w.id)).toEqual([0]); expect(api.state().variables).toMatchObject({ Count: '2', Log: 'B;A;' });
  });
  it('missing values clear selection and repeat their change event', async () => {
    const w = select(); log(w); const api = session(fixture(w), portable);
    await api.execute(set(w, 'missing')); await api.execute(set(w, 'missing'));
    expect(api.selectedOptions(w.id)).toEqual([]); expect(api.controlValue(w.id)).toBe(''); expect(api.state().variables).toMatchObject({ Count: '2', Log: ';;' });
    await api.execute(set(w, '')); expect(api.selectedOptions(w.id)).toEqual([2]); expect(api.state().variables.Count).toBe('3');
    await api.execute(set(w, '')); expect(api.state().variables.Count).toBe('3');
    await api.execute(set(w, ' ')); expect(api.selectedOptions(w.id)).toEqual([3]); expect(api.controlValue(w.id)).toBe(' ');
  });
  it('programmatic sets and handlers work while hidden or disabled; user choice respects disabled ancestors', async () => {
    const w = select(); log(w); w.disabled = true; w.hidden = true; const api = session(fixture(w), portable);
    await api.chooseOptions(w.id, [4]); expect(api.selectedOptions(w.id)).toEqual([0]);
    await api.execute(set(w, 'B')); expect(api.selectedOptions(w.id)).toEqual([4]); expect(api.state().variables.Count).toBe('1');
    const child = select(), panel = createWidget('panel'); panel.disabled = true; panel.states![0].widgets = [child]; const nested = session(fixture(panel), portable);
    await nested.chooseOptions(child.id, [4]); expect(nested.selectedOptions(child.id)).toEqual([0]); await nested.execute(set(child, 'B')); expect(nested.selectedOptions(child.id)).toEqual([4]);
  });
  it('keeps ordinary selection, Set Text, error and focus flags separate from selected options', async () => {
    const w = select(); log(w); const api = session(fixture(w), portable);
    await api.execute(action({ type: 'setText', targetId: w.id, value: 'B' }, { type: 'setSelected', targetId: w.id, value: 'true' }, { type: 'setError', targetId: w.id, value: 'true' }));
    expect(api.selectedOptions(w.id)).toEqual([0]); expect(api.widget(w)).toMatchObject({ selected: true, error: true }); expect(api.state().variables.Count).toBe('0');
    await api.focus(w.id, true); await api.focus(w.id, false); expect(api.selectedOptions(w.id)).toEqual([0]);
  });
  it('selects all duplicate matches in multiple and repeats unequal array/scalar writes', async () => {
    const w = select(undefined, [4], true); log(w); const api = session(fixture(w), portable);
    await api.execute(set(w, 'A')); expect(api.selectedOptions(w.id)).toEqual([0, 1]); expect(api.controlValue(w.id)).toBe('A,A');
    await api.execute(set(w, 'A')); expect(api.state().variables.Count).toBe('2');
    expect(api.matches({ ...action(), conditions: [{ source: 'selectedOption', key: w.id, operator: 'equals', value: 'A' }] })).toBe(true);
  });
  it('preserves multiple loose equality quirks for [] and comma-joined arrays', async () => {
    const w = select(['', 'A', 'B', 'A,B'], [], true); log(w); const api = session(fixture(w), portable);
    await api.execute(set(w, '')); expect(api.selectedOptions(w.id)).toEqual([]); expect(api.state().variables.Count).toBe('0');
    await api.chooseOptions(w.id, [1, 2]); await api.execute(set(w, 'A,B')); expect(api.selectedOptions(w.id)).toEqual([1, 2]); expect(api.state().variables.Count).toBe('1');
    await api.execute(set(w, 'missing')); await api.execute(set(w, 'missing')); expect(api.state().variables.Count).toBe('3');
  });
  it('dispatches the handler synchronously between adjacent actions', async () => {
    const w = select(); log(w); const api = session(fixture(w), portable);
    await api.execute(action({ type: 'setSelectedOption', targetId: w.id, value: 'B' }, { type: 'setVariable', targetId: 'After', value: '[[Count]]:[[Log]]' }));
    expect(api.state().variables.After).toBe('1:B;');
  });
  it('rolls back option indices and variables after a later action fails', async () => {
    const w = select(), file = createWidget('input'); file.inputType = 'file'; file.text = ''; log(w); const doc = fixture(w, file), saved = serializeDocument(doc), api = session(doc, portable);
    await expect(api.execute(action({ type: 'setSelectedOption', targetId: w.id, value: 'B' }, { type: 'setText', targetId: file.id, value: 'no' }))).rejects.toThrow('File inputs');
    expect(api.selectedOptions(w.id)).toEqual([0]); expect(api.state().variables.Count).toBe('0'); expect(serializeDocument(doc)).toBe(saved);
  });
  it('bounds recursive unmatched setters and leaves the queue usable', async () => {
    const w = select(); w.interactions = [{ ...set(w, 'missing'), event: 'change' }]; const api = session(fixture(w), portable);
    await expect(api.execute(set(w, 'missing'))).rejects.toThrow('Option change event cycle'); expect(api.selectedOptions(w.id)).toEqual([0]);
    w.interactions = []; await api.execute(set(w, 'B')); expect(api.selectedOptions(w.id)).toEqual([4]);
  });
  it.each([[-1], [8], [0, 1], [1.5], [NaN]].map(indices => ({ indices })))('rejects invalid user indices $indices without mutation', async ({ indices }) => {
    const w = select(); const api = session(fixture(w), portable); await expect(api.chooseOptions(w.id, indices)).rejects.toThrow('Invalid selected option indices'); expect(api.selectedOptions(w.id)).toEqual([0]);
  });
  it('rejects unsorted or repeated multiple indices', async () => { const w = select(undefined, [], true), api = session(fixture(w), portable); for (const indices of [[1, 0], [1, 1]]) await expect(api.chooseOptions(w.id, indices)).rejects.toThrow('Invalid selected'); expect(api.selectedOptions(w.id)).toEqual([]); });
  it('isolates row choices, preserves hide/remount, resets refresh and invalidates stale rows', async () => {
    const w = select(), repeater = createWidget('repeater'); repeater.repeater!.template = [w]; const api = session(fixture(repeater), portable); await api.start(); const [first, second] = api.rows(repeater);
    await api.chooseOptions(w.id, [1], first.context); expect(api.selectedOptions(w.id, first.context)).toEqual([1]); expect(api.selectedOptions(w.id, second.context)).toEqual([0]);
    await api.execute(action({ type: 'hide', targetId: repeater.id }, { type: 'show', targetId: repeater.id })); expect(api.selectedOptions(w.id, first.context)).toEqual([1]);
    await api.execute(action({ type: 'sortRows', targetId: repeater.id, value: repeater.repeater!.columns[0] })); expect(api.selectedOptions(w.id, api.rows(repeater)[0].context)).toEqual([0]);
    await api.execute(action({ type: 'deleteRow', targetId: repeater.id, value: '0' })); await api.chooseOptions(w.id, [4], first.context); expect(api.selectedOptions(w.id, first.context)).toEqual([]); expect(api.selectedOptions(w.id)).toEqual([]);
  });
  it('evaluates broadcast values first, applies in reverse row order and skips equality per row', async () => {
    const w = select(['A', 'B'], [0]), repeater = createWidget('repeater'); repeater.repeater!.columns = ['Choice']; repeater.repeater!.rows = [{ Choice: 'A' }, { Choice: 'B' }, { Choice: 'B' }]; repeater.repeater!.template = [w];
    w.interactions = [{ ...action({ type: 'setVariable', targetId: 'Log', value: '[[Log]][[Item.index]];' }, { type: 'setVariable', targetId: 'Choice', value: 'A' }), event: 'change' }];
    const api = session(fixture(repeater), portable); await api.start(); const rows = api.rows(repeater); await api.chooseOptions(w.id, [1], rows[0].context); api.state().variables.Log = ''; api.state().variables.Choice = 'B';
    await api.execute(set(w, '[[Choice]]')); expect(api.state().variables.Log).toBe('3;2;'); expect(rows.map(row => api.selectedOptions(w.id, row.context))).toEqual([[1], [1], [1]]);
  });
  it('resets selection on page navigation, clears legacy initial values and ignores disposed requests', async () => {
    const w = select(); delete w.selectedIndices; w.text = '[[Choice]]'; const doc = fixture(w), other = createPage('Other'); doc.pages.push(other); const api = session(doc, portable);
    expect(api.selectedOptions(w.id)).toEqual([4]); await api.chooseOptions(w.id, [1]); await api.navigate(other.id); await api.execute(action({ type: 'setVariable', targetId: 'Choice', value: ' ' })); await api.navigate(doc.pages[0].id);
    expect(api.selectedOptions(w.id)).toEqual([3]); api.dispose(); await api.chooseOptions(w.id, [4]); expect(api.selectedOptions(w.id)).toEqual([3]);
  });
});
