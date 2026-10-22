import { solveAuthorResize, type AuthorResizeRect } from './author-resize-solver';
import { planSelectionLayout, type SelectionLayoutInput, type SelectionLayoutState,
  type SelectionLayoutServices, type SelectionLayoutEntry, type SelectionLayoutEffect,
  type SelectionLayoutResult } from './selection-layout';

export type SelectionPointerHandle = 1 | 2 | 3 | 4 | 6 | 8 | 9 | 12;
export interface SelectionPointerTarget {
  id: string;
  type: 'checkbox' | 'radio';
  input: SelectionLayoutInput;
  services: SelectionLayoutServices;
  locked?: boolean;
}
export interface SelectionPointerOriginal {
  targets: readonly SelectionPointerTarget[];
  handle: SelectionPointerHandle;
  selectionRect: AuthorResizeRect;
  freedom: 1 | 2 | 3;
}
export interface SelectionPointerState {
  targets: { id: string; layout: SelectionLayoutState; measurementPasses: number }[];
  /** Native single-handle controller state; not a saved widget property. */
  fitHotZone: boolean;
}
export interface SelectionPointerResizeRequest {
  /** Accumulated pointer displacement from the gesture start, in diagram units. */
  delta: { x: number; y: number };
  modifiers?: { control?: boolean; alt?: boolean; shift?: boolean };
}
export interface SelectionPointerTrace {
  id: string;
  branch: 'single' | 'multiple';
  requested?: AuthorResizeRect;
  skipped?: 'locked';
  effects: SelectionLayoutEffect[];
}
export type SelectionPointerResizeResult =
  | { ok: true; state: SelectionPointerState;
      results: { id: string; result: Extract<SelectionLayoutResult, { ok: true }> }[];
      trace: SelectionPointerTrace[] }
  | { ok: false; reason: string; widgetIds: string[]; trace: SelectionPointerTrace[] };

const HANDLES = new Set<number>([1, 2, 3, 4, 6, 8, 9, 12]);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-5;
const roundAway = (value: number) => Math.sign(value) * Math.floor(Math.abs(value) + .5);
const copy = <T>(value: T): T => structuredClone(value);
function modelRect(rect: AuthorResizeRect) {
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
    || Math.abs(rect.x) > 100_000 || Math.abs(rect.y) > 100_000
    || rect.width < 1 || rect.height < 1 || rect.width > 100_000 || rect.height > 100_000)
    throw Error('Selection resize requires finite model rectangles with size 1..100000');
}
function currentInput(original: SelectionLayoutInput, current: SelectionLayoutState): SelectionLayoutInput {
  return { ...copy(original), ...copy(current), coordinateContext: { ...original.coordinateContext,
    locationInDiagram: copy(current.locationInDiagram) } };
}

/** Capture geometry once. Text-panel and shared-fit state remain live between
 * calls to planSelectionPointerResize. Fonts/DOM belong to the host services. */
