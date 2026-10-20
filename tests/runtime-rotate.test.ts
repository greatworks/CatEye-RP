import { Script } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument, createPage, createWidget, serializeDocument, uid } from '../src/model/document';
import { ROTATION_EASINGS, type Action, type Document, type EventType, type Interaction, type RotateActionSpec } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { createRuntime, executeInteraction } from '../src/runtime/engine';
import { evaluateExpression } from '../src/runtime/expressions';
import sourceProbe from '../research/runtime-rotate-motion-probes.json';

const sessions: OfflineRuntime[] = [];
afterEach(() => { sessions.splice(0).forEach(runtime => runtime.dispose()); vi.useRealTimers(); });
const spec = (patch: Partial<RotateActionSpec> = {}): RotateActionSpec => ({ mode: 'by', degrees: '90', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'none', duration: 0, ...patch });
const rotate = (id: string, patch: Partial<RotateActionSpec> = {}): Omit<Action, 'id'> => ({ type: 'rotate', targetId: id, rotate: spec(patch) });
const variable = (name: string, value: string): Omit<Action, 'id'> => ({ type: 'setVariable', targetId: name, value });
const interaction = (event: EventType, ...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: event, event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ id: uid(), ...action })) });
const oracle = (sourceProbe.results.find(result => result.name === 'shipped-easing-catalog')!.observed as unknown as { samples: Record<string, number[]> }).samples;

