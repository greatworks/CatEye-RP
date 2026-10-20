import { afterEach, describe, expect, it, vi } from 'vitest';
import { Script } from 'node:vm';
import { cloneWidgets, createDocument, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { createRuntime, executePageEvent } from '../src/runtime/engine';
import { evaluateExpression } from '../src/runtime/expressions';
import type { Action, Condition, Document, EventType, Interaction } from '../src/model/types';

const variable = (key: string, value: string): Omit<Action, 'id'> => ({ type: 'setVariable', targetId: key, value });
const equals = (key: string, value: string): Condition => ({ source: 'variable', key, operator: 'equals', value });
const caseOf = (actions: Omit<Action, 'id'>[], extra: Partial<Interaction> = {}): Interaction => ({
  id: uid(), event: 'click', name: 'Case', enabled: true, isNewIfGroup: false, conditionMode: 'all', conditions: [], actions: actions.map(a => ({ id: uid(), ...a })), ...extra,
});
afterEach(() => vi.useRealTimers());

describe('conditional chain document data', () => {
  it('preserves explicit boundaries through save/open and nested cloning without changing old documents', () => {
    const doc = createDocument(), panel = createWidget('panel'), child = createWidget('button');
    doc.pages[0].widgets = [panel]; panel.states![0].widgets = [child];
    child.interactions = [caseOf([], { isNewIfGroup: true }), caseOf([]), caseOf([], { isNewIfGroup: undefined })];
    delete child.interactions[2].isNewIfGroup;
    const reopened = parseDocument(serializeDocument(doc));
    expect(reopened).toEqual(doc);
    const cloned = cloneWidgets([panel])[0].states![0].widgets[0];
    expect(cloned.interactions.map(c => c.isNewIfGroup)).toEqual([true, false, undefined]);
    expect(cloned.interactions.map(c => c.id)).not.toEqual(child.interactions.map(c => c.id));
  });

  it.each([null, 0, 1, 'false', [], {}])('rejects a nonboolean chain marker %j', marker => {
    const doc = createDocument(); doc.pages[0].interactions = [caseOf([], { event: 'load' })];
    const raw = JSON.parse(JSON.stringify(doc)); raw.pages[0].interactions[0].isNewIfGroup = marker;
    expect(() => parseDocument(JSON.stringify(raw))).toThrow(/isNewIfGroup.*boolean/);
  });
});

for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} conditional case chains`, () => {
  const make = (doc: Document): OfflineRuntime => portable
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, evaluateExpression)
    : createOfflineRuntime(doc, undefined, evaluateExpression);
  function fixture() {
    const doc = createDocument(), button = createWidget('button'); doc.pages[0].widgets = [button];
    doc.caseSelection = 'never'; // These cases exercise direct IF-chain dispatch, not the choice UI.
    doc.variables = { Choice: 'B', Trace: '' }; return { doc, button };
  }

  it('runs only the first enabled match, never evaluating later conditions in the same chain', async () => {
    const { doc, button } = fixture();
    button.interactions = [
      caseOf([variable('Trace', 'A')], { isNewIfGroup: true, conditions: [equals('Choice', 'A')] }),
      caseOf([variable('Trace', 'B')], { conditions: [equals('Choice', 'B')] }),
      caseOf([variable('Trace', 'invalid')], { conditions: [equals('Choice', '[[1 / 0]]')] }),
      caseOf([variable('Trace', '[[Trace]]|next')], { isNewIfGroup: true, conditions: [equals('Trace', 'B')] }),
    ];
    const runtime = make(doc); await runtime.trigger(button.id, 'click');
    expect(runtime.state().variables.Trace).toBe('B|next'); runtime.dispose();
  });

  it('falls back after false/disabled cases, and an unconditional branch ends that chain', async () => {
    const { doc, button } = fixture();
    button.interactions = [
      caseOf([variable('Trace', 'wrong')], { isNewIfGroup: true, conditions: [equals('Choice', 'A')] }),
      caseOf([variable('Trace', 'disabled')], { enabled: false, conditions: [equals('Choice', '[[1 / 0]]')] }),
      caseOf([variable('Trace', 'fallback')]), caseOf([variable('Trace', 'unreachable')]),
    ];
    const runtime = make(doc); await runtime.trigger(button.id, 'click');
    expect(runtime.state().variables.Trace).toBe('fallback'); runtime.dispose();
  });

  it.each(['all', 'any'] as const)('short-circuits ordered %s conditions before an unnecessary invalid expression', async conditionMode => {
    const { doc, button } = fixture();
    button.interactions = [
      caseOf([variable('Trace', 'selected')], { isNewIfGroup: true, conditionMode, conditions: [equals('Choice', conditionMode === 'all' ? 'A' : 'B'), equals('Choice', '[[1 / 0]]')] }),
      caseOf([variable('Trace', 'fallback')]),
    ];
    const runtime = make(doc); await runtime.trigger(button.id, 'click');
    expect(runtime.state().variables.Trace).toBe(conditionMode === 'all' ? 'fallback' : 'selected'); runtime.dispose();
  });

  it('treats an empty matching case as selected and disabled IF as a real new boundary', async () => {
    const { doc, button } = fixture();
    button.interactions = [
      caseOf([], { isNewIfGroup: true }), caseOf([variable('Escaped', 'blocked')]),
      caseOf([variable('Trace', 'disabled')], { isNewIfGroup: true, enabled: false }),
      caseOf([variable('Trace', 'new chain fallback')]),
    ];
    const runtime = make(doc); await runtime.trigger(button.id, 'click');
    expect(runtime.state().variables.Trace).toBe('new chain fallback');
    expect(runtime.state().variables.Escaped).toBeUndefined(); runtime.dispose();
  });

  it('scopes boundaries to the triggered event and treats its first continuation as a chain start', async () => {
    const { doc, button } = fixture();
    button.interactions = [
      caseOf([variable('Trace', 'click')]),
      caseOf([variable('Trace', 'enter')], { event: 'mouseEnter', isNewIfGroup: true }),
      caseOf([variable('Trace', 'wrong click fallback')]),
      caseOf([variable('Trace', 'wrong enter fallback')], { event: 'mouseEnter' }),
    ];
    const runtime = make(doc); await runtime.trigger(button.id, 'click'); expect(runtime.state().variables.Trace).toBe('click');
    await runtime.trigger(button.id, 'mouseEnter'); expect(runtime.state().variables.Trace).toBe('enter'); runtime.dispose();
  });

  it('keeps legacy cases independent and resets chain selection on each event', async () => {
    const { doc, button } = fixture();
    button.interactions = [
      caseOf([variable('Trace', '[[Trace]]first|')], { isNewIfGroup: undefined }),
      caseOf([variable('Trace', '[[Trace]]second|')], { isNewIfGroup: undefined }),
      caseOf([variable('Trace', 'blocked')]),
    ];
    const runtime = make(doc); await runtime.trigger(button.id, 'click'); await runtime.trigger(button.id, 'click');
    expect(runtime.state().variables.Trace).toBe('first|second|first|second|'); runtime.dispose();
  });

  it('keeps a waiting match selected while the next IF and a different event proceed', async () => {
    vi.useFakeTimers(); const { doc, button } = fixture();
    button.interactions = [
      caseOf([variable('Trace', 'prefix'), { type: 'wait', duration: 100 }, variable('Trace', '[[Trace]]|tail')], { isNewIfGroup: true }),
      caseOf([variable('Trace', 'wrong fallback')]),
      caseOf([variable('Trace', '[[Trace]]|next')], { isNewIfGroup: true, conditions: [equals('Trace', 'prefix')] }),
      caseOf([variable('Trace', '[[Trace]]|enter')], { event: 'mouseEnter', isNewIfGroup: true }),
    ];
    const runtime = make(doc), pending = runtime.trigger(button.id, 'click');
    await runtime.trigger(button.id, 'mouseEnter'); expect(runtime.state().variables.Trace).toBe('prefix|next|enter');
    await vi.advanceTimersByTimeAsync(100); await pending;
    expect(runtime.state().variables.Trace).toBe('prefix|next|enter|tail'); runtime.dispose();
  });

  it('uses fresh branch selection for each repeater item and child Loaded event', async () => {
    const { doc } = fixture(), repeater = createWidget('repeater'), child = createWidget('text');
    doc.pages[0].widgets = [repeater]; doc.variables.Pick = 'A';
    repeater.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }], template: [child], itemHeight: 40, gap: 0 };
    repeater.interactions = [
      caseOf([{ type: 'setText', targetId: child.id, value: 'selected [[Item.Name]]' }], { event: 'itemLoad', isNewIfGroup: true, conditions: [equals('Pick', '[[Item.Name]]')] }),
      caseOf([{ type: 'setText', targetId: child.id, value: 'fallback [[Item.Name]]' }], { event: 'itemLoad' }),
    ];
    child.interactions = [
      caseOf([variable('Trace', '[[Trace]]child [[Item.Name]]|')], { event: 'load', isNewIfGroup: true }),
      caseOf([variable('Trace', 'wrong child branch')], { event: 'load' }),
    ];
    const runtime = make(doc); await runtime.start();
    expect(runtime.rows(repeater).map(r => runtime.widget(child, r.context).text)).toEqual(['selected A', 'fallback B']);
    expect(runtime.state().variables.Trace).toBe('child A|child B|'); runtime.dispose();
  });

  it('applies chain rules to Page Loaded and separately to widget Loaded', async () => {
    const { doc, button } = fixture();
    doc.pages[0].interactions = [caseOf([variable('Trace', 'page')], { event: 'load', isNewIfGroup: true }), caseOf([variable('Trace', 'wrong page')], { event: 'load' })];
    button.interactions = [caseOf([variable('Trace', '[[Trace]]|widget')], { event: 'load', isNewIfGroup: true }), caseOf([variable('Trace', 'wrong widget')], { event: 'load' })];
    const runtime = make(doc); await runtime.start();
    expect(runtime.state().variables.Trace).toBe('page|widget'); runtime.dispose();
  });
});

it.each(['load', 'click'] as EventType[])('snapshot page helper dispatches one complete %s case chain', async event => {
  const doc = createDocument(); doc.variables.Trace = '';
  doc.pages[0].interactions = [
    caseOf([variable('Trace', 'first')], { event, isNewIfGroup: true }),
    caseOf([variable('Trace', 'wrong')], { event }),
    caseOf([variable('Trace', '[[Trace]]|next')], { event, isNewIfGroup: true }),
  ];
  const original = createRuntime(doc), result = await executePageEvent(doc, original, event);
  expect(result.variables.Trace).toBe('first|next'); expect(original.variables.Trace).toBe('');
});
