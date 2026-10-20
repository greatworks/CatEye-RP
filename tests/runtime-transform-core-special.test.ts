import { Script } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import type { Action, Interaction, MoveTargetSpec, Widget } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import source from '../research/runtime-transform-special-final-probes.json';

const sessions: OfflineRuntime[] = [];
afterEach(() => { sessions.splice(0).forEach(r => r.dispose()); vi.useRealTimers(); });
const action = (value: Omit<Action, 'id'>): Action => ({ id: uid(), ...value });
const event = (actions: Action[], name: Interaction['event'] = 'click'): Interaction => ({ id: uid(), name, event: name, enabled: true, conditions: [], conditionMode: 'all', actions });
const move = (fields: Partial<MoveTargetSpec>) => action({ type: 'move', move: { targets: [{ target: { kind: 'widgetsBelow' }, mode: 'delta', x: { text: '0' }, y: { text: '10' }, trajectory: 'straight', easing: 'none', duration: 64, ...fields }] } });
const shape = (x: number, y: number, width: number, height: number): Widget => ({ ...createWidget('box', x, y), width, height });
function fixture() { const doc = createDocument(), box = shape(100, 100, 100, 50); doc.pages[0].widgets = [box]; doc.variables = { Log: '' }; return { doc, box }; }

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} special motion consumers`, () => {
  function make(doc: ReturnType<typeof createDocument>, evaluator: typeof evaluateExpression = evaluateExpression) {
    vi.useFakeTimers(); const factory: typeof createOfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout, Date }) : createOfflineRuntime;
    const r = factory(parseDocument(serializeDocument(doc)), undefined, evaluator); sessions.push(r); return r;
  }
  for (const sample of source.results.filter(r => r.name.startsWith('ordinary arc samples'))) it(sample.name, async () => {
    const [x, y, trajectory] = sample.name.slice('ordinary arc samples '.length).split('/');
    const { doc, box } = fixture(), r = make(doc), pending = r.execute(event([move({ target: { kind: 'widget', id: box.id }, x: { text: x }, y: { text: y }, trajectory: trajectory as MoveTargetSpec['trajectory'], easing: 'linear', duration: 64 })]));
    const calls = (sample.observed as unknown as { calls: { sample?: number; nodes?: Record<string, { left: number; top: number }> }[] }).calls.filter(c => c.sample !== undefined);
    for (const [i, c] of calls.entries()) { await vi.advanceTimersByTimeAsync(i ? 16 : 0); expect(r.widget(box).x).toBeCloseTo(c.nodes!.u1.left, 9); expect(r.widget(box).y).toBeCloseTo(c.nodes!.u1.top, 9); }
    await pending;
  });
  it('selects same-container siblings with strict overlap, including hidden widgets, in document order', async () => {
    const { doc, box } = fixture(), yes = shape(199, 150, 10, 20), touch = shape(200, 150, 10, 20), above = shape(100, 149.999, 10, 20), hidden = shape(100, 150, 10, 20);
    hidden.hidden = true; doc.pages[0].widgets.push(yes, touch, above, hidden);
    yes.interactions = [event([action({ type: 'setVariable', targetId: 'Log', value: '[[Log]]Y' })], 'move')]; hidden.interactions = [event([action({ type: 'setVariable', targetId: 'Log', value: '[[Log]]H' })], 'move')]; box.interactions = [event([move({})])];
    const r = make(doc); await r.trigger(box.id, 'click'); expect(r.widget(yes).y).toBe(160); expect(r.widget(hidden)).toMatchObject({ y: 160, hidden: true }); expect(r.widget(touch).y).toBe(150); expect(r.widget(above).y).toBe(149.999); expect(r.state().variables.Log).toBe('YH');
  });
  it('uses resize-old threshold and inferred signed size change; ordinary inferred movement is one pixel', async () => {
    const { doc, box } = fixture(), following = shape(110, 155, 20, 20); doc.pages[0].widgets.push(following);
    box.interactions = [event([move({ mode: 'sizeDeltaY' })], 'resize'), event([move({ mode: 'sizeDeltaY' })])];
    const r = make(doc); await r.execute(event([action({ type: 'resize', resize: { targets: [{ target: { kind: 'widget', id: box.id }, width: { text: '100' }, height: { text: '80' }, anchor: 'top left', easing: 'none', duration: 0 }] } })]));
    expect(r.widget(following).y).toBe(185); await r.trigger(box.id, 'click'); expect(r.widget(following).y).toBe(186);
  });
  it('Right compression applies the complementary axis and ignores authored trajectory in its direct consumer', async () => {
    const { doc, box } = fixture(), following = shape(200, 110, 20, 20); doc.pages[0].widgets.push(following); box.interactions = [event([move({ target: { kind: 'widgetsRight' }, x: { text: '10' }, y: { text: '10' }, easing: 'linear' })])];
    const r = make(doc), pending = r.trigger(box.id, 'click'); await vi.advanceTimersByTimeAsync(32);
    expect(r.widget(following).x).toBeCloseTo(202.92893218813452); expect(r.widget(following).y).toBeCloseTo(117.07106781186548);
    await vi.advanceTimersByTimeAsync(32); await pending; expect(r.widget(following)).toMatchObject({ x: 210, y: 120 });
  });
  it('does not cross panel state or row instances and pushes a direct non-fit item', async () => {
    const { doc } = fixture(), list = createWidget('repeater'), box = shape(0, 0, 100, 10), following = shape(10, 10, 20, 10), outside = shape(10, 10, 20, 10);
    list.style.strokeWidth = 0; list.repeater = { columns: ['Name'], rows: [{ Name: 'a' }, { Name: 'b' }], template: [box, following], itemWidth: 100, itemHeight: 20, gap: 0, layout: 'vertical', fitToContent: false };
    box.interactions = [event([move({ y: { text: '5' } })])]; doc.pages[0].widgets = [list, outside]; const r = make(doc); await r.start(); const rows = r.rows(list);
    await r.trigger(box.id, 'click', rows[0].data, rows[0].context); expect(r.widget(following, rows[0].context).y).toBe(15); expect(r.widget(following, rows[1].context).y).toBe(10); expect(r.widget(outside).y).toBe(10);
    expect(r.rows(list).map(row => [row.y, row.height])).toEqual([[0, 25], [25, 20]]);
  });
  it('a source inside a panel only moves state siblings and does not explicitly push its outer row', async () => {
    const { doc } = fixture(), list = createWidget('repeater'), panel = createWidget('panel'), box = shape(0, 0, 100, 10), following = shape(10, 10, 20, 10), outside = shape(10, 10, 20, 10);
    panel.fitToContent = false; panel.states![0].widgets = [box, following]; list.style.strokeWidth = 0; list.repeater = { columns: ['Name'], rows: [{ Name: 'a' }], template: [panel, outside], itemWidth: 100, itemHeight: 20, gap: 0, layout: 'vertical' };
    box.interactions = [event([move({ y: { text: '5' } })])]; doc.pages[0].widgets = [list]; const r = make(doc); await r.start(); const row = r.rows(list)[0]; await r.trigger(box.id, 'click', row.data, row.context);
    expect(r.widget(following, row.context).y).toBe(15); expect(r.widget(outside, row.context).y).toBe(10); expect(r.rows(list)[0].height).toBe(20);
  });
  it('thisItem outside a row evaluates safe expressions without manufacturing a row', async () => {
    const { doc, box } = fixture(); box.interactions = [event([action({ type: 'resize', resize: { targets: [{ target: { kind: 'thisItem' }, width: { text: '200' }, height: { text: '80' }, anchor: 'center', easing: 'linear', duration: 1000 }] } }), action({ type: 'setVariable', targetId: 'Log', value: 'done' })])];
    const r = make(doc); await r.trigger(box.id, 'click'); expect(r.widget(box)).toMatchObject({ width: 100, height: 50 }); expect(r.state().variables.Log).toBe('done'); expect(r.state().itemLayouts).toEqual({}); expect(vi.getTimerCount()).toBe(0);
  });
  it('Page Loaded thisItem evaluates constant dimensions and continues without a widget source', async () => {
    const { doc, box } = fixture(); doc.pages[0].interactions = [event([action({ type: 'resize', resize: { targets: [{ target: { kind: 'thisItem' }, width: { text: '120' }, height: { text: '35' }, anchor: 'bottom right', easing: 'linear', duration: 1000 }] } }), action({ type: 'setVariable', targetId: 'Log', value: 'continued' })], 'load')];
    const r = make(doc); await r.start();
    expect(r.state().variables.Log).toBe('continued'); expect(r.widget(box)).toMatchObject({ x: 100, y: 100, width: 100, height: 50 });
    expect(r.state().itemLayouts).toEqual({}); expect(r.state().motionState).toBeUndefined(); expect(vi.getTimerCount()).toBe(0);
  });
  it('Page Loaded thisItem does not manufacture This or Target while evaluating dimensions', async () => {
    const { doc } = fixture(), reads: { name: string; value: string | number | boolean | undefined }[] = [];
    doc.pages[0].interactions = [event([action({ type: 'resize', resize: { targets: [{ target: { kind: 'thisItem' }, width: { text: '[[This.width]]' }, height: { text: '[[Target.height]]' }, anchor: 'center', easing: 'none', duration: 0 }] } }), action({ type: 'setVariable', targetId: 'Log', value: 'continued' })], 'load')];
    const r = make(doc, (expression, read, mode) => evaluateExpression(expression, name => { const value = read(name); reads.push({ name, value }); return value; }, mode)); await r.start();
    expect(reads).toEqual([{ name: 'This.width', value: undefined }, { name: 'Target.height', value: undefined }]);
    expect(r.state().variables.Log).toBe('continued'); expect(r.state().itemLayouts).toEqual({}); expect(vi.getTimerCount()).toBe(0);
  });
  it('Page Loaded thisItem still rejects unsafe expressions and rolls back its event', async () => {
    const { doc } = fixture(); doc.pages[0].interactions = [event([action({ type: 'setVariable', targetId: 'Log', value: 'started' }), action({ type: 'resize', resize: { targets: [{ target: { kind: 'thisItem' }, width: { text: '[[Target.constructor]]' }, height: { text: '35' }, anchor: 'center', easing: 'none', duration: 0 }] } }), action({ type: 'setVariable', targetId: 'Log', value: 'continued' })], 'load')];
    const r = make(doc); await expect(r.start()).rejects.toThrow(/constructor/);
    expect(r.state().variables.Log).toBe(''); expect(r.state().itemLayouts).toEqual({}); expect(vi.getTimerCount()).toBe(0);
  });
});
