import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as inputModel from '../src/model/selection-pointer-input';
import { prepareSelectionPointerRotate, planSelectionPointerRotate,
  type SelectionPointerRotateTarget } from '../src/model/selection-pointer-rotate';
import type { SelectionPointerHandle } from '../src/model/selection-pointer-resize';

const modifiers = (mask: number) => ({ shift: Boolean(mask & 65536), control: Boolean(mask & 131072), alt: Boolean(mask & 262144) });
const inputSource = JSON.parse(readFileSync('research/selection-rotation-input-probes.json', 'utf8').replace(/^\uFEFF/, ''));
const controllerSource = JSON.parse(readFileSync('research/selection-rotation-controller-probes.json', 'utf8').replace(/^\uFEFF/, ''));
const composedSource = JSON.parse(readFileSync('research/selection-rotation-controller-composed-probes.json', 'utf8').replace(/^\uFEFF/, ''));
const constructorSource = JSON.parse(readFileSync('research/selection-rotation-host-review-source-probes.json', 'utf8').replace(/^\uFEFF/, ''));
const angleUnitSource = JSON.parse(readFileSync('research/selection-rotation-model-angle-unit-probes.json', 'utf8').replace(/^\uFEFF/, ''));
function numeric(actual: any, expected: any, label = ''): void {
  if (typeof expected === 'number') expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(1e-9);
  else if (expected && typeof expected === 'object') {
    for (const key of Object.keys(expected)) numeric(actual?.[key], expected[key], `${label}.${key}`);
  } else expect(actual, label).toEqual(expected);
}

describe('shared pointer projection for captured rotation mode', () => {
  it('matches all 256 retained mode-2 input projections with live bounds and all move keys', () => {
    const cases = inputSource.results.filter((item: any) => item.name.startsWith('move '));
    expect(cases).toHaveLength(256);
    for (const { input, actual, name } of cases) {
      const handle = input.handle as SelectionPointerHandle;
      const original = inputModel.prepareSelectionPointerInput({ targetCount: 2, handle,
        // This retained input facade supplies selection freedoms=3. The
        // handle's axis freedom is a different controller input.
        freedom: input.freedom ?? 3,
        initialModifiers: modifiers(131072), initialHotzonePoint: input.start,
        grid: { enabled: input.gridEnabled, spacing: { width: 8, height: 8 }, tolerance: 5 / input.zoom } });
      const frame = { absolutePoint: input.point, currentBounds: input.currentBounds, modifiers: modifiers(input.keys) };
      const before = structuredClone({ original, frame });
      const output = inputModel.projectSelectionPointerInput(original, frame);
      expect(output.ok, name).toBe(true);
      if (!output.ok) throw Error(output.reason);
      numeric(output.delta, actual.delta, name);
      numeric(output.trace.correction, actual.correction, name);
      numeric(output.trace.candidate ?? null, actual.candidate, name);
      expect(output.trace.mode, name).toBe('rotate');
      expect(output.layoutModifiers, name).toEqual({ shift: input.shift, control: false, alt: false });
      expect({ original, frame }).toEqual(before);
      expect(inputModel.planSelectionPointerInput(original, frame)).toMatchObject({ ok: false, reason: expect.stringMatching(/rotation/i) });
    }
  });

  it('retains the old resize wrapper and rejects an invalid captured mode', () => {
    const original = inputModel.prepareSelectionPointerInput({ targetCount: 2, handle: 4, freedom: 1,
      initialModifiers: modifiers(0), initialHotzonePoint: { x: 300, y: 109.5 },
      grid: { enabled: false, spacing: { width: 8, height: 8 }, tolerance: 5 } });
    const frame = { currentBounds: { x: 100, y: 100, width: 200, height: 20 },
      absolutePoint: { x: 340, y: 120 }, modifiers: modifiers(131072) };
    expect(inputModel.projectSelectionPointerInput(original, frame)).toEqual(inputModel.planSelectionPointerInput(original, frame));
    expect(inputModel.projectSelectionPointerInput({ ...original, mode: 'other' as any }, frame)).toMatchObject({ ok: false });
  });
});

