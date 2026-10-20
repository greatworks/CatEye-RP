import { describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createWidget, uid } from '../src/model/document';
import type { Action, Interaction } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

type Step = Omit<Action, 'id'>;
const event = (actions: Step[], trigger: Interaction['event'] = 'click'): Interaction => ({ id: uid(), event: trigger, name: trigger, enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(a => ({ ...a, id: uid() })) });
const log = (entry: string): Step => ({ type: 'setVariable', targetId: 'Trace', value: `[[Trace]]${entry}` });
function fixture(portable: boolean, count = 5) {
  const doc = createDocument(), list = createWidget('repeater'), child = createWidget('button'), outside = createWidget('button');
  doc.caseSelection = 'never'; doc.variables = { Trace: '' };
  child.x = 0; child.y = 0; child.width = 100; child.height = 20;
  list.style.strokeWidth = 0; list.width = 100; list.height = 200;
  list.repeater = { columns: ['Name'], rows: Array.from({ length: count }, (_, index) => ({ Name: String(index + 1) })), template: [child], itemWidth: 100, itemHeight: 20, gap: 0, layout: 'vertical' };
  list.interactions = [event([log('R[[Item.Name]]:[[Item.index]]|')], 'itemResize')];
  doc.pages[0].widgets = [list, outside];
  const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, evaluateExpression) : createOfflineRuntime(doc, undefined, evaluateExpression);
  const action = async (...steps: Step[]) => { outside.interactions = [event(steps)]; await runtime.trigger(outside.id, 'click'); };
  const inside = async (index: number, ...steps: Step[]) => { child.interactions = [event(steps)]; const item = runtime.rows(list)[index]; await runtime.trigger(child.id, 'click', item.data, item.context); };
  const resize = (index: number, x?: number, y?: number) => inside(index, { type: 'resizeItem', targetId: list.id, x, y });
  const rects = () => runtime.rows(list).map(({ x, y, width, height }) => [x, y, width, height]);
  const bounds = () => { const w = runtime.widget(list); return [w.width, w.height]; };
  return { doc, list, child, outside, runtime, action, inside, resize, rects, bounds };
}