export function prepareSelectionPointerResize(
  targets: readonly SelectionPointerTarget[], handle: SelectionPointerHandle,
): { original: SelectionPointerOriginal; state: SelectionPointerState } {
  if (!targets.length || targets.length > 10_000) throw Error('Select at least one supported selection control');
  if (!HANDLES.has(handle) || targets.length === 1 && handle !== 1 && handle !== 4)
    throw Error('A single selection control supports only left and right resize handles');
  const ids = new Set<string>();
  const originalTargets = targets.map(target => {
    if (!target.id || ids.has(target.id)) throw Error('Selection resize requires unique target identities');
    ids.add(target.id);
    if (target.type !== 'checkbox' && target.type !== 'radio') throw Error('Resize selection controls separately from other widgets');
    if (target.locked !== undefined && typeof target.locked !== 'boolean') throw Error('locked must be Boolean');
    modelRect(target.input.ownerRect);
    if (target.input.editingText) throw Error('Finish inline text editing before pointer resizing');
    // Validate the common numeric domain without measuring or changing layout.
    const checked = planSelectionLayout({ ...target.input, guard: true }, { kind: 'layout', recalculateFit: false }, target.services);
    if (!checked.ok) throw Error(checked.reason);
    return { ...target, input: copy(target.input), services: { ...target.services } };
  });
  const frames = originalTargets.map(target => target.input.ownerRect);
  const x = Math.min(...frames.map(rect => rect.x)), y = Math.min(...frames.map(rect => rect.y));
  const selectionRect = { x, y, width: Math.max(...frames.map(rect => rect.x + rect.width)) - x,
    height: Math.max(...frames.map(rect => rect.y + rect.height)) - y };
  modelRect(selectionRect);
  const original: SelectionPointerOriginal = { targets: originalTargets, handle, selectionRect,
    freedom: ((handle & 5 ? 1 : 0) | (handle & 10 ? 2 : 0)) as 1 | 2 | 3 };
  const state: SelectionPointerState = {
    targets: originalTargets.map(({ id, input }) => ({ id, measurementPasses: 0, layout: {
      ownerRect: copy(input.ownerRect), textPanelRect: copy(input.textPanelRect),
      locationInDiagram: copy(input.coordinateContext.locationInDiagram),
      rawFit: copy(input.rawFit), effectiveFit: copy(input.effectiveFit), guard: input.guard,
      ...(input.styleEditorReference ? { styleEditorReference: copy(input.styleEditorReference) } : {}),
    } })),
    fitHotZone: targets.length === 1 && targets[0].input.effectiveFit.width,
  };
  return { original, state };
}

/** Ordinary unrotated SelectionButton controller. Each successful result holds
 * this frame's complete incremental effects for applySelectionAuthorEffects.
 * Single obN4 and multiple INw2 are separate native branches. No Layer tree,
 * general transform or external document mutation is implied. Shift aspect is
 * gated by native hot-zone availability: single horizontal SelectionButton has
 * no orthogonal handle; a multiple selection exposes all eight handles. */