for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} runtime Rotate`, () => {
  function make(doc: Document) {
    vi.useFakeTimers();
    const factory: typeof createOfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout, Date }) : createOfflineRuntime;
    const runtime = factory(doc, undefined, evaluateExpression, undefined, {}); sessions.push(runtime); return runtime;
  }
  function fixture() {
    const doc = createDocument(), shape = createWidget('box', 100, 100), button = createWidget('button');
    Object.assign(shape, { width: 200, height: 100 }); doc.pages[0].widgets = [shape, button]; doc.variables = { Trace: '', N: '0', Degrees: '30' };
    return { doc, shape, button };
  }
  it('fires Rotate before writing pivot geometry, including a zero delta, and preserves the authored document', async () => {
    const { doc, shape, button } = fixture();
    shape.interactions = [interaction('rotate', variable('Trace', '[[Trace]][[This.x]],[[This.y]];'), variable('N', '[[N + 1]]'))];
    button.interactions = [interaction('click', rotate(shape.id, { anchor: 'top left' }), rotate(shape.id, { degrees: '0' }))];
    const before = serializeDocument(doc), runtime = make(doc); await runtime.trigger(button.id, 'click');
    expect(runtime.widget(shape)).toMatchObject({ rotation: 90, x: -50, y: 150 });
    expect(runtime.state().variables).toMatchObject({ Trace: '100,100;-50,150;', N: '2' }); expect(serializeDocument(doc)).toBe(before);
  });
  it('uses signed To without a shortest arc, and clockwise=false negates the requested value', async () => {
    const { doc, shape, button } = fixture(); shape.rotation = 350;
    button.interactions = [interaction('click', rotate(shape.id, { mode: 'to', degrees: '10', easing: 'linear', duration: 640 }))];
    const runtime = make(doc), pending = runtime.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(320);
    expect(runtime.widget(shape).rotation).toBeCloseTo(180, 9); await vi.advanceTimersByTimeAsync(320); await pending;
    expect(runtime.widget(shape).rotation).toBe(10);
    await runtime.execute(interaction('click', rotate(shape.id, { mode: 'to', degrees: '30', clockwise: false })));
    expect(runtime.widget(shape).rotation).toBe(-30);
  });
  it.each(ROTATION_EASINGS)('matches retained jQuery samples for %s, including actual intermediate state', async easing => {
    const { doc, shape, button } = fixture(); button.interactions = [interaction('click', rotate(shape.id, { degrees: '180', easing, duration: 640 }))];
    const runtime = make(doc), pending = runtime.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(0);
    if (easing === 'none') { await pending; expect(runtime.widget(shape).rotation).toBe(180); return; }
    for (let index = 1; index <= 4; index++) { await vi.advanceTimersByTimeAsync(160); expect(runtime.widget(shape).rotation).toBeCloseTo(180 * oracle[easing][index], 8); }
    await pending;
  });
  it('defers timed expression evaluation to event flush and each queued start while allowing other input', async () => {
    const { doc, shape, button } = fixture(), fast = createWidget('button'); doc.pages[0].widgets.push(fast);
    button.interactions = [interaction('click', rotate(shape.id, { degrees: '[[Degrees]]', easing: 'linear', duration: 160 }), rotate(shape.id, { degrees: '[[Degrees]]', easing: 'linear', duration: 160 }), variable('Degrees', '90'))];
    fast.interactions = [interaction('click', variable('Degrees', '30'), variable('Trace', 'input'))];
    const runtime = make(doc), pending = runtime.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(80);
    expect(runtime.widget(shape).rotation).toBeCloseTo(45, 9); await runtime.trigger(fast.id, 'click'); expect(runtime.state().variables.Trace).toBe('input');
    await vi.advanceTimersByTimeAsync(240); await pending; expect(runtime.widget(shape).rotation).toBeCloseTo(120, 9);
  });
  it.each(['box', 'input'] as const)('orbits %s around the rotated local offset, with the native orientation gate', async type => {
    const { doc, button } = fixture(), shape = createWidget(type, 100, 100); Object.assign(shape, { width: 200, height: 100, rotation: 90 }); doc.pages[0].widgets = [shape, button];
    button.interactions = [interaction('click', rotate(shape.id, { offsetX: '30', offsetY: '-10' }))];
    const runtime = make(doc); await runtime.trigger(button.id, 'click');
    const result = runtime.widget(shape); expect(result.x).toBeCloseTo(140, 9); expect(result.y).toBeCloseTo(120, 9); expect(result.rotation).toBe(type === 'box' ? 180 : 90);
  });
  it('starts separate target animations together and keeps center Rotate compatible with an immediate Move', async () => {
    const { doc, shape, button } = fixture(), other = createWidget('box'); doc.pages[0].widgets.push(other);
    button.interactions = [interaction('click', rotate(shape.id, { easing: 'linear', duration: 160 }), rotate(other.id, { degrees: '180', easing: 'linear', duration: 160 }), { type: 'move', targetId: shape.id, x: 240, y: 260 })];
    const runtime = make(doc), pending = runtime.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(80);
    expect(runtime.widget(shape)).toMatchObject({ x: 240, y: 260, rotation: 45 }); expect(runtime.widget(other).rotation).toBe(90);
    await vi.advanceTimersByTimeAsync(80); await pending;
  });
  it('holds a later Move until the orbit channel finishes without blocking another target', async () => {
    const { doc, shape, button } = fixture(), fast = createWidget('button'); doc.pages[0].widgets.push(fast);
    button.interactions = [interaction('click', rotate(shape.id, { anchor: 'top left', easing: 'linear', duration: 160 }))];
    fast.interactions = [interaction('click', { type: 'move', targetId: shape.id, x: 400, y: 500 }, variable('Trace', 'moved action submitted'))];
    const runtime = make(doc), pending = runtime.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(32);
    const moved = runtime.trigger(fast.id, 'click'); await vi.advanceTimersByTimeAsync(0); expect(runtime.state().variables.Trace).toBe('moved action submitted'); expect(runtime.widget(shape).x).not.toBe(400);
    await vi.advanceTimersByTimeAsync(128); await Promise.all([pending, moved]); expect(runtime.widget(shape)).toMatchObject({ x: 400, y: 500, rotation: 90 });
  });
  it('rolls back Rotate event failure without leaving timers and limits recursive handlers', async () => {
    const { doc, shape, button } = fixture(); shape.interactions = [interaction('rotate', variable('Trace', 'bad'), variable('N', '[[1 / 0]]'))];
    button.interactions = [interaction('click', rotate(shape.id, { easing: 'linear', duration: 160 }))];
    const runtime = make(doc); await expect(runtime.trigger(button.id, 'click')).rejects.toThrow('division by zero'); expect(runtime.widget(shape).rotation).toBe(0); expect(runtime.state().variables.Trace).toBe(''); expect(vi.getTimerCount()).toBe(0);
    shape.interactions = [interaction('rotate', rotate(shape.id))];
    await expect(runtime.execute(interaction('click', rotate(shape.id)))).rejects.toThrow(/cycle limit/); expect(runtime.widget(shape).rotation).toBe(0);
  });
  it('preserves a live ordinary tween across an adaptive CSS reset, but not after page unload', async () => {
    const { doc, shape, button } = fixture(), destination = createPage('Elsewhere'); doc.pages.push(destination);
    doc.pages[0].adaptiveBaseSize = { width: 1200, height: 0 }; doc.pages[0].adaptiveViews = [{ id: 'phone', name: 'Phone', width: 390, overrides: { [shape.id]: { rotation: 12 } } }];
    button.interactions = [interaction('click', rotate(shape.id, { degrees: '180', easing: 'linear', duration: 160 }))];
    const runtime = make(doc), pending = runtime.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(32); await runtime.setViewport({ width: 390 }); expect(runtime.widget(shape).rotation).toBe(12);
    await vi.advanceTimersByTimeAsync(128); await pending; expect(runtime.widget(shape).rotation).toBe(180);
    const second = runtime.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(32); await runtime.navigate(destination.id); await second; expect(vi.getTimerCount()).toBe(0);
  });
  it('restores an old animation when navigation Loaded fails and removes new destination motion', async () => {
    const { doc, shape, button } = fixture(), other = createPage('Failing'), target = createWidget('box'); other.widgets = [target]; doc.pages.push(other);
    other.interactions = [interaction('load', rotate(target.id, { easing: 'linear', duration: 160 }), variable('N', '[[1 / 0]]'))];
    button.interactions = [interaction('click', rotate(shape.id, { easing: 'linear', duration: 160 }))];
    const runtime = make(doc), pending = runtime.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(32);
    await expect(runtime.navigate(other.id)).rejects.toThrow('division by zero'); expect(runtime.state().pageId).toBe(doc.pages[0].id);
    await vi.advanceTimersByTimeAsync(128); await pending; expect(runtime.widget(shape).rotation).toBe(90); expect(runtime.state().widgetOverrides[target.id]).toBeUndefined(); expect(vi.getTimerCount()).toBe(0);
  });
  it('isolates equal template IDs by nested stable row identity and does not paint a rebuilt row with its detached tween', async () => {
    const { doc } = fixture(), outer = createWidget('repeater'), inner = createWidget('repeater'), cell = createWidget('box');
    inner.repeater = { columns: ['Degrees'], rows: [{ Degrees: '90' }], template: [cell], itemHeight: 40, gap: 0 };
    outer.repeater = { columns: ['Name'], rows: [{ Name: 'A' }, { Name: 'B' }], template: [inner], itemHeight: 50, gap: 0 }; doc.pages[0].widgets = [outer];
    cell.interactions = [interaction('click', rotate(cell.id, { degrees: '[[Item.Degrees]]', easing: 'linear', duration: 160 }))];
    const runtime = make(doc); await runtime.start(); const parents = runtime.rows(outer), a = runtime.rows(inner, parents[0].context)[0], b = runtime.rows(inner, parents[1].context)[0];
    const pending = runtime.trigger(cell.id, 'click', b.data, b.context); await vi.advanceTimersByTimeAsync(80);
    expect(runtime.widget(cell, a.context).rotation).toBe(0); expect(runtime.widget(cell, b.context).rotation).toBe(45);
    await runtime.execute(interaction('click', { type: 'updateRow', targetId: inner.id, value: '{"row":"this","values":{"Degrees":"30"}}' }), b.data, b.context);
    expect(runtime.widget(cell, b.context).rotation).toBe(0); await vi.advanceTimersByTimeAsync(80); await pending; expect(runtime.widget(cell, b.context).rotation).toBe(0);
  });
  it('rotates a flat sibling group about its union, with independent By/To angle and per-member events', async () => {
    const { doc, shape, button } = fixture(), field = createWidget('input', 300, 100);
    Object.assign(shape, { width: 100, height: 100, groupId: 'flat' }); Object.assign(field, { width: 100, height: 100, groupId: 'flat', hidden: true }); doc.pages[0].widgets.push(field);
    shape.interactions = field.interactions = [interaction('rotate', variable('N', '[[N+1]]'))];
    button.interactions = [interaction('click', rotate('flat'))];
    const runtime = make(doc); await runtime.trigger(button.id, 'click');
    expect(runtime.widget(shape)).toMatchObject({ x: 200, y: 0, rotation: 90 });
    expect(runtime.widget(field)).toMatchObject({ x: 200, y: 200, rotation: 0, hidden: true }); expect(runtime.state().variables.N).toBe('2');
    await runtime.execute(interaction('click', rotate('flat', { mode: 'to', degrees: '180' })));
    expect(runtime.widget(shape).rotation).toBe(180); expect(runtime.widget(field).rotation).toBe(0); expect(runtime.state().variables.N).toBe('4');
  });
  it('reserves all flat group member channels without blocking unrelated actions', async () => {
    const { doc, shape, button } = fixture(), other = createWidget('box', 400, 100), fast = createWidget('button');
    shape.groupId = other.groupId = 'flat'; doc.pages[0].widgets.push(other, fast);
    button.interactions = [interaction('click', rotate('flat', { easing: 'linear', duration: 160 }))];
    fast.interactions = [interaction('click', { type: 'move', targetId: shape.id, x: 600, y: 700 }, variable('N', '1'))];
    const runtime = make(doc), first = runtime.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(32);
    const second = runtime.trigger(fast.id, 'click'); await vi.advanceTimersByTimeAsync(0); expect(runtime.state().variables.N).toBe('1'); expect(runtime.widget(shape).x).not.toBe(600);
    await vi.advanceTimersByTimeAsync(128); await Promise.all([first, second]); expect(runtime.widget(shape)).toMatchObject({ x: 600, y: 700, rotation: 90 });
  });
  it('does not invent a common coordinate frame for a malformed cross-container flat group', async () => {
    const { doc, shape, button } = fixture(), panel = createWidget('panel'), child = createWidget('box');
    shape.groupId = child.groupId = 'flat'; panel.states![0].widgets = [child]; doc.pages[0].widgets.push(panel);
    const runtime = make(doc); await expect(runtime.execute(interaction('click', rotate('flat')))).rejects.toThrow(/sibling/);
    expect(runtime.widget(shape).rotation).toBe(0); expect(runtime.widget(child).rotation).toBe(0);
  });
  it('uses state-effective outer shadow for an offset pivot while a center rotation remains centered', async () => {
    const { doc, shape } = fixture(); shape.selected = true; shape.selectedStyle = { outerShadow: { on: true, offsetX: 10, offsetY: 20, blurRadius: 6, color: '#000' } };
    const runtime = make(doc); await runtime.execute(interaction('click', rotate(shape.id, { offsetX: '30', offsetY: '-10' })));
    expect(runtime.widget(shape).x).toBeCloseTo(120, 8); expect(runtime.widget(shape).y).toBeCloseTo(60, 8);
    await runtime.execute(interaction('click', rotate(shape.id))); expect(runtime.widget(shape).x).toBeCloseTo(120, 8);
  });
  it('reads This/Target.rotation from the live angle rather than the final-angle bounds cache', async () => {
    const { doc, shape, button } = fixture(), read = createWidget('button'); doc.pages[0].widgets.push(read);
    button.interactions = [interaction('click', rotate(shape.id, { degrees: '180', easing: 'linear', duration: 160 }))];
    shape.interactions = [interaction('click', variable('N', '[[This.rotation]]'))];
    const runtime = make(doc), pending = runtime.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(80); await runtime.trigger(shape.id, 'click'); expect(runtime.state().variables.N).toBe('90');
    await vi.advanceTimersByTimeAsync(80); await pending;
    await runtime.execute(interaction('click', rotate(shape.id, { mode: 'to', degrees: '[[Target.rotation+30]]' }))); expect(runtime.widget(shape).rotation).toBe(210);
  });
  it('lets the next queued tween resolve a rebuilt row while the old tween keeps its detached generation', async () => {
    const { doc } = fixture(), repeater = createWidget('repeater'), cell = createWidget('box');
    repeater.repeater = { columns: ['Degrees'], rows: [{ Degrees: '90' }], template: [cell], itemHeight: 40, gap: 0 }; doc.pages[0].widgets = [repeater];
    cell.interactions = [interaction('click', rotate(cell.id, { degrees: '[[Item.Degrees]]', easing: 'linear', duration: 160 }), rotate(cell.id, { degrees: '[[Item.Degrees]]', easing: 'linear', duration: 160 }))];
    const runtime = make(doc); await runtime.start(); const row = runtime.rows(repeater)[0]; const pending = runtime.trigger(cell.id, 'click', row.data, row.context); await vi.advanceTimersByTimeAsync(80);
    await runtime.execute(interaction('click', { type: 'updateRow', targetId: repeater.id, value: '{"row":"this","values":{"Degrees":"30"}}' }), row.data, row.context);
    await vi.advanceTimersByTimeAsync(80); expect(runtime.widget(cell, row.context).rotation).toBe(0); await vi.advanceTimersByTimeAsync(160); await pending; expect(runtime.widget(cell, row.context).rotation).toBe(30);
  });

  it('attributes a failing queued start to its own trigger and allows the previous and following jobs to finish', async () => {
    const { doc, shape } = fixture(), runtime = make(doc); const outcomes: string[] = [];
    const first = runtime.execute(interaction('click', rotate(shape.id, { easing: 'linear', duration: 64 }))).then(() => outcomes.push('first:ok'), () => outcomes.push('first:error'));
    await vi.advanceTimersByTimeAsync(16);
    const bad = runtime.execute(interaction('click', rotate(shape.id, { degrees: '[[1/0]]', easing: 'linear', duration: 64 }))).then(() => outcomes.push('bad:ok'), () => outcomes.push('bad:error'));
    const last = runtime.execute(interaction('click', rotate(shape.id, { degrees: '30', easing: 'linear', duration: 64 }))).then(() => outcomes.push('last:ok'), () => outcomes.push('last:error'));
    await vi.advanceTimersByTimeAsync(200);
    expect(outcomes.slice().sort()).toEqual(['bad:error','first:ok','last:ok']); expect(runtime.widget(shape).rotation).toBe(120); expect(vi.getTimerCount()).toBe(0);
    await Promise.all([first,bad,last]);
  });

  it('keeps the native negative-shadow moved cache distinct from painted CSS and public rotation', async () => {
    const { doc, shape } = fixture(); shape.style.outerShadow = { on: true, offsetX: -10, offsetY: -20, blurRadius: 6, color: '#000' };
    shape.interactions = [interaction('click', variable('Trace', '[[This.x]],[[This.y]],[[This.width]],[[This.height]]'))];
    const runtime = make(doc), pending = runtime.execute(interaction('click', rotate(shape.id, { offsetX: '30', offsetY: '-10', easing: 'linear', duration: 64 })));
    await vi.advanceTimersByTimeAsync(64); await pending; await runtime.trigger(shape.id, 'click');
    expect(runtime.widget(shape).x).toBeCloseTo(120, 8); expect(runtime.widget(shape).y).toBeCloseTo(60, 8);
    const readback = runtime.state().variables.Trace.split(',').map(Number); expect(readback[0]).toBeCloseTo(104, 8); expect(readback[1]).toBeCloseTo(34, 8); expect(readback.slice(2)).toEqual([200,100]);
  });
  it('fits the parent after releasing the next Rotate, using its cached destination bounds', async () => {
    const { doc, shape, button } = fixture(), panel = createWidget('panel'); Object.assign(shape,{x:0,y:0}); panel.fitToContent = true; panel.states![0].widgets = [shape]; doc.pages[0].widgets = [panel,button];
    button.interactions = [interaction('click', rotate(shape.id,{easing:'linear',duration:64}),rotate(shape.id,{easing:'linear',duration:64}))];
    const runtime = make(doc), pending = runtime.trigger(button.id,'click'); await vi.advanceTimersByTimeAsync(32);
    expect(runtime.widget(panel)).toMatchObject({width:200,height:100});
    await vi.advanceTimersByTimeAsync(32); expect(runtime.widget(shape).rotation).toBe(90); expect(runtime.widget(panel).width).toBeCloseTo(200,8); expect(runtime.widget(panel).height).toBeCloseTo(100,8);
    await vi.advanceTimersByTimeAsync(64); await pending;
  });
  it('isolates flat group angles by row with independent By/To accumulation', async () => {
    const {doc}=fixture(), repeater=createWidget('repeater'), a=createWidget('box',0,0), b=createWidget('box',200,0); a.groupId=b.groupId='flat';
    repeater.repeater={columns:['N'],rows:[{N:'A'},{N:'B'}],template:[a,b],itemHeight:100,gap:0};doc.pages[0].widgets=[repeater];
    const runtime=make(doc);await runtime.start();const rows=runtime.rows(repeater);
    await runtime.execute(interaction('click',rotate('flat')),rows[1].data,rows[1].context);expect(runtime.widget(a,rows[0].context).rotation).toBe(0);expect(runtime.widget(a,rows[1].context).rotation).toBe(90);
    await runtime.execute(interaction('click',rotate('flat',{mode:'to',degrees:'180'})),rows[1].data,rows[1].context);expect(runtime.widget(a,rows[1].context).rotation).toBe(180);
  });
  it('preserves a flat group angle across an ordinary adaptive reset of its members', async () => {
    const { doc, shape, button } = fixture(); shape.groupId = button.groupId = 'flat';
    doc.pages[0].adaptiveBaseSize = { width: 1200, height: 0 };
    doc.pages[0].adaptiveViews = [{ id: 'phone', name: 'Phone', width: 390, overrides: { [shape.id]: { rotation: 12 } } }];
    const runtime = make(doc); await runtime.execute(interaction('click', rotate('flat'))); await runtime.setViewport({ width: 390 });
    expect(runtime.widget(shape).rotation).toBe(12);
    await runtime.execute(interaction('click', rotate('flat', { mode: 'to', degrees: '180' })));
    expect(runtime.widget(shape).rotation).toBe(102); expect(runtime.widget(button).rotation).toBe(90);
  });

  it('releases an orbit Move queue before the final orientation step and its Rotate completion',async()=>{
    const {doc,shape}=fixture();shape.interactions=[interaction('move',variable('Trace','[[This.rotation]]/[[This.x]]'))];const runtime=make(doc);
    const first=runtime.execute(interaction('click',rotate(shape.id,{anchor:'top left',easing:'linear',duration:64})));await vi.advanceTimersByTimeAsync(16);
    const move=runtime.execute(interaction('click',{type:'move',targetId:shape.id,x:500,y:600}));await vi.advanceTimersByTimeAsync(48);await Promise.all([first,move]);
    expect(runtime.state().variables.Trace).toBe('67.5/500');expect(runtime.widget(shape)).toMatchObject({x:500,y:600,rotation:90});
  });
});


it('snapshot execution retains group angle and native shadow location without changing the project',async()=>{
  const doc=createDocument(),a=createWidget('box',100,100),b=createWidget('input',300,100);a.groupId=b.groupId='flat';doc.pages[0].widgets=[a,b];
  const before=serializeDocument(doc);let state=createRuntime(doc);
  state=await executeInteraction(doc,state,interaction('click',rotate('flat')));
  const copied=structuredClone(state);state=await executeInteraction(doc,state,interaction('click',rotate('flat',{mode:'to',degrees:'180'})));
  expect(state.widgetOverrides[a.id].rotation).toBe(180);expect(copied.widgetOverrides[a.id].rotation).toBe(90);expect(copied.motionState?.groupAngles).toBeDefined();
  const shape=createWidget('box',100,100);Object.assign(shape,{width:200,height:100});shape.style.outerShadow={on:true,offsetX:-10,offsetY:-20,blurRadius:6,color:'#000'};doc.pages[0].widgets=[shape];doc.variables.Trace='';
  state=await executeInteraction(doc,createRuntime(doc),interaction('click',rotate(shape.id,{offsetX:'30',offsetY:'-10'})));
  state=await executeInteraction(doc,state,interaction('click',rotate(shape.id,{degrees:'[[Target.x-104]]'})));
  expect(state.widgetOverrides[shape.id].rotation).toBeCloseTo(90,8);expect(Object.keys(state.motionState?.rotationLocations??{})).toEqual([shape.id]);
  doc.pages[0].widgets=[a,b];delete doc.variables.Trace;expect(serializeDocument(doc)).toBe(before);


});
