import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prepareSelectionPointerInput, planSelectionPointerInput, selectionPointerHotzonePoint,
  selectionPointerBounds, selectionPointerCandidate, selectionPointerGridCorrection } from '../src/model/selection-pointer-input';
import { prepareSelectionPointerResize, planSelectionPointerResize,
  type SelectionPointerTarget, type SelectionPointerHandle } from '../src/model/selection-pointer-resize';

const modifiers = (mask: number) => ({ shift: Boolean(mask & 65536), control: Boolean(mask & 131072), alt: Boolean(mask & 262144) });
const source = JSON.parse(readFileSync('research/selection-input-keys-probes.json', 'utf8').replace(/^\uFEFF/, ''));
const gridSource = JSON.parse(readFileSync('research/selection-input-grid-probes.json', 'utf8').replace(/^\uFEFF/, ''));
const currentBounds = { x: 100, y: 100, width: 240, height: 40 };
const initialHotzonePoint = { x: 340, y: 120 };
function prepare(targetCount = 1, mask = 0) {
  return prepareSelectionPointerInput({ targetCount, handle: 4, freedom: 1,
    initialModifiers: modifiers(mask), initialHotzonePoint,
    grid: { enabled: false, spacing: { width: 8, height: 8 }, tolerance: 5 } });
}
function numeric(actual: unknown, expected: any, label = '') {
  if (typeof expected === 'number') {
    expect(typeof actual, label).toBe('number');
    expect(Math.abs(Number(actual) - expected), label).toBeLessThanOrEqual(1e-8);
  } else if (expected && typeof expected === 'object') {
    for (const key of Object.keys(expected)) numeric((actual as any)?.[key], expected[key], `${label}.${key}`);
  } else expect(actual, label).toEqual(expected);
}

describe('source-record grid candidate and correction', () => {
  it('matches all 896 retained xFY0 candidates, including crossing and Shift branches', () => {
    const cases = gridSource.results.filter((item: any) => item.name.startsWith('candidate '));
    expect(cases).toHaveLength(896);
    for (const { input, actual, name } of cases) numeric(selectionPointerCandidate(input.currentBounds,
      input.point, input.handle, input.freedom, input.shift), actual.rect, name);
  });

  it('matches 768 retained grid corrections and all six inclusive tolerance boundaries', () => {
    const cases = gridSource.results.filter((item: any) => /^(grid |threshold )/.test(item.name));
    expect(cases).toHaveLength(774);
    for (const { input, actual, name } of cases) {
      const handle = input.handle ?? 4;
      const anchor = input.anchor ?? ((handle & 1 ? 4 : 0) | (handle & 4 ? 1 : 0) | (handle & 2 ? 8 : 0) | (handle & 8 ? 2 : 0));
      numeric(selectionPointerGridCorrection(input.rect, anchor, { enabled: true, spacing: input.grid ?? { width: 8, height: 8 },
        tolerance: (input.toleranceDevice ?? 5) / (input.zoom ?? 1) }, input.shift ?? false), actual.correction, name);
    }
  });

  it('matches every original hot-zone anchor at each recorded zoom', () => {
    const cases = gridSource.results.filter((item: any) => item.name.startsWith('logical hotzone '));
    expect(cases).toHaveLength(64);
    for (const { input, actual, name } of cases)
      numeric(selectionPointerHotzonePoint(input.currentBounds, input.handle), actual.start, name);
  });

  it('matches the 18 original input-entry and live-geometry records', () => {
    const cases = gridSource.results.filter((item: any) => /^(entry |live frame )/.test(item.name));
    expect(cases).toHaveLength(18);
    for (const { input, actual, name } of cases) {
      const original = prepareSelectionPointerInput({ targetCount: 2, handle: input.handle, freedom: input.freedom ?? 3,
        initialModifiers: modifiers(0), initialHotzonePoint: input.start,
        grid: { enabled: input.gridEnabled !== false, spacing: input.grid ?? { width: 8, height: 8 },
          tolerance: (input.toleranceDevice ?? 5) / (input.zoom ?? 1) } });
      const output = planSelectionPointerInput(original, { currentBounds: input.currentBounds,
        absolutePoint: input.point, modifiers: { shift: input.shift ?? false, control: false, alt: input.alt ?? false } });
      expect(output.ok, name).toBe(true);
      if (!output.ok) throw Error(output.reason);
      numeric(output.delta, actual.delta, name);
      numeric(output.trace.correction, actual.correction, name);
      expect(output.trace.candidate ?? null, name).toEqual(actual.candidate);
    }
  });

  it('snaps absolute edges and leaves orthogonal corrections for the layout freedom gate', () => {
    const original = prepareSelectionPointerInput({ ...prepare(), initialHotzonePoint: { x: 341, y: 119.5 },
      grid: { enabled: true, spacing: { width: 8, height: 8 }, tolerance: 5 } });
    const output = planSelectionPointerInput(original, { currentBounds: { ...currentBounds, x: 101 },
      absolutePoint: { x: 362, y: 119.5 }, modifiers: modifiers(0) });
    expect(output).toMatchObject({ ok: true, rawDelta: { x: 21, y: 0 }, delta: { x: 19, y: 4 },
      trace: { candidate: { x: 101, y: 100, width: 261, height: 40 }, correction: { x: -2, y: 4 } } });
  });

  it('does not silently discard the native no-candidate sentinel', () => {
    const sentinel = { x: -100000, y: -100000, width: 200000, height: 200000 };
    const original = prepareSelectionPointerInput({ ...prepare(), grid: { enabled: true,
      spacing: { width: 7, height: 11 }, tolerance: 5 } });
    const output = planSelectionPointerInput(original, { currentBounds, absolutePoint: { x: 90, y: 119.5 }, modifiers: modifiers(0) });
    expect(output).toMatchObject({ ok: true, trace: { candidate: sentinel, correction: { x: 2, y: 1 } } });
  });

  it('rejects a nonfinite direct grid carrier without changing the captured input', () => {
    const original = prepareSelectionPointerInput({ targetCount: 2, handle: 6, freedom: 3,
      initialModifiers: modifiers(0), initialHotzonePoint: { x: 340, y: 100 },
      grid: { enabled: true, spacing: { width: 8, height: 8 }, tolerance: 5 } });
    const before = structuredClone(original);
    // Direct degenerate grid carriers are a product rejection boundary, not a
    // claim that the native source itself rejects or rolls back these values.
    expect(() => selectionPointerGridCorrection({ x: 100, y: 100, width: 0, height: 40 }, 3,
      { ...original.grid, tolerance: 0 }, true)).toThrow(/finite/i);
    expect(original).toEqual(before);
  });

  it('does not retain a pointer-down offset inside the handle hit box', () => {
    const original = prepareSelectionPointerInput({ ...prepare(), initialHotzonePoint: selectionPointerHotzonePoint(currentBounds, 4) });
    // Press at x343, then move 20: native origin remains logical x340.
    expect(planSelectionPointerInput(original, { currentBounds, absolutePoint: { x: 363, y: 119.5 },
      modifiers: modifiers(0) })).toMatchObject({ ok: true, delta: { x: 23, y: 0 } });
  });
});

