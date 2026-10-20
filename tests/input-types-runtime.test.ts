import { afterEach, describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createWidget, serializeDocument, uid } from '../src/model/document';
import type { Action, Document, InputType, Interaction, Widget } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

const sessions: OfflineRuntime[] = [];
afterEach(() => { for (const session of sessions.splice(0)) session.dispose(); });
const action = (...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: 'Run', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(a => ({ ...a, id: uid() })) });
const docWith = (...widgets: Widget[]) => { const doc = createDocument(); doc.caseSelection = 'never'; doc.pages[0].widgets = widgets; doc.variables.Changes = '0'; return doc; };
const changes = (w: Widget) => { w.interactions = [{ ...action({ type: 'setVariable', targetId: 'Changes', value: '[[number(Changes)+1]]' }), event: 'change' }]; };
const field = (type: InputType, text = '') => ({ ...createWidget('input'), inputType: type, text });
function session(doc: Document, portable: boolean) {
  const result: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, new Script(`(${evaluateExpression.toString()})`).runInNewContext()) : createOfflineRuntime(doc, undefined, evaluateExpression);
  sessions.push(result); return result;
}
// Edge 155 + the original 11.0.0.4150 setter probes are recorded separately in
// research/input-types-evidence.json. These tests also exercise no-DOM export.
const cases: [InputType, string, string][] = [
  ...(['text', 'password', 'tel', 'search'] as const).map(type => [type, ' a\r\nb\tc ', ' ab\tc '] as [InputType, string, string]),
  ['email', ' \t a\r\nb@example.test \n', 'ab@example.test'], ['email', 'invalid address', 'invalid address'], ['email', '\u00a0x\u00a0', '\u00a0x\u00a0'],
  ['url', ' \nhttps://a.test/\r\nb\t ', 'https://a.test/b'], ['url', 'invalid url', 'invalid url'],
  ...['.5', '-.5', '01', '-0', '1e2', '1e+2', '1e-9999', '1.e2'].map(value => ['number', value, value] as [InputType, string, string]),
  ...['+1', '1.', ' 1 ', 'NaN', 'Infinity', '1e309'].map(value => ['number', value, ''] as [InputType, string, string]),
  ...['0001-01-01', '0004-02-29', '2000-02-29', '10000-02-29', '275760-09-13'].map(value => ['date', value, value] as [InputType, string, string]),
  ...['0000-01-01', '1900-02-29', '2026-02-29', '2026-1-01', '275760-09-14', '999999-01-01'].map(value => ['date', value, ''] as [InputType, string, string]),
  ['month', '2026-10', '2026-10'], ['month', '275760-09', '275760-09'], ['month', '275760-10', ''], ['month', '2026-00', ''],
  ...['00:00', '23:59:59', '12:30:01.000', '12:30:01.1', '12:30:01.10', '12:30:01.100'].map(value => ['time', value, value] as [InputType, string, string]),
  ...['24:00', '12:60', '12:30:60', '12:30:01.1000', '1:30'].map(value => ['time', value, ''] as [InputType, string, string]),
  ['file', 'C:\\private\\saved.txt', ''],
];
for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} input type values`, () => {
  it.each(cases)('reads %s authored %j as native %j without changing the project', (type, authored, expected) => {
    const w = field(type, authored), doc = docWith(w), saved = serializeDocument(doc), api = session(doc, portable);
    expect(api.controlValue(w.id)).toBe(expected); expect(api.text(`[[Widget.${w.id}.text]]`)).toBe(expected);
    expect(serializeDocument(doc)).toBe(saved);
  });
  it('uses sanitized values in chained actions, conditions and change callbacks', async () => {
    const w = field('number', '01'); changes(w); const api = session(docWith(w), portable);
    await api.execute(action({ type: 'setText', targetId: w.id, value: '+1' }, { type: 'setVariable', targetId: 'Read', value: `[[Widget.${w.id}.text]]` }));
    expect(api.state().variables.Read).toBe(''); expect(api.state().variables.Changes).toBe('1');
    expect(api.matches({ ...action(), conditions: [{ source: 'widgetText', key: w.id, operator: 'isEmpty', value: '' }] })).toBe(true);
    await api.execute(action({ type: 'setText', targetId: w.id, value: 'NaN' })); expect(api.state().variables.Changes).toBe('1');
    await api.execute(action({ type: 'setText', targetId: w.id, value: '.5' })); expect(api.controlValue(w.id)).toBe('.5'); expect(api.state().variables.Changes).toBe('2');
  });
  it('tracks Hint state separately from sanitized empty display and requested nonempty SetText', async () => {
    const w = { ...field('number', 'bad authored'), hintText: 'Enter a number', hintStyle: { color: '#123456' } }; changes(w);
    const api = session(docWith(w), portable); expect(api.hint(w.id)).toBe(w.hintText); expect(api.controlValue(w.id)).toBe(''); expect(api.widget(w).style.color).toBe('#123456');
    await api.execute(action({ type: 'setText', targetId: w.id, value: 'bad setter' }));
    expect(api.hint(w.id)).toBeUndefined(); expect(api.controlValue(w.id)).toBe(''); expect(api.state().variables.Changes).toBe('0');
    await api.execute(action({ type: 'setText', targetId: w.id, value: '12' })); expect(api.state().variables.Changes).toBe('1');
    await api.execute(action({ type: 'setText', targetId: w.id, value: '' })); expect(api.hint(w.id)).toBe(w.hintText); expect(api.state().variables.Changes).toBe('2');
  });
  it('compares email raw normalized display while reads of active hints remain empty', async () => {
    const w = { ...field('email'), hintText: ' hint@example.test ' }; changes(w); const api = session(docWith(w), portable);
    expect(api.controlValue(w.id)).toBe('hint@example.test'); expect(api.text(`[[Widget.${w.id}.text]]`)).toBe('');
    await api.execute(action({ type: 'setText', targetId: w.id, value: 'hint@example.test' }));
    expect(api.hint(w.id)).toBe(w.hintText); expect(api.state().variables.Changes).toBe('0');
    await api.execute(action({ type: 'setText', targetId: w.id, value: ' actual@example.test ' }));
    expect(api.hint(w.id)).toBeUndefined(); expect(api.text(`[[Widget.${w.id}.text]]`)).toBe('actual@example.test'); expect(api.state().variables.Changes).toBe('1');
  });
  it('keeps local file selection transient, ignores readonly/hint and rejects a different nonempty setter', async () => {
    const w = { ...field('file', 'not a selected file'), readOnly: true, hintText: 'ignored' }; changes(w);
    const doc = docWith(w), saved = serializeDocument(doc), api = session(doc, portable), chosen = 'C:\\fakepath\\local.txt';
    expect(api.hint(w.id)).toBeUndefined(); expect(api.controlValue(w.id)).toBe('');
    expect(api.input(w.id, chosen)).toBe(true); expect(api.controlValue(w.id)).toBe(chosen);
    await api.execute(action({ type: 'setText', targetId: w.id, value: chosen })); expect(api.controlValue(w.id)).toBe(chosen);
    await expect(api.execute(action({ type: 'setText', targetId: w.id, value: 'different.txt' }))).rejects.toThrow(/File inputs/);
    expect(api.controlValue(w.id)).toBe(chosen);
    await api.execute(action({ type: 'setText', targetId: w.id, value: '' })); expect(api.controlValue(w.id)).toBe(''); expect(api.state().variables.Changes).toBe('1');
    expect(serializeDocument(doc)).toBe(saved);
  });
  it('sanitizes row expressions per instance and changes only the selected row', async () => {
    const w = field('number', '[[Item.Value]]'), repeater = createWidget('repeater'); repeater.repeater!.columns = ['Value']; repeater.repeater!.rows = [{ Value: '01' }, { Value: 'bad' }]; repeater.repeater!.template = [w];
    const api = session(docWith(repeater), portable); await api.start(); const rows = api.rows(repeater);
    expect(rows.map(row => api.controlValue(w.id, row.context))).toEqual(['01', '']);
    await api.execute(action({ type: 'setText', targetId: w.id, value: '1.e2' }), undefined, rows[1].context);
    expect(rows.map(row => api.controlValue(w.id, row.context))).toEqual(['01', '1.e2']);
  });
  it('normalizes textarea line endings without removing newlines and leaves authored text intact', async () => {
    const w = { ...createWidget('textarea'), text: 'A\r\nB\rC' }, doc = docWith(w), api = session(doc, portable);
    expect(api.controlValue(w.id)).toBe('A\nB\nC');
    await api.execute(action({ type: 'setText', targetId: w.id, value: 'X\r\nY' })); expect(api.controlValue(w.id)).toBe('X\nY'); expect(w.text).toBe('A\r\nB\rC');
  });
});
