import type { AuthorResizeRect } from './author-resize-solver';
import type { SelectionLayoutEffect } from './selection-layout';
import { prepareSelectionPointerInput, projectSelectionPointerInput, selectionPointerBounds,
  type SelectionPointerInputOriginal, type SelectionPointerInputModifiers,
  type SelectionPointerInputTrace, type SelectionPointerPoint } from './selection-pointer-input';

export interface SelectionPointerRotateTarget {
  id: string;
  type: 'checkbox' | 'radio';
  ownerRect: AuthorResizeRect;
  /** This adapter admits the existing ordinary zero-angle authoring scope. */
  rotation: 0;
  locked?: boolean;
}
export interface SelectionPointerRotateOriginal {
  targets: readonly SelectionPointerRotateTarget[];
  input: SelectionPointerInputOriginal;
  /** Actual pointer-down position, distinct from input.initialHotzonePoint. */
  downPoint: SelectionPointerPoint;
  selectionRect: AuthorResizeRect;
  pivot: SelectionPointerPoint;
}
export interface SelectionPointerRotateState {
  targets: { id: string; ownerRect: AuthorResizeRect }[];
}
export interface SelectionPointerRotateRequest {
  point: SelectionPointerPoint;
  modifiers: SelectionPointerInputModifiers;
}
export interface SelectionPointerRotateTrace {
  input?: SelectionPointerInputTrace;
  delta?: SelectionPointerPoint;
  anglePoint?: SelectionPointerPoint;
  rawAngle?: number;
  angle?: number;
  targets: { id: string; skipped?: 'locked'; requested?: SelectionPointerPoint; changed?: boolean }[];
}
export type SelectionPointerRotateResult =
  | { ok: true; state: SelectionPointerRotateState;
      results: { id: string; effects: SelectionLayoutEffect[] }[]; trace: SelectionPointerRotateTrace }
  | { ok: false; reason: string; widgetIds: string[]; trace: SelectionPointerRotateTrace };

const copy = <T>(value: T): T => structuredClone(value);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-5;
function point(value: SelectionPointerPoint) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) throw Error('Selection rotation requires finite coordinates');
}
function modelRect(value: AuthorResizeRect) {
  point(value);
  if (Math.abs(value.x) > 100_000 || Math.abs(value.y) > 100_000
    || !Number.isFinite(value.width) || !Number.isFinite(value.height)
    || value.width < 1 || value.height < 1 || value.width > 100_000 || value.height > 100_000)
    throw Error('Selection rotation requires model rectangles with location within ±100000 and size 1..100000');
}
function targetsValid(targets: readonly SelectionPointerRotateTarget[]) {
  if (!targets || targets.length < 2 || targets.length > 10_000) throw Error('Selection rotation requires 2..10000 selection controls');
  const ids = new Set<string>();
  for (const target of targets) {
    if (typeof target.id !== 'string' || !target.id || ids.has(target.id)) throw Error('Selection rotation requires unique target identities');
    ids.add(target.id);
    if (target.type !== 'checkbox' && target.type !== 'radio') throw Error('Rotate selection controls separately from other widgets');
    if (target.rotation !== 0) throw Error('Selection rotation requires ordinary zero-angle owners');
    if (target.locked !== undefined && typeof target.locked !== 'boolean') throw Error('locked must be Boolean');
    modelRect(target.ownerRect);
  }
}

/** Capture the ordinary multi-Selection mode-2 controller without fonts, text
 * panels or layout services. Locked roots remain in the initial common pivot. */
export function prepareSelectionPointerRotate(options: {
  targets: readonly SelectionPointerRotateTarget[];
  input: SelectionPointerInputOriginal;
  downPoint: SelectionPointerPoint;
}): { original: SelectionPointerRotateOriginal; state: SelectionPointerRotateState } {
  targetsValid(options.targets); point(options.downPoint);
  const checkedInput = prepareSelectionPointerInput(options.input);
  if (options.input.mode !== 'rotate' || checkedInput.mode !== 'rotate'
    || options.input.targetCount !== options.targets.length)
    throw Error('Selection rotation requires a captured multiple-target exact-Control mode');
  const targets = copy(options.targets), selectionRect = selectionPointerBounds(targets.map(target => target.ownerRect));
  const pivot = { x: selectionRect.x + selectionRect.width / 2, y: selectionRect.y + selectionRect.height / 2 };
  const original: SelectionPointerRotateOriginal = { targets, input: checkedInput, downPoint: copy(options.downPoint), selectionRect, pivot };
  return { original, state: { targets: targets.map(target => ({ id: target.id, ownerRect: copy(target.ownerRect) })) } };
}

