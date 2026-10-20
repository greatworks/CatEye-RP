import { describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { createDocument, createWidget, uid } from '../src/model/document';
import type { Action, Interaction } from '../src/model/types';
import type { BorderWidths, BoxMetrics, BoxPosition } from '../src/runtime/browser-box';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

type Step = Omit<Action, 'id'>;
const interaction = (actions: Step[], event: Interaction['event'] = 'click'): Interaction => ({ id: uid(), name: event, event, enabled: true, conditions: [], conditionMode: 'all', actions: actions.map(a => ({ ...a, id: uid() })) });

// A finite table of supplied host observations, deliberately not a DPR/rounding algorithm.
function mapped(value: number, entries: [number, number][]): number {
  return entries.find(([input]) => Math.abs(input - value) < 1e-9)?.[1] ?? value;
}
function fixture(portable: boolean, count = 1) {
  const doc = createDocument(), list = createWidget('repeater'), child = createWidget('button');
  doc.caseSelection = 'never'; doc.variables = { Width: '', Trace: '', Resizes: '0', Initial: '' };
  list.style.strokeWidth = 0; list.x = list.y = 0;
  list.repeater = { columns: ['Name'], rows: Array.from({ length: count }, (_, i) => ({ Name: String(i + 1) })), template: [child], itemWidth: 100, itemHeight: 20.1, gap: 5, layout: 'vertical', padding: [2, 3, 4, 7] };
  list.interactions = [interaction([
    { type: 'setVariable', targetId: 'Width', value: '[[This.width]]' },
    { type: 'setVariable', targetId: 'Trace', value: '[[Trace]][[This.width]]/[[This.height]];' },
    { type: 'setVariable', targetId: 'Resizes', value: '[[Resizes + 1]]' },
  ], 'itemResize')];
  doc.pages[0].widgets = [list];
  const reads: { width: number; height: number; borders: BorderWidths; position?: BoxPosition }[] = [];
  const reader = (width: number, height: number, borders: BorderWidths, position?: BoxPosition): BoxMetrics => {
    reads.push({ width, height, borders: [...borders], ...(position ? { position: { ...position } } : {}) });
    return {
      width: mapped(width, [[130.1, 130.094], [100.094, 100.08], [130.088, 130.078], [130.0945, 130.094]]),
      height: mapped(height, [[20.1, 20.093], [30.093, 30.078]]),
      borders: [...borders],
      ...(position ? { position: { x: position.x, y: mapped(position.y, [[27.1, 27.09], [37.09, 37.08]]) } } : {}),
    };
  };
  const runtime: OfflineRuntime = portable
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, new Script(`(${evaluateExpression.toString()})`).runInNewContext(), reader)
    : createOfflineRuntime(doc, undefined, evaluateExpression, reader);
  const key = Object.keys(runtime.state().itemLayouts)[0];
  const layers = (index = 0) => {
    const row = runtime.rows(list)[index], state = runtime.state();
    return { logical: { ...state.itemLayouts[key][row.id] }, css: { ...state.itemCssLayouts[key][row.id] }, geometry: { ...state.itemGeometry[key][row.id] }, rendered: { x: row.x, y: row.y, width: row.width, height: row.height } };
  };
  const inside = (index: number, ...actions: Step[]) => { const row = runtime.rows(list)[index]; return runtime.execute(interaction(actions), row.data, row.context); };
  const resize = (width?: number, height?: number, index = 0) => inside(index, { type: 'resizeItem', targetId: list.id, x: width, y: height });
  const refresh = () => runtime.execute(interaction([{ type: 'removeFilter', targetId: list.id, value: '{"all":true}' }]));
  return { doc, list, child, runtime, key, reads, layers, inside, resize, refresh };
}

