import type { SelectionLayoutRect, SelectionLayoutServices } from './selection-layout';

/** Retained H5px finite, nonnegative domain. Sentinel/NaN rectangles cannot
 * enter the product planner. Strict epsilon matters for a zero-width label. */
export function unionSelectionAuthorRectangles(a: SelectionLayoutRect, b: SelectionLayoutRect): SelectionLayoutRect {
  for (const rectangle of [a, b]) {
    if (Object.values(rectangle).some(value => !Number.isFinite(value)) || rectangle.width < 0 || rectangle.height < 0)
      throw Error('Selection union requires finite nonnegative rectangles');
  }
  if (Math.abs(a.width) < 1e-5 || Math.abs(a.height) < 1e-5) return { ...b };
  if (Math.abs(b.width) < 1e-5 || Math.abs(b.height) < 1e-5) return { ...a };
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y };
}

export const selectionAuthorGeometry: Omit<SelectionLayoutServices, 'measureText'> = {
  // KJm7 MinWidth/MinHeight are 1 in the admitted no-transform inheritance path.
  readMinimumSize: () => ({ width: 1, height: 1 }),
  // Product measurement is in unscaled CSS pixels regardless of canvas zoom.
  // Original Direct2D uses inverse render matrices; their DPI equivalence to
  // this browser service is not established by a UI zoom value.
  convertIndicatorInset: () => ({ width: 2, height: 2 }),
  unionRectangles: unionSelectionAuthorRectangles,
};