describe('input consumption composes with the existing selection layout boundary', () => {
  function target(): SelectionPointerTarget {
    return { id: 'selection', type: 'checkbox', input: {
      ownerRect: { ...currentBounds }, textPanelRect: { x: 14, y: 0, width: 100, height: 20 },
      coordinateContext: { kind: 'translation', locationInDiagram: { x: 100, y: 100 }, ownerRotation: 0, textRotation: 0 },
      rawFit: { width: false, height: false }, effectiveFit: { width: false, height: false }, alignRight: false,
      empty: false, guard: false, padding: [0, 0, 0, 0], indicatorSize: 14,
      horizontalAlignment: 'left', verticalAlignment: 'top',
    }, services: { measureText: () => ({ width: 80, height: 20 }), readMinimumSize: () => ({ width: 1, height: 1 }),
      convertIndicatorInset: () => ({ width: 2, height: 2 }), unionRectangles: (a, b) => {
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
        return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x,
          height: Math.max(a.y + a.height, b.y + b.height) - y };
      } } };
  }

  it.each([{ mask: 131072, width: 260 }, { mask: 262144, width: 261 }, { mask: 458752, width: 261 }])(
    'consumes input keys $mask without opening the direct layout modifier guard', ({ mask, width }) => {
      const prepared = prepareSelectionPointerResize([target()], 4);
      expect(planSelectionPointerResize(prepared.original, prepared.state, { delta: { x: 21, y: 0 },
        modifiers: modifiers(mask) }).ok).toBe(false);
      const original = prepareSelectionPointerInput({ targetCount: 1, handle: 4, freedom: prepared.original.freedom,
        initialModifiers: modifiers(mask), initialHotzonePoint: selectionPointerHotzonePoint(currentBounds, 4),
        grid: { enabled: true, spacing: { width: 8, height: 8 }, tolerance: 5 } });
      const input = planSelectionPointerInput(original, { currentBounds,
        absolutePoint: { x: 361, y: 119.5 }, modifiers: modifiers(mask) });
      expect(input.ok).toBe(true);
      if (!input.ok) throw Error(input.reason);
      const output = planSelectionPointerResize(prepared.original, prepared.state, { delta: input.delta, modifiers: input.layoutModifiers });
      expect(output.ok).toBe(true);
      if (!output.ok) throw Error(output.reason);
      expect(output.state.targets[0].layout.ownerRect).toEqual({ x: 100, y: 100, width, height: 20 });
      expect(output.results[0].result.effects.filter(effect => effect.name === 'style.Size'))
        .toEqual(expect.arrayContaining([expect.objectContaining({ allViews: false })]));
      expect(prepared.state.targets[0].layout.ownerRect).toEqual(currentBounds);
    });
});

