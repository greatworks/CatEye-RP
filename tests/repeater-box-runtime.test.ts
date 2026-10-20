import { afterEach, describe, expect, it } from 'vitest';
import { Script } from 'node:vm';
import { applyAdaptiveWidgetEdits, clearAdaptiveOverrides, createAdaptiveView, resolveAdaptiveWidgets } from '../src/model/adaptive';
import { createDocument, createWidget, mergeWidgetStyle, parseDocument, serializeDocument, uid } from '../src/model/document';
import type { Action, Document, Interaction, Widget } from '../src/model/types';
import { createOfflineRuntime, type OfflineRuntime } from '../src/runtime/export-runtime';
import { evaluateExpression } from '../src/runtime/expressions';

type Step = Omit<Action, 'id'>;
type Direction = 'vertical' | 'horizontal';
const live: OfflineRuntime[] = [];
afterEach(() => { for (const runtime of live.splice(0)) runtime.dispose(); });
const event = (actions: Step[], trigger: Interaction['event'] = 'click'): Interaction => ({ id: uid(), event: trigger, name: trigger, enabled: true, conditionMode: 'all', conditions: [], actions: actions.map(action => ({ ...action, id: uid() })) });
function makeRuntime(doc: Document, portable: boolean): OfflineRuntime {
  const runtime: OfflineRuntime = portable
    ? new Script(`(${createOfflineRuntime.toString()})`).runInNewContext({ structuredClone, setTimeout, clearTimeout })(doc, undefined, new Script(`(${evaluateExpression.toString()})`).runInNewContext())
    : createOfflineRuntime(doc, undefined, evaluateExpression);
  live.push(runtime); return runtime;
}
function fixture(portable: boolean, layout: Direction = 'vertical', wrap?: number, count = 5) {
  const doc = createDocument(), list = createWidget('repeater'), child = createWidget('button', 0, 0), outside = createWidget('button');
  doc.caseSelection = 'never'; doc.variables = { Trace: '' }; child.width = 100; child.height = 20;
  list.style.strokeWidth = 2; list.style.borderWidths = [3, 5, 7, 2];
  list.repeater = { columns: ['Name'], rows: Array.from({ length: count }, (_, index) => ({ Name: String(index + 1) })), template: [child], itemWidth: 100, itemHeight: 20, gap: 0, horizontalGap: 8, verticalGap: 4, layout, padding: [5, 7, 11, 3], ...(wrap === undefined ? {} : { wrap }) };
  list.interactions = [event([{ type: 'setVariable', targetId: 'Trace', value: '[[Trace]][[Item.Name]]|' }], 'itemResize')];
  doc.pages[0].widgets = [list, outside]; const runtime = makeRuntime(doc, portable);
  const action = async (...steps: Step[]) => { outside.interactions = [event(steps)]; await runtime.trigger(outside.id, 'click'); };
  const resize = async (index: number, x?: number, y?: number) => {
    child.interactions = [event([{ type: 'resizeItem', targetId: list.id, x, y }])];
    const item = runtime.rows(list)[index]; await runtime.trigger(child.id, 'click', item.data, item.context);
  };
  const refresh = () => action({ type: 'removeFilter', targetId: list.id, value: '{"all":true}' });
  const bounds = () => { const widget = runtime.widget(list); return [widget.width, widget.height]; };
  const rects = () => runtime.rows(list).map(({ x, y, width, height }) => [x, y, width, height]);
  return { doc, list, child, runtime, action, resize, refresh, bounds, rects };
}

// Fixed expectations come from the border-box probes in
// research/repeater-box-model-evidence.json, not from the product layout helper.
const layouts: { direction: Direction; wrap?: number; bounds: number[]; origins: number[][]; drifted: number[] }[] = [
  { direction: 'vertical', bounds: [110, 132], origins: [[1, 2], [1, 26], [1, 50], [1, 74], [1, 98]], drifted: [130, 152] },
  { direction: 'vertical', wrap: 2, bounds: [326, 60], origins: [[1, 2], [1, 26], [109, 2], [109, 26], [217, 2]], drifted: [346, 80] },
  { direction: 'horizontal', bounds: [542, 36], origins: [[1, 2], [109, 2], [217, 2], [325, 2], [433, 2]], drifted: [556, 50] },
  { direction: 'horizontal', wrap: 2, bounds: [218, 84], origins: [[1, 2], [109, 2], [1, 26], [109, 26], [1, 50]], drifted: [232, 98] },
];

