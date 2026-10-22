import type { AuthorResizeRect } from './author-resize-solver';
import type { SelectionPointerHandle } from './selection-pointer-resize';

export interface SelectionPointerPoint { x: number; y: number }
export interface SelectionPointerInputModifiers { shift: boolean; control: boolean; alt: boolean }
export interface SelectionPointerGrid {
  enabled: boolean;
  spacing: { width: number; height: number };
  /** Already converted from device to diagram units by the host graphics service. */
  tolerance: number;
}
export interface SelectionPointerInputOptions {
  targetCount: number;
  handle: SelectionPointerHandle;
  freedom: 1 | 2 | 3;
  initialModifiers: SelectionPointerInputModifiers;
  /** The native hot-zone anchor, in the same diagram coordinates as each frame. */
  initialHotzonePoint: SelectionPointerPoint;
  grid: SelectionPointerGrid;
}
export interface SelectionPointerInputOriginal extends SelectionPointerInputOptions {
  mode: 'resize' | 'rotate';
}
export interface SelectionPointerInputFrame {
  absolutePoint: SelectionPointerPoint;
  /** Current accepted owners' union, not the geometry snapshot used by the resize solver. */
  currentBounds: AuthorResizeRect;
  modifiers: SelectionPointerInputModifiers;
}
export interface SelectionPointerInputTrace {
  mode: 'resize' | 'rotate';
  rawModifiers: SelectionPointerInputModifiers;
  snap: 'off' | 'bypassed' | 'grid';
  candidate?: AuthorResizeRect;
  correction: SelectionPointerPoint;
}
export type SelectionPointerInputResult =
  | { ok: true; rawDelta: SelectionPointerPoint; delta: SelectionPointerPoint;
      layoutModifiers: SelectionPointerInputModifiers; trace: SelectionPointerInputTrace }
  | { ok: false; reason: string };

const handles = new Set<number>([1, 2, 3, 4, 6, 8, 9, 12]);
function point(value: SelectionPointerPoint) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) throw Error('Selection input requires finite coordinates');
}
function rect(value: AuthorResizeRect, allowZero = false) {
  point(value);
  if (!Number.isFinite(value.width) || !Number.isFinite(value.height)
    || (allowZero ? value.width < 0 || value.height < 0 : value.width <= 0 || value.height <= 0))
    throw Error('Selection input requires finite positive current bounds');
}
function modifiers(value: SelectionPointerInputModifiers) {
  if (!value || ![value.shift, value.control, value.alt].every(item => typeof item === 'boolean'))
    throw Error('Selection input modifiers must be Boolean');
}
function grid(value: SelectionPointerGrid) {
  if (!value || typeof value.enabled !== 'boolean' || !value.spacing
    || !Number.isFinite(value.spacing.width) || value.spacing.width <= 0
    || !Number.isFinite(value.spacing.height) || value.spacing.height <= 0
    || !Number.isFinite(value.tolerance) || value.tolerance < 0)
    throw Error('Selection grid requires finite positive spacing and nonnegative tolerance');
}
function options(value: SelectionPointerInputOptions) {
  if (!Number.isInteger(value.targetCount) || value.targetCount < 1 || value.targetCount > 10_000)
    throw Error('Selection target count must be 1..10000');
  if (!handles.has(value.handle) || ![1, 2, 3].includes(value.freedom)) throw Error('Unsupported selection input handle or freedom');
  point(value.initialHotzonePoint); modifiers(value.initialModifiers); grid(value.grid);
}

const opposite = (handle: number) => (handle & 1 ? 4 : 0) | (handle & 4 ? 1 : 0)
  | (handle & 2 ? 8 : 0) | (handle & 8 ? 2 : 0);
const corner = (handle: number) => handle === 3 || handle === 6 || handle === 9 || handle === 12;
const roundAway = (value: number) => Math.sign(value) * Math.floor(Math.abs(value) + .5);

/** xFY0's ordinary zero-angle candidate. Crossing may produce a zero axis or
 * the source sentinel, which still participates in the subsequent grid search. */