describe('ordinary Selection mode-2 Location controller', () => {
  const admitted = controllerSource.cases.filter((item: any) => !item.input.scopeOffset
    && !item.input.widgets.some((widget: any) => widget.rotationCapable));
  it('covers the admitted source fixture count explicitly', () => expect(admitted).toHaveLength(45));
  it.each(admitted as any[])('$name', (fixture: any) => {
    const { input, actual } = fixture;
    const initialHotzonePoint = inputModel.selectionPointerHotzonePoint(input.bounds, 12);
    const capturedInput = inputModel.prepareSelectionPointerInput({ targetCount: input.widgets.length,
      handle: 12, freedom: 3, initialModifiers: modifiers(131072), initialHotzonePoint,
      grid: { enabled: false, spacing: { width: 8, height: 8 }, tolerance: 5 } });
    const targets = input.widgets.map((widget: any, index: number) => ({ id: widget.id,
      type: index % 2 ? 'radio' : 'checkbox', rotation: 0, ownerRect: widget.rect, locked: widget.locked })) as SelectionPointerRotateTarget[];
    const originalArguments = structuredClone({ targets, input: capturedInput, downPoint: input.down });
    const prepared = prepareSelectionPointerRotate(originalArguments);
    numeric(prepared.original.selectionRect, input.bounds);
    let state = prepared.state;
    for (let index = 0; index < input.frames.length; index++) {
      const frame = input.frames[index], expected = actual[index];
      const request = { point: { x: initialHotzonePoint.x + frame.delta.x, y: initialHotzonePoint.y + frame.delta.y },
        modifiers: modifiers(frame.keys ?? 0) };
      const before = structuredClone({ original: prepared.original, state, request });
      const result = planSelectionPointerRotate(prepared.original, state, request);
      expect(result.ok, `${fixture.name} frame ${index}`).toBe(true);
      if (!result.ok) throw Error(result.reason);
      for (const target of expected.after) {
        numeric(result.state.targets.find(item => item.id === target.id)?.ownerRect, target.rect, `${fixture.name} ${target.id}`);
      }
      const writes = expected.events.filter((event: any) => event.name === 'Location.write');
      const effects = result.results.flatMap(item => item.effects.map(effect => ({ id: item.id, ...effect })));
      expect(effects).toHaveLength(writes.length);
      for (let write = 0; write < writes.length; write++) {
        const event = writes[write];
        expect(effects[write]).toMatchObject({ id: event.id, name: 'style.Location', allViews: false, notify: true });
        numeric(effects[write], event.point, 'complete Location pair');
      }
      const snap = expected.events.find((event: any) => event.name === 'angle.snap');
      numeric(result.trace.rawAngle, snap.raw);
      numeric(result.trace.angle, snap.answer);
      expect(result.trace.targets.filter(item => item.skipped === 'locked').map(item => item.id))
        .toEqual(targets.filter(item => item.locked).map(item => item.id));
      expect({ original: prepared.original, state, request }).toEqual(before);
      state = result.state;
    }
    expect(originalArguments).toEqual({ targets, input: capturedInput, downPoint: input.down });
  });
});

describe('captured origin and consecutive live-input composition', () => {
  it('matches all 48 native captures without replacing the real down point by the hot-zone point', () => {
    const cases = inputSource.results.filter((item: any) => item.name.startsWith('capture '));
    expect(cases).toHaveLength(48);
    for (const { input, actual } of cases) {
      const captured = inputModel.prepareSelectionPointerInput({ targetCount: input.targets.length, handle: input.handle,
        freedom: 3, initialModifiers: modifiers(input.keys),
        initialHotzonePoint: inputModel.selectionPointerHotzonePoint(input.rect, input.handle),
        grid: { enabled: true, spacing: { width: 8, height: 8 }, tolerance: 5 / input.zoom } });
      const targets = input.targets.map((target: any) => ({ id: target.id, type: 'checkbox', rotation: 0, ownerRect: target.rect }));
      const prepared = prepareSelectionPointerRotate({ targets, input: captured, downPoint: input.down });
      numeric(prepared.original.downPoint, actual.down);
      numeric(prepared.original.input.initialHotzonePoint, actual.logicalStart);
      numeric(prepared.original.selectionRect, actual.initialBounds);
    }
  });

  const cases = composedSource.results.filter((item: any) => item.name.startsWith('composed '));
  it('contains all 32 source input/controller sessions and 128 frames', () => {
    expect(cases).toHaveLength(32);
    expect(cases.reduce((total: number, item: any) => total + item.frames.length, 0)).toBe(128);
  });
  it.each(cases as any[])('$name', (fixture: any) => {
    const { captureInput, captured } = fixture, first = fixture.frames[0].input;
    const input = inputModel.prepareSelectionPointerInput({ targetCount: captureInput.targets.length,
      handle: captureInput.handle, freedom: 3, initialModifiers: modifiers(captureInput.keys),
      initialHotzonePoint: captured.logicalStart,
      grid: { enabled: first.gridEnabled, spacing: { width: 8, height: 8 }, tolerance: 5 / captureInput.zoom } });
    const targets = captureInput.targets.map((target: any, index: number) => ({ id: target.id, ownerRect: target.rect,
      type: index % 2 ? 'radio' : 'checkbox', rotation: 0, locked: target.locked }));
    const prepared = prepareSelectionPointerRotate({ targets, input, downPoint: captured.down });
    let state = prepared.state;
    for (const frame of fixture.frames) {
      const result = planSelectionPointerRotate(prepared.original, state,
        { point: frame.input.point, modifiers: modifiers(frame.input.keys) });
      expect(result.ok, fixture.name).toBe(true);
      if (!result.ok) throw Error(result.reason);
      numeric(result.trace.delta, frame.projected.delta);
      for (const target of frame.observed.after)
        numeric(result.state.targets.find(item => item.id === target.id)?.ownerRect, target.rect, target.id);
      state = result.state;
    }
  });
});

