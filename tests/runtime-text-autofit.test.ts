import { Script } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocument, createWidget, serializeDocument, uid } from '../src/model/document';
import { createOfflineRuntime, type OfflineRuntime, type RowContext, type ShapeTextMeasurement } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import type { Action, Document, Interaction, Widget } from '../src/model/types';

const sessions: OfflineRuntime[] = [];
afterEach(() => { for (const runtime of sessions.splice(0)) runtime.dispose(); });
const event = (...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: 'Text size', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ ...action, id: uid() })) });
const setText = (w: Widget, value = 'Changed'): Omit<Action, 'id'> => ({ type: 'setText', targetId: w.id, value });
function fixture() {
  const doc = createDocument(), shape = createWidget('box', 100, 200);
  Object.assign(shape, { width: 80.25, height: 40.5, shapeText: { autoFitWidth: true, autoFitHeight: true }, text: 'Before' });
  Object.assign(shape.style, { textAlign: 'left', verticalAlign: 'top', textPadding: [0, 0, 0, 0] });
  doc.pages[0].widgets = [shape]; doc.caseSelection = 'never'; return { doc, shape };
}
function make(doc: Document, portable: boolean) {
  const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, evaluateExpression) : createOfflineRuntime(doc, undefined, evaluateExpression);
  sessions.push(runtime); return runtime;
}
function host(runtime: OfflineRuntime, shape: Widget, next = { width: 125.75, height: 62.25 }) {
  const trace: { kind: string; text: string; rect?: { x: number; y: number; width: number; height: number }; context?: RowContext }[] = [];
  runtime.bindControls({
    flush: () => { trace.push({ kind: 'flush', text: runtime.widget(shape).text }); }, focus: () => {}, selectText: () => {},
    measureShapeText: (id, context): ShapeTextMeasurement => {
      expect(id).toBe(shape.id); const w = runtime.widget(shape, context), rect = { x: w.x, y: w.y, width: w.width, height: w.height };
      trace.push({ kind: 'measure', text: w.text, rect, context: structuredClone(context) });
      return { ...next, rect, textAlign: w.style.textAlign, verticalAlign: w.style.verticalAlign ?? 'top' };
    },
  });
  return { trace, next };
}

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} native SetText AutoFit`, () => {
  it('keeps initial geometry and measures synchronously only after a qualifying text mutation', async () => {
    const { doc, shape } = fixture(), original = serializeDocument(doc), runtime = make(doc, portable), { trace } = host(runtime, shape);
    await runtime.start(); expect(trace).toEqual([]); expect(runtime.widget(shape)).toMatchObject({ width: 80.25, height: 40.5 });
    await runtime.execute(event(setText(shape, 'One'), setText(shape, 'Two')));
    expect(trace.map(x => [x.kind, x.text])).toEqual([['flush', 'One'], ['measure', 'One'], ['flush', 'Two'], ['measure', 'Two']]);
    expect(trace[3].rect).toMatchObject({ width: 125.75, height: 62.25 });
    expect(runtime.widget(shape)).toMatchObject({ width: 125.75, height: 62.25, x: 100, y: 200, text: 'Two' });
    expect(serializeDocument(doc)).toBe(original);
  });
  for (const width of [false, true]) for (const height of [false, true]) it(`honors width=${width} height=${height} independently`, async () => {
    const { doc, shape } = fixture(); shape.shapeText = { autoFitWidth: width, autoFitHeight: height };
    const runtime = make(doc, portable), { trace } = host(runtime, shape);
    await runtime.execute(event(setText(shape)));
    expect(trace.filter(x => x.kind === 'measure')).toHaveLength(width || height ? 1 : 0);
    expect(runtime.widget(shape)).toMatchObject({ width: width ? 125.75 : 80.25, height: height ? 62.25 : 40.5 });
    expect(runtime.nativeTextSet(shape.id)).toBe(true);
  });
  for (const [horizontal, hx] of [['left', 0], ['center', .5], ['right', 1]] as const) for (const [vertical, vy] of [['top', 0], ['middle', .5], ['bottom', 1]] as const) it(`preserves ${horizontal}/${vertical} alignment for growth then shrink`, async () => {
    const { doc, shape } = fixture(); shape.style.textAlign = horizontal; shape.style.verticalAlign = vertical;
    const runtime = make(doc, portable), { next } = host(runtime, shape);
    await runtime.execute(event(setText(shape)));
    expect(runtime.widget(shape)).toMatchObject({ x: 100 - 45.5 * hx, y: 200 - 21.75 * vy });
    Object.assign(next, { width: 12.5, height: 7.25 }); await runtime.execute(event(setText(shape, 'Small')));
    expect(runtime.widget(shape)).toMatchObject({ x: 100 + 67.75 * hx, y: 200 + 33.25 * vy, width: 12.5, height: 7.25 });
  });
  it('registers equal text/zero delta and remeasures only registered instances', async () => {
    const { doc, shape } = fixture(), other = createWidget('box'); other.shapeText = { ...shape.shapeText! }; doc.pages[0].widgets.push(other);
    const runtime = make(doc, portable), { trace, next } = host(runtime, shape, { width: shape.width, height: shape.height });
    await runtime.updateAutoFitted(); expect(trace).toEqual([]);
    await runtime.execute(event(setText(shape, shape.text))); expect(runtime.hasOverride(shape.id, 'width')).toBe(false);
    next.width = 200; await runtime.updateAutoFitted(); expect(trace.filter(x => x.kind === 'measure')).toHaveLength(2); expect(runtime.widget(shape).width).toBe(200);
  });
  it('keeps a native setter as one first-formatted paragraph, with raw whitespace and literal markup', async () => {
    const { doc, shape } = fixture(); shape.richText = { paragraphs: [{ textAlign: 'right', lineHeightPx: 21, runs: [{ text: 'First', style: { fontSize: 17 } }, { text: 'Second', style: { fontWeight: 700 } }] }, { runs: [{ text: 'Last' }] }] };
    const runtime = make(doc, portable), value = '  <b>A\rB\u2028C\r\n\nD\n';
    await runtime.execute(event(setText(shape, value)));
    expect(runtime.widget(shape).richText).toEqual({ paragraphs: [{ textAlign: 'right', lineHeightPx: 21, runs: [{ text: value, style: { fontSize: 17 } }] }] });
    expect(runtime.widget(shape).text).toBe(value); expect(runtime.nativeTextSet(shape.id)).toBe(true);
  });
  it('does not fabricate measurements without a browser host or resize legacy/form text', async () => {
    const { doc, shape } = fixture(), form = createWidget('input'); doc.pages[0].widgets.push(form);
    const runtime = make(doc, portable); await runtime.execute(event(setText(shape))); expect(runtime.widget(shape).width).toBe(80.25);
    const { trace } = host(runtime, shape); await runtime.execute(event(setText(form))); expect(trace).toEqual([]);
    delete shape.shapeText; await runtime.execute(event(setText(shape))); expect(trace).toEqual([]);
  });
  it('preserves the native double-zero logical-size quirk while painting an empty owner', async () => {
    const { doc, shape } = fixture(); shape.style.textAlign = 'right'; shape.style.verticalAlign = 'bottom';
    const runtime = make(doc, portable), { next } = host(runtime, shape, { width: 0, height: 0 });
    await runtime.execute(event(setText(shape, '')));
    expect(runtime.widget(shape)).toMatchObject({ width: 80.25, height: 40.5, x: 180.25, y: 240.5 });
    expect(runtime.renderSize(shape)).toEqual({ width: 0, height: 0 });
    next.width = 15; next.height = 0; await runtime.execute(event(setText(shape, 'A')));
    expect(runtime.widget(shape)).toMatchObject({ width: 15, height: 0 }); expect(runtime.renderSize(shape)).toEqual({ width: 15, height: 0 });
  });
  it('rolls geometry, setter state and registration back if a later synchronous action fails', async () => {
    const { doc, shape } = fixture(), runtime = make(doc, portable), before = structuredClone(runtime.state()), { trace } = host(runtime, shape);
    await expect(runtime.execute(event(setText(shape), { type: 'setSelected', targetId: shape.id, value: 'invalid' }))).rejects.toThrow();
    expect(runtime.state()).toEqual(before); expect(runtime.nativeTextSet(shape.id)).toBe(false);
    const calls = trace.length; await runtime.updateAutoFitted(); expect(trace).toHaveLength(calls);
  });
  it('uses new geometry during OnResize and applies alignment after handlers can move it', async () => {
    const { doc, shape } = fixture(); shape.style.textAlign = 'right';
    shape.interactions = [
      { ...event({ type: 'setVariable', targetId: 'Trace', value: '[[This.width]]|[[This.x]]|[[This.widthchange]]' }, { type: 'move', targetId: shape.id, x: 400, y: 500 }), event: 'resize' },
      { ...event({ type: 'setVariable', targetId: 'Moved', value: '[[This.x]]|[[This.width]]' }), event: 'move' },
    ];
    const runtime = make(doc, portable); host(runtime, shape); await runtime.execute(event(setText(shape)));
    expect(runtime.state().variables.Trace).toBe('125.75|100|45.5');
    expect(runtime.widget(shape).x).toBe(354.5); expect(runtime.state().variables.Moved).toBe('354.5|125.75');
  });
  it('fits a panel at resize time and retains that size after direct alignment movement', async () => {
    const { doc, shape } = fixture(), panel = createWidget('panel');
    Object.assign(shape, { x: 10, y: 20, width: 100, height: 20 });
    Object.assign(shape.style, { textAlign: 'right', verticalAlign: 'bottom' });
    panel.fitToContent = true; panel.states![0].widgets = [shape]; doc.pages[0].widgets = [panel];
    const runtime = make(doc, portable); host(runtime, shape, { width: 130, height: 35 });
    expect(runtime.widget(panel)).toMatchObject({ width: 110, height: 40 });
    await runtime.execute(event(setText(shape)));
    expect(runtime.widget(shape)).toMatchObject({ x: -20, y: 5, width: 130, height: 35 });
    expect(runtime.widget(panel)).toMatchObject({ width: 140, height: 55 });
    // A subsequent public move has its own fit callback, unlike AutoFit's move.
    await runtime.execute(event({ type: 'move', targetId: shape.id, x: 0, y: 0 }));
    expect(runtime.widget(panel)).toMatchObject({ width: 130, height: 35 });
  });
  it('fits the repeater row before resize handlers and does not refit on alignment', async () => {
    const { doc, shape } = fixture(), list = createWidget('repeater');
    Object.assign(shape, { x: 10, y: 20, width: 100, height: 20 });
    Object.assign(shape.style, { textAlign: 'right', verticalAlign: 'bottom' });
    list.repeater = { columns: ['Value'], rows: [{ Value: 'A' }], template: [shape], itemWidth: 110, itemHeight: 40, fitToContent: true, layout: 'vertical', gap: 0 };
    shape.interactions = [{ ...event({ type: 'setVariable', targetId: 'Fit', value: '[[This.Repeater.width]]|[[This.Repeater.height]]' }), event: 'resize' }];
    doc.pages[0].widgets = [list]; const runtime = make(doc, portable); await runtime.start();
    host(runtime, shape, { width: 130, height: 35 }); const row = runtime.rows(list)[0];
    await runtime.execute(event(setText(shape)), row.data, row.context);
    expect(runtime.state().variables.Fit).toBe('140|55');
    expect(runtime.rows(list)[0]).toMatchObject({ width: 140, height: 55 });
    expect(runtime.widget(shape, row.context)).toMatchObject({ x: -20, y: 5 });
  });
  it('clears width/height deltas after Resize and follows the original zero-old-axis guard', async () => {
    const { doc, shape } = fixture(); shape.width = 0; shape.height = 10;
    shape.interactions = [{ ...event({ type: 'setVariable', targetId: 'Delta', value: '[[This.widthchange]]|[[This.heightchange]]' }), event: 'resize' },
      { ...event({ type: 'setVariable', targetId: 'After', value: '[[This.widthchange]]|[[This.heightchange]]' }), event: 'click' }];
    const runtime = make(doc, portable); host(runtime, shape, { width: 20, height: 25 });
    await runtime.execute(event(setText(shape))); expect(runtime.state().variables.Delta).toBe('0|15');
    await runtime.trigger(shape.id, 'click'); expect(runtime.state().variables.After).toBe('0|0');
  });
});
