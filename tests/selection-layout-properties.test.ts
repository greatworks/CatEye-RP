import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  planSelectionLayout, type SelectionLayoutInput, type SelectionLayoutServices,
} from '../src/model/selection-layout';

function input(patch: Partial<SelectionLayoutInput> = {}): SelectionLayoutInput {
  return {
    ownerRect: { x: 20, y: 30, width: 100, height: 20 },
    textPanelRect: { x: 0, y: 0, width: 50, height: 15 },
    coordinateContext: { kind: 'translation', locationInDiagram: { x: 20, y: 30 }, ownerRotation: 0, textRotation: 0 },
    rawFit: { width: false, height: false }, effectiveFit: { width: false, height: false },
    alignRight: false, empty: false, guard: false, padding: [0, 0, 0, 0], indicatorSize: 13,
    horizontalAlignment: 'left', verticalAlignment: 'top', ...patch,
  };
}
const changed = (changedKeys: number[], notify = true, contained = false) =>
  ({ kind: 'styleChanged' as const, changedKeys, notify, contained });
function services(): SelectionLayoutServices {
  return {
    measureText: vi.fn(() => ({ width: 60, height: 15 })),
    readMinimumSize: () => ({ width: 0, height: 0 }),
    convertIndicatorInset: () => ({ width: 2, height: 2 }),
    unionRectangles(a, b) {
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x,
        height: Math.max(a.y + a.height, b.y + b.height) - y };
    },
  };
}

describe('selection style-change notification gates', () => {
  // These four retained entry cases never call BNZT. The other old MIue
  // cases stubbed its panel refresh and are not full-refresh geometry oracles.
  const retained = JSON.parse(readFileSync('research/selection-layout-transaction-probes.json', 'utf8'));
  const gates = retained.cases.filter((row: { input: Record<string, unknown> }) => row.input.entry === 'styleChanged'
    && (row.input.notify === false || row.input.guarded || row.input.suppressStyleLayout
      || JSON.stringify(row.input.keys) === '[101]')) as {
        input: { keys: number[]; notify?: boolean; guarded?: boolean; suppressStyleLayout?: boolean };
        actual: { rect: unknown; panel: unknown; events: unknown[]; measures: number };
      }[];
  it.each(gates.map((row, index) => [index, row] as const))('retained blocked MIue branch %i', (_index, row) => {
    const before = input({ guard: !!row.input.guarded });
    const result = planSelectionLayout(before, changed(row.input.keys, row.input.notify !== false,
      !!row.input.suppressStyleLayout), services());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ownerRect).toEqual(row.actual.rect);
    expect(result.state.textPanelRect).toEqual(row.actual.panel);
    expect(result.effects).toEqual(row.actual.events);
    expect(result.measurementPasses).toBe(row.actual.measures);
    expect(result.state.guard).toBe(before.guard);
  });

  it('performs P94 expansion before notify, contained and recursion gates', () => {
    const before = input({ indicatorSize: 150, guard: true });
    const original = structuredClone(before), service = services();
    const result = planSelectionLayout(before, changed([94], false, true), service);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ownerRect).toEqual({ x: 20, y: 30, width: 200, height: 20 });
    expect(result.state.textPanelRect).toEqual(before.textPanelRect);
    expect(result.state.guard).toBe(true);
    expect(service.measureText).not.toHaveBeenCalled();
    expect(result.effects.filter(effect => effect.name === 'style.Size')).toEqual([
      { name: 'style.Size', width: 200, height: 20, allViews: false, notify: true },
    ]);
    expect(result.effects.find(effect => effect.name === 'OI8Z.enter')).toEqual({ name: 'OI8Z.enter', force: true, alreadyGuarded: true });
    expect(result.effects.at(-1)).toEqual({ name: 'style.changed.base' });
    expect(before).toEqual(original);
  });

  it('uses the old panel for the P94 request, then lets the Size validator apply current fit and padding', () => {
    const before = input({ indicatorSize: 150, guard: true, padding: [2, 7, 3, 5],
      rawFit: { width: true, height: false }, effectiveFit: { width: true, height: false } });
    const result = planSelectionLayout(before, changed([94], false), services());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.effects.find(effect => effect.name === 'uJ0j.request')).toEqual({
      name: 'uJ0j.request', width: 200, height: 20, guard: true,
    });
    expect(result.state.ownerRect).toEqual({ x: 20, y: 30, width: 212, height: 20 });
    expect(result.measurementPasses).toBe(0);
  });

  it('withholds a P94 partial Size write when its own preflight layout measurement throws', () => {
    const before = input({ indicatorSize: 150 }), original = structuredClone(before), service = services();
    service.measureText = () => { throw Error('P94 measurement failure'); };
    const result = planSelectionLayout(before, changed([94], false, true), service);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('P94 measurement failure');
    expect(result).not.toHaveProperty('state');
    expect(result.diagnosticPartialState?.ownerRect).toEqual({ x: 20, y: 30, width: 200, height: 20 });
    expect(result.diagnosticPartialState?.guard).toBe(false);
    expect(result.effects.at(-2)).toEqual({ name: 'finally.dispose' });
    expect(result.effects.at(-1)).toEqual({ name: 'guard', value: false });
    expect(before).toEqual(original);
  });

  it.each([
    ['empty text', { empty: true, indicatorSize: 150 }, [94]],
    ['equal owner width', { indicatorSize: 100 }, [94]],
    ['smaller indicator', { indicatorSize: 20 }, [94]],
    ['unrelated property', { indicatorSize: 150 }, [2]],
  ] as const)('does not preflight-expand for %s', (_name, patch, keys) => {
    const before = input(patch), result = planSelectionLayout(before, changed([...keys], false), services());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ownerRect).toEqual(before.ownerRect);
    expect(result.effects).toEqual([{ name: 'style.changed.base' }]);
  });

  it('rejects an empty-text negative panel atomically instead of copying the native negative-size result', () => {
    const before = input({ empty: true, indicatorSize: 150 }), original = structuredClone(before);
    const result = planSelectionLayout(before, changed([94]), services());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/nonnegative/);
    expect(result).not.toHaveProperty('state');
    expect(result.diagnosticPartialState?.guard).toBe(false);
    expect(result.effects.some(effect => effect.name === 'style.changed.base')).toBe(false);
    expect(before).toEqual(original);
  });
});