export function selectionPointerCandidate(bounds: AuthorResizeRect, absolutePoint: SelectionPointerPoint,
  handle: SelectionPointerHandle, freedom: 0 | 1 | 2 | 3, shift: boolean): AuthorResizeRect {
  rect(bounds); point(absolutePoint);
  if (!handles.has(handle) || ![0, 1, 2, 3].includes(freedom) || typeof shift !== 'boolean')
    throw Error('Unsupported selection candidate input');
  let x = absolutePoint.x, y = absolutePoint.y;
  const right = bounds.x + bounds.width, bottom = bounds.y + bounds.height;
  const ratio = bounds.height / bounds.width;
  if (shift && corner(handle)) {
    const width = handle & 1 ? right - x : x - bounds.x;
    const height = handle & 2 ? bottom - y : y - bounds.y;
    if (width * ratio > height) y = handle & 2 ? bottom - width * ratio : bounds.y + width * ratio;
    else if (height > width * ratio) x = handle & 1 ? right - height / ratio : bounds.x + height / ratio;
  }
  const result = { x: handle & 1 ? Math.min(x, right) : bounds.x,
    y: handle & 2 ? Math.min(y, bottom) : bounds.y,
    width: handle & 1 ? Math.max(0, right - x) : handle & 4 ? Math.max(0, x - bounds.x) : bounds.width,
    height: handle & 2 ? Math.max(0, bottom - y) : handle & 8 ? Math.max(0, y - bounds.y) : bounds.height };
  rect(result, true);
  if (result.width === 0 && result.height === 0 || result.width === 0 && !(freedom & 2)
    || result.height === 0 && !(freedom & 1)) return { x: -100000, y: -100000, width: 200000, height: 200000 };
  return result;
}

/** Grid-only iFYq. Anchor is the opposite of the moving handle. Guides/objects
 * are deliberately absent. One converted tolerance is used on both axes. */
export function selectionPointerGridCorrection(candidate: AuthorResizeRect, anchor: number,
  settings: SelectionPointerGrid, shift: boolean): SelectionPointerPoint {
  rect(candidate, true); grid(settings);
  if (!handles.has(anchor) || typeof shift !== 'boolean') throw Error('Unsupported selection grid anchor');
  if (!settings.enabled) return { x: 0, y: 0 };
  const nearest = (value: number, spacing: number) => roundAway(value / spacing) * spacing - value;
  const right = nearest(candidate.x + candidate.width, settings.spacing.width);
  const left = nearest(candidate.x, settings.spacing.width);
  const bottom = nearest(candidate.y + candidate.height, settings.spacing.height);
  const top = nearest(candidate.y, settings.spacing.height);
  let x = ((anchor & 1) || Math.abs(right) <= Math.abs(left)) && !(anchor & 4) ? right : left;
  let y = ((anchor & 2) || Math.abs(bottom) <= Math.abs(top)) && !(anchor & 8) ? bottom : top;
  point({ x, y });
  const xHit = Math.abs(x) <= settings.tolerance, yHit = Math.abs(y) <= settings.tolerance;
  if (!xHit) x = 0;
  if (!yHit) y = 0;
  if (shift && corner(anchor)) {
    const ratio = candidate.height / candidate.width, sign = anchor === 3 || anchor === 12 ? 1 : -1;
    if (!yHit || xHit && Math.abs(x * ratio) < Math.abs(y)) {
      const aligned = sign * x * ratio;
      if (!(Math.abs(aligned - y) < 1e-5)) y = aligned;
    } else {
      const aligned = sign * y / ratio;
      if (!(Math.abs(aligned - x) < 1e-5)) x = aligned;
    }
  }
  // Native may forward nonfinite corrections for degenerate ratios. This
  // bounded product adapter rejects them before any owner or fit-state commit.
  point({ x, y });
  return { x, y };
}

/** Finite ordinary SelectionButton owners in one unrotated diagram scope. The
 * input host must include selected locked roots, as native selection bounds do. */