function ordinary(options: { targets?: SelectionPointerRotateTarget[]; downPoint?: { x: number; y: number } } = {}) {
  const targets: SelectionPointerRotateTarget[] = options.targets ?? [
    { id: 'a', type: 'checkbox', rotation: 0, ownerRect: { x: 0, y: 0, width: 100, height: 20 } },
    { id: 'b', type: 'radio', rotation: 0, ownerRect: { x: 200, y: 0, width: 100, height: 20 } },
  ];
  const bounds = inputModel.selectionPointerBounds(targets.map(target => target.ownerRect));
  const input = inputModel.prepareSelectionPointerInput({ targetCount: targets.length, handle: 4, freedom: 3,
    initialModifiers: modifiers(131072), initialHotzonePoint: inputModel.selectionPointerHotzonePoint(bounds, 4),
    grid: { enabled: false, spacing: { width: 8, height: 8 }, tolerance: 5 } });
  return prepareSelectionPointerRotate({ targets, input, downPoint: options.downPoint ?? input.initialHotzonePoint });
}

describe('Location-only state and atomic product boundaries', () => {
  it('matches all twelve retained strict per-axis Location equality cases against accepted state', () => {
    const cases = controllerSource.checks.filter((item: any) => item.name.startsWith('location epsilon '));
    expect(cases).toHaveLength(12);
    for (const fixture of cases) {
      const [, axis, amount] = /^location epsilon ([xy]) (.+)$/.exec(fixture.name)!;
      const prepared = ordinary();
      prepared.state.targets[0].ownerRect[axis as 'x' | 'y'] = Number(amount);
      const before = structuredClone(prepared.state);
      const result = planSelectionPointerRotate(prepared.original, prepared.state,
        { point: prepared.original.input.initialHotzonePoint, modifiers: modifiers(0) });
      expect(result.ok).toBe(true);
      if (!result.ok) throw Error(result.reason);
      expect(result.results.some(item => item.id === 'a'), fixture.name).toBe(fixture.actual);
      expect(prepared.state).toEqual(before);
      const saved = result.state.targets[0].ownerRect[axis as 'x' | 'y'];
      expect(saved).toBe(fixture.actual ? 0 : Number(amount));
    }
  });

  it('does not alias snapshots or caller input and accepts a no-op without persistent writes', () => {
    const prepared = ordinary(), before = structuredClone(prepared);
    const result = planSelectionPointerRotate(prepared.original, prepared.state,
      { point: prepared.original.input.initialHotzonePoint, modifiers: modifiers(458752) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.reason);
    expect(result.results).toEqual([]);
    result.state.targets[0].ownerRect.x = 42;
    expect(prepared).toEqual(before);
  });

  it('rejects a changed identity or size before returning any persistent result', () => {
    for (const mutate of [(state: ReturnType<typeof ordinary>['state']) => state.targets.reverse(),
      (state: ReturnType<typeof ordinary>['state']) => { state.targets[1].ownerRect.width++; }]) {
      const prepared = ordinary(); mutate(prepared.state);
      const before = structuredClone(prepared);
      const result = planSelectionPointerRotate(prepared.original, prepared.state,
        { point: { x: 150, y: 160 }, modifiers: modifiers(0) });
      expect(result).toMatchObject({ ok: false });
      expect('results' in result).toBe(false);
      expect(prepared).toEqual(before);
    }
  });

  it('rejects nonfinite pointer input without altering accepted state', () => {
    const prepared = ordinary(), before = structuredClone(prepared);
    expect(planSelectionPointerRotate(prepared.original, prepared.state,
      { point: { x: NaN, y: 0 }, modifiers: modifiers(0) })).toMatchObject({ ok: false });
    expect(prepared).toEqual(before);
  });

  it('rejects an out-of-model second target atomically, retaining only diagnostic attempted trace', () => {
    const targets: SelectionPointerRotateTarget[] = [
      { id: 'a', type: 'checkbox', rotation: 0, ownerRect: { x: 0, y: 99990, width: 10, height: 10 } },
      { id: 'b', type: 'radio', rotation: 0, ownerRect: { x: 1000, y: 99990, width: 10, height: 10 } },
    ];
    const prepared = ordinary({ targets, downPoint: { x: 1010, y: 99995 } });
    const before = structuredClone(prepared);
    const result = planSelectionPointerRotate(prepared.original, prepared.state, { modifiers: modifiers(0),
      point: { x: 505, y: 100499.5 } });
    expect(result).toMatchObject({ ok: false, widgetIds: ['b'] });
    expect('results' in result).toBe(false);
    expect(result.trace.targets).toHaveLength(1);
    expect(prepared).toEqual(before);
  });

  it('rejects single/mixed/rotated or duplicate roots and a mode that was not captured as rotation', () => {
    const prepared = ordinary(), options = { targets: [...prepared.original.targets],
      input: prepared.original.input, downPoint: prepared.original.downPoint };
    for (const targets of [[options.targets[0]], [options.targets[0], options.targets[0]],
      [options.targets[0], { ...options.targets[1], type: 'box' }],
      [options.targets[0], { ...options.targets[1], rotation: 90 }]])
      expect(() => prepareSelectionPointerRotate({ ...options, targets: targets as SelectionPointerRotateTarget[] })).toThrow();
    expect(() => prepareSelectionPointerRotate({ ...options, input: { ...options.input, mode: 'resize' } })).toThrow(/captured/i);
  });
});

function checkSourceSession(input: any, observed: any) {
  const captured = inputModel.prepareSelectionPointerInput({ targetCount: input.targets.length, handle: input.handle,
    freedom: input.freedom ?? ((input.handle & 5 ? 1 : 0) | (input.handle & 10 ? 2 : 0)),
    initialModifiers: modifiers(131072), initialHotzonePoint: observed.captured.logicalStart,
    grid: { enabled: input.grid !== false, spacing: { width: 8, height: 8 }, tolerance: 5 / (input.zoom ?? 1) } });
  const targets = input.targets.map((target: any, index: number) => ({ id: target.id, ownerRect: target.rect,
    type: index % 2 ? 'radio' : 'checkbox', rotation: 0, locked: target.locked }));
  const prepared = prepareSelectionPointerRotate({ targets, input: captured, downPoint: input.down });
  let state = prepared.state;
  for (const frame of observed.frames) {
    const result = planSelectionPointerRotate(prepared.original, state, frame.request);
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.reason);
    numeric(result.trace.delta, frame.input.delta);
    const snap = frame.controller.events.find((event: any) => event.name === 'angle.snap');
    numeric(result.trace.rawAngle, snap.raw);
    // The branch matters more than a small pre-snap angular error: rounding
    // at exactly ten degrees can incorrectly jump to fifteen degrees.
    numeric(result.trace.angle, snap.answer);
    for (const target of frame.controller.after)
      numeric(result.state.targets.find(item => item.id === target.id)?.ownerRect, target.rect, target.id);
    const wrote = frame.controller.events.filter((event: any) => event.name === 'Location.write');
    expect(result.results.map(item => item.id)).toEqual(wrote.map((event: any) => event.id));
    state = result.state;
  }
  return state;
}

describe('constructor-derived freedom and unit-operation boundary', () => {
  it('covers all 64 constructor-derived sessions / 256 frames independently of the earlier freedom=3 facade', () => {
    expect(constructorSource.results).toHaveLength(64);
    expect(constructorSource.results.reduce((count: number, row: any) => count + row.observed.frames.length, 0)).toBe(256);
  });
  it.each(constructorSource.results as any[])('$name', (fixture: any) => {
    checkSourceSession(fixture.input, fixture.observed);
  });
  it('uses retained K5wb multiplication order at the default magnetic-snap boundary', () => {
    checkSourceSession(angleUnitSource.input, angleUnitSource.actual);
  });
});