export function planSelectionPointerResize(
  original: SelectionPointerOriginal, state: SelectionPointerState, request: SelectionPointerResizeRequest,
): SelectionPointerResizeResult {
  const trace: SelectionPointerTrace[] = [];
  let activeId: string | undefined;
  try {
    if (!Number.isFinite(request.delta.x) || !Number.isFinite(request.delta.y)) throw Error('Pointer delta must be finite');
    if (request.modifiers?.control || request.modifiers?.alt)
      throw Error('Control/Alt selection resize gestures are not supported');
    if (state.targets.length !== original.targets.length || typeof state.fitHotZone !== 'boolean')
      throw Error('Selection pointer state does not match the original targets');
    const nextState = copy(state), results: Extract<SelectionPointerResizeResult, { ok: true }>['results'] = [];
    const single = original.targets.length === 1;
    const delta = single ? { ...request.delta } : {
      x: original.handle & 1 ? Math.min(request.delta.x, original.selectionRect.width)
        : Math.max(request.delta.x, -original.selectionRect.width),
      y: original.handle & 2 ? Math.min(request.delta.y, original.selectionRect.height)
        : Math.max(request.delta.y, -original.selectionRect.height),
    };
    for (let index = 0; index < original.targets.length; index++) {
      const target = original.targets[index], current = nextState.targets[index];
      activeId = target.id;
      if (current.id !== target.id || !Number.isSafeInteger(current.measurementPasses) || current.measurementPasses < 0)
        throw Error('Selection pointer state has an invalid identity or measurement counter');
      modelRect(current.layout.ownerRect);
      const effects: SelectionLayoutEffect[] = [];
      const row: SelectionPointerTrace = { id: target.id, branch: single ? 'single' : 'multiple', effects };
      trace.push(row);
      const initialPass = current.measurementPasses;
      function layout(entry: SelectionLayoutEntry) {
        const offset = current.measurementPasses;
        const outcome = planSelectionLayout(currentInput(target.input, current.layout), entry, {
          ...target.services,
          measureText: (req, context) => target.services.measureText({ ...req, pass: req.pass + offset }, context),
        });
        for (const effect of outcome.effects) effects.push(typeof effect.index === 'number'
          ? { ...effect, index: effect.index + offset } : effect);
        if (!outcome.ok) throw Error(outcome.reason);
        current.layout = outcome.state;
        current.measurementPasses += outcome.measurementPasses;
      }
      if (target.locked) row.skipped = 'locked';
      else {
        // JbNd sees current effective fit. Single hot-zone refresh can turn off
        // this call for later frames; the old geometry snapshot is not refreshed.
        if (!single || nextState.fitHotZone) {
          if (single) nextState.fitHotZone = false;
          if (current.layout.effectiveFit.width && (original.freedom & 1))
            layout({ kind: 'fit', axis: 'width', value: Math.abs(delta.x) < 1e-5 });
          if (single) nextState.fitHotZone = current.layout.effectiveFit.width;
        }
        const old = target.input.ownerRect;
        let requested: AuthorResizeRect;
        if (single) {
          // obN4, no rotation: round the signed size delta AwayFromZero, clamp
          // to the native minimum, then hold the opposite ORIGINAL anchor.
          const minimum = target.services.readMinimumSize({ state: copy(current.layout),
            reenterLayout: force => layout({ kind: 'layout', recalculateFit: force }) });
          if (!Number.isFinite(minimum.width) || !Number.isFinite(minimum.height)
            || minimum.width < 0 || minimum.height < 0) throw Error('Invalid selection minimum size');
          const width = Math.max(minimum.width, old.width + roundAway(original.handle === 1 ? -delta.x : delta.x));
          requested = { x: original.handle === 1 ? old.x + old.width - width : old.x,
            y: old.y, width, height: Math.max(old.height, minimum.height) };
        } else {
          const solved = solveAuthorResize({ originalRect: old, originalBounds: old,
            delta, parentRect: original.selectionRect, handle: original.handle,
            // CbNX refreshes aspect on each frame. Keep JbNd's original
            // freedom above: solver aspect may project both axes, but a
            // vertical handle must not consequently clear AutoFitWidth.
            freedom: original.freedom, preserveAspect: Boolean(request.modifiers?.shift), orientation: 3, rotation: 0 });
          if (!solved.finite) throw Error('Selection resize projection is nonfinite');
          requested = solved.rect;
        }
        row.requested = copy(requested);
        // A zero projection reaches uJ0j's explicit minimum validator. Other
        // unsafe sizes/locations are rejected atomically before document writes.
        if (![requested.x, requested.y, requested.width, requested.height].every(Number.isFinite)
          || requested.width < 0 || requested.height < 0) throw Error('Invalid requested selection geometry');
        effects.push({ name: 'YJ0S.request', rect: copy(requested), allViews: false },
          { name: 'uJ0j.request', width: requested.width, height: requested.height, guard: current.layout.guard });
        layout({ kind: 'size', size: { width: requested.width, height: requested.height }, allViews: false, notify: true });
        // YJ0S writes requested Location AFTER all synchronous Size/layout work.
        // Its anchor is not recomputed from the actual text-corrected size.
        const owner = current.layout.ownerRect;
        if (!near(owner.x, requested.x) || !near(owner.y, requested.y)) {
          current.layout.locationInDiagram = {
            x: current.layout.locationInDiagram.x + requested.x - owner.x,
            y: current.layout.locationInDiagram.y + requested.y - owner.y,
          };
          current.layout.ownerRect = { ...owner, x: requested.x, y: requested.y };
          effects.push({ name: 'NJ01' }, { name: 'style.Location', x: requested.x, y: requested.y, allViews: false, notify: true },
            { name: 'DJ0E', a: false, b: true }, { name: 'location.changed' });
        }
        modelRect(current.layout.ownerRect);
        for (const effect of effects) {
          if (effect.name === 'style.Size') modelRect({ x: 0, y: 0, width: effect.width as number, height: effect.height as number });
          if (effect.name === 'style.Location') modelRect({ x: effect.x as number, y: effect.y as number, width: 1, height: 1 });
        }
      }
      results.push({ id: target.id, result: { ok: true, state: copy(current.layout), effects: copy(effects),
        measurementPasses: current.measurementPasses - initialPass } });
    }
    return { ok: true, state: nextState, results, trace };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error),
      widgetIds: activeId ? [activeId] : original.targets.map(target => target.id), trace };
  }
}
