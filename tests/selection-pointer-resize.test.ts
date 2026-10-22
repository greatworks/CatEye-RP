import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { prepareSelectionPointerResize, planSelectionPointerResize } from '../src/model/selection-pointer-resize';
import type { SelectionLayoutInput, SelectionLayoutServices } from '../src/model/selection-layout';
import type { SelectionPointerHandle } from '../src/model/selection-pointer-resize';
import { createDocument, createPage, createWidget, parseDocument, serializeDocument } from '../src/model/document';
import { applySelectionAuthorEffects } from '../src/model/selection-author-edits';

function target(id = 'a', x = 20, fit = false) {
  const input: SelectionLayoutInput = {
    ownerRect: { x, y: 30, width: 100, height: 20 },
    textPanelRect: { x: 13, y: 0, width: 87, height: 15 },
    coordinateContext: { kind: 'translation', locationInDiagram: { x, y: 30 }, ownerRotation: 0, textRotation: 0 },
    rawFit: { width: fit, height: false }, effectiveFit: { width: fit, height: false },
    alignRight: false, empty: false, guard: false, padding: [0, 0, 0, 0], indicatorSize: 13,
    horizontalAlignment: 'left', verticalAlignment: 'top',
  };
  const services: SelectionLayoutServices = {
    measureText: vi.fn(() => ({ width: 60, height: 15 })),
    readMinimumSize: () => ({ width: 1, height: 1 }),
    convertIndicatorInset: () => ({ width: 2, height: 2 }),
    unionRectangles(a, b) {
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x,
        height: Math.max(a.y + a.height, b.y + b.height) - y };
    },
  };
  return { id, type: 'checkbox' as const, input, services };
}