describe('selection input captures native controller mode before consuming frame keys', () => {
  it('uses the source logical hot-zone point, including the half-unit side offset', () => {
    expect([1, 2, 3, 4, 6, 8, 9, 12].map(handle => selectionPointerHotzonePoint(currentBounds, handle as SelectionPointerHandle))).toEqual([
      { x: 100, y: 119.5 }, { x: 219.5, y: 100 }, { x: 100, y: 100 }, { x: 340, y: 119.5 },
      { x: 340, y: 100 }, { x: 219.5, y: 140 }, { x: 100, y: 140 }, { x: 340, y: 140 },
    ]);
  });

  it('unions the current owners without expanding negative coordinates to the origin', () => {
    const owners = [{ x: -300, y: -80, width: 60, height: 20 }, { x: -160, y: -40, width: 40, height: 15 }];
    const before = structuredClone(owners);
    expect(selectionPointerBounds(owners)).toEqual({ x: -300, y: -80, width: 180, height: 55 });
    expect(owners).toEqual(before);
    expect(() => selectionPointerBounds([])).toThrow(/at least one/i);
    expect(() => selectionPointerBounds([owners[0], { ...owners[1], width: 0 }])).toThrow(/positive/i);
  });

  it('matches every original press-mode observation, including Ctrl combinations', () => {
    const observations = source.cases.filter((item: any) => item.name === 'press-mode-and-continuous-modifiers');
    expect(observations).toHaveLength(128);
    for (const item of observations) {
      const original = prepare(item.input.count, item.input.startMask);
      expect(original.mode, JSON.stringify(item.input)).toBe(item.actual.down.mode === 2 ? 'rotate' : 'resize');
    }
  });

  it('does not reselect rotation when Ctrl changes during an admitted resize gesture', () => {
    for (const mask of [0, 65536, 131072, 262144, 196608, 327680, 393216, 458752]) {
      const original = prepare(2);
      const output = planSelectionPointerInput(original, { absolutePoint: { x: 361, y: 127 },
        currentBounds, modifiers: modifiers(mask) });
      expect(output.ok).toBe(true);
      if (!output.ok) throw Error(output.reason);
      expect(output.delta).toEqual({ x: 21, y: 7 });
      expect(output.layoutModifiers).toEqual({ shift: Boolean(mask & 65536), control: false, alt: false });
      expect(output.trace.rawModifiers).toEqual(modifiers(mask));
      expect(original.mode).toBe('resize');
    }
  });

  it('rejects a captured rotation controller even if Ctrl is released before the move', () => {
    const original = prepare(2, 131072);
    expect(planSelectionPointerInput(original, { absolutePoint: { x: 361, y: 120 }, currentBounds,
      modifiers: modifiers(0) })).toMatchObject({ ok: false, reason: expect.stringMatching(/rotation/i) });
  });

  it('bypasses enabled grid with Alt without losing Shift or changing raw coordinates', () => {
    const original = prepareSelectionPointerInput({ ...prepare(2), grid: { enabled: true,
      spacing: { width: 8, height: 8 }, tolerance: 5 } });
    const output = planSelectionPointerInput(original, { absolutePoint: { x: 361.25, y: 127.75 },
      currentBounds, modifiers: modifiers(458752) });
    expect(output).toMatchObject({ ok: true, delta: { x: 21.25, y: 7.75 },
      layoutModifiers: { shift: true, control: false, alt: false }, trace: { snap: 'bypassed' } });
  });

  it('owns copied captured settings and never mutates caller geometry or modifier snapshots', () => {
    const options = { targetCount: 1, handle: 4 as const, freedom: 1 as const,
      initialModifiers: modifiers(0), initialHotzonePoint: { ...initialHotzonePoint },
      grid: { enabled: false, spacing: { width: 8, height: 8 }, tolerance: 5 } };
    const original = prepareSelectionPointerInput(options);
    options.grid.spacing.width = 2; options.initialHotzonePoint.x = 0; options.initialModifiers.alt = true;
    const frame = { currentBounds: { ...currentBounds }, absolutePoint: { x: 360, y: 120 }, modifiers: modifiers(0) };
    const before = structuredClone(frame);
    const output = planSelectionPointerInput(original, frame);
    expect(output).toMatchObject({ ok: true, delta: { x: 20, y: 0 } });
    expect(original.grid.spacing.width).toBe(8);
    expect(frame).toEqual(before);
  });

  it('rejects invalid finite-domain requests atomically', () => {
    expect(() => prepareSelectionPointerInput({ ...prepare(), targetCount: 0 })).toThrow(/count/i);
    const original = prepare();
    const before = structuredClone(original);
    expect(planSelectionPointerInput(original, { currentBounds, absolutePoint: { x: NaN, y: 120 },
      modifiers: modifiers(0) })).toMatchObject({ ok: false, reason: expect.stringMatching(/finite/i) });
    expect(original).toEqual(before);
  });
});