for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} repeater item layout`, () => {
  it('moves following vertical rows and dispatches once after both dimensions change', async () => {
    const f = fixture(portable, 2); await f.runtime.start(); const observed: number[][] = [];
    f.runtime.subscribe(() => { if (f.runtime.state().variables.Trace) observed.push(f.bounds()); });
    await f.resize(0, 120, 30);
    expect(f.rects()).toEqual([[0, 0, 120, 30], [0, 30, 100, 20]]); expect(f.bounds()).toEqual([120, 50]);
    expect(f.runtime.state().variables.Trace).toBe('R1:1|'); expect(observed.every(size => size[0] === 120 && size[1] === 50)).toBe(true);
    await f.resize(0, 120, 30); expect(f.runtime.state().variables.Trace).toBe('R1:1|');
    f.runtime.dispose();
  });
  it('uses horizontal sums and cross-axis maxima with different gaps', async () => {
    const f = fixture(portable, 3); Object.assign(f.list.repeater!, { layout: 'horizontal', horizontalGap: 7, verticalGap: 3 }); await f.runtime.start();
    await f.resize(1, 40, 45);
    expect(f.rects()).toEqual([[0, 0, 100, 20], [107, 0, 40, 45], [154, 0, 100, 20]]); expect(f.bounds()).toEqual([254, 45]);
    await f.resize(1, 40, 10); expect(f.bounds()).toEqual([254, 20]); f.runtime.dispose();
  });
  for (const direction of ['vertical', 'horizontal'] as const) it(`keeps fixed groups and recomputes maxima after growth/shrink: ${direction}`, async () => {
    const f = fixture(portable); Object.assign(f.list.repeater!, { layout: direction, wrap: 2, horizontalGap: 8, verticalGap: 4 }); await f.runtime.start();
    await f.resize(0, 130, 80); await f.resize(2, 90, 45);
    if (direction === 'vertical') {
      expect(f.rects()).toEqual([[0, 0, 130, 80], [0, 84, 100, 20], [138, 0, 90, 45], [138, 49, 100, 20], [246, 0, 100, 20]]);
      expect(f.bounds()).toEqual([346, 104]); await f.resize(0, 80, 10);
      expect(f.bounds()).toEqual([316, 69]); expect(f.rects()[2]).toEqual([108, 0, 90, 45]);
    } else {
      expect(f.rects()).toEqual([[0, 0, 130, 80], [138, 0, 100, 20], [0, 84, 90, 45], [98, 84, 100, 20], [0, 133, 100, 20]]);
      expect(f.bounds()).toEqual([238, 153]); await f.resize(0, 80, 10);
      expect(f.bounds()).toEqual([198, 93]); expect(f.rects()[2]).toEqual([0, 24, 90, 45]);
    }
    f.runtime.dispose();
  });
  it('retains omitted dimensions and supports fractional / zero item size', async () => {
    const f = fixture(portable, 2); await f.runtime.start(); await f.resize(0, undefined, 12.5);
    expect(f.rects()[0]).toEqual([0, 0, 100, 12.5]); await f.resize(0, -50, 0);
    expect(f.rects()).toEqual([[0, 0, 0, 0], [0, 0, 100, 20]]); expect(f.bounds()).toEqual([100, 20]); f.runtime.dispose();
  });
  it('resets sizes on sort/page/filter refresh and scopes resize to a visible source row', async () => {
    const f = fixture(portable, 4); await f.runtime.start(); await f.action({ type: 'setItemsPerPage', targetId: f.list.id, value: '2' });
    const stale = f.runtime.rows(f.list)[0]; await f.resize(0, 140, 55);
    await f.action({ type: 'sortRows', targetId: f.list.id, value: 'Name:desc' });
    expect(f.runtime.rows(f.list).map(row => row.data.Name)).toEqual(['4', '3']); expect(f.bounds()).toEqual([100, 40]);
    f.child.interactions = [event([{ type: 'resizeItem', targetId: f.list.id, y: 90 }])];
    await f.runtime.trigger(f.child.id, 'click', stale.data, stale.context); expect(f.bounds()).toEqual([100, 40]);
    await f.action({ type: 'setRepeaterPage', targetId: f.list.id, value: 'next' }); expect(f.runtime.rows(f.list).map(row => row.data.Name)).toEqual(['2', '1']);
    await f.resize(1, 80, 60); expect(f.bounds()).toEqual([100, 80]);
    await f.action({ type: 'filterRows', targetId: f.list.id, value: '{"column":"Name","operator":"equals","value":"1"}' }); expect(f.bounds()).toEqual([100, 20]); f.runtime.dispose();
  });
  it('does not create an item or event for empty data or an outside resize source', async () => {
    const f = fixture(portable, 0); await f.runtime.start(); await f.action({ type: 'resizeItem', targetId: f.list.id, x: 20, y: 60 });
    expect(f.runtime.rows(f.list)).toEqual([]); expect(f.bounds()).toEqual([100, 0]); expect(f.runtime.state().variables.Trace).toBe('');
    await f.action({ type: 'addRow', targetId: f.list.id, value: '{"Name":"A"}' }, { type: 'resizeItem', targetId: f.list.id, y: 60 }); expect(f.bounds()).toEqual([100, 20]); f.runtime.dispose();
  });
  it('nests Item Resized inside Item Loaded and keeps the refresh data guard', async () => {
    const f = fixture(portable, 2);
    f.list.interactions.push(event([log('L[[Item.Name]]|'), { type: 'resizeItem', targetId: f.list.id, y: 35 }, log('E[[Item.Name]]|')], 'itemLoad'));
    f.list.interactions[0].actions.push({ id: uid(), type: 'addRow', targetId: f.list.id, value: '{"Name":"guarded"}' });
    await f.runtime.start(); expect(f.runtime.state().variables.Trace).toBe('L1|R1:1|E1|L2|R2:2|E2|'); expect(f.bounds()).toEqual([100, 70]); expect(f.runtime.rows(f.list)).toHaveLength(2); f.runtime.dispose();
  });
  it('preserves row context across Wait and later refresh resets the explicit size', async () => {
    const f = fixture(portable, 2); await f.runtime.start();
    await f.inside(1, { type: 'wait', duration: 0 }, { type: 'resizeItem', targetId: f.list.id, y: 55 });
    expect(f.rects()[1]).toEqual([0, 20, 100, 55]); expect(f.runtime.state().variables.Trace).toBe('R2:2|');
    await f.action({ type: 'removeFilter', targetId: f.list.id, value: '{"all":true}' }); expect(f.bounds()).toEqual([100, 40]); f.runtime.dispose();
  });
  it('fits actual changed children, without fitting every item at load or on fixed text changes', async () => {
    const f = fixture(portable, 2); f.list.repeater!.fitToContent = true; f.child.x = 10; f.child.y = 20; f.child.width = 30; f.child.height = 40;
    await f.runtime.start(); expect(f.bounds()).toEqual([100, 40]); expect(f.runtime.state().variables.Trace).toBe('');
    await f.inside(0, { type: 'setText', targetId: f.child.id, value: 'fixed-size text' }); expect(f.bounds()).toEqual([100, 40]);
    await f.inside(0, { type: 'move', targetId: f.child.id, x: 15 }); expect(f.rects()[0]).toEqual([0, 0, 45, 60]);
    await f.resize(0, 170, 90); expect(f.rects()[0]).toEqual([0, 0, 170, 90]);
    await f.inside(0, { type: 'move', targetId: f.child.id, x: -10, y: -20 }); expect(f.rects()[0]).toEqual([0, 0, 20, 20]);
    await f.inside(0, { type: 'hide', targetId: f.child.id }); expect(f.rects()[0]).toEqual([0, 0, 0, 0]);
    await f.action({ type: 'show', targetId: f.child.id }); expect(f.rects()[0]).toEqual([0, 0, 20, 20]); f.runtime.dispose();
  });
  it('includes rotated bounds and clamps entirely negative content to zero', async () => {
    const f = fixture(portable, 1); f.list.repeater!.fitToContent = true; Object.assign(f.child, { x: 10, y: 20, width: 20, height: 100, rotation: 90 });
    await f.runtime.start(); await f.inside(0, { type: 'move', targetId: f.child.id, x: 10 }); expect(f.bounds()[0]).toBeCloseTo(70); expect(f.bounds()[1]).toBeCloseTo(80);
    await f.inside(0, { type: 'move', targetId: f.child.id, x: -200, y: -200 }); expect(f.bounds()).toEqual([0, 0]); f.runtime.dispose();
  });
  it('stops a fit chain at a fixed panel or inactive state', async () => {
    const f = fixture(portable, 1), panel = createWidget('panel'); panel.x = panel.y = 0; panel.width = 50; panel.height = 30;
    panel.states![0].widgets = [f.child]; f.list.repeater!.template = [panel]; f.list.repeater!.fitToContent = true;
    // Build after structural ownership changes.
    f.runtime.dispose(); const runtime = createOfflineRuntime(f.doc, undefined, evaluateExpression); await runtime.start();
    f.child.interactions = [event([{ type: 'move', targetId: f.child.id, x: 50 }])]; const row = runtime.rows(f.list)[0];
    await runtime.trigger(f.child.id, 'click', row.data, row.context); expect(runtime.rows(f.list)[0].height).toBe(20);
    panel.fitToContent = true; panel.states!.push({ id: uid(), name: 'other', widgets: [] }); panel.activeStateId = panel.states![1].id;
    await runtime.trigger(f.child.id, 'click', row.data, row.context); expect(runtime.rows(f.list)[0].height).toBe(20);
    panel.activeStateId = panel.states![0].id; f.child.interactions[0].actions[0].x = 70; await runtime.trigger(f.child.id, 'click', row.data, row.context);
    expect(runtime.rows(f.list)[0].width).toBe(170); runtime.dispose();
  });
  it('retains explicit item size when a fitted panel extent or active state does not change', async () => {
    const f = fixture(portable, 1), panel = createWidget('panel'), extent = createWidget('text');
    panel.x = panel.y = 0; panel.fitToContent = true; extent.x = extent.y = 0; extent.width = extent.height = 100;
    f.child.width = f.child.height = 10; panel.states![0].widgets = [f.child, extent]; f.list.repeater!.template = [panel]; f.list.repeater!.fitToContent = true;
    f.runtime.dispose(); const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(f.doc, undefined, evaluateExpression) : createOfflineRuntime(f.doc, undefined, evaluateExpression);
    await runtime.start(); const row = runtime.rows(f.list)[0];
    f.child.interactions = [event([{ type: 'resizeItem', targetId: f.list.id, x: 200, y: 200 }, { type: 'move', targetId: f.child.id, x: 20, y: 20 }, { type: 'setState', targetId: panel.id, value: panel.activeStateId }])];
    await runtime.trigger(f.child.id, 'click', row.data, row.context); expect(runtime.rows(f.list)[0].width).toBe(200); expect(runtime.rows(f.list)[0].height).toBe(200);
    expect(runtime.state().variables.Trace).toBe('R1:1|'); runtime.dispose();
  });
  it('propagates nested repeater refresh bounds to its fitted outer item', async () => {
    const f = fixture(portable, 1), outer = createWidget('repeater'); f.list.x = f.list.y = 0;
    outer.repeater = { columns: ['Name'], rows: [{ Name: 'outer' }, { Name: 'second' }], template: [f.list], itemWidth: 100, itemHeight: 20, gap: 0, layout: 'vertical', fitToContent: true };
    f.doc.pages[0].widgets = [outer]; f.runtime.dispose(); const runtime: OfflineRuntime = portable ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(f.doc, undefined, evaluateExpression) : createOfflineRuntime(f.doc, undefined, evaluateExpression);
    await runtime.start(); const parent = runtime.rows(outer)[0], row = runtime.rows(f.list, parent.context)[0];
    f.child.interactions = [event([{ type: 'addRow', targetId: f.list.id, value: '{"Name":"B"}' }])]; await runtime.trigger(f.child.id, 'click', row.data, row.context);
    expect(runtime.rows(outer).map(item => [item.y, item.height])).toEqual([[0, 40], [40, 20]]);
    expect(runtime.rows(f.list, runtime.rows(outer)[1].context)).toHaveLength(1); runtime.dispose();
  });
  it('updates an outer fitted panel before resize handlers observe it', async () => {
    const f = fixture(portable, 2), panel = createWidget('panel'); panel.fitToContent = true; panel.states![0].widgets = [f.list]; f.list.x = 10; f.list.y = 15;
    f.doc.pages[0].widgets = [panel, f.outside]; f.runtime.dispose(); const runtime = createOfflineRuntime(f.doc, undefined, evaluateExpression); await runtime.start();
    f.child.interactions = [event([{ type: 'resizeItem', targetId: f.list.id, x: 130, y: 45 }])]; const row = runtime.rows(f.list)[0];
    const observations: number[] = []; runtime.subscribe(() => { if (runtime.state().variables.Trace) observations.push(runtime.widget(panel).height); });
    await runtime.trigger(f.child.id, 'click', row.data, row.context); expect(runtime.widget(panel).height).toBe(80); expect(observations.every(height => height === 80)).toBe(true); runtime.dispose();
  });
  it('guards recursive resize events and rolls the triggering segment back', async () => {
    const f = fixture(portable, 1); await f.runtime.start(); f.list.interactions = [event([{ type: 'resizeItem', targetId: f.list.id, y: 10 }, { type: 'resizeItem', targetId: f.list.id, y: 30 }], 'itemResize')];
    await expect(f.resize(0, 120, 40)).rejects.toThrow('Item resize event cycle limit'); expect(f.rects()[0]).toEqual([0, 0, 100, 20]);
    f.list.interactions = []; await f.resize(0, 120, 40); expect(f.bounds()).toEqual([120, 40]); f.runtime.dispose();
  });
  it('retains legacy outer bounds until explicitly resized', async () => {
    const f = fixture(portable, 2); delete f.list.repeater!.layout; delete f.list.repeater!.itemWidth;
    await f.runtime.start(); expect(f.bounds()).toEqual([100, 200]); await f.resize(0, 100, 35); expect(f.bounds()).toEqual([100, 55]);
    await f.action({ type: 'removeFilter', targetId: f.list.id, value: '{"all":true}' }); expect(f.bounds()).toEqual([100, 200]); f.runtime.dispose();
  });
});