for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} repeater row CSS and geometry layers`, () => {
  it('keeps initial raw geometry even when the host would read a different CSS height', async () => {
    const f = fixture(portable); f.list.interactions.push(interaction([{ type: 'setVariable', targetId: 'Initial', value: '[[This.width]]/[[This.height]]' }], 'itemLoad'));
    await f.runtime.start();
    const expected = { x: 7, y: 2, width: 100, height: 20.1 };
    expect(f.layers()).toEqual({ logical: expected, css: expected, geometry: expected, rendered: expected });
    expect(f.runtime.state().variables.Initial).toBe('100/20.1'); expect(f.runtime.state().variables.Resizes).toBe('0'); f.runtime.dispose();
  });

  it('keeps requested 130.1, CSS 130.1 and readback 130.094 distinct', async () => {
    const f = fixture(portable); await f.runtime.start(); await f.resize(130.1);
    const value = f.layers();
    expect(value.logical.width).toBe(130.1); expect(value.css.width).toBe(130.1); expect(value.rendered.width).toBe(130.1); expect(value.geometry.width).toBe(130.094);
    expect(f.runtime.state().variables.Width).toBe('130.094'); expect(f.runtime.state().variables.Resizes).toBe('1'); f.runtime.dispose();
  });

  it('repeating the same nominal request does no CSS measurement or event even if This differs', async () => {
    const f = fixture(portable); await f.runtime.start(); await f.resize(130.1);
    const before = structuredClone(f.runtime.state()); f.reads.length = 0; await f.resize(130.1);
    expect(f.runtime.state()).toEqual(before); expect(f.reads).toEqual([]); f.runtime.dispose();
  });

  it('preserves nominal addition residue and only stops when a repeated request is exactly equal', async () => {
    const f = fixture(portable); await f.runtime.start(); await f.resize(0.1);
    // Native sizesMap uses += delta: do not replace with requested or use epsilon equality.
    expect(f.layers().logical.width).toBe(0.09999999999999432);
    expect(f.runtime.state().variables.Resizes).toBe('1'); f.reads.length = 0;
    await f.resize(0.1);
    expect(f.layers().logical.width).toBe(0.1); expect(f.reads.length).toBeGreaterThan(0);
    expect(f.runtime.state().variables.Resizes).toBe('2');
    const before = structuredClone(f.runtime.state()); f.reads.length = 0; await f.resize(0.1);
    expect(f.runtime.state()).toEqual(before); expect(f.reads).toEqual([]); f.runtime.dispose();
  });

  it('uses current CSS readback plus the nominal delta for the next request', async () => {
    const f = fixture(portable); await f.runtime.start(); await f.resize(130.1); f.reads.length = 0; await f.resize(100.1);
    const value = f.layers();
    expect(value.logical.width).toBeCloseTo(100.1, 10); expect(value.css.width).toBeCloseTo(100.094, 10);
    expect(value.rendered.width).toBe(value.css.width); expect(value.geometry.width).toBe(100.08);
    expect(f.reads.some(read => Math.abs(read.width - 100.094) < 1e-9)).toBe(true);
    expect(f.runtime.state().variables.Trace).toBe('130.094/20.093;100.08/20.093;'); f.runtime.dispose();
  });

  it('refreshes the unmodified height cache on an X-only resize without rewriting height CSS', async () => {
    const f = fixture(portable); await f.runtime.start(); await f.resize(130.1);
    const value = f.layers();
    expect(value.logical.height).toBe(20.1); expect(value.css.height).toBe(20.1); expect(value.rendered.height).toBe(20.1); expect(value.geometry.height).toBe(20.093);
    expect(f.runtime.state().variables.Trace).toBe('130.094/20.093;'); f.runtime.dispose();
  });

  it('handles X then Y through their own CSS reads before one final resize event', async () => {
    const f = fixture(portable); await f.runtime.start(); await f.resize(130.1, 30.1);
    const value = f.layers();
    expect(value.logical.height).toBeCloseTo(30.1, 10); expect(value.css.height).toBeCloseTo(30.093, 10); expect(value.geometry.height).toBe(30.078);
    expect(value.logical.width).toBe(130.1); expect(value.css.width).toBe(130.1); expect(value.geometry.width).toBe(130.094);
    expect(f.runtime.state().variables.Resizes).toBe('1'); expect(f.runtime.state().variables.Trace).toBe('130.094/30.078;'); f.runtime.dispose();
  });

  it('treats the recorded This.width number as a new request rather than a nominal no-op', async () => {
    const f = fixture(portable); await f.runtime.start(); await f.resize(130.1);
    // resizeItem is numeric-only: retrieve the event's expression output through the variable API.
    const fromEvent = Number(f.runtime.state().variables.Width); expect(fromEvent).toBe(130.094);
    await f.resize(fromEvent); const value = f.layers();
    expect(value.logical.width).toBe(130.094); expect(value.css.width).toBeCloseTo(130.088, 10); expect(value.geometry.width).toBe(130.078);
    expect(f.runtime.state().variables.Resizes).toBe('2'); expect(f.runtime.state().variables.Trace).toBe('130.094/20.093;130.078/20.093;'); f.runtime.dispose();
  });

  it('fires for nonzero nominal changes even when the host readback remains unchanged', async () => {
    const f = fixture(portable); await f.runtime.start(); await f.resize(130.1); await f.resize(130.1005);
    const value = f.layers();
    expect(value.logical.width).toBeCloseTo(130.1005, 10); expect(value.css.width).toBeCloseTo(130.0945, 10); expect(value.geometry.width).toBe(130.094);
    expect(f.runtime.state().variables.Resizes).toBe('2'); expect(f.runtime.state().variables.Trace).toBe('130.094/20.093;130.094/20.093;'); f.runtime.dispose();
  });

  it('updates a nonmax row and its event without changing root CSS or root cache', async () => {
    const f = fixture(portable, 2); await f.runtime.start(); await f.resize(180);
    const before = { css: { ...f.runtime.state().repeaterCssBounds[f.key] }, geometry: { ...f.runtime.state().repeaterBounds[f.key] } };
    await f.resize(130.1, undefined, 1);
    expect(f.layers(1).geometry.width).toBe(130.094); expect(f.layers(1).css.width).toBe(130.1);
    expect(f.runtime.state().repeaterCssBounds[f.key]).toEqual(before.css); expect(f.runtime.state().repeaterBounds[f.key]).toEqual(before.geometry);
    expect(f.runtime.state().variables.Resizes).toBe('2'); f.runtime.dispose();
  });

  it('pushes following positions through host reads while retaining their untouched size cache', async () => {
    const f = fixture(portable, 2); await f.runtime.start(); expect(f.layers(1).geometry.y).toBe(27.1);
    await f.resize(undefined, 30.1);
    const next = f.layers(1);
    expect(next.logical.y).toBeCloseTo(37.1, 10); expect(next.css.y).toBeCloseTo(37.09, 10); expect(next.rendered.y).toBe(next.css.y); expect(next.geometry.y).toBe(37.08);
    expect(next.geometry.height).toBe(20.1); expect(f.runtime.state().variables.Resizes).toBe('1'); f.runtime.dispose();
  });

  it('rebuilds the three layers from raw template values on refresh', async () => {
    const f = fixture(portable); await f.runtime.start(); await f.resize(130.1, 30.1); await f.refresh();
    const expected = { x: 7, y: 2, width: 100, height: 20.1 };
    expect(f.layers()).toEqual({ logical: expected, css: expected, geometry: expected, rendered: expected });
    expect(f.runtime.state().variables.Resizes).toBe('1'); f.runtime.dispose();
  });

  it('rolls back all new layer state and nested event changes after a later action fails', async () => {
    const f = fixture(portable); await f.runtime.start(); await f.resize(130.1);
    const before = structuredClone(f.runtime.state());
    await expect(f.inside(0, { type: 'resizeItem', targetId: f.list.id, x: 100.1, y: 30.1 }, { type: 'setVariable', targetId: 'Trace', value: '[[1 / 0]]' })).rejects.toThrow('division by zero');
    expect(f.runtime.state()).toEqual(before); await f.resize(100.1);
    expect(f.layers().css.width).toBeCloseTo(100.094, 10); expect(f.layers().geometry.width).toBe(100.08); expect(f.runtime.state().variables.Resizes).toBe('2'); f.runtime.dispose();
  });
});