describe('selection property refresh through the retained BNZT panel chain', () => {
  const source = JSON.parse(readFileSync('research/selection-author-properties-probes.json', 'utf8'));
  type Row = {
    input: { entry: string; keys: number[]; notify?: boolean; editingText?: boolean;
      panelChangeGuard?: boolean; widthFit?: boolean; heightFit?: boolean };
    actual: { rect: unknown; panel: unknown; guard: boolean; measures: number;
      events: { name: string; [key: string]: unknown }[] };
  };
  const rows: Row[] = source.cases.filter((row: Row & { name: string }) =>
    ['Style refresh gates and force order', 'Changed-key gate'].includes(row.name));
  it.each(rows.map((row, index) => [index, row] as const))('full retained property transaction %i', (_index, row) => {
    const fit = { width: !!row.input.widthFit, height: !!row.input.heightFit };
    const before = input({ rawFit: fit, effectiveFit: fit, editingText: !!row.input.editingText,
      panelChangeGuard: !!row.input.panelChangeGuard });
    const original = structuredClone(before), service = services();
    service.readEditorHeight = () => 19.25;
    const result = planSelectionLayout(before, changed(row.input.keys, row.input.notify !== false), service);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ownerRect).toEqual(row.actual.rect);
    expect(result.state.textPanelRect).toEqual(row.actual.panel);
    expect(result.state.guard).toBe(row.actual.guard);
    expect(result.measurementPasses).toBe(row.actual.measures);
    // Minimum getters are explicit product services, whereas this source
    // fixture supplies a zero minimum sink without recording those reads.
    expect(result.effects.filter(effect => effect.name !== 'minimum.read')).toEqual(row.actual.events);
    expect(result.effects.some(effect => effect.name === 'VJm0')).toBe(false);
    expect(before).toEqual(original);
  });

  it('does not collapse duplicate Location keys into the singleton suppression case', () => {
    const result = planSelectionLayout(input(), changed([101, 101]), services());
    expect(result.ok).toBe(true);
    expect(result.effects.filter(effect => effect.name === 'OI8Z.enter' && !effect.alreadyGuarded)
      .map(effect => effect.force)).toEqual([true, false]);
  });

  it('uses distinct graphics answers across forced fit and the subsequent false refresh', () => {
    const before = input({ rawFit: { width: true, height: true }, effectiveFit: { width: true, height: true } });
    const service = services();
    service.measureText = vi.fn().mockReturnValueOnce({ width: 60.4, height: 15.4 })
      .mockReturnValueOnce({ width: 70.5, height: 18.5 }).mockReturnValue({ width: 80.5, height: 21.5 });
    const result = planSelectionLayout(before, changed([2]), service);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.measurementPasses).toBe(3);
    expect(result.state.textPanelRect).toEqual({ x: 13, y: 0, width: 81, height: 22 });
    expect(result.state.ownerRect).toEqual({ x: 20, y: 30, width: 94, height: 22 });
    expect(service.measureText).toHaveBeenCalledTimes(3);
  });

  it('cleans the owner guard and withholds all writes if the outer refresh fails after BNZT changed Size', () => {
    const before = input(), original = structuredClone(before), service = services();
    service.measureText = vi.fn().mockReturnValueOnce({ width: 60, height: 15 })
      .mockImplementationOnce(() => { throw Error('outer refresh failed'); });
    const result = planSelectionLayout(before, changed([2]), service);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('outer refresh failed');
    expect(result).not.toHaveProperty('state');
    expect(result.diagnosticPartialState?.ownerRect.height).toBe(15);
    expect(result.diagnosticPartialState?.guard).toBe(false);
    expect(result.effects.some(effect => effect.name === 'style.changed.base')).toBe(false);
    expect(before).toEqual(original);
  });

  it.each([NaN, Infinity, -1, .5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid property key %s before writes', key => {
    const result = planSelectionLayout(input(), changed([key]), services());
    expect(result.ok).toBe(false);
    expect(result.effects).toEqual([]);
  });
});