describe('selection pointer sessions separate geometry snapshots from live text state', () => {
  it('prepares without measuring and admits only left/right handles for a single control', () => {
    const item = target();
    expect(() => prepareSelectionPointerResize([item], 2)).toThrow(/handle/i);
    const prepared = prepareSelectionPointerResize([item], 4);
    expect(item.services.measureText).not.toHaveBeenCalled();
    expect(prepared.state.targets[0].layout.ownerRect).toEqual(item.input.ownerRect);
    item.input.ownerRect.width = 999;
    expect(prepared.original.targets[0].input.ownerRect.width).toBe(100);
    expect(prepared.state.targets[0].layout.ownerRect.width).toBe(100);
  });

  it('disables AFW once, retains the live panel and does not restore AFW on return to the old edge', () => {
    const item = target('a', 20, true), prepared = prepareSelectionPointerResize([item], 4);
    const original = structuredClone(prepared.state);
    const first = planSelectionPointerResize(prepared.original, prepared.state, { delta: { x: 20, y: 8 } });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.targets[0].layout.rawFit.width).toBe(false);
    expect(first.state.fitHotZone).toBe(false);
    expect(first.state.targets[0].layout.ownerRect.width).toBe(120);
    const back = planSelectionPointerResize(prepared.original, first.state, { delta: { x: 0, y: 0 } });
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.state.targets[0].layout.ownerRect.width).toBe(100);
    expect(back.state.targets[0].layout.rawFit.width).toBe(false);
    expect(back.results[0].result.effects.some(effect => effect.name === 'fit.flag')).toBe(false);
    expect(prepared.state).toEqual(original);
  });

  it('uses the original geometry for a west gesture and writes its Location after text changed the requested height', () => {
    const item = target(), prepared = prepareSelectionPointerResize([item], 1);
    const result = planSelectionPointerResize(prepared.original, prepared.state, { delta: { x: -20, y: 500 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.targets[0].layout.ownerRect).toEqual({ x: 0, y: 30, width: 120, height: 15 });
    const effects = result.results[0].result.effects;
    expect(effects.filter(effect => effect.name === 'style.Location').at(-1)).toEqual({
      name: 'style.Location', x: 0, y: 30, allViews: false, notify: true,
    });
    expect(effects.map(effect => effect.name).lastIndexOf('style.Size'))
      .toBeLessThan(effects.map(effect => effect.name).lastIndexOf('style.Location'));
  });

  it('plans all selected roots with the same old selection frame', () => {
    const prepared = prepareSelectionPointerResize([target('a', 0), target('b', 300)], 4);
    const result = planSelectionPointerResize(prepared.original, prepared.state, { delta: { x: 100, y: 50 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.targets.map(row => row.layout.ownerRect)).toEqual([
      { x: 0, y: 30, width: 125, height: 15 }, { x: 375, y: 30, width: 125, height: 15 },
    ]);
  });

  it('withholds every target result when a later target measurement fails', () => {
    const a = target('a', 0), b = target('b', 300);
    b.services.measureText = () => { throw Error('second target failed'); };
    const prepared = prepareSelectionPointerResize([a, b], 4), before = structuredClone(prepared.state);
    const result = planSelectionPointerResize(prepared.original, prepared.state, { delta: { x: 100, y: 0 } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('second target failed');
    expect(result).not.toHaveProperty('state');
    expect(result).not.toHaveProperty('results');
    expect(prepared.state).toEqual(before);
  });
});

describe('retained single Selection controller and layout composition', () => {
  const sessions = JSON.parse(readFileSync('research/selection-pointer-session-probes.json', 'utf8'));
  const compared = new Set(['OI8Z.enter', 'guard', 'YJ0S.request', 'uJ0j.request', 'style.Size', 'style.Location',
    'measure', 'graphics.measure', 'panel.rect', 'panel.invalidate', 'panel.measured', 'WIyL', 'graphics.convert-size',
    'indicator.rect', 'NJ01', 'DJ0E', 'size.changed', 'location.changed', 'finally.dispose']);
  type Row = { input: { widthFit: boolean; heightFit: boolean; handle: 1 | 4; rect: SelectionLayoutInput['ownerRect'];
    panel: SelectionLayoutInput['textPanelRect']; buttonSize: number; measurements: { width: number; height: number }[];
    deltas: { x: number; y: number }[] };
    actual: { before: { panel: unknown }; after: { rect: unknown; panel: unknown; fit: boolean; dbNv: boolean };
      events: { name: string }[]; error: string | null }[] };
  it.each((sessions.cases as (Row & { input: { rects?: unknown; shift?: boolean } })[])
    .filter(row => !row.input.rects).map((row, index) => [index, row] as const))('persistent source session %i', (_index, row) => {
    const item = target();
    Object.assign(item.input, { ownerRect: row.input.rect, textPanelRect: row.input.panel,
      coordinateContext: { kind: 'translation', locationInDiagram: { x: row.input.rect.x, y: row.input.rect.y }, ownerRotation: 0, textRotation: 0 },
      rawFit: { width: row.input.widthFit, height: row.input.heightFit },
      effectiveFit: { width: row.input.widthFit, height: row.input.heightFit }, indicatorSize: row.input.buttonSize });
    item.services.measureText = request => row.input.measurements[Math.min(request.pass, row.input.measurements.length - 1)];
    const prepared = prepareSelectionPointerResize([item], row.input.handle);
    let state = prepared.state;
    row.input.deltas.forEach((delta, index) => {
      const expected = row.actual[index], before = structuredClone(state);
      expect(state.targets[0].layout.textPanelRect).toEqual(expected.before.panel);
      const result = planSelectionPointerResize(prepared.original, state, { delta, modifiers: { shift: row.input.shift } });
      expect(result.ok).toBe(true);
      expect(state).toEqual(before);
      if (!result.ok) return;
      state = result.state;
      expect(state.targets[0].layout.ownerRect).toEqual(expected.after.rect);
      expect(state.targets[0].layout.textPanelRect).toEqual(expected.after.panel);
      expect(state.targets[0].layout.rawFit.width).toBe(expected.after.fit);
      expect(state.fitHotZone).toBe(expected.after.dbNv);
      expect(result.results[0].result.effects.filter(effect => compared.has(effect.name)))
        .toEqual(expected.events.filter(effect => compared.has(effect.name)));
    });
  });

  type MultipleRow = { input: { widthFit: boolean; heightFit: boolean; handle: SelectionPointerHandle;
    rects: SelectionLayoutInput['ownerRect'][]; panel: SelectionLayoutInput['textPanelRect']; buttonSize: number;
    measurements: { width: number; height: number }[]; deltas: { x: number; y: number }[];
    locked?: boolean[]; shift?: boolean };
    actual: { after: { id: string; rect: unknown; panel: unknown; fit: boolean }[];
      events: { name: string; index?: number; id?: string; rect?: unknown }[]; error: string | null }[] };
  const multiple = (sessions.cases as MultipleRow[]).filter(row => row.input.rects);
  it.each(multiple.map((row, index) => [index, row] as const))('multiple source session %i', (_index, row) => {
    const targets = row.input.rects.map((rect, index) => {
      const item = target(`selection${index}`, rect.x, row.input.widthFit);
      Object.assign(item.input, { ownerRect: rect, textPanelRect: row.input.panel,
        coordinateContext: { kind: 'translation', locationInDiagram: { x: rect.x, y: rect.y }, ownerRotation: 0, textRotation: 0 },
        rawFit: { width: row.input.widthFit, height: row.input.heightFit },
        effectiveFit: { width: row.input.widthFit, height: row.input.heightFit }, indicatorSize: row.input.buttonSize });
      item.services.measureText = () => row.input.measurements[0];
      return { ...item, locked: row.input.locked?.[index] };
    });
    const prepared = prepareSelectionPointerResize(targets, row.input.handle);
    let state = prepared.state;
    row.input.deltas.forEach((delta, index) => {
      const expected = row.actual[index], before = structuredClone(state);
      expect(expected.error).toBeNull();
      const result = planSelectionPointerResize(prepared.original, state, { delta, modifiers: { shift: row.input.shift } });
      expect(result.ok).toBe(true);
      expect(state).toEqual(before);
      if (!result.ok) return;
      state = result.state;
      expect(state.targets.map(t => ({ id: t.id, rect: t.layout.ownerRect, panel: t.layout.textPanelRect, fit: t.layout.rawFit.width })))
        .toEqual(expected.after);
      const requested = expected.events.filter(e => e.name === 'INw2.result');
      expect(result.trace.filter(t => !t.skipped).map(t => ({ id: t.id, rect: t.requested })))
        .toEqual(requested.map(e => ({ id: e.id, rect: e.rect })));
      // The source harness numbers all widgets' measurement calls globally;
      // production services number each target independently. Compare the
      // complete ordered layout payloads apart from this diagnostic index.
      const comparable = (events: { name: string; index?: number }[]) => events.filter(e => compared.has(e.name))
        .map(({ index: _index, ...event }) => event);
      expect(comparable(result.results.flatMap(t => t.result.effects))).toEqual(comparable(expected.events));
    });
  });

  type NumericRow = { input: { angle: number; handle: 1 | 4; rect: SelectionLayoutInput['ownerRect']; delta: { x: number; y: number } };
    actual: { rect: unknown } };
  const numeric = JSON.parse(readFileSync('research/selection-pointer-numeric-probes.json', 'utf8'));
  const zeroAngle = (numeric.cases as NumericRow[]).filter(row => row.input.angle === 0);
  it.each(zeroAngle.map((row, index) => [index, row] as const))('single obN4 numeric source %i', (_index, row) => {
    const item = target(); item.input.ownerRect = row.input.rect;
    item.input.coordinateContext.locationInDiagram = { x: row.input.rect.x, y: row.input.rect.y };
    const prepared = prepareSelectionPointerResize([item], row.input.handle);
    const result = planSelectionPointerResize(prepared.original, prepared.state, { delta: row.input.delta });
    expect(result.trace[0].requested).toEqual(row.actual.rect);
    // Native obN4 permits an owner narrower than its indicator. The bounded
    // text planner rejects negative available panel widths after that request.
    if ((row.actual.rect as { width: number }).width < item.input.indicatorSize) {
      expect(result.ok).toBe(false);
      expect(result).not.toHaveProperty('results');
    } else expect(result.ok).toBe(true);
  });
});

describe('selection pointer product safety and isolation', () => {
  it('supports an opaque zero panel for locked targets without consulting their measurement services', () => {
    const a = { ...target('a', 0, true), locked: true }, b = target('b', 300);
    a.input.textPanelRect = { x: 0, y: 0, width: 0, height: 0 };
    const unexpected = vi.fn((): never => { throw Error('Locked target service was called'); });
    a.services = { measureText: unexpected, readMinimumSize: unexpected, convertIndicatorInset: unexpected, unionRectangles: unexpected };
    const prepared = prepareSelectionPointerResize([a, b], 4);
    const result = planSelectionPointerResize(prepared.original, prepared.state, { delta: { x: 100, y: 0 } });
    expect(result.ok).toBe(true); expect(unexpected).not.toHaveBeenCalled();
    if (!result.ok) return;
    expect(result.state.targets[0]).toEqual(prepared.state.targets[0]);
    expect(result.state.targets[1].layout.ownerRect).toEqual({ x: 375, y: 30, width: 125, height: 15 });
  });

  it('preserves each selected control size in a shared twenty-percent source projection', () => {
    const targets = [target('a', 100), target('b', 450)];
    targets.forEach((t, i) => {
      t.input.ownerRect = { x: i ? 450 : 100, y: 100, width: i ? 180 : 240, height: 20 };
      t.input.coordinateContext.locationInDiagram = { x: t.input.ownerRect.x, y: 100 };
      t.input.indicatorSize = 14;
      t.input.textPanelRect = { x: 14, y: 0, width: t.input.ownerRect.width - 14, height: 20 };
      t.services.measureText = () => ({ width: 80, height: 20 });
    });
    const prepared = prepareSelectionPointerResize(targets, 4);
    const result = planSelectionPointerResize(prepared.original, prepared.state, { delta: { x: 106, y: 0 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.targets.map(t => t.layout.ownerRect)).toEqual([
      { x: 100, y: 100, width: 288, height: 20 }, { x: 520, y: 100, width: 216, height: 20 },
    ]);
  });

  it('applies ordered current-view effects incrementally while preserving parent, sibling, inactive and raw content', () => {
    const doc = createDocument(), page = createPage('Pointer persistence'), widget = createWidget('checkbox', 20, 30);
    widget.width = 100; widget.height = 20;
    widget.text = 'Preserved'; widget.selectionText = { autoFitWidth: true, autoFitHeight: false, alignRight: false };
    page.widgets = [widget]; doc.pages = [page];
    page.adaptiveViews = [
      { id: 'parent', name: 'Parent', width: 700, overrides: { [widget.id]: { x: 30, width: 110, style: { color: '#123456' } } } },
      { id: 'current', name: 'Current', width: 390, baseViewId: 'parent', overrides: { [widget.id]: { x: 40, width: 120, hidden: true } } },
      { id: 'sibling', name: 'Sibling', width: 500, overrides: { [widget.id]: { width: 150 } } },
    ];
    page.adaptiveOverrides = { orphan: { [widget.id]: { x: 80, width: 160, style: { color: '#abcdef' } } } };
    const baseline = serializeDocument(doc), item = target(widget.id, 40, true);
    item.input.ownerRect.width = 120;
    const prepared = prepareSelectionPointerResize([item], 1);
    let state = prepared.state, candidate = page;
    for (const dx of [-20, 0, -40]) {
      const result = planSelectionPointerResize(prepared.original, state, { delta: { x: dx, y: 0 } });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
      candidate = applySelectionAuthorEffects(candidate, 'current', widget.id, result.results[0].result);
    }
    expect(candidate.adaptiveViews[1].overrides[widget.id]).toEqual({ x: 0, y: 30, width: 160, height: 15, hidden: true });
    expect(candidate.adaptiveViews[0]).toEqual(page.adaptiveViews[0]);
    expect(candidate.adaptiveViews[2]).toEqual(page.adaptiveViews[2]);
    expect(candidate.adaptiveOverrides).toEqual(page.adaptiveOverrides);
    expect(candidate.widgets[0]).toEqual({ ...widget, selectionText: { ...widget.selectionText, autoFitWidth: false } });
    expect(serializeDocument(doc)).toBe(baseline);
    const next = { ...doc, pages: [candidate] };
    expect(parseDocument(serializeDocument(next))).toEqual(next);
    expect(serializeDocument(parseDocument(baseline))).toBe(baseline);
  });
  it('rejects mixed types before preparing a partial gesture', () => {
    expect(() => prepareSelectionPointerResize([target(), { ...target('b', 200), type: 'box' as 'checkbox' }], 4))
      .toThrow(/separately/);
  });
  it('preserves locked roots in the shared selection bounds but does not change their state', () => {
    const a = { ...target('a', 0), locked: true }, b = target('b', 300);
    const prepared = prepareSelectionPointerResize([a, b], 4);
    const result = planSelectionPointerResize(prepared.original, prepared.state, { delta: { x: 100, y: 0 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.targets[0]).toEqual(prepared.state.targets[0]);
    expect(result.results[0].result.effects).toEqual([]);
    expect(result.state.targets[1].layout.ownerRect.x).toBe(375);
    expect(result.state.targets[1].layout.ownerRect.width).toBe(125);
  });
  it.each([{ delta: { x: NaN, y: 0 } }, { delta: { x: 20, y: 0 }, modifiers: { control: true } },
    { delta: { x: 20, y: 0 }, modifiers: { alt: true } },
    { delta: { x: 20, y: 0 }, modifiers: { control: true, alt: true, shift: true } }])
    ('rejects unsafe/unproved input without mutating state', request => {
      const prepared = prepareSelectionPointerResize([target()], 4), before = structuredClone(prepared.state);
      const result = planSelectionPointerResize(prepared.original, prepared.state, request);
      expect(result.ok).toBe(false);
      expect(result).not.toHaveProperty('state');
      expect(prepared.state).toEqual(before);
    });
});

describe('native hInw modifier sampling and per-frame aspect gate', () => {
  type NativeState = { id?: string; rect: SelectionLayoutInput['ownerRect']; panel: SelectionLayoutInput['textPanelRect'];
    fit: boolean; dbNv?: boolean };
  type NativeCase = { name: string; input: { rect?: SelectionLayoutInput['ownerRect']; rects?: SelectionLayoutInput['ownerRect'][];
    widthFit: boolean; heightFit: boolean; handle: SelectionPointerHandle; panel: SelectionLayoutInput['textPanelRect'];
    buttonSize: number; measurements: { width: number; height: number }[]; locked?: boolean[];
    keyMasks: number[]; deltas: { x: number; y: number }[] };
    actual: { before: NativeState | NativeState[]; after: NativeState | NativeState[];
      events: { name: string; index?: number; id?: string; rect?: unknown }[]; error: string | null }[] };
  const source = JSON.parse(readFileSync('research/selection-pointer-modifiers-probes.json', 'utf8'));
  // The native hInw call itself accepts Ctrl/Alt masks, but their upstream
  // delta/start behavior is not closed here. Do not treat that downstream
  // observation as authorization to silently ignore them in the product.
  const supported = (source.cases as NativeCase[]).filter(row => row.input.keyMasks.every(mask => (mask & (131072 | 262144)) === 0));
  const compared = new Set(['OI8Z.enter', 'guard', 'YJ0S.request', 'uJ0j.request', 'style.Size', 'style.Location',
    'measure', 'graphics.measure', 'panel.rect', 'panel.invalidate', 'panel.measured', 'WIyL', 'graphics.convert-size',
    'indicator.rect', 'NJ01', 'DJ0E', 'size.changed', 'location.changed', 'finally.dispose']);

  it.each(supported.map((row, index) => [index, row] as const))('hInw continuous native scenario %i', (_index, row) => {
    const multi = Boolean(row.input.rects), frames = row.input.rects ?? [row.input.rect!];
    const targets = frames.map((rect, index) => {
      const item = target(multi ? `selection${index}` : 'selection', rect.x, row.input.widthFit);
      Object.assign(item.input, { ownerRect: rect, textPanelRect: row.input.panel,
        coordinateContext: { kind: 'translation', locationInDiagram: { x: rect.x, y: rect.y }, ownerRotation: 0, textRotation: 0 },
        rawFit: { width: row.input.widthFit, height: row.input.heightFit },
        effectiveFit: { width: row.input.widthFit, height: row.input.heightFit }, indicatorSize: row.input.buttonSize });
      item.services.measureText = request => row.input.measurements[Math.min(request.pass, row.input.measurements.length - 1)];
      return { ...item, locked: row.input.locked?.[index] };
    });
    const prepared = prepareSelectionPointerResize(targets, row.input.handle);
    let state = prepared.state;
    row.input.deltas.forEach((delta, frameIndex) => {
      const expected = row.actual[frameIndex], before = structuredClone(state);
      expect(expected.error).toBeNull();
      const result = planSelectionPointerResize(prepared.original, state, { delta,
        modifiers: { shift: Boolean(row.input.keyMasks[frameIndex] & 65536) } });
      expect(result.ok).toBe(true); expect(state).toEqual(before);
      if (!result.ok) return;
      state = result.state;
      const nativeAfter = Array.isArray(expected.after) ? expected.after : [expected.after];
      expect(state.targets.map(t => ({ rect: t.layout.ownerRect, panel: t.layout.textPanelRect, fit: t.layout.rawFit.width })))
        .toEqual(nativeAfter.map(({ rect, panel, fit }) => ({ rect, panel, fit })));
      if (!multi) expect(state.fitHotZone).toBe(nativeAfter[0].dbNv);
      const requests = expected.events.filter(e => e.name === (multi ? 'INw2.result' : 'obN4.result'));
      expect(result.trace.filter(t => !t.skipped).map(t => t.requested)).toEqual(requests.map(e => e.rect));
      const comparable = (events: { name: string; index?: number }[]) => events.filter(e => compared.has(e.name))
        .map(({ index, ...event }) => multi ? event : { ...event, ...(index === undefined ? {} : { index }) });
      expect(comparable(result.results.flatMap(t => t.result.effects))).toEqual(comparable(expected.events));
    });
  });

  it('retains the accepted live state when a later target fails during a Shift transition', () => {
    const a = target('a', 0, true), b = target('b', 300, true);
    let fail = false;
    b.services.measureText = () => { if (fail) throw Error('Shift frame measurement failed'); return { width: 60, height: 15 }; };
    const prepared = prepareSelectionPointerResize([a, b], 4);
    const first = planSelectionPointerResize(prepared.original, prepared.state, { delta: { x: 100, y: 0 } });
    expect(first.ok).toBe(true); if (!first.ok) return;
    const saved = structuredClone(first.state);
    fail = true;
    const failure = planSelectionPointerResize(prepared.original, first.state, { delta: { x: 100, y: 0 }, modifiers: { shift: true } });
    expect(failure.ok).toBe(false); expect(failure).not.toHaveProperty('results'); expect(failure).not.toHaveProperty('state');
    expect(first.state).toEqual(saved);
    fail = false;
    const retry = planSelectionPointerResize(prepared.original, first.state, { delta: { x: 100, y: 0 }, modifiers: { shift: true } });
    expect(retry.ok).toBe(true); expect(first.state).toEqual(saved);
    if (!retry.ok) return;
    expect(retry.state.targets.every(t => t.layout.rawFit.width === false)).toBe(true);
    expect(retry.trace.map(t => t.requested)).toEqual([
      { x: 0, y: 27.5, width: 125, height: 25 }, { x: 375, y: 27.5, width: 125, height: 25 },
    ]);
  });
});