export function selectionPointerBounds(rectangles: readonly AuthorResizeRect[]): AuthorResizeRect {
  if (!rectangles.length || rectangles.length > 10_000) throw Error('Selection bounds require at least one and at most 10000 rectangles');
  rectangles.forEach(item => rect(item));
  const x = Math.min(...rectangles.map(item => item.x)), y = Math.min(...rectangles.map(item => item.y));
  const result = { x, y, width: Math.max(...rectangles.map(item => item.x + item.width)) - x,
    height: Math.max(...rectangles.map(item => item.y + item.height)) - y };
  rect(result);
  return result;
}

/** zbNw + kI8w, modern box model and zero rotation. The one-unit reduction
 * precedes the side midpoint; right/bottom then restore their outer edge. */
export function selectionPointerHotzonePoint(bounds: AuthorResizeRect, handle: SelectionPointerHandle): SelectionPointerPoint {
  rect(bounds);
  if (!handles.has(handle)) throw Error('Unsupported selection input handle');
  const result = { x: handle & 1 ? bounds.x : handle & 4 ? bounds.x + bounds.width : bounds.x + (bounds.width - 1) / 2,
    y: handle & 2 ? bounds.y : handle & 8 ? bounds.y + bounds.height : bounds.y + (bounds.height - 1) / 2 };
  point(result);
  return result;
}

/** CbNh captures UbNP's exact-Control mode. SelectionButton has no Rotation
 * capability; a single target therefore stays in resize mode for every key set. */
export function prepareSelectionPointerInput(value: SelectionPointerInputOptions): SelectionPointerInputOriginal {
  options(value);
  const exactControl = value.initialModifiers.control && !value.initialModifiers.shift && !value.initialModifiers.alt;
  return { ...structuredClone(value), mode: value.targetCount > 1 && exactControl ? 'rotate' : 'resize' };
}

/** Shared jF4A projection after the controller mode has been captured. Rotation
 * and resize use the same grid producer; their downstream geometry is separate.
 * Native Moved finalizes without CbNX, so this is a pointer-move operation. */
export function projectSelectionPointerInput(original: SelectionPointerInputOriginal,
  frame: SelectionPointerInputFrame): SelectionPointerInputResult {
  try {
    options(original); point(frame.absolutePoint); rect(frame.currentBounds); modifiers(frame.modifiers);
    if (original.mode !== 'resize' && original.mode !== 'rotate') throw Error('Invalid captured selection controller mode');
    const rawDelta = { x: frame.absolutePoint.x - original.initialHotzonePoint.x,
      y: frame.absolutePoint.y - original.initialHotzonePoint.y };
    point(rawDelta);
    const trace: SelectionPointerInputTrace = { mode: original.mode, rawModifiers: { ...frame.modifiers },
      snap: frame.modifiers.alt ? 'bypassed' : 'off', correction: { x: 0, y: 0 } };
    if (original.grid.enabled && !frame.modifiers.alt) {
      trace.snap = 'grid';
      trace.candidate = selectionPointerCandidate(frame.currentBounds, frame.absolutePoint, original.handle,
        original.freedom, frame.modifiers.shift);
      trace.correction = selectionPointerGridCorrection(trace.candidate, opposite(original.handle), original.grid,
        frame.modifiers.shift);
    }
    // Preserve source operation order: correction is added to the absolute
    // pointer before subtracting the captured hot-zone anchor.
    const delta = { x: frame.absolutePoint.x + trace.correction.x - original.initialHotzonePoint.x,
      y: frame.absolutePoint.y + trace.correction.y - original.initialHotzonePoint.y };
    point(delta);
    return { ok: true, rawDelta, delta,
      layoutModifiers: { shift: frame.modifiers.shift, control: false, alt: false }, trace };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Existing resize-only entry keeps its explicit mode guard. Call the shared
 * projection from a separately admitted rotation controller, never by changing
 * the captured mode to make a resize request pass validation. */
export function planSelectionPointerInput(original: SelectionPointerInputOriginal,
  frame: SelectionPointerInputFrame): SelectionPointerInputResult {
  if (original.mode !== 'resize') return { ok: false, reason: 'Selection rotation controller input is not supported' };
  return projectSelectionPointerInput(original, frame);
}
