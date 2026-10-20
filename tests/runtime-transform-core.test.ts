import { Script } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import type { Action, Document, Interaction, MoveTargetSpec, ResizeTargetSpec, RotateActionSpec } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

const sessions: OfflineRuntime[] = [];
afterEach(() => { sessions.splice(0).forEach(s => s.dispose()); vi.useRealTimers(); });
const expr = (text: string) => ({ text });
const action = (value: Omit<Action, 'id'>): Action => ({ id: uid(), ...value });
const interaction = (...actions: Action[]): Interaction => ({ id: uid(), name: 'Transform', event: 'click', enabled: true, conditions: [], conditionMode: 'all', actions });
const set = (targetId: string, value: string) => action({ type: 'setVariable', targetId, value });
const move = (id: string, patch: Partial<MoveTargetSpec> = {}) => action({ type: 'move', move: { targets: [{ target: { kind: 'widget', id }, mode: 'delta', x: expr('40'), y: expr('20'), trajectory: 'straight', easing: 'linear', duration: 40, ...patch }] } });
const resize = (id: string, patch: Partial<ResizeTargetSpec> = {}) => action({ type: 'resize', resize: { targets: [{ target: { kind: 'widget', id }, width: expr('300'), height: expr('160'), anchor: 'top left', easing: 'linear', duration: 70, ...patch }] } });
const rotate = (id: string, patch: Partial<RotateActionSpec> = {}) => action({ type: 'rotate', targetId: id, rotate: { mode: 'by', degrees: '90', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'linear', duration: 100, ...patch } });
function fixture() {
  const doc = createDocument(), shape = createWidget('box', 100, 100), button = createWidget('button');
  Object.assign(shape, { width: 200, height: 100 }); doc.pages[0].widgets = [shape, button]; doc.variables = { N: '0', Seen: '', W: '300', D: '90' };
  return { doc, shape, button };
}
for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} saved transform actions`, () => {
  function make(doc: Document) {
    // Always pass the strict complete saved object, including paired action specs.
    const saved = parseDocument(serializeDocument(doc));
    vi.useFakeTimers();
    const factory: typeof createOfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout, Date }) : createOfflineRuntime;
    const runtime = factory(saved, undefined, evaluateExpression, undefined, {}); sessions.push(runtime); return runtime;
  }
  it('retains immediate legacy numeric Move/Resize without opting old duration into animation', async () => {
    const { doc, shape, button } = fixture(); button.interactions = [interaction(action({ type: 'move', targetId: shape.id, x: 12, y: 34, duration: 100 }), action({ type: 'resize', targetId: shape.id, x: 240, y: 120, duration: 100 }))];
    const r = make(doc); await r.trigger(button.id, 'click'); expect(r.widget(shape)).toMatchObject({ x: 12, y: 34, width: 240, height: 120 }); expect(vi.getTimerCount()).toBe(0);
  });
  it('publishes Move destination cache before paint, interpolates, and accepts unrelated input', async () => {
    const { doc, shape, button } = fixture(); button.interactions = [interaction(move(shape.id, { duration: 64 }))];
    shape.interactions = [{ ...interaction(set('Seen', '[[This.x]],[[This.y]]')), event: 'move' }];
    const r = make(doc), pending = r.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(0);
    expect(r.widget(shape)).toMatchObject({ x: 100, y: 100 }); expect(r.state().variables.Seen).toBe('140,120');
    await vi.advanceTimersByTimeAsync(32); expect(r.widget(shape)).toMatchObject({ x: 120, y: 110 });
    await r.execute(interaction(set('N', '7'))); expect(r.state().variables.N).toBe('7');
    await vi.advanceTimersByTimeAsync(32); await pending; expect(r.widget(shape)).toMatchObject({ x: 140, y: 120 });
  });
  it('uses independent Resize anchor and publishes final size before pixels finish', async () => {
    const { doc, shape, button } = fixture(); button.interactions = [interaction(resize(shape.id, { anchor: 'bottom right', duration: 64 }), set('Seen', '[[Widget.' + shape.id + '.text]]'))];
    shape.interactions = [interaction(set('Seen', '[[This.width]],[[This.height]]'))];
    const r = make(doc), pending = r.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(0); await r.trigger(shape.id, 'click');
    expect(r.state().variables.Seen).toBe('300,160'); expect(r.widget(shape)).toMatchObject({ width: 200, height: 100 });
    await vi.advanceTimersByTimeAsync(64); await pending; expect(r.widget(shape)).toMatchObject({ x: 0, y: 40, width: 300, height: 160 });
  });
  it.each([[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]])('matches unequal native triple residual and early event for order %s,%s,%s', async (a, b, c) => {
    const { doc, shape, button } = fixture(); const acts = [move(shape.id), resize(shape.id), rotate(shape.id)];
    shape.interactions = [{ ...interaction(set('Seen', '[[Seen]][[N]];')), event: 'rotate' }]; button.interactions = [interaction(acts[a], acts[b], acts[c], set('N', '9'))];
    const r = make(doc), pending = r.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(0); expect(r.state().variables.Seen).toBe('0;');
    await vi.advanceTimersByTimeAsync(160); await pending; const w = r.widget(shape);
    expect(w.width).toBeCloseTo(299.65306122448976, 8); expect(w.height).toBeCloseTo(159.59183673469386, 8); expect(w.rotation).toBeCloseTo(90, 8);
    expect(r.state().variables.Seen).toBe('0;9;9;'); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['by', 'to'] as const)('keeps Resize-led clockwise omission separate from the remaining %s Rotate', async mode => {
    const { doc, shape, button } = fixture(); shape.rotation = 30; button.interactions = [interaction(resize(shape.id), rotate(shape.id, { mode, clockwise: false }))];
    const r = make(doc), pending = r.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(160); await pending;
    expect(r.widget(shape).rotation).toBeCloseTo(mode === 'by' ? 66 : -90, 8);
  });
  it('retains the Move-To public cache/paint difference caused by native duplicate Move release', async () => {
    const { doc, shape, button } = fixture(); shape.interactions = [interaction(set('Seen', '[[This.x]],[[This.y]]'))];
    button.interactions = [interaction(move(shape.id, { mode: 'location', x: expr('140'), y: expr('120'), duration: 100 }), resize(shape.id), rotate(shape.id, { duration: 40 }))];
    const r = make(doc), pending = r.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(160); await pending; await r.trigger(shape.id, 'click');
    expect(r.state().variables.Seen).toBe('140,120'); expect(r.widget(shape).x).toBeCloseTo(128, 8); expect(r.widget(shape).y).toBeCloseTo(114, 8);
  });
  it('treats saved StringLiteral zero as zero while zero CSS does not invent a resized cache', async () => {
    const { doc, shape, button } = fixture(); button.interactions = [interaction(move(shape.id, { mode: 'location', x: expr('[[0]]'), y: expr('0'), easing: 'none' }), resize(shape.id, { width: expr('0'), height: expr('0'), easing: 'none' }))];
    shape.interactions = [interaction(set('Seen', '[[This.width]],[[This.height]]'))]; const r = make(doc); await r.trigger(button.id, 'click'); await r.trigger(shape.id, 'click');
    expect(r.widget(shape)).toMatchObject({ x: 0, y: 0, width: 0, height: 0 }); expect(r.state().variables.Seen).toBe('200,100');
  });
  it('uses expression-local binding identities and preserves ordered target entries', async () => {
    const { doc, shape, button } = fixture(), other = createWidget('box', 400, 200); doc.pages[0].widgets.push(other);
    const a = move(shape.id, { mode: 'location', easing: 'none', x: { text: '[[Track.x + 10]]', bindings: { track: { kind: 'widget', targetId: other.id } } }, y: expr('') });
    a.move!.targets.push({ ...move(other.id, { x: expr('-20'), y: expr('0'), easing: 'none' }).move!.targets[0] }); button.interactions = [interaction(a)];
    const r = make(doc); await r.trigger(button.id, 'click'); expect(r.widget(shape)).toMatchObject({ x: 410, y: 100 }); expect(r.widget(other).x).toBe(380);
  });
  it('Wait begins another planner rather than retroactively merging its remainder', async () => {
    const { doc, shape, button } = fixture(); button.interactions = [interaction(move(shape.id, { duration: 64 }), action({ type: 'wait', value: '16' }), resize(shape.id, { duration: 64 }))];
    const r = make(doc), pending = r.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(32); expect(r.widget(shape).width).toBeGreaterThan(200);
    // A separate Resize may write left/top captured at its own start. The
    // source does not promise ideal combined translation across a Wait.
    await vi.advanceTimersByTimeAsync(128); await pending; expect(r.widget(shape).width).toBe(300); expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects the bounded native pending-instant nonprogress route atomically', async () => {
    const { doc, shape, button } = fixture(); button.interactions = [interaction(move(shape.id), move(shape.id, { easing: 'none' }), resize(shape.id, { duration: 100 }), rotate(shape.id))];
    const r = make(doc); await expect(r.trigger(button.id, 'click')).rejects.toThrow(/motion.*(?:progress|instant)/i);
    expect(r.widget(shape)).toMatchObject({ x: 100, y: 100, width: 200, height: 100, rotation: 0 }); expect(vi.getTimerCount()).toBe(0);
  });
});
