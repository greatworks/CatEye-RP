import { Script } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument, createPage, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import type { Action, EventType, Interaction, MoveTargetSpec } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { createRuntime, executeInteraction, getRuntimeWidget } from '../src/runtime/engine';
import { evaluateExpression } from '../src/runtime/expressions';

const sessions: OfflineRuntime[] = [];
afterEach(() => { sessions.splice(0).forEach(r => r.dispose()); vi.useRealTimers(); });
const a = (value: Omit<Action, 'id'>): Action => ({ id: uid(), ...value });
const evt = (event: EventType, ...actions: Action[]): Interaction => ({ id: uid(), name: event, event, enabled: true, conditions: [], conditionMode: 'all', actions });
const set = (value: string) => a({ type: 'setVariable', targetId: 'Log', value });
const move = (id: string, patch: Partial<MoveTargetSpec> = {}) => a({ type: 'move', move: { targets: [{ target: { kind: 'widget', id }, mode: 'delta', x: { text: '40' }, y: { text: '20' }, trajectory: 'straight', easing: 'linear', duration: 64, ...patch }] } });
const resize = (id: string, width = '300', duration = 64) => a({ type: 'resize', resize: { targets: [{ target: { kind: 'widget', id }, width: { text: width }, height: { text: '160' }, anchor: 'top left', easing: 'linear', duration }] } });
function fixture() { const doc = createDocument(), box = createWidget('box', 100, 100); box.width = 200; box.height = 100; doc.pages[0].widgets = [box]; doc.variables = { Log: '' }; return { doc, box }; }

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} transform lifetime and drag`, () => {
  function make(doc: ReturnType<typeof createDocument>) {
    vi.useFakeTimers(); const factory: typeof createOfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout, Date }) : createOfflineRuntime;
    const runtime = factory(parseDocument(serializeDocument(doc)), undefined, evaluateExpression, undefined, { width: 1200, height: 800 }); sessions.push(runtime); return runtime;
  }
  it('isolates a failing queued Resize from the successful preceding event', async () => {
    const { doc, box } = fixture(), r = make(doc), first = r.execute(evt('click', resize(box.id)));
    await vi.advanceTimersByTimeAsync(16); const second = r.execute(evt('click', resize(box.id, '[[1/0]]'))), rejected = expect(second).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(160); await first; await rejected; expect(r.widget(box).width).toBe(300); expect(vi.getTimerCount()).toBe(0);
  });
  it('rolls back a combined event without cancelling an older independent tween', async () => {
    const { doc, box } = fixture(), other = createWidget('box'); doc.pages[0].widgets.push(other);
    const r = make(doc), first = r.execute(evt('click', move(box.id))); await vi.advanceTimersByTimeAsync(16);
    await expect(r.execute(evt('click', resize(other.id), a({ type: 'setSelected', targetId: other.id, value: 'invalid' })))).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(100); await first; expect(r.widget(box).x).toBe(140); expect(r.widget(other).width).toBe(other.width); expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels pending paints on navigation and preserves the document bytes', async () => {
    const { doc, box } = fixture(), page = createPage(); doc.pages.push(page); const before = serializeDocument(doc), r = make(doc);
    const pending = r.execute(evt('click', resize(box.id))); await vi.advanceTimersByTimeAsync(16);
    await r.execute(evt('click', a({ type: 'openPage', targetId: page.id }))); await vi.advanceTimersByTimeAsync(100); await pending;
    expect(r.state().pageId).toBe(page.id); expect(r.state().motionState?.resizeTargets).toBeUndefined(); expect(serializeDocument(doc)).toBe(before); expect(vi.getTimerCount()).toBe(0);
  });
  it('captures Window at event creation while a queued expression reads current widget geometry', async () => {
    const { doc, box } = fixture(), button = createWidget('button'); doc.pages[0].widgets.push(button);
    button.interactions = [evt('click', move(box.id), move(box.id, { x: { text: '[[Window.width - Target.x]]' }, y: { text: '0' } }))];
    const r = make(doc), pending = r.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(16); await r.setViewport({ width: 900, height: 400 });
    await vi.advanceTimersByTimeAsync(160); await pending; expect(r.widget(box).x).toBe(1200);
  });
  it('starts on a zero move, keeps incremental deltas, and resets public getters after Drop', async () => {
    const { doc, box } = fixture(); box.interactions = [evt('dragStart', set('[[Log]]S;')), evt('drag', move(box.id, { mode: 'drag', easing: 'none' }), set('[[Log]][[DragX]],[[TotalDragX]];')), evt('dragDrop', set('[[Log]]D[[DragX]];')), evt('swipeRight', set('[[Log]]R;')), evt('click', set('[[DragX]],[[TotalDragX]],[[DragTime]]'))];
    const r = make(doc); expect(r.beginDrag(box.id, 5, 5, [], 100)).toBe(true); expect(r.beginDrag(box.id, 5, 5)).toBe(false);
    await r.dragMove(5, 5, 110); expect(r.state().variables.Log).toBe('S;0,0;');
    await r.dragMove(45, 15, 130); expect(r.widget(box)).toMatchObject({ x: 140, y: 110 });
    await r.endDrag(150); expect(r.state().variables.Log).toBe('S;0,0;40,40;D40;R;');
    await r.trigger(box.id, 'click'); expect(r.state().variables.Log).toBe('0,0,600000');
    // Raw Move drag context retains the old incremental delta after Drop.
    await r.execute(evt('click', move(box.id, { mode: 'dragX', easing: 'none' }))); expect(r.widget(box).x).toBe(180);
  });
  it('restores the first dragged location and leaves drag/cancel as one separate lifecycle', async () => {
    const { doc, box } = fixture(); box.interactions = [evt('drag', move(box.id, { mode: 'drag', easing: 'none' })), evt('dragDrop', move(box.id, { mode: 'locationBeforeDrag', easing: 'none' }))];
    const r = make(doc); r.beginDrag(box.id, 0, 0, [], 0); await r.dragMove(12, 9, 20); await r.dragMove(20, 17, 30); expect(r.widget(box)).toMatchObject({ x: 120, y: 117 });
    await r.endDrag(40); expect(r.widget(box)).toMatchObject({ x: 100, y: 100 });
    r.beginDrag(box.id, 0, 0); await r.dragMove(5, 5); r.cancelDrag(); expect(r.widget(box)).toMatchObject({ x: 105, y: 105 });
  });
  it('does not block later pointer moves on the first movement animation', async () => {
    const { doc, box } = fixture(); box.interactions = [evt('drag', move(box.id, { mode: 'drag' }))]; const r = make(doc);
    r.beginDrag(box.id, 0, 0); const first = r.dragMove(10, 0); await vi.advanceTimersByTimeAsync(16); const second = r.dragMove(30, 0);
    await vi.advanceTimersByTimeAsync(160); await first; await second; expect(r.widget(box).x).toBe(130); await r.endDrag(); expect(vi.getTimerCount()).toBe(0);
  });
  it('Move withThis inherits the source delta, easing and duration', async () => {
    const { doc, box } = fixture(), follower = createWidget('box', 400, 100); doc.pages[0].widgets.push(follower);
    box.interactions = [evt('move', move(follower.id, { mode: 'withThis', x: { text: '999' }, duration: 1000 }))];
    const r = make(doc), pending = r.execute(evt('click', move(box.id))); await vi.advanceTimersByTimeAsync(32); expect(r.widget(follower).x).toBe(420);
    await vi.advanceTimersByTimeAsync(32); await pending; expect(r.widget(follower).x).toBe(440); expect(vi.getTimerCount()).toBe(0);
  });
  it('guards missing drag / source movement instead of writing non-finite geometry', async () => {
    const { doc, box } = fixture(), r = make(doc);
    await expect(r.execute(evt('click', move(box.id, { mode: 'drag' })))).rejects.toThrow(/drag context/);
    await expect(r.execute(evt('click', move(box.id, { mode: 'withThis' })))).rejects.toThrow(/source movement/);
    expect(r.widget(box)).toMatchObject({ x: 100, y: 100 });
  });
  it('uses strict boundary offsets and leaves an already-satisfied predicate alone', async () => {
    const { doc, box } = fixture(), r = make(doc);
    await r.execute(evt('click', move(box.id, { easing: 'none', mode: 'location', y: { text: '-20' }, boundary: { kind: 'compare', operator: '>', direction: 'top', left: { text: '-20' }, right: { text: '0' } } })));
    expect(r.widget(box).y).toBe(1);
    await r.execute(evt('click', move(box.id, { easing: 'none', x: { text: '8' }, y: { text: '9' }, boundary: { kind: 'compare', operator: '>=', direction: 'left', left: { text: '20' }, right: { text: '0' } } })));
    expect(r.widget(box)).toMatchObject({ x: 48, y: 10 });
  });
  it('isolates combined row channels and lets queued work bind a rebuilt row without repainting its predecessor', async () => {
    const { doc, box } = fixture(), list = createWidget('repeater');
    list.repeater = { columns: ['Name'], rows: [{ Name: 'a' }, { Name: 'b' }], template: [box], itemWidth: 400, itemHeight: 200, layout: 'vertical', gap: 0 };
    box.interactions = [evt('click', move(box.id), resize(box.id), move(box.id, { x: { text: '10' }, y: { text: '0' } }), resize(box.id, '[[Target.width + 20]]'))];
    doc.pages[0].widgets = [list]; const r = make(doc); await r.start(); const rows = r.rows(list), pending = r.trigger(box.id, 'click', rows[0].data, rows[0].context);
    await vi.advanceTimersByTimeAsync(16); expect(r.widget(box, rows[1].context)).toMatchObject({ x: 100, width: 200 });
    await r.execute(evt('click', a({ type: 'updateRow', targetId: list.id, value: '{"row":"this","values":{"Name":"new"}}' })), rows[0].data, rows[0].context);
    await vi.advanceTimersByTimeAsync(48); expect(r.widget(box, rows[0].context)).toMatchObject({ x: 100, width: 200 });
    await vi.advanceTimersByTimeAsync(64); await pending; expect(r.widget(box, rows[0].context)).toMatchObject({ x: 110, width: 220 }); expect(r.widget(box, rows[1].context)).toMatchObject({ x: 100, width: 200 });
  });
  it('keeps a live combined tween after an adaptive reset but clears its destination caches immediately', async () => {
    const { doc, box } = fixture(); doc.pages[0].adaptiveBaseSize = { width: 1200, height: 0 }; doc.pages[0].adaptiveViews = [{ id: 'phone', name: 'Phone', width: 390, overrides: { [box.id]: { x: 12, width: 77 } } }];
    const r = make(doc), pending = r.execute(evt('click', move(box.id), resize(box.id))); await vi.advanceTimersByTimeAsync(16); await r.setViewport({ width: 390 });
    expect(r.widget(box)).toMatchObject({ x: 12, width: 77 }); expect(r.state().motionState?.resizeTargets?.[box.id]).toBeUndefined();
    await vi.advanceTimersByTimeAsync(48); await pending; expect(r.widget(box)).toMatchObject({ x: 140, width: 300 });
  });
  it('restores the shared drag return-location map after a failed Drop navigation', async () => {
    const { doc, box } = fixture(), page = createPage(), bad = createWidget('box'); doc.variables.Bad = 'invalid'; page.widgets = [bad]; page.interactions = [evt('load', a({ type: 'setSelected', targetId: bad.id, value: '[[Bad]]' }))]; doc.pages.push(page);
    box.interactions = [evt('drag', move(box.id, { mode: 'drag', easing: 'none' })), evt('dragDrop', a({ type: 'openPage', targetId: page.id })), evt('click', move(box.id, { mode: 'locationBeforeDrag', easing: 'none' }))];
    const r = make(doc); await r.start(); r.beginDrag(box.id, 0, 0); await r.dragMove(10, 0); await expect(r.endDrag()).rejects.toThrow();
    expect(r.state().pageId).toBe(doc.pages[0].id); expect(r.state().motionState?.drag?.started).toBe(true); await r.trigger(box.id, 'click'); expect(r.widget(box).x).toBe(100);
  });
  it('immediately cancels a deleted drag row, and disposal does not retain raw drag or movement contexts', async () => {
    const { doc, box } = fixture(), list = createWidget('repeater'); list.repeater = { columns: ['Name'], rows: [{ Name: 'a' }], template: [box], itemHeight: 40, gap: 0 }; doc.pages[0].widgets = [list];
    box.interactions = [evt('drag', move(box.id, { mode: 'drag', easing: 'none' }))]; const r = make(doc); await r.start(); const row = r.rows(list)[0]; r.beginDrag(box.id, 0, 0, row.context); await r.dragMove(10, 0);
    await r.execute(evt('click', a({ type: 'deleteRow', targetId: list.id, value: '{"row":"this"}' })), row.data, row.context); expect(r.state().motionState?.drag?.started ?? false).toBe(false);
    r.dispose(); expect(r.state().motionState?.drag).toBeUndefined(); expect(r.state().motionState?.moveInfos).toBeUndefined(); expect(vi.getTimerCount()).toBe(0);
  });
});

it('engine snapshots retain independent Move/Resize destinations between interactions', async () => {
  vi.useFakeTimers(); const { doc, box } = fixture();
  const task = executeInteraction(doc, createRuntime(doc), evt('click', move(box.id), resize(box.id)));
  await vi.advanceTimersByTimeAsync(100); const first = await task;
  expect(getRuntimeWidget(box, first)).toMatchObject({ width: 300, height: 160 });
  const second = executeInteraction(doc, first, evt('click', move(box.id, { mode: 'location', x: { text: '[[Target.width + Target.x]]' }, y: { text: '' }, easing: 'none' })));
  expect(getRuntimeWidget(box, await second).x).toBe(440);
  expect(first.motionState?.resizeTargets?.[box.id]).toEqual({ width: 300, height: 160 });
});