for (const portable of [false, true]) describe(`${portable ? 'portable' : 'module'} repeater box runtime`, () => {
  for (const layout of layouts) {
    const label = `${layout.direction}, ${layout.wrap === undefined ? 'unwrapped' : 'wrap 2'}`;
    it(`uses all padding sides in the envelope and subtracts top/left borders from row origins: ${label}`, async () => {
      const f = fixture(portable, layout.direction, layout.wrap); await f.runtime.start();
      expect(f.bounds()).toEqual(layout.bounds);
      expect(f.rects()).toEqual(layout.origins.map(([x, y]) => [x, y, 100, 20]));
      expect(f.runtime.widget(f.list).style.borderWidths).toEqual([3, 5, 7, 2]);
      expect(f.runtime.state().variables.Trace).toBe('');
    });

    it(`accumulates the main-axis border on nonzero envelope changes and resets it on refresh: ${label}`, async () => {
      const f = fixture(portable, layout.direction, layout.wrap); await f.runtime.start();
      await f.resize(0, 120, 30); await f.resize(0, 100, 20);
      expect(f.bounds()).toEqual(layout.drifted); expect(f.rects()).toEqual(layout.origins.map(([x, y]) => [x, y, 100, 20]));
      expect(f.runtime.state().variables.Trace).toBe('1|1|');
      await f.resize(0, 100, 20); expect(f.bounds()).toEqual(layout.drifted); expect(f.runtime.state().variables.Trace).toBe('1|1|');
      await f.refresh(); expect(f.bounds()).toEqual(layout.bounds); expect(f.runtime.state().variables.Trace).toBe('1|1|');
    });
  }

  it('retains negative empty raw cache values without pretending they are the DOM border-box minimum', async () => {
    const expected = [[102, -2], [-6, -2], [-6, 22], [-6, -2]];
    for (const [index, layout] of layouts.entries()) {
      const f = fixture(portable, layout.direction, layout.wrap, 0); f.list.repeater!.padding = [1, 1, 1, 1]; await f.runtime.start();
      expect(f.bounds()).toEqual(expected[index]); expect(f.rects()).toEqual([]);
      expect(Object.values(f.runtime.state().repeaterBounds)).toEqual([{ width: expected[index][0], height: expected[index][1] }]);
      await f.refresh(); expect(f.bounds()).toEqual(expected[index]);
      // Actual CSS clamping to 7x10 is covered separately by browser tests.
      expect(f.runtime.state().variables.Trace).toBe('');
    }
  });

  for (const direction of ['vertical', 'horizontal'] as const) {
    it(`uses the initial computed border minimum when a zero-sized item first grows: ${direction}`, async () => {
      const f = fixture(portable, direction, undefined, 1);
      Object.assign(f.list.repeater!, { itemWidth: 0, itemHeight: 0, padding: [0, 0, 0, 0] }); await f.runtime.start();
      expect(f.bounds()).toEqual([0, 0]); expect(f.rects()).toEqual([[-2, -3, 0, 0]]);
      await f.resize(0, 10, 10); expect(f.bounds()).toEqual(direction === 'vertical' ? [27, 30] : [24, 27]);
      expect(f.rects()).toEqual([[-2, -3, 10, 10]]); await f.refresh(); expect(f.bounds()).toEqual([0, 0]);
    });

    it(`does not accumulate borders for nonmaximal cross-axis or partial wrap-group changes: ${direction}`, async () => {
      const f = fixture(portable, direction, 2); await f.runtime.start(); const initial = f.bounds();
      if (direction === 'vertical') { await f.resize(0, 80); await f.resize(4, undefined, 10); }
      else { await f.resize(0, undefined, 10); await f.resize(4, 80); }
      expect(f.bounds()).toEqual(initial); expect(f.runtime.state().variables.Trace).toBe('1|5|');
      expect(f.rects()[0]).toEqual(direction === 'vertical' ? [1, 2, 80, 20] : [1, 2, 100, 10]);
      expect(f.rects()[4]).toEqual(direction === 'vertical' ? [217, 2, 100, 10] : [1, 50, 80, 20]);
    });

    it(`keeps nonmaximal unwrapped cross-axis resizes out of the outer cache: ${direction}`, async () => {
      const f = fixture(portable, direction, undefined, 3); await f.runtime.start(); const initial = f.bounds();
      if (direction === 'vertical') await f.resize(0, 80); else await f.resize(0, undefined, 10);
      expect(f.bounds()).toEqual(initial); expect(f.runtime.state().variables.Trace).toBe('1|');
    });
  }

  it('preserves positive empty envelopes when padding exceeds the gaps', async () => {
    const expected = [[140, 30], [32, 30], [32, 54], [32, 30]];
    for (const [index, layout] of layouts.entries()) {
      const f = fixture(portable, layout.direction, layout.wrap, 0); f.list.repeater!.padding = [13, 17, 21, 23]; await f.runtime.start();
      expect(f.bounds()).toEqual(expected[index]); expect(f.rects()).toEqual([]);
    }
  });

  it('clears independent borders on setStyle common-stroke actions while retaining explicitly supplied sides', async () => {
    const f = fixture(portable); await f.runtime.start();
    await f.action({ type: 'setStyle', targetId: f.list.id, style: { strokeWidth: 4 } });
    expect(f.runtime.widget(f.list).style).not.toHaveProperty('borderWidths'); expect(f.runtime.widget(f.list).style.strokeWidth).toBe(4);
    expect(f.rects()[0].slice(0, 2)).toEqual([1, 2]); // A style action alone does not refresh cached row origins.
    await f.resize(0, 120); expect(f.bounds()).toEqual([138, 132]);
    await f.refresh(); expect(f.bounds()).toEqual([110, 132]); expect(f.rects()[0].slice(0, 2)).toEqual([-1, 1]);
    await f.action({ type: 'setStyle', targetId: f.list.id, style: { fill: '#eeeeee' } });
    expect(f.runtime.widget(f.list).style).not.toHaveProperty('borderWidths');
    await f.action({ type: 'setStyle', targetId: f.list.id, style: { strokeWidth: 9, borderWidths: [2, 6, 4, 8] } });
    expect(f.runtime.widget(f.list).style).toMatchObject({ strokeWidth: 9, borderWidths: [2, 6, 4, 8], fill: '#eeeeee' });
    await f.refresh(); expect(f.rects()[0].slice(0, 2)).toEqual([-5, 3]);
    expect(f.list.style.borderWidths).toEqual([3, 5, 7, 2]); // Authored base is unchanged.
  });

  it('round-trips an adaptive common-stroke reset and uses it in the runtime without changing Base', async () => {
    const f = fixture(portable); let page = createAdaptiveView(f.doc.pages[0], 'Small', 400); const viewId = page.adaptiveViews[0].id;
    const widgets = resolveAdaptiveWidgets(page, viewId).map(widget => widget.id === f.list.id ? { ...widget, style: mergeWidgetStyle(widget.style, { strokeWidth: widget.style.strokeWidth }) } : widget);
    page = applyAdaptiveWidgetEdits(page, viewId, widgets);
    expect(page.adaptiveViews[0].overrides[f.list.id]).toEqual({ style: { strokeWidth: 2 } }); expect(page.widgets[0].style.borderWidths).toEqual([3, 5, 7, 2]);
    const doc = parseDocument(serializeDocument({ ...f.doc, pages: [page] }));
    doc.pages[0].widgets = resolveAdaptiveWidgets(doc.pages[0], viewId); const effective = doc.pages[0].widgets[0];
    const runtime = makeRuntime(doc, portable); await runtime.start();
    expect(runtime.widget(effective).style).not.toHaveProperty('borderWidths');
    expect(runtime.rows(effective)[0]).toMatchObject({ x: 1, y: 3 });
    const reset = clearAdaptiveOverrides(page, viewId, [f.list.id]);
    expect(resolveAdaptiveWidgets(reset, viewId)[0].style.borderWidths).toEqual([3, 5, 7, 2]);
    expect(reset.adaptiveViews[0].overrides).toEqual({});
  });
});

