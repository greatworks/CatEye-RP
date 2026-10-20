import { Script } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import type { Action, Interaction, MotionBoundary, MoveTargetSpec, ResizeTargetSpec } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

const sessions: OfflineRuntime[] = [];
afterEach(() => { sessions.splice(0).forEach(r => r.dispose()); vi.useRealTimers(); });
const action = (value: Omit<Action, 'id'>): Action => ({ id: uid(), ...value });
const event = (actions: Action[], name: Interaction['event'] = 'click'): Interaction => ({ id: uid(), name, event: name, enabled: true, conditionMode: 'all', conditions: [], actions });
const move = (id: string, fields: Partial<MoveTargetSpec> = {}) => action({ type: 'move', move: { targets: [{ target: { kind: 'widget', id }, mode: 'delta', x: { text: '40' }, y: { text: '20' }, easing: 'none', duration: 64, trajectory: 'straight', ...fields }] } });
const resize = (id: string, fields: Partial<ResizeTargetSpec> = {}) => action({ type: 'resize', resize: { targets: [{ target: { kind: 'widget', id }, width: { text: '300' }, height: { text: '160' }, anchor: 'top left', easing: 'linear', duration: 64, ...fields }] } });
const compare = (direction: 'left'|'right'|'top'|'bottom', operator: '>'|'<'|'>='|'<=', left: string, right: string): MotionBoundary => ({ kind: 'compare', direction, operator, left: { text: left }, right: { text: right } });
function fixture() { const doc = createDocument(), box = createWidget('box', 100, 100); box.width = 200; box.height = 100; doc.pages[0].widgets = [box]; doc.variables = { Log: '' }; return { doc, box }; }

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} native transform consumers`, () => {
  function make(doc: ReturnType<typeof createDocument>) {
    vi.useFakeTimers(); const factory: typeof createOfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout, Date }) : createOfflineRuntime;
    const r = factory(parseDocument(serializeDocument(doc)), undefined, evaluateExpression); sessions.push(r); return r;
  }
  it('projects a false boundary from the first direction expression, not the requested destination', async () => {
    const { doc, box } = fixture(), r = make(doc);
    const boundary: MotionBoundary = { kind: 'and', left: compare('left', '>=', '40', '20'), right: compare('right', '<=', '400', '500') };
    // Force the second predicate false without changing its projection upper bound.
    boundary.right = compare('right', '<=', '600', '500');
    await r.execute(event([move(box.id, { x: { text: '999' }, boundary })]));
    expect(r.widget(box)).toMatchObject({ x: 40, y: 120 });
  });
  it('folds contradictory leaves in source order for AND and OR', async () => {
    for (const kind of ['and', 'or'] as const) for (const reverse of [false, true]) {
      const { doc, box } = fixture(), r = make(doc), lower = compare('left', '>=', '40', '200'), upper = compare('left', '<=', '40', '20');
      await r.execute(event([move(box.id, { boundary: { kind, left: reverse ? upper : lower, right: reverse ? lower : upper } })]));
      expect(r.widget(box).x).toBe(reverse ? 200 : 20);
    }
  });
  it('subtracts width from a right-direction seed and projects after slice scaling', async () => {
    const { doc, box } = fixture(), r = make(doc);
    const pending = r.execute(event([move(box.id, { easing: 'linear', x: { text: '200' }, y: { text: '0' }, boundary: compare('right', '<=', '250', '200') }), resize(box.id, { width: { text: '200' }, height: { text: '100' }, duration: 32 })]));
    await vi.advanceTimersByTimeAsync(32); expect(r.state().motionState?.rotationLocations?.[box.id]?.x).toBe(0);
    await vi.advanceTimersByTimeAsync(64); await pending; expect(r.widget(box).x).toBe(0);
  });
  it('fires unchanged Resize immediately while its merged Move remains animated', async () => {
    const { doc, box } = fixture(); box.interactions = [event([action({ type: 'setVariable', targetId: 'Log', value: '[[This.x]]' })], 'resize')];
    const r = make(doc), pending = r.execute(event([move(box.id, { easing: 'linear' }), resize(box.id, { width: { text: '200' }, height: { text: '100' } })]));
    await vi.advanceTimersByTimeAsync(0); expect(r.state().variables.Log).toBe('140'); expect(r.widget(box).x).toBe(100);
    await vi.advanceTimersByTimeAsync(64); await pending; expect(r.widget(box)).toMatchObject({ x: 140, y: 120 });
  });
  it('turns off fit-to-content at Resize intake, even while an older Resize owns the channel', async () => {
    const { doc } = fixture(), panel = createWidget('panel'), child = createWidget('box', 0, 0); panel.fitToContent = true; panel.states![0].widgets = [child]; doc.pages[0].widgets = [panel];
    const r = make(doc), first = r.execute(event([resize(panel.id)])); await vi.advanceTimersByTimeAsync(16);
    // Runtime style re-enables fit while the prior tween still owns Resize.
    r.state().widgetOverrides[panel.id].fitToContent = true;
    const second = r.execute(event([resize(panel.id, { width: { text: '400' } })])); await vi.advanceTimersByTimeAsync(0);
    expect(r.widget(panel).fitToContent).toBe(false); await vi.advanceTimersByTimeAsync(160); await first; await second;
  });
  it('thisItem evaluates This but leaves Target undefined and resizes immediately without motion options', async () => {
    const { doc, box } = fixture(), list = createWidget('repeater'); box.x = box.y = 0; box.width = 80; box.height = 20;
    list.style.strokeWidth = 0; list.repeater = { columns: ['Name'], rows: [{ Name: 'a' }, { Name: 'b' }], template: [box], itemWidth: 100, itemHeight: 30, layout: 'vertical', gap: 0 };
    box.interactions = [event([resize(box.id, { target: { kind: 'thisItem' }, width: { text: '[[This.width + 10]]' }, height: { text: '[[Target.height]]' }, anchor: 'bottom right', duration: 60000 }), action({ type: 'setVariable', targetId: 'Log', value: 'done' })])];
    doc.pages[0].widgets = [list]; const r = make(doc); await r.start(); const row = r.rows(list)[0]; await r.trigger(box.id, 'click', row.data, row.context);
    expect(r.rows(list).map(item => [item.width, item.height, item.y])).toEqual([[90, 30, 0], [100, 30, 30]]);
    expect(r.state().variables.Log).toBe('done'); expect(vi.getTimerCount()).toBe(0); expect(r.widget(box, row.context)).toMatchObject({ width: 80, height: 20 });
  });
  it('thisItem clamps negative sizes, shifts following rows, and rolls back item events atomically', async () => {
    const { doc, box } = fixture(), list = createWidget('repeater'); list.style.strokeWidth = 0;
    list.repeater = { columns: ['Name'], rows: [{ Name: 'a' }, { Name: 'b' }], template: [box], itemWidth: 100, itemHeight: 30, layout: 'vertical', gap: 0 };
    box.interactions = [event([resize(box.id, { target: { kind: 'thisItem' }, width: { text: '-1' }, height: { text: '12.5' } })])];
    list.interactions = [event([action({ type: 'setVariable', targetId: 'Log', value: '[[Item.Name]]' })], 'itemResize')];
    doc.pages[0].widgets = [list]; const r = make(doc); await r.start(); const row = r.rows(list)[0]; await r.trigger(box.id, 'click', row.data, row.context);
    expect(r.rows(list).map(item => [item.width, item.height, item.y])).toEqual([[0, 12.5, 0], [100, 30, 12.5]]); expect(r.state().variables.Log).toBe('a');
    const before = structuredClone(r.state());
    await expect(r.execute(event([resize(box.id, { target: { kind: 'thisItem' }, height: { text: '90' } }), action({ type: 'setSelected', targetId: box.id, value: 'bad' })]), row.data, row.context)).rejects.toThrow();
    expect(r.state().itemLayouts).toEqual(before.itemLayouts);
  });
  it('keeps an invalid size axis, clamps a negative axis, and does not swallow unsafe expressions', async () => {
    const { doc, box } = fixture(), r = make(doc);
    await r.execute(event([resize(box.id, { width: { text: 'not a number' }, height: { text: '-3' }, easing: 'none' })]));
    expect(r.widget(box)).toMatchObject({ width: 200, height: 0 });
    await expect(r.execute(event([resize(box.id, { width: { text: '[[Target.constructor]]' }, easing: 'none' })]))).rejects.toThrow();
  });
  it('Move-led Rotate resolves degree before OnRotate, while Resize-led Rotate resolves it afterwards', async () => {
    for (const withResize of [false, true]) {
      const { doc, box } = fixture(); doc.variables.Angle = '45'; box.interactions = [event([action({ type: 'setVariable', targetId: 'Angle', value: '90' })], 'rotate')];
      const r = make(doc), rotation = action({ type: 'rotate', targetId: box.id, rotate: { mode: 'by', degrees: '[[Angle]]', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'linear', duration: 64 } });
      const pending = r.execute(event([withResize ? resize(box.id) : move(box.id, { easing: 'linear' }), rotation]));
      await vi.advanceTimersByTimeAsync(64); await pending; expect(r.widget(box).rotation).toBe(withResize ? 90 : 45);
    }
  });
  it('uses unrotated CSS anchor dimensions for Move+Rotate even when bounds include a shadow', async () => {
    const { doc, box } = fixture(); box.style.outerShadow = { on: true, offsetX: 10, offsetY: 20, blurRadius: 6, color: '#000000' }; const r = make(doc);
    const pending = r.execute(event([move(box.id, { x: { text: '0' }, y: { text: '0' }, easing: 'linear' }), action({ type: 'rotate', targetId: box.id, rotate: { mode: 'by', degrees: '90', clockwise: true, anchor: 'top left', offsetX: '0', offsetY: '0', easing: 'linear', duration: 64 } })]));
    await vi.advanceTimersByTimeAsync(64); await pending; expect(r.widget(box).x).toBeCloseTo(-50); expect(r.widget(box).y).toBeCloseTo(150);
  });
  it('does not apply resizeOffset as movement when an offset Rotate has zero degree delta', async () => {
    const { doc, box } = fixture(), r = make(doc);
    const pending = r.execute(event([resize(box.id), action({ type: 'rotate', targetId: box.id, rotate: { mode: 'by', degrees: '0', clockwise: true, anchor: 'top left', offsetX: '0', offsetY: '0', easing: 'linear', duration: 64 } })]));
    await vi.advanceTimersByTimeAsync(64); await pending; expect(r.widget(box)).toMatchObject({ x: 100, y: 100, width: 300, height: 160, rotation: 0 });
  });
  it('a zero standalone Move emits its event and releases the channel without a timer or location cache', async () => {
    const { doc, box } = fixture(); box.interactions = [event([action({ type: 'setVariable', targetId: 'Log', value: 'zero' })], 'move')]; const r = make(doc);
    const pending = r.execute(event([move(box.id, { x: { text: '0' }, y: { text: '0' }, easing: 'linear' })]));
    await vi.advanceTimersByTimeAsync(0); expect(vi.getTimerCount()).toBe(0); await pending; expect(r.state().variables.Log).toBe('zero'); expect(r.state().motionState?.rotationLocations?.[box.id]).toBeUndefined(); expect(r.state().motionState?.moveInfos?.[box.id]).toEqual({ deltaX: 0, deltaY: 0, easing: 'none', duration: 0 });
  });
});