/** CbNX mode 2 + IbNU for the Selection capability branch. Each frame projects
 * original centers, while the input candidate and Location equality read the
 * current accepted state. kJ0t cannot write Selection's own rotation. Location
 * uses current-view false/notify true; its exact [101] notification skips text
 * layout. Only persistent writes are returned, not editor invalidation events.
 * Pointer-up is completion, not another call to this planner. */
export function planSelectionPointerRotate(original: SelectionPointerRotateOriginal,
  state: SelectionPointerRotateState, request: SelectionPointerRotateRequest): SelectionPointerRotateResult {
  const trace: SelectionPointerRotateTrace = { targets: [] };
  let activeId: string | undefined;
  try {
    targetsValid(original.targets); point(original.downPoint); point(original.pivot);
    if (original.input.mode !== 'rotate' || original.input.targetCount !== original.targets.length)
      throw Error('Selection rotation requires its captured mode and target count');
    if (state.targets.length !== original.targets.length) throw Error('Selection rotation state does not match its original targets');
    for (let index = 0; index < state.targets.length; index++) {
      const current = state.targets[index], initial = original.targets[index];
      activeId = initial.id;
      modelRect(current.ownerRect);
      if (current.id !== initial.id || current.ownerRect.width !== initial.ownerRect.width || current.ownerRect.height !== initial.ownerRect.height)
        throw Error('Selection rotation state has changed target identity or size');
    }
    activeId = undefined;
    const projected = projectSelectionPointerInput(original.input, { absolutePoint: request.point, modifiers: request.modifiers,
      currentBounds: selectionPointerBounds(state.targets.map(target => target.ownerRect)) });
    if (!projected.ok) throw Error(projected.reason);
    trace.input = projected.trace; trace.delta = projected.delta;
    const anglePoint = { x: original.downPoint.x + projected.delta.x, y: original.downPoint.y + projected.delta.y };
    point(anglePoint); trace.anglePoint = anglePoint;
    const angleAt = (at: SelectionPointerPoint) => Math.atan2(at.y - original.pivot.y, at.x - original.pivot.x) * 57.29577951308232 + 90;
    const rawAngle = angleAt(anglePoint) - angleAt(original.downPoint);
    const nearest = Math.sign(rawAngle / 15) * Math.floor(Math.abs(rawAngle / 15) + .5) * 15;
    const angle = request.modifiers.shift || Math.abs(rawAngle - nearest) <= 5 ? nearest : rawAngle;
    trace.rawAngle = rawAngle; trace.angle = angle;
    const radians = angle * (Math.PI / 180), sine = Math.sin(radians), cosine = Math.cos(radians);
    const nextState = copy(state), results: Extract<SelectionPointerRotateResult, { ok: true }>['results'] = [];
    for (let index = 0; index < original.targets.length; index++) {
      const target = original.targets[index], current = nextState.targets[index];
      activeId = target.id;
      if (target.locked) { trace.targets.push({ id: target.id, skipped: 'locked' }); continue; }
      const initial = target.ownerRect;
      const center = { x: initial.x + initial.width / 2, y: initial.y + initial.height / 2 };
      const relative = { x: center.x - original.pivot.x, y: center.y - original.pivot.y };
      const rotated = { x: relative.x * cosine - relative.y * sine + original.pivot.x,
        y: relative.x * sine + relative.y * cosine + original.pivot.y };
      const requested = { x: initial.x + (rotated.x - center.x), y: initial.y + (rotated.y - center.y) };
      modelRect({ ...initial, ...requested });
      const changed = !near(requested.x, current.ownerRect.x) || !near(requested.y, current.ownerRect.y);
      trace.targets.push({ id: target.id, requested, changed });
      if (changed) {
        current.ownerRect = { ...current.ownerRect, ...requested };
        results.push({ id: target.id, effects: [{ name: 'style.Location', ...requested, allViews: false, notify: true }] });
      }
    }
    return { ok: true, state: nextState, results, trace };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error),
      widgetIds: activeId ? [activeId] : [], trace };
  }
}