describe('adaptive independent border differences', () => {
  it('persists only changed sides, retains sides with a simultaneous common-width edit, and removes differences reset to Base', () => {
    const doc = createDocument(), widget = createWidget('box'); widget.style.borderWidths = [1, 2, 3, 4]; doc.pages[0].widgets = [widget];
    let page = createAdaptiveView(doc.pages[0], 'Small', 400); const viewId = page.adaptiveViews[0].id;
    const edit = (style: Widget['style']) => { page = applyAdaptiveWidgetEdits(page, viewId, [{ ...resolveAdaptiveWidgets(page, viewId)[0], style }]); };
    edit({ ...widget.style, borderWidths: [1, 2, 3, 7] }); expect(page.adaptiveViews[0].overrides[widget.id]).toEqual({ style: { borderWidths: [1, 2, 3, 7] } });
    edit({ ...widget.style, strokeWidth: 8 }); expect(page.adaptiveViews[0].overrides[widget.id]).toEqual({ style: { strokeWidth: 8, borderWidths: [1, 2, 3, 4] } });
    expect(resolveAdaptiveWidgets(page, viewId)[0].style.borderWidths).toEqual([1, 2, 3, 4]);
    edit(widget.style); expect(page.adaptiveViews[0].overrides).toEqual({}); expect(page.widgets[0].style).toEqual(widget.style);
  });
});