describe('P94 and multi-pass failure source transactions', () => {
  type Row = {
    name: string;
    input: { keys: number[]; buttonSize?: number; guarded?: boolean; notify?: boolean;
      suppressStyleLayout?: boolean; widthFit?: boolean; heightFit?: boolean;
      padding?: [number, number, number, number]; measurements?: { width: number; height: number }[];
      throwAtMeasure?: number };
    actual: { rect: unknown; panel: unknown; guard: boolean; measures: number;
      events: { name: string }[]; error: string | null };
  };
  const rows: Row[] = JSON.parse(readFileSync('research/selection-properties-model-source-fixtures.json', 'utf8')).cases;
  it.each(rows.map(row => [row.name, row] as const))('%s', (_name, row) => {
    const fit = { width: !!row.input.widthFit, height: !!row.input.heightFit };
    const before = input({ rawFit: fit, effectiveFit: fit, guard: !!row.input.guarded,
      indicatorSize: row.input.buttonSize ?? 13, padding: row.input.padding ?? [0, 0, 0, 0] });
    const original = structuredClone(before), service = services();
    service.measureText = request => {
      if (request.pass === row.input.throwAtMeasure) throw Error('Injected graphics measurement error');
      const samples = row.input.measurements;
      return samples?.[Math.min(request.pass, samples.length - 1)] ?? { width: 60, height: 15 };
    };
    const result = planSelectionLayout(before, changed(row.input.keys, row.input.notify !== false,
      !!row.input.suppressStyleLayout), service);
    expect(result.ok).toBe(!row.actual.error);
    const state = result.ok ? result.state : result.diagnosticPartialState!;
    expect(state.ownerRect).toEqual(row.actual.rect);
    expect(state.textPanelRect).toEqual(row.actual.panel);
    expect(state.guard).toBe(row.actual.guard);
    expect(result.measurementPasses).toBe(row.actual.measures);
    // The retained test throws before entering its graphics sink; this adapter
    // throws inside the explicit service, after recording the attempted call.
    // Compare every remaining event, including both finally/guard transitions.
    expect(result.effects.filter(effect => effect.name !== 'minimum.read' &&
      !(effect.name === 'graphics.measure' && effect.index === row.input.throwAtMeasure))).toEqual(row.actual.events);
    if (!result.ok) {
      expect(result.reason).toBe(row.actual.error);
      expect(result).not.toHaveProperty('state');
    }
    expect(before).toEqual(original);
  });
});

describe('selection text-change layout tail after host text synchronization', () => {
  const source = JSON.parse(readFileSync('research/selection-author-properties-probes.json', 'utf8'));
  type Row = { input: { entry: string; overridden?: boolean; panelChangeGuard?: boolean };
    actual: { rect: unknown; panel: unknown; measures: number; events: { name: string; flag?: boolean;
      keys?: null; [key: string]: unknown }[] } };
  const rows: Row[] = source.cases.filter((row: Row & { name: string }) =>
    row.name === 'Text mutation entry and suppression scope' && !row.input.overridden);
  it.each(rows.map((row, index) => [index, row] as const))('retained text tail %i', (_index, row) => {
    const before = input({ panelChangeGuard: !!row.input.panelChangeGuard }), original = structuredClone(before);
    const result = planSelectionLayout(before, { kind: 'textChanged' }, services());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.ownerRect).toEqual(row.actual.rect);
    expect(result.state.textPanelRect).toEqual(row.actual.panel);
    expect(result.measurementPasses).toBe(row.actual.measures);
    const start = row.actual.events.findIndex(event => event.name === 'panel.style-refresh');
    expect(start).toBeGreaterThanOrEqual(0);
    const tail = row.actual.events.slice(start).map(event => event.name === 'owner.VJm0'
      ? { name: 'VJm0', value: event.flag, property: event.keys } : event);
    expect(result.effects.filter(effect => effect.name !== 'minimum.read')).toEqual(tail);
    expect(before).toEqual(original);
  });

  it('still notifies after an already-guarded text tail without running graphics', () => {
    const service = services(), result = planSelectionLayout(input({ guard: true }), { kind: 'textChanged' }, service);
    expect(result.ok).toBe(true);
    expect(service.measureText).not.toHaveBeenCalled();
    expect(result.effects).toEqual([
      { name: 'panel.style-refresh', notify: false },
      { name: 'OI8Z.enter', force: true, alreadyGuarded: true },
      { name: 'VJm0', value: false, property: null },
    ]);
  });

  it('does not notify or expose a candidate when text-tail measurement fails', () => {
    const service = services();
    service.measureText = () => { throw Error('text measurement failed'); };
    const result = planSelectionLayout(input(), { kind: 'textChanged' }, service);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('text measurement failed');
    expect(result.diagnosticPartialState?.guard).toBe(false);
    expect(result).not.toHaveProperty('state');
    expect(result.effects.some(effect => effect.name === 'VJm0')).toBe(false);
  });
});
