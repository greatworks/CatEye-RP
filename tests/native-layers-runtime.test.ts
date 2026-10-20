import { Script } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument, createPage, createWidget, parseDocument, serializeDocument, uid } from '../src/model/document';
import type { Action, Document, EventType, Interaction, Widget } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';
import { createRuntime, executeInteraction, getRuntimeWidget } from '../src/runtime/engine';
import { layerAuthoringBounds } from '../src/model/layer-geometry';
import { nativeLayersRuntimeFixture } from './fixtures/native-layers-runtime';

const sessions: OfflineRuntime[] = [];
afterEach(() => { sessions.splice(0).forEach(session => session.dispose()); vi.useRealTimers(); });
const interaction = (event: EventType, ...actions: Omit<Action, 'id'>[]): Interaction => ({ id: uid(), name: event, event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(action => ({ id: uid(), ...action })) });
const trace = (value: string): Omit<Action, 'id'> => ({ type: 'setVariable', targetId: 'Trace', value });
const rect = (x: number, y: number, width: number, height: number): Widget => ({ ...createWidget('box', x, y), width, height });
const layer = (...widgets: Widget[]): Widget => ({ ...createWidget('layer'), ...layerAuthoringBounds(widgets), layer: { widgets } });
function fixture() {
  const doc = createDocument(), a = rect(100, 100, 20, 20), b = rect(140, 100, 40, 30), h = { ...rect(200, 140, 20, 20), hidden: true };
  const nested = layer(b, h), root = layer(a, nested), button = createWidget('button');
  doc.pages[0].widgets = [root, button]; doc.variables = { Trace: '' };
  return { doc, a, b, h, nested, root, button };
}
for (const portable of [false, true]) describe(`${portable ? 'serialized' : 'module'} native Layer runtime`, () => {
  function make(doc: Document) {
    if (!vi.isFakeTimers()) vi.useFakeTimers();
    const factory: typeof createOfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout, Date }) : createOfflineRuntime;
    const runtime = factory(parseDocument(serializeDocument(doc)), undefined, evaluateExpression, undefined, {}); sessions.push(runtime); return runtime;
  }
  it('indexes nested members and reads their shared scope coordinates without adding Layer bounds', async () => {
    const { doc, root, nested, b, button } = fixture();
    button.interactions = [interaction('click', { type: 'move', targetId: b.id, x: 160, y: 110 })];
    b.interactions = [interaction('click', trace('[[This.x]],[[This.y]]'))];
    const before = serializeDocument(doc), runtime = make(doc);
    expect(runtime.widget(root)).toMatchObject({ x: 100, y: 100, width: 120, height: 60 });
    expect(runtime.widget(nested)).toMatchObject({ x: 140, y: 100, width: 80, height: 60 });
    await runtime.trigger(button.id, 'click'); await runtime.trigger(b.id, 'click');
    expect(runtime.state().variables.Trace).toBe('160,110');
    expect(serializeDocument(doc)).toBe(before);
  });
  it('named-view bounds filter hidden and unplaced members, include rotated shadows, and keep negative-coordinate union semantics', async () => {
    const doc = createDocument(), shape = rect(100, 100, 200, 100);
    shape.rotation = 90; shape.style.outerShadow = { on: true, offsetX: 10, offsetY: 20, blurRadius: 6, color: '#000000' };
    const root = layer(shape, { ...rect(-200, -200, 500, 500), hidden: true }, { ...rect(-300, -300, 900, 900), placed: false });
    const negative = layer(rect(-40, -30, 10, 10)), empty = layer();
    doc.pages[0].widgets = [root, negative, empty];
    doc.pages[0].adaptiveViews = [{ id: 'named', name: 'Named', width: 390, overrides: {} }];
    doc.pages[0].adaptiveBaseSize = { width: 1200, height: 0 };
    const runtime = make(doc); await runtime.setAdaptiveView({ kind: 'view', viewId: 'named' });
    const drawn = runtime.widget(root);
    expect(drawn.x).toBeCloseTo(145); expect(drawn.y).toBeCloseTo(55);
    expect(drawn.width).toBeCloseTo(126); expect(drawn.height).toBeCloseTo(216);
    expect(runtime.widget(negative)).toMatchObject({ x: -40, y: -30, width: 40, height: 30 });
    expect(runtime.widget(empty)).toMatchObject({ x: 0, y: 0, width: 0, height: 0 });
  });
  it('updates containing Layer bounds and dispatches Resize before Move after a child action', async () => {
    const doc = createDocument(), child = rect(100, 80, 20, 30), root = layer(child), button = createWidget('button');
    root.interactions = [interaction('resize', trace('[[Trace]]R[[This.width]],[[This.height]];')), interaction('move', trace('[[Trace]]M[[This.x]],[[This.y]];'))];
    button.interactions = [interaction('click', { type: 'move', targetId: child.id, x: 140, y: 120 }, { type: 'resize', targetId: child.id, x: 40, y: 50 })];
    doc.pages[0].widgets = [root, button]; doc.variables = { Trace: '' };
    const runtime = make(doc); await runtime.trigger(button.id, 'click');
    expect(runtime.widget(root)).toMatchObject({ x: 140, y: 120, width: 40, height: 50 });
    expect(runtime.state().variables.Trace).toBe('M140,120;R40,50;');
  });
  it('keeps Layer members in their complete repeater row identity and dispatches Loaded for them', async () => {
    const { doc, b, root } = fixture(), repeater = createWidget('repeater');
    repeater.repeater!.template = [root]; repeater.repeater!.rows = [{ Name: 'First' }, { Name: 'Second' }];
    b.interactions = [interaction('load', { type: 'setText', targetId: b.id, value: '[[Item.Name]]' }), interaction('click', { type: 'move', targetId: b.id, x: 250, y: 180 })];
    doc.pages[0].widgets = [repeater]; const runtime = make(doc); await runtime.start();
    const rows = runtime.rows(repeater);
    expect(rows).toHaveLength(2);
    expect(runtime.widget(b, rows[0].context).text).toBe('First');
    expect(runtime.widget(b, rows[1].context).text).toBe('Second');
    await runtime.trigger(b.id, 'click', rows[0].data, rows[0].context);
    expect(runtime.widget(b, rows[0].context)).toMatchObject({ x: 250, y: 180 });
    expect(runtime.widget(b, rows[1].context)).toMatchObject({ x: 140, y: 100 });
  });
  it('bubbles an unhandled member click through Layers without using Propagate as a click gate', async () => {
    const { doc, root, nested, b } = fixture();
    root.layer!.propagate = false; nested.layer!.propagate = false;
    root.interactions = [interaction('click', trace('root'))];
    const runtime = make(doc); await runtime.trigger(b.id, 'click');
    expect(runtime.state().variables.Trace).toBe('root');
  });
  it('moves all Layer descendants in scope including hidden members, with visible preorder Move events', async () => {
    const { doc, root, nested, a, b, h, button } = fixture();
    for (const [w, name] of [[root, 'g'], [a, 'a'], [nested, 'n'], [b, 'b'], [h, 'h']] as const) w.interactions = [interaction('move', trace(`[[Trace]]${name};`))];
    button.interactions = [interaction('click', { type: 'move', move: { targets: [{ target: { kind: 'widget', id: root.id }, mode: 'delta', x: { text: '30' }, y: { text: '20' }, trajectory: 'straight', easing: 'linear', duration: 64 }] } })];
    const runtime = make(doc), pending = runtime.trigger(button.id, 'click'); await vi.advanceTimersByTimeAsync(0);
    expect(runtime.state().variables.Trace).toBe('g;a;n;b;');
    await vi.advanceTimersByTimeAsync(32); expect(runtime.widget(b)).toMatchObject({ x: 155, y: 110 });
    await vi.advanceTimersByTimeAsync(32); await pending;
    expect(runtime.widget(a)).toMatchObject({ x: 130, y: 120 });
    expect(runtime.widget(b)).toMatchObject({ x: 170, y: 120 });
    expect(runtime.widget(h)).toMatchObject({ x: 230, y: 160 });
  });
  it('rotates members about Layer bounds, preserving independent nested Layer degrees and panel child coordinates', async () => {
    const doc = createDocument(), a = rect(300, 100, 100, 60), b = rect(500, 100, 100, 60), nested = layer(b), root = layer(a, nested), button = createWidget('button');
    nested.rotation = 15;
    for (const [w, name] of [[root, 'g'], [a, 'a'], [nested, 'n'], [b, 'b']] as const) w.interactions = [interaction('rotate', trace(`[[Trace]]${name};`))];
    button.interactions = [interaction('click', { type: 'rotate', targetId: root.id, rotate: { mode: 'by', degrees: '90', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'none', duration: 0 } })];
    doc.pages[0].widgets = [root, button]; doc.variables = { Trace: '' };
    const runtime = make(doc); await runtime.trigger(button.id, 'click');
    expect(runtime.widget(a).x).toBeCloseTo(400); expect(runtime.widget(a).y).toBeCloseTo(0);
    expect(runtime.widget(b).x).toBeCloseTo(400); expect(runtime.widget(b).y).toBeCloseTo(200);
    expect(runtime.widget(a).rotation).toBe(90); expect(runtime.widget(b).rotation).toBe(90);
    expect(runtime.widget(nested).rotation).toBe(15);
    expect(runtime.state().variables.Trace).toBe('g;a;n;b;');
  });
  it('scales Layer members, including hidden leaves, while keeping nonresizable controls at their native size', async () => {
    const doc = createDocument(), a = rect(100, 100, 40, 20), b = rect(140, 120, 40, 20), root = layer(a, b), button = createWidget('button');
    button.interactions = [interaction('click', { type: 'resize', resize: { targets: [{ target: { kind: 'widget', id: root.id }, width: { text: '160' }, height: { text: '80' }, anchor: 'top left', easing: 'none', duration: 0 }] } })];
    doc.pages[0].widgets = [root, button]; const runtime = make(doc); await runtime.trigger(button.id, 'click');
    expect(runtime.widget(a)).toMatchObject({ x: 100, y: 100, width: 80, height: 40 });
    expect(runtime.widget(b)).toMatchObject({ x: 180, y: 140, width: 80, height: 40 });
  });
  it('propagates pointer paint only through opted-in nested containers and keeps selection independent', async () => {
    const { doc, root, nested, a, b, h } = fixture();
    root.layer!.propagate = true; nested.layer!.propagate = false;
    for (const w of [a, b, h]) w.mouseOverStyle = { fill: '#ff0000' };
    h.placed = false;
    const runtime = make(doc); runtime.setInteractionState(root.id, { mouseOver: true });
    expect(runtime.widget(a).style.fill).toBe('#ff0000');
    expect(runtime.widget(b).style.fill).not.toBe('#ff0000');
    await runtime.select(root.id, true);
    expect(runtime.widget(a).selected).toBe(true); expect(runtime.widget(b).selected).toBe(true); expect(runtime.widget(h).selected).toBe(true);
  });
  it('uses unrotated offsetLocation for edge-anchor resize displacement of a rotated member', async () => {
    const doc = createDocument(), extent = rect(100, 100, 200, 100), leaf = rect(140, 120, 40, 20), root = layer(extent, leaf);
    leaf.rotation = 90; doc.pages[0].widgets = [root];
    const runtime = make(doc);
    await runtime.execute(interaction('click', { type: 'resize', resize: { targets: [{ target: { kind: 'widget', id: root.id }, width: { text: '300' }, height: { text: '160' }, anchor: 'top left', easing: 'none', duration: 0 }] } }));
    expect(runtime.widget(leaf)).toMatchObject({ x: 160, y: 132, width: 60, height: 32, rotation: 90 });
  });
  it('keeps excluded sentinel logical geometry after refresh while supplying nonnegative CSS dimensions', async () => {
    const doc = createDocument(), root = layer({ ...rect(10, 20, 30, 40), hidden: true });
    doc.pages[0].widgets = [root]; doc.pages[0].adaptiveViews = [{ id: 'named', name: 'Named', width: 390, overrides: {} }];
    doc.pages[0].adaptiveBaseSize = { width: 1200, height: 0 };
    const runtime = make(doc); await runtime.setAdaptiveView({ kind: 'view', viewId: 'named' });
    expect(runtime.widget(root)).toMatchObject({ x: 99999, y: 99999, width: -99999, height: -99999 });
    expect(runtime.renderSize(root)).toEqual({ width: 0, height: 0 });
  });
  it('keeps Layer degree and member geometry in engine snapshots across successive By/To actions', async () => {
    const doc = createDocument(), a = rect(300, 100, 100, 60), b = rect(500, 100, 100, 60), root = layer(a, b);
    doc.pages[0].widgets = [root];
    const command = (mode: 'by'|'to', degrees: string) => interaction('click', { type: 'rotate', targetId: root.id, rotate: { mode, degrees, clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'none', duration: 0 } });
    const first = await executeInteraction(doc, createRuntime(doc), command('by', '90'));
    expect(getRuntimeWidget(root, first).rotation).toBe(90);
    const second = await executeInteraction(doc, first, command('to', '180'));
    expect(getRuntimeWidget(a, second).x).toBeCloseTo(500); expect(getRuntimeWidget(a, second).y).toBeCloseTo(100);
    expect(getRuntimeWidget(root, second).rotation).toBe(180);
  });
  it('reserves member channels before a reentrant root Rotate handler enqueues its own member action', async () => {
    const doc = createDocument(), a = rect(300, 100, 100, 60), b = rect(500, 100, 100, 60), root = layer(a, b);
    root.interactions = [interaction('rotate', { type: 'move', targetId: a.id, x: 700, y: 250 })];
    doc.pages[0].widgets = [root]; const runtime = make(doc);
    const pending = runtime.execute(interaction('click', { type: 'rotate', targetId: root.id, rotate: { mode: 'by', degrees: '90', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'linear', duration: 64 } }));
    await vi.advanceTimersByTimeAsync(32); expect(runtime.widget(a).x).not.toBe(700);
    await vi.advanceTimersByTimeAsync(64); await pending;
    expect(runtime.widget(a)).toMatchObject({ x: 700, y: 250, rotation: 90 }); expect(vi.getTimerCount()).toBe(0);
  });
  it('rolls back all root/member state when a member geometry event fails', async () => {
    const { doc, root, a } = fixture(); a.interactions = [interaction('rotate', trace('[[1 / 0]]'))];
    const runtime = make(doc), before = structuredClone(runtime.state());
    await expect(runtime.execute(interaction('click', { type: 'rotate', targetId: root.id, rotate: { mode: 'by', degrees: '90', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'linear', duration: 64 } }))).rejects.toThrow(/division by zero/i);
    expect(runtime.state()).toEqual(before); expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps initial Base data bounds, refreshes named-view bounds, and restores Base data on return', async () => {
    const doc = createDocument(), child = rect(100, 80, 40, 20), hidden = { ...rect(300, 200, 40, 20), hidden: true }, root = layer(child, hidden);
    doc.pages[0].widgets = [root]; doc.pages[0].adaptiveViews = [{ id: 'named', name: 'Named', width: 390, overrides: {} }];
    doc.pages[0].adaptiveBaseSize = { width: 1200, height: 0 };
    const saved = parseDocument(serializeDocument(doc)).pages[0].widgets[0], runtime = make(doc);
    expect(runtime.widget(root)).toMatchObject({ x: saved.x, y: saved.y, width: saved.width, height: saved.height });
    await runtime.start();
    expect(runtime.widget(root).width).toBe(240);
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'named' });
    expect(runtime.widget(root)).toMatchObject({ x: 100, y: 80, width: 40, height: 20 });
    await runtime.setAdaptiveView({ kind: 'base' });
    expect(runtime.widget(root)).toMatchObject({ x: 100, y: 80, width: 240, height: 140 });
    expect(getRuntimeWidget(saved, runtime.state())).toMatchObject({ x: 100, y: 80, width: 240, height: 140 });
  });
  it('compresses through visible Layers, moves matching sibling Layers once, and stops at a hidden Layer', async () => {
    for (const hidden of [false, true]) {
      const doc = createDocument(), source = rect(100, 100, 100, 50), inside = rect(100, 200, 100, 20), outside = rect(100, 250, 100, 20);
      const root = layer(source, inside), peerA = rect(100, 300, 100, 20), peerB = rect(100, 340, 100, 20), peer = layer(peerA, peerB);
      root.hidden = hidden; doc.pages[0].widgets = [root, outside, peer];
      source.interactions = [interaction('click', { type: 'move', move: { targets: [{ target: { kind: 'widgetsBelow' }, mode: 'delta', x: { text: '0' }, y: { text: '10' }, trajectory: 'straight', easing: 'none', duration: 0 }] } })];
      const runtime = make(doc); await runtime.trigger(source.id, 'click');
      expect(runtime.widget(inside).y).toBe(210);
      expect(runtime.widget(outside).y).toBe(hidden ? 250 : 260);
      expect(runtime.widget(peerA).y).toBe(hidden ? 300 : 310);
      expect(runtime.widget(peerB).y).toBe(hidden ? 340 : 350);
    }
  });
  it('keeps resizing displacement when a combined Layer rotation has zero delta', async () => {
    const doc = createDocument(), extent = rect(100, 100, 200, 100), leaf = rect(140, 120, 40, 20), root = layer(extent, leaf);
    doc.pages[0].widgets = [root];
    const runtime = make(doc);
    const pending = runtime.execute(interaction('click',
      { type: 'resize', resize: { targets: [{ target: { kind: 'widget', id: root.id }, width: { text: '300' }, height: { text: '160' }, anchor: 'top left', easing: 'linear', duration: 64 }] } },
      { type: 'rotate', targetId: root.id, rotate: { mode: 'by', degrees: '0', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'linear', duration: 64 } }));
    await vi.advanceTimersByTimeAsync(64); await pending;
    expect(runtime.widget(leaf)).toMatchObject({ x: 160, y: 132, width: 60, height: 32, rotation: 0 });
  });
  it('evaluates combined offsets after the two root Rotate events and uses the Resize anchor', async () => {
    const doc = createDocument(), extent = rect(100, 100, 200, 100), leaf = rect(140, 120, 40, 20), root = layer(extent, leaf);
    doc.variables = { Offset: '0' }; doc.pages[0].widgets = [root];
    root.interactions = [interaction('rotate', { type: 'setVariable', targetId: 'Offset', value: '[[Offset + 10]]' })];
    const commands = (offsetX: string, anchor: 'bottom right'|'top left') => interaction('click',
      { type: 'resize', resize: { targets: [{ target: { kind: 'widget', id: root.id }, width: { text: '300' }, height: { text: '160' }, anchor: 'top left', easing: 'linear', duration: 64 }] } },
      { type: 'rotate', targetId: root.id, rotate: { mode: 'by', degrees: '90', clockwise: false, anchor, offsetX, offsetY: '0', easing: 'linear', duration: 64 } });
    const actual = make(doc), expected = make(doc);
    const a = actual.execute(commands('[[Offset]]', 'bottom right')), b = expected.execute(commands('20', 'top left'));
    await vi.advanceTimersByTimeAsync(64); await Promise.all([a, b]);
    expect(actual.state().variables.Offset).toBe('20');
    expect(actual.widget(leaf)).toMatchObject({ x: expected.widget(leaf).x, y: expected.widget(leaf).y, width: 60, height: 32, rotation: 90 });
  });
  it('initializes Layer Selected before Disabled and preserves the original root-to-child declaration order', async () => {
    for (const parentSelected of [false, true]) for (const parentDisabled of [false, true]) for (const childSelected of [false, true]) for (const childDisabled of [false, true]) {
      const doc = createDocument(), child = rect(10, 20, 30, 40), root = layer(child);
      Object.assign(root, { selected: parentSelected, disabled: parentDisabled });
      Object.assign(child, { selected: childSelected, disabled: childDisabled });
      doc.variables = { Trace: '' }; doc.pages[0].widgets = [root];
      child.interactions = [interaction('select', trace('[[Trace]]child;'))];
      root.interactions = [interaction('select', trace('[[Trace]]root;'))];
      const runtime = make(doc); await runtime.start();
      expect(runtime.widget(child).selected, JSON.stringify({ parentSelected, parentDisabled, childSelected, childDisabled })).toBe(parentSelected || !parentDisabled && childSelected);
      expect(runtime.widget(child).disabled).toBe(parentDisabled || childDisabled);
      expect(runtime.widget(root)).toMatchObject({ selected: parentSelected, disabled: parentDisabled });
      expect(runtime.state().variables.Trace).toBe(parentSelected ? 'child;root;' : !parentDisabled && childSelected ? 'child;' : '');
    }
  });
  it('runs the complete saved browser fixture through combined Move/Resize and a following Layer Rotate', async () => {
    const doc = nativeLayersRuntimeFixture(), root = doc.pages[0].widgets[0], first = root.layer!.widgets[0], second = root.layer!.widgets[1].layer!.widgets[0];
    const runtime = make(doc); await runtime.start();
    const combined = runtime.trigger('layer-combine', 'click'); await vi.advanceTimersByTimeAsync(160); await combined;
    expect(runtime.widget(first)).toMatchObject({ x: 120, y: 110, width: 80, height: 40 });
    expect(runtime.widget(second)).toMatchObject({ x: 240, y: 110, width: 80, height: 40 });
    const rotated = runtime.trigger('layer-rotate', 'click'); await vi.advanceTimersByTimeAsync(160); await rotated;
    expect(runtime.widget(first).x).toBeCloseTo(180, 8); expect(runtime.widget(first).y).toBeCloseTo(50, 8);
    expect(runtime.widget(second).x).toBeCloseTo(180, 8); expect(runtime.widget(second).y).toBeCloseTo(170, 8);
  });
  it('isolates timed Layer members by row and does not repaint a refreshed generation', async () => {
    const doc = createDocument(), leaf = rect(10, 10, 40, 20), root = layer(leaf), repeater = createWidget('repeater');
    repeater.repeater = { columns: ['Name'], rows: [{ Name: 'First' }, { Name: 'Second' }], template: [root], itemHeight: 60, gap: 0 };
    leaf.interactions = [interaction('click', { type: 'rotate', targetId: root.id, rotate: { mode: 'by', degrees: '90', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'linear', duration: 160 } })];
    doc.pages[0].widgets = [repeater]; const runtime = make(doc); await runtime.start(); const rows = runtime.rows(repeater);
    runtime.widget(leaf, rows[0].context); runtime.widget(leaf, rows[1].context);
    const pending = runtime.trigger(leaf.id, 'click', rows[1].data, rows[1].context); await vi.advanceTimersByTimeAsync(80);
    expect(runtime.widget(leaf, rows[1].context).rotation).toBeCloseTo(45);
    expect(runtime.widget(leaf, rows[0].context).rotation).toBe(0);
    await runtime.execute(interaction('click', { type: 'updateRow', targetId: repeater.id, value: '{"row":"this","values":{"Name":"Refreshed"}}' }), rows[1].data, rows[1].context);
    await vi.advanceTimersByTimeAsync(80); await pending;
    expect(runtime.widget(leaf, rows[1].context).rotation).toBe(0);
    expect(runtime.widget(root, rows[1].context).rotation).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });
  it('preserves independent Layer degree across a view reset and cancels its descendants on navigation', async () => {
    const doc = createDocument(), leaf = rect(10, 10, 40, 20), root = layer(leaf), elsewhere = createPage('Elsewhere');
    doc.pages[0].widgets = [root]; doc.pages.push(elsewhere); doc.pages[0].adaptiveBaseSize = { width: 1200, height: 0 };
    doc.pages[0].adaptiveViews = [{ id: 'small', name: 'Small', width: 390, overrides: { [leaf.id]: { rotation: 12 } } }];
    const command = interaction('click', { type: 'rotate', targetId: root.id, rotate: { mode: 'by', degrees: '90', clockwise: true, anchor: 'center', offsetX: '0', offsetY: '0', easing: 'linear', duration: 160 } });
    const runtime = make(doc), pending = runtime.execute(command); await vi.advanceTimersByTimeAsync(32);
    await runtime.setAdaptiveView({ kind: 'view', viewId: 'small' });
    expect(runtime.widget(root).rotation).toBe(90); expect(runtime.widget(leaf).rotation).toBe(12);
    await vi.advanceTimersByTimeAsync(128); await pending; expect(runtime.widget(leaf).rotation).toBe(90);
    const second = runtime.execute(command); await vi.advanceTimersByTimeAsync(32); await runtime.navigate(elsewhere.id); await second;
    expect(runtime.state().pageId).toBe(elsewhere.id); expect(vi.getTimerCount()).toBe(0);
  });
  it('uses only the first ordered descendant for focus, with no fallback past an empty first Layer', async () => {
    const doc = createDocument(), input = createWidget('input', 10, 10), second = createWidget('input', 100, 10), empty = layer();
    const nested = layer(input), root = layer(nested, second), blocked = layer(empty, second);
    doc.pages[0].widgets = [root]; const calls: string[] = [], runtime = make(doc);
    runtime.bindControls({ flush() {}, focus: id => calls.push(id), selectText() {} });
    await runtime.execute(interaction('click', { type: 'setFocus', targetId: root.id }));
    expect(calls).toEqual([input.id]);
    const doc2 = createDocument(); doc2.pages[0].widgets = [blocked]; const runtime2 = make(doc2);
    runtime2.bindControls({ flush() {}, focus: id => calls.push(id), selectText() {} });
    await runtime2.execute(interaction('click', { type: 'setFocus', targetId: blocked.id }));
    expect(calls).toEqual([input.id]);
  });
});
